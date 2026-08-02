# Phase 6w: fixed Raster Mesh render proof

完了日: 2026-08-02  
判定: SOL review `A`

## 目的と結果

Phase 6vのstatic Raster Mesh / SkinWeightを、一つの非clipped Rasterへ描画接続した。
`raster-skin-render-plan.js`が既存Bone FKから評価済み頂点を一度だけ作り、Pixi preview / playback / onionと
CPU compositor / Bake / exportが同じ頂点・triangle順を消費する。

CPU側は既存`warpRgbaWithTriangles()`、Pixi側は既存Control Mesh data adapterを再利用する。
Control Mesh / WARP Pose、rigid bindingへMesh / weightを複製していない。

## 境界

- Raster Skinはinternal clippingより前に適用する。
- clipping owner / sourceへ参加するRasterは`unsupported`。
- active Folder WARP / rigid RenderIslandに含まれるRasterも初期proofでは`unsupported`。
- unsupportedを元Rasterへ無言fallbackせず、authoring preflightとCPU exportで明示する。

## 検証

- `verify-raster-skin-render-plan.mjs`
- `verify-folder-part-render-plan.mjs`
- `verify-folder-deformer-render-plan.mjs`
- `verify-structured-bake-model.mjs`
- 全29 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`

## 後続へ送ったもの

SkinとFolder WARP / clippingの同時適用順、複数Mesh、GPU専用backendは別Gateとする。
