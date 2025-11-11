/**
 * ================================================================================
 * WEBP Exporter - WEBP形式エクスポート（静止画・Animated WEBP対応）
 * ================================================================================
 * 
 * 【依存関係】
 * - system/export-manager.js (親)
 * - libs/webpxmux/webpxmux.js (Animated WEBP用 - 動的ロード)
 * - system/camera-system.js (カメラ状態取得)
 * - system/animation-system.js (アニメーションデータ)
 * 
 * 【責務】
 * - 静止画WEBP生成（Canvas toBlob使用）
 * - Animated WEBP生成（webpxmux.js使用）
 * - カメラ状態の正確な保持・復元
 * 
 * 【改修履歴】
 * v8.24.0: カメラズレ修正 / Animated WEBP実装 / 二重変換削除
 * 
 * ================================================================================
 */

class WEBPExporter {
    constructor(manager) {
        this.manager = manager;
        this.webpxmux = null; // 遅延ロード
        this.wasmLoaded = false;
    }

    // ====================================================================
    // WASM初期化（遅延ロード）
    // ====================================================================
    
    async _ensureWebPXMuxLoaded() {
        if (this.wasmLoaded && this.webpxmux) {
            return true;
        }

        try {
            // libs/webpxmux/webpxmux.js を動的ロード
            if (!window.WebPXMux) {
                await this._loadScript('libs/webpxmux/webpxmux.js');
            }

            // WASM初期化
            this.webpxmux = await window.WebPXMux.create({
                wasmPath: 'libs/webpxmux/webpxmux.wasm'
            });

            this.wasmLoaded = true;
            console.log('✓ WebPXMux WASM loaded');
            return true;

        } catch (error) {
            console.error('❌ WebPXMux load failed:', error);
            console.warn('📌 Animated WEBP requires libs/webpxmux/ folder with webpxmux.js and webpxmux.wasm');
            console.warn('📌 Install: npm install webpxmux, then copy files to libs/webpxmux/');
            return false;
        }
    }

    async _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    // ====================================================================
    // カメラ状態管理（ズレ修正の核心）
    // ====================================================================
    
    _backupCameraState() {
        const camera = this.manager.cameraSystem;
        const worldContainer = camera?.worldContainer;
        
        if (!camera || !worldContainer) {
            return null;
        }

        return {
            position: { x: worldContainer.position.x, y: worldContainer.position.y },
            scale: { x: worldContainer.scale.x, y: worldContainer.scale.y },
            rotation: worldContainer.rotation,
            pivot: { x: worldContainer.pivot.x, y: worldContainer.pivot.y }
        };
    }

    _restoreCameraState(state) {
        if (!state) return;

        const camera = this.manager.cameraSystem;
        const worldContainer = camera?.worldContainer;
        
        if (!worldContainer) return;

        worldContainer.position.set(state.position.x, state.position.y);
        worldContainer.scale.set(state.scale.x, state.scale.y);
        worldContainer.rotation = state.rotation;
        worldContainer.pivot.set(state.pivot.x, state.pivot.y);
    }

    async _waitFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    // ====================================================================
    // 静止画WEBP生成（カメラズレ修正版）
    // ====================================================================
    
    async generateStaticWebP(options = {}) {
        const canvasSize = this.manager.getCanvasSize();
        const resolution = options.resolution || 1;
        const quality = options.quality !== undefined ? options.quality / 100 : 0.9;

        // カメラ状態をバックアップ
        const cameraState = this._backupCameraState();

        try {
            // キャンバスコンテナ作成（透明背景 or 白背景）
            const tempContainer = new PIXI.Container();
            
            if (!options.transparent) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, canvasSize.width, canvasSize.height);
                bg.fill(0xFFFFFF);
                tempContainer.addChild(bg);
            }

            // 全レイヤーをコピー
            const layerManager = this.manager.layerManager;
            const visibleLayers = layerManager.getAllLayers()
                .filter(layer => layer.visible)
                .sort((a, b) => a.zIndex - b.zIndex);

            for (const layer of visibleLayers) {
                const layerCopy = this._cloneLayerForExport(layer);
                tempContainer.addChild(layerCopy);
            }

            await this._waitFrame();

            // 🎯 カメラ補正なしで extract（tempContainerは独立）
            const extractedCanvas = this.manager.app.renderer.extract.canvas({
                target: tempContainer,
                resolution: resolution,
                antialias: true
            });

            // 最終Canvas作成
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvasSize.width * resolution;
            finalCanvas.height = canvasSize.height * resolution;
            const ctx = finalCanvas.getContext('2d', { alpha: options.transparent });

            if (!options.transparent) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            }

            ctx.drawImage(extractedCanvas, 0, 0);

            // WEBP変換
            const blob = await new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('WEBP generation failed')),
                    'image/webp',
                    quality
                );
            });

            // クリーンアップ
            tempContainer.destroy({ children: true });

            return blob;

        } finally {
            // カメラ状態を必ず復元
            this._restoreCameraState(cameraState);
        }
    }

    _cloneLayerForExport(layer) {
        const container = new PIXI.Container();
        container.alpha = layer.opacity / 100;

        if (layer.children) {
            for (const child of layer.children) {
                if (child instanceof PIXI.Graphics || child instanceof PIXI.Mesh) {
                    const clone = child.clone ? child.clone() : child;
                    container.addChild(clone);
                }
            }
        }

        return container;
    }

    // ====================================================================
    // Animated WEBP生成（webpxmux使用）
    // ====================================================================
    
    async generateAnimatedWebP(options = {}) {
        // WASM初期化チェック
        const loaded = await this._ensureWebPXMuxLoaded();
        if (!loaded) {
            throw new Error('WebPXMux not available. Please install libs/webpxmux/');
        }

        const animData = this.manager.animationSystem.getAnimationData();
        if (!animData || animData.frames.length === 0) {
            throw new Error('No animation frames');
        }

        const resolution = options.resolution || 1;
        const quality = (options.quality !== undefined ? options.quality : 90) / 100;

        // アニメーション状態のバックアップ
        const backup = this.manager.animationSystem.captureAllLayerStates();
        const cameraState = this._backupCameraState();

        try {
            const frames = [];
            const delays = [];

            console.log(`🎬 Generating ${animData.frames.length} frames for Animated WEBP...`);

            // 各フレームを処理
            for (let i = 0; i < animData.frames.length; i++) {
                // フレームを適用
                this.manager.animationSystem.applyFrameToLayers(i);
                await this._waitFrame();

                // フレーム画像を取得
                const frameBlob = await this.generateStaticWebP({
                    resolution,
                    quality: quality * 100,
                    transparent: options.transparent
                });

                // Blob → ImageData
                const imageData = await this._blobToImageData(frameBlob);

                // WebPエンコード
                const encoded = this.webpxmux.encode(imageData.data, {
                    width: imageData.width,
                    height: imageData.height,
                    quality: quality
                });

                frames.push(encoded);
                delays.push(animData.frames[i].duration || 100);

                console.log(`  ✓ Frame ${i + 1}/${animData.frames.length}`);
            }

            // Mux → Animated WEBP
            console.log('🔧 Muxing frames...');
            const animBuffer = this.webpxmux.mux(frames, { delays });
            const blob = new Blob([animBuffer], { type: 'image/webp' });

            console.log('✅ Animated WEBP generated');
            return blob;

        } finally {
            // 状態復元
            this.manager.animationSystem.restoreFromSnapshots(backup);
            this._restoreCameraState(cameraState);
        }
    }

    async _blobToImageData(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(imageData);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Image load failed'));
            };

            img.src = url;
        });
    }

    // ====================================================================
    // プレビュー生成（軽量版）
    // ====================================================================
    
    async generatePreview(options = {}) {
        // プレビューは低解像度で生成
        const previewOptions = {
            ...options,
            resolution: 0.5, // 低解像度
            quality: 70       // 低品質
        };

        if (options.animated && this.manager.animationSystem?.hasAnimation()) {
            return this.generateAnimatedWebP(previewOptions);
        } else {
            return this.generateStaticWebP(previewOptions);
        }
    }
}

// グローバル登録
window.WEBPExporter = WEBPExporter;