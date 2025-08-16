/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: キャンバス制御・PixiJS Application管理
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js (Pure JavaScript)
 * 🎯 NODE_MODULES: pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: PixiJS基盤・レンダリング統合
 * 🎯 ISOLATION_TEST: 可能（単体キャンバス機能）
 * 🎯 SPLIT_THRESHOLD: 400行（キャンバス制御・分割慎重）
 * 📋 PHASE_TARGET: Phase1.1ss3 - Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: Application.init() 対応予定
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 */

/**
 * キャンバス管理システム
 * 元HTMLのDrawingEngineを基にしたPixiJS統合改良版
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class CanvasManager {
    constructor() {
        this.width = 400;
        this.height = 400;
        this.app = null;
        this.drawingContainer = null;
        this.paths = [];
        this.backgroundColor = 0xf0e0d6;
        this.isInitialized = false;
        
        console.log('🎨 CanvasManager 構築開始（Pure JavaScript）...');
    }
    
    /**
     * キャンバス管理システム初期化
     * @param {string} containerId - キャンバスコンテナID
     */
    async init(containerId) {
        try {
            console.log('🔧 PixiJS Application初期化開始...');
            
            // PixiJS Application作成（v7方式）
            this.app = new PIXI.Application({
                width: this.width,
                height: this.height,
                backgroundColor: this.backgroundColor,
                antialias: true,
                resolution: 1, // 固定値（デバイス依存排除）
                autoDensity: false // 無効化
            });
            
            // コンテナに追加
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`キャンバスコンテナが見つかりません: ${containerId}`);
            }
            
            container.appendChild(this.app.view);
            
            // 描画用コンテナ作成
            this.drawingContainer = new PIXI.Container();
            this.app.stage.addChild(this.drawingContainer);
            
            // インタラクション設定
            this.setupInteraction();
            
            this.isInitialized = true;
            console.log('✅ PixiJS Application初期化完了');
            
            return this.app;
            
        } catch (error) {
            console.error('❌ キャンバス初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * インタラクション設定
     */
    setupInteraction() {
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        console.log('✅ インタラクション設定完了');
    }
    
    /**
     * ローカルポインター位置取得
     * @param {PIXI.InteractionEvent} event - PIXIイベント
     * @returns {Object} 座標オブジェクト
     */
    getLocalPointerPosition(event) {
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data.originalEvent;
        const x = (originalEvent.clientX - rect.left) * (this.width / rect.width);
        const y = (originalEvent.clientY - rect.top) * (this.height / rect.height);
        return { x, y };
    }
    
    /**
     * パス作成（描画開始）
     * 元HTMLのcreatePathメソッドを改良
     * @param {number} x - X座標
     * @param {number} y - Y座標 
     * @param {number} size - ブラシサイズ
     * @param {number} color - 色（16進数）
     * @param {number} opacity - 不透明度
     * @param {string} tool - ツール種類
     * @returns {Object} パスオブジェクト
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
            isComplete: false
        };
        
        // 初回描画: 円形ブラシで点を描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size });
        
        this.drawingContainer.addChild(path.graphics);
        this.paths.push(path);
        
        console.log(`✏️ パス作成: ${path.id} (${tool})`);
        return path;
    }
    
    /**
     * 線描画（描画継続）
     * 元HTMLのdrawLineメソッドを改良
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
        
        // 連続する円形で線を描画
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    /**
     * キャンバスリサイズ
     * 元HTMLのresizeメソッドを改良
     * @param {number} newWidth - 新しい幅
     * @param {number} newHeight - 新しい高さ
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    resize(newWidth, newHeight, centerContent = false) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this