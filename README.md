# Markdown Viewer

A minimal, premium markdown editor, viewer, and note-taking workspace that runs entirely in the browser. Zero dependencies, no build step, works 100% offline, and includes optional cloud synchronization via Supabase.

## Features

- **Folder & Note Explorer** — organize markdown documents into nested folders and subfolders right from the sidebar
- **Live preview** — compiled markdown appears as you type (80ms debounce)
- **Supabase Cloud Sync (Optional)** — sync all folders and notes to your own Supabase PostgreSQL database using standard REST API (no backend or npm dependencies required)
- **Local-First Persistence** — everything works immediately offline; documents, folders, active file, theme, and window states are stored in `localStorage`
- **Instant Search / Filter** — search across all files in your workspace in real-time
- **Hide / show editor** — the ☰ button or `⌘\` / `⌘B` slides the editor away for a clean reading view
- **Hide / show explorer** — the sidebar icon or `⌘⌥B` / `Ctrl+Alt+B` toggles the folder sidebar
- **Dark & light mode** — sun/moon toggle or `⌘D` / `Ctrl+D`, respects your system preference on first load
- **Resizable split** — drag dividers between the sidebar, editor, and preview panes
- **Scroll sync** — proportional editor ↔ preview scrolling
- **Export** — download the active document as a `.md` file
- **Safe by design** — the renderer escapes all input and whitelists only known-safe URL schemes; no raw `innerHTML` of user content
- **Statusbar**: live word count, save state indicator, file breadcrumb path, cloud sync status, and `Ln/Col` cursor position

## Supported Syntax

Headings (`#`–`######`), bold/italic/strikethrough, inline code, fenced code blocks with language headers and copy buttons, links, images (http/mailto/relative only), autolinks, blockquotes, ordered/unordered lists, task lists (`- [x]`), tables (with alignment), horizontal rules.

## Cloud Sync (Supabase)

Markdown Viewer is pre-configured with permanent Supabase Cloud Sync connected to your project:
`https://ksyxioqmkwznzrqmsotf.supabase.co`

### 1-Click Sync
- **Dedicated Sync Button**: Click **`Sync`** in the topbar or sidebar (or press **`⌘⇧Y`** / **`Ctrl+Shift+Y`**) to synchronize immediately.
- **Auto-Sync on Save**: Pressing **`⌘S`** / **`Ctrl+S`** or typing automatically syncs changes in the background.
- **First-Time Activation**: The very first time you sync, paste your Supabase **anon public API key** (from Supabase &rarr; Project Settings &rarr; API &rarr; Project API keys). Once saved, you will never be asked again — clicking **Sync** performs a direct sync instantly with no modal!
- **Table Setup**: If you haven't created the table in your Supabase SQL Editor yet, run:
  ```sql
  create table if not exists markdown_items (
    id text primary key,
    name text not null,
    type text not null check (type in ('file', 'folder')),
    parent_id text,
    content text default '',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  alter table markdown_items enable row level security;
  create policy "public_access" on markdown_items for all using (true) with check (true);
  ```

## Run it

Open `index.html` directly in any modern browser — or serve the folder locally:

```bash
npx serve .
```

Or deploy directly to Vercel:
```bash
vercel --prod
```

## Keyboard Shortcuts

Press `⌘/` or `Ctrl+/` (or click the keyboard icon in the topbar) anytime to open the interactive shortcuts cheat sheet:

| Category | Shortcut (Mac) | Shortcut (Win/Linux) | Action |
| :--- | :--- | :--- | :--- |
| **Explorer & View** | `⌘⌥B` | `Ctrl+Alt+B` | Toggle folder explorer sidebar |
| | `⌘\` or `⌘⇧E` | `Ctrl+\` or `Ctrl+Shift+E` | Toggle editor pane |
| | `⌘D` | `Ctrl+D` | Toggle dark / light theme |
| | `⌘/` | `Ctrl+/` | Open keyboard shortcuts modal |
| **Document** | `⌘S` | `Ctrl+S` | Save to local storage & cloud |
| | `⌘⇧Y` | `Ctrl+Shift+Y` | Sync with Supabase Cloud |
| | `⌘⇧S` | `Ctrl+Shift+S` | Export / download active note as `.md` |
| | `⌘O` | `Ctrl+O` | Open local markdown file into explorer |
| | `⌘⌥N` | `Ctrl+Alt+N` | New document |
| | `⌘P` | `Ctrl+P` | Print / save as clean PDF |
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
