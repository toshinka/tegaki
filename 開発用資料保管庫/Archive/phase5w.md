# Phase 5w: Clip transform keyframe基盤（完了）

更新日: 2026-07-13

## 完了内容

- `ClipInstance.transform / transformKeyframes` を唯一の運動正本として、Clip-local 0-based Frameのsampling契約を固定した。
- 同一Frame後勝ち、範囲外key無視、欠損parameter継承、rotation radian、左keyのhold / linearを実装した。
- position / scale / rotationをTable preview、閉Table再生、onion、compositorへ接続した。
- 静的transformを暗黙の始点・終点とし、旧Projectのkeyframe無しCAFを従来表示と一致させた。
- save/load、単体・複数CAF copy/paste、CAF Group、Timeline Historyでkeyframeをclone / round-tripする。
- CLIP MOTION popup、Frame key編集、Canvas drag / wheel / Shift+wheel、Clip単位anchor編集を追加した。
- VキーとCLIP MOTIONは排他とし、破壊的raster変形と非破壊Clip Motionのcommit先を分離した。

## 対象外として維持

- opacity、色補間、easing curve、Perform、mesh、Bone、physics、WebGPU。
- 上側Lane前面、stroke中working Layer、preview staging交換、PSD record、Lane / Timeline onion display-only、Folder clipping契約。

## 検証

- 変更JSの `node --check`、固定入力、`npm.cmd run build`。
- BrowserでMotion入力、key追加/削除、Undo/Redo、copy/paste、再生追従、V/MOTION排他、popup drag、anchor表示を確認。
- Project JSON / Group / 旧Project互換の固定round-tripを確認。
- 大容量Albumへの追加は既存約105MBデータで長時間化したため、同じ実操作を反復しない。
