# 📚 Common Symbol Dictionary - Template (PixiJS v7 Drawing App)

## 1. Core Application
Main application control, rendering core, and system integration.

| Symbol Name     | Type   | Description                                               | File         | Dependencies                                     | Arguments / Return                                     | Example                                                              | Notes                            |
|-----------------|--------|-----------------------------------------------------------|--------------|---------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|----------------------------------|
| PixiDrawingApp  | Class  | Core PixiJS application handling rendering and canvas setup. | app-core.js  | PIXI.Application, DrawingToolsSystem, UIManager  | constructor(width: number, height: number) / void      | const app = new PixiDrawingApp(400, 400); app.init();                | Call init() after PIXI is loaded. |

## 2. Drawing Tools
All vector pen, eraser, and tool logic classes.

| Symbol Name     | Type   | Description                                               | File         | Dependencies                                     | Arguments / Return                                     | Example                                                              | Notes                            |
|-----------------|--------|-----------------------------------------------------------|--------------|---------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|----------------------------------|
| DrawingToolsSystem | Class  | Manages all drawing tools and integrates with PixiDrawingApp. | drawing-tools.js | PixiDrawingApp                                   | constructor(app: PixiDrawingApp) / void                | const tools = new DrawingToolsSystem(app); tools.init();             | Initialize after PixiDrawingApp. |

## 3. UI Components
UI elements including panels, buttons, sliders, and popups.

| Symbol Name     | Type   | Description                                               | File         | Dependencies                                     | Arguments / Return                                     | Example                                                              | Notes                            |
|-----------------|--------|-----------------------------------------------------------|--------------|---------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|----------------------------------|
| UIManager       | Class  | Handles UI interactions, updates status bar, and popups.  | ui-manager.js| PixiDrawingApp, DrawingToolsSystem                | constructor(app: PixiDrawingApp, tools: DrawingToolsSystem) / void | const ui = new UIManager(app, tools); ui.init();                     | Call after both app and tools are initialized. |

## 4. Utility & Helpers
Helper functions and utility modules.

| Symbol Name     | Type   | Description                                               | File         | Dependencies                                     | Arguments / Return                                     | Example                                                              | Notes                            |
|-----------------|--------|-----------------------------------------------------------|--------------|---------------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|----------------------------------|
| screenToWorld   | Function | Converts screen coordinates to world coordinates.        | viewport-utils.js | PIXI.Container                                   | screenToWorld(x: number, y: number) / { x: number, y: number } | const pos = screenToWorld(100, 200);                                | Used in panning and zooming logic. |
