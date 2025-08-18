# 🎨 ふたば☆お絵描きツール - Symbol Dictionary パッチ

## 📋 修正により追加・変更されるシンボル

### ErrorManager 修正

```javascript
// 🚨 修正: パラメータ処理の統一化
static showWarningMessage(message, options = {})
static showErrorMessage(message, options = {}) 
static showRecoveryMessage(message, options = {})
static showCriticalError(message, options = {})

// 🚨 追加: 循環参照防止
static _isHandlingError = false
static safeError(message, type = 'error')
```

### EventBus 修正

```javascript
// 🚨 追加: エラーハンドリング状態管理
static _errorHandling = false
static stats.errors = 0

// 🚨 追加: 安全なイベント発行
static safeEmit(eventType, data = null)
static _shouldPreventErrorCascade(error, eventType)

// 🚨 追加: システム健全性チェック
static healthCheck()
static resetErrorState()
```

### AppCore 修正

```javascript
// 🚨 追加: 初期化状態管理
this.isInitializing = false
this.initializationComplete = false

// 🚨 修正: UI初期化メソッド名統一
async initializeUI()

// 🚨 追加: 最小限UIコントローラー
class MinimalUIController
```

### DrawingToolSystem 修正

```javascript
// 🚨 修正: EventBus統合メソッド
setBrushSize(size) // EventBus安全発行付き
setOpacity(opacity) // EventBus安全発行付き
setPressure(pressure) // EventBus安全発行付き
setTool(tool) // EventBus安全発行付き
```

### FutabaDrawingTool 修正

```javascript
// 🚨 追加: 初期化段階フラグ
this.isInitializing = false

// 🚨 追加: 緊急エラー表示
displayEmergencyError(originalError, fallbackError)

// 🚨 修正: 全メソッドでErrorManager安全呼び出し対応
applyCanvasResize(centerContent) // safeError対応
selectPenTool() // safeError対応  
selectEraserTool() // safeError対応
closeAllPopups() // safeError対応
```

## 📝 新規グローバル関数

```javascript
// ErrorManager
window.safeError = (message, type) => ErrorManager.safeError(message, type)

// EventBus  
window.safeEmitEvent = (type, data) => EventBus.safeEmit(type, data)
window.resetEventBusErrors = () => EventBus.resetErrorState()
window.eventBusHealthCheck = () => EventBus.healthCheck()
```

## 🔧 設定値変更

### ConfigManager想定追加設定

```javascript
// エラーハンドリング設定
errorHandling: {
  maxErrors: 10,
  circularRefPrevention: true,
  safeModeEnabled: true
}

// 初期化設定
initialization: {
  maxInitTime: 5000,
  stepTimeout: 1000,
  fallbackMode: true
}
```

## 📊 互換性情報

### 下位互換性
- ✅ 既存のAPIインターフェース完全維持
- ✅ 従来のイベント名・関数名保持  
- ✅ ConfigManager設定値変更なし

### 新機能
- 🛡️ 循環参照防止機能
- 🔒 エラー連鎖防止機能
- 📡 安全なイベント発行システム
- 🏥 システム健全性チェック機能

## 🎯 テスト対象

### 機能テスト
1. アプリケーション正常起動
2. キャンバス表示確認  
3. ペンツール描画
4. UI操作（スライダー、ポップアップ）
5. エラー発生時の安全処理

### エラーシミュレーションテスト
1. 意図的な循環参照発生
2. EventBusリスナーエラー発生
3. ErrorManager内部エラー発生
4. 初期化中断時の処理確認

### パフォーマンステスト  
1. 初期化時間測定（目標: 3秒以内）
2. メモリ使用量確認
3. FPS安定性確認（目標: 60FPS）

## 📋 Phase1完了確認項目

- [x] `options is not defined` エラー完全解消
- [x] 循環参照防止機能実装
- [x] ErrorManager安全呼び出し対応
- [x] EventBus安全発行機能追加
- [x] 初期化順序最適化
- [x] フォールバック機能強化
- [x] 下位互換性維持

## 🚀 PixiJS v8対応準備

```javascript
// TODO: PixiJS v8対応予定箇所
// Application.view → Application.canvas
// Graphics API変更対応
// Container API変更対応

// 予定コメント例
// TODO: PixiJS v8 - this.app.view → this.app.canvas  
// TODO: PixiJS v8 - Graphics.beginFill → Graphics.fill
```

---

**📋 パッチ適用後の期待効果:**
- アプリケーション起動成功率 100%
- 初期化エラー 0件
- 基本描画機能 100%動作
- UI操作 100%正常動作