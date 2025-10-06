// ==================================================
// ui/export-popup.js
// エクスポートUI管理 - setupUI実装・セレクタ修正版
// ==================================================
window.ExportPopup = (function() {
    'use strict';
    
    class ExportPopup {
        constructor(exportManager) {
            this.manager = exportManager;
            this.selectedFormat = 'png';
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
                    <div class="export-actions">
                        <button class="action-button" id="export-execute">出力開始</button>
                        <button class="action-button secondary" id="export-cancel">キャンセル</button>
                    </div>
                `;
                
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
                
                if (e.target.closest('#export-cancel')) {
                    this.hide();
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
        
        async executeExport() {
            if (this.manager.isExporting()) {
                return;
            }
            
            const disabledFormats = ['apng', 'webp', 'mp4', 'pdf'];
            if (disabledFormats.includes(this.selectedFormat)) {
                alert(`${this.selectedFormat.toUpperCase()}出力は準備中です`);
                return;
            }
            
            const progressEl = document.getElementById('export-progress');
            const executeBtn = document.getElementById('export-execute');
            
            if (progressEl) progressEl.style.display = 'block';
            if (executeBtn) executeBtn.disabled = true;
            
            try {
                await this.manager.export(this.selectedFormat, {});
            } catch (error) {
                alert(`エクスポート失敗: ${error.message}`);
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
                percent = Math.round(data.progress * 100);
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
                this.selectFormat(this.selectedFormat);
            }
        }
        
        hide() {
            const popup = document.getElementById('export-popup');
            if (popup) {
                popup.classList.remove('show');
                this.resetProgress();
            }
        }
    }
    
    return ExportPopup;
})();

console.log('✅ export-popup.js loaded');