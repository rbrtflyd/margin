# Margin

A thinking canvas for non-linear design work. Everything on it is a plain text box. An assistant reads the board when you ask and helps you find, reflect and think out loud. It doesn't pitch ideas unless you ask for them.

## What's here (v1)

- **Canvas**: double-click to write, drag to move, drag on empty space to select several, paste text to drop it in as a box.
- **Floating UI**: one toolbar pill, plus panels that appear when you call them and go away when you're done.
- **Boards**: one per project or feature, switched from the toolbar. Export and import as JSON.
- **Ask** (`⌘K`): sends the board, or just the selected boxes, to Claude through `/api/ask` and streams the answer back. Answers can be put on the canvas, where they show in blue so they never read as your own writing.
- **Storage**: browser `localStorage` only. Each device has its own boards until a database is added.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then add ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. `APP_PASSCODE` can stay empty locally.

## Deploy on Vercel

1. Import `rbrtflyd/margin` in Vercel (framework preset: Next.js, no other settings).
2. Add environment variables:
   - `ANTHROPIC_API_KEY`: your key.
   - `APP_PASSCODE`: any secret string. Required on Vercel; the Ask panel asks for it once per browser.
   - `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`.
3. Deploy.

The passcode exists because the deployed URL is public and `/api/ask` spends your API credit.

## Shortcuts

| Key | Action |
| --- | --- |
| Double-click | New text box, or edit an existing one |
| `T` | New text box under the pointer |
| `Enter` | Edit the selected box |
| `Esc` or `⌘Enter` | Finish editing |
| `Delete` | Delete selection |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘A` | Select all |
| `⌘C` | Copy selected boxes as text |
| `⌘K` or `/` | Ask |
| Space + drag, middle-drag | Pan |
| Scroll / pinch | Pan / zoom |
| `⇧1` / `⇧0` | Zoom to fit / 100% |

## Where things live

- `components/Margin.tsx`: app state, boards, undo history, shortcuts, toolbar.
- `components/Canvas.tsx`: pan, zoom, selection, dragging, text editing.
- `components/AskPanel.tsx`: the floating assistant panel and streaming.
- `components/BoardsMenu.tsx`: board switcher popover.
- `lib/assistant.ts`: the assistant's system prompt and how the board is described to it.
- `app/api/ask/route.ts`: server route that calls the Anthropic Messages API and streams text.
- `lib/store.ts`: `localStorage` persistence, import and export. Replace `loadStore` and `saveStore` to move to a database.

## Not built yet

- A database, so boards sync across devices.
- Sources: Granola calls, OzBrain and downstream work (Figma, code) for the assistant to search. The Messages API's MCP connector is the likely route.
- Linting and tests.
