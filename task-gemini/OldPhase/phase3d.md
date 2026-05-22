# Phase 3d — 囲い塗り（投げ縄塗り）の実装準備

> Phase 3c で通常バケツは、クリック地点から閉領域だけを塗る Flood Fill MVP になった。
> ただし線に隙間がある場合は、仕様上その隙間から塗りが漏れる。Phase 3d では、その弱点を別操作で補う「囲い塗り（投げ縄塗り）」を検討する。

---

## 目的

- ユーザーがペンで範囲を囲み、その囲いの内側を現在色で塗れるようにする。
- Phase 3c のバケツ flood fill を壊さない。
- 隙間閉じアルゴリズムを無理に高度化する前に、明示的な範囲指定による塗りを試す。

---

## 初回方針

- まずは実装前の棚卸しを行う。
- 既存の PointerEvent、stroke-recorder、brush-core、fill-tool の責務を確認する。
- 新しい描画モード名は仮に `lasso-fill` とするが、既存ツール体系と衝突する場合はCodex判断へ戻す。
- UI追加は最小限にする。新アイコン追加やクイックパネル大型化はこのPhaseでは無理に行わない。

---

## 棚卸し対象

```text
tegaki_work/system/drawing/drawing-engine.js
tegaki_work/system/drawing/pointer-handler.js
tegaki_work/system/drawing/stroke-recorder.js
tegaki_work/system/drawing/brush-core.js
tegaki_work/system/drawing/fill-tool.js
tegaki_work/ui/quick-access-popup.js
tegaki_work/ui/ui-panels.js
tegaki_work/ui/dom-builder.js
tegaki_work/config.js
```

必ず `rg` で既存の tool mode、EventBus、ショートカットを確認する。

```powershell
rg -n "fill|lasso|tool:|brush:mode|canvas:pointer|pointerdown|pointermove|pointerup|stroke:start|stroke:end" tegaki_work
```

---

## 実装候補

### 候補A: 別ツールとして投げ縄塗り

- ツールモード `lasso-fill` を追加。
- pointerdown から pointermove の座標列を保持。
- pointerup 時に閉じた多角形としてマスク化し、現在色で `RenderTexture` へ焼き込む。
- 履歴は Phase 3c と同じ `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()` を使う。

### 候補B: バケツの補助モード

- バケツ選択中に修飾キーを押している間だけ投げ縄塗りにする。
- UIを増やさずに済むが、液タブ操作で修飾キー前提になるため初回では慎重に扱う。

初回は候補Aを優先して検討する。

---

## 完了条件

初回棚卸しだけで止める場合：

- 実装対象ファイルとイベント経路が `PROGRESS.md` に整理されている。
- Codex判断が必要な点が明記されている。
- `npm.cmd run build` が成功する。

実装まで進める場合：

- 囲った範囲の内側が現在色で塗れる。
- ペン、消しゴム、エアブラシ、通常バケツを壊していない。
- Undo/Redo で塗り前後が戻る。
- サムネイルが更新される。
- `npm.cmd run build` が成功する。

---

## やらないこと

- 表示中レイヤー合成参照。
- gap close の本格アルゴリズム。
- カラーサークル、スポイト、クイックパネル全面スリム化。
- レイヤーパネル独自D&D。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路の復活。

---

## Codex判断へ戻す条件

- 新ツール追加が `drawing-engine.js`、`brush-core.js`、`fill-tool.js` の責務を大きくまたぐ。
- 既存のストローク開始/終了イベントを変える必要がある。
- 履歴や保存形式を変更したくなる。
- 100行を超える削除や主要クラス再構成が必要になる。
