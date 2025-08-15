/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: キャンバス制御統括・PixiJS管理・リサイズ対応
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/utils/coordinates.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/app, @pixi/display
 * 🎯 PIXI_EXTENSIONS: Application、Container、Graphics統合
 * 🎯 ISOLATION_TEST: 可能（PixiJS単体テスト）
 * 🎯 SPLIT_THRESHOLD: 450行（キャンバス統括・分割慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: Application API変更、Renderer統合
 */

import { transformGlobalToLocal, transformLocalToGlobal } from '../utils/coordinates.js';

/**
 * キャンバス制御統合管理システム
 * 元HTMLのDrawingEngineを改良・統合
 * SOLID原則: 単一責任 - キャンバス・描画基盤管理のみ
 */
export class CanvasManager {
    constructor() {
        this.width = 400;
        this.height = 400;
        this.app = null;
        this.drawingContainer = null;
        this.backgroundContainer = null;
        this.paths = [];
        this.backgroundColor = 0xf0e0d6; // ふたばクリーム色
        this.isInitialized = false;
        
        // キャンバス設定
        this.canvasSettings = {
            antialias: true,
            resolution: 1, // 固定値（元HTML修正対応）
            autoDensity: false,
            powerPreference: 'high-performance', // GPU加速優先
            preserveDrawingBuffer: false,
            clearBeforeRender: true
        };
        
        console.log('🖼️ CanvasManager 構築開始...');
    }
    
    /**
     * キャンバス管理システム初期化
     * @param {string} containerId - DOM要素ID
     */
    async init(containerId = 'drawing-canvas') {
        console.log('🖼️ キャンバス初期化開始...');
        
        try {
            await this.createPixiApplication();
            this.setupContainers();
            this.attachToDOM(containerId);
            this.setupInteraction();
            this.isInitialized = true;
            
            console.log('✅ CanvasManager初期化完了');
            console.log(`📐 キャンバスサイズ: ${this.width}×${this.height}px`);
            console.log(`🎨 背景色: #${this.backgroundColor.toString(16).padStart(6, '0')}`);
            
            return this.app;
        } catch (error) {
            console.error('❌ キャンバス初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * PixiJS Application作成
     */
    async createPixiApplication() {
        // v7対応の設定
        const appConfig = {
            width: this.width,
            height: this.height,
            backgroundColor: this.backgroundColor,
            ...this.canvasSettings
        };
        
        // v8移行準備: Application設定変更
        // v8: background instead of backgroundColor
        // v8: new Application().init(config) pattern
        
        this.app = new PIXI.Application(appConfig);
        
        // GPU情報取得（パフォーマンス監視用）
        if (this.app.renderer && this.app.renderer.gl) {
            const gl = this.app.renderer.gl;
            console.log('🚀 GPU情報:', {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION)
            });
        }
        
        return this.app;
    }
    
    /**
     * コンテナ階層セットアップ
     */
    setupContainers() {
        // 背景レイヤー
        this.backgroundContainer = new PIXI.Container();
        this.backgroundContainer.name = 'background';
        this.backgroundContainer.sortableChildren = false;
        
        // 描画レイヤー
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing';
        this.drawingContainer.sortableChildren = true; // Z-order対応
        
        // レイヤー追加
        this.app.stage.addChild(this.backgroundContainer);
        this.app.stage.addChild(this.drawingContainer);
        
        // v8移行準備: Container APIの変更対応
        // v8: addChild → addChildAt または専用メソッド使用予定
        
        console.log('📚 コンテナ階層セットアップ完了');
    }
    
    /**
     * DOM要素に接続
     * @param {string} containerId - 接続先DOM要素ID
     */
    attachToDOM(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`DOM要素が見つかりません: ${containerId}`);
        }
        
        // 既存のcanvasをクリア
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // PixiJSキャンバスを追加
        container.appendChild(this.app.view);
        
        console.log(`🔗 DOM接続完了: ${containerId}`);
    }
    
    /**
     * インタラクション設定
     */
    setupInteraction() {
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        console.log('👆 インタラクション設定完了');
    }
    
    /**
     * ローカル座標取得（元HTMLのgetLocalPointerPosition統合）
     * @param {Object} event - PointerEventまたはPixiJS InteractionEvent
     */
    getLocalPointerPosition(event) {
        const rect = this.app.view.getBoundingClientRect();
        let clientX, clientY;
        
        // イベント形式の判定・統一
        if (event.data && event.data.originalEvent) {
            // PixiJS InteractionEvent
            const originalEvent = event.data.originalEvent;
            clientX = originalEvent.clientX;
            clientY = originalEvent.clientY;
        } else if (event.clientX !== undefined) {
            // 直接のPointerEvent
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            console.warn('⚠️ 不明なイベント形式');
            return { x: 0, y: 0 };
        }
        
        // 座標変換実行
        return transformGlobalToLocal(
            clientX, clientY, 
            rect, 
            this.width, this.height
        );
    }
    
    /**
     * グローバル座標取得
     * @param {number} localX - ローカルX座標
     * @param {number} localY - ローカルY座標
     */
    getGlobalPointerPosition(localX, localY) {
        const rect = this.app.view.getBoundingClientRect();
        return transformLocalToGlobal(
            localX, localY,
            rect,
            this.width, this.height
        );
    }
    
    /**
     * パス作成
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} size - ブラシサイズ
     * @param {number} color - 色
     * @param {number} opacity - 不透明度
     * @param {string} tool - ツール種類
     */
    createPath(x, y, size, color, opacity, tool = 'pen') {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool === 'eraser' ? this.backgroundColor : color,
            size: size,
            opacity: tool === 'eraser' ? 1.0 : opacity,
            tool: tool,
            isComplete: false,
            timestamp: Date.now()
        };
        
        // 初回描画: 円形ブラシで点を描画（元HTML方式維持）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        // v8移行準備コメント
        // v8: path.graphics.circle(x, y, size / 2).fill({ color: path.color, alpha: path.opacity });
        
        path.points.push({ x, y, size, timestamp: Date.now() });
        
        // Z-orderの設定（新しいパスを前面に）
        path.graphics.zIndex = this.paths.length;
        
        this.drawingContainer.addChild(path.graphics);
        this.paths.push(path);
        
        console.log(`✏️ パス作成: ${tool} - ${path.id}`);
        return path;
    }
    
    /**
     * 線描画
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    drawLine(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ（元HTML同様）
        if (distance < 1.5) return;
        
        // 連続する円形で線を描画（元HTML方式維持）
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x, y, size: path.size, timestamp: Date.now() });
    }
    
    /**
     * キャンバスリサイズ（元HTMLのresize統合）
     * @param {number} newWidth - 新しい幅
     * @param {number} newHeight - 新しい高さ
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    resize(newWidth, newHeight, centerContent = false) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = newWidth;
        this.height = newHeight;
        
        // PixiJSアプリケーションリサイズ
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // 中央寄せ処理
        if (centerContent && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.paths.forEach(path => {
                path.graphics.x += offsetX;
                path.graphics.y += offsetY;
            });
        }
        
        console.log(`📐 キャンバスリサイズ: ${oldWidth}×${oldHeight} → ${newWidth}×${newHeight}`);
        console.log(`🎯 中央寄せ: ${centerContent ? '有効' : '無効'}`);
    }
    
    /**
     * キャンバスクリア
     */
    clear() {
        this.paths.forEach(path => {
            this.drawingContainer.removeChild(path.graphics);
            path.graphics.destroy();
        });
        this.paths = [];
        
        console.log('🧹 キャンバスクリア完了');
    }
    
    /**
     * 背景色変更
     * @param {number} color - 新しい背景色
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this.app.renderer.backgroundColor = color;
        
        // v8移行準備
        // v8: this.app.renderer.background = color;
        
        console.log(`🎨 背景色変更: #${color.toString(16).padStart(6, '0')}`);
    }
    
    /**
     * パフォーマンス情報取得
     */
    getPerformanceInfo() {
        return {
            pathCount: this.paths.length,
            totalPoints: this.paths.reduce((total, path) => total + path.points.length, 0),
            canvasSize: `${this.width}×${this.height}`,
            memoryUsage: this.app.renderer.gl ? 
                this.app.renderer.gl.getParameter(this.app.renderer.gl.MAX_TEXTURE_SIZE) : 'N/A'
        };
    }
    
    /**
     * キャンバス状態取得
     */
    getCanvasState() {
        return {
            width: this.width,
            height: this.height,
            backgroundColor: this.backgroundColor,
            pathCount: this.paths.length,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        if (this.app) {
            this.clear();
            this.app.destroy(true, { children: true, texture: true, baseTexture: true });
            this.app = null;
        }
        this.isInitialized = false;
        console.log('🗑️ CanvasManager破棄完了');
    }
}

export default CanvasManager;