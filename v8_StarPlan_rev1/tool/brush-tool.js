/**
 * tools/brush-tool.js - BrushTool 衛星
 * ベクターペン描画フローの実装
 */

window.MyApp = window.MyApp || {};

window.MyApp.BrushTool = class BrushTool {
    constructor() {
        this.id = 'brush';
        this.name = 'ベクターペン';
        this.mainController = null;
        
        // ツール設定
        this.settings = {
            size: 16.0,
            color: 0x800000, // futaba-maroon
            opacity: 0.85,
            minDistance: 1.5 // 点間の最小距離
        };
        
        // 描画状態
        this.strokeState = {
            active: false,
            points: [],
            layerId: null,
            startTime: null,
            currentStroke: null
        };
        
        this.debug = false;
    }

    // 主星との接続
    async register(mainController) {
        this.mainController = mainController;
        this.debug = window.MyApp.config?.debug || false;
        
        if (this.debug) console.log('[BrushTool] Registered with MainController');
        return true;
    }

    // 描画開始
    start(point, meta = {}) {
        try {
            if (this.strokeState.active) {
                this.cancel(); // 既存のストロークをキャンセル
            }
            
            // 状態初期化
            this.strokeState = {
                active: true,
                points: [{ x: point.x, y: point.y }],
                layerId: meta.layerId || null,
                startTime: Date.now(),
                currentStroke: {
                    id: `brush_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    toolId: this.id,
                    layerId: meta.layerId,
                    color: this.settings.color,
                    size: this.settings.size,
                    opacity: this.settings.opacity,
                    points: [{ x: point.x, y: point.y }]
                }
            };
            
            // DrawingEngine に一時描画開始を通知
            this.drawTemporary();
            
            if (this.debug) {
                console.log(`[BrushTool] Drawing started at (${point.x}, ${point.y})`);
            }
            
            return this.strokeState.currentStroke;
            
        } catch (error) {
            this.reportError('BRUSH_START_ERROR', 'Failed to start brush stroke', {
                point, meta, error: error.message
            });
            return false;
        }
    }

    // 描画継続
    move(point, meta = {}) {
        if (!this.strokeState.active) {
            return false;
        }
        
        try {
            const lastPoint = this.strokeState.points[this.strokeState.points.length - 1];
            const distance = Math.sqrt(
                (point.x - lastPoint.x) ** 2 + 
                (point.y - lastPoint.y) ** 2
            );
            
            // 最小距離チェック
            if (distance < this.settings.minDistance) {
                return true; // 距離が短すぎる場合はスキップ
            }
            
            // 点を追加
            this.strokeState.points.push({ x: point.x, y: point.y });
            this.strokeState.currentStroke.points.push({ x: point.x, y: point.y });
            
            // DrawingEngine に一時描画更新を通知
            this.drawTemporary();
            
            return true;
            
        } catch (error) {
            this.reportError('BRUSH_MOVE_ERROR', 'Failed to continue brush stroke', {
                point, meta, error: error.message
            });
            return false;
        }
    }

    // 描画終了
    end(point, meta = {}) {
        if (!this.strokeState.active) {
            return false;
        }

        try {
            // 最終点を追加
            if (point) {
                const lastPoint = this.strokeState.points[this.strokeState.points.length - 1];
                const distance = Math.sqrt(
                    (point.x - lastPoint.x) ** 2 + 
                    (point.y - lastPoint.y) ** 2
                );
                
                if (distance >= this.settings.minDistance) {
                    this.strokeState.points.push({ x: point.x, y: point.y });
                    this.strokeState.currentStroke.points.push({ x: point.x, y: point.y });
                }
            }
            
            // ストロークが有効か確認（最低2点必要）
            if (this.strokeState.points.length < 1) {
                this.cancel();
                return false;
            }
            
            // DrawingEngine にストローク確定を依頼
            const result = this.commitStroke();
            
            // 状態リセット
            const completedStroke = this.strokeState.currentStroke;
            this.strokeState = {
                active: false,
                points: [],
                layerId: null,
                startTime: null,
                currentStroke: null
            };
            
            if (this.debug) {
                console.log(`[BrushTool] Drawing ended, ${completedStroke.points.length} points`);
            }
            
            return result;
            
        } catch (error) {
            this.reportError('BRUSH_END_ERROR', 'Failed to end brush stroke', {
                point, meta, error: error.message
            });
            this.cancel();
            return false;
        }
    }

    // 描画キャンセル
    cancel(meta = {}) {
        if (!this.strokeState.active) {
            return;
        }
        
        try {
            // DrawingEngine の一時描画をクリア
            if (this.strokeState.layerId) {
                const drawingEngine = this.mainController.getSatellite('DrawingEngine');
                if (drawingEngine) {
                    // 一時描画のクリア（LayerService経由）
                    const layerService = this.mainController.getSatellite('LayerService');
                    if (layerService) {
                        const layer = layerService.getLayer(this.strokeState.layerId);
                        if (layer && layer.tempGraphics) {
                            layer.tempGraphics.clear();
                        }
                    }
                }
            }
            
            // 状態リセット
            this.strokeState = {
                active: false,
                points: [],
                layerId: null,
                startTime: null,
                currentStroke: null
            };
            
            if (this.debug) {
                console.log('[BrushTool] Drawing cancelled');
            }
            
        } catch (error) {
            this.reportError('BRUSH_CANCEL_ERROR', 'Failed to cancel brush stroke', {
                meta, error: error.message
            });
            
            // 強制リセット
            this.strokeState = {
                active: false,
                points: [],
                layerId: null,
                startTime: null,
                currentStroke: null
            };
        }
    }

    // 一時描画
    drawTemporary() {
        if (!this.strokeState.active || !this.strokeState.layerId) {
            return;
        }
        
        try {
            const drawingEngine = this.mainController.getSatellite('DrawingEngine');
            if (!drawingEngine) {
                throw new Error('DrawingEngine not available');
            }
            
            drawingEngine.drawTemporaryStroke(
                this.strokeState.layerId,
                this.strokeState.points,
                this.settings.color,
                this.settings.size,
                this.settings.opacity
            );
            
        } catch (error) {
            this.reportError('BRUSH_TEMP_DRAW_ERROR', 'Failed to draw temporary stroke', {
                error: error.message
            });
        }
    }

    // ストローク確定
    commitStroke() {
        if (!this.strokeState.active || !this.strokeState.layerId) {
            return false;
        }
        
        try {
            const drawingEngine = this.mainController.getSatellite('DrawingEngine');
            if (!drawingEngine) {
                throw new Error('DrawingEngine not available');
            }
            
            const strokeData = drawingEngine.commitStroke(
                this.strokeState.layerId,
                this.strokeState.points,
                this.settings.color,
                this.settings.size,
                this.settings.opacity
            );
            
            return strokeData;
            
        } catch (error) {
            this.reportError('BRUSH_COMMIT_ERROR', 'Failed to commit stroke', {
                error: error.message
            });
            return false;
        }
    }

    // シリアライズ
    serialize() {
        if (!this.strokeState.currentStroke) {
            return null;
        }
        
        return {
            toolId: this.id,
            strokeData: {
                ...this.strokeState.currentStroke,
                duration: Date.now() - this.strokeState.startTime,
                settings: { ...this.settings }
            }
        };
    }

    // 設定取得
    getSettings() {
        return { ...this.settings };
    }

    // 設定更新
    updateSettings(newSettings) {
        const validKeys = ['size', 'color', 'opacity', 'minDistance'];
        
        for (const key in newSettings) {
            if (validKeys.includes(key) && newSettings[key] !== undefined) {
                switch (key) {
                    case 'size':
                        this.settings.size = Math.max(0.1, Math.min(100, Number(newSettings.size) || 16.0));
                        break;
                    case 'color':
                        this.settings.color = Number(newSettings.color) || 0x800000;
                        break;
                    case 'opacity':
                        this.settings.opacity = Math.max(0, Math.min(1, Number(newSettings.opacity) || 0.85));
                        break;
                    case 'minDistance':
                        this.settings.minDistance = Math.max(0.1, Number(newSettings.minDistance) || 1.5);
                        break;
                }
            }
        }
        
        if (this.debug) {
            console.log('[BrushTool] Settings updated:', this.settings);
        }
    }

    // ツール情報取得
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            type: 'drawing',
            settings: this.getSettings(),
            state: {
                active: this.strokeState.active,
                pointCount: this.strokeState.points.length
            }
        };
    }

    // ブラシサイズ設定（UIから呼び出し用）
    setBrushSize(size) {
        this.updateSettings({ size: size });
    }

    // ブラシ不透明度設定（UIから呼び出し用）
    setBrushOpacity(opacity) {
        this.updateSettings({ opacity: opacity });
    }

    // ブラシ色設定（UIから呼び出し用）
    setBrushColor(color) {
        this.updateSettings({ color: color });
    }

    // プレビュー用のカーソル情報取得
    getCursorInfo() {
        return {
            type: 'circle',
            size: this.settings.size,
            color: this.settings.color,
            opacity: this.settings.opacity * 0.5 // プレビューは半透明
        };
    }

    // ツール固有の統計情報
    getStats() {
        return {
            toolId: this.id,
            settings: this.getSettings(),
            currentStroke: this.strokeState.active ? {
                pointCount: this.strokeState.points.length,
                duration: this.strokeState.startTime ? Date.now() - this.strokeState.startTime : 0,
                layerId: this.strokeState.layerId
            } : null
        };
    }

    // パフォーマンス最適化用の点間引き
    optimizePoints(points, threshold = 2.0) {
        if (points.length <= 2) return points;
        
        const optimized = [points[0]]; // 開始点は常に含める
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = optimized[optimized.length - 1];
            const curr = points[i];
            const distance = Math.sqrt(
                (curr.x - prev.x) ** 2 + 
                (curr.y - prev.y) ** 2
            );
            
            if (distance >= threshold) {
                optimized.push(curr);
            }
        }
        
        optimized.push(points[points.length - 1]); // 終了点は常に含める
        
        return optimized;
    }

    // エラー報告ヘルパー
    reportError(code, message, context) {
        if (this.mainController) {
            this.mainController.notify({
                type: 'error',
                payload: { code, message, context }
            });
        } else {
            console.error(`[BrushTool] ${code}: ${message}`, context);
        }
    }

    // 破棄処理
    destroy() {
        try {
            if (this.strokeState.active) {
                this.cancel();
            }
            
            this.strokeState = {
                active: false,
                points: [],
                layerId: null,
                startTime: null,
                currentStroke: null
            };
            
            if (this.debug) {
                console.log('[BrushTool] Destroyed');
            }
            
        } catch (error) {
            console.error('[BrushTool] Error during destruction:', error);
        }
    }
};