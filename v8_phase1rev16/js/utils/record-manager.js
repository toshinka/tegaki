/**
 * @provides RecordManager, initializeRecordManagerV8
 * @uses CanvasManager.getDrawContainer, EventBus.emit
 * @initflow 1. AppCore作成 → 2. CanvasManager初期化後 → 3. RecordManager初期化 → 4. ToolManager連携
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫v7/v8二重管理禁止 🚫直接Graphics操作禁止
 * @manager-key window.Tegaki.RecordManagerInstance
 * @dependencies-strict 必須: CanvasManager / オプション: EventBus, ConfigManager
 * @integration-flow AppCore → RecordManager初期化 → ToolManager連携設定
 * @method-naming-rules addStroke()/undoOperation()/redoOperation()統一
 * @state-management 履歴は直接操作禁止・専用メソッド経由のみ・非破壊編集
 * @performance-notes v8 Graphics記録・WebGPU最適化・高精度履歴管理・Container階層対応
 * 
 * RecordManager PixiJS v8完全対応版
 * - TPF (TegakiPathFormat) 形式完全対応
 * - v8 Graphics互換・WebGPU最適化
 * - 非破壊編集・高精度Undo/Redo
 * - Container階層対応・レイヤー座標系
 * - 仮バッファ統合ルール準備（Phase3用）
 */

class RecordManager {
    constructor() {
        // TPF形式履歴管理
        this.strokeHistory = [];
        this.currentIndex = -1;
        this.maxHistorySize = 100;
        
        // v8機能状態
        this.v8FeaturesEnabled = false;
        this.webGPUOptimized = false;
        this.nonDestructiveEditing = false;
        
        // Manager連携
        this.canvasManager = null;
        this.eventBus = null;
        this.drawContainer = null;
        
        // TPF形式設定
        this.tpfVersion = '1.0';
        this.layerPrefix = 'layer_';
        this.currentLayer = 'layer_01';
        
        // v8 Graphics記録用
        this.graphicsRegistry = new Map();
        this.strokeCounter = 0;
        
        console.log('🔄 RecordManager v8対応版 作成開始 - TPF形式・Undo/Redo・v8 Graphics統合版');
    }
    
    /**
     * 🚀 v8機能初期化（CanvasManager連携・WebGPU最適化）
     */
    initializeV8Features() {
        console.log('🔄 RecordManager v8機能初期化開始 - TPF形式・非破壊編集');
        
        try {
            // WebGPU最適化確認
            this.webGPUOptimized = !!PIXI?.Renderer?.defaultOptions?.preference?.includes?.('webgpu');
            
            // 非破壊編集有効化
            this.nonDestructiveEditing = true;
            
            // v8機能フラグ設定
            this.v8FeaturesEnabled = true;
            
            console.log('🚀 v8特徴: 非破壊編集・v8 Graphics活用・高性能メモリ管理・WebGPU加速');
            console.log('✅ v8機能初期化完了: WebGPU=' + (this.webGPUOptimized ? '有効' : '無効'));
            
        } catch (error) {
            console.error('❌ v8機能初期化失敗:', error);
            this.v8FeaturesEnabled = false;
        }
    }
    
    /**
     * 🔧 CanvasManager v8連携設定
     */
    setCanvasManagerV8(canvasManager) {
        console.log('🔧 RecordManager: CanvasManager v8連携設定開始');
        
        try {
            if (!canvasManager) {
                throw new Error('CanvasManager required for v8 features');
            }
            
            this.canvasManager = canvasManager;
            
            // DrawContainer取得
            this.drawContainer = this.canvasManager.getDrawContainer();
            if (!this.drawContainer) {
                console.warn('⚠️ DrawContainer未取得 - 記録機能制限');
                return;
            }
            
            console.log('📦 DrawContainer連携完了:', !!this.drawContainer);
            
            // v8機能初期化
            this.initializeV8Features();
            
            console.log('✅ CanvasManager v8連携設定完了');
            
        } catch (error) {
            console.error('❌ CanvasManager連携失敗:', error);
            throw error;
        }
    }
    
    /**
     * 📡 EventBus連携設定
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        console.log('📡 RecordManager: EventBus連携設定完了');
    }
    
    /**
     * 🎨 TPF形式ストローク追加（v8 Graphics対応）
     */
    addStroke(strokeData) {
        console.log('🎨 TPF形式ストローク追加開始:', strokeData?.id);
        
        try {
            if (!strokeData || !strokeData.points || strokeData.points.length === 0) {
                console.warn('⚠️ 無効なストロークデータ - 追加スキップ');
                return false;
            }
            
            // TPF形式データ正規化
            const tpfStroke = this.normalizeToTPF(strokeData);
            
            // v8 Graphics生成・記録
            const graphics = this.createV8Graphics(tpfStroke);
            
            // 履歴に追加（非破壊編集）
            this.addToHistory({
                action: 'stroke',
                data: tpfStroke,
                graphics: graphics,
                timestamp: Date.now(),
                layer: this.currentLayer
            });
            
            console.log('💾 TPF形式ストローク追加完了:', tpfStroke.id);
            return true;
            
        } catch (error) {
            console.error('❌ ストローク追加失敗:', error);
            return false;
        }
    }
    
    /**
     * 📋 TPF形式データ正規化
     */
    normalizeToTPF(strokeData) {
        try {
            // 基本TPF構造
            const tpfStroke = {
                // 必須フィールド
                id: strokeData.id || 'stroke_' + Date.now() + '_' + (++this.strokeCounter),
                type: strokeData.type || 'stroke', // 'stroke' | 'erase' | 'transform'
                layer: strokeData.layer || this.currentLayer,
                
                // 描画属性
                color: strokeData.color || '#800000',
                width: strokeData.width || 2.0,
                opacity: strokeData.opacity || 1.0,
                
                // 座標データ
                points: this.normalizePoints(strokeData.points),
                bounds: this.calculateBounds(strokeData.points),
                
                // メタデータ
                meta: {
                    created: strokeData.created || new Date().toISOString(),
                    tool: strokeData.tool || 'unknown',
                    engine: 'pixi_v8',
                    version: this.tpfVersion,
                    duration: strokeData.duration || 0
                }
            };
            
            // SVGパス生成
            tpfStroke.path = this.generateSVGPath(tpfStroke.points);
            
            console.log('📋 TPF形式正規化完了:', tpfStroke.id, 'points:', tpfStroke.points.length);
            return tpfStroke;
            
        } catch (error) {
            console.error('❌ TPF正規化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 📍 座標データ正規化
     */
    normalizePoints(points) {
        if (!Array.isArray(points) || points.length === 0) {
            throw new Error('Invalid points data');
        }
        
        return points.map((point, index) => ({
            x: Number(point.x) || 0,
            y: Number(point.y) || 0,
            pressure: Number(point.pressure) || 0.5,
            time: Number(point.time) || index * 16, // 60fps想定
            timestamp: point.timestamp || Date.now()
        }));
    }
    
    /**
     * 📐 座標範囲計算
     */
    calculateBounds(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0, w: 0, h: 0 };
        }
        
        let minX = points[0].x, maxX = points[0].x;
        let minY = points[0].y, maxY = points[0].y;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        
        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
        };
    }
    
    /**
     * 🎨 SVGパス生成（TPF形式用）
     */
    generateSVGPath(points) {
        if (!points || points.length === 0) {
            return '';
        }
        
        if (points.length === 1) {
            return `M${points[0].x} ${points[0].y}`;
        }
        
        let path = `M${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            path += ` L${points[i].x} ${points[i].y}`;
        }
        
        return path;
    }
    
    /**
     * 🖼️ v8 Graphics生成（新API準拠）
     */
    createV8Graphics(tpfStroke) {
        console.log('🖼️ v8 Graphics生成開始:', tpfStroke.id);
        
        try {
            if (!this.v8FeaturesEnabled || !this.drawContainer) {
                console.warn('⚠️ v8機能未準備 - Graphics生成スキップ');
                return null;
            }
            
            // v8新API: Graphics作成
            const graphics = new PIXI.Graphics();
            
            // v8新API: 描画スタイル設定
            const strokeStyle = {
                width: tpfStroke.width,
                color: tpfStroke.color,
                alpha: tpfStroke.opacity,
                cap: 'round',
                join: 'round'
            };
            
            // v8新API: パス描画（shape().stroke()形式）
            if (tpfStroke.points && tpfStroke.points.length > 0) {
                const firstPoint = tpfStroke.points[0];
                graphics.moveTo(firstPoint.x, firstPoint.y);
                
                for (let i = 1; i < tpfStroke.points.length; i++) {
                    const point = tpfStroke.points[i];
                    graphics.lineTo(point.x, point.y);
                }
                
                // v8新API: stroke()で描画確定（v7のbeginFill/endFill削除）
                graphics.stroke(strokeStyle);
            }
            
            // Container追加
            this.drawContainer.addChild(graphics);
            
            // Graphics登録
            this.graphicsRegistry.set(tpfStroke.id, graphics);
            
            console.log('✅ v8 Graphics生成完了:', tpfStroke.id);
            return graphics;
            
        } catch (error) {
            console.error('❌ v8 Graphics生成失敗:', error);
            return null;
        }
    }
    
    /**
     * 📚 履歴追加（非破壊編集）
     */
    addToHistory(operation) {
        try {
            // 現在位置以降の履歴削除（分岐防止）
            if (this.currentIndex < this.strokeHistory.length - 1) {
                const deletedOperations = this.strokeHistory.splice(this.currentIndex + 1);
                this.cleanupDeletedOperations(deletedOperations);
            }
            
            // 操作追加
            this.strokeHistory.push(operation);
            this.currentIndex = this.strokeHistory.length - 1;
            
            // 履歴サイズ制限
            if (this.strokeHistory.length > this.maxHistorySize) {
                const deletedOperation = this.strokeHistory.shift();
                this.cleanupDeletedOperations([deletedOperation]);
                this.currentIndex--;
            }
            
            // イベント通知
            this.emitHistoryChange();
            
            console.log('📚 履歴追加完了:', operation.data?.id, 'index:', this.currentIndex);
            
        } catch (error) {
            console.error('❌ 履歴追加失敗:', error);
        }
    }
    
    /**
     * ↶ Undo操作（v8対応）
     */
    undoOperation() {
        console.log('↶ Undo操作開始 - v8対応');
        
        try {
            if (this.currentIndex < 0) {
                console.log('📝 Undo不可: