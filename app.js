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

  /* ---------- Persistence ---------- */
  const KEY = {
    text: "mdv.text",
    theme: "mdv.theme",
    editor: "mdv.editor",
    split: "mdv.split",
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

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    statSaved.textContent = "Saving…";
    statSaved.classList.remove("flash");
    saveTimer = setTimeout(() => {
      store.set(KEY.text, editor.value);
      statSaved.textContent = "Saved";
      statSaved.classList.add("flash");
      setTimeout(() => statSaved.classList.remove("flash"), 1200);
    }, 500);
  }

  function scheduleSaveNow() {
    clearTimeout(saveTimer);
    store.set(KEY.text, editor.value);
    statSaved.textContent = "Saved";
    statSaved.classList.add("flash");
    setTimeout(() => statSaved.classList.remove("flash"), 1200);
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
          editor.value = evt.target.result;
          scheduleRender();
          scheduleSaveNow();
          updateCaret();
        };
        reader.readAsText(file);
        fileInput.value = "";
      });
    }
    fileInput.click();
  }

  function newDocument() {
    if (editor.value.trim().length > 0) {
      if (!confirm("Start a new document? Any unsaved edits will be replaced.")) {
        return;
      }
    }
    editor.value = "# Untitled\n\n";
    scheduleRender();
    scheduleSaveNow();
    updateCaret();
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
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

    // Escape closes shortcuts modal if open
    if (e.key === "Escape") {
      if (shortcutsModal && !shortcutsModal.hasAttribute("hidden")) {
        e.preventDefault();
        closeModal();
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
      // Save: Cmd+S / Ctrl+S
      if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        scheduleSaveNow();
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
      // Auto-wrap selection on typing pair characters
      if (PAIRS[e.key] && editor.selectionStart !== editor.selectionEnd && !meta && !e.altKey) {
        e.preventDefault();
        applyWrap(e.key, PAIRS[e.key]);
        return;
      }

      // Tab and Shift+Tab
      if (e.key === "Tab") {
        e.preventDefault();
        handleTab(e.shiftKey);
        return;
      }

      // Smart Enter
      if (e.key === "Enter" && !e.shiftKey && !meta && !e.altKey) {
        if (handleEnter(e)) return;
      }

      if (meta) {
        // Italic: Cmd+I / Ctrl+I
        if (k === "i") {
          e.preventDefault();
          applyWrap("*");
          return;
        }

        // Inline Code: Cmd+E / Ctrl+E
        if (k === "e" && !e.shiftKey) {
          e.preventDefault();
          applyWrap("`");
          return;
        }

        // Link: Cmd+K / Ctrl+K
        if (k === "k" && !e.shiftKey) {
          e.preventDefault();
          applyLink();
          return;
        }

        // Strikethrough: Cmd+Shift+X or Cmd+Shift+K
        if ((k === "x" || k === "k") && e.shiftKey) {
          e.preventDefault();
          applyWrap("~~");
          return;
        }

        // Code block: Cmd+Shift+C
        if (k === "c" && e.shiftKey) {
          e.preventDefault();
          applyCodeBlock();
          return;
        }

        // Bullet list: Cmd+Shift+U or Cmd+Shift+8
        if ((k === "u" || e.key === "*") && e.shiftKey) {
          e.preventDefault();
          applyList("bullet");
          return;
        }

        // Numbered list: Cmd+Shift+O or Cmd+Shift+7
        if ((k === "o" || e.key === "&") && e.shiftKey) {
          e.preventDefault();
          applyList("number");
          return;
        }

        // Task list: Cmd+Shift+T
        if (k === "t" && e.shiftKey) {
          e.preventDefault();
          applyList("task");
          return;
        }

        // Blockquote: Cmd+Shift+Q or Cmd+Shift+.
        if ((k === "q" || e.key === ">") && e.shiftKey) {
          e.preventDefault();
          applyList("quote");
          return;
        }

        // Horizontal rule: Cmd+Shift+H
        if (k === "h" && e.shiftKey) {
          e.preventDefault();
          applyHorizontalRule();
          return;
        }

        // Duplicate line: Cmd+Shift+D
        if (k === "d" && e.shiftKey) {
          e.preventDefault();
          duplicateCurrentLine();
          return;
        }

        // Headings: Cmd+Alt+0..6 or Cmd+0..6
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
    const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const title =
      ((editor.value.match(/^\s*#\s+(.+)$/m) || [])[1] || "document")
        .trim().slice(0, 60);
    a.download = title.replace(/[\\/:*?"<>|]/g, "-") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- restore state ---------- */
  (function restore() {
    const saved = store.get(KEY.text, null);
    editor.value = saved !== null ? saved : WELCOME;

    applyTheme(
      store.get(KEY.theme, null) ||
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    );

    setEditorVisible(store.get(KEY.editor, "1") !== "0", false);

    const split = parseFloat(store.get(KEY.split, "44"));
    if (!Number.isNaN(split)) editorPane.style.flexBasis = split + "%";

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const modSymbol = isMac ? "⌘" : "Ctrl+";
    const shiftSymbol = isMac ? "⇧" : "Shift+";

    document.querySelectorAll("kbd[data-mac]").forEach((kbd) => {
      kbd.textContent = isMac ? kbd.dataset.mac : kbd.dataset.win;
    });

    menuBtn.title = `Toggle editor (${modSymbol}\\ or ${modSymbol}B)`;
    themeBtn.title = `Toggle theme (${modSymbol}D)`;
    exportBtn.title = `Download as .md (${modSymbol}${shiftSymbol}S)`;
    if (shortcutsBtn) shortcutsBtn.title = `Keyboard shortcuts (${modSymbol}/)`;
    if (openBtn) openBtn.title = `Open file (${modSymbol}O)`;

    render();
    updateCaret();
  })();

  initGutter();
  initScrollSync();
})();
