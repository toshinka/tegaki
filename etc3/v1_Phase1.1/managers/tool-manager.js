/**
 * 🛠️ ToolManager - ツール系統括制御（緊急修正版）
 * 責務:
 * - ツール切替管理
 * - 描画イベント処理
 * - ブラシ設定管理
 * - ショートカット処理
 * 
 * 🚨 緊急修正内容:
 * - drawing-tools.jsとの競合回避
 * - 最小限機能での動作保証
 * - エラーハンドリング強化
 */

class ToolManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.currentTool = 'pen';
        this.brushSize = 5;
        this.brushColor = '#800000';
        this.tools = new Map();
        this.isInitialized = false;
        this.isDrawing = false;
        this.currentPath = null;
    }
    
    async init() {
        try {
            console.log('🛠️ ToolManager 初期化開始（緊急修正版）...');
            
            await this.setupTools();
            await this.setupShortcuts();
            await this.setupDrawingEvents();
            
            this.isInitialized = true;
            console.log('🛠️ ToolManager 初期化完了');
            
        } catch (error) {
            console.error('❌ ToolManager 初期化失敗:', error);
            // エラーでも基本機能は提供
            await this.setupMinimalTools();
            this.isInitialized = true;
        }
    }
    
    async setupTools() {
        try {
            // 基本ツール定義
            this.tools.set('pen', {
                name: 'pen',
                cursor: 'crosshair',
                color: this.brushColor,
                size: this.brushSize
            });
            
            this.tools.set('eraser', {
                name: 'eraser',
                cursor: 'crosshair',
                color: '#FFFFFF', // 背景色で消去
                size: this.brushSize * 2
            });
            
            console.log('✅ ツール設定完了:', Array.from(this.tools.keys()));
            
        } catch (error) {
            console.error('❌ ツール設定失敗:', error);
        }
    }
    
    async setupMinimalTools() {
        console.log('🔧 最小限ツール設定...');
        
        // 最低限の機能のみ
        this.tools.set('pen', { name: 'pen', cursor: 'crosshair' });
        this.currentTool = 'pen';
        
        console.log('✅ 最小限ツール設定完了');
    }
    
    async setupShortcuts() {
        try {
            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return; // 入力フィールドでは無視
                }
                
                switch(e.key.toLowerCase()) {
                    case 'p':
                    case 'b':
                        e.preventDefault();
                        this.setTool('pen');
                        break;
                    case 'e':
                        e.preventDefault();
                        this.setTool('eraser');
                        break;
                    case 'escape':
                        e.preventDefault();
                        this.clearCanvas();
                        break;
                }
            });
            
            console.log('⌨️ ショートカット設定完了');
            
        } catch (error) {
            console.error('❌ ショートカット設定失敗:', error);
        }
    }
    
    async setupDrawingEvents() {
        try {
            if (!this.appCore.app || !this.appCore.stage) {
                console.warn('⚠️ PixiJS未初期化 - 描画イベント設定スキップ');
                return;
            }
            
            // 描画レイヤー作成
            this.drawingLayer = new PIXI.Container();
            this.drawingLayer.interactive = true;
            this.appCore.stage.addChild(this.drawingLayer);
            
            // マウス/タッチイベント
            this.drawingLayer.on('pointerdown', this.onPointerDown.bind(this));
            this.drawingLayer.on('pointermove', this.onPointerMove.bind(this));
            this.drawingLayer.on('pointerup', this.onPointerUp.bind(this));
            this.drawingLayer.on('pointerupoutside', this.onPointerUp.bind(this));
            
            console.log('🎨 描画イベント設定完了');
            
        } catch (error) {
            console.error('❌ 描画イベント設定失敗:', error);
        }
    }
    
    onPointerDown(event) {
        try {
            this.isDrawing = true;
            const pos = event.data.global;
            
            // 新しいパス作成
            this.currentPath = new PIXI.Graphics();
            const tool = this.tools.get(this.currentTool);
            
            if (tool) {
                const color = tool.color === '#FFFFFF' ? 0xFFFFFF : 0x800000;
                const size = tool.size || this.brushSize;
                
                this.currentPath.lineStyle(size, color, 1);
                this.currentPath.moveTo(pos.x, pos.y);
            }
            
            this.drawingLayer.addChild(this.currentPath);
            
        } catch (error) {
            console.error('❌ 描画開始エラー:', error);
        }
    }
    
    onPointerMove(event) {
        try {
            if (!this.isDrawing || !this.currentPath) return;
            
            const pos = event.data.global;
            this.currentPath.lineTo(pos.x, pos.y);
            
        } catch (error) {
            console.error('❌ 描画移動エラー:', error);
        }
    }
    
    onPointerUp(event) {
        try {
            this.isDrawing = false;
            this.currentPath = null;
            
            // メモリマネージャーがあれば履歴保存
            const memoryManager = this.appCore.getManager('memory');
            if (memoryManager && typeof memoryManager.saveState === 'function') {
                memoryManager.saveState();
            }
            
        } catch (error) {
            console.error('❌ 描画終了エラー:', error);
        }
    }
    
    setTool(toolName) {
        try {
            if (this.tools.has(toolName)) {
                this.currentTool = toolName;
                const tool = this.tools.get(toolName);
                
                // カーソル変更
                if (this.appCore.app && this.appCore.app.view) {
                    this.appCore.app.view.style.cursor = tool.cursor || 'crosshair';
                }
                
                // UI更新
                const uiManager = this.appCore.getManager('ui');
                if (uiManager && typeof uiManager.updateCurrentTool === 'function') {
                    uiManager.updateCurrentTool(toolName);
                }
                
                console.log(`🔄 ツール変更: ${toolName}`);
                return true;
            }
            
            console.warn(`⚠️ 未知のツール: ${toolName}`);
            return false;
            
        } catch (error) {
            console.error('❌ ツール切替エラー:', error);
            return false;
        }
    }
    
    setBrushSize(size) {
        try {
            this.brushSize = Math.max(1, Math.min(100, size));
            
            // 現在のツールのサイズも更新
            if (this.tools.has(this.currentTool)) {
                const tool = this.tools.get(this.currentTool);
                tool.size = this.brushSize;
            }
            
            console.log(`🖌️ ブラシサイズ: ${this.brushSize}`);
            return this.brushSize;
            
        } catch (error) {
            console.error('❌ ブラシサイズ設定エラー:', error);
            return this.brushSize;
        }
    }
    
    setBrushColor(color) {
        try {
            this.brushColor = color;
            
            // ペンツールのカラー更新
            if (this.tools.has('pen')) {
                const penTool = this.tools.get('pen');
                penTool.color = color;
            }
            
            console.log(`🎨 ブラシカラー: ${color}`);
            
        } catch (error) {
            console.error('❌ ブラシカラー設定エラー:', error);
        }
    }
    
    clearCanvas() {
        try {
            if (this.drawingLayer) {
                this.drawingLayer.removeChildren();
                console.log('🧹 キャンバスクリア完了');
                
                // メモリマネージャーがあれば履歴保存
                const memoryManager = this.appCore.getManager('memory');
                if (memoryManager && typeof memoryManager.saveState === 'function') {
                    memoryManager.saveState();
                }
            }
        } catch (error) {
            console.error('❌ キャンバスクリアエラー:', error);
        }
    }
    
    getCurrentTool() {
        return this.currentTool;
    }
    
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    getBrushSize() {
        return this.brushSize;
    }
    
    getBrushColor() {
        return this.brushColor;
    }
    
    // デバッグ/統計情報
    getStats() {
        try {
            return {
                initialized: this.isInitialized,
                currentTool: this.currentTool,
                brushSize: this.brushSize,
                brushColor: this.brushColor,
                availableTools: this.getAvailableTools(),
                isDrawing: this.isDrawing,
                drawingLayerChildren: this.drawingLayer ? this.drawingLayer.children.length : 0
            };
        } catch (error) {
            console.error('❌ 統計取得エラー:', error);
            return { error: error.message };
        }
    }
    
    // drawing-tools.jsとの互換性のためのメソッド
    setActiveTool(toolName) {
        return this.setTool(toolName);
    }
    
    getActiveTool() {
        return this.tools.get(this.currentTool);
    }
    
    // 緊急診断
    diagnose() {
        console.group('🔍 ToolManager 診断');
        
        try {
            console.log('基本状態:', {
                initialized: this.isInitialized,
                currentTool: this.currentTool,
                toolCount: this.tools.size,
                hasDrawingLayer: !!this.drawingLayer
            });
            
            console.log('利用可能ツール:');
            this.tools.forEach((tool, name) => {
                console.log(`  ${name}:`, tool);
            });
            
            console.log('描画状態:', {
                isDrawing: this.isDrawing,
                hasCurrentPath: !!this.currentPath,
                layerChildren: this.drawingLayer?.children.length || 0
            });
            
            console.log('設定:', {
                brushSize: this.brushSize,
                brushColor: this.brushColor
            });
            
        } catch (error) {
            console.error('診断エラー:', error);
        }
        
        console.groupEnd();
    }
}