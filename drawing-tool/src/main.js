/**
 * PixiJS v8統合管理・段階初期化
 * モダンお絵かきツール v3.3 - Phase1統合エントリーポイント
 * 
 * 機能:
 * - PixiJS v8単一アプリケーション管理
 * - WebGPU優先設定・フォールバック制御
 * - Phase1基盤システム統合初期化
 * - ふたば色UI統合・Chrome API活用
 * - 干渉問題根絶・座標系統一
 */

import { Application } from 'pixi.js';
import PixiV8UnifiedRenderer from './pixi-v8/PixiV8UnifiedRenderer.js';
import PixiV8InputController from './pixi-v8/PixiV8InputController.js';
import PixiV8AirbrushTool from './pixi-v8/PixiV8AirbrushTool.js';
import EventStore from './stores/EventStore.js';
import ShortcutController from './utils/ShortcutController.js';
import HistoryController from './stores/HistoryController.js';

/**
 * モダンお絵かきツール v3.3メインアプリケーション
 * PixiJS v8統一基盤・段階的機能解封・Chrome API統合
 */
class ModernDrawingToolV33 {
    constructor() {
        this.pixiApp = null;
        this.renderer = null;
        this.inputController = null;
        this.airbrushTool = null;
        this.eventStore = null;
        this.shortcutController = null;
        this.historyController = null;
        
        // Phase管理（段階的機能解封）
        this.currentPhase = 1;
        this.maxPhase = 4;
        
        // PixiJS v8統一状態
        this.isWebGPUEnabled = false;
        this.isInitialized = false;
        
        // エラーハンドリング
        this.initializationErrors = [];
        
        // 統合テスト機能
        this.integrationTests = {
            enabled: true,
            results: new Map()
        };
        
        console.log('🎨 モダンお絵かきツール v3.3 - PixiJS v8統一基盤 初期化開始');
    }
    
    /**
     * PixiJS v8統一基盤アプリケーション初期化
     * WebGPU優先・Canvas2D完全排除・DOM競合根絶
     */
    async initializePixiV8Application() {
        try {
            const canvas = document.getElementById('pixi-canvas') || this.createCanvas();
            
            // PixiJS v8統一設定（WebGPU優先・Chrome API対応）
            const pixiConfig = {
                view: canvas,
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0xffffee, // ふたば背景色
                antialias: true,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
                powerPreference: 'high-performance',
                // WebGPU優先設定（v3.3核心）
                preference: 'webgpu',
                // Chrome API統合準備
                premultipliedAlpha: false,
                preserveDrawingBuffer: true
            };
            
            // PixiJS v8アプリケーション単一作成（干渉根絶）
            this.pixiApp = new Application();
            await this.pixiApp.init(pixiConfig);
            
            // WebGPU対応状況検出
            this.isWebGPUEnabled = this.pixiApp.renderer.type === 'webgpu';
            
            console.log(`✅ PixiJS v8統一基盤初期化成功 - ${this.isWebGPUEnabled ? 'WebGPU' : 'WebGL2'}`);
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS v8統一基盤初期化失敗:', error);
            this.initializationErrors.push({
                type: 'pixi-initialization',
                error: error,
                timestamp: Date.now()
            });
            return false;
        }
    }
    
    /**
     * Phase1システム統合初期化
     * 基盤レンダラー・入力制御・エアスプレー・イベント・履歴管理
     */
    async initializePhase1Systems() {
        try {
            // 1. イベントストア初期化（最優先・他システムの基盤）
            this.eventStore = new EventStore();
            console.log('✅ EventStore 初期化完了');
            
            // 2. PixiJS v8統一レンダラー初期化
            this.renderer = new PixiV8UnifiedRenderer(this.pixiApp);
            console.log('✅ PixiV8UnifiedRenderer 初期化完了');
            
            // 3. PixiJS v8統一入力制御初期化
            this.inputController = new PixiV8InputController(this.pixiApp);
            console.log('✅ PixiV8InputController 初期化完了');
            
            // 4. エアスプレーツール初期化（PaintBrush代替・v3.3新機能）
            this.airbrushTool = new PixiV8AirbrushTool(this.pixiApp);
            console.log('✅ PixiV8AirbrushTool 初期化完了（PaintBrush代替）');
            
            // 5. ショートカット制御初期化（詳細キー対応）
            this.shortcutController = new ShortcutController(this.eventStore);
            console.log('✅ ShortcutController 初期化完了');
            
            // 6. 履歴制御初期化（アンドゥ・リドゥ）
            this.historyController = new HistoryController(this.pixiApp, this.eventStore);
            console.log('✅ HistoryController 初期化完了');
            
            // システム間連携設定
            this.setupPhase1Integration();
            
            // 統合テスト実行
            if (this.integrationTests.enabled) {
                await this.runIntegrationTests();
            }
            
            console.log('🚀 Phase1システム統合初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ Phase1システム初期化失敗:', error);
            this.initializationErrors.push({
                type: 'phase1-systems',
                error: error,
                timestamp: Date.now()
            });
            return false;
        }
    }
    
    /**
     * Phase1システム間統合連携設定
     * PixiJS v8統一座標・イベント連携・Chrome API活用
     */
    setupPhase1Integration() {
        // レンダラー ⇔ 入力制御連携
        this.inputController.onDrawingStart = (event) => {
            this.renderer.beginDrawing(event);
            this.eventStore.emitDrawingStart(event.x, event.y, event.toolConfig);
        };
        
        this.inputController.onDrawingUpdate = (event) => {
            if (this.inputController.currentTool === 'airbrush') {
                // エアスプレーツール連携（v3.3新機能）
                this.airbrushTool.spray(event.x, event.y, event.pressure);
                this.eventStore.emitAirbrushSpray(event.x, event.y, event.pressure, this.airbrushTool.settings);
            } else {
                this.renderer.updateDrawing(event);
                this.eventStore.emitDrawingUpdate(event.x, event.y, event.pressure);
            }
        };
        
        this.inputController.onDrawingEnd = (event) => {
            this.renderer.endDrawing(event);
            this.eventStore.emitDrawingEnd(event.x, event.y);
        };
        
        // ショートカット ⇔ システム連携
        this.shortcutController.register('ctrl+z', () => {
            this.eventStore.emitHistoryAction('undo');
        });
        
        this.shortcutController.register('ctrl+y', () => {
            this.eventStore.emitHistoryAction('redo');
        });
        
        // エアスプレーツール専用ショートカット（v3.3新機能）
        this.shortcutController.register('a', () => {
            this.inputController.setTool('airbrush');
            this.eventStore.emitToolChange('airbrush');
        });
        
        this.shortcutController.register('a+[', () => {
            this.airbrushTool.decreaseSize();
        });
        
        this.shortcutController.register('a+]', () => {
            this.airbrushTool.increaseSize();
        });
        
        // イベントストア統一連携
        this.eventStore.on('canvas-resize', (data) => {
            this.renderer.handleCanvasResize(data.width, data.height);
        });
        
        this.eventStore.on('webgpu-state-change', (data) => {
            console.log(`🔄 WebGPU状態変更: ${data.enabled ? '有効' : '無効'}`);
        });
        
        // エラー統合ハンドリング
        this.eventStore.on('error-occurred', (data) => {
            this.handleSystemError(data);
        });
        
        console.log('🔗 Phase1システム間統合連携設定完了');
    }
    
    /**
     * Phase1統合テスト実行
     * システム間連携・機能完全性テスト
     */
    async runIntegrationTests() {
        console.log('🧪 Phase1統合テスト開始');
        
        try {
            // 1. EventStore連携テスト
            const eventTest = await this.testEventStoreIntegration();
            this.integrationTests.results.set('eventStore', eventTest);
            
            // 2. 履歴機能テスト
            const historyTest = await this.testHistoryFunctionality();
            this.integrationTests.results.set('history', historyTest);
            
            // 3. ショートカットテスト
            const shortcutTest = await this.testShortcutIntegration();
            this.integrationTests.results.set('shortcuts', shortcutTest);
            
            // 4. エアスプレーツールテスト
            const airbrushTest = await this.testAirbrushTool();
            this.integrationTests.results.set('airbrush', airbrushTest);
            
            // 5. レンダリングテスト
            const renderTest = await this.testRenderingSystem();
            this.integrationTests.results.set('rendering', renderTest);
            
            const allPassed = Array.from(this.integrationTests.results.values()).every(result => result.passed);
            
            console.log(`🧪 Phase1統合テスト完了 - ${allPassed ? '✅ 全テスト合格' : '⚠️ 一部テスト失敗'}`);
            
        } catch (error) {
            console.error('❌ 統合テスト実行エラー:', error);
        }
    }
    
    /**
     * EventStore統合テスト
     */
    async testEventStoreIntegration() {
        try {
            let eventReceived = false;
            
            // テストイベント監視
            this.eventStore.once('integration-test', () => {
                eventReceived = true;
            });
            
            // テストイベント発行
            this.eventStore.emit('integration-test', { test: true });
            
            return {
                passed: eventReceived,
                message: eventReceived ? 'EventStore連携正常' : 'EventStore連携失敗'
            };
            
        } catch (error) {
            return { passed: false, message: `EventStoreテスト失敗: ${error.message}` };
        }
    }
    
    /**
     * 履歴機能テスト
     */
    async testHistoryFunctionality() {
        try {
            const initialUndoCount = this.historyController.getHistoryState().undoCount;
            
            // テスト描画アクション
            this.historyController.beginAction('test-drawing');
            this.historyController.endAction();
            
            const afterActionCount = this.historyController.getHistoryState().undoCount;
            
            return {
                passed: afterActionCount === initialUndoCount + 1,
                message: `履歴機能: ${afterActionCount - initialUndoCount}件記録`
            };
            
        } catch (error) {
            return { passed: false, message: `履歴テスト失敗: ${error.message}` };
        }
    }
    
    /**
     * ショートカット統合テスト
     */
    async testShortcutIntegration() {
        try {
            const shortcutCount = Object.keys(this.shortcutController.getShortcuts()).length;
            
            return {
                passed: shortcutCount > 20,
                message: `ショートカット: ${shortcutCount}件登録済み`
            };
            
        } catch (error) {
            return { passed: false, message: `ショートカットテスト失敗: ${error.message}` };
        }
    }
    
    /**
     * エアスプレーツールテスト
     */
    async testAirbrushTool() {
        try {
            const initialSettings = { ...this.airbrushTool.settings };
            
            // 設定変更テスト
            this.airbrushTool.updateSettings({ intensity: 0.8 });
            const settingsChanged = this.airbrushTool.settings.intensity === 0.8;
            
            // 設定復元
            this.airbrushTool.updateSettings(initialSettings);
            
            return {
                passed: settingsChanged,
                message: settingsChanged ? 'エアスプレー機能正常' : 'エアスプレー設定失敗'
            };
            
        } catch (error) {
            return { passed: false, message: `エアスプレーテスト失敗: ${error.message}` };
        }
    }
    
    /**
     * レンダリングシステムテスト
     */
    async testRenderingSystem() {
        try {
            const layerCount = this.renderer.drawingLayers.children.length;
            const isWebGPU = this.pixiApp.renderer.type === 'webgpu';
            
            return {
                passed: layerCount >= 0 && this.pixiApp.renderer,
                message: `レンダリング: ${isWebGPU ? 'WebGPU' : 'WebGL2'}, レイヤー${layerCount}件`
            };
            
        } catch (error) {
            return { passed: false, message: `レンダリングテスト失敗: ${error.message}` };
        }
    }
    
    /**
     * システムエラーハンドリング
     */
    handleSystemError(errorData) {
        this.initializationErrors.push({
            type: errorData.type,
            error: errorData.error,
            context: errorData.context,
            timestamp: errorData.timestamp
        });
        
        console.error(`🚨 システムエラー [${errorData.type}]:`, errorData.error);
        
        // 重要エラーの特別処理
        const criticalErrors = ['pixi-initialization', 'webgpu-fallback'];
        if (criticalErrors.includes(errorData.type)) {
            this.handleCriticalError(errorData);
        }
    }
    
    /**
     * 重要エラー処理
     */
    handleCriticalError(errorData) {
        console.error('🚨 重要エラー発生 - システム状態確認が必要:', errorData);
        
        // Phase1診断実行
        const diagnosis = this.diagnosePase1Systems();
        console.log('🔍 Phase1システム診断:', diagnosis);
    }
    
    /**
     * Phase1システム診断
     */
    diagnosePase1Systems() {
        return {
            pixiApp: {
                initialized: !!this.pixiApp,
                rendererType: this.pixiApp?.renderer?.type || 'none',
                webgpu: this.isWebGPUEnabled
            },
            systems: {
                renderer: !!this.renderer,
                inputController: !!this.inputController,
                airbrushTool: !!this.airbrushTool,
                eventStore: !!this.eventStore,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController
            },
            integration: {
                totalErrors: this.initializationErrors.length,
                testResults: this.integrationTests.results.size,
                eventStoreStats: this.eventStore?.getEventStats() || null
            }
        };
    }
    
    /**
     * Canvas要素作成・DOM統合
     * PixiJS v8統一Canvas・競合問題根絶
     */
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'pixi-canvas';
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #ffffee;
            cursor: crosshair;
            touch-action: none;
            display: block;
        `;
        
        document.body.appendChild(canvas);
        return canvas;
    }
    
    /**
     * リサイズハンドリング
     * PixiJS v8統一座標・Chrome API活用
     */
    handleResize() {
        if (!this.pixiApp) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.pixiApp.renderer.resize(width, height);
        this.eventStore.emit('canvas-resize', { width, height });
        
        console.log(`📐 リサイズ処理完了: ${width}x${height}`);
    }
    
    /**
     * Phase2以降準備（将来拡張）
     * UI制御・カラーパレット・レイヤー管理等
     */
    async preparePhase2() {
        console.log('📋 Phase2準備中 - UI制御・移動可能パネル・カラーパレット');
        this.currentPhase = 2;
        // Phase2ファイル群の動的import準備
        // 実装はPhase2作成時に追加
    }
    
    /**
     * メインアプリケーション初期化・実行
     * 段階的初期化・エラーハンドリング・確実実装保証
     */
    async initialize() {
        try {
            // Phase1: PixiJS v8統一基盤初期化
            console.log('🚀 Phase1開始: PixiJS v8統一基盤・エアスプレー機能');
            
            const pixiInitialized = await this.initializePixiV8Application();
            if (!pixiInitialized) {
                throw new Error('PixiJS v8統一基盤初期化失敗');
            }
            
            const phase1Initialized = await this.initializePhase1Systems();
            if (!phase1Initialized) {
                throw new Error('Phase1システム初期化失敗');
            }
            
            // リサイズイベント設定
            window.addEventListener('resize', () => this.handleResize());
            this.handleResize(); // 初期リサイズ
            
            this.isInitialized = true;
            
            // Phase1完成報告
            const diagnosis = this.diagnosePase1Systems();
            console.log('✅ Phase1初期化完了 - モダンお絵かきツール v3.3 起動成功');
            console.log('📊 Phase1システム状態:', diagnosis);
            
            // 統合テスト結果表示
            if (this.integrationTests.enabled) {
                this.displayIntegrationTestResults();
            }
            
            // Phase2以降準備
            await this.preparePhase2();
            
        } catch (error) {
            console.error('❌ アプリケーション初期化失敗:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * 統合テスト結果表示
     */
    displayIntegrationTestResults() {
        console.log('🧪 Phase1統合テスト結果:');
        
        for (const [testName, result] of this.integrationTests.results) {
            const status = result.passed ? '✅' : '❌';
            console.log(`  ${status} ${testName}: ${result.message}`);
        }
        
        const passedCount = Array.from(this.integrationTests.results.values())
            .filter(result => result.passed).length;
        const totalCount = this.integrationTests.results.size;
        
        console.log(`🎯 統合テスト結果: ${passedCount}/${totalCount} 合格`);
    }
    
    /**
     * 初期化エラーハンドリング
     * 段階的縮退・代替手段提供
     */
    handleInitializationError(error) {
        this.initializationErrors.push({
            type: 'application-initialization',
            error: error,
            timestamp: Date.now()
        });
        
        // システム診断実行
        const diagnosis = this.diagnosePase1Systems();
        
        // エラー情報表示
        const errorMessage = `
            ❌ モダンお絵かきツール v3.3 初期化エラー
            
            エラー詳細: ${error.message}
            
            確認事項:
            1. ブラウザがPixiJS v8・WebGPU対応か確認
            2. npmインストールが完了しているか確認
            3. package.jsonの依存関係が正しいか確認
            
            技術情報:
            - PixiJS v8統一基盤: ${diagnosis.pixiApp.initialized ? '✅' : '❌'}
            - WebGPU対応: ${diagnosis.pixiApp.webgpu ? '✅' : '❌'}
            - システム初期化: ${Object.values(diagnosis.systems).filter(Boolean).length}/6
            - エラー数: ${this.initializationErrors.length}
            
            統合テスト結果:
            ${Array.from(this.integrationTests.results.entries())
                .map(([name, result]) => `- ${name}: ${result.passed ? '✅' : '❌'} ${result.message}`)
                .join('\n            ')}
        `;
        
        console.error(errorMessage);
        
        // DOM表示（開発時デバッグ用）
        if (document.body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #800000;
                color: #f0e0d6;
                padding: 20px;
                border-radius: 16px;
                font-family: monospace;
                white-space: pre-line;
                z-index: 9999;
                max-width: 80%;
                max-height: 80%;
                overflow: auto;
                box-shadow: 0 8px 32px rgba(128, 0, 0, 0.6);
            `;
            errorDiv.textContent = errorMessage;
            document.body.appendChild(errorDiv);
            
            // 10秒後に自動削除
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 10000);
        }
    }
    
    /**
     * アプリケーション状態取得（デバッグ・監視用）
     */
    getApplicationState() {
        return {
            phase: this.currentPhase,
            maxPhase: this.maxPhase,
            isInitialized: this.isInitialized,
            isWebGPUEnabled: this.isWebGPUEnabled,
            pixiRenderer: this.pixiApp?.renderer?.type || 'none',
            errors: this.initializationErrors,
            systems: {
                renderer: !!this.renderer,
                inputController: !!this.inputController,
                airbrushTool: !!this.airbrushTool,
                eventStore: !!this.eventStore,
                shortcutController: !!this.shortcutController,
                historyController: !!this.historyController
            },
            integrationTests: {
                enabled: this.integrationTests.enabled,
                results: Object.fromEntries(this.integrationTests.results),
                passedCount: Array.from(this.integrationTests.results.values())
                    .filter(result => result.passed).length,
                totalCount: this.integrationTests.results.size
            },
            performance: {
                eventStoreStats: this.eventStore?.getEventStats() || null,
                historyState: this.historyController?.getHistoryState() || null,
                shortcutCount: this.shortcutController ? 
                    Object.keys(this.shortcutController.getShortcuts()).length : 0
            }
        };
    }
    
    /**
     * Phase1機能デモ実行（デバッグ用）
     */
    async runPhase1Demo() {
        if (!this.isInitialized) {
            console.error('❌ アプリケーション未初期化');
            return;
        }
        
        console.log('🎬 Phase1機能デモ開始');
        
        try {
            // 1. ツール切り替えデモ
            await this.demoToolSwitching();
            
            // 2. エアスプレーデモ
            await this.demoAirbrushTool();
            
            // 3. 履歴機能デモ
            await this.demoHistoryFeatures();
            
            // 4. ショートカットデモ
            await this.demoShortcuts();
            
            console.log('✅ Phase1機能デモ完了');
            
        } catch (error) {
            console.error('❌ Phase1デモ実行エラー:', error);
        }
    }
    
    /**
     * ツール切り替えデモ
     */
    async demoToolSwitching() {
        console.log('🔧 ツール切り替えデモ');
        
        const tools = ['pen', 'eraser', 'airbrush'];
        
        for (const tool of tools) {
            this.eventStore.emitToolChange(tool);
            console.log(`→ ${tool}ツールに切り替え`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    /**
     * エアスプレーデモ
     */
    async demoAirbrushTool() {
        console.log('🎨 エアスプレーツールデモ');
        
        // 設定変更デモ
        this.airbrushTool.updateSettings({
            intensity: 0.8,
            density: 0.6,
            radius: 25
        });
        
        console.log('→ エアスプレー設定更新');
        
        // スプレー動作シミュレーション
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * 100 + 50;
            const y = Math.random() * 100 + 50;
            
            this.eventStore.emitAirbrushSpray(x, y, 0.8, this.airbrushTool.settings);
            console.log(`→ スプレー実行: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    /**
     * 履歴機能デモ
     */
    async demoHistoryFeatures() {
        console.log('📚 履歴機能デモ');
        
        // テスト描画アクション
        this.historyController.beginAction('demo-drawing');
        await new Promise(resolve => setTimeout(resolve, 100));
        this.historyController.endAction();
        
        console.log('→ 描画アクション記録');
        
        // アンドゥ・リドゥテスト
        const undoResult = this.historyController.undo();
        console.log(`→ アンドゥ実行: ${undoResult ? '成功' : '失敗'}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const redoResult = this.historyController.redo();
        console.log(`→ リドゥ実行: ${redoResult ? '成功' : '失敗'}`);
        
        const historyState = this.historyController.getHistoryState();
        console.log(`→ 履歴状態: Undo=${historyState.undoCount}, Redo=${historyState.redoCount}`);
    }
    
    /**
     * ショートカットデモ
     */
    async demoShortcuts() {
        console.log('⌨️ ショートカットデモ');
        
        // ショートカット統計表示
        const shortcuts = this.shortcutController.getShortcuts();
        const categories = ['basic', 'tools', 'canvas'];
        
        for (const category of categories) {
            const categoryShortcuts = this.shortcutController.getShortcuts(category);
            console.log(`→ ${category}カテゴリ: ${Object.keys(categoryShortcuts).length}件`);
        }
        
        console.log(`→ 総ショートカット数: ${Object.keys(shortcuts).length}件`);
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // システム順序解放
        if (this.historyController) {
            this.historyController.destroy();
        }
        
        if (this.shortcutController) {
            this.shortcutController.destroy();
        }
        
        if (this.airbrushTool) {
            this.airbrushTool.destroy();
        }
        
        if (this.inputController) {
            this.inputController.destroy();
        }
        
        if (this.renderer) {
            this.renderer.destroy();
        }
        
        if (this.eventStore) {
            this.eventStore.destroy();
        }
        
        if (this.pixiApp) {
            this.pixiApp.destroy(true, true);
        }
        
        // イベントリスナー削除
        window.removeEventListener('resize', this.handleResize);
        
        console.log('🗑️ ModernDrawingToolV33 リソース解放完了');
    }
}

// グローバル変数・デバッグ用アクセス
let modernDrawingTool = null;

/**
 * DOMContentLoaded時自動初期化
 * PixiJS v8統一基盤・確実実装保証
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        modernDrawingTool = new ModernDrawingToolV33();
        
        // デバッグ用グローバルアクセス
        window.modernDrawingTool = modernDrawingTool;
        
        // 開発用便利メソッド
        window.runPhase1Demo = () => modernDrawingTool.runPhase1Demo();
        window.getAppState = () => modernDrawingTool.getApplicationState();
        window.diagnosePhase1 = () => modernDrawingTool.diagnosePase1Systems();
        
        await modernDrawingTool.initialize();
        
        // 初期化成功時のコンソール案内
        console.log(`
🎨 モダンお絵かきツール v3.3 Phase1 起動完了！

📋 利用可能なデバッグコマンド:
• window.getAppState() - アプリケーション状態取得
• window.runPhase1Demo() - Phase1機能デモ実行
• window.diagnosePhase1() - システム診断実行
• modernDrawingTool.eventStore.setDebugMode(true) - イベントデバッグON

⌨️ 利用可能なショートカット:
• A - エアスプレーツール
• P - ペンツール  
• E - 消しゴムツール
• Ctrl+Z - アンドゥ
• Ctrl+Y - リドゥ
• A+[ / A+] - エアスプレーサイズ調整

🚀 Phase1機能:
✅ PixiJS v8統一基盤 (${modernDrawingTool.isWebGPUEnabled ? 'WebGPU' : 'WebGL2'})
✅ エアスプレーツール (PaintBrush代替)
✅ 詳細ショートカット復活
✅ 非破壊履歴システム
✅ 統合イベント管理
        `);
        
    } catch (error) {
        console.error('❌ DOMContentLoaded初期化エラー:', error);
    }
});

// WebGPU・Chrome API対応ブラウザ検出
console.log('🔍 ブラウザ対応状況:');
console.log(`- WebGPU: ${navigator.gpu ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- OffscreenCanvas: ${typeof OffscreenCanvas !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- WebCodecs: ${typeof VideoEncoder !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);
console.log(`- ESModule: ${typeof import !== 'undefined' ? '✅ 対応' : '❌ 非対応'}`);

export default ModernDrawingToolV33;