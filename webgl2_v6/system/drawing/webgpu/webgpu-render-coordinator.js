/**
 * ================================================================================
 * webgpu-render-coordinator.js Phase 2新規実装
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - system/drawing/webgpu/webgpu-drawing-layer.js (WebGPUDrawingLayer)
 *   - PIXI.js v8.14 (Pixi.Application)
 * 
 * 📄 子ファイル使用先:
 *   - core-initializer.js
 * 
 * 【責務】
 * - WebGPUとPixi.jsの単一統合レンダーループ管理
 * - GPU競合解消（WebGPU→Pixi順序制御）
 * - フレームタイミング統一制御
 * - リソースクリーンアップ統合管理
 * 
 * 【アーキテクチャ原則】
 * - WebGPUがMaster Loop所有権を持つ
 * - Pixiは手動レンダリング（ticker停止必須）
 * - 1フレームに1回のみrequestAnimationFrame発行
 * - 描画順序: WebGPU render → Pixi render
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPURenderCoordinator {
        /**
         * @param {HTMLCanvasElement} webgpuCanvas - WebGPU描画用canvas
         * @param {PIXI.Application} pixiApp - Pixi.js UI用アプリ
         * @param {WebGPUDrawingLayer} webgpuLayer - WebGPU描画レイヤー
         */
        constructor(webgpuCanvas, pixiApp, webgpuLayer) {
            if (!webgpuCanvas) throw new Error('[RenderCoordinator] webgpuCanvas is null');
            if (!pixiApp) throw new Error('[RenderCoordinator] pixiApp is null');
            if (!webgpuLayer) throw new Error('[RenderCoordinator] webgpuLayer is null');
            
            this.webgpuCanvas = webgpuCanvas;
            this.pixiApp = pixiApp;
            this.webgpuLayer = webgpuLayer;
            
            this.isRunning = false;
            this.rafId = null;
            this.frameCount = 0;
            this.lastFrameTime = 0;
            this.fps = 0;
            
            this.gpuContext = null;
            
            // パフォーマンス統計
            this.stats = {
                totalFrames: 0,
                droppedFrames: 0,
                avgFrameTime: 0,
                gpuRenderTime: 0,
                pixiRenderTime: 0
            };
        }

        /**
         * 初期化
         */
        async initialize() {
            console.log('[RenderCoordinator] Initializing...');
            
            // WebGPU Context取得
            if (!navigator.gpu) {
                throw new Error('[RenderCoordinator] WebGPU not supported');
            }
            
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                throw new Error('[RenderCoordinator] GPU adapter not found');
            }
            
            const device = await adapter.requestDevice();
            if (!device) {
                throw new Error('[RenderCoordinator] GPU device creation failed');
            }
            
            this.gpuContext = this.webgpuCanvas.getContext('webgpu');
            if (!this.gpuContext) {
                throw new Error('[RenderCoordinator] WebGPU context creation failed');
            }
            
            const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
            this.gpuContext.configure({
                device: device,
                format: canvasFormat,
                alphaMode: 'premultiplied'
            });
            
            // Pixi ticker停止確認
            if (this.pixiApp.ticker.started) {
                console.warn('[RenderCoordinator] Pixi ticker still running, stopping...');
                this.pixiApp.ticker.stop();
            }
            
            console.log('[RenderCoordinator] Initialized successfully');
            return true;
        }

        /**
         * レンダーループ開始
         */
        startRenderLoop() {
            if (this.isRunning) {
                console.warn('[RenderCoordinator] Already running');
                return;
            }
            
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            
            console.log('[RenderCoordinator] Starting Master Render Loop');
            this._renderLoop(performance.now());
        }

        /**
         * レンダーループ停止
         */
        stopRenderLoop() {
            if (!this.isRunning) return;
            
            this.isRunning = false;
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            
            console.log('[RenderCoordinator] Stopped');
        }

        /**
         * Master Render Loop（1フレームに1回のみ実行）
         * @private
         */
        _renderLoop(timestamp) {
            if (!this.isRunning) return;
            
            const deltaTime = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;
            
            // フレーム統計更新
            this.frameCount++;
            this.stats.totalFrames++;
            
            if (deltaTime > 16.7 * 2) {
                this.stats.droppedFrames++;
            }
            
            try {
                // 1. WebGPU描画実行
                const gpuStartTime = performance.now();
                this._renderWebGPU();
                this.stats.gpuRenderTime = performance.now() - gpuStartTime;
                
                // 2. Pixi手動レンダリング実行
                const pixiStartTime = performance.now();
                this._renderPixi();
                this.stats.pixiRenderTime = performance.now() - pixiStartTime;
                
            } catch (error) {
                console.error('[RenderCoordinator] Render error:', error);
                this.stats.droppedFrames++;
            }
            
            // 次フレーム登録（1回のみ）
            this.rafId = requestAnimationFrame((ts) => this._renderLoop(ts));
        }

        /**
         * WebGPU描画実行
         * @private
         */
        _renderWebGPU() {
            if (!this.webgpuLayer) return;
            
            // WebGPUDrawingLayerの描画メソッド呼び出し
            if (typeof this.webgpuLayer.render === 'function') {
                this.webgpuLayer.render();
            }
        }

        /**
         * Pixi手動レンダリング実行
         * @private
         */
        _renderPixi() {
            if (!this.pixiApp || !this.pixiApp.renderer || !this.pixiApp.stage) {
                return;
            }
            
            try {
                // 手動レンダリング（ticker停止状態で実行）
                this.pixiApp.renderer.render(this.pixiApp.stage);
            } catch (error) {
                console.error('[RenderCoordinator] Pixi render failed:', error);
            }
        }

        /**
         * FPS計算（1秒ごと更新）
         */
        _updateFPS() {
            const now = performance.now();
            const elapsed = now - this.lastFPSUpdate;
            
            if (elapsed >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / elapsed);
                this.frameCount = 0;
                this.lastFPSUpdate = now;
            }
        }

        /**
         * パフォーマンス統計取得
         */
        getStats() {
            return {
                ...this.stats,
                fps: this.fps,
                isRunning: this.isRunning
            };
        }

        /**
         * リソースクリーンアップ
         */
        destroy() {
            this.stopRenderLoop();
            
            if (this.gpuContext) {
                this.gpuContext.unconfigure();
                this.gpuContext = null;
            }
            
            console.log('[RenderCoordinator] Destroyed');
        }
    }

    window.WebGPURenderCoordinator = WebGPURenderCoordinator;

})();

console.log('✅ webgpu-render-coordinator.js Phase 2 loaded');
console.log('   🔧 Master Render Loop統合');
console.log('   🔧 WebGPU→Pixi順序制御');
console.log('   🔧 GPU競合解消');