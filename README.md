# Margin

A thinking canvas for non-linear design work. Everything on it is a plain text box. An assistant reads the board when you ask and helps you find, reflect and think out loud. It doesn't pitch ideas unless you ask for them.

## What's here (v1)

- **Canvas**: double-click to write, drag to move, drag on empty space to select several, paste text to drop it in as a box.
- **Floating UI**: one toolbar pill, plus panels that appear when you call them and go away when you're done.
- **Boards**: one per project or feature, switched from the toolbar. Export and import as JSON.
- **Ask** (`⌘K`): sends the board, or just the selected boxes, to Claude through `/api/ask` and streams the answer back. Answers can be put on the canvas, where they show in blue so they never read as your own writing.
- **Accounts**: Neon Auth (managed Better Auth), email and password plus Google. It switches on when its env vars are set; until then the app runs without accounts.
- **Storage**: browser `localStorage`, kept separately per signed-in user. Each device has its own boards until a database is added.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Open http://localhost:3000. Without the Neon Auth variables the app runs signed-out and `APP_PASSCODE` can stay empty locally. Safari blocks the auth cookies on plain http, so use `npm run dev -- --experimental-https` there.

## Deploy on Vercel

1. Import `rbrtflyd/margin` in Vercel (framework preset: Next.js, no other settings).
2. Add environment variables:
   - `ANTHROPIC_API_KEY`: your key.
   - `NEON_AUTH_BASE_URL`: from the Neon Console (project, Branch, Auth, Configuration).
   - `NEON_AUTH_COOKIE_SECRET`: 32+ characters, e.g. `openssl rand -base64 32`.
   - `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`.
3. In Neon Auth, add your Vercel domain to the trusted domains and turn on the sign-in methods you want (email and password, Google).
4. Deploy.

With Neon Auth on, every page and `/api/ask` require a session. Without it, set `APP_PASSCODE` instead: `/api/ask` refuses to run on Vercel without one, because the URL is public and each ask spends your API credit.

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
- `lib/auth/server.ts`, `lib/auth/client.ts`: Neon Auth setup. `auth` is `null` when not configured.
- `proxy.ts`: sends signed-out visitors to `/auth/sign-in` (API routes and auth pages excluded).
- `app/api/auth/[...path]/route.ts`: proxies auth requests to Neon Auth.
- `app/auth/`: sign-in and sign-up pages and their server actions, plus sign-out.

## Not built yet

- A database, so boards sync across devices. With Neon's Data API, the signed-in user's token can drive row-level security on a `boards` table keyed by user id.
- Sources: Granola calls, OzBrain and downstream work (Figma, code) for the assistant to search. The Messages API's MCP connector is the likely route.
- Linting and tests.
