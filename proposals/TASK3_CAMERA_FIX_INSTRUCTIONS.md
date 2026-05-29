# TASK 3 追加確認版：液タブペン描画不可の修正指示書
> 作成者: Claude（camera-system.js 実コード確認済み）  
> 対象AI: Gemini CLI  
> 作業フォルダ: `tegaki_work/`  
> 前提読了: `AGENTS.md` → `tegaki_work/PROGRESS.md` → 本ファイル

---

## ⚠️ 作業前の重要警告

`camera-system.js` はズーム・パン・回転・反転・カーソル制御が集まる要のファイルです。
**変更は必ず差分編集（部分置換）で行い、丸ごと上書きは絶対禁止。**
変更箇所は本指示書に示す2箇所のみです。それ以外は一切触らないこと。

---

## 原因の特定（Claude による実コード診断）

### バグの根本原因：`pointerdown` の判定に `pointerType` チェックが1箇所だけ漏れている

`camera-system.js` の `_setupMouseEvents()` 内、`pointerdown` ハンドラの条件式：

```javascript
// 現状のコード（_setupMouseEvents内 pointerdown）
const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

if ((isMouseSecondaryButton || this.spacePressed) && !this.shiftPressed) {
    this.isDragging = true;
    this.canvasMoveMode = true;   // ← ここでtrueになる
    ...
}
```

**`isMouseSecondaryButton` の定義自体は正しく `pointerType !== 'pen'` を含んでいる。**

しかし問題は `pointerup` ハンドラにある：

```javascript
// 現状のコード（_setupMouseEvents内 pointerup）
canvas.addEventListener('pointerup', (e) => {
    const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

    if (this.isDragging && (isMouseSecondaryButton || !this.spacePressed)) {
        this._stopDragging();   // ← これが呼ばれない条件がある
    }
    if (this.isScaleRotateDragging && (isMouseSecondaryButton || !this.spacePressed)) {
        this._stopDragging();
    }
});
```

**`_stopDragging()` が呼ばれる条件：**
- `isMouseSecondaryButton` が true（右クリックマウスのup）
- または `!this.spacePressed`（Spaceが押されていない）

**`_stopDragging()` が呼ばれない条件：**
- `isMouseSecondaryButton` が false かつ `this.spacePressed` が true

つまり、**「Spaceを押したまま液タブペンで接触した場合」**：
1. `pointerdown` では `isMouseSecondaryButton = false`（penなので正しく除外）、かつ `this.spacePressed = true` → 移動モード開始してしまう
2. `pointerup` では `isMouseSecondaryButton = false` かつ `this.spacePressed` が残っていれば → `_stopDragging()` が呼ばれない

**さらに重大な問題**：通常の液タブ使用（Space不要）でも、以下のシナリオで詰まる可能性がある：

`drawing-engine.js` の `_handlePointerDown` は `isCanvasMoveMode()` をチェックして `return` する。
一度でも `canvasMoveMode = true` になったまま `_stopDragging()` が漏れると、
**その後のペン描画がすべてブロックされ続ける**。

### 追加の観察事項

`pointerup` の `_stopDragging()` 呼び出し条件が非対称になっている。
`pointerdown` は「右ボタン OR Space」でドラッグ開始するが、
`pointerup` は「右ボタン OR Spaceが離れている」でしか停止しない。
この非対称が積み重なって `canvasMoveMode` が `true` のまま残るケースが発生する。

---

## 修正内容

**変更ファイル：`system/camera-system.js` のみ**  
**変更箇所：2箇所（`pointerup` ハンドラの修正、`pointermove` の既存ガードの確認）**

---

### 修正1：`pointerup` ハンドラの条件を対称化する

`_setupMouseEvents()` 内の `pointerup` リスナーを以下に置き換える。

**変更前（このコードを探して置き換える）：**

```javascript
        canvas.addEventListener('pointerup', (e) => {
            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if (this.isDragging && (isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
            if (this.isScaleRotateDragging && (isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
        });
```

**変更後：**

```javascript
        canvas.addEventListener('pointerup', (e) => {
            // ペン入力のpointerupでは常にドラッグを停止する
            // （ペンがcanvasMoveMode=trueのまま残るのを防ぐ）
            if (e.pointerType === 'pen') {
                if (this.isDragging || this.isScaleRotateDragging) {
                    this._stopDragging();
                }
                return;
            }

            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if (this.isDragging && (isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
            if (this.isScaleRotateDragging && (isMouseSecondaryButton || !this.spacePressed)) {
                this._stopDragging();
            }
        });
```

**この修正の意図：**  
液タブペンの `pointerup` では、`isDragging` や `isScaleRotateDragging` が誤って `true` になっていた場合でも確実に `_stopDragging()` を呼んで `canvasMoveMode = false` に戻す。
マウス操作のロジックは一切変えない。

---

### 修正2：`pointerdown` に `pointerType === 'pen'` の早期リターンガードを追加する

`_setupMouseEvents()` 内の `pointerdown` リスナーの冒頭に1行追加する。

**変更前（このコードを探す）：**

```javascript
        canvas.addEventListener('pointerdown', (e) => {
            if (this.vKeyPressed) return;
            
            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if ((isMouseSecondaryButton || this.spacePressed) && !this.shiftPressed) {
```

**変更後：**

```javascript
        canvas.addEventListener('pointerdown', (e) => {
            if (this.vKeyPressed) return;

            // ペン入力はカメラ移動に一切使わない
            // （Spaceが押されていてもペンはDrawingEngine側で描画する）
            if (e.pointerType === 'pen') return;

            const isMouseSecondaryButton = e.button === 2 && e.pointerType !== 'pen';

            if ((isMouseSecondaryButton || this.spacePressed) && !this.shiftPressed) {
```

**この修正の意図：**  
`isMouseSecondaryButton` の定義が正しくても `spacePressed` 条件が残っているため、
Space中に液タブで誤ってカメラ移動が開始される余地がある。
ペン入力は先頭で完全に除外することで、どんな修飾キー状態でも描画に回す。

---

## 修正後の動作確認手順

### ビルド確認（必須）

```
npm.cmd run build
```
エラーゼロで通ることを確認する。

### ブラウザ動作確認（必須）

| 操作 | 期待結果 |
|---|---|
| 液タブペン接触のみ | `[DrawingEngine] down gate` ログが出る。`Blocked: CanvasMoveMode` が出ない |
| 液タブペンで描く | 実際に線が引ける |
| Space + マウス左ドラッグ | キャンバスが移動する（従来通り） |
| マウス右ドラッグ | キャンバスが移動する（従来通り） |
| Space + Shift + ドラッグ | 回転・拡縮できる（従来通り） |
| Space + 液タブペン | キャンバスが移動せず、描画が走る |

### 実機確認（液タブ所持オーナーが実施）

- 液タブペンで実際に線が引けることを確認する
- Space押しながら液タブペンで描けることを確認する
- マウスのスクロールズームが引き続き機能することを確認する

---

## 作業後に必ず実施すること

1. `npm.cmd run build` エラーゼロを確認
2. `tegaki_work/PROGRESS.md` に作業結果を記録する
   - 「液タブペン描画不可」バグの対処済みチェックを更新する
   - 実機確認はオーナー待ちの旨を記載する

---

## ⛔ 絶対に触らないこと（スコープ外）

- `_setupCheckerPattern()` / `createGuideLines()` / `_drawCameraFrame()` — 描画系メソッド
- `resizeCanvas()` / `centerCanvasOnScreen()` — リサイズ系（TASK 2の対象）
- `_handleWheelZoom()` / `_handleWheelRotation()` / `_handleScaleRotateDrag()` — ホイール・変形系
- `_setupEventBusListeners()` — EventBus連携
- 上記2箇所以外の `_setupMouseEvents()` 内のコード

---

*作成: Claude / 日付: 2026-05-29 / camera-system.js 実コード確認済み*
