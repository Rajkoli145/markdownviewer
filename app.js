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
- Toggle the editor away with the ☰ button — or \`⌘B\`
- Dark & light themes (\`⌘D\`)
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

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    const k = e.key.toLowerCase();

    if (k === "s") {
      e.preventDefault();
      store.set(KEY.text, editor.value);
      statSaved.textContent = "Saved";
      statSaved.classList.add("flash");
      setTimeout(() => statSaved.classList.remove("flash"), 1200);
    }
    if (k === "b") {
      e.preventDefault();
      setEditorVisible(app.classList.contains("editor-hidden"));
    }
    if (k === "d") {
      e.preventDefault();
      themeBtn.click();
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

    render();
    updateCaret();
  })();

  initGutter();
  initScrollSync();
})();
