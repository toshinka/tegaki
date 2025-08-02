/**
 * PixiJS v8統一入力制御・InteractionManager
 * モダンお絵かきツール v3.3 - Phase1統一入力システム
 * 
 * 機能:
 * - PixiJS v8統一入力処理・EventSystem活用
 * - マウス・タッチ・ペン統合制御
 * - 筆圧感知・座標精度・Chrome API統合
 * - ツール切り替え・設定管理
 * - 干渉問題根絶・単一イベントハンドリング
 */

import { FederatedPointerEvent, Point } from 'pixi.js';

/**
 * PixiJS v8統一入力制御
 * EventSystem統合・筆圧対応・座標精度保証
 */
class PixiV8InputController {
    constructor(pixiApp) {
        this.app = pixiApp;
        this.stage = pixiApp.stage;
        
        // 入力状態管理
        this.isPointerDown = false;
        this.lastPointerPosition = new Point(0, 0);
        this.pointerHistory = [];
        
        // ツール管理
        this.currentTool = 'pen';
        this.toolConfig = {
            pen: { size: 2, opacity: 1.0, color: 0x800000 },
            eraser: { size: 10, opacity: 1.0 },
            airbrush: { size: 20, opacity: 0.7, intensity: 0.65, density: 0.5 },
            eyedropper: {},
            fill: { tolerance: 32 },
            select: { type: 'rectangle' },
            text: { fontSize: 16, fontFamily: 'Arial' }
        };
        
        // 筆圧・精度設定
        this.pressureSettings = {
            enabled: true,
            smoothing: 0.7,
            minPressure: 0.1,
            maxPressure: 1.0
        };
        
        // Chrome API入力拡張
        this.pointerCapture = {
            enabled: typeof PointerEvent !== 'undefined',
            capturedPointerId: null
        };
        
        // コールバック関数（外部連携用）
        this.onDrawingStart = null;
        this.onDrawingUpdate = null;
        this.onDrawingEnd = null;
        this.onToolChange = null;
        
        this.initializeEventListeners();
        this.setupPointerCapture();
        
        console.log('✅ PixiV8InputController初期化完了 - 統一入力制御');
    }
    
    /**
     * 塗りつぶし処理（プレースホルダー）
     */
    fillArea(toolEvent) {
        console.log(`🪣 塗りつぶし - 座標: (${toolEvent.x}, ${toolEvent.y})`);
    }
    
    /**
     * 選択開始処理（プレースホルダー）
     */
    startSelection(toolEvent) {
        console.log('⬚ 選択開始');
    }
    
    updateSelection(toolEvent) {
        console.log('⬚ 選択更新');
    }
    
    endSelection(toolEvent) {
        console.log('⬚ 選択終了');
    }
    
    /**
     * ズーム処理
     * PixiJS v8統一座標・中心点ズーム
     */
    handleZoom(zoomFactor, centerPoint) {
        const stage = this.stage;
        const oldScale = stage.scale.x;
        const newScale = Math.max(0.1, Math.min(10, oldScale * zoomFactor));
        
        if (newScale !== oldScale) {
            // 中心点を基準にズーム
            const worldPos = stage.toLocal(centerPoint);
            
            stage.scale.set(newScale);
            
            const newScreenPos = stage.toGlobal(worldPos);
            stage.x -= (newScreenPos.x - centerPoint.x);
            stage.y -= (newScreenPos.y - centerPoint.y);
            
            console.log(`🔍 ズーム: ${newScale.toFixed(2)}x`);
        }
    }
    
    /**
     * ツール設定
     * ツール切り替え・設定適用
     */
    setTool(toolName) {
        if (this.toolConfig[toolName]) {
            const previousTool = this.currentTool;
            this.currentTool = toolName;
            
            if (this.onToolChange) {
                this.onToolChange({
                    previousTool: previousTool,
                    currentTool: toolName,
                    toolConfig: { ...this.toolConfig[toolName] }
                });
            }
            
            console.log(`🔧 ツール切り替え: ${previousTool} → ${toolName}`);
        }
    }
    
    /**
     * ツールサイズ調整
     * 現在ツールのサイズ変更
     */
    adjustToolSize(delta) {
        const config = this.toolConfig[this.currentTool];
        if (config && config.size !== undefined) {
            config.size = Math.max(1, Math.min(100, config.size + delta));
            console.log(`📏 ツールサイズ調整: ${config.size}px`);
        }
    }
    
    /**
     * 一時ツール設定
     * スペースキー等での一時切り替え
     */
    setTemporaryTool(toolName) {
        if (!this.previousTool) {
            this.previousTool = this.currentTool;
            this.setTool(toolName);
        }
    }
    
    /**
     * 一時ツール復元
     * 元のツールに戻す
     */
    restoreFromTemporaryTool() {
        if (this.previousTool) {
            this.setTool(this.previousTool);
            this.previousTool = null;
        }
    }
    
    /**
     * ツール設定更新
     * 外部からの設定変更
     */
    updateToolConfig(toolName, newConfig) {
        if (this.toolConfig[toolName]) {
            this.toolConfig[toolName] = {
                ...this.toolConfig[toolName],
                ...newConfig
            };
            console.log(`⚙️ ツール設定更新: ${toolName}`, newConfig);
        }
    }
    
    /**
     * 筆圧設定更新
     */
    updatePressureSettings(newSettings) {
        this.pressureSettings = {
            ...this.pressureSettings,
            ...newSettings
        };
        console.log('⚙️ 筆圧設定更新', this.pressureSettings);
    }
    
    /**
     * 入力状態リセット
     * 緊急時・状態クリア
     */
    resetInputState() {
        this.isPointerDown = false;
        this.pointerHistory = [];
        
        if (this.pointerCapture.capturedPointerId !== null) {
            this.app.view.releasePointerCapture?.(this.pointerCapture.capturedPointerId);
            this.pointerCapture.capturedPointerId = null;
        }
        
        console.log('🔄 入力状態リセット完了');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            currentTool: this.currentTool,
            isPointerDown: this.isPointerDown,
            lastPosition: {
                x: this.lastPointerPosition.x,
                y: this.lastPointerPosition.y
            },
            pointerHistoryLength: this.pointerHistory.length,
            pressureSettings: { ...this.pressureSettings },
            toolConfig: { ...this.toolConfig[this.currentTool] },
            pointerCapture: {
                enabled: this.pointerCapture.enabled,
                captured: this.pointerCapture.capturedPointerId !== null
            }
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // イベントリスナー削除
        this.stage.off('pointerdown');
        this.stage.off('pointermove');
        this.stage.off('pointerup');
        this.stage.off('pointerupoutside');
        this.stage.off('wheel');
        
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
        
        // ポインターキャプチャ解除
        this.resetInputState();
        
        // コールバック削除
        this.onDrawingStart = null;
        this.onDrawingUpdate = null;
        this.onDrawingEnd = null;
        this.onToolChange = null;
        
        console.log('🗑️ PixiV8InputController リソース解放完了');
    }
}

export default PixiV8InputController;
     * PixiJS v8統一イベントリスナー設定
     * EventSystem活用・DOM競合根絶
     */
    initializeEventListeners() {
        // PixiJS v8 EventSystem統一設定
        this.stage.eventMode = 'static';
        this.stage.interactiveChildren = true;
        
        // ポインター入力統合（マウス・タッチ・ペン）
        this.stage.on('pointerdown', this.handlePointerDown.bind(this));
        this.stage.on('pointermove', this.handlePointerMove.bind(this));
        this.stage.on('pointerup', this.handlePointerUp.bind(this));
        this.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        
        // ホイールイベント（ズーム・スクロール）
        this.stage.on('wheel', this.handleWheel.bind(this));
        
        // キーボードイベント（DOM統合）
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // コンテキストメニュー無効化
        this.app.view.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('🎮 PixiJS v8統一イベントリスナー設定完了');
    }
    
    /**
     * Chrome API PointerCapture設定
     * 精度向上・イベント取りこぼし防止
     */
    setupPointerCapture() {
        if (!this.pointerCapture.enabled) return;
        
        // Pointer Events API活用
        this.app.view.style.touchAction = 'none';
        
        console.log('⚡ Chrome API PointerCapture設定完了');
    }
    
    /**
     * ポインター押下処理
     * 描画開始・ツール別処理分岐
     */
    handlePointerDown(event) {
        if (this.isPointerDown) return;
        
        this.isPointerDown = true;
        const globalPos = event.global;
        this.lastPointerPosition.copyFrom(globalPos);
        
        // 筆圧取得（対応デバイスのみ）
        const pressure = this.extractPressure(event);
        
        // ポインターキャプチャ開始
        if (this.pointerCapture.enabled && event.pointerId !== undefined) {
            this.pointerCapture.capturedPointerId = event.pointerId;
            this.app.view.setPointerCapture?.(event.pointerId);
        }
        
        // ポインター履歴初期化
        this.pointerHistory = [{
            x: globalPos.x,
            y: globalPos.y,
            pressure: pressure,
            timestamp: Date.now()
        }];
        
        // ツール別処理
        const toolEvent = this.createToolEvent(globalPos, pressure, 'start');
        
        switch (this.currentTool) {
            case 'pen':
            case 'airbrush':
                this.startDrawing(toolEvent);
                break;
            case 'eraser':
                this.startErasing(toolEvent);
                break;
            case 'eyedropper':
                this.pickColor(toolEvent);
                break;
            case 'fill':
                this.fillArea(toolEvent);
                break;
            case 'select':
                this.startSelection(toolEvent);
                break;
        }
        
        console.log(`🖱️ ポインター押下 - ツール: ${this.currentTool}, 座標: (${globalPos.x}, ${globalPos.y}), 筆圧: ${pressure}`);
    }
    
    /**
     * ポインター移動処理
     * 描画更新・スムージング・筆圧補間
     */
    handlePointerMove(event) {
        const globalPos = event.global;
        const pressure = this.extractPressure(event);
        
        // ポインター履歴更新（スムージング用）
        this.pointerHistory.push({
            x: globalPos.x,
            y: globalPos.y,
            pressure: pressure,
            timestamp: Date.now()
        });
        
        // 履歴上限管理（メモリ効率）
        if (this.pointerHistory.length > 10) {
            this.pointerHistory.shift();
        }
        
        // 描画中の場合のみ更新処理
        if (this.isPointerDown) {
            const smoothedPos = this.smoothPointerPosition();
            const smoothedPressure = this.smoothPressure();
            
            const toolEvent = this.createToolEvent(smoothedPos, smoothedPressure, 'update');
            
            switch (this.currentTool) {
                case 'pen':
                case 'airbrush':
                    this.updateDrawing(toolEvent);
                    break;
                case 'eraser':
                    this.updateErasing(toolEvent);
                    break;
                case 'select':
                    this.updateSelection(toolEvent);
                    break;
            }
        }
        
        this.lastPointerPosition.copyFrom(globalPos);
    }
    
    /**
     * ポインター離上処理
     * 描画終了・ポインターキャプチャ解除
     */
    handlePointerUp(event) {
        if (!this.isPointerDown) return;
        
        this.isPointerDown = false;
        const globalPos = event.global;
        const pressure = this.extractPressure(event);
        
        // ポインターキャプチャ解除
        if (this.pointerCapture.enabled && this.pointerCapture.capturedPointerId !== null) {
            this.app.view.releasePointerCapture?.(this.pointerCapture.capturedPointerId);
            this.pointerCapture.capturedPointerId = null;
        }
        
        // ツール別終了処理
        const toolEvent = this.createToolEvent(globalPos, pressure, 'end');
        
        switch (this.currentTool) {
            case 'pen':
            case 'airbrush':
                this.endDrawing(toolEvent);
                break;
            case 'eraser':
                this.endErasing(toolEvent);
                break;
            case 'select':
                this.endSelection(toolEvent);
                break;
        }
        
        console.log(`🖱️ ポインター離上 - 座標: (${globalPos.x}, ${globalPos.y})`);
    }
    
    /**
     * ホイールイベント処理
     * ズーム・スクロール・ツールサイズ調整
     */
    handleWheel(event) {
        const deltaY = event.deltaY;
        const isCtrlPressed = event.ctrlKey;
        
        if (isCtrlPressed) {
            // Ctrl+ホイール: ズーム
            const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
            this.handleZoom(zoomFactor, event.global);
        } else {
            // ホイールのみ: ツールサイズ調整
            const sizeDelta = deltaY > 0 ? -1 : 1;
            this.adjustToolSize(sizeDelta);
        }
        
        event.preventDefault();
    }
    
    /**
     * キーボード押下処理
     * ツール切り替え・ショートカット
     */
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const isCtrlPressed = event.ctrlKey;
        const isShiftPressed = event.shiftKey;
        
        // ツール切り替えショートカット
        const toolKeys = {
            'p': 'pen',
            'e': 'eraser',
            'a': 'airbrush',
            'i': 'eyedropper',
            'g': 'fill',
            'm': 'select',
            't': 'text'
        };
        
        if (toolKeys[key] && !isCtrlPressed) {
            this.setTool(toolKeys[key]);
            event.preventDefault();
        }
        
        // ツールサイズ調整
        if (key === '[') {
            this.adjustToolSize(-1);
            event.preventDefault();
        } else if (key === ']') {
            this.adjustToolSize(1);
            event.preventDefault();
        }
        
        // スペースキー: 一時的に移動ツール
        if (key === ' ' && !isCtrlPressed) {
            this.setTemporaryTool('move');
            event.preventDefault();
        }
    }
    
    /**
     * キーボード離上処理
     * 一時ツール解除
     */
    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        
        if (key === ' ') {
            this.restoreFromTemporaryTool();
            event.preventDefault();
        }
    }
    
    /**
     * 筆圧抽出
     * Chrome API・Pointer Events対応
     */
    extractPressure(event) {
        if (!this.pressureSettings.enabled) return 1.0;
        
        let pressure = 1.0;
        
        // Pointer Events API対応
        if (event.pressure !== undefined) {
            pressure = event.pressure;
        }
        // Touch Events対応
        else if (event.force !== undefined) {
            pressure = event.force;
        }
        
        // 圧力範囲正規化
        pressure = Math.max(this.pressureSettings.minPressure, 
                           Math.min(this.pressureSettings.maxPressure, pressure));
        
        return pressure;
    }
    
    /**
     * ポインター位置スムージング
     * ブレ軽減・描画品質向上
     */
    smoothPointerPosition() {
        if (this.pointerHistory.length < 2) {
            return this.lastPointerPosition;
        }
        
        const smoothing = this.pressureSettings.smoothing;
        const recent = this.pointerHistory.slice(-3);
        
        let smoothX = 0;
        let smoothY = 0;
        let totalWeight = 0;
        
        recent.forEach((point, index) => {
            const weight = (index + 1) / recent.length;
            smoothX += point.x * weight;
            smoothY += point.y * weight;
            totalWeight += weight;
        });
        
        return new Point(
            this.lastPointerPosition.x * (1 - smoothing) + (smoothX / totalWeight) * smoothing,
            this.lastPointerPosition.y * (1 - smoothing) + (smoothY / totalWeight) * smoothing
        );
    }
    
    /**
     * 筆圧スムージング
     * 筆圧変化を滑らかに
     */
    smoothPressure() {
        if (this.pointerHistory.length < 2) {
            return this.pointerHistory[0]?.pressure || 1.0;
        }
        
        const recent = this.pointerHistory.slice(-3);
        const avgPressure = recent.reduce((sum, point) => sum + point.pressure, 0) / recent.length;
        
        return avgPressure;
    }
    
    /**
     * ツールイベント作成
     * 統一イベントオブジェクト生成
     */
    createToolEvent(position, pressure, phase) {
        return {
            x: position.x,
            y: position.y,
            pressure: pressure,
            phase: phase, // 'start', 'update', 'end'
            tool: this.currentTool,
            toolConfig: { ...this.toolConfig[this.currentTool] },
            timestamp: Date.now(),
            pointerHistory: [...this.pointerHistory]
        };
    }
    
    /**
     * 描画開始
     * 外部レンダラー連携
     */
    startDrawing(toolEvent) {
        if (this.onDrawingStart) {
            this.onDrawingStart(toolEvent);
        }
    }
    
    /**
     * 描画更新
     * 外部レンダラー連携
     */
    updateDrawing(toolEvent) {
        if (this.onDrawingUpdate) {
            this.onDrawingUpdate(toolEvent);
        }
    }
    
    /**
     * 描画終了
     * 外部レンダラー連携
     */
    endDrawing(toolEvent) {
        if (this.onDrawingEnd) {
            this.onDrawingEnd(toolEvent);
        }
    }
    
    /**
     * 消しゴム処理（プレースホルダー）
     */
    startErasing(toolEvent) {
        console.log('🗑️ 消しゴム開始');
        this.startDrawing(toolEvent); // 暫定的に描画と同じ処理
    }
    
    updateErasing(toolEvent) {
        this.updateDrawing(toolEvent);
    }
    
    endErasing(toolEvent) {
        this.endDrawing(toolEvent);
    }
    
    /**
     * 色抽出処理（プレースホルダー）
     */
    pickColor(toolEvent) {
        console.log(`🎨 色抽出 - 座標: (${toolEvent.x}, ${toolEvent.y})`);
    }
    
    /**