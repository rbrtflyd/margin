# Margin: whiteboard roadmap

The goal is FigJam-level whiteboarding on Margin's own canvas: selecting, moving, resizing, styling, flowcharts, images, and rich embeds. We are not adopting tldraw, Excalidraw, or React Flow. Margin stays a single-person tool, so multiplayer, cursors, comments, and voting are out of scope. Touch should work, but desktop comes first.

Each workstream below is sized for one agent. Claim one in the status table, work on a branch named `roadmap/<id>` (for example `roadmap/0a`), and mark it done when its "Done when" list holds.

## Status

| ID | Workstream | Depends on | Status |
| --- | --- | --- | --- |
| 0A | Save one board at a time | none | done |
| 0B | Split `Canvas.tsx` into interaction modules | none | done |
| 0C | Bounds layer and canvas bug fixes | 0B | done |
| 0D | Item schema v2 | none | open |
| 0E | Geometry tests and undo coalescing | 0A | open |
| 1A | Duplicate, nudge, copy and paste items | 0B | open |
| 1B | Multi-selection: bar, resize, modifiers, hover | 0B, 0C | open |
| 1C | Stacking order, lock, group | 0B, 0D | open |
| 1D | Align, distribute, smart guides, grid | 0C | open |
| 2A | Shapes rendered as SVG, more shapes | 0D | open |
| 2B | Style controls: fill, stroke, text color | 0D, 1B, 2A | open |
| 2C | Text formatting and sticky sizing | 0D | open |
| 3A | Connection dots and quick-create | 0B, 0C | open |
| 3B | Arrowheads, curves, auto sides, elbow bends | 0D | open |
| 3C | Connector label editing | 3B | open |
| 3D | Assistant reads connectors | none | open |
| 4A | Image storage pipeline | 0A, 0D | open |
| 4B | Image items on the canvas | 4A | open |
| 4C | Link cards and `/api/unfurl` | 0D | open |
| 4D | Embeds | 4C | open |
| 4E | Assistant reads images and links | 4B, 4C | open |
| 5A | Sections | 0C, 0D | open |
| 5B | Zoom menu, minimap, find | 0C | open |
| 5C | Viewport culling and performance | 0C | open |
| 5D | Export PNG and SVG | 0C | open |
| 5E | Templates and duplicate board | 0A | open |
| 6A | Context menu | 1A, 1C | open |
| 6B | Shortcut sheet | none | open |
| 6C | Touch polish | 3A | open |
| 6D | Accessibility | none | open |

Status values: `open`, `in progress (<agent or branch>)`, `done`.

You can start 0A, 0B, 0D, 3D, 6B, and 6D right away and run them in parallel.

## Rules for every workstream

These come from `CLAUDE.md` and the project brief. A change that breaks one of them isn't done.

- **Keep it minimal.** UI floats and goes away when you don't need it, as in Figma: the toolbar pill, popovers, the selection bar. Nothing docks to a screen edge. The selection bar only shows controls that apply to the current selection.
- **Item kinds are visual, never semantic.** Images, links, embeds, and sections are fine because they describe how something looks. Idea, question, and task are not allowed. Every kind has text the assistant can read: an image caption, a link title, a section name.
- **The assistant is a rubber duck.** It surfaces, reflects, and asks questions, and only offers ideas when Robert asks. Don't add "generate" or "suggest" features. Items Claude writes (`by: 'claude'`) always render in the non-photo-blue tokens, whatever style fields they have.
- **All board writes go through `commitItems`** in `components/Margin.tsx`, so undo keeps working.
- **Coordinates are world units.** Anything measured on screen, like snap distances, hit areas, and handle sizes, gets divided by `view.k`.
- **Schema changes go in four places:** `lib/types.ts`, `itemValidator` in `convex/schemas/boards.ts`, `compactItem` in `lib/items.ts`, and import/export in `lib/store.ts`.
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before writing route or config code.
- **Verify:** run `npm run typecheck` and `npm run build`, then test the feature in the browser with `npm run dev`. Once 0E lands, also run the tests.

### Files many workstreams touch

These files are where merge conflicts will happen: `components/Canvas.tsx` (or the modules 0B splits it into), `components/BoardItem.tsx`, `components/SelectionBar.tsx`, `components/Margin.tsx`, and `lib/types.ts`. Rebase often, and keep diffs to these files small and focused.

## Phase 0: Foundations

### 0A. Save one board at a time

Today every edit, after a 250ms debounce, sends **every** board to `boards.mutations.save`. That gets slow once boards hold images, and two tabs can silently overwrite each other.

Touches: `components/Margin.tsx`, `convex/boards/mutations.ts`.

- [x] Add a `saveBoard({ id, name, items, view, asks, updatedAt })` mutation, and a separate small mutation to set the current board.
- [x] Track which boards changed, and debounce-save only those.
- [x] Before writing, check `updatedAt` against the stored document. If another tab has written newer data, don't overwrite it; surface the conflict (a toast is enough).
- [x] Add a small floating save status: "Saving", "Saved", or "Offline".
- [x] Remove the old whole-store `save`, or keep it only for import.

Done when editing one board sends only that board, two tabs can't silently overwrite each other, and reloading always restores the latest edit.

### 0B. Split `Canvas.tsx` into interaction modules

`Canvas.tsx` is about 1,100 lines, with every interaction in one `Drag` union and one set of pointer handlers. Most of the work below adds interactions, so split it before anyone builds on it.

Touches: `components/Canvas.tsx`, plus new files under `components/canvas/`.

- [x] Give each interaction its own module: pan, select and move, marquee, resize, place, connect, and endpoint drag. Each gets `start`, `move`, `end`, and an optional preview to render.
- [x] Keep `Canvas.tsx` as the shell: the view transform, wheel, gesture and pinch handling, and choosing which interaction runs.
- [x] Keep the `CanvasApi` surface (`center`, `pointer`, `fit`, `zoomTo`, `rectOf`, `panTo`) unchanged.
- [x] Make this a pure refactor. Behavior must not change.

Done when everything that works today still works: create each kind, select, Shift-select, marquee, move, resize, connect, re-attach connector ends, pan, zoom, pinch, space-to-pan, and double-click to create text.

### 0C. Bounds layer and canvas bug fixes

Touches: the modules from 0B, `lib/connectors.ts`, `lib/items.ts`.

- [x] Add one `boundsOf(item)` function. It uses the stored `w`/`h` when they're set, and the measured size otherwise (text boxes that size to their contents), cached with a `ResizeObserver`.
- [x] Move marquee hit-testing to `boundsOf` instead of calling `getBoundingClientRect` on every item.
- [x] Fix: when you group-drag items, a connector end that isn't attached to anything doesn't move in the preview.
- [x] Fix: `SNAP = 28` in `lib/connectors.ts` is in world units, so it's about 3px on screen at 10% zoom and 112px at 400%. Make it a screen-pixel distance, `SNAP / view.k`.
- [x] Fix: `currentRects` inside the `[]`-deps effect captures stale `dragging`/`resize` state.

Done when snapping feels the same at every zoom level, and every selected item moves together during a drag.

### 0D. Item schema v2

Add every new field in one pass so later workstreams don't fight over `lib/types.ts`. All of them are optional, and missing means today's default.

Touches: the four schema files listed under "Rules for every workstream".

- [ ] Style fields hold palette names, not hex values, so Claude's items can always be forced to blue tokens: `stroke?: Fill | 'ink' | 'none'`, `strokeWidth?: 1 | 2 | 4`, `strokeStyle?: 'solid' | 'dashed' | 'dotted'`, `textColor?`, `fontSize?: 's' | 'm' | 'l' | 'xl'`, `align?: 'left' | 'center' | 'right'`. Allow `fill: 'none'` for outline-only shapes.
- [ ] Add `locked?: boolean` and `groupId?: string`.
- [ ] Connector fields: `arrowStart?`, `arrowEnd?` (`'none' | 'arrow' | 'triangle' | 'circle'`), `route` gains `'curved'`, an optional `bend?: number` for elbows, and `labelAt?: number` (0 to 1 along the path).
- [ ] Anchors: allow `side: 'auto'`.
- [ ] Reserve, but don't render yet: `kind` gains `'image' | 'link' | 'embed' | 'section'`, plus `assetId?`, `url?`, `meta?: { title?, description?, siteName?, thumb?, provider? }`, and `caption?`.
- [ ] Bump export to `v: 2`, and make `importStore` migrate v1 files.
- [ ] Make Claude's items render blue even when style fields are set.

Done when old boards and old export files load unchanged, and typecheck passes.

### 0E. Geometry tests and undo coalescing

Touches: `package.json`, new `*.test.ts` files next to `lib/`, `components/Margin.tsx`.

- [ ] Add Vitest and an `npm test` script.
- [ ] Test `applyResize`, `snapAnchor`, `elbowPoints`, `connectorPoints`, `detachAnchor`, `boundsOf`, and the v1 to v2 import migration.
- [ ] Let `commitItems` take a coalesce key, so repeated writes with the same key within about 500ms become one undo step. Nudging and clicking through colors will use this.

Done when `npm test` passes, and holding an arrow key creates one undo step instead of dozens.

## Phase 1: Selecting and transforming

### 1A. Duplicate, nudge, copy and paste items

- [ ] Cmd+D duplicates the selection, offset slightly. Alt-drag duplicates and leaves the originals in place.
- [ ] Arrow keys nudge by 1, or 10 with Shift, in screen pixels and coalesced in undo.
- [ ] Cmd+C writes the items as a JSON payload in a custom MIME type, with the current plain-text output as a fallback.
- [ ] Cmd+V of that payload pastes items at the cursor with new ids. Connectors between pasted items reattach to the copies, and connectors to items that weren't copied become free ends.
- [ ] Cut (Cmd+X).

### 1B. Multi-selection: bar, resize, modifiers, hover

- [ ] Show `SelectionBar` for several items, with shared values and a "mixed" state when they differ.
- [ ] Draw one bounding box around a multi-selection, with handles that scale positions and sizes together. Connectors follow.
- [ ] Change resize to match FigJam: free by default, Shift keeps proportions, Alt resizes from the center. Today corner handles on shapes and stickies always keep proportions (`keepRatio` in `Canvas.tsx`).
- [ ] Show a hover outline on the item under the cursor.

### 1C. Stacking order, lock, group

- [ ] Stacking order is array order. Cmd+] and Cmd+[ move forward and back; Cmd+Shift+] and Cmd+Shift+[ move to the front and back. Connectors stay under items.
- [ ] Lock and unlock with Cmd+Shift+L. Locked items can't be moved, resized, or picked up by the marquee, but can still be selected by clicking.
- [ ] Group and ungroup with Cmd+G and Cmd+Shift+G, using `groupId`. Clicking selects the whole group; double-clicking selects one item inside it.

### 1D. Align, distribute, smart guides, grid

- [ ] In the multi-select bar: align left, center, or right, align top, middle, or bottom, distribute horizontally or vertically, and tidy up (arrange in a grid).
- [ ] Smart guides: while moving or resizing, snap edges and centers to nearby items within 6 screen pixels, draw guide lines, and show equal-spacing hints. Hold Cmd to turn snapping off.
- [ ] Optional dot grid with a snap-to-grid toggle. Keep it off by default.

Coordinate with 1B, since both add controls to `SelectionBar.tsx`.

## Phase 2: Styling

### 2A. Shapes rendered as SVG, more shapes

Diamonds and triangles are cut out with a CSS `clipPath` today, and a clip path can't draw an outline. Strokes need real SVG.

- [ ] Render each shape as an SVG path sized to the item, and drop `shapeClip`.
- [ ] Add flowchart shapes: parallelogram, cylinder, document, hexagon, star, chevron, speech bubble.
- [ ] Update the shape dropdown in `CanvasToolbar.tsx` to fit the new shapes; consider a compact grid.
- [ ] Keep connector anchors on shape edges correct for the new shapes. Side midpoints are fine for now.

### 2B. Style controls: fill, stroke, text color

- [ ] One palette of about 10 to 12 colors in `lib/items.ts`, used for fill, stroke, and text.
- [ ] In the selection bar: fill (including none), stroke color, stroke width, and stroke style. Each opens as a small popover so the bar stays short.
- [ ] Remember the last style used for each kind, so new items use it.
- [ ] Optional: copy style and paste style (Cmd+Alt+C and Cmd+Alt+V).

### 2C. Text formatting and sticky sizing

- [ ] Font size (S, M, L, XL) and alignment for text, stickies, and shapes.
- [ ] Bold, italic, strikethrough, and links. Keep markdown as the storage format: toolbar buttons and Cmd+B and Cmd+I wrap the selection in markers, and `lib/markdown.tsx` renders them. Don't add a rich-text model.
- [ ] Text in a sticky shrinks automatically as it fills, as in FigJam.
- [ ] Add a wide sticky size, as a preset in the selection bar.

## Phase 3: Connectors and flowcharts

### 3A. Connection dots and quick-create

- [ ] On hover or selection, show a dot on each side of an item. Dragging from a dot starts a connector there.
- [ ] Quick-create: hovering a shape or sticky shows a `+` on each side. Clicking one creates a matching item at a set distance, already connected, and puts it straight into editing. This is the biggest single speed-up for flowcharts.
- [ ] Dots and `+` controls also appear on selection, not only on hover, so touch works.

### 3B. Arrowheads, curves, auto sides, elbow bends

- [ ] Arrowhead at the start, end, both, or neither, in a few styles, set from the selection bar.
- [ ] A curved route alongside straight and elbow.
- [ ] `side: 'auto'` re-picks the closest side as items move. New connectors use auto unless you dropped onto a specific side dot.
- [ ] Dragging the middle segment of an elbow connector bends it, stored in `bend`.

### 3C. Connector label editing

- [ ] Double-clicking a connector adds or edits its label.
- [ ] Dragging a label moves it along the path, stored in `labelAt`.
- [ ] The line breaks around the label so the text stays readable.

### 3D. Assistant reads connectors

The assistant gets connectors today as items with empty text and no endpoints, so it can't see how things connect.

Touches: `components/AskPanel.tsx`, `lib/types.ts` (`AskRequest`), `app/api/ask`, `lib/assistant.ts`.

- [ ] Send items without connectors, plus `edges: { from, to, label }[]`, where `from` and `to` are item ids or `null` for free ends.
- [ ] Describe the edges to the model in the board context, and mention them in `SYSTEM_PROMPT` without changing the assistant's stance.

## Phase 4: Images, links, and embeds

Update the item list in `CLAUDE.md` when these kinds ship.

### 4A. Image storage pipeline

Image bytes never go in `items`, because a board document has a 1 MiB limit.

- [ ] Convex file storage: a `generateUploadUrl` mutation, and a query that turns `assetId`s into URLs. Both are owner-checked.
- [ ] In the browser, shrink images to at most 2048px on the long side and encode as WebP before upload.
- [ ] Add a scheduled Convex job (cron) that deletes stored files no board has referenced for 30 days. Don't delete when an item is deleted, because undo can bring it back.
- [ ] Decide how export handles images: inline as base64 in the JSON, or keep URLs. Write the choice down here.

### 4B. Image items on the canvas

- [ ] Paste an image, drag and drop image files, or upload from the toolbar.
- [ ] Show a local preview right away (`URL.createObjectURL`), then swap in the stored URL.
- [ ] Resizing keeps proportions by default. Duplicates share the same `assetId`.
- [ ] An optional caption that the assistant reads.

### 4C. Link cards and `/api/unfurl`

- [ ] A `POST /api/unfurl` route that fetches a URL and returns OpenGraph and Twitter card metadata. It needs the same session check as `/api/ask`. It must block private and loopback IPs (checked after DNS resolves and on every redirect), time out after 5 seconds, and stop reading after about 1 MB.
- [ ] Pasting a lone URL creates a link card with title, description, site name, favicon, and preview image. Store the metadata on the item and never fetch it again.
- [ ] Clicking a card opens the link in a new tab, unless you're dragging it.

### 4D. Embeds

- [ ] Use an allowlist of providers, each with its own URL rewrite: YouTube (`youtube-nocookie.com/embed`), Vimeo, Loom, Figma (`embed.figma.com`), Google Slides and Docs, CodePen, Spotify. Any other URL stays a link card.
- [ ] Show a still preview until you click to activate it. While inactive, a cover over the iframe takes pointer events so the embed can be dragged and selected. Esc or clicking outside deactivates it.
- [ ] Use sandboxed iframes with only the permissions each provider needs.
- [ ] Toggle between card and embed views from the selection bar.

### 4E. Assistant reads images and links

- [ ] Send captions, link titles, descriptions, and URLs to the assistant along with the text.
- [ ] Later and opt-in: send the image pixels to Claude.

## Phase 5: Structure, navigation, output

### 5A. Sections

- [ ] A titled, colored area. Moving it moves the items whose centers are inside. Resizing it doesn't move anything.
- [ ] Section names go to the assistant, so it can say "in the Research section".
- [ ] Sections render behind other items, and their title can be edited in place.

### 5B. Zoom menu, minimap, find

- [ ] The zoom % button opens a menu: zoom in, zoom out, 100%, fit, zoom to selection (Shift+2).
- [ ] A floating minimap that only appears while panning or zooming.
- [ ] Find (Cmd+F): a floating input with next and previous, which pans to and highlights matches.
- [ ] Jump to a section from a list.

### 5C. Viewport culling and performance

- [ ] Skip rendering items outside the viewport, plus a margin.
- [ ] Memoize `BoardItem` so a drag only re-renders the items that moved.
- [ ] Add a dev-only way to generate a board with 2,000 items. Panning and dragging should stay smooth.

### 5D. Export PNG and SVG

- [ ] Export the selection or the whole board as PNG or SVG, and copy as PNG to the clipboard.
- [ ] Images need CORS-readable URLs to appear in exports; check Convex storage URLs.
- [ ] PDF can come later.

### 5E. Templates and duplicate board

- [ ] Duplicate board in the board switcher.
- [ ] A few starter templates (flowchart, retro, kanban), stored as boards that get copied.

## Phase 6: Polish

### 6A. Context menu

- [ ] Right-click opens a menu with copy, paste, duplicate, stacking order, lock, group, and delete. Use `components/ui/context-menu.tsx`.
- [ ] On touch, a long press opens it.

### 6B. Shortcut sheet

- [ ] `?` opens a floating sheet listing the keyboard shortcuts, grouped. Keep it in sync with the handler in `Margin.tsx`.

### 6C. Touch polish

- [ ] Bigger handles and hit areas on touch screens (`pointer: coarse`).
- [ ] No feature that only works on hover.
- [ ] Test on an iPad: pan, pinch, select, move, resize, connect, and edit text.

### 6D. Accessibility

- [ ] Tab and Shift+Tab move between items, and Enter edits the focused item.
- [ ] Labels on toolbar and selection-bar controls.
- [ ] The flash animation respects `prefers-reduced-motion`.

## Not planned

- **Rotation.** It complicates hit-testing, resizing, connector anchors, and smart guides, for a feature people rarely use on whiteboards.
- Freehand drawing.
- Multiplayer and cursors.
- Comments.
- Stamps and voting.
- Timers and widgets.
- Obstacle-avoiding connector routing.
