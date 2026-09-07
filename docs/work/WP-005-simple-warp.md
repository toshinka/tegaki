# WP-005 — Simple 4x4 WARP UI

状態: ACTIVE（2026-09-07）。作業開始baseline HEAD: `82192bd22c31f154c1cba155b063ac4fa601bb15`。

現時点ではLayer TransformのBASIC/WARP切替、Simple 4x4の16点pointer adapter、normal/CAF SOURCEのRaster preview/bake、CAF ANIMATEの既存`layerDeformers` bridge接続まで実装した。関連verifier・構文・Vite buildはPASSしている。normal SOURCEの実Browser操作とCAF ANIMATEの入場・preview・Escまでを限定確認したが、CAF SOURCEの実Browser、CAF ANIMATEのV確定/Frame継続、実Pixi画素、保存/再open、Owner操作受入は未完了である。

## Progress (2026-09-07)

- 実装差分: WARP tabを既存Layer Transform panelへ追加し、auto-fitされた4x4の16点とpointer gesture adapterを接続した。pointerdownでbaseline/capture、pointermoveでpreview、pointerupはgesture終了のみ、pointercancel/lost captureはgesture rollbackとしてsessionを継続する。
- normal SOURCE: 描画後にVで入場し、WARP表示（16点）・点ドラッグ・Esc取消・V確定をBrowserで確認した。変更確定はHistory `+1`、取消は`+0`、gesture中のpointerdown/upではHistoryを増やさない。確定後のUndo/Redoは各1回で元画像/変形画像へ戻る。変更中のBASIC切替はWARPに留まり、暗黙commitしない。console errorは確認されなかった。
- CAF ANIMATE: 2Frame CAFを実Browserで選択し、`ANIMATE · F1 READY`、4x4/16点表示、点drag後の`ANIMATE · F1 WARP KEYED`、Esc取消を確認した。確認時Historyは変化せず、V確定・Frame移動・Table close後の再現は未受入である。
- 追加修正: 初回WARP入場時の既存transform anchor初期化を先に行い、未変更BASIC sessionの誤検出でWARP entryが拒否される経路を除去した。source previewの比較基準は現在候補ではなくsession開始時baselineとしたため、移動して元へ戻す操作はno-opになる。bridge再描画中もWARP transactionが生きている間はoverlayを維持する。
- 技術確認: `test warp` 19/19、`test transform` 13/13、`test animation` 34/34、`test project` 9/9、専用WARP verifier 3件、harness check、構文確認、Vite production build、`git diff --check`をPASS。Browser確認はOwner受入とは分離する。
- 未完了: CAF SOURCEのRaster bake、CAF ANIMATEの`layerDeformers` V確定/Frame/Table close、実Pixi/CPU/export画素一致、save/reopen、非4x4/排他対象の実画面拒否、pointercancel実操作、Owner操作受入。

## Goal

旧Phase 9q A〜Dのmodel/Project/render/transaction資産を使い、Layer Transform WARPをCanvas直接操作へ接続する。

## Scope

読む: [Transformと評価順](../ARCHITECTURE.md)、[旧9q](../../task-codex/phase9q.md)のA〜D証拠とE条件。
候補変更file: `system/layer-transform.js`、`system/layer-system.js`、`ui/warp-grid-overlay.js`または既存BASIC overlayの隣接adapter、`ui/animation-table-popup.js`のLayer WARP bridge/marker、対象CSS/verifier。
READY化時に新規overlayの要否と正確なwrite範囲をleadが固定する。

## Contract

SOURCEはRaster bake、ANIMATEはClipInstance.layerDeformers。Simpleは4x4、非4x4を暗黙変換しない。
入場keyなし、previewは同じbaseline、確定History 1、cancel/no-opは0。
root/Folder WARP、Rig/Mesh/Skin/clipping排他とCPU/Pixi一致を維持する。

## Tasks

1. WP-002/003、WP-004、WP-007の前提を保持したまま、Simple 4x4 UIと既存transactionの限定接続を実装・検証する。
2. WARP tab、auto-fit 16点、pen hit、BASICとのmode移行を接続。
3. pointerupはgesture終了、cancel/capture喪失は定義済みgesture rollback、session継続を検証。
4. 同FrameのLayer Motion/WARPは単色丸一個、pending色も共用。
5. V close/Escape/Frame移動/Table close/save/export terminalを確認。

## Acceptance

- normal SOURCE、CAF SOURCE、CAF ANIMATEの対象と保存先が一致。
- 対象Rasterのみ変形し、旧非4x4、排他対象を明示拒否。
- preview/CPU/Bake/exportの固定入力結果一致とUndo/Redo/save/reopenが通る。
- 入場/無変更/取消のHistory 0、実変更確定1、丸KEY一個。

## Verification

`test warp`、`test transform`、構文/build、Browser 16点操作と実Pixi画素比較。
node配線testだけでproduction完成とはしない。

## Stop

新しいWARP保存model、永続SOURCE effect stack、static RIG移設、任意Mesh編集は対象外。
前提が未完なので、このカードを読んだworkerが直ちに実装を始めない。

## Completion

上記技術検証とOwner操作受入を記録してからDONEへ更新する。旧9qを形式だけcloseしない。
