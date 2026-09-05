# WP-004 — 出力拒否と未確定編集の比較監査

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
