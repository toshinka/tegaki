/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/gl-texture-bridge.js
 * 責務: WebGLTextureからPIXI.Spriteへの変換を担当する
 * 依存: pixi.js, webgl2-drawing-layer.js
 * 被依存: stroke-renderer.js
 * 公開API: GLTextureBridge, glTextureBridge
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.GLTextureBridge
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { Texture, Sprite } from 'pixi.js';

export class GLTextureBridge {
    constructor() {
        this.gl = null;
        this.initialized = false;
        this.pixiApp = null;
    }

    /**
     * 初期化
     * @param {WebGL2RenderingContext} gl - WebGL2コンテキスト
     * @param {PIXI.Application} pixiApp - PixiJSアプリケーション
     */
    async initialize(gl, pixiApp) {
        if (this.initialized) {
            console.warn('[GLTextureBridge] Already initialized');
            return;
        }

        this.gl = gl;
        this.pixiApp = pixiApp;
        this.initialized = true;

        console.log('[GLTextureBridge] ✅ Initialized (PixiJS v8)');
    }

    /**
     * WebGLTexture → PIXI.Sprite変換
     * 
     * @param {WebGLTexture} glTexture - WebGL2テクスチャ
     * @param {number} width - テクスチャ幅
     * @param {number} height - テクスチャ高さ
     * @returns {Promise<PIXI.Sprite|null>}
     */
    async createSpriteFromGLTexture(glTexture, width, height) {
        if (!this.initialized) {
            console.error('[GLTextureBridge] Not initialized');
            return null;
        }

        if (!glTexture) {
            console.error('[GLTextureBridge] Invalid texture');
            return null;
        }

        if (!width || !height || width <= 0 || height <= 0) {
            console.error('[GLTextureBridge] Invalid dimensions:', { width, height });
            return null;
        }

        try {
            const canvas = await this._glTextureToCanvas(glTexture, width, height);
            if (!canvas) {
                console.error('[GLTextureBridge] Failed to convert texture to canvas');
                return null;
            }

            const texture = Texture.from(canvas);
            const sprite = new Sprite(texture);
            sprite.anchor.set(0, 0);

            return sprite;

        } catch (error) {
            console.error('[GLTextureBridge] Error creating sprite:', error);
            return null;
        }
    }

    /**
     * WebGLTexture → Canvas変換（readPixels使用）
     * @private
     * @param {WebGLTexture} glTexture - WebGL2テクスチャ
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @returns {Promise<HTMLCanvasElement|null>}
     */
    async _glTextureToCanvas(glTexture, width, height) {
        const gl = this.gl;

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            glTexture,
            0
        );

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('[GLTextureBridge] FBO incomplete for readPixels:', status);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(fbo);
            return null;
        }

        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('[GLTextureBridge] Failed to get 2d context');
            return null;
        }

        const imageData = ctx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            const srcRow = (height - 1 - y) * width * 4;
            const dstRow = y * width * 4;
            
            for (let x = 0; x < width * 4; x++) {
                imageData.data[dstRow + x] = pixels[srcRow + x];
            }
        }

        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    /**
     * WebGPU互換API: createSpriteFromGPUTexture
     * 内部でcreateSpriteFromGLTextureに委譲
     */
    async createSpriteFromGPUTexture(texture, width, height) {
        return this.createSpriteFromGLTexture(texture, width, height);
    }

    destroy() {
        this.gl = null;
        this.pixiApp = null;
        this.initialized = false;
    }
}

export const glTextureBridge = new GLTextureBridge();

// 下位互換性のためにグローバルに登録
window.GLTextureBridge = glTextureBridge;
window.WebGPUTextureBridge = glTextureBridge;

console.log('✅ gl-texture-bridge.js Phase 5完全版 (PixiJS v8対応) loaded');
console.log('   ✅ WebGLTexture → PIXI.Sprite変換実装完了');
console.log('   ✅ PixiJS v8: Texture.from()直接使用');
