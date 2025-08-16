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
 * キャンバス管理システム（Pure JavaScript版）
 * 元HTMLのDrawingEngineを基にしたPixiJS統合改良版
 * ESM/TypeScript完全排除・グローバル公開方式
 */
class CanvasManager {
    constructor() {
        this.width = 400;
        this.height = 400;
        this.app = null;
        this.drawingContainer = null;
        this.backgroundContainer = null;
        this.paths = [];
        this.backgroundColor = 0xf0e0d6;
        this.isInitialized = false;
        this.canvasElement = null;
        
        // パフォーマンス監視
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        
        console.log('🎨 CanvasManager 構築開始（Pure JavaScript）...');
    }
    
    /**
     * キャンバス管理システム初期化
     * @param {string} containerId - キャンバスコンテナID
     */
    async init(containerId) {
        try {
            console.log('🔧 PixiJS Application初期化開始...');
            
            // PixiJS利用可能確認
            if (!window.PIXI) {
                throw new Error('PixiJS が読み込まれていません');
            }
            
            // PixiJS Application作成（v7方式）
            this.app = new PIXI.Application({
                width: this.width,
                height: this.height,
                backgroundColor: this.backgroundColor,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            
            // コンテナに追加
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`キャンバスコンテナが見つかりません: ${containerId}`);
            }
            
            // 既存内容をクリア
            container.innerHTML = '';
            container.appendChild(this.app.view);
            this.canvasElement = this.app.view;
            
            // レイヤー構造セットアップ
            this.setupLayers();
            
            // インタラクション設定
            this.setupInteraction();
            
            // 拡張ライブラリ統合
            this.integrateExtensions();
            
            this.isInitialized = true;
            console.log('✅ PixiJS Application初期化完了');
            console.log(`📊 キャンバス: ${this.width}×${this.height}px`);
            
            return this.app;
            
        } catch (error) {
            console.error('❌ キャンバス初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * レイヤー構造セットアップ
     */
    setupLayers() {
        // 背景レイヤー
        this.backgroundContainer = new PIXI.Container();
        this.backgroundContainer.name = 'background';
        this.app.stage.addChild(this.backgroundContainer);
        
        // 描画レイヤー（メイン）
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing';
        this.app.stage.addChild(this.drawingContainer);
        
        // 背景色表示
        const background = new PIXI.Graphics();
        background.beginFill(this.backgroundColor);
        background.drawRect(0, 0, this.width, this.height);
        background.endFill();
        this.backgroundContainer.addChild(background);
        
        console.log('✅ レイヤー構造セットアップ完了');
    }
    
    /**
     * インタラクション設定
     */
    setupInteraction() {
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        // カーソル設定
        this.app.stage.cursor = 'crosshair';
        
        console.log('✅ インタラクション設定完了');
    }
    
    /**
     * 拡張ライブラリ統合
     */
    integrateExtensions() {
        // @pixi/layers 統合（利用可能時）
        if (window.PixiExtensions?.hasFeature('layers')) {
            console.log('🔧 @pixi/layers統合中...');
            // 必要に応じてレイヤーシステム拡張
        }
        
        // その他拡張機能統合
        if (window.PixiExtensions) {
            const stats = window.PixiExtensions.getStats();
            console.log(`📊 拡張ライブラリ統合: ${stats.available}/${stats.total}`);
        }
    }
    
    /**
     * ローカルポインター位置取得
     * @param {PIXI.InteractionEvent} event - PIXIイベント
     * @returns {Object} 座標オブジェクト
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) {
            return { x: 0, y: 0 };
        }
        
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data.originalEvent;
        
        // スケール比率計算
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        
        const x = (originalEvent.clientX - rect.left) * scaleX;
        const y = (originalEvent.clientY - rect.top) * scaleY;
        
        return { 
            x: Math.max(0, Math.min(this.width, x)), 
            y: Math.max(0, Math.min(this.height, y))
        };
    }
    
    /**
     * パス作成（描画開始）
     * 元HTMLのcreatePathメソッドを改良・Pure JavaScript対応
     * @param {number} x - X座標
     * @param {number} y - Y座標 
     * @param {number} size - ブラシサイズ
     * @param {number} color - 色（16進数）
     * @param {number} opacity - 不透明度
     * @param {string} tool - ツール種類
     * @returns {Object} パスオブジェクト
     */
    createPath(x, y, size, color, opacity, tool = 'pen') {
        if (!this.isInitialized) {
            console.warn('⚠️ キャンバス未初期化状態でのパス作成');
            return null;
        }
        
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
        
        // 初回描画: 円形ブラシで点を描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size, timestamp: Date.now() });
        
        // 適切なコンテナに追加
        this.drawingContainer.addChild(path.graphics);
        this.paths.push(path);
        
        console.log(`✏️ パス作成: ${path.id} (${tool}) at (${Math.round(x)}, ${Math.round(y)})`);
        return path;
    }
    
    /**
     * 線描画（描画継続）
     * 元HTMLのdrawLineメソッドを改良・Pure JavaScript対応
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    drawLine(path, x, y) {
        if (!path || !path.graphics || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ（性能最適化）
        if (distance < 1.5) return;
        
        // スムーズな線描画のための補間
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            // 筆圧対応サイズ計算
            const pressureSize = this.calculatePressureSize(path.size, t);
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, pressureSize / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ 
            x, y, 
            size: path.size, 
            timestamp: Date.now() 
        });
        
        // パフォーマンス監視
        this.updateFrameCount();
    }
    
    /**
     * 筆圧対応サイズ計算
     * @param {number} baseSize - 基本サイズ
     * @param {number} pressure - 筆圧値 (0-1)
     * @returns {number} 調整済みサイズ
     */
    calculatePressureSize(baseSize, pressure = 1.0) {
        const minSize = baseSize * 0.3;
        const maxSize = baseSize * 1.2;
        return minSize + (maxSize - minSize) * pressure;
    }
    
    /**
     * パス完了
     * @param {Object} path - パスオブジェクト
     */
    completePath(path) {
        if (path) {
            path.isComplete = true;
            path.completedAt = Date.now();
            console.log(`✅ パス完了: ${path.id} (${path.points.length} points)`);
        }
    }
    
    /**
     * キャンバスリサイズ
     * 元HTMLのresizeメソッドを改良・Pure JavaScript対応
     * @param {number} newWidth - 新しい幅
     * @param {number} newHeight - 新しい高さ
     * @param {boolean} centerContent - 中央寄せフラグ
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.isInitialized) {
            console.warn('⚠️ キャンバス未初期化状態でのリサイズ');
            return;
        }
        
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = Math.max(100, Math.min(4000, newWidth));
        this.height = Math.max(100, Math.min(4000, newHeight));
        
        // PixiJS Applicationリサイズ
        this.app.renderer.resize(this.width, this.height);
        
        // ヒットエリア更新
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        // 背景更新
        this.updateBackground();
        
        // コンテンツ中央寄せ
        if (centerContent) {
            const offsetX = (this.width - oldWidth) / 2;
            const offsetY = (this.height - oldHeight) / 2;
            
            this.drawingContainer.position.set(
                this.drawingContainer.x + offsetX,
                this.drawingContainer.y + offsetY
            );
        }
        
        console.log(`🔄 キャンバスリサイズ: ${oldWidth}×${oldHeight} → ${this.width}×${this.height}`);
        
        // リサイズイベント発火（カスタムイベント）
        this.dispatchResizeEvent(oldWidth, oldHeight);
    }
    
    /**
     * 背景更新
     */
    updateBackground() {
        if (this.backgroundContainer.children.length > 0) {
            const background = this.backgroundContainer.children[0];
            if (background instanceof PIXI.Graphics) {
                background.clear();
                background.beginFill(this.backgroundColor);
                background.drawRect(0, 0, this.width, this.height);
                background.endFill();
            }
        }
    }
    
    /**
     * リサイズイベント発火
     */
    dispatchResizeEvent(oldWidth, oldHeight) {
        const event = new CustomEvent('canvasResize', {
            detail: {
                oldWidth,
                oldHeight,
                newWidth: this.width,
                newHeight: this.height
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * キャンバスクリア
     * @param {boolean} keepBackground - 背景保持フラグ
     */
    clear(keepBackground = true) {
        if (!this.isInitialized) return;
        
        // 描画コンテナクリア
        this.drawingContainer.removeChildren();
        
        // パス配列クリア
        this.paths.length = 0;
        
        console.log('🗑️ キャンバスクリア完了');
        
        // クリアイベント発火
        const event = new CustomEvent('canvasClear');
        document.dispatchEvent(event);
    }
    
    /**
     * キャンバス状態取得
     * @returns {Object} 状態オブジェクト
     */
    getCanvasState() {
        return {
            width: this.width,
            height: this.height,
            isInitialized: this.isInitialized,
            pathCount: this.paths.length,
            completedPaths: this.paths.filter(p => p.isComplete).length,
            backgroundColor: this.backgroundColor,
            hasContent: this.paths.length > 0
        };
    }
    
    /**
     * パフォーマンス情報取得
     * @returns {Object} パフォーマンス情報
     */
    getPerformanceInfo() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        const fps = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0;
        
        return {
            fps: fps,
            frameCount: this.frameCount,
            pathCount: this.paths.length,
            totalPoints: this.paths.reduce((sum, path) => sum + path.points.length, 0),
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    /**
     * メモリ使用量推定
     * @returns {Object} メモリ使用量情報
     */
    estimateMemoryUsage() {
        const pathMemory = this.paths.length * 100; // パスあたり約100byte
        const pointMemory = this.paths.reduce((sum, path) => sum + path.points.length, 0) * 32; // ポイントあたり約32byte
        
        return {
            paths: pathMemory,
            points: pointMemory,
            total: pathMemory + pointMemory,
            unit: 'bytes'
        };
    }
    
    /**
     * フレームカウント更新
     */
    updateFrameCount() {
        this.frameCount++;
        this.lastFrameTime = performance.now();
    }
    
    /**
     * 座標境界チェック
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {Object} 調整済み座標
     */
    clampCoordinates(x, y) {
        return {
            x: Math.max(0, Math.min(this.width, x)),
            y: Math.max(0, Math.min(this.height, y))
        };
    }
    
    /**
     * パス検索
     * @param {string} pathId - パスID
     * @returns {Object|null} パスオブジェクト
     */
    findPath(pathId) {
        return this.paths.find(path => path.id === pathId) || null;
    }
    
    /**
     * パス削除
     * @param {string} pathId - パスID
     * @returns {boolean} 削除成功フラグ
     */
    removePath(pathId) {
        const pathIndex = this.paths.findIndex(path => path.id === pathId);
        
        if (pathIndex >= 0) {
            const path = this.paths[pathIndex];
            
            // Graphics削除
            if (path.graphics && path.graphics.parent) {
                path.graphics.parent.removeChild(path.graphics);
                path.graphics.destroy();
            }
            
            // 配列から削除
            this.paths.splice(pathIndex, 1);
            
            console.log(`🗑️ パス削除: ${pathId}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * パス可視性制御
     * @param {string} pathId - パスID
     * @param {boolean} visible - 可視性
     */
    setPathVisibility(pathId, visible) {
        const path = this.findPath(pathId);
        if (path && path.graphics) {
            path.graphics.visible = visible;
            console.log(`👁️ パス可視性変更: ${pathId} → ${visible}`);
        }
    }
    
    /**
     * パス透明度設定
     * @param {string} pathId - パスID
     * @param {number} alpha - 透明度 (0-1)
     */
    setPathAlpha(pathId, alpha) {
        const path = this.findPath(pathId);
        if (path && path.graphics) {
            path.graphics.alpha = Math.max(0, Math.min(1, alpha));
            console.log(`🎨 パス透明度変更: ${pathId} → ${alpha}`);
        }
    }
    
    /**
     * キャンバスエクスポート（基本実装）
     * @param {string} format - 出力形式 ('png', 'jpeg')
     * @param {number} quality - 品質 (0-1)
     * @returns {string} DataURL
     */
    exportCanvas(format = 'png', quality = 1.0) {
        if (!this.app?.view) {
            console.warn('⚠️ キャンバス未初期化状態でのエクスポート');
            return null;
        }
        
        try {
            const canvas = this.app.view;
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const dataURL = canvas.toDataURL(mimeType, quality);
            
            console.log(`📸 キャンバスエクスポート: ${format} (${Math.round(dataURL.length/1024)}KB)`);
            return dataURL;
            
        } catch (error) {
            console.error('❌ エクスポートエラー:', error);
            return null;
        }
    }
    
    /**
     * キャンバス統計情報
     * @returns {Object} 統計情報
     */
    getStatistics() {
        const now = Date.now();
        const activePaths = this.paths.filter(p => !p.isComplete);
        const completedPaths = this.paths.filter(p => p.isComplete);
        
        return {
            canvas: {
                width: this.width,
                height: this.height,
                area: this.width * this.height
            },
            paths: {
                total: this.paths.length,
                active: activePaths.length,
                completed: completedPaths.length
            },
            points: {
                total: this.paths.reduce((sum, path) => sum + path.points.length, 0),
                average: this.paths.length > 0 ? 
                    Math.round(this.paths.reduce((sum, path) => sum + path.points.length, 0) / this.paths.length) : 0
            },
            performance: this.getPerformanceInfo(),
            memory: this.estimateMemoryUsage()
        };
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const stats = this.getStatistics();
        console.group('📊 CanvasManager デバッグ情報');
        console.log('キャンバス:', stats.canvas);
        console.log('パス:', stats.paths);
        console.log('ポイント:', stats.points);
        console.log('パフォーマンス:', stats.performance);
        console.log('メモリ:', stats.memory);
        console.log('拡張機能:', window.PixiExtensions?.getStats());
        console.groupEnd();
        
        return stats;
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        if (this.app) {
            // すべてのパスを削除
            this.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            
            this.paths.length = 0;
            
            // PIXIアプリケーション破棄
            this.app.destroy(true, true);
            this.app = null;
            
            console.log('🗑️ CanvasManager破棄完了');
        }
        
        this.isInitialized = false;
    }
}

/**
 * Pure JavaScript用グローバル登録
 * ESM/TypeScript混在禁止原則に完全準拠
 */
window.CanvasManager = CanvasManager;

/**
 * 初期化ログ出力
 */
console.log('📦 CanvasManager クラス定義完了（Pure JavaScript）');
console.log('🎯 機能: PixiJS統合・描画管理・パフォーマンス監視');
console.log('📋 準拠: Phase1.1ss3・DRY/SOLID原則・Pure JavaScript');

/**
 * v8移行準備コメント
 * 📋 V8_MIGRATION: 以下のAPI変更予定
 * - new PIXI.Application() → await PIXI.Application.init()
 * - backgroundColor: 0xffffff → background: '#ffffff'
 * - renderer.resize() → app.resize()
 * - WebGPU Renderer統合予定
 */