/**
 * ==========================================================
 * @module EraserTool
 * @role   消しゴムツール（ピクセル消去）
 * @depends MainController (イベント経由)
 * @provides
 *   - start(payload): 消去ストローク開始
 *   - move(point): 消去ストローク描画
 *   - end(): 消去確定
 *   - updateSettings(settings): ツール設定更新
 * @notes
 *   - 消去も「描画確定イベント」として扱い、HistoryService に登録される。
 *   - blendMode = ERASE を使用。ペンとは別クラスで責務を分離する。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class EraserTool {
        constructor() {
            this.id = 'eraser';
            this.name = '消しゴム';
            this.mainApi = null;
            this.engine = null;
            
            this.points = [];
            this.isDrawing = false;
            this.currentStroke = null;
            
            this.settings = {
                tool: 'eraser',
                size: 24.0,
                color: 0xf0e0d6, // 背景色で上書き
                alpha: 1.0
            };
        }

        register(mainApi) {
            this.mainApi = mainApi;
            this.engine = mainApi.getEngineBridge();
            this._setupCanvasHandlers();
        }

        _setupCanvasHandlers() {
            // DrawingEngineが既にハンドラーを設定するので、重複を避ける
        }

        _onPointerDown(e) {
            // スペースキー押下中は消去しない
            if(this._isSpacePressed()) return;
            
            // アクティブツールでない場合は消去しない
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
            
            // 一時消去開始
            this._eraseTemporary();
            
            if(global.MyApp.debug) {
                console.log(`[EraserTool] Start erase at (${x}, ${y})`);
            }
        }

        move(point) {
            if(!this.isDrawing) return;
            
            const { x, y } = point;
            const lastPoint = this.points[this.points.length - 1];
            
            // 最小距離チェック
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            if(distance < 2.0) return;
            
            this.points.push({ x, y });
            this._eraseTemporary();
        }

        end() {
            if(!this.isDrawing) return;
            
            this.isDrawing = false;
            
            // 消去ストロークデータを作成
            const strokeData = {
                id: `erase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: this.points.slice(),
                style: { ...this.settings },
                timestamp: Date.now(),
                isEraser: true
            };
            
            // 主星経由で消去を確定
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
                console.log(`[EraserTool] End erase, points: ${strokeData.points.length}`);
            }
        }

        cancel() {
            if(this.isDrawing) {
                this.isDrawing = false;
                this.points = [];
                
                if(global.MyApp.debug) {
                    console.log('[EraserTool] Erase cancelled');
                }
            }
        }

        _eraseTemporary() {
            if(!this.engine || this.points.length < 1) return;
            
            // EngineBridge経由で一時消去（ERASEブレンドモード使用）
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
                console.log('[EraserTool] Settings updated:', this.settings);
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
            // 消しゴム特有のイベントハンドリング
            if(global.MyApp.debug) {
                console.log(`[EraserTool] Handle event: ${event.type}`);
            }
        }
    }

    global.MyApp.EraserTool = EraserTool;
})(window);