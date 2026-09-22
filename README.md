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

Keyboard shortcuts: `⌘S` force-save · `⌘B` toggle editor · `⌘D` toggle theme.
