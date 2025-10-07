// ==================================================
// ui/export-popup.js
// エクスポートUI管理 - GIFプレビュー対応版
// ==================================================
window.ExportPopup = (function() {
    'use strict';
    
    class ExportPopup {
        constructor(exportManager) {
            this.manager = exportManager;
            this.selectedFormat = 'png';
            this.isVisible = false;
            this.currentGifBlob = null;
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
                
                popup.innerHTML = `
                    <div class="popup-title">画像・アニメ出力</div>
                    <div class="format-selection">
                        <button class="format-btn selected" data-format="png">PNG</button>
                        <button class="format-btn" data-format="gif">GIF</button>
                        <button class="format-btn disabled" data-format="apng">APNG</button>
                        <button class="format-btn disabled" data-format="webp">WEBP</button>
                        <button class="format-btn disabled" data-format="mp4">MP4</button>
                        <button class="format-btn disabled" data-format="pdf">PDF</button>
                    </div>
                    <div class="export-options" id="export-options">
                        <div class="setting-label">PNG静止画出力</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                            現在のキャンバス状態をPNG画像として出力します。
                        </div>
                    </div>
                    <div class="export-progress" id="export-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="progress-text">0%</div>
                    </div>
                    <div class="gif-preview-container" id="gif-preview-container" style="display: none; margin: 12px 0; text-align: center; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 6px; padding: 12px;">
                        <div style="font-size: 12px; color: var(--futaba-maroon); margin-bottom: 8px; font-weight: 500;">
                            ↓ 下の画像を右クリック →「画像をコピー」してください
                        </div>
                        <img id="gif-preview-image" style="max-width: 100%; max-height: 300px; border: 2px solid var(--futaba-light-medium); border-radius: 4px; cursor: context-menu;" />
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">
                            ※ブラウザの制約により、直接クリップボードへコピーできません
                        </div>
                    </div>
                    <div class="export-status" id="export-status" style="display: none; font-size: 12px; color: var(--text-secondary); margin: 8px 0;"></div>
                    <div class="export-actions">
                        <button class="action-button" id="export-execute">出力開始</button>
                        <button class="action-button secondary" id="export-copy">コピー</button>
                    </div>
                `;
                
                document.body.appendChild(popup);
            }
            
            this.updateOptionsUI(this.selectedFormat);
        }
        
        setupEventListeners() {
            // ポップアップ内のクリックイベント
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
                
                if (e.target.closest('#export-copy')) {
                    this.executeCopy();
                    return;
                }
                
                // ポップアップ外クリックで閉じる（遅延実行で他の処理を優先）
                if (this.isVisible) {
                    setTimeout(() => {
                        const popup = document.getElementById('export-popup');
                        const exportIcon = document.getElementById('export-tool');
                        
                        if (popup && !popup.contains(e.target) && 
                            e.target !== exportIcon && !exportIcon?.contains(e.target)) {
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
                
                window.TegakiEventBus.on('export:copied', (data) => {
                    this.onCopySuccess(data);
                });
                
                window.TegakiEventBus.on('export:aborted', () => {
                    const progressEl = document.getElementById('export-progress');
                    if (progressEl) progressEl.style.display = 'none';
                    this.resetProgress();
                });
            }
        }
        
        selectFormat(format) {
            this.selectedFormat = format;
            
            document.querySelectorAll('.format-btn').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.format === format);
            });
            
            this.updateOptionsUI(format);
            this.updateCopyButtonState();
            this.hideGifPreview();
        }
        
        updateCopyButtonState() {
            const copyBtn = document.getElementById('export-copy');
            if (!copyBtn) return;
            
            const copyableFormats = ['png', 'gif'];
            
            if (copyableFormats.includes(this.selectedFormat)) {
                copyBtn.disabled = false;
                copyBtn.style.opacity = '1';
            } else {
                copyBtn.disabled = true;
                copyBtn.style.opacity = '0.5';
            }
        }
        
        updateOptionsUI(format) {
            const optionsEl = document.getElementById('export-options');
            if (!optionsEl) return;
            
            const canvasWidth = window.TEGAKI_CONFIG?.canvas.width || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas.height || 400;
            const cutCount = this.manager?.animationSystem?.getAnimationData?.()?.cuts?.length || 0;
            const quality = window.TEGAKI_CONFIG?.animation?.exportSettings?.quality || 10;
            
            const optionsMap = {
                'png': `
                    <div class="setting-label">PNG静止画出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        現在のキャンバス状態をPNG画像として出力します。<br>
                        サイズ: ${canvasWidth}×${canvasHeight}px
                    </div>
                `,
                'gif': `
                    <div class="setting-label">GIFアニメーション出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        全てのCUTをGIFアニメーションとして出力します。<br>
                        品質: ${quality} / フレーム数: ${cutCount}
                    </div>
                `,
                'apng': `
                    <div class="setting-label">APNGアニメーション出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        準備中 - 次回実装予定
                    </div>
                `,
                'webp': `
                    <div class="setting-label">WEBP出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        準備中 - 次回実装予定
                    </div>
                `,
                'mp4': `
                    <div class="setting-label">MP4動画出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        準備中 - 将来実装予定
                    </div>
                `,
                'pdf': `
                    <div class="setting-label">PDF出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        準備中 - 将来実装予定
                    </div>
                `
            };
            
            optionsEl.innerHTML = optionsMap[format] || '';
        }
        
        showGifPreview(blob) {
            const container = document.getElementById('gif-preview-container');
            const img = document.getElementById('gif-preview-image');
            
            if (!container || !img) return;
            
            if (this.currentGifBlob) {
                URL.revokeObjectURL(img.src);
            }
            
            this.currentGifBlob = blob;
            img.src = URL.createObjectURL(blob);
            container.style.display = 'block';
        }
        
        hideGifPreview() {
            const container = document.getElementById('gif-preview-container');
            const img = document.getElementById('gif-preview-image');
            
            if (!container || !img) return;
            
            if (this.currentGifBlob) {
                URL.revokeObjectURL(img.src);
                this.currentGifBlob = null;
            }
            
            container.style.display = 'none';
            img.src = '';
        }
        
        showStatus(message, isError = false) {
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
            
            const disabledFormats = ['apng', 'webp', 'mp4', 'pdf'];
            if (disabledFormats.includes(this.selectedFormat)) {
                this.showStatus(`${this.selectedFormat.toUpperCase()}出力は準備中です`, true);
                return;
            }
            
            const progressEl = document.getElementById('export-progress');
            const executeBtn = document.getElementById('export-execute');
            const copyBtn = document.getElementById('export-copy');
            
            this.hideStatus();
            this.hideGifPreview();
            if (progressEl) progressEl.style.display = 'block';
            if (executeBtn) executeBtn.disabled = true;
            if (copyBtn) copyBtn.disabled = true;
            
            try {
                await this.manager.export(this.selectedFormat, {});
            } catch (error) {
                this.showStatus(`エクスポート失敗: ${error.message}`, true);
                if (progressEl) progressEl.style.display = 'none';
                if (executeBtn) executeBtn.disabled = false;
                this.updateCopyButtonState();
                this.resetProgress();
            }
        }
        
        async executeCopy() {
            if (this.manager.isExporting()) {
                return;
            }
            
            const copyableFormats = ['png', 'gif'];
            if (!copyableFormats.includes(this.selectedFormat)) {
                this.showStatus(`${this.selectedFormat.toUpperCase()}のコピーは対応していません`, true);
                return;
            }
            
            const copyBtn = document.getElementById('export-copy');
            const executeBtn = document.getElementById('export-execute');
            const progressEl = document.getElementById('export-progress');
            
            this.hideStatus();
            this.hideGifPreview();
            
            if (copyBtn) {
                copyBtn.disabled = true;
                copyBtn.textContent = 'コピー中...';
            }
            if (executeBtn) executeBtn.disabled = true;
            
            if (this.selectedFormat === 'gif' && progressEl) {
                progressEl.style.display = 'block';
            }
            
            try {
                const exporter = this.manager.exporters[this.selectedFormat];
                if (exporter && exporter.copy) {
                    await exporter.copy({});
                } else {
                    throw new Error('Copy method not available');
                }
            } catch (error) {
                this.showStatus(`コピー失敗: ${error.message}`, true);
                if (copyBtn) {
                    copyBtn.textContent = 'コピー';
                }
                if (progressEl) progressEl.style.display = 'none';
                this.updateCopyButtonState();
                if (executeBtn) executeBtn.disabled = false;
                this.resetProgress();
            }
        }
        
        onCopySuccess(data) {
            const copyBtn = document.getElementById('export-copy');
            const executeBtn = document.getElementById('export-execute');
            const progressEl = document.getElementById('export-progress');
            
            if (progressEl) progressEl.style.display = 'none';
            
            if (data && data.blob) {
                this.showGifPreview(data.blob);
            }
            
            if (copyBtn) {
                copyBtn.textContent = 'コピー';
                this.updateCopyButtonState();
            }
            
            if (executeBtn) executeBtn.disabled = false;
            this.resetProgress();
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
            
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `${percent}%`;
        }
        
        onExportCompleted(data) {
            const progressEl = document.getElementById('export-progress');
            const executeBtn = document.getElementById('export-execute');
            
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            this.updateCopyButtonState();
            
            this.resetProgress();
            
            setTimeout(() => {
                this.hide();
            }, 500);
        }
        
        onExportFailed(data) {
            const progressEl = document.getElementById('export-progress');
            const executeBtn = document.getElementById('export-execute');
            
            if (progressEl) progressEl.style.display = 'none';
            if (executeBtn) executeBtn.disabled = false;
            this.updateCopyButtonState();
            
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
                this.hideGifPreview();
            }
        }
    }
    
    return ExportPopup;
})();

console.log('✅ export-popup.js (GIFプレビュー対応版) loaded');