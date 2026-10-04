# WP-033 — 通常Rasterの半透明PNGをProject往復で保持

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerの2026-10-05「続きを行ってください」に基づくWP032 HOLDの限定修正。main/871c51ed850f436aa0d49deb049bf7276c3a9655、全dirtyを保持。新しい保存形式ではなく、既存canonical Raster読出しから既存PNG fieldを作る。

READ: AGENTS → STATUS → TECHNICAL → 本Card → DEVELOPMENT「漫画文字とRIG proofの並行導線」→ ARCHITECTUREの保存正本表と対象header。Pixi router/core-conceptsも参照。根拠は[WP032司令監査](../ai/WP-032-rive-bone-audit.md)。旧RIG/他backendへ調査を広げない。

## Goal

新RIGで確定した56°/progress1のPNGを通常Rasterへ追加した後、実Project export/loadでcanonical RasterとExport画素が完全一致する。一般RasterのPNG保存だけを、既存文字/吹き出し/コマと同じLayerSystem.createLayerRasterSnapshotのstraight-alpha読出しへ統一する。追加のunpremultiply/閾値/色補正を行わない。Project schema、PNG field、load経路、History/renderer/SOURCE authority、Rive保存正本は変更しない。

## Contract

既存canonical straight-alphaとPNG保存契約を維持する。Project load、Layer、History、rendererを変更せず、一般Raster保存時の追加alpha変換だけを除く。

## Scope

既存TEGAKI｜実装 LUNA `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2`のみ:

- `tegaki_work/system/project-manager.js`: exportProjectの通常Raster PNG採取blockだけ。文字/吹き出し/コマ向けの既存dirtyを保持し、同じcanonical snapshot→Canvas2D.putImageData→toDataURLを一般Rasterへ適用。支持されているincludePathCollections:falseで不要なpath cloneを避けてよい。新class/helper/schema/load変更をしない。
- `tegaki_work/build/verify-project-raster-alpha-save.mjs` NEW: 一般Rasterの低alpha/半透明/opaque色を既存PNG採取へ渡す実関数の限定検証。canonical読出し一回・余分なextract/alpha変換無し、寸法/bounds/既存metadata/背景folder除外を確認。mockとnative証拠を区別。
- `docs/ai/WP-033-raster-project-alpha-result.md` NEW、専用cache `.cache/rive-editor/`。

司令のみ: Card/STATUS RIG節/登録/manifest/案内、`build/wp029-rive-browser.html`の実測追補、必要な独立Browser fixture/cache。workerと同fileの並列write無し。WP030の最新限定WRITEはinput表示/balloon操作/共通paragraph等でproject-managerは含まないとlive Card/diffで照合済み。既存WP030のPNG採取変更は保護し、この保存blockのwrite ownerは本SliceのLUNA一人。漫画UI/geometry/font/keyboard/CSSはread-only。共有docsは対象行を再読し限定patch。

## Tasks

担当は既存PNG採取blockを揃え、実export関数を低alpha入力で検証する。司令はsourceと実Browserを監査して現在地と案内を更新する。

## Acceptance

56°/progress1の通常Rasterが実Project往復でRaster/Export画素差0、元絵不変、UndoRedo一致。既存漫画の保存往復を保持する。

## Verification

workerは構文、新限定verifier、関連Project verifier、diff-checkを実施し、変更範囲/結果/残る未知を報告。SDK/serverを操作せずBrowserは司令担当。完了報告だけでcloseしない。

司令は固定CLI1.3.0/runtime2.44.0の既存56°fixture、専用product18833/tabとeditor18729を使用。新入口→native frame明示追加→新Raster/History一件/元絵不変→UndoRedo→実ProjectManager export/loadのRaster/Export差0を確認。既存漫画文字/吹き出し/コマPNG保存の実Browser fixtureを必要な一経路で回帰確認。旧Project読込・bounds外の一般Raster・DPR1xについて既存関連checksを利用。syntax/Project suite/build/harness/diffを実施。static/実Browser/Owner受入を区別、未実測をPASSにしない。

own Vite/companionのPID/executable/listener/installation receipt照合、ownだけ正常終了、reuseは停止しない。workerはserver/API/process/Browser mutation無し。cacheのsourceコピー/binaries/生成物を成果へ混ぜない。

## Stop

canonical snapshot経路でも差が残り、load/Layer/renderer修正が必要なら具体的HOLDへ返す。SDK修復、第二version/platform/backend、system install、production schema/History/renderer/SOURCE変更、旧RIG移行、他project/他者process停止、commit/push禁止。多部品/IK/物理/Timelineの自動継続無し。Ownerレビュー/制作受入/pushを自己承認しない。

## Completion

VERIFIED。[担当結果](../ai/WP-033-raster-project-alpha-result.md)のsourceを[司令監査](../ai/WP-033-raster-project-alpha-audit.md)で確認し、実56°/progress1の同じ開始hashからRaster/Export差0を実測。元絵不変、新Raster/History各一件、UndoRedo、吹き出しの本文/PNG実Project往復、Project suite11とbuild PASS。保存schema/load/Layer/renderer/History不変。Owner受入と未測定は監査へ分離。次のRIG機能を自動実行しない。
