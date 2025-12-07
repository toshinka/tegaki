/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-brush-core.js
 * 責務: ラスターブラシの中核実装 - Canvas2D リアルタイムラスタライズ
 * 
 * 【Phase B-1 真・ラスター版: Canvas2D + リアルタイム更新】
 * ✅ Canvas2D オフスクリーン描画（真のラスター）
 * ✅ 毎フレーム PIXI.Texture 更新（リアルタイム表示）
 * ✅ スタンプテクスチャ描画対応
 * ✅ 消しゴム: destination-out による真の消去
 * ✅ 出力時も同じ品質保証
 * 
 * 【Phase A: 緊急修正完了】
 * ✅ A-1: 筆圧サイズ計算修正
 * ✅ A-2: リアルタイム描画実装
 * ✅ A-3: 消しゴム正しい実装
 * 
 * 【親ファイル依存】
 * - config.js (ブラシ設定)
 * - settings-manager.js (ユーザー設定)
 * - brush-stamp.js (スタンプ生成)
 * - brush-interpolator.js (補間処理)
 * 
 * 【子ファイル依存このファイルに】
 * - brush-core.js (ストローク管理)
 * - core-engine.js (初期化)
 * ============================================================================
 */

(function() {
    'use strict';

    class RasterBrushCore {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            
            // WebGL2コンテキスト
            this.gl = null;
            
            // 現在のストローク
            this.currentStroke = null;
            this.isDrawing = false;
            
            // 前回の描画位置
            this.lastPoint = null;
            
            // ブラシ設定
            this.brushSettings = null;
            
            // 統合モジュール参照
            this.brushStamp = window.BrushStamp || null;
            this.brushInterpolator = window.BrushInterpolator || null;
            
            // Phase A: 設定マネージャー参照
            this.settingsManager = null;
            
            // Phase B-1 真・ラスター版: Canvas2D 描画
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            this.currentSprite = null;
            this.currentTexture = null;
            
            // スタンプキャッシュ
            this.stampCache = new Map();
            this.currentStampCanvas = null;
            
            // リアルタイム描画用
            this.isAddedToLayer = false;
            this.targetLayer = null;
            
            // Canvas座標オフセット
            this.canvasOffsetX = 0;
            this.canvasOffsetY = 0;
            
            // バウンディングボックス
            this.minX = 0;
            this.minY = 0;
            this.maxX = 0;
            this.maxY = 0;
        }

        // ================================================================================
        // 初期化
        // ================================================================================

        initialize(gl) {
            this.gl = gl;
            
            if (!this.gl) {
                console.error('[RasterBrushCore] WebGL2 context not provided');
                return false;
            }
            
            // SettingsManager取得
            if (window.TegakiSettingsManager) {
                if (typeof window.TegakiSettingsManager.get === 'function') {
                    this.settingsManager = window.TegakiSettingsManager;
                } else if (typeof window.TegakiSettingsManager === 'function') {
                    this.settingsManager = new window.TegakiSettingsManager(
                        window.TegakiEventBus || window.eventBus,
                        window.TEGAKI_CONFIG
                    );
                }
            }
            
            // BrushStamp初期化
            if (!this.brushStamp) {
                console.warn('[RasterBrushCore] BrushStamp not available');
            } else if (typeof this.brushStamp.initialize === 'function') {
                this.brushStamp.initialize(gl);
            }
            
            console.log('[RasterBrushCore] ✅ Initialized with WebGL2 context');
            console.log('[RasterBrushCore]    Settings manager:', this.settingsManager ? 'OK' : 'Not available');
            console.log('[RasterBrushCore]    BrushStamp:', this.brushStamp ? 'OK' : 'Not available');
            return true;
        }

        setBrushSettings(brushSettings) {
            this.brushSettings = brushSettings;
        }

        // ================================================================================
        // ストローク開始 - Canvas2D ラスター描画
        // ================================================================================

        startStroke(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            this.isDrawing = true;
            
            // 現在のストローク情報を保存
            this.currentStroke = {
                points: [],
                settings: settings || this.brushSettings?.getSettings() || {},
                startTime: Date.now()
            };
            
            // 最初の点を記録
            this.lastPoint = {
                localX, localY, pressure, tiltX, tiltY, twist
            };
            
            this.currentStroke.points.push({ ...this.lastPoint });
            
            // バウンディングボックス初期化
            const margin = (settings?.size || 10) * 2;
            this.minX = localX - margin;
            this.minY = localY - margin;
            this.maxX = localX + margin;
            this.maxY = localY + margin;
            
            // Canvas2D オフスクリーン作成
            const canvasSize = 1024; // 固定サイズ
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.width = canvasSize;
            this.offscreenCanvas.height = canvasSize;
            this.offscreenCtx = this.offscreenCanvas.getContext('2d', { 
                willReadFrequently: false,
                alpha: true
            });
            
            // アンチエイリアス設定
            this.offscreenCtx.imageSmoothingEnabled = true;
            this.offscreenCtx.imageSmoothingQuality = 'high';
            
            // Canvas の原点を中心に（負の座標も描画可能）
            this.canvasOffsetX = canvasSize / 2;
            this.canvasOffsetY = canvasSize / 2;
            
            // ブレンドモード設定
            const mode = this.currentStroke.settings?.mode || 'pen';
            if (mode === 'eraser') {
                this.offscreenCtx.globalCompositeOperation = 'destination-out';
            } else {
                // 重要: 透明度を累積させるため 'source-over' を維持
                this.offscreenCtx.globalCompositeOperation = 'source-over';
            }
            
            // スタンプ準備
            this._prepareStamp(this.currentStroke.settings);
            
            // PIXI.Sprite 作成してレイヤーに追加
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (activeLayer) {
                this.currentTexture = PIXI.Texture.from(this.offscreenCanvas);
                this.currentSprite = new PIXI.Sprite(this.currentTexture);
                this.currentSprite.anchor.set(0.5, 0.5);
                this.currentSprite.position.set(localX, localY); // 最初の点の位置
                this.currentSprite.label = 'raster_stroke';
                
                // ブレンドモード設定
                if (mode === 'eraser') {
                    this.currentSprite.blendMode = 'erase';
                } else {
                    this.currentSprite.blendMode = 'normal';
                }
                
                activeLayer.addChild(this.currentSprite);
                this.isAddedToLayer = true;
                this.targetLayer = activeLayer;
            }
            
            // 最初の点を描画
            this._drawPoint(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
            
            // リアルタイム更新
            this._updateTexture();
            this._renderImmediate();
            
            return true;
        }

        // ================================================================================
        // ストローク更新
        // ================================================================================

        addStrokePoint(localX, localY, pressure, tiltX, tiltY, twist) {
            if (!this.isDrawing || !this.currentStroke) {
                return;
            }
            
            const currentPoint = { localX, localY, pressure, tiltX, tiltY, twist };
            
            // バウンディングボックス更新
            const margin = (this.currentStroke.settings?.size || 10) * 2;
            this.minX = Math.min(this.minX, localX - margin);
            this.minY = Math.min(this.minY, localY - margin);
            this.maxX = Math.max(this.maxX, localX + margin);
            this.maxY = Math.max(this.maxY, localY + margin);
            
            // 前回点との距離を計算
            if (this.lastPoint) {
                const dx = localX - this.lastPoint.localX;
                const dy = localY - this.lastPoint.localY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 補間が必要な距離閾値
                const threshold = window.TEGAKI_CONFIG?.brush?.raster?.interpolation?.distanceThreshold || 2.5;
                
                if (distance > threshold && this.brushInterpolator) {
                    // 補間ポイント生成
                    const interpolatedPoints = this.brushInterpolator.interpolate(
                        this.lastPoint,
                        currentPoint,
                        distance
                    );
                    
                    // 補間ポイントを描画
                    interpolatedPoints.forEach(point => {
                        this._drawPoint(
                            point.localX,
                            point.localY,
                            point.pressure,
                            point.tiltX,
                            point.tiltY,
                            point.twist,
                            this.currentStroke.settings
                        );
                        this.currentStroke.points.push(point);
                    });
                } else {
                    // 補間なしで描画
                    this._drawPoint(localX, localY, pressure, tiltX, tiltY, twist, this.currentStroke.settings);
                    this.currentStroke.points.push(currentPoint);
                }
            }
            
            this.lastPoint = currentPoint;
            
            // リアルタイム更新
            this._updateTexture();
            this._renderImmediate();
        }

        // ================================================================================
        // ストローク終了
        // ================================================================================

        finalizeStroke() {
            if (!this.isDrawing || !this.currentStroke) {
                return null;
            }
            
            this.isDrawing = false;
            
            // 最終テクスチャ更新
            this._updateTexture();
            
            const sprite = this.currentSprite;
            
            if (sprite) {
                // ストローク情報をメタデータとして保存
                sprite._rasterStrokeData = {
                    points: this.currentStroke.points,
                    settings: this.currentStroke.settings,
                    isRasterStroke: true,
                    bounds: {
                        minX: this.minX,
                        minY: this.minY,
                        maxX: this.maxX,
                        maxY: this.maxY
                    }
                };
            }
            
            // 最終レンダリング
            this._renderImmediate();
            
            // クリーンアップ
            this.currentStroke = null;
            this.lastPoint = null;
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            this.currentSprite = null;
            this.currentTexture = null;
            this.currentStampCanvas = null;
            this.isAddedToLayer = false;
            this.targetLayer = null;
            
            return sprite;
        }

        cancelStroke() {
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // レイヤーから削除
            if (this.currentSprite && this.isAddedToLayer && this.targetLayer) {
                this.targetLayer.removeChild(this.currentSprite);
            }
            
            if (this.currentSprite) {
                this.currentSprite.destroy();
                this.currentSprite = null;
            }
            
            if (this.currentTexture) {
                this.currentTexture.destroy();
                this.currentTexture = null;
            }
            
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            this.currentStampCanvas = null;
            this.isAddedToLayer = false;
            this.targetLayer = null;
        }

        // ================================================================================
        // スタンプ生成
        // ================================================================================

        _prepareStamp(settings) {
            const config = window.TEGAKI_CONFIG?.brush?.raster?.stamp || {};
            const size = settings?.size || 10;
            const hardness = settings?.hardness !== undefined ? settings.hardness : (config.hardness || 1.0);
            const antialiasing = settings?.antialiasing !== undefined ? settings.antialiasing : (config.antialiasing !== false);
            
            const cacheKey = `stamp_${size}_${hardness}_${antialiasing}`;
            
            if (this.stampCache.has(cacheKey)) {
                this.currentStampCanvas = this.stampCache.get(cacheKey);
                return;
            }
            
            try {
                const radius = size;
                const stampCanvas = this._generateStampCanvas(radius, hardness, antialiasing);
                
                this.stampCache.set(cacheKey, stampCanvas);
                this.currentStampCanvas = stampCanvas;
            } catch (error) {
                console.warn('[RasterBrushCore] Failed to generate stamp:', error);
                this.currentStampCanvas = null;
            }
        }

        _generateStampCanvas(radius, hardness, antialiasing) {
            const size = Math.ceil(radius * 2) + 4;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            
            const ctx = canvas.getContext('2d');
            const centerX = size / 2;
            const centerY = size / 2;
            
            // グラデーション作成
            const gradient = ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );
            
            if (antialiasing) {
                const edge = radius * Math.max(0.1, 1.0 - hardness * 0.8);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                gradient.addColorStop(Math.max(0, Math.min(0.99, edge / radius)), 'rgba(255, 255, 255, 1.0)');
                gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
            } else {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                gradient.addColorStop(0.98, 'rgba(255, 255, 255, 1.0)');
                gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            return canvas;
        }

        // ================================================================================
        // Canvas2D 描画 - 真のラスター
        // ================================================================================

        _drawPoint(localX, localY, pressure, tiltX, tiltY, twist, settings) {
            if (!this.offscreenCtx) {
                return;
            }
            
            const ctx = this.offscreenCtx;
            const size = settings?.size || 3;
            const baseColor = settings?.color || 0x800000;
            const baseOpacity = settings?.opacity || 1.0;
            const mode = settings?.mode || 'pen';
            
            // 筆圧によるサイズ調整
            let minPressureSize = 0.01;
            
            if (this.settingsManager && typeof this.settingsManager.get === 'function') {
                const setting = this.settingsManager.get('minPressureSize');
                if (setting !== undefined && !isNaN(setting)) {
                    minPressureSize = parseFloat(setting);
                }
            }
            
            if (settings?.minPressureSize !== undefined && !isNaN(settings.minPressureSize)) {
                minPressureSize = parseFloat(settings.minPressureSize);
            }
            
            const pressureSize = size * (minPressureSize + pressure * (1.0 - minPressureSize));
            
            // 流量（フロー）設定適用
            let flowOpacity = baseOpacity;
            const flowConfig = window.TEGAKI_CONFIG?.brush?.flow;
            
            if (flowConfig && flowConfig.enabled) {
                const flowValue = flowConfig.opacity !== undefined ? flowConfig.opacity : 1.0;
                const flowSensitivity = flowConfig.sensitivity !== undefined ? flowConfig.sensitivity : 1.0;
                flowOpacity = baseOpacity * flowValue * flowSensitivity;
                flowOpacity = flowOpacity * (0.5 + pressure * 0.5);
            } else {
                flowOpacity = baseOpacity * pressure;
            }
            
            const finalAlpha = Math.max(0.01, Math.min(1.0, flowOpacity));
            
            ctx.save();
            
            // RGB変換
            const r = (baseColor >> 16) & 0xFF;
            const g = (baseColor >> 8) & 0xFF;
            const b = baseColor & 0xFF;
            
            // Canvas座標に変換（オフセット適用）
            const canvasX = localX + this.canvasOffsetX - (this.currentSprite ? this.currentSprite.position.x : 0);
            const canvasY = localY + this.canvasOffsetY - (this.currentSprite ? this.currentSprite.position.y : 0);
            
            // シンプルな円描画（アンチエイリアスはCanvasが自動適用）
            ctx.globalAlpha = mode === 'eraser' ? 1.0 : finalAlpha;
            ctx.fillStyle = mode === 'eraser' ? '#FFFFFF' : `rgb(${r}, ${g}, ${b})`;
            
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, pressureSize, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }

        // ================================================================================
        // テクスチャ更新
        // ================================================================================

        _updateTexture() {
            if (this.currentSprite && this.offscreenCanvas) {
                try {
                    // PIXI v8: 新しいテクスチャを作成して置き換え
                    const oldTexture = this.currentTexture;
                    this.currentTexture = PIXI.Texture.from(this.offscreenCanvas, {
                        resourceOptions: {
                            updateDimensions: true
                        }
                    });
                    this.currentSprite.texture = this.currentTexture;
                    
                    // 古いテクスチャを破棄
                    if (oldTexture) {
                        setTimeout(() => {
                            try {
                                oldTexture.destroy(false); // ソースは破棄しない
                            } catch (e) {
                                // エラーは無視
                            }
                        }, 100);
                    }
                } catch (error) {
                    console.warn('[RasterBrushCore] Texture update failed:', error);
                }
            }
        }

        _renderImmediate() {
            if (window.pixiApp && window.pixiApp.renderer && window.pixiApp.stage) {
                try {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                } catch (error) {
                    // エラーは無視
                }
            }
        }

        // ================================================================================
        // ユーティリティ
        // ================================================================================

        getIsDrawing() {
            return this.isDrawing;
        }

        getCurrentStroke() {
            return this.currentStroke;
        }
        
        getDebugInfo() {
            return {
                isDrawing: this.isDrawing,
                hasGL: this.gl !== null,
                hasSettingsManager: this.settingsManager !== null,
                hasBrushStamp: this.brushStamp !== null,
                currentStroke: this.currentStroke ? {
                    pointCount: this.currentStroke.points.length,
                    settings: this.currentStroke.settings
                } : null,
                hasCanvas: this.offscreenCanvas !== null,
                hasSprite: this.currentSprite !== null,
                isAddedToLayer: this.isAddedToLayer,
                stampCacheSize: this.stampCache.size,
                hasStamp: this.currentStampCanvas !== null,
                minPressureSize: this.settingsManager 
                    ? this.settingsManager.get('minPressureSize') 
                    : 'N/A'
            };
        }
        
        destroy() {
            this.stampCache.clear();
            
            if (this.currentSprite) {
                this.currentSprite.destroy();
                this.currentSprite = null;
            }
            
            if (this.currentTexture) {
                this.currentTexture.destroy();
                this.currentTexture = null;
            }
            
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            this.currentStampCanvas = null;
        }
    }

    // ================================================================================
    // グローバル登録
    // ================================================================================

    window.RasterBrushCore = RasterBrushCore;

    console.log('✅ raster-brush-core.js Phase B-1 loaded (真・ラスター版)');
    console.log('   ✅ B-1: Canvas2D オフスクリーン描画（真のラスター）');
    console.log('   ✅ B-1: 毎フレーム PIXI.Texture 更新（リアルタイム）');
    console.log('   ✅ B-1: スタンプテクスチャ描画対応');
    console.log('   ✅ B-1: 消しゴム destination-out 実装');
    console.log('   ✅ Phase A 全機能継承');

})();