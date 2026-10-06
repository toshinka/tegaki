# WP-035 Slice A/B — Rive grid3 mesh result

## Scope and authority

- Start: `main` / `4760db9c16f2af50345916381d45559cec7b1733`.
- Slice A: fixed quad/grid3 authoring model, strict source parsing, official CLI proof, and a visible receipt fixture.
- Slice B: bounded profile/weight draft UI and server wiring, plus native Web receipt instrumentation in the fixture.
- Project/History/save/renderer authorities, live processes, and other projects remained read-only; saved source remains the profile/weight authority.
- Existing dirty worktree content was preserved. No commit or push was made.

## Implemented files

- [mesh-profile.mjs](../../tegaki_work/advanced/rive-editor/mesh-profile.mjs) — profile definitions, UV/order/kind checks, topology bytes, packed Root/End weights, and quad↔grid3 conversion.
- [model.mjs](../../tegaki_work/advanced/rive-editor/model.mjs) — keeps the existing quad source template byte-identical and adds `meshProfile: "grid3"` generation/parsing and source-derived snapshot fields.
- [verify-rive-editor-grid.mjs](../../tegaki_work/build/verify-rive-editor-grid.mjs) — pure checks plus bounded official CLI/native evidence under `.cache/rive-editor/wp035`.
- [weight-editor.js](../../tegaki_work/advanced/rive-editor/weight-editor.js) — quad/grid3 draft controller, raw field validity, fixed conversion, and Apply/Discard lifecycle.
- [editor.js](../../tegaki_work/advanced/rive-editor/editor.js) / [editor.html](../../tegaki_work/advanced/rive-editor/editor.html) — profile selector, 4/9 controls, operation guards, and source-derived snapshot fields.
- [server.mjs](../../tegaki_work/advanced/rive-editor/server.mjs) — profile/weight validation before CLI, profile-preserving image replacement, and grid topology snapshot fields.
- [wp035-rive-grid-browser.html](../../tegaki_work/build/wp035-rive-grid-browser.html) — visible trusted PNG receipt plus optional `.riv` load/render/dispose receipt through the existing `RiveNativeRuntime`; it does not synthesize product input or call mutation APIs.
- [wp035-grid-verification.json](../../tegaki_work/.cache/rive-editor/wp035/wp035-grid-verification.json) and [native-grid-receipt.json](../../tegaki_work/.cache/rive-editor/wp035/native-grid-receipt.json) — bounded evidence receipts.

## Model result

- Existing quad source was recreated byte-for-byte from `wp034-saved-backup/scene.rml`.
- Grid profile has eight ordered `ContourMeshVertex` entries followed by one `MeshVertex` center, with UVs `0/0.5/1` and image-local bounds derived from the source dimensions.
- Fixed fan topology: `[[0,1,8],[1,2,8],[2,3,8],[3,4,8],[4,5,8],[5,6,8],[6,7,8],[7,0,8]]`.
- Fixed `triangleIndexBytes`: `AAEIAQIIAgMIAwQIBAUIBQYIBgcIBwAI`.
- Default grid bytes derived from the existing quad `[0,255,255,0]`: `[0,128,255,255,255,128,0,0,128]`.
- Custom native proof bytes: `[0,180,255,220,255,60,0,30,150]`. Unknown profiles, wrong vertex counts, wrong kinds/order/UVs, wrong topology, and unsupported packed weights reject without fallback.

## Fixed CLI/native proof

`verify-rive-editor-grid.mjs` passed **96 checks**. The fixed cache gate passed with the existing `rive 1.3.0` CLI and `runtime 2.44.0` hashes recorded in the receipt.

The existing quad compatibility verifiers also passed: `verify-rive-editor-model.mjs` and `verify-rive-editor-weights.mjs` (63 checks).

- `default-grid`: `--verify`, `--once`, `inspect`, and progress-1 screenshot passed. `.riv` SHA-256: `d45c5e3bf9f3649019faaf18624f3649084b6f69fecff081930137df6db2c748`; PNG SHA-256: `fbea60e58b810ff5baace543ba548d2e183b56469a0223be69c65a25a0c95b46`.
- `mixed-grid`: `.riv` SHA-256 `a5e264f07f37622d925d25fc9b683e07dd2b1cb3dbbda7ac71c1e938960b9010`; progress-1 PNG SHA-256 `3a4601696f500a8541e625969b5029129c2283fbf476f879017a5de9351073e1`.
- `reload-grid`: copied mixed source into a separate directory and rebuilt in a new CLI process. Source, `.riv`, and progress-1 PNG hashes match `mixed-grid` exactly.
- Default versus mixed progress-1 PNG hashes differ, proving a native pixel change from the middle/edge weight change at 56°.
- `inspect` reports `GridMesh3` with 9 vertices and all 8 expected triangles for all three directories.

## Verification boundary

- Syntax: `model.mjs`, `mesh-profile.mjs`, `weight-editor.js`, `editor.js`, `server.mjs`, and `verify-rive-editor-grid.mjs` passed `node --check`.
- Slice B static/controller/API checks are included in the 96-check verifier. They cover profile selection as draft-only, raw invalid/empty preservation, invalid-draft profile-switch rejection with selector/raw/scene preservation, 9→4 corner conversion and warning, one explicit Apply callback, operation blocking, profile validation before CLI, image/profile preservation, source-authoritative reopen/cancel wiring, and the 400-vs-500 input error boundary.
- Audit correction: `.weight-row[hidden]` is forced to `display: none`, so quad renders four rows and grid3 renders the 3×3 rows; the center note is grid-only; invalid profile switching is rejected before conversion; only recognized input-validation prefixes return `400/input-rejected`, while internal failures remain `500/server-error`.
- The fixture now has a trusted manual `.riv` path that instantiates a new `RiveNativeRuntime`, calls `load`/`render(1)`, records RGBA SHA-256, transparent pixels, alpha bounds, then calls `dispose`. This native Web interaction was not run in this turn, so Browser/native Web and Owner acceptance remain `UNVERIFIED`.
- CLI/native proof is separate from the Browser fixture: fixed-cache native CLI and pixel comparison are `PASS`; Browser visual and Owner acceptance remain `UNVERIFIED`.
- The live 18729/PID48196 and 5174 services were not stopped, restarted, or given a second cache/server.

