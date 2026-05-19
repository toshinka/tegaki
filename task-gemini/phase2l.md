# Phase 2l — 透明キャンバス市松表示 / 背景非表示時の見た目整備

> Phase 2k でキャンバス上限とカメラ拡縮範囲は一区切り。
> Phase 2l は、背景レイヤー非表示時に透明キャンバスを市松模様で示すための小フェーズ。

---

## 背景

オーナーから以下の追加メモがある。

- レイヤー背景を消すとキャンバス背景が貫通するが、透明を表す市松模様にしたい。
- 白とグレーではなく、Tegaki の既定色である `cream` と `lightMedium` の組み合わせにしたい。

既存コードには `system/checker-utils.js` と `LayerSystem.attachCheckerPatternToWorld()` があり、市松表示の土台はすでに存在する。
初回はこの既存経路を確認し、色と visibility 同期を小さく整える。

---

## 目的

- 背景レイヤー非表示時に、キャンバス範囲だけ市松模様を表示する。
- 背景レイヤー表示時は、従来通り背景色を表示する。
- 市松色を白/グレーではなく、Tegaki既定色の `cream + lightMedium` 系にする。
- リサイズ後も市松範囲がキャンバスサイズに追従するか確認する。
- 保存/読み込みやサムネイルに不要な副作用を出さない。

---

## Gemini に任せる範囲

Gemini は初回、棚卸しと記録を優先する。

- 関係ファイルの読み取り。
- `rg` による checker / background visibility / resize 経路の検索。
- `PROGRESS.md` への調査結果追記。
- 低リスクな色変更や visibility 同期の小修正。

Gemini は独自判断でレイヤー構造、保存形式、描画パイプラインを変更しない。

---

## 調査対象候補

- `system/checker-utils.js`
- `system/layer-system.js`
- `system/camera-system.js`
- `system/drawing/thumbnail-system.js`
- `config.js`
- `styles/main.css`
- `ui/layer-panel-renderer.js`（背景 visibility 操作の確認のみ）

---

## 調査観点

1. **市松生成**
   - キャンバス用 checker の色とサイズ。
   - 現在の色が `cream + background` になっていないか。
   - `lightMedium` 相当へ変える場合の最小差分。

2. **表示同期**
   - 背景レイヤー visibility が false の時だけ checker が見えるか。
   - 背景レイヤー visibility を戻すと checker が消えるか。
   - 背景レイヤーの目アイコン操作と同期しているか。

3. **リサイズ**
   - `camera:resized` 後に checker のサイズが更新されるか。
   - 2500px上限でも必要以上に重くならないか。

4. **副作用確認**
   - 背景レイヤー自体の保存/読み込みに影響しないか。
   - サムネイルの checker とキャンバス表示の checker を混同していないか。
   - PNG出力時に市松が混ざらないか。市松は透明表示用のUIで、作品データとして焼き込まない。

---

## Phase 2l 初回の完了条件

- 現在の checker 経路と色のズレが `PROGRESS.md` に整理されている。
- 低リスクで済む場合、市松色が `cream + lightMedium` 系へ変更されている。
- 背景表示/非表示、リサイズ後の表示が確認対象として記録されている。
- コード変更した場合のみ `npm.cmd run build` が成功している。

---

## Codex 判断へ戻すもの

- レイヤー container 構造の変更。
- 背景レイヤーの保存形式変更。
- サムネイル生成の大きな作り替え。
- PNG/アルバム出力経路の変更。
- 50行を超える修正。
