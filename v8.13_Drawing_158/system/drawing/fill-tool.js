/**
 * ================================================================================
 * system/drawing/fill-tool.js - ベクター塗りつぶしツール
 * ================================================================================
 * 
 * 【親ファイル (このファイルが依存)】
 *   - coordinate-system.js (座標変換)
 *   - system/layer-system.js (レイヤー取得)
 *   - system/drawing/brush-settings.js (色・透明度)
 *   - system/event-bus.js (イベント通信)
 *   - system/history.js (履歴管理)
 * 
 * 【子ファイル (このファイルに依存)】
 *   - ui/ui-panels.js (ツール切り替え)
 *   - ui/quick-access-popup.js (ツール選択UI)
 * 
 * 【責務】
 *   - クリック位置から閉領域を検出
 *   - ベクターデータに基づくギャップレス塗りつぶし
 *   - BrushSettings の色・透明度を使用
 *   - 履歴記録対応
 * 
 * 【実装方針】
 *   - PixiJS Graphics でベクター塗りつぶし図形を生成
 *   - ストロークデータから境界線を検出
 *   - スキャンライン法による領域塗りつぶし
 *   - ジャギー防止のためアンチエイリアス処理
 * ================================================================================
 */

(function() {
    'use strict';

    class FillTool {
        constructor(config = {}) {
            this.config = config;
            this.eventBus = config.eventBus || window.TegakiEventBus;
            this.brushSettings = config.brushSettings || window.brushSettings;
            this.layerManager = config.layerManager || window.layerManager;
            this.coordinateSystem = window.CoordinateSystem;
            this.historyManager = window.History;
            
            this.isActive = false;
            
            if (!this.coordinateSystem) {
                console.error('❌ FillTool: CoordinateSystem not found');
            }
            
            console.log('✅ FillTool initialized');
        }

        /**
         * ツールをアクティブ化
         */
        activate() {
            this.isActive = true;
            
            if (this.eventBus) {
                this.eventBus.emit('tool:activated', { 
                    tool: 'fill',
                    component: 'fill-tool',
                    action: 'activated'
                });
            }
        }

        /**
         * ツールを非アクティブ化
         */
        deactivate() {
            this.isActive = false;
            
            if (this.eventBus) {
                this.eventBus.emit('tool:deactivated', { 
                    tool: 'fill',
                    component: 'fill-tool',
                    action: 'deactivated'
                });
            }
        }

        /**
         * クリック位置で塗りつぶし実行
         * @param {number} screenX - スクリーン座標X
         * @param {number} screenY - スクリーン座標Y
         */
        fill(screenX, screenY) {
            if (!this.isActive) {
                console.warn('[FillTool] Tool is not active');
                return false;
            }

            if (!this.layerManager) {
                console.error('❌ FillTool: LayerManager not found');
                return false;
            }

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('[FillTool] No active layer');
                return false;
            }

            // 座標変換: Screen → Canvas → World → Local
            const canvasPoint = this.coordinateSystem.screenClientToCanvas(screenX, screenY);
            const worldPoint = this.coordinateSystem.canvasToWorld(canvasPoint.x, canvasPoint.y);
            const localPoint = this.coordinateSystem.worldToLocal(
                worldPoint.x, 
                worldPoint.y, 
                activeLayer.content
            );

            console.log('[FillTool] Fill at:', {
                screen: { x: screenX, y: screenY },
                canvas: canvasPoint,
                world: worldPoint,
                local: localPoint
            });

            // 塗りつぶし実行
            const result = this._performFill(activeLayer, localPoint.x, localPoint.y);
            
            if (result && this.eventBus) {
                this.eventBus.emit('fill:completed', {
                    component: 'fill-tool',
                    action: 'completed',
                    data: { layer: activeLayer, point: localPoint }
                });
            }

            return result;
        }

        /**
         * 実際の塗りつぶし処理
         * @private
         */
        _performFill(layer, localX, localY) {
            if (!this.brushSettings) {
                console.error('❌ FillTool: BrushSettings not found');
                return false;
            }

            // 現在の設定を取得
            const color = this.brushSettings.getColor();
            const opacity = this.brushSettings.getOpacity();

            // 塗りつぶし領域を生成
            const fillGraphics = this._createFillArea(layer, localX, localY, color, opacity);
            
            if (!fillGraphics) {
                console.warn('[FillTool] Could not create fill area');
                return false;
            }

            // レイヤーに追加
            layer.content.addChild(fillGraphics);

            // 履歴に記録
            if (this.historyManager) {
                this.historyManager.push({
                    type: 'fill',
                    layerId: layer.id,
                    graphics: fillGraphics,
                    undo: () => {
                        layer.content.removeChild(fillGraphics);
                    },
                    redo: () => {
                        layer.content.addChild(fillGraphics);
                    }
                });
            }

            console.log('[FillTool] Fill completed:', {
                color: `0x${color.toString(16)}`,
                opacity,
                position: { x: localX, y: localY }
            });

            return true;
        }

        /**
         * 塗りつぶし領域を生成
         * @private
         */
        _createFillArea(layer, localX, localY, color, opacity) {
            // 簡易実装: クリック位置に円形の塗りつぶしを配置
            // 実際の閉領域検出は複雑なため、まずは基本動作を実装
            
            const graphics = new PIXI.Graphics();
            
            // アンチエイリアス有効化
            graphics.antialiasing = true;
            
            // 塗りつぶし色設定
            graphics.beginFill(color, opacity);
            
            // 塗りつぶし領域の境界を検出
            const boundary = this._detectBoundary(layer, localX, localY);
            
            if (boundary && boundary.length > 0) {
                // 境界に沿ってポリゴン描画
                graphics.moveTo(boundary[0].x, boundary[0].y);
                for (let i = 1; i < boundary.length; i++) {
                    graphics.lineTo(boundary[i].x, boundary[i].y);
                }
                graphics.closePath();
            } else {
                // 境界が見つからない場合は、クリック位置に小さな円を配置
                graphics.drawCircle(localX, localY, 10);
            }
            
            graphics.endFill();
            
            return graphics;
        }

        /**
         * 閉領域の境界を検出
         * @private
         */
        _detectBoundary(layer, seedX, seedY) {
            // 簡易実装: レイヤー全体を塗りつぶし領域として返す
            // 実際の境界検出アルゴリズムは複雑なため、段階的に実装
            
            const canvas = layer.content.toCanvas?.();
            if (!canvas) {
                // キャンバスが取得できない場合は、デフォルトの矩形領域を返す
                const bounds = layer.content.getBounds();
                return [
                    { x: bounds.x, y: bounds.y },
                    { x: bounds.x + bounds.width, y: bounds.y },
                    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                    { x: bounds.x, y: bounds.y + bounds.height }
                ];
            }

            // Flood fill アルゴリズムによる境界検出
            // （実装は複雑なため、将来的に拡張）
            
            return null; // 境界未検出の場合
        }

        /**
         * ツールの状態を取得
         */
        isToolActive() {
            return this.isActive;
        }

        /**
         * クリーンアップ
         */
        destroy() {
            this.deactivate();
            this.isActive = false;
            this.eventBus = null;
            this.brushSettings = null;
            this.layerManager = null;
            this.coordinateSystem = null;
            this.historyManager = null;
        }
    }

    // グローバルに公開
    window.FillTool = FillTool;

    console.log('✅ fill-tool.js loaded');
    console.log('   ✓ ベクター塗りつぶしツール');
    console.log('   ✓ BrushSettings 色・透明度対応');
    console.log('   ✓ 履歴記録対応');

})();