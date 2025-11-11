/**
 * ================================================================================
 * system/exporters/webp-exporter.js - WEBP形式エクスポート【v8.25.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js
 *   - system/camera-system.js
 *   - system/animation-system.js
 *   - system/layer-system.js
 * 
 * 【依存関係 - Children】
 *   - libs/webpxmux/webpxmux.js (Animated WEBP用)
 * 
 * 【責務】
 *   - 静止画WEBP生成（Canvas toBlob API）
 *   - Animated WEBP生成（webpxmux.js使用）
 *   - 独立コンテナ方式によるカメラ干渉の完全排除
 * 
 * 【v8.25.0 改修内容】
 *   🔧 カメラ状態管理を完全削除（独立コンテナのため不要）
 *   🔧 Animated WEBP生成フローを修正（Canvas→ImageData直接変換）
 *   🔧 webpxmux.encode()の正しい使用方法に修正
 *   🔧 フレーム結合ロジックの改善
 * 
 * 【設計原則】
 *   - tempContainerは独立しているためカメラ補正不要
 *   - 各フレームはCanvas→ImageDataで直接取得
 *   - webpxmux.encode()にはImageData.dataを直接渡す
 * 
 * ================================================================================
 */

class WEBPExporter {
    constructor(manager) {
        this.manager = manager;
        this.webpxmux = null;
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
            if (!window.WebPXMux) {
                await this._loadScript('libs/webpxmux/webpxmux.js');
            }

            this.webpxmux = await window.WebPXMux.create({
                wasmPath: 'libs/webpxmux/webpxmux.wasm'
            });

            this.wasmLoaded = true;
            console.log('✓ WebPXMux WASM loaded');
            return true;

        } catch (error) {
            console.error('❌ WebPXMux load failed:', error);
            console.warn('📌 Animated WEBP requires libs/webpxmux/ with webpxmux.js and webpxmux.wasm');
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

    async _waitFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    // ====================================================================
    // 静止画WEBP生成（独立コンテナ方式 - カメラ補正不要）
    // ====================================================================
    
    async generateStaticWebP(options = {}) {
        const canvasSize = this.manager.getCanvasSize();
        const resolution = options.resolution || 1;
        const quality = options.quality !== undefined ? options.quality / 100 : 0.9;

        // 独立したコンテナを作成（カメラ干渉なし）
        const tempContainer = new PIXI.Container();
        
        if (!options.transparent) {
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, canvasSize.width, canvasSize.height);
            bg.fill(0xFFFFFF);
            tempContainer.addChild(bg);
        }

        // レイヤーをコピー
        const layerManager = this.manager.layerManager;
        const visibleLayers = layerManager.getAllLayers()
            .filter(layer => layer.visible)
            .sort((a, b) => a.zIndex - b.zIndex);

        for (const layer of visibleLayers) {
            const layerCopy = this._cloneLayerForExport(layer);
            tempContainer.addChild(layerCopy);
        }

        await this._waitFrame();

        // extract（tempContainerは独立しているためカメラ影響なし）
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
    // Animated WEBP生成（Canvas→ImageData直接変換）
    // ====================================================================
    
    async generateAnimatedWebP(options = {}) {
        const loaded = await this._ensureWebPXMuxLoaded();
        if (!loaded) {
            throw new Error('WebPXMux not available. Install libs/webpxmux/');
        }

        const animData = this.manager.animationSystem.getAnimationData();
        if (!animData || animData.frames.length === 0) {
            throw new Error('No animation frames');
        }

        const resolution = options.resolution || 1;
        const quality = (options.quality !== undefined ? options.quality : 90) / 100;
        const canvasSize = this.manager.getCanvasSize();
        const width = canvasSize.width * resolution;
        const height = canvasSize.height * resolution;

        // アニメーション状態のバックアップ
        const backup = this.manager.animationSystem.captureAllLayerStates();

        try {
            const frames = [];
            const delays = [];

            console.log(`🎬 Generating ${animData.frames.length} frames for Animated WEBP...`);

            // 各フレームを処理
            for (let i = 0; i < animData.frames.length; i++) {
                // フレームを適用
                this.manager.animationSystem.applyFrameToLayers(i);
                await this._waitFrame();

                // Canvas取得
                const frameCanvas = await this._renderFrameToCanvas({
                    resolution,
                    transparent: options.transparent
                });

                // Canvas → ImageData直接取得
                const ctx = frameCanvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, width, height);

                // WebPエンコード（ImageData.dataを直接渡す）
                const encoded = this.webpxmux.encode(imageData.data, {
                    width: width,
                    height: height,
                    quality: quality * 100  // 0-100スケールに変換
                });

                frames.push(encoded);
                delays.push(animData.frames[i].duration || 100);

                console.log(`  ✓ Frame ${i + 1}/${animData.frames.length}`);

                // プログレス通知
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:frame-rendered', {
                        frame: i + 1,
                        total: animData.frames.length
                    });
                }
            }

            // Mux → Animated WEBP
            console.log('🔧 Muxing frames into Animated WEBP...');
            const animBuffer = this.webpxmux.mux(frames, { 
                delays: delays,
                loop: 0  // 無限ループ
            });
            
            const blob = new Blob([animBuffer], { type: 'image/webp' });

            console.log('✅ Animated WEBP generated successfully');
            return blob;

        } finally {
            // 状態復元
            this.manager.animationSystem.restoreFromSnapshots(backup);
        }
    }

    /**
     * フレームをCanvasにレンダリング（独立コンテナ使用）
     */
    async _renderFrameToCanvas(options = {}) {
        const canvasSize = this.manager.getCanvasSize();
        const resolution = options.resolution || 1;

        // 独立コンテナ作成
        const tempContainer = new PIXI.Container();
        
        if (!options.transparent) {
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, canvasSize.width, canvasSize.height);
            bg.fill(0xFFFFFF);
            tempContainer.addChild(bg);
        }

        // レイヤーをコピー
        const layerManager = this.manager.layerManager;
        const visibleLayers = layerManager.getAllLayers()
            .filter(layer => layer.visible)
            .sort((a, b) => a.zIndex - b.zIndex);

        for (const layer of visibleLayers) {
            const layerCopy = this._cloneLayerForExport(layer);
            tempContainer.addChild(layerCopy);
        }

        await this._waitFrame();

        // extract
        const canvas = this.manager.app.renderer.extract.canvas({
            target: tempContainer,
            resolution: resolution,
            antialias: true
        });

        // クリーンアップ
        tempContainer.destroy({ children: true });

        return canvas;
    }

    // ====================================================================
    // プレビュー生成（軽量版）
    // ====================================================================
    
    async generatePreview(options = {}) {
        const previewOptions = {
            ...options,
            resolution: 0.5,
            quality: 70
        };

        if (options.animated && this.manager.animationSystem?.hasAnimation()) {
            return this.generateAnimatedWebP(previewOptions);
        } else {
            return this.generateStaticWebP(previewOptions);
        }
    }

    /**
     * 旧メソッド（後方互換）
     */
    async export(options = {}) {
        return this.generateStaticWebP(options);
    }
}

// グローバル登録
window.WEBPExporter = WEBPExporter;

console.log('✅ webp-exporter.js v8.25.0 loaded');
console.log('   🔧 カメラ状態管理を削除（独立コンテナのため不要）');
console.log('   🔧 Animated WEBP生成フロー修正');
console.log('   🔧 Canvas→ImageData直接変換に修正');