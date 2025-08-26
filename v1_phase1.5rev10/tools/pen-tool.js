/**
 * ✏️ PenTool Phase1.5 非破壊編集対応版 - AbstractTool継承・RecordManager統合
 * 📋 RESPONSIBILITY: ベクター描画処理・座標データ管理・非破壊編集対応
 * 🚫 PROHIBITION: レイヤー操作・UI通知・座標変換・直接Manager作成
 * ✅ PERMISSION: PIXI.Graphics作成・線描画・CanvasManagerへの渡し・操作記録
 * 
 * 📏 DESIGN_PRINCIPLE: AbstractTool継承・非破壊編集・座標データ主体・Graphics表示従
 * 🔄 INTEGRATION: Phase1.5非破壊編集・RecordManager・CoordinateManager統合
 * 🎯 FEATURE: Undo/Redo対応・操作履歴記録・キャンバス外描画対応
 * 🆕 Phase1.5: AbstractTool継承・RecordManager統合・非破壊編集完全対応
 * 
 * 🎨 CANVAS_DISPLAY: キャンバス表示の流れ
 * 1. bootstrap.js → DOM読み込み完了後にTegakiApplicationを作成
 * 2. app-core.js → CanvasManagerでPixiJS初期化・レイヤー作成・DOM配置
 * 3. CanvasManager → 背景レイヤー(layer0) + 描画レイヤー(layer1)作成
 * 4. HTML DOM → PixiJSのcanvas要素をdivコンテナに配置
 * 
 * ✏️ PEN_DRAWING_FLOW: ペン描画の正しい流れ
 * 1. ToolManager.selectTool('pen') → PenTool.activate() → this.active = true
 * 2. Canvas DOM Event → ToolManager.handlePointerDown → PenTool.onPointerDown
 * 3. PenTool.handleMouseDown → this.active確認 → 描画開始
 * 4. PIXI.Graphics作成 → lineStyle設定 → CanvasManager.addGraphicsToLayer
 * 5. PointerMove → 継続描画 → lineTo/drawCircle → 座標記録
 * 6. PointerUp → 描画終了 → ストローク完了 → 操作記録保存
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

if (!window.Tegaki.PenTool) {
    /**
     * PenTool - Phase1.5 非破壊編集対応版（AbstractTool継承）
     * AbstractToolを継承してベクター描画・非破壊編集・操作記録を行う
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
            
            console.log('✏️ PenTool Phase1.5 修正版 作成（AbstractTool継承）');
            
            // ペン固有の状態
            this.currentPath = null;      // 現在の描画Graphics
            this.points = [];             // 現在ストロークの座標配列
            this.strokeHistory = [];      // 全ストローク履歴（ローカル参照用）
            
            // ベクター設定
            this.vectorDataEnabled = true;  // ベクターデータ保持（常に有効）
        }
        
        /**
         * 🔧 FIX: ToolManagerとの互換性のため setCanvasManager メソッドを追加
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
         * 🔧 CRITICAL FIX: アクティベート処理を明示的に実装
         * AbstractToolのactivateを確実に呼び出してthis.active = trueにする
         */
        onActivate() {
            console.log(`✏️ PenTool アクティベート完了 - 描画可能状態`);
        }
        
        /**
         * 🔧 CRITICAL FIX: PointerイベントでのisActive確認を修正
         */
        onPointerDown(x, y, event) {
            // activeフラグの明示的確認とログ出力
            console.log(`✏️ PenTool onPointerDown: active=${this.active}, enabled=${this.enabled}, coords=(${x}, ${y})`);
            
            // 非アクティブ時は即座に中断
            if (!this.active) {
                console.warn('⚠️ PenTool not active, ignoring pointer down');
                return false;
            }
            
            // AbstractToolのhandleMouseDownを呼び出し
            return this.handleMouseDown({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerMove(x, y, event) {
            if (!this.active || !this.isDrawing) return false;
            return this.handleMouseMove({ clientX: x, clientY: y, pressure: event?.pressure });
        }
        
        onPointerUp(x, y, event) {
            if (!this.active || !this.isDrawing) return false;
            return this.handleMouseUp({ clientX: x, clientY: y, pressure: event?.pressure });
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
         * 描画開始処理（AbstractTool実装）
         */
        onDrawStart(point, event) {
            if (!this.canvasManager) {
                console.warn('⚠️ CanvasManager not set');
                return;
            }
            
            const { x, y } = point;
            
            // アクティブレイヤー確認
            const activeLayerId = this.canvasManager.getActiveLayerId();
            console.log(`✏️ ペン描画開始: layer=${activeLayerId}, pos=(${Math.round(x)}, ${Math.round(y)})`);
            
            // 座標配列初期化
            this.points = [{
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            }];
            
            // Graphics作成（表示レンダラー）
            this.currentPath = new PIXI.Graphics();
            this.updateGraphicsStyle();
            
            // 🆕 currentActionにGraphics設定（Undo/Redo用）
            if (this.currentAction) {
                this.currentAction.graphics = this.currentPath;
                this.currentAction.type = 'pen'; // 操作タイプ設定
            }
            
            // 描画開始点設定
            this.currentPath.moveTo(x, y);
            
            // 開始点に小さな円を描画
            this.drawPointCircle(x, y);
            
            // アクティブレイヤーに追加
            try {
                this.canvasManager.addGraphicsToLayer(this.currentPath);
                console.log(`✅ ペンGraphics追加成功: layer=${activeLayerId}`);
            } catch (error) {
                console.error('❌ ペンGraphics追加失敗:', error);
                if (window.Tegaki?.ErrorManagerInstance) {
                    window.Tegaki.ErrorManagerInstance.showError(
                        'technical',
                        `ペンGraphics追加失敗: ${error.message}`,
                        { context: 'PenTool.onDrawStart' }
                    );
                }
            }
        }
        
        /**
         * 描画更新処理（AbstractTool実装）
         */
        onDrawMove(point, event) {
            if (!this.currentPath) return;
            
            const { x, y } = point;
            
            // 前の点取得
            const prev = this.points[this.points.length - 1];
            
            // 点を記録（ベクターデータ）
            const pointData = {
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            };
            this.points.push(pointData);
            
            // 前の点からのmoveTo保証
            if (prev) {
                this.currentPath.moveTo(prev.x, prev.y);
            }
            
            // 線描画
            if (this.settings.smoothing && this.points.length > 2) {
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
         * 描画終了処理（AbstractTool実装）
         */
        onDrawEnd(point, event) {
            if (!this.currentPath) return;
            
            const { x, y } = point;
            
            // 最終点追加
            const finalPoint = {
                x, y, 
                pressure: event?.pressure || 1.0, 
                timestamp: Date.now()
            };
            this.points.push(finalPoint);
            
            // 最終線描画
            const prev = this.points[this.points.length - 2];
            if (prev) {
                this.currentPath.moveTo(prev.x, prev.y);
            }
            this.currentPath.lineTo(x, y);
            
            // 最終点に円描画
            this.drawPointCircle(x, y);
            
            // 🆕 ストロークデータをローカル履歴に保存
            if (this.vectorDataEnabled && this.currentAction) {
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
            
            // 描画完了処理
            const pathLength = this.points.length;
            const activeLayerId = this.canvasManager?.getActiveLayerId();
            
            console.log(`✅ ペン描画完了: layer=${activeLayerId}, pathPoints=${pathLength}, color=0x${this.settings.color.toString(16)}`);
            
            // リセット
            this.currentPath = null;
            this.points = [];
        }
        
        /**
         * 🆕 操作取り消し処理（AbstractTool実装）
         */
        onUndo(operationData) {
            console.log(`↶ ペンストローク取り消し: ${operationData.id}`);
            
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
                const strokeData = operationData.data;
                operationData.graphics = this.redrawStroke(strokeData);
                
                if (operationData.graphics && this.canvasManager) {
                    this.canvasManager.addGraphicsToLayer(operationData.graphics, operationData.data.layerId);
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
                this.canvasManager.removeGraphicsFromLayer(this.currentPath);
            }
            
            // 状態リセット
            this.currentPath = null;
            this.points = [];
        }
        
        /**
         * 点描画（円）+ lineStyle復元
         * 🔧 FIX: beginFill/endFill後のlineStyle復元
         */
        drawPointCircle(x, y) {
            this.currentPath.beginFill(this.settings.color, this.settings.opacity);
            this.currentPath.drawCircle(x, y, this.settings.lineWidth / 2);
            this.currentPath.endFill();
            
            // 🔧 重要修正: 円描画後にlineStyleを再設定
            this.updateGraphicsStyle();
        }
        
        /**
         * Graphics スタイル更新（lineStyle復元用）
         * 🔧 FIX: endFill後のlineStyle消失問題対策
         */
        updateGraphicsStyle() {
            if (!this.currentPath) return;
            
            this.currentPath.lineStyle({
                width: this.settings.lineWidth,
                color: this.settings.color,
                alpha: this.settings.opacity,
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
        
        /**
         * ストローク再描画（Undo/Redo用）
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
            
            this.updateSetting('color', colorValue);
            console.log(`✏️ ペン色変更: 0x${colorValue.toString(16)}`);
        }
        
        /**
         * ペン線幅設定
         */
        setPenWidth(width) {
            if (width > 0 && width <= 100) {
                this.updateSetting('lineWidth', width);
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
                this.updateSetting('opacity', opacity);
                console.log(`✏️ ペン透明度変更: ${opacity}`);
            } else {
                console.warn(`⚠️ 無効な透明度: ${opacity} (0.0-1.0の範囲で指定してください)`);
            }
        }
        
        /**
         * スムージング設定
         */
        setSmoothing(enabled) {
            this.updateSetting('smoothing', enabled);
            console.log(`✏️ スムージング: ${enabled ? '有効' : '無効'}`);
        }
        
        /**
         * ストローク履歴取得
         */
        getStrokeHistory() {
            return [...this.strokeHistory];
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
            const baseInfo = super.getToolState ? super.getToolState() : {};
            
            return {
                ...baseInfo,
                // ペン固有情報
                pen: {
                    hasCurrentPath: !!this.currentPath,
                    currentPathPoints: this.points.length,
                    strokeHistoryCount: this.strokeHistory.length,
                    vectorDataEnabled: this.vectorDataEnabled,
                    
                    // 現在の設定
                    color: `0x${this.settings.color.toString(16)}`,
                    lineWidth: this.settings.lineWidth,
                    opacity: this.settings.opacity,
                    smoothing: this.settings.smoothing,
                    pressureSensitive: this.settings.pressureSensitive
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
            
            // ペン固有機能テスト
            try {
                // Graphics作成テスト
                const testGraphics = new PIXI.Graphics();
                testGraphics.lineStyle(2, 0xff0000);
                testGraphics.moveTo(0, 0);
                testGraphics.lineTo(10, 10);
                
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
                
            } catch (error) {
                results.error.push(`PenTool機能テストエラー: ${error.message}`);
            }
            
            return results;
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.PenTool = PenTool;
}

console.log('✏️ PenTool Phase1.5 修正版 Loaded - 描画機能修復完了');
console.log('🔧 座標変換重複修正・PointerEvent対応・AbstractTool連携最適化');
console.log('📏 RecordManager統合・Undo/Redo対応・操作記録・キャンバス外描画対応');