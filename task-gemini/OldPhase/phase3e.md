# Phase 3e — 通常バケツ強化

> Phase 3c で通常バケツの閉領域 flood fill、Phase 3d で投げ縄塗りが入った。
> 次は投げ縄・図形塗りを増やす前に、通常バケツ自体をどこまで強くできるかを確認する。

---

## 目的

- 通常バケツの隙間漏れを減らす方向を検討し、最初の小さな実装候補を決める。
- 表示中レイヤー参照、現在レイヤー参照、線画下レイヤーへ塗る方式の実装コストを整理する。
- 投げ縄塗り、多角形塗り、楕円塗り、矩形塗りを増やすべきか、選択範囲ツールと統合すべきかを判断しやすくする。

---

## 背景判断

- 投げ縄塗りは、線に隙間がある場合の暫定補助として有効。
- ただし多角形、楕円、矩形塗りへ広げると、機能の性質は選択範囲ツールに近くなる。
- 通常バケツが gap close、表示中レイヤー参照、線画下塗りに対応できれば、「選択範囲 + バケツ」で代替できる機能が増える。
- そのため、次は図形塗りの追加ではなく、通常バケツの強化方針を優先する。

---

## 棚卸し対象

```text
tegaki_work/system/drawing/fill-tool.js
tegaki_work/system/drawing/brush-core.js
tegaki_work/system/layer-system.js
tegaki_work/system/drawing/thumbnail-system.js
tegaki_work/system/project-manager.js
tegaki_work/ui/quick-access-popup.js
tegaki_work/config.js
```

確認コマンド:

```powershell
rg -n "fill|flood|lasso-fill|extract.pixels|createLayerRasterSnapshot|restoreLayerRasterSnapshot|visible|clipping|RenderTexture" tegaki_work
```

---

## 検討項目

### 1. gap close

- 小さな隙間を壁として閉じる方法を調べる。
- 初回は設定UIを増やさず、固定しきい値で試せるか確認する。
- 高コストな画像処理や大きなピクセルバッファ加工が必要なら Codex 判断へ戻す。

### 2. 表示中レイヤー参照

- 塗り先はアクティブレイヤーのまま、境界判定だけ表示中レイヤー合成を参照できるか確認する。
- 背景レイヤーは特殊扱いを維持する。
- 透明市松やUI補助表示を参照画像へ混ぜない。

### 3. 線画下レイヤーへ塗る

- 線画レイヤーを参照し、下の塗りレイヤーへ焼き込む導線を検討する。
- 初回では保存形式やレイヤー構造を変えない。

### 4. 投げ縄塗りの扱い

- 現時点では暫定補助ツールとして残す。
- アイコンが増えて圧迫した場合は、`G` キーまたはバケツ系アイコン再押しで `fill` / `lasso-fill` を循環切替する案を検討する。
- 多角形、楕円、矩形塗りは、選択範囲ツールのPhaseでまとめて扱う候補にする。

---

## Geminiに任せる範囲

- `fill-tool.js` の現状整理。
- gap close の方式候補とリスク整理。
- 表示中レイヤー参照に必要なデータ取得経路の棚卸し。
- `PROGRESS.md` への調査結果記録。
- 50行以内の低リスクなログ/コメント/ヘッダー同期。

Gemini が独自判断で以下をしないこと。

- 表示中レイヤー合成参照の本実装。
- 保存形式や履歴形式の変更。
- UI追加。
- 多角形、楕円、矩形塗りの実装。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路の復活。

---

## Codex判断へ戻す条件

- `fill-tool.js` だけでは完結せず、`layer-system.js`、履歴、保存、UIへ広く波及する。
- gap close の方式が重く、操作ごとに大きなピクセル処理が必要になる。
- 表示中レイヤー参照で premultiplied alpha、上下反転、背景混入の問題が出る。
- ツール数増加によりクイックパネル再設計が必要になる。

---

## 完了条件

- 通常バケツ強化の実装順が決まっている。
- 可能なら最初の小さな検証実装候補が1つに絞られている。
- gap close、表示中レイヤー参照、線画下塗りの優先度とリスクが `PROGRESS.md` に記録されている。
- 実装へ進む場合は、まず1つの小さな検証に限定する。
- `npm.cmd run build` が成功する。
