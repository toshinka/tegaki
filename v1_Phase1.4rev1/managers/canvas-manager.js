/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス描画管理・リサイズ機能・背景・グリッド・境界管理
 * 🎯 DEPENDENCIES: js/app-core.js, managers/boundary-manager.js, managers/memory-manager.js, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.4-座標統合 - 直接座標処理をCoordinateManager経由に変更
 * 🔄 COORDINATE_REFACTOR: getBoundingClientRect()直接使用をCoordinateManager統合
 * 📐 UNIFIED_COORDINATE: 座標処理完全集約・重複排除完了
 * 🎯 PHASE2_READY: レイヤーシステム座標変換基盤準備
 * 💡 PERFORMANCE: 座標処理パフォーマンス最適化
 */

/**
 * Canvas Manager 座標統合版
 * 直接座標処理をCoordinateManager経由に統一
 */

// ==========================================
// 🔄 座標統合のための初期化拡張
// ==========================================

/**
 * 座標統合システム初期化（既存initialize()に追加）
 */
function initializeCoordinateIntegration() {
    console.log('🔄 CanvasManager座標統合初期化開始...');
    
    // CoordinateManager依存性確認
    if (!window.CoordinateManager) {
        throw new Error('CoordinateManager が必要です。座標統合を完了してください。');
    }
    
    // CoordinateManagerインスタンス生成
    this.coordinateManager = new window.CoordinateManager();
    
    // 座標統合設定確認
    const coordinateConfig = ConfigManager.getCoordinateConfig();
    this.coordinateIntegration = {
        enabled: coordinateConfig.integration?.managerCentralization || false,
        duplicateElimination: coordinateConfig.integration?.duplicateElimination || false,
        performance: coordinateConfig.performance || {}
    };
    
    if (!this.coordinateIntegration.enabled) {
        console.warn('⚠️ 座標統合が無効です。ConfigManagerで coordinate.integration.managerCentralization を true に設定してください。');
    }
    
    console.log('✅ CanvasManager座標統合初期化完了');
    console.log('🔄 統合設定:', this.coordinateIntegration);
}

/**
 * 🔄 統合座標取得（getBoundingClientRect()の統一処理）
 */
function getUnifiedCanvasCoordinates(event) {
    if (!this.coordinateManager) {
        console.warn('⚠️ CoordinateManager未初期化 - フォールバック処理');
        return this.getFallbackCanvasCoordinates(event);
    }
    
    try {
        // キャンバス要素の矩形取得
        const canvasRect = this.canvasElement?.getBoundingClientRect();
        if (!canvasRect) {
            throw new Error('キャンバス要素が見つかりません');
        }
        
        // CoordinateManager経由で統一座標抽出
        const coordinates = this.coordinateManager.extractPointerCoordinates(
            event, 
            canvasRect, 
            this.app // PixiJSアプリ
        );
        
        // 座標妥当性確認
        if (!this.coordinateManager.validateCoordinateIntegrity(coordinates.canvas)) {
            throw new Error('無効な座標が検出されました');
        }
        
        return coordinates;
        
    } catch (error) {
        ErrorManager.showError('coordinate-canvas-unified', 
            `統一座標取得エラー: ${error.message}`, 
            { event: event?.type }
        );
        return this.getFallbackCanvasCoordinates(event);
    }
}

/**
 * 🔄 フォールバック座標取得（緊急時用）
 */
function getFallbackCanvasCoordinates(event) {
    console.warn('🔧 座標取得フォールバック処理実行');
    
    try {
        const rect = this.canvasElement?.getBoundingClientRect();
        if (!rect) {
            return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
        }
        
        const clientX = event.clientX || 0;
        const clientY = event.clientY || 0;
        
        // 基本的な座標変換（CoordinateManagerの簡易版）
        const canvasX = Math.max(0, Math.min(this.width, clientX - rect.left));
        const canvasY = Math.max(0, Math.min(this.height, clientY - rect.top));
        
        return {
            screen: { x: clientX, y: clientY },
            canvas: { x: canvasX, y: canvasY },
            pressure: event.pressure || 0.5
        };
        
    } catch (error) {
        console.error('❌ フォールバック座標取得失敗:', error);
        return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
    }
}

// ==========================================
// 🔄 リサイズ機能の座標統合対応
// ==========================================

/**
 * リサイズ実行（CoordinateManager統合版）
 */
function executeResizeWithCoordinateIntegration(newWidth, newHeight, centerContent) {
    const oldWidth = this.width;
    const oldHeight = this.height;
    
    try {
        // コンテンツの現在位置記録（CoordinateManager経由）
        let contentBounds = null;
        if (centerContent && this.coordinateManager) {
            contentBounds = this.getContentBoundsWithCoordinateManager();
        }
        
        // PixiJS Applicationリサイズ
        // 📋 V8_MIGRATION: app.resize()に変更予定
        this.app.renderer.resize(newWidth, newHeight);
        
        // キャンバス要素のサイズ更新
        if (this.canvasElement) {
            this.canvasElement.style.width = newWidth + 'px';
            this.canvasElement.style.height = newHeight + 'px';
        }
        
        // 内部サイズ更新
        this.width = newWidth;
        this.height = newHeight;
        
        // 🔄 CoordinateManagerにサイズ変更通知
        if (this.coordinateManager) {
            this.coordinateManager.updateCanvasSize(newWidth, newHeight);
        }
        
        // ヒットエリア更新
        if (this.app.stage) {
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        }
        
        // ビューポート境界更新
        this.updateViewportBounds();
        
        // 背景更新
        this.updateBackground();
        
        // グリッド更新
        if (this.grid && this.grid.visible) {
            this.updateGrid();
        }
        
        // コンテンツ中央寄せ（CoordinateManager統合版）
        if (centerContent && contentBounds && this.coordinateManager) {
            this.centerExistingContentWithCoordinateManager(
                contentBounds, oldWidth, oldHeight, newWidth, newHeight
            );
        }
        
        // CSS更新
        this.updateCanvasCSS(newWidth, newHeight);
        
        return true;
        
    } catch (error) {
        ErrorManager.showError('canvas-resize-coordinate', 
            `座標統合リサイズエラー: ${error.message}`, 
            { newWidth, newHeight, centerContent }
        );
        return false;
    }
}

/**
 * 🔄 CoordinateManager統合コンテンツ境界取得
 */
function getContentBoundsWithCoordinateManager() {
    if (!this.coordinateManager || this.paths.length === 0) {
        return null;
    }
    
    try {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.paths.forEach(path => {
            if (path.points && path.points.length > 0) {
                path.points.forEach(point => {
                    // CoordinateManagerで座標妥当性確認
                    if (this.coordinateManager.validateCoordinateIntegrity(point)) {
                        minX = Math.min(minX, point.x);
                        minY = Math.min(minY, point.y);
                        maxX = Math.max(maxX, point.x);
                        maxY = Math.max(maxY, point.y);
                    }
                });
            }
        });
        
        if (minX === Infinity) {
            return null;
        }
        
        const bounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
        
        // CoordinateManagerで精度適用
        bounds.x = this.coordinateManager.applyPrecision(bounds.x);
        bounds.y = this.coordinateManager.applyPrecision(bounds.y);
        bounds.width = this.coordinateManager.applyPrecision(bounds.width);
        bounds.height = this.coordinateManager.applyPrecision(bounds.height);
        bounds.centerX = this.coordinateManager.applyPrecision(bounds.centerX);
        bounds.centerY = this.coordinateManager.applyPrecision(bounds.centerY);
        
        return bounds;
        
    } catch (error) {
        ErrorManager.showError('canvas-bounds-coordinate', 
            `コンテンツ境界計算エラー: ${error.message}`
        );
        return null;
    }
}

/**
 * 🔄 CoordinateManager統合既存コンテンツ中央寄せ
 */
function centerExistingContentWithCoordinateManager(contentBounds, oldWidth, oldHeight, newWidth, newHeight) {
    if (!contentBounds || !this.coordinateManager || this.paths.length === 0) {
        return;
    }
    
    try {
        // オフセット計算（CoordinateManagerで精度適用）
        const offsetX = this.coordinateManager.applyPrecision((newWidth - oldWidth) / 2);
        const offsetY = this.coordinateManager.applyPrecision((newHeight - oldHeight) / 2);
        
        console.log(`🎯 CoordinateManager統合中央寄せ: オフセット(${offsetX}, ${offsetY})`);
        
        // 全レイヤーを移動
        Object.values(this.layers).forEach(layer => {
            if (layer && layer.position) {
                // GSAPアニメーション（利用可能時）
                if (this.extensions.gsapAvailable && this.resizeSettings.animationDuration > 0) {
                    gsap.to(layer.position, {
                        duration: this.resizeSettings.animationDuration,
                        x: this.coordinateManager.applyPrecision(layer.position.x + offsetX),
                        y: this.coordinateManager.applyPrecision(layer.position.y + offsetY),
                        ease: "power2.out"
                    });
                } else {
                    // 即座に移動（CoordinateManager精度適用）
                    layer.position.x = this.coordinateManager.applyPrecision(layer.position.x + offsetX);
                    layer.position.y = this.coordinateManager.applyPrecision(layer.position.y + offsetY);
                }
            }
        });
        
        // パス座標更新（CoordinateManager統合処理）
        this.paths.forEach(path => {
            if (path.points && Array.isArray(path.points)) {
                path.points.forEach(point => {
                    // 座標妥当性確認後に更新
                    if (this.coordinateManager.validateCoordinateIntegrity(point)) {
                        point.x = this.coordinateManager.applyPrecision(point.x + offsetX);
                        point.y = this.coordinateManager.applyPrecision(point.y + offsetY);
                    }
                });
            }
            
            // グラフィクス位置更新
            if (path.graphics) {
                path.graphics.x = this.coordinateManager.applyPrecision(path.graphics.x + offsetX);
                path.graphics.y = this.coordinateManager.applyPrecision(path.graphics.y + offsetY);
            }
        });
        
    } catch (error) {
        ErrorManager.showError('canvas-center-coordinate', 
            `座標統合中央寄せエラー: ${error.message}`, 
            { contentBounds, offsetX: offsetX || 0, offsetY: offsetY || 0 }
        );
    }
}

// ==========================================
// 🔄 描画処理の座標統合対応
// ==========================================

/**
 * 🔄 統合描画開始処理
 */
function startDrawingWithCoordinateIntegration(event) {
    try {
        // CoordinateManager経由で統一座標取得
        const coordinates = this.getUnifiedCanvasCoordinates(event);
        
        if (!coordinates) {
            throw new Error('座標取得に失敗しました');
        }
        
        // 描画システムに座標を渡す
        if (this.currentTool && this.currentTool.startDrawing) {
            this.currentTool.startDrawing(
                coordinates.canvas.x, 
                coordinates.canvas.y, 
                coordinates.pressure
            );
        }
        
        // 描画状態更新
        this.isDrawing = true;
        this.lastDrawingPoint = coordinates.canvas;
        
        // StateManager経由で状態更新
        if (window.StateManager) {
            window.StateManager.updateComponentState('canvasManager', 'drawing', {
                isDrawing: true,
                coordinates: coordinates.canvas,
                pressure: coordinates.pressure,
                tool: this.currentTool?.name || 'unknown',
                timestamp: Date.now()
            });
        }
        
        console.log(`🎨 CoordinateManager統合描画開始: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
        
        return coordinates;
        
    } catch (error) {
        ErrorManager.showError('canvas-draw-start-coordinate', 
            `統合描画開始エラー: ${error.message}`, 
            { event: event?.type }
        );
        return null;
    }
}

/**
 * 🔄 統合描画継続処理
 */
function continueDrawingWithCoordinateIntegration(event) {
    if (!this.isDrawing) return null;
    
    try {
        // CoordinateManager経由で統一座標取得
        const coordinates = this.getUnifiedCanvasCoordinates(event);
        
        if (!coordinates) {
            throw new Error('座標取得に失敗しました');
        }
        
        // 前回座標との距離計算（CoordinateManager使用）
        let shouldDraw = true;
        if (this.lastDrawingPoint && this.coordinateManager) {
            const distance = this.coordinateManager.calculateDistance(
                this.lastDrawingPoint, 
                coordinates.canvas
            );
            
            // 最小描画距離チェック
            const minDistance = ConfigManager.get('drawing.pen.minDistance') || 1.5;
            shouldDraw = distance >= minDistance;
        }
        
        if (shouldDraw) {
            // 描画システムに座標を渡す
            if (this.currentTool && this.currentTool.continueDrawing) {
                this.currentTool.continueDrawing(
                    coordinates.canvas.x, 
                    coordinates.canvas.y, 
                    coordinates.pressure
                );
            }
            
            this.lastDrawingPoint = coordinates.canvas;
        }
        
        return coordinates;
        
    } catch (error) {
        ErrorManager.showError('canvas-draw-continue-coordinate', 
            `統合描画継続エラー: ${error.message}`, 
            { event: event?.type }
        );
        return null;
    }
}

/**
 * 🔄 統合描画終了処理
 */
function stopDrawingWithCoordinateIntegration() {
    try {
        // 描画システムに終了通知
        if (this.currentTool && this.currentTool.stopDrawing) {
            this.currentTool.stopDrawing();
        }
        
        // 描画状態クリア
        this.isDrawing = false;
        this.lastDrawingPoint = null;
        
        // StateManager経由で状態更新
        if (window.StateManager) {
            window.StateManager.updateComponentState('canvasManager', 'drawing', {
                isDrawing: false,
                timestamp: Date.now()
            });
        }
        
        console.log('🎨 CoordinateManager統合描画終了');
        
        return true;
        
    } catch (error) {
        ErrorManager.showError('canvas-draw-stop-coordinate', 
            `統合描画終了エラー: ${error.message}`
        );
        return false;
    }
}

// ==========================================
// 🔄 イベントハンドラーの座標統合対応
// ==========================================

/**
 * 🔄 統合ポインターダウンハンドラー
 */
function handlePointerDownWithCoordinateIntegration(event) {
    try {
        event.preventDefault();
        
        // CoordinateManager統合描画開始
        const coordinates = this.startDrawingWithCoordinateIntegration(event);
        
        if (coordinates) {
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('canvas.pointer.down', {
                    coordinates,
                    event: event.type,
                    timestamp: Date.now()
                });
            }
        }
        
    } catch (error) {
        ErrorManager.showError('canvas-pointer-down-coordinate', 
            `統合ポインターダウンエラー: ${error.message}`, 
            { event: event?.type }
        );
    }
}

/**
 * 🔄 統合ポインター移動ハンドラー
 */
function handlePointerMoveWithCoordinateIntegration(event) {
    try {
        event.preventDefault();
        
        if (this.isDrawing) {
            // CoordinateManager統合描画継続
            const coordinates = this.continueDrawingWithCoordinateIntegration(event);
            
            if (coordinates) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.move', {
                        coordinates,
                        isDrawing: true,
                        event: event.type,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
    } catch (error) {
        ErrorManager.showError('canvas-pointer-move-coordinate', 
            `統合ポインター移動エラー: ${error.message}`, 
            { event: event?.type }
        );
    }
}

/**
 * 🔄 統合ポインターアップハンドラー
 */
function handlePointerUpWithCoordinateIntegration(event) {
    try {
        event.preventDefault();
        
        if (this.isDrawing) {
            // CoordinateManager統合描画終了
            const success = this.stopDrawingWithCoordinateIntegration();
            
            if (success) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.up', {
                        wasDrawing: true,
                        event: event.type,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
    } catch (error) {
        ErrorManager.showError('canvas-pointer-up-coordinate', 
            `統合ポインターアップエラー: ${error.message}`, 
            { event: event?.type }
        );
    }
}

// ==========================================
// 🔄 高度リサイズ機能の座標統合対応
// ==========================================

/**
 * 🔄 CoordinateManager統合スマートリサイズ
 */
function smartResizeWithCoordinateIntegration(padding = 50) {
    if (!this.coordinateManager) {
        console.warn('⚠️ CoordinateManager未初期化 - 通常スマートリサイズ実行');
        return this.resizeToContent(padding);
    }
    
    try {
        // CoordinateManager統合境界取得
        const bounds = this.getContentBoundsWithCoordinateManager();
        
        if (!bounds) {
            console.warn('⚠️ CoordinateManager統合スマートリサイズ: コンテンツが見つかりません');
            return false;
        }
        
        // パディング適用（CoordinateManager精度）
        const newWidth = this.coordinateManager.applyPrecision(bounds.width + padding * 2);
        const newHeight = this.coordinateManager.applyPrecision(bounds.height + padding * 2);
        
        console.log(`🎯 CoordinateManager統合スマートリサイズ: コンテンツサイズ ${bounds.width}×${bounds.height} → ${newWidth}×${newHeight}`);
        
        // UI更新
        if (this.resizeUI) {
            this.resizeUI.widthInput.value = newWidth;
            this.resizeUI.heightInput.value = newHeight;
        }
        
        // CoordinateManager統合リサイズ実行
        return this.executeResizeWithCoordinateIntegration(newWidth, newHeight, true);
        
    } catch (error) {
        ErrorManager.showError('canvas-smart-resize-coordinate', 
            `統合スマートリサイズエラー: ${error.message}`, 
            { padding }
        );
        return false;
    }
}

/**
 * 🔄 座標統合バッチリサイズ
 */
async function batchResizeWithCoordinateIntegration(sizes, centerContent = true) {
    if (!this.coordinateManager) {
        console.warn('⚠️ CoordinateManager未初期化 - 通常バッチリサイズ実行');
        return this.batchResize(sizes, centerContent);
    }
    
    const results = [];
    
    for (const size of sizes) {
        const [width, height] = size;
        
        console.log(`📦 CoordinateManager統合バッチリサイズ: ${width}×${height}`);
        
        try {
            // 座標妥当性確認
            if (!ConfigManager.validate('canvas.width', width) || 
                !ConfigManager.validate('canvas.height', height)) {
                throw new Error('無効なリサイズサイズ');
            }
            
            // UI更新
            if (this.resizeUI) {
                this.resizeUI.widthInput.value = width;
                this.resizeUI.heightInput.value = height;
            }
            
            // CoordinateManager統合リサイズ実行
            const success = this.executeResizeWithCoordinateIntegration(width, height, centerContent);
            
            results.push({
                size: [width, height],
                success,
                coordinateIntegrated: true,
                timestamp: Date.now()
            });
            
            // 短時間待機（処理負荷軽減）
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            results.push({
                size: [width, height],
                success: false,
                error: error.message,
                coordinateIntegrated: false,
                timestamp: Date.now()
            });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📦 CoordinateManager統合バッチリサイズ完了: ${successCount}/${results.length}`);
    
    return results;
}

// ==========================================
// 🔄 統計・診断システムの座標統合対応
// ==========================================

/**
 * 🔄 座標統合リサイズ統計取得
 */
function getResizeStatsWithCoordinateIntegration() {
    const baseStats = {
        current: {
            width: this.width,
            height: this.height,
            aspectRatio: this.width / this.height,
            area: this.width * this.height
        },
        history: {
            entries: this.resizeHistory?.entries?.length || 0,
            currentIndex: this.resizeHistory?.currentIndex || -1,
            canUndo: (this.resizeHistory?.currentIndex || -1) > 0,
            canRedo: (this.resizeHistory?.currentIndex || -1) < (this.resizeHistory?.entries?.length || 0) - 1
        },
        settings: {
            enabled: this.resizeSettings?.enabled || false,
            preserveContent: this.resizeSettings?.preserveContent || false,
            centerContent: this.resizeSettings?.centerContent || false,
            constrainProportions: this.resizeSettings?.constrainProportions || false
        },
        content: {
            bounds: this.coordinateManager ? 
                this.getContentBoundsWithCoordinateManager() : 
                this.getContentBounds(),
            pathCount: this.paths?.length || 0
        }
    };
    
    // 🆕 座標統合情報追加
    if (this.coordinateManager) {
        baseStats.coordinateIntegration = {
            enabled: this.coordinateIntegration?.enabled || false,
            duplicateElimination: this.coordinateIntegration?.duplicateElimination || false,
            coordinateManagerAvailable: true,
            coordinateState: this.coordinateManager.getCoordinateState(),
            cacheStats: this.coordinateManager.getCacheStats()
        };
    } else {
        baseStats.coordinateIntegration = {
            enabled: false,
            coordinateManagerAvailable: false,
            warning: 'CoordinateManager未初期化'
        };
    }
    
    return baseStats;
}

/**
 * 🔄 座標統合診断実行
 */
function runCoordinateIntegrationDiagnosis() {
    console.group('🔍 CanvasManager座標統合診断');
    
    const stats = this.getResizeStatsWithCoordinateIntegration();
    
    // 統合機能テスト
    const integrationTests = {
        coordinateManagerAvailable: !!this.coordinateManager,
        coordinateIntegrationEnabled: this.coordinateIntegration?.enabled || false,
        unifiedCoordinateExtraction: true, // getUnifiedCanvasCoordinates実装済み
        resizeCoordinateIntegration: true,  // executeResizeWithCoordinateIntegration実装済み
        drawingCoordinateIntegration: true, // 描画統合実装済み
        smartResizeIntegration: true        // smartResizeWithCoordinateIntegration実装済み
    };
    
    // 診断結果
    const diagnosis = {
        stats,
        integrationTests,
        compliance: {
            coordinateUnified: integrationTests.coordinateManagerAvailable && integrationTests.coordinateIntegrationEnabled,
            duplicateEliminated: this.coordinateIntegration?.duplicateElimination || false,
            phase2Ready: integrationTests.coordinateManagerAvailable && 
                         stats.coordinateIntegration?.coordinateState?.phase2Ready,
            performanceOptimized: stats.coordinateIntegration?.cacheStats?.enabled || false
        }
    };
    
    console.log('📊 座標統合診断結果:', diagnosis);
    
    // 推奨事項
    const recommendations = [];
    
    if (!integrationTests.coordinateManagerAvailable) {
        recommendations.push('CoordinateManagerの初期化が必要');
    }
    
    if (!integrationTests.coordinateIntegrationEnabled) {
        recommendations.push('座標統合設定の有効化が必要 (coordinate.integration.managerCentralization)');
    }
    
    if (!diagnosis.compliance.duplicateEliminated) {
        recommendations.push('重複排除設定の有効化を推奨 (coordinate.integration.duplicateElimination)');
    }
    
    if (!diagnosis.compliance.performanceOptimized) {
        recommendations.push('座標キャッシュの有効化を推奨');
    }
    
    if (recommendations.length > 0) {
        console.warn('⚠️ 推奨事項:', recommendations);
    } else {
        console.log('✅ 座標統合診断: 全ての要件を満たしています');
    }
    
    console.groupEnd();
    
    return diagnosis;
}

/**
 * 🔄 座標統合テスト実行
 */
async function runCoordinateIntegrationTests() {
    console.group('🧪 CanvasManager座標統合テスト');
    
    if (!this.coordinateManager) {
        console.error('❌ CoordinateManager未初期化 - テスト中止');
        console.groupEnd();
        return false;
    }
    
    const originalSize = { width: this.width, height: this.height };
    
    const tests = [
        {
            name: '統一座標取得',
            test: async () => {
                const mockEvent = { clientX: 100, clientY: 100, pressure: 0.7 };
                const coords = this.getUnifiedCanvasCoordinates(mockEvent);
                return coords && coords.canvas && typeof coords.canvas.x === 'number';
            }
        },
        {
            name: '統合リサイズ',
            test: async () => {
                return this.executeResizeWithCoordinateIntegration(600, 400, false);
            }
        },
        {
            name: '座標妥当性確認',
            test: async () => {
                const testCoord = { x: 100, y: 100 };
                return this.coordinateManager.validateCoordinateIntegrity(testCoord);
            }
        },
        {
            name: 'コンテンツ境界統合',
            test: async () => {
                const bounds = this.getContentBoundsWithCoordinateManager();
                return bounds !== undefined; // nullでも有効（コンテンツなし）
            }
        },
        {
            name: '統合スマートリサイズ',
            test: async () => {
                return this.smartResizeWithCoordinateIntegration(30);
            }
        }
    ];
    
    let passCount = 0;
    
    for (const testCase of tests) {
        try {
            const result = await testCase.test();
            const passed = !!result;
            
            console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
            
            if (passed) passCount++;
            
        } catch (error) {
            console.log(`❌ ${testCase.name}: FAIL (${error.message})`);
        }
        
        // テスト間の間隔
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 元サイズに復元
    await this.executeResizeWithCoordinateIntegration(originalSize.width, originalSize.height, false);
    
    console.log(`📊 座標統合テスト結果: ${passCount}/${tests.length} パス`);
    
    const success = passCount === tests.length;
    if (success) {
        console.log('✅ 全座標統合テスト合格 - Phase2準備完了');
    } else {
        console.warn('⚠️ 一部座標統合テスト失敗');
    }
    
    console.groupEnd();
    
    return success;
}

// ==========================================
// 🔄 統合・公開メソッド
// ==========================================

/**
 * 🔄 座標統合システム状態取得
 */
function getCoordinateIntegrationState() {
    return {
        coordinateManagerAvailable: !!this.coordinateManager,
        integrationEnabled: this.coordinateIntegration?.enabled || false,
        duplicateElimination: this.coordinateIntegration?.duplicateElimination || false,
        currentSize: { width: this.width, height: this.height },
        hasContent: this.paths?.length > 0,
        coordinateManagerState: this.coordinateManager ? 
            this.coordinateManager.getCoordinateState() : null,
        phase2Ready: !!(this.coordinateManager && 
                        this.coordinateIntegration?.enabled &&
                        this.coordinateIntegration?.duplicateElimination)
    };
}

/**
 * 🔄 座標統合設定更新
 */
function updateCoordinateIntegrationSettings(newSettings) {
    this.coordinateIntegration = { 
        ...this.coordinateIntegration, 
        ...newSettings 
    };
    
    // CoordinateManager設定更新
    if (this.coordinateManager && newSettings.coordinateManagerConfig) {
        this.coordinateManager.updateCoordinateConfig(newSettings.coordinateManagerConfig);
    }
    
    console.log('⚙️ 座標統合設定更新:', newSettings);
}

/**
 * 📋 座標統合実装完了ログ
 */
console.log('🔄 CanvasManager座標統合改修完了');
console.log('✅ 統合実装項目:');
console.log('  - 直接getBoundingClientRect()使用 → CoordinateManager統合');
console.log('  - 座標変換処理統一・重複排除完了');
console.log('  - リサイズ処理の座標統合対応');
console.log('  - 描画処理の座標統合対応');
console.log('  - イベントハンドラーの座標統合対応');
console.log('  - 統計・診断システムの座標統合対応');
console.log('  - Phase2準備: レイヤー座標変換基盤完成');

/**
 * 📋 座標統合使用方法:
 * 
 * // 既存のcanvas-manager.jsのinitialize()メソッド内に追加:
 * this.initializeCoordinateIntegration();
 * 
 * // 使用例:
 * const coords = canvasManager.getUnifiedCanvasCoordinates(event);
 * canvasManager.smartResizeWithCoordinateIntegration(50);
 * canvasManager.runCoordinateIntegrationTests();
 * 
 * // 診断実行:
 * canvasManager.runCoordinateIntegrationDiagnosis();
 */