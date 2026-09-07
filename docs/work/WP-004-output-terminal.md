# WP-004 — 出力拒否と未確定編集の比較監査

状態: DONE — audit / decision complete（2026-09-07）。Owner制作操作感の受入は別途未確認。WP-007のruntime guardは後続カードで実装する。

## Goal

Layer Motionがunsupported時に落ちる経路を固定入力で示し、Project save/exportが未確定編集をどう扱うかを明文化する。ここは診断・設計資料のカード。

## Scope

read-only: `system/animation/timeline-frame-compositor.js`、`folder-part-render-plan.js`、`project-manager.js`、`export-manager.js`、`ui/animation-table-popup.js`、`pixel-selection-system.js`。
変更可: 新規`tegaki_work/build/verify-output-terminal-audit.mjs`、`docs/work/WP-004-results.md`、重大判断の追記。製品runtimeを修正しない。

## Contract

- CPU/Pixi/Bake/exportで同じ評価結果を目指す既存原則を維持。
- legacy Rig fallbackまで一括で拒否へ変えない。effect種類と拒否reason別に表を作る。
- save/exportでHistoryを変えるかはHD-005。未確定のUXを診断時に勝手に採用しない。

## Tasks

1. root/Folder/Layer Motion/WARP/Skinごとにsupported/unsupported consumerを比較。
2. F-003を実Canvasの固定Rasterで確認し、設定あり/なし/競合の出力hashまたはpixel/bboxを比較。
3. SOURCE、CAF SOURCE、ANIMATE、selectionで未確定→save/export→cancelのstate/History/出力を記録。
4. 欠落を防ぐ最小修正案とHD-005の推奨を結果文書へまとめる。

## Acceptance

- 各経路の「拒否/preview採取/確定/rollback」が根拠付きで埋まり、未実施欄が明示される。
- testはproduction consumerを呼ぶ。CPU fake-canvasだけならpixel一致とは報告しない。
- legacy fallbackの保持条件、修正対象、必要なOwner判断が一意に分かる。

## Verification

既存`test animation`/`test warp`を参照し、追加probeは生成物を書かない既定値にする。
実Pixi確認ができなければ環境blockerを記録し、決定的なCPU部分を成果として残す。

## Stop

runtime変更、schema導入、外部ファイル上書き、Owner Projectの破壊的試験は禁止。比較は新規/複製fixtureで行う。

## Completion

結果表、再現入力、実行証拠、修正案、HD-005推奨が揃いleadが確認。製品修正は別READYカードへ切り出す。

## Closure — 2026-09-07

- Slice 1〜3のCPU拒否、実Canvas/PNG、save/export terminal比較、限定実UI観測を`WP-004-results.md`へ固定した。
- HD-005は`MIXED`で確定した。Selectionは既存auto commitを維持し、SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderは未確定Layer Transformを明示停止する後続WP-007へ切り出した。Project Saveは変更しない。
- WP-004は監査と判断の完了でDONEとする。WP-007の製品runtime変更、実UI統一、sequence/download境界はWP-004の成果へ遡及しない。

## Progress

### 2026-09-07 Slice 1 — CPU拒否抜けとterminal差のproduction probe

- 新規`verify-output-terminal-audit.mjs`でproduction `createFolderEffectRenderPlan()`と`TimelineFrameCompositor._renderClipEntry()`を直接実行した。
- 同じRasterへRig PartとLayer Motionを持つ競合fixtureはplanが`unsupported / layer-transform-rig-overlap`になる。一方、Clipに`layerDeformers`がない場合、CPU compositorのassertは通過し、fake Canvasへ`drawImage`まで進む。F-003の拒否抜けを実consumerで確定した。
- このprobeはCanvas API呼出順を捕捉するfake Canvasで、実pixel/hash一致ではない。実Canvas固定画素は未実施として残す。
- production sourceの入口比較では、Project saveはSelection確定後にactive Layer Transformを明示終了する。Export/sequence/previewはSelectionだけを確定し、Layer Transformを終了しない。
- 初期比較表とHD-005候補は[WP-004 results](WP-004-results.md)へ記録。製品runtimeは変更していない。

### 2026-09-07 Slice 2 — CPU拒否抜けの限定修正

- `TimelineFrameCompositor._assertLayerDeformerPlanReady()`の早期return条件を`none/ready`だけへ限定した。
- Layer Motionだけの競合fixtureで、共有planが`unsupported`を返した時に`_renderClipEntry()`がCanvas描画前にreason付き例外を出すことを確認した。
- legacy fallbackや正常planのconsumer、Save/Exportのterminalは変更していない。

### 2026-09-07 Slice 3 — Browser / Canvas evidence

- 製品runtimeを変更せず、production consumerを実`HTMLCanvasElement`とPNG Blobへ接続する診断ページを追加した。ready Layer/Folder Motionはframe surfaceとPNGでhash/bboxが一致し、unsupported overlapは`renderFrame`、`renderClipFrameSurface`、preview callerの全入口で描画前にreason付き拒否となった。
- Selection、SOURCE、CAF SOURCE、ANIMATE Layer/Folderについて、fixtureのSaveは未確定Transform/KEYを確定してHistoryを1件進め、Export/Preview直呼出しはLayer Transformを終了せずHistoryを増やさない差を記録した。
- 隔離した実UIでは通常SOURCEのPreview後にV/sessionが残りEscapeで閉じた。ANIMATE LayerはExport toolbar click時にsessionが閉じてからPreviewへ進んだ。この差をHD-005判断材料として固定し、後続WP-007で明示停止guardへ統一する。
