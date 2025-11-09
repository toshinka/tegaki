/**
 * ========================================
 * 修正ファイル1: ui/slider-utils.js
 * v8.13.9-FINAL - 慣性スクロール実装
 * ========================================
 */

// ui/slider-utils.js
window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SliderUtils = {
    createSlider(options) {
        const {
            container, min = 0, max = 100, initial = 50,
            step = null, onChange = null, onCommit = null, format = null
        } = options;
        
        const containerEl = typeof container === 'string' 
            ? document.getElementById(container) : container;
            
        if (!containerEl) return null;
        if (containerEl._sliderListenerSetup) return containerEl._sliderInstance;
        
        const track = containerEl.querySelector('.slider-track');
        const handle = containerEl.querySelector('.slider-handle');
        const valueDisplay = containerEl.parentNode?.querySelector('.slider-value');
        
        if (!track || !handle) return null;
        
        let currentValue = initial;
        let dragging = false;
        let rafId = null;
        let pendingUpdate = null;
        
        // 🔧 慣性スクロール用
        let velocity = 0;
        let lastMoveTime = 0;
        let lastMoveValue = initial;
        let momentumRafId = null;
        
        const updateUI = (newValue) => {
            currentValue = Math.max(min, Math.min(max, newValue));
            if (step !== null) {
                currentValue = Math.round(currentValue / step) * step;
            }
            
            const percentage = ((currentValue - min) / (max - min)) * 100;
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            if (valueDisplay) {
                valueDisplay.textContent = format 
                    ? format(currentValue) 
                    : currentValue.toFixed(1);
            }
        };
        
        const scheduleOnChange = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (onChange && pendingUpdate !== null) {
                    onChange(pendingUpdate);
                    pendingUpdate = null;
                }
            });
        };
        
        // 🔧 慣性スクロール適用
        const applyMomentum = () => {
            if (!dragging && Math.abs(velocity) > 0.5) {
                currentValue += velocity;
                currentValue = Math.max(min, Math.min(max, currentValue));
                
                updateUI(currentValue);
                pendingUpdate = currentValue;
                scheduleOnChange();
                
                velocity *= 0.92; // 減衰係数
                momentumRafId = requestAnimationFrame(applyMomentum);
            } else {
                velocity = 0;
                if (momentumRafId) {
                    cancelAnimationFrame(momentumRafId);
                    momentumRafId = null;
                }
            }
        };
        
        const getValue = (clientX) => {
            const rect = containerEl.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        const handlePointerDown = (e) => {
            if (e.button !== 0) return;
            
            dragging = true;
            velocity = 0;
            if (momentumRafId) {
                cancelAnimationFrame(momentumRafId);
                momentumRafId = null;
            }
            
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            lastMoveValue = newValue;
            lastMoveTime = performance.now();
            pendingUpdate = currentValue;
            scheduleOnChange();
            
            if (containerEl.setPointerCapture) {
                try { containerEl.setPointerCapture(e.pointerId); } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handlePointerMove = (e) => {
            if (!dragging) return;
            
            const now = performance.now();
            const dt = Math.max(1, now - lastMoveTime);
            
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            // 🔧 速度計算（慣性スクロール用）
            velocity = (newValue - lastMoveValue) / dt * 16; // 60fps基準
            
            lastMoveValue = newValue;
            lastMoveTime = now;
            
            pendingUpdate = currentValue;
            scheduleOnChange();
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handlePointerUp = (e) => {
            if (!dragging) return;
            
            dragging = false;
            
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            // 🔧 慣性スクロール開始
            if (Math.abs(velocity) > 0.5) {
                applyMomentum();
            }
            
            if (onCommit) {
                setTimeout(() => onCommit(currentValue), 50);
            }
            
            if (containerEl.releasePointerCapture) {
                try { containerEl.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            
            e.stopPropagation();
        };
        
        const handlePointerCancel = (e) => {
            if (!dragging) return;
            dragging = false;
            velocity = 0;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (momentumRafId) {
                cancelAnimationFrame(momentumRafId);
                momentumRafId = null;
            }
        };
        
        containerEl.addEventListener('pointerdown', handlePointerDown, { passive: false });
        document.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
        document.addEventListener('pointerup', handlePointerUp, { capture: true });
        document.addEventListener('pointercancel', handlePointerCancel, { capture: true });
        
        updateUI(initial);
        containerEl._sliderListenerSetup = true;
        
        const instance = {
            getValue: () => currentValue,
            setValue: (value) => {
                updateUI(value);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                if (rafId !== null) cancelAnimationFrame(rafId);
                if (momentumRafId) cancelAnimationFrame(momentumRafId);
                containerEl.removeEventListener('pointerdown', handlePointerDown);
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
                document.removeEventListener('pointercancel', handlePointerCancel);
                containerEl._sliderListenerSetup = false;
                containerEl._sliderInstance = null;
            }
        };
        
        containerEl._sliderInstance = instance;
        return instance;
    },
    
    createSimpleSlider(containerId, min, max, initial, callback, onCommit) {
        return this.createSlider({
            container: containerId, min, max, initial,
            onChange: (value) => {
                const container = document.getElementById(containerId);
                const valueDisplay = container?.parentNode?.querySelector('.slider-value');
                if (valueDisplay && callback) {
                    valueDisplay.textContent = callback(value);
                }
            },
            onCommit: onCommit || (() => {}),
            format: callback
        });
    }
};

console.log('✅ slider-utils.js v8.13.9-FINAL (慣性スクロール実装) loaded');

/**
 * ========================================
 * 修正ファイル2: ui/ui-panels.js  
 * v8.13.9-FINAL - 反転ボタンイベント完全削除
 * ========================================
 */

// ui/ui-panels.js
window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.UIController = class {
    constructor(drawingEngine, layerManager, app) {
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.app = app;
        
        this.validateCoreRuntime();
        this.setupEventDelegation();
        this.setupEventBusListeners();
        this.setupSliders();
        this.setupCanvasResize();
        // 🔧 FINAL: setupFlipButtons() 完全削除（layer-transform.jsに一本化）
        this.initializeStatusPanel();
        window.TegakiUI.setupPanelStyles();
    }
    
    validateCoreRuntime() {
        if (!window.CoreRuntime?.api) {
            throw new Error('CoreRuntime dependency missing');
        }
    }
    
    getPopupManager() { return window.PopupManager; }
    showPopup(name) { this.getPopupManager()?.show(name); }
    hidePopup(name) { this.getPopupManager()?.hide(name); }
    togglePopup(name) { this.getPopupManager()?.toggle(name); }
    closeAllPopups(exceptName = null) { this.getPopupManager()?.hideAll(exceptName); }
    
    initializeStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) statusPanel.style.display = 'none';
    }
    
    setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) return;
        
        eventBus.on('ui:toggle-settings', () => this.togglePopup('settings'));
        eventBus.on('ui:show-settings', () => this.showPopup('settings'));
        eventBus.on('ui:toggle-quick-access', () => this.togglePopup('quickAccess'));
        eventBus.on('ui:toggle-album', () => this.togglePopup('album'));
        eventBus.on('ui:toggle-export', () => this.togglePopup('export'));
        eventBus.on('ui:sidebar:sync-tool', ({ tool }) => this.updateToolUI(tool));
    }
    
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-button');
            if (toolButton) {
                this.handleToolClick(toolButton);
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                const result = window.CoreRuntime.api.layer.create();
                if (result) window.CoreRuntime.api.layer.setActive(result.index);
                return;
            }
            
            const folderAddBtn = e.target.closest('#add-folder-btn');
            if (folderAddBtn) {
                alert('フォルダ機能は準備中です');
                return;
            }

            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.album-overlay') &&
                !e.target.closest('.layer-transform-panel') &&
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                this.closeAllPopups('quickAccess');
            }
        });
    }
    
    handleToolClick(button) {
        const toolId = button.id;
        const toolMap = {
            'pen-tool': () => {
                if (!window.CoreRuntime.api.tool.set('pen')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.togglePopup('quickAccess');
                this.updateToolUI('pen');
            },
            'eraser-tool': () => {
                if (!window.CoreRuntime.api.tool.set('eraser')) return;
                window.CoreRuntime.api.layer.exitMoveMode();
                this.closeAllPopups();
                this.updateToolUI('eraser');
            },
            'resize-tool': () => this.togglePopup('resize'),
            'gif-animation-tool': () => {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:toggle-timeline');
                }
                this.closeAllPopups();
                this.updateToolUI('gif-animation');
            },
            'library-tool': () => this.togglePopup('album'),
            'export-tool': () => this.togglePopup('export'),
            'settings-tool': () => this.togglePopup('settings')
        };
        
        const handler = toolMap[toolId];
        if (handler) handler();
    }

    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');

        const toolNames = { 
            pen: 'ベクターペン', 
            eraser: '消しゴム', 
            'gif-animation': 'GIFアニメーション'
        };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
    }

    togglePopupById(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
    }
    
    setupSliders() {}

    setupCanvasResize() {
        const applyBtn = document.getElementById('apply-resize');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    const newWidth = parseInt(widthInput.value);
                    const newHeight = parseInt(heightInput.value);
                    
                    if (newWidth > 0 && newHeight > 0) {
                        window.CoreRuntime.api.camera.resize(newWidth, newHeight);
                        this.closeAllPopups();
                    }
                }
            });
        }
    }

    // 🔧 FINAL: setupFlipButtons() メソッド完全削除
    // 理由: layer-transform.js で一元管理
};

window.TegakiUI.createSlider = function(sliderId, min, max, initial, callback) {
    const container = document.getElementById(sliderId);
    if (!container || sliderId.startsWith('qa-')) return;

    const track = container.querySelector('.slider-track');
    const handle = container.querySelector('.slider-handle');
    const valueDisplay = container.parentNode?.querySelector('.slider-value');

    if (!track || !handle || !valueDisplay) return;

    let value = initial;
    let dragging = false;

    const update = (newValue) => {
        value = Math.max(min, Math.min(max, newValue));
        const percentage = ((value - min) / (max - min)) * 100;
        track.style.width = percentage + '%';
        handle.style.left = percentage + '%';
        valueDisplay.textContent = callback(value);
    };

    const getValue = (clientX) => {
        const rect = container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return min + (percentage * (max - min));
    };

    container.addEventListener('mousedown', (e) => {
        dragging = true;
        update(getValue(e.clientX));
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) update(getValue(e.clientX));
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    update(initial);
};

window.TegakiUI.setupPanelStyles = function() {
    const style = document.createElement('style');
    style.textContent = `
        .flip-section { gap: 2px !important; height: 56px; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
        .flip-button { padding: 4px 8px !important; font-size: 10px !important; white-space: nowrap !important; height: 26px !important; display: flex !important; align-items: center !important; justify-content: center !important; }
        .slider { position: relative; width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; cursor: pointer; }
        .slider-track { position: absolute; height: 100%; background: linear-gradient(to right, #4a90e2, #357abd); border-radius: 2px; transition: width 0.05s; }
        .slider-handle { position: absolute; width: 16px; height: 16px; top: 50%; transform: translate(-50%, -50%); background: white; border: 2px solid #4a90e2; border-radius: 50%; cursor: grab; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); transition: left 0.05s; }
        .slider-handle:active { cursor: grabbing; }
        .tool-button.active { background-color: var(--futaba-light-maroon) !important; border-color: var(--futaba-maroon) !important; }
        .tool-button:hover:not(.active) { background-color: var(--futaba-light-medium) !important; }
    `;
    
    if (!document.querySelector('style[data-tegaki-panels]')) {
        style.setAttribute('data-tegaki-panels', 'true');
        document.head.appendChild(style);
    }
};

console.log('✅ ui-panels.js v8.13.9-FINAL (反転ボタンイベント完全削除) loaded');

/**
 * ========================================
 * 使用方法
 * ========================================
 * 
 * 1. ui/slider-utils.js を置き換え
 * 2. ui/ui-panels.js を置き換え
 * 3. system/layer-transform.js は既存のv8.13.9を使用
 * 
 * 反転ボタンのイベントは layer-transform.js のみで管理され、
 * 多重実装が完全に解消されます。
 */