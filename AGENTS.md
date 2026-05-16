# AGENTS.md

> AI agents should read this file first. The authoritative project plan is `TEGAKI.md`.

## Read Order

1. `TEGAKI.md`
   - Project direction, current phase, technical stack, forbidden changes.
2. `tegaki_work/PROGRESS.md`
   - Current implementation state, confirmed fixes, known issues.
3. The task-specific instruction file named by the owner.
   - Short fix: `GEMINI作業指示書.txt`
   - Phase work: `task-gemini/*.md`
   - Codex guidance: `CODEX.md`
   - Gemini guidance: `GEMINI.md`

## Workspace Rules

- Current implementation target: `tegaki_work/`.
- Do not edit `PastFiles/` unless the owner explicitly asks.
- Treat old `tegaki_phase*` references as historical unless confirmed by `TEGAKI.md`.
- Do not leave build artifacts in `tegaki_work/dist/` unless the owner asks for them.
- Do not revert unrelated user or agent changes.

## Engineering Rules

- Search with `rg` before adding a new class, function, event, or responsibility.
- Prefer existing EventBus contracts and local helper APIs.
- Keep edits narrowly scoped to the requested bug or phase.
- Update file headers when dependencies, emitted events, received events, or responsibilities change.
- Use `TEGAKI_CONFIG.debug` for temporary diagnostic logs; remove noisy logs after confirmation.
- Run `npm.cmd run build` from `tegaki_work/` when code changes are made.

## Current Tegaki Direction

- Drawing is raster-first: live stroke segments are baked into each layer's `RenderTexture`.
- Layers are PixiJS `Container + Sprite(RenderTexture)`.
- Background is a special layer with opaque `backgroundGraphics`; do not treat it as a normal merge target.
- Perfect Freehand is auxiliary/legacy, not the sole source of truth for current drawing.
- WebGPU/SDF/MSDF/WebGL2 mesh paths are frozen unless a phase explicitly reopens them.

## Agent Roles

- Codex: local investigation, root-cause fixes, document synchronization, narrow code changes.
- Claude: design review and second opinion.
- Gemini CLI: implementation from explicit instruction files.

When this file conflicts with `TEGAKI.md`, `TEGAKI.md` wins.
