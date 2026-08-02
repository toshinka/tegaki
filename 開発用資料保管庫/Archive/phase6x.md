# Phase 6x: one Raster / multi-PIVOT authoring

完了日: 2026-08-02  
判定: SOL review `A`

## 目的と結果

CLIP MOTIONのRIG / MOTIONへRaster targetを追加し、一枚RasterへPart / rigid bindingを作らない
複数Mesh BONEを置けるようにした。未設定Rasterを含むCAFを最初に開いた時はRIGへ入り、対象tabに
Raster名を表示する。

- RIG: `＋ BONE`、Bone selector、X / Y / Rotation、Canvas PIVOT配置、wheel角度、既存親dropdown。
- Canvas: 既存PIVOT長押し親接続、接続線drag付け替え、空drop解除をMesh BONEでも再利用。
- MOTION: 既存`ClipInstance.rigMotion.boneTracks`へBone Pose keyを記録し、新Motion正本を作らない。
- Animation Table: Mesh BONE keyを既存Bone子Laneへ投影する。
- 空RasterはBone配置を拒否し、alpha実内容の中心を初期PIVOT候補にする。

## UI境界

Folder PIVOTはrigid Folder、Raster PIVOTはSkin Mesh BONEとしてtarget表示を分ける。
RIG / MOTION / WARPのlast-used tab復帰、CLIP MOTION中の描画禁止、Futaba paletteを維持する。
Mesh BONEのIK、削除UI、weight編集は本Phaseへ含めない。

## 検証

- `verify-raster-bone-skinning.mjs`
- 既存Bone / parent link / IK verifier
- Browser: Animation Table開閉、2 Frame CAF、初回RIG、Raster target、`＋ BONE` / `AUTO GRID`表示、空Raster拒否、console errorなし
- Browserテストの一時HistoryはUndoで0/500へ復元

## 後続へ送ったもの

複数RasterへBone所属を明示する高度UI、Mesh Bone IK、manual weight、touch深掘りは別Goalとする。
