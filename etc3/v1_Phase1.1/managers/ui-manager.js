/**
 * 🎨 UIManager - UI系統括制御（緊急修正版）
 * 責務: 
 * - ツールボタン制御
 * - スライダー制御
 * - ステータス表示
 * - UI更新管理
 * 
 * 🚨 緊急修正内容:
 * - @pixi/ui依存関係の安全化
 * - HTMLフォールバック実装
 * - エラーハンドリング強化
 */

class UIManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.uiContainer = null;
        this.htmlUI = null;
        this.isInitialized = false;
        this.buttons = new Map();
        this.sliders = new Map();
    }
    
    async init() {
        try {
            console.log('🎨 UIManager 初期化開始（緊急修正版）...');
            
            // 利用可能なUI方式を決定
            const uiMethod = this.determineUIMethod();
            console.log(`UI方式: ${uiMethod}`);
            
            switch (uiMethod) {
                case 'pixi-ui':
                    await this.setupPixiUI();
                    break;
                case 'html-overlay':
                    await this.setupHTMLUI();
                    break;
                case 'minimal':
                default:
                    await this.setupMinimalUI();
                    break;
            }
            
            this.isInitialized = true;
            console.log('🎨 UIManager 初期化完了');
            
        } catch (error) {
            console.error('❌ UIManager 初期化失敗:', error);
            // フォールバックUI作成
            await this.setupMinimalUI();
            this.isInitialized = true;
        }
    }
    
    determineUIMethod() {
        try {
            // @pixi/ui が完全に利用可能か確認
            if (this.extensions.isAvailable('UI') && 
                typeof PIXI !== 'undefined' && 
                PIXI.UI && 
                PIXI.UI.Button) {
                return 'pixi-ui';
            }
            
            // PixiJS が利用可能ならHTML オーバーレイ
            if (typeof PIXI !== 'undefined' && this.appCore.app) {
                return 'html-overlay';
            }
            
            // 最小限のUI
            return 'minimal';
            
        } catch (error) {
            console.error('❌ UI方式決定エラー:', error);
            return 'minimal';
        }
    }
    
    async setupPixiUI() {
        try {
            console.log('🚀 @pixi/ui セットアップ開始...');
            
            this.uiContainer = new PIXI.Container();
            
            // ツールボタン作成
            await this.createPixiToolButtons();
            
            // スライダー作成
            await this.createPixiSliders();
            
            this.appCore.stage.addChild(this.uiContainer);
            
            console.log('✅ @pixi/ui セットアップ完了');
            
        } catch (error) {
            console.error('❌ @pixi/ui セットアップ失敗:', error);
            throw error;
        }
    }
    
    async setupHTMLUI() {
        try {
            console.log('🌐 HTML UI セットアップ開始...');
            
            this.createHTMLUIOverlay();
            this.createHTMLToolButtons();
            this.createHTMLSliders();
            this.createHTMLStatus();
            
            console.log('✅ HTML UI セットアップ完了');
            
        } catch (error) {
            console.error('❌ HTML UI セットアップ失敗:', error);
            throw error;
        }
    }
    
    async setupMinimalUI() {
        try {
            console.log('⚡ 最小UI セットアップ開始...');
            
            // 最小限のHTMLボタンのみ
            this.createMinimalHTMLUI();
            
            console.log('✅ 最小UI セットアップ完了');
            
        } catch (error) {
            console.error('❌ 最小UI セットアップ失敗:', error);
        }
    }
    
    async createPixiToolButtons() {
        try {
            const buttonConfig = [
                { id: 'pen', label: 'ペン', x: 10, y: 10 },
                { id: 'eraser', label: '消しゴム', x: 100, y: 10 }
            ];
            
            for (const config of buttonConfig) {
                const button = new PIXI.UI.Button({
                    text: config.label,
                    onClick: () => this.onToolButtonClick(config.id)
                });
                
                button.x = config.x;
                button.y = config.y;
                
                this.uiContainer.addChild(button);
                this.buttons.set(config.id, button);
            }
            
        } catch (error) {
            console.error('❌ Pixiツールボタン作成失敗:', error);
            throw error;
        }
    }
    
    async createPixiSliders() {
        try {
            // ブラシサイズスライダー
            const sizeSlider = new PIXI.UI.Slider({
                min: 1,
                max: 50,
                value: 5,
                onChange: (value) => this.onBrushSizeChange(value)
            });
            
            sizeSlider.x = 10;
            sizeSlider.y = 60;
            
            this.uiContainer.addChild(sizeSlider);
            this.sliders.set('brushSize', sizeSlider);
            
        } catch (error) {
            console.error('❌ Pixiスライダー作成失敗:', error);
            throw error;
        }
    }
    
    createHTMLUIOverlay() {
        try {
            // HTMLオーバーレイ作成
            this.htmlUI = document.createElement('div');
            this.htmlUI.id = 'tegaki-ui-overlay';
            this.htmlUI.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 1000;
                pointer-events: none;
                font-family: Arial, sans-serif;
                user-select: none;
            `;
            
            document.body.appendChild(this.htmlUI);
            
        } catch (error) {
            console.error('❌ HTMLオーバーレイ作成失敗:', error);
            throw error;
        }
    }
    
    createHTMLToolButtons() {
        try {
            const toolsContainer = document.createElement('div');
            toolsContainer.style.cssText = `
                pointer-events: auto;
                display: flex;
                gap: 5px;
                margin-bottom: 10px;
            `;
            
            const tools = [
                { id: 'pen', label: '🖊️', title: 'ペンツール (P)' },
                { id: 'eraser', label: '🧽', title: '消しゴム (E)' }
            ];
            
            tools.forEach(tool => {
                const button = document.createElement('button');
                button.id = `tool-${tool.id}`;
                button.innerHTML = tool.label;
                button.title = tool.title;
                button.style.cssText = `
                    padding: 8px 12px;
                    border: 2px solid #800000;
                    background: white;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 16px;
                `;
                
                button.addEventListener('click', () => this.onToolButtonClick(tool.id));
                
                toolsContainer.appendChild(button);
                this.buttons.set(tool.id, button);
            });
            
            this.htmlUI.appendChild(toolsContainer);
            
        } catch (error) {
            console.error('❌ HTMLツールボタン作成失敗:', error);
            throw error;
        }
    }
    
    createHTMLSliders() {
        try {
            const slidersContainer = document.createElement('div');
            slidersContainer.style.cssText = `
                pointer-events: auto;
                background: rgba(255,255,255,0.9);
                padding: 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
            `;
            
            // ブラシサイズスライダー
            const sizeLabel = document.createElement('label');
            sizeLabel.textContent = 'サイズ: ';
            sizeLabel.style.cssText = `
                display: block;
                margin-bottom: 5px;
                font-size: 12px;
                color: #333;
            `;
            
            const sizeSlider = document.createElement('input');
            sizeSlider.type = 'range';
            sizeSlider.min = '1';
            sizeSlider.max = '50';
            sizeSlider.value = '5';
            sizeSlider.id = 'brush-size-slider';
            sizeSlider.style.cssText = `
                width: 100px;
                margin-right: 10px;
            `;
            
            const sizeValue = document.createElement('span');
            sizeValue.id = 'brush-size-value';
            sizeValue.textContent = '5px';
            sizeValue.style.cssText = `
                font-size: 12px;
                color: #666;
            `;
            
            sizeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                sizeValue.textContent = `${value}px`;
                this.onBrushSizeChange(value);
            });
            
            sizeLabel.appendChild(sizeSlider);
            sizeLabel.appendChild(sizeValue);
            slidersContainer.appendChild(sizeLabel);
            
            this.htmlUI.appendChild(slidersContainer);
            this.sliders.set('brushSize', sizeSlider);
            
        } catch (error) {
            console.error('❌ HTMLスライダー作成失敗:', error);
            throw error;
        }
    }
    
    createHTMLStatus() {
        try {
            const statusContainer = document.createElement('div');
            statusContainer.id = 'tegaki-status';
            statusContainer.style.cssText = `
                pointer-events: none;
                margin-top: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 11px;
                min-height: 20px;
            `;
            
            statusContainer.innerHTML = `
                現在のツール: <span id="current-tool">ペン</span> | 
                サイズ: <span id="current-size">5px</span>
            `;
            
            this.htmlUI.appendChild(statusContainer);
            
        } catch (error) {
            console.error('❌ HTMLステータス作成失敗:', error);
        }
    }
    
    createMinimalHTMLUI() {
        try {
            // 画面右上に最小限のボタンを配置
            const minimalUI = document.createElement('div');
            minimalUI.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
                display: flex;
                gap: 5px;
            `;
            
            const tools = [
                { id: 'pen', text: 'P', title: 'ペン' },
                { id: 'eraser', text: 'E', title: '消しゴム' },
                { id: 'clear', text: '✕', title: 'クリア' }
            ];
            
            tools.forEach(tool => {
                const btn = document.createElement('button');
                btn.textContent = tool.text;
                btn.title = tool.title;
                btn.style.cssText = `
                    width: 30px;
                    height: 30px;
                    border: 1px solid #800000;
                    background: white;
                    cursor: pointer;
                    border-radius: 3px;
                    font-weight: bold;
                    font-size: 12px;
                `;
                
                btn.addEventListener('click', () => {
                    if (tool.id === 'clear') {
                        this.clearCanvas();
                    } else {
                        this.onToolButtonClick(tool.id);
                    }
                });
                
                minimalUI.appendChild(btn);
                this.buttons.set(tool.id, btn);
            });
            
            document.body.appendChild(minimalUI);
            this.htmlUI = minimalUI;
            
        } catch (error) {
            console.error('❌ 最小UI作成失敗:', error);
        }
    }
    
    // イベントハンドラー
    onToolButtonClick(toolId) {
        try {
            const toolManager = this.appCore.getManager('tool');
            if (toolManager && typeof toolManager.setTool === 'function') {
                toolManager.setTool(toolId);
                this.updateCurrentTool(toolId);
            } else {
                console.warn('⚠️ ToolManager が利用できません');
            }
        } catch (error) {
            console.error('❌ ツールボタンクリックエラー:', error);
        }
    }
    
    onBrushSizeChange(size) {
        try {
            const toolManager = this.appCore.getManager('tool');
            if (toolManager && typeof toolManager.setBrushSize === 'function') {
                toolManager.setBrushSize(size);
                this.updateBrushSizeDisplay(size);
            } else {
                console.warn('⚠️ ToolManager が利用できません');
            }
        } catch (error) {
            console.error('❌ ブラシサイズ変更エラー:', error);
        }
    }
    
    clearCanvas() {
        try {
            const toolManager = this.appCore.getManager('tool');
            if (toolManager && typeof toolManager.clearCanvas === 'function') {
                toolManager.clearCanvas();
            } else if (window.minimalDrawing && window.minimalDrawing.clear) {
                // フォールバック描画システム
                window.minimalDrawing.clear();
            } else {
                console.warn('⚠️ キャンバスクリア機能が利用できません');
            }
        } catch (error) {
            console.error('❌ キャンバスクリアエラー:', error);
        }
    }
    
    // UI更新メソッド
    updateCurrentTool(toolName) {
        try {
            // ボタンの状態更新
            this.buttons.forEach((button, buttonId) => {
                if (button.style) {
                    // HTML button
                    if (buttonId === toolName) {
                        button.style.background = '#800000';
                        button.style.color = 'white';
                    } else if (buttonId !== 'clear') {
                        button.style.background = 'white';
                        button.style.color = 'black';
                    }
                }
            });
            
            // ステータス表示更新
            const currentToolElement = document.getElementById('current-tool');
            if (currentToolElement) {
                const toolNames = { pen: 'ペン', eraser: '消しゴム' };
                currentToolElement.textContent = toolNames[toolName] || toolName;
            }
            
            console.log(`🔄 UI更新: 現在のツール = ${toolName}`);
            
        } catch (error) {
            console.error('❌ ツールUI更新エラー:', error);
        }
    }
    
    updateBrushSizeDisplay(size) {
        try {
            // サイズ表示更新
            const sizeElement = document.getElementById('current-size');
            if (sizeElement) {
                sizeElement.textContent = `${size}px`;
            }
            
            const sizeValueElement = document.getElementById('brush-size-value');
            if (sizeValueElement) {
                sizeValueElement.textContent = `${size}px`;
            }
            
        } catch (error) {
            console.error('❌ ブラシサイズ表示更新エラー:', error);
        }
    }
    
    showMessage(message, type = 'info', duration = 3000) {
        try {
            // 一時的なメッセージ表示
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                position: fixed;
                top: 50px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                padding: 10px 20px;
                border-radius: 4px;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 14px;
                background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, duration);
            
        } catch (error) {
            console.error('❌ メッセージ表示エラー:', error);
        }
    }
    
    // 統計・デバッグ情報
    getStats() {
        try {
            return {
                initialized: this.isInitialized,
                uiMethod: this.htmlUI ? 'html' : (this.uiContainer ? 'pixi' : 'none'),
                buttonCount: this.buttons.size,
                sliderCount: this.sliders.size,
                hasContainer: !!this.uiContainer,
                hasHTMLUI: !!this.htmlUI
            };
        } catch (error) {
            console.error('❌ UI統計取得エラー:', error);
            return { error: error.message };
        }
    }
    
    // 緊急診断
    diagnose() {
        console.group('🔍 UIManager 診断');
        
        try {
            console.log('基本状態:', {
                initialized: this.isInitialized,
                hasPixiContainer: !!this.uiContainer,
                hasHTMLUI: !!this.htmlUI
            });
            
            console.log('UI要素数:', {
                buttons: this.buttons.size,
                sliders: this.sliders.size
            });
            
            console.log('拡張機能状態:', {
                pixiUI: this.extensions.isAvailable('UI'),
                pixi: typeof PIXI !== 'undefined'
            });
            
            console.log('DOM要素:');
            this.buttons.forEach((button, id) => {
                console.log(`  ${id}:`, button.tagName || 'PIXI Object');
            });
            
        } catch (error) {
            console.error('診断エラー:', error);
        }
        
        console.groupEnd();
    }
    
    // クリーンアップ
    destroy() {
        try {
            // HTMLUI削除
            if (this.htmlUI && this.htmlUI.parentNode) {
                this.htmlUI.parentNode.removeChild(this.htmlUI);
            }
            
            // PixiUIコンテナ削除
            if (this.uiContainer && this.uiContainer.parent) {
                this.uiContainer.parent.removeChild(this.uiContainer);
            }
            
            // 参照クリア
            this.buttons.clear();
            this.sliders.clear();
            this.uiContainer = null;
            this.htmlUI = null;
            
            console.log('🧹 UIManager クリーンアップ完了');
            
        } catch (error) {
            console.error('❌ UIManager クリーンアップエラー:', error);
        }
    }
}