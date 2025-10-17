// ===== ToolSizeManager初期化例 =====
// core-initializer.js や core-engine.js に追加する初期化コード

// 例1: core-initializer.js内での初期化
function initializeToolSizeManager() {
    const config = window.TEGAKI_CONFIG;
    const eventBus = window.TegakiEventBus;
    
    if (!config || !eventBus) {
        console.error('ToolSizeManager: config or eventBus not found');
        return null;
    }
    
    // ToolSizeManagerインスタンス生成
    const toolSizeManager = new window.ToolSizeManager(config, eventBus);
    
    // グローバル登録
    window.toolSizeManager = toolSizeManager;
    
    console.log('✅ ToolSizeManager initialized');
    
    return toolSizeManager;
}

// 例2: 既存のアプリケーション初期化フローへの統合
// core-engine.js の TegakiApp クラス内に追加する場合:
/*
class TegakiApp {
    constructor(config) {
        this.config = config;
        this.eventBus = window.TegakiEventBus;
        
        // ... 既存の初期化 ...
        
        // ToolSizeManager初期化
        this.toolSizeManager = new window.ToolSizeManager(config, this.eventBus);
        window.toolSizeManager = this.toolSizeManager; // グローバル登録
        
        // ... 他の初期化 ...
    }
}
*/

// 例3: index.htmlでの読み込み順序
/*
<!-- 必要なファイルを順番に読み込む -->
<script src="config.js"></script>
<script src="system/event-bus.js"></script>
<script src="system/tool-size-manager.js"></script>
<script src="ui/keyboard-handler.js"></script>

<script>
    // アプリケーション起動時の初期化
    document.addEventListener('DOMContentLoaded', () => {
        // EventBus初期化
        window.TegakiEventBus = new window.TegakiEventBusClass();
        
        // ToolSizeManager初期化
        window.toolSizeManager = new window.ToolSizeManager(
            window.TEGAKI_CONFIG,
            window.TegakiEventBus
        );
        
        // KeyboardHandler初期化
        window.KeyboardHandler.init();
        
        // ... 他の初期化 ...
    });
</script>
*/

// 例4: EventBus統合確認用のテストコード
function testToolSizeManager() {
    const toolSizeManager = window.toolSizeManager;
    const eventBus = window.TegakiEventBus;
    
    if (!toolSizeManager || !eventBus) {
        console.error('Test failed: toolSizeManager or eventBus not found');
        return;
    }
    
    console.log('=== ToolSizeManager Test ===');
    
    // 1. サイズスロット取得
    console.log('Size Slots:', toolSizeManager.getSizeSlots());
    
    // 2. 現在の設定取得
    console.log('Pen Settings:', toolSizeManager.getPenSettings());
    console.log('Eraser Settings:', toolSizeManager.getEraserSettings());
    
    // 3. スロット選択テスト
    eventBus.emit('tool:select-size-slot', { slot: 3 });
    console.log('After slot 3 selected:', toolSizeManager.getPenSettings());
    
    // 4. ドラッグシミュレーション
    eventBus.emit('tool:drag-size-start', {
        tool: 'pen',
        startSize: 10,
        startOpacity: 0.85
    });
    
    eventBus.emit('tool:drag-size-update', {
        tool: 'pen',
        deltaX: 50,  // 右に50ピクセル移動（サイズ+5）
        deltaY: 20   // 下に20ピクセル移動（透明度+0.1）
    });
    
    eventBus.emit('tool:drag-size-end');
    
    console.log('After drag:', toolSizeManager.getPenSettings());
    
    // 5. デバッグ情報
    console.log('Debug Info:', toolSizeManager.getDebugInfo());
    
    console.log('=== Test Complete ===');
}

// 例5: BrushSettingsとの連携確認
function verifyBrushSettingsIntegration() {
    const toolSizeManager = window.toolSizeManager;
    const drawingEngine = window.drawingApp?.drawingEngine;
    
    if (!toolSizeManager || !drawingEngine) {
        console.error('Verification failed: required components not found');
        return;
    }
    
    const brushSettings = drawingEngine.brushSettings;
    
    if (!brushSettings) {
        console.error('BrushSettings not found');
        return;
    }
    
    console.log('=== BrushSettings Integration Test ===');
    
    // 初期値を確認
    console.log('Initial BrushSettings:', {
        size: brushSettings.getBrushSize(),
        opacity: brushSettings.getBrushOpacity()
    });
    
    console.log('Initial ToolSizeManager:', toolSizeManager.getPenSettings());
    
    // ToolSizeManager経由でサイズ変更
    window.TegakiEventBus.emit('tool:drag-size-start', {
        tool: 'pen',
        startSize: brushSettings.getBrushSize(),
        startOpacity: brushSettings.getBrushOpacity()
    });
    
    window.TegakiEventBus.emit('tool:drag-size-update', {
        tool: 'pen',
        deltaX: 100,
        deltaY: 50
    });
    
    window.TegakiEventBus.emit('tool:drag-size-end');
    
    // 結果を確認（BrushSettingsとToolSizeManagerが同期しているか）
    console.log('After drag BrushSettings:', {
        size: brushSettings.getBrushSize(),
        opacity: brushSettings.getBrushOpacity()
    });
    
    console.log('After drag ToolSizeManager:', toolSizeManager.getPenSettings());
    
    console.log('=== Integration Test Complete ===');
}

// 例6: 完全な初期化シーケンス（core-initializer.js用）
class ToolSystemInitializer {
    static initialize(config, eventBus, drawingEngine) {
        if (!config || !eventBus || !drawingEngine) {
            throw new Error('ToolSystemInitializer: Missing required dependencies');
        }
        
        console.log('🔧 Initializing Tool System...');
        
        // 1. ToolSizeManager初期化
        const toolSizeManager = new window.ToolSizeManager(config, eventBus);
        window.toolSizeManager = toolSizeManager;
        console.log('  ✅ ToolSizeManager initialized');
        
        // 2. ToolSizeManagerとBrushSettingsの同期
        this.syncWithBrushSettings(toolSizeManager, drawingEngine);
        console.log('  ✅ Synced with BrushSettings');
        
        // 3. EventBusリスナー追加
        this.setupEventListeners(toolSizeManager, eventBus);
        console.log('  ✅ Event listeners configured');
        
        // 4. KeyboardHandler初期化
        if (window.KeyboardHandler) {
            window.KeyboardHandler.init();
            console.log('  ✅ KeyboardHandler initialized');
        }
        
        console.log('✅ Tool System initialization complete');
        
        return toolSizeManager;
    }
    
    static syncWithBrushSettings(toolSizeManager, drawingEngine) {
        const brushSettings = drawingEngine.brushSettings;
        const eraserSettings = drawingEngine.eraserBrushSettings;
        
        if (brushSettings) {
            // BrushSettingsの初期値をToolSizeManagerに反映
            toolSizeManager.penSize = brushSettings.getBrushSize();
            toolSizeManager.penOpacity = brushSettings.getBrushOpacity();
        }
        
        if (eraserSettings) {
            toolSizeManager.eraserSize = eraserSettings.getBrushSize();
            toolSizeManager.eraserOpacity = eraserSettings.getBrushOpacity();
        }
    }
    
    static setupEventListeners(toolSizeManager, eventBus) {
        // ツール切り替え時の処理
        eventBus.on('tool:select', ({ tool }) => {
            // 現在のツールに応じた設定を復元
            if (tool === 'pen') {
                const settings = toolSizeManager.getPenSettings();
                toolSizeManager.updateBrushSettings('pen', settings.size, settings.opacity);
            } else if (tool === 'eraser') {
                const settings = toolSizeManager.getEraserSettings();
                toolSizeManager.updateBrushSettings('eraser', settings.size, settings.opacity);
            }
        });
        
        // サイズ・透明度変更をUIに通知（将来のスライダー表示用）
        eventBus.on('tool:size-opacity-changed', ({ tool, size, opacity }) => {
            // UI更新処理（将来実装）
            // 例: スライダーの位置を更新、数値表示を更新など
        });
    }
}

// 使用例：core-initializer.jsまたはcore-engine.js内
/*
// アプリケーション初期化時に呼び出す
function initializeApplication() {
    const config = window.TEGAKI_CONFIG;
    const eventBus = new window.TegakiEventBusClass();
    window.TegakiEventBus = eventBus;
    
    // ... DrawingEngine等の初期化 ...
    const drawingEngine = new window.DrawingEngine(config, eventBus);
    
    // ツールシステム初期化
    const toolSizeManager = ToolSystemInitializer.initialize(
        config,
        eventBus,
        drawingEngine
    );
    
    // ... 残りの初期化 ...
}
*/

// 公開API
window.ToolSystemInitializer = ToolSystemInitializer;

console.log('✅ Tool System Initializer loaded');
console.log('   使用方法: ToolSystemInitializer.initialize(config, eventBus, drawingEngine)');