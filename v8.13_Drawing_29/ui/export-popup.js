// ===== ui/export-popup.js - PopupManager対応改修版 =====
// 責務: エクスポートUI管理、プレビュー表示
// 🔥 改修: PopupManager統合、共通インターフェース適用、DOM操作の統一

window.TegakiExportPopup = class ExportPopup {
    constructor(dependencies) {
        this.manager = dependencies.exportManager;
        this.selectedFormat = 'png';
        this.isVisible = false;
        this.currentPreviewUrl = null;
        this.currentBlob = null;
        this.popup = null;
        
        this._ensurePopupElement();
        this.setupEventListeners();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('export-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            // 既存要素の初期化
            this.popup.classList.remove('show');
            this.popup.style.display = '';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area') || document.body;
        
        const popup = document.createElement('div');
        popup.id = 'export-popup';
        popup.className = 'popup-panel';
        popup.style.left = '60px';
        popup.style.top = '200px';
        popup.style.minWidth = '420px';
        popup.style.maxWidth = '600px';
        
        popup.innerHTML = '<div class="popup-title">画像・アニメ出力</div>' +
            '<div class="format-selection">' +
                '<button class="format-btn selected" data-format="png">PNG</button>' +
                '<button class="format-btn" data-format="gif">GIF</button>' +
                '<button class="format-btn disabled" data-format="pdf">PDF</button>' +
            '</div>' +
            '<div class="export-options" id="export-options"></div>' +
            '<div class="export-progress" id="export-progress" style="display: none;">' +
                '<div class="progress-bar"><div class="progress-fill"></div></div>' +
                '<div class="progress-text">0%</div>' +
            '</div>' +
            '<div class="preview-container" id="preview-container" style="display: none; margin: 8px 0; text-align: center; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 6px; padding: 8px; max-height: 350px; overflow: auto;">' +
                '<div id="preview-message" style="font-size: 12px; color: var(--futaba-maroon); margin-bottom: 8px; font-weight: 500;">プレビュー</div>' +
                '<img id="preview-image" style="max-width: 100%; max-height: 300px; width: auto; height: auto; object-fit: contain; border: 2px solid var(--futaba-light-medium); border-radius: 4px; cursor: context-menu; display: block; margin: 0 auto;" />' +
            '</div>' +
            '<div class="export-status" id="export-status" style="display: none; font-size: 12px; color: var(--text-secondary); margin: 8px 0;"></div>' +
            '<div class="export-actions">' +
                '<button class="action-button" id="export-execute">ダウンロード</button>' +
                '<button class="action-button secondary" id="export-preview">プレビュー</button>' +
            '</div>';
        
        container.appendChild(popup);
        this.popup = popup;
        
        this.updateOptionsUI(this.selectedFormat);
    }
    
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const formatBtn = e.target.closest('.format-btn');
            if (formatBtn && !formatBtn.classList.contains('disabled')) {
                this.selectFormat(formatBtn.dataset.format);
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
        
        if (window.TegakiEventBus) {
            window.TegakiEventBus.on('export:progress', (data) => {
                this.updateProgress(data);
            });
            
            window.TegakiEventBus.on('export:completed', (data) => {
                this.onExportCompleted(data);
            });
            
            window.TegakiEventBus.on('export:failed', (data) => {
                this.onExportFailed(data);
            });
            
            window.TegakiEventBus.on('export:frame-rendered', (data) => {
                this.updateProgress({
                    current: data.frame,
                    total: data.total
                });
            });
        }
    }
    
    selectFormat(format) {
        this.selectedFormat = format;
        
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
        
        this.updateOptionsUI(format);
        this.updatePreviewButtonVisibility();
        this.hidePreview();
    }
    
    getCutCount() {
        if (this.manager?.animationSystem?.getAnimationData) {
            const animData = this.manager.animationSystem.getAnimationData();
            if (animData?.cuts) {
                return animData.cuts.length;
            }
        }
        return 1;
    }
    
    updatePreviewButtonVisibility() {
        const previewBtn = document.getElementById('export-preview');
        if (!previewBtn) return;
        
        const showPreview = this.selectedFormat === 'png' || this.selectedFormat === 'gif';
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
        
        const cutCount = this.getCutCount();
        let quality = 10;
        if (window.TEGAKI_CONFIG?.animation?.exportSettings) {
            quality = window.TEGAKI_CONFIG.animation.exportSettings.quality;
        }
        
        const pngDescription = cutCount >= 2 
            ? '全' + cutCount + '個のCUTをAPNG（アニメーションPNG）として出力します。'
            : '現在のキャンバスをPNG画像として出力します。';
        
        const cutInfo = cutCount >= 2 ? (' / CUT数: ' + cutCount) : '';
        
        const optionsMap = {
            'png': '<div class="setting-label">PNG出力（CUT数で自動判定）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    pngDescription + '<br>' +
                    'サイズ: ' + canvasWidth + '×' + canvasHeight + 'px' + cutInfo +
                '</div>',
            'gif': '<div class="setting-label">GIFアニメーション出力</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    '全' + cutCount + '個のCUTをGIFアニメーションとして出力します。<br>' +
                    '品質: ' + quality + ' / フレーム数: ' + cutCount +
                '</div>',
            'pdf': '<div class="setting-label">PDF出力</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    '準備中 - 将来実装予定' +
                '</div>'
        };
        
        optionsEl.innerHTML = optionsMap[format] || '';
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
        
        img.onload = () => { /* handled */ };
        img.onerror = () => { /* handled */ };
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
        statusEl.style.color = isError ? 'var(--futaba-maroon)' : 'var(--text-secondary)';
    }
    
    hideStatus() {
        const statusEl = document.getElementById('export-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }
    
    async executeExport() {
        if (this.manager.isExporting()) {
            return;
        }
        
        const disabledFormats = ['pdf'];
        if (disabledFormats.includes(this.selectedFormat)) {
            this.showStatus(this.selectedFormat.toUpperCase() + '出力は準備中です', true);
            return;
        }
        
        const progressEl = document.getElementById('export-progress');
        const executeBtn = document.getElementById('export-execute');
        const previewBtn = document.getElementById('export-preview');
        
        this.hideStatus();
        this.hidePreview();
        if (progressEl) progressEl.style.display = 'block';
        if (executeBtn) executeBtn.disabled = true;
        if (previewBtn) previewBtn.disabled = true;
        
        try {
            await this.manager.export(this.selectedFormat, {});
        } catch (error) {
            this.showStatus('エクスポート失敗: ' + error.message, true);
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            if (previewBtn) previewBtn.disabled = false;
            this.resetProgress();
        }
    }
    
    async executePreview() {
        if (this.manager.isExporting()) {
            return;
        }
        
        const disabledFormats = ['pdf'];
        if (disabledFormats.includes(this.selectedFormat)) {
            this.showStatus(this.selectedFormat.toUpperCase() + 'のプレビューは準備中です', true);
            return;
        }
        
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
        
        const cutCount = this.getCutCount();
        const isAnimation = this.selectedFormat === 'gif' || (this.selectedFormat === 'png' && cutCount >= 2);
        
        if (isAnimation && progressEl) {
            progressEl.style.display = 'block';
        }
        
        try {
            const result = await this.manager.generatePreview(this.selectedFormat, {});
            
            if (progressEl) progressEl.style.display = 'none';
            
            const formatName = result.format === 'apng' ? 'APNG' : result.format.toUpperCase();
            this.showPreview(result.blob, formatName + 'プレビューを表示しました。右クリックでコピーできます');
            
            if (previewBtn) {
                previewBtn.textContent = 'プレビュー';
                previewBtn.disabled = false;
            }
            if (executeBtn) executeBtn.disabled = false;
            this.resetProgress();
            
        } catch (error) {
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
        
        const formatName = data.format === 'apng' ? 'APNG' : (data.format ? data.format.toUpperCase() : 'PNG');
        this.showStatus(formatName + 'ダウンロード完了', false);
        setTimeout(() => this.hideStatus(), 2000);
    }
    
    onExportFailed(data) {
        const progressEl = document.getElementById('export-progress');
        const executeBtn = document.getElementById('export-execute');
        const previewBtn = document.getElementById('export-preview');
        
        if (progressEl) progressEl.style.display = 'none';
        if (executeBtn) executeBtn.disabled = false;
        if (previewBtn) previewBtn.disabled = false;
        
        this.showStatus('エクスポート失敗: ' + data.error, true);
        this.resetProgress();
    }
    
    resetProgress() {
        const progressFill = document.querySelector('#export-progress .progress-fill');
        const progressText = document.querySelector('#export-progress .progress-text');
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }
    
    // ===== 必須インターフェース =====
    
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
    }
};

// グローバル公開（複数パターン対応）
window.ExportPopup = window.TegakiExportPopup;

console.log('✅ export-popup.js (PopupManager対応版) loaded');