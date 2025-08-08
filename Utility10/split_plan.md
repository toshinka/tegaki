# ふたば☆お絵描きツール 分割計画書 v1.0

## 📊 現状分析
- **総コードサイズ**: 約35KB
- **主要クラス**: 5クラス（DrawingEngine, ToolSystem, UIController, PerformanceMonitor, FutabaDrawingTool）
- **将来実装予定**: ペン機能拡充、レイヤー、ショートカット、他ツール群

## 🎯 分割戦略：3分割システム

### 1️⃣ **core-engine.js** (約8-10KB)
**役割**: 安定したコア機能・描画エンジン
**内容**:
- `DrawingEngine` クラス
- PIXI.js初期化・描画ロジック
- キャンバス操作・リサイズ機能
- パス管理・座標計算

**更新頻度**: 低（基盤部分）
**依存関係**: PIXI.js → core-engine.js

### 2️⃣ **ui-system.js** (約12-15KB)
**役割**: UI管理・設定パネル・イベント処理
**内容**:
- `UIController` クラス
- ポップアップ・スライダー・チェックボックス
- ドラッグ&ドロップ・レスポンシブ対応
- ステータス表示・プリセット管理

**更新頻度**: 中（UI改善・設定追加時）
**依存関係**: core-engine.js → ui-system.js

### 3️⃣ **tools-features.js** (約15-20KB)
**役割**: 動的機能・ツール実装・拡張機能
**内容**:
- `ToolSystem` クラス
- `PerformanceMonitor` クラス
- `FutabaDrawingTool` クラス（メインアプリ）
- ペン・消しゴムツール実装
- **将来追加**: レイヤーシステム、ショートカット、新ツール群

**更新頻度**: 高（機能追加・ツール拡充時）
**依存関係**: core-engine.js + ui-system.js → tools-features.js

## 📦 ファイル構成
```
futaba-drawing-tool/
├── index.html (メインHTML - 約3KB)
├── js/
│   ├── core-engine.js     (基盤エンジン)
│   ├── ui-system.js       (UI・設定)
│   └── tools-features.js  (ツール・機能)
└── css/
    └── styles.css (CSS分離 - 約8KB)
```

## 🔄 読み込み順序
```javascript
// index.html内
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
<script src="js/core-engine.js"></script>
<script src="js/ui-system.js"></script>
<script src="js/tools-features.js"></script>
```

## ✅ 分割の利点

### 開発効率
- **機能別開発**: ペン機能はtools-features.jsのみ編集
- **並行作業**: UI改善とツール開発を同時進行可能
- **デバッグ簡素化**: 問題箇所の特定が容易

### 保守性
- **責任分離**: 各ファイルが明確な役割を持つ
- **低結合**: 基盤部分(core-engine)の安定性確保
- **段階的テスト**: ファイル単位での動作確認

### 将来性
- **スケーラブル**: 新機能はtools-features.jsに集約
- **キャッシュ効率**: 変更の少ないcore-engine.jsはキャッシュされる
- **チーム開発**: ファイル別の担当制が可能

## 🎮 将来実装との相性

### レイヤーシステム
```javascript
// tools-features.js内に追加
class LayerSystem {
    constructor(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.layers = [];
    }
}
```

### ショートカットシステム
```javascript
// tools-features.js内に追加
class ShortcutManager {
    constructor(toolSystem, uiController) {
        this.toolSystem = toolSystem;
        this.uiController = uiController;
    }
}
```

### 新ツール群
```javascript
// tools-features.js内に追加
class ShapeTools extends ToolSystem {
    // 図形ツール
}

class TextTool extends ToolSystem {
    // テキストツール
}
```

## 📈 パフォーマンス考慮

### 初回読み込み
- **非同期読み込み**: defer属性でレンダリングブロックを防止
- **段階的初期化**: core → ui → tools の順で初期化

### 実行時
- **メモリ効率**: 各クラスのスコープ分離でメモリリーク防止
- **イベント最適化**: UI系イベントをui-system.jsに集約

## 🛠️ 実装ステップ

1. **CSS分離** (準備)
2. **core-engine.js作成** (基盤)
3. **ui-system.js作成** (UI)
4. **tools-features.js作成** (機能)
5. **index.html更新** (統合)
6. **動作テスト** (検証)

## 💡 推奨理由

**3分割が最適な理由**:
- **2分割**: 将来の機能追加でtools部分が肥大化
- **4分割**: 現段階では過剰、ファイル管理が複雑
- **3分割**: 機能と保守性のバランスが最適

この分割により、現在の35KBから将来100KB超の大規模ツールまで効率的にスケールできる基盤が構築されます。