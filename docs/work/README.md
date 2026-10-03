# Work Packageの入口

登録済みWPの状態と依存は[manifest](../harness.json)のpackages、実行中の一件は[STATUS](../STATUS.md)に置く。WP-010〜018はpackage未登録のため対象CardとSTATUSで状態を確認する。本一覧の存在を実行許可や受入完了と扱わない。
READYは委任可能という意味で、現在の製品実装停止を解除するものではない。

| ID | 目的 | カード |
|---|---|---|
| WP-001 | History redo例外後のindex維持 | [History failure](WP-001-history-failure.md) |
| WP-002 | Layer effectとRigの双方向排他・安全な解除 | [Effect guards](WP-002-effect-guards.md) |
| WP-003 | KEY確定後のpanel保持とFrame継続 | [KEY continuation](WP-003-key-continuation.md) |
| WP-004 | unsupported出力とsave/export terminalの比較・判断材料（監査DONE） | [Output terminal audit](WP-004-output-terminal.md) |
| WP-006 | Folder自身のMotion KEY | [Folder transform KEY](WP-006-folder-transform-key.md) |
| WP-007 | 未確定Layer TransformのExport terminal guard | [Export terminal guard](WP-007-export-terminal-guard.md) |
| WP-005 | Drawing WARP Simple UIを既存transactionへ接続（ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING） | [Simple WARP](WP-005-simple-warp.md) |
| WP-008 | Layer Transform Progressive Controls（ACTIVE — ROUGH PRODUCT PASS / OWNER REVIEW） | [Progressive controls](WP-008-layer-transform-progressive-controls.md) |
| WP-009 | Layer Transform KEY bundle D&D / component delete（ACTIVE — TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING） | [KEY management](WP-009-layer-transform-key-management.md) |
| WP-010 | コマ割り | [Panel layout](WP-010-panel-layout.md) |
| WP-011 | 集中線 | [Focus lines](WP-011-focus-lines.md) |
| WP-012 | レイヤーパネル・フォルダ合成 | [Layer compositing](WP-012-layer-panel-compositing-investigation.md) |
| WP-013 | 吹き出し | [Balloon](WP-013-balloon.md) |
| WP-014 | トーン | [Tone](WP-014-tone.md) |
| WP-015 | 漫画原稿サイズ | [Manga canvas](WP-015-manga-canvas-size.md) |
| WP-016 | 自動選択・グラデーション | [Auto select / gradient](WP-016-auto-select-gradient.md) |
| WP-017 | 角ペン・角消しゴム | [Square tip](WP-017-square-tip.md) |
| WP-018 | 環境スナップショット | [Settings snapshot](WP-018-settings-snapshot.md) |
| WP-019 | Inochi2D編集・保存・再読込の独立proof | [Inochi roundtrip](WP-019-inochi-edit-roundtrip-proof.md) |
| WP-020 | 旧系隔離・新RIGの最初の実行経路 | [RIG renewal](WP-020-rig-renewal-first-path.md) |
| WP-021 | 選定フォント・見本・短評・Primary | [Curated fonts](WP-021-curated-font-library.md) |
| WP-022 | 外部フォント・場面別ツリー・ジョグ選択 | [Font organization](WP-022-font-organization.md) |

先の機能すべてへ未確定の詳細カードを作らない。新カードはGoal / Scope / Contract / Tasks / Acceptance / Verification / Stop / Completionを持ち、同じ概念の第二正本を作らない。
カードを渡す前に対象fileの存在とbaseline、依存の完了状態を確認する。
