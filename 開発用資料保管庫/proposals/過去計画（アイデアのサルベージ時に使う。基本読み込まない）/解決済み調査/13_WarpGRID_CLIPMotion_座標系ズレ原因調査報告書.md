# Warp GRID / CLIP Motion 描画物変形時の座標ズレ原因調査報告書

更新日: 2026-07-22  
作成対象: `開発用資料保管庫/proposals/13_WarpGRID_CLIPMotion_座標系ズレ原因調査報告書.md`  
関連モジュール: `ui/animation-table-popup.js`, `ui/warp-grid-overlay.js`, `system/animation/timeline-frame-compositor.js`, `system/animation/warp-grid-rasterizer.js`

---

## 1. 調査概要と結論

アニメーションテーブルにおいて CLIP Motion（Transform）および Warp GRID（Deformer）による描画物変形を適用した際、**キャンバス上の見た目がズレるが、GIF動画出力は正常な位置で出力される場合がある** 現象について詳細な点検・調査を行いました。

### 結論（根本原因）
原因は **キャンバスプレビュー表示部（PixiJS）における Deformer プレビュー用 `Sprite` の原点オフセットの扱いと `CLIP Motion` トランスフォーム適用の計算不一致** です。

1. **`_createDeformerPreviewNode` のオフセット扱い**  
   Warp GRID 適用時、描画物および GRID のバウンディングボックス (`outputBounds`) だけをクロップしたオフスクリーンテクスチャから Pixi `Sprite` を作成し、その初期位置を Project 座標 `(outputBounds.x, outputBounds.y)` に設定しています。
2. **`_applyClipMotionToPreviewNode` による上書き**  
   プレビューノード生成直後に呼ばれる `_applyClipMotionToPreviewNode` は、引数の `node` を「原点が `(0, 0)` の Container」と前提し、`node.position` を `(pivotX + transform.x, pivotY + transform.y)` で強引に上書きし、`node.pivot` を Project 座標のピボット位置 `(pivotX, pivotY)`（通常 200, 200）にセットしています。
3. **表示座標の計算不一致（ズレの発生）**  
   Sprite のテクスチャ画像自体の (0, 0) は Project 座標 `(outputBounds.x, outputBounds.y)` から始まっているため、テクスチャ上の `(pivotX, pivotY)` ピクセルは Project 座標 `(pivotX + outputBounds.x, pivotY + outputBounds.y)` に位置します。  
   しかし PixiJS の表示処理によってテクスチャ上の `(pivotX, pivotY)` が画面上の `position` に一致するように描画されるため、画像全体が **`(-outputBounds.x, -outputBounds.y)` だけ手前（左上方向）に平行移動してズレて表示** されます。

---

## 2. なぜ「キャンバス表示はズレるが、GIF出力は正常」になるのか

| 処理経路 | 処理内容 | 座標結果 |
| :--- | :--- | :--- |
| **経路A: GIF / APNG 動画出力**<br>(`TimelineFrameCompositor.js`) | CPUラスタライザで変形した `surface.canvas` を、2D Canvas Context へ描画する際、<br>`ctx.drawImage(canvas, bounds.x - pivotX, bounds.y - pivotY)`<br>のように `bounds.x` (`outputBounds.x`) オフセットを明示的に加減算して描画しています。 | **正常**<br>（オフセットが補正されるため正確な座標で出力される） |
| **経路B: DOM SVG ガイド線**<br>(`warp-grid-overlay.js`) | `_getWarpGridWorldPoints()` で GRID の点から Project 座標 `(bounds.x + point.x * bounds.width, ...)` を計算し、`createCenteredTransformMatrix` で Transform 行列を掛け合わせた正しいワールド座標へガイドを描画しています。 | **正常**<br>（本来の正しい位置に格子やポイントが表示される） |
| **経路C: キャンバス画像表示**<br>(`animation-table-popup.js`) | `_createDeformerPreviewNode` で作られた Pixi `Sprite` の初期位置 `(outputBounds.x, outputBounds.y)` が `_applyClipMotionToPreviewNode` によって直後に消失・破壊され、`(-outputBounds.x, -outputBounds.y)` の表示位置ズレが発生します。 | **ズレ発生**<br>（キャンバス上で絵だけがガイド線からずれる） |

---

## 3. ズレが発生するパイプラインの数学的・コードレベルの検証

### (1) パイプラインにおける変形評価順序
Tegaki の描画変形契約は以下の評価順序となっています：
$$\text{Output Surface} = \text{Clip Motion (Transform)} \circ \text{Warp Grid (Deformer)} (\text{Raster Image})$$

1. **Warp Grid (Deformer)**:  
   描画スナップショットの局所領域（`bindBounds`）を対象に、16点（または可変点）の正規化座標（$0.0 \sim 1.0$）をもとにメッシュ変形し、オフセット `outputBounds` を持つ最小ラスター表面へ書き出す。
2. **Clip Motion (Transform)**:  
   キャンバス全体（通常 400x400）のアンカー `(anchorX, anchorY)`（ピボット $P = (\text{width} \cdot \text{anchorX}, \text{height} \cdot \text{anchorY})$）を中心として、平行移動 $(x, y)$、拡大縮小 $(\text{scaleX}, \text{scaleY})$、回転 $\theta$ を適用する。

---

### (2) プレビューノード表示計算におけるコードの問題点

#### `ui/animation-table-popup.js` 1474行目〜1609行目 (`_createDeformerPreviewNode`)
```javascript
const sprite = new Sprite(outputTexture);
sprite.position.set(outputBounds.x, outputBounds.y);
return sprite;
```
ここでは、変形結果が描画された `outputTexture` (サイズ: `outputBounds.width` × `outputBounds.height`) から Pixi `Sprite` を生成し、Project 座標上の配置位置として `position = (outputBounds.x, outputBounds.y)` を設定しています。

#### `ui/animation-table-popup.js` 1434行目 & 2059行目 (`_applyClipMotionToPreviewNode`)
```javascript
_applyClipMotionToPreviewNode(node, clip, frameIndex) {
    ...
    const pivotX = width * transform.anchorX; // 例: 200
    const pivotY = height * transform.anchorY; // 例: 200
    node.pivot.set(pivotX, pivotY);
    node.position.set(pivotX + transform.x, pivotY + transform.y);
    ...
}
```
ここで、`node`（先ほどの `Sprite`）に対し、`position` を `(pivotX + transform.x, pivotY + transform.y)` で直接上書きしています。

#### 座標変換における不一致の証明
PixiJS の `Sprite` のワールド座標変換式は以下の通りです：
$$W = M_{\text{transform}} \cdot (L - \text{node.pivot}) + \text{node.position}$$
ここで $L$ は `Sprite` テクスチャ内のローカルピクセル座標です。

`outputTexture` のローカルピクセル $(0, 0)$ は、Project 座標の $(outputBounds.x, outputBounds.y)$ に対応します。  
したがって、Project 座標 $P = (P_x, P_y)$ に対応するテクスチャローカル座標 $L$ は：
$$L = (P_x - outputBounds.x, P_y - outputBounds.y)$$

`_applyClipMotionToPreviewNode` によって $\text{node.pivot} = (pivotX, pivotY)$ および $\text{node.position} = (pivotX + x, pivotY + y)$ がセットされた場合、変換式は以下のようになります：
$$W = M_{\text{transform}} \cdot ((P_x - outputBounds.x - pivotX), (P_y - outputBounds.y - pivotY)) + (pivotX + x, pivotY + y)$$

本来、Project 座標のピボット点 $P = (pivotX, pivotY)$ がスクリーン上の $(pivotX + x, pivotY + y)$ に配置されるべきですが、上記に $P = (pivotX, pivotY)$ を代入すると：
$$W = M_{\text{transform}} \cdot (-outputBounds.x, -outputBounds.y) + (pivotX + x, pivotY + y)$$
回転・拡縮が単位行列（Identity）の場合：
$$W = (pivotX + x - outputBounds.x, pivotY + y - outputBounds.y)$$

この結果、表示位置が **`(-outputBounds.x, -outputBounds.y)` だけ位置ズレを起こします**。

---

### (3) なぜ GRID 設定時にズレが顕在化するのか
- **GRID 未設定時（通常プレビュー）**  
  `previewNode` は `Container` (`root`) であり、その中には個々のレイヤースプライトが絶対 Project 座標 `(rasterBounds.x, rasterBounds.y)` で配置されています。そのため `root` 自身のローカル原点 `(0, 0)` は Project 座標の `(0, 0)` と完全に一致しており、`root.pivot = (200, 200)` に設定してもズレは発生しません。
- **GRID 設定時（Deformer プレビュー）**  
  `_createDeformerPreviewNode` が呼ばれることで、`previewNode` が `Container` からクロップされた `Sprite(outputTexture)` に置き換わります。
- 描画画像や Bind 枠がキャンバス全体 (400x400) でない場合（画面の一部や小サイズレイヤー、または局所 GRID 設定時）、`outputBounds.x` や `outputBounds.y` が 0 でなくなります（例: `x=120, y=80`）。
- GRID を ON にした瞬間に `Container` 経路から `Sprite` 経路に切り替わり、`(-120, -80)` の表示飛び（跳躍ズレ）が発生します。
- ワールド座標系で正しく描画されているガイド線 (SVG Overlay) と、`-outputBounds` ズレを起こした Pixi スプライトの見た目が食い違うことになります。

---

## 4. 解決策・修正提案

本問題を解消するための改修方針案を提示します。

### 修正案A: 原点 `(0, 0)` を保証する `Container` ラッパーの導入（推賞）

`_createDeformerPreviewNode` から返すノードを単体 `Sprite` にするのではなく、Project 座標の原点 `(0, 0)` を維持する `Container` でラップし、その中に `Sprite` を `(outputBounds.x, outputBounds.y)` で配置します。

```javascript
// ui/animation-table-popup.js _createDeformerPreviewNode 内
const sprite = new Sprite(outputTexture);
sprite.eventMode = 'none';
sprite.position.set(outputBounds.x, outputBounds.y);
sprite.alpha = alpha;
sprite._tegakiOwnedPreviewTexture = outputTexture;

// 原点 (0, 0) を保持する wrapper Container を生成
const wrapperNode = new Container();
wrapperNode.eventMode = 'none';
wrapperNode.addChild(sprite);
wrapperNode._tegakiWarpGridPreview = true;

return wrapperNode;
```

#### メリット
- `wrapperNode` 自身の原点が Project 座標の `(0, 0)` と一致するため、既存の `_applyClipMotionToPreviewNode` の `pivot`・`position`・`scale`・`rotation` 処理を一切変更することなく、Deformer なしの通常 Container と全く同じ基準で計算・表示可能になります。
- 動画出力 (`TimelineFrameCompositor`) やガイド表示 (`WarpGridOverlay`) と完全に見た目が一致するようになります。

---

### 修正案B: `_applyClipMotionToPreviewNode` 内でのオフセット補正

`Sprite` ノード自身が `_tegakiWarpGridPreview` を持っている場合、`pivot` の設定時に `outputBounds` オフセット分を減算して補正します。

```javascript
_applyClipMotionToPreviewNode(node, clip, frameIndex) {
    if (!node || !clip) return;
    const frame = Number.isInteger(frameIndex) ? frameIndex : this.model.playback.currentFrame;
    const transform = sampleClipTransform(clip, frame);
    const canvasConfig = window.TEGAKI_CONFIG?.canvas || {};
    const width = Math.max(1, Number(canvasConfig.width) || 400);
    const height = Math.max(1, Number(canvasConfig.height) || 400);
    
    let pivotX = width * transform.anchorX;
    let pivotY = height * transform.anchorY;

    // Sprite直接の場合はテクスチャの開始オフセット分をピボットから引く
    if (node._tegakiOutputBounds) {
        pivotX -= node._tegakiOutputBounds.x;
        pivotY -= node._tegakiOutputBounds.y;
    }

    node.pivot.set(pivotX, pivotY);
    ...
}
```

---

## 5. まとめ・点検チェックリスト

| 点検項目 | 状況 | 影響範囲 |
| :--- | :--- | :--- |
| **GIF / APNG 出力** | 正常 | `TimelineFrameCompositor` 内の `_drawTransformedClip` で `bounds.x` を補正済みのため影響なし。 |
| **GRID Overlay (DOM)** | 正常 | `_getWarpGridWorldPoints` で Project 座標から直に Matrix 適用しているため影響なし。 |
| **キャンバス内プレビュー** | **不具合あり** | `_createDeformerPreviewNode` で作成された Sprite の `position` が `_applyClipMotionToPreviewNode` で破壊され、`outputBounds` 分ズレる。 |
| **修正による影響リスク** | 低 | 修正案Aを適用することで、プレビューノードの親座標系契約が Deformer の有無によらず統一されるため、他機能への副作用を最小限に抑えられる。 |

本報告書を開発用資料保管庫 (`開発用資料保管庫/proposals/13_WarpGRID_CLIPMotion_座標系ズレ原因調査報告書.md`) に記録いたしました。次Phaseでの修正対応の参考資料としてご活用ください。

---

## 6. Codex実装照合（2026-07-22）

- 原因分析を実コードと照合し、修正案Aを採用した。`_createDeformerPreviewNode()`はProject原点の`Container`を返し、cropped Spriteだけを`outputBounds.x / y`へ配置する。RenderTexture所有・破棄印はwrapperへ置く。
- WARP tab中のCanvas入力がMotion gestureへ落ちる別経路も確認したため、Motion Canvas操作をMotion tabへ限定し、WARP tool再選択時にoverlayを再構築する境界を追加した。
- Browser固定操作ではGRID作成直後の表示、再生中overlay、再生停止後の左上GRID移動、途中Frame BRUSH自動keyを確認し、Motion keyは0のまま、console errorも0件だった。
- 追加監査で、Pixi previewのdestination Meshは元Rasterへsource-overされる一方、CPU/Bakeはsample RGBAを直接上書きしていた別問題を特定した。透明・半透明sourceがBind外の既存destinationへ重なる場合に限って下絵を消すため、CPUもsource-overへ統一した。共有triangle edgeだけを半開coverageで片側へ帰属させ、triangle内部の実際のself-overlapはPixi同様に複数回合成する。
- Browserでは局所GRIDの透明領域を既存図形へ重ね、preview・再生・5 Frame Bakeで下絵保持を確認した。GIF / APNG / 実制作Rasterの最終外周alphaはオーナー実機受入を継続する。
