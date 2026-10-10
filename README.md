# Margin

A thinking canvas for non-linear design work. You write on a board; an assistant reads it when you ask and helps you find, reflect and think out loud. It doesn't pitch ideas unless you ask for them.

Product direction is in [`docs/brief.md`](docs/brief.md). The whiteboard plan, split into workstreams agents can claim, is in [`docs/roadmap.md`](docs/roadmap.md).

## What's here

- **Canvas**: text boxes, stickies, five shapes (rectangle, rounded rectangle, ellipse, diamond, triangle), and connectors. Connectors are straight or elbow; each end snaps to the side of an item or ends anywhere. Double-click to write, drag to move, drag on empty space to select several, paste text to drop it in as a box.
- **Floating UI**: a toolbar pill, a selection bar for fill color or connector route, and a draggable Ask panel. Nothing docks to the screen edges.
- **Boards**: one Convex document per board, synced across devices. Export and import as JSON.
- **Ask** (`⌘K`): sends the board, or just the selected items, to Claude through `/api/ask` and streams the answer back. Answers can be put on the canvas, where they show in blue so they never read as your own writing.
- **Accounts**: Better Auth on Convex (`@convex-dev/better-auth`), email and password plus optional Google. Sign-in is required for every page and for `/api/ask`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill it in
npx convex dev               # in another terminal; writes the Convex URLs
npm run dev
```

Open http://localhost:3000. Set these on the Convex deployment (`npx convex env set`), not only in `.env.local`:

- `BETTER_AUTH_SECRET`: 32+ characters, e.g. `openssl rand -base64 32`
- `SITE_URL`: `http://localhost:3000`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional): enables Google sign-in

Safari blocks auth cookies on plain http, so use `npm run dev -- --experimental-https` there.

## Deploy on Vercel

1. Import `rbrtflyd/margin` in Vercel (framework preset: Next.js, no other settings).
2. Add environment variables:
   - `ANTHROPIC_API_KEY`: your key.
   - `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`.
   - `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`: from the Convex dashboard.
   - `NEXT_PUBLIC_SITE_URL`: your Vercel URL.
3. On the Convex deployment, set `BETTER_AUTH_SECRET`, `SITE_URL` (the Vercel URL), and optional Google OAuth credentials.
4. Deploy.

Every page and `/api/ask` require a session. The Anthropic key never reaches the client.

## Shortcuts

| Key | Action |
| --- | --- |
| `V` | Pointer |
| `T` | Text tool |
| `S` | Sticky |
| `R` / `O` | Rectangle / ellipse |
| `L` / `X` | Straight / elbow connector |
| Double-click | New text box, or edit an existing one |
| `Enter` | Edit the selected item |
| `Esc` or `⌘Enter` | Finish editing, or return to the pointer |
| `Delete` | Delete selection |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘A` | Select all |
| `⌘C` | Copy selected items as text |
| `⌘K` or `/` | Ask |
| Space + drag, middle-drag | Pan |
| Scroll / pinch | Pan / zoom |
| `⇧1` / `⇧0` | Zoom to fit / 100% |

## Where things live

- `components/Margin.tsx`: app state, boards, undo history, shortcuts.
- `components/Canvas.tsx`: pan, zoom, selection, dragging, placing, connectors.
- `components/BoardItem.tsx`: how items render and how text is edited.
- `components/CanvasToolbar.tsx`, `components/SelectionBar.tsx`, `components/AskPanel.tsx`, `components/BoardSwitcher.tsx`: floating UI.
- `lib/assistant.ts`: the assistant's system prompt and how the board is described to it.
- `lib/items.ts`, `lib/connectors.ts`, `lib/types.ts`: item geometry, connector routing, and types.
- `lib/store.ts`: JSON import and export.
- `app/api/ask/route.ts`: server route that calls Claude through the AI SDK and streams the answer.
- `convex/boards/`: board queries and mutations.
- `lib/auth/server.ts`, `lib/auth/client.ts`: Better Auth on Convex.
- `proxy.ts`: sends signed-out visitors to `/auth/sign-in` (API routes and auth pages excluded).
- `app/auth/`: sign-in and sign-up pages.

## Not built yet

- The whiteboard work in [`docs/roadmap.md`](docs/roadmap.md): selection polish, styling, flowcharts, images, embeds, sections, export.
- Sources: Granola calls, OzBrain and downstream work (Figma, code, Paper) for the assistant to search.
- Linting and tests.
