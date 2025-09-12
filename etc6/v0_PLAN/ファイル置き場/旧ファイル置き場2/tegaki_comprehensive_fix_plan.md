# 🔧 Tegaki Phase1.5 包括的修正計画書（剛直原則完全遵守版）

## 💀 重大違反事項分析（ルールブック準拠）

### ❌ 架空メソッド呼び出し（絶対禁止事項 #3 違反）

1. **`this.eventBus.emit is not a function`**
   - `abstract-tool.js:67` で `eventBus.emit()` 呼び出し
   - しかし実際の EventBus には `emit` メソッドが存在しない

2. **`this.errorManager.handleError is not a function`**
   - `tool-manager.js:175` で `errorManager.handleError()` 呼び出し
   - しかし実際の ErrorManager には `handleError` メソッドが存在しない

3. **`this.toolManager.setCanvasManager is not a function`**
   - `app-core.js:152` で `toolManager.setCanvasManager()` 呼び出し
   - しかし ToolManager には `setCanvasManager` メソッドが存在しない

4. **Canvas要素取得失敗**
   - `abstract-tool.js:107` で Canvas 要素が見つからない
   - `canvasManager.getCanvasElement()` メソッドが存在しない可能性

### 🔍 根本原因（責務分離違反）

- **API仕様の不統一**: ファイル間でメソッド名・引数の不一致
- **依存関係の架空定義**: 存在しないメソッドへの依存
- **初期化順序の混乱**: Canvas作成前にCanvas依存処理を実行

## 🎯 修正戦略（剛直原則完全遵守）

### 1️⃣ **実在メソッド確認・修正**
```
ルールブック原則: 架空メソッド呼び出し禁止（絶対禁止事項 #3）

✅ DO: 実装されているメソッドのみ呼び出す
❌ DON'T: 存在しないメソッドを呼び出す
❌ DON'T: フォールバック・デフォルト値で逃げる
```

### 2️⃣ **責務分離の厳格化**
```
ルールブック原則: 1ファイル＝1責務（絶対禁止事項 #4）

✅ DO: 各クラスは単一責務のみ
❌ DON'T: Manager間での責務の重複
❌ DON'T: 初期化ロジックの散在
```

### 3️⃣ **エラー隠蔽完全禁止**
```
ルールブック原則: try/catch での握りつぶし禁止（絶対禁止事項 #1）

✅ DO: エラーは必ず throw か console.error + 詳細ログ
❌ DON'T: try-catch で握りつぶし
❌ DON'T: フォールバック・フェイルセーフ
```

## 📋 実在メソッド調査・修正リスト

### EventBus 実メソッド確認
**調査対象**: `js/utils/event-bus.js`
- 実装されているメソッド名を確認
- `emit` メソッドの存在・シグネチャ確認
- 正しいメソッド名に修正

### ErrorManager 実メソッド確認  
**調査対象**: `js/utils/error-manager.js`
- 実装されているメソッド名を確認
- `handleError` メソッドの存在・シグネチャ確認
- 正しいメソッド名に修正

### CanvasManager 実メソッド確認
**調査対象**: `managers/canvas-manager.js`
- `getCanvasElement` メソッドの存在確認
- `setPixiApp` メソッドのシグネチャ確認
- Canvas要素取得の正しいフロー確認

### ToolManager 実メソッド確認
**調査対象**: `managers/tool-manager.js`
- `setCanvasManager` メソッドの存在確認
- 初期化時の必要なメソッド確認
- 正しい初期化フロー確認

## 🔧 修正実装計画

### Step 1: 実在メソッド調査
1. 各 Manager ファイルを調査
2. 実装されているメソッド一覧を作成
3. 架空メソッド呼び出しを特定

### Step 2: メソッド名・API統一
1. 実在するメソッド名に修正
2. 引数・戻り値を実装に合わせて修正
3. 存在しないメソッドは削除・代替実装

### Step 3: 初期化順序修正
1. Canvas作成 → Canvas要素取得の順序厳守
2. Manager作成 → 依存性注入の順序厳守
3. PixiJS設定 → Tool初期化の順序厳守

### Step 4: エラーハンドリング修正
1. 架空メソッド呼び出しを完全削除
2. 実在エラー処理メソッドのみ使用
3. フォールバック・try-catch握りつぶし削除

## 📂 修正対象ファイル優先順位

### 🚨 最優先（架空メソッド除去）
1. **abstract-tool.js** - EventBus メソッド修正
2. **tool-manager.js** - ErrorManager メソッド修正  
3. **app-core.js** - ToolManager メソッド修正

### 🔧 高優先（初期化順序）
4. **tegaki-application.js** - 初期化フロー修正
5. **canvas-manager.js** - Canvas要素取得メソッド確認

### 📝 中優先（API統一）
6. **error-manager.js** - 実メソッド名確認
7. **event-bus.js** - 実メソッド名確認

## 🎯 修正後の期待動作

### ✅ 解決する問題
1. **架空メソッド呼び出し完全排除**
2. **Canvas要素正常取得**
3. **ToolManager正常初期化**
4. **EventBus正常動作**
5. **ErrorManager正常動作**

### 📊 成功指標
- コンソールエラー数: 0件
- キャンバス表示: ✅ 正常
- ペン描画: ✅ 正常
- ツール切り替え: ✅ 正常
- Manager連携: ✅ 正常

## 🚫 修正時の絶対禁止事項

### 💀 ルールブック重大違反（やってはならない）
1. **try-catch での握りつぶし** - エラーを隠すな
2. **フォールバック処理** - 正しい構造でのみ動作
3. **架空メソッド呼び出し** - 存在しないメソッドを呼ぶな  
4. **二重責務** - 1ファイル1責務厳守
5. **ブラックボックス化** - 全処理に日本語コメント

### ⚠️ やりがちな間違い（避けるべき）
```javascript
// ❌ 絶対禁止: フォールバック
const method = obj.method || obj.fallbackMethod || (() => {});

// ❌ 絶対禁止: 握りつぶし
try { 
    riskyMethod(); 
} catch(e) { 
    /* 無視 */ 
}

// ❌ 絶対禁止: 架空メソッド
obj.nonExistentMethod(); // メソッドが存在するか確認せずに呼び出し
```

### ✅ 正しい修正方法
```javascript
// ✅ 正しい: 実在メソッドのみ呼び出し
if (typeof obj.actualMethod === 'function') {
    obj.actualMethod();
} else {
    throw new Error('Required method not available');
}

// ✅ 正しい: エラーは隠蔽しない
try {
    riskyMethod();
} catch (error) {
    console.error('❌ Operation failed:', error);
    throw error; // 上位に委譲
}
```

## 📋 実装手順

### Phase 1: 調査（1-2ファイル）
1. EventBus・ErrorManager の実メソッド名確認
2. CanvasManager の実API確認
3. 架空メソッド一覧作成

### Phase 2: 修正（3-4ファイル）
1. abstract-tool.js の EventBus 呼び出し修正
2. tool-manager.js の ErrorManager 呼び出し修正
3. app-core.js の ToolManager 呼び出し修正
4. 初期化順序の修正

### Phase 3: 検証（全体）
1. コンソールエラー 0件 確認
2. 基本機能動作確認
3. Manager連携確認

---

**🎯 修正方針**: 剛直原則完全遵守・架空メソッド完全排除・エラー隠蔽禁止  
**💀 重大原則**: エラーを隠すな・構造を透けさせろ・素人が読める構造にしろ  
**🚫 絶対禁止**: フォールバック・try-catch握りつぶし・架空メソッド呼び出し