# ペンUI責務移譲計画書（モジュール分割版v2.0）

## 1. 【重要】モジュール分割アーキテクチャ提案

### 現状の問題分析
- **drawing-tools.js**: 現在1400行超、STEP 6完了時には2000行を超える予想
- **SRP違反**: 描画ロジック + UI制御 + イベント処理が混在
- **保守性低下**: 単一ファイルへの機能集中によるバグ発生リスク増大

### 新アーキテクチャ: レイヤー分離設計

```
drawing-tools/                    # 新ディレクトリ構造
├── core/
│   ├── drawing-tools-system.js  # 統合システム（200行程度）
│   ├── tool-manager.js          # ツール管理（150行程度）
│   └── base-tool.js             # ベースツールクラス（100行程度）
├── tools/
│   ├── pen-tool.js              # ペンツール実装（200行程度）
│   ├── eraser-tool.js           # 消しゴムツール実装（150行程度）
│   └── [future-tools].js        # 将来ツール（レイヤー等）
└── ui/
    ├── pen-tool-ui.js           # ペンツール専用UI（300行程度）
    ├── tool-ui-base.js          # UI共通基盤（150行程度）
    └── components/
        ├── slider-manager.js    # スライダー制御（200行程度）
        ├── popup-manager.js     # ポップアップ制御（150行程度）
        └── preview-sync.js      # プレビュー連動（200行程度）
```

## 2. SOLID・DRY原則に基づくモジュール設計

### 単一責任原則（SRP）準拠設計

#### **core/drawing-tools-system.js**
**責任**: システム統合・API提供
- 各モジュールの初期化・依存注入
- main.js向けAPI提供
- システム全体の状態管理

#### **core/tool-manager.js** 
**責任**: ツール切り替え・管理
- ツール登録・切り替えロジック
- アクティブツール状態管理
- ツール間共通処理

#### **tools/pen-tool.js**
**責任**: ペン描画ロジックのみ
- ベクター描画処理
- スムージング機能
- パス生成・管理

#### **ui/pen-tool-ui.js**
**責任**: ペンツール専用UI制御
- PenToolUIクラス
- ツール固有のUI状態管理
- 描画システムとUI間の橋渡し

#### **ui/components/slider-manager.js**
**責任**: スライダー機能のみ
- 全ツール共通のスライダー制御
- 値検証・変換機能
- スライダーイベント処理

### オープン・クローズ原則（OCP）準拠設計

#### **base-tool.js**: 拡張可能な基盤
```javascript
// 新ツール追加時の拡張例
class LayerTool extends BaseTool {
    // レイヤー機能固有の実装
    // UI制御は tools/ui/layer-tool-ui.js に分離
}
```

#### **tool-ui-base.js**: UI共通基盤
```javascript
// ツール固有UI拡張可能
class ToolUIBase {
    // 共通UI処理（スライダー、ポップアップ等）
    // 各ツールUIが継承・拡張
}
```

### 依存関係逆転原則（DIP）準拠設計

#### インターフェース分離
```javascript
// core/interfaces.js
const IToolUI = {
    init: () => Promise,
    updateSettings: (settings) => void,
    destroy: () => void
};

const ITool = {
    activate: () => void,
    deactivate: () => void,
    onPointerDown: (x, y, event) => void
};
```

## 3. 段階的移譲計画（モジュール分割版）

### STEP 2完了時点での分割実行

#### STEP 2.5: 緊急モジュール分割（新規挿入）
**目標**: drawing-tools.jsの肥大化回避・基盤モジュール分離

##### 実施内容
1. **ディレクトリ構造作成**
```
drawing-tools/
├── core/
├── tools/  
└── ui/components/
```

2. **基盤クラス分離**
   - `BaseTool` → `drawing-tools/core/base-tool.js`
   - `ToolManager` → `drawing-tools/core/tool-manager.js`

3. **ツール実装分離**
   - `VectorPenTool` → `drawing-tools/tools/pen-tool.js`
   - `EraserTool` → `drawing-tools/tools/eraser-tool.js`

4. **UI制御分離**
   - `PenToolUI` → `drawing-tools/ui/pen-tool-ui.js`
   - スライダー制御 → `drawing-tools/ui/components/slider-manager.js`

5. **統合システム再構築**
   - `DrawingToolsSystem` → `drawing-tools/core/drawing-tools-system.js`
   - モジュール間依存注入システム構築

##### 期待成果物
- drawing-tools.js: 1400行 → 200行（インポート・エクスポートのみ）
- 各モジュール: 100-300行の適切なサイズ
- 将来拡張への完璧な基盤

### STEP 3: プレビュー連動機能移譲（モジュール分割版）
**移譲先**: `drawing-tools/ui/components/preview-sync.js`

### STEP 4: ポップアップ制御移譲（モジュール分割版）  
**移譲先**: `drawing-tools/ui/components/popup-manager.js`

### STEP 5: イベント処理移譲（モジュール分割版）
**統合先**: 各UI専用モジュールに分散配置

### STEP 6: 最終統合・最適化（モジュール分割版）
**目標**: 全モジュールの依存関係最適化・パフォーマンス確保

## 4. モジュール分割の具体設計

### **core/drawing-tools-system.js**
```javascript
/**
 * 統合描画ツールシステム
 * 責任: システム統合・API提供・依存注入
 */
import { ToolManager } from './tool-manager.js';
import { PenTool } from '../tools/pen-tool.js';
import { PenToolUI } from '../ui/pen-tool-ui.js';

export class DrawingToolsSystem {
    constructor(app) {
        this.app = app;
        this.toolManager = null;
        this.toolUIs = new Map();
    }
    
    async init() {
        // モジュール初期化・依存注入
        this.toolManager = new ToolManager(this.app);
        
        // ツール登録
        await this.registerTool('pen', PenTool, PenToolUI);
    }
    
    async registerTool(name, ToolClass, UIClass) {
        const tool = new ToolClass(this.app);
        const ui = new UIClass(this, tool);
        
        this.toolManager.registerTool(name, tool);
        this.toolUIs.set(name, ui);
        
        await ui.init();
    }
}
```

### **ui/pen-tool-ui.js**
```javascript
/**
 * ペンツール専用UI制御
 * 責任: ペンツールのUI制御のみ
 */
import { SliderManager } from './components/slider-manager.js';
import { PreviewSync } from './components/preview-sync.js';
import { ToolUIBase } from './tool-ui-base.js';

export class PenToolUI extends ToolUIBase {
    constructor(drawingSystem, penTool) {
        super(drawingSystem, penTool);
        this.sliderManager = null;
        this.previewSync = null;
    }
    
    async init() {
        this.sliderManager = new SliderManager(this);
        this.previewSync = new PreviewSync(this);
        
        await this.sliderManager.initPenSliders();
        await this.previewSync.init();
    }
}
```

### **ui/components/slider-manager.js**
```javascript
/**
 * スライダー制御マネージャー
 * 責任: スライダー機能のみ
 */
export class SliderManager {
    constructor(toolUI) {
        this.toolUI = toolUI;
        this.sliders = new Map();
    }
    
    async initPenSliders() {
        this.createSlider('pen-size-slider', /* ... */);
        this.createSlider('pen-opacity-slider', /* ... */);
    }
    
    // 他ツール用のスライダーも拡張可能
    async initEraserSliders() { /* ... */ }
    async initLayerSliders() { /* ... */ }
}
```

## 5. 移譲効果の比較

### Before（単一ファイル構成）
- drawing-tools.js: 2000行予想（STEP 6完了時）
- 保守性: ❌ 低い
- 拡張性: ❌ 困難
- バグリスク: ❌ 高い

### After（モジュール分割構成）  
- 最大モジュール: 300行以下
- 保守性: ✅ 高い
- 拡張性: ✅ 容易
- バグリスク: ✅ 低い

### 具体的改善指標
- **ファイルサイズ**: 2000行 → 最大300行/ファイル
- **責任分離**: 1ファイル5責任 → 1ファイル1責任
- **新ツール追加**: 1ファイル修正必要 → 新ファイル作成のみ
- **テスト容易性**: モノリシックテスト → モジュール単体テスト

## 6. 段階的実行スケジュール（修正版）

### 🚨 STEP 2.5 (緊急): モジュール分割基盤構築
- **期間**: 即座実行
- **目標**: drawing-tools.js肥大化の即座回避
- **成果物**: モジュール化された基盤システム

### STEP 3-6: 既存計画をモジュール分割版で実行
- 各機能を適切なモジュールに配置
- モジュール間インターフェース確立
- 依存関係の最適化

## 7. 品質保証（モジュール分割版）

### モジュール単体テスト
```javascript
// testing/unit/
├── core/
│   ├── drawing-tools-system.test.js
│   └── tool-manager.test.js
├── tools/
│   └── pen-tool.test.js
└── ui/
    ├── pen-tool-ui.test.js
    └── components/
        ├── slider-manager.test.js
        └── preview-sync.test.js
```

### 統合テスト
- モジュール間連携テスト
- パフォーマンスリグレッションテスト
- メモリリーク検出テスト

## 8. 期待される長期効果

### 設計品質向上
- **SOLID原則完全準拠**: 各モジュールが単一責任
- **DRY原則徹底**: 共通機能の適切な抽象化
- **保守性大幅向上**: 修正影響範囲の限定

### 開発効率向上  
- **新ツール追加**: レイヤー等の実装が容易
- **機能拡張**: 既存モジュールへの影響最小
- **バグ修正**: 責任範囲が明確で原因特定容易

### システム安定性向上
- **モジュール独立性**: 1モジュールの障害が全体に波及しない
- **テスト容易性**: 単体テスト・統合テストの充実
- **パフォーマンス**: モジュール単位での最適化可能

---

**このモジュール分割版計画に基づいてSTEP 2.5（緊急モジュール分割）から開始しますか？**