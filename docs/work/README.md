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
| WP-023 | 個人開発用ローカルフォント自動参照 | [Automatic local fonts](WP-023-font-auto-local.md) |
| WP-024 | フォント比較page・応答改善 | [Font comparison](WP-024-font-comparison.md) |
| WP-025 | 漫画の再編集文字・曲線・少点変形 | [Editable lettering](WP-025-editable-manga-lettering.md) |
| WP-026 | Rive画像rigの独立Browser proof（VERIFIED / 製品採用・Owner受入未） | [Rive authoring proof](WP-026-rive-authoring-browser-proof.md) |
| WP-027 | 漫画文字の密度・目的別設定・固定確定欄 | [Lettering workflow](WP-027-manga-lettering-workflow.md) |
| WP-028 | 文字別編集・3点サイズ・書体集約・第二フチ取り | [Character editing](WP-028-lettering-character-editing.md) |
| WP-029 | 新RIGの試作編集入口・独立素材保存・新Rasterフレーム受渡し（限定技術VERIFIED / Owner未受入） | [Rive first path](WP-029-rive-editor-first-path.md) |
| WP-030 | 漫画後続の依存順・書体の情報整理集約から順次実装 | [Manga follow-through](WP-030-manga-tools-follow-through.md) |
| WP-031 | 新RIG入口のlazy起動・接続・失敗表示と復帰 | [Rive operational entry](WP-031-rive-editor-operational-entry.md) |
| WP-032 | 既存End骨の直接編集/native保存往復VERIFIED、Project HOLDはWP033で解消 | [Rive direct bone edit](WP-032-rive-direct-bone-edit.md) |
| WP-033 | 通常Rasterの半透明PNGをProject往復で保持・実画素差0 | [Raster alpha roundtrip](WP-033-raster-project-alpha-roundtrip.md) |

先の機能すべてへ未確定の詳細カードを作らない。新カードはGoal / Scope / Contract / Tasks / Acceptance / Verification / Stop / Completionを持ち、同じ概念の第二正本を作らない。
カードを渡す前に対象fileの存在とbaseline、依存の完了状態を確認する。
