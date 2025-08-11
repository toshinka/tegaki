# ペンUI責務移譲計画書（STEP分割版）

## 1. 背景と現状分析

### 現在の問題点
- **ui-manager.js**が1200行以上の巨大ファイルとなり、ペンツール関連のUI責務（スライダー、ポップアップ機能等）が含まれている
- ペンツールのUI変更がui-manager.js全体に影響を与え、度々スライダーやポップアップ機能が破損する
- SRP（単一責任原則）に違反し、将来のレイヤー機能等の追加で更なる肥大化が予想される
- ツール固有のUI制御が汎用UIマネージャーに混在している

### 移譲方針
- **DRY原則**: 重複コードを排除し、共通化可能な部分は抽出
- **SOLID原則**: 各クラスの責任を明確化し、拡張性を向上
- **段階的移譲**: STEPごとに分割し、各段階で動作確認を行う
- **デバッグ機能強化**: 各システムの独立性を保ちながらデバッグを容易に

## 2. 対象ファイル分析

| ファイル名 | ペン関連責務 | 移譲対象の機能 | 参考情報ソース |
|-----------|-------------|--------------|--------------|
| ui-manager.js | ペンスライダー、ポップアップ制御、プリセット連携 | スライダー制御、プレビュー連動、設定同期 | メインファイル |
| ui/components.js | PenPresetManager、PresetDisplayManager | ライブ値管理、プレビュー更新機能 | コンポーネント定義 |
| ui/ui-events.js | ペン関連キーボードショートカット | イベント処理の一部をペンツールに移譲 | イベント処理システム |
| ui/PresetManager.js | プリセット管理全般 | プリセット制御をdrawing-tools.jsに統合 | プリセット専用システム |
| drawing-tools.js | 描画ロジック | UI制御機能を追加する移譲先 | 移譲先ファイル |

## 3. STEP分割移譲計画

### STEP 1: 基盤準備・分析フェーズ
**目標**: 移譲対象の詳細把握と基盤構造の準備

#### 改修対象ファイル
- **分析対象**: ui-manager.js, ui/components.js, ui/PresetManager.js
- **参考ファイル**: drawing-tools.js, config.js

#### 実施内容
1. **責務マッピング作成**
   - ui-manager.js内のペン関連コード特定（grep: "pen", "slider", "opacity"等）
   - 各関数の依存関係分析
   - グローバル変数・イベントリスナーの洗い出し

2. **drawing-tools.js基盤構造設計**
   - PenToolUIクラスの設計
   - existing drawing-tools.js へのUI責務統合方針策定
   - インターフェース設計（initUI, updateUI等のAPI）

3. **移譲方針詳細化**
   - 各STEPで移譲する具体的な関数・クラスの特定
   - 依存関係に基づく移譲順序の決定
   - エラーハンドリング方針の策定

#### 期待成果物
- 詳細な責務マッピング表
- drawing-tools.js拡張設計書
- 次STEPの実行計画

### STEP 2: ペンスライダー制御移譲
**目標**: ペンサイズ・透明度スライダー制御をdrawing-tools.jsに移譲

#### 改修対象ファイル
- **移譲元**: ui-manager.js（スライダー関連メソッド）
- **移譲先**: drawing-tools.js（PenToolUIクラス追加）
- **参考**: ui/components.js（SliderControllerクラス）

#### 実施内容
1. **PenToolUIクラス作成**
```javascript
// drawing-tools.js に追加
class PenToolUI {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.sliders = new Map();
    }
    
    initSliders() {
        // ui-manager.js から移譲したスライダー初期化コード
        this.createSlider('pen-size-slider', /* ... */);
        this.createSlider('pen-opacity-slider', /* ... */);
    }
}
```

2. **スライダー制御移譲**
   - `setupSliders()`, `createSlider()`, `updateSliderValue()` 等を移譲
   - SliderControllerインスタンス管理をPenToolUIに移管
   - イベントリスナー再設定

3. **main.js連携修正**
   - `drawingTools.initUI()` 呼び出し追加
   - `uiManager.initPenUI()` 削除

#### 期待成果物
- 動作するペンスライダー制御（ui-manager.js非依存）
- PenToolUIクラス基盤構造完成

### STEP 3: プレビュー連動機能移譲
**目標**: リアルタイムプレビュー機能をdrawing-tools.jsに統合

#### 改修対象ファイル
- **移譲元**: ui/components.js（PresetDisplayManager, PenPresetManager）
- **移譲先**: drawing-tools.js（PenToolUIクラス拡張）
- **参考**: ui-manager.js（プレビュー連動コード）

#### 実施内容
1. **プレビュー管理機能統合**
```javascript
// PenToolUIクラス拡張
class PenToolUI {
    initPreviewSystem() {
        this.presetDisplay = new PresetDisplayManager(this.drawingToolsSystem);
        this.penPresetManager = new PenPresetManager(this.drawingToolsSystem);
    }
    
    updatePreviewSync(size, opacity) {
        // 元ui-manager.js の updatePresetLiveValues() 機能
    }
}
```

2. **ライブ値管理移譲**
   - `updateActivePresetLive()` 機能移譲
   - プレビュー同期制御（`previewSyncEnabled`）移譲
   - リアルタイム更新のスロットリング制御移譲

3. **UI更新連携**
   - `updateAllDisplays()` のペン関連部分を分離
   - PenToolUIからの通知システム構築

#### 期待成果物
- 独立したペンプレビューシステム
- スライダー操作とプレビューのリアルタイム連動

### STEP 4: ポップアップ制御移譲
**目標**: ペン設定ポップアップの制御権をdrawing-tools.jsに移譲

#### 改修対象ファイル
- **移譲元**: ui-manager.js（ポップアップ制御部分）
- **移譲先**: drawing-tools.js（PenToolUIクラス拡張）
- **参考**: ui/components.js（PopupManagerクラス）

#### 実施内容
1. **ポップアップ制御統合**
```javascript
// PenToolUIクラス拡張
class PenToolUI {
    initPopupControl() {
        this.popupManager = new PopupManager();
        this.popupManager.registerPopup('pen-settings');
    }
    
    handleToolButtonClick() {
        // ペンツールボタンクリック時のポップアップ表示制御
    }
}
```

2. **ツールボタン連携**
   - ペンツールボタンクリック時の処理を移譲
   - ポップアップ表示/非表示ロジック移譲
   - ESCキーでの閉じる機能もPenToolUIで処理

3. **状態同期**
   - ポップアップ表示状態とツール状態の同期
   - 他ツール選択時のポップアップ自動閉じる機能

#### 期待成果物
- ペンツール専用のポップアップ制御システム
- ui-manager.js非依存でのポップアップ動作

### STEP 5: イベント処理移譲・統合
**目標**: ペン関連イベント処理を統合し、キーボードショートカット対応

#### 改修対象ファイル
- **移譲元**: ui/ui-events.js（ペン関連ショートカット）
- **移譲先**: drawing-tools.js（PenToolUIクラス拡張）
- **参考**: ui-manager.js（イベント処理）

#### 実施内容
1. **キーボードショートカット移譲**
```javascript
// PenToolUIクラス拡張
class PenToolUI {
    initKeyboardShortcuts() {
        // P+1, P+2 等のプリセット選択
        // ホイールでのサイズ変更
        // R キーでのリセット
    }
    
    handlePenSpecificEvents(event) {
        // ペンツール固有のイベント処理
    }
}
```

2. **イベントハンドリング統合**
   - ペンツール関連のキーボードショートカットを移譲
   - ホイールでのペンサイズ変更機能移譲
   - プリセットリセット（Rキー）処理移譲

3. **UI-Events連携**
   - UIEventSystemとの協調動作
   - コンテキスト認識（ペンツール選択時のみ有効化）

#### 期待成果物
- ペンツール専用のイベント処理システム
- 他ツールとの干渉のないショートカット動作

### STEP 6: 最終統合・テスト・最適化
**目標**: 全機能の統合確認とパフォーマンス最適化

#### 改修対象ファイル
- **最終検証**: drawing-tools.js（完成版PenToolUI）
- **クリーンアップ**: ui-manager.js（ペン関連コード除去）
- **参考**: 全ファイル（統合テスト）

#### 実施内容
1. **統合テスト実施**
   - 全ペンツール機能の動作確認
   - エラーケースでの安定性確認
   - パフォーマンステスト（メモリリーク確認等）

2. **ui-manager.jsクリーンアップ**
   - 移譲済みコードの削除
   - 空になったメソッドの除去
   - 依存関係の整理

3. **API最適化**
```javascript
// DrawingToolsSystemにAPI追加
class DrawingToolsSystem {
    getPenUI() {
        return this.penToolUI;
    }
    
    initUI() {
        return this.penToolUI.init();
    }
}
```

4. **ドキュメント・デバッグ強化**
   - 各システムの責任範囲明文化
   - デバッグ関数の充実
   - エラーハンドリング強化

#### 期待成果物
- 完全に独立したペンツールUIシステム
- ui-manager.jsの大幅スリム化（目標：600行以下）
- 将来拡張（レイヤー等）への基盤完成

## 4. 品質保証・検証方法

### 各STEPでの確認項目
1. **動作確認**
   - ペンサイズスライダーの正常動作
   - 透明度スライダーの正常動作
   - プレビューのリアルタイム更新
   - ポップアップの表示/非表示
   - キーボードショートカット動作

2. **非回帰テスト**
   - 既存機能への影響がないこと
   - 他ツール（消しゴム等）の正常動作
   - システム全体の安定性維持

3. **パフォーマンス確認**
   - メモリ使用量増加の確認
   - スライダー操作の応答性確認
   - ブラウザコンソールエラーの無いこと

### デバッグ体制
- 各STEPで専用デバッグ関数を実装
- window.debugPenUI() 等のグローバルデバッグ関数提供
- エラー発生時のGraceful Degradation実装

## 5. 期待される効果

### 即座の効果
- ペンツールUI修正時の影響範囲限定
- ui-manager.jsのサイズ削減（1200行→600行目標）
- バグ発生リスクの軽減

### 長期的効果
- レイヤー機能等の追加時の基盤整備
- 各ツール専用UIシステムのテンプレート確立
- 保守性・拡張性の大幅向上
- SOLID原則準拠による設計品質向上

## 6. リスク管理

### 主要リスク
- **統合時のバグ**: 段階的移譲により最小化
- **パフォーマンス劣化**: 各STEPでの測定により早期発見
- **既存機能破損**: 非回帰テストにより防止

### 緩和策
- 各STEPでのバックアップ作成
- 段階的rollback機能の準備
- 十分なテスト期間の確保

---

**この計画書に基づいてSTEP 1から順次実行していきますか？**