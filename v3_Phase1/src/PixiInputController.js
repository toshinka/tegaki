/**
 * PixiJS統一入力制御 v3.2
 * PixiJS InteractionManager統合・ペンタブレット対応・統一座標処理
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統一入力制御クラス
 * マウス・ペンタブレット・トラックパッド統一処理
 */
export class PixiInputController {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // 描画状態管理
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        
        // 入力デバイス情報
        this.inputDevice = {
            type: 'unknown',
            pressure: 1.0,
            tiltX: 0,
            tiltY: 0,
            twist: 0,
            isEraser: false
        };
        
        // 入力統計・デバッグ
        this.stats = {
            totalEvents: 0,
            drawingEvents: 0,
            pressureEvents: 0,
            errors: 0,
            lastInputTime: null
        };
        
        // Phase段階対応
        this.phase1Ready = false;
        
        // 🎨 Phase2: ツール連携（封印中）
        // this.currentTool = 'pen';         // 🔒Phase2解封 
        // this.toolConfig = {};             // 🔒Phase2解封
        
        this.isReady = false;
        this.initialize();
    }
    
    /**
     * PixiJS統一入力制御初期化
     */
    initialize() {
        try {
            console.log('🎯 PixiJS統一入力制御初期化開始');
            
            // PixiJS InteractionManager統合設定
            this.setupPixiInteraction();
            
            // ペンタブレット・圧力感知設定
            this.setupPressureSensitivity();
            
            // キーボード入力統合
            this.setupKeyboardIntegration();
            
            // 入力デバイス検出
            this.detectInputDevices();
            
            // EventStore連携設定
            this.setupEventStoreIntegration();
            
            this.phase1Ready = true;
            this.isReady = true;
            
            console.log('✅ PixiJS統一入力制御初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJS入力制御初期化エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * キーアップ処理
     */
    handleKeyUp(event) {
        try {
            // EventStore経由でキーイベント通知
            this.eventStore.emit('input:key:up', {
                key: event.key,
                code: event.code,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey
            });
            
        } catch (error) {
            console.error('❌ キーアップ処理エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * 描画開始処理
     */
    startDrawing(drawData) {
        try {
            if (this.isDrawing) {
                console.warn('⚠️ 既に描画中です');
                return;
            }
            
            this.isDrawing = true;
            this.strokePoints = [];
            
            // 開始点追加
            this.addStrokePoint(drawData);
            
            // ストローク初期化
            this.currentStroke = {
                id: this.generateStrokeId(),
                startTime: drawData.timestamp,
                points: [...this.strokePoints],
                device: { ...drawData.device },
                // tool: this.currentTool,       // 🔒Phase2解封
                // config: { ...this.toolConfig } // 🔒Phase2解封
            };
            
            // EventStore通知
            this.eventStore.emit('draw:start', {
                stroke: this.currentStroke,
                position: drawData.position,
                unified: true
            });
            
            console.log('🎯 描画開始:', this.currentStroke.id);
            
        } catch (error) {
            console.error('❌ 描画開始エラー:', error);
            this.stats.errors++;
            this.isDrawing = false;
        }
    }
    
    /**
     * 描画継続処理
     */
    continueDrawing(drawData) {
        try {
            if (!this.isDrawing || !this.currentStroke) {
                return;
            }
            
            // ポイント追加
            this.addStrokePoint(drawData);
            
            // ストローク更新
            this.currentStroke.points = [...this.strokePoints];
            this.currentStroke.lastUpdate = drawData.timestamp;
            
            // EventStore通知（間引き処理）
            if (this.shouldEmitContinueEvent()) {
                this.eventStore.emit('draw:continue', {
                    stroke: this.currentStroke,
                    position: drawData.position,
                    points: this.strokePoints,
                    unified: true
                });
            }
            
        } catch (error) {
            console.error('❌ 描画継続エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * 描画終了処理
     */
    endDrawing(drawData) {
        try {
            if (!this.isDrawing) {
                return;
            }
            
            // 最終ポイント追加（中断でない場合）
            if (!drawData.interrupted && drawData.position) {
                this.addStrokePoint(drawData);
            }
            
            // ストローク完成
            if (this.currentStroke) {
                this.currentStroke.points = [...this.strokePoints];
                this.currentStroke.endTime = drawData.timestamp;
                this.currentStroke.duration = this.currentStroke.endTime - this.currentStroke.startTime;
                this.currentStroke.interrupted = drawData.interrupted || false;
                
                // EventStore通知
                this.eventStore.emit('draw:end', {
                    stroke: this.currentStroke,
                    points: this.strokePoints,
                    interrupted: drawData.interrupted,
                    unified: true
                });
                
                console.log('🎯 描画終了:', this.currentStroke.id, 
                          `(${this.strokePoints.length}点, ${this.currentStroke.duration}ms)`);
            }
            
            // 状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            this.strokePoints = [];
            
        } catch (error) {
            console.error('❌ 描画終了エラー:', error);
            this.stats.errors++;
            this.isDrawing = false;
        }
    }
    
    /**
     * ストロークポイント追加
     */
    addStrokePoint(drawData) {
        const point = {
            x: drawData.position.x,
            y: drawData.position.y,
            pressure: drawData.pressure || 1.0,
            tiltX: drawData.device?.tiltX || 0,
            tiltY: drawData.device?.tiltY || 0,
            twist: drawData.device?.twist || 0,
            timestamp: drawData.timestamp,
            index: this.strokePoints.length
        };
        
        // 重複点・極近距離点フィルタリング
        if (this.shouldAddPoint(point)) {
            this.strokePoints.push(point);
        }
    }
    
    /**
     * ポイント追加判定
     */
    shouldAddPoint(newPoint) {
        if (this.strokePoints.length === 0) {
            return true; // 最初の点は必ず追加
        }
        
        const lastPoint = this.strokePoints[this.strokePoints.length - 1];
        const distance = Math.sqrt(
            Math.pow(newPoint.x - lastPoint.x, 2) + 
            Math.pow(newPoint.y - lastPoint.y, 2)
        );
        
        // 最小距離フィルター（1px未満は除外）
        return distance >= 1.0;
    }
    
    /**
     * 継続イベント発信判定（パフォーマンス最適化）
     */
    shouldEmitContinueEvent() {
        // 3ポイントごと、または圧力変化時に発信
        return this.strokePoints.length % 3 === 0 || 
               this.hasPressureChange();
    }
    
    /**
     * 圧力変化検出
     */
    hasPressureChange() {
        if (this.strokePoints.length < 2) {
            return false;
        }
        
        const current = this.strokePoints[this.strokePoints.length - 1];
        const previous = this.strokePoints[this.strokePoints.length - 2];
        
        return Math.abs(current.pressure - previous.pressure) > 0.1;
    }
    
    /**
     * 強制描画停止
     */
    forceStopDrawing() {
        if (this.isDrawing) {
            console.log('🚨 強制描画停止');
            this.endDrawing({
                interrupted: true,
                forced: true,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * ストロークID生成
     */
    generateStrokeId() {
        return 'stroke_' + Date.now().toString(36) + '_' + 
               Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * 🎨 Phase2: ツール変更処理（封印中）
     */
    /*
    handleToolChange(toolData) {                 // 🔒Phase2解封
        this.currentTool = toolData.tool;
        this.toolConfig = { ...toolData.config };
        
        console.log('🎨 ツール変更:', this.currentTool);
        
        // 描画中の場合は一旦終了
        if (this.isDrawing) {
            this.endDrawing({
                interrupted: true,
                reason: 'tool-change',
                timestamp: Date.now()
            });
        }
    }
    */
    
    /**
     * 入力統計情報取得
     */
    getStats() {
        return {
            ...this.stats,
            currentDevice: this.inputDevice,
            isDrawing: this.isDrawing,
            currentStrokePoints: this.strokePoints.length,
            averageEventsPerSecond: this.calculateEventRate()
        };
    }
    
    /**
     * イベント発生率計算
     */
    calculateEventRate() {
        if (!this.stats.lastInputTime || this.stats.totalEvents === 0) {
            return 0;
        }
        
        const uptime = Date.now() - (this.stats.lastInputTime - this.stats.totalEvents * 10);
        return Math.round(this.stats.totalEvents / (uptime / 1000));
    }
    
    /**
     * システム情報取得
     */
    getInfo() {
        return {
            system: 'PixiJS統一入力制御',
            devices: {
                mouse: true,
                pen: 'supported',
                touch: 'disabled',
                keyboard: true
            },
            pressureSensitive: this.inputDevice.type === 'pen',
            coordinateSystem: 'pixi-unified',
            ready: this.isReady,
            phase1Ready: this.phase1Ready
        };
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.isReady && this.coordinate && this.eventStore;
    }
    
    /**
     * デバッグ情報表示
     */
    showDebugInfo() {
        console.group('🎯 PixiJS統一入力制御 デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('入力デバイス:', this.inputDevice);
        console.log('現在の描画状態:', {
            isDrawing: this.isDrawing,
            strokePoints: this.strokePoints.length,
            currentStroke: this.currentStroke?.id
        });
        console.groupEnd();
    }
    
    /**
     * 入力感度調整（ペンタブレット最適化）
     */
    adjustSensitivity(settings) {
        try {
            // 圧力感度調整
            if (settings.pressureSensitivity) {
                this.pressureSensitivity = Math.max(0.1, Math.min(2.0, settings.pressureSensitivity));
            }
            
            // 距離フィルター調整
            if (settings.distanceFilter) {
                this.distanceFilter = Math.max(0.5, Math.min(5.0, settings.distanceFilter));
            }
            
            console.log('🎯 入力感度調整完了:', settings);
            
        } catch (error) {
            console.error('❌ 入力感度調整エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * 入力デバイステスト
     */
    testInputDevice() {
        console.group('🔍 入力デバイステスト');
        
        // 基本情報
        console.log('デバイスタイプ:', this.inputDevice.type);
        console.log('圧力対応:', this.inputDevice.pressure !== 1.0);
        console.log('傾き対応:', this.inputDevice.tiltX !== 0 || this.inputDevice.tiltY !== 0);
        
        // ブラウザ対応状況
        console.log('PointerEvents対応:', 'PointerEvent' in window);
        console.log('圧力検出:', 'pressure' in (new PointerEvent('pointerdown')));
        
        console.groupEnd();
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // 描画中の場合は強制終了
            if (this.isDrawing) {
                this.forceStopDrawing();
            }
            
            // イベントリスナー削除
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
            
            console.log('🎯 PixiJS統一入力制御破棄完了');
            
        } catch (error) {
            console.error('❌ 入力制御破棄エラー:', error);
        }
    }
}errors++;
        }
    }
    
    /**
     * PixiJS InteractionManager統合設定
     */
    setupPixiInteraction() {
        const stage = this.app.stage;
        
        // PixiJS統一ポインターイベント設定
        stage.interactive = true;
        stage.hitArea = new PIXI.Rectangle(0, 0, this.app.view.width, this.app.view.height);
        
        // ポインターダウン（描画開始）
        stage.on('pointerdown', (event) => {
            this.handlePointerDown(event);
        });
        
        // ポインタームーブ（描画継続）
        stage.on('pointermove', (event) => {
            this.handlePointerMove(event);
        });
        
        // ポインターアップ（描画終了）
        stage.on('pointerup', (event) => {
            this.handlePointerUp(event);
        });
        
        // ポインターアウト（描画中断）
        stage.on('pointerout', (event) => {
            this.handlePointerOut(event);
        });
        
        // コンテキストメニュー無効化
        this.app.view.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        console.log('🎯 PixiJS InteractionManager統合完了');
    }
    
    /**
     * ペンタブレット・圧力感知設定
     */
    setupPressureSensitivity() {
        // Pointer Events API活用
        this.app.view.addEventListener('pointerdown', (event) => {
            this.updateInputDevice(event);
        });
        
        this.app.view.addEventListener('pointermove', (event) => {
            this.updateInputDevice(event);
        });
        
        console.log('🖊️ ペンタブレット・圧力感知設定完了');
    }
    
    /**
     * 入力デバイス情報更新
     */
    updateInputDevice(event) {
        try {
            // PointerEvent詳細情報取得
            this.inputDevice.type = event.pointerType || 'mouse';
            this.inputDevice.pressure = event.pressure || 1.0;
            this.inputDevice.tiltX = event.tiltX || 0;
            this.inputDevice.tiltY = event.tiltY || 0;
            this.inputDevice.twist = event.twist || 0;
            
            // 消しゴム検出（Wacom等対応）
            this.inputDevice.isEraser = event.pointerType === 'pen' && 
                                       (event.buttons === 32 || event.button === 5);
            
            // 圧力感度統計更新
            if (event.pressure && event.pressure !== 1.0) {
                this.stats.pressureEvents++;
            }
            
        } catch (error) {
            console.error('❌ 入力デバイス情報更新エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * キーボード入力統合
     */
    setupKeyboardIntegration() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        console.log('⌨️ キーボード入力統合完了');
    }
    
    /**
     * 入力デバイス検出
     */
    detectInputDevices() {
        // タッチデバイス検出（非対応警告）
        if ('ontouchstart' in window) {
            console.warn('⚠️ タッチデバイス検出: 本アプリはマウス・ペンタブレット専用です');
        }
        
        // ペンタブレット検出
        if (navigator.maxTouchPoints > 1) {
            console.log('🖊️ ペンタブレット対応デバイス検出');
        }
        
        console.log('🔍 入力デバイス検出完了');
    }
    
    /**
     * EventStore連携設定
     */
    setupEventStoreIntegration() {
        // 描画制御イベント購読
        this.eventStore.on('draw:tool:change', (data) => {
            // this.handleToolChange(data);   // 🔒Phase2解封
        });
        
        this.eventStore.on('input:force:stop', () => {
            this.forceStopDrawing();
        });
        
        console.log('📡 EventStore入力連携設定完了');
    }
    
    /**
     * ポインターダウン処理
     */
    handlePointerDown(event) {
        try {
            this.stats.totalEvents++;
            this.stats.lastInputTime = Date.now();
            
            // PixiJS統一座標取得
            const pixiPos = event.data.getLocalPosition(this.app.stage);
            
            // 描画開始
            this.startDrawing({
                position: pixiPos,
                pressure: this.inputDevice.pressure,
                device: this.inputDevice,
                timestamp: Date.now()
            });
            
            // EventStore通知
            this.eventStore.emit('input:pointer:down', {
                pixi: pixiPos,
                global: event.data.global,
                device: this.inputDevice,
                drawing: this.isDrawing
            });
            
        } catch (error) {
            console.error('❌ ポインターダウン処理エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * ポインタームーブ処理
     */
    handlePointerMove(event) {
        try {
            this.stats.totalEvents++;
            
            // PixiJS統一座標取得
            const pixiPos = event.data.getLocalPosition(this.app.stage);
            
            if (this.isDrawing) {
                this.stats.drawingEvents++;
                
                // 描画継続
                this.continueDrawing({
                    position: pixiPos,
                    pressure: this.inputDevice.pressure,
                    device: this.inputDevice,
                    timestamp: Date.now()
                });
            }
            
            // EventStore通知
            this.eventStore.emit('input:pointer:move', {
                pixi: pixiPos,
                global: event.data.global,
                device: this.inputDevice,
                drawing: this.isDrawing
            });
            
        } catch (error) {
            console.error('❌ ポインタームーブ処理エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * ポインターアップ処理
     */
    handlePointerUp(event) {
        try {
            this.stats.totalEvents++;
            
            // PixiJS統一座標取得
            const pixiPos = event.data.getLocalPosition(this.app.stage);
            
            if (this.isDrawing) {
                // 描画終了
                this.endDrawing({
                    position: pixiPos,
                    pressure: this.inputDevice.pressure,
                    device: this.inputDevice,
                    timestamp: Date.now()
                });
            }
            
            // EventStore通知
            this.eventStore.emit('input:pointer:up', {
                pixi: pixiPos,
                global: event.data.global,
                device: this.inputDevice,
                drawing: false
            });
            
        } catch (error) {
            console.error('❌ ポインターアップ処理エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * ポインターアウト処理（描画中断）
     */
    handlePointerOut(event) {
        try {
            if (this.isDrawing) {
                console.log('🎯 ポインターアウト: 描画中断');
                this.endDrawing({
                    interrupted: true,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('❌ ポインターアウト処理エラー:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * キーボードイベント処理
     */
    handleKeyDown(event) {
        try {
            // EventStore経由でキーイベント通知
            this.eventStore.emit('input:key:down', {
                key: event.key,
                code: event.code,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey
            });
            
        } catch (error) {
            console.error('❌ キーダウン処理エラー:', error);
            this.stats.