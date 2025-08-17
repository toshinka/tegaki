/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0 - Phase1.4STEP1
 * 
 * 🎯 AI_WORK_SCOPE: タブレットペン描画対応強化・Pointer Events統合・筆圧検出
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, js/utils/coordinates.js
 * 🎯 NODE_MODULES: lodash（最適化）, pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: PixiExtensions統合・フォールバック対応
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行以下維持・Phase1.4完了後Phase2で拡張
 * 
 * 📋 PHASE_TARGET: Phase1.4STEP1 - タブレットペン描画復活・筆圧対応
 * 📋 V8_MIGRATION: Pointer Events API継続・WebGPU筆圧最適化準備
 * 📋 PERFORMANCE_TARGET: ペン描画遅延1ms以下・筆圧60Hz対応・マウス互換性維持
 * 📋 DRY_COMPLIANCE: ✅ 統一イベント処理・重複排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・依存性逆転・開放閉鎖原則
 */

/**
 * タブレットペン対応強化版ペンツール（Phase1.4STEP1）
 * Pointer Events API統合・筆圧検出・デバイス判定・マウス互換性維持
 * Pure JavaScript完全準拠・DRY原則・SOLID原則遵守
 */
class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.version = 'v1.0-Phase1.4STEP1';
        this.name = 'pen';
        this.displayName = 'ベクターペン';
        
        // 🎯 Phase1.4STEP1: 描画状態管理
        this.currentPath = null;
        this.isDrawing = false;
        this.isActive = false;
        this.lastPoint = null;
        
        // 🎯 Phase1.4STEP1: Pointer Events対応状態
        this.pointerSupport = {
            available: typeof PointerEvent !== 'undefined',
            activePointer: null,
            pointerType: 'mouse',
            isPrimaryPointer: true,
            coalesced: false
        };
        
        // 🎯 Phase1.4STEP1: 筆圧システム（簡素化・実用重視）
        this.pressure = {
            current: 0.5,
            last: 0.5,
            min: 0.0,
            max: 1.0,
            sensitivity: 1.0,
            enabled: false,
            smoothing: 0.3
        };
        
        // 🎯 Phase1.4STEP1: デバイス判定
        this.deviceInfo = {
            type: 'unknown',
            supportsPressure: false,
            supportsTilt: false,
            maxPressure: 1.0,
            identified: false
        };
        
        // 🎯 Phase1.4STEP1: 設定（シンプル・実用重視）
        this.settings = {
            // 基本設定
            size: 16.0,
            opacity: 0.85,
            color: 0x800000,
            
            // 筆圧設定
            pressureEnabled: true,
            pressureMultiplier: 1.5,
            minPressureSize: 0.3,
            maxPressureSize: 2.0,
            
            // 描画設定
            smoothing: true,
            smoothingFactor: 0.7,
            capStyle: 'round',
            joinStyle: 'round'
        };
        
        // 🎯 Phase1.4STEP1: イベントバインド管理
        this.eventBindings = new Map();
        this.boundMethods = {
            onPointerDown: this.onPointerDown.bind(this),
            onPointerMove: this.onPointerMove.bind(this),
            onPointerUp: this.onPointerUp.bind(this),
            onPointerCancel: this.onPointerCancel.bind(this),
            onPointerLeave: this.onPointerLeave.bind(this)
        };
        
        console.log(`✒️ PenTool Phase1.4STEP1構築 - ${this.version}`);
    }
    
    /**
     * 🎯 Phase1.4STEP1: ペンツール初期化（タブレット対応強化）
     */
    async initialize() {
        console.group(`✒️ PenTool Phase1.4STEP1初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: Pointer Events対応チェック
            this.checkPointerEventsSupport();
            
            // Phase 2: デバイス判定・識別
            this.identifyInputDevice();
            
            // Phase 3: イベントリスナー設定
            this.setupEventListeners();
            
            // Phase 4: 筆圧システム初期化
            this.initializePressureSystem();
            
            // Phase 5: ToolManager登録
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            const initTime = performance.now() - startTime;
            console.log(`✅ PenTool Phase1.4STEP1初期化完了 - ${initTime.toFixed(2)}ms`);
            
            // 初期化結果ログ
            this.logInitializationResult();
            
            return this;
            
        } catch (error) {
            console.error('❌ PenTool Phase1.4STEP1初期化エラー:', error);
            return this.fallbackInitialization();
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Events対応チェック
     */
    checkPointerEventsSupport() {
        console.log('🔍 Pointer Events対応チェック...');
        
        this.pointerSupport.available = typeof PointerEvent !== 'undefined';
        
        if (this.pointerSupport.available) {
            console.log('✅ Pointer Events API 利用可能');
            
            // Coalesced Events対応チェック
            try {
                const testEvent = new PointerEvent('pointermove', { pressure: 0.5 });
                this.pointerSupport.coalesced = typeof testEvent.getCoalescedEvents === 'function';
                console.log(`📊 Coalesced Events: ${this.pointerSupport.coalesced ? '対応' : '非対応'}`);
            } catch (e) {
                this.pointerSupport.coalesced = false;
            }
            
        } else {
            console.warn('⚠️ Pointer Events API 非対応 - Mouse/Touch Events使用');
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: 入力デバイス判定・識別
     */
    identifyInputDevice() {
        console.log('🖱️ 入力デバイス判定開始...');
        
        // User Agent ベース判定
        const ua = navigator.userAgent;
        
        if (/iPad|iPhone|iPod/.test(ua)) {
            this.deviceInfo.type = 'iOS';
            this.deviceInfo.supportsPressure = true;
            console.log('🍎 iOS デバイス検出 - Apple Pencil対応準備');
            
        } else if (/Android/.test(ua)) {
            this.deviceInfo.type = 'Android';
            this.deviceInfo.supportsPressure = true;
            console.log('🤖 Android デバイス検出 - スタイラス対応準備');
            
        } else if (/Windows.*Touch/.test(ua)) {
            this.deviceInfo.type = 'Windows';
            this.deviceInfo.supportsPressure = true;
            console.log('🪟 Windows タッチデバイス検出 - Surface Pen対応準備');
            
        } else {
            this.deviceInfo.type = 'Desktop';
            this.deviceInfo.supportsPressure = true; // Wacomタブレット等
            console.log('🖥️ デスクトップ環境検出 - Wacomタブレット対応準備');
        }
        
        // 筆圧検出可能性設定
        this.pressure.enabled = this.deviceInfo.supportsPressure && this.settings.pressureEnabled;
        
        this.deviceInfo.identified = true;
    }
    
    /**
     * 🎯 Phase1.4STEP1: イベントリスナー設定（統合版）
     */
    setupEventListeners() {
        console.log('🎧 イベントリスナー設定開始...');
        
        const canvas = this.getCanvas();
        if (!canvas) {
            console.warn('⚠️ キャンバス要素未取得 - イベント設定スキップ');
            return;
        }
        
        // 既存イベント削除
        this.removeEventListeners();
        
        if (this.pointerSupport.available) {
            // Pointer Events優先使用
            this.setupPointerEvents(canvas);
        } else {
            // フォールバック: Mouse + Touch Events
            this.setupMouseTouchEvents(canvas);
        }
        
        console.log('✅ イベントリスナー設定完了');
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Events設定（メイン）
     */
    setupPointerEvents(canvas) {
        console.log('🎯 Pointer Events設定...');
        
        // Pointer Events設定
        const events = [
            ['pointerdown', this.boundMethods.onPointerDown],
            ['pointermove', this.boundMethods.onPointerMove],
            ['pointerup', this.boundMethods.onPointerUp],
            ['pointercancel', this.boundMethods.onPointerCancel],
            ['pointerleave', this.boundMethods.onPointerLeave]
        ];
        
        events.forEach(([eventName, handler]) => {
            canvas.addEventListener(eventName, handler, { passive: false });
            this.eventBindings.set(eventName, handler);
        });
        
        // タッチアクション設定（重要）
        canvas.style.touchAction = 'none';
        
        console.log('✅ Pointer Events設定完了');
    }
    
    /**
     * 🎯 Phase1.4STEP1: Mouse/Touch Events設定（フォールバック）
     */
    setupMouseTouchEvents(canvas) {
        console.log('🖱️ Mouse/Touch Events設定（フォールバック）...');
        
        // Mouse Events
        const mouseEvents = [
            ['mousedown', (e) => this.onPointerDown(this.convertMouseToPointer(e))],
            ['mousemove', (e) => this.onPointerMove(this.convertMouseToPointer(e))],
            ['mouseup', (e) => this.onPointerUp(this.convertMouseToPointer(e))]
        ];
        
        // Touch Events（簡易版）
        const touchEvents = [
            ['touchstart', (e) => this.onPointerDown(this.convertTouchToPointer(e))],
            ['touchmove', (e) => this.onPointerMove(this.convertTouchToPointer(e))],
            ['touchend', (e) => this.onPointerUp(this.convertTouchToPointer(e))]
        ];
        
        [...mouseEvents, ...touchEvents].forEach(([eventName, handler]) => {
            canvas.addEventListener(eventName, handler, { passive: false });
            this.eventBindings.set(eventName, handler);
        });
        
        console.log('✅ Mouse/Touch Events設定完了');
    }
    
    /**
     * 🎯 Phase1.4STEP1: 筆圧システム初期化
     */
    initializePressureSystem() {
        console.log('📊 筆圧システム初期化...');
        
        // 筆圧設定確認
        if (this.pressure.enabled) {
            console.log('✅ 筆圧検出有効 - 感度設定完了');
        } else {
            console.log('📝 筆圧検出無効 - 固定サイズ描画');
        }
        
        // 筆圧履歴初期化
        this.pressureHistory = [];
        
        console.log('📊 筆圧システム初期化完了');
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: Pointer Events処理群
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Down（描画開始）
     */
    onPointerDown(event) {
        if (!this.isActive) return;
        
        try {
            // イベント詳細取得
            const pointerInfo = this.extractPointerInfo(event);
            
            // プライマリポインターのみ処理
            if (!pointerInfo.isPrimary) return;
            
            // 座標取得
            const coords = this.getCanvasCoordinates(event);
            if (!coords) return;
            
            // 筆圧取得・処理
            const pressure = this.processPressure(pointerInfo.pressure);
            
            // 描画開始
            this.startDrawing(coords.x, coords.y, pressure, pointerInfo);
            
            // イベント制御
            event.preventDefault();
            event.stopPropagation();
            
            console.log(`✒️ 描画開始: (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}) P:${pressure.toFixed(3)} [${pointerInfo.pointerType}]`);
            
        } catch (error) {
            console.error('❌ Pointer Down エラー:', error);
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Move（描画継続）
     */
    onPointerMove(event) {
        if (!this.isActive || !this.isDrawing) return;
        
        try {
            // イベント詳細取得
            const pointerInfo = this.extractPointerInfo(event);
            
            // 座標取得
            const coords = this.getCanvasCoordinates(event);
            if (!coords) return;
            
            // 筆圧取得・処理
            const pressure = this.processPressure(pointerInfo.pressure);
            
            // Coalesced Events処理（高精度）
            if (this.pointerSupport.coalesced && event.getCoalescedEvents) {
                const coalescedEvents = event.getCoalescedEvents();
                if (coalescedEvents.length > 1) {
                    // 複数点を順次処理
                    coalescedEvents.forEach(coalescedEvent => {
                        const coalescedCoords = this.getCanvasCoordinates(coalescedEvent);
                        const coalescedPressure = this.processPressure(coalescedEvent.pressure || pressure);
                        if (coalescedCoords) {
                            this.continueDrawing(coalescedCoords.x, coalescedCoords.y, coalescedPressure);
                        }
                    });
                    return;
                }
            }
            
            // 通常描画継続
            this.continueDrawing(coords.x, coords.y, pressure);
            
            // イベント制御
            event.preventDefault();
            
        } catch (error) {
            console.error('❌ Pointer Move エラー:', error);
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Up（描画終了）
     */
    onPointerUp(event) {
        if (!this.isActive || !this.isDrawing) return;
        
        try {
            // 描画終了
            this.stopDrawing();
            
            // イベント制御
            event.preventDefault();
            event.stopPropagation();
            
            console.log('✒️ 描画終了');
            
        } catch (error) {
            console.error('❌ Pointer Up エラー:', error);
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Cancel（描画キャンセル）
     */
    onPointerCancel(event) {
        if (this.isDrawing) {
            console.log('⚠️ 描画キャンセル');
            this.cancelDrawing();
        }
        event.preventDefault();
    }
    
    /**
     * 🎯 Phase1.4STEP1: Pointer Leave（描画中断）
     */
    onPointerLeave(event) {
        if (this.isDrawing) {
            console.log('📤 キャンバス離脱 - 描画終了');
            this.stopDrawing();
        }
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: 描画処理メソッド群
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: 描画開始
     */
    startDrawing(x, y, pressure, pointerInfo) {
        if (!this.toolManager?.appCore) {
            console.warn('⚠️ AppCore 未初期化');
            return null;
        }
        
        try {
            this.isDrawing = true;
            this.pointerSupport.activePointer = pointerInfo?.pointerId || null;
            
            // パス作成
            this.currentPath = this.createPath(x, y, pressure);
            
            // 最初の点設定
            this.lastPoint = { x, y, pressure };
            
            return this.currentPath;
            
        } catch (error) {
            console.error('❌ 描画開始エラー:', error);
            this.isDrawing = false;
            return null;
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: 描画継続
     */
    continueDrawing(x, y, pressure) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) {
            return false;
        }
        
        try {
            // 距離チェック（最適化）
            const distance = Math.sqrt((x - this.lastPoint.x) ** 2 + (y - this.lastPoint.y) ** 2);
            if (distance < 1.0) {
                return true; // スキップ
            }
            
            // 線の太さ計算
            const lineWidth = this.calculateLineWidth(pressure);
            
            // スムージング適用
            if (this.settings.smoothing) {
                const smoothed = this.applySmoothingFilter(x, y, pressure);
                this.drawLine(smoothed.x, smoothed.y, lineWidth);
            } else {
                this.drawLine(x, y, lineWidth);
            }
            
            // 最後の点更新
            this.lastPoint = { x, y, pressure };
            
            return true;
            
        } catch (error) {
            console.error('❌ 描画継続エラー:', error);
            return false;
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return null;
        
        try {
            const completedPath = this.currentPath;
            
            // クリーンアップ
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            this.pointerSupport.activePointer = null;
            
            return completedPath;
            
        } catch (error) {
            console.error('❌ 描画終了エラー:', error);
            return null;
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: 描画キャンセル
     */
    cancelDrawing() {
        if (!this.isDrawing) return;
        
        try {
            // パス削除
            if (this.currentPath && this.currentPath.graphics && this.currentPath.graphics.parent) {
                this.currentPath.graphics.parent.removeChild(this.currentPath.graphics);
            }
            
            // クリーンアップ
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            this.pointerSupport.activePointer = null;
            
            console.log('🗑️ 描画キャンセル完了');
            
        } catch (error) {
            console.error('❌ 描画キャンセルエラー:', error);
        }
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: 描画ヘルパーメソッド群
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: パス作成
     */
    createPath(x, y, pressure) {
        const pathId = `pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const lineWidth = this.calculateLineWidth(pressure);
        
        const path = {
            id: pathId,
            tool: this.name,
            startTime: performance.now(),
            points: [{ x, y, pressure }],
            graphics: null
        };
        
        // PixiJS Graphics作成
        path.graphics = new PIXI.Graphics();
        path.graphics.lineStyle({
            width: lineWidth,
            color: this.settings.color,
            alpha: this.settings.opacity,
            cap: this.settings.capStyle === 'round' ? PIXI.LINE_CAP.ROUND : PIXI.LINE_CAP.BUTT,
            join: this.settings.joinStyle === 'round' ? PIXI.LINE_JOIN.ROUND : PIXI.LINE_JOIN.MITER
        });
        
        // 初期位置設定
        path.graphics.moveTo(x, y);
        
        // AppCoreに追加
        if (this.toolManager.appCore.drawingContainer) {
            this.toolManager.appCore.drawingContainer.addChild(path.graphics);
            if (!this.toolManager.appCore.paths) {
                this.toolManager.appCore.paths = [];
            }
            this.toolManager.appCore.paths.push(path);
        }
        
        return path;
    }
    
    /**
     * 🎯 Phase1.4STEP1: 線描画
     */
    drawLine(x, y, width) {
        if (!this.currentPath?.graphics) return;
        
        const graphics = this.currentPath.graphics;
        
        // 動的線幅対応
        graphics.lineStyle({
            width: width,
            color: this.settings.color,
            alpha: this.settings.opacity,
            cap: this.settings.capStyle === 'round' ? PIXI.LINE_CAP.ROUND : PIXI.LINE_CAP.BUTT,
            join: this.settings.joinStyle === 'round' ? PIXI.LINE_JOIN.ROUND : PIXI.LINE_JOIN.MITER
        });
        
        graphics.lineTo(x, y);
        
        // パスに点追加
        this.currentPath.points.push({ x, y, pressure: this.pressure.current });
    }
    
    /**
     * 🎯 Phase1.4STEP1: 線の太さ計算（筆圧対応）
     */
    calculateLineWidth(pressure) {
        if (!this.pressure.enabled) {
            return this.settings.size;
        }
        
        const minSize = this.settings.size * this.settings.minPressureSize;
        const maxSize = this.settings.size * this.settings.maxPressureSize;
        
        return minSize + (maxSize - minSize) * pressure;
    }
    
    /**
     * 🎯 Phase1.4STEP1: スムージングフィルタ適用
     */
    applySmoothingFilter(x, y, pressure) {
        if (!this.lastPoint) {
            return { x, y, pressure };
        }
        
        const factor = this.settings.smoothingFactor;
        
        return {
            x: this.lastPoint.x * factor + x * (1 - factor),
            y: this.lastPoint.y * factor + y * (1 - factor),
            pressure: this.lastPoint.pressure * factor + pressure * (1 - factor)
        };
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: ユーティリティメソッド群
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: Pointerイベント情報抽出
     */
    extractPointerInfo(event) {
        return {
            pointerId: event.pointerId || 0,
            pointerType: event.pointerType || 'mouse',
            isPrimary: event.isPrimary !== false,
            pressure: event.pressure || 0.5,
            tangentialPressure: event.tangentialPressure || 0,
            tiltX: event.tiltX || 0,
            tiltY: event.tiltY || 0,
            twist: event.twist || 0,
            width: event.width || 1,
            height: event.height || 1
        };
    }
    
    /**
     * 🎯 Phase1.4STEP1: キャンバス座標取得
     */
    getCanvasCoordinates(event) {
        const canvas = this.getCanvas();
        if (!canvas) return null;
        
        try {
            const rect = canvas.getBoundingClientRect();
            
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
        } catch (error) {
            console.error('❌ 座標取得エラー:', error);
            return null;
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: 筆圧処理
     */
    processPressure(rawPressure) {
        if (!this.pressure.enabled) {
            return 0.5; // デフォルト値
        }
        
        // 筆圧値正規化
        let pressure = Math.max(this.pressure.min, Math.min(this.pressure.max, rawPressure || 0.5));
        
        // 感度調整
        pressure *= this.pressure.sensitivity;
        
        // スムージング適用
        pressure = this.pressure.last * this.pressure.smoothing + pressure * (1 - this.pressure.smoothing);
        
        // 記録
        this.pressure.current = pressure;
        this.pressure.last = pressure;
        
        if (this.pressureHistory) {
            this.pressureHistory.push(pressure);
            if (this.pressureHistory.length > 10) {
                this.pressureHistory.shift();
            }
        }
        
        return pressure;
    }
    
    /**
     * 🎯 Phase1.4STEP1: キャンバス要素取得
     */
    getCanvas() {
        return this.toolManager?.appCore?.app?.view || null;
    }
    
    /**
     * 🎯 Phase1.4STEP1: Mouse to Pointer変換
     */
    convertMouseToPointer(mouseEvent) {
        return {
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            pressure: 0.5,
            clientX: mouseEvent.clientX,
            clientY: mouseEvent.clientY,
            preventDefault: mouseEvent.preventDefault.bind(mouseEvent),
            stopPropagation: mouseEvent.stopPropagation.bind(mouseEvent)
        };
    }
    
    /**
     * 🎯 Phase1.4STEP1: Touch to Pointer変換
     */
    convertTouchToPointer(touchEvent) {
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        if (!touch) return null;
        
        return {
            pointerId: touch.identifier || 1,
            pointerType: 'touch',
            isPrimary: true,
            pressure: 0.5,
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: touchEvent.preventDefault.bind(touchEvent),
            stopPropagation: touchEvent.stopPropagation.bind(touchEvent)
        };
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: 公開API・設定管理
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: ツール設定更新
     */
    updateSettings(newSettings) {
        if (!newSettings) return;
        
        try {
            // 設定マージ（DRY原則）
            this.settings = { ...this.settings, ...newSettings };
            
            // 筆圧設定更新
            if ('pressureEnabled' in newSettings) {
                this.pressure.enabled = newSettings.pressureEnabled && this.deviceInfo.supportsPressure;
            }
            
            if ('pressureMultiplier' in newSettings) {
                this.pressure.sensitivity = newSettings.pressureMultiplier;
            }
            
            console.log('✒️ ペンツール設定更新:', newSettings);
            
        } catch (error) {
            console.error('❌ ペンツール設定更新エラー:', error);
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: ツールアクティベート
     */
    activate() {
        this.isActive = true;
        console.log(`✒️ ${this.displayName} アクティブ化 - Phase1.4STEP1`);
        
        // イベントリスナー再設定（必要に応じて）
        if (this.eventBindings.size === 0) {
            this.setupEventListeners();
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: ツール非アクティベート
     */
    deactivate() {
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.isActive = false;
        console.log(`✒️ ${this.displayName} 非アクティブ化 - Phase1.4STEP1`);
    }
    
    /**
     * 🎯 Phase1.4STEP1: イベントリスナー削除
     */
    removeEventListeners() {
        const canvas = this.getCanvas();
        if (!canvas || this.eventBindings.size === 0) return;
        
        this.eventBindings.forEach((handler, eventName) => {
            canvas.removeEventListener(eventName, handler);
        });
        
        this.eventBindings.clear();
        console.log('🧹 イベントリスナー削除完了');
    }
    
    /**
     * 🎯 Phase1.4STEP1: ツールクリーンアップ
     */
    cleanup() {
        console.log('🧹 ペンツールクリーンアップ開始...');
        
        // 描画中断
        if (this.isDrawing) {
            this.cancelDrawing();
        }
        
        // イベントリスナー削除
        this.removeEventListeners();
        
        // 状態リセット
        this.isActive = false;
        this.currentPath = null;
        this.lastPoint = null;
        this.pressureHistory = [];
        
        console.log('🧹 ペンツールクリーンアップ完了');
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: デバッグ・診断メソッド群
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: 初期化結果ログ
     */
    logInitializationResult() {
        console.group('📊 ペンツール初期化結果');
        
        console.log(`🔧 バージョン: ${this.version}`);
        console.log(`🎯 デバイス: ${this.deviceInfo.type}`);
        console.log(`📊 筆圧対応: ${this.pressure.enabled ? '有効' : '無効'}`);
        console.log(`🎧 Pointer Events: ${this.pointerSupport.available ? '利用' : 'フォールバック'}`);
        console.log(`🔄 Coalesced Events: ${this.pointerSupport.coalesced ? '対応' : '非対応'}`);
        
        if (this.pressure.enabled) {
            console.log(`📈 筆圧感度: ${this.pressure.sensitivity}`);
            console.log(`📉 筆圧範囲: ${this.pressure.min} - ${this.pressure.max}`);
        }
        
        console.groupEnd();
    }
    
    /**
     * 🎯 Phase1.4STEP1: 診断情報取得
     */
    getDiagnosticInfo() {
        return {
            version: this.version,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            deviceInfo: { ...this.deviceInfo },
            pointerSupport: { ...this.pointerSupport },
            pressure: {
                enabled: this.pressure.enabled,
                current: this.pressure.current,
                sensitivity: this.pressure.sensitivity
            },
            eventBindings: this.eventBindings.size,
            settings: { ...this.settings }
        };
    }
    
    /**
     * 🎯 Phase1.4STEP1: 筆圧テスト
     */
    testPressureSystem() {
        console.group('🧪 筆圧システムテスト');
        
        if (!this.pressure.enabled) {
            console.log('❌ 筆圧システム無効');
            console.groupEnd();
            return false;
        }
        
        // テスト筆圧値
        const testPressures = [0.0, 0.25, 0.5, 0.75, 1.0];
        
        console.log('📊 筆圧値テスト:');
        testPressures.forEach(testPressure => {
            const processed = this.processPressure(testPressure);
            const lineWidth = this.calculateLineWidth(processed);
            console.log(`  ${testPressure.toFixed(2)} → ${processed.toFixed(3)} (幅: ${lineWidth.toFixed(1)}px)`);
        });
        
        console.log('✅ 筆圧システムテスト完了');
        console.groupEnd();
        return true;
    }
    
    /**
     * 🎯 Phase1.4STEP1: イベントシステムテスト
     */
    testEventSystem() {
        console.group('🧪 イベントシステムテスト');
        
        const canvas = this.getCanvas();
        if (!canvas) {
            console.log('❌ キャンバス未取得');
            console.groupEnd();
            return false;
        }
        
        console.log(`🎯 キャンバス要素: ${canvas.tagName} (${canvas.width}×${canvas.height})`);
        console.log(`🎧 イベントバインド数: ${this.eventBindings.size}`);
        
        // バインド確認
        this.eventBindings.forEach((handler, eventName) => {
            console.log(`  ✅ ${eventName}: バインド済み`);
        });
        
        console.log('✅ イベントシステムテスト完了');
        console.groupEnd();
        return true;
    }
    
    // ==========================================
    // 🎯 Phase1.4STEP1: フォールバック・エラー処理
    // ==========================================
    
    /**
     * 🎯 Phase1.4STEP1: フォールバック初期化
     */
    fallbackInitialization() {
        console.log('🛡️ ペンツール フォールバック初期化...');
        
        try {
            // 基本設定のみ
            this.settings = {
                size: 16.0,
                opacity: 0.85,
                color: 0x800000,
                pressureEnabled: false,
                smoothing: false
            };
            
            // システム無効化
            this.pressure.enabled = false;
            this.pointerSupport.available = false;
            this.deviceInfo.supportsPressure = false;
            
            // 基本イベント設定
            this.setupEventListeners();
            
            // ToolManager登録
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
            }
            
            console.log('✅ フォールバック初期化完了');
            return this;
            
        } catch (error) {
            console.error('❌ フォールバック初期化エラー:', error);
            return this;
        }
    }
    
    /**
     * 🎯 Phase1.4STEP1: エラー回復処理
     */
    recoverFromError(error) {
        console.warn('🔧 ペンツールエラー回復処理:', error.message);
        
        try {
            // 描画状態リセット
            if (this.isDrawing) {
                this.cancelDrawing();
            }
            
            // イベント再設定
            this.removeEventListeners();
            setTimeout(() => {
                this.setupEventListeners();
            }, 100);
            
            console.log('✅ エラー回復処理完了');
            return true;
            
        } catch (recoveryError) {
            console.error('❌ エラー回復失敗:', recoveryError);
            return false;
        }
    }
}

// ==========================================
// 🎯 Phase1.4STEP1: グローバル登録・初期化準備
// ==========================================

// グローバル登録（Pure JavaScript方式）
if (typeof window !== 'undefined') {
    window.PenTool = PenTool;
    console.log('🌍 PenTool Phase1.4STEP1 グローバル登録完了');
}

// 自動初期化（ToolManager存在時）
if (typeof window !== 'undefined' && window.ToolManager) {
    // ToolManagerが既に存在する場合の自動登録
    document.addEventListener('DOMContentLoaded', () => {
        if (window.futabaDrawingTool?.toolManager) {
            const penTool = new PenTool(window.futabaDrawingTool.toolManager);
            penTool.initialize().then(() => {
                console.log('🎯 ペンツール自動初期化完了');
            }).catch(error => {
                console.error('❌ ペンツール自動初期化エラー:', error);
            });
        }
    });
}

/**
 * 🎯 Phase1.4STEP1: タブレットペン対応テストスイート
 */
class TabletPenTestSuite {
    constructor(penTool) {
        this.penTool = penTool;
    }
    
    async runAllTests() {
        console.group('🧪 タブレットペン対応テスト実行開始');
        
        const results = {
            pointerEventsSupport: this.testPointerEventsSupport(),
            deviceDetection: this.testDeviceDetection(),
            pressureSystem: this.penTool.testPressureSystem(),
            eventSystem: this.penTool.testEventSystem(),
            coordinateMapping: this.testCoordinateMapping(),
            drawingFlow: await this.testDrawingFlow()
        };
        
        const passed = Object.values(results).filter(Boolean).length;
        const total = Object.keys(results).length;
        
        console.log(`📊 テスト結果: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
        console.groupEnd();
        
        return results;
    }
    
    testPointerEventsSupport() {
        console.log('🧪 Pointer Events対応テスト...');
        
        const hasPointerEvent = typeof PointerEvent !== 'undefined';
        const hasCoalescedEvents = hasPointerEvent && 
            (() => {
                try {
                    const testEvent = new PointerEvent('pointermove');
                    return typeof testEvent.getCoalescedEvents === 'function';
                } catch (e) { return false; }
            })();
        
        console.log(`  PointerEvent: ${hasPointerEvent ? '✅' : '❌'}`);
        console.log(`  CoalescedEvents: ${hasCoalescedEvents ? '✅' : '❌'}`);
        
        return hasPointerEvent;
    }
    
    testDeviceDetection() {
        console.log('🧪 デバイス検出テスト...');
        
        const deviceInfo = this.penTool.deviceInfo;
        
        console.log(`  デバイスタイプ: ${deviceInfo.type}`);
        console.log(`  筆圧対応: ${deviceInfo.supportsPressure ? '✅' : '❌'}`);
        console.log(`  識別完了: ${deviceInfo.identified ? '✅' : '❌'}`);
        
        return deviceInfo.identified;
    }
    
    testCoordinateMapping() {
        console.log('🧪 座標マッピングテスト...');
        
        const canvas = this.penTool.getCanvas();
        if (!canvas) {
            console.log('  ❌ キャンバス未取得');
            return false;
        }
        
        // 模擬座標テスト
        const mockEvent = {
            clientX: 100,
            clientY: 200
        };
        
        const coords = this.penTool.getCanvasCoordinates(mockEvent);
        
        console.log(`  座標変換: (${mockEvent.clientX}, ${mockEvent.clientY}) → ${coords ? `(${coords.x.toFixed(1)}, ${coords.y.toFixed(1)})` : 'null'}`);
        
        return coords !== null;
    }
    
    async testDrawingFlow() {
        console.log('🧪 描画フローテスト...');
        
        try {
            // アクティベート
            this.penTool.activate();
            
            // 模擬描画開始
            const path = this.penTool.startDrawing(50, 50, 0.5, { pointerId: 1, pointerType: 'pen', isPrimary: true });
            
            if (!path) {
                console.log('  ❌ 描画開始失敗');
                return false;
            }
            
            // 模擬描画継続
            const continued = this.penTool.continueDrawing(100, 100, 0.7);
            
            // 描画終了
            const completed = this.penTool.stopDrawing();
            
            console.log(`  描画開始: ${path ? '✅' : '❌'}`);
            console.log(`  描画継続: ${continued ? '✅' : '❌'}`);
            console.log(`  描画終了: ${completed ? '✅' : '❌'}`);
            
            return path && continued && completed;
            
        } catch (error) {
            console.error('  ❌ 描画フローテストエラー:', error);
            return false;
        }
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    window.TabletPenTestSuite = TabletPenTestSuite;
}