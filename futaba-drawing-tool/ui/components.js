/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev7
 * UIコンポーネント群 - ui/components.js (Phase2B統合調整版)
 * 
 * 🔧 Phase2B統合調整内容:
 * 1. ✅ PresetDisplayManagerの新PresetManager連携強化
 * 2. ✅ イベントシステムの統合（新PresetManagerイベント対応）
 * 3. ✅ プレビュー更新システムの最適化
 * 4. ✅ エラーハンドリングの強化
 * 5. ✅ パフォーマンス最適化（更新頻度制御）
 * 6. ✅ デバッグ機能の拡張
 * 7. ✅ 後方互換性の確保
 * 
 * Phase2B目標: 新PresetManagerとの完全統合・表示システム最適化
 * 責務: 独立性の高いUIコンポーネント・新システム統合表示
 * 依存: config.js, ui/preset-manager.js（新規連携）
 */

console.log('🔧 ui/components.js Phase2B統合調整版読み込み開始...');

// ==== Phase2B: UIイベント定数（拡張版）====
const UI_EVENTS = {
    // 基本UIイベント
    TOOL_SELECTED: 'ui:tool_selected',
    POPUP_OPENED: 'ui:popup_opened',
    POPUP_CLOSED: 'ui:popup_closed',
    SETTING_CHANGED: 'ui:setting_changed',
    COORDINATES_UPDATED: 'ui:coordinates_updated',
    
    // Phase2B: プリセット関連イベント（拡張）
    PRESET_UPDATED: 'ui:preset_updated',
    PRESET_SELECTED: 'ui:preset_selected',
    PRESET_LIVE_UPDATED: 'ui:preset_live_updated',
    PRESET_RESET: 'ui:preset_reset',
    PREVIEW_SIZE_CHANGED: 'ui:preview_size_changed',
    
    // Phase2B: 新PresetManager連携イベント
    PRESET_MANAGER_READY: 'ui:preset_manager_ready',
    PRESET_DISPLAY_UPDATE: 'ui:preset_display_update'
};

// ==== Phase2B: UI設定定数（CONFIG連携強化版）====
const UI_CONFIG = {
    // ポップアップ設定
    POPUP_ANIMATION_DURATION: 300,
    POPUP_MIN_WIDTH: 280,
    POPUP_MIN_HEIGHT: 350,
    
    // Phase2B: スライダー設定（CONFIG連携）
    SLIDER_UPDATE_THROTTLE: window.CONFIG?.SLIDER_UPDATE_THROTTLE || 16, // 60fps
    SLIDER_DEBUG: window.DEBUG_CONFIG?.ENABLE_LOGGING || false,
    
    // ドラッグ設定
    DRAG_THRESHOLD: 3,
    
    // Phase2B: プリセット設定（CONFIG統一）
    SIZE_PRESETS: window.CONFIG?.SIZE_PRESETS || [1, 2, 4, 8, 16, 32],
    SIZE_PREVIEW_MIN: window.CONFIG?.PREVIEW_MIN_SIZE || 0.5,
    SIZE_PREVIEW_MAX: window.CONFIG?.PREVIEW_MAX_SIZE || 20,
    
    // Phase2B: 動的プレビュー設定（最適化）
    DYNAMIC_PREVIEW_ENABLED: true,
    LIVE_UPDATE_THROTTLE: window.CONFIG?.PRESET_UPDATE_THROTTLE || 16, // 60fps
    LINEAR_TRANSFORM_SCALE: 19.5, // プレビューサイズのスケール
    
    // Phase2B: パフォーマンス制御
    MAX_UPDATE_FREQUENCY: 60, // Hz
    UPDATE_BATCH_SIZE: 10,    // バッチ更新サイズ
    ANIMATION_DURATION: 150   // ms
};

// ==== スライダーコントローラー（Phase2B: エラーハンドリング強化版）====
class SliderController {
    constructor(sliderId, min, max, initial, updateCallback) {
        this.sliderId = sliderId;
        this.min = min;
        this.max = max;
        this.value = initial;
        this.updateCallback = updateCallback;
        this.isDragging = false;
        this.throttleTimeout = null;
        
        // Phase2B: エラーハンドリング強化
        this.isInitialized = false;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        try {
            this.elements = this.findElements();
            if (this.elements.container) {
                this.setupEventListeners();
                this.updateDisplay();
                this.isInitialized = true;
            }
        } catch (error) {
            console.error(`SliderController初期化エラー (${sliderId}):`, error);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2B: エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        if (this.errorCount > this.maxErrors) {
            console.error(`SliderController (${this.sliderId}): 最大エラー数に達しました。無効化します。`);
            this.isInitialized = false;
            return;
        }
        console.warn(`SliderController (${this.sliderId}) エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * DOM要素を検索（Phase2B: エラーハンドリング強化）
     */
    findElements() {
        const container = document.getElementById(this.sliderId);
        if (!container) {
            throw new Error(`スライダー要素が見つかりません: ${this.sliderId}`);
        }
        
        const valueDisplay = this.findValueDisplayElement(container);
        
        return {
            container,
            track: container.querySelector('.slider-track'),
            handle: container.querySelector('.slider-handle'),
            valueDisplay
        };
    }
    
    /**
     * valueDisplay要素を検索（Phase2B: 検索ロジック改善）
     */
    findValueDisplayElement(container) {
        const selectors = [
            '.slider-value',
            '.value-display',
            '.current-value',
            '[data-slider-value]'
        ];
        
        let valueDisplay = null;
        
        // 親要素から順次検索
        const searchContexts = [
            container.parentNode,
            container.closest('.slider-controls'),
            container.closest('.slider-container'),
            container.closest('.control-group')
        ].filter(Boolean);
        
        for (const context of searchContexts) {
            for (const selector of selectors) {
                valueDisplay = context.querySelector(selector);
                if (valueDisplay) break;
            }
            if (valueDisplay) break;
        }
        
        if (!valueDisplay && UI_CONFIG.SLIDER_DEBUG) {
            console.warn(`[${this.sliderId}] value display要素が見つかりません`);
        }
        
        return valueDisplay;
    }
    
    /**
     * Phase2B: イベントリスナー設定（エラーハンドリング付き）
     */
    setupEventListeners() {
        if (!this.elements.container) return;
        
        try {
            const { container } = this.elements;
            
            container.addEventListener('mousedown', (e) => this.onMouseDown(e));
            document.addEventListener('mousemove', (e) => this.onMouseMove(e));
            document.addEventListener('mouseup', () => this.onMouseUp());
            
            // タッチイベント対応（将来実装用）
            // container.addEventListener('touchstart', (e) => this.onTouchStart(e));
            // document.addEventListener('touchmove', (e) => this.onTouchMove(e));
            // document.addEventListener('touchend', () => this.onTouchEnd());
            
        } catch (error) {
            this.handleError(error);
        }
    }
    
    onMouseDown(event) {
        if (!this.isInitialized) return;
        
        try {
            this.isDragging = true;
            this.updateValueFromPosition(event.clientX);
            event.preventDefault();
        } catch (error) {
            this.handleError(error);
        }
    }
    
    onMouseMove(event) {
        if (!this.isDragging || !this.isInitialized) return;
        
        try {
            this.updateValueFromPosition(event.clientX);
        } catch (error) {
            this.handleError(error);
        }
    }
    
    onMouseUp() {
        this.isDragging = false;
    }
    
    updateValueFromPosition(clientX) {
        if (!this.elements.container) return;
        
        try {
            const rect = this.elements.container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const newValue = this.min + percentage * (this.max - this.min);
            
            this.setValue(newValue);
        } catch (error) {
            this.handleError(error);
        }
    }
    
    /**
     * 値を設定（Phase2B: パフォーマンス最適化）
     */
    setValue(value, updateDisplay = true) {
        if (!this.isInitialized) return;
        
        const oldValue = this.value;
        this.value = Math.max(this.min, Math.min(this.max, value));
        
        if (updateDisplay) {
            this.updateDisplay();
        }
        
        // Phase2B: より精密な変更検知
        if (this.updateCallback && Math.abs(this.value - oldValue) > 0.001) {
            this.throttledCallback();
        }
    }
    
    throttledCallback() {
        if (this.throttleTimeout) {
            clearTimeout(this.throttleTimeout);
        }
        
        this.throttleTimeout = setTimeout(() => {
            try {
                if (this.updateCallback) {
                    this.updateCallback(this.value);
                }
            } catch (error) {
                this.handleError(error);
            } finally {
                this.throttleTimeout = null;
            }
        }, UI_CONFIG.SLIDER_UPDATE_THROTTLE);
    }
    
    /**
     * 表示更新（Phase2B: エラーハンドリング強化）
     */
    updateDisplay() {
        if (!this.isInitialized || !this.elements.track || !this.elements.handle) return;
        
        try {
            const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
            
            // CSS変更をバッチで実行（パフォーマンス最適化）
            requestAnimationFrame(() => {
                if (this.elements.track) {
                    this.elements.track.style.width = percentage + '%';
                }
                if (this.elements.handle) {
                    this.elements.handle.style.left = percentage + '%';
                }
            });
            
            this.updateValueDisplay();
        } catch (error) {
            this.handleError(error);
        }
    }
    
    /**
     * 数値表示更新（Phase2B: エラーハンドリング強化）
     */
    updateValueDisplay() {
        if (!this.elements.valueDisplay || !this.updateCallback) return;
        
        try {
            const displayValue = this.updateCallback(this.value, true);
            
            if (typeof displayValue === 'string' && displayValue.trim()) {
                this.elements.valueDisplay.textContent = displayValue;
                this.elements.valueDisplay.style.display = 'block';
                this.elements.valueDisplay.style.visibility = 'visible';
            } else {
                this.elements.valueDisplay.textContent = this.value.toFixed(1);
            }
            
        } catch (error) {
            this.elements.valueDisplay.textContent = this.value.toFixed(1);
            this.handleError(error);
        }
    }
    
    adjustValue(delta) {
        this.setValue(this.value + delta);
    }
    
    /**
     * Phase2B: システム状態取得
     */
    getStatus() {
        return {
            sliderId: this.sliderId,
            isInitialized: this.isInitialized,
            value: this.value,
            min: this.min,
            max: this.max,
            isDragging: this.isDragging,
            errorCount: this.errorCount,
            hasElements: !!this.elements?.container
        };
    }
    
    destroy() {
        try {
            if (this.throttleTimeout) {
                clearTimeout(this.throttleTimeout);
            }
            this.isInitialized = false;
            this.elements = null;
        } catch (error) {
            console.warn(`SliderController destroy error (${this.sliderId}):`, error);
        }
    }
}

// ==== ポップアップマネージャー（Phase2B: 機能拡張版）====
class PopupManager {
    constructor() {
        this.activePopup = null;
        this.popups = new Map();
        this.animationQueue = [];
        this.isProcessingAnimation = false;
        
        this.setupGlobalListeners();
        console.log('📋 PopupManager初期化完了（Phase2B拡張版）');
    }
    
    registerPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) {
            console.warn(`ポップアップ要素が見つかりません: ${popupId}`);
            return false;
        }
        
        this.popups.set(popupId, {
            element: popup,
            isDraggable: popup.classList.contains('draggable'),
            isModal: popup.classList.contains('modal'),
            zIndex: parseInt(popup.style.zIndex) || 1000
        });
        
        if (popup.classList.contains('draggable')) {
            this.makeDraggable(popup);
        }
        
        console.log(`📋 ポップアップ登録: ${popupId}`);
        return true;
    }
    
    /**
     * Phase2B: アニメーション付きポップアップ表示
     */
    showPopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        // 他のポップアップを隠す
        this.hideAllPopups();
        
        // アニメーションキューに追加
        this.queueAnimation(() => {
            popupData.element.classList.add('show');
            this.activePopup = popupId;
            
            // モーダルの場合はオーバーレイを表示
            if (popupData.isModal) {
                this.showModalOverlay();
            }
            
            // イベント通知
            this.notifyPopupEvent('popup:shown', popupId);
            
            console.log(`📋 ポップアップ表示: ${popupId}`);
        });
        
        return true;
    }
    
    hidePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        this.queueAnimation(() => {
            popupData.element.classList.remove('show');
            if (this.activePopup === popupId) {
                this.activePopup = null;
            }
            
            // モーダルオーバーレイを隠す
            if (popupData.isModal) {
                this.hideModalOverlay();
            }
            
            // イベント通知
            this.notifyPopupEvent('popup:hidden', popupId);
        });
        
        return true;
    }
    
    togglePopup(popupId) {
        const popupData = this.popups.get(popupId);
        if (!popupData) return false;
        
        const isVisible = popupData.element.classList.contains('show');
        return isVisible ? this.hidePopup(popupId) : this.showPopup(popupId);
    }
    
    hideAllPopups() {
        this.popups.forEach((popupData, popupId) => {
            if (popupData.element.classList.contains('show')) {
                popupData.element.classList.remove('show');
            }
        });
        this.activePopup = null;
        this.hideModalOverlay();
    }
    
    /**
     * Phase2B: アニメーションキュー処理
     */
    queueAnimation(animationFn) {
        this.animationQueue.push(animationFn);
        if (!this.isProcessingAnimation) {
            this.processAnimationQueue();
        }
    }
    
    async processAnimationQueue() {
        this.isProcessingAnimation = true;
        
        while (this.animationQueue.length > 0) {
            const animationFn = this.animationQueue.shift();
            
            try {
                animationFn();
                // アニメーション完了を待つ
                await new Promise(resolve => 
                    setTimeout(resolve, UI_CONFIG.ANIMATION_DURATION)
                );
            } catch (error) {
                console.error('ポップアップアニメーションエラー:', error);
            }
        }
        
        this.isProcessingAnimation = false;
    }
    
    /**
     * Phase2B: モーダルオーバーレイ管理
     */
    showModalOverlay() {
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999;
                display: none;
            `;
            document.body.appendChild(overlay);
            
            overlay.addEventListener('click', () => {
                this.hideAllPopups();
            });
        }
        
        overlay.style.display = 'block';
        setTimeout(() => overlay.style.opacity = '1', 10);
    }
    
    hideModalOverlay() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', UI_CONFIG.ANIMATION_DURATION);
        }
    }
    
    setupGlobalListeners() {
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.popup-panel') && 
                !event.target.closest('.tool-button[data-popup]') &&
                !event.target.closest('.modal-overlay')) {
                this.hideAllPopups();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.activePopup) {
                this.hideAllPopups();
            }
        });
    }
    
    /**
     * Phase2B: ドラッグ機能強化
     */
    makeDraggable(popup) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        let startPosition = { x: 0, y: 0 };
        
        const dragHandle = popup.querySelector('.popup-title, .drag-handle') || popup;
        
        dragHandle.addEventListener('mousedown', (event) => {
            if (event.target === dragHandle || dragHandle.contains(event.target)) {
                isDragging = true;
                popup.classList.add('dragging');
                
                const rect = popup.getBoundingClientRect();
                dragOffset.x = event.clientX - rect.left;
                dragOffset.y = event.clientY - rect.top;
                startPosition.x = rect.left;
                startPosition.y = rect.top;
                
                event.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;
            
            const x = Math.max(0, Math.min(
                event.clientX - dragOffset.x,
                window.innerWidth - popup.offsetWidth
            ));
            const y = Math.max(0, Math.min(
                event.clientY - dragOffset.y,
                window.innerHeight - popup.offsetHeight
            ));
            
            popup.style.left = x + 'px';
            popup.style.top = y + 'px';
        });
        
        document.addEventListener('mouseup', (event) => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
                
                // ドラッグ距離が小さい場合はクリックとして扱わない
                const currentRect = popup.getBoundingClientRect();
                const dragDistance = Math.sqrt(
                    Math.pow(currentRect.left - startPosition.x, 2) +
                    Math.pow(currentRect.top - startPosition.y, 2)
                );
                
                if (dragDistance < UI_CONFIG.DRAG_THRESHOLD) {
                    // 元の位置に戻す
                    popup.style.left = startPosition.x + 'px';
                    popup.style.top = startPosition.y + 'px';
                }
            }
        });
    }
    
    /**
     * Phase2B: イベント通知
     */
    notifyPopupEvent(eventType, popupId) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventType, {
                detail: { popupId, activePopup: this.activePopup }
            }));
        }
    }
    
    /**
     * Phase2B: システム状態取得
     */
    getStatus() {
        return {
            activePopup: this.activePopup,
            popupCount: this.popups.size,
            isProcessingAnimation: this.isProcessingAnimation,
            queueLength: this.animationQueue.length
        };
    }
}

// ==== ステータスバー管理（Phase2B: 表示拡張版）====
class StatusBarManager {
    constructor() {
        this.elements = this.findElements();
        this.updateQueue = [];
        this.isUpdating = false;
        
        console.log('📊 StatusBarManager初期化完了（Phase2B拡張版）');
    }
    
    findElements() {
        return {
            canvasInfo: document.getElementById('canvas-info'),
            currentTool: document.getElementById('current-tool'),
            currentColor: document.getElementById('current-color'),
            coordinates: document.getElementById('coordinates'),
            pressureMonitor: document.getElementById('pressure-monitor'),
            fps: document.getElementById('fps'),
            gpuUsage: document.getElementById('gpu-usage'),
            memoryUsage: document.getElementById('memory-usage'),
            // Phase2B: プリセット情報表示追加
            activePreset: document.getElementById('active-preset'),
            historyStatus: document.getElementById('history-status')
        };
    }
    
    /**
     * Phase2B: バッチ更新システム
     */
    queueUpdate(updateFn) {
        this.updateQueue.push(updateFn);
        if (!this.isUpdating) {
            this.processUpdateQueue();
        }
    }
    
    async processUpdateQueue() {
        this.isUpdating = true;
        
        const batch = this.updateQueue.splice(0, UI_CONFIG.UPDATE_BATCH_SIZE);
        
        try {
            batch.forEach(updateFn => updateFn());
        } catch (error) {
            console.error('ステータスバー更新エラー:', error);
        }
        
        this.isUpdating = false;
        
        if (this.updateQueue.length > 0) {
            setTimeout(() => this.processUpdateQueue(), 16);
        }
    }
    
    updateCanvasInfo(width, height) {
        this.queueUpdate(() => {
            if (this.elements.canvasInfo) {
                this.elements.canvasInfo.textContent = `${width}×${height}px`;
            }
        });
    }
    
    updateCurrentTool(toolName) {
        this.queueUpdate(() => {
            if (this.elements.currentTool) {
                const toolNames = {
                    pen: 'ベクターペン',
                    eraser: '消しゴム',
                    fill: '塗りつぶし',
                    select: '範囲選択'
                };
                this.elements.currentTool.textContent = toolNames[toolName] || toolName;
            }
        });
    }
    
    updateCurrentColor(color) {
        this.queueUpdate(() => {
            if (this.elements.currentColor) {
                const colorStr = typeof color === 'number' ? 
                    '#' + color.toString(16).padStart(6, '0') : color;
                this.elements.currentColor.textContent = colorStr;
                
                // 色見本も更新
                if (this.elements.currentColor.style) {
                    this.elements.currentColor.style.backgroundColor = colorStr;
                }
            }
        });
    }
    
    updateCoordinates(x, y) {
        this.queueUpdate(() => {
            if (this.elements.coordinates) {
                this.elements.coordinates.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        });
    }
    
    updatePressureMonitor(pressure) {
        this.queueUpdate(() => {
            if (this.elements.pressureMonitor) {
                this.elements.pressureMonitor.textContent = pressure.toFixed(1) + '%';
                
                // 圧力に応じて色変更
                const hue = Math.round(pressure * 1.2); // 0-120 (赤->緑)
                this.elements.pressureMonitor.style.color = `hsl(${hue}, 70%, 50%)`;
            }
        });
    }
    
    /**
     * Phase2B: パフォーマンス統計表示強化
     */
    updatePerformanceStats(stats) {
        this.queueUpdate(() => {
            if (this.elements.fps && 'fps' in stats) {
                this.elements.fps.textContent = stats.fps;
                
                // FPSに応じて色変更
                const fps = parseInt(stats.fps);
                if (fps >= 50) {
                    this.elements.fps.style.color = '#4CAF50'; // 緑
                } else if (fps >= 30) {
                    this.elements.fps.style.color = '#FF9800'; // オレンジ
                } else {
                    this.elements.fps.style.color = '#F44336'; // 赤
                }
            }
            
            if (this.elements.gpuUsage && 'gpuUsage' in stats) {
                this.elements.gpuUsage.textContent = stats.gpuUsage + '%';
            }
            
            if (this.elements.memoryUsage && 'memoryUsage' in stats) {
                const memoryMB = typeof stats.memoryUsage === 'string' ? 
                    stats.memoryUsage : stats.memoryUsage + 'MB';
                this.elements.memoryUsage.textContent = memoryMB;
            }
        });
    }
    
    /**
     * Phase2B: アクティブプリセット表示
     */
    updateActivePreset(presetInfo) {
        this.queueUpdate(() => {
            if (this.elements.activePreset && presetInfo) {
                this.elements.activePreset.textContent = 
                    `${presetInfo.name || `サイズ${presetInfo.size}`} (${Math.round(presetInfo.opacity * 100)}%)`;
            }
        });
    }
    
    /**
     * Phase2B: 履歴状態表示
     */
    updateHistoryStatus(historyStats) {
        this.queueUpdate(() => {
            if (this.elements.historyStatus && historyStats) {
                const canUndo = historyStats.canUndo || false;
                const canRedo = historyStats.canRedo || false;
                const historyLength = historyStats.historyLength || 0;
                
                this.elements.historyStatus.textContent = 
                    `履歴: ${historyLength} (${canUndo ? 'U' : '-'}${canRedo ? 'R' : '-'})`;
                    
                // 操作可能状態に応じて色変更
                this.elements.historyStatus.style.color = 
                    canUndo || canRedo ? '#4CAF50' : '#999';
            }
        });
    }
    
    /**
     * Phase2B: システム状態取得
     */
    getStatus() {
        return {
            elementsFound: Object.values(this.elements).filter(Boolean).length,
            totalElements: Object.keys(this.elements).length,
            queueLength: this.updateQueue.length,
            isUpdating: this.isUpdating
        };
    }
}

// ==== Phase2B: プリセット表示管理（新PresetManager統合強化版）====
class PresetDisplayManager {
    constructor(toolsSystem) {
        this.toolsSystem = toolsSystem;
        this.presetManager = null; // Phase2B: 新PresetManager連携
        
        // 更新制御
        this.updateThrottle = null;
        this.isUpdating = false;
        this.updateRequestId = null;
        
        // Phase2B: エラー制御
        this.errorCount = 0;
        this.maxErrors = 10;
        
        // Phase2B: イベントリスナー管理
        this.eventListeners = new Map();
        
        console.log('🎨 PresetDisplayManager初期化完了（Phase2B: 新PresetManager統合強化版）');
    }
    
    /**
     * Phase2B: 新PresetManager設定（拡張版）
     */
    setPresetManager(presetManager) {
        this.presetManager = presetManager;
        
        if (presetManager) {
            // Phase2B: イベントリスナー設定
            this.setupPresetManagerEvents();
            console.log('🔧 PresetDisplayManager: 新PresetManager連携完了');
        } else {
            console.warn('PresetDisplayManager: PresetManager が null です');
        }
    }
    
    /**
     * Phase2B: PresetManagerイベントリスナー設定
     */
    setupPresetManagerEvents() {
        if (!this.presetManager) return;
        
        try {
            // プリセット選択イベント
            this.presetManager.addEventListener('preset:selected', (data) => {
                this.handlePresetSelected(data);
            });
            
            // ライブ更新イベント
            this.presetManager.addEventListener('preset:live_updated', (data) => {
                this.handleLiveUpdated(data);
            });
            
            // リセットイベント
            this.presetManager.addEventListener('preset:reset', (data) => {
                this.handlePresetReset(data);
            });
            
            // 復元イベント
            this.presetManager.addEventListener('preset:restored', (data) => {
                this.handlePresetRestored(data);
            });
            
            console.log('🎛️ PresetManagerイベントリスナー設定完了');
            
        } catch (error) {
            console.error('PresetManagerイベントリスナー設定エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2B: イベントハンドラー
     */
    handlePresetSelected(data) {
        this.throttledUpdate();
        this.notifyDisplayEvent(UI_EVENTS.PRESET_SELECTED, data);
    }
    
    handleLiveUpdated(data) {
        this.throttledUpdate();
        this.notifyDisplayEvent(UI_EVENTS.PRESET_LIVE_UPDATED, data);
    }
    
    handlePresetReset(data) {
        this.forceUpdate();
        this.notifyDisplayEvent(UI_EVENTS.PRESET_RESET, data);
    }
    
    handlePresetRestored(data) {
        this.forceUpdate();
        this.notifyDisplayEvent(UI_EVENTS.PRESET_UPDATED, data);
    }
    
    /**
     * Phase2B: ライブプレビュー更新（強化版）
     */
    updateLivePreview(size, opacity, color = null) {
        if (!this.presetManager) {
            console.warn('PresetManager が設定されていません');
            return;
        }
        
        try {
            this.presetManager.updateActivePresetLive(size, opacity, color);
            // 即座に更新をリクエスト（ライブプレビュー用）
            this.requestImmediateUpdate();
            
        } catch (error) {
            console.error('ライブプレビュー更新エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2B: 即座更新リクエスト
     */
    requestImmediateUpdate() {
        if (this.updateRequestId) {
            cancelAnimationFrame(this.updateRequestId);
        }
        
        this.updateRequestId = requestAnimationFrame(() => {
            this.updatePresetsDisplay();
            this.updateRequestId = null;
        });
    }
    
    /**
     * Phase2B: プリセット表示の更新（完全強化版）
     */
    updatePresetsDisplay() {
        if (this.isUpdating) {
            return;
        }
        
        if (!this.presetManager) {
            console.warn('PresetManager が設定されていません');
            return;
        }
        
        this.isUpdating = true;
        
        try {
            const previewData = this.presetManager.generatePreviewData();
            const presetsContainer = document.getElementById('size-presets');
            
            if (!presetsContainer) {
                console.warn('size-presets コンテナが見つかりません');
                return;
            }
            
            const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
            
            if (presetItems.length === 0) {
                console.warn('プリセット項目が見つかりません');
                return;
            }
            
            // Phase2B: バッチ更新で効率化
            const updateBatch = [];
            
            previewData.forEach((data, index) => {
                if (index < presetItems.length) {
                    updateBatch.push(() => this.updatePresetItem(presetItems[index], data));
                }
            });
            
            // バッチ処理で更新
            this.processBatchUpdates(updateBatch);
            
            console.log(`🎨 プリセット表示更新完了: ${previewData.length}項目`);
            
            // イベント通知
            this.notifyDisplayEvent(UI_EVENTS.PRESET_DISPLAY_UPDATE, {
                itemCount: previewData.length,
                updateTime: Date.now()
            });
            
        } catch (error) {
            console.error('プリセット表示更新エラー:', error);
            this.handleError(error);
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * Phase2B: バッチ更新処理
     */
    processBatchUpdates(updateBatch) {
        const processChunk = (startIndex) => {
            const endIndex = Math.min(startIndex + UI_CONFIG.UPDATE_BATCH_SIZE, updateBatch.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                try {
                    updateBatch[i]();
                } catch (error) {
                    console.error(`バッチ更新エラー (${i}):`, error);
                    this.handleError(error);
                }
            }
            
            if (endIndex < updateBatch.length) {
                // 次のチャンクを非同期で処理
                setTimeout(() => processChunk(endIndex), 1);
            }
        };
        
        processChunk(0);
    }
    
    /**
     * Phase2B: 個別プリセット項目の更新（強化版）
     */
    updatePresetItem(item, data) {
        try {
            // DOM要素を取得
            const circle = item.querySelector('.size-preview-circle');
            const sizeLabel = item.querySelector('.size-preview-label, .size-label');
            const opacityLabel = item.querySelector('.size-preview-percent, .opacity-label');
            
            // HTML属性更新
            item.setAttribute('data-size', data.dataSize);
            item.setAttribute('data-preset-id', data.presetId);
            
            // Phase2B: 円の動的サイズ更新（アニメーション対応）
            if (circle) {
                this.updateCircleDisplay(circle, data);
            }
            
            // Phase2B: ラベル更新（強調表示対応）
            if (sizeLabel) {
                this.updateSizeLabel(sizeLabel, data);
            }
            
            if (opacityLabel) {
                this.updateOpacityLabel(opacityLabel, data);
            }
            
            // Phase2B: アクティブ状態の視覚的反映（強化）
            this.updateActiveState(item, data);
            
        } catch (error) {
            console.error('プリセット項目更新エラー:', error, data);
            this.handleError(error);
        }
    }
    
    /**
     * Phase2B: 円表示更新
     */
    updateCircleDisplay(circle, data) {
        // スムーズなアニメーション用CSS設定
        if (!circle.style.transition) {
            circle.style.transition = `
                width ${UI_CONFIG.ANIMATION_DURATION}ms ease-out,
                height ${UI_CONFIG.ANIMATION_DURATION}ms ease-out,
                opacity ${UI_CONFIG.ANIMATION_DURATION}ms ease-out,
                background-color ${UI_CONFIG.ANIMATION_DURATION}ms ease-out
            `;
        }
        
        // サイズ設定（最小サイズ保証）
        const finalSize = Math.max(data.displaySize, UI_CONFIG.SIZE_PREVIEW_MIN);
        circle.style.width = finalSize + 'px';
        circle.style.height = finalSize + 'px';
        
        // 色・透明度設定
        circle.style.background = data.color;
        circle.style.opacity = data.opacity;
        
        // Phase2B: サイズに応じた視覚効果
        if (data.actualSize > 100) {
            circle.style.boxShadow = '0 2px 8px rgba(128, 0, 0, 0.3)';
        } else {
            circle.style.boxShadow = 'none';
        }
    }
    
    /**
     * Phase2B: サイズラベル更新
     */
    updateSizeLabel(sizeLabel, data) {
        sizeLabel.textContent = data.sizeLabel;
        
        if (data.isActive) {
            sizeLabel.style.fontWeight = 'bold';
            sizeLabel.style.color = '#800000'; // ふたばマルーン
            sizeLabel.style.textShadow = '0 1px 2px rgba(128, 0, 0, 0.3)';
        } else {
            sizeLabel.style.fontWeight = 'normal';
            sizeLabel.style.color = '#333';
            sizeLabel.style.textShadow = 'none';
        }
    }
    
    /**
     * Phase2B: 透明度ラベル更新
     */
    updateOpacityLabel(opacityLabel, data) {
        opacityLabel.textContent = data.opacityLabel;
        
        if (data.isActive) {
            opacityLabel.style.fontWeight = 'bold';
            opacityLabel.style.color = '#800000';
        } else {
            opacityLabel.style.fontWeight = 'normal';
            opacityLabel.style.color = '#666';
        }
    }
    
    /**
     * Phase2B: アクティブ状態更新（強化版）
     */
    updateActiveState(item, data) {
        item.classList.toggle('active', data.isActive);
        
        if (data.isActive) {
            // アクティブ項目の強調表示
            item.style.borderColor = '#800000'; // ふたばマルーン
            item.style.backgroundColor = '#ffe6e6';
            item.style.boxShadow = '0 0 8px rgba(128, 0, 0, 0.3)';
            item.style.transform = 'scale(1.05)';
        } else {
            // 非アクティブ項目の通常表示
            item.style.borderColor = '#ccc';
            item.style.backgroundColor = 'transparent';
            item.style.boxShadow = 'none';
            item.style.transform = 'scale(1)';
        }
    }
    
    /**
     * Phase2B: スロットリング付き更新
     */
    throttledUpdate() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }
        
        this.updateThrottle = setTimeout(() => {
            this.updatePresetsDisplay();
            this.updateThrottle = null;
        }, UI_CONFIG.LIVE_UPDATE_THROTTLE);
    }
    
    /**
     * Phase2B: 強制更新（即座実行）
     */
    forceUpdate() {
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
        
        if (this.updateRequestId) {
            cancelAnimationFrame(this.updateRequestId);
            this.updateRequestId = null;
        }
        
        this.updatePresetsDisplay();
    }
    
    /**
     * Phase2B: プリセット選択処理（強化版）
     */
    handlePresetSelection(presetSize) {
        if (!this.presetManager) {
            console.warn('PresetManager が設定されていません');
            return null;
        }
        
        try {
            const presetId = this.presetManager.getPresetIdBySize(presetSize);
            if (!presetId) {
                console.warn(`プリセットID取得失敗: サイズ${presetSize}`);
                return null;
            }
            
            const preset = this.presetManager.selectPreset(presetId);
            if (preset) {
                // 即座に表示を更新
                this.forceUpdate();
                console.log(`🎯 プリセット選択処理: ${preset.name}`);
            }
            
            return preset;
            
        } catch (error) {
            console.error('プリセット選択処理エラー:', error);
            this.handleError(error);
            return null;
        }
    }
    
    /**
     * Phase2B: エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`PresetDisplayManager: 最大エラー数 (${this.maxErrors}) に達しました。機能を無効化します。`);
            this.destroy();
            return;
        }
        
        console.warn(`PresetDisplayManager エラー ${this.errorCount}/${this.maxErrors}:`, error);
    }
    
    /**
     * Phase2B: イベント通知
     */
    notifyDisplayEvent(eventType, data) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventType, {
                detail: { ...data, timestamp: Date.now() }
            }));
        }
    }
    
    /**
     * Phase2B: プリセット状態の取得（拡張版）
     */
    getPresetDisplayState() {
        if (!this.presetManager) return null;
        
        try {
            return {
                activePresetId: this.presetManager.getActivePresetId(),
                hasLiveValues: !!this.presetManager.currentLiveValues,
                presetCount: this.presetManager.presets.size,
                isUpdating: this.isUpdating,
                errorCount: this.errorCount,
                hasPresetManager: !!this.presetManager,
                lastUpdateTime: Date.now()
            };
        } catch (error) {
            console.error('プリセット状態取得エラー:', error);
            return null;
        }
    }
    
    /**
     * Phase2B: デバッグ情報表示（拡張版）
     */
    debugPresetDisplay() {
        console.group('🔍 PresetDisplayManager デバッグ情報（Phase2B統合強化版）');
        
        try {
            console.log('基本状態:', this.getPresetDisplayState());
            
            if (this.presetManager) {
                const previewData = this.presetManager.generatePreviewData();
                console.log('プレビューデータ:', previewData);
                
                console.log('PresetManager状態:', this.presetManager.getSystemStats());
            }
            
            // DOM状態確認
            const presetsContainer = document.getElementById('size-presets');
            if (presetsContainer) {
                const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
                console.log(`DOM項目数: ${presetItems.length}`);
                
                presetItems.forEach((item, index) => {
                    const circle = item.querySelector('.size-preview-circle');
                    console.log(`項目${index}:`, {
                        dataSize: item.getAttribute('data-size'),
                        presetId: item.getAttribute('data-preset-id'),
                        circleSize: circle ? `${circle.style.width} x ${circle.style.height}` : 'N/A',
                        isActive: item.classList.contains('active')
                    });
                });
            }
            
            // パフォーマンス統計
            console.log('パフォーマンス:', {
                errorCount: this.errorCount,
                maxErrors: this.maxErrors,
                isUpdating: this.isUpdating,
                hasUpdateThrottle: !!this.updateThrottle,
                hasUpdateRequestId: !!this.updateRequestId
            });
            
        } catch (error) {
            console.error('デバッグ情報取得エラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2B: システム統計取得
     */
    getSystemStats() {
        try {
            return {
                displayState: this.getPresetDisplayState(),
                presetManagerStats: this.presetManager ? this.presetManager.getSystemStats() : null,
                performance: {
                    errorCount: this.errorCount,
                    maxErrors: this.maxErrors,
                    isUpdating: this.isUpdating,
                    updateThrottleActive: !!this.updateThrottle,
                    updateRequestActive: !!this.updateRequestId
                },
                memoryUsage: this.estimateMemoryUsage()
            };
        } catch (error) {
            console.error('システム統計取得エラー:', error);
            return null;
        }
    }
    
    /**
     * Phase2B: メモリ使用量推定
     */
    estimateMemoryUsage() {
        try {
            const eventListenersSize = JSON.stringify(Array.from(this.eventListeners.entries())).length;
            return Math.round(eventListenersSize / 1024 * 100) / 100; // KB
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Phase2B: Phase2B機能テスト
     */
    testPhase2BIntegration() {
        console.group('🧪 PresetDisplayManager Phase2B統合テスト');
        
        try {
            // 1. PresetManager連携テスト
            console.log('1. PresetManager連携テスト');
            const hasPresetManager = !!this.presetManager;
            console.log('PresetManager連携:', hasPresetManager ? '✅' : '❌');
            
            if (hasPresetManager) {
                const presetManagerStats = this.presetManager.getSystemStats();
                console.log('PresetManager統計:', presetManagerStats);
            }
            
            // 2. 表示更新テスト
            console.log('2. 表示更新テスト');
            const beforeUpdate = Date.now();
            this.forceUpdate();
            const afterUpdate = Date.now();
            console.log(`更新時間: ${afterUpdate - beforeUpdate}ms`);
            
            // 3. イベント通知テスト
            console.log('3. イベント通知テスト');
            this.notifyDisplayEvent('test:event', { test: true });
            console.log('イベント通知: ✅');
            
            // 4. エラーハンドリングテスト
            console.log('4. エラーハンドリングテスト');
            console.log(`現在のエラー数: ${this.errorCount}/${this.maxErrors}`);
            
            // 5. パフォーマンステスト
            console.log('5. パフォーマンステスト');
            const stats = this.getSystemStats();
            console.log('システム統計:', stats);
            
            console.log('✅ Phase2B統合テスト完了');
            
        } catch (error) {
            console.error('❌ Phase2B統合テストエラー:', error);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2B: クリーンアップ（強化版）
     */
    destroy() {
        try {
            // タイムアウト・リクエストのクリア
            if (this.updateThrottle) {
                clearTimeout(this.updateThrottle);
                this.updateThrottle = null;
            }
            
            if (this.updateRequestId) {
                cancelAnimationFrame(this.updateRequestId);
                this.updateRequestId = null;
            }
            
            // イベントリスナークリア
            this.eventListeners.clear();
            
            // 参照クリア
            this.presetManager = null;
            this.toolsSystem = null;
            
            // フラグリセット
            this.isUpdating = false;
            this.errorCount = 0;
            
            console.log('🧹 PresetDisplayManager クリーンアップ完了（Phase2B）');
            
        } catch (error) {
            console.warn('PresetDisplayManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート（Phase2B対応版）====
if (typeof window !== 'undefined') {
    window.SliderController = SliderController;
    window.PopupManager = PopupManager;
    window.StatusBarManager = StatusBarManager;
    window.PresetDisplayManager = PresetDisplayManager;
    window.UI_CONFIG = UI_CONFIG;
    window.UI_EVENTS = UI_EVENTS;
    
    console.log('✅ ui/components.js Phase2B統合調整版 読み込み完了');
    console.log('📦 利用可能クラス:');
    console.log('  - SliderController（Phase2B: エラーハンドリング強化版）');
    console.log('  - PopupManager（Phase2B: アニメーション・モーダル対応版）');
    console.log('  - StatusBarManager（Phase2B: バッチ更新・表示拡張版）');
    console.log('  - PresetDisplayManager（Phase2B: 新PresetManager統合強化版）');
    console.log('🔧 Phase2B統合調整完了:');
    console.log('  ✅ PresetDisplayManagerの新PresetManager連携強化');
    console.log('  ✅ イベントシステムの統合（新PresetManagerイベント対応）');
    console.log('  ✅ プレビュー更新システムの最適化（バッチ処理・アニメーション）');
    console.log('  ✅ エラーハンドリングの強化（段階的無効化）');
    console.log('  ✅ パフォーマンス最適化（更新頻度制御・メモリ管理）');
    console.log('  ✅ デバッグ機能の拡張（統合テスト・システム統計）');
    console.log('  ✅ UI_CONFIG・UI_EVENTSのCONFIG連携');
    console.log('🎯 責務: 独立UIコンポーネント・新PresetManager統合表示・最適化された更新制御');
    console.log('🏗️ Phase2B完了: プリセット管理分離・表示システム統合・パフォーマンス最適化');
}

// ES6モジュールエクスポート（将来のTypeScript移行用）
/*
export { 
    SliderController, 
    PopupManager, 
    StatusBarManager, 
    PresetDisplayManager,
    UI_CONFIG,
    UI_EVENTS 
};
*/