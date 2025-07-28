// src/main.js - OGL統一エンジン版
// v5.2 OGL統一アーキテクチャに基づく実装

import { OGLUnifiedEngine } from './engine/OGLUnifiedEngine.js';
import { ToolStore } from './tools/ToolStore.js';
import { ToolPanel } from './ui/ToolPanel.js';

class OGLDrawingApp {
    constructor() {
        this.oglEngine = null;
        this.toolStore = null;
        this.toolPanel = null;
        this.isInitialized = false;
        this.currentStroke = null;
        
        // 初期化
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🚀 OGL統一エンジン初期化開始...');

            // キャンバス要素の取得
            const canvas = document.getElementById('ogl-canvas');
            if (!canvas) {
                throw new Error('Canvas element with id "ogl-canvas" not found');
            }

            // OGL統一エンジンの初期化
            this.oglEngine = new OGLUnifiedEngine(canvas);
            await this.oglEngine.initialize();
            console.log('✅ OGL統一エンジン初期化完了');

            // ツールストアの初期化
            this.toolStore = new ToolStore();
            this.toolStore.addEventListener('toolChanged', (event) => {
                this.handleToolChange(event.detail);
            });
            console.log('✅ ToolStore初期化完了');

            // UI初期化
            this.toolPanel = new ToolPanel(this.toolStore);
            console.log('✅ UI初期化完了');

            // イベントリスナー設定
            this.setupEventListeners();
            console.log('✅ イベントリスナー設定完了');

            // デフォルトツール選択（ペン）
            await this.selectTool('pen');
            console.log('✅ デフォルトツール選択完了');

            // 初期化完了
            this.isInitialized = true;
            console.log('🎉 OGLDrawingApp初期化成功');

        } catch (error) {
            console.error('❌ OGLDrawingApp初期化失敗:', error);
            this.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    setupEventListeners() {
        const canvas = document.getElementById('ogl-canvas');
        if (!canvas) throw new Error('Canvas not found');

        // === ポインターイベント（OGL統一描画） ===
        canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        canvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));

        // === キーボードショートカット ===
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // === ツールボタンイベント ===
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool) {
                    this.selectTool(tool);
                }
            });
        });

        // === アクションボタンイベント ===
        const clearButton = document.getElementById('clearButton');
        const undoButton = document.getElementById('undoButton');
        
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearCanvas());
        }
        
        if (undoButton) {
            undoButton.addEventListener('click', () => this.undo());
        }

        // === コントロールパネルイベント ===
        this.setupControlPanelEvents();

        // === 右クリックメニュー無効化 ===
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('📡 イベントリスナー設定完了');
    }

    setupControlPanelEvents() {
        // ペンコントロール
        const penSizeSlider = document.getElementById('penSizeSlider');
        const penSizeValue = document.getElementById('penSizeValue');
        const penOpacitySlider = document.getElementById('penOpacitySlider');
        const penOpacityValue = document.getElementById('penOpacityValue');

        if (penSizeSlider && penSizeValue) {
            // スライダー → 数値入力の同期
            penSizeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                penSizeValue.value = value;
                this.updateToolProperty('size', parseInt(value));
                this.updateStatusBar();
            });

            // 数値入力 → スライダーの同期
            penSizeValue.addEventListener('input', (e) => {
                const value = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                penSizeSlider.value = value;
                e.target.value = value;
                this.updateToolProperty('size', value);
                this.updateStatusBar();
            });
        }

        if (penOpacitySlider && penOpacityValue) {
            penOpacitySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                penOpacityValue.value = value;
                this.updateToolProperty('opacity', parseInt(value));
                this.updateStatusBar();
            });

            penOpacityValue.addEventListener('input', (e) => {
                const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 100));
                penOpacitySlider.value = value;
                e.target.value = value;
                this.updateToolProperty('opacity', value);
                this.updateStatusBar();
            });
        }

        // 消しゴムコントロール
        const eraserSizeSlider = document.getElementById('eraserSizeSlider');
        const eraserSizeValue = document.getElementById('eraserSizeValue');

        if (eraserSizeSlider && eraserSizeValue) {
            eraserSizeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                eraserSizeValue.value = value;
                this.updateToolProperty('size', parseInt(value));
                this.updateStatusBar();
            });

            eraserSizeValue.addEventListener('input', (e) => {
                const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 10));
                eraserSizeSlider.value = value;
                e.target.value = value;
                this.updateToolProperty('size', value);
                this.updateStatusBar();
            });
        }
    }

    // === ポインターイベントハンドラー（OGL統一描画） ===
    handlePointerDown(e) {
        if (!this.isInitialized || !this.oglEngine) return;

        try {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = e.pressure || 1.0;

            console.log(`🖊️ ストローク開始: (${x.toFixed(1)}, ${y.toFixed(1)}) 筆圧: ${pressure.toFixed(2)}`);

            // OGL統一エンジンでストローク開始
            this.currentStroke = this.oglEngine.startStroke(x, y, pressure);
            
            e.preventDefault();
        } catch (error) {
            console.error('❌ PointerDown エラー:', error);
        }
    }

    handlePointerMove(e) {
        if (!this.isInitialized || !this.oglEngine || !this.currentStroke || e.buttons === 0) return;

        try {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = e.pressure || 1.0;

            // OGL統一エンジンでストローク継続
            this.oglEngine.continueStroke(this.currentStroke, x, y, pressure);
            
            e.preventDefault();
        } catch (error) {
            console.error('❌ PointerMove エラー:', error);
        }
    }

    handlePointerUp(e) {
        if (!this.isInitialized || !this.oglEngine || !this.currentStroke) return;

        try {
            console.log('🖊️ ストローク終了');

            // OGL統一エンジンでストローク終了
            this.oglEngine.endStroke(this.currentStroke);
            this.currentStroke = null;
            
            e.preventDefault();
        } catch (error) {
            console.error('❌ PointerUp エラー:', error);
        }
    }

    // === キーボードショートカット ===
    async handleKeyDown(e) {
        if (!this.isInitialized) return;

        try {
            switch (e.key.toLowerCase()) {
                case 'p':
                    if (!e.ctrlKey && !e.metaKey) {
                        await this.selectTool('pen');
                        e.preventDefault();
                    }
                    break;
                case 'e':
                    await this.selectTool('eraser');
                    e.preventDefault();
                    break;
                case 'delete':
                case 'backspace':
                    if (e.ctrlKey || e.metaKey) {
                        this.clearCanvas();
                        e.preventDefault();
                    }
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        this.undo();
                        e.preventDefault();
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ KeyDown エラー:', error);
        }
    }

    // === ツール選択（OGL統一エンジン制御） ===
    async selectTool(toolName) {
        if (!this.oglEngine) return;

        try {
            console.log(`🔧 ツール選択: ${toolName}`);

            // OGL統一エンジンでツール選択
            await this.oglEngine.selectTool(toolName);

            // ToolStore更新
            if (this.toolStore) {
                this.toolStore.setCurrentTool(toolName);
            }

            // UI更新
            this.updateToolUI(toolName);
            this.updateStatusBar();

            console.log(`✅ ツール選択完了: ${toolName}`);
        } catch (error) {
            console.error(`❌ ツール選択エラー (${toolName}):`, error);
        }
    }

    // === ツール変更ハンドラー ===
    handleToolChange(toolData) {
        try {
            this.updateToolUI(toolData.tool);
            this.updateStatusBar();
        } catch (error) {
            console.error('❌ ツール変更ハンドラーエラー:', error);
        }
    }

    // === ツールプロパティ更新 ===
    updateToolProperty(property, value) {
        if (!this.oglEngine) return;

        try {
            this.oglEngine.updateToolProperty(property, value);
        } catch (error) {
            console.error(`❌ ツールプロパティ更新エラー (${property}: ${value}):`, error);
        }
    }

    // === UI更新 ===
    updateToolUI(toolName) {
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(button => {
            if (button.dataset.tool === toolName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // コントロールパネルの表示切替
        document.querySelectorAll('.control-panel').forEach(panel => {
            panel.classList.remove('visible');
        });

        const controlPanel = document.getElementById(`${toolName}Controls`);
        if (controlPanel) {
            controlPanel.classList.add('visible');
        }
    }

    updateStatusBar() {
        try {
            const currentTool = this.oglEngine ? this.oglEngine.getCurrentTool() : null;
            const toolSettings = this.oglEngine ? this.oglEngine.getCurrentToolSettings() : {};

            // ツール名
            const statusTool = document.getElementById('statusTool');
            if (statusTool) {
                statusTool.textContent = currentTool === 'pen' ? 'ペン' : 
                                        currentTool === 'eraser' ? '消しゴム' : currentTool || 'なし';
            }

            // サイズ
            const statusSize = document.getElementById('statusSize');
            if (statusSize) {
                statusSize.textContent = toolSettings.size || '3';
            }

            // 不透明度
            const statusOpacity = document.getElementById('statusOpacity');
            if (statusOpacity) {
                const opacity = toolSettings.opacity || 100;
                statusOpacity.textContent = `${opacity}%`;
            }

            // FPS（簡易実装）
            const statusFPS = document.getElementById('statusFPS');
            if (statusFPS) {
                statusFPS.textContent = '60';
            }
        } catch (error) {
            console.error('❌ ステータスバー更新エラー:', error);
        }
    }

    // === アクション ===
    clearCanvas() {
        if (!this.oglEngine) return;

        try {
            console.log('🗑️ キャンバスクリア');
            this.oglEngine.clearCanvas();
        } catch (error) {
            console.error('❌ キャンバスクリアエラー:', error);
        }
    }

    undo() {
        if (!this.oglEngine) return;

        try {
            console.log('↶ 取り消し');
            this.oglEngine.undo();
        } catch (error) {
            console.error('❌ 取り消しエラー:', error);
        }
    }

    // === エラー表示 ===
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #ff4444;
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
            font-size: 12px;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    // === 廃棄処理 ===
    dispose() {
        try {
            this.isInitialized = false;
            
            if (this.oglEngine) {
                this.oglEngine.dispose();
            }
            
            if (this.toolStore) {
                this.toolStore.dispose();
            }
            
            console.log('🧹 OGLDrawingApp廃棄完了');
        } catch (error) {
            console.error('❌ 廃棄処理エラー:', error);
        }
    }

    // === デバッグ用 ===
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentTool: this.oglEngine ? this.oglEngine.getCurrentTool() : null,
            engineReady: this.oglEngine ? this.oglEngine.isReady() : false,
            strokeCount: this.oglEngine ? this.oglEngine.getStrokeCount() : 0
        };
    }
}

// === アプリケーション起動 ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 OGL統一お絵かきツール起動...');
        window.oglApp = new OGLDrawingApp();
        
        // ページ離脱時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            if (window.oglApp) {
                window.oglApp.dispose();
            }
        });

        // デバッグ用グローバル関数
        window.getOGLAppStatus = () => {
            return window.oglApp ? window.oglApp.getStatus() : null;
        };
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
    }
});

// === グローバルエラーハンドリング ===
window.addEventListener('error', (e) => {
    console.error('🌐 グローバルエラー:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('🌐 未処理Promise拒否:', e.reason);
    e.preventDefault();
});