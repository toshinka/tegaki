/**
 * 🧭 NavigationManager - Phase1.5スタブ実装版
 * 📋 RESPONSIBILITY: キャンバスパン・ズーム・キーボードナビゲーション
 * 🚫 PROHIBITION: 座標変換・描画処理・レイヤー管理・フォールバック
 * ✅ PERMISSION: CoordinateManager連携・EventBus通信・キー入力処理
 * 
 * 📏 DESIGN_PRINCIPLE: CoordinateManager完全連携・パフォーマンス重視・状態管理統一
 * 🔄 INTEGRATION: Phase1.5基盤・CoordinateManager必須・ShortcutManager協調
 * 🎯 Phase1.5: パン・ズーム基盤実装・Phase2変形準備
 */

(function() {
    'use strict';
    
    /**
     * NavigationManager - キャンバスナビゲーション管理
     */
    class NavigationManager {
        constructor() {
            console.log('🧭 NavigationManager Phase1.5スタブ実装 - 初期化開始');
            
            this.coordinateManager = null;
            this.eventBus = null;
            
            // ナビゲーション状態（Phase1.5基盤）
            this.isPanning = false;
            this.panStartPos = { x: 0, y: 0 };
            this.panAccumulator = { x: 0, y: 0 };
            
            // ズーム状態（Phase1.5基盤）
            this.zoomLevel = 1.0;
            this.zoomMin = 0.1;
            this.zoomMax = 10.0;
            this.zoomStep = 0.1;
            
            // キーボード状態（Phase1.5基盤）
            this.keys = new Set();
            this.keyboardPanSpeed = 20;
            
            this.initializeComplete = false;
            
            console.log('🧭 NavigationManager スタブ実装完了');
        }
        
        /**
         * 初期化（Phase1.5スタブ - CoordinateManager・EventBus連携準備）
         */
        initialize(coordinateManager, eventBus) {
            console.log('🧭 NavigationManager 初期化 - Phase1.5スタブ版');
            
            if (!coordinateManager) {
                console.warn('⚠️ NavigationManager: CoordinateManager未提供 - Phase1.5開発中');
                return false;
            }
            
            if (!eventBus) {
                console.warn('⚠️ NavigationManager: EventBus未提供 - Phase1.5開発中');
                return false;
            }
            
            this.coordinateManager = coordinateManager;
            this.eventBus = eventBus;
            
            // Phase1.5: 基本パン・ズームイベント準備（スタブ）
            this.setupEventListeners();
            
            this.initializeComplete = true;
            console.log('✅ NavigationManager 初期化完了 - Phase1.5スタブ版');
            
            return true;
        }
        
        /**
         * イベントリスナー設定（Phase1.5スタブ実装）
         */
        setupEventListeners() {
            console.log('🧭 NavigationManager イベントリスナー設定 - Phase1.5スタブ');
            
            // Phase1.5: 基本的なキーボードイベント準備
            document.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                this.handleKeyUp(e);
            });
            
            // Phase1.5: マウスパンイベント準備（スタブ）
            // 詳細実装は次のステップで追加予定
            
            console.log('🧭 NavigationManager イベントリスナー設定完了 - Phase1.5スタブ');
        }
        
        /**
         * キーダウン処理（Phase1.5スタブ実装）
         */
        handleKeyDown(event) {
            if (!this.initializeComplete) return;
            
            this.keys.add(event.code);
            
            // Phase1.5: 基本キーボードナビゲーション（スタブ）
            switch (event.code) {
                case 'Space':
                    if (!this.isPanning) {
                        console.log('🧭 NavigationManager: Space キー - パンモード開始準備');
                        // 詳細実装は次ステップで追加
                    }
                    event.preventDefault();
                    break;
                    
                case 'ArrowUp':
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'ArrowRight':
                    if (this.keys.has('Space')) {
                        console.log('🧭 NavigationManager: 方向キー - キーボードパン準備');
                        this.handleKeyboardPan(event.code);
                        event.preventDefault();
                    }
                    break;
            }
        }
        
        /**
         * キーアップ処理（Phase1.5スタブ実装）
         */
        handleKeyUp(event) {
            if (!this.initializeComplete) return;
            
            this.keys.delete(event.code);
            
            if (event.code === 'Space' && this.isPanning) {
                console.log('🧭 NavigationManager: Space キー解除 - パンモード終了準備');
                this.isPanning = false;
                // 詳細実装は次ステップで追加
            }
        }
        
        /**
         * キーボードパン処理（Phase1.5スタブ実装）
         */
        handleKeyboardPan(direction) {
            if (!this.coordinateManager) {
                console.warn('⚠️ NavigationManager: CoordinateManager未初期化 - キーボードパン無効');
                return;
            }
            
            let deltaX = 0;
            let deltaY = 0;
            
            switch (direction) {
                case 'ArrowUp':
                    deltaY = -this.keyboardPanSpeed;
                    break;
                case 'ArrowDown':
                    deltaY = this.keyboardPanSpeed;
                    break;
                case 'ArrowLeft':
                    deltaX = -this.keyboardPanSpeed;
                    break;
                case 'ArrowRight':
                    deltaX = this.keyboardPanSpeed;
                    break;
            }
            
            console.log(`🧭 NavigationManager キーボードパン: deltaX=${deltaX}, deltaY=${deltaY} - Phase1.5スタブ`);
            
            // Phase1.5: CoordinateManager連携でのパン実装準備
            // 詳細実装は次ステップで CoordinateManager.applyPan(deltaX, deltaY) 予定
            
            // EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('navigation:pan', { deltaX, deltaY, source: 'keyboard' });
            }
        }
        
        /**
         * ズーム処理（Phase1.5スタブ実装）
         */
        handleZoom(delta, centerX, centerY) {
            if (!this.coordinateManager) {
                console.warn('⚠️ NavigationManager: CoordinateManager未初期化 - ズーム無効');
                return;
            }
            
            const oldZoom = this.zoomLevel;
            this.zoomLevel = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoomLevel + delta * this.zoomStep));
            
            if (oldZoom !== this.zoomLevel) {
                console.log(`🧭 NavigationManager ズーム: ${oldZoom.toFixed(2)} -> ${this.zoomLevel.toFixed(2)} - Phase1.5スタブ`);
                
                // Phase1.5: CoordinateManager連携でのズーム実装準備
                // 詳細実装は次ステップで CoordinateManager.applyZoom() 予定
                
                // EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('navigation:zoom', { 
                        oldZoom, 
                        newZoom: this.zoomLevel, 
                        centerX, 
                        centerY 
                    });
                }
            }
        }
        
        /**
         * パン開始（Phase1.5スタブ実装）
         */
        startPan(x, y) {
            console.log(`🧭 NavigationManager パン開始: (${x}, ${y}) - Phase1.5スタブ`);
            this.isPanning = true;
            this.panStartPos = { x, y };
            this.panAccumulator = { x: 0, y: 0 };
        }
        
        /**
         * パン実行（Phase1.5スタブ実装）
         */
        updatePan(x, y) {
            if (!this.isPanning) return;
            
            const deltaX = x - this.panStartPos.x;
            const deltaY = y - this.panStartPos.y;
            
            this.panAccumulator.x += deltaX;
            this.panAccumulator.y += deltaY;
            
            console.log(`🧭 NavigationManager パン更新: delta=(${deltaX}, ${deltaY}), total=(${this.panAccumulator.x}, ${this.panAccumulator.y}) - Phase1.5スタブ`);
            
            // Phase1.5: CoordinateManager連携でのパン実装準備
            // 詳細実装は次ステップで CoordinateManager.applyPan() 予定
            
            this.panStartPos = { x, y };
        }
        
        /**
         * パン終了（Phase1.5スタブ実装）
         */
        endPan() {
            if (!this.isPanning) return;
            
            console.log(`🧭 NavigationManager パン終了: total=(${this.panAccumulator.x}, ${this.panAccumulator.y}) - Phase1.5スタブ`);
            this.isPanning = false;
            
            // EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('navigation:pan:end', { 
                    totalDeltaX: this.panAccumulator.x, 
                    totalDeltaY: this.panAccumulator.y 
                });
            }
        }
        
        /**
         * ビューリセット（Phase1.5スタブ実装）
         */
        resetView() {
            console.log('🧭 NavigationManager ビューリセット - Phase1.5スタブ');
            
            this.zoomLevel = 1.0;
            this.panAccumulator = { x: 0, y: 0 };
            
            // Phase1.5: CoordinateManager連携でのリセット実装準備
            // 詳細実装は次ステップで CoordinateManager.resetTransform() 予定
            
            // EventBus通知（スタブ）
            if (this.eventBus) {
                this.eventBus.emit('navigation:reset', { zoom: this.zoomLevel });
            }
        }
        
        /**
         * 現在の状態取得（Phase1.5スタブ実装）
         */
        getNavigationState() {
            return {
                isPanning: this.isPanning,
                zoomLevel: this.zoomLevel,
                panPosition: { ...this.panAccumulator },
                initialized: this.initializeComplete
            };
        }
        
        /**
         * Phase1.5ステータス確認
         */
        getPhase15Status() {
            return {
                phase: 'Phase1.5',
                implementation: 'stub',
                features: {
                    keyboardPan: 'stub',
                    mousePan: 'stub',
                    zoom: 'stub',
                    coordinateManager: this.coordinateManager ? 'connected' : 'disconnected',
                    eventBus: this.eventBus ? 'connected' : 'disconnected'
                },
                nextStep: 'DetailedImplementation - CoordinateManager統合・パフォーマンス最適化'
            };
        }
    }
    
    // Tegaki名前空間にNavigationManagerを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.NavigationManager = NavigationManager;
    
    console.log('🧭 NavigationManager Phase1.5スタブ実装 - 名前空間登録完了');
    console.log('🔧 次のステップ: 詳細実装・CoordinateManager完全連携・パフォーマンス最適化');
    
})();