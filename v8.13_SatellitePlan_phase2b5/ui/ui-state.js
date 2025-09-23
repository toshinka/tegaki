// ===== ui/ui-state.js - Fixed Version =====
// 責任: UI状態の一元管理

(function() {
    'use strict';
    
    // 修正1: 正しいCONFIG参照
    const CONFIG = window.TEGAKI_CONFIG;
    
    if (!CONFIG) {
        console.error('CRITICAL: TEGAKI_CONFIG not available - ui-state.js requires config.js');
        throw new Error('config.js dependency missing');
    }
    
    // === UI状態管理システム ===
    const UIState = {
        // ツール状態
        currentTool: 'pen',
        previousTool: null,
        
        // パネル状態
        panels: {
            layers: { visible: true, x: 10, y: 10 },
            tools: { visible: true, x: 10, y: 200 },
            colors: { visible: true, x: 10, y: 400 },
            penSettings: { visible: false, x: 60, y: 100 },
            resizeSettings: { visible: false, x: 60, y: 150 },
            transformPanel: { visible: false, x: '50%', y: 20 }
        },
        
        // 入力状態
        input: {
            mouseDown: false,
            spaceDown: false,
            ctrlDown: false,
            shiftDown: false,
            altDown: false,
            vKeyDown: false,
            lastX: 0,
            lastY: 0,
            pressure: 1.0
        },
        
        // モード状態
        mode: 'draw', // draw, transform, select
        
        // 選択状態
        selection: {
            active: false,
            start: null,
            end: null,
            type: 'rectangle' // rectangle, lasso, magic
        },
        
        // 変形状態
        transform: {
            active: false,
            mode: 'move', // move, rotate, scale
            handles: [],
            pivot: 'center'
        },
        
        // レイヤー移動モード状態
        layerMoveMode: {
            active: false,
            dragging: false,
            lastPoint: { x: 0, y: 0 }
        },
        
        // キャンバス状態 - 修正2: 正しいプロパティ名を使用
        canvas: {
            width: CONFIG.canvas.width,
            height: CONFIG.canvas.height,
            zoom: 1.0,
            pan: { x: 0, y: 0 },
            rotation: 0
        },
        
        // アクティブポップアップ
        activePopup: null,
        
        // 状態更新メソッド
        setTool(tool) {
            if (this.currentTool !== tool) {
                this.previousTool = this.currentTool;
                this.currentTool = tool;
                this.notifyToolChange(tool);
            }
        },
        
        setPanelVisibility(panelId, visible) {
            if (this.panels[panelId]) {
                this.panels[panelId].visible = visible;
                this.notifyPanelVisibilityChange(panelId, visible);
            }
        },
        
        setPanelPosition(panelId, x, y) {
            if (this.panels[panelId]) {
                this.panels[panelId].x = x;
                this.panels[panelId].y = y;
            }
        },
        
        updateInput(key, value) {
            if (this.input.hasOwnProperty(key)) {
                this.input[key] = value;
            }
        },
        
        setMode(mode) {
            if (this.mode !== mode) {
                const oldMode = this.mode;
                this.mode = mode;
                
                // モード変更時のクリーンアップ
                if (mode !== 'select') {
                    this.selection.active = false;
                    this.selection.start = null;
                    this.selection.end = null;
                }
                if (mode !== 'transform') {
                    this.transform.active = false;
                    this.transform.handles = [];
                }
                
                this.notifyModeChange(oldMode, mode);
            }
        },
        
        setLayerMoveMode(active) {
            if (this.layerMoveMode.active !== active) {
                this.layerMoveMode.active = active;
                if (!active) {
                    this.layerMoveMode.dragging = false;
                }
                this.notifyLayerMoveModeChange(active);
            }
        },
        
        setActivePopup(popupId) {
            if (this.activePopup !== popupId) {
                this.activePopup = popupId;
                this.notifyActivePopupChange(popupId);
            }
        },
        
        updateCanvas(width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.notifyCanvasChange();
        },
        
        // 通知メソッド（イベント発火）
        notifyToolChange(tool) {
            window.dispatchEvent(new CustomEvent('ui:toolChange', { 
                detail: { tool, previous: this.previousTool } 
            }));
        },
        
        notifyPanelVisibilityChange(panelId, visible) {
            window.dispatchEvent(new CustomEvent('ui:panelVisibilityChange', { 
                detail: { panelId, visible } 
            }));
        },
        
        notifyModeChange(oldMode, newMode) {
            window.dispatchEvent(new CustomEvent('ui:modeChange', { 
                detail: { oldMode, newMode } 
            }));
        },
        
        notifyLayerMoveModeChange(active) {
            window.dispatchEvent(new CustomEvent('ui:layerMoveModeChange', { 
                detail: { active } 
            }));
        },
        
        notifyActivePopupChange(popupId) {
            window.dispatchEvent(new CustomEvent('ui:activePopupChange', { 
                detail: { popupId, previous: this.activePopup } 
            }));
        },
        
        notifyCanvasChange() {
            window.dispatchEvent(new CustomEvent('ui:canvasChange', { 
                detail: { width: this.canvas.width, height: this.canvas.height } 
            }));
        },
        
        // 状態クエリメソッド
        isToolActive(tool) {
            return this.currentTool === tool;
        },
        
        isPanelVisible(panelId) {
            return this.panels[panelId] ? this.panels[panelId].visible : false;
        },
        
        isInMode(mode) {
            return this.mode === mode;
        },
        
        isLayerMoveModeActive() {
            return this.layerMoveMode.active;
        },
        
        hasActiveSelection() {
            return this.selection.active && this.selection.start && this.selection.end;
        },
        
        isTransformActive() {
            return this.transform.active;
        },
        
        // キーボード状態管理
        isKeyDown(key) {
            switch(key) {
                case 'space': return this.input.spaceDown;
                case 'ctrl': return this.input.ctrlDown;
                case 'shift': return this.input.shiftDown;
                case 'alt': return this.input.altDown;
                case 'v': return this.input.vKeyDown;
                default: return false;
            }
        },
        
        // マウス状態管理
        isMouseDown() {
            return this.input.mouseDown;
        },
        
        getLastMousePosition() {
            return { x: this.input.lastX, y: this.input.lastY };
        },
        
        updateMousePosition(x, y) {
            this.input.lastX = x;
            this.input.lastY = y;
        },
        
        // 選択範囲管理
        startSelection(x, y, type = 'rectangle') {
            this.selection.active = true;
            this.selection.start = { x, y };
            this.selection.end = { x, y };
            this.selection.type = type;
        },
        
        updateSelection(x, y) {
            if (this.selection.active) {
                this.selection.end = { x, y };
            }
        },
        
        endSelection() {
            if (this.selection.active) {
                // 選択範囲が有効かチェック
                const { start, end } = this.selection;
                const width = Math.abs(end.x - start.x);
                const height = Math.abs(end.y - start.y);
                
                if (width < 5 || height < 5) {
                    // 小さすぎる選択は無効
                    this.clearSelection();
                }
            }
        },
        
        clearSelection() {
            this.selection.active = false;
            this.selection.start = null;
            this.selection.end = null;
        },
        
        getSelectionRect() {
            if (!this.hasActiveSelection()) return null;
            
            const { start, end } = this.selection;
            return {
                x: Math.min(start.x, end.x),
                y: Math.min(start.y, end.y),
                width: Math.abs(end.x - start.x),
                height: Math.abs(end.y - start.y)
            };
        },
        
        // 変形管理
        startTransform(mode = 'move', pivot = 'center') {
            this.transform.active = true;
            this.transform.mode = mode;
            this.transform.pivot = pivot;
            this.setMode('transform');
        },
        
        endTransform() {
            this.transform.active = false;
            this.transform.handles = [];
            this.setMode('draw');
        },
        
        // デバッグ情報
        getDebugInfo() {
            return {
                currentTool: this.currentTool,
                mode: this.mode,
                activePopup: this.activePopup,
                layerMoveMode: this.layerMoveMode.active,
                selectionActive: this.selection.active,
                transformActive: this.transform.active,
                inputState: { ...this.input },
                canvasSize: { width: this.canvas.width, height: this.canvas.height }
            };
        },
        
        // 状態リセット
        reset() {
            this.currentTool = 'pen';
            this.previousTool = null;
            this.mode = 'draw';
            this.activePopup = null;
            
            this.selection.active = false;
            this.selection.start = null;
            this.selection.end = null;
            
            this.transform.active = false;
            this.transform.handles = [];
            
            this.layerMoveMode.active = false;
            this.layerMoveMode.dragging = false;
            
            // 入力状態はリセットしない（物理的な状態なので）
        }
    };
    
    // === キーボードイベント統合管理 ===
    class KeyboardManager {
        constructor(uiState) {
            this.uiState = uiState;
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        }
        
        handleKeyDown(e) {
            // 基本キー状態更新
            this.updateKeyStates(e, true);
            
            // ショートカット処理 - 修正3: ショートカット設定の正しい参照
            const shortcut = this.getShortcut(e);
            if (shortcut) {
                this.executeShortcut(shortcut, e);
            }
        }
        
        handleKeyUp(e) {
            this.updateKeyStates(e, false);
        }
        
        updateKeyStates(e, pressed) {
            switch(e.code) {
                case 'Space':
                    this.uiState.updateInput('spaceDown', pressed);
                    break;
                case 'ControlLeft':
                case 'ControlRight':
                    this.uiState.updateInput('ctrlDown', pressed);
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.uiState.updateInput('shiftDown', pressed);
                    break;
                case 'AltLeft':
                case 'AltRight':
                    this.uiState.updateInput('altDown', pressed);
                    break;
                case 'KeyV':
                    this.uiState.updateInput('vKeyDown', pressed);
                    break;
            }
        }
        
        getShortcut(e) {
            // 修正3: 正しいショートカット参照
            const shortcuts = window.TEGAKI_SHORTCUTS || {};
            
            // 単独キー
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                // コードマッピングの変換
                const keyMap = {
                    'KeyP': 'pen',
                    'KeyE': 'eraser', 
                    'KeyV': 'layerMode',
                    'Digit0': 'canvasReset',
                    'KeyH': 'horizontalFlip'
                };
                
                if (keyMap[e.code]) {
                    return keyMap[e.code];
                }
            }
            
            // Ctrl+Key の組み合わせ
            if (e.ctrlKey) {
                const ctrlMap = {
                    'KeyZ': 'undo',
                    'KeyY': 'redo',
                    'KeyC': 'copy',
                    'KeyV': 'paste'
                };
                
                if (ctrlMap[e.code]) {
                    return ctrlMap[e.code];
                }
            }
            
            return null;
        }
        
        executeShortcut(shortcut, event) {
            switch(shortcut) {
                case 'pen':
                    this.uiState.setTool('pen');
                    break;
                case 'eraser':
                    this.uiState.setTool('eraser');
                    break;
                case 'layerMode':
                    this.uiState.setLayerMoveMode(!this.uiState.isLayerMoveModeActive());
                    break;
                case 'undo':
                    window.dispatchEvent(new CustomEvent('app:undo'));
                    break;
                case 'redo':
                    window.dispatchEvent(new CustomEvent('app:redo'));
                    break;
                case 'copy':
                    window.dispatchEvent(new CustomEvent('app:copy'));
                    break;
                case 'paste':
                    window.dispatchEvent(new CustomEvent('app:paste'));
                    break;
                case 'canvasReset':
                    window.dispatchEvent(new CustomEvent('app:canvasReset'));
                    break;
                case 'horizontalFlip':
                    window.dispatchEvent(new CustomEvent('app:horizontalFlip', { 
                        detail: { vertical: event.shiftKey } 
                    }));
                    break;
            }
            
            event.preventDefault();
        }
    }
    
    // === マウス/タッチイベント統合管理 ===
    class PointerManager {
        constructor(uiState) {
            this.uiState = uiState;
        }
        
        setupEventListeners(canvas) {
            if (!canvas) {
                console.warn('PointerManager: Canvas element not provided');
                return;
            }
            
            canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
            canvas.addEventListener('pointerenter', (e) => this.handlePointerEnter(e));
            canvas.addEventListener('pointerleave', (e) => this.handlePointerLeave(e));
        }
        
        handlePointerDown(e) {
            this.uiState.updateInput('mouseDown', true);
            this.updatePointerPosition(e);
            
            window.dispatchEvent(new CustomEvent('pointer:down', { 
                detail: this.getPointerData(e) 
            }));
        }
        
        handlePointerMove(e) {
            this.updatePointerPosition(e);
            
            window.dispatchEvent(new CustomEvent('pointer:move', { 
                detail: this.getPointerData(e) 
            }));
        }
        
        handlePointerUp(e) {
            this.uiState.updateInput('mouseDown', false);
            
            window.dispatchEvent(new CustomEvent('pointer:up', { 
                detail: this.getPointerData(e) 
            }));
        }
        
        handlePointerEnter(e) {
            window.dispatchEvent(new CustomEvent('pointer:enter', { 
                detail: this.getPointerData(e) 
            }));
        }
        
        handlePointerLeave(e) {
            window.dispatchEvent(new CustomEvent('pointer:leave', { 
                detail: this.getPointerData(e) 
            }));
        }
        
        updatePointerPosition(e) {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.uiState.updateMousePosition(x, y);
        }
        
        getPointerData(e) {
            const rect = e.target.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                screenX: e.clientX,
                screenY: e.clientY,
                pressure: e.pressure || 1.0,
                button: e.button,
                buttons: e.buttons,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey
            };
        }
    }
    
    // === グローバル公開 ===
    window.UIState = UIState;
    window.KeyboardManager = KeyboardManager;
    window.PointerManager = PointerManager;
    
    console.log('✅ UIState fixed version loaded');
    
})();