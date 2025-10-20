# Tegaki ツール - サイズ反映フロー分析

## 🔴 **根本原因特定**

### 問題: UIからのサイズ変更が描画に反映されない

```
UI(tool-size-popup.js)
  ↓ 
brushSettings.setBrushSize(50)
  ↓
BrushSettings.size = 50 ✅（ここは成功）
  ↓
EventBus.emit('tool:size-opacity-changed', {...size:50})
  ↓
DrawingEngine購読 → settings.setBrushSize(50) ✅
  ↓
BrushSettings.size = 50 ✅
  ↓
startDrawing() 呼び出し → ❌ サイズが反映されない
```

---

## 📋 **シンボル定義辞典**

### ❌ **グローバルシンボル（値が不一致）**

| シンボル | 定義場所 | 参照ファイル | 現在値 | 問題 |
|---------|--------|----------|--------|-----|
| `window.TegakiEventBus` | `event-bus.js` | 全域 | ✅ EventBusClass | 購読遅延 |
| `window.CoreRuntime.internal.drawingEngine` | `core-runtime.js` | `core-initializer.js` | DrawingEngine v8.1 | ここが主体 |
| `window.drawingEngine` | `core-runtime.js`の`setupLegacyCompatibility()` | `tool-size-manager.js`, `keyboard-handler.js` | DrawingEngine参照 | 参照は同じ |
| `window.drawingApp.drawingEngine` | `core-initializer.js` | `keyboard-handler.js` | DrawingEngine参照 | 参照は同じ |
| `window.coreEngine` | `core-initializer.js` | - | CoreEngine | 使用少 |

### ✅ **ローカルインスタンス（クラス定義）**

| クラス名 | ファイル | グローバル登録 | 状態 |
|---------|---------|-------------|------|
| `BrushSettings` | `brush-settings.js` | `window.TegakiDrawing.BrushSettings` | ✅ 正常 |
| `DrawingEngine` | `drawing-engine.js` | `window.TegakiDrawing.DrawingEngine` | ✅ v8.1 |
| `ToolSizeManager` | `tool-size-manager.js` | `window.ToolSizeManager` | ✅ 正常 |
| `ToolSizePopup` | `tool-size-popup.js` | `window.ToolSizePopup` | ✅ 正常 |
| `KeyboardHandler` | `keyboard-handler.js` | `window.KeyboardHandler` | ✅ P/Eドラッグ対応 |

### 📊 **主要プロパティ**

| オブジェクト | プロパティ | 型 | 責務 | 現状 |
|-----------|---------|---|-----|-----|
| `BrushSettings` | `.size` | Number | ペンサイズ（唯一の情報源） | ✅ 更新される |
| `BrushSettings` | `.opacity` | Number | 不透明度（唯一の情報源） | ✅ 更新される |
| `DrawingEngine` | `.settings` | BrushSettings参照 | ブラシ設定へのアクセス | ⚠️ 参照は正しい |
| `DrawingEngine` | `.isDrawing` | Boolean | 描画中フラグ | ✅ 正常 |
| `DrawingEngine` | `.currentPath` | Object | 現在のストローク | ✅ 正常 |

---

## 🔗 **イベントフロー図**

### ケース1: UIからのサイズ変更（手動スライダー）

```
ToolSizePopup.applySize(50)
  ↓
BrushSettings.setBrushSize(50)
  ┌─ this.size = 50 ✅
  └─ eventBus.emit('brushSizeChanged', {size:50}) ✅
  ↓
ToolSizePopup.applySize() 内部で
  eventBus.emit('tool:size-opacity-changed', {tool:'pen', size:50, opacity:0.85})
  ↓
DrawingEngine.subscribeToSettings() 購読
  ┌─ settings.setBrushSize(50) ✅ 再度設定
  └─ settings.setBrushOpacity(0.85) ✅
  ↓
描画トリガー: 左クリック
  ↓
CoreRuntime.handlePointerDown()
  → drawingEngine.startDrawing(screenX, screenY, event)
```

### ❌ **ケース1の破綻点**

```
startDrawing() 内部:
  const currentSize = this.settings.getBrushSize()  ← ここが問題！
```

**問題の詳細：**
- `startDrawing()` は `this.settings` が最新と仮定している
- しかし **`this.settings` インスタンスが異なるか、参照タイミングにズレがある可能性**
- もしくは `this.settings.getBrushSize()` の実装に問題がある

---

### ケース2: P/E+ドラッグでのサイズ変更

```
KeyboardHandler.handleMouseDown(P/E+click)
  ↓
TegakiEventBus.emit('tool:drag-size-start', {tool:'pen', startSize:?, startOpacity:?})
  ↓
ToolSizeManager._handleDragStart()
  ↓
KeyboardHandler.handleMouseMove(P/E+drag)
  ↓
TegakiEventBus.emit('tool:drag-size-update', {deltaX, deltaY})
  ↓
ToolSizeManager._handleDragUpdate()
  → 新サイズ計算
  → TegakiEventBus.emit('tool:size-opacity-changed', {size, opacity})
  ↓
DrawingEngine.subscribeToSettings() 購読
  → settings.setBrushSize(size) ✅
```

**このフローは正しい** が、描画時に反映されない。

---

## 🐛 **根本的な問題**

### **仮説1: `this.settings` インスタンスの異なり**

```javascript
// core-initializer.js で:
drawingEngine = new DrawingEngine(..., eventBus, config)
→ DrawingEngine 内で BrushSettings 初期化
  this.settings = new BrushSettings(config, eventBus)

// tool-size-popup.js で:
getBrushSettings() 
→ window.CoreRuntime.internal.drawingEngine.settings 取得
→ setBrushSize(50)
```

**確認項目:**
```javascript
// これらが同じインスタンスか？
const a = window.CoreRuntime.internal.drawingEngine.settings;
const b = window.TegakiDrawing.BrushSettings.prototype; // これは不正

// 正しくは:
const a = window.CoreRuntime.internal.drawingEngine.settings;
const b = new window.TegakiDrawing.BrushSettings(...);
console.log(a === b); // 同じインスタンス？ ← 確認必須
```

---

### **仮説2: `getBrushSize()` 呼び出しタイミング**

`tool-size-popup.js` では呼び出し直前に取得 ✅

```javascript
function applySize(size) {
  const brushSettings = getBrushSettings(); // ← 毎回取得
  brushSettings.setBrushSize(size);         // ← 設定
  brushSettings.getBrushSize();             // ← 確認？
}
```

`drawing-engine.js v8.1` では直前に取得 ✅

```javascript
startDrawing(screenX, screenY, pressureOrEvent) {
  const currentSize = this.settings.getBrushSize(); // ← v8.1で修正済み
  ...
}
```

---

### **仮説3: EventBus購読タイミングの遅延**

```javascript
// DrawingEngine コンストラクタ
_isEventBusSubscribed = false;
_attemptSubscription();  // ← 即座に試行

_attemptSubscription() {
  if (this._isEventBusSubscribed) return;
  
  const eventBus = window.TegakiEventBus || this.eventBus;
  
  if (eventBus && typeof eventBus.on === 'function') {
    this.subscribeToSettings(); // ← 購読実行
    return;
  }
  
  // リトライ: 最大5秒間
  if (this._subscriptionRetryCount < 100) {
    setTimeout(() => this._attemptSubscription(), 50);
  }
}
```

**確認ポイント:**
```javascript
// 実際に購読されているか？
console.log(window.CoreRuntime.internal.drawingEngine._isEventBusSubscribed);
// → false なら購読されていない ❌
// → true なら購読されている ✅
```

---

## 📍 **問題の詳細マッピング**

### ファイル別の実装状況

| ファイル | 責務 | 実装 | 問題 |
|---------|-----|------|-----|
| `config.js` | 設定値 | ✅ 完全 | なし |
| `event-bus.js` | イベント発火/購読 | ✅ 完全 | 警告抑制のみ |
| `brush-settings.js` | ブラシ設定の保持 | ✅ 完全 | **サイズ設定は動作** |
| `tool-size-popup.js` | UIポップアップ | ✅ 完全 | `setBrushSize()`呼び出し成功 |
| `tool-size-manager.js` | ドラッグ管理 | ✅ 完全 | イベント発火成功 |
| `drawing-engine.js` | 実際の描画 | ⚠️ v8.1修正 | **ここで反映されない** |
| `keyboard-handler.js` | キーボード/P+Eドラッグ | ✅ 完全 | なし |
| `core-initializer.js` | 初期化 | ✅ 完全 | EventBus購読確認不足 |
| `core-runtime.js` | ランタイム | ✅ 完全 | なし |

---

## 🔍 **検証手順**

### **Step 1: インスタンス確認**

```javascript
// コンソールで:
const settings = window.CoreRuntime.internal.drawingEngine.settings;
console.log('Settings instance:', settings);
console.log('Settings.getBrushSize():', settings.getBrushSize());
console.log('Settings.size:', settings.size);

// サイズ変更
settings.setBrushSize(50);
console.log('After setBrushSize(50):');
console.log('  .getBrushSize():', settings.getBrushSize());
console.log('  .size:', settings.size);
```

### **Step 2: イベント購読確認**

```javascript
console.log('EventBus subscribed:', 
  window.CoreRuntime.internal.drawingEngine._isEventBusSubscribed);

// 購読されていなければ:
window.CoreRuntime.internal.drawingEngine.subscribeToSettings();
console.log('After manual subscribe:', 
  window.CoreRuntime.internal.drawingEngine._isEventBusSubscribed);
```

### **Step 3: イベント発火テスト**

```javascript
window.TegakiEventBus.emit('tool:size-opacity-changed', 
  { tool: 'pen', size: 50, opacity: 0.85 });

// 確認
const engine = window.CoreRuntime.internal.drawingEngine;
console.log('After emit, engine.settings.getBrushSize():', 
  engine.settings.getBrushSize());
```

### **Step 4: 描画テスト**

```javascript
// 画面上で通常のペン描画をテスト
// サイズが反映されるか確認
```

---

## 💡 **推定される修正候補**

### **候補A: EventBus購読の確実性**

`core-initializer.js` の `_ensureDrawingEngineSettings()` 後に、
明示的に `subscribeToSettings()` を呼び出す

```javascript
await this._ensureDrawingEngineSettings(drawingEngine);

// ← ここに追加
drawingEngine.subscribeToSettings(); // 強制購読
```

### **候補B: `startDrawing()` 直前にキャッシュ無効化**

```javascript
startDrawing(screenX, screenY, pressureOrEvent) {
  this._ensureBrushSettings(); // インスタンス再確認

  const currentSize = this.settings.getBrushSize();
  const currentOpacity = this.settings.getBrushOpacity();
  
  // ... 以降同じ
}
```

### **候補C: `this.settings` の直接参照ではなく、メソッド経由**

```javascript
// 現在（直接参照）:
const size = this.settings.getBrushSize();

// 改修案（メソッド経由）:
_getCurrentSize() {
  if (!this.settings) this._ensureBrushSettings();
  return this.settings?.getBrushSize() ?? this.brushSize;
}

const size = this._getCurrentSize();
```

---

## 📊 **データフロー図**

```
┌─────────────────────────────────────────────────────────────┐
│  User Action (Click Slider/P+E Drag)                      │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────▼──────────┐
    │ tool-size-popup.js │  or  │ keyboard-handler.js │
    │ applySize(50)      │       │ handleDrag()        │
    └────────┬───────────┘       └────────┬────────────┘
             │                           │
    ┌────────▼──────────────────────────────┐
    │ EventBus.emit('tool:size-opacity-..') │
    └────────┬───────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │ BrushSettings.setBrushSize(50)            │
    │ + DrawingEngine.subscribeToSettings()      │
    │   → settings.setBrushSize(50)  ✅         │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │ User clicks to draw                       │
    │ CoreRuntime.handlePointerDown()           │
    │ → drawingEngine.startDrawing()            │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │ const currentSize =                       │
    │   this.settings.getBrushSize()            │
    │                                           │
    │ ❓ この時点で 50 か 100 (古い値) か？   │
    │    ← ここが問題の可能性                    │
    └────────┬──────────────────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │ this.recorder.startNewPath(...,           │
    │   size: currentSize)  ← サイズ確定        │
    │                                           │
    │ Rendering with wrong size ❌              │
    └────────────────────────────────────────────┘
```

---

## ✅ **次のアクション**

1. **コンソール検証**: Step 1～3 の検証スクリプトを実行
2. **ボトルネック特定**: どのステップで値が失われるか特定
3. **標的修正**: 候補A～C から適切な修正を選択
4. **統合テスト**: 全体を改修後、動作確認