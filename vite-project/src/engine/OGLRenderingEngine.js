// src/engine/rendering/OGLRenderingEngine.js

import { Renderer, Camera, Transform, Program, Mesh, Geometry } from 'ogl'; [cite: 111]

export class OGLRenderingEngine {
    constructor() {
        this.renderer = null; [cite: 112]
        this.gl = null;
        this.camera = null; [cite: 112]
        this.scene = null; [cite: 112]
        this.program = null;
        this.currentStrokeMesh = null;
        this.allStrokes = [];
    }

    initialize(canvas, config = {}) {
        this.renderer = new Renderer({ canvas, alpha: true, antialias: true }); [cite: 114]
        this.gl = this.renderer.gl;
        this.gl.clearColor(1, 1, 1, 1);
        
        this.camera = new Camera(this.gl, { left: 0, right: canvas.width, top: 0, bottom: canvas.height, near: -1, far: 1 }); [cite: 114]
        this.scene = new Transform(); [cite: 114]

        this.program = this.createProgram(config); [cite: 115]
    }

    startStroke() {
        const geometry = new Geometry(this.gl, {
            position: { size: 2, data: new Float32Array(0) },
        });
        this.currentStrokeMesh = new Mesh(this.gl, { geometry, program: this.program }); [cite: 118]
        this.currentStrokeMesh.setParent(this.scene); [cite: 118]
    }

    renderPath(pathData) {
        if (!pathData || !pathData.points || !this.currentStrokeMesh) return; [cite: 116]

        const newVertices = this.createVerticesFromPath(pathData); [cite: 41, 45]
        if (newVertices.length === 0) return;

        const currentVertices = this.currentStrokeMesh.geometry.attributes.position.data;
        const combinedVertices = new Float32Array(currentVertices.length + newVertices.length);
        combinedVertices.set(currentVertices, 0);
        combinedVertices.set(newVertices, currentVertices.length);

        this.currentStrokeMesh.geometry.attributes.position.data = combinedVertices;
        this.currentStrokeMesh.geometry.attributes.position.needsUpdate = true;
        this.currentStrokeMesh.geometry.computeBoundingBox();

        this.render(); [cite: 119]
    }

    endStroke() {
        if (this.currentStrokeMesh) {
            this.allStrokes.push(this.currentStrokeMesh);
            this.currentStrokeMesh = null;
        }
    }
    
    render() {
        this.renderer.render({ scene: this.scene, camera: this.camera }); [cite: 119]
    }

    createVerticesFromPath(pathData) {
        const vertices = [];
        const points = pathData.points;
        const widths = pathData.widths;
        if (points.length < 2) return vertices;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const width1 = widths[i];
            const width2 = widths[i + 1];
            const segment = this.createLineSegment(p1, p2, width1, width2); [cite: 49]
            vertices.push(...segment);
        }
        return vertices;
    }

    createLineSegment(p1, p2, width1, width2) {
        const dx = p2.x - p1.x; [cite: 51]
        const dy = p2.y - p1.y; [cite: 51]
        let length = Math.sqrt(dx * dx + dy * dy); [cite: 52]
        if (length === 0) length = 0.0001;

        const nx = -dy / length; [cite: 53]
        const ny = dx / length; [cite: 54]
        
        const hw1 = width1 / 2; [cite: 55]
        const hw2 = width2 / 2; [cite: 55]

        return [
            p1.x + nx * hw1, p1.y + ny * hw1,
            p1.x - nx * hw1, p1.y - ny * hw1,
            p2.x + nx * hw2, p2.y + ny * hw2,
            p2.x + nx * hw2, p2.y + ny * hw2,
            p1.x - nx * hw1, p1.y - ny * hw1,
            p2.x - nx * hw2, p2.y - ny * hw2,
        ]; [cite: 56, 57]
    }
    
    createProgram(config) {
        const vertex = `
            attribute vec2 position;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.0, 1.0);
            }
        `; [cite: 123]
        const fragment = `
            precision highp float;
            uniform vec3 uColor;
            uniform float uAlpha;
            void main() {
                gl_FragColor = vec4(uColor, uAlpha);
            }
        `; [cite: 126]

        return new Program(this.gl, {
            vertex,
            fragment,
            uniforms: {
                uColor: { value: config.color || [0, 0, 0] },
                uAlpha: { value: config.alpha || 1.0 },
            }, [cite: 127]
        });
    }

    dispose() {
        this.allStrokes.forEach(mesh => mesh.geometry.dispose()); [cite: 65]
        if (this.currentStrokeMesh) this.currentStrokeMesh.geometry.dispose();
        if (this.program) this.program.dispose();
        this.scene = new Transform();
        this.allStrokes = [];
    }
}