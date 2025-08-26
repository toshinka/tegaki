/**
 * ✏️ PenTool Phase1.5 直接描画修正版 - AbstractTool継承・即時描画対応
 * 
 * 📋 使用メソッド一覧（依存確認済み ✅）
 * - new PIXI.Graphics() - PixiJS標準描画クラス
 * - graphics.lineStyle() - PixiJS線設定
 * - graphics.moveTo() / lineTo() - PixiJS線描画
 * - canvasManager.addGraphicsToLayer() - CanvasManager標準メソッド
 * - coordinateManager.toCanvas() - CoordinateManager座標変換
 * - recordManager.startOperation() - RecordManager操作記録
 * 
 * 📋 RESPONSIBILITY: ベクター描画処理・座標データ管理・即時描画実行
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換重複・直接Manager作成・フォールバック
 * ✅ PERMISSION: PIXI.Graphics作成・線描画・CanvasManagerへの渡し・操作記録
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・直接描画・RecordManager記録・PixiJS活用
 * 🔄 INTEGRATION: Phase1.5 Manager統合・AbstractTool標準準拠・PixiJS Graphics活用
 * 
 * ✏️ PEN_DRAWING_FLOW: ペン描画の修正版フロー
 * 1. PointerDown → CoordinateManager.toCanvas() → 座標確定（NaNエラー時は中断）
 * 2. PIXI.Graphics作成 → lineStyle設定 → moveTo開始点
 * 3. CanvasManager.addGraphicsToLayer() → 即座に画面表示
 * 4. PointerMove → lineTo描画 → 即座に画面更新
 * 5. PointerUp → RecordManager記録 → 描画完了
 * 6. Graphics表示とRecordManager記録を並行処理（ブロックしない）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.PenTool) {
    /**
     * PenTool - Phase1.5 直接描画修正版（AbstractTool継承）
     * AbstractToolを継承してベクター描画・即時表示・操作記録を行う
     */
    class PenTool extends window.Tegaki.AbstractTool {
        constructor() {
            // AbstractTool継承（ツール名とデフォルト設定）
            super('pen', {
                color: 0x800000,           // ふたば風マルーン
                lineWidth: 4,              // デフォルト線幅
                opacity: 1.0,              // 不透明度
                smoothing: true,           // スムージング有効
                pressureSensitive: false   // 筆圧感度（Phase3で実装）
            });
            
            console.log('✏️ PenTool Phase1.5 直接描画修正版 作成（AbstractTool継承）');
            
            // ペン固有の状態
            this.currentPath = null;      // 現在の描画Graphics
            this.points = [];             // 現在ストロークの座標配列
            this.strokeHistory = [];      // 全ストローク履歴（ローカル参照用）
            this.lastDrawPoint = null;    // 前回描画点（距離計算用）
            
            // 描画設定
            this.minDrawDistance = 2;     // 最小描画距離（滑らか化）
            this.vectorDataEnabled = true;  // ベクターデータ保持（常に有効）
        }
        
        /**
         * 🔧 ToolManagerとの互換性のため setCanvasManager メソッドを追加
         */
        setCanvasManager(canvasManager) {
            console.log('✏️ PenTool - setCanvasManager 呼び出し（互換性メソッド）');
            
            // AbstractToolのinitializeメソッドを呼び出す
            this.initialize({
                canvasManager: canvasManager,
                coordinateManager: window.Tegaki?.CoordinateManagerInstance,
                recordManager: window.Tegaki?.RecordManagerInstance,
                eventBus: window.Tegaki?.EventBusInstance
            });
        }
        
        /**
         * 🔧 アクティベート処理
         */
        onActivate() {
            console.log(`✏️ PenTool アクティベート完了 - 描画可能状態`);
        }
        
        /**
         * 🎯 PointerDown処理（NaN対策・直接描画）
         */
        onPointerDown(x, y, event) {
            console.log(`✏️ PenTool onPointerDown: active=${this.active}, enabled=${this.enabled}, input=(${x}, ${y})`);
            
            // 非アクティブ時は即座に中断
            if (!this.active) {
                console.warn('⚠️ PenTool not active, ignoring pointer down');
                return false;
            }
            
            // 座標変換（NaN対策済みCoordinateManagerを使用）
            let canvasPoint;
            try {
                if (this.coordinateManager) {
                    canvasPoint = this.coordinateManager.toCanvas({ x, y });
                } else {
                    // フォールバック禁止 - 必須Manager未設定はエラー
                    throw new Error('CoordinateManager not set');
                }
            } catch (error) {
                console.error('❌ 座標変換エラー:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'technical',
                        `座標変換失敗: ${error.message}`,
                        { context: 'PenTool.onPointerDown' }
                    );
                }
                return false;
            }
            
            // 変換後座標の最終確認
            if (!Number.isFinite(canvasPoint.x) || !Number.isFinite(canvasPoint.y)) {
                console.error('❌ 変換後座標がNaN:', canvasPoint);
                return false;
            }
            
            console.log(`✏️ 座標変換成功: (${Math.round(x)}, ${Math.round(y)}) → (${Math.round(canvasPoint.x)}, ${Math.round(canvasPoint.y)})`);
            
            // 描画開始
            this.startDrawing(canvasPoint.x, canvasPoint.y, event);
            return true;
        }
        
        /**
         * PointerMove処理
         */
        onPointerMove(x, y, event) {
            if (!this.active || !this.isDrawing) return false;
            
            // 座標変換
            let canvasPoint;
            try {
                canvasPoint = this.coordinateManager.toCanvas({ x, y });
            } catch (error) {
                console.warn('⚠️ Move座標変換エラー:', error.message);
                return false;
            }
            
            if (!Number.isFinite(canvasPoint.x) || !Number.isFinite(canvasPoint.y)) {
                console.warn('⚠️ Move座標がNaN:', canvasPoint);
                return false;
            }
            
            this.continueDrawing(canvasPoint.x, canvasPoint.y, event);
            return true;
        }
        
        /**
         * PointerUp処理
         */
        onPointerUp(x, y, event) {
            if (!this.active || !this.isDrawing) return false;
            
            // 座標変換
            let canvasPoint;
            try {
                canvasPoint = this.coordinateManager.toCanvas({ x, y });
            } catch (error) {
                console.warn('⚠️ Up座標変換エラー:', error.message);
                canvasPoint = this.lastDrawPoint || { x: 0, y: 0 };
            }
            
            if (!Number.isFinite(canvasPoint.x) || !Number.isFinite(canvasPoint.y)) {
                canvasPoint = this.lastDrawPoint || { x: 0, y: 0 };
            }
            
            this.endDrawing(canvasPoint.x, canvasPoint.y, event);
            return true;
        }
        
        /**
         * 🎨 描画開始処理（直接実装・即時表示）
         */
        startDrawing(x, y, event) {
            if (!this.canvasManager) {
                console.warn('⚠️ CanvasManager not set');
                return;
            }
            
            this.isDrawing = true;
            this.lastDrawPoint = { x, y };
            
            // アクティブレイヤー確認
            const activeLayerId = this.canvasManager.getActiveLayerId();
            console.log(`✏️ ペン描画開始: layer=${activeLayerId}, pos=(${Math.round(x)}, ${Math.round(y)})`);
            
            // 座標配列初期化
            this.points = [{
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            }];
            
            // 🎨 PIXI.Graphics作成（即時表示用）
            this.currentPath = new PIXI.Graphics();
            
            // lineStyle設定（PixiJS標準）
            this.currentPath.lineStyle({
                width: this.settings.lineWidth,
                color: this.settings.color,
                alpha: this.settings.opacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            // 開始点設定 + 初期描画（点として表示）
            this.currentPath.moveTo(x, y);
            this.currentPath.drawCircle(x, y, this.settings.lineWidth / 2);
            
            // 🎯 即座にCanvasに追加（画面表示）
            try {
                this.canvasManager.addGraphicsToLayer(this.currentPath);
                console.log(`✅ ペンGraphics即座追加: layer=${activeLayerId}`);
            } catch (error) {
                console.error('❌ ペンGraphics追加失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'technical',
                        `ペンGraphics追加失敗: ${error.message}`,
                        { context: 'PenTool.startDrawing' }
                    );
                }
                return;
            }
            
            // RecordManager連携（非ブロッキング）
            if (this.recordManager) {
                try {
                    this.currentAction = this.recordManager.startOperation({
                        tool: this.name,
                        type: 'pen',
                        data: {
                            startPoint: { x, y },
                            settings: { ...this.settings },
                            layerId: activeLayerId
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ RecordManager記録開始失敗:', error.message);
                    // 記録失敗でも描画は継続（エラーでブロックしない）
                }
            }
        }
        
        /**
         * 🎨 描画継続処理（滑らか化・即時表示）
         */
        continueDrawing(x, y, event) {
            if (!this.currentPath) return;
            
            // 距離による滑らか化（細かすぎる点をスキップ）
            if (this.lastDrawPoint) {
                const distance = Math.sqrt(
                    Math.pow(x - this.lastDrawPoint.x, 2) + 
                    Math.pow(y - this.lastDrawPoint.y, 2)
                );
                
                if (distance < this.minDrawDistance) {
                    return; // 短すぎる移動はスキップ
                }
            }
            
            // 点を記録（ベクターデータ）
            const pointData = {
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            };
            this.points.push(pointData);
            this.lastDrawPoint = { x, y };
            
            // 🎨 即座に線描画（PixiJS標準機能）
            this.currentPath.lineTo(x, y);
            
            // 線の隙間を円で埋める（太い線で重要）
            this.currentPath.drawCircle(x, y, this.settings.lineWidth / 2);
            
            // デバッグログ（頻度制限）
            if (this.points.length % 5 === 0) {
                console.log(`✏️ 描画継続: 点数=${this.points.length}, 座標=(${Math.round(x)}, ${Math.round(y)})`);
            }
        }
        
        /**
         * 🎨 描画終了処理（記録保存・完了処理）
         */
        endDrawing(x, y, event) {
            if (!this.currentPath) return;
            
            this.isDrawing = false;
            
            // 最終点追加
            const finalPoint = {
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            };
            this.points.push(finalPoint);
            this.lastDrawPoint = null;
            
            // 最終線描画
            this.currentPath.lineTo(x, y);
            this.currentPath.drawCircle(x, y, this.settings.lineWidth / 2);
            
            // ストロークデータをローカル履歴に保存
            if (this.vectorDataEnabled) {
                const strokeData = {
                    id: `pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    layerId: this.canvasManager?.getActiveLayerId() || 'default',
                    points: [...this.points],
                    style: {
                        color: this.settings.color,
                        lineWidth: this.settings.lineWidth,
                        opacity: this.settings.opacity,
                        smoothing: this.settings.smoothing
                    },
                    createdAt: Date.now(),
                    type: 'pen',
                    graphics: this.currentPath
                };
                
                this.strokeHistory.push(strokeData);
                console.log(`💾 ペンストローク保存: id=${strokeData.id}, points=${strokeData.points.length}`);
            }
            
            // RecordManager記録終了（非ブロッキング）
            if (this.currentAction && this.recordManager) {
                try {
                    this.currentAction.data.endPoint = { x, y };
                    this.currentAction.data.points = [...this.points];
                    this.currentAction.graphics = this.currentPath;
                    
                    this.recordManager.endOperation(this.currentAction.id, {
                        success: true,
                        graphics: this.currentPath,
                        strokeData: this.strokeHistory[this.strokeHistory.length - 1]
                    });
                } catch (error) {
                    console.warn('⚠️ RecordManager記録終了失敗:', error.message);
                }
                
                this.currentAction = null;
            }
            
            // 描画完了処理
            const pathLength = this.points.length;
            const activeLayerId = this.canvasManager?.getActiveLayerId();
            
            console.log(`✅ ペン描画完了: layer=${activeLayerId}, pathPoints=${pathLength}, color=0x${this.settings.color.toString(16)}`);
            
            // リセット
            this.currentPath = null;
            this.points = [];
        }
        
        /**
         * デフォルト設定取得（AbstractTool実装）
         */
        getDefaultSettings() {
            return {
                color: 0x800000,           // ふたば風マルーン
                lineWidth: 4,              // デフォルト線幅
                opacity: 1.0,              // 不透明度
                smoothing: true,           // スムージング有効
                pressureSensitive: false   // 筆圧感度（Phase3で実装）
            };
        }
        
        /**
         * 🆕 操作取り消し処理（AbstractTool実装）
         */
        onUndo(operationData) {
            console.log(`↶ ペンストローク取り消し: ${operationData.id}`);
            
            // Graphics削除
            if (operationData.graphics && this.canvasManager) {
                try {
                    this.canvasManager.removeGraphicsFromLayer(operationData.graphics);
                    console.log('🗑️ Graphics削除完了');
                } catch (error) {
                    console.warn('⚠️ Graphics削除失敗:', error.message);
                }
            }
            
            // ローカル履歴からも削除
            const index = this.strokeHistory.findIndex(stroke => stroke.id === operationData.id);
            if (index !== -1) {
                this.strokeHistory.splice(index, 1);
                console.log(`🗑️ ローカルストローク履歴削除: index=${index}`);
            }
        }
        
        /**
         * 🆕 操作やり直し処理（AbstractTool実装）
         */
        onRedo(operationData) {
            console.log(`↷ ペンストローク復元: ${operationData.id}`);
            
            // Graphics再作成（必要に応じて）
            if (!operationData.graphics && operationData.data) {
                operationData.graphics = this.redrawStroke(operationData.data);
            }
            
            // Canvasに追加
            if (operationData.graphics && this.canvasManager) {
                try {
                    this.canvasManager.addGraphicsToLayer(operationData.graphics, operationData.data?.layerId);
                    console.log('📥 Graphics復元完了');
                } catch (error) {
                    console.warn('⚠️ Graphics復元失敗:', error.message);
                }
            }
            
            // ローカル履歴にも復元
            if (operationData.data && !this.strokeHistory.find(s => s.id === operationData.id)) {
                const strokeData = {
                    ...operationData.data,
                    graphics: operationData.graphics
                };
                this.strokeHistory.push(strokeData);
                console.log(`📥 ローカルストローク履歴復元: id=${strokeData.id}`);
            }
        }
        
        /**
         * 未完了操作強制終了処理（AbstractTool実装）
         */
        onOperationForceEnd(operationData) {
            console.log(`⚠️ ペン描画強制終了: ${operationData.id}`);
            
            // 未完了のGraphicsがあれば削除
            if (this.currentPath && this.canvasManager) {
                try {
                    this.canvasManager.removeGraphicsFromLayer(this.currentPath);
                } catch (error) {
                    console.warn('⚠️ 強制終了Graphics削除失敗:', error.message);
                }
            }
            
            // 状態リセット
            this.currentPath = null;
            this.points = [];
            this.isDrawing = false;
            this.lastDrawPoint = null;
        }
        
        /**
         * ストローク再描画（Undo/Redo用）
         */
        redrawStroke(strokeData) {
            if (!strokeData || !strokeData.points) return null;
            
            const graphics = new PIXI.Graphics();
            
            // スタイル適用
            graphics.lineStyle({
                width: strokeData.style?.lineWidth || this.settings.lineWidth,
                color: strokeData.style?.color || this.settings.color,
                alpha: strokeData.style?.opacity || this.settings.opacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            
            // ストローク再描画
            const points = strokeData.points;
            if (points.length > 0) {
                graphics.moveTo(points[0].x, points[0].y);
                graphics.drawCircle(points[0].x, points[0].y, (strokeData.style?.lineWidth || this.settings.lineWidth) / 2);
                
                for (let i = 1; i < points.length; i++) {
                    graphics.lineTo(points[i].x, points[i].y);
                    graphics.drawCircle(points[i].x, points[i].y, (strokeData.style?.lineWidth || this.settings.lineWidth) / 2);
                }
            }
            
            return graphics;
        }
        
        // ========================================
        // 設定・ユーティリティメソッド群
        // ========================================
        
        /**
         * ペン色設定
         */
        setPenColor(color) {
            let colorValue;
            if (typeof color === 'string') {
                colorValue = parseInt(color.replace('#', ''), 16);
            } else if (typeof color === 'number') {
                colorValue = color;
            } else {
                console.warn('⚠️ 無効な色指定:', color);
                return;
            }
            
            this.settings.color = colorValue;
            console.log(`✏️ ペン色変更: 0x${colorValue.toString(16)}`);
        }
        
        /**
         * ペン線幅設定
         */
        setPenWidth(width) {
            if (width > 0 && width <= 100) {
                this.settings.lineWidth = width;
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
                this.settings.opacity = opacity;
                console.log(`✏️ ペン透明度変更: ${opacity}`);
            } else {
                console.warn(`⚠️ 無効な透明度: ${opacity} (0.0-1.0の範囲で指定してください)`);
            }
        }
        
        /**
         * スムージング設定
         */
        setSmoothing(enabled) {
            this.settings.smoothing = enabled;
            console.log(`✏️ スムージング: ${enabled ? '有効' : '無効'}`);
        }
        
        /**
         * 最小描画距離設定（滑らか化）
         */
        setMinDrawDistance(distance) {
            if (distance >= 0 && distance <= 10) {
                this.minDrawDistance = distance;
                console.log(`✏️ 最小描画距離変更: ${distance}px`);
            } else {
                console.warn(`⚠️ 無効な最小描画距離: ${distance} (0-10の範囲で指定してください)`);
            }
        }
        
        /**
         * ストローク履歴取得
         */
        getStrokeHistory() {
            return [...this.strokeHistory];
        }
        
        /**
         * ストローク履歴クリア
         */
        clearStrokeHistory() {
            this.strokeHistory = [];
            console.log('🧹 ストローク履歴クリア完了');
        }
        
        /**
         * SVG変換用データ取得（Phase3：エクスポート用）
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
        
        /**
         * 🆕 Phase1.5デバッグ情報取得（AbstractTool拡張）
         */
        getDebugInfo() {
            return {
                // 基本状態
                active: this.active,
                enabled: this.enabled,
                isDrawing: this.isDrawing,
                
                // ペン固有情報
                pen: {
                    hasCurrentPath: !!this.currentPath,
                    currentPathPoints: this.points.length,
                    strokeHistoryCount: this.strokeHistory.length,
                    vectorDataEnabled: this.vectorDataEnabled,
                    lastDrawPoint: this.lastDrawPoint,
                    minDrawDistance: this.minDrawDistance,
                    
                    // 現在の設定
                    color: `0x${this.settings.color.toString(16)}`,
                    lineWidth: this.settings.lineWidth,
                    opacity: this.settings.opacity,
                    smoothing: this.settings.smoothing,
                    pressureSensitive: this.settings.pressureSensitive
                },
                
                // Manager接続状況
                managers: {
                    canvasManager: !!this.canvasManager,
                    coordinateManager: !!this.coordinateManager,
                    recordManager: !!this.recordManager,
                    eventBus: !!this.eventBus
                },
                
                // 最新ストローク情報
                lastStroke: this.strokeHistory.length > 0 ? {
                    id: this.strokeHistory[this.strokeHistory.length - 1].id,
                    pointCount: this.strokeHistory[this.strokeHistory.length - 1].points.length,
                    layerId: this.strokeHistory[this.strokeHistory.length - 1].layerId
                } : null
            };
        }
        
        /**
         * 🆕 Phase1.5機能テスト
         */
        testPhase15Features() {
            const results = { success: [], error: [], warning: [] };
            
            try {
                // Graphics作成テスト
                const testGraphics = new PIXI.Graphics();
                testGraphics.lineStyle(2, 0xff0000);
                testGraphics.moveTo(0, 0);
                testGraphics.lineTo(10, 10);
                testGraphics.drawCircle(5, 5, 1);
                
                results.success.push('PenTool: PIXI.Graphics描画機能正常');
                
                // 設定変更テスト
                const originalColor = this.settings.color;
                this.setPenColor(0x00ff00);
                if (this.settings.color === 0x00ff00) {
                    results.success.push('PenTool: 設定変更機能正常');
                    this.setPenColor(originalColor); // 復元
                } else {
                    results.error.push('PenTool: 設定変更機能異常');
                }
                
                // ストローク履歴テスト
                if (Array.isArray(this.strokeHistory)) {
                    results.success.push('PenTool: ストローク履歴管理正常');
                } else {
                    results.error.push('PenTool: ストローク履歴管理異常');
                }
                
                // 座標変換テスト（CoordinateManager必要）
                if (this.coordinateManager) {
                    try {
                        const testPoint = this.coordinateManager.toCanvas({ x: 100, y: 100 });
                        if (Number.isFinite(testPoint.x) && Number.isFinite(testPoint.y)) {
                            results.success.push('PenTool: 座標変換連携正常');
                        } else {
                            results.error.push('PenTool: 座標変換結果がNaN');
                        }
                    } catch (error) {
                        results.warning.push(`PenTool: 座標変換テストエラー: ${error.message}`);
                    }
                } else {
                    results.warning.push('PenTool: CoordinateManager未設定');
                }
                
            } catch (error) {
                results.error.push(`PenTool機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.PenTool = PenTool;
    
    console.log('✏️ PenTool Phase1.5 直接描画修正版 Loaded - 即時描画・NaN対策・AbstractTool完全準拠');
} else {
    console.log('⚠️ PenTool already defined - skipping redefinition');
}

console.log('✏️ pen-tool.js loaded - 直接描画・座標変換修正・RecordManager非ブロッキング対応完了');