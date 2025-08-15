/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: PixiJS Application管理・基盤システム・拡張統合・キャンバス制御
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/main.js
 * 🎯 NODE_MODULES: pixi.js（Application, Graphics, Container）
 * 🎯 PIXI_EXTENSIONS: layers, ui（利用可能時）
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能（PIXIアプリ単独動作確認）
 * 🎯 SPLIT_THRESHOLD: 300行以下維持（基盤システムのため適切サイズ保持）
 * 📋 PHASE_TARGET: Phase1.1
 * 📋 V8_MIGRATION: await PIXI.Application.init() API対応予定
 */

console.log('🏗️ PixiJS基盤管理システム読み込み開始...');

// ==== PixiJS基盤管理システム ====
class AppCore {
    constructor() {
        this.app = null;
        this.viewport = null;
        this.initialized = false;
        
        // 基盤設定
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6, // ふたばクリーム
                antialias: true,
                resolution: 1, // v8移行: devicePixelRatio対応予定
                autoDensity: false
            },
            performance: {
                targetFPS: 60,
                maxFPS: 120 // 📋 V8_MIGRATION: 120FPS対応予定
            }
        };
        
        // コンテナ管理
        this.containers = new Map();
        
        // イベント管理
        this.eventHandlers = new Map();
    }
    
    /**
     * PixiJS基盤初期化
     * Application作成・コンテナセットアップ・拡張統合
     */
    async initialize() {
        console.group('🎨 PixiJS基盤システム初期化');
        
        try {
            // Step1: PixiJS Application作成
            await this.createApplication();
            
            // Step2: 基盤コンテナセットアップ
            this.setupContainers();
            
            // Step3: 拡張ライブラリ統合
            this.integrateExtensions();
            
            // Step4: イベントシステムセットアップ
            this.setupEventSystem();
            
            // Step5: 初期化完了処理
            this.completeInitialization();
            
            console.log('✅ PixiJS基盤システム初期化完了');
            console.groupEnd();
            
        } catch (error) {
            console.error('❌ PixiJS基盤初期化エラー:', error);
            console.groupEnd();
            throw error;
        }
    }
    
    /**
     * PixiJS Application作成
     * v7対応・v8移行準備・設定最適化
     */
    async createApplication() {
        console.log('🖼️ PixiJS Application作成中...');
        
        try {
            // 📋 V8_MIGRATION: v8移行時の処理分岐
            if (this.isPixiV8()) {
                // v8: await PIXI.Application.init() 方式
                // this.app = await PIXI.Application.init(this.config.canvas);
                console.log('🔄 PixiJS v8検出 - v8方式での初期化準備中...');
                throw new Error('PixiJS v8は Phase4 で対応予定です');
            } else {
                // v7: new PIXI.Application() 方式
                this.app = new PIXI.Application(this.config.canvas);
            }
            
            console.log(`✅ PixiJS Application作成完了 - v${PIXI.VERSION}`);
            console.log(`📏 キャンバスサイズ: ${this.config.canvas.width}×${this.config.canvas.height}`);
            
            // キャンバスDOM統合
            this.attachToDOM();
            
        } catch (error) {
            console.error('❌ PixiJS Application作成失敗:', error);
            throw error;
        }
    }
    
    /**
     * キャンバスDOM統合
     * HTML要素への追加・スタイル適用
     */
    attachToDOM() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナ #drawing-canvas が見つかりません');
        }
        
        // 既存canvasがあれば削除
        while (canvasContainer.firstChild) {
            canvasContainer.removeChild(canvasContainer.firstChild);
        }
        
        // PIXIキャンバス追加
        canvasContainer.appendChild(this.app.view);
        
        // キャンバススタイル設定
        this.app.view.style.display = 'block';
        this.app.view.style.cursor = 'crosshair';
        
        console.log('✅ キャンバスDOM統合完了');
    }
    
    /**
     * 基盤コンテナセットアップ
     * レイヤー構造・描画順序管理
     */
    setupContainers() {
        console.log('📦 基盤コンテナセットアップ中...');
        
        // 基本レイヤー構造作成
        const layers = [
            { name: 'background', zIndex: 0 },
            { name: 'drawing', zIndex: 1 },
            { name: 'ui', zIndex: 2 },
            { name: 'overlay', zIndex: 3 }
        ];
        
        layers.forEach(layerConfig => {
            const container = this.createContainer(layerConfig.name);
            container.zIndex = layerConfig.zIndex;
            container.sortableChildren = true;
            
            this.app.stage.addChild(container);
            this.containers.set(layerConfig.name, container);
            
            console.log(`📁 ${layerConfig.name}レイヤー作成 (zIndex: ${layerConfig.zIndex})`);
        });
        
        // ソート有効化
        this.app.stage.sortableChildren = true;
        
        console.log('✅ 基盤コンテナセットアップ完了');
    }
    
    /**
     * コンテナ作成
     * @pixi/layers使用時は高度機能、フォールバック時は基本Container
     */
    createContainer(name) {
        const extensions = window.PixiExtensions;
        
        if (extensions && extensions.hasFeature('layers')) {
            // @pixi/layers使用
            const Layer = extensions.getComponent('layers', 'Layer');
            if (Layer) {
                console.log(`🎯 ${name}: @pixi/layers.Layer使用`);
                return new Layer();
            }
        }
        
        // フォールバック: 基本Container
        console.log(`📦 ${name}: 基本Container使用`);
        return new PIXI.Container();
    }
    
    /**
     * 拡張ライブラリ統合
     * 利用可能な拡張機能の統合・設定
     */
    integrateExtensions() {
        console.log('🔧 拡張ライブラリ統合中...');
        
        const extensions = window.PixiExtensions;
        if (!extensions) {
            console.warn('⚠️ PixiExtensions が利用できません - 基本機能のみ使用');
            return;
        }
        
        // @pixi/layers統合
        if (extensions.hasFeature('layers')) {
            this.setupAdvancedLayers();
        }
        
        // @pixi/ui統合
        if (extensions.hasFeature('ui')) {
            this.setupAdvancedUI();
        }
        
        console.log('✅ 拡張ライブラリ統合完了');
    }
    
    /**
     * 高度レイヤー機能セットアップ
     * @pixi/layers使用時の追加機能
     */
    setupAdvancedLayers() {
        const extensions = window.PixiExtensions;
        const Group = extensions.getComponent('layers', 'Group');
        
        if (Group) {
            // レイヤーグループ作成
            this.layerGroups = {
                background: new Group(0),
                drawing: new Group(1),
                ui: new Group(2),
                overlay: new Group(3)
            };
            
            // グループとコンテナ関連付け
            this.containers.forEach((container, name) => {
                if (this.layerGroups[name]) {
                    container.group = this.layerGroups[name];
                }
            });
            
            console.log('🎯 @pixi/layers高度機能セットアップ完了');
        }
    }
    
    /**
     * 高度UI機能セットアップ
     * @pixi/ui使用時の追加機能
     */
    setupAdvancedUI() {
        // UI拡張機能は managers/ui-manager.js で詳細実装予定
        console.log('🎛️ @pixi/ui統合準備完了 - UIManager連携待機中');
    }
    
    /**
     * イベントシステムセットアップ
     * 基本マウス・タッチイベント・座標変換
     */
    setupEventSystem() {
        console.log('🎯 イベントシステムセットアップ中...');
        
        // ステージインタラクティブ設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(
            0, 0, this.config.canvas.width, this.config.canvas.height
        );
        
        // 基本イベントハンドラー設定
        this.setupBasicEvents();
        
        // 座標変換ヘルパー設定
        this.setupCoordinateSystem();
        
        console.log('✅ イベントシステムセットアップ完了');
    }
    
    /**
     * 基本イベントハンドラー設定
     * pointer系イベント・座標更新
     */
    setupBasicEvents() {
        // ポインター移動イベント
        this.app.stage.on('pointermove', (event) => {
            const localPos = this.getLocalPosition(event);
            this.updateCoordinateDisplay(localPos.x, localPos.y);
        });
        
        // ポインタ開始イベント
        this.app.stage.on('pointerdown', (event) => {
            const localPos = this.getLocalPosition(event);
            this.dispatchCustomEvent('canvasPointerDown', { position: localPos, originalEvent: event });
        });
        
        // ポインタ移動中イベント
        this.app.stage.on('pointermove', (event) => {
            const localPos = this.getLocalPosition(event);
            this.dispatchCustomEvent('canvasPointerMove', { position: localPos, originalEvent: event });
        });
        
        // ポインタ終了イベント
        this.app.stage.on('pointerup', (event) => {
            const localPos = this.getLocalPosition(event);
            this.dispatchCustomEvent('canvasPointerUp', { position: localPos, originalEvent: event });
        });
        
        console.log('🖱️ 基本イベントハンドラー設定完了');
    }
    
    /**
     * 座標変換システムセットアップ
     * ローカル座標・スクリーン座標変換
     */
    setupCoordinateSystem() {
        this.coordinateHelper = {
            screenToLocal: (screenX, screenY) => {
                const rect = this.app.view.getBoundingClientRect();
                const localX = (screenX - rect.left) * (this.config.canvas.width / rect.width);
                const localY = (screenY - rect.top) * (this.config.canvas.height / rect.height);
                return { x: localX, y: localY };
            },
            
            localToScreen: (localX, localY) => {
                const rect = this.app.view.getBoundingClientRect();
                const screenX = (localX / this.config.canvas.width) * rect.width + rect.left;
                const screenY = (localY / this.config.canvas.height) * rect.height + rect.top;
                return { x: screenX, y: screenY };
            }
        };
    }
    
    /**
     * ローカル座標取得ヘルパー
     * PIXIイベントからローカル座標取得
     */
    getLocalPosition(event) {
        const originalEvent = event.data?.originalEvent || event.originalEvent || event;
        
        if (originalEvent.clientX !== undefined && originalEvent.clientY !== undefined) {
            return this.coordinateHelper.screenToLocal(originalEvent.clientX, originalEvent.clientY);
        }
        
        // PIXIイベントの場合
        return event.data?.getLocalPosition(this.app.stage) || { x: 0, y: 0 };
    }
    
    /**
     * 座標表示更新
     * ステータスパネル更新
     */
    updateCoordinateDisplay(x, y) {
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * カスタムイベント発行
     * 他システムへの通知・疎結合連携
     */
    dispatchCustomEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }
    
    /**
     * 初期化完了処理
     * 統計表示・レディ状態設定
     */
    completeInitialization() {
        this.initialized = true;
        
        // キャンバス情報表示更新
        this.updateCanvasInfo();
        
        // 基盤システム統計
        console.log('📊 基盤システム統計:');
        console.log(`  📏 キャンバス: ${this.config.canvas.width}×${this.config.canvas.height}`);
        console.log(`  📦 コンテナ: ${this.containers.size}層`);
        console.log(`  🎯 ターゲットFPS: ${this.config.performance.targetFPS}`);
        console.log(`  🔧 拡張統合: ${window.PixiExtensions.getStats().coverage}`);
        
        // レディイベント発行
        this.dispatchCustomEvent('appCoreReady', { 
            appCore: this,
            config: this.config,
            containers: Array.from(this.containers.keys())
        });
    }
    
    /**
     * キャンバス情報表示更新
     * ステータスパネル情報更新
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${this.config.canvas.width}×${this.config.canvas.height}px`;
        }
    }
    
    // ==== 外部API群 ====
    
    /**
     * コンテナ取得
     * 外部からの安全なコンテナアクセス
     */
    getContainer(name) {
        return this.containers.get(name) || null;
    }
    
    /**
     * 描画コンテナ取得
     * 描画ツールからのアクセス用
     */
    getDrawingContainer() {
        return this.getContainer('drawing');
    }
    
    /**
     * UIコンテナ取得
     * UI要素からのアクセス用
     */
    getUIContainer() {
        return this.getContainer('ui');
    }
    
    /**
     * キャンバスリサイズ
     * 動的サイズ変更・中央寄せ対応
     */
    resizeCanvas(newWidth, newHeight, centerContent = false) {
        console.log(`🔄 キャンバスリサイズ: ${newWidth}×${newHeight} (中央寄せ: ${centerContent})`);
        
        const oldWidth = this.config.canvas.width;
        const oldHeight = this.config.canvas.height;
        
        // 設定更新
        this.config.canvas.width = newWidth;
        this.config.canvas.height = newHeight;
        
        // PIXIアプリケーションリサイズ
        this.app.renderer.resize(newWidth, newHeight);
        
        // ヒットエリア更新
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // 中央寄せ処理
        if (centerContent) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            // 描画コンテンツを中央に移動
            const drawingContainer = this.getDrawingContainer();
            if (drawingContainer && (offsetX !== 0 || offsetY !== 0)) {
                drawingContainer.position.x += offsetX;
                drawingContainer.position.y += offsetY;
            }
        }
        
        // 表示情報更新
        this.updateCanvasInfo();
        
        // リサイズイベント発行
        this.dispatchCustomEvent('canvasResized', {
            oldSize: { width: oldWidth, height: oldHeight },
            newSize: { width: newWidth, height: newHeight },
            centerContent
        });
        
        console.log('✅ キャンバスリサイズ完了');
    }
    
    /**
     * グラフィック要素追加
     * 描画ツールからの安全な追加
     */
    addToDrawing(graphics, layer = 'drawing') {
        const container = this.getContainer(layer);
        if (container && graphics) {
            container.addChild(graphics);
            return true;
        }
        return false;
    }
    
    /**
     * グラフィック要素削除
     * 安全な削除・メモリクリーンアップ
     */
    removeFromDrawing(graphics, layer = 'drawing') {
        const container = this.getContainer(layer);
        if (container && graphics && container.children.includes(graphics)) {
            container.removeChild(graphics);
            return true;
        }
        return false;
    }
    
    /**
     * 全描画クリア
     * 全レイヤーのクリア・メモリ解放
     */
    clearDrawing() {
        console.log('🗑️ 描画クリア実行中...');
        
        const drawingContainer = this.getDrawingContainer();
        if (drawingContainer) {
            // 全子要素削除・メモリ解放
            while (drawingContainer.children.length > 0) {
                const child = drawingContainer.children[0];
                drawingContainer.removeChild(child);
                
                // Graphics要素の場合はdestroy呼び出し
                if (child.destroy && typeof child.destroy === 'function') {
                    child.destroy();
                }
            }
            
            console.log('✅ 描画クリア完了');
            
            // クリアイベント発行
            this.dispatchCustomEvent('drawingCleared', { container: drawingContainer });
        }
    }
    
    /**
     * システム統計取得
     * デバッグ・監視用統計情報
     */
    getSystemStats() {
        return {
            initialized: this.initialized,
            pixiVersion: PIXI.VERSION,
            canvasSize: {
                width: this.config.canvas.width,
                height: this.config.canvas.height
            },
            containers: Array.from(this.containers.keys()),
            containerChildren: Object.fromEntries(
                Array.from(this.containers.entries()).map([name, container] => [
                    name, 
                    container.children.length
                ])
            ),
            extensions: window.PixiExtensions.getStats(),
            performance: {
                targetFPS: this.config.performance.targetFPS,
                rendererType: this.app.renderer.type,
                context: this.app.renderer.gl ? 'WebGL' : 'Canvas'
            }
        };
    }
    
    // ==== 内部ヘルパーメソッド ====
    
    /**
     * PixiJS v8判定
     * バージョン確認・移行準備
     */
    isPixiV8() {
        return PIXI.VERSION && PIXI.VERSION.startsWith('8');
    }
    
    /**
     * デバッグ情報表示
     * 開発・AI分業時のデバッグ支援
     */
    debug() {
        console.group('🔍 AppCore デバッグ情報');
        
        const stats = this.getSystemStats();
        console.log('システム統計:', stats);
        
        console.log('コンテナ階層:');
        this.containers.forEach((container, name) => {
            console.log(`  📦 ${name}: ${container.children.length}子要素, zIndex: ${container.zIndex}`);
        });
        
        if (window.PixiExtensions) {
            console.log('拡張ライブラリ:', window.PixiExtensions.getAllLibraryDetails());
        }
        
        console.groupEnd();
    }
    
    /**
     * 破棄処理
     * リソース解放・イベントクリーンアップ
     */
    destroy() {
        console.log('🗑️ AppCore 破棄処理実行中...');
        
        // イベントハンドラー削除
        if (this.app && this.app.stage) {
            this.app.stage.removeAllListeners();
        }
        
        // 全コンテナクリア
        this.containers.forEach(container => {
            while (container.children.length > 0) {
                const child = container.children[0];
                container.removeChild(child);
                if (child.destroy && typeof child.destroy === 'function') {
                    child.destroy();
                }
            }
        });
        
        // PIXIアプリケーション破棄
        if (this.app) {
            this.app.destroy(true, true);
            this.app = null;
        }
        
        // 状態リセット
        this.initialized = false;
        this.containers.clear();
        
        console.log('✅ AppCore 破棄処理完了');
    }
}

// ==== グローバル公開 ====
// Pure JavaScript形式でグローバル公開（ESM禁止準拠）
window.AppCore = AppCore;

// ==== Phase1.1完了マーカー ====
console.log('✅ Phase1.1 STEP5: PixiJS基盤管理システム実装完了');
console.log('📊 機能概要:');
console.log('  🖼️ PixiJS Application管理・v8移行準備');
console.log('  📦 4層レイヤーシステム（background, drawing, ui, overlay）');
console.log('  🎯 イベントシステム・座標変換');
console.log('  🔧 拡張ライブラリ統合（@pixi/layers, @pixi/ui）');
console.log('  📏 動的リサイズ・中央寄せ対応');
console.log('  🗑️ メモリ管理・安全な破棄処理');
console.log('📋 次のステップ: js/managers/ui-manager.js UI統括システム実装');