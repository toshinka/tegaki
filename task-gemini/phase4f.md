# Phase 4f — アニメテーブル内だけの再生ヘッドMVP

## 概要

Phase 4e で、セルの `duration` をUI上で扱えるようになった。
Phase 4f では、旧 `animation-system.js` へ接続せず、新アニメテーブル内だけで再生ヘッドを自動進行させる。

目的は「再生ボタンを押すと現在フレーム表示が進む」感触を作ること。
まだ描画レイヤーの表示切替、RenderTexture snapshot、保存/ロード、Export には触らない。

## 重要な再発防止ルール

過去に Gemini 作業で、`timeline-ui.js` と `animation-table-popup.js` の HTML テンプレート文字列・CSS注入ブロック周辺が壊れ、`Expected a semicolon` 系のビルドエラーが複数回発生している。

このPhaseでは以下を必ず守ること。

- `innerHTML = \`` や `style.textContent = \`` を編集したら、編集箇所の前後50行を必ず読み返し、バッククォート・閉じタグ・波括弧・メソッド境界が崩れていないか確認する。
- `timeline-ui.js` は原則触らない。どうしても触る場合は変更前後の該当メソッド全体を確認する。
- `animation-table-popup.js` のテンプレート文字列を大きく組み替えない。ボタン追加などは既存ヘッダー構造の小差分に留める。
- `npm.cmd run build` で `Expected a semicolon` が出た場合、推測で複数ファイルを直さず、直近で触ったテンプレート文字列の閉じ忘れを最初に確認する。
- JS側の inline style は追加しない。見た目はCSSクラスで制御する。

## 現在の前提

- `TimelineModel.setCurrentFrame(frameIndex)` がある。
- `AnimationTablePopup.selectedCelId` がある。
- セルは `duration` を持ち、横長表示できる。
- `animationSystem.init()` はまだ呼ばない。

## 目標

- 新アニメテーブルのヘッダーに Play / Stop または Play / Pause の小ボタンを追加する。
- Play中は `TimelineModel.playback.currentFrame` が一定間隔で進む。
- 最終フレームに到達したら、MVPでは `loop` が true なら 0 に戻り、false なら停止する。
- 再生中も現在フレーム列ハイライトが更新される。
- 再生は新アニメテーブル内のUI状態だけに限定する。

## 実装範囲

### 1. データモデル

- 必要なら `TimelineModel.advanceFrame()` を追加してよい。
- `fps` は既存の `TimelineModel.fps` を使う。初期値12fpsのままでよい。
- `playback.loop` は既存値を使う。ループ切替UIは今回は必須ではない。

### 2. UI

- `animation-table-popup.js` に `isPlaying` / `_playTimer` などの状態を持たせてよい。
- 再生は `setInterval` または `requestAnimationFrame` のどちらでもよいが、MVPでは実装が安全な方を選ぶ。
- パネルを閉じたら再生を停止する。
- Play中のボタン表示はCSSクラスで制御する。

### 3. 禁止

- `animationSystem.init()` を復活させない。
- 旧 `animation-system.js` の `play()` / `stop()` / タイマーへ接続しない。
- 描画レイヤーの表示/非表示をフレームに応じて変えない。
- RenderTexture snapshot、保存/ロード、Export、Albumへ触らない。
- 旧 `timeline-ui.js` を大改造・廃止しない。
- セルのドラッグ移動、ドラッグ伸縮、複製、範囲選択へ踏み込まない。

## 完了条件

- [ ] 新アニメテーブル内のPlayボタンで現在フレームが自動進行する。
- [ ] Stop/Pauseで進行が止まる。
- [ ] パネルを閉じると再生が止まる。
- [ ] 現在フレーム列のハイライトが再生に合わせて更新される。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4f_report.md` と `PROGRESS.md` が更新されている。

