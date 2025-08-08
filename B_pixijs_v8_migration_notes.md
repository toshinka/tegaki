# 📄 PixiJS v8 Migration Design Notes (Supplement to Rulebook)

This document is an additional chapter for the **JavaScript + PixiJS v7 Rulebook**.  
Its purpose is to ensure smooth migration from PixiJS v7 to v8, especially for projects aiming to add GIF animation mode, deformers (Live2D/SPINE-like), and mesh-based transformations.

---

## 1. Core Principles for v8 Readiness

1. **Centralize PixiJS API Calls**  
   - All PixiJS rendering, mesh creation, and texture loading should be handled in the `Core` layer (e.g., `PixiDrawingApp`).  
   - Avoid direct `PIXI.*` calls inside UI or tool modules.

2. **Abstract Rendering Logic**  
   - Create wrapper methods for drawing shapes, adding/removing objects, and applying filters.  
   - Example:
     ```js
     // Core abstraction
     addToStage(displayObject) { this.stage.addChild(displayObject); }
     ```

3. **Separate Logic and Rendering**  
   - Tool logic (`DrawingToolsSystem`) should never depend on specific Pixi v7 classes.  
   - Pass only abstracted methods or interfaces.

4. **Define Geometry & Mesh Interfaces**  
   - All custom mesh/deformer logic should have clear vertex data structures and update methods.  
   - Keep them independent from the current Pixi `Mesh` class to allow swapping to v8's new Mesh API.

---

## 2. Known API Changes (v7 → v8)

| Area                  | v7 Approach                           | v8 Approach                                | Migration Tip |
|-----------------------|----------------------------------------|---------------------------------------------|--------------|
| Application Init      | `new PIXI.Application({ ... })`       | Mostly same, but config keys may change     | Wrap in a factory method |
| Graphics API          | `graphics.drawCircle()` etc.          | Mostly same, minor param changes possible   | Keep all Graphics calls in one helper |
| Mesh                  | `PIXI.SimpleMesh` / `PIXI.Mesh`        | New Mesh system with better attribute binding | Use wrapper class for mesh creation |
| Textures              | `PIXI.Texture.from()`                 | Still valid, new loader optimizations       | Centralize all texture creation |
| Filters               | `new PIXI.Filter()`                   | Still valid, uniform binding changes        | Abstract filter creation and assignment |

---

## 3. Suggested File/Module Structure for Migration

```
src/
  core/
    PixiDrawingApp.js       // All Pixi init & rendering API
    MeshManager.js          // Mesh creation & deformation
    TextureManager.js       // Texture loading & caching
  tools/
    DrawingToolsSystem.js   // Tool logic (no direct Pixi API)
    PenTool.js
    EraserTool.js
  ui/
    UIManager.js            // UI logic only
    panels/
    controls/
  utils/
    geometryUtils.js
    colorUtils.js
```

---

## 4. Migration Checklist

- [ ] No direct `PIXI.*` calls in `ui/` or `tools/` directories.
- [ ] All rendering API calls in `core/` only.
- [ ] Mesh and geometry updates use wrapper functions.
- [ ] Textures and assets loaded only via `TextureManager`.
- [ ] Filters created only via centralized factory.

---

## 5. When to Migrate to v8

Recommended timing:
1. **After GIF Animation Mode is stable** (v7)  
2. Before adding **Live2D/SPINE-like deformers**  
3. Use this document + Rulebook + Symbol Dictionary for AI-assisted migration.

---
