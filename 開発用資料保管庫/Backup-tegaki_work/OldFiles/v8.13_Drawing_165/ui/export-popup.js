/**
 * ================================================================================
 * ui/export-popup.js - 高DPI出力対応版【Phase 1完成】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js (エクスポート実行)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - エクスポート設定UI
 *   - プレビュー表示
 *   - 進捗表示
 *   - 高DPI出力オプション管理
 * 
 * 【改修内容】
 *   ✅ resolution='auto' をデフォルトで渡す
 *   ✅ 高品質出力オプションUI追加
 *   ✅ 画面DPIと出力DPIの整合性確保
 * ================================================================================
 */

window.TegakiExportPopup = class ExportPopup {
    constructor(dependencies) {
        this.manager = dependencies.exportManager;
        this.selectedFormat = 'png';
        this.isVisible = false;
        this.currentPreviewUrl = null;
        this.currentBlob = null;
        this.popup = null;
        this.useHighDPI = true; // デフォルトで高DPI有効
        
        this._ensurePopupElement();
        this.setupEventListeners();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('export-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
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
                '<button class="format-btn" data-format="pdf">PDF</button>' +
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
            
            if (e.target.closest('#high-dpi-toggle')) {
                this.toggleHighDPI();
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
    
    toggleHighDPI() {
        this.useHighDPI = !this.useHighDPI;
        this.updateOptionsUI(this.selectedFormat);
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
    
    getFrameCount() {
        if (this.manager?.animationSystem?.getAnimationData) {
            const animData = this.manager.animationSystem.getAnimationData();
            if (animData?.frames) {
                return animData.frames.length;
            }
        }
        return 1;
    }
    
    updatePreviewButtonVisibility() {
        const previewBtn = document.getElementById('export-preview');
        if (!previewBtn) return;
        
        const showPreview = ['png', 'gif'].includes(this.selectedFormat);
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
        
        const dpr = window.devicePixelRatio || 1;
        const outputWidth = this.useHighDPI ? Math.round(canvasWidth * dpr) : canvasWidth;
        const outputHeight = this.useHighDPI ? Math.round(canvasHeight * dpr) : canvasHeight;
        
        const frameCount = this.getFrameCount();
        let quality = 10;
        if (window.TEGAKI_CONFIG?.animation?.exportSettings) {
            quality = window.TEGAKI_CONFIG.animation.exportSettings.quality;
        }
        
        const frameInfo = frameCount >= 2 ? ` / ${frameCount}フレーム` : '';
        
        const pngDescription = frameCount >= 2 
            ? '全' + frameCount + 'フレームをAPNG（アニメーションPNG）として出力します。'
            : '現在のキャンバスをPNG画像として出力します。';
        
        const highDPIToggle = '<div style="margin: 12px 0; padding: 8px; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 4px;">' +
            '<label style="display: flex; align-items: center; cursor: pointer; user-select: none;">' +
                '<input type="checkbox" id="high-dpi-toggle" ' + (this.useHighDPI ? 'checked' : '') + ' style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">' +
                '<span style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon);">高DPI出力 (画面と同等の品質)</span>' +
            '</label>' +
            '<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; margin-left: 26px;">' +
                '有効時: ' + outputWidth + '×' + outputHeight + 'px (DPI:' + dpr.toFixed(1) + 'x)<br>' +
                '無効時: ' + canvasWidth + '×' + canvasHeight + 'px (標準)' +
            '</div>' +
        '</div>';
        
        const optionsMap = {
            'png': '<div class="setting-label">PNG出力（Frame数でAPNG自動判定）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    pngDescription + '<br>' +
                    'ベースサイズ: ' + canvasWidth + '×' + canvasHeight + 'px' + frameInfo +
                '</div>' +
                highDPIToggle,
            'gif': '<div class="setting-label">GIFアニメーション出力</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    '全' + frameCount + 'フレームをGIFアニメーションとして出力します。<br>' +
                    '品質: ' + quality + ' / フレーム数: ' + frameCount +
                '</div>' +
                highDPIToggle,
            'pdf': '<div class="setting-label">PDF出力（全フレームを複数ページ）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    '全' + frameCount + 'フレームをPDFの各ページとして出力します。<br>' +
                    'ベースサイズ: ' + canvasWidth + '×' + canvasHeight + 'px' + frameInfo +
                '</div>' +
                highDPIToggle
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
    
    /**
     * エクスポート実行 - 高DPI対応
     */
    async executeExport() {
        if (this.manager.isExporting()) {
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
            // 🔧 高DPI対応: resolution を渡す
            const options = {
                resolution: this.useHighDPI ? 'auto' : 1
            };
            
            await this.manager.export(this.selectedFormat, options);
        } catch (error) {
            this.showStatus('エクスポート失敗: ' + error.message, true);
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            if (previewBtn) previewBtn.disabled = false;
            this.resetProgress();
        }
    }
    
    /**
     * プレビュー生成 - 高DPI対応
     */
    async executePreview() {
        if (this.manager.isExporting()) {
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
        
        const frameCount = this.getFrameCount();
        const isAnimation = ['gif'].includes(this.selectedFormat) || 
                          (this.selectedFormat === 'png' && frameCount >= 2);
        
        if (isAnimation && progressEl) {
            progressEl.style.display = 'block';
        }
        
        try {
            // 🔧 高DPI対応: resolution を渡す
            const options = {
                resolution: this.useHighDPI ? 'auto' : 1
            };
            
            const result = await this.manager.generatePreview(this.selectedFormat, options);
            
            if (progressEl) progressEl.style.display = 'none';
            
            let formatName = this.selectedFormat.toUpperCase();
            if (result.format === 'apng') {
                formatName = 'APNG';
            }
            
            const dpiInfo = this.useHighDPI ? ' (高DPI)' : '';
            this.showPreview(result.blob, formatName + 'プレビュー' + dpiInfo + 'を表示しました。右クリックでコピーできます');
            
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
        
        let formatName = 'PNG';
        if (data.format === 'apng') {
            formatName = 'APNG';
        } else if (data.format) {
            formatName = data.format.toUpperCase();
        }
        
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

window.ExportPopup = window.TegakiExportPopup;

console.log('✅ export-popup.js (高DPI対応版) loaded');
console.log('   ✓ 高DPI出力オプション追加');
console.log('   ✓ resolution="auto" をデフォルト適用');