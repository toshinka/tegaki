// ==================================================
// ui/export-popup.js
// エクスポートUI管理 - デバッグ強化版
// ==================================================
window.ExportPopup = (function() {
    'use strict';
    
    class ExportPopup {
        constructor(exportManager) {
            this.manager = exportManager;
            this.selectedFormat = 'png';
            this.isVisible = false;
            this.currentPreviewUrl = null;
            this.currentBlob = null;
            this.setupUI();
            this.setupEventListeners();
        }
        
        setupUI() {
            let popup = document.getElementById('export-popup');
            
            if (!popup) {
                popup = document.createElement('div');
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
                        '<div class="progress-bar">' +
                            '<div class="progress-fill"></div>' +
                        '</div>' +
                        '<div class="progress-text">0%</div>' +
                    '</div>' +
                    '<div class="preview-container" id="preview-container" style="display: none; margin: 8px 0; text-align: center; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 6px; padding: 8px; max-height: 350px; overflow: auto;">' +
                        '<div id="preview-message" style="font-size: 12px; color: var(--futaba-maroon); margin-bottom: 8px; font-weight: 500;">' +
                            'プレビューを表示しました。右クリックでコピーできます' +
                        '</div>' +
                        '<img id="preview-image" style="max-width: 100%; max-height: 300px; width: auto; height: auto; object-fit: contain; border: 2px solid var(--futaba-light-medium); border-radius: 4px; cursor: context-menu; display: block; margin: 0 auto;" />' +
                    '</div>' +
                    '<div class="export-status" id="export-status" style="display: none; font-size: 12px; color: var(--text-secondary); margin: 8px 0;"></div>' +
                    '<div class="export-actions">' +
                        '<button class="action-button" id="export-execute">ダウンロード</button>' +
                        '<button class="action-button secondary" id="export-preview">プレビュー</button>' +
                    '</div>';
                
                document.body.appendChild(popup);
            }
            
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
                
                if (this.isVisible) {
                    setTimeout(() => {
                        const popup = document.getElementById('export-popup');
                        const exportIcon = document.getElementById('export-tool');
                        
                        if (popup && !popup.contains(e.target) && 
                            e.target !== exportIcon && (!exportIcon || !exportIcon.contains(e.target))) {
                            this.hide();
                        }
                    }, 0);
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
            if (this.manager && this.manager.animationSystem && 
                this.manager.animationSystem.getAnimationData) {
                const animData = this.manager.animationSystem.getAnimationData();
                if (animData && animData.cuts) {
                    return animData.cuts.length;
                }
            }
            return 1;
        }
        
        updatePreviewButtonVisibility() {
            const previewBtn = document.getElementById('export-preview');
            if (!previewBtn) return;
            
            const cutCount = this.getCutCount();
            const showPreview = this.selectedFormat === 'png' || this.selectedFormat === 'gif';
            
            previewBtn.style.display = showPreview ? 'block' : 'none';
        }
        
        updateOptionsUI(format) {
            const optionsEl = document.getElementById('export-options');
            if (!optionsEl) return;
            
            let canvasWidth = 400;
            let canvasHeight = 400;
            if (window.TEGAKI_CONFIG && window.TEGAKI_CONFIG.canvas) {
                canvasWidth = window.TEGAKI_CONFIG.canvas.width;
                canvasHeight = window.TEGAKI_CONFIG.canvas.height;
            }
            
            const cutCount = this.getCutCount();
            
            let quality = 10;
            if (window.TEGAKI_CONFIG && window.TEGAKI_CONFIG.animation && 
                window.TEGAKI_CONFIG.animation.exportSettings) {
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
            
            if (!container || !img) {
                console.error('Preview elements not found');
                return;
            }
            
            this.cleanupPreview();
            
            this.currentBlob = blob;
            this.currentPreviewUrl = URL.createObjectURL(blob);
            
            console.log('Preview URL created:', this.currentPreviewUrl);
            console.log('Blob type:', blob.type, 'Size:', blob.size);
            
            img.onload = () => {
                console.log('Preview image loaded successfully');
            };
            
            img.onerror = (e) => {
                console.error('Preview image load error:', e);
            };
            
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
                console.error('Export error:', error);
                this.showStatus('エクスポート失敗: ' + error.message, true);
                if (progressEl) progressEl.style.display = 'none';
                if (executeBtn) executeBtn.disabled = false;
                if (previewBtn) previewBtn.disabled = false;
                this.resetProgress();
            }
        }
        
        async executePreview() {
            console.log('=== Preview execution started ===');
            console.log('Current format:', this.selectedFormat);
            console.log('Manager exists:', !!this.manager);
            console.log('Is exporting:', this.manager.isExporting());
            
            if (this.manager.isExporting()) {
                console.log('Already exporting, aborting');
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
            
            console.log('Cut count:', cutCount);
            console.log('Is animation:', isAnimation);
            
            if (isAnimation && progressEl) {
                progressEl.style.display = 'block';
            }
            
            try {
                console.log('Calling generatePreview...');
                const result = await this.manager.generatePreview(this.selectedFormat, {});
                
                console.log('Preview generated:', result);
                console.log('Blob received:', result.blob);
                console.log('Format:', result.format);
                
                if (progressEl) progressEl.style.display = 'none';
                
                const formatName = result.format === 'apng' ? 'APNG' : result.format.toUpperCase();
                this.showPreview(result.blob, formatName + 'プレビューを表示しました。右クリックでコピーできます');
                
                if (previewBtn) {
                    previewBtn.textContent = 'プレビュー';
                    previewBtn.disabled = false;
                }
                if (executeBtn) executeBtn.disabled = false;
                this.resetProgress();
                
                console.log('=== Preview execution completed ===');
                
            } catch (error) {
                console.error('=== Preview execution failed ===');
                console.error('Error:', error);
                console.error('Stack:', error.stack);
                
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
        
        show() {
            const popup = document.getElementById('export-popup');
            if (popup) {
                popup.classList.add('show');
                this.isVisible = true;
                this.selectFormat(this.selectedFormat);
                this.hideStatus();
            }
        }
        
        hide() {
            const popup = document.getElementById('export-popup');
            if (popup) {
                popup.classList.remove('show');
                this.isVisible = false;
                this.resetProgress();
                this.hideStatus();
                this.hidePreview();
            }
        }
    }
    
    return ExportPopup;
})();

console.log('✅ export-popup.js (デバッグ強化版) loaded');