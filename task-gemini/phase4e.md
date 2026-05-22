# Phase 4e — アニメテーブルのセル長さMVP

## 概要

Phase 4d で、現在フレーム移動とセル選択が入った。
Phase 4e では、再生・保存・描画内容へ進む前に、セルが「1コマだけ」ではなく「数フレームぶん続く」概念を扱えるようにする。

ToonSquid 2 風のアニメテーブルでは、セルの開始位置と長さが編集の基本になる。
まずはドラッグ操作ではなく、低リスクなボタン/ショートカット/修飾キー操作で `duration` を変更するMVPに留める。

## 現在の前提

- `TimelineModel.playback.currentFrame` はフレームヘッダークリックで移動できる。
- セルは `TrackModel.cels` に in-memory で保持される。
- セル選択状態は `AnimationTablePopup.selectedCelId` で保持される。
- `CelModel.duration` は存在するが、現状ほぼ `1` 固定。
- `animationSystem.init()` はまだ呼ばない。

## 目標

- 選択中セルの `duration` を増減できる。
- `duration > 1` のセルは、テーブル上で横に伸びたブロックとして表示される。
- セルが占有している範囲をクリックした時も、そのセルを選択できる。
- セル範囲の重なりは、MVPでは避けるか、単純な上書き/拒否のどちらかに統一する。
- まだ保存/ロードやRenderTextureには触らない。

## 実装範囲

### 1. データモデル

- `CelModel.duration` を実際に表示・操作へ使う。
- `TrackModel.getCelAtFrame(frameIndex)` は、`startFrame <= frameIndex < startFrame + duration` を含むセルを返すようにする。
- 必要なら以下のような小APIを追加する。
  - `resizeCel(celId, duration)`
  - `setCelDuration(celId, duration)`
  - `canPlaceCel(startFrame, duration, ignoreCelId)`
- `duration` は最低 `1`、最大は `TimelineModel.totalFrames - startFrame` に収める。

### 2. UI操作

- 選択中セルに対して、以下のどちらかの低リスク操作を実装する。
  - `[` / `]` ではなく、アニメテーブル内の小ボタンで `duration -1 / +1`
  - または `Alt+Wheel` / `Shift+Wheel` など、既存ショートカットと衝突しにくい操作
- 迷う場合は、アニメテーブルヘッダーに小さな `-` / `+` ボタンを追加する。
- セル削除の `Alt+クリック` / `Shift+クリック` は維持する。
- ドラッグ伸縮は Phase 4e では実装しない。

### 3. 表示

- `duration > 1` のセルは、連続するスロットに横長のセルとして見えるようにする。
- まずは各スロットに同じセルブロックを描くより、開始スロットに `width: duration * cellWidth` のブロックを置く方が望ましい。
- ただし複雑になりすぎる場合は、MVPとして範囲内スロットを `.has-cel` で塗る方式でもよい。
- 選択セル、現在フレーム列、アクティブトラックが見分けられるようにする。

### 4. 報告

- 作業後に `task-gemini/phase4e_report.md` を作成する。
- `tegaki_work/PROGRESS.md` に実施内容、確認結果、未着手範囲を追記する。

## 禁止事項

- `animationSystem.init()` を復活させない。
- 旧 `animation-system.js` の再生タイマーへ接続しない。
- RenderTexture snapshot、保存/ロード、Export、Albumへ触らない。
- 旧 `timeline-ui.js` を大改造・廃止しない。
- セルのドラッグ移動、ドラッグ伸縮、複製、範囲選択へ踏み込まない。
- レイヤーD&D、無限キャンバス、物理演算、WebGPUへ進まない。

## 完了条件

- [ ] 選択中セルの `duration` を増減できる。
- [ ] `duration > 1` のセル範囲がUI上で判別できる。
- [ ] セル範囲内クリックで該当セルを選択できる。
- [ ] セル削除、セル追加、現在フレーム移動が退行していない。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4e_report.md` と `PROGRESS.md` が更新されている。

