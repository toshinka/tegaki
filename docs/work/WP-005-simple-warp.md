# WP-005 — Simple 4x4 WARP UI

状態: ACTIVE（2026-09-07）。作業開始baseline HEAD: `28c8e90eebdec37010a342a04565a83786435975`。

現時点ではLayer TransformのBASIC/WARP切替、Simple 4x4の16点pointer adapter、normal/CAF SOURCEのRaster preview/bake、CAF ANIMATEの既存`layerDeformers` bridge接続まで実装した。関連verifier・構文・Vite buildはPASSしている。normal SOURCEの実Browser操作、CAF ANIMATEの入場・preview・Esc・V確定・次Frame移動、Tableを閉じたCAF SOURCEのdrag・V確定を限定確認した。Table close rollbackとpointer terminalの本Sliceは技術PASSだが、trusted device pointercancel、実Pixi画素、保存/再open、Owner操作受入は未完了である。

## Progress (2026-09-07)

- 実装差分: WARP tabを既存Layer Transform panelへ追加し、auto-fitされた4x4の16点とpointer gesture adapterを接続した。pointerdownでbaseline/capture、pointermoveでpreview、pointerupはgesture終了のみ、pointercancel/lost captureはgesture rollbackとしてsessionを継続する。
- normal SOURCE: 描画後にVで入場し、WARP表示（16点）・点ドラッグ・Esc取消・V確定をBrowserで確認した。変更確定はHistory `+1`、取消は`+0`、gesture中のpointerdown/upではHistoryを増やさない。確定後のUndo/Redoは各1回で元画像/変形画像へ戻る。変更中のBASIC切替はWARPに留まり、暗黙commitしない。console errorは確認されなかった。
- CAF ANIMATE: 2Frame CAFを実Browserで選択し、`ANIMATE · F1 READY`、4x4/16点表示、点drag後の`ANIMATE · F1 WARP KEYED`、Esc取消を確認した。確認時Historyは変化せず、V確定・Frame移動・Table close後の再現は未受入である。
- 追加修正: 初回WARP入場時の既存transform anchor初期化を先に行い、未変更BASIC sessionの誤検出でWARP entryが拒否される経路を除去した。source previewの比較基準は現在候補ではなくsession開始時baselineとしたため、移動して元へ戻す操作はno-opになる。bridge再描画中もWARP transactionが生きている間はoverlayを維持する。
- 追加追補: CAF ANIMATEのWARP bridge previewが予約する`AnimationTablePopup.render()`は、高度WARP GRID用判定に失敗すると共有`warpGridOverlay`をdeactivateしていた。`getLayerWarpEditSession()`とLayer Transformの`warp` modeが生きている間はcleanup対象から除外する局所guardを追加した。修正後の実Browserで、点drag後も16点と`ANIMATE · F1 WARP KEYED`が維持され、V確定でTableへ戻りHistoryが1件増え、次Frameへ移動できた。Tableを閉じたCAF SOURCEでも`SOURCE · WARP`のdrag→V確定を確認した。両方ともconsole errorは0件。IABではChrome version/DPRは取得できなかった。
- 技術確認: `test warp` 20/20、`test transform` 13/13、`test animation` 34/34、`test project` 9/9、専用WARP verifier 4件、harness check、構文確認、`git diff --check`をPASS。今回production JSは変更していないため、Vite production buildは前回のguard変更時PASSを継承し、再実行していない。Browser確認はOwner受入とは分離する。
- Table close terminal: 2Frame CAF ANIMATEで、元KEYなしの`pending→close`はHistoryをduration変更分から増やさず、close後overlayを0へ戻し、再open時に`F1 · KEY未設定`／`READY`へ戻った。元KEYありでは一度`History +1`で確定したF1のpointsを基準に別位置のpendingを作り、close後に元pointsと`WARP KEYED`を再現し、追加Historyを作らなかった。狭いIABではclose buttonのEnter起動、viewport 1280x720のIABでは同じpendingと実pointerup保持を確認した。model authority直読はBrowser隔離のため、`hide()`のcancel-before-hide順序を`verify-layer-transform-warp-ui.mjs`で固定し、既存transaction verifierと分離して記録した。
- Pointer terminal: `verify-layer-warp-pointer-terminal.mjs`でproduction `LayerTransformWarpController`をinstantiateし、Gesture Aのpointerup保持、Gesture Bのpointercancel rollback、capture loss rollback、pointerup後late loss保持、History/finish 0を固定した。`build/wp005-pointer-terminal-diagnostic.html`ではproduction `WarpGridOverlay`のDOM listenerへsynthetic `PointerEvent`をdispatchし、NORMAL SOURCE／CAF ANIMATEの両方で同じ結果をBrowser確認した。IAB診断はviewport 1280x720、DPR 2.25、console errors 0。trusted device由来のpointercancelは未検証として残す。
- 未完了: 実Pixi/CPU/export画素一致、save/reopen、非4x4/排他対象の実画面拒否、trusted device pointercancel、Owner操作受入。CAF SOURCEのdrag→Vは確認済みだが、DrawingSnapshotのsave/reopen往復と実画素比較は未確認。

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
