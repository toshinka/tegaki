# ペンツールプレビュー連動機能実装計画書

## 概要
ペンツールのポップアップ内でアクティブなプリセットのペンサイズプレビューの●とサイズ・不透明度の数字をスライダーの動きと連動させる機能を実装する。プレビューの●は枠の◯よりも大きくならないよう制限し、数値は記録される。

## 現状分析

### 既存のプリセット表示システム
- **プリセット表示**: `PresetDisplayManager`（ui/components.js）が管理
- **サイズプレビュー**: `.size-preview-circle`クラスの要素で●を表示
- **プレビューフレーム**: `.size-preview-frame`（20px固定）で◯枠を表示
- **プリセット管理**: `PenPresetManager`（ui/components.js）でデータ管理
- **スライダー**: `SliderController`（ui/components.js）で値変更

### 課題
1. スライダー変更時のリアルタイムプレビュー更新がない
2. アクティブプリセットの●サイズがスライダー値と連動していない
3. サイズと不透明度の数字表示がライブ更新されない
4. プレビューサイズ制限（20px枠）が効いていない場合がある

## 実装計画

### Phase 1: プレビュー連動システムの設計

#### 1.1 責務分離
- **PresetDisplayManager**: プレビューの視覚的更新
- **PenPresetManager**: プリセットデータの管理
- **UIManager**: スライダーとプリセットの橋渡し

#### 1.2 データフロー設計
```
スライダー変更 → UIManager → PenPresetManager → PresetDisplayManager → DOM更新
```

### Phase 2: リアルタイム更新機能の実装

#### 2.1 新機能
1. **ライブプレビュー更新**
   - スライダー値変更時のリアルタイムプレビュー
   - アクティブプリセットのみ更新（他は固定）

2. **プレビューサイズ制限**
   - 20px枠を超えないサイズ計算
   - 大サイズ値の対数スケール圧縮

3. **数値表示連動**
   - サイズ値（`.size-preview-label`）
   - 不透明度値（`.size-preview-percent`）

#### 2.2 値の記録
- ライブ変更値は`PenPresetManager`内に一時保存
- スライダー操作終了時に正式記録
- リセット機能でデフォルト値に復帰

### Phase 3: UI改善

#### 3.1 全体プレビューリセットボタン
- 位置: ペンツール設定パネル内の既存リセットボタン付近
- 機能: 全プリセットのライブ値をクリア
- サイズ: 小さめのボタン

## 改変対象ファイル

### 主要改変ファイル

#### 1. `ui/components.js`（メイン改変）
**改変箇所**:
- `PresetDisplayManager`クラス
  - `updatePresetsDisplay()`メソッド拡張
  - 新メソッド: `updateActivePresetPreview(size, opacity)`
  - 新メソッド: `syncPreviewWithLiveValues()`

- `PenPresetManager`クラス  
  - `updateActivePresetLive()`メソッド拡張
  - 新メソッド: `clearLiveValues()`
  - 新メソッド: `hasLiveValues()`

**理由**: 既存のコンポーネントにリアルタイム更新機能を追加

#### 2. `ui-manager.js`（連携改変）
**改変箇所**:
- `UIManagerSystem`クラス
  - `updatePresetLiveValues()`メソッド拡張
  - スライダーコールバック修正（プレビュー更新追加）
  - 新メソッド: `resetAllPreviewValues()`

**理由**: スライダーとプリセット表示の橋渡し機能強化

#### 3. `index.html`（軽微改変）
**改変箇所**:
- リセットボタン追加
- プレビューリセットボタンの追加（小さめ）

**理由**: 全体プレビューリセット機能のUI追加

### 参考ファイル

#### 1. `config.js`
**参考内容**:
- `PREVIEW_MIN_SIZE`、`PREVIEW_MAX_SIZE`（プレビューサイズ制限）
- `DEFAULT_BRUSH_SIZE`、`DEFAULT_OPACITY`（デフォルト値）
- `PREVIEW_UTILS.calculatePreviewSize()`（サイズ計算関数）

#### 2. `styles.css`
**参考内容**:
- `.size-preview-frame`、`.size-preview-circle`のスタイル
- プリセット関連のCSS構造

## 実装詳細

### 新機能の具体的仕様

#### 1. リアルタイムプレビュー更新
```javascript
// スライダー変更時
onSliderChange(type, value) {
    // アクティブプリセットのライブ値更新
    this.penPresetManager.updateActivePresetLive(
        type === 'size' ? value : null,
        type === 'opacity' ? value : null
    );
    
    // プレビュー表示即座更新
    this.presetDisplayManager.updateActivePresetPreview();
}
```

#### 2. プレビューサイズ制限
```javascript
// 20px枠制限の計算
calculateConstrainedPreviewSize(actualSize) {
    const calculated = PREVIEW_UTILS.calculatePreviewSize(actualSize);
    return Math.min(calculated, CONFIG.PREVIEW_MAX_SIZE);
}
```

#### 3. 数値表示連動
```javascript
// ライブ値表示
updatePreviewLabels(preset, liveValues) {
    const displaySize = liveValues?.size ?? preset.size;
    const displayOpacity = liveValues?.opacity ?? preset.opacity;
    
    element.querySelector('.size-preview-label').textContent = displaySize.toFixed(1);
    element.querySelector('.size-preview-percent').textContent = 
        Math.round(displayOpacity * 100) + '%';
}
```

## DRY・SOLID原則の適用

### DRY原則
- プレビューサイズ計算: `PREVIEW_UTILS.calculatePreviewSize()`を再利用
- CONFIG値取得: `safeConfigGet()`関数を活用
- プレビューサイズ制限: 共通の制限ロジック

### SOLID原則

#### 単一責任原則（SRP）
- `PresetDisplayManager`: プレビュー表示のみ
- `PenPresetManager`: プリセットデータ管理のみ
- `UIManager`: UI要素間の連携のみ

#### 開放閉鎖原則（OCP）
- 既存メソッドの拡張（変更ではなく追加）
- 新機能は新メソッドとして実装

#### 依存関係逆転原則（DIP）
- インターフェースを通じた疎結合
- CONFIG依存は`safeConfigGet()`を介する

## 作業断絶時の復旧手順

### 最小ファイル添付リスト
1. **`ui/components.js`** - メイン改変ファイル
2. **`ui-manager.js`** - 連携改変ファイル  
3. **`config.js`** - 設定値参照
4. **`index.html`** - HTML構造参照

### 作業復帰手順
1. 改変対象の`ui/components.js`をバックアップ
2. `PresetDisplayManager.updatePresetsDisplay()`メソッドを特定
3. `PenPresetManager.updateActivePresetLive()`メソッドを特定
4. `UIManager.updatePresetLiveValues()`メソッドを特定
5. リアルタイム更新機能を段階的に実装

### 実装チェックポイント
- [ ] スライダー変更時にアクティブプリセットの●サイズが変わる
- [ ] ●は20px枠を超えない
- [ ] サイズ数字がリアルタイム更新される
- [ ] 不透明度数字がリアルタイム更新される
- [ ] 他のプリセットは変更されない
- [ ] プレビューリセットボタンが機能する
- [ ] 値の記録と復元が正常に動作する

## 実装優先度

### High Priority（必須）
1. アクティブプリセットの●サイズとスライダー連動
2. プレビューサイズの20px制限
3. 数値表示のリアルタイム更新

### Medium Priority（重要）
1. 全体プレビューリセットボタン
2. 値の永続化（記録機能）

### Low Priority（オプション）
1. プレビュー更新のアニメーション
2. 詳細なエラーハンドリング

## 期待される結果

1. **ユーザビリティ向上**: スライダー操作と視覚的フィードバックの一致
2. **直感性の向上**: 実際のペンサイズが●で即座に確認できる
3. **制限の明確化**: 大きなサイズでも●が制限内で表示される
4. **データ整合性**: 変更値の適切な記録と復元

## リスク対策

### 技術的リスク
- **パフォーマンス**: 60fps更新でも滑らかな動作を保証
- **ブラウザ互換性**: 主要ブラウザでの動作確認
- **メモリリーク**: イベントリスナーの適切な削除

### ユーザビリティリスク
- **混乱防止**: アクティブプリセットのみの変更を明確化
- **操作性**: スライダー操作の応答性確保
- **視認性**: 小さな●も見やすい色・コントラスト

## 完了判定基準

### 機能要件
- [x] 仕様書作成完了
- [ ] アクティブプリセットの●がスライダーと連動
- [ ] ●サイズが20px枠を超えない
- [ ] サイズ・不透明度数字がリアルタイム表示
- [ ] 値の記録・復元機能
- [ ] 全体プレビューリセット機能

### 品質要件
- [ ] 60fps滑らかな更新
- [ ] エラーハンドリング
- [ ] ブラウザ互換性確認
- [ ] メモリリーク検証

## 次のアクション

1. **`ui/components.js`の`PresetDisplayManager`改変**
2. **`ui/components.js`の`PenPresetManager`改変**
3. **`ui-manager.js`のスライダーコールバック修正**
4. **`index.html`にプレビューリセットボタン追加**
5. **動作テスト・調整**

---

この計画書に基づいて段階的に実装を進めることで、要求された機能を確実に達成できます。