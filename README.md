# Markdown Viewer

A minimal, premium markdown editor + viewer that runs entirely in the browser. No dependencies, no build step.

## Features

- **Live preview** — compiled markdown appears as you type (80ms debounce)
- **Hide / show editor** — the ☰ button or `⌘B` / `Ctrl+B` slides the editor away for a clean reading view
- **Dark & light mode** — sun/moon toggle or `⌘D` / `Ctrl+D`, respects your system preference on first load
- **Everything persists** — document, theme, editor visibility, and split position are stored in `localStorage`
- **Resizable split** — drag the divider (20–75%)
- **Scroll sync** — proportional editor ↔ preview scrolling
- **Export** — download the document as a `.md` file (download icon)
- **Safe by design** — the renderer escapes all input and whitelists only known-safe URL schemes; no raw `innerHTML` of user content
- Statusbar: word count, save state, `Ln/Col` position

## Supported syntax

Headings, bold/italic/strikethrough, inline code, fenced code blocks, links, images (http/mailto/relative only), autolinks, blockquotes, ordered/unordered lists, task lists, tables (with alignment), horizontal rules.

## Run it

Open `index.html` in any modern browser — or serve the folder:

```bash
npx serve .
```

## Keyboard Shortcuts

Press `⌘/` or `Ctrl+/` (or click the keyboard icon in the topbar) anytime to open the interactive shortcuts cheat sheet:

| Category | Shortcut (Mac) | Shortcut (Win/Linux) | Action |
| :--- | :--- | :--- | :--- |
| **Document** | `⌘S` | `Ctrl+S` | Force-save to local storage |
| | `⌘⇧S` | `Ctrl+Shift+S` | Export / download as `.md` |
| | `⌘O` | `Ctrl+O` | Open local markdown file |
| | `⌘⌥N` | `Ctrl+Alt+N` | New document / clear editor |
| | `⌘P` | `Ctrl+P` | Print / save as clean PDF |
| **View** | `⌘\` or `⌘⇧E` | `Ctrl+\` or `Ctrl+Shift+E` | Toggle editor pane |
| | `⌘D` | `Ctrl+D` | Toggle dark / light theme |
| | `⌘/` | `Ctrl+/` | Open keyboard shortcuts modal |
| **Formatting** | `⌘B` | `Ctrl+B` | **Bold** selection (or toggle editor if outside) |
| | `⌘I` | `Ctrl+I` | *Italic* selection |
| | `⌘E` | `Ctrl+E` | `Inline code` |
| | `⌘K` | `Ctrl+K` | Insert link `[text](url)` |
| | `⌘⇧X` | `Ctrl+Shift+X` | ~~Strikethrough~~ |
| | `⌘⇧C` | `Ctrl+Shift+C` | Fenced code block |
| | `⌘⌥1`–`6` | `Ctrl+Alt+1`–`6` | Heading level 1 to 6 |
| | `⌘⌥0` | `Ctrl+Alt+0` | Normal text / paragraph |
| **Lists & Blocks**| `⌘⇧U` | `Ctrl+Shift+U` | Bullet list (`- `) |
| | `⌘⇧O` | `Ctrl+Shift+O` | Numbered list (`1. `) |
| | `⌘⇧T` | `Ctrl+Shift+T` | Task checklist (`- [ ] `) |
| | `⌘⇧Q` | `Ctrl+Shift+Q` | Blockquote (`> `) |
| | `⌘⇧H` | `Ctrl+Shift+H` | Horizontal rule (`---`) |
| | `Tab` / `⇧Tab` | `Tab` / `Shift+Tab` | Indent / outdent line(s) with 2 spaces |
| **Smart Helpers** | `Enter` | `Enter` | Automatically continues lists and tasks |
| | `(`, `[`, `{`, `"`, `` ` ``, `*` | *(same)* | Auto-wraps selected text with delimiter pair |
| | `⌘⇧D` | `Ctrl+Shift+D` | Duplicate current line |

