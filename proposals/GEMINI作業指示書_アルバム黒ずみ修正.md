# GEMINI作業指示書 — アルバム繰り返し保存時の黒ずみ修正

> 作成: Claude (2026-05-20)
> 対象フェーズ: Phase 1c 追修正
> 難易度: 中（ファイルを特定してから小さく修正するだけ）

---

## 作業前に必ず読むこと

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`

---

## 症状

アルバムに保存 → ロード → また保存、を繰り返すと、
ブラシ描線の縁が **徐々に黒ずんで**いく。
（初回保存画像と比べて、2回・3回目のロード後は縁がはっきり暗くなる）

---

## 原因（変更前に必ず理解すること）

### プリマルチプライドアルファの二重変換

Pixi.js は GPU 内部で **プリマルチプライドアルファ**（Premultiplied Alpha）形式でピクセルを管理している。

```
プリマルチプライド形式:
  本来の色: R=139, G=0, B=0, A=100（40%透明の暗赤）
  GPU内部:  R=55,  G=0, B=0, A=100  ← RGBがアルファ倍された値
```

`renderer.extract.canvas()` や `extract.pixels()` で取り出すと、
GPU 内部のプリマルチプライド値がそのまま Canvas の ImageData に入る。

これを `canvas.toDataURL('image/png')` で PNG にすると、
PNG 形式は**ストレートアルファ前提**なので、**暗いRGB値のまま保存**される。

```
保存される PNG: R=55, G=0, B=0, A=100   ← 間違い（本来は R=139 のはず）
```

この PNG を Pixi がテクスチャとして読み込むとき、
「ストレートアルファの PNG だ」と判断して再度プリマルチプライドに変換する。

```
Pixi 読み込み後: R=55*(100/255)=21, G=0, B=0, A=100  ← さらに暗くなった！
```

これを繰り返すたびに縁が暗くなっていく。

### 修正の方針

`extract.canvas()` 呼び出し直後に **アンプリマルチプライ**処理を挟む。
（プリマルチプライドな値を → ストレートアルファな値に戻す）

---

## 調査ステップ（実装前に必ず行う）

### Step 1: `project-manager.js` を探す

```bash
rg -l "exportProject\|loadProject\|serializeLayer\|layerToDataURL\|renderTexture.*toDataURL\|extract.*canvas\|extract.*pixels" tegaki_work/
```

ヒットしたファイルを全て開き、以下を確認する：

- レイヤーの `renderTexture` を PNG/dataURL として取り出している箇所
- dataURL や base64 文字列を Pixi テクスチャとして読み込んでいる箇所

**→ 発見したファイルと行番号を PROGRESS.md にメモしてから修正に入ること。**

### Step 2: album-popup.js のフォールバックを確認

`ui/album-popup.js` の `_captureCurrentThumbnail()` 末尾の fallback パス：

```javascript
// ← ここを確認
const canvas = this.app.renderer.extract.canvas({
    target,
    clearColor: '#00000000'   // 透明背景のまま extract している
});
return canvas?.toDataURL?.('image/png') || null;
```

透明背景で `extract.canvas()` → そのまま `toDataURL` しているため、
プリマルチプライドな値が PNG に書き込まれている。

---

## 修正内容

### 修正A: `export-manager.js` に共通ヘルパー関数を追加

`system/export-manager.js` の `renderToCanvas()` メソッドの**直前**に
以下のプライベートメソッドを追加する（クラス内に追加すること）。

**追加場所**: `renderToCanvas(options = {}) {` の直前

```javascript
/**
 * Canvas の ImageData をアンプリマルチプライドに変換する
 * Pixi の extract.canvas() はプリマルチプライド値をそのまま返すため、
 * PNG 保存前に必ずこの関数を通すこと。
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement} 同じ canvas オブジェクト（破壊的変更）
 */
_unpremultiplyCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a > 0 && a < 255) {
            // プリマルチプライドを元の RGB 値に戻す
            d[i]     = Math.min(255, Math.round(d[i]     * 255 / a));
            d[i + 1] = Math.min(255, Math.round(d[i + 1] * 255 / a));
            d[i + 2] = Math.min(255, Math.round(d[i + 2] * 255 / a));
        }
        // a === 0  → R/G/B は 0 のまま（完全透明なので触らない）
        // a === 255 → すでにストレートアルファと同値なので触らない
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
```

---

### 修正B: `renderToCanvas()` の return 前に呼び出す

`system/export-manager.js` の `renderToCanvas()` メソッド内、
`renderTexture.destroy(true);` の直後、`return canvas;` の直前に
以下の1行を追加する。

**変更前（最後の4行）:**
```javascript
        renderTexture.destroy(true);
        return canvas;
    }
```

**変更後:**
```javascript
        renderTexture.destroy(true);
        this._unpremultiplyCanvas(canvas);  // ← この1行を追加
        return canvas;
    }
```

---

### 修正C: `album-popup.js` フォールバックの透明背景を白に変更

`ui/album-popup.js` の `_captureCurrentThumbnail()` 内、
fallback の `extract.canvas()` 呼び出しを変更する。

**変更前:**
```javascript
    const canvas = this.app.renderer.extract.canvas({
        target,
        clearColor: '#00000000'
    });
    return canvas?.toDataURL?.('image/png') || null;
```

**変更後:**
```javascript
    const canvas = this.app.renderer.extract.canvas({
        target,
        clearColor: [1, 1, 1, 1]   // 白背景に変更（透明背景での抽出を避ける）
    });
    return canvas?.toDataURL?.('image/png') || null;
```

> **理由**: 白背景にすると全ピクセルが `A=255`（完全不透明）になり、
> プリマルチプライド値 = ストレートアルファ値 となるため劣化が起きない。

---

### 修正D: `project-manager.js`（Step 1 で発見した場合）

Step 1 で見つけたファイルに `extract.canvas()` または `extract.pixels()` 呼び出しがあれば、
**`export-manager.js` の `_unpremultiplyCanvas` を再利用**する。

もし `project-manager.js` が `ExportManager` のインスタンスを参照しているなら：

```javascript
// project-manager.js 内で
const canvas = app.renderer.extract.canvas({ target: layerRenderTexture });
window.exportManager._unpremultiplyCanvas(canvas);  // ← 追加
const dataUrl = canvas.toDataURL('image/png');
```

もし `project-manager.js` が独立していて `exportManager` を参照できないなら、
同じ `_unpremultiplyCanvas` 関数をそのファイルにも**コピー**して追加する
（関数の中身は全く同じでよい）。

---

## やってはいけないこと（禁止事項）

- `export-manager.js` の `renderToCanvas()` 以外の既存メソッドを変更しない
- `album-popup.js` の `_captureCurrentThumbnail()` の主経路（`exportManager.generatePreview` を呼んでいる部分）は変更しない
- `thumbnail-system.js` には今回一切手を触れない
- `layer-system.js` には今回一切手を触れない
- `_unpremultiplyCanvas` の中で `console.log` を大量に追加しない

---

## 変更するファイルのまとめ

| ファイル | 変更内容 |
|---|---|
| `system/export-manager.js` | `_unpremultiplyCanvas()` メソッド追加 + `renderToCanvas()` 末尾に1行追加 |
| `ui/album-popup.js` | フォールバックの `clearColor` を白に変更（1箇所） |
| `system/project-manager.js`（存在する場合） | `extract.canvas()` 直後にアンプリマルチプライを適用 |

---

## 確認方法

1. `npm.cmd run build` でビルドエラーがないことを確認する
2. ブラウザでツールを開き、ブラシで円を描く
3. アルバムに保存 → ロード → 再度保存、を **3回以上繰り返す**
4. アルバムギャラリーのサムネイル（または実キャンバスの描線）を見比べて、
   縁の黒ずみが出なくなっていれば修正完了

---

## PROGRESS.md への記載内容（作業後に追記すること）

```
### YYYY-MM-DD アルバム黒ずみ修正
- system/export-manager.js: `_unpremultiplyCanvas()` 追加、`renderToCanvas()` に適用
- ui/album-popup.js: フォールバックの clearColor を白に変更
- (project-manager.js があれば): extract.canvas 直後にアンプリマルチプライ適用
- ビルド確認: OK
- 動作確認: アルバム3回ループで黒ずみ消失を目視確認
```

---

## Claudeへ（作業後に報告すること）

- `project-manager.js` が存在したか・どこにあったか
- Step 1 の `rg` で発見した「extract / pixels / dataURL」関連の全ファイル
- 修正後、黒ずみが残る場合は「ロード直後のキャンバス描線」と「ロード前の描線」の
  スクリーンショットを添えて報告すること
