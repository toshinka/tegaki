/**
 * ============================================================================
 * ファイル名: system/export-manager.js
 * 責務: エクスポーターの統合管理、フォーマット判定、ファイルダウンロードを担当する
 * 依存: pixi.js, system/event-bus.js, config.js, layer-system.js
 * 被依存: core-engine.js等
 * 公開API: ExportManager
 * イベント発火: export:*, export:completed, export:failed, export:progress, export:aborted
 * イベント受信: なし
 * グローバル登録: window.ExportManager
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
import { TegakiEventBus } from './event-bus.js';
import { TimelineFrameCompositor } from './animation/timeline-frame-compositor.js';

export class ExportManager {
    constructor(app, layerSystem, animationSystem = null, cameraSystem = null) {
        if (!app || !app.renderer) {
            throw new Error('ExportManager: app and renderer are required');
        }
        if (!layerSystem) {
            throw new Error('ExportManager: layerSystem is required');
        }

        this.app = app;
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        this.cameraSystem = cameraSystem;
        this.exporters = {};
        this.currentExport = null;
    }
    
    /**
     * エクスポータ登録
     */
    registerExporter(format, exporter) {
        this.exporters[format] = exporter;
    }
    
    /**
     * フレーム数取得（厳格版）
     */
    _getFrameCount() {
        const timelineSource = this._getTimelineSource();
        if (timelineSource) {
            return timelineSource.compositor.getFrameCount();
        }
        const animData = this.animationSystem?.getAnimationData?.();
        if (!animData || !animData.frames || !Array.isArray(animData.frames)) {
            return 0;
        }
        return animData.frames.length;
    }

    getFrameCount() {
        return this._getFrameCount();
    }

    getAnimationFPS() {
        const timelineSource = this._getTimelineSource();
        if (timelineSource) return timelineSource.compositor.getFps();
        return this.animationSystem?.getAnimationData?.()?.fps || 12;
    }

    _getTimelineSource() {
        const popup = window.PopupManager?.popups?.get?.('animationTable')?.instance;
        const model = popup?.model;
        if (!model) return null;
        const compositor = new TimelineFrameCompositor(model, this.layerSystem);
        return compositor.getFrameCount() > 0 ? { model, compositor } : null;
    }

    async renderAnimationFrames(options = {}) {
        const timelineSource = this._getTimelineSource();
        if (timelineSource) {
            return timelineSource.compositor.renderFrames({
                ...options,
                onProgress: (current, total) => {
                    TegakiEventBus?.emit('export:progress', {
                        current,
                        total,
                        progress: Math.round((current / total) * 100)
                    });
                }
            });
        }
        return null;
    }
    
    /**
     * APNG自動検出（PNG用）
     */
    _shouldUseAPNG() {
        return this._getFrameCount() >= 2;
    }
    
    /**
     * WebM自動検出（WEBP用・複数フレーム時）
     */
    _shouldUseWebM() {
        return this._getFrameCount() >= 2;
    }
    
    /**
     * キャンバスサイズ取得
     */
    getCanvasSize() {
        const config = window.TEGAKI_CONFIG?.canvas;
        return {
            width: config?.width || 400,
            height: config?.height || 400
        };
    }
    
    /**
     * エクスポート実行
     */
    async export(format, options = {}) {
        this._commitFloatingSelection();
        let targetFormat = format;
        let actualFormat = format;
        
        if (format === 'png' && this._shouldUseAPNG()) {
            targetFormat = 'apng';
            actualFormat = 'apng';
        }
        
        if (format === 'webp' && this._shouldUseWebM()) {
            targetFormat = 'webm';
            actualFormat = 'webm';
        }
        
        const exporter = this.exporters[targetFormat];
        if (!exporter) {
            throw new Error(`Unsupported format: ${targetFormat}`);
        }
        
        this.currentExport = { format: actualFormat, progress: 0 };

        try {
            let blob;

            if (exporter.generateBlob) {
                blob = await exporter.generateBlob(options);
            } else {
                blob = await exporter.export({ ...options, skipDownload: true });
            }

            if (blob && typeof blob === 'object' && blob.blob) {
                blob = blob.blob;
            }
            
            if (!options.skipDownload && blob instanceof Blob) {
                const timestamp = this._getTimestamp();
                const filename = this._generateFilename(actualFormat, timestamp);
                this.downloadFile(blob, filename);
                
                if (TegakiEventBus) {
                    TegakiEventBus.emit('export:completed', {
                        format: actualFormat,
                        filename: filename
                    });
                }
                
                this.currentExport = null;
                return { blob, format: actualFormat, filename };
            }
            
            this.currentExport = null;
            return blob;

        } catch (error) {
            this.currentExport = null;
            
            if (TegakiEventBus) {
                TegakiEventBus.emit('export:failed', {
                    format: actualFormat,
                    error: error.message
                });
            }
            
            throw error;
        }
    }
    
    /**
     * 連番PNG一括出力（ffmpeg変換用）
     */
    async exportSequencePNG(options = {}) {
        this._commitFloatingSelection();
        const frameCount = this._getFrameCount();
        if (frameCount < 2) {
            throw new Error('アニメーションフレームが2枚以上必要です');
        }
        
        const resolution = options.resolution || 1;
        const timestamp = this._getTimestamp();
        const baseName = `tegaki_${timestamp}`;
        
        this.currentExport = { format: 'sequence-png', progress: 0 };
        
        if (TegakiEventBus) {
            TegakiEventBus.emit('export:started', { 
                format: 'sequence-png',
                total: frameCount
            });
        }
        
        try {
            const blobs = [];
            const timelineFrames = await this.renderAnimationFrames({
                ...options,
                resolution
            });

            if (timelineFrames) {
                for (let i = 0; i < timelineFrames.length; i++) {
                    const blob = await this._canvasToPNGBlob(timelineFrames[i].canvas);
                    const frameNum = String(i + 1).padStart(4, '0');
                    const filename = `${baseName}_${frameNum}.png`;
                    this.downloadFile(blob, filename);
                    blobs.push({ blob, filename, index: timelineFrames[i].index });
                }
            } else {
                const pngExporter = this.exporters['png'];
                const currentFrame = this.animationSystem.getCurrentFrameIndex();
                for (let i = 0; i < frameCount; i++) {
                    this.animationSystem.setCurrentFrame(i);
                    await this._waitFrame();
                    const blob = await pngExporter.generateBlob({
                        resolution,
                        transparent: options.transparent
                    });
                
                    const frameNum = String(i + 1).padStart(4, '0');
                    const filename = `${baseName}_${frameNum}.png`;
                
                    this.downloadFile(blob, filename);
                    blobs.push({ blob, filename, index: i });
                }
                this.animationSystem.setCurrentFrame(currentFrame);
            }
            
            if (TegakiEventBus) {
                TegakiEventBus.emit('export:completed', {
                    format: 'sequence-png',
                    count: frameCount,
                    baseName: baseName
                });
            }
            
            this.currentExport = null;
            
            return {
                blobs: blobs,
                baseName: baseName,
                frameCount: frameCount,
                ffmpegCommand: this._generateFFmpegCommand(baseName, {
                    fps: this.getAnimationFPS()
                })
            };
            
        } catch (error) {
            this.currentExport = null;
            
            if (TegakiEventBus) {
                TegakiEventBus.emit('export:failed', {
                    format: 'sequence-png',
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    _canvasToPNGBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('PNG Blob generation failed'));
            }, 'image/png');
        });
    }
    
    /**
     * ffmpegコマンド生成
     */
    _generateFFmpegCommand(baseName, animData) {
        const fps = animData.fps || 12;
        
        const webmCmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 ${baseName}.webm`;
        const mp4Cmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${baseName}.mp4`;
        const gifCmd = `ffmpeg -framerate ${fps} -i ${baseName}_%04d.png -vf "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" ${baseName}.gif`;
        
        return {
            webm: webmCmd,
            mp4: mp4Cmd,
            gif: gifCmd
        };
    }
    
    async _waitFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    /**
     * プレビュー生成
     */
    async generatePreview(format, options = {}) {
        this._commitFloatingSelection();
        let targetFormat = format;
        let actualFormat = format;
        
        const frameCount = this._getFrameCount();
        
        if (format === 'png' && frameCount >= 2) {
            targetFormat = 'apng';
            actualFormat = 'apng';
        }
        
        if (format === 'webp' && frameCount >= 2) {
            targetFormat = 'webm';
            actualFormat = 'webm';
        }
        
        const exporter = this.exporters[targetFormat];
        if (!exporter) {
            throw new Error(`Preview not supported for format: ${targetFormat}`);
        }
        
        let blob;
        
        try {
            const previewOptions = {
                ...options,
                resolution: options.resolution || 1,
                quality: 80,
                skipDownload: true
            };
            
            if (targetFormat === 'webm') {
                const result = await exporter.export(previewOptions);
                blob = result.blob || result;
            } else if (exporter.generatePreview) {
                blob = await exporter.generatePreview(previewOptions);
            } else if (exporter.generateBlob) {
                blob = await exporter.generateBlob(previewOptions);
            } else if (exporter.export) {
                const result = await exporter.export(previewOptions);
                blob = result.blob || result;
            } else {
                throw new Error(`No suitable method for preview generation`);
            }
            
            if (!blob || blob.size === 0) {
                throw new Error('プレビュー生成に失敗しました（空のBlobが生成されました）');
            }
            
            return { blob, format: actualFormat };
            
        } catch (error) {
            throw new Error(`プレビュー生成エラー: ${error.message}`);
        }
    }
    
    _getTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
               `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    _commitFloatingSelection() {
        const selectionApi = window.CoreRuntime?.api?.selection;
        if (!selectionApi?.getState?.()?.transformSessionActive) return false;
        return selectionApi.confirmTransform?.() === true;
    }
    
    _generateFilename(format, timestamp) {
        const ext = {
            'png': '.png',
            'apng': '.png',
            'gif': '.gif',
            'webp': '.webp',
            'webm': '.webm',
            'psd': '.psd',
            'mp4': '.mp4'
        }[format] || '.png';
        
        return `tegaki_${timestamp}${ext}`;
    }
    
    async exportAsPNGBlob(options = {}) {
        const exporter = this.exporters['png'];
        if (!exporter?.generateBlob) {
            throw new Error('PNG exporter not available');
        }
        return await exporter.generateBlob(options);
    }
    
    async exportAsAPNGBlob(options = {}) {
        const exporter = this.exporters['apng'];
        if (!exporter?.generateBlob) {
            throw new Error('APNG exporter not available');
        }
        return await exporter.generateBlob(options);
    }
    
    async exportAsWebPBlob(options = {}) {
        if (this._shouldUseWebM()) {
            const exporter = this.exporters['webm'];
            if (!exporter?.export) {
                throw new Error('WebM exporter not available');
            }
            const result = await exporter.export({ ...options, skipDownload: true });
            return result.blob || result;
        } else {
            const exporter = this.exporters['webp'];
            if (!exporter?.generateBlob) {
                throw new Error('WEBP exporter not available');
            }
            return await exporter.generateBlob(options);
        }
    }
    
    async exportAsPSDBlob(options = {}) {
        const exporter = this.exporters['psd'];
        if (!exporter?.generateBlob) {
            throw new Error('PSD exporter not available');
        }
        return await exporter.generateBlob(options);
    }
    
    async exportAsAutoBlob(options = {}) {
        const format = this._shouldUseAPNG() ? 'apng' : 'png';
        return await this.generatePreview(format, options).then(r => r.blob);
    }

    /**
     * Canvas の ImageData をアンプリマルチプライドに変換する
     * Pixi の extract.canvas() はプリマルチプライド値をそのまま返すため、
     * PNG 保存前に必ずこの関数を通すこと。
     * @param {HTMLCanvasElement} canvas
     * @returns {HTMLCanvasElement} 同じ canvas オブジェクト（破壊的変更）
     */
    _unpremultiplyCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;

        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a > 0 && a < 255) {
                // プリマルチプライドを元の RGB 値に戻す
                d[i]     = Math.min(255, Math.round(d[i]     * 255 / a));
                d[i + 1] = Math.min(255, Math.round(d[i + 1] * 255 / a));
                d[i + 2] = Math.min(255, Math.round(d[i + 2] * 255 / a));
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    renderToCanvas(options = {}) {
        const width = options.width || this.getCanvasSize().width;
        const height = options.height || this.getCanvasSize().height;
        const resolution = options.resolution || 1;
        const transparent = options.transparent === true;
        const container = options.container || this.layerSystem.currentFrameContainer;

        if (!container || typeof container.updateLocalTransform !== 'function') {
            throw new Error('render target container is not available');
        }

        const renderTexture = PIXI.RenderTexture.create({
            width,
            height,
            resolution,
            antialias: true
        });

        this.app.renderer.render({
            container,
            target: renderTexture,
            clear: true,
            clearColor: transparent ? [0, 0, 0, 0] : [1, 1, 1, 1]
        });

        const canvas = this.app.renderer.extract.canvas({
            target: renderTexture,
            resolution
        });

        renderTexture.destroy(true);
        this._unpremultiplyCanvas(canvas);
        return canvas;
    }
    
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binary);
    }
    
    async blobToDataURL(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = this.arrayBufferToBase64(arrayBuffer);
        return `data:${blob.type};base64,${base64}`;
    }
    
    dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }
    
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    
    async copyToClipboard(blob) {
        try {
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
            return true;
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            return false;
        }
    }
    
    isExporting() {
        return this.currentExport !== null;
    }
    
    getCurrentProgress() {
        return this.currentExport ? this.currentExport.progress : 0;
    }
    
    abortExport() {
        if (this.currentExport) {
            this.currentExport = null;
            if (TegakiEventBus) {
                TegakiEventBus.emit('export:aborted');
            }
        }
    }
}

// 下位互換性のためにグローバルに登録
window.ExportManager = ExportManager;
