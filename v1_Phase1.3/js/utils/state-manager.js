/**
 * 🎨 ふたば☆お絵描きツール - 統一状態管理システム（API拡張版+SystemState対応）
 * 🎯 AI_WORK_SCOPE: 状態取得統一・デバッグ支援・監視機能・コンポーネント状態管理・システム状態管理
 * 🎯 DEPENDENCIES: ConfigManager (設定値参照用)
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 300行以下維持
 * 📋 PHASE_TARGET: Phase1.3統一化（SystemState対応）
 * 📋 V8_MIGRATION: v8状態監視対応準備済み
 * 🔧 API拡張: updateComponentState + updateSystemState メソッド追加
 */

/**
 * 統一状態管理システム（SystemState対応版）
 * すべての状態取得を統一し、デバッグを支援
 * ToolManager向けupdateSystemStateメソッド追加
 */
class StateManager {
    /**
     * 状態監視データ
     */
    static monitoring = {
        startTime: performance.now(),
        stateRequests: 0,
        lastUpdate: null
    };
    
    /**
     * コンポーネント状態管理
     */
    static componentStates = new Map();
    
    /**
     * システム状態管理（新規追加）
     */
    static systemStates = new Map();
    
    /**
     * 🔧 コンポーネント状態更新（統一API）
     * @param {string} component - コンポーネント名
     * @param {string} state - 状態
     * @param {Object} data - 状態データ
     */
    static updateComponentState(component, state, data = {}) {
        try {
            if (typeof component !== 'string' || typeof state !== 'string') {
                throw new Error('component と state は文字列である必要があります');
            }
            
            const timestamp = Date.now();
            const stateEntry = {
                component,
                state,
                data,
                timestamp,
                id: `${component}-${state}-${timestamp}`
            };
            
            // コンポーネント状態保存
            this.componentStates.set(component, stateEntry);
            
            // EventBusに通知（存在する場合）
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit('component.state.updated', stateEntry);
            }
            
            console.log(`🔧 コンポーネント状態更新: ${component} → ${state}`, data);
            
            return true;
            
        } catch (error) {
            console.error('StateManager.updateComponentState エラー:', error.message);
            
            // ErrorManager に通知（存在する場合）
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('state-update', 
                    `コンポーネント状態更新エラー: ${error.message}`, 
                    { component, state, data }
                );
            }
            
            return false;
        }
    }
    
    /**
     * 🔧 システム状態更新（ToolManager向け新規API）
     * @param {string} system - システム名 ('toolManager', 'canvasManager'等)
     * @param {string} state - 状態名 ('initialized', 'drawing'等)
     * @param {Object} data - 状態データ
     * @returns {boolean} 成功フラグ
     */
    static updateSystemState(system, state, data = {}) {
        try {
            if (typeof system !== 'string' || typeof state !== 'string') {
                throw new Error('system と state は文字列である必要があります');
            }
            
            const timestamp = Date.now();
            const stateEntry = {
                system,
                state,
                data,
                timestamp,
                id: `${system}-${state}-${timestamp}`
            };
            
            // システム状態保存
            this.systemStates.set(system, stateEntry);
            
            // EventBusに通知（存在する場合）
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit('system.state.updated', stateEntry);
            }
            
            console.log(`🔧 システム状態更新: ${system} → ${state}`, data);
            
            return true;
            
        } catch (error) {
            console.error('StateManager.updateSystemState エラー:', error.message);
            
            // ErrorManager に通知（存在する場合）
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('state-update',
                    `システム状態更新エラー: ${error.message}`,
                    { system, state, data }
                );
            }
            
            return false;
        }
    }
    
    /**
     * 🔧 コンポーネント状態取得
     * @param {string} component - コンポーネント名
     * @returns {Object|null} コンポーネント状態
     */
    static getComponentState(component) {
        return this.componentStates.get(component) || null;
    }
    
    /**
     * 🔧 システム状態取得（新規追加）
     * @param {string} system - システム名
     * @returns {Object|null} システム状態
     */
    static getSystemState(system) {
        return this.systemStates.get(system) || null;
    }
    
    /**
     * 🔧 全コンポーネント状態取得
     * @returns {Object} 全コンポーネント状態
     */
    static getAllComponentStates() {
        const states = {};
        this.componentStates.forEach((value, key) => {
            states[key] = value;
        });
        return states;
    }
    
    /**
     * 🔧 全システム状態取得（新規追加）
     * @returns {Object} 全システム状態
     */
    static getAllSystemStates() {
        const states = {};
        this.systemStates.forEach((value, key) => {
            states[key] = value;
        });
        return states;
    }
    
    /**
     * アプリケーション全体状態取得（統一版・SystemState統合）
     * @returns {Object} 完全な状態情報
     */
    static getApplicationState() {
        this.monitoring.stateRequests++;
        this.monitoring.lastUpdate = Date.now();
        
        return {
            core: this.getCoreState(),
            ui: this.getUIState(),
            drawing: this.getDrawingState(),
            performance: this.getPerformanceState(),
            errors: this.getErrorState(),
            config: this.getConfigState(),
            debug: this.getDebugState(),
            components: this.getAllComponentStates(), // 既存
            systems: this.getAllSystemStates() // 新規追加
        };
    }
    
    /**
     * コアシステム状態取得
     * @returns {Object} コア状態
     */
    static getCoreState() {
        const app = window.futabaDrawingTool;
        const appCore = app?.appCore;
        
        return {
            version: app?.version || 'unknown',
            isInitialized: app?.isInitialized || false,
            initializationSteps: app?.initializationSteps || [],
            hasAppCore: !!appCore,
            hasPixiApp: !!appCore?.app,
            hasDrawingContainer: !!appCore?.drawingContainer,
            hasUIContainer: !!appCore?.uiContainer,
            // 新旧両方のプロパティ名に対応
            hasToolSystem: !!appCore?.toolSystem,
            hasToolManager: !!appCore?.toolManager,
            hasUIController: !!appCore?.uiController,
            hasUIManager: !!appCore?.uiManager,
            hasPerformanceMonitor: !!appCore?.performanceMonitor,
            canvasSize: appCore ? `${appCore.canvasWidth}×${appCore.canvasHeight}` : 'unknown',
            canvasElement: !!document.getElementById('drawing-canvas'),
            fallbackMode: appCore?.fallbackMode || false,
            extensionsAvailable: appCore?.extensionsAvailable || false
        };
    }
    
    /**
     * UI状態取得
     * @returns {Object} UI状態
     */
    static getUIState() {
        // 新旧両方のプロパティ名に対応
        const uiController = window.futabaDrawingTool?.appCore?.uiController || 
                           window.futabaDrawingTool?.appCore?.uiManager;
        
        // アクティブツール検出
        const activeToolButton = document.querySelector('.tool-button.active');
        const activeTool = activeToolButton?.id?.replace('-tool', '') || 'unknown';
        
        // アクティブポップアップ検出
        const activePopups = Array.from(document.querySelectorAll('.popup-panel.show'))
                                  .map(popup => popup.id);
        
        // スライダー状態取得
        const sliders = {};
        ['pen-size', 'pen-opacity', 'pen-pressure', 'pen-smoothing'].forEach(sliderId => {
            const valueElement = document.getElementById(`${sliderId}-value`);
            if (valueElement) {
                sliders[sliderId] = valueElement.textContent;
            }
        });
        
        // ステータス表示取得
        const statusElements = {};
        ['canvas-info', 'current-tool', 'current-color', 'coordinates', 
         'pressure-monitor', 'fps', 'gpu-usage', 'memory-usage'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                statusElements[id] = element.textContent;
            }
        });
        
        return {
            activeTool,
            activePopups,
            sliders,
            statusElements,
            hasUIController: !!uiController,
            totalToolButtons: document.querySelectorAll('.tool-button').length,
            enabledToolButtons: document.querySelectorAll('.tool-button:not(.disabled)').length,
            totalPopups: document.querySelectorAll('.popup-panel').length
        };
    }
    
    /**
     * 描画状態取得
     * @returns {Object} 描画状態
     */
    static getDrawingState() {
        // 新旧両方のプロパティ名に対応
        const toolSystem = window.futabaDrawingTool?.appCore?.toolSystem || 
                          window.futabaDrawingTool?.appCore?.toolManager;
        const appCore = window.futabaDrawingTool?.appCore;
        
        return {
            hasToolSystem: !!toolSystem,
            currentTool: toolSystem?.currentTool || 'unknown',
            isDrawing: toolSystem?.isDrawing || false,
            brushSize: toolSystem?.brushSize || 0,
            brushColor: toolSystem?.brushColor || 0,
            brushColorHex: toolSystem?.brushColor ? 
                          `#${toolSystem.brushColor.toString(16).padStart(6, '0')}` : 'unknown',
            opacity: toolSystem?.opacity || 0,
            pressure: toolSystem?.pressure || 0,
            smoothing: toolSystem?.smoothing || 0,
            pathCount: appCore?.paths?.length || 0,
            lastPoint: toolSystem?.lastPoint || null,
            currentPath: !!toolSystem?.currentPath,
            minDistance: toolSystem?.minDistance || 0,
            extensionsAvailable: toolSystem?.extensionsAvailable || false
        };
    }
    
    /**
     * パフォーマンス状態取得
     * @returns {Object} パフォーマンス状態
     */
    static getPerformanceState() {
        const performanceMonitor = window.futabaDrawingTool?.appCore?.performanceMonitor;
        const app = window.futabaDrawingTool;
        
        const initTime = app ? performance.now() - app.startTime : 0;
        const memoryInfo = performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : null;
        
        return {
            hasPerformanceMonitor: !!performanceMonitor,
            isMonitoring: performanceMonitor?.isRunning || false,
            currentFPS: performanceMonitor?.metrics?.currentFPS || 0,
            averageFPS: performanceMonitor?.metrics?.averageFPS || 0,
            minFPS: performanceMonitor?.metrics?.minFPS || 0,
            maxFPS: performanceMonitor?.metrics?.maxFPS || 0,
            initTime: Math.round(initTime),
            memoryUsage: memoryInfo,
            frameCount: performanceMonitor?.metrics?.frameCount || 0,
            updateCallbacks: performanceMonitor?.updateCallbacks?.size || 0,
            isHighPerformance: initTime < 3000 && (performanceMonitor?.metrics?.currentFPS || 0) >= 50
        };
    }
    
    /**
     * エラー状態取得
     * @returns {Object} エラー状態
     */
    static getErrorState() {
        const app = window.futabaDrawingTool;
        const errorManager = window.ErrorManager;
        
        return {
            hasErrorManager: !!errorManager,
            appErrorLog: app?.errorLog || [],
            managerErrorLog: errorManager ? errorManager.getErrorLog() : [],
            totalAppErrors: app?.errorLog?.length || 0,
            totalManagerErrors: errorManager ? errorManager.getErrorLog().length : 0,
            errorStats: errorManager ? errorManager.getErrorStats() : null,
            lastError: app?.errorLog?.slice(-1)[0] || null
        };
    }
    
    /**
     * 設定状態取得
     * @returns {Object} 設定状態
     */
    static getConfigState() {
        const configManager = window.ConfigManager;
        
        if (!configManager) {
            return { hasConfigManager: false };
        }
        
        return {
            hasConfigManager: true,
            debugInfo: configManager.getDebugInfo(),
            canvasConfig: configManager.getCanvasConfig(),
            drawingConfig: configManager.getDrawingConfig(),
            performanceConfig: configManager.getPerformanceConfig(),
            colors: configManager.getColors(),
            v8Ready: configManager.get('v8Migration.enabled')
        };
    }
    
    /**
     * デバッグ状態取得
     * @returns {Object} デバッグ状態
     */
    static getDebugState() {
        return {
            pixiVersion: window.PIXI?.VERSION || 'not loaded',
            pixiExtensions: !!window.PixiExtensions,
            extensionsInitialized: window.PixiExtensions?.initialized || false,
            extensionStats: window.PixiExtensions?.getStats?.() || null,
            gsapAvailable: !!window.gsap,
            lodashAvailable: !!window._,
            hammerAvailable: !!window.Hammer,
            stateManagerStats: {
                requests: this.monitoring.stateRequests,
                uptime: Math.round(performance.now() - this.monitoring.startTime),
                lastUpdate: this.monitoring.lastUpdate,
                componentStates: this.componentStates.size,
                systemStates: this.systemStates.size // 新規追加
            },
            domElements: this.getDOMElementsState(),
            browserInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screenSize: `${window.screen.width}×${window.screen.height}`,
                windowSize: `${window.innerWidth}×${window.innerHeight}`
            }
        };
    }
    
    /**
     * DOM要素状態取得
     * @returns {Object} DOM要素状態
     */
    static getDOMElementsState() {
        const requiredElements = [
            'drawing-canvas', 'pen-tool', 'eraser-tool', 'pen-settings', 
            'resize-settings', 'canvas-info', 'current-tool', 'coordinates'
        ];
        
        const elementStatus = {};
        let foundElements = 0;
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            elementStatus[id] = {
                exists: !!element,
                visible: element ? element.offsetParent !== null : false,
                classList: element ? Array.from(element.classList) : []
            };
            if (element) foundElements++;
        });
        
        return {
            required: requiredElements.length,
            found: foundElements,
            missing: requiredElements.filter(id => !document.getElementById(id)),
            elements: elementStatus,
            completeness: Math.round((foundElements / requiredElements.length) * 100)
        };
    }
    
    /**
     * 簡易状態取得（デバッグ用）
     * @returns {Object} 簡易状態
     */
    static getQuickState() {
        const core = this.getCoreState();
        const ui = this.getUIState();
        const drawing = this.getDrawingState();
        const performance = this.getPerformanceState();
        
        return {
            status: core.isInitialized ? '初期化完了' : '未初期化',
            canvasSize: core.canvasSize,
            tool: ui.activeTool,
            brushSize: drawing.brushSize,
            pathCount: drawing.pathCount,
            fps: performance.currentFPS,
            initTime: performance.initTime + 'ms',
            errors: this.getErrorState().totalAppErrors,
            componentStates: this.componentStates.size,
            systemStates: this.systemStates.size // 新規追加
        };
    }
    
    /**
     * 状態比較
     * @param {Object} previousState - 前回の状態
     * @returns {Object} 変更点
     */
    static compareState(previousState) {
        const currentState = this.getApplicationState();
        const changes = {};
        
        this.compareObjects(previousState, currentState, changes, '');
        
        return {
            hasChanges: Object.keys(changes).length > 0,
            changes,
            timestamp: Date.now()
        };
    }
    
    /**
     * オブジェクト比較（再帰）
     * @param {Object} old - 古いオブジェクト
     * @param {Object} new - 新しいオブジェクト
     * @param {Object} changes - 変更点格納オブジェクト
     * @param {string} path - パス
     */
    static compareObjects(oldObj, newObj, changes, path) {
        if (!oldObj || !newObj) return;
        
        for (const key in newObj) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                this.compareObjects(oldObj[key], newObj[key], changes, currentPath);
            } else if (oldObj[key] !== newObj[key]) {
                changes[currentPath] = {
                    old: oldObj[key],
                    new: newObj[key]
                };
            }
        }
    }
    
    /**
     * 健全性チェック（強化版）
     * @returns {Object} チェック結果
     */
    static healthCheck() {
        const state = this.getApplicationState();
        const issues = [];
        const warnings = [];
        
        // コア状態チェック
        if (!state.core.isInitialized) {
            issues.push('アプリケーションが未初期化');
        }
        
        if (!state.core.hasPixiApp) {
            issues.push('PixiJS Applicationが未初期化');
        }
        
        // 新旧両方のプロパティ名をチェック
        if (!state.core.hasToolSystem && !state.core.hasToolManager) {
            issues.push('ツールシステムが未初期化');
        }
        
        if (!state.core.hasUIController && !state.core.hasUIManager) {
            issues.push('UIコントローラーが未初期化');
        }
        
        // UI状態チェック
        if (state.ui.totalToolButtons === 0) {
            issues.push('ツールボタンが見つからない');
        }
        
        if (state.debug.domElements.completeness < 90) {
            warnings.push(`DOM要素の完全性が低い: ${state.debug.domElements.completeness}%`);
        }
        
        // パフォーマンスチェック
        if (state.performance.initTime > 5000) {
            warnings.push(`初期化時間が長い: ${state.performance.initTime}ms`);
        }
        
        if (state.performance.currentFPS > 0 && state.performance.currentFPS < 30) {
            warnings.push(`FPSが低い: ${state.performance.currentFPS}`);
        }
        
        // エラーチェック
        if (state.errors.totalAppErrors > 0) {
            warnings.push(`エラーが発生: ${state.errors.totalAppErrors}件`);
        }
        
        // コンポーネント状態チェック
        const componentCount = Object.keys(state.components).length;
        if (componentCount === 0) {
            warnings.push('コンポーネント状態が記録されていません');
        }
        
        // システム状態チェック（新規追加）
        const systemCount = Object.keys(state.systems).length;
        if (systemCount === 0) {
            warnings.push('システム状態が記録されていません');
        }
        
        return {
            healthy: issues.length === 0,
            issues,
            warnings,
            score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5),
            timestamp: Date.now(),
            componentStates: componentCount,
            systemStates: systemCount // 新規追加
        };
    }
    
    /**
     * 🔧 統計情報取得（SystemState対応）
     * @returns {Object} 統計情報
     */
    static getStats() {
        return {
            monitoring: { ...this.monitoring },
            componentStates: this.componentStates.size,
            systemStates: this.systemStates.size, // 新規追加
            uptime: Math.round(performance.now() - this.monitoring.startTime),
            requestsPerMinute: Math.round((this.monitoring.stateRequests / (performance.now() - this.monitoring.startTime)) * 60000)
        };
    }
    
    /**
     * 🔧 状態リセット（SystemState対応）
     */
    static resetComponentStates() {
        const componentCount = this.componentStates.size;
        const systemCount = this.systemStates.size;
        
        this.componentStates.clear();
        this.systemStates.clear();
        
        console.log(`🔧 状態リセット完了: コンポーネント${componentCount}件、システム${systemCount}件削除`);
        
        if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
            window.EventBus.safeEmit('all.states.reset', { 
                componentCount, 
                systemCount 
            });
        }
    }
    
    /**
     * 🔧 システム状態のみリセット（新規追加）
     */
    static resetSystemStates() {
        const count = this.systemStates.size;
        this.systemStates.clear();
        console.log(`🔧 システム状態リセット: ${count}件削除`);
        
        if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
            window.EventBus.safeEmit('system.states.reset', { count });
        }
    }
}

// グローバル公開
window.StateManager = StateManager;

// 旧関数との互換性維持（統一移行のため）
window.getAppState = () => {
    console.warn('getAppState() is deprecated. Use StateManager.getApplicationState()');
    return StateManager.getApplicationState();
};

// デバッグ用グローバル関数
window.getState = () => StateManager.getApplicationState();
window.getQuickState = () => StateManager.getQuickState();
window.getCoreState = () => StateManager.getCoreState();
window.getDrawingState = () => StateManager.getDrawingState();
window.healthCheck = () => StateManager.healthCheck();

console.log('✅ StateManager 初期化完了（SystemState対応版）');
console.log('💡 使用例: StateManager.getApplicationState() または window.getState()');
console.log('🔧 新機能: StateManager.updateComponentState(component, state, data)');
console.log('🔧 新API: StateManager.updateSystemState(system, state, data)');