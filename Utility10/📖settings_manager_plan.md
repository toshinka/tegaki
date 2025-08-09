# 🎨 settings-manager.js 実装計画書

## 1. 概要

**実装対象**: settings-manager.js  
**バージョン**: v1.3  
**実装優先度**: 高（アンドゥ・リドゥの次に必要）

## 2. 主な責務

### 2.1 高DPI設定管理
- **動的解像度切り替え**: resolution値の1 ⇔ window.devicePixelRatio切り替え
- **設定UI**: 高DPIモードのON/OFF切り替えボタン
- **即座適用**: 設定変更時のPixiJSアプリケーション再初期化

### 2.2 ショートカットキー管理
- **ペンツール**: `P`キー
- **プリセット変更**: `P + [` (前のプリセット), `P + ]` (次のプリセット)
- **画面消去**: `DEL`キー
- **アンドゥ**: `Ctrl+Z` (既存)
- **リドゥ**: `Ctrl+Y` または `Ctrl+Shift+Z` (既存)
- **消しゴム**: `E`キー (既存)

### 2.3 ユーザー設定保存
- **LocalStorage連携**: 設定の永続化
- **設定項目**: 高DPIモード、ショートカット有効/無効
- **デフォルト値管理**: 初回起動時の設定

## 3. ファイル依存関係

### 3.1 改修対象ファイル
1. **app-core.js** - 高DPI設定適用のため
2. **ui-manager.js** - 設定UI追加のため
3. **history-manager.js** - 設定変更の履歴記録のため

### 3.2 参考ファイル
1. **高DPI設定について.txt** - 技術的実装方法
2. **🎨 1.プロジェクト計画書** - 機能仕様
3. **0.JavaScript+PixiJSv7_Rulebook.txt** - 実装ガイドライン

## 4. 実装詳細

### 4.1 設定項目定数
```javascript
const SETTINGS_CONFIG = {
    HIGH_DPI: 'highDpi',
    SHORTCUTS_ENABLED: 'shortcutsEnabled',
    AUTO_SAVE: 'autoSave'
};

const DEFAULT_SETTINGS = {
    highDpi: false,           // 初期は低DPIモード
    shortcutsEnabled: true,   // ショートカット有効
    autoSave: true           // 設定自動保存
};
```

### 4.2 ショートカット定義
```javascript
const SHORTCUT_KEYS = {
    PEN_TOOL: 'KeyP',
    PRESET_PREV: 'KeyP+BracketLeft',    // P + [
    PRESET_NEXT: 'KeyP+BracketRight',   // P + ]
    CLEAR_CANVAS: 'Delete',
    UNDO: 'KeyZ+CtrlLeft',
    REDO: 'KeyY+CtrlLeft',
    ERASER: 'KeyE'
};
```

### 4.3 高DPI設定適用方法
1. **app-core.js のCONFIG修正**
   ```javascript
   // settings-manager から取得するように変更
   RESOLUTION: settingsManager.isHighDpiEnabled() ? window.devicePixelRatio : 1,
   AUTO_DENSITY: settingsManager.isHighDpiEnabled()
   ```

2. **動的切り替え実装**
   - 設定変更時にPixiJSアプリケーションを再初期化
   - 描画内容を保持したままの切り替え

### 4.4 UI統合
- **設定ボタン**: 既存のサイドバーの設定アイコンを有効化
- **設定パネル**: ポップアップ形式の設定ダイアログ
- **高DPI切り替え**: チェックボックス形式
- **ショートカット表示**: 一覧表示

## 5. 改修ファイル詳細

### 5.1 app-core.js の改修
```javascript
// CONFIGの動的化
const CONFIG = {
    // ... 他の設定は不変
    get RESOLUTION() {
        return window.settingsManager?.isHighDpiEnabled() ? 
            window.devicePixelRatio : 1;
    },
    get AUTO_DENSITY() {
        return window.settingsManager?.isHighDpiEnabled() || false;
    }
};

// アプリケーション再初期化メソッド追加
async reinitializeWithSettings(newSettings) {
    // 現在の描画内容を保存
    // アプリケーション再作成
    // 描画内容を復元
}
```

### 5.2 ui-manager.js の改修
1. **settings-toolボタンの有効化**
2. **設定パネルの追加**
3. **ポップアップ管理にsettings-panelを追加**

### 5.3 history-manager.js の改修
- **HISTORY_TYPES.SETTINGS_CHANGE** 追加
- **設定変更の記録・復元メソッド** 追加

## 6. ショートカット実装詳細

### 6.1 キー組み合わせ判定
```javascript
class ShortcutHandler {
    constructor() {
        this.pressedKeys = new Set();
        this.keySequences = new Map();
    }
    
    handleKeyDown(event) {
        this.pressedKeys.add(event.code);
        this.checkShortcuts();
    }
    
    checkShortcuts() {
        // P + [ の判定
        if (this.pressedKeys.has('KeyP') && this.pressedKeys.has('BracketLeft')) {
            this.executePrevPreset();
        }
        // P + ] の判定  
        if (this.pressedKeys.has('KeyP') && this.pressedKeys.has('BracketRight')) {
            this.executeNextPreset();
        }
    }
}
```

### 6.2 プリセット変更連携
- **PenPresetManager との連携**: 前後のプリセット選択
- **履歴記録**: プリセット変更を履歴に記録
- **UI更新**: プリセット表示の同期

## 7. 実装手順

### Phase 1: 基本構造作成
1. **settings-manager.js** の骨格作成
2. **設定項目とデフォルト値** の定義
3. **LocalStorage連携** の実装

### Phase 2: 高DPI設定機能
1. **app-core.js** のCONFIG動的化
2. **アプリケーション再初期化** 機能
3. **設定UI** の作成

### Phase 3: ショートカット機能  
1. **キーボードイベント監視** の実装
2. **ショートカット判定ロジック** の作成
3. **各機能との連携** (ツール切り替え、プリセット変更等)

### Phase 4: 統合・テスト
1. **history-manager連携** の実装
2. **UI統合** と動作確認
3. **設定保存・復元** のテスト

## 8. 期待する成果物

### 8.1 新規ファイル
- **settings-manager.js** (完全新規作成)

### 8.2 更新ファイル
1. **app-core.js** - 高DPI設定対応
2. **ui-manager.js** - 設定UI追加  
3. **history-manager.js** - 設定変更履歴対応
4. **index.html** - 設定パネルHTML追加
5. **styles.css** - 設定パネルスタイル追加

### 8.3 機能確認項目
- [ ] 高DPIモードの動的切り替えが動作する
- [ ] P キーでペンツールに切り替わる
- [ ] P + [ / P + ] でプリセットが変更される
- [ ] DEL キーでキャンバスがクリアされる
- [ ] 設定がLocalStorageに保存される
- [ ] 設定変更がアンドゥ・リドゥされる

## 9. 将来拡張予定

### 9.1 設定項目の追加
- **カスタムショートカット**: ユーザー定義キー
- **自動保存間隔**: 設定可能な保存タイミング
- **UI表示設定**: パネル位置、透明度等

### 9.2 高度な機能
- **設定プロファイル**: 複数設定の切り替え
- **クラウド同期**: オンライン設定保存
- **プラグイン設定**: 将来のプラグインシステム連携

---

この計画書に基づき、まず **settings-manager.js** の新規作成を行い、続いて関連ファイルの改修を段階的に実施します。各フェーズでの動作確認を重視し、安定した機能拡張を目指します。