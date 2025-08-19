/**
 * 🎨 ふたば☆お絵描きツール - 統一状態管理システム
 * 🎯 AI_WORK_SCOPE: 状態取得統一・デバッグ支援・監視機能
 * 🎯 DEPENDENCIES: ConfigManager (設定値参照用)
 * 🎯 PIXI_EXTENSIONS: 使用しない
 * 🎯 ISOLATION_TEST: 可能
 * 🎯 SPLIT_THRESHOLD: 200行以下維持
 * 📋 PHASE_TARGET: Phase1統一化
 * 📋 V8_MIGRATION: v8状態監視対応準備済み
 */

/**
 * 統一状態管理システム
 * すべての状態取得を統一し、デバッグを支援
 */
class StateManager {
    /**
     * 状態監視データ
     */
    static monitoring = {
        startTime: performance.now(),
        stateRequests: 0,
        lastUpdate: null,
        components: new Map() // ✅ コンポーネント状態管理
    };
    
    /**
     * ✅ 統一API: コンポーネント状態更新
     * @param {string} component - コンポーネント名
     * @param {string} state - 状態
     * @param {Object} data - データ
     */
    static updateComponentState(component, state, data) {
        try {
            const timestamp = Date.now();
            const stateData = {
                component,
                state,
                data,
                timestamp,
                version: '1.0'
            };
            
            // 状態を保存
            this.monitoring.components.set(component, stateData);
            this.monitoring.lastUpdate = timestamp;
            
            console.log('📊 コンポーネント状態更新:', component, '->', state);
            
            // イベント通知
            if (window.EventBus) {
                window.EventBus.safeEmit('state.component.updated', stateData);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ コンポーネント状態更新エラー:', error);
            
            // エラー管理システム連携
            if (window.ErrorManager) {
                window.ErrorManager.showError('state-error', 'コンポーネント状態更新失敗: ' + error.message);
            }
            
            return false;
        }
    }
    
    /**
     * ✅ 統一API: 特定コンポーネント状態取得
     * @param {string} component - コンポーネント名
     * @returns {Object|null} 状態データ
     */
    static getComponentState(component) {
        try {
            this.monitoring.stateRequests++;
            return this.monitoring.components.get(component) || null;
            
        } catch (error) {
            console.error('❌ コンポーネント状態取得エラー:', error);
            return null;
        }
    }
    
    /**
     * ✅ 統一API: アプリケーション全体状態取得（統一版）
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
            components: this.getAllComponentStates() // ✅ コンポーネント状態追加
        };
    }
    
    /**
     * ✅ 統一API: 全コンポーネント状態取得
     * @returns {Object} 全コンポーネント状態
     */
    static getAllComponentStates() {
        const states = {};
        
        this.monitoring.components.forEach((stateData, component) => {
            states[component] = stateData;
        });
        
        return {
            total: this.monitoring.components.size,
            states: states,
            lastUpdate: this.monitoring.lastUpdate
        };
    }
    
    /**
     * コアシステム状態取得
     * @returns {Object} コア状態
     */
    static getCoreState() {
        const app = window.futabaDrawingTool;
        const appCore = app ? app.appCore : null;
        
        return {
            version: app ? app.version : 'unknown',
            isInitialized: app ? app.isInitialized : false,
            initializationSteps: app ? app.initializationSteps : [],
            hasAppCore: !!appCore,
            hasPixiApp: !!(appCore && appCore.app),
            hasDrawingContainer: !!(appCore && appCore.drawingContainer),
            hasUIContainer: !!(appCore && appCore.uiContainer),
            hasToolSystem: !!(appCore && appCore.toolSystem),
            hasUIController: !!(appCore && appCore.uiController),
            hasPerformanceMonitor: !!(appCore && appCore.performanceMonitor),
            canvasSize: appCore ? appCore.canvasWidth + '×' + appCore.canvasHeight : 'unknown',
            canvasElement: !!document.getElementById('drawing-canvas'),
            fallbackMode: appCore ? appCore.fallbackMode : false,
            extensionsAvailable: appCore ? appCore.extensionsAvailable : false
        };
    }
    
    /**
     * UI状態取得
     * @returns {Object} UI状態
     */
    static getUIState() {
        const uiController = window.futabaDrawingTool && window.futabaDrawingTool.appCore ? 
                            window.futabaDrawingTool.appCore.uiController : null;
        
        // アクティブツール検出
        const activeToolButton = document.querySelector('.tool-button.active');
        const activeTool = activeToolButton && activeToolButton.id ? 
                          activeToolButton.id.replace('-tool', '') : 'unknown';
        
        // アクティブポップアップ検出
        const activePopups = Array.from(document.querySelectorAll('.popup-panel.show'))
                                  .map(popup => popup.id);
        
        // スライダー状態取得
        const sliders = {};
        ['pen-size', 'pen-opacity', 'pen-pressure', 'pen-smoothing'].forEach(sliderId => {
            const valueElement = document.getElementById(sliderId + '-value');
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
        const toolSystem = window.futabaDrawingTool && window.futabaDrawingTool.appCore ? 
                          window.futabaDrawingTool.appCore.toolSystem : null;
        const appCore = window.futabaDrawingTool ? window.futabaDrawingTool.appCore : null;
        
        return {
            hasToolSystem: !!toolSystem,
            currentTool: toolSystem ? toolSystem.currentTool : 'unknown',
            isDrawing: toolSystem ? toolSystem.isDrawing : false,
            brushSize: toolSystem ? toolSystem.brushSize : 0,
            brushColor: toolSystem ? toolSystem.brushColor : 0,
            brushColorHex: toolSystem && toolSystem.brushColor ? 
                          '#' + toolSystem.brushColor.toString(16).padStart(6, '0') : 'unknown',
            opacity: toolSystem ? toolSystem.opacity : 0,
            pressure: toolSystem ? toolSystem.pressure : 0,
            smoothing: toolSystem ? toolSystem.smoothing : 0,
            pathCount: appCore && appCore.paths ? appCore.paths.length : 0,
            lastPoint: toolSystem ? toolSystem.lastPoint : null,
            currentPath: !!(toolSystem && toolSystem.currentPath),
            minDistance: toolSystem ? toolSystem.minDistance : 0,
            extensionsAvailable: toolSystem ? toolSystem.extensionsAvailable : false
        };
    }
    
    /**
     * パフォーマンス状態取得
     * @returns {Object} パフォーマンス状態
     */
    static getPerformanceState() {
        const performanceMonitor = window.futabaDrawingTool && window.futabaDrawingTool.appCore ? 
                                  window.futabaDrawingTool.appCore.performanceMonitor : null;
        const app = window.futabaDrawingTool;
        
        const initTime = app && app.startTime ? performance.now() - app.startTime : 0;
        const memoryInfo = performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : null;
        
        return {
            hasPerformanceMonitor: !!performanceMonitor,
            isMonitoring: performanceMonitor ? performanceMonitor.isRunning : false,
            currentFPS: performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.currentFPS : 0,
            averageFPS: performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.averageFPS : 0,
            minFPS: performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.minFPS : 0,
            maxFPS: performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.maxFPS : 0,
            initTime: Math.round(initTime),
            memoryUsage: memoryInfo,
            frameCount: performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.frameCount : 0,
            updateCallbacks: performanceMonitor && performanceMonitor.updateCallbacks ? performanceMonitor.updateCallbacks.size : 0,
            isHighPerformance: initTime < 3000 && (performanceMonitor && performanceMonitor.metrics ? performanceMonitor.metrics.currentFPS : 0) >= 50
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
            appErrorLog: app && app.errorLog ? app.errorLog : [],
            managerErrorLog: errorManager ? errorManager.getErrorLog() : [],
            totalAppErrors: app && app.errorLog ? app.errorLog.length : 0,
            totalManagerErrors: errorManager ? errorManager.getErrorLog().length : 0,
            errorStats: errorManager ? errorManager.getErrorStats() : null,
            lastError: app && app.errorLog ? app.errorLog.slice(-1)[0] : null
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
            pixiVersion: window.PIXI ? window.PIXI.VERSION : 'not loaded',
            pixiExtensions: !!window.PixiExtensions,
            extensionsInitialized: window.PixiExtensions ? window.PixiExtensions.initialized : false,
            extensionStats: window.PixiExtensions && window.PixiExtensions.getStats ? window.PixiExtensions.getStats() : null,
            gsapAvailable: !!window.gsap,
            lodashAvailable: !!window._,
            hammerAvailable: !!window.Hammer,
            stateManagerStats: {
                requests: this.monitoring.stateRequests,
                uptime: Math.round(performance.now() - this.monitoring.startTime),
                lastUpdate: this.monitoring.lastUpdate,
                components: this.monitoring.components.size // ✅ コンポーネント数追加
            },
            domElements: this.getDOMElementsState(),
            browserInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screenSize: window.screen.width + '×' + window.screen.height,
                windowSize: window.innerWidth + '×' + window.innerHeight
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
            components: this.monitoring.components.size // ✅ コンポーネント数追加
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
     * @param {Object} oldObj - 古いオブジェクト
     * @param {Object} newObj - 新しいオブジェクト
     * @param {Object} changes - 変更点格納オブジェクト
     * @param {string} path - パス
     */
    static compareObjects(oldObj, newObj, changes, path) {
        if (!oldObj || !newObj) return;
        
        for (const key in newObj) {
            const currentPath = path ? path + '.' + key : key;
            
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
     * ✅ 統一API: 健全性チェック
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
        
        // UI状態チェック
        if (state.ui.totalToolButtons === 0) {
            issues.push('ツールボタンが見つからない');
        }
        
        if (state.debug.domElements.completeness < 90) {
            warnings.push('DOM要素の完全性が低い: ' + state.debug.domElements.completeness + '%');
        }
        
        // パフォーマンスチェック
        if (state.performance.initTime > 5000) {
            warnings.push('初期化時間が長い: ' + state.performance.initTime + 'ms');
        }
        
        if (state.performance.currentFPS > 0 && state.performance.currentFPS < 30) {
            warnings.push('FPSが低い: ' + state.performance.currentFPS);
        }
        
        // エラーチェック
        if (state.errors.totalAppErrors > 0) {
            warnings.push('エラーが発生: ' + state.errors.totalAppErrors + '件');
        }
        
        // ✅ コンポーネント状態チェック
        const componentStates = state.components.states;
        for (const [component, componentData] of Object.entries(componentStates)) {
            if (componentData.state === 'error' || componentData.state === 'failed') {
                issues.push('コンポーネントエラー: ' + component);
            }
        }
        
        return {
            healthy: issues.length === 0,
            issues,
            warnings,
            score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5),
            timestamp: Date.now(),
            components: {
                total: state.components.total,
                initialized: Object.values(componentStates).filter(c => c.state === 'initialized').length,
                failed: Object.values(componentStates).filter(c => c.state === 'failed' || c.state === 'error').length
            }
        };
    }
    
    /**
     * ✅ 統一API: コンポーネント状態リセット
     * @param {string} component - コンポーネント名
     */
    static resetComponentState(component) {
        try {
            if (this.monitoring.components.has(component)) {
                this.monitoring.components.delete(component);
                console.log('🔄 コンポーネント状態リセット:', component);
                
                // イベント通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('state.component.reset', { component, timestamp: Date.now() });
                }
                
                return true;
            }
            return false;
            
        } catch (error) {
            console.error('❌ コンポーネント状態リセットエラー:', error);
            return false;
        }
    }
    
    /**
     * ✅ 統一API: 全コンポーネント状態クリア
     */
    static clearAllComponentStates() {
        try {
            const count = this.monitoring.components.size;
            this.monitoring.components.clear();
            
            console.log('🗑️ 全コンポーネント状態クリア:', count + '件');
            
            // イベント通知
            if (window.EventBus) {
                window.EventBus.safeEmit('state.all.cleared', { count, timestamp: Date.now() });
            }
            
            return count;
            
        } catch (error) {
            console.error('❌ 全コンポーネント状態クリアエラー:', error);
            return 0;
        }
    }
    
    /**
     * ✅ デバッグ統計取得
     * @returns {Object} 統計情報
     */
    static getStats() {
        return {
            monitoring: {
                uptime: Math.round(performance.now() - this.monitoring.startTime),
                stateRequests: this.monitoring.stateRequests,
                lastUpdate: this.monitoring.lastUpdate,
                componentsTracked: this.monitoring.components.size
            },
            components: this.getAllComponentStates(),
            health: this.healthCheck(),
            timestamp: Date.now()
        };
    }
}

// ✅ グローバル公開（統一システム）
if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
}

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

// ✅ 統一システムデバッグコマンド
window.checkUnifiedSystemsHealth = () => {
    console.group('🏥 統一システム健全性チェック');
    
    const systems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
    const health = {};
    
    systems.forEach(system => {
        const systemObj = window[system];
        health[system] = {
            exists: !!systemObj,
            methods: systemObj ? Object.getOwnPropertyNames(systemObj.prototype || systemObj) : [],
            functional: testSystemBasicFunction(system)
        };
    });
    
    const allHealthy = systems.every(sys => health[sys].exists && health[sys].functional);
    
    console.log('📊 システム健全性:', allHealthy ? '✅ 正常' : '❌ 問題あり');
    console.log('📋 詳細:', health);
    console.groupEnd();
    
    return {
        allHealthy,
        systems: health,
        timestamp: Date.now()
    };
};

// システム基本機能テスト
function testSystemBasicFunction(systemName) {
    try {
        const system = window[systemName];
        if (!system) return false;
        
        switch (systemName) {
            case 'ConfigManager':
                return typeof system.get === 'function';
            case 'ErrorManager':
                return typeof system.showError === 'function';
            case 'StateManager':
                return typeof system.updateComponentState === 'function' &&
                       typeof system.getApplicationState === 'function' &&
                       typeof system.healthCheck === 'function';
            case 'EventBus':
                return typeof system.safeEmit === 'function';
            default:
                return true;
        }
    } catch (error) {
        return false;
    }
}

console.log('✅ StateManager 統一API版 初期化完了');
console.log('💡 使用例: StateManager.updateComponentState("toolManager", "initialized", data)');
console.log('💡 使用例: StateManager.getApplicationState() または window.getState()');
console.log('💡 使用例: window.checkUnifiedSystemsHealth() で統一システム確認');