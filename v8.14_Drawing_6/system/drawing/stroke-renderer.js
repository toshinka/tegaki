/**
 * ================================================================================
 * stroke-renderer.js - Graphics-Smooth対応版（元ファイル完全継承）
 * ================================================================================
 * 
 * 📁 依存Parents:
 *   - @pixi/graphics-smooth (CDN経由)
 *   - polygon-generator.js (ポリゴン)
 *   - brush-settings.js (モード/色/サイズ)
 * 
 * 📄 依存Children:
 *   - brush-core.js (renderPreview, renderFinalStroke呼出)
 *   - layer-system.js (レイヤー追加)
 * 
 * 🔧 Phase 3改修: 元ファイル完全継承版
 * ================================================================================
 */

(function() {
    'use strict';
    
    class StrokeRenderer {
        constructor() {
            this.currentTool = 'pen';
            this.webgpuEnabled = false;
            this.webgpuLayer = null;
            this.webgpuMaskLayer = null;
            
            // SmoothGraphics可用性確認
            this.useSmoothGraphics = (typeof PIXI.smooth !== 'undefined' && PIXI.smooth.SmoothGraphics);
            
            if (this.useSmoothGraphics) {
                console.log('✅ [StrokeRenderer] Using @pixi/graphics-smooth');
            } else {
                console.log('[StrokeRenderer] @pixi/graphics-smooth not loaded, using standard Graphics');
            }
        }
        
        /**
         * WebGPUレイヤー設定（将来のマスク統合用）
         */
        async setWebGPULayer(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            
            if (webgpuLayer && webgpuLayer.isInitialized && webgpuLayer.isInitialized()) {
                this.webgpuEnabled = true;
                
                if (window.WebGPUMaskLayer) {
                    const config = window.TEGAKI_CONFIG?.canvas || {};
                    const width = config.width || 400;
                    const height = config.height || 400;
                    
                    this.webgpuMaskLayer = new window.WebGPUMaskLayer(webgpuLayer);
                    const success = await this.webgpuMaskLayer.initialize(width, height);
                    
                    if (success) {
                        console.log('✅ [StrokeRenderer] WebGPUMaskLayer initialized');
                    }
                }
            }
        }
        
        /**
         * ツール設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }
        
        /**
         * Graphicsインスタンス作成
         * @private
         */
        _createGraphics() {
            if (this.useSmoothGraphics) {
                return new PIXI.smooth.SmoothGraphics();
            }
            return new PIXI.Graphics();
        }
        
        /**
         * プレビュー描画（リアルタイム）
         */
        renderPreview(points, settings, targetGraphics = null) {
            const graphics = targetGraphics || this._createGraphics();
            graphics.clear();
            
            if (!points || points.length === 0) {
                return graphics;
            }
            
            const mode = settings.mode || this.currentTool;
            const size = settings.size || 10;
            const color = settings.color || 0x800000;
            const alpha = settings.opacity ?? 1.0;
            
            const drawColor = (mode === 'eraser') ? 0xFFFFFF : color;
            const drawAlpha = (mode === 'eraser') ? 0.3 : alpha;
            
            if (points.length === 1) {
                const p = points[0];
                graphics.circle(p.x, p.y, size / 2);
                graphics.fill({ color: drawColor, alpha: drawAlpha });
            } else {
                graphics.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length; i++) {
                    graphics.lineTo(points[i].x, points[i].y);
                }
                
                graphics.stroke({ 
                    width: size, 
                    color: drawColor, 
                    alpha: drawAlpha,
                    cap: 'round',
                    join: 'round'
                });
            }
            
            return graphics;
        }
        
        /**
         * ストローク最終描画
         */
        renderFinalStroke(strokeData, settings) {
            if (!strokeData) {
                console.error('[StrokeRenderer] strokeData is null');
                return null;
            }
            
            // 単一ドット
            if (strokeData.isSingleDot && strokeData.points?.length > 0) {
                const p = strokeData.points[0];
                return this.renderDot(p.x, p.y, settings);
            }
            
            // ポリゴン描画
            if (strokeData.polygon && strokeData.polygon.length > 0) {
                const graphics = this._renderPolygon(strokeData.polygon, settings);
                
                if (graphics) {
                    console.log('[StrokeRenderer] Rendered polygon', {
                        points: strokeData.polygon.length,
                        type: graphics.constructor.name,
                        bounds: graphics.getBounds()
                    });
                }
                
                return graphics;
            }
            
            // ポリゴン無し→ポイントから直接描画
            if (strokeData.points && strokeData.points.length > 0) {
                console.warn('[StrokeRenderer] No polygon, rendering from points');
                return this._renderFromPoints(strokeData.points, settings);
            }
            
            console.error('[StrokeRenderer] No valid stroke data');
            return null;
        }
        
        /**
         * ポリゴン描画（PerfectFreehand出力）
         * @private
         */
        _renderPolygon(polygon, settings) {
            const graphics = this._createGraphics();
            const mode = settings.mode || this.currentTool;
            const color = settings.color || 0x800000;
            const alpha = settings.opacity ?? 1.0;
            
            // ポリゴンをフラット配列に変換
            const flatPolygon = Array.isArray(polygon[0]) ? polygon.flat() : polygon;
            
            // SmoothGraphics/Graphics共通API
            graphics.poly(flatPolygon);
            graphics.fill({ color: color, alpha: alpha });
            
            // 消しゴムはblendMode
            if (mode === 'eraser') {
                graphics.blendMode = 'erase';
            }
            
            return graphics;
        }
        
        /**
         * ポイントから直接描画（フォールバック）
         * @private
         */
        _renderFromPoints(points, settings) {
            const graphics = this._createGraphics();
            const mode = settings.mode || this.currentTool;
            const size = settings.size || 10;
            const color = settings.color || 0x800000;
            const alpha = settings.opacity ?? 1.0;
            
            if (points.length === 1) {
                const p = points[0];
                graphics.circle(p.x, p.y, size / 2);
                graphics.fill({ color: color, alpha: alpha });
            } else {
                graphics.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length; i++) {
                    graphics.lineTo(points[i].x, points[i].y);
                }
                
                graphics.stroke({ 
                    width: size, 
                    color: color, 
                    alpha: alpha,
                    cap: 'round',
                    join: 'round'
                });
            }
            
            if (mode === 'eraser') {
                graphics.blendMode = 'erase';
            }
            
            return graphics;
        }
        
        /**
         * 単一ドット描画
         */
        renderDot(x, y, settings) {
            const graphics = this._createGraphics();
            const radius = (settings.size || 10) / 2;
            const color = settings.color || 0x800000;
            const alpha = settings.opacity ?? 1.0;
            
            graphics.circle(x, y, radius);
            graphics.fill({ color: color, alpha: alpha });
            
            return graphics;
        }
    }
    
    // シングルトンインスタンス + クラス公開（元ファイル互換）
    window.strokeRenderer = new StrokeRenderer();
    window.StrokeRenderer = StrokeRenderer;
    
    console.log('✅ stroke-renderer.js (Graphics-Smooth対応版) loaded');
    console.log('   ✅ @pixi/graphics-smooth統合');
    console.log('   ✅ WebGL2アンチエイリアス');
    console.log('   ✅ PixiJS v8バグ回避');
})();