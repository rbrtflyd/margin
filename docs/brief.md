# Margin: project brief

Last updated: October 9, 2026

## What it is

Margin is Robert's canvas for non-linear creative work, built first for himself and maybe for others. It's a place to think and iterate, with an AI assistant that acts as a true assistant: it surfaces things, gives feedback, and serves as a rubber duck. Organization isn't the main point; finding flow while iterating is, whether inside Margin or in another tool. Reference points: Figma, FigJam, Milanote.

## The problems it's meant to solve (Robert's framing)

1. Divergent and convergent thinking isn't linear. Brainstorming takes a huge amount of cognitive effort to manage, and it produces lots of artifacts that hold interesting ideas but don't always belong.
2. Non-visual material piles up per project and per feature: data, resources, information, ideas. That backlog is hard to remember, parse and manage.
3. The creative process isn't linear, so single pages, files or AI chat threads are awkward. There's no single path through the work.
4. AI shouldn't be giving him ideas, unless it's in a specific tool or way he asks for. He wants it to act as an assistant, e.g. "I know we have information about cognitive overload in EMRs, can you surface that for me?"
5. Tracking ideas as tasks breaks in Linear, Asana and similar tools, because the ideas and the tasks keep changing.
6. Keeping consistent context across sessions and tools. He hopes Margin solves this over time too.

## Direction Robert has set

- **Minimal.** UI comes and goes like Figma's. Nothing is anchored to the screen edges. Things like a shelf of sources, or a "where you left off" note, would be ephemeral panels. The details come later.
- **No semantic types.** He shouldn't have to decide whether something is an idea or a question. He writes; the assistant reads and interprets when he needs it to. Items come in visual forms only: text, sticky, shape, and connector today, with images, links, embeds, and sections planned. Every form carries text the assistant can read.
- **No diverge/converge toggle.** At Arrows the feedback comes in constantly, so the diverge-converge cycle is fast and tight. A mode switch doesn't fit.
- **Whiteboarding at FigJam's level**, on Margin's own canvas: selecting, moving, resizing, styling, flowcharts, images, and rich embeds such as YouTube videos and Figma frames. The plan is in [`docs/roadmap.md`](roadmap.md).
- **Single-person.** Multiplayer, cursors, comments, and voting are out of scope. Touch should work, but desktop comes first. Freehand drawing isn't needed.
- **Interesting but too specific for now:** spaces that show what's happening, and clustering.
- **Connected sources over time.** MCP connections, Granola first, so all of a project's calls are available to the assistant. Later, downstream awareness of what already exists at higher fidelity in Figma, code or Paper.
- **Real use cases:** Ceramic, his side project and a simplified EHR, which has slower and deeper work. Arrows, his day job, which is fast-paced with frequent feedback.

## Current state

- **Repo:** github.com/rbrtflyd/margin (private), deployed on Vercel.
- **Stack:**
  - Next.js 16 with the App Router and `proxy.ts`, React 19, and TypeScript.
  - Tailwind CSS v4. UI primitives come from Base UI and shadcn (in `components/ui/`), with Hugeicons for icons.
  - Convex for storage.
  - Better Auth, running on Convex through `@convex-dev/better-auth`. Sign-in is required for every page and for `/api/ask`.
- **The canvas** is custom-built; we decided against tldraw, Excalidraw, and React Flow in October 2026. It has:
  - Text boxes, stickies, five shapes (rectangle, rounded rectangle, ellipse, diamond, triangle), and connectors. Connectors are straight or elbow, and each end either snaps to the side of an item or ends anywhere on the canvas.
  - Connector labels.
  - Pan, zoom, and pinch; marquee select; moving and resizing items; paste-to-add; undo and redo.
- **Floating UI:** a toolbar pill, a selection bar that sets the fill color or connector route for a single selected item, and a draggable Ask panel.
- **Boards:** one Convex document per board, synced across devices. Boards can be exported and imported as JSON.
- **Ask:** the Ask panel calls Claude through `/api/ask` using the AI SDK. The default model is `claude-sonnet-5-5`. The assistant's behavior is defined in `SYSTEM_PROMPT` in `lib/assistant.ts`. Text Claude writes renders in non-photo blue.
- **Robert is handling:** lint setup and Vercel configuration.
- **Not built yet:**
  - The roadmap in [`docs/roadmap.md`](roadmap.md).
  - Sources (Granola, OzBrain).
  - Downstream links (Figma, code, Paper).
  - Tests.

## How v1 got here

Claude built an earlier prototype as an artifact, with a sample Ceramic project. It had typed cards (idea, question, source), clusters, a diverge/converge toggle, a shelf, a "where you left off" card, and idea stages showing when downstream work had drifted. Robert's feedback: too busy and too specific. The typed cards and modes added cognitive load, and the UI should float rather than be docked.

v1 kept three things:
- The assistant surfaces and reflects, and doesn't pitch ideas.
- Assistant-written text is visually distinct from his, shown in non-photo blue.
- Boards per project.

## Decided

- **Storage:** one Convex document per board, with its items in an array. A document can hold at most 1 MiB, so image files go in Convex file storage and items only reference them. Revisit if text-only boards get close to the limit.
- **Canvas:** stays custom. Robert would rather take on the bugs of building images and embeds himself than be limited by what tldraw, Excalidraw, or React Flow support.

## Open questions

- How sources connect to the assistant, for example through the Anthropic Messages API's MCP connector.
- What form ephemeral panels take for sources and "where you left off".
- Whether exported JSON embeds image data or keeps links to stored files (roadmap workstream 4A).
