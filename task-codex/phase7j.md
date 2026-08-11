# Phase 7j — Deformer SELECT Stage 2 / runtime shape selection

更新日: 2026-08-11
担当: SOL / XHigh（Gate・review）、限定実装はLUNA / MAXまたはSOL
状態: OPEN（Gate 0=`GO`、Stage A / B完了、SOL review 1=`A`、Owner一括確認待ち）

> Phase 7iはSOL review 4=`A`、Ownerまとめ確認待ちのままOPENを維持する。本PhaseはPhase 7iのMesh / Skin / 保存schemaへ依存せず、7iをcloseした扱いにしない。

## 1. 目的

Phase 7bで受入れたWARP `SELECT`のRECT runtime選択を、`RECT / CIRCLE / POLYLINE(LASSO)`へ拡張する。選択形状と選択indexは操作中だけのUI stateとし、既存Warp key、topology、History確定経路を唯一の正本として維持する。

## 2. Gate 0結果

- `warp-point-selection.js`はscreen-space hit判定とProject delta移動を分離済みで、fixed 4×4 / Control Mesh、CAF全体 / Folder別WARPを共有する。
- `AnimationTablePopup._warpPointSelection`はClip ID、Folder target ID、point count、topology signatureを照合し、target / topology変更時にclearする。Project / History snapshotへ保存しない。
- 空Canvas dragは`select-marquee`、選択point dragは`select-move`として分離済み。新形状はmarquee生成とhit判定だけを追加し、Pose commit / Historyは変更しない。
- `WarpGridOverlay`は`pointer-events:none`のdisplay-only SVG。marqueeを一つのSVG pathへ一般化しても入力正本にはならない。
- `M`はBRUSH中のmode巡回を所有する。SELECT中だけshape巡回を先に分岐し、BRUSH中と他toolからのBRUSH入口は維持できる。

判定は`GO`。新schema、EventBus、rasterizer、Mesh / Skin、soft weightを必要としない。

## 3. Stage A — pure shape helper

- RECT互換を維持したまま、screen-space circleと閉じたpolyline/lassoを正規化する。
- finite pointだけを扱い、circle境界とpolygon辺上を選択に含める。
- polylineはpointer pathを決定的な最小距離で間引き、3点未満・退化形状を空hitとして拒否する。
- generic `find...InShape()`からRECT / CIRCLE / POLYLINEを明示dispatchする。
- verifierで境界、逆向きpath、非finite、退化、replace / toggleを固定する。

## 4. Stage B — 限定UI adapter

- runtime `_warpPointSelectionShape`だけを追加し、既定は`rectangle`。
- SELECT中の`M`は`RECT → CIRCLE → POLYLINE → RECT`を巡回する。BRUSH中の`M`は`MOVE / INFLATE / PINCH / SMOOTH`巡回を維持する。
- SELECT buttonは初回clickでSELECTへ入り、active中の再clickでshapeを巡回する。pen / touchでkeyboardを必須にしない。
- button内へ短い`RECT / CIRCLE / POLY`表示を置き、ARIA / Futaba tooltipも現在shapeへ同期する。
- 空Canvas dragは現在shapeのdisplay-only marqueeを描き、pointerupで既存selectionへreplace / Ctrl・Cmd toggleする。
- 選択point一括move、Escape、pointercancel / lost capture、Frame移動、target / topology clear、Table closeを既存経路のまま維持する。

## 5. 非対象

- soft selection / falloff、Shift追加、Alt減算
- 選択点の回転・拡縮handle
- Mesh vertex / SkinWeight / ControlHandleへの転用
- effect mask、Bind、Raster Pixel Selectionとの統合
- selection shape / path / indexのProject・History・Recovery保存
- WARP key、topology、sampler、rasterizer、Bake / exportの変更
- Phase 7iのLINE閾値、Mesh tab、manual topology / weight

## 6. 受入条件

- RECT既存fixtureを維持し、CIRCLE / POLYLINEのpure hitがdeterministic。
- SELECT中`M`とbutton再押下だけがshapeを巡回し、BRUSH中`M`は既存mode巡回。
- fixed / Control Mesh、CAF / Folder別でshape選択後の一括moveが1 History。
- 空click、退化polyline、Escape / cancelはWarp keyとHistoryを変更しない。
- Undo / Redo、Frame移動、target切替、Table close / reopenで古いindexを誤適用しない。
- preview / playback / onion / Bake / exportは選択runtime stateに依存しない。
- console warning / error 0件、全verifier、node check、buildを通過し、生成差分を残さない。

## 7. 停止条件

- polylineをProjectへ保存しないと操作が成立しない。
- overlayがpointer inputを所有する必要がある。
- RECT / CIRCLE / POLYLINEで別々のWarp key commitまたはHistory経路が必要になる。
- 通常Canvas shortcut、BRUSH、Space panとの競合を局所分岐で解消できない。
- 主要class再構成または大幅DOM置換が必要になる。

## 8. 実施結果（2026-08-11）

- `warp-point-selection.js`へRECT互換を維持したCIRCLE / POLYLINE正規化、境界を含むhit判定、generic shape dispatchを追加した。POLYLINEは2px未満のpointer sampleを間引き、3点未満と退化polygonを空hitにする。
- `AnimationTablePopup`にはruntime `_warpPointSelectionShape`だけを追加した。SELECT中の`M`とactive SELECT再clickで形状を巡回し、BRUSH中の`M`は既存`MOVE / INFLATE / PINCH / SMOOTH`を維持する。
- display-only `WarpGridOverlay`のmarqueeを単一SVG pathへ一般化した。Warp key、Project、History、topology、Mesh / Skin、rasterizerは変更していない。
- SOL review 1判定は`A`。選択形状ごとの分岐はmarquee生成 / hitだけで、選択点moveと1 gesture 1 HistoryはPhase 7bの既存経路を共有する。
- 全49 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`を通過した。Browserの4×4 WARPでRECT / CIRCLE / POLY実選択、選択点move、Undo / Redo、BRUSH中`M`、Motion close / reopen時の選択破棄、console warning / error 0件を確認した。
- Phase 7iと本PhaseはOwnerが後日まとめて確認するためOPENを維持する。Control Mesh、Folder target、制作Project、pen / touchはOwner一括確認へ残す。
