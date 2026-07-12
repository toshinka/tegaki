# Phase 5w: Clip transform keyframe基盤

更新日: 2026-07-13

## 目的

既存の `ClipInstance.transform` と `transformKeyframes` を正本として、position / scale / rotationのFrame sampling契約を完成させる。mesh、bone、physics、WebGPUはこのPhaseへ混ぜない。

## Slice 0: 契約監査と純粋sampling

1. `transformKeyframes` の旧Project実データ有無と全read/write経路を監査する。
2. keyframe schema、Frame基準、重複key、範囲外key、欠損parameter、rotation単位を文書化する。
3. hold / linearの純粋sampling helperを追加し、固定入力で境界を検証する。
4. `TimelineFrameCompositor` の静的transform参照をsample結果へ置換する。
5. UI追加前に、Table preview、閉Table再生、onion、exportが同じFrame transformを使えるか経路を監査する。

## 後続Slice

- Slice 1: save/load、copy/paste、CAF Group、Undo/Redo round-trip。
- Slice 2: 選択CAF・現在Frameへkeyを置く最小UIとposition / scale / rotation数値編集。
- Slice 3: Table preview、閉Table再生、onion、GIF/WEBP出力の実操作一致。
- opacity、色補間、easing、Perform記録はPhase 5w完了後に再棚卸しする。

## 維持契約

- ClipAsset / DrawingSnapshotは絵素材、ClipInstanceは配置・運動parameterとする。
- 上側Lane前面、preview staging交換、stroke中working Layer表示、PSD record順を変更しない。
- transform keyframeをCAF内部Layer transformやVキーの破壊的raster変形と混同しない。
- 旧Projectのkeyframe無しCAFは現在の静的transformと完全一致させる。
- Backup/、PastFiles/、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## 検証

- 変更JSの `node --check`。
- `npm.cmd run build`。
- 固定入力でhold / linear、先頭前、末尾後、欠損parameter、rotationを確認。
- BrowserでTable開閉、再生、onion、copy/paste、Undo/Redo、保存再読込、console errorなしを確認。
- build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

