# Margin

A thinking canvas for non-linear design work. Everything on it is a plain text box. An assistant reads the board when you ask and helps you find, reflect and think out loud. It doesn't pitch ideas unless you ask for them.

## What's here (v1)

- **Canvas**: double-click to write, drag to move, drag on empty space to select several, paste text to drop it in as a box.
- **Floating UI**: one toolbar pill, plus panels that appear when you call them and go away when you're done.
- **Boards**: one per project or feature, switched from the toolbar. Export and import as JSON.
- **Ask** (`⌘K`): sends the board, or just the selected boxes, to Claude through `/api/ask` and streams the answer back. Answers can be put on the canvas, where they show in blue so they never read as your own writing.
- **Accounts**: Convex Auth, email and password plus Google. It switches on when `NEXT_PUBLIC_CONVEX_URL` is set; until then the app runs without accounts.
- **Storage**: browser `localStorage` while Convex is off. Once Convex is connected, boards sync per signed-in user.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Without `NEXT_PUBLIC_CONVEX_URL` the app runs signed-out and `APP_PASSCODE` can stay empty locally.

### Connect Convex (auth + synced boards)

You need a Convex account for this step. The app stays usable without it.

1. In a second terminal: `npx convex dev`. Log in with GitHub, create a project named `margin` (or whatever you like). This writes `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` into `.env.local` and pushes `convex/`.
2. Generate auth keys and set them on the deployment:

   ```bash
   npm run auth:keys
   npx convex env set JWT_PRIVATE_KEY "-----BEGIN PRIVATE KEY----- ..."
   npx convex env set JWKS '{"keys":[...]}'
   npx convex env set SITE_URL http://localhost:3000
   ```

   `npx @convex-dev/auth` does the same key setup if you prefer the interactive command.
3. Restart `npm run dev`. Sign-in is on; boards you already have in this browser are copied into Convex on first save.
4. Optional Google sign-in: create an OAuth client whose authorized redirect URI is `https://<your-deployment>.convex.site/api/auth/callback/google`, then:

   ```bash
   npx convex env set AUTH_GOOGLE_ID <client-id>
   npx convex env set AUTH_GOOGLE_SECRET <client-secret>
   ```

   Restart `npx convex dev` so the Google provider is included.

Safari blocks auth cookies on plain http, so use `npm run dev -- --experimental-https` there.

## Deploy on Vercel

1. Import `rbrtflyd/margin` in Vercel (framework preset: Next.js).
2. Set the build command to `npx convex deploy --cmd 'npm run build'`.
3. Add environment variables:
   - `ANTHROPIC_API_KEY`: your key.
   - `CONVEX_DEPLOY_KEY`: production deploy key from the Convex dashboard (Deployment Settings). Uncheck every environment except Production.
   - `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-5-5`.
4. On the Convex production deployment, set `SITE_URL` to your Vercel URL, and copy `JWT_PRIVATE_KEY` / `JWKS` (and Google vars if you use them) from the dev deployment, or generate a fresh pair with `npm run auth:keys`.
5. Deploy. `convex deploy` sets `NEXT_PUBLIC_CONVEX_URL` for the build.

Until Convex is connected, set `APP_PASSCODE` instead: `/api/ask` refuses to run on Vercel without one, because the URL is public and each ask spends your API credit.

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
- `lib/store.ts`: `localStorage` persistence, import and export. Used when Convex is off, and to seed Convex on first sign-in.
- `convex/`: schema, auth, and the `stores` / `users` functions. `npx convex dev` regenerates `convex/_generated`.
- `lib/env.ts`: `isConvexConfigured()`. Every caller handles the off case so the app still runs signed-out.
- `proxy.ts`: Convex Auth middleware when configured; otherwise a pass-through. `/api/ask` checks the session itself.
- `app/auth/`: sign-in and sign-up pages.

## Not built yet

- Live merge of the same board open in two tabs. Each tab hydrates once, then writes back on a debounce.
- Sources: Granola calls, OzBrain and downstream work (Figma, code) for the assistant to search. The Messages API's MCP connector is the likely route.
- Linting and tests.
