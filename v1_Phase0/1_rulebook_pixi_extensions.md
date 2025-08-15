# JavaScript + PixiJS v7→v8 Rulebook v3.1 - PixiJS拡張統合対応版

## 1. 基本理念（PixiJS拡張統合強化版）

### 1.1 核心方針
- **段階的品質向上**: v7完成→v8移行の安定的発展戦略
- **PixiJS拡張統合**: @pixi/ui・@pixi/layers等の拡張ライブラリ完全活用
- **fetch API分割**: HTML単体→モジュール分割の安定移行・CORS制限回避
- **非破壊的変形**: ベクターベース変形によるアニメ制作品質確保
- **実証済みライブラリ活用**: npmインストール確認済み拡張ライブラリの安全導入
- **AI協働開発**: 必要ファイルのみ添付での効率的開発・保守

### 1.2 実装原則（PixiJS拡張統合版）
- **SOLID・DRY原則徹底**: 単一責任・責務分離・重複コード排除
- **500行ファイル制限**: 超過時は機能別分割・依存関係最小化
- **拡張ライブラリファースト**: 独自実装前にPixiJS拡張ライブラリ採用検討
- **CDN活用+フォールバック**: CDN障害時の代替手段確保
- **非破壊品質保証**: アニメ制作における品質劣化完全防止

### 1.3 PixiJS拡張ライブラリ活用戦略
- **@pixi/ui統合**: 独自UI実装の完全代替・プロ級インターフェース実現
- **@pixi/layers統合**: 非破壊レイヤーシステム・アニメ制作対応
- **@pixi/gif統合**: 高品質GIFアニメーション制作環境
- **@pixi/text-bitmap統合**: 高速テキスト描画・UI性能向上
- **pixi-svg統合**: Tabler Iconsベクターアイコンシステム

---

## 2. ファイル構成ルール（PixiJS拡張統合版）

### 2.1 基本構成（拡張ライブラリ統合対応）
```
🎨 tegaki-fetch-extensions/
├─ index.html                     // 拡張ライブラリ統合・エントリーポイント
├─ css/
│  └─ styles.css                  // ふたば☆ちゃんねる風スタイル
├─ libs/                          // 拡張ライブラリ統合層
│  └─ pixi-extensions.js         // PixiJS拡張統合システム
├─ js/
│  ├─ main.js                     // アプリケーション初期化
│  ├─ app-core.js                 // PixiJS初期化・拡張統合基盤
│  ├─ managers/                   // 統括管理層
│  │  ├─ ui-manager.js           // UI系統括（@pixi/ui完全活用）
│  │  ├─ layer-manager.js        // レイヤー系統括（@pixi/layers活用）
│  │  ├─ tool-manager.js         // ツール系統括
│  │  ├─ canvas-manager.js       // キャンバス制御（pixi-viewport活用）
│  │  ├─ memory-manager.js       // 非破壊メモリ管理
│  │  └─ settings-manager.js     // 設定統括
│  ├─ tools/                     // 描画ツール群（AI分業対応）
│  │  ├─ pen-tool.js            // ペンツール
│  │  ├─ eraser-tool.js         // 消しゴムツール
│  │  ├─ bucket-tool.js         // バケツツール
│  │  └─ selection-tool.js      // 選択ツール
│  ├─ ui/                        // UI コンポーネント群（@pixi/ui統合）
│  │  ├─ popup-manager.js       // ポップアップ（@pixi/ui.FancyButton活用）
│  │  ├─ slider-manager.js      // スライダー（@pixi/ui.Slider活用）
│  │  └─ status-display.js      // ステータス表示
│  ├─ layers/                    // レイヤーシステム（@pixi/layers統合）
│  │  ├─ layer-core.js          // レイヤー機能（@pixi/layers活用）
│  │  └─ layer-ui.js           // レイヤーパネルUI
│  ├─ animation/                 // アニメーション機能（@pixi/gif統合）
│  │  ├─ gif-manager.js         // GIFアニメ（@pixi/gif活用）
│  │  └─ timeline-ui.js         // タイムライン
│  ├─ utils/                     // 共通ユーティリティ
│  │  ├─ coordinates.js         // 座標変換
│  │  ├─ performance.js         // パフォーマンス監視
│  │  └─ debug.js              // デバッグ支援
│  └─ migration/                 // v8移行準備（Phase4）
     ├─ v8-compatibility.js     // 互換性レイヤー
     └─ webgpu-preparation.js   // WebGPU準備
└─ assets/                      // 静的リソース
   └─ icons/                    // SVGアイコン（@tabler/icons活用）
```

### 2.2 PixiJS拡張ライブラリ統合（index.html）
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <!-- PixiJS拡張ライブラリ統合（実証済み構成） -->
    
    <!-- PixiJS v7 本体 -->
    <script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js"></script>
    
    <!-- @pixi/ui: UIコンポーネント（実証済みv1.2.4） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/ui@1.2.4/dist/ui.min.js"></script>
    
    <!-- @pixi/layers: レイヤーシステム（実証済みv2.1.0） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/layers@2.1.0/dist/pixi-layers.min.js"></script>
    
    <!-- @pixi/gif: GIFアニメ（実証済みv2.1.1） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/gif@2.1.1/dist/gif.min.js"></script>
    
    <!-- @pixi/text-bitmap: 高速テキスト（実証済みv7.4.3） -->
    <script src="https://cdn.jsdelivr.net/npm/@pixi/text-bitmap@7.4.3/dist/pixi-text-bitmap.min.js"></script>
    
    <!-- pixi-svg: SVG読み込み（実証済みv3.2.0） -->
    <script src="https://cdn.jsdelivr.net/npm/pixi-svg@3.2.0/dist/pixi-svg.min.js"></script>
    
    <!-- GSAP: アニメーション -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    
    <!-- Lodash: ユーティリティ -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
    
    <!-- Hammer.js: タッチジェスチャー -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
    
    <!-- PixiJS拡張統合システム -->
    <script src="libs/pixi-extensions.js"></script>
    
    <!-- アプリケーション本体（ESM回避・従来型読み込み） -->
    <script src="js/main.js"></script>
    
    <div id="app-root"></div>
</body>
</html>
```

### 2.3 拡張ライブラリ統合システム（libs/pixi-extensions.js）
**主責務**: CDN検証・拡張ライブラリ統合・フォールバック提供

**基本原則**:
- CDNライブラリ可用性検証
- グローバル統合オブジェクト提供
- フォールバック機能完備
- AI分業開発対応識別

### 2.4 従来型JavaScript読み込み（CORS制限回避）
```javascript
// ESM（type="module"）使用禁止 - CORS制限回避
// ❌ 禁止: <script type="module" src="js/main.js"></script>
// ✅ 推奨: <script src="js/main.js"></script>

// fetch API動的読み込みパターン
// js/main.js - エントリーポイント
class AppLoader {
    async init() {
        // 拡張ライブラリ統合確認
        if (!window.PixiExtensions) {
            throw new Error('PixiJS拡張統合システム読み込み失敗');
        }
        
        // 動的コンポーネント読み込み
        const components = await this.loadComponents([
            'js/app-core.js',
            'js/managers/ui-manager.js'
        ]);
        
        // アプリケーション初期化
        const app = new components.AppCore();
        await app.init();
    }
    
    async loadComponents(files) {
        // fetch API使用・ESM回避
        const components = {};
        for (const file of files) {
            const response = await fetch(file);
            const code = await response.text();
            // 動的実行・グローバル登録
            eval(code);
        }
        return window.TegakiComponents || {};
    }
}
```

---

## 3. PixiJS拡張ライブラリ活用ルール（実証済み構成）

### 3.1 @pixi/ui活用原則（実証済みv1.2.4）
```javascript
// ✅ 推奨: @pixi/ui使用（車輪の再発明防止）
const { FancyButton, Slider, CheckBox } = window.PixiExtensions.UI;

const penButton = new FancyButton({
    defaultView: createButtonTexture('#800000'),
    hoverView: createButtonTexture('#aa5a56'),
    pressedView: createButtonTexture('#cf9c97'),
    text: new PIXI.Text('ペンツール', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: 0xffffff
    })
});

// ❌ 禁止: 独自ボタン実装（@pixi/ui利用可能時）
```

### 3.2 @pixi/layers活用原則（実証済みv2.1.0）
```javascript
// ✅ 推奨: @pixi/layers使用（非破壊レイヤーシステム）
const { Layer, Group } = window.PixiExtensions.Layers;

const drawingLayer = new Layer();
drawingLayer.group = new Group(1, true); // zIndex: 1, sort: true

const backgroundLayer = new Layer();
backgroundLayer.group = new Group(0, false); // zIndex: 0, sort: false

// レイヤー順序制御
drawingLayer.group.zIndex = 2;

// ❌ 禁止: 独自レイヤー実装（@pixi/layers利用可能時）
```

### 3.3 @pixi/gif活用原則（実証済みv2.1.1）
```javascript
// ✅ 推奨: @pixi/gif使用（高品質GIFアニメ）
const { AnimatedGIF } = window.PixiExtensions.GIF;

const gifSprite = AnimatedGIF.fromFrames(frames);
gifSprite.animationSpeed = 0.5;
gifSprite.play();

// GIFエクスポート機能
const exportGIF = async () => {
    const gif = new AnimatedGIF();
    await gif.fromPixiFrames(animationFrames);
    return gif.exportAsBlob();
};

// ❌ 禁止: 独自GIF実装（@pixi/gif利用可能時）
```

### 3.4 拡張ライブラリ検証システム
```javascript
// libs/pixi-extensions.js - 統合検証システム
window.PixiExtensions = {
    // 拡張ライブラリ検証
    validateExtensions: function() {
        const required = {
            'PIXI': window.PIXI,
            'UI': window.PIXI_UI || window.UI,
            'Layers': window.PIXI.display?.Layer,
            'GIF': window.PIXI_GIF || window.GIF,
            'TextBitmap': window.PIXI.BitmapText,
            'SVG': window.PIXI_SVG || window.SVG
        };
        
        const results = {};
        for (const [name, lib] of Object.entries(required)) {
            results[name] = {
                available: !!lib,
                version: lib?.VERSION || 'unknown'
            };
        }
        
        return results;
    },
    
    // 統合アクセス提供
    get UI() {
        return window.PIXI_UI || window.UI || null;
    },
    
    get Layers() {
        return window.PIXI.display || null;
    },
    
    get GIF() {
        return window.PIXI_GIF || window.GIF || null;
    }
};
```

---

## 4. 非破壊的変形ルール（@pixi/layers統合強化）

### 4.1 レイヤーベース変形原則
```javascript
// js/layers/layer-core.js
class LayerCore {
    constructor() {
        this.layers = [];
        this.layerGroups = new Map();
    }
    
    createLayer(options = {}) {
        const { Layer, Group } = window.PixiExtensions.Layers;
        
        if (Layer && Group) {
            // @pixi/layers使用（推奨）
            const layer = new Layer();
            layer.group = new Group(options.zIndex || 0, true);
            layer.name = options.name || `Layer ${this.layers.length}`;
            
            // 非破壊変形対応
            layer.originalTransform = new PIXI.Matrix();
            layer.transformHistory = [];
            
            return layer;
        } else {
            // フォールバック: 通常コンテナ
            return this.createFallbackLayer(options);
        }
    }
    
    // 非破壊変形適用
    applyTransform(layer, transform) {
        // 変形履歴保存
        layer.transformHistory.push({
            before: layer.transform.clone(),
            transform: transform.clone(),
            timestamp: Date.now()
        });
        
        // 変形適用
        layer.transform.append(transform);
        
        // メモリ管理
        if (layer.transformHistory.length > 100) {
            layer.transformHistory.shift(); // 古い履歴削除
        }
    }
}
```

### 4.2 アニメ制作品質保証
- **フレーム品質**: @pixi/layersによるレイヤー品質保持
- **変形履歴**: 完全な変形履歴・アンドゥ対応
- **GIF出力品質**: @pixi/gifによる高品質出力

---

## 5. AI分業開発ルール（拡張ライブラリ対応）

### 5.1 拡張ライブラリ依存識別システム
```javascript
// 各ファイル先頭に拡張ライブラリ依存情報埋め込み
/**
 * 🎯 AI_WORK_SCOPE: UI管理専用ファイル
 * 🎯 DEPENDENCIES: main.js, app-core.js, libs/pixi-extensions.js
 * 🎯 PIXI_EXTENSIONS: @pixi/ui（必須）, @pixi/text-bitmap（推奨）
 * 🎯 CDN_FALLBACK: 独自UI実装あり
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → ui-components.js分割
 */
```

### 5.2 分業パターン定義（拡張ライブラリ考慮）
**UI改修パターン**:
```javascript
// UI改修時の必要ファイル
files: [
    'index.html',                    // CDN読み込み確認
    'libs/pixi-extensions.js',       // 拡張統合システム
    'js/main.js',                    // 初期化
    'js/app-core.js',               // PixiJS基盤
    'js/managers/ui-manager.js'     // UI統括（改修対象）
]
// 拡張ライブラリ: @pixi/ui必須、@pixi/text-bitmap推奨
```

**レイヤー改修パターン**:
```javascript
// レイヤー改修時の必要ファイル
files: [
    'index.html',                    // CDN読み込み確認
    'libs/pixi-extensions.js',       // 拡張統合システム
    'js/main.js',                    // 初期化
    'js/app-core.js',               // PixiJS基盤
    'js/managers/layer-manager.js',  // レイヤー統括
    'js/layers/layer-core.js'       // レイヤー機能（改修対象）
]
// 拡張ライブラリ: @pixi/layers必須
```

---

## 6. パフォーマンス・品質保証ルール（拡張ライブラリ活用）

### 6.1 拡張ライブラリ活用最適化
```javascript
// js/utils/performance.js
class PerformanceMonitor {
    constructor() {
        this.extensions = window.PixiExtensions;
        this.metrics = {};
    }
    
    measureExtensionPerformance() {
        // @pixi/ui使用時の性能測定
        if (this.extensions.UI?.available) {
            this.metrics.uiComponentCount = document.querySelectorAll('.pixi-ui-component').length;
            this.metrics.uiRenderTime = this.measureUIRenderTime();
        }
        
        // @pixi/layers使用時の性能測定
        if (this.extensions.Layers?.available) {
            this.metrics.layerCount = this.countActiveLayers();
            this.metrics.layerRenderTime = this.measureLayerRenderTime();
        }
        
        return this.metrics;
    }
    
    optimizeExtensionUsage() {
        // @pixi/text-bitmap最適化
        if (this.extensions.TextBitmap?.available) {
            PIXI.BitmapFont.from('ui-font', {
                fontFamily: 'system-ui',
                fontSize: 12,
                fill: 0x800000
            });
        }
        
        // @pixi/layers最適化
        if (this.extensions.Layers?.available) {
            // レイヤーグループ最適化
            this.optimizeLayerGroups();
        }
    }
}
```

### 6.2 非破壊品質検証（拡張ライブラリ統合）
```javascript
class QualityAssurance {
    validateNonDestructiveTransforms() {
        // @pixi/layers使用時の品質検証
        if (window.PixiExtensions.Layers?.available) {
            return this.validateLayerTransforms();
        } else {
            return this.validateContainerTransforms();
        }
    }
    
    validateGIFExportQuality() {
        // @pixi/gif使用時の品質検証
        if (window.PixiExtensions.GIF?.available) {
            return this.validateGIFQuality();
        } else {
            return this.validateCanvasGIFQuality();
        }
    }
}
```

---

## 7. エラーハンドリング・フォールバック戦略

### 7.1 CDN障害対応
```javascript
// libs/pixi-extensions.js - CDN障害検出・フォールバック
class CDNFallbackSystem {
    async validateCDNLibraries() {
        const cdnTests = [
            { name: 'PIXI', test: () => !!window.PIXI },
            { name: 'PIXI_UI', test: () => !!window.PIXI_UI },
            { name: 'PIXI_LAYERS', test: () => !!window.PIXI.display?.Layer },
            { name: 'PIXI_GIF', test: () => !!window.PIXI_GIF },
        ];
        
        const results = [];
        for (const cdn of cdnTests) {
            const available = cdn.test();
            results.push({ name: cdn.name, available });
            
            if (!available) {
                await this.loadFallback(cdn.name);
            }
        }
        
        return results;
    }
    
    async loadFallback(libraryName) {
        switch (libraryName) {
            case 'PIXI_UI':
                console.warn('@pixi/ui CDN失敗 - 独自UI実装に切り替え');
                window.PIXI_UI_FALLBACK = true;
                break;
            case 'PIXI_LAYERS':
                console.warn('@pixi/layers CDN失敗 - 通常コンテナに切り替え');
                window.PIXI_LAYERS_FALLBACK = true;
                break;
        }
    }
}
```

### 7.2 拡張ライブラリ非対応環境対応
```javascript
// 拡張ライブラリ非対応時の代替実装
class FallbackImplementation {
    createButton(options) {
        if (window.PixiExtensions.UI?.available) {
            // @pixi/ui使用
            return new window.PixiExtensions.UI.FancyButton(options);
        } else {
            // 独自実装フォールバック
            return this.createSimpleButton(options);
        }
    }
    
    createLayer(options) {
        if (window.PixiExtensions.Layers?.available) {
            // @pixi/layers使用
            const layer = new window.PixiExtensions.Layers.Layer();
            layer.group = new window.PixiExtensions.Layers.Group(options.zIndex);
            return layer;
        } else {
            // 通常コンテナフォールバック
            const container = new PIXI.Container();
            container.zIndex = options.zIndex || 0;
            return container;
        }
    }
}
```

---

## 8. Phase移行戦略（拡張ライブラリ統合対応）

### 8.1 Phase1: 拡張ライブラリ統合基盤（1-2週間）
**目標**: 既存HTML分割・拡張ライブラリ統合・CORS制限回避

**主要タスク**:
- HTML→fetch API分割（ESM回避）
- libs/pixi-extensions.js統合システム構築
- @pixi/ui・@pixi/layers・@pixi/gif統合
- CDN障害対応・フォールバック実装

### 8.2 Phase2: 拡張ライブラリ活用完成（2-3週間）
**目標**: @pixi拡張ライブラリフル活用・プロ級機能実現

**主要タスク**:
- @pixi/ui完全統合（ボタン・スライダー・ポップアップ）
- @pixi/layers完全統合（非破壊レイヤーシステム）
- @pixi/text-bitmap統合（高速UI）
- pixi-svg統合（Tablerアイコンシステム）

### 8.3 Phase3: アニメーション完成（2-3週間）
**目標**: @pixi/gif活用・高品質アニメ制作環境

**主要タスク**:
- @pixi/gif完全統合
- タイムラインUI（@pixi/ui活用）
- オニオンスキン機能
- 高品質GIFエクスポート

### 8.4 Phase4: v8移行（3-4週間）
**目標**: PixiJS v8移行・WebGPU・120FPS

**主要タスク**:
- v8互換性レイヤー
- WebGPU Renderer統合
- 120FPS最適化
- 拡張ライブラリv8対応

---

## 9. 禁止事項（拡張ライブラリ統合強化版）

### 9.1 基本禁止事項
- **拡張ライブラリ迂回**: 利用可能な@pixi拡張を無視した独自実装禁止
- **ESM使用**: type="module"使用によるCORS制限発生禁止
- **CDN単一依存**: CDN障害時の代替手段なし禁止
- **バージョン不整合**: package.json確認済みと異なるバージョン使用禁止

### 9.2 拡張ライブラリ固有禁止事項
- **@pixi/ui迂回**: FancyButton等利用可能時の独自ボタン実装禁止
- **@pixi/layers迂回**: Layer・Group利用可能時の独自レイヤー実装禁止
- **@pixi/gif迂回**: AnimatedGIF利用可能時の独自GIF実装禁止
- **拡張未検証使用**: PixiExtensions検証を経ない直接使用禁止

### 9.3 CORS・技術制限禁止事項
- **file://プロトコル依存**: ローカル開発でのESM・fetch制限無視禁止
- **サーバー要求**: 簡単なHTTPサーバー不要な過度な技術使用禁止
- **TypeScript混在**: 純JavaScript環境での型定義混在禁止

---

## 10. 品質保証・テストルール（拡張ライブラリ対応）

### 10.1 拡張ライブラリ統合テスト
```javascript
// 自動テスト例
describe('PixiJS拡張ライブラリ統合', () => {
    test('必須拡張ライブラリ読み込み確認', () => {
        expect(window.PIXI).toBeDefined();
        expect(window.PIXI_UI || window.UI).toBeDefined();
        expect(window.PIXI.display?.Layer).toBeDefined();
        expect(window.PIXI_GIF || window.GIF).toBeDefined();
    });
    
    test('PixiExtensions統合システム動作', () => {
        expect(window.PixiExtensions).toBeDefined();
        expect(window.PixiExtensions.validateExtensions).toBeFunction();
        
        const results = window.PixiExtensions.validateExtensions();
        expect(results.PIXI.available).toBe(true);
        expect(results.UI.available).toBe(true);
    });
    
    test('CDN障害時フォールバック動作', async () => {
        // CDN障害シミュレーション
        window.PIXI_UI = undefined;
        
        const fallback = new FallbackImplementation();
        const button = fallback.createButton({ text: 'テスト' });
        
        expect(button).toBeDefined();
        expect(button.interactive).toBe(true);
    });
});
```

### 10.2 非破壊変形品質テスト（@pixi/layers統合）
```javascript
describe('非破壊変形品質保証', () => {
    test('レイヤー変形履歴保持', () => {
        const layerCore = new LayerCore();
        const layer = layerCore.createLayer({ name: 'テストレイヤー' });
        
        // 変形適用
        const transform = new PIXI.Matrix();
        transform.rotate(Math.PI);
        layerCore.applyTransform(layer, transform);
        
        // 履歴確認
        expect(layer.transformHistory.length).toBe(1);
        expect(layer.transformHistory[0].transform.rotation).toBeCloseTo(Math.PI);
        
        // 元状態復元確認
        layer.transform.copyFrom(layer.originalTransform);
        expect(layer.transform.rotation).toBe(0);
    });
    
    test('@pixi/layers使用時の品質保持', () => {
        if (window.PixiExtensions.Layers?.available) {
            const layer = new window.PixiExtensions.Layers.Layer();
            layer.group = new window.PixiExtensions.Layers.Group(1);
            
            // グループ順序確認
            expect(layer.group.zIndex).toBe(1);
            
            // レイヤー独立性確認
            const graphics1 = new PIXI.Graphics();
            const graphics2 = new PIXI.Graphics();
            
            layer.addChild(graphics1);
            layer.addChild(graphics2);
            
            expect(layer.children.length).toBe(2);
            expect(graphics1.parent).toBe(layer);
        }
    });
});
```

### 10.3 AI分業開発効率テスト
```javascript
describe('AI分業開発効率', () => {
    test('最小構成ファイル特定', () => {
        const uiWorkScope = {
            required: [
                'index.html',
                'libs/pixi-extensions.js',
                'js/main.js',
                'js/app-core.js',
                'js/managers/ui-manager.js'
            ],
            optional: [
                'js/tools/pen-tool.js',
                'js/layers/layer-core.js'
            ]
        };
        
        expect(uiWorkScope.required.length).toBeLessThanOrEqual(5);
        expect(uiWorkScope.optional.length).toBeGreaterThan(0);
    });
    
    test('拡張ライブラリ依存識別', () => {
        const dependencies = extractPixiExtensionsDependencies('js/managers/ui-manager.js');
        
        expect(dependencies).toContain('@pixi/ui');
        expect(dependencies).toContain('@pixi/text-bitmap');
    });
});
```

---

## 11. 将来展望・技術発展方針（拡張ライブラリ完全活用）

### 11.1 拡張ライブラリエコシステム発展
- **Phase1完成**: @pixi/ui・@pixi/layers・@pixi/gif完全統合
- **Phase2発展**: @pixi/sound・@pixi/particle-emitter追加統合
- **Phase3拡張**: @pixi/spine・@pixi/basis追加統合
- **Phase4完成**: PixiJS v8対応・WebGPU・次世代拡張統合

### 11.2 AI協働開発パターン確立
- **拡張ライブラリ識別**: AI自動識別・最適提案システム
- **依存関係最小化**: 必要最小限ファイル自動抽出
- **品質保証自動化**: 拡張ライブラリ活用度測定・品質スコア
- **コミュニティ貢献**: 拡張統合パターンのオープンソース提供

---

## 12. 実装優先度・段階的導入戦略

### 12.1 高優先度拡張ライブラリ（Phase1必須）
1. **@pixi/ui v1.2.4**: UI革命・独自実装撤廃
2. **@pixi/layers v2.1.0**: 非破壊レイヤーシステム基盤
3. **libs/pixi-extensions.js**: 統合システム・フォールバック

### 12.2 中優先度拡張ライブラリ（Phase2推奨）
1. **@pixi/gif v2.1.1**: GIFアニメーション機能
2. **@pixi/text-bitmap v7.4.3**: UI高速化・テキスト最適化
3. **pixi-svg v3.2.0**: Tablerアイコンシステム

### 12.3 低優先度拡張ライブラリ（Phase3以降検討）
1. **@tabler/icons v3.34.1**: 豊富なアイコンセット
2. **GSAP・Lodash・Hammer.js**: 補助ライブラリ群

---

## 13. 運用・保守ルール（拡張ライブラリ対応）

### 13.1 拡張ライブラリ更新戦略
- **安定版採用**: LTSバージョン優先・メジャーアップデート慎重検討
- **後方互換性**: 既存機能影響を最小限に抑制
- **段階的更新**: 拡張ライブラリ1つずつ個別検証・更新
- **フォールバック維持**: 更新失敗時の即時復旧能力確保

### 13.2 AI協働開発運用
- **依存関係文書化**: 各ファイルの拡張ライブラリ依存明記
- **分業パターン標準化**: 典型的改修パターンのテンプレート化
- **品質チェックリスト**: 拡張ライブラリ活用度・品質基準明確化

---

## 14. バージョン管理・継続改善（拡張統合版）

### 14.1 拡張統合品質指標
- **Phase1**: 拡張ライブラリ統合率90%以上・CORS制限回避100%
- **Phase2**: @pixi拡張活用率95%以上・独自実装削減80%以上
- **Phase3**: アニメ品質保証・GIF出力品質向上50%
- **Phase4**: v8移行成功率100%・拡張ライブラリ完全対応

### 14.2 技術負債管理
- **独自実装削減**: @pixi拡張で代替可能な独自実装の段階的置換
- **拡張統合深化**: より高度な拡張ライブラリ機能の段階的導入
- **性能最適化**: 拡張ライブラリ組み合わせ最適化・ボトルネック解消

---

*🎨 JavaScript + PixiJS v7→v8 Rulebook v3.1 - PixiJS拡張統合対応版*  
*作成日: 2025年8月15日*  
*対応技術: PixiJS v7.4.3 + 拡張ライブラリ群, Fetch API, CORS制限回避*  
*基本理念: 拡張ライブラリファースト・AI協働開発最適化・段階的品質向上*  
*実証基盤: package.json確認済み拡張ライブラリ群（npmインストール済み）*