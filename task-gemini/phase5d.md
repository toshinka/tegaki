# Phase 5d — 選択範囲MVPと変形統合

更新日: 2026-06-19

## 前提

Phase 5cを完了し、VキーLayer変形のpreview / confirm / cancel / History境界が確認できていること。
Phase 5cで重大なラスター確定不具合が残った場合、本Phaseを開始しない。

## 目的

最初のpixel selectionとして矩形選択を実装する。
選択範囲の移動・変形をPhase 5cのtransform sessionへ接続し、Layer全体変形とは対象だけが異なる設計にする。

## 調査時点で判明していること

- 現在の「選択」はLayerSystemの複数Layer選択であり、pixel selectionではない。
- lassoという名称の既存実装は塗りつぶし系で、selection maskではない。
- selection bounds / mask / marquee / clipboardの共通基盤は未実装。
- 最初から投げ縄、自動選択、featherまで含めると変形・履歴・合成の不具合を切り分けにくい。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `task-gemini/phase5c.md`
5. Phase 5c完了時の変形監査結果
6. `開発用資料保管庫/proposals/01_描画・編集・出力.md`
7. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
8. Layer transform、History、RenderTexture、clipboard関連実装

## Task 1 — Selection stateの最小設計

selection stateは最低限次を持つ。

- 対象Layer ID。
- 矩形bounds。
- maskまたは矩形maskを生成できる情報。
- active / inactive。
- transform session中か。
- 選択解除時のcommit / cancel規則。

条件:

- Layerの複数選択stateと名称・責務を混同しない。
- DOMだけを正本にしない。
- selection overlayは描画内容へ焼き込まない。
- Layer切替、削除、project load、canvas resize時の失効規則を決める。

## Task 2 — 矩形選択UI

- pointer dragで矩形範囲を作成する。
- canvas外へdragしてもboundsをcanvas内へclampする。
- selection border / marqueeをoverlay表示する。
- Escapeまたは明示操作で解除できる。
- selection tool中は描画strokeを開始しない。
- zoom、pan、表示反転中もpointer座標が正しい。

見た目はCSS classまたは描画overlayで管理し、大量のinline styleを追加しない。

## Task 3 — 選択pixelの移動と変形

Phase 5cのtransform sessionへ次を接続する。

- 選択pixelの移動。
- scale。
- rotate。
- horizontal / vertical flip。
- confirm。
- cancel。

重要条件:

- selection外pixelは変化しない。
- preview中に元pixelと移動pixelが二重表示されない。
- confirm時のresampleは1回にする。
- cancelで開始時snapshotへ戻る。
- 1回のconfirmを1つのUndo単位にする。
- VキーのLayer全体変形と同じハンドル・数学を再利用する。

## Task 4 — 基本編集操作

MVPに含める:

- selection内削除。
- selection内copy。
- pasteしたpixelを新しいfloating selectionとして配置。
- selection解除時のcommit。

最初の実装対象は通常Raster Layerとする。
CAF internal Layerは、同じRenderTexture / History adapterで安全に扱えることを確認できた場合のみ同Phaseへ含める。無理に同時対応せず、制約を明記して後続へ送る。

## Task 5 — 状態遷移と履歴

最低限次を確認する。

- selection作成 → 移動 → confirm → Undo → Redo。
- selection作成 → transform → cancel。
- copy → paste → 移動 → confirm。
- selection中のLayer切替。
- selection対象Layerの削除。
- project save前のfloating selection処理。

未確定pixelを黙って消さない。
save時は自動commitするかsaveを止めるかを明示し、一貫させる。

## 対象外

- 自由投げ縄selection。
- 色域・自動選択。
- feather、境界ぼかし、selection拡張・縮小。
- 複数Layerを横断するpixel selection。
- perspective、mesh、warp。
- animation Frame間のselection追跡。

## 受け入れ条件

- 通常Raster Layerで矩形選択を作成し、選択pixelだけを移動・変形できる。
- confirm / cancel / Undo / Redoでpixel欠落や二重化がない。
- copy / pasteしたpixelをfloating selectionとして配置できる。
- pan、zoom、Phase 5cの表示反転中もselection座標が一致する。
- VキーLayer全体変形とselection変形が同じtransform sessionを使う。
- Layer selectionとpixel selectionのstateが混線しない。
- CAF未対応ならUI上で誤って使える状態にせず、後続条件を記録する。

## 検証

- 不透明pixel、半透明pixel、空白を含む矩形。
- canvas端を含む矩形。
- clipping対象Layer。
- 拡大、pan、表示反転状態。
- confirm / cancel / Undo / Redoの反復。
- save / load前後の未確定selection規則。

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` の生成差分を残さない。

## 完了報告

`tegaki_work/PROGRESS.md` へ以下を記録する。

- selection stateとoverlayの正本。
- transform sessionとの接続方法。
- Historyとsave時の未確定selection規則。
- CAF internal Layer対応の有無と残件。
