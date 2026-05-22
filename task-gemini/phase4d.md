# Phase 4d — アニメテーブルのセル選択・フレームカーソルMVP

## 概要

Phase 4c で、アニメテーブル上に in-memory の `CelModel` をクリック配置できるようになった。
Phase 4d では、再生や保存へ進む前に、テーブル編集の基本となる「現在フレームの移動」と「セル選択状態」を作る。

まだ `animation-system.js` の再生タイマー、`animationSystem.init()`、RenderTexture snapshot、保存/ロードには触らない。

## 目標

- フレームヘッダーをクリックすると `TimelineModel.playback.currentFrame` が移動する。
- 現在フレーム列のハイライトが即座に更新される。
- セルをクリックした時、追加/削除だけでなく選択状態を持てるようにする。
- 選択中セルをUI上で判別できる。
- セル未配置スロットのクリック挙動は、Phase 4c の「セル追加」を維持する。

## 実装範囲

### 1. データモデル

- `TimelineModel` に `setCurrentFrame(frameIndex)` を追加してよい。
- `TimelineModel` または `AnimationTablePopup` 側に、選択中セルIDを保持する。
- `CelModel` に `selected` を直接持たせるか、UI側で `selectedCelId` として持つかは実装しやすい方でよい。
- 選択状態は in-memory のみでよい。保存しない。

### 2. UI操作

- `.anim-frame-num` に `data-frame-index` を付け、クリックで現在フレームを移動する。
- `.anim-cell-slot.has-cel` をクリックした場合は、そのセルを選択する。
- 空セルをクリックした場合は、従来どおりセルを追加し、追加されたセルを選択してよい。
- 既存セルの削除は、MVPでは `Alt+クリック` または `Shift+クリック` のどちらかにしてよい。
  - 単純クリックで即削除だと選択と衝突するため、Phase 4d では選択を優先する。
- 選択セルには `.selected` などのクラスを付ける。

### 3. 表示

- 現在フレーム列、選択セル、アクティブトラックの3状態が見分けられるようにする。
- 色は既存の Futaba / Maroon / Orange 系に合わせる。
- JS内の大量 inline style は使わず、CSSクラスで制御する。

### 4. 報告

- 作業後に `task-gemini/phase4d_report.md` を作成する。
- `tegaki_work/PROGRESS.md` に実施内容、確認結果、未着手範囲を追記する。

## 禁止事項

- `animationSystem.init()` を復活させない。
- 旧 `animation-system.js` の再生タイマーへ接続しない。
- RenderTexture snapshot、保存/ロード、Export、Albumへ触らない。
- 旧 `timeline-ui.js` を大改造・廃止しない。
- セルのドラッグ移動、伸縮、複製、範囲選択へ踏み込まない。
- レイヤーD&D、無限キャンバス、物理演算、WebGPUへ進まない。

## 完了条件

- [ ] フレームヘッダークリックで現在フレームが移動する。
- [ ] 現在フレーム列のハイライトが更新される。
- [ ] セルを選択でき、選択状態がUI上で判別できる。
- [ ] セル追加は引き続き可能。
- [ ] セル削除は修飾キークリックなど、選択と衝突しない形で可能。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4d_report.md` と `PROGRESS.md` が更新されている。

