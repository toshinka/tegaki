/**
 * Core Engine - Phase2c厳格改修版
 * 中枢制御・システム統合・EventBus管理・公開API・後方互換性
 */

(function() {
    'use strict';
    
    // TegakiSystemsレジストリ（システム登録用）
    if (!window.TegakiSystems) {
        window.TegakiSystems = {
            systems: {},
            Register: function(name, SystemClass) {
                this.systems[name] = SystemClass;
                if (window.TEGAKI_CONFIG?.debug) {
                    console.log(`✅ System registered: ${name}`);
                }
            },
            
            // デバッグ用：登録済みシステム一覧
            List: function() {
                return Object.keys(this.systems);
            }
        };
        
        if (window.TEGAKI_CONFIG?.debug) {
            console.log('✅ TegakiSystems registry initialized');
        }
    }

    class CoreEngine {
        constructor(app) {
            this.app = app;
            this.CONFIG = window.TEGAKI_CONFIG; // 設定統一
            this.systems = {}; // システム管理統一
            
            // EventBus統合初期化
            this.setupEventBus();
            
            if (this.CONFIG?.debug) {
                console.log('✅ CoreEngine initialized');
            }
        }
        
        /**
         * EventBus初期化・統合
         */
        setupEventBus() {
            if (!window.Tegaki) {
                window.Tegaki = {};
            }
            
            // EventBus実装
            if (!window.Tegaki.EventBus) {
                window.Tegaki.EventBus = {
                    listeners: {},
                    
                    on(event, callback) {
                        if (!this.listeners[event]) {
                            this.listeners[event] = [];
                        }
                        this.listeners[event].push(callback);
                    },
                    
                    emit(event, data) {
                        if (this.listeners[event]) {
                            this.listeners[event].forEach(callback => callback(data));
                        }
                        if (window.TEGAKI_CONFIG?.debug) {
                            console.log(`📡 EventBus: ${event}`, data);
                        }
                    },
                    
                    off(event, callback) {
                        if (this.listeners[event]) {
                            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
                        }
                    }
                };
            }
        }

        /**
         * システム初期化・統合（動的読み込み対応）
         */
        async initialize() {
            try {
                // システム読み込み完了まで待機
                await this.waitForSystemsLoaded();
                
                // システム初期化
                this.instantiateSystems();
                
                // システム相互参照設定
                this.setupCrossReferences();
                
                // 初期レイヤー作成
                this.createInitialLayers();
                
                // EventBus統合イベント設定
                this.setupCoreEvents();
                
                // 後方互換性のため描画エンジン初期化
                this.initializeDrawingEngine();
                this.addEventListeners();
                
                if (this.CONFIG?.debug) {
                    console.log('✅ CoreEngine fully initialized');
                }
                
                return this; // チェーン可能にする
                
            } catch (error) {
                console.error('❌ CoreEngine initialization failed:', error);
                throw error;
            }
        }
        
        /**
         * システム読み込み完了待機
         */
        async waitForSystemsLoaded() {
            const requiredSystems = ['CameraSystem', 'LayerSystem', 'ClipboardSystem'];
            const maxWait = 5000; // 5秒タイムアウト
            const startTime = Date.now();
            
            if (this.CONFIG?.debug) {
                console.log('🔄 Waiting for systems to load...', requiredSystems);
            }
            
            while (Date.now() - startTime < maxWait) {
                const loadedSystems = [];
                const missingSystems = [];
                
                requiredSystems.forEach(name => {
                    if (window.TegakiSystems?.systems?.[name]) {
                        loadedSystems.push(name);
                    } else {
                        missingSystems.push(name);
                    }
                });
                
                if (this.CONFIG?.debug && missingSystems.length > 0) {
                    console.log(`⏳ Still waiting for: ${missingSystems.join(', ')}`);
                }
                
                if (missingSystems.length === 0) {
                    if (this.CONFIG?.debug) {
                        console.log('✅ All systems loaded:', loadedSystems);
                    }
                    return;
                }
                
                // 100ms待機
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // タイムアウト時の詳細情報
            console.error('❌ System loading timeout. Available systems:', 
                Object.keys(window.TegakiSystems?.systems || {}));
            throw new Error('Required systems not loaded within timeout');
        }
        
        /**
         * システムインスタンス化
         */
        instantiateSystems() {
            const SystemClasses = window.TegakiSystems.systems;
            
            // カメラシステム
            this.systems.camera = new SystemClasses.CameraSystem(this);
            
            // レイヤーシステム
            this.systems.layer = new SystemClasses.LayerSystem(this);
            
            // クリップボードシステム
            this.systems.clipboard = new SystemClasses.ClipboardSystem(this);
            
            if (this.CONFIG?.debug) {
                console.log('✅ Systems instantiated');
            }
        }
        
        /**
         * システム相互参照設定
         */
        setupCrossReferences() {
            // 各システムに他システムへの参照を設定
            Object.values(this.systems).forEach(system => {
                system.cameraSystem = this.systems.camera;
                system.layerSystem = this.systems.layer;
                system.clipboardSystem = this.systems.clipboard;
                system.coreEngine = this;
            });
            
            if (this.CONFIG?.debug) {
                console.log('✅ Cross-references established');
            }
        }
        
        /**
         * 初期レイヤー作成
         */
        createInitialLayers() {
            // 背景レイヤー作成
            const bgLayer = this.systems.layer.createLayer('背景', 'background');
            
            // 描画レイヤー作成
            const drawLayer = this.systems.layer.createLayer('レイヤー1', 'drawing');
            this.systems.layer.setActiveLayer(drawLayer.id);
            
            if (this.CONFIG?.debug) {
                console.log('✅ Initial layers created');
            }
        }
        
        /**
         * コアイベント設定
         */
        setupCoreEvents() {
            const EventBus = window.Tegaki.EventBus;
            
            // キャンバスリサイズイベント
            EventBus.on('canvas:resize', (data) => {
                this.handleCanvasResize(data.width, data.height);
            });
            
            // レイヤー変形確定イベント
            EventBus.on('layer:transform:confirmed', (data) => {
                this.handleLayerTransformConfirmed(data);
            });
            
            // レイヤー順序変更イベント
            EventBus.on('layer:order:changed', (data) => {
                this.handleLayerOrderChanged(data);
            });
            
            if (this.CONFIG?.debug) {
                console.log('✅ Core events established');
            }
        }
        
        /**
         * キャンバスリサイズハンドラ
         * @param {number} width - 新しい幅
         * @param {number} height - 新しい高さ
         */
        handleCanvasResize(width, height) {
            // CONFIG更新
            this.CONFIG.canvas.width = width;
            this.CONFIG.canvas.height = height;
            
            // カメラシステムリサイズ
            this.systems.camera.resizeCanvas(width, height);
            
            // レイヤーシステムリサイズ
            this.systems.layer.resizeCanvas(width, height);
            
            if (this.CONFIG?.debug) {
                console.log(`✅ Canvas resized: ${width}x${height}`);
            }
        }
        
        /**
         * レイヤー変形確定ハンドラ
         * @param {Object} data - イベントデータ
         */
        handleLayerTransformConfirmed(data) {
            // UI更新通知（ui-panels.jsへ）
            const event = new CustomEvent('tegaki:layer:transform:confirmed', {
                detail: data
            });
            document.dispatchEvent(event);
        }
        
        /**
         * レイヤー順序変更ハンドラ
         * @param {Object} data - イベントデータ
         */
        handleLayerOrderChanged(data) {
            // UI更新通知（ui-panels.jsへ）
            const event = new CustomEvent('tegaki:layer:order:changed', {
                detail: data
            });
            document.dispatchEvent(event);
        }
        
        // ========================================
        // 後方互換API（main.jsから呼ばれる）
        // ========================================
        
        /**
         * @returns {CameraSystem} カメラシステム
         */
        getCameraSystem() {
            return this.systems.camera;
        }
        
        /**
         * @returns {LayerSystem} レイヤーシステム
         */
        getLayerManager() {
            return this.systems.layer;
        }
        
        /**
         * @returns {ClipboardSystem} クリップボードシステム
         */
        getClipboardSystem() {
            return this.systems.clipboard;
        }
        
        // index.htmlとの互換性メソッド
        getDrawingEngine() {
            return this.systems.layer; // LayerSystemが描画機能を統合
        }
        
        // core-runtime.jsとの互換性
        addEventListeners() {
            // 既にsetupCoreEvents()で実装済み
            return this;
        }
        
        initializeDrawingEngine() {
            // LayerSystemで統合済み
            return this;
        }
        
        // ========================================
        // 統合制御API（外部から呼ばれる）
        // ========================================
        
        /**
         * キャンバスサイズ変更
         * @param {number} width - 幅
         * @param {number} height - 高さ
         */
        resizeCanvas(width, height) {
            window.Tegaki.EventBus.emit('canvas:resize', {width, height});
        }
        
        /**
         * アクティブレイヤー取得
         * @returns {Layer|null} アクティブレイヤー
         */
        getActiveLayer() {
            return this.systems.layer?.getActiveLayer() || null;
        }
        
        /**
         * レイヤー取得（ID指定）
         * @param {string} layerId - レイヤーID
         * @returns {Layer|null} レイヤー
         */
        getLayerById(layerId) {
            return this.systems.layer?.getLayerById(layerId) || null;
        }
        
        /**
         * 全レイヤー取得
         * @returns {Array} レイヤー配列
         */
        getAllLayers() {
            return this.systems.layer?.getAllLayers() || [];
        }
        
        /**
         * レイヤー作成
         * @param {string} name - レイヤー名
         * @param {string} type - レイヤータイプ
         * @returns {Layer} 作成されたレイヤー
         */
        createLayer(name = 'New Layer', type = 'drawing') {
            return this.systems.layer?.createLayer(name, type) || null;
        }
        
        /**
         * レイヤー削除
         * @param {string} layerId - レイヤーID
         */
        removeLayer(layerId) {
            this.systems.layer?.removeLayer(layerId);
        }
        
        /**
         * レイヤー順序変更
         * @param {string} layerId - レイヤーID
         * @param {number} newIndex - 新しいインデックス
         */
        setLayerOrder(layerId, newIndex) {
            this.systems.layer?.setLayerOrder(layerId, newIndex);
        }
        
        /**
         * アクティブレイヤー設定
         * @param {string} layerId - レイヤーID
         */
        setActiveLayer(layerId) {
            this.systems.layer?.setActiveLayer(layerId);
        }
        
        /**
         * レイヤー変形開始
         * @param {string} layerId - レイヤーID
         */
        startLayerTransform(layerId) {
            this.systems.layer?.startLayerTransform(layerId);
        }
        
        /**
         * レイヤー変形確定
         * @param {string} layerId - レイヤーID
         */
        confirmLayerTransform(layerId) {
            this.systems.layer?.confirmLayerTransform(layerId);
        }
        
        /**
         * レイヤー変形キャンセル
         * @param {string} layerId - レイヤーID
         */
        cancelLayerTransform(layerId) {
            this.systems.layer?.cancelLayerTransform(layerId);
        }
        
        /**
         * 座標変換：スクリーン→キャンバス
         * @input screen coordinates {x, y} - ブラウザクライアントピクセル
         * @output canvas coordinates {x, y} - キャンバス論理座標（canonical）
         */
        screenToCanvas(screenPt) {
            return this.systems.camera?.screenToCanvas(screenPt) || screenPt;
        }
        
        /**
         * 座標変換：キャンバス→スクリーン
         * @input canvas coordinates {x, y} - キャンバス論理座標（canonical）
         * @output screen coordinates {x, y} - ブラウザクライアントピクセル
         */
        canvasToScreen(canvasPt) {
            return this.systems.camera?.canvasToScreen(canvasPt) || canvasPt;
        }
        
        /**
         * コピー実行
         */
        copy() {
            this.systems.clipboard?.copy();
        }
        
        /**
         * ペースト実行
         */
        paste() {
            this.systems.clipboard?.paste();
        }
        
        // ========================================
        // 描画関連API（DrawingEngineとの統合）
        // ========================================
        
        /**
         * 描画開始
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         */
        startDrawing(screenX, screenY) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // 座標変換：スクリーン→キャンバス
            const canvasPoint = this.screenToCanvas({x: screenX, y: screenY});
            
            // レイヤーシステムで描画開始
            this.systems.layer.startDrawing(activeLayer.id, canvasPoint);
        }
        
        /**
         * 描画継続
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         */
        continueDrawing(screenX, screenY) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // 座標変換：スクリーン→キャンバス
            const canvasPoint = this.screenToCanvas({x: screenX, y: screenY});
            
            // レイヤーシステムで描画継続
            this.systems.layer.continueDrawing(activeLayer.id, canvasPoint);
        }
        
        /**
         * 描画終了
         */
        endDrawing() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // レイヤーシステムで描画終了
            this.systems.layer.endDrawing(activeLayer.id);
        }
        
        // ========================================
        // デバッグ・診断API
        // ========================================
        
        /**
         * システム状態取得
         */
        getSystemState() {
            if (!this.CONFIG?.debug) return;
            
            return {
                camera: this.systems.camera?.getState?.() || 'not available',
                layer: this.systems.layer?.getState?.() || 'not available',
                clipboard: this.systems.clipboard?.getState?.() || 'not available',
                config: this.CONFIG
            };
        }
        
        /**
         * システム診断実行
         */
        runDiagnostics() {
            if (!this.CONFIG?.debug) return;
            
            console.log('🔍 System Diagnostics:');
            console.log('- TegakiSystems Registry:', !!window.TegakiSystems);
            console.log('- Available Systems:', window.TegakiSystems?.List?.() || []);
            console.log('- Camera System:', !!this.systems.camera);
            console.log('- Layer System:', !!this.systems.layer);
            console.log('- Clipboard System:', !!this.systems.clipboard);
            console.log('- EventBus:', !!window.Tegaki?.EventBus);
            console.log('- Config:', !!this.CONFIG);
            
            const state = this.getSystemState();
            console.log('System State:', state);
        }
        
        // core-runtime.js互換性メソッド
        setupCanvas() {
            // 既にcamera-system.jsで実装済み
            return this;
        }
        
        setupEventHandlers() {
            // 既にsetupCoreEvents()で実装済み
            return this;
        }
        
        // phase1b4互換性メソッド
        createInitialLayer() {
            return this.createInitialLayers();
        }
    }

    // index.htmlが期待する構造で登録
    if (!window.TegakiCore) {
        window.TegakiCore = {};
    }
    window.TegakiCore.CoreEngine = CoreEngine;
    
    // 後方互換性のため
    window.CoreEngine = CoreEngine;
    
    if (window.TEGAKI_CONFIG?.debug) {
        console.log('✅ core-engine.js loaded - TegakiCore.CoreEngine registered');
    }

})();