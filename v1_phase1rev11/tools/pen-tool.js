/**
 * ✏️ PenTool Phase1.5準備版 - 描画修正・将来拡張設計
 * 📋 RESPONSIBILITY: ベクター描画処理・座標データ管理
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換
 * ✅ PERMISSION: PIXI.Graphics作成・線描画・CanvasManagerへの渡し
 * 
 * 🔧 FIX: lineStyle復元処理追加（円描画後の線消失問題解決）
 * 🎯 FUTURE: ベクターデータ保持設計・AI補正・SVG互換準備
 * 📏 DESIGN_PRINCIPLE: 座標が主・Graphics表示は従
 * 🔄 INTEGRATION: Phase1.5非破壊編集・Phase2レイヤー変形対応
 * 
 * 🚀 将来実装予定（Phase別）:
 * ┌─ Phase1.5: 非破壊編集基盤 ─┐
 * │ • RecordManager連携        │
 * │ • Undo/Redo対応           │
 * │ • 操作履歴記録           │
 * │ • ストローク単位管理       │
 * └─────────────────────────┘
 * ┌─ Phase2: レイヤー・変形 ─┐
 * │ • レイヤー変形対応        │
 * │ • ベクターデータ変換      │
 * │ • 範囲選択連携           │
 * │ • レイヤー間移動         │
 * └─────────────────────────┘
 * ┌─ Phase3: AI・高度機能 ──┐
 * │ • AI補正・認識          │
 * │ • SVG互換出力           │
 * │ • 物理ブラシ・SDF       │
 * │ • パフォーマンス最適化   │
 * └─────────────────────────┘
 * 
 * ⚠️ 設計思想:
 * - 「座標配列 = 真のデータ」「Graphics = 表示レンダラー」
 * - 将来のSVG変換・AI補正・物理ブラシに対応できる設計
 * - 非破壊編集・レイヤー変形の基盤を意識した実装
 * 
 * 🤔 実装タイミング相談:
 * - Undo/Redoとの相性: ストローク単位記録が理想→Phase1.5で基盤作成推奨
 * - レイヤー移動との競合: ベクターデータ変換が必要→Phase2で本格対応
 * - 現在のシンプル実装: Phase1完了まで維持、基盤は準備のみ
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * PenTool - Phase1.5準備版（描画修正・将来拡張設計）
 * アクティブレイヤーにベクター描画・座標データ管理する専任クラス
 */
class PenTool {
    constructor() {
        console.log('✏️ PenTool Phase1.5準備版 作成');
        
        this.canvasManager = null;
        this.isDrawing = false;
        this.currentPath = null;
        
        // 🎯 Phase1.5準備: ベクターデータ保持設計
        this.points = [];                    // 現在ストロークの座標配列
        this.strokeHistory = [];             // 全ストロークの履歴（Phase1.5で活用）
        this.currentStroke = null;           // 現在編集中のストローク
        
        // ペン設定
        this.color = 0x800000;               // ふたば風マルーン
        this.lineWidth = 4;                  // デフォルト線幅
        this.opacity = 1.0;                  // 不透明度
        
        // ベクター設定
        this.smoothing = true;               // スムージング有効
        this.pressureSensitive = false;      // 筆圧感度（Phase3で実装）
        
        // 🚀 Phase1.5準備: 将来機能フラグ
        this.vectorDataEnabled = true;       // ベクターデータ保持（常に有効）
        this.undoRedoReady = false;          // Undo/Redo準備（Phase1.5で有効化）
        this.layerTransformReady = false;    // レイヤー変形準備（Phase2で有効化）
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log('✏️ PenTool - CanvasManager設定完了');
    }
    
    /**
     * 描画開始（将来拡張対応版）
     * 🎯 Phase1.5準備: ストローク作成・記録開始
     */
    onPointerDown(x, y, event) {
        if (!this.canvasManager) {
            console.warn('⚠️ CanvasManager not set');
            return;
        }
        
        // アクティブレイヤー確認
        const activeLayerId = this.canvasManager.getActiveLayerId();
        console.log(`✏️ 描画開始: layer=${activeLayerId}, pos=(${x}, ${y})`);
        
        this.isDrawing = true;
        this.points = [{x, y, pressure: event.pressure || 1.0, timestamp: Date.now()}];
        
        // 🎯 Phase1.5準備: ストローク作成（ベクターデータ）
        this.currentStroke = {
            id: Date.now(),                  // 一意ID
            layerId: activeLayerId,          // 描画レイヤー
            points: this.points,             // 座標配列
            style: {                         // スタイル情報
                color: this.color,
                lineWidth: this.lineWidth,
                opacity: this.opacity,
                smoothing: this.smoothing
            },
            createdAt: Date.now(),
            type: 'pen'                      // ツール種別
        };
        
        // Graphics作成（表示レンダラー）
        this.currentPath = new PIXI.Graphics();
        this.updateGraphicsStyle();
        
        // 描画開始点設定
        this.currentPath.moveTo(x, y);
        
        // 開始点に小さな円を描画
        this.drawPointCircle(x, y);
        
        // アクティブレイヤーに追加
        this.canvasManager.addGraphicsToLayer(this.currentPath);
    }
    
    /**
     * 描画継続（lineStyle復元修正版）
     * 🔧 FIX: 円描画後のlineStyle復元処理追加
     */
    onPointerMove(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 前の点取得
        const prev = this.points[this.points.length - 1];
        
        // 点を記録（ベクターデータ）
        const pointData = {x, y, pressure: event.pressure || 1.0, timestamp: Date.now()};
        this.points.push(pointData);
        if (this.currentStroke) {
            this.currentStroke.points.push(pointData);
        }
        
        // 前の点からのmoveTo保証
        if (prev) {
            this.currentPath.moveTo(prev.x, prev.y);
        }
        
        // 線描画
        if (this.smoothing && this.points.length > 2) {
            this.drawSmoothLine();
        } else {
            this.currentPath.lineTo(x, y);
        }
        
        // 線の隙間を円で埋める
        this.drawPointCircle(x, y);
        
        // 🔧 重要修正: 円描画後にlineStyleを復元
        this.updateGraphicsStyle();
    }
    
    /**
     * 描画終了（ストローク完成処理）
     * 🎯 Phase1.5準備: ストローク履歴保存
     */
    onPointerUp(x, y, event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 最終点追加
        const finalPoint = {x, y, pressure: event.pressure || 1.0, timestamp: Date.now()};
        this.points.push(finalPoint);
        if (this.currentStroke) {
            this.currentStroke.points.push(finalPoint);
            this.currentStroke.completedAt = Date.now();
        }
        
        // 最終線描画
        const prev = this.points[this.points.length - 2];
        if (prev) {
            this.currentPath.moveTo(prev.x, prev.y);
        }
        this.currentPath.lineTo(x, y);
        
        // 最終点に円描画
        this.drawPointCircle(x, y);
        
        // 🎯 Phase1.5準備: ストローク履歴保存
        if (this.currentStroke && this.vectorDataEnabled) {
            this.strokeHistory.push({...this.currentStroke});
            console.log(`💾 ストローク保存: id=${this.currentStroke.id}, points=${this.currentStroke.points.length}`);
            
            // Phase1.5: RecordManager連携準備（将来実装）
            // if (this.undoRedoReady && window.Tegaki.RecordManager) {
            //     window.Tegaki.RecordManager.recordStroke(this.currentStroke);
            // }
        }
        
        // 描画完了処理
        this.isDrawing = false;
        const pathLength = this.points.length;
        const activeLayerId = this.canvasManager.getActiveLayerId();
        
        console.log(`✅ 描画完了: layer=${activeLayerId}, pathPoints=${pathLength}, color=0x${this.color.toString(16)}`);
        
        // リセット
        this.currentPath = null;
        this.points = [];
        this.currentStroke = null;
    }
    
    /**
     * 点描画（円）+ lineStyle復元
     * 🔧 FIX: beginFill/endFill後のlineStyle復元
     */
    drawPointCircle(x, y) {
        this.currentPath.beginFill(this.color, this.opacity);
        this.currentPath.drawCircle(x, y, this.lineWidth / 2);
        this.currentPath.endFill();
        
        // 🔧 重要修正: 円描画後にlineStyleを再設定
        this.updateGraphicsStyle();
    }
    
    /**
     * Graphics スタイル更新（lineStyle復元用）
     * 🔧 FIX: endFill後のlineStyle消失問題対策
     */
    updateGraphicsStyle() {
        this.currentPath.lineStyle({
            width: this.lineWidth,
            color: this.color,
            alpha: this.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
    }
    
    /**
     * スムーズな曲線描画（座標修正版）
     * 📏 設計: ベジェカーブによるスムージング
     */
    drawSmoothLine() {
        if (this.points.length < 3) return;
        
        const len = this.points.length;
        const p1 = this.points[len - 3];
        const p2 = this.points[len - 2];
        const p3 = this.points[len - 1];
        
        // 始点を明示的に補正
        this.currentPath.moveTo(p2.x, p2.y);
        
        // 制御点計算（簡易スムージング）
        const cp1x = p1.x + (p2.x - p1.x) * 0.5;
        const cp1y = p1.y + (p2.y - p1.y) * 0.5;
        const cp2x = p2.x + (p3.x - p2.x) * 0.5;
        const cp2y = p2.y + (p3.y - p2.y) * 0.5;
        
        // ベジェカーブ描画
        this.currentPath.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
    }
    
    // ========================================
    // 🎯 Phase1.5準備: 将来拡張メソッド群
    // ========================================
    
    /**
     * ストローク履歴取得（Phase1.5：Undo/Redo用）
     */
    getStrokeHistory() {
        return [...this.strokeHistory];
    }
    
    /**
     * ストローク再描画（Phase1.5：Undo/Redo用）
     * 🎯 将来: RecordManagerから呼び出される
     */
    redrawStroke(strokeData) {
        if (!strokeData || !strokeData.points) return null;
        
        const graphics = new PIXI.Graphics();
        
        // スタイル適用
        graphics.lineStyle({
            width: strokeData.style.lineWidth,
            color: strokeData.style.color,
            alpha: strokeData.style.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // ストローク再描画
        const points = strokeData.points;
        if (points.length > 0) {
            graphics.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                graphics.lineTo(points[i].x, points[i].y);
                
                // 点も再描画
                graphics.beginFill(strokeData.style.color, strokeData.style.opacity);
                graphics.drawCircle(points[i].x, points[i].y, strokeData.style.lineWidth / 2);
                graphics.endFill();
                
                // lineStyle復元
                graphics.lineStyle({
                    width: strokeData.style.lineWidth,
                    color: strokeData.style.color,
                    alpha: strokeData.style.opacity,
                    cap: PIXI.LINE_CAP.ROUND,
                    join: PIXI.LINE_JOIN.ROUND
                });
            }
        }
        
        return graphics;
    }
    
    /**
     * ストローク削除（Phase1.5：Undo用）
     */
    removeLastStroke() {
        if (this.strokeHistory.length > 0) {
            return this.strokeHistory.pop();
        }
        return null;
    }
    
    /**
     * SVG変換用データ取得（Phase3：エクスポート用）
     * 🎯 将来: SVGエクスポート・AI補正で使用
     */
    toSVGData() {
        return this.strokeHistory.map(stroke => ({
            type: 'path',
            id: stroke.id,
            d: this.strokeToSVGPath(stroke),
            style: {
                stroke: `#${stroke.style.color.toString(16).padStart(6, '0')}`,
                strokeWidth: stroke.style.lineWidth,
                strokeOpacity: stroke.style.opacity,
                fill: 'none',
                strokeLinecap: 'round',
                strokeLinejoin: 'round'
            }
        }));
    }
    
    /**
     * ストロークをSVGパス文字列に変換（Phase3：内部処理）
     */
    strokeToSVGPath(stroke) {
        if (!stroke.points || stroke.points.length === 0) return '';
        
        let path = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
        
        for (let i = 1; i < stroke.points.length; i++) {
            path += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
        }
        
        return path;
    }
    
    // ========================================
    // 設定・デバッグメソッド群
    // ========================================
    
    /**
     * ペン色設定
     */
    setPenColor(color) {
        if (typeof color === 'string') {
            this.color = parseInt(color.replace('#', ''), 16);
        } else if (typeof color === 'number') {
            this.color = color;
        } else {
            console.warn('⚠️ 無効な色指定:', color);
            return;
        }
        console.log(`✏️ ペン色変更: 0x${this.color.toString(16)}`);
    }
    
    /**
     * ペン線幅設定
     */
    setPenWidth(width) {
        if (width > 0 && width <= 100) {
            this.lineWidth = width;
            console.log(`✏️ ペン線幅変更: ${width}px`);
        } else {
            console.warn(`⚠️ 無効な線幅: ${width} (1-100の範囲で指定してください)`);
        }
    }
    
    /**
     * ペン透明度設定
     */
    setPenOpacity(opacity) {
        if (opacity >= 0 && opacity <= 1) {
            this.opacity = opacity;
            console.log(`✏️ ペン透明度変更: ${opacity}`);
        } else {
            console.warn(`⚠️ 無効な透明度: ${opacity} (0.0-1.0の範囲で指定してください)`);
        }
    }
    
    /**
     * スムージング設定
     */
    setSmoothing(enabled) {
        this.smoothing = enabled;
        console.log(`✏️ スムージング: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * Phase1.5機能有効化（Phase1.5で呼び出し）
     */
    enablePhase15Features() {
        this.undoRedoReady = true;
        console.log('🚀 Phase1.5機能有効化: Undo/Redo準備完了');
    }
    
    /**
     * Phase2機能有効化（Phase2で呼び出し）
     */
    enablePhase2Features() {
        this.layerTransformReady = true;
        console.log('🚀 Phase2機能有効化: レイヤー変形準備完了');
    }
    
    /**
     * 設定取得
     */
    getSettings() {
        return {
            color: this.color,
            lineWidth: this.lineWidth,
            opacity: this.opacity,
            smoothing: this.smoothing,
            pressureSensitive: this.pressureSensitive,
            vectorDataEnabled: this.vectorDataEnabled,
            undoRedoReady: this.undoRedoReady,
            layerTransformReady: this.layerTransformReady
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            isDrawing: this.isDrawing,
            canvasManagerSet: !!this.canvasManager,
            hasCurrentPath: !!this.currentPath,
            pathLength: this.points.length,
            strokeHistoryCount: this.strokeHistory.length,
            currentStroke: this.currentStroke ? {
                id: this.currentStroke.id,
                pointCount: this.currentStroke.points.length,
                layerId: this.currentStroke.layerId
            } : null,
            settings: this.getSettings()
        };
    }
}

// Tegaki名前空間に登録
window.Tegaki.PenTool = PenTool;

console.log('✏️ PenTool Phase1.5準備版 Loaded - 描画修正・将来拡張設計完了');
console.log('🎯 将来実装予定: Phase1.5=Undo/Redo, Phase2=レイヤー変形, Phase3=AI/SVG');