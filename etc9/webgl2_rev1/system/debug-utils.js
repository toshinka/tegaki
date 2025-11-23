/**
 * ================================================================================
 * debug-utils.js - Tegaki WebGL2 デバッグユーティリティ
 * ================================================================================
 * 
 * 【責務】
 * - 初期化状態の包括的チェック
 * - 描画フロー診断
 * - イベントリスナー確認
 * - 座標変換テスト
 * - コンソールデバッグコマンド提供
 * 
 * 【使用方法】
 * ```javascript
 * // 初期化状態確認
 * TegakiDebug.checkInitialization()
 * 
 * // 描画フローテスト
 * TegakiDebug.testDrawingFlow(100, 100)
 * 
 * // 座標変換テスト
 * TegakiDebug.testCoordinateTransform(200, 200)
 * 
 * // イベントリスナー確認
 * TegakiDebug.checkEventListeners()
 * 
 * // 依存関係チェック
 * TegakiDebug.checkDependencies()
 * 
 * // 完全診断
 * TegakiDebug.fullDiagnostic()
 * ```
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    const TegakiDebug = {
        version: '1.0.0',
        
        /**
         * 初期化状態の包括的チェック
         */
        checkInitialization() {
            console.group('🔍 Tegaki Initialization Check');

            const checks = {
                'CoordinateSystem': {
                    exists: !!window.CoordinateSystem,
                    initialized: window.CoordinateSystem?.initialized,
                    canvas: !!window.CoordinateSystem?.canvas,
                    worldContainer: !!window.CoordinateSystem?.worldContainer
                },
                'CameraSystem': {
                    exists: !!window.cameraSystem,
                    worldContainer: !!window.cameraSystem?.worldContainer,
                    canvasContainer: !!window.cameraSystem?.canvasContainer
                },
                'LayerManager': {
                    exists: !!window.layerManager,
                    layers: window.layerManager?.getLayers()?.length || 0,
                    activeLayer: !!window.layerManager?.getActiveLayer()
                },
                'DrawingEngine': {
                    exists: !!window.drawingEngine,
                    initialized: window.drawingEngine?.initialized,
                    coordSystem: !!window.drawingEngine?.coordSystem,
                    pointerHandler: !!window.drawingEngine?.pointerHandler,
                    brushCore: !!window.drawingEngine?.brushCore,
                    glCanvas: !!window.drawingEngine?.glCanvas,
                    isDrawing: window.drawingEngine?.isDrawing
                },
                'PointerHandler': {
                    exists: !!window.drawingEngine?.pointerHandler,
                    attached: window.drawingEngine?.pointerHandler?.attached,
                    activePointers: window.drawingEngine?.pointerHandler?.activePointers?.size || 0
                },
                'BrushCore': {
                    exists: !!window.BrushCore,
                    initialized: window.BrushCore?.initialized,
                    strokeRecorder: !!window.BrushCore?.strokeRecorder,
                    layerManager: !!window.BrushCore?.layerManager,
                    msdfAvailable: window.BrushCore?.msdfAvailable,
                    maskAvailable: window.BrushCore?.maskAvailable,
                    isDrawing: window.BrushCore?.isDrawing
                },
                'StrokeRecorder': {
                    exists: !!window.strokeRecorder,
                    initialized: window.strokeRecorder?.initialized,
                    isRecording: window.strokeRecorder?.isRecording,
                    points: window.strokeRecorder?.points?.length || 0
                },
                'WebGL2': {
                    canvas: !!document.querySelector('#webgl2-canvas'),
                    DrawingLayer: !!window.WebGL2DrawingLayer,
                    StrokeProcessor: !!window.GLStrokeProcessor,
                    MSDFPipeline: !!window.GLMSDFPipeline,
                    TextureBridge: !!window.GLTextureBridge,
                    MaskLayer: !!window.GLMaskLayer
                },
                'EventBus': {
                    exists: !!window.TegakiEventBus,
                    listenerCount: Object.keys(window.TegakiEventBus?._events || {}).length
                }
            };

            let allGood = true;
            const issues = [];

            for (const [name, status] of Object.entries(checks)) {
                const failedChecks = Object.entries(status)
                    .filter(([k, v]) => v === false || v === 0)
                    .map(([k]) => k);
                
                if (failedChecks.length > 0) {
                    console.error(`❌ ${name}:`, failedChecks.join(', '));
                    console.log(`   Details:`, status);
                    issues.push({ system: name, failed: failedChecks });
                    allGood = false;
                } else {
                    console.log(`✅ ${name}: OK`, status);
                }
            }

            console.groupEnd();

            if (allGood) {
                console.log('✅ All systems initialized correctly!');
            } else {
                console.warn('⚠️ Some systems have issues:', issues);
            }

            return { success: allGood, issues };
        },

        /**
         * 依存関係チェック
         */
        checkDependencies() {
            console.group('🔗 Dependency Check');

            const dependencies = [
                { name: 'PIXI', obj: window.PIXI },
                { name: 'TEGAKI_CONFIG', obj: window.TEGAKI_CONFIG },
                { name: 'CoordinateSystem', obj: window.CoordinateSystem },
                { name: 'TegakiEventBus', obj: window.TegakiEventBus },
                { name: 'TegakiCameraSystem', obj: window.TegakiCameraSystem },
                { name: 'TegakiLayerSystem', obj: window.TegakiLayerSystem },
                { name: 'DrawingEngine', obj: window.DrawingEngine },
                { name: 'PointerHandler', obj: window.PointerHandler },
                { name: 'BrushCore', obj: window.BrushCore },
                { name: 'StrokeRecorder', obj: window.StrokeRecorder },
                { name: 'WebGL2DrawingLayer', obj: window.WebGL2DrawingLayer },
                { name: 'GLStrokeProcessor', obj: window.GLStrokeProcessor },
                { name: 'GLMSDFPipeline', obj: window.GLMSDFPipeline },
                { name: 'GLTextureBridge', obj: window.GLTextureBridge }
            ];

            const missing = dependencies.filter(dep => !dep.obj);
            const available = dependencies.filter(dep => !!dep.obj);

            console.log(`✅ Available (${available.length}/${dependencies.length}):`);
            available.forEach(dep => console.log(`   - ${dep.name}`));

            if (missing.length > 0) {
                console.error(`❌ Missing (${missing.length}):`);
                missing.forEach(dep => console.log(`   - ${dep.name}`));
            }

            console.groupEnd();

            return { available: available.length, missing: missing.length, missingList: missing };
        },

        /**
         * 描画フロー診断
         */
        testDrawingFlow(x = 100, y = 100) {
            console.group('🎨 Drawing Flow Test');

            // Step 1: DrawingEngine確認
            if (!window.drawingEngine) {
                console.error('❌ DrawingEngine not found');
                console.groupEnd();
                return { success: false, step: 'DrawingEngine not found' };
            }

            if (!window.drawingEngine.initialized) {
                console.error('❌ DrawingEngine not initialized');
                console.groupEnd();
                return { success: false, step: 'DrawingEngine not initialized' };
            }

            console.log('✅ Step 1: DrawingEngine OK');

            // Step 2: PointerHandler確認
            if (!window.drawingEngine.pointerHandler) {
                console.error('❌ PointerHandler not attached');
                console.groupEnd();
                return { success: false, step: 'PointerHandler not attached' };
            }

            console.log('✅ Step 2: PointerHandler OK');

            // Step 3: 座標変換テスト
            const result = window.drawingEngine.testCoordinateTransform(x, y);
            
            if (result) {
                console.log('✅ Step 3: Coordinate transform successful');
                console.log('Result:', result);
            } else {
                console.error('❌ Step 3: Coordinate transform failed');
                console.groupEnd();
                return { success: false, step: 'Coordinate transform failed' };
            }

            // Step 4: BrushCore確認
            if (!window.BrushCore || !window.BrushCore.initialized) {
                console.error('❌ BrushCore not initialized');
                console.groupEnd();
                return { success: false, step: 'BrushCore not initialized' };
            }

            console.log('✅ Step 4: BrushCore OK');

            // Step 5: WebGL2確認
            if (!window.BrushCore.msdfAvailable) {
                console.warn('⚠️ Step 5: MSDF Pipeline not available');
            } else {
                console.log('✅ Step 5: WebGL2 MSDF Pipeline OK');
            }

            console.log('✅ All steps passed! Drawing should work.');
            console.groupEnd();

            return { success: true, transformResult: result };
        },

        /**
         * 座標変換テスト
         */
        testCoordinateTransform(clientX, clientY) {
            console.group('📐 Coordinate Transform Test');
            console.log('Input:', { clientX, clientY });

            if (!window.CoordinateSystem) {
                console.error('❌ CoordinateSystem not found');
                console.groupEnd();
                return null;
            }

            if (!window.CoordinateSystem.initialized) {
                console.error('❌ CoordinateSystem not initialized');
                console.groupEnd();
                return null;
            }

            const activeLayer = window.layerManager?.getActiveLayer();
            if (!activeLayer) {
                console.error('❌ No active layer');
                console.groupEnd();
                return null;
            }

            const result = window.CoordinateSystem.transformScreenToLocal(
                clientX,
                clientY,
                activeLayer
            );

            if (result) {
                console.log('✅ Transform successful:');
                console.log('  Canvas:', { x: result.canvasX, y: result.canvasY });
                console.log('  World:', { x: result.worldX, y: result.worldY });
                console.log('  Local:', { x: result.localX, y: result.localY });
            } else {
                console.error('❌ Transform failed');
            }

            console.groupEnd();
            return result;
        },

        /**
         * イベントリスナー確認
         */
        checkEventListeners() {
            console.group('👂 Event Listeners Check');

            const glCanvas = document.querySelector('#webgl2-canvas');
            if (!glCanvas) {
                console.error('❌ WebGL2 canvas not found');
                console.groupEnd();
                return;
            }

            console.log('✅ WebGL2 canvas found:', glCanvas);
            console.log('Canvas ID:', glCanvas.id);
            console.log('Canvas size:', { width: glCanvas.width, height: glCanvas.height });

            // PointerHandler確認
            if (window.drawingEngine?.pointerHandler) {
                console.log('✅ PointerHandler attached');
                console.log('Active pointers:', 
                    window.drawingEngine.pointerHandler.getActivePointers().length
                );
            } else {
                console.error('❌ PointerHandler not attached');
            }

            // EventBus確認
            if (window.TegakiEventBus) {
                console.log('✅ EventBus available');
                const events = Object.keys(window.TegakiEventBus._events || {});
                console.log(`Registered events (${events.length}):`, events);
            } else {
                console.error('❌ EventBus not found');
            }

            console.log('\n💡 To inspect event listeners in Chrome DevTools:');
            console.log('1. Select the canvas element in Elements tab');
            console.log('2. Run: getEventListeners($0)');

            console.groupEnd();
        },

        /**
         * WebGL2状態確認
         */
        checkWebGL2() {
            console.group('🖼️ WebGL2 State Check');

            const glCanvas = document.querySelector('#webgl2-canvas');
            if (!glCanvas) {
                console.error('❌ WebGL2 canvas not found');
                console.groupEnd();
                return;
            }

            console.log('✅ Canvas found:', {
                id: glCanvas.id,
                width: glCanvas.width,
                height: glCanvas.height,
                clientWidth: glCanvas.clientWidth,
                clientHeight: glCanvas.clientHeight
            });

            // WebGL2コンテキスト確認
            let gl = null;
            try {
                if (window.WebGL2DrawingLayer && window.WebGL2DrawingLayer.getGL) {
                    gl = window.WebGL2DrawingLayer.getGL();
                }
            } catch (e) {
                console.warn('WebGL2DrawingLayer.getGL() failed:', e);
            }

            if (gl) {
                console.log('✅ WebGL2 context available');
                console.log('GL info:', {
                    version: gl.getParameter(gl.VERSION),
                    vendor: gl.getParameter(gl.VENDOR),
                    renderer: gl.getParameter(gl.RENDERER)
                });
            } else {
                console.error('❌ WebGL2 context not available');
            }

            // コンポーネント確認
            const components = {
                'WebGL2DrawingLayer': !!window.WebGL2DrawingLayer,
                'GLStrokeProcessor': !!window.GLStrokeProcessor,
                'GLMSDFPipeline': !!window.GLMSDFPipeline,
                'GLTextureBridge': !!window.GLTextureBridge,
                'GLMaskLayer': !!window.GLMaskLayer
            };

            for (const [name, exists] of Object.entries(components)) {
                if (exists) {
                    console.log(`✅ ${name} loaded`);
                } else {
                    console.error(`❌ ${name} not loaded`);
                }
            }

            console.groupEnd();
        },

        /**
         * 完全診断（すべてのチェックを実行）
         */
        fullDiagnostic() {
            console.log('═══════════════════════════════════════════════════════');
            console.log('🔍 Tegaki WebGL2 Full Diagnostic');
            console.log('═══════════════════════════════════════════════════════\n');

            const results = {};

            results.dependencies = this.checkDependencies();
            console.log('\n');

            results.initialization = this.checkInitialization();
            console.log('\n');

            results.webgl2 = this.checkWebGL2();
            console.log('\n');

            results.eventListeners = this.checkEventListeners();
            console.log('\n');

            results.drawingFlow = this.testDrawingFlow(100, 100);
            console.log('\n');

            console.log('═══════════════════════════════════════════════════════');
            console.log('📊 Diagnostic Summary');
            console.log('═══════════════════════════════════════════════════════');

            const allPassed = 
                results.dependencies.missing === 0 &&
                results.initialization.success &&
                results.drawingFlow.success;

            if (allPassed) {
                console.log('✅ All checks passed! System is ready for drawing.');
            } else {
                console.warn('⚠️ Some checks failed. See details above.');
            }

            return results;
        },

        /**
         * 描画テスト（実際にストロークをシミュレート）
         */
        simulateDrawing(duration = 2000) {
            console.group('✏️ Drawing Simulation');

            if (!window.drawingEngine || !window.drawingEngine.initialized) {
                console.error('❌ DrawingEngine not ready');
                console.groupEnd();
                return;
            }

            console.log('Starting drawing simulation for', duration, 'ms...');

            // 中央座標を計算
            const canvas = document.querySelector('#webgl2-canvas');
            if (!canvas) {
                console.error('❌ Canvas not found');
                console.groupEnd();
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // PointerDown
            const mockDownEvent = {
                clientX: centerX - 50,
                clientY: centerY,
                pressure: 0.5,
                pointerId: 1,
                button: 0
            };

            console.log('1. PointerDown at:', { x: mockDownEvent.clientX, y: mockDownEvent.clientY });

            try {
                window.drawingEngine._handlePointerDown(mockDownEvent);
            } catch (e) {
                console.error('PointerDown failed:', e);
                console.groupEnd();
                return;
            }

            // PointerMove (円を描く)
            const steps = 20;
            const radius = 50;
            let step = 0;

            const interval = setInterval(() => {
                step++;
                const angle = (step / steps) * Math.PI * 2;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                const mockMoveEvent = {
                    clientX: x,
                    clientY: y,
                    pressure: 0.5 + Math.sin(angle) * 0.2,
                    pointerId: 1
                };

                try {
                    window.drawingEngine._handlePointerMove(mockMoveEvent);
                } catch (e) {
                    console.error('PointerMove failed:', e);
                    clearInterval(interval);
                }

                if (step >= steps) {
                    clearInterval(interval);

                    // PointerUp
                    const mockUpEvent = {
                        clientX: centerX - 50,
                        clientY: centerY,
                        pressure: 0,
                        pointerId: 1,
                        button: 0
                    };

                    console.log(`${steps + 1}. PointerUp`);

                    try {
                        window.drawingEngine._handlePointerUp(mockUpEvent);
                        console.log('✅ Drawing simulation complete!');
                    } catch (e) {
                        console.error('PointerUp failed:', e);
                    }

                    console.groupEnd();
                }
            }, duration / steps);
        },

        /**
         * クイックヘルプ
         */
        help() {
            console.log('═══════════════════════════════════════════════════════');
            console.log('🛠️  Tegaki Debug Utils - Available Commands');
            console.log('═══════════════════════════════════════════════════════\n');
            console.log('TegakiDebug.checkInitialization()  - Check all system initialization');
            console.log('TegakiDebug.checkDependencies()     - Check required dependencies');
            console.log('TegakiDebug.testDrawingFlow()       - Test complete drawing flow');
            console.log('TegakiDebug.testCoordinateTransform(x, y) - Test coordinate conversion');
            console.log('TegakiDebug.checkEventListeners()   - Check event listener setup');
            console.log('TegakiDebug.checkWebGL2()           - Check WebGL2 components');
            console.log('TegakiDebug.fullDiagnostic()        - Run all checks');
            console.log('TegakiDebug.simulateDrawing()       - Simulate a drawing stroke');
            console.log('TegakiDebug.help()                  - Show this help\n');
            console.log('═══════════════════════════════════════════════════════');
        }
    };

    // グローバル登録
    window.TegakiDebug = TegakiDebug;

    console.log('✅ debug-utils.js loaded');
    console.log('   Type: TegakiDebug.help() for available commands');
    console.log('   Quick check: TegakiDebug.fullDiagnostic()');

})();