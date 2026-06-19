/**
 * ============================================================================
 * ファイル名: ui/export-popup.js
 * 責務: 画像および動画のエクスポート設定（フォーマット、解像度等）のUIを提供する
 * 依存: system/export-manager.js, system/event-bus.js, ui/popup-drag-helper.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: ExportPopup
 * イベント発火: なし
 * イベント受信: export:*
 * グローバル登録: window.ExportPopup, window.TegakiExportPopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { attachPopupDrag } from './popup-drag-helper.js';

export class ExportPopup {
    constructor(dependencies = {}) {
        this.manager = dependencies.exportManager || window.exportManager;
        this.selectedFormat = 'png';
        this.selectedResolution = 1;
        this.isVisible = false;
        this.currentPreviewUrl = null;
        this.currentBlob = null;
        this.popup = null;
        this.eventBus = TegakiEventBus;
        this.popupDragCleanup = null;
        
        this._ensurePopupElement();
        this.setupEventListeners();
        this._setupPopupDrag();
        this._initializeFormatButtons();
        this.updateOptionsUI(this.selectedFormat);
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('export-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            this.popup.classList.add('popup-panel--translucent');
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area') || document.body;
        if (!container) return;
        
        const popup = document.createElement('div');
        popup.id = 'export-popup';
        popup.className = 'popup-panel popup-panel--translucent';
        popup.style.left = '60px';
        popup.style.top = '200px';
        popup.style.minWidth = '420px';
        popup.style.maxWidth = '600px';
        
        popup.innerHTML = `
            <div class="popup-title">画像・動画出力</div>
            <div class="format-selection">
                <button class="format-btn selected" data-format="png">PNG</button>
                <button class="format-btn" data-format="gif">GIF</button>
                <button class="format-btn" data-format="webp">WEBP</button>
                <button class="format-btn" data-format="psd">PSD</button>
            </div>
            <div class="export-options" id="export-options"></div>
            <div class="export-progress" id="export-progress" style="display: none;">
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <div class="progress-text">0%</div>
            </div>
            <div class="preview-container" id="preview-container" style="display: none; margin: 8px 0; text-align: center; background: rgba(255, 255, 238, 0.62); border: 1px solid rgba(207, 156, 151, 0.78); border-radius: 5px; padding: 10px;">
                <div id="preview-message" style="font-size: 12px; color: #800000; margin-bottom: 8px; font-weight: 500;">プレビュー</div>
                <div style="width: 200px; height: 200px; margin: 0 auto; background: rgba(255, 255, 238, 0.82); border: 1px solid rgba(207, 156, 151, 0.78); border-radius: 5px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img id="preview-image" style="width: 200px; height: 200px; object-fit: contain; display: block;" />
                </div>
            </div>
            <div class="export-status" id="export-status" style="display: none; font-size: 12px; color: #800000; margin: 8px 0;"></div>
            <div class="export-actions">
                <button class="action-button" id="export-execute">ダウンロード</button>
                <button class="action-button secondary" id="export-preview">プレビュー</button>
            </div>
        `;
        
        container.appendChild(popup);
        this.popup = popup;
        this._setupPopupDrag();
        
        this._initializeFormatButtons();
        this.updateOptionsUI(this.selectedFormat);
    }
    
    _initializeFormatButtons() {
        const formatBtns = this.popup.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            btn.style.color = 'var(--futaba-maroon)';
            btn.style.backgroundColor = 'rgba(255, 255, 238, 0.62)';
            btn.style.border = '1px solid rgba(207, 156, 151, 0.78)';
            btn.style.padding = '8px 10px';
            btn.style.borderRadius = '5px';
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '600';
            btn.style.cursor = 'pointer';
            btn.style.transition = 'all 0.15s';
            
            if (btn.classList.contains('selected')) {
                btn.style.backgroundColor = 'rgba(207, 156, 151, 0.82)';
                btn.style.color = 'var(--futaba-maroon)';
                btn.style.border = '1px solid var(--futaba-medium)';
            }
        });
    }

    _setupPopupDrag() {
        if (!this.popup || this.popupDragCleanup) return;
        this.popupDragCleanup = attachPopupDrag(this.popup);
    }
    
    setupEventListeners() {
        this.popup.addEventListener('click', (e) => {
            const formatBtn = e.target.closest('.format-btn');
            if (formatBtn && !formatBtn.classList.contains('disabled')) {
                this.selectFormat(formatBtn.dataset.format);
                return;
            }
            
            const resBtn = e.target.closest('.resolution-btn');
            if (resBtn) {
                const newResolution = parseInt(resBtn.dataset.resolution);
                this.selectResolution(newResolution);
                return;
            }
            
            if (e.target.closest('#export-execute')) {
                this.executeExport();
                return;
            }
            
            if (e.target.closest('#export-preview')) {
                this.executePreview();
                return;
            }
        });
        
        if (this.eventBus) {
            this.eventBus.on('export:progress', (data) => {
                this.updateProgress(data);
            });
            
            this.eventBus.on('export:completed', (data) => {
                this.onExportCompleted(data);
            });
            
            this.eventBus.on('export:failed', (data) => {
                this.onExportFailed(data);
            });
        }
    }
    
    selectFormat(format) {
        this.selectedFormat = format;
        
        const formatBtns = this.popup.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            const isSelected = btn.dataset.format === format;
            btn.classList.toggle('selected', isSelected);
            
            if (isSelected) {
                btn.style.backgroundColor = 'rgba(207, 156, 151, 0.82)';
                btn.style.color = 'var(--futaba-maroon)';
                btn.style.border = '1px solid var(--futaba-medium)';
            } else {
                btn.style.backgroundColor = 'rgba(255, 255, 238, 0.62)';
                btn.style.color = 'var(--futaba-maroon)';
                btn.style.border = '1px solid rgba(207, 156, 151, 0.78)';
            }
        });
        
        this.updateOptionsUI(format);
        this.updatePreviewButtonVisibility();
        this.hidePreview();
    }
    
    selectResolution(resolution) {
        this.selectedResolution = resolution;
        
        const resBtns = this.popup.querySelectorAll('.resolution-btn');
        resBtns.forEach(btn => {
            const btnResolution = parseInt(btn.dataset.resolution);
            const isSelected = btnResolution === resolution;
            
            btn.classList.toggle('selected', isSelected);
            
            if (isSelected) {
                btn.style.border = '1px solid var(--futaba-medium)';
                btn.style.background = 'rgba(207, 156, 151, 0.82)';
                btn.style.color = 'var(--futaba-maroon)';
            } else {
                btn.style.border = '1px solid rgba(207, 156, 151, 0.78)';
                btn.style.background = 'rgba(255, 255, 238, 0.62)';
                btn.style.color = 'var(--futaba-maroon)';
            }
        });
        
        this.updateOutputSize();
    }
    
    updateOutputSize() {
        const outputSizeEl = document.getElementById('output-size-display');
        if (!outputSizeEl) return;
        
        let canvasWidth = 400;
        let canvasHeight = 400;
        if (window.TEGAKI_CONFIG?.canvas) {
            canvasWidth = window.TEGAKI_CONFIG.canvas.width;
            canvasHeight = window.TEGAKI_CONFIG.canvas.height;
        }
        
        const outputWidth = canvasWidth * this.selectedResolution;
        const outputHeight = canvasHeight * this.selectedResolution;
        
        outputSizeEl.textContent = `${outputWidth}×${outputHeight}px（${this.selectedResolution}倍出力）`;
    }
    
    getFrameCount() {
        const animData = window.animationSystem?.getAnimationData?.();
        if (animData?.frames) {
            return animData.frames.length;
        }
        return 1;
    }
    
    updatePreviewButtonVisibility() {
        const previewBtn = document.getElementById('export-preview');
        if (!previewBtn) return;
        
        const showPreview = ['png', 'gif', 'webp'].includes(this.selectedFormat);
        previewBtn.style.display = showPreview ? 'block' : 'none';
    }
    
    updateOptionsUI(format) {
        const optionsEl = document.getElementById('export-options');
        if (!optionsEl) return;
        
        let canvasWidth = 400;
        let canvasHeight = 400;
        if (window.TEGAKI_CONFIG?.canvas) {
            canvasWidth = window.TEGAKI_CONFIG.canvas.width;
            canvasHeight = window.TEGAKI_CONFIG.canvas.height;
        }
        
        const frameCount = this.getFrameCount();
        
        const resolutionUI = '';
        
        const optionsMap = {
            'png': `
                <div class="setting-label">PNG出力（APNG自動検出）</div>
                <div style="font-size: 12px; color: var(--futaba-maroon); margin-top: 8px;">
                    ${frameCount >= 2 
                        ? `全${frameCount}フレームをAPNGとして出力します。`
                        : `現在のキャンバスをPNG画像として出力します。サイズ: ${canvasWidth}×${canvasHeight}px`}
                </div>`,
                
            'gif': `
                <div class="setting-label">GIF出力（CUT数で自動判定）</div>
                <div style="font-size: 12px; color: var(--futaba-maroon); margin-top: 8px;">
                    ${frameCount >= 2
                        ? `全${frameCount}フレームをGIFアニメとして出力します。`
                        : `現在のキャンバスをGIF画像として出力します。サイズ: ${canvasWidth}×${canvasHeight}px`}
                </div>`,

            'webp': `
                <div class="setting-label">WEBP出力（WebM動画自動検出）</div>
                <div style="font-size: 12px; color: var(--futaba-maroon); margin-top: 8px;">
                    ${frameCount >= 2 
                        ? `全${frameCount}フレームをWebM動画として出力します。`
                        : `現在のキャンバスをWEBP画像として出力します。サイズ: ${canvasWidth}×${canvasHeight}px`}
                </div>`,
                
            'psd': `
                <div class="setting-label">PSD出力（開発中）</div>
                <div style="font-size: 12px; color: var(--futaba-maroon); margin-top: 8px;">
                    レイヤー構造を保持したPhotoshop形式での出力です。<br>
                    ⚠️ 現在開発中です。
                </div>`
        };
        
        optionsEl.innerHTML = optionsMap[format] || '';
        
        setTimeout(() => {
            this.selectResolution(this.selectedResolution);
        }, 0);
        
        this.updatePreviewButtonVisibility();
    }
    
    showPreview(blob, message) {
        const container = document.getElementById('preview-container');
        const img = document.getElementById('preview-image');
        const messageEl = document.getElementById('preview-message');
        
        if (!container || !img) return;
        
        this.cleanupPreview();
        
        this.currentBlob = blob;
        this.currentPreviewUrl = URL.createObjectURL(blob);
        
        img.src = this.currentPreviewUrl;
        
        if (message && messageEl) {
            messageEl.textContent = message;
        }
        
        container.style.display = 'block';
    }
    
    hidePreview() {
        const container = document.getElementById('preview-container');
        if (container) {
            container.style.display = 'none';
        }
        this.cleanupPreview();
    }
    
    cleanupPreview() {
        if (this.currentPreviewUrl) {
            URL.revokeObjectURL(this.currentPreviewUrl);
        }
        this.currentPreviewUrl = null;
        this.currentBlob = null;
        
        const img = document.getElementById('preview-image');
        if (img) img.src = '';
    }
    
    showStatus(message, isError) {
        const statusEl = document.getElementById('export-status');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? '#cc0000' : 'var(--futaba-maroon)';
    }
    
    hideStatus() {
        const statusEl = document.getElementById('export-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }
    
    async executeExport() {
        if (!this.manager) return;
        if (this.manager.isExporting()) return;
        
        const progressEl = document.getElementById('export-progress');
        const executeBtn = document.getElementById('export-execute');
        const previewBtn = document.getElementById('export-preview');
        
        this.hideStatus();
        this.hidePreview();
        if (progressEl) progressEl.style.display = 'block';
        if (executeBtn) executeBtn.disabled = true;
        if (previewBtn) previewBtn.disabled = true;
        
        try {
            const options = {
                resolution: this.selectedResolution
            };
            await this.manager.export(this.selectedFormat, options);
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus('エクスポート失敗: ' + error.message, true);
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            if (previewBtn) previewBtn.disabled = false;
            this.resetProgress();
        }
    }
    
    async executePreview() {
        if (!this.manager) return;
        if (this.manager.isExporting()) return;
        
        const previewBtn = document.getElementById('export-preview');
        const executeBtn = document.getElementById('export-execute');
        const progressEl = document.getElementById('export-progress');
        
        this.hideStatus();
        this.hidePreview();
        
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.textContent = '生成中...';
        }
        if (executeBtn) executeBtn.disabled = true;
        
        const frameCount = this.getFrameCount();
        const isAnimation = frameCount >= 2;
        
        if (isAnimation && progressEl) {
            progressEl.style.display = 'block';
        }
        
        try {
            const options = {
                resolution: this.selectedResolution
            };
            const result = await this.manager.generatePreview(this.selectedFormat, options);
            
            if (progressEl) progressEl.style.display = 'none';
            
            let formatName = this.selectedFormat.toUpperCase();
            if (result.format === 'apng') {
                formatName = 'APNG';
            } else if (result.format === 'webm') {
                formatName = 'WebM動画';
            }
            
            this.showPreview(result.blob, `${formatName}プレビュー（${this.selectedResolution}x）`);
            
            if (previewBtn) {
                previewBtn.textContent = 'プレビュー';
                previewBtn.disabled = false;
            }
            if (executeBtn) executeBtn.disabled = false;
            this.resetProgress();
            
        } catch (error) {
            console.error('Preview generation error:', error);
            this.showStatus('プレビュー生成失敗: ' + error.message, true);
            if (previewBtn) {
                previewBtn.textContent = 'プレビュー';
                previewBtn.disabled = false;
            }
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            this.resetProgress();
        }
    }
    
    updateProgress(data) {
        const progressFill = document.querySelector('#export-progress .progress-fill');
        const progressText = document.querySelector('#export-progress .progress-text');
        
        let percent = 0;
        
        if (data.progress !== undefined) {
            percent = Math.round(data.progress);
        } else if (data.current && data.total) {
            percent = Math.round((data.current / data.total) * 100);
        }
        
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = percent + '%';
    }
    
    onExportCompleted(data) {
        const progressEl = document.getElementById('export-progress');
        const executeBtn = document.getElementById('export-execute');
        const previewBtn = document.getElementById('export-preview');
        
        if (progressEl) progressEl.style.display = 'none';
        if (executeBtn) executeBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
        
        this.resetProgress();
        
        let formatName = 'PNG';
        if (data.format === 'apng') {
            formatName = 'APNG';
        } else if (data.format === 'webm') {
            formatName = 'WebM動画';
        } else if (data.format === 'webp') {
            formatName = 'WEBP';
        } else if (data.format) {
            formatName = data.format.toUpperCase();
        }
        
        this.showStatus(`${formatName}ダウンロード完了`, false);
        setTimeout(() => this.hideStatus(), 2000);
    }
    
    onExportFailed(data) {
        const progressEl = document.getElementById('export-progress');
        const executeBtn = document.getElementById('export-execute');
        const previewBtn = document.getElementById('export-preview');
        
        if (progressEl) progressEl.style.display = 'none';
        if (executeBtn) executeBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
        
        this.showStatus(`エクスポート失敗: ${data.error}`, true);
        this.resetProgress();
    }
    
    resetProgress() {
        const progressFill = document.querySelector('#export-progress .progress-fill');
        const progressText = document.querySelector('#export-progress .progress-text');
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.classList.add('show');
        this.isVisible = true;
        this.selectFormat(this.selectedFormat);
        this.hideStatus();
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
        this.resetProgress();
        this.hideStatus();
        this.hidePreview();
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup && !!this.manager;
    }
    
    destroy() {
        this.cleanupPreview();
        if (this.popupDragCleanup) {
            this.popupDragCleanup();
            this.popupDragCleanup = null;
        }
    }
}

// 下位互換性のためにグローバルに登録
window.ExportPopup = ExportPopup;
window.TegakiExportPopup = ExportPopup;
