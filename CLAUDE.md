# Margin: notes for agents

Next.js 15 (App Router) + React 19 + TypeScript. No UI libraries, no CSS framework: styles are in `app/globals.css`, driven by CSS custom properties with a dark-mode block.

## Product rules to keep intact

- One primitive: a free text box. Don't add item types (idea, question, task). The assistant interprets text itself.
- The assistant is an assistant and rubber duck, not a co-designer. It finds, reflects and asks questions, and only offers ideas when the user explicitly asks. That stance lives in `SYSTEM_PROMPT` in `lib/assistant.ts`.
- UI floats and is ephemeral (toolbar pill, popovers, a draggable Ask panel). Avoid panels docked to screen edges.
- Assistant-written boxes (`by: 'claude'`) render in the non-photo-blue tokens so they never read as the user's own words.

## Conventions

- All board writes in `components/Margin.tsx` go through `commitItems`, which records undo history when `record` is true.
- Canvas coordinates are world units; `view` is `{ x, y, k }` (translate, then scale).
- The API key never reaches the client. `/api/ask` requires `APP_PASSCODE` whenever it runs on Vercel.
