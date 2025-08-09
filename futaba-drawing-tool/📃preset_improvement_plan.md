# ペンプリセットUI改修・履歴管理実装計画書

## 1. 概要

この計画書では、以下の2つの主要改修を行います：

### 🎯 主要改修項目
1. （実施済）**プリセット視覚表示の改善** - アクティブ状態を四角い枠で表示
2. **プリセット変更の永続化** - 変更内容をプリセットに保存
3. **履歴管理システムの実装** - アンドゥ・リドゥ機能の追加

## 2. 視覚表示改善（優先度：高）（実施済）

### A. 現在の問題（実施済）
- アクティブプリセットが#800000で塗りつぶされるため、サイズ変化が見づらい
- プレビュー円の境界が不明確


### B. 改修方針（実施済）
- アクティブ状態は **CSS の border プロパティ** で四角い枠を表示
- プレビュー円は常に元の色（透明度反映）で表示
- 枠の色は#800000を使用

### C. 実装内容（実施済）

#### CSS 修正（styles.css）
```css
/* アクティブプリセットのスタイル */
.size-preset-item.active {
    border: 2px solid #007acc !important;
    border-radius: 4px;
    background-color: rgba(0, 122, 204, 0.1);
}

.size-preset-item {
    border: 2px solid transparent;
    transition: border-color 0.2s ease, background-color 0.2s ease;
}

/* ホバー効果も追加 */
.size-preset-item:hover:not(.active) {
    border-color: #ccc;
    background-color: rgba(0, 0, 0, 0.05);
}
```

#### PresetDisplayManager の修正（ui-manager.js）
- `updatePresetsDisplay()` メソッドでアクティブクラスのみ制御
- 円の色は常にプリセット本来の色を使用

## 3. プリセット変更永続化（優先度：高）

### A. 現在の問題
- ライブプレビューの変更がプリセットに保存されない
- スライダー操作後に他のプリセットを選択すると変更が失われる

### B. 改修方針
- **「変更を確定」ボタン** をペン設定UI に追加
- ボタン押下時にライブ値を実際のプリセットデータに保存
- 自動保存オプション（設定で ON/OFF 切り替え可能）

### C. 実装内容

#### HTML 修正（index.html）
ペン設定ポップアップに確定ボタンを追加：

```html
<div class="setting-group">
    <div class="preset-actions">
        <button id="save-preset-changes" class="action-button primary">変更を保存</button>
        <button id="reset-preset-changes" class="action-button secondary">リセット</button>
    </div>
</div>
```

#### PenPresetManager の拡張（drawing-tools.js）
```javascript
// プリセット保存機能を追加
saveLiveChangesToPreset() {
    if (!this.activePresetId || !this.currentLiveValues) return false;
    
    const activePreset = this.presets.get(this.activePresetId);
    if (!activePreset) return false;
    
    // ライブ値をプリセットに反映
    activePreset.size = this.currentLiveValues.size;
    activePreset.opacity = this.currentLiveValues.opacity;
    activePreset.color = this.currentLiveValues.color;
    
    // ライブ値をクリア
    this.currentLiveValues = null;
    
    console.log('💾 プリセット変更保存:', this.activePresetId, activePreset);
    return true;
}

// プリセットリセット機能
resetActivePreset() {
    if (!this.activePresetId) return false;
    
    // デフォルト値に戻す
    const defaultPresets = this.getDefaultPresets();
    const defaultPreset = defaultPresets.find(p => p.id === this.activePresetId);
    
    if (defaultPreset) {
        this.presets.set(this.activePresetId, { ...defaultPreset });
        this.currentLiveValues = null;
        return true;
    }
    return false;
}
```

## 4. 履歴管理システムの実装（優先度：中）

### A. 新ファイル: history-manager.js

履歴管理は複雑な機能のため、専用ファイルを作成します。

#### ファイル構成の変更
```
futaba-drawing-tool/
├── app-core.js           （既存）
├── drawing-tools.js      （既存・拡張）
├── ui-manager.js         （既存・拡張）
├── history-manager.js    （新規作成）
└── main.js              （既存・拡張）
```

#### history-manager.js の設計

```javascript
/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.8
 * 履歴管理システム - history-manager.js
 * 
 * 責務: アンドゥ・リドゥ・履歴管理
 * 依存: app-core.js, drawing-tools.js
 */

class HistoryManager {
    constructor(app, maxHistorySize = 50) {
        this.app = app;
        this.maxHistorySize = maxHistorySize;
        this.history = [];
        this.currentIndex = -1;
        this.isRecording = true;
    }
    
    // 履歴記録の種類
    static HISTORY_TYPES = {
        DRAWING: 'drawing',           // 描画操作
        PRESET_CHANGE: 'preset_change', // プリセット変更
        CANVAS_RESIZE: 'canvas_resize', // キャンバスリサイズ
        TOOL_CHANGE: 'tool_change'    // ツール変更
    };
    
    // 履歴エントリを記録
    recordHistory(type, data, preview = null) {
        if (!this.isRecording) return;
        
        const historyEntry = {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            type: type,
            data: data,
            preview: preview, // サムネイル画像データ
        };
        
        // 現在位置より後の履歴を削除
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // 新しい履歴を追加
        this.history.push(historyEntry);
        this.currentIndex++;
        
        // 最大サイズを超えた場合は古い履歴を削除
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }
        
        console.log(`📚 履歴記録: ${type}`, historyEntry);
    }
    
    // アンドゥ実行
    undo() {
        if (!this.canUndo()) return false;
        
        const currentEntry = this.history[this.currentIndex];
        this.currentIndex--;
        
        return this.applyHistoryEntry(currentEntry, 'undo');
    }
    
    // リドゥ実行
    redo() {
        if (!this.canRedo()) return false;
        
        this.currentIndex++;
        const nextEntry = this.history[this.currentIndex];
        
        return this.applyHistoryEntry(nextEntry, 'redo');
    }
    
    // 履歴エントリの適用
    applyHistoryEntry(entry, direction) {
        this.isRecording = false; // 適用中は記録しない
        
        try {
            switch (entry.type) {
                case HistoryManager.HISTORY_TYPES.PRESET_CHANGE:
                    return this.applyPresetChange(entry, direction);
                    
                case HistoryManager.HISTORY_TYPES.DRAWING:
                    return this.applyDrawingChange(entry, direction);
                    
                // 他のタイプの処理...
            }
        } finally {
            this.isRecording = true; // 記録を再開
        }
        
        return false;
    }
    
    // プリセット変更の適用
    applyPresetChange(entry, direction) {
        const { presetId, before, after } = entry.data;
        const targetData = direction === 'undo' ? before : after;
        
        // PenPresetManager にアクセスして適用
        const toolsSystem = this.app.getToolsSystem();
        const presetManager = toolsSystem.getPenPresetManager();
        
        return presetManager.applyPresetData(presetId, targetData);
    }
}
```

### B. 既存ファイルとの統合

#### DrawingToolsSystem の拡張（drawing-tools.js）
```javascript
class DrawingToolsSystem {
    constructor(app) {
        // 既存のコンストラクター内容...
        this.historyManager = new HistoryManager(app); // 追加
    }
    
    // 履歴管理システムへのアクセサー
    getHistoryManager() {
        return this.historyManager;
    }
    
    // プリセット変更時に履歴記録
    onPresetChanged(presetId, beforeData, afterData) {
        this.historyManager.recordHistory(
            HistoryManager.HISTORY_TYPES.PRESET_CHANGE,
            { presetId, before: beforeData, after: afterData }
        );
    }
}
```

#### UIManager にアンドゥ・リドゥを追加

UI にアンドゥ・リドゥのショートカットを実装します。

## 5. JavaScript+PixiJSv7_Rulebook.txt の改修

### A. ファイル構成ルールの更新

```diff
## 2. ファイル構成ルール
- 現行の3ファイル構成（fetch API分割前提）：
+ 現行の4ファイル構成（fetch API分割前提）：
1. **app-core.js**（旧 core-engine.js）  
   - PixiJSアプリ生成・描画ループ管理・リソースロード。
   - Application / Stage / Renderer 初期化はここに集約。
2. **drawing-tools.js**（旧 tools-features.js）  
   - 各描画ツールや機能（ペン、消しゴム、ベクターペンなど）をクラス化。
   - PixiJS Graphics / Mesh / Container の使用はツール内に閉じる。
3. **ui-manager.js**（旧 ui-system.js）  
   - UIコンテナ管理・UIイベント処理。
   - UIロジックと描画ロジックは分離する。
+ 4. **history-manager.js**（新規）
+    - アンドゥ・リドゥ・履歴管理システム。
+    - 操作履歴の記録と復元機能を提供。
```

### B. シンボル辞書の更新

```diff
## 4. シンボル辞書（推奨用語）
| 用語 | 命名例 | 補足 |
|------|--------|------|
| アプリ全体 | `app` | PIXI.Application |
| ステージ | `stage` | app.stage |
| レイヤー | `{name}Layer` | backgroundLayer, drawingLayer |
| コンテナ | `{name}Container` | UI部品など |
| ツール | `{ToolName}Tool` | VectorPenTool, EraserTool |
| 設定 | `CONFIG` | 全定数まとめ |
| 状態 | `state` | 現在の描画設定 |
| イベント一覧 | `EVENTS` | pointerdown等を定数化 |
+ | 履歴管理 | `historyManager` | アンドゥ・リドゥ管理 |
+ | 履歴エントリ | `historyEntry` | 個別の操作記録 |
```

### C. 状態管理の追加

```diff
## 7. 状態管理
- 描画状態（色、太さ、ツール種別）は`app-core`の`state`に集約
- Undo/RedoはRenderTexture差分管理
+ - 履歴管理は`history-manager.js`の`HistoryManager`で一元管理
+ - プリセット変更履歴も含めて記録・復元
- アニメ・自動描画は`Ticker`で更新
```

## 6. 実装優先度

### フェーズ1（すぐ実装）
1. ✅ 視覚表示改善（CSS + PresetDisplayManager修正）
2. ✅ プリセット変更初期化（リセットボタン）

### フェーズ2（後日実装）
3. 🔄 HistoryManager の基本実装
4. 🔄 アンドゥ・リドゥのUI統合
5. 🔄 ショートカット（Ctrl+Z, Ctrl+Y）の実装

### フェーズ3（将来拡張）
6. 🚀 描画履歴のサムネイル表示
7. 🚀 履歴の永続化（LocalStorage）
8. 🚀 履歴のエクスポート・インポート機能

## 7. 動作確認項目

### 視覚改善の確認
- [ ] アクティブプリセットに四角い枠が表示される
- [ ] プレビュー円のサイズ変化が明確に見える
- [ ] ホバー効果が適切に動作する

### 初期化と変更維持の確認  
- [ ] 「リセット」ボタンでデフォルト値に戻る
- [ ] 他のプリセット選択後も保存された変更が維持される

### 履歴管理の確認
- [ ] Ctrl+Z でアンドゥが実行される
- [ ] Ctrl+Y でリドゥが実行される
- [ ] プリセット変更がアンドゥ・リドゥできる

この計画に沿って実装することで、より使いやすく、信頼性の高いペン設定システムが実現できます。