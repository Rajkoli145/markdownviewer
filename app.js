/* ============================================================
   Markdown Viewer — app logic
   ============================================================ */
(() => {
  "use strict";

  /* ---------- DOM ---------- */
  const $ = (s) => document.querySelector(s);
  const app = $("#app");
  const editor = $("#editor");
  const preview = $("#preview");
  const gutter = $("#gutter");
  const surface = $("#surface");
  const previewPane = $("#previewPane");
  const editorPane = $("#editorPane");
  const menuBtn = $("#menuBtn");
  const themeBtn = $("#themeBtn");
  const exportBtn = $("#exportBtn");
  const openBtn = $("#openBtn");
  const shortcutsBtn = $("#shortcutsBtn");
  const shortcutsModal = $("#shortcutsModal");
  const modalCloseBtn = $("#modalCloseBtn");
  const statWords = $("#statStats");
  const statSaved = $("#statSaved");
  const statPos = $("#statPos");
  const statCloud = $("#statCloud");
  const statPath = $("#statPath");

  // Sidebar & Explorer DOM
  const sidebar = $("#sidebar");
  const sidebarGutter = $("#sidebarGutter");
  const sidebarToggleBtn = $("#sidebarToggleBtn");
  const newFileBtn = $("#newFileBtn");
  const newFolderBtn = $("#newFolderBtn");
  const fileSearch = $("#fileSearch");
  const fileTree = $("#fileTree");
  const activeFileName = $("#activeFileName");
  const breadcrumbFolder = $("#breadcrumbFolder");

  // Cloud Sync DOM
  const syncBtn = $("#syncBtn");
  const syncBtnLabel = $("#syncBtnLabel");
  const sidebarSyncBtn = $("#sidebarSyncBtn");
  const cloudBtn = $("#cloudBtn");
  const cloudStatusBtn = $("#cloudStatusBtn");
  const cloudModal = $("#cloudModal");
  const cloudModalCloseBtn = $("#cloudModalCloseBtn");
  const cloudUrlInput = $("#cloudUrlInput");
  const cloudKeyInput = $("#cloudKeyInput");
  const cloudConnectBtn = $("#cloudConnectBtn");
  const cloudDisconnectBtn = $("#cloudDisconnectBtn");
  const cloudStatusMsg = $("#cloudStatusMsg");
  const sqlCopyBtn = $("#sqlCopyBtn");

  /* ---------- Persistence ---------- */
  const KEY = {
    text: "mdv.text",
    theme: "mdv.theme",
    editor: "mdv.editor",
    split: "mdv.split",
    sidebar: "mdv.sidebar",
    sidebarSplit: "mdv.sidebarSplit",
    items: "mdv.items",
    activeId: "mdv.activeId",
    cloudUrl: "mdv.cloud.url",
    cloudKey: "mdv.cloud.key",
  };
  const store = {
    get(k, fallback) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? fallback : v;
      } catch { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch { /* private mode */ }
    },
  };

  const WELCOME = `# Markdown Viewer

A minimal, focused place to write and read **Markdown**.

## Features

- Live preview as you type
- Toggle the editor away with the ☰ button — or \`⌘\\\` / \`⌘B\`
- Dark & light themes (\`⌘D\`)
- Full keyboard shortcuts: press \`⌘/\` for cheat sheet
- Everything saves to your browser automatically

## Writing basics

| Syntax | Result |
| :-- | --: |
| \`**bold**\` | **bold** |
| \`*italic*\` | *italic* |
| \`~~gone~~\` | ~~gone~~ |

> "Simplicity is the ultimate sophistication."
> — Leonardo da Vinci

1. Write on the left
2. Read on the right
3. Drag the divider to rebalance

\`\`\`js
const focus = "less, but better";
\`\`\`

- [x] ship a beautiful viewer
- [ ] write something great in it
`;

  /* ============================================================
     Markdown engine — safe by construction
     (escape everything, then build HTML via whitelisted patterns)
     ============================================================ */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ESC[c]);
  const escapeAttr = (url) => esc(url).replace(/`/g, "%60");

  function safeUrl(raw) {
    const t = raw.trim();
    if (/^(https?:|mailto:|#|\/)/i.test(t)) return t;
    if (/^[^:\s]+\.[^:\s]{2,}$/i.test(t) && !t.includes("..")) {
      return "https://" + t; // bare domains like example.com
    }
    return null; // block javascript:, data:, vbscript:, etc.
  }

  /* ---------- inline ---------- */
  function renderInline(text) {
    const s = esc(text);
    let out = "";
    let i = 0;

    while (i < s.length) {
      const rest = s.slice(i);
      let m;

      // images ![alt](src)
      m = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/);
      if (m) {
        const url = safeUrl(m[2]);
        out += url
          ? `<img src="${escapeAttr(url)}" alt="${m[1]}" />`
          : `<em>[image: ${m[1]}]</em>`;
        i += m[0].length;
        continue;
      }

      // links [text](href)
      m = rest.match(/^\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/);
      if (m) {
        const url = safeUrl(m[2]);
        out += url
          ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${renderInline(m[1])}</a>`
          : renderInline(m[1]);
        i += m[0].length;
        continue;
      }

      // inline code
      m = rest.match(/^`([^`]+)`/);
      if (m) { out += `<code>${m[1]}</code>`; i += m[0].length; continue; }

      // bold + italic
      m = rest.match(/^\*\*\*([^*]+)\*\*\*/);
      if (m) { out += `<strong><em>${m[1]}</em></strong>`; i += m[0].length; continue; }

      // bold
      m = rest.match(/^\*\*([^*]+)\*\*/);
      if (m) { out += `<strong>${m[1]}</strong>`; i += m[0].length; continue; }
      m = rest.match(/^__([^_]+)__/);
      if (m) { out += `<strong>${m[1]}</strong>`; i += m[0].length; continue; }

      // italic
      m = rest.match(/^\*([^*]+)\*/);
      if (m) { out += `<em>${m[1]}</em>`; i += m[0].length; continue; }
      m = rest.match(/^_([^_]+)_/);
      if (m) { out += `<em>${m[1]}</em>`; i += m[0].length; continue; }

      // strikethrough
      m = rest.match(/^~~([^~]+)~~/);
      if (m) { out += `<del>${m[1]}</del>`; i += m[0].length; continue; }

      // autolink: http(s)
      m = rest.match(/^https?:\/\/[^\s<]+/);
      if (m) {
        out += `<a href="${m[0]}" target="_blank" rel="noopener noreferrer">${m[0]}</a>`;
        i += m[0].length;
        continue;
      }

      // autolink: bare domain (www.foo.com, foo.dev, …)
      m = rest.match(/^(?:^|[\s(])((?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|app|ai|co|me|so|sh|gg|xyz|to)(?:\/[^\s<]*)?)/i);
      if (m) {
        const lead = /^\s/.test(m[0]) ? m[0][0] : "";
        const url = m[1];
        out += `${lead}<a href="https://${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        i += m[0].length;
        continue;
      }

      // plain character
      out += s[i];
      i += 1;
    }
    return out;
  }

  /* ---------- blocks ---------- */
  function renderBlocks(src) {
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let m;

    const peek = (k = 0) => lines[i + k] ?? "";

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { i++; continue; }

      // fenced code
      m = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)\s*$/);
      if (m) {
        const lang = m[2];
        const closeRe = new RegExp(`^${m[1][0]}{3,}\\s*$`);
        const body = [];
        i++;
        while (i < lines.length && !closeRe.test(lines[i])) {
          body.push(lines[i]);
          i++;
        }
        i++; // closing fence (or EOF)
        out.push(`<pre data-lang="${esc(lang)}"><code>${esc(body.join("\n"))}</code></pre>`);
        continue;
      }

      // heading
      m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const level = m[1].length;
        out.push(`<h${level}>${renderInline(m[2].replace(/\s#+\s*$/, ""))}</h${level}>`);
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        out.push("<hr />");
        i++;
        continue;
      }

      // blockquote
      if (/^\s*>/.test(line)) {
        const body = [];
        while (
          i < lines.length &&
          (/^\s*>/.test(lines[i]) ||
            (body.length && lines[i].trim() &&
             !/^\s*(?:#{1,6}\s|`{3,}|~{3,})/.test(lines[i])))
        ) {
          body.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push(`<blockquote>${renderBlocks(body.join("\n"))}</blockquote>`);
        continue;
      }

      // lists
      const li = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
      if (li) {
        const ordered = /\d/.test(li[2]);
        const baseIndent = li[1].length;
        const items = [];
        let para = [];

        const flushPara = () => {
          if (para.length) {
            items.push({ t: "p", text: para.join(" ") });
            para = [];
          }
        };

        while (i < lines.length) {
          const cur = lines[i];
          if (!cur.trim()) break;

          const cm = cur.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/);
          if (cm && cm[1].length >= baseIndent) {
            flushPara();
            let content = cm[3];
            let task = null;
            const tm = content.match(/^\[([ xX])\]\s+(.*)$/);
            if (tm) {
              task = tm[1] !== " ";
              content = tm[2];
            }
            items.push({ t: task === null ? "li" : "task", done: task, text: content });
            i++;
            continue;
          }

          // continuation lines: deeper indent (incl. sub-list content)
          if (cm && cm[1].length > baseIndent) { i++; continue; }

          // loose paragraph continuation inside a list item
          if (items.length && /^\s{2,}/.test(cur)) {
            para.push(cur.trim());
            i++;
            continue;
          }

          // lazy continuation: plain line continues the last item
          if (items.length && /^\S/.test(cur) && para.length === 0) {
            const last = items[items.length - 1];
            if (last && last.t !== "p") {
              items[items.length - 1] = { ...last, text: last.text + " " + cur.trim() };
              i++;
              continue;
            }
          }

          flushPara();
          break;
        }
        flushPara();

        const tag = ordered ? "ol" : "ul";
        let html = `<${tag}>`;
        for (const it of items) {
          if (it.t === "p") {
            html += `<li>${renderInline(it.text)}</li>`;
            continue;
          }
          const check = it.t === "task"
            ? `<input type="checkbox" disabled${it.done ? " checked" : ""} />`
            : "";
          html += `<li>${check}${renderInline(it.text)}</li>`;
        }
        out.push(html + `</${tag}>`);
        continue;
      }

      // table: row followed by a |---|---| separator
      if (
        /\|/.test(line) &&
        /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(peek(1)) &&
        /-/.test(peek(1))
      ) {
        const parseRow = (row) => {
          let r = row.trim();
          if (r.startsWith("|")) r = r.slice(1);
          if (r.endsWith("|")) r = r.slice(0, -1);
          return r.split("|").map((c) => c.trim());
        };
        const alignOf = (c) => {
          const l = c.startsWith(":");
          const r = c.endsWith(":");
          if (l && r) return ' style="text-align:center"';
          if (r) return ' style="text-align:right"';
          return "";
        };
        const header = parseRow(line);
        const aligns = parseRow(peek(1)).map(alignOf);
        i += 2;

        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          rows.push(parseRow(lines[i]));
          i++;
        }

        let html = "<table><thead><tr>";
        header.forEach((c, k) => {
          html += `<th${aligns[k] || ""}>${renderInline(c)}</th>`;
        });
        html += "</tr></thead>";
        if (rows.length) {
          html += "<tbody>";
          for (const r of rows) {
            html += "<tr>" + r.map((c, k) => `<td${aligns[k] || ""}>${renderInline(c)}</td>`).join("") + "</tr>";
          }
          html += "</tbody>";
        }
        out.push(html + "</table>");
        continue;
      }

      // paragraph: consume until blank line or a block starter
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,6}\s|\s*>|\s*(?:-{3,}|\*{3,}|_{3,})\s*$|(`{3,}|~{3,})|\s*(?:[-*+]|\d{1,9}[.)])\s)/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) {
        out.push(`<p>${renderInline(para.join("\n")).replace(/\n/g, "<br />")}</p>`);
      } else {
        i++; // safety against infinite loops
      }
    }

    return out.join("\n");
  }

  const renderMarkdown = (src) => renderBlocks(src.replace(/\u0000/g, ""));

  /* ============================================================
     Rendering pipeline
     ============================================================ */
  let renderTimer = null;
  const scheduleRender = () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 80);
  };

  /* ============================================================
     Cloud Sync (Supabase REST API)
     ============================================================ */
  const DEFAULT_SUPABASE_URL = "https://ksyxioqmkwznzrqmsotf.supabase.co";
  let DEFAULT_SUPABASE_KEY = ""; // Optional hardcoded key when provided

  const CloudSync = {
    getUrl() {
      return (store.get(KEY.cloudUrl, DEFAULT_SUPABASE_URL) || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
    },
    getKey() {
      if (DEFAULT_SUPABASE_KEY) return DEFAULT_SUPABASE_KEY;
      return (store.get(KEY.cloudKey, "") || "").trim();
    },
    setKey(k) {
      store.set(KEY.cloudKey, (k || "").trim());
    },
    isConnected() {
      return Boolean(this.getKey());
    },
    getHeaders() {
      const key = this.getKey();
      return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      };
    },
    async testConnection(url, key) {
      if (arguments.length === 1) {
        key = url;
        url = this.getUrl();
      }
      url = (url || this.getUrl()).trim().replace(/\/+$/, "");
      key = (key || this.getKey()).trim();
      const res = await fetch(`${url}/rest/v1/markdown_items?select=id&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return true;
    },
    async fetchAll() {
      if (!this.isConnected()) return null;
      const res = await fetch(`${this.getUrl()}/rest/v1/markdown_items?select=*`, {
        headers: {
          apikey: this.getKey(),
          Authorization: `Bearer ${this.getKey()}`
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return await res.json();
    },
    async upsert(item) {
      if (!this.isConnected()) return;
      const payload = {
        id: item.id,
        name: item.name,
        type: item.type,
        parent_id: item.parent_id || null,
        content: item.content || "",
        updated_at: item.updated_at || new Date().toISOString()
      };
      await fetch(`${this.getUrl()}/rest/v1/markdown_items`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
    },
    async upsertBatch(batch) {
      if (!this.isConnected() || !batch.length) return;
      const payload = batch.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        parent_id: item.parent_id || null,
        content: item.content || "",
        updated_at: item.updated_at || new Date().toISOString()
      }));
      await fetch(`${this.getUrl()}/rest/v1/markdown_items`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
    },
    async deleteItem(id) {
      if (!this.isConnected()) return;
      await fetch(`${this.getUrl()}/rest/v1/markdown_items?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.getHeaders()
      });
      await fetch(`${this.getUrl()}/rest/v1/markdown_items?parent_id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.getHeaders()
      });
    }
  };

  /* ============================================================
     Folder & File Storage Engine
     ============================================================ */
  let items = [];
  let activeId = null;
  const openFolderIds = new Set(["folder-notes"]);
  let cloudSyncTimer = null;

  function initItems() {
    let saved = null;
    try {
      const raw = localStorage.getItem(KEY.items);
      if (raw) saved = JSON.parse(raw);
    } catch { /* empty */ }

    if (!Array.isArray(saved) || saved.length === 0) {
      const now = new Date().toISOString();
      const existingText = store.get(KEY.text, null);
      const folderId = "folder-notes";
      const welcomeId = "file-welcome";

      saved = [
        {
          id: folderId,
          name: "Notes",
          type: "folder",
          parent_id: null,
          created_at: now,
          updated_at: now
        },
        {
          id: "file-quick-thoughts",
          name: "Quick Thoughts.md",
          type: "file",
          parent_id: folderId,
          content: `# Quick Thoughts\n\n- Folders and files are now organized in the sidebar!\n- Create new folders, sub-notes, and switch between them.\n- Connect your Supabase database in Cloud Settings for instant cloud sync.\n`,
          created_at: now,
          updated_at: now
        },
        {
          id: welcomeId,
          name: "welcome.md",
          type: "file",
          parent_id: null,
          content: existingText || WELCOME,
          created_at: now,
          updated_at: now
        }
      ];
      store.set(KEY.items, JSON.stringify(saved));
    }

    items = saved;
    activeId = store.get(KEY.activeId, null);
    if (!activeId || !items.find((it) => it.id === activeId && it.type === "file")) {
      const firstFile = items.find((it) => it.type === "file");
      activeId = firstFile ? firstFile.id : null;
      if (activeId) store.set(KEY.activeId, activeId);
    }
  }

  function getActiveItem() {
    return items.find((it) => it.id === activeId);
  }

  function saveActiveItem() {
    const item = getActiveItem();
    if (item) {
      item.content = editor.value;
      item.updated_at = new Date().toISOString();
      store.set(KEY.items, JSON.stringify(items));
      store.set(KEY.text, editor.value);
    }
  }

  function getFolderPath(folderId) {
    const parts = [];
    let cur = folderId;
    while (cur) {
      const f = items.find((it) => it.id === cur && it.type === "folder");
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parent_id;
    }
    return parts.length ? parts.join(" / ") + " /" : "";
  }

  function updateBreadcrumb() {
    const item = getActiveItem();
    if (!item) {
      if (breadcrumbFolder) breadcrumbFolder.textContent = "";
      if (activeFileName) activeFileName.value = "";
      if (statPath) statPath.textContent = "";
      return;
    }
    const path = getFolderPath(item.parent_id);
    if (breadcrumbFolder) breadcrumbFolder.textContent = path;
    if (activeFileName) activeFileName.value = item.name;
    if (statPath) statPath.textContent = path ? `${path} ${item.name}` : item.name;
  }

  function switchFile(id) {
    if (activeId === id) return;
    saveActiveItem();
    activeId = id;
    store.set(KEY.activeId, activeId);
    const item = getActiveItem();
    if (item) {
      editor.value = item.content || "";
      scheduleRender();
      updateBreadcrumb();
      updateCaret();
      renderFileTree();
    }
  }

  function createFile(name, parent_id = null) {
    saveActiveItem();
    const finalName = (name || prompt("Note name:", "Untitled.md") || "Untitled.md").trim();
    if (!finalName) return;
    const withExt = finalName.endsWith(".md") || finalName.endsWith(".markdown") ? finalName : finalName + ".md";
    const now = new Date().toISOString();
    const newItem = {
      id: "file-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: withExt,
      type: "file",
      parent_id: parent_id,
      content: `# ${withExt.replace(/\.md$/i, "")}\n\n`,
      created_at: now,
      updated_at: now
    };
    items.push(newItem);
    if (parent_id) openFolderIds.add(parent_id);
    store.set(KEY.items, JSON.stringify(items));
    switchFile(newItem.id);
    renderFileTree();
    editor.focus();
    if (CloudSync.isConnected()) {
      CloudSync.upsert(newItem).catch(() => updateCloudStatus("error"));
    }
  }

  function createFolder(name, parent_id = null) {
    const finalName = (name || prompt("Folder name:", "New Folder") || "").trim();
    if (!finalName) return;
    const now = new Date().toISOString();
    const newFolder = {
      id: "folder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: finalName,
      type: "folder",
      parent_id: parent_id,
      created_at: now,
      updated_at: now
    };
    items.push(newFolder);
    openFolderIds.add(newFolder.id);
    if (parent_id) openFolderIds.add(parent_id);
    store.set(KEY.items, JSON.stringify(items));
    renderFileTree();
    if (CloudSync.isConnected()) {
      CloudSync.upsert(newFolder).catch(() => updateCloudStatus("error"));
    }
  }

  function renameItem(id) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const newName = (prompt(`Rename ${item.type}:`, item.name) || "").trim();
    if (!newName || newName === item.name) return;
    item.name = newName;
    item.updated_at = new Date().toISOString();
    store.set(KEY.items, JSON.stringify(items));
    updateBreadcrumb();
    renderFileTree();
    if (CloudSync.isConnected()) {
      CloudSync.upsert(item).catch(() => updateCloudStatus("error"));
    }
  }

  function deleteItem(id) {
    const item = items.find((it) => it.id === id);
    if (!item) return;

    if (item.type === "folder") {
      if (!confirm(`Delete folder "${item.name}" and all notes inside?`)) return;
    } else {
      if (!confirm(`Delete note "${item.name}"?`)) return;
    }

    const toDeleteIds = new Set([id]);
    function collectChildren(parentId) {
      items.filter((it) => it.parent_id === parentId).forEach((child) => {
        toDeleteIds.add(child.id);
        if (child.type === "folder") collectChildren(child.id);
      });
    }
    collectChildren(id);

    items = items.filter((it) => !toDeleteIds.has(it.id));

    if (toDeleteIds.has(activeId)) {
      const nextFile = items.find((it) => it.type === "file");
      if (nextFile) {
        activeId = nextFile.id;
        editor.value = nextFile.content || "";
      } else {
        createFile("welcome.md", null);
        return;
      }
    }

    store.set(KEY.items, JSON.stringify(items));
    store.set(KEY.activeId, activeId);
    updateBreadcrumb();
    scheduleRender();
    renderFileTree();

    if (CloudSync.isConnected()) {
      CloudSync.deleteItem(id).catch(() => updateCloudStatus("error"));
    }
  }

  function renderFileTree() {
    if (!fileTree) return;
    const query = (fileSearch ? fileSearch.value : "").trim().toLowerCase();

    let filtered = items;
    if (query) {
      filtered = items.filter((it) => it.name.toLowerCase().includes(query) || (it.content && it.content.toLowerCase().includes(query)));
    }

    if (filtered.length === 0) {
      fileTree.innerHTML = `<div class="tree-empty">No ${query ? "matching notes" : "files found"}.<br><button class="btn-primary" style="margin-top:10px; font-size:11px; padding:4px 10px;" id="emptyNewFileBtn">+ Create Note</button></div>`;
      const btn = $("#emptyNewFileBtn");
      if (btn) btn.addEventListener("click", () => createFile("Untitled.md"));
      return;
    }

    function renderLevel(parentId) {
      const children = filtered.filter((it) => it.parent_id === parentId);
      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      let html = "";
      for (const item of children) {
        if (item.type === "folder") {
          const isOpen = openFolderIds.has(item.id) || !!query;
          const subCount = items.filter((it) => it.parent_id === item.id).length;
          html += `
            <div class="tree-folder ${isOpen ? "open" : ""}" data-id="${item.id}">
              <div class="tree-folder-header">
                <span class="folder-arrow">
                  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3.5l4.5 4.5-4.5 4.5"/></svg>
                </span>
                <svg class="folder-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
                </svg>
                <span class="folder-title" title="${esc(item.name)}">${esc(item.name)}</span>
                <span class="folder-count">${subCount}</span>
                <div class="tree-actions">
                  <button class="tree-action-btn action-add-file" title="New file inside folder" data-id="${item.id}">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v10M3 8h10"/></svg>
                  </button>
                  <button class="tree-action-btn action-rename" title="Rename folder" data-id="${item.id}">
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z"/></svg>
                  </button>
                  <button class="tree-action-btn action-delete" title="Delete folder" data-id="${item.id}">
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h10M6 5V3h4v2M5 5v8h6V5"/></svg>
                  </button>
                </div>
              </div>
              <div class="tree-children">
                ${renderLevel(item.id)}
              </div>
            </div>
          `;
        } else {
          const isActive = item.id === activeId;
          html += `
            <div class="tree-file ${isActive ? "active" : ""}" data-id="${item.id}" title="${esc(item.name)}">
              <svg class="file-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4.5 3.5h7l4 4v9a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 3 16.5v-11.5A1.5 1.5 0 0 1 4.5 3.5z"/>
                <path d="M11.5 3.5v4h4M6.5 11.5h7M6.5 14.5h4"/>
              </svg>
              <span class="file-title">${esc(item.name)}</span>
              <div class="tree-actions">
                <button class="tree-action-btn action-rename" title="Rename" data-id="${item.id}">
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z"/></svg>
                </button>
                <button class="tree-action-btn action-delete" title="Delete" data-id="${item.id}">
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h10M6 5V3h4v2M5 5v8h6V5"/></svg>
                </button>
              </div>
            </div>
          `;
        }
      }
      return html;
    }

    fileTree.innerHTML = renderLevel(null);
  }

  function updateCloudStatus(status, text) {
    const isConn = CloudSync.isConnected();
    const dots = document.querySelectorAll(".cloud-status-dot");
    dots.forEach((d) => {
      d.className = "cloud-status-dot " + (status || (isConn ? "synced" : ""));
    });

    if (syncBtn) {
      if (status === "syncing") {
        syncBtn.className = "sync-btn syncing";
        if (syncBtnLabel) syncBtnLabel.textContent = "Syncing…";
      } else if (status === "synced") {
        syncBtn.className = "sync-btn synced";
        if (syncBtnLabel) syncBtnLabel.textContent = "Synced!";
      } else if (status === "error") {
        syncBtn.className = "sync-btn error";
        if (syncBtnLabel) syncBtnLabel.textContent = "Sync Error";
      } else {
        syncBtn.className = "sync-btn" + (isConn ? " connected" : "");
        if (syncBtnLabel) syncBtnLabel.textContent = "Sync";
      }
    }

    if (sidebarSyncBtn) {
      if (status === "syncing") {
        sidebarSyncBtn.classList.add("syncing");
      } else {
        sidebarSyncBtn.classList.remove("syncing");
      }
    }

    if (statCloud) {
      if (status === "synced") {
        statCloud.innerHTML = `☁️ Synced`;
        statCloud.title = "Supabase Cloud: Synced and active (click to sync/configure)";
      } else if (status === "syncing") {
        statCloud.innerHTML = `☁️ Syncing…`;
        statCloud.title = "Supabase Cloud: Sync in progress";
      } else if (status === "error") {
        statCloud.innerHTML = `⚠️ Cloud error`;
        statCloud.title = text || "Supabase Cloud: Connection or table error (click to configure)";
      } else {
        statCloud.innerHTML = isConn ? `☁️ Ready` : `☁️ Local storage`;
        statCloud.title = isConn ? "Supabase Cloud ready (click to sync)" : "Operating in local storage (click to set Supabase anon key)";
      }
    }
  }

  async function performFullCloudSync() {
    if (!CloudSync.isConnected()) return;
    updateCloudStatus("syncing");

    try {
      const remoteItems = await CloudSync.fetchAll();
      if (!Array.isArray(remoteItems)) return;

      const remoteMap = new Map(remoteItems.map((r) => [r.id, r]));
      const localMap = new Map(items.map((l) => [l.id, l]));

      const toUpload = [];
      const merged = [];

      for (const local of items) {
        const remote = remoteMap.get(local.id);
        if (!remote) {
          toUpload.push(local);
          merged.push(local);
        } else {
          const localTime = new Date(local.updated_at || 0).getTime();
          const remoteTime = new Date(remote.updated_at || 0).getTime();
          if (localTime >= remoteTime) {
            toUpload.push(local);
            merged.push(local);
          } else {
            merged.push(remote);
          }
        }
      }

      for (const remote of remoteItems) {
        if (!localMap.has(remote.id)) {
          merged.push(remote);
        }
      }

      items = merged;
      store.set(KEY.items, JSON.stringify(items));

      if (toUpload.length) {
        await CloudSync.upsertBatch(toUpload);
      }

      const cur = getActiveItem();
      if (cur) {
        editor.value = cur.content || "";
        scheduleRender();
      }

      renderFileTree();
      updateBreadcrumb();
      updateCloudStatus("synced");
    } catch (err) {
      console.error("Full cloud sync error:", err);
      updateCloudStatus("error", err.message);
      throw err;
    }
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    statSaved.textContent = "Saving…";
    statSaved.classList.remove("flash");
    saveTimer = setTimeout(() => {
      saveActiveItem();
      statSaved.textContent = "Saved";
      statSaved.classList.add("flash");
      setTimeout(() => statSaved.classList.remove("flash"), 1200);
    }, 500);

    if (CloudSync.isConnected()) {
      clearTimeout(cloudSyncTimer);
      updateCloudStatus("syncing");
      cloudSyncTimer = setTimeout(async () => {
        try {
          const item = getActiveItem();
          if (item) {
            await CloudSync.upsert(item);
            updateCloudStatus("synced");
          }
        } catch (err) {
          console.error("Cloud auto-sync error:", err);
          updateCloudStatus("error");
        }
      }, 1500);
    }
  }

  function scheduleSaveNow() {
    clearTimeout(saveTimer);
    saveActiveItem();
    statSaved.textContent = "Saved";
    statSaved.classList.add("flash");
    setTimeout(() => statSaved.classList.remove("flash"), 1200);

    if (CloudSync.isConnected()) {
      const item = getActiveItem();
      if (item) CloudSync.upsert(item).catch(() => updateCloudStatus("error"));
    }
  }

  function render() {
    const src = editor.value;
    const isEmpty = src.trim().length === 0;
    const prevScroll = previewPane.scrollTop;
    const atBottom =
      previewPane.scrollHeight - previewPane.scrollTop - previewPane.clientHeight < 4;
    const wasEmpty = preview.classList.contains("is-empty");

    preview.classList.toggle("is-empty", isEmpty);
    preview.innerHTML = isEmpty
      ? `<div class="empty-hint">Preview appears here — start typing on the left</div>`
      : renderMarkdown(src);

    // keep the user's reading position stable across re-renders
    if (!isEmpty) {
      if (atBottom) {
        previewPane.scrollTop = previewPane.scrollHeight;
      } else if (!wasEmpty) {
        previewPane.scrollTop = prevScroll;
      }
    }

    updateStats(src);
  }

  /* ---------- status ---------- */
  function updateStats(src) {
    const words = (src.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
    statWords.textContent = `${words.toLocaleString()} word${words === 1 ? "" : "s"}`;
  }

  function updateCaret() {
    const upto = editor.value.slice(0, editor.selectionStart);
    const nl = upto.split("\n");
    statPos.textContent = `Ln ${nl.length}, Col ${nl[nl.length - 1].length + 1}`;
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set(KEY.theme, t);
  }
  themeBtn.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  /* ---------- editor show / hide ---------- */
  function setEditorVisible(visible, persist = true) {
    app.classList.toggle("editor-hidden", !visible);
    menuBtn.classList.toggle("on", visible);
    menuBtn.setAttribute("aria-pressed", String(visible));
    if (persist) store.set(KEY.editor, visible ? "1" : "0");
  }
  menuBtn.addEventListener("click", () =>
    setEditorVisible(app.classList.contains("editor-hidden"))
  );

  /* ---------- pane resize ---------- */
  function initGutter() {
    let dragging = false;
    let raf = 0;

    gutter.addEventListener("pointerdown", (e) => {
      dragging = true;
      gutter.classList.add("dragging");
      gutter.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    gutter.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        let pct = ((e.clientX - rect.left) / rect.width) * 100;
        pct = Math.min(75, Math.max(20, pct));
        editorPane.style.flexBasis = pct + "%";
        store.set(KEY.split, String(Math.round(pct)));
      });
    });

    const endDrag = () => {
      dragging = false;
      gutter.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    gutter.addEventListener("pointerup", endDrag);
    gutter.addEventListener("pointercancel", endDrag);
  }

  /* ---------- scroll sync (proportional) ---------- */
  function initScrollSync() {
    let syncing = false;
    let raf = 0;

    editor.addEventListener("scroll", () => {
      if (syncing || app.classList.contains("editor-hidden")) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const eMax = editor.scrollHeight - editor.clientHeight;
        const pMax = previewPane.scrollHeight - previewPane.clientHeight;
        if (eMax <= 0 || pMax <= 0) return;
        syncing = true;
        previewPane.scrollTop = (editor.scrollTop / eMax) * pMax;
        requestAnimationFrame(() => { syncing = false; });
      });
    }, { passive: true });
  }

  editor.addEventListener("input", () => {
    scheduleRender();
    scheduleSave();
    updateCaret();
  });
  editor.addEventListener("keyup", updateCaret);
  editor.addEventListener("click", updateCaret);

  /* ---------- text editing & formatting helpers ---------- */
  function insertText(text) {
    editor.focus();
    let handled = false;
    try {
      handled = document.execCommand("insertText", false, text);
    } catch {
      handled = false;
    }
    if (!handled) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.setRangeText(text, start, end, "end");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    scheduleRender();
    scheduleSave();
    updateCaret();
  }

  function applyWrap(prefix, suffix = prefix) {
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;
    const selected = val.slice(start, end);

    // If selection is already wrapped with prefix & suffix, unwrap
    if (
      selected.length >= prefix.length + suffix.length &&
      selected.startsWith(prefix) &&
      selected.endsWith(suffix) &&
      (prefix !== "*" || (!selected.startsWith("**") && !selected.endsWith("**")))
    ) {
      const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
      editor.setSelectionRange(start, end);
      insertText(unwrapped);
      editor.setSelectionRange(start, start + unwrapped.length);
      return;
    }

    // If cursor/selection is directly surrounded by delimiters
    const before = val.slice(Math.max(0, start - prefix.length), start);
    const after = val.slice(end, end + suffix.length);
    if (
      before === prefix &&
      after === suffix &&
      (prefix !== "*" || (val.slice(Math.max(0, start - 2), start) !== "**" && val.slice(end, end + 2) !== "**"))
    ) {
      editor.setSelectionRange(start - prefix.length, end + suffix.length);
      insertText(selected);
      editor.setSelectionRange(start - prefix.length, start - prefix.length + selected.length);
      return;
    }

    // Otherwise wrap
    if (selected.length > 0) {
      const wrapped = prefix + selected + suffix;
      editor.setSelectionRange(start, end);
      insertText(wrapped);
      editor.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    } else {
      const emptyWrap = prefix + suffix;
      insertText(emptyWrap);
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
    }
  }

  function applyLink() {
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;
    const selected = val.slice(start, end).trim();

    const isUrl = /^https?:\/\/[^\s]+$/i.test(selected);
    if (isUrl) {
      const text = `[title](${selected})`;
      editor.setSelectionRange(start, end);
      insertText(text);
      editor.setSelectionRange(start + 1, start + 6);
    } else if (selected.length > 0) {
      const text = `[${selected}](url)`;
      editor.setSelectionRange(start, end);
      insertText(text);
      const urlStart = start + 1 + selected.length + 2;
      editor.setSelectionRange(urlStart, urlStart + 3);
    } else {
      const text = "[title](https://)";
      insertText(text);
      editor.setSelectionRange(start + 1, start + 6);
    }
  }

  function applyCodeBlock() {
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;
    const selected = val.slice(start, end);

    if (selected.length > 0) {
      const text = "```\n" + selected + "\n```";
      editor.setSelectionRange(start, end);
      insertText(text);
      editor.setSelectionRange(start + 4, start + 4 + selected.length);
    } else {
      const text = "```\n\n```";
      insertText(text);
      editor.setSelectionRange(start + 4, start + 4);
    }
  }

  function transformSelectedLines(fn) {
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = val.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = val.length;

    const originalBlock = val.slice(lineStart, lineEnd);
    const lines = originalBlock.split("\n");
    const newLines = fn(lines);
    const newBlock = newLines.join("\n");

    editor.setSelectionRange(lineStart, lineEnd);
    insertText(newBlock);
    editor.setSelectionRange(lineStart, lineStart + newBlock.length);
  }

  function applyHeading(level) {
    transformSelectedLines((lines) => {
      return lines.map((l) => {
        const stripped = l.replace(/^\s*#{1,6}\s+/, "");
        if (level === 0) return stripped;
        return `${"#".repeat(level)} ${stripped}`;
      });
    });
  }

  function applyList(type) {
    transformSelectedLines((lines) => {
      let allHave = true;
      for (const l of lines) {
        if (!l.trim()) continue;
        if (type === "bullet" && !/^\s*[-*+]\s+/.test(l)) allHave = false;
        if (type === "number" && !/^\s*\d+[.)]\s+/.test(l)) allHave = false;
        if (type === "task" && !/^\s*[-*+]\s+\[(?: |x|X)\]\s+/.test(l)) allHave = false;
        if (type === "quote" && !/^\s*>\s?/.test(l)) allHave = false;
      }

      let num = 1;
      return lines.map((l) => {
        if (!l.trim()) return l;
        const clean = l.replace(/^\s*(?:[-*+]\s+(?:\[(?: |x|X)\]\s+)?|\d+[.)]\s+|>\s?)/, "");
        if (allHave) return clean;
        if (type === "bullet") return `- ${clean}`;
        if (type === "number") return `${num++}. ${clean}`;
        if (type === "task") return `- [ ] ${clean}`;
        if (type === "quote") return `> ${clean}`;
        return l;
      });
    });
  }

  function applyHorizontalRule() {
    editor.focus();
    const start = editor.selectionStart;
    const val = editor.value;
    const prevChar = start > 0 ? val[start - 1] : "\n";
    const hr = (prevChar === "\n" ? "" : "\n") + "---\n";
    insertText(hr);
  }

  function duplicateCurrentLine() {
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = val.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = val.length;

    const lines = val.slice(lineStart, lineEnd);
    editor.setSelectionRange(lineEnd, lineEnd);
    insertText("\n" + lines);
    editor.setSelectionRange(start + lines.length + 1, end + lines.length + 1);
  }

  function handleTab(shiftKey) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    if (start !== end || val.slice(start, end).includes("\n")) {
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      let lineEnd = val.indexOf("\n", end);
      if (lineEnd === -1) lineEnd = val.length;

      const lines = val.slice(lineStart, lineEnd).split("\n");
      const modified = shiftKey
        ? lines.map((l) => l.replace(/^ {1,2}/, ""))
        : lines.map((l) => "  " + l);
      const newBlock = modified.join("\n");
      editor.setSelectionRange(lineStart, lineEnd);
      insertText(newBlock);
      editor.setSelectionRange(lineStart, lineStart + newBlock.length);
    } else {
      if (shiftKey) {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const beforeCursor = val.slice(lineStart, start);
        if (beforeCursor.endsWith("  ")) {
          editor.setSelectionRange(start - 2, start);
          insertText("");
        } else if (beforeCursor.endsWith(" ")) {
          editor.setSelectionRange(start - 1, start);
          insertText("");
        }
      } else {
        insertText("  ");
      }
    }
  }

  function handleEnter(e) {
    const start = editor.selectionStart;
    const val = editor.value;
    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    const line = val.slice(lineStart, start);

    // Task list
    const taskMatch = line.match(/^(\s*[-*+]\s+\[(?: |x|X)\]\s+)(.*)$/);
    if (taskMatch) {
      e.preventDefault();
      if (!taskMatch[2].trim()) {
        editor.setSelectionRange(lineStart, start);
        insertText("");
      } else {
        insertText("\n- [ ] ");
      }
      return true;
    }

    // Numbered list
    const numMatch = line.match(/^(\s*)(\d+)([.)]\s+)(.*)$/);
    if (numMatch) {
      e.preventDefault();
      if (!numMatch[4].trim()) {
        editor.setSelectionRange(lineStart, start);
        insertText("");
      } else {
        const nextNum = parseInt(numMatch[2], 10) + 1;
        insertText(`\n${numMatch[1]}${nextNum}${numMatch[3]}`);
      }
      return true;
    }

    // Unordered list
    const bulletMatch = line.match(/^(\s*[-*+]\s+)(.*)$/);
    if (bulletMatch) {
      e.preventDefault();
      if (!bulletMatch[2].trim()) {
        editor.setSelectionRange(lineStart, start);
        insertText("");
      } else {
        insertText(`\n${bulletMatch[1]}`);
      }
      return true;
    }

    // Blockquote
    const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);
    if (quoteMatch) {
      e.preventDefault();
      if (!quoteMatch[2].trim()) {
        editor.setSelectionRange(lineStart, start);
        insertText("");
      } else {
        insertText("\n> ");
      }
      return true;
    }

    return false;
  }

  const PAIRS = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'",
    "`": "`",
    "*": "*",
    "_": "_",
    "~": "~",
  };

  /* ---------- open file & new document ---------- */
  function openFile() {
    let fileInput = document.getElementById("fileInput");
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.id = "fileInput";
      fileInput.accept = ".md,.markdown,.txt";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result;
          createFile(file.name, null, content);
        };
        reader.readAsText(file);
        fileInput.value = "";
      });
    }
    fileInput.click();
  }

  function newDocument() {
    createFile("Untitled.md", null);
  }

  /* ---------- sidebar show / hide ---------- */
  function setSidebarVisible(visible, persist = true) {
    app.classList.toggle("sidebar-hidden", !visible);
    if (sidebarToggleBtn) {
      sidebarToggleBtn.classList.toggle("on", visible);
      sidebarToggleBtn.setAttribute("aria-pressed", String(visible));
    }
    if (persist) store.set(KEY.sidebar, visible ? "1" : "0");
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", () => {
      setSidebarVisible(app.classList.contains("sidebar-hidden"));
    });
  }

  if (newFileBtn) newFileBtn.addEventListener("click", () => createFile("Untitled.md"));
  if (newFolderBtn) newFolderBtn.addEventListener("click", () => createFolder("New Folder"));

  if (fileSearch) {
    fileSearch.addEventListener("input", () => {
      renderFileTree();
    });
  }

  if (activeFileName) {
    activeFileName.addEventListener("change", () => {
      const item = getActiveItem();
      if (!item) return;
      const newName = activeFileName.value.trim();
      if (newName && newName !== item.name) {
        item.name = newName;
        item.updated_at = new Date().toISOString();
        store.set(KEY.items, JSON.stringify(items));
        renderFileTree();
        if (CloudSync.isConnected()) {
          CloudSync.upsert(item).catch(() => updateCloudStatus("error"));
        }
      }
    });
    activeFileName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        activeFileName.blur();
      }
    });
  }

  if (fileTree) {
    fileTree.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".action-add-file");
      if (addBtn) {
        e.stopPropagation();
        createFile("Untitled.md", addBtn.dataset.id);
        return;
      }
      const renBtn = e.target.closest(".action-rename");
      if (renBtn) {
        e.stopPropagation();
        renameItem(renBtn.dataset.id);
        return;
      }
      const delBtn = e.target.closest(".action-delete");
      if (delBtn) {
        e.stopPropagation();
        deleteItem(delBtn.dataset.id);
        return;
      }

      const folderHeader = e.target.closest(".tree-folder-header");
      if (folderHeader) {
        const folder = folderHeader.closest(".tree-folder");
        const folderId = folder.dataset.id;
        if (openFolderIds.has(folderId)) {
          openFolderIds.delete(folderId);
        } else {
          openFolderIds.add(folderId);
        }
        renderFileTree();
        return;
      }

      const fileRow = e.target.closest(".tree-file");
      if (fileRow) {
        switchFile(fileRow.dataset.id);
      }
    });
  }

  function initSidebarGutter() {
    let dragging = false;
    let raf = 0;

    if (!sidebarGutter) return;

    sidebarGutter.addEventListener("pointerdown", (e) => {
      dragging = true;
      sidebarGutter.classList.add("dragging");
      sidebarGutter.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    sidebarGutter.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        let width = e.clientX - rect.left;
        width = Math.min(420, Math.max(160, width));
        sidebar.style.flexBasis = width + "px";
        sidebar.style.width = width + "px";
        store.set(KEY.sidebarSplit, String(Math.round(width)));
      });
    });

    const endDrag = () => {
      dragging = false;
      sidebarGutter.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    sidebarGutter.addEventListener("pointerup", endDrag);
    sidebarGutter.addEventListener("pointercancel", endDrag);
  }

  /* ---------- cloud modal & sync button ---------- */
  function openCloudModal(initialMsg) {
    if (!cloudModal) return;
    if (cloudKeyInput) cloudKeyInput.value = CloudSync.getKey();
    if (initialMsg) {
      showCloudMessage(initialMsg, "error");
    } else if (cloudStatusMsg) {
      cloudStatusMsg.style.display = "none";
    }
    cloudModal.removeAttribute("hidden");
    if (cloudKeyInput) {
      setTimeout(() => cloudKeyInput.focus(), 60);
    }
  }

  function closeCloudModal() {
    if (!cloudModal) return;
    cloudModal.setAttribute("hidden", "");
    editor.focus();
  }

  let isSyncing = false;

  async function syncNow(interactive = false) {
    if (isSyncing) return;
    if (!CloudSync.isConnected()) {
      if (interactive) {
        openCloudModal();
      }
      return;
    }

    isSyncing = true;
    updateCloudStatus("syncing");

    try {
      saveActiveItem();
      await performFullCloudSync();
      updateCloudStatus("synced");
      setTimeout(() => {
        if (!isSyncing && CloudSync.isConnected()) {
          updateCloudStatus("synced");
        }
      }, 2000);
    } catch (err) {
      console.error("Sync error:", err);
      let shortErr = err.message || "Failed";
      if (shortErr.includes("UNAUTHORIZED") || shortErr.includes("Invalid API key") || shortErr.includes("No API key")) {
        shortErr = "Invalid API Key";
        if (interactive) openCloudModal("Invalid or missing Supabase anon API key. Please check your key.");
      }
      updateCloudStatus("error", shortErr);
    } finally {
      isSyncing = false;
    }
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", () => syncNow(true));
  }
  if (sidebarSyncBtn) {
    sidebarSyncBtn.addEventListener("click", () => syncNow(true));
  }
  if (cloudBtn) cloudBtn.addEventListener("click", () => syncNow(true));
  if (cloudStatusBtn) cloudStatusBtn.addEventListener("click", () => syncNow(true));
  if (statCloud) statCloud.addEventListener("click", () => openCloudModal());
  if (cloudModalCloseBtn) cloudModalCloseBtn.addEventListener("click", closeCloudModal);
  if (cloudModal) {
    cloudModal.addEventListener("click", (e) => {
      if (e.target === cloudModal) closeCloudModal();
    });
  }

  if (sqlCopyBtn) {
    sqlCopyBtn.addEventListener("click", () => {
      const code = $("#sqlSnippet") ? $("#sqlSnippet").textContent : "";
      navigator.clipboard.writeText(code).then(() => {
        const orig = sqlCopyBtn.textContent;
        sqlCopyBtn.textContent = "Copied!";
        setTimeout(() => (sqlCopyBtn.textContent = orig), 1500);
      });
    });
  }

  function showCloudMessage(msg, type) {
    if (!cloudStatusMsg) return;
    cloudStatusMsg.textContent = msg;
    cloudStatusMsg.className = "cloud-status-msg " + (type || "");
    cloudStatusMsg.style.display = "block";
  }

  if (cloudConnectBtn) {
    cloudConnectBtn.addEventListener("click", async () => {
      const key = cloudKeyInput ? cloudKeyInput.value.trim() : "";

      if (!key) {
        showCloudMessage("Please enter your Supabase anon public API key.", "error");
        return;
      }

      cloudConnectBtn.disabled = true;
      cloudConnectBtn.textContent = "Testing & Syncing…";
      showCloudMessage("Connecting to Supabase…", "");

      try {
        await CloudSync.testConnection(key);
        CloudSync.setKey(key);

        showCloudMessage("Connected! Syncing notes…", "success");
        await performFullCloudSync();

        showCloudMessage(`Connected successfully! Synced ${items.length} items.`, "success");
        updateCloudStatus("synced");
        setTimeout(() => {
          closeCloudModal();
        }, 700);
      } catch (err) {
        console.error(err);
        showCloudMessage(
          `Connection failed: ${err.message}. Make sure you ran the SQL table setup in Supabase SQL Editor.`,
          "error"
        );
        updateCloudStatus("error", err.message);
      } finally {
        cloudConnectBtn.disabled = false;
        cloudConnectBtn.textContent = "Save & Sync Now";
      }
    });
  }

  if (cloudDisconnectBtn) {
    cloudDisconnectBtn.addEventListener("click", () => {
      if (!confirm("Clear your saved Supabase key? Your local notes will remain intact.")) return;
      CloudSync.setKey("");
      if (cloudKeyInput) cloudKeyInput.value = "";
      showCloudMessage("Disconnected. Operating in local storage mode.", "success");
      updateCloudStatus("");
    });
  }

  /* ---------- shortcuts modal ---------- */
  function openModal() {
    if (shortcutsModal) shortcutsModal.removeAttribute("hidden");
  }

  function closeModal() {
    if (shortcutsModal) shortcutsModal.setAttribute("hidden", "");
    editor.focus();
  }

  function toggleModal() {
    if (!shortcutsModal) return;
    if (shortcutsModal.hasAttribute("hidden")) {
      openModal();
    } else {
      closeModal();
    }
  }

  if (shortcutsBtn) shortcutsBtn.addEventListener("click", toggleModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (shortcutsModal) {
    shortcutsModal.addEventListener("click", (e) => {
      if (e.target === shortcutsModal) closeModal();
    });
  }
  if (openBtn) openBtn.addEventListener("click", openFile);

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    const isEditor = document.activeElement === editor;
    const k = e.key.toLowerCase();

    // Escape closes modals if open
    if (e.key === "Escape") {
      if (shortcutsModal && !shortcutsModal.hasAttribute("hidden")) {
        e.preventDefault();
        closeModal();
        return;
      }
      if (cloudModal && !cloudModal.hasAttribute("hidden")) {
        e.preventDefault();
        closeCloudModal();
        return;
      }
    }

    // Toggle shortcuts modal: Cmd+/ or Ctrl+/
    if (meta && (e.key === "/" || e.key === "?")) {
      e.preventDefault();
      toggleModal();
      return;
    }

    // Help: '?' when not typing in editor
    if (e.key === "?" && !isEditor && !meta && !e.altKey) {
      e.preventDefault();
      toggleModal();
      return;
    }

    // Global App shortcuts
    if (meta) {
      // Toggle sidebar: Cmd+Alt+B or Cmd+Shift+B
      if ((k === "b" && e.altKey) || (k === "b" && e.shiftKey)) {
        e.preventDefault();
        setSidebarVisible(app.classList.contains("sidebar-hidden"));
        return;
      }

      // Save: Cmd+S / Ctrl+S
      if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        scheduleSaveNow();
        if (CloudSync.isConnected()) {
          syncNow(false);
        }
        return;
      }

      // Cloud sync: Cmd+Shift+Y / Ctrl+Shift+Y
      if (k === "y" && e.shiftKey) {
        e.preventDefault();
        syncNow(true);
        return;
      }

      // Export: Cmd+Shift+S / Ctrl+Shift+S
      if (k === "s" && e.shiftKey) {
        e.preventDefault();
        exportBtn.click();
        return;
      }

      // Open: Cmd+O / Ctrl+O
      if (k === "o") {
        e.preventDefault();
        openFile();
        return;
      }

      // Theme toggle: Cmd+D / Ctrl+D (when not Shift)
      if (k === "d" && !e.shiftKey) {
        e.preventDefault();
        themeBtn.click();
        return;
      }

      // New document: Cmd+Alt+N / Ctrl+Alt+N
      if (k === "n" && e.altKey) {
        e.preventDefault();
        newDocument();
        return;
      }

      // Print: Cmd+P / Ctrl+P
      if (k === "p" && !e.shiftKey) {
        e.preventDefault();
        window.print();
        return;
      }

      // Toggle editor: Cmd+\ or Cmd+Shift+E
      if (e.key === "\\" || (k === "e" && e.shiftKey)) {
        e.preventDefault();
        setEditorVisible(app.classList.contains("editor-hidden"));
        return;
      }

      // Cmd+B / Ctrl+B:
      // If editor is not active or editor is hidden, toggle editor!
      // If editor is active and visible, bold!
      if (k === "b") {
        e.preventDefault();
        if (app.classList.contains("editor-hidden") || !isEditor) {
          setEditorVisible(app.classList.contains("editor-hidden"));
        } else {
          applyWrap("**");
        }
        return;
      }
    }

    // Editor formatting & typing helpers
    if (isEditor) {
      if (PAIRS[e.key] && editor.selectionStart !== editor.selectionEnd && !meta && !e.altKey) {
        e.preventDefault();
        applyWrap(e.key, PAIRS[e.key]);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        handleTab(e.shiftKey);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && !meta && !e.altKey) {
        if (handleEnter(e)) return;
      }

      if (meta) {
        if (k === "i") {
          e.preventDefault();
          applyWrap("*");
          return;
        }

        if (k === "e" && !e.shiftKey) {
          e.preventDefault();
          applyWrap("`");
          return;
        }

        if (k === "k" && !e.shiftKey) {
          e.preventDefault();
          applyLink();
          return;
        }

        if ((k === "x" || k === "k") && e.shiftKey) {
          e.preventDefault();
          applyWrap("~~");
          return;
        }

        if (k === "c" && e.shiftKey) {
          e.preventDefault();
          applyCodeBlock();
          return;
        }

        if ((k === "u" || e.key === "*") && e.shiftKey) {
          e.preventDefault();
          applyList("bullet");
          return;
        }

        if ((k === "o" || e.key === "&") && e.shiftKey) {
          e.preventDefault();
          applyList("number");
          return;
        }

        if (k === "t" && e.shiftKey) {
          e.preventDefault();
          applyList("task");
          return;
        }

        if ((k === "q" || e.key === ">") && e.shiftKey) {
          e.preventDefault();
          applyList("quote");
          return;
        }

        if (k === "h" && e.shiftKey) {
          e.preventDefault();
          applyHorizontalRule();
          return;
        }

        if (k === "d" && e.shiftKey) {
          e.preventDefault();
          duplicateCurrentLine();
          return;
        }

        if (e.key >= "0" && e.key <= "6" && (e.altKey || !isMac)) {
          e.preventDefault();
          applyHeading(parseInt(e.key, 10));
          return;
        }
      }
    }
  });

  /* ---------- export ---------- */
  exportBtn.addEventListener("click", () => {
    const item = getActiveItem();
    let filename = item ? item.name : "document.md";
    if (!filename.endsWith(".md")) filename += ".md";
    const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- restore state ---------- */
  (function restore() {
    initItems();

    const activeItem = getActiveItem();
    editor.value = activeItem ? (activeItem.content || "") : WELCOME;

    applyTheme(
      store.get(KEY.theme, null) ||
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    );

    setEditorVisible(store.get(KEY.editor, "1") !== "0", false);
    setSidebarVisible(store.get(KEY.sidebar, "1") !== "0", false);

    const split = parseFloat(store.get(KEY.split, "44"));
    if (!Number.isNaN(split)) editorPane.style.flexBasis = split + "%";

    const sidebarSplit = parseFloat(store.get(KEY.sidebarSplit, "240"));
    if (!Number.isNaN(sidebarSplit) && sidebar) {
      sidebar.style.flexBasis = sidebarSplit + "px";
      sidebar.style.width = sidebarSplit + "px";
    }

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const modSymbol = isMac ? "⌘" : "Ctrl+";
    const altSymbol = isMac ? "⌥" : "Alt+";
    const shiftSymbol = isMac ? "⇧" : "Shift+";

    document.querySelectorAll("kbd[data-mac]").forEach((kbd) => {
      kbd.textContent = isMac ? kbd.dataset.mac : kbd.dataset.win;
    });

    if (sidebarToggleBtn) sidebarToggleBtn.title = `Toggle explorer (${modSymbol}${altSymbol}B)`;
    menuBtn.title = `Toggle editor (${modSymbol}\\ or ${modSymbol}B)`;
    themeBtn.title = `Toggle theme (${modSymbol}D)`;
    exportBtn.title = `Download as .md (${modSymbol}${shiftSymbol}S)`;
    if (shortcutsBtn) shortcutsBtn.title = `Keyboard shortcuts (${modSymbol}/)`;
    if (openBtn) openBtn.title = `Open file (${modSymbol}O)`;
    if (syncBtn) syncBtn.title = `Sync with Supabase (${modSymbol}${shiftSymbol}Y)`;
    if (sidebarSyncBtn) sidebarSyncBtn.title = `Sync with Supabase (${modSymbol}${shiftSymbol}Y)`;
    if (cloudStatusBtn) cloudStatusBtn.title = `Sync with Supabase (${modSymbol}${shiftSymbol}Y)`;

    renderFileTree();
    updateBreadcrumb();
    render();
    updateCaret();

    // Init cloud status & background sync
    if (CloudSync.isConnected()) {
      updateCloudStatus("synced");
      performFullCloudSync().catch(() => {});
    } else {
      updateCloudStatus("");
    }
  })();

  initGutter();
  initSidebarGutter();
  initScrollSync();
})();
