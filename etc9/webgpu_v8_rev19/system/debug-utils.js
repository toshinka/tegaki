// ================================================================================
// Debug Utilities - TEGAKI_DEBUG
// ================================================================================
// Phase 4デバッグ用ユーティリティ
// 実装確認・診断・WebGPU対応チェック
// ================================================================================

(function() {
    'use strict';

    window.TEGAKI_DEBUG = {
        /**
         * 総合診断 - システム全体の状態確認
         */
        diagnose() {
            console.group('🔍 TEGAKI Diagnostic Report');
            
            // 基本システム
            console.group('📦 Core Systems');
            this._checkExists('PIXI', window.PIXI);
            this._checkExists('TEGAKI_CONFIG', window.TEGAKI_CONFIG);
            this._checkExists('TegakiEventBus', window.TegakiEventBus);
            this._checkExists('CoreRuntime', window.CoreRuntime);
            this._checkExists('CoreEngine', window.coreEngine);
            this._checkExists('DrawingEngine', window.drawingEngine);
            this._checkExists('LayerManager', window.layerManager);
            this._checkExists('CameraSystem', window.cameraSystem);
            console.groupEnd();

            // WebGPU関連
            console.group('🎮 WebGPU Systems');
            this._checkExists('navigator.gpu', navigator.gpu);
            this._checkExists('WebGPUCapabilities', window.WebGPUCapabilities);
            this._checkExists('WebGPUDrawingLayer', window.WebGPUDrawingLayer);
            this._checkExists('WebGPUComputeSDF', window.WebGPUComputeSDF);
            this._checkExists('WebGPUComputeMSDF', window.WebGPUComputeMSDF);
            this._checkExists('WebGPUTextureBridge', window.WebGPUTextureBridge);
            this._checkExists('webgpuLayer (instance)', window.webgpuLayer);
            console.groupEnd();

            // Drawing関連
            console.group('✏️ Drawing Systems');
            this._checkExists('StrokeRecorder', window.drawingEngine?.strokeRecorder);
            this._checkExists('StrokeRenderer', window.drawingEngine?.strokeRenderer);
            this._checkExists('BrushCore', window.drawingEngine?.brushCore);
            this._checkExists('BrushSettings', window.BrushSettings);
            console.groupEnd();

            // Animation関連
            console.group('🎬 Animation Systems');
            this._checkExists('AnimationSystem', window.animationSystem);
            this._checkExists('TimelineUI', window.timelineUI);
            console.groupEnd();

            // Export関連
            console.group('💾 Export Systems');
            this._checkExists('ExportManager', window.TEGAKI_EXPORT_MANAGER);
            this._checkExists('PNGExporter', window.PNGExporter);
            this._checkExists('APNGExporter', window.APNGExporter);
            this._checkExists('GIFExporter', window.GIFExporter);
            this._checkExists('WebPExporter', window.WebPExporter);
            console.groupEnd();

            console.groupEnd();
        },

        /**
         * Phase 4実装確認
         */
        checkPhase4Implementation() {
            console.group('✅ Phase 4 Implementation Check');
            
            const phase4Components = {
                'WebGPU基盤': {
                    'WebGPUCapabilities': window.WebGPUCapabilities,
                    'WebGPUDrawingLayer': window.WebGPUDrawingLayer,
                    'WebGPUTextureBridge': window.WebGPUTextureBridge
                },
                'Compute Shader': {
                    'WebGPUComputeSDF': window.WebGPUComputeSDF,
                    'WebGPUComputeMSDF': window.WebGPUComputeMSDF
                },
                'Runtime': {
                    'webgpuLayer (instance)': window.webgpuLayer,
                    'WebGPU enabled': window.drawingAppInstance?.webgpuEnabled
                }
            };

            for (const [category, components] of Object.entries(phase4Components)) {
                console.group(`📋 ${category}`);
                for (const [name, obj] of Object.entries(components)) {
                    this._checkExists(name, obj);
                }
                console.groupEnd();
            }

            console.groupEnd();
        },

        /**
         * WebGPU対応確認
         */
        async checkWebGPUSupport() {
            console.group('🎮 WebGPU Support Check');

            // navigator.gpu存在確認
            if (!navigator.gpu) {
                console.error('❌ navigator.gpu is undefined');
                console.log('💡 WebGPU is not supported in this browser');
                console.groupEnd();
                return {
                    supported: false,
                    error: 'navigator.gpu undefined'
                };
            }

            console.log('✅ navigator.gpu exists');

            // WebGPUCapabilities確認
            if (!window.WebGPUCapabilities) {
                console.error('❌ WebGPUCapabilities not loaded');
                console.groupEnd();
                return {
                    supported: false,
                    error: 'WebGPUCapabilities not loaded'
                };
            }

            console.log('✅ WebGPUCapabilities loaded');

            try {
                // WebGPU対応チェック実行
                const result = await window.WebGPUCapabilities.checkSupport();
                
                if (result.supported) {
                    console.log('✅ WebGPU is supported');
                    
                    if (result.features) {
                        console.group('📋 Supported Features');
                        result.features.forEach(feature => {
                            console.log(`  - ${feature}`);
                        });
                        console.groupEnd();
                    }

                    if (result.limits) {
                        console.group('📊 Device Limits');
                        const importantLimits = [
                            'maxBufferSize',
                            'maxComputeWorkgroupSizeX',
                            'maxComputeWorkgroupSizeY',
                            'maxStorageBufferBindingSize'
                        ];
                        importantLimits.forEach(key => {
                            if (result.limits[key] !== undefined) {
                                console.log(`  ${key}: ${result.limits[key]}`);
                            }
                        });
                        console.groupEnd();
                    }
                } else {
                    console.error('❌ WebGPU not supported:', result.error);
                }

                console.groupEnd();
                return result;

            } catch (error) {
                console.error('❌ Error checking WebGPU support:', error);
                console.groupEnd();
                return {
                    supported: false,
                    error: error.message
                };
            }
        },

        /**
         * WebGPUレイヤー初期化状態確認
         */
        checkWebGPULayerStatus() {
            console.group('🔧 WebGPU Layer Status');

            if (!window.webgpuLayer) {
                console.warn('⚠️ webgpuLayer not initialized');
                console.groupEnd();
                return;
            }

            const layer = window.webgpuLayer;
            console.log('✅ webgpuLayer exists');
            console.log('Device:', layer.device ? '✅' : '❌');
            console.log('Adapter:', layer.adapter ? '✅' : '❌');
            console.log('Canvas Context:', layer.context ? '✅' : '❌');

            if (layer.computeSDF) {
                console.log('SDF Compute:', layer.computeSDF.initialized ? '✅' : '⚠️ Not initialized');
            } else {
                console.log('SDF Compute:', '❌ Not found');
            }

            if (layer.computeMSDF) {
                console.log('MSDF Compute:', layer.computeMSDF.initialized ? '✅' : '⚠️ Not initialized');
            } else {
                console.log('MSDF Compute:', '❌ Not found');
            }

            console.groupEnd();
        },

        /**
         * ストローク描画パス確認
         */
        checkStrokeRenderingPath() {
            console.group('✏️ Stroke Rendering Path Check');

            const strokeRenderer = window.drawingEngine?.strokeRenderer;
            
            if (!strokeRenderer) {
                console.error('❌ StrokeRenderer not found');
                console.groupEnd();
                return;
            }

            console.log('✅ StrokeRenderer exists');

            const webgpuEnabled = !!strokeRenderer.webgpuLayer;
            console.log('WebGPU Layer:', webgpuEnabled ? '✅ Enabled' : '❌ Disabled');

            console.group('📋 Rendering Priority');
            console.log('1. MSDF (WebGPU)', webgpuEnabled && strokeRenderer.webgpuLayer?.computeMSDF ? '✅' : '❌');
            console.log('2. SDF (WebGPU)', webgpuEnabled && strokeRenderer.webgpuLayer?.computeSDF ? '✅' : '❌');
            console.log('3. SDF (CPU)', strokeRenderer._renderFinalStrokeSDF ? '✅' : '❌');
            console.log('4. Legacy Graphics', '✅ (Fallback)');
            console.groupEnd();

            console.groupEnd();
        },

        /**
         * メモリ使用状況確認
         */
        checkMemoryUsage() {
            if (!performance.memory) {
                console.warn('⚠️ performance.memory not available (Chrome only)');
                return;
            }

            console.group('💾 Memory Usage');
            const memory = performance.memory;
            console.log('Used:', this._formatBytes(memory.usedJSHeapSize));
            console.log('Total:', this._formatBytes(memory.totalJSHeapSize));
            console.log('Limit:', this._formatBytes(memory.jsHeapSizeLimit));
            console.log('Usage:', `${(memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(1)}%`);
            console.groupEnd();
        },

        /**
         * 存在チェックヘルパー
         */
        _checkExists(name, obj) {
            if (obj !== undefined && obj !== null) {
                console.log(`✅ ${name}`);
            } else {
                console.log(`❌ ${name}`);
            }
        },

        /**
         * バイト数フォーマット
         */
        _formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },

        /**
         * パフォーマンステスト
         */
        async performanceTest() {
            console.group('⚡ Performance Test');

            if (!window.webgpuLayer || !window.webgpuLayer.computeSDF) {
                console.error('❌ WebGPU not available for testing');
                console.groupEnd();
                return;
            }

            // テスト用ポイント生成
            const pointCount = 1000;
            const points = [];
            for (let i = 0; i < pointCount; i++) {
                points.push({
                    x: Math.random() * 512,
                    y: Math.random() * 512
                });
            }

            console.log(`📝 Testing with ${pointCount} points on 512x512 canvas`);

            try {
                const startTime = performance.now();
                await window.webgpuLayer.computeSDF.generateSDF(points, 512, 512);
                const endTime = performance.now();

                const elapsed = endTime - startTime;
                console.log(`✅ SDF Generation: ${elapsed.toFixed(2)}ms`);
                
                if (elapsed < 16) {
                    console.log('🎉 Excellent! (60fps capable)');
                } else if (elapsed < 33) {
                    console.log('✅ Good (30fps capable)');
                } else {
                    console.warn('⚠️ Slow (may impact performance)');
                }

            } catch (error) {
                console.error('❌ Performance test failed:', error);
            }

            console.groupEnd();
        }
    };

    console.log('✅ debug-utils.js (TEGAKI_DEBUG) loaded');

})();