// ========================================
// quick-export-ui.js - Phase 1改修版
// 改修内容: ExportManager初期化完了後のみUI作成
// ========================================

class QuickExportUI {
    constructor() {
        this.container = null;
        this.isGenerating = false;
        this.initialized = false;
        
        // ★ Phase 1改修: ExportManager初期化待機
        this.waitForExportManager();
    }

    waitForExportManager() {
        // EventBus経由で初期化完了を待つ
        if (window.TegakiEventBus) {
            window.TegakiEventBus.on('export:manager:initialized', () => {
                this.init();
            });
        }
        
        // タイマーでも確認（フォールバック）
        const checkInterval = setInterval(() => {
            if (window.TEGAKI_EXPORT_MANAGER && !this.initialized) {
                clearInterval(checkInterval);
                this.init();
            }
        }, 500);
        
        // 10秒後にタイムアウト
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.initialized) {
                console.warn('[QuickExportUI] ExportManager initialization timeout');
            }
        }, 10000);
    }

    init() {
        if (this.initialized) return;
        
        this.initialized = true;
        this.createUI();
        this.setupEventListeners();
        console.log('✅ QuickExportUI initialized');
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'quick-export-ui';
        this.container.innerHTML = `
            <div class="quick-export-buttons">
                <button id="quick-export-png" title="PNG出力 (P)">PNG</button>
                <button id="quick-export-gif" title="GIFプレビュー (G)">GIF</button>
                <button id="quick-export-apng" title="APNGプレビュー (A)">APNG</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #quick-export-ui {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
            }
            .quick-export-buttons {
                display: flex;
                gap: 8px;
            }
            .quick-export-buttons button {
                padding: 8px 16px;
                background: #800000;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .quick-export-buttons button:hover {
                background: #aa5a56;
            }
            .quick-export-buttons button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.container);
    }

    setupEventListeners() {
        document.getElementById('quick-export-png').addEventListener('click', () => {
            this.exportPNG();
        });

        document.getElementById('quick-export-gif').addEventListener('click', () => {
            this.previewGIF();
        });

        document.getElementById('quick-export-apng').addEventListener('click', () => {
            this.previewAPNG();
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) return;
            
            if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                this.exportPNG();
            } else if (e.key === 'g' || e.key === 'G') {
                e.preventDefault();
                this.previewGIF();
            } else if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                this.previewAPNG();
            }
        });
    }

    getExportManager() {
        if (!window.TEGAKI_EXPORT_MANAGER) {
            console.error('[QuickExportUI] TEGAKI_EXPORT_MANAGER not initialized');
            alert('エクスポートシステムが初期化されていません。\nページをリロードしてください。');
            return null;
        }
        return window.TEGAKI_EXPORT_MANAGER;
    }

    async exportPNG() {
        const manager = this.getExportManager();
        if (!manager || this.isGenerating) return;

        try {
            this.isGenerating = true;
            this.setButtonsEnabled(false);

            const result = await manager.generatePreview('png');
            if (result && result.blob) {
                this.downloadBlob(result.blob, 'export.png');
            }
        } catch (error) {
            console.error('[QuickExportUI] PNG export failed:', error);
            alert('PNG出力に失敗しました: ' + error.message);
        } finally {
            this.isGenerating = false;
            this.setButtonsEnabled(true);
        }
    }

    async previewGIF() {
        const manager = this.getExportManager();
        if (!manager || this.isGenerating) return;

        try {
            this.isGenerating = true;
            this.setButtonsEnabled(false);

            const result = await manager.generatePreview('gif', {});

            if (result && result.blob) {
                this.showPreview(result.blob, 'GIFプレビュー');
            }
        } catch (error) {
            console.error('[QuickExportUI] GIF preview failed:', error);
            alert('GIFプレビュー生成に失敗しました: ' + error.message);
        } finally {
            this.isGenerating = false;
            this.setButtonsEnabled(true);
        }
    }

    async previewAPNG() {
        const manager = this.getExportManager();
        if (!manager || this.isGenerating) return;

        try {
            this.isGenerating = true;
            this.setButtonsEnabled(false);

            const result = await manager.generatePreview('png', {});

            if (result && result.blob) {
                const formatName = result.format === 'apng' ? 'APNG' : 'PNG';
                this.showPreview(result.blob, formatName + 'プレビュー');
            }
        } catch (error) {
            console.error('[QuickExportUI] APNG preview failed:', error);
            alert('APNGプレビュー生成に失敗しました: ' + error.message);
        } finally {
            this.isGenerating = false;
            this.setButtonsEnabled(true);
        }
    }

    showPreview(blob, title) {
        const url = URL.createObjectURL(blob);
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 20000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        const titleEl = document.createElement('div');
        titleEl.textContent = title;
        titleEl.style.cssText = `
            color: white;
            font-size: 18px;
            margin-bottom: 10px;
        `;

        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = `
            max-width: 90%;
            max-height: 80%;
            border: 2px solid white;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '閉じる (ESC)';
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 20px;
            background: #800000;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        `;

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'ダウンロード';
        downloadBtn.style.cssText = `
            margin-top: 10px;
            padding: 10px 20px;
            background: #aa5a56;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        `;

        const close = () => {
            URL.revokeObjectURL(url);
            overlay.remove();
        };

        closeBtn.onclick = close;
        downloadBtn.onclick = () => {
            const ext = title.includes('GIF') ? 'gif' : 'png';
            this.downloadBlob(blob, `preview.${ext}`);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', onEsc);
            }
        });

        overlay.appendChild(titleEl);
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        overlay.appendChild(downloadBtn);
        document.body.appendChild(overlay);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    setButtonsEnabled(enabled) {
        const pngBtn = document.getElementById('quick-export-png');
        const gifBtn = document.getElementById('quick-export-gif');
        const apngBtn = document.getElementById('quick-export-apng');
        
        if (pngBtn) pngBtn.disabled = !enabled;
        if (gifBtn) gifBtn.disabled = !enabled;
        if (apngBtn) apngBtn.disabled = !enabled;
    }
}

// ★ Phase 1改修: 即座に初期化せず、インスタンスのみ作成
if (typeof window !== 'undefined') {
    window.QuickExportUI = new QuickExportUI();
}

console.log('✅ quick-export-ui.js (Phase 1改修版) loaded');