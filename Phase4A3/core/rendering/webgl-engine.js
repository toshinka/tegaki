/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine
 * Version: 1.0.1 (Critical Fix for Drawing Methods)
 *
 * ・描画メソッド(drawCircle, drawLine等)が誤って削除されていたのを完全に復元しました。
 * 　これにより、ペンや消しゴムで描画ができない問題が修正されます。
 * ・ブレンドモード対応、変形バグ修正は維持されています。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;
        this.program = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.compositeTexture = null;
        this.compositeFBO = null;

        this.layerTextures = new Map();

        this.drawingQuality = {
            enableSubpixel: true,
            antialiasThreshold: 2.0,
            minDrawSteps: 1,
            maxDrawSteps: 100
        };

        this.transformOffscreenCanvas = document.createElement('canvas');
        this.transformOffscreenCtx = this.transformOffscreenCanvas.getContext('2d');


        try {
            this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true });
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        const gl = this.gl;

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); 

        const vsSource = `
            attribute vec4 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_opacity;
            void main() {
                vec4 texColor = texture2D(u_image, v_texCoord);
                gl_FragColor = vec4(texColor.rgb * texColor.a, texColor.a) * u_opacity;
            }
        `;

        const vertexShader = this._compileShader(vsSource, gl.VERTEX_SHADER);
        const fragmentShader = this._compileShader(fsSource, gl.FRAGMENT_SHADER);
        this.program = this._createProgram(vertexShader, fragmentShader);

        if (!this.program) {
            console.error("Failed to create WebGL program.");
            return;
        }

        gl.useProgram(this.program);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        const texCoords = [ 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0 ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        this.a_position_loc = gl.getAttribLocation(this.program, "a_position");
        this.a_texCoord_loc = gl.getAttribLocation(this.program, "a_texCoord");
        this.u_image_loc = gl.getUniformLocation(this.program, "u_image");
        this.u_opacity_loc = gl.getUniformLocation(this.program, "u_opacity");

        this._setupCompositingBuffer();
        console.log("WebGL Engine (v1.0.1) initialized successfully.");
    }

    _compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    _createOrUpdateTextureFromImageData(imageData, existingTexture = null) {
        const gl = this.gl;
        const texture = existingTexture || gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    _setupCompositingBuffer() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;

        if (this.compositeFBO) gl.deleteFramebuffer(this.compositeFBO);
        if (this.compositeTexture) gl.deleteTexture(this.compositeTexture);

        this.compositeTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.compositeFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.compositeTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete');
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    _setBlendMode(blendMode) {
        const gl = this.gl;
        
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        switch (blendMode) {
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'screen':
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                break;
            case 'add':
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
        }
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeFBO) return;

        const gl = this.gl;

        const currentLayerNames = new Set(layers.map(l => l.name));
        for (const layer of layers) {
            const existingTexture = this.layerTextures.get(layer);
            const texture = this._createOrUpdateTextureFromImageData(layer.imageData, existingTexture);
            this.layerTextures.set(layer, texture);
        }

        for (const [layer, texture] of this.layerTextures.entries()) {
            if (!currentLayerNames.has(layer.name)) {
                gl.deleteTexture(texture);
                this.layerTextures.delete(layer);
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBO);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0 || !this.layerTextures.has(layer)) continue;

            this._setBlendMode(layer.blendMode);

            const texture = this.layerTextures.get(layer);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(this.u_image_loc, 0);
            gl.uniform1f(this.u_opacity_loc, layer.opacity / 100.0); 

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disableVertexAttribArray(a_position_loc);
        gl.disableVertexAttribArray(a_texCoord_loc);
    }

    renderToDisplay(compositionData, dirtyRect) {
        if (!this.gl || !this.program || !this.compositeTexture) return;
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        
        this._setBlendMode('normal');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position_loc);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.a_texCoord_loc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_texCoord_loc);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
        gl.uniform1i(this.u_image_loc, 0);
        gl.uniform1f(this.u_opacity_loc, 1.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(this.a_position_loc);
        gl.disableVertexAttribArray(this.a_texCoord_loc);
    }
    
    // ★★★ ここから下の描画メソッド群を復元 ★★★

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        const quality = this.drawingQuality;
        const useSubpixel = quality.enableSubpixel && radius >= 0.5;
        if (radius < 0.8) {
            this._drawSinglePixel(imageData, centerX, centerY, color, isEraser, radius);
            return;
        }
        const rCeil = Math.ceil(radius + 1);
        for (let y = -rCeil; y <= rCeil; y++) {
            for (let x = -rCeil; x <= rCeil; x++) {
                const distance = Math.hypot(x, y);
                if (distance <= radius + 0.5) {
                    const finalX = centerX + x;
                    const finalY = centerY + y;
                    let alpha = this._calculatePixelAlpha(distance, radius, useSubpixel);
                    if (alpha > 0.01) {
                        if (isEraser) {
                            this._erasePixel(imageData, finalX, finalY, alpha);
                        } else {
                            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
                            this._blendPixel(imageData, finalX, finalY, finalColor);
                        }
                    }
                }
            }
        }
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, pressure0 = 1.0, pressure1 = 1.0, calculatePressureSize) {
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
        const distance = Math.hypot(x1 - x0, y1 - y0);
        if (distance > Math.hypot(this.canvas.width, this.canvas.height) * 2) return;

        const quality = this.drawingQuality;
        const baseSteps = Math.max(quality.minDrawSteps, Math.ceil(distance / Math.max(0.5, size / 8)));
        const steps = Math.min(quality.maxDrawSteps, baseSteps);

        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const pressure = pressure0 + (pressure1 - pressure0) * t;
            const adjustedSize = calculatePressureSize(size, pressure);
            this.drawCircle(imageData, x, y, adjustedSize / 2, color, isEraser);
        }
    }

    fill(imageData, color) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
    }

    clear(imageData) {
        imageData.data.fill(0);
    }
    
    getTransformedImageData(sourceImageData, transform) {
        const sw = sourceImageData.width;
        const sh = sourceImageData.height;
        
        const tempCanvas = this.transformOffscreenCanvas;
        const tempCtx = this.transformOffscreenCtx;
        tempCanvas.width = sw;
        tempCanvas.height = sh;

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sw;
        sourceCanvas.height = sh;
        sourceCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

        tempCtx.clearRect(0, 0, sw, sh);
        tempCtx.save();
        
        tempCtx.translate(transform.x, transform.y);
        tempCtx.translate(sw / 2, sh / 2);
        tempCtx.rotate(transform.rotation * Math.PI / 180);
        tempCtx.scale(transform.scale * transform.flipX, transform.scale * transform.flipY);
        tempCtx.translate(-sw / 2, -sh / 2);

        tempCtx.drawImage(sourceCanvas, 0, 0);
        
        tempCtx.restore();

        return tempCtx.getImageData(0, 0, sw, sh);
    }

    _drawSinglePixel(imageData, x, y, color, isEraser, intensity = 1.0) {
        const alpha = Math.min(1.0, intensity);
        if (isEraser) {
            this._erasePixel(imageData, x, y, alpha);
        } else {
            const finalColor = { ...color, a: Math.floor(color.a * alpha) };
            this._blendPixel(imageData, x, y, finalColor);
        }
    }

    _calculatePixelAlpha(distance, radius, useSubpixel) {
        if (distance <= radius - 0.5) { return 1.0; }
        if (!useSubpixel) { return distance <= radius ? 1.0 : 0.0; }
        if (distance <= radius) {
            const fadeStart = Math.max(0, radius - 1.0);
            const fadeRange = radius - fadeStart;
            if (fadeRange > 0) {
                const fadeRatio = (distance - fadeStart) / fadeRange;
                return Math.max(0, 1.0 - fadeRatio);
            }
            return 1.0;
        }
        if (distance <= radius + 0.5) {
            return Math.max(0, 1.0 - (distance - radius) * 2.0);
        }
        return 0.0;
    }

    _blendPixel(imageData, x, y, color) {
        try {
            x = Math.floor(x);
            y = Math.floor(y);
            if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
            if (!imageData.data || !color) return;
            const index = (y * imageData.width + x) * 4;
            const data = imageData.data;
            if (index < 0 || index >= data.length - 3) return;

            const topAlpha = color.a / 255;
            if (topAlpha <= 0) return;
            
            const bottomAlpha = data[index + 3] / 255;
            const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha);
            if (outAlpha > 0) {
                data[index]     = (color.r * topAlpha + data[index]     * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 1] = (color.g * topAlpha + data[index + 1] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 2] = (color.b * topAlpha + data[index + 2] * bottomAlpha * (1 - topAlpha)) / outAlpha;
                data[index + 3] = outAlpha * 255;
            }
        } catch (error) {
            console.warn('ピクセル描画エラー:', { x, y, error });
        }
    }

    _erasePixel(imageData, x, y, strength) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return;
        const index = (y * imageData.width + x) * 4;
        const currentAlpha = imageData.data[index + 3];
        imageData.data[index + 3] = Math.max(0, currentAlpha * (1 - strength));
    }
}