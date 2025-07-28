// src/main.js

import { ServiceContainer } from './core/ServiceContainer.js';
import { ToolEngineController } from './engine/ToolEngineController.js';
import { BezierCalculationEngine } from './engine/BezierCalculationEngine.js';
import { OGLRenderingEngine } from './engine/OGLRenderingEngine.js';
import { ToolStore } from './features/tools/ToolStore.js';
import { ToolPanel } from './features/tools/ToolPanel.js';

class App {
    constructor() {
        this.serviceContainer = new ServiceContainer();
        this.toolEngineController = null;
        this.toolStore = null;
        this.toolPanel = null;
        this.isInitialized = false;
        
        this.setupDependencies();
        this.initialize();
    }

    setupDependencies() {
        // 専門エンジンをDIコンテナに登録
        this.serviceContainer.register('BezierCalculationEngine', () => new BezierCalculationEngine());
        this.serviceContainer.register('OGLRenderingEngine', () => new OGLRenderingEngine());
        
        // 制御エンジンを登録（専門エンジンに依存）
        this.serviceContainer.register('ToolEngineController', () => new ToolEngineController(this.serviceContainer));
        
        // ToolStoreを登録
        this.serviceContainer.register('ToolStore', (container) => new ToolStore(container));
    }

    async initialize() {
        try {
            // キャンバス要素の存在確認
            const canvas = document.getElementById('vector-canvas');
            if (!canvas) {
                throw new Error('Canvas element with id "vector-canvas" not found');
            }

            console.log('Initializing engines...');

            // サービスを順序立てて解決
            this.toolEngineController = this.serviceContainer.resolve('ToolEngineController');
            this.toolStore = this.serviceContainer.resolve('ToolStore');

            console.log('Services resolved successfully');

            // UIを初期化（ToolStoreやToolPanelは任意のため、存在する場合のみ）
            try {
                this.toolPanel = new ToolPanel(this.serviceContainer);
                console.log('UI initialized');
            } catch (error) {
                console.warn('UI initialization failed, continuing without UI:', error);
            }

            // イベントリスナーを設定（エンジン初期化前に設定）
            this.setupEventListeners();

            console.log('Event listeners set up');

            // デフォルトツールを選択（これによりエンジンが初期化される）
            console.log('Selecting default tool...');
            
            // ToolStoreを通さずに直接ToolEngineControllerでツール選択
            await this.toolEngineController.selectTool('pen');

            // 初期化完了フラグを設定
            this.isInitialized = true;
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    setupEventListeners() {
        const canvas = document.getElementById('vector-canvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        console.log('Setting up canvas event listeners...');

        // ポインターイベントの設定
        canvas.addEventListener('pointerdown', (e) => {
            if (!this.isInitialized) {
                console.warn('Application not fully initialized yet');
                return;
            }

            try {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const pressure = e.pressure || 1.0;
                
                console.log(`Starting stroke at (${x}, ${y}) with pressure ${pressure}`);
                
                // エンジンの準備状態を確認
                if (!this.toolEngineController.isReady()) {
                    console.warn('Tool engine controller not ready');
                    return;
                }
                
                this.toolEngineController.startStroke(x, y, pressure);
                e.preventDefault();
            } catch (error) {
                console.error('Error in pointerdown event:', error);
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!this.isInitialized || e.buttons === 0) return;
            
            try {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const pressure = e.pressure || 1.0;
                
                if (!this.toolEngineController.isReady()) return;
                
                this.toolEngineController.continueStroke(x, y, pressure);
                e.preventDefault();
            } catch (error) {
                console.error('Error in pointermove event:', error);
            }
        });

        canvas.addEventListener('pointerup', (e) => {
            if (!this.isInitialized) return;
            
            try {
                if (!this.toolEngineController.isReady()) return;
                
                console.log('Ending stroke');
                this.toolEngineController.endStroke();
                e.preventDefault();
            } catch (error) {
                console.error('Error in pointerup event:', error);
            }
        });
        
        canvas.addEventListener('pointerleave', (e) => {
            if (!this.isInitialized) return;
            
            try {
                if (!this.toolEngineController.isReady()) return;
                
                this.toolEngineController.endStroke();
            } catch (error) {
                console.error('Error in pointerleave event:', error);
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', async (e) => {
            if (!this.isInitialized) return;
            
            try {
                switch (e.key) {
                    case 'p':
                    case 'P':
                        if (e.ctrlKey || e.metaKey) return; // Ctrl+P は印刷なので除外
                        await this.toolEngineController.selectTool('pen');
                        e.preventDefault();
                        break;
                    case 'b':
                    case 'B':
                        await this.toolEngineController.selectTool('brush');
                        e.preventDefault();
                        break;
                    case 'e':
                    case 'E':
                        await this.toolEngineController.selectTool('eraser');
                        e.preventDefault();
                        break;
                    case 'Delete':
                    case 'Backspace':
                        if (e.ctrlKey || e.metaKey) {
                            this.toolEngineController.clearCanvas();
                            e.preventDefault();
                        }
                        break;
                }
            } catch (error) {
                console.error('Error in keydown event:', error);
            }
        });

        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            if (!this.isInitialized) return;
            
            try {
                this.handleResize();
            } catch (error) {
                console.error('Error in resize event:', error);
            }
        });

        // 右クリックメニューを無効化（キャンバス上でのみ）
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        console.log('Canvas event listeners set up successfully');
    }

    handleResize() {
        const canvas = document.getElementById('vector-canvas');
        if (!canvas || !this.toolEngineController) return;

        try {
            if (this.toolEngineController.renderingEngine && 
                this.toolEngineController.renderingEngine.isInitialized()) {
                const rect = canvas.getBoundingClientRect();
                this.toolEngineController.renderingEngine.resize(rect.width, rect.height);
                console.log(`Canvas resized to ${rect.width}x${rect.height}`);
            }
        } catch (error) {
            console.error('Error handling resize:', error);
        }
    }

    // エラー表示用のヘルパーメソッド
    showError(message) {
        // 簡単なエラー表示
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
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // 5秒後に自動で削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    // アプリケーション終了時のクリーンアップ
    dispose() {
        try {
            this.isInitialized = false;
            
            if (this.toolEngineController) {
                this.toolEngineController.disposeCurrentEngines();
            }
            
            if (this.toolStore && this.toolStore.clearListeners) {
                this.toolStore.clearListeners();
            }
            
            this.serviceContainer.clear();
            
            console.log('Application disposed');
        } catch (error) {
            console.error('Error disposing application:', error);
        }
    }

    // デバッグ用メソッド
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentTool: this.toolEngineController ? this.toolEngineController.getCurrentTool() : null,
            engineReady: this.toolEngineController ? this.toolEngineController.isReady() : false,
            renderingEngineStats: this.toolEngineController && this.toolEngineController.renderingEngine
                ? this.toolEngineController.renderingEngine.getStats()
                : null
        };
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Starting application...');
        window.app = new App();
        
        // ページ離脱時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            if (window.app) {
                window.app.dispose();
            }
        });

        // デバッグ用：アプリケーション状態をコンソールで確認可能にする
        window.getAppStatus = () => {
            return window.app ? window.app.getStatus() : null;
        };
        
    } catch (error) {
        console.error('Failed to start application:', error);
    }
});

// グローバルエラーハンドリング
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});