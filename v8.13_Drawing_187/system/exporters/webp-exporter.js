/**
 * ================================================================================
 * system/exporters/webp-exporter.js - プレビュー生成強化【v8.29.0】
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
 *   - Animated WEBP生成（APNG経由方式）
 *   - 独立コンテナ方式によるカメラ干渉の完全排除
 * 
 * 【v8.29.0 改修内容】
 *   🔧 generatePreview()の確実性向上
 *   🔧 エラーハンドリング強化
 *   🔧 Blob生成検証追加
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
 *   真のAnimated WebPはffmpeg変換（連番PNG出力）をご利用ください。
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
            const visibleLayers = layerManager.getLayers()
                .filter(layer => layer.layerData?.visible !== false)
                .sort((a, b) => (a.layerData?.zIndex || 0) - (b.layerData?.zIndex || 0));

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

            if (!extractedCanvas) {
                throw new Error('Canvas抽出に失敗しました');
            }

            // 最終Canvas作成
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvasSize.width * resolution;
            finalCanvas.height = canvasSize.height * resolution;
            const ctx = finalCanvas.getContext('2d', { alpha: options.transparent });

            if (!ctx) {
                throw new Error('Canvas 2Dコンテキスト取得に失敗しました');
            }

            if (!options.transparent) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            }

            ctx.drawImage(extractedCanvas, 0, 0);

            // WEBP変換（ブラウザネイティブAPI）
            const blob = await new Promise((resolve, reject) => {
                finalCanvas.toBlob(
                    blob => {
                        if (!blob || blob.size === 0) {
                            reject(new Error('WEBP Blob生成に失敗しました'));
                        } else {
                            resolve(blob);
                        }
                    },
                    'image/webp',
                    quality
                );
            });

            return blob;
            
        } catch (error) {
            console.error('WEBP generation error:', error);
            throw error;
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
            
            if (!apngBlob || apngBlob.size === 0) {
                throw new Error('APNG Blob生成に失敗しました');
            }
            
            console.log('✅ Animated WEBP生成完了（APNG形式、.webp拡張子）');
            console.log('   💡 真のAnimated WebPはffmpeg変換（連番PNG出力）をご利用ください');
            
            // APNG BlobをWEBPとして返す
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
            const visibleLayers = layerManager.getLayers()
                .filter(layer => layer.layerData?.visible !== false)
                .sort((a, b) => (a.layerData?.zIndex || 0) - (b.layerData?.zIndex || 0));

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

            if (!canvas) {
                throw new Error('Canvas抽出に失敗しました');
            }

            return canvas;
            
        } finally {
            // クリーンアップ
            tempContainer.destroy({ children: true });
        }
    }

    // ====================================================================
    // プレビュー生成（軽量版）【v8.29.0 強化版】
    // ====================================================================
    
    async generatePreview(options = {}) {
        const previewOptions = {
            ...options,
            resolution: options.resolution || 1,
            quality: 80
        };

        try {
            let blob;
            
            if (options.animated && this.manager.animationSystem?.hasAnimation()) {
                blob = await this.generateAnimatedWebP(previewOptions);
            } else {
                blob = await this.generateStaticWebP(previewOptions);
            }
            
            if (!blob || blob.size === 0) {
                throw new Error('プレビュー生成に失敗しました');
            }
            
            return blob;
            
        } catch (error) {
            console.error('WEBP Preview generation error:', error);
            throw new Error(`WEBPプレビュー生成エラー: ${error.message}`);
        }
    }

    /**
     * 旧メソッド（後方互換）
     */
    async export(options = {}) {
        try {
            const blob = await this.generateStaticWebP(options);
            
            if (!blob || blob.size === 0) {
                throw new Error('WEBP生成に失敗しました');
            }
            
            return blob;
        } catch (error) {
            console.error('WEBP export error:', error);
            throw error;
        }
    }
}

// グローバル登録
window.WEBPExporter = WEBPExporter;

console.log('✅ webp-exporter.js v8.29.0 loaded');
console.log('   🔧 generatePreview()の確実性向上');
console.log('   🔧 エラーハンドリング強化');
console.log('   🔧 Blob生成検証追加');