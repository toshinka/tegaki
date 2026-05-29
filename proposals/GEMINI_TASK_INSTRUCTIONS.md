# Gemini CLI 作業指示書
> 作成者: Claude  
> 対象AI: Gemini CLI（ローカル実装担当）  
> 作業フォルダ: `tegaki_work/`  
> 前提読了: `AGENTS.md` → `TEGAKI.md` → `tegaki_work/PROGRESS.md` → 本ファイル

---

## ⚠️ 技術妥当性レビュー結果（Claude による事前チェック）

作業着手前に以下の問題を把握してください。

### 🔴 重大な不整合：STEP 1 / STEP 1.5 が未反映

**PEN_PROGRESS.md には「STEP 1完了・STEP 1.5完了」と記載されているが、
GitHubのファイルを直接確認した結果、以下の実装が存在しない。**

| 項目 | PEN_PROGRESSの記載 | 実ファイルの状態 |
|---|---|---|
| `LazyBrush` クラス | `pointer-handler.js`内に実装済みとある | ❌ クラスが存在しない |
| `normalizeEvent()`の筆圧補正 | `pressureCorrection`乗算を実装済みとある | ❌ 素の`pressure`を返すのみ |
| `normalizeEvent()`の筆圧カーブ | `applyPressureCurve()`を実装済みとある | ❌ 関数が存在しない |
| `onPointerMove`でのradius動的更新 | `smoothing×16`でradius更新済みとある | ❌ 処理が存在しない |
| `config.js`の`lazyRadius`削除 | 削除済みとある | ❌ `lazyEnabled: true`は残っているが`lazyRadius`はもともと未定義（`pen`オブジェクトに`lazyRadius`プロパティなし） |
| 設定タブ | 「ペン」タブを新設済みとある | ✅ HTMLは実装済み、UIは正常 |

**結論：`settings-popup.js`のUI（ペンタブ）は確かに実装されているが、
`pointer-handler.js`側の実際の描画処理への接続（STEP 1.5の核心）が丸ごと未実装。
Geminiがトークン切れでsettings-popup.jsのHTML部分だけ書いて止まった可能性が高い。**

### 🟡 注意事項：既存の描画品質は安定している

- `stroke-renderer.js`の`_renderLineSegment()`（ライブ焼き込み方式）は正常に動いている
- `brush-core.js`の`_renderRealtimePenSegment()`も正常に動いている
- Perfect Freehandによるポリゴン描画（`renderPreview`）も機能している
- **つまり「ペンは描ける」状態。ただし手ブレ補正・筆圧カーブが未接続なだけ**

### 🟡 注意事項：STEP 2（スタンプエンジン）の技術提案について

`pen-improvement-proposal.md`のSTEP 2提案は技術的には正当だが、
**現フェーズでは着手禁止**（`stroke-renderer.js`と`brush-core.js`の根幹置換になるため）。
今回の作業スコープ外です。オーナー確認後の別フェーズで扱います。

---

## 作業タスク一覧（優先順位順）

---

## 🔴 TASK 1（最優先）：STEP 1.5 の描画接続を完成させる

**作業ファイル：`system/drawing/pointer-handler.js` のみ**

### 背景

`settings-popup.js`の「ペン」タブUIはすでに実装済み。
`SettingsManager`に`smoothing`/`pressureCorrection`/`pressureCurve`が保存される状態になっている。
しかし`pointer-handler.js`がそれらを読んで描画に反映する処理が存在しない。
これを実装する。

### 実装内容

以下の3点を`pointer-handler.js`の`PointerHandler.attach()`内に追加する。

#### A. `LazyBrush` クラスを `pointer-handler.js` 内に定義する

`PointerHandler`クラスの**外側・上部**（`export class PointerHandler`の前）に追記する。

```javascript
/**
 * 手ブレ補正クラス（Lerp方式・デッドゾーンなし）
 * 描き始めから即座に滑らかな線が出る指数移動平均方式。
 */
class LazyBrush {
    constructor() {
        this.radius = 8;   // px（スクリーン座標）
        this.penX = null;
        this.penY = null;
    }

    reset(x, y) {
        this.penX = x;
        this.penY = y;
    }

    /**
     * @param {number} x - スクリーン座標X
     * @param {number} y - スクリーン座標Y
     * @returns {{ x: number, y: number, moved: boolean }}
     */
    update(x, y) {
        if (this.penX === null) {
            this.reset(x, y);
            return { x, y, moved: true };
        }
        const dx = x - this.penX;
        const dy = y - this.penY;
        const dist = Math.hypot(dx, dy);

        if (dist <= 0) return { x: this.penX, y: this.penY, moved: false };

        // Lerp方式：radius=0なら即時追従、大きいほど遅れる
        const damping = this.radius <= 0
            ? 1.0
            : Math.min(1.0, dist / (dist + this.radius));

        this.penX += dx * damping;
        this.penY += dy * damping;

        return { x: this.penX, y: this.penY, moved: damping > 0.001 };
    }
}
```

#### B. `normalizeEvent()` 関数に筆圧補正とカーブを追加する

現在の `normalizeEvent()` は素の `e.pressure` をそのまま返している。
以下のように**筆圧補正 → カーブ適用**の処理を追加する。

```javascript
function normalizeEvent(e) {
    // 筆圧補正係数をSettingsManagerから取得
    const correction = window.TegakiSettingsManager?.get?.('pressureCorrection') ?? 1.0;
    const rawPressure = e.pressure ?? 0.5;
    // 補正して[0, 1]にクランプ
    let pressure = Math.min(1.0, Math.max(0.0, rawPressure * correction));

    // 筆圧カーブ適用
    const curve = window.TegakiSettingsManager?.get?.('pressureCurve') ?? 'linear';
    if (curve === 'ease-in') {
        pressure = pressure * pressure;           // 軽め：弱押しで細くなる
    } else if (curve === 'ease-out') {
        pressure = 1 - (1 - pressure) * (1 - pressure); // 重め：強押しでないと太くならない
    }
    // 'linear'はそのまま

    return {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY,
        pressure,           // ← 補正・カーブ適用済みの値
        tiltX: e.tiltX ?? 0,
        tiltY: e.tiltY ?? 0,
        twist: e.twist ?? 0,
        button: e.button,
        buttons: e.buttons,
        originalEvent: e
    };
}
```

#### C. `activePointers` を `LazyBrush` と統合し、`onPointerDown`/`onPointerMove` を修正する

`attach()` 関数内の `const activePointers = new Map();` の直後に LazyBrush の Map を追加する。

```javascript
const activePointers = new Map();
const lazyBrushes = new Map();  // ← 追加：ポインターIDごとのLazyBrushインスタンス
```

`onPointerDown` の中で LazyBrush を初期化する。
既存の `activePointers.set(e.pointerId, info);` の**直後**に追加：

```javascript
// LazyBrush の初期化
const brush = new LazyBrush();
const smoothing = window.TegakiSettingsManager?.get?.('smoothing') ?? 0.5;
brush.radius = smoothing * 16;  // smoothing 0.5 → radius 8（旧lazyRadius=8相当）
brush.reset(e.clientX, e.clientY);
lazyBrushes.set(e.pointerId, brush);
```

`onPointerMove` を以下のように書き換える：

```javascript
function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) {
        if (preventDefault) e.preventDefault();
        return;
    }

    // smoothing値をリアルタイムで反映（ストローク中に設定を変えても効く）
    const brush = lazyBrushes.get(e.pointerId);
    if (brush) {
        const smoothing = window.TegakiSettingsManager?.get?.('smoothing') ?? 0.5;
        brush.radius = smoothing * 16;
    }

    // LazyBrushでフィルタリングした座標を使う
    let filteredClientX = e.clientX;
    let filteredClientY = e.clientY;
    if (brush) {
        const result = brush.update(e.clientX, e.clientY);
        filteredClientX = result.x;
        filteredClientY = result.y;
        // moved=falseの場合（ほぼ動いていない）もハンドラは呼ぶ（筆圧変化のため）
    }

    // normalizeEventにはフィルタ済み座標を渡す
    const info = normalizeEvent(e);
    info.clientX = filteredClientX;  // LazyBrush補正済み座標で上書き
    info.clientY = filteredClientY;

    activePointers.set(e.pointerId, info);

    if (handlers.move) {
        handlers.move(info, e);
    }

    if (preventDefault) {
        e.preventDefault();
    }
}
```

`onPointerUp` と `onPointerCancel` の `activePointers.delete(e.pointerId)` の直後にそれぞれ追加：

```javascript
lazyBrushes.delete(e.pointerId);
```

デタッチ関数（`return () => { ... }` の中）にも追加：

```javascript
lazyBrushes.clear();
```

### 受け入れ条件

- [ ] `npm run build`（または`npm.cmd run build`）がエラーなしで通る
- [ ] 設定ポップアップの「ペン」タブで「線補正」スライダーを変えると、描線の滑らかさが変わる
- [ ] 「線補正 0」にすると手の動きをそのまま追うリアルタイム描画になる
- [ ] 「線補正 1.0」にすると最大補正（radius=16）で滑らか
- [ ] 筆圧カーブ「軽め」で弱押し時の線が細くなる（ease-in）
- [ ] 筆圧カーブ「重め」で強押しでないと太くならない（ease-out）
- [ ] 既存の消しゴム・エアブラシ・ぼかしの動作を壊していない

---

## 🔴 TASK 2（最優先）：リサイズ後の描画範囲が旧400x400のまま

**作業ファイル：`system/layer-system.js`（主）、`system/data-models.js`（確認のみ）**

### 背景

PROGRESS.mdに「`LayerSystem`に`resizeLayerTextures`と`_resizeSingleLayerTexture`を実装した」とある。
しかし実機では「リサイズ後も旧400x400範囲外に描けない」バグが未解消。
実装が中途半端か、呼び出し箇所が欠けている可能性が高い。

### 調査手順

まず`layer-system.js`を読み、以下を確認する：

1. `resizeLayerTextures()` メソッドが存在するか
2. 存在する場合、どこから呼ばれているか（キャンバスリサイズイベントのハンドラから呼ばれているか）
3. `_resizeSingleLayerTexture()` の中で既存レイヤーのピクセルをコピーして新テクスチャへ移しているか

### 期待する実装（存在しない場合は新規追加、不完全な場合は修正）

```javascript
/**
 * キャンバスリサイズ時に全レイヤーのRenderTextureを新サイズへ拡張する。
 * 既存ピクセルは左上揃えで保持し、拡張部分は透明にする。
 * @param {number} newWidth - 新しいキャンバス幅
 * @param {number} newHeight - 新しいキャンバス高さ
 */
resizeLayerTextures(newWidth, newHeight) {
    if (!this.app?.renderer) return;

    for (const layer of this.layers) {
        this._resizeSingleLayerTexture(layer, newWidth, newHeight);
    }
}

/**
 * 単一レイヤーのRenderTextureを新サイズへ拡張する。
 * @param {Object} layer - PixiJS Containerレイヤー
 * @param {number} newWidth
 * @param {number} newHeight
 */
_resizeSingleLayerTexture(layer, newWidth, newHeight) {
    const layerData = layer.layerData;
    if (!layerData?.renderTexture) return;

    const renderer = this.app.renderer;
    const oldTexture = layerData.renderTexture;

    // 新しいRenderTextureを作成
    const { RenderTexture, Sprite } = window.PIXI || {};
    if (!RenderTexture) {
        // PixiJSのインポートがある場合はそちらを使う
        console.warn('[LayerSystem] RenderTexture not available for resize');
        return;
    }

    const newTexture = RenderTexture.create({
        width: newWidth,
        height: newHeight,
        resolution: 1
    });

    // 新テクスチャを透明でクリア
    renderer.render({
        container: new window.PIXI.Graphics(),
        target: newTexture,
        clear: true
    });

    // 既存ピクセルをコピー（左上揃え）
    const oldSprite = new Sprite(oldTexture);
    renderer.render({
        container: oldSprite,
        target: newTexture,
        clear: false
    });
    oldSprite.destroy();

    // 旧テクスチャを破棄し、新テクスチャへ切り替え
    oldTexture.destroy(true);
    layerData.renderTexture = newTexture;

    // LayerSpriteのtextureも更新
    if (layer.layerSprite) {
        layer.layerSprite.texture = newTexture;
    }
    // data-models側のサイズも更新
    layerData.width = newWidth;
    layerData.height = newHeight;
}
```

**重要：`RenderTexture`と`Sprite`のimportはファイル先頭のimport文を確認し、既存のものを使うこと。
`window.PIXI`参照はフォールバックであり、実際はモジュールimportが正しい。**

### キャンバスリサイズのイベントハンドラ確認

`layer-system.js`の`_setupResizeEvents()`（または同等のメソッド）を確認し、
キャンバスサイズ変更時に`resizeLayerTextures(newWidth, newHeight)`が呼ばれているか確認する。
呼ばれていない場合は追加する。

### 受け入れ条件

- [ ] キャンバスを400→600にリサイズした後、600x600全域に描画できる
- [ ] リサイズ前のレイヤーの絵が消えない（左上に保持されている）
- [ ] `npm run build` が通る

---

## 🟠 TASK 3：液タブペン描画不可の原因特定と修正

**作業ファイル：`system/drawing/drawing-engine.js`、`system/camera-system.js`**

### 背景

PROGRESS.mdによると「`[PointerHandler] raw pointerdown Object`のログしか出ない」とある。
現在の`pointer-handler.js`を確認すると、確かに`onPointerDown`にJSONログが入っている。
しかし`drawing-engine.js`の`_handlePointerDown`にも入口ログがある。

### 確認手順

1. `drawing-engine.js`の`_handlePointerDown`の冒頭ログを確認する
2. `camera-system.js`の`isCanvasMoveMode()`の判定ロジックを確認する

### 疑われる問題箇所

`drawing-engine.js`の以下の条件：

```javascript
if (this.cameraSystem?.isCanvasMoveMode()) {
    if (info.pointerType === 'pen') console.log('[DrawingEngine] Blocked: CanvasMoveMode');
    return;
}
```

`camera-system.js`が液タブペンの接触を「右クリック」扱いしてキャンバス移動モードを
`true`にしたまま戻さない可能性が指摘されている（PROGRESS.mdの2026-05-15メモ）。

### 修正方針

`camera-system.js`の`isCanvasMoveMode()`または移動モード開始ロジックを確認し、
`pointerType === 'pen'`のときは`button === 2`でも移動モードに入らないよう保護する。

具体的には、カメラ移動開始条件に以下のガードを追加する：

```javascript
// カメラ移動開始判定（既存コードを探して修正）
// ペン入力時はbutton===2でもカメラ移動に入らない
const isRightClickMove = e.button === 2 && e.pointerType !== 'pen';
const isSpaceMove = this.spacePressed && e.button === 0;
if (isRightClickMove || isSpaceMove) {
    // キャンバス移動開始
}
```

**修正前後でマウス右ドラッグによるキャンバス移動が壊れないこと。**

### 受け入れ条件

- [ ] 液タブペンで接触したとき、`[DrawingEngine] down gate`ログが出る
- [ ] `Blocked: CanvasMoveMode`が液タブペンで出なくなる
- [ ] 液タブペンで実際に線が引ける（実機確認）
- [ ] マウス右ドラッグでのキャンバス移動は引き続き機能する

---

## 🟡 TASK 4：サムネイル黒背景・余白問題の仕上げ

**作業ファイル：`system/drawing/thumbnail-system.js`、`ui/layer-panel-renderer.js`**

### 背景

PROGRESS.mdによると「通常レイヤーのサムネイルの透明部分が黒く出る」問題が未解消。

### 調査と修正方針

#### thumbnail-system.js の確認

サムネイル生成時に`canvas.getContext('2d')`の`clearRect()`を呼んでいるか確認する。

期待する処理：

```javascript
// サムネイル生成のコアロジック（既存コードを探して修正）
const canvas = document.createElement('canvas');
canvas.width = thumbnailWidth;
canvas.height = thumbnailHeight;
const ctx = canvas.getContext('2d');

// ★ 必ずクリアする（これがないと前のゴミが残る）
ctx.clearRect(0, 0, canvas.width, canvas.height);

// PixiJSのRenderTextureからImageDataを取得してcanvasに描く
// （既存の実装方式に合わせること）
```

また、`extract.canvas()`や`extract.image()`等を使っている場合、
取得したcanvasが`premultipliedAlpha`で透明部分が黒になっていないか確認する。
黒になる場合は以下のように`globalCompositeOperation`で対処する：

```javascript
// RenderTextureから取得したImageDataをcanvasに書く際の修正例
ctx.globalCompositeOperation = 'copy';
ctx.drawImage(sourceCanvas, 0, 0, thumbnailWidth, thumbnailHeight);
ctx.globalCompositeOperation = 'source-over';
```

#### layer-panel-renderer.js の確認

サムネイルimgタグのスタイルに`object-fit: contain`が設定されており、
それによる余白部分が灰色に見える問題を確認する。

修正方法：サムネイルコンテナの背景色をチェッカーパターン（透明を示す）にする。
**インラインスタイル禁止のため、CSSクラスを`main.css`に追加し、クラスで制御すること。**

`main.css`に追加するクラス例：

```css
/* サムネイルの透明部分をチェッカーパターンで表示 */
.layer-thumbnail-wrapper {
    background-image:
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    background-color: #fff;
}
```

### 受け入れ条件

- [ ] 通常レイヤー（透明）のサムネイルが黒くならない
- [ ] 透明部分がチェッカーパターンで表示される（または透明のまま）
- [ ] 背景レイヤーのサムネイルは背景色が正しく表示される
- [ ] `npm run build` が通る

---

## 作業後に必ず実施すること

1. `npm.cmd run build`（または`npm run build`）を実行してエラーゼロを確認
2. `tegaki_work/PROGRESS.md`を更新する（作業内容・結果・残課題を記録）
3. `tegaki_work/PEN_PROGRESS.md`のSTEP 1.5セクションを実装完了状態に更新する

---

## スコープ外（今回は絶対に触らない）

- `stroke-renderer.js`のアルゴリズム変更（STEP 2スタンプエンジンは別フェーズ）
- `brush-core.js`の描画ロジック変更
- `webgl2/`ディレクトリ以下
- `animation-system.js`等のタイムライン関連
- `history.js`のロジック変更
- TEGAKI.mdに「凍結中」とあるWebGPU/SDF/MSDF系

---

## 補足：各タスクの依存関係

```
TASK 1（LazyBrush接続）  → 独立。いつでも着手可
TASK 2（リサイズ）       → 独立。いつでも着手可
TASK 3（液タブ）         → TASK 1完了後の方が望ましい（ログが増えて診断しやすい）
TASK 4（サムネイル）     → 独立。スコープが小さく安全
```

推奨順序：TASK 1 → TASK 2 → TASK 4 → TASK 3（TASK 3は実機確認が必要なため最後）

---

*作成: Claude / 日付: 2026-05-29*
