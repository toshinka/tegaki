(function() {
    'use strict';
    
    class GIFExporter {
        constructor(animationSystem, app) {
            this.animationSystem = animationSystem;
            this.app = app;
            this.isExporting = false;
        }
        
        async exportGIF(options = {}) {
            if (this.isExporting) {
                console.warn('GIF export already in progress');
                return;
            }
            
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                console.warn('No cuts to export');
                window.TegakiEventBus?.emit('gif:export-failed', { 
                    error: new Error('アニメーションにCUTが含まれていません') 
                });
                return;
            }
            
            const settings = {
                width: options.width || window.TEGAKI_CONFIG.canvas.width,
                height: options.height || window.TEGAKI_CONFIG.canvas.height,
                quality: options.quality || 
                    window.TEGAKI_CONFIG.animation.exportSettings.quality,
                workers: window.TEGAKI_CONFIG.animation.exportSettings.workers
            };
            
            // 最大サイズ制限適用
            const maxSize = window.TEGAKI_CONFIG.animation.exportSettings;
            if (settings.width > maxSize.maxWidth) {
                const ratio = maxSize.maxWidth / settings.width;
                settings.width = maxSize.maxWidth;
                settings.height = Math.round(settings.height * ratio);
            }
            if (settings.height > maxSize.maxHeight) {
                const ratio = maxSize.maxHeight / settings.height;
                settings.height = maxSize.maxHeight;
                settings.width = Math.round(settings.width * ratio);
            }
            
            this.isExporting = true;
            
            try {
                console.log('Starting GIF export:', settings);
                
                // gif.js 初期化
                const gif = new GIF({
                    workers: settings.workers,
                    quality: settings.quality,
                    width: settings.width,
                    height: settings.height,
                    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.min.js'
                });
                
                // 進捗イベント
                gif.on('progress', (progress) => {
                    const progressPercent = Math.round(progress * 100);
                    console.log(`GIF export progress: ${progressPercent}%`);
                    window.TegakiEventBus?.emit('gif:export-progress', { 
                        progress: progressPercent 
                    });
                });
                
                // 現在の状態をバックアップ
                const backupSnapshots = this.animationSystem.captureAllLayerStates();
                
                // 各CUTをフレームとして追加
                for (let i = 0; i < animData.cuts.length; i++) {
                    const cut = animData.cuts[i];
                    
                    console.log(`Processing cut ${i + 1}/${animData.cuts.length}: ${cut.name}`);
                    
                    // CUT状態を適用
                    this.animationSystem.applyCutToLayers(i);
                    
                    // 少し待ってから描画（レンダリング安定化）
                    await this.waitFrame();
                    
                    try {
                        // Canvas取得
                        const canvas = await this.renderCutToCanvas(settings);
                        
                        if (canvas) {
                            // フレーム追加（duration はミリ秒）
                            gif.addFrame(canvas, { 
                                delay: Math.round(cut.duration * 1000)
                            });
                            
                            console.log(`Added frame ${i + 1} with duration ${cut.duration}s`);
                        } else {
                            console.warn(`Failed to render cut ${i + 1}`);
                        }
                        
                    } catch (frameError) {
                        console.error(`Error processing cut ${i + 1}:`, frameError);
                    }
                    
                    // 進捗更新（フレーム処理部分）
                    window.TegakiEventBus?.emit('gif:frame-rendered', { 
                        frame: i + 1, 
                        total: animData.cuts.length 
                    });
                }
                
                // 元の状態に復元
                this.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                // GIF生成完了時の処理
                gif.on('finished', (blob) => {
                    try {
                        this.downloadGIF(blob);
                        console.log('GIF export completed successfully');
                        window.TegakiEventBus?.emit('gif:export-completed', {
                            size: blob.size,
                            cuts: animData.cuts.length
                        });
                    } catch (downloadError) {
                        console.error('GIF download failed:', downloadError);
                        window.TegakiEventBus?.emit('gif:export-failed', { error: downloadError });
                    } finally {
                        this.isExporting = false;
                    }
                });
                
                // エラー処理
                gif.on('abort', () => {
                    console.warn('GIF export aborted');
                    this.isExporting = false;
                    window.TegakiEventBus?.emit('gif:export-aborted');
                });
                
                // レンダリング開始
                console.log('Starting GIF rendering...');
                gif.render();
                
            } catch (error) {
                console.error('GIF export failed:', error);
                this.isExporting = false;
                window.TegakiEventBus?.emit('gif:export-failed', { error });
            }
        }
        
        // CUTをCanvasにレンダリング
        async renderCutToCanvas(settings) {
            try {
                // RenderTexture作成（高解像度）
                const renderTexture = PIXI.RenderTexture.create({
                    width: settings.width,
                    height: settings.height,
                    resolution: 2 // 高解像度で生成
                });
                
                // レイヤーコンテナのクローン作成
                const tempContainer = new PIXI.Container();
                
                // キャンバス中央化オフセット計算
                const offsetX = (settings.width - window.TEGAKI_CONFIG.canvas.width) / 2;
                const offsetY = (settings.height - window.TEGAKI_CONFIG.canvas.height) / 2;
                
                // レイヤーコンテナを一時的に移動
                const layersContainer = this.animationSystem.layerSystem.layersContainer;
                const originalParent = layersContainer.parent;
                const originalPosition = { x: layersContainer.x, y: layersContainer.y };
                
                if (originalParent) {
                    originalParent.removeChild(layersContainer);
                }
                
                tempContainer.addChild(layersContainer);
                tempContainer.position.set(offsetX, offsetY);
                
                // レンダリング実行
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                // Canvas取得
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                // 元の構造に復元
                tempContainer.removeChild(layersContainer);
                layersContainer.position.set(originalPosition.x, originalPosition.y);
                
                if (originalParent) {
                    originalParent.addChild(layersContainer);
                }
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('Canvas rendering failed:', error);
                return null;
            }
        }
        
        // フレーム待機（描画安定化）
        waitFrame() {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 16); // 約1フレーム待機
                });
            });
        }
        
        // GIFダウンロード
        downloadGIF(blob) {
            try {
                const url = URL.createObjectURL(blob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `tegaki_animation_${timestamp}.gif`;
                
                // ダウンロードリンク作成
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // URL解放（遅延）
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 1000);
                
                console.log(`GIF downloaded as: ${filename}`);
                
            } catch (error) {
                console.error('GIF download failed:', error);
                throw error;
            }
        }
        
        // 書き出し中止
        abortExport() {
            if (this.isExporting) {
                this.isExporting = false;
                console.log('GIF export aborted by user');
                window.TegakiEventBus?.emit('gif:export-aborted');
            }
        }
        
        // 書き出し状態確認
        isExportInProgress() {
            return this.isExporting;
        }
        
        // 書き出し可能チェック
        canExport() {
            const animData = this.animationSystem.getAnimationData();
            return {
                canExport: animData.cuts.length > 0 && !this.isExporting,
                reason: animData.cuts.length === 0 ? 'No cuts available' : 
                        this.isExporting ? 'Export in progress' : 'Ready'
            };
        }
        
        // プレビュー用クイック書き出し（低品質・小サイズ）
        async exportPreview() {
            if (this.isExporting) return null;
            
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return null;
            
            const settings = {
                width: 160,
                height: 120,
                quality: 20,
                workers: 1
            };
            
            try {
                // 最初の数フレームのみでプレビュー生成
                const maxFrames = Math.min(5, animData.cuts.length);
                
                const gif = new GIF({
                    workers: settings.workers,
                    quality: settings.quality,
                    width: settings.width,
                    height: settings.height,
                    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.min.js'
                });
                
                const backupSnapshots = this.animationSystem.captureAllLayerStates();
                
                for (let i = 0; i < maxFrames; i++) {
                    this.animationSystem.applyCutToLayers(i);
                    await this.waitFrame();
                    
                    const canvas = await this.renderCutToCanvas(settings);
                    if (canvas) {
                        gif.addFrame(canvas, { delay: 500 }); // 固定0.5秒
                    }
                }
                
                this.animationSystem.restoreFromSnapshots(backupSnapshots);
                
                return new Promise((resolve) => {
                    gif.on('finished', resolve);
                    gif.render();
                });
                
            } catch (error) {
                console.error('Preview export failed:', error);
                return null;
            }
        }
    }
    
    window.TegakiGIFExporter = GIFExporter;
    console.log('✅ gif-exporter.js loaded');
})();