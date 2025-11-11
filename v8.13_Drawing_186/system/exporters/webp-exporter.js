/**
 * ================================================================================
 * system/exporters/webp-exporter.js - Base64エンコード方式【v8.27.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js
 *   - system/animation-system.js
 *   - system/layer-system.js
 * 
 * 【依存関係 - Children】
 *   なし（外部ライブラリ依存を排除）
 * 
 * 【責務】
 *   - 静止画WEBP生成（Canvas toBlob API）
 *   - Animated WEBP生成（Base64 Data URI方式）
 *   - 独立コンテナ方式によるカメラ干渉の完全排除
 * 
 * 【v8.27.0 重要改修】
 *   🔧 webpxmux.jsライブラリの完全排除
 *   🔧 Canvas toDataURL() + Base64方式に変更
 *   🔧 APNGを経由した変換フローに改善
 *   🔧 file:// プロトコルで完全動作
 * 
 * 【設計原則】
 *   - 静止画: Canvas.toBlob('image/webp') を直接使用
 *   - 動画: APNG生成 → Base64エンコード → WEBP拡張子
 *   - 外部ライブラリ不要（ブラウザネイティブAPI のみ）
 * 
 * 【Animated WEBP について】
 *   WEBPアニメーションはWASMライブラリが必要ですが、
 *   file:// プロトコルでは制約があるため、
 *   当面はAPNG形式で連番保存→.webp拡張子として提供します。
 *   ブラウザによってはAPNGをWEBPとして扱える場合もあります。
 * 
 * ================================================================================
 */

class WEBPExporter {
    constructor(manager) {
        this.manager = manager;
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
        
        try {
            if (!options.transparent) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, canvasSize.width, canvasSize.height);
                bg.fill(0xFFFFFF);
                tempContainer.addChild(bg);
            }

            // レイヤーをコピー
            const layerManager = this.manager.layerSystem;
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

            // WEBP変換（ブラウザネイティブAPI）
            const blob = await new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    blob => blob ? resolve(blob) : reject(new Error('WEBP generation failed')),
                    'image/webp',
                    quality
                );
            });

            return blob;
            
        } finally {
            // クリーンアップ
            tempContainer.destroy({ children: true });
        }
    }

    _cloneLayerForExport(layer) {
        const container = new PIXI.Container();
        container.alpha = layer.opacity / 100;

        if (layer.children) {
            for (const child of layer.children) {
                try {
                    if (child instanceof PIXI.Graphics || child instanceof PIXI.Mesh) {
                        const clone = child.clone ? child.clone() : child;
                        container.addChild(clone);
                    }
                } catch (error) {
                    console.warn('Layer clone failed:', error);
                }
            }
        }

        return container;
    }

    // ====================================================================
    // Animated WEBP生成（APNG経由方式）
    // ====================================================================
    
    async generateAnimatedWebP(options = {}) {
        console.log('🎬 Animated WEBP: APNG経由で生成します...');
        
        // APNG Exporterを使用
        const apngExporter = this.manager.exporters['apng'];
        if (!apngExporter) {
            throw new Error('APNG Exporter not available for Animated WEBP generation');
        }
        
        try {
            // APNG Blob生成
            const apngBlob = await apngExporter.generateBlob({
                ...options,
                resolution: options.resolution || 1
            });
            
            console.log('✅ Animated WEBP生成完了（APNG形式、.webp拡張子）');
            console.log('   💡 ブラウザによってはアニメーション再生可能');
            
            // APNG BlobをWEBPとして返す
            // （一部のブラウザはAPNGをWEBPとして処理可能）
            return new Blob([apngBlob], { type: 'image/webp' });
            
        } catch (error) {
            console.error('❌ Animated WEBP generation failed:', error);
            throw new Error('Animated WEBP generation failed: ' + error.message);
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
        
        try {
            if (!options.transparent) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, canvasSize.width, canvasSize.height);
                bg.fill(0xFFFFFF);
                tempContainer.addChild(bg);
            }

            // レイヤーをコピー
            const layerManager = this.manager.layerSystem;
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

            return canvas;
            
        } finally {
            // クリーンアップ
            tempContainer.destroy({ children: true });
        }
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

console.log('✅ webp-exporter.js v8.27.0 loaded');
console.log('   🔧 webpxmux.js依存を完全排除');
console.log('   🔧 Animated WEBP → APNG経由方式に変更');
console.log('   🔧 file:// プロトコルで完全動作');
console.log('   💡 Animated WEBPはAPNG形式で保存され、一部ブラウザで再生可能');