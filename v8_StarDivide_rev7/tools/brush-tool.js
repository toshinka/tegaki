/**
 * ==========================================================
 * @module BrushTool
 * @role   ベクターペンツール（描画専用）
 * @depends MainController (イベント経由)
 * @provides
 *   - start(payload): ストローク開始
 *   - move(point): ストローク描画
 *   - end(): ストローク終了・確定
 *   - updateSettings(settings): ツール設定更新
 * @notes
 *   - 描画確定時には主星を経由して HistoryService に記録する。
 *   - PixiJS Graphics を利用して描画処理を行う。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class BrushTool {
        constructor() {
            this.id = 'brush';
            this.name = 'ベクターペン';
            this.mainApi = null;
            this.engine = null;
            
            this.points = [];
            this.isDrawing = false;
            this.currentStroke = null;
            
            this.settings = {
                tool: 'brush',
                size: 16.0,
                color: 0x800000,
                alpha: 1.0
            };
        }

        register(mainApi) {
            this.mainApi = mainApi;
            this.engine = mainApi.getEngineBridge();
            this._setupCanvasHandlers();
        }

        _setupCanvasHandlers() {
            // DrawingEngineが既にハンドラーを設定するので、ここでは重複設定を避ける
            // BrushToolは主にDrawingEngineからの通知を受け取る形に変更
        }

        _onPointerDown(e) {
            // スペースキー押下中は描画しない
            if(this._isSpacePressed()) return;
            
            // アクティブツールでない場合は描画しない
            if(!this._isActiveTool()) return;

            // ペン入力で圧力が0の場合は無視
            if(e.pointerType === 'pen' && e.pressure === 0) return;

            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.start({ x, y });
            e.preventDefault();
        }

        _onPointerMove(e) {
            if(!this.isDrawing) return;
            if(this._isSpacePressed()) return;

            // ペン入力で圧力が0の場合は無視
            if(e.pointerType === 'pen' && e.pressure === 0) return;

            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.move({ x, y });
        }

        _onPointerUp(e) {
            if(this.isDrawing) {
                this.end();
            }
        }

        start(payload) {
            const { x, y } = payload;
            
            this.points = [{ x, y }];
            this.isDrawing = true;
            this.currentStroke = null;
            
            // 一時描画開始
            this._drawTemporary();
            
            if(global.MyApp.debug) {
                console.log(`[BrushTool] Start stroke at (${x}, ${y})`);
            }
        }

        move(point) {
            if(!this.isDrawing) return;
            
            const { x, y } = point;
            const lastPoint = this.points[this.points.length - 1];
            
            // 最小距離チェック（パフォーマンス向上）
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            if(distance < 1.5) return;
            
            this.points.push({ x, y });
            this._drawTemporary();
        }

        end() {
            if(!this.isDrawing) return;
            
            this.isDrawing = false;
            
            // ストロークデータを作成
            const strokeData = {
                id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: this.points.slice(),
                style: { ...this.settings },
                timestamp: Date.now()
            };
            
            // 主星経由でストロークを確定
            if(this.mainApi) {
                this.mainApi.notify({
                    type: 'tools.strokeCommit',
                    payload: {
                        layerId: 0, // アクティブレイヤー（簡易実装）
                        strokeData: strokeData
                    }
                });
            }
            
            this.points = [];
            
            if(global.MyApp.debug) {
                console.log(`[BrushTool] End stroke, points: ${strokeData.points.length}`);
            }
        }

        cancel() {
            if(this.isDrawing) {
                this.isDrawing = false;
                this.points = [];
                
                if(global.MyApp.debug) {
                    console.log('[BrushTool] Stroke cancelled');
                }
            }
        }

        _drawTemporary() {
            if(!this.engine || this.points.length < 1) return;
            
            // EngineBridge経由で一時描画
            this.engine.drawTemporaryStroke(0, this.points, this.settings);
        }

        _isSpacePressed() {
            // 主星に問い合わせ
            if(this.mainApi && this.mainApi.requestConfirm) {
                const state = this.mainApi.requestConfirm('spaceState');
                return state && state.pressed;
            }
            return false;
        }

        _isActiveTool() {
            // ToolManagerが現在このツールをアクティブにしているかチェック
            return global.MyApp.main && 
                   global.MyApp.main.appState && 
                   global.MyApp.main.appState.currentTool === this.id;
        }

        updateSettings(settings) {
            this.settings = { ...this.settings, ...settings };
            
            if(global.MyApp.debug) {
                console.log('[BrushTool] Settings updated:', this.settings);
            }
        }

        // Tool インターフェース実装
        serialize() {
            return {
                id: this.id,
                settings: this.settings
            };
        }

        handleEvent(event) {
            // 特定のイベントハンドリングが必要な場合に実装
            if(global.MyApp.debug) {
                console.log(`[BrushTool] Handle event: ${event.type}`);
            }
        }
    }

    global.MyApp.BrushTool = BrushTool;
})(window);