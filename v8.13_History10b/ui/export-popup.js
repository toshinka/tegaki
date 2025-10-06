// ==================================================
// ui/export-popup.js
// エクスポートUI管理
// ==================================================
window.ExportPopup = (function() {
    'use strict';
    
    class ExportPopup {
        constructor(exportManager) {
            this.manager = exportManager;
            this.selectedFormat = 'png';
            this.setupEventListeners();
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
            
            const optionsMap = {
                'png': `
                    <div class="setting-label">PNG静止画出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        現在のキャンバス状態をPNG画像として出力します。<br>
                        サイズ: ${window.TEGAKI_CONFIG.canvas.width}×${window.TEGAKI_CONFIG.canvas.height}px
                    </div>
                `,
                'gif': `
                    <div class="setting-label">GIFアニメーション出力</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        全てのCUTをGIFアニメーションとして出力します。<br>
                        品質: ${window.TEGAKI_CONFIG.animation.exportSettings.quality} / フレーム数: ${this.manager.animationSystem?.getAnimationData().cuts.length || 0}
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
            }
        }
        
        updateProgress(data) {
            const progressBar = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            
            let percent = 0;
            
            if (data.progress !== undefined) {
                percent = data.progress;
            } else if (data.current && data.total) {
                percent = Math.round((data.current / data.total) * 100);
            }
            
            if (progressBar) progressBar.style.width = `${percent}%`;
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
            const progressBar = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            
            if (progressBar) progressBar.style.width = '0%';
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