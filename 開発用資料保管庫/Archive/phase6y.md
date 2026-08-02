# Phase 6y: Alpha-fit Auto Grid / auto distance weight

完了日: 2026-08-02  
判定: SOL review `A`

## 目的と結果

選択Rasterのalpha実内容へdeterministicな初期Skin Meshを作り、既存Mesh BONE segmentとの距離から
最大2 influenceの初期weightを生成した。これは輪郭 / holeを処理するAuto Contourではなく、
明示名どおり`Alpha-fit Grid`である。

- 横長: 8×4、縦長: 4×8、正方形寄り: 6×6。
- tight alpha boundsへ1px paddingし、Raster bounds内へ限定する。
- 生成後はClipAsset static Setupとして固定する。
- source snapshot id / updatedAt / size / rasterBoundsをprovenanceとして保持する。
- Raster更新時は`STALE`表示だけを行い、`GRID再生成`までtopology / weightを上書きしない。
- Asset / internal Raster duplicateではsnapshot IDをremapし、複製先sourceへrebaseする。
- authoring preflightがPhase 6wのunsupported境界に当たる場合はHistory stateへrollbackする。

## 検証

- `verify-raster-bone-auto-setup.mjs`
- alpha bounds、8×4決定、triangle / vertex数、最大2 weight・正規化、determinism
- current / stale、非自動更新、明示再生成、duplicate / subtree copy、Project round-trip
- 全29 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`

## 後続へ送ったもの

manual weight / brush / smooth / lock / mirror、Auto Contour、LINE向け3列Ribbon、volume維持、
SkinとWARP / clippingの同時適用は別Gateとする。
