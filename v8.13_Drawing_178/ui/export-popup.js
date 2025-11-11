/**
 * ================================================================================
 * ui/export-popup.js - UI改善・プレビューサイズ制限【v8.20.0】
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
 * 
 * 【v8.20.0 改修内容】
 *   🔧 倍率選択ボタンの即時反映とアクティブ状態の明確化
 *   🔧 プレビュー画像を200x200以内に制限（アスペクト比維持）
 *   🔧 選択状態の視覚的フィードバック強化
 *   🔧 コンソールログクリーンアップ
 * 
 * ================================================================================
 */

window.TegakiExportPopup = class ExportPopup {
    constructor(dependencies) {
        this.manager = dependencies.exportManager;
        this.selectedFormat = 'png';
        this.selectedResolution = 2;
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
                '<button class="format-btn" data-format="webp">WEBP</button>' +
                '<button class="format-btn" data-format="psd">PSD</button>' +
            '</div>' +
            '<div class="export-options" id="export-options"></div>' +
            '<div class="export-progress" id="export-progress" style="display: none;">' +
                '<div class="progress-bar"><div class="progress-fill"></div></div>' +
                '<div class="progress-text">0%</div>' +
            '</div>' +
            '<div class="preview-container" id="preview-container" style="display: none; margin: 8px 0; text-align: center; background: var(--futaba-background); border: 1px solid var(--futaba-light-medium); border-radius: 6px; padding: 8px; max-height: 230px; overflow: auto;">' +
                '<div id="preview-message" style="font-size: 12px; color: var(--futaba-maroon); margin-bottom: 8px; font-weight: 500;">プレビュー</div>' +
                '<img id="preview-image" style="max-width: 200px; max-height: 200px; width: auto; height: auto; object-fit: contain; border: 2px solid var(--futaba-light-medium); border-radius: 4px; cursor: context-menu; display: block; margin: 0 auto;" />' +
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
    
    /**
     * 倍率選択【v8.20.0 改善】
     * 
     * 改善点:
     * - 全ボタンを即座に更新
     * - 視覚的フィードバックを明確化
     */
    selectResolution(resolution) {
        this.selectedResolution = resolution;
        
        // 全てのボタンを更新
        document.querySelectorAll('.resolution-btn').forEach(btn => {
            const btnResolution = parseInt(btn.dataset.resolution);
            const isSelected = btnResolution === resolution;
            
            btn.classList.toggle('selected', isSelected);
            
            if (isSelected) {
                btn.style.border = '2px solid var(--futaba-maroon)';
                btn.style.background = 'var(--futaba-maroon)';
                btn.style.color = 'var(--futaba-cream)';
            } else {
                btn.style.border = '2px solid var(--futaba-light-medium)';
                btn.style.background = 'var(--futaba-cream)';
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
        
        const showPreview = ['png', 'webp'].includes(this.selectedFormat);
        previewBtn.style.display = showPreview ? 'block' : 'none';
    }
    
    /**
     * オプションUI更新【v8.20.0】
     * 
     * 改善点:
     * - ボタンにホバー/クリックのイベントリスナーを適切に設定
     * - 初期選択状態を確実に反映
     */
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
        
        const resolutionUI = (format === 'png' || format === 'webp') ? 
            '<div style="margin: 12px 0;">' +
                '<div style="font-size: 13px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 8px;">📐 出力解像度</div>' +
                '<div style="display: flex; gap: 8px; margin-bottom: 8px;">' +
                    '<button class="resolution-btn" data-resolution="1" style="flex: 1; padding: 8px; border: 2px solid var(--futaba-light-medium); border-radius: 4px; background: var(--futaba-cream); color: var(--futaba-maroon); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;">1x</button>' +
                    '<button class="resolution-btn" data-resolution="2" style="flex: 1; padding: 8px; border: 2px solid var(--futaba-light-medium); border-radius: 4px; background: var(--futaba-cream); color: var(--futaba-maroon); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;">2x 推奨</button>' +
                    '<button class="resolution-btn" data-resolution="4" style="flex: 1; padding: 8px; border: 2px solid var(--futaba-light-medium); border-radius: 4px; background: var(--futaba-cream); color: var(--futaba-maroon); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;">4x</button>' +
                '</div>' +
                '<div id="output-size-display" style="font-size: 12px; color: var(--text-primary);">' +
                    (canvasWidth * this.selectedResolution) + '×' + (canvasHeight * this.selectedResolution) + 'px（' + this.selectedResolution + '倍出力）' +
                '</div>' +
                '<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">💡 拡大表示時のジャギーを防ぐため、2倍以上推奨</div>' +
            '</div>' 
            : '';
        
        const optionsMap = {
            'png': '<div class="setting-label">PNG出力（APNG自動検出）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    (frameCount >= 2 
                        ? `全${frameCount}フレームをAPNGとして出力します。`
                        : '高品質な次世代画像フォーマットです。') +
                '</div>' +
                resolutionUI,
                
            'webp': '<div class="setting-label">WEBP出力（動画自動検出）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    (frameCount >= 2 
                        ? `全${frameCount}フレームをWEBPアニメーションとして出力します。`
                        : '高圧縮・高品質な次世代画像フォーマットです。') +
                '</div>' +
                resolutionUI,
                
            'psd': '<div class="setting-label">PSD出力（開発中）</div>' +
                '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">' +
                    'レイヤー構造を保持したPhotoshop形式での出力です。<br>' +
                    '⚠️ 現在開発中です。' +
                '</div>'
        };
        
        optionsEl.innerHTML = optionsMap[format] || '';
        
        // ボタンの初期状態を設定
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
        const isAnimation = this.selectedFormat === 'webp' && frameCount >= 2 || 
                          this.selectedFormat === 'png' && frameCount >= 2;
        
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
            }
            
            this.showPreview(result.blob, formatName + 'プレビュー（' + this.selectedResolution + 'x）');
            
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
        } else if (data.format === 'webp') {
            formatName = data.type === 'animated' ? 'WEBP動画' : 'WEBP';
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

console.log('✅ export-popup.js v8.20.0 loaded');