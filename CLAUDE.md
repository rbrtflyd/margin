# Margin: notes for agents

Next.js 16 (App Router, `proxy.ts`) + React 19 + TypeScript. Auth is Neon Auth (managed Better Auth) via `@neondatabase/auth`. UI is Tailwind CSS v4 (stone paper, zinc ink, sky for the assistant). `app/globals.css` only has fonts, the flash animation, and base html/body.

## Product rules to keep intact

- Items may be text, a sticky, a shape, or a connector. The assistant still reads the text. Don't add semantic item types (idea, question, task).
- The assistant is an assistant and rubber duck, not a co-designer. It finds, reflects and asks questions, and only offers ideas when the user explicitly asks. That stance lives in `SYSTEM_PROMPT` in `lib/assistant.ts`.
- UI floats and is ephemeral (toolbar pill, popovers, a draggable Ask panel). Avoid panels docked to screen edges.
- Assistant-written boxes (`by: 'claude'`) render in the non-photo-blue tokens so they never read as the user's own words.

## Conventions

- All board writes in `components/Margin.tsx` go through `commitItems`, which records undo history when `record` is true.
- Canvas coordinates are world units; `view` is `{ x, y, k }` (translate, then scale).
- `auth` from `lib/auth/server.ts` is `null` when the Neon Auth env vars are missing; every caller handles that case so the app still runs signed-out.
- The API key never reaches the client. `/api/ask` requires a session when auth is on, and `APP_PASSCODE` on Vercel when it's off.
