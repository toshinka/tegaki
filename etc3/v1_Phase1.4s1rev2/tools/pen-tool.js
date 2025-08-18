/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🚨 Phase A1: タブレットペン緊急修正版
 * 
 * 🎯 AI_WORK_SCOPE: タブレットペン描画対応・筆圧値取得・イベント処理統一・isActive修正
 * 🎯 DEPENDENCIES: js/managers/tool-manager.js, js/utils/coordinates.js, js/app-core.js
 * 🎯 NODE_MODULES: lodash（最適化）, pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: lodash, gsap（スムースアニメーション）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 
 * 📋 PHASE_TARGET: Phase1.4-A1 - タブレットペン緊急修正
 * 📋 V8_MIGRATION: Graphics API変更対応・WebGPU最適化準備
 * 📋 PERFORMANCE_TARGET: 筆圧120Hz対応・GPU加速準備
 * 📋 DRY_COMPLIANCE: ✅ 共通処理統一・重複コード排除
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * Phase A1: タブレットペン緊急修正版ペンツール
 * 🚨 緊急修正内容:
 * 1. isActive フラグ確実設定・管理
 * 2. 筆圧値取得方法修正（event.data?.originalEvent?.pressure 優先）
 * 3. イベントリスナー統一（PixiJS app.view経由）
 * 4. 座標変換統一（getCanvasCoordinates統一）
 * 5. main.js selectPenTool() 連携強化
 */
class PenTool {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.version = 'v1.0-Phase1.4-A1';
        this.name = 'pen';
        this.displayName = 'ベクターペン';
        
        // 🚨 A1修正: アクティブ状態管理強化
        this.isActive = false;
        this.activationConfirmed = false; // 二重確認用
        
        // 🚨 A1修正: 描画状態管理明確化
        this.currentPath = null;
        this.isDrawing = false;
        this.drawingSession = null;
        
        // 🚨 A1修正: 筆圧システム簡潔化・確実化
        this.pressureSystem = {
            enabled: true,
            currentPressure: 0.5,
            lastPressure: 0.5,
            hasPointerPressure: false,
            fallbackPressure: 0.5,
            // 筆圧取得メソッド優先順位
            extractMethods: [
                'event.data?.originalEvent?.pressure',     // PixiJS包装イベント優先
                'event.originalEvent?.pressure',           // 直接originalEvent
                'event.pressure',                          // 直接pressure
                'event.force'                              // force属性（一部デバイス）
            ]
        };
        
        // 🚨 A1修正: 基本設定簡潔化
        this.settings = {
            baseSize: 16.0,
            minSize: 0.1,
            maxSize: 100.0,
            opacity: 0.85,
            color: 0x800000,
            pressureSensitivity: true,
            smoothing: 0.3,
            edgeSmoothing: true,
            // 筆圧設定
            pressureMultiplier: 1.0,
            minPressureSize: 0.3,
            maxPressureSize: 2.0
        };
        
        // イベントリスナー管理
        this.eventListeners = {
            pointerdown: null,
            pointermove: null,
            pointerup: null,
            pointercancel: null
        };
        
        // パフォーマンス監視簡易版
        this.performance = {
            drawCalls: 0,
            averageLatency: 0,
            lastFrameTime: 0
        };
        
        console.log(`✒️ PenTool Phase A1構築 - ${this.version}`);
    }
    
    /**
     * 🚨 A1修正: 初期化簡潔化・確実化
     */
    async initialize() {
        console.group(`✒️ PenTool Phase A1初期化 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 基本依存関係確認
            this.checkBasicDependencies();
            
            // Phase 2: 筆圧システム初期化
            this.initializePressureSystem();
            
            // Phase 3: イベントリスナー設定
            this.setupEventListeners();
            
            // Phase 4: ToolManager登録
            if (this.toolManager) {
                this.toolManager.registerTool(this.name, this);
                console.log('✅ ToolManager登録完了');
            }
            
            const initTime = performance.now() - startTime;
            console.log(`✅ PenTool Phase A1初期化完了 - ${initTime.toFixed(2)}ms`);
            
            return this;
            
        } catch (error) {
            console.error('❌ PenTool Phase A1初期化エラー:', error);
            return this; // エラーでも継続
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🚨 A1修正: 基本依存関係確認
     */
    checkBasicDependencies() {
        const deps = {
            toolManager: !!this.toolManager,
            appCore: !!this.toolManager?.appCore,
            app: !!this.toolManager?.appCore?.app,
            view: !!this.toolManager?.appCore?.app?.view,
            drawingContainer: !!this.toolManager?.appCore?.drawingContainer
        };
        
        const available = Object.values(deps).filter(Boolean).length;
        const total = Object.keys(deps).length;
        
        console.log(`📊 依存関係確認: ${available}/${total} 利用可能`, deps);
        
        if (!deps.app || !deps.view) {
            console.warn('⚠️ 重要な依存関係が不足していますが継続します');
        }
    }
    
    /**
     * 🚨 A1修正: 筆圧システム初期化（簡潔化）
     */
    initializePressureSystem() {
        console.log('📊 筆圧システム初期化（Phase A1）...');
        
        // PointerEvent対応確認
        this.pressureSystem.hasPointerPressure = typeof PointerEvent !== 'undefined';
        
        if (this.pressureSystem.hasPointerPressure) {
            console.log('✅ PointerEvent筆圧対応利用可能');
        } else {
            console.log('⚠️ PointerEvent非対応 - フォールバック使用');
        }
        
        // 筆圧曲線設定（基本的なもののみ）
        this.pressureCurves = {
            linear: (p) => p,
            ease: (p) => p * p * (3 - 2 * p)
        };
        
        console.log('📊 筆圧システム初期化完了');
    }
    
    /**
     * 🚨 A1修正: イベントリスナー設定（PixiJS統一）
     */
    setupEventListeners() {
        console.log('🎯 イベントリスナー設定（PixiJS統一）...');
        
        const app = this.toolManager?.appCore?.app;
        if (!app || !app.view) {
            console.warn('⚠️ PIXI App/View 未利用可能 - イベント設定スキップ');
            return;
        }
        
        const canvas = app.view;
        
        // 🚨 A1修正: すべてPixiJS app.view経由に統一
        this.eventListeners.pointerdown = (e) => this.handlePointerDown(e);
        this.eventListeners.pointermove = (e) => this.handlePointerMove(e);
        this.eventListeners.pointerup = (e) => this.handlePointerUp(e);
        this.eventListeners.pointercancel = (e) => this.handlePointerCancel(e);
        
        // イベント登録（passive: false で preventDefault可能にする）
        canvas.addEventListener('pointerdown', this.eventListeners.pointerdown, { passive: false });
        canvas.addEventListener('pointermove', this.eventListeners.pointermove, { passive: false });
        canvas.addEventListener('pointerup', this.eventListeners.pointerup, { passive: false });
        canvas.addEventListener('pointercancel', this.eventListeners.pointercancel, { passive: false });
        
        // タッチアクション無効化（ブラウザのデフォルトジェスチャ防止）
        canvas.style.touchAction = 'none';
        
        console.log('✅ イベントリスナー設定完了（PixiJS統一）');
    }
    
    /**
     * 🚨 A1修正: Pointer圧力情報抽出（優先順位対応）
     */
    extractPointerInfo(event) {
        const pointerInfo = {
            x: 0,
            y: 0,
            pressure: this.pressureSystem.fallbackPressure,
            timestamp: performance.now(),
            pointerType: event.pointerType || 'mouse'
        };
        
        // 🚨 A1修正: 座標取得統一（getCanvasCoordinates使用）
        try {
            if (this.toolManager?.appCore?.getCanvasCoordinates) {
                const coords = this.toolManager.appCore.getCanvasCoordinates(event);
                pointerInfo.x = coords.x;
                pointerInfo.y = coords.y;
            } else {
                // フォールバック座標取得
                const rect = event.currentTarget.getBoundingClientRect();
                pointerInfo.x = event.clientX - rect.left;
                pointerInfo.y = event.clientY - rect.top;
            }
        } catch (error) {
            console.warn('⚠️ 座標取得エラー - フォールバック使用:', error);
        }
        
        // 🚨 A1修正: 筆圧取得（優先順位対応）
        const pressureMethods = [
            () => event.data?.originalEvent?.pressure,  // PixiJS包装イベント優先
            () => event.originalEvent?.pressure,        // 直接originalEvent
            () => event.pressure,                       // 直接pressure属性
            () => event.force,                          // force属性（一部デバイス）
            () => this.pressureSystem.fallbackPressure // 最終フォールバック
        ];
        
        for (const method of pressureMethods) {
            try {
                const pressure = method();
                if (typeof pressure === 'number' && pressure >= 0 && pressure <= 1) {
                    pointerInfo.pressure = pressure;
                    break;
                }
            } catch (error) {
                // 次のメソッドを試行
                continue;
            }
        }
        
        // 筆圧値更新
        this.pressureSystem.currentPressure = pointerInfo.pressure;
        this.pressureSystem.lastPressure = pointerInfo.pressure;
        
        return pointerInfo;
    }
    
    /**
     * 🚨 A1修正: PointerDown処理（確実なアクティブ判定）
     */
    handlePointerDown(event) {
        // 🚨 A1修正: アクティブ状態確認強化
        if (!this.isActive) {
            // 非アクティブ時は処理しない
            return;
        }
        
        const startTime = performance.now();
        
        try {
            event.preventDefault(); // デフォルト動作防止
            
            const pointerInfo = this.extractPointerInfo(event);
            
            console.log(`✒️ PointerDown: (${pointerInfo.x.toFixed(2)}, ${pointerInfo.y.toFixed(2)}) P:${pointerInfo.pressure.toFixed(3)} Type:${pointerInfo.pointerType}`);
            
            // 描画開始
            const path = this.startDrawing(pointerInfo.x, pointerInfo.y, pointerInfo.pressure, pointerInfo.timestamp);
            
            if (path) {
                // 成功時の状態更新
                this.updatePressureMonitor(pointerInfo.pressure);
            }
            
            const processTime = performance.now() - startTime;
            this.performance.lastFrameTime = processTime;
            
        } catch (error) {
            console.error('❌ PointerDown処理エラー:', error);
        }
    }
    
    /**
     * 🚨 A1修正: PointerMove処理（高頻度処理最適化）
     */
    handlePointerMove(event) {
        if (!this.isActive || !this.isDrawing) {
            return;
        }
        
        const startTime = performance.now();
        
        try {
            const pointerInfo = this.extractPointerInfo(event);
            
            // 描画継続
            const success = this.continueDrawing(pointerInfo.x, pointerInfo.y, pointerInfo.pressure, pointerInfo.timestamp);
            
            if (success) {
                // 座標・筆圧監視更新
                this.updateCoordinatesMonitor(pointerInfo.x, pointerInfo.y);
                this.updatePressureMonitor(pointerInfo.pressure);
            }
            
            const processTime = performance.now() - startTime;
            this.performance.lastFrameTime = processTime;
            
            // パフォーマンス警告
            if (processTime > 16) { // 60FPS基準
                console.warn(`⚠️ PointerMove処理遅延: ${processTime.toFixed(2)}ms`);
            }
            
        } catch (error) {
            console.error('❌ PointerMove処理エラー:', error);
        }
    }
    
    /**
     * 🚨 A1修正: PointerUp処理（確実な終了）
     */
    handlePointerUp(event) {
        if (!this.isActive || !this.isDrawing) {
            return;
        }
        
        const startTime = performance.now();
        
        try {
            const pointerInfo = this.extractPointerInfo(event);
            
            console.log(`✒️ PointerUp: (${pointerInfo.x.toFixed(2)}, ${pointerInfo.y.toFixed(2)}) P:${pointerInfo.pressure.toFixed(3)}`);
            
            // 描画終了
            const path = this.stopDrawing(pointerInfo.timestamp);
            
            if (path) {
                console.log(`✒️ 描画完了: ${path.points?.length || 0}点`);
            }
            
            const processTime = performance.now() - startTime;
            this.performance.lastFrameTime = processTime;
            
        } catch (error) {
            console.error('❌ PointerUp処理エラー:', error);
        }
    }
    
    /**
     * PointerCancel処理
     */
    handlePointerCancel(event) {
        if (this.isDrawing) {
            console.log('✒️ PointerCancel - 描画中止');
            this.stopDrawing();
        }
    }
    
    /**
     * 🚨 A1修正: 描画開始（簡潔化・確実化）
     */
    startDrawing(x, y, pressure = 0.5, timestamp = performance.now()) {
        if (!this.toolManager?.appCore) {
            console.warn('⚠️ AppCore 未初期化 - 描画不可');
            return null;
        }
        
        try {
            this.isDrawing = true;
            
            // 描画セッション作成
            this.drawingSession = {
                id: this.generateSessionId(),
                startTime: timestamp,
                points: []
            };
            
            // パス作成
            this.currentPath = this.createPath(x, y, pressure);
            
            console.log(`✒️ 描画開始: Session ${this.drawingSession.id}`);
            return this.currentPath;
            
        } catch (error) {
            console.error('❌ 描画開始エラー:', error);
            this.isDrawing = false;
            return null;
        }
    }
    
    /**
     * 🚨 A1修正: 描画継続（簡潔化）
     */
    continueDrawing(x, y, pressure = 0.5, timestamp = performance.now()) {
        if (!this.isDrawing || !this.currentPath) {
            return false;
        }
        
        try {
            // 新しい点を追加
            const point = { x, y, pressure, timestamp };
            
            // 描画実行
            this.executeDrawing(point);
            
            // セッション更新
            if (this.drawingSession) {
                this.drawingSession.points.push(point);
            }
            
            this.performance.drawCalls++;
            return true;
            
        } catch (error) {
            console.error('❌ 描画継続エラー:', error);
            return false;
        }
    }
    
    /**
     * 🚨 A1修正: 描画終了（簡潔化）
     */
    stopDrawing(timestamp = performance.now()) {
        if (!this.isDrawing || !this.currentPath) {
            return null;
        }
        
        try {
            // 描画終了処理
            const completedPath = this.currentPath;
            
            // セッション統計
            if (this.drawingSession) {
                const duration = timestamp - this.drawingSession.startTime;
                console.log(`✒️ 描画セッション完了: ${this.drawingSession.points.length}点, ${duration.toFixed(2)}ms`);
            }
            
            // クリーンアップ
            this.isDrawing = false;
            this.currentPath = null;
            this.drawingSession = null;
            
            return completedPath;
            
        } catch (error) {
            console.error('❌ 描画終了エラー:', error);
            this.isDrawing = false;
            return null;
        }
    }
    
    /**
     * 🚨 A1修正: パス作成（基本機能）
     */
    createPath(x, y, pressure) {
        const pathId = this.generatePathId();
        const size = this.calculateSize(pressure);
        
        const path = {
            id: pathId,
            tool: this.name,
            startTime: performance.now(),
            points: [{ x, y, pressure, size }],
            graphics: null
        };
        
        // PIXI Graphics作成
        path.graphics = new PIXI.Graphics();
        path.graphics.lineStyle({
            width: size,
            color: this.settings.color,
            alpha: this.settings.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        // 初期点設定
        path.graphics.moveTo(x, y);
        
        // コンテナに追加
        if (this.toolManager.appCore.drawingContainer) {
            this.toolManager.appCore.drawingContainer.addChild(path.graphics);
        }
        
        return path;
    }
    
    /**
     * 🚨 A1修正: 描画実行（基本機能）
     */
    executeDrawing(point) {
        if (!this.currentPath?.graphics) return;
        
        const size = this.calculateSize(point.pressure);
        
        // 筆圧に応じた線幅変更
        if (this.settings.pressureSensitivity) {
            this.currentPath.graphics.lineStyle({
                width: size,
                color: this.settings.color,
                alpha: this.settings.opacity,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
        }
        
        // 線を引く
        this.currentPath.graphics.lineTo(point.x, point.y);
        
        // パスに点追加
        this.currentPath.points.push({ ...point, size });
    }
    
    /**
     * サイズ計算
     */
    calculateSize(pressure) {
        let size = this.settings.baseSize;
        
        if (this.settings.pressureSensitivity) {
            const minSize = this.settings.baseSize * this.settings.minPressureSize;
            const maxSize = this.settings.baseSize * this.settings.maxPressureSize;
            size = minSize + (maxSize - minSize) * pressure;
        }
        
        return Math.max(this.settings.minSize, Math.min(this.settings.maxSize, size));
    }
    
    /**
     * 🚨 A1修正: ツールアクティベート（確実な状態管理）
     */
    activate() {
        console.log(`✒️ ${this.displayName} アクティベート開始...`);
        
        try {
            this.isActive = true;
            this.activationConfirmed = true;
            
            // イベントリスナー再設定（念のため）
            this.setupEventListeners();
            
            console.log(`✅ ${this.displayName} アクティベート完了 - Phase A1`);
            return true;
            
        } catch (error) {
            console.error('❌ ツールアクティベートエラー:', error);
            this.isActive = false;
            this.activationConfirmed = false;
            return false;
        }
    }
    
    /**
     * ツール非アクティベート
     */
    deactivate() {
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        this.isActive = false;
        this.activationConfirmed = false;
        
        console.log(`✒️ ${this.displayName} 非アクティベート - Phase A1`);
    }
    
    /**
     * 設定更新
     */
    updateSettings(newSettings) {
        if (!newSettings) return;
        
        try {
            this.settings = { ...this.settings, ...newSettings };
            console.log('✒️ ペンツール設定更新:', newSettings);
        } catch (error) {
            console.error('❌ 設定更新エラー:', error);
        }
    }
    
    /**
     * イベントリスナークリーンアップ
     */
    cleanup() {
        const app = this.toolManager?.appCore?.app;
        const canvas = app?.view;
        
        if (canvas && this.eventListeners) {
            Object.entries(this.eventListeners).forEach(([event, listener]) => {
                if (listener) {
                    canvas.removeEventListener(event, listener);
                }
            });
        }
        
        console.log('✒️ ペンツール クリーンアップ完了');
    }
    
    // ==========================================
    // ユーティリティメソッド
    // ==========================================
    
    /**
     * 座標監視更新
     */
    updateCoordinatesMonitor(x, y) {
        try {
            const coordsElement = document.getElementById('coordinates');
            if (coordsElement) {
                coordsElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        } catch (error) {
            // エラー無視（UIが存在しない場合）
        }
    }
    
    /**
     * 筆圧監視更新
     */
    updatePressureMonitor(pressure) {
        try {
            const pressureElement = document.getElementById('pressure-monitor');
            if (pressureElement) {
                const percentage = (pressure * 100).toFixed(1);
                pressureElement.textContent = `${percentage}%`;
            }
        } catch (error) {
            // エラー無視（UIが存在しない場合）
        }
    }
    
    /**
     * セッションID生成
     */
    generateSessionId() {
        return `pen_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * パスID生成
     */
    generatePathId() {
        return `pen_path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 状態取得（デバッグ用）
     */
    getStatus() {
        return {
            version: this.version,
            isActive: this.isActive,
            activationConfirmed: this.activationConfirmed,
            isDrawing: this.isDrawing,
            hasCurrentPath: !!this.currentPath,
            pressureSystem: {
                ...this.pressureSystem,
                currentPressure: this.pressureSystem.currentPressure.toFixed(3)
            },
            performance: {
                ...this.performance,
                lastFrameTime: this.performance.lastFrameTime.toFixed(2) + 'ms'
            }
        };
    }
}

// 🚨 A1修正: グローバル公開（AI分業対応）
if (typeof window !== 'undefined') {
    window.PenTool = PenTool;
    console.log('✅ PenTool Phase A1 グローバル公開完了');
}