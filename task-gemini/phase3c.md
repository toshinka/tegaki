# Phase 3c — 囲い塗りバケツMVP

> Phase 3b でクイックアクセスポップアップのレイアウト、ツール別プリセット、カラースロットは一区切り。
> Phase 3c では、現行バケツの「レイヤー全面塗り」から、クリック地点の閉領域だけを塗る最小実装へ進む。

---

## 目的

- 線で囲った領域の内側をクリックしたとき、内側だけが塗られるようにする。
- 例：`○` の内側でバケツを使うと、内側が塗られて `●` に近い見た目になる。
- 既存の PixiJS v8 + RenderTexture 焼き込み方式、Undo/Redo、サムネイル更新を維持する。

---

## 作業対象

```text
tegaki_work/system/drawing/fill-tool.js
tegaki_work/system/layer-system.js
tegaki_work/system/history.js
tegaki_work/system/drawing/thumbnail-system.js
tegaki_work/ui/quick-access-popup.js
tegaki_work/styles/main.css
```

主対象は `fill-tool.js`。他ファイルは、API確認・既存履歴/サムネイル経路の確認に留める。

---

## 現状

- `fill-tool.js` は Phase 1c で復旧済み。
- 現在の legacy 経路は、クリック位置に関係なくアクティブレイヤーの `RenderTexture` 全体を塗る。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は現フェーズでは使わない。
- `RenderTexture` サイズは `layerData.renderTexture.width/height` を優先する。

---

## 実装方針

### 1. 既存実装の検索と確認

実装前に必ず確認する。

```powershell
rg -n "FillTool|fill\\(|legacy-full|layer:filled|createLayerRasterSnapshot|restoreLayerRasterSnapshot|thumbnail:layer-updated" tegaki_work
```

確認観点：

- バケツ起動イベントは `brush:mode-changed` / `tool:changed` / `canvas:pointerdown` のどれで動いているか。
- 履歴は `createLayerRasterSnapshot()` と `_recordRasterFillHistory()` の既存経路を再利用できるか。
- サムネイル更新は既存の `thumbnail:layer-updated` と `requestThumbnailUpdate()` のどちらが現行経路か。

### 2. Flood fill MVP

- クリック地点 `localX/localY` を整数ピクセルへ変換する。
- アクティブレイヤーの `RenderTexture` からピクセルを取得し、同一領域を flood fill する。
- 境界判定は、初版では「現在レイヤーの不透明ピクセル」を壁として扱う。
- 塗り対象は、クリック地点と連結した透明または近似色領域に限定する。
- 塗り結果は mask 画像または `Graphics` 群として `RenderTexture` に焼き込む。

初版で重視すること：

- `○` の内側をクリックして内側だけが塗れる。
- 外側をクリックした場合は外側だけが塗れる。
- 閉じていない線は、隙間から漏れる挙動でよい。gap close は後続。

### 3. しきい値

初版では定数でよい。

```javascript
const FILL_ALPHA_THRESHOLD = 24;
const FILL_COLOR_TOLERANCE = 8;
```

- アンチエイリアス線の薄い縁を壁として扱うため、alpha しきい値を設ける。
- UI追加はしない。設定 popup やクイックパネルへ項目を増やさない。
- しきい値の調整が必要なら、`fill-tool.js` 内の局所定数にまとめる。

### 4. 履歴・保存・サムネイル

- 実装後も `Undo/Redo` で塗り前/塗り後が戻ること。
- `pathsData` 互換データは、既存の `fill_legacy` と同等の最小記録でよい。
- 塗り後にサムネイルが即時更新されること。
- 保存/アルバム/PNG出力形式は変更しない。

---

## Geminiに任せる範囲

- `fill-tool.js` の現状棚卸し。
- `RenderTexture` からピクセル取得できる既存APIの確認。
- flood fill MVP の局所実装案作成。
- `npm.cmd run build` の実行と `PROGRESS.md` への記録。

Gemini が独自判断で以下をしないこと。

- WebGPU / SDF / MSDF / WebGL2 Mesh 経路の復活。
- 表示中レイヤー合成参照。
- 線画下の別レイヤーへ塗る新仕様。
- gap close の本格実装。
- クイックパネルや設定 popup へのUI追加。
- `layer-system.js` や履歴形式の大規模改修。

---

## Codex判断へ戻す条件

- PixiJS v8 の `extract.pixels()` / `extract.canvas()` まわりで黒ずみ、上下反転、premultiplied alpha 問題が出る。
- flood fill のために描画データ形式や保存形式を変えたくなる。
- 表示中レイヤー参照や別レイヤー塗りを初版に入れたくなる。
- 100行を超える削除、主要クラス再構成、複数ファイルへまたがる履歴改修が必要になる。

---

## 完了条件

- `○` の内側クリックで内側だけが塗れる。
- 外側クリックで外側だけが塗れる。
- 全面塗りに戻らない。
- ペン、消しゴム、エアブラシ、ぼかし、通常バケツ起動が壊れていない。
- Undo/Redo で塗り前/塗り後が戻る。
- レイヤーサムネイルが塗り後に更新される。
- `npm.cmd run build` が成功する。
- `tegaki_work/PROGRESS.md` に結果、確認コマンド、残課題を記録する。

---

## 後続へ送ること

- 表示中レイヤー合成を参照した塗り。
- 線画レイヤーの下にある別レイヤーへ塗る動線。
- 隙間閉じ / gap close。
- 境界しきい値のUI。
- カラーサークルとスポイト。
- レイヤーパネル独自D&D再設計。

---

## アーカイブ運用メモ

- Phase 3b のバックアップはオーナーが手動取得済み。
- 次回以降、フェーズ完了バックアップは Codex がルートの `archive.bat [フェーズ名]` または `node archive.js [フェーズ名]` を実行して管理する。
- `archive.js` は `node_modules` と `dist` を除外する。既存コピー先がある場合は上書きせず停止するため、必要時だけオーナー確認後に `--force` を使う。
