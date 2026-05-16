\# Pen Engine Architecture Overview (2026)



\## Current Technical Direction



The project has changed significantly from its earlier architecture.



\### Previous Plan

\- WebGPU-based rendering pipeline

\- Experimental GPU-first architecture



\### Current Plan

\- WebGL2-based rendering

\- PixiJS as the rendering framework

\- Focus on stability, compatibility, and maintainability



WebGPU development is currently frozen.



\---



\# Primary Goal



Build a high-performance browser-based raster drawing engine for manga and illustration production.



Key requirements:

\- Pressure-sensitive pen input

\- Smooth, natural stroke rendering

\- Real-time GPU acceleration

\- Large canvas support

\- Future expansion toward animation tools



\---



\# Current Pen Technology Stack



\## Stroke Generation

\- perfect-freehand



\## Input Stabilization (planned / optional)

\- lazy-brush



\## Polygon Triangulation

\- Earcut (built into PixiJS)



\## Rendering

\- PixiJS Mesh

\- WebGL2



\---



\# Rendering Pipeline



Pointer Events

→ Optional Lazy Brush stabilization

→ perfect-freehand outline generation

→ Earcut triangulation

→ PixiJS Mesh

→ WebGL2 rendering



\---



\# Why perfect-freehand is Retained



perfect-freehand remains the industry-standard solution for browser-based raster brush generation.



Advantages:

\- Pressure support

\- Tapering

\- Smooth interpolation

\- Proven in production tools such as tldraw

\- Mature and stable



Conclusion:

No replacement is currently necessary.



\---



\# Potential Enhancements



\## Near-Term

\- Integrate lazy-brush for stroke stabilization

\- Improve brush texture rendering

\- Optimize triangulation caching



\## Mid-Term

\- Stamp-based textured brushes

\- Blend mode improvements

\- Undo/redo performance tuning



\## Long-Term

\- AI-assisted stroke correction

\- Animation support

\- Physics-based deformation tools



\---



\# Recommended Responsibilities for Codex



Codex should focus on:

\- Refactoring pen engine modules

\- Integrating lazy-brush

\- Optimizing WebGL2 rendering

\- Improving mesh generation performance

\- Adding tests and benchmarks



Codex should NOT:

\- Reintroduce WebGPU code

\- Replace perfect-freehand without strong justification



\---



\# Architectural Principles



\- Maintain modular design

\- Preserve separation of concerns

\- Prioritize stability over experimentation

\- Optimize only after profiling

\- Keep future extensibility in mind



\---



\# Current Recommendation



Continue using the following stack:



\- Pointer Events

\- lazy-brush (optional)

\- perfect-freehand

\- Earcut

\- PixiJS Mesh

\- WebGL2



This is considered the most practical and modern browser-based raster drawing pipeline as of 2026.

