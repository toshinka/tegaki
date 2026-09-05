# WP-005 — Simple 4x4 WARP UI

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

1. WP-002/003とWP-004から生じた必要修正が完了してから、write範囲を確定。
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

前提確認後READY化し、上記技術検証とOwner操作受入を記録する。旧9qを形式だけcloseしない。
