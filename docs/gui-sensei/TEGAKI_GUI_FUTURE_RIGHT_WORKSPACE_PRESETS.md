# TEGAKI Future GUI Concept — Right Workspace Presentation Presets

Status: Future concept only. Not implemented or Owner-approved.

## Intent

The Right Workspace may eventually expose presentation presets without changing
the current Layer, CAF, Transform, History, or Canvas authorities. Presets are
visual arrangements of the existing contextual work area, not new persistence
or editing modes.

## Candidate presets

- **Full contextual workspace** — the current detailed Layer/CAF or Transform
  presentation, with the action rail and shared atmospheric surface visible.
- **Thumbnail-only Layer** — compact Layer thumbnails and essential state,
  keeping the existing selection and editing ownership intact.
- **Collapsed workspace** — hide the Right Workspace content and return its
  reserved width to the Canvas/Dock layout while retaining the same shared
  atmospheric gradient when the workspace is reopened.

## Future layout conditions

The preset switch must derive its width from the existing Right Workspace
owner. Collapsing the workspace may release that width to Canvas and Dock, but
must not move artwork coordinates or create a second status owner. The shared
gradient should remain a screen-space atmosphere, independent of which preset
is visible or how the Dock is resized, minimized, or maximized.

## Explicit non-scope

This note does not define a schema, preset storage, a new renderer, or an
implementation contract. The current Card records the concept only; it does
not implement any preset or revise the existing research documents.
