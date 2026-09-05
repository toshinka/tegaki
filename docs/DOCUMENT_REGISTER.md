# 文書状態登録簿

状態: CURRENT。ここは資料の効力を管理する。実装状態/順序をもう一度記述しない。

## 状態の意味

| 状態 | 意味 |
|---|---|
| CURRENT | 現在の設計/開発契約。役割はdocs/READMEで一意化 |
| CURRENT REFERENCE | 限定領域の運用規約/所有map。現在値はコードと照合 |
| REFERENCE | 原案、調査、比較、採否の根拠。本文の命令は現在の実装指示ではない |
| PAUSED | 未完仕事を停止。close済みではない |
| SUPERSEDED ROUTING | 旧URL/pathを維持する転送入口。本文仕様を重複所有しない |
| ARCHIVED | 過去の記録。冒頭が未完でも末尾に完了経緯がある場合がある |

## 現行入口と互換入口

- `AGENTS.md`: 入口。`TEGAKI.md`: 技術契約。
- `docs/README.md / STATUS.md / PRODUCT.md / ARCHITECTURE.md / VOCABULARY.md / DEVELOPMENT.md / ROADMAP.md / AUDIT.md / DOCUMENT_REGISTER.md`: CURRENT。
- `docs/work/`: Work Package。状態は`docs/harness.json`。
- `tegaki_work/PROGRESS.md / ARCHITECTURE.md / PHASE4Z_BOUNDARY.md / NEXT_CHAT_HANDOFF.md / CODEX_MULTI_MODEL_WORKFLOW.md`: SUPERSEDED ROUTING。
- `task-codex/phase9q.md`: PAUSED。A〜D証拠と未完Eを残す。
- `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`: CURRENT REFERENCE。styleの所有先、phase別checkpointを区別。
- `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`: REFERENCE。局所履歴。現在のSOURCE/ANIMATEはdocs/ARCHITECTURE。
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`: REFERENCE。制作受入の証拠。後のOwner受入を古いNG文より優先。
- `tegaki_work/EXTERNAL_WEB_REVIEW_REQUEST_TEMPLATE.md`: REFERENCE。現行workflowはdocs/DEVELOPMENT。
- `tegaki_work/GitHubURL.txt`: CURRENTの外部案内。仕様/現在地の第二正本にしない。

## proposals全25文書の処置

下記のpathは`開発用資料保管庫/proposals/`からの相対。現行の順序はdocs/ROADMAPだけが所有する。

| 文書 | 状態 | 保持する価値/読み直す条件 |
|---|---|---|
| `00_計画索引.md` | SUPERSEDED ROUTING | 新登録簿への案内、旧全文はArchive |
| `01_短中期ロードマップ.md` | SUPERSEDED ROUTING | 新ROADMAPへの案内、候補/履歴の原文保存 |
| `05_長期研究_AI・WebGPU・物理.md` | REFERENCE | 研究の採用条件、fallback、AI出力取り込み原則 |
| `08_フォルダ合成・クリッピング調査.md` | REFERENCE | group合成/clipの根拠、現在コードとの差を再確認する時 |
| `09_変形アニメーション・メッシュ・GPU画材ロードマップ.md` | REFERENCE | Motion/Deformer/画材の分離 |
| `10_Motion_Graph・Easing・Motion_Path設計.md` | REFERENCE | 既存Graph資産と未実装Path/Performの候補 |
| `12_Camera_Frame・Resize_UI将来設計.md` | REFERENCE | View/Project/Animation Cameraの区別 |
| `14_UIツール導線・Text・階層Motion将来設計.md` | REFERENCE | 外部比較URL、Clip Focus等の採用/棄却条件 |
| `15_キャラクターRig・Mesh・Perform統合ロードマップ.md` | REFERENCE | Rig/mesh実装変遷、未採用solver/physics案 |
| `16_制作Workspace・UI・外部Handoff構造ロードマップ.md` | REFERENCE | Workspace代替、外部handoff、library候補 |
| `17_RIG・Motion責務再配置Architecture Gate.md` | REFERENCE | 右/左/統合等の比較、D採用と再試行条件 |
| `Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md` | REFERENCE | Transform familyとFocus Lens原案 |
| `Tegaki_Transform_Rig_Authoring_Interaction_Addendum_2026-08-31.md` | REFERENCE | 入力文法とroot-first案の初版 |
| `Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md` | REFERENCE | Interaction Context等を加えた改訂案。初版も保存 |
| `Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md` | REFERENCE | WHAT/HOW/WHEN/DO、導線純化のOwner優先方向 |
| `Tegaki_Drawing_WARP_Authority_Gate_2026-09-05.md` | REFERENCE | Gate入力と採用C、A〜D実装記録。冒頭の未実装記述を現在化しない |
| `UI_CSSスタイルガイド.md` | CURRENT REFERENCE | 色/共通control/静的style/attentionの運用規約 |
| `CODEX_mesh_rig_investigation_request.md` | REFERENCE | 外部監査要求。未採用の指示を直接実行しない |
| `Tegaki 長時間描画性能劣化 — 第1回 調査・棚卸し指示書.md` | REFERENCE | 性能調査の入力 |
| `Tegaki 長時間描画性能劣化 — 第2回 改修実装指示書.md` | REFERENCE | patch History/thumbnailの当時の改修契約 |
| `Tegaki_長時間描画性能劣化_第1回_調査・棚卸し報告書.md` | REFERENCE | 調査証拠と計測条件 |
| `Tegaki_ペン入力レスポンス追加強化_第3回_調査・棚卸し報告書.md` | REFERENCE | 入力性能の追加報告。全経路受入と同一視しない |
| `Tegaki_アニメテーブル・レイヤーパネル周りUI_UX再構築_提案書.md` | REFERENCE | Frame Compass/CAF Parent Headerの提案根拠 |
| `ペン描画遅延_原因診断書.md` | REFERENCE | 旧計測・原因説。現コードとの照合が必要 |
| `（ふたばちゃんねる投稿システム案）futaba_tegaki_integration_plan.md` | REFERENCE | 将来投稿連携。現在の本体機能/実装指示ではない |

原案は移動によるリンク切れを避け現pathに保持し、冒頭へ状態を明記した。詳細の重複を継続更新しない。
新しい比較で棄却した案は、理由/再試行条件と関連Work Packageを同じ原案またはArchiveの短い記録に残す。

## Archiveと未分類領域

`開発用資料保管庫/Archive/`はdirectory単位でARCHIVED。既存Phase原文は削除/書換えしない。
`Archive/reconstruction-2026-09-05/`には再構成前のAGENTS/TEGAKI/Architecture/PHASE4Z/Progress/handoff/workflow/proposal00/01/GitHubURLを保存した。filename内の`__`は元pathの`/`を表す。
原文にある相対pathは元の配置から解釈する。現行読者はcompatibility entryを経由する。

`Claude_GPT_Review/`、`関連ツール/`、ほかの非登録資料は外部参考/未分類。今回全件精読していない。CURRENTへ自動昇格しない。
`開発用資料保管庫/実装したいことメモ.txt`はOwner向け簡略要望。実装カードへ落とす時に現行コードと照合する。
保護されたBackup/PastFilesは登録・内容探索の対象外。

## 維持すること

新規の正本文書を増やす場合は、どの失敗を防ぎ、どの既存正本を置き換えるかを先に示す。
現行docのlink、登録漏れ、カード依存は`development-harness.mjs check`で検査する。
古い資料の削除や全Phaseの改名は必要条件にしない。現在と履歴の入口が混ざらないことを優先する。
