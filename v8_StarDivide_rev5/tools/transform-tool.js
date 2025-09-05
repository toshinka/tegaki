/**
 * ==========================================================
 * @module TransformTool
 * @role   変形ツール（移動・回転・スケール）
 * @depends MainController (イベント経由)
 * @provides
 *   - start(payload): 変形操作開始
 *   - move(point): 変形操作中
 *   - end(): 変形操作確定
 * @notes
 *   - 非破壊的変形操作を提供。
 *   - 変形は主星を経由して HistoryService に記録される。
 * ==========================================================
 */
window.MyApp = window.MyApp || {};
(function(global){
    class TransformTool {
        constructor() {
            this.id = 'transform';
            this.name = '変形';
            this.mainApi = null;
            
            this.transformState = {
                active: false,
                mode: 'move', // 'move', 'rotate', 'scale'
                startPoint: null,
                currentPoint: null,
                targetLayer: null
            };
            
            this.settings = {
                snapToGrid: false,
                gridSize: 10
            };
        }

        register(mainApi) {
            this.mainApi = mainApi;
            this._setupCanvasHandlers();
        }

        _setupCanvasHandlers() {
            // DrawingEngineが既にハンドラーを設定するので、重複を避ける
        }

        _onPointerDown(e) {
            // スペースキー押下中は変形しない
            if(this._isSpacePressed()) return;
            
            // アクティブツールでない場合は変形しない
            if(!this._isActiveTool()) return;

            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.start({ x, y });
            e.preventDefault();
        }

        _onPointerMove(e) {
            if(!this.transformState.active) return;
            if(this._isSpacePressed()) return;

            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.move({ x, y });
        }

        _onPointerUp(e) {
            if(this.transformState.active) {
                this.end();
            }
        }

        start(payload) {
            const { x, y } = payload;
            
            this.transformState.active = true;
            this.transformState.startPoint = { x, y };
            this.transformState.currentPoint = { x, y };
            
            // 変形対象レイヤーの決定（簡易実装）
            this.transformState.targetLayer = this._findTargetLayer(x, y);
            
            if(global.MyApp.debug) {
                console.log(`[TransformTool] Start transform at (${x}, ${y})`);
            }
        }

        move(point) {
            if(!this.transformState.active) return;
            
            const { x, y } = point;
            this.transformState.currentPoint = { x, y };
            
            // 変形のプレビュー（実際の実装では視覚的フィードバックを提供）
            this._updateTransformPreview();
        }

        end() {
            if(!this.transformState.active) return;
            
            const transformData = this._calculateTransform();
            
            // 変形データを主星に送信して確定
            if(this.mainApi && transformData.isValid) {
                this.mainApi.notify({
                    type: 'layers.transformRequest',
                    payload: {
                        layerId: this.transformState.targetLayer,
                        transform: transformData,
                        mode: this.transformState.mode
                    }
                });
            }
            
            this._resetTransformState();
            
            if(global.MyApp.debug) {
                console.log('[TransformTool] Transform completed');
            }
        }

        cancel() {
            if(this.transformState.active) {
                this._resetTransformState();
                
                if(global.MyApp.debug) {
                    console.log('[TransformTool] Transform cancelled');
                }
            }
        }

        _findTargetLayer(x, y) {
            // 指定座標のレイヤーを検索（簡易実装）
            // 実際にはレイヤーのヒットテストが必要
            return 0; // デフォルトレイヤー
        }

        _updateTransformPreview() {
            // 変形プレビューの更新（視覚的フィードバック）
            const transform = this._calculateTransform();
            
            if(global.MyApp.debug && transform.isValid) {
                console.log(`[TransformTool] Preview: dx=${transform.dx}, dy=${transform.dy}`);
            }
        }

        _calculateTransform() {
            if(!this.transformState.startPoint || !this.transformState.currentPoint) {
                return { isValid: false };
            }
            
            const start = this.transformState.startPoint;
            const current = this.transformState.currentPoint;
            
            const dx = current.x - start.x;
            const dy = current.y - start.y;
            
            // スナップ処理
            let finalDx = dx;
            let finalDy = dy;
            
            if(this.settings.snapToGrid) {
                const grid = this.settings.gridSize;
                finalDx = Math.round(dx / grid) * grid;
                finalDy = Math.round(dy / grid) * grid;
            }
            
            return {
                isValid: Math.abs(finalDx) > 1 || Math.abs(finalDy) > 1,
                dx: finalDx,
                dy: finalDy,
                mode: this.transformState.mode,
                startPoint: { ...start },
                endPoint: { ...current }
            };
        }

        _resetTransformState() {
            this.transformState.active = false;
            this.transformState.startPoint = null;
            this.transformState.currentPoint = null;
            this.transformState.targetLayer = null;
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
                console.log('[TransformTool] Settings updated:', this.settings);
            }
        }

        setTransformMode(mode) {
            // 変形モードの切り替え（move, rotate, scale）
            if(['move', 'rotate', 'scale'].includes(mode)) {
                this.transformState.mode = mode;
                
                if(global.MyApp.debug) {
                    console.log(`[TransformTool] Mode changed to: ${mode}`);
                }
            }
        }

        // Tool インターフェース実装
        serialize() {
            return {
                id: this.id,
                settings: this.settings,
                mode: this.transformState.mode
            };
        }

        handleEvent(event) {
            // 変形ツール特有のイベントハンドリング
            switch(event.type) {
                case 'transform.setMode':
                    this.setTransformMode(event.payload.mode);
                    break;
                default:
                    if(global.MyApp.debug) {
                        console.log(`[TransformTool] Handle event: ${event.type}`);
                    }
            }
        }
    }

    global.MyApp.TransformTool = TransformTool;
})(window);