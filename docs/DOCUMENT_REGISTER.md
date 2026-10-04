# 文書状態登録簿

状態: CURRENT。ここは資料の効力を管理する。実装状態/順序をもう一度記述しない。

## 状態の意味

| 状態 | 意味 |
|---|---|
| CURRENT | 現在の設計/開発契約。役割はdocs/READMEで一意化 |
| CURRENT REFERENCE | 限定領域の運用規約/所有map。現在値はコードと照合 |
| REFERENCE | 原案、調査、比較、採否の根拠。本文の命令は現在の実装指示ではない |
| PAUSED | 未完仕事を停止。close済みではない |
| SUPERSEDED ROUTING | 旧文書名から現行正本へ案内する記録。旧URLの維持を意味せず、本文仕様を重複所有しない |
| ARCHIVED | 過去の記録。冒頭が未完でも末尾に完了経緯がある場合がある |

## 現行入口と互換入口

- `docs/work/WP-034-rive-weights-playback.md`: CURRENT。Owner就寝中ロングラン。固定四隅の二骨weightと既存EndPose再生を二Sliceで実装、source/Project/rendererの正本境界を維持する。
- `docs/ai/WP-034-rive-weights-playback-result.md`: REFERENCE EVIDENCE。担当の限定実装/検証結果。native/Browser/Ownerの未検証範囲を司令監査と区別する。
- `docs/ai/WP-034-rive-weights-playback-audit.md`: REFERENCE EVIDENCE。司令の実controller境界監査、独立公式CLI/native評価、現行UI/hostの未検証範囲。

- `docs/work/WP-033-raster-project-alpha-roundtrip.md`: CURRENT。通常Rasterの既存PNG保存をcanonical snapshotへ揃える限定契約。共通保存blockのwrite ownerと実Project往復の検証境界を持つ。
- `docs/ai/WP-033-raster-project-alpha-result.md`: REFERENCE EVIDENCE。担当のPNG採取限定修正と実export関数のmock検証。実Browserの証拠と区別する。
- `docs/ai/WP-033-raster-project-alpha-audit.md`: REFERENCE EVIDENCE。司令の実56°終点Raster/Export画素差0と吹き出しProject往復、固定hash/未測定の監査。

- `docs/work/WP-030-manga-tools-follow-through.md`: CURRENT。Owner承認の漫画後続の依存順と、書体の情報整理集約の限定write/保存境界/検証。後続段階は開始前に同Cardへ限定契約を追記する。

- `docs/work/WP-027-manga-lettering-workflow.md`: CURRENT。文字パネルの目的別設定・Futaba glass・固定footer・Ctrl+Enter・数値wheel・共通漫画tab即時切替の限定UI契約。WP-025の保存/rendererを変更しない。
- `docs/work/WP-028-lettering-character-editing.md`: CURRENT。Owner指定の書体集約・4tab・文字別編集・3点サイズ・第二フチ取り。version-1 recipeへoptional属性を追加し、Project/History/確定画素の正本を維持。
- `docs/work/WP-029-rive-editor-first-path.md`: CURRENT。触れるRive試作編集と新規通常Rasterへの一経路。独立editor/製品hostのwrite owner、iframe protocol、AI可視性、保存とHistory境界を指定。
- `docs/work/WP-031-rive-editor-operational-entry.md`: CURRENT。新RIG入口のlazy起動/接続/再試行、固定SDKとprocess所有、Vite dev専用bridgeの限定契約。WP030の漫画/書体filesを変更しない。
- `docs/ai/WP-031-rive-entry-audit.md`: REFERENCE EVIDENCE。司令のhost接続/失敗/復帰監査。担当結果とnative/Browser/Owner受入の階層を分け、実装契約を上書きしない。
- `docs/ai/WP-031-rive-dev-entry-result.md`: REFERENCE EVIDENCE。専用companion/bridgeの固定cache・所有・HTTP・receipt競合修正の担当証拠。実製品監査は司令reportで区別する。
- `docs/work/WP-032-rive-direct-bone-edit.md`: CURRENT。一枚PNG/既存End骨のnative直接previewと一回compile、独立gesture/投影module、取消/未確定frame拒否の限定契約。共通renderer/保存を変更しない。
- `docs/ai/WP-032-rive-bone-editor-result.md`: REFERENCE EVIDENCE。担当の直接編集/native Browser結果と未実測範囲。初報を司令監査・制作受入へ拡張しない。
- `docs/ai/WP-032-rive-bone-audit.md`: REFERENCE EVIDENCE。司令のnative直接編集/保存再build/PNG/AX/狭幅と通常Raster受渡しの実測。Project再読込の半透明縁差によるHOLD、次の一般Raster保存修正案と未実測を保持する。
- `docs/ai/WP-029-rive-editor-result.md / WP-029-rive-integration-audit.md`: REFERENCE EVIDENCE。担当の独立native編集検証と司令の実製品Raster/History/Project往復監査。未確認の範囲を区別し、Card/製品コードを上書きしない。
- `docs/ai/2026-10-04-lettering-character-editing-result.md`: REFERENCE EVIDENCE。WP-028の実装・Browser/renderer/保存回帰と未受入範囲。Card/製品コードを上書きしない。
- `docs/ai/2026-10-04-manga-lettering-workflow-result.md`: REFERENCE EVIDENCE。WP-027の限定UI実装、Browser/数値behavior/保存回帰の証拠とOwner未受入範囲。Card/製品コードを上書きしない。

- `docs/ai/2026-10-04-manga-panel-workflow-design.md`: REFERENCE。漫画パネルの制作動線と、WP-027後の書体比較への情報/整理集約・4目的tab・Transform操作共通化・外へ膨らむ変形・3点サイズ/文字別編集の追加設計。追加機能の製品実装・保存契約承認ではない。

- `docs/ai/2026-10-04-rig-architecture-reassessment.md`: REFERENCE。評価器限定案とnative先行順序を再精査。Riveの独立Browser proofを次候補とし、製品採用/保存/renderer切替は決定しない。
- `docs/work/WP-026-rive-authoring-browser-proof.md`: CURRENT。Riveの一画像rig・限定GUI・公式build・Browser再読込・PNGの独立proofと司令監査。成立範囲・未実測はCard Completion、漫画/文字との並行導線はDEVELOPMENT、現在地はSTATUS。

- `docs/ai/2026-10-04-text-vector-draft-design.md`: REFERENCE。独自の文字編集骨格、交換可能な専門部品、ペン/図形等との共用範囲と制作例からの検証を仮設計。library採用・保存schema・汎用editorの実装承認ではない。

- `docs/ai/2026-10-04-text-vector-oss-shortlist.md`: REFERENCE。旧文字toolの継承不要を反映したOSS/license/日本語組版・幾何・変形の比較。製品依存導入・保存schema承認ではない。

- `docs/ai/2026-10-04-text-editing-proposal.md`: REFERENCE。QTP文字の漫画tab移植、曲線配置・envelope・将来Anime接点の調査と提案。実装指示・保存schema承認ではない。

- `docs/ai/WP-020-inochi-proof-result.md / WP-020-rig-entry-boundary.md`: REFERENCE。WP-020の実測結果と限定接点調査。実行契約はWP-020。

- `AGENTS.md`: 入口。`docs/TECHNICAL.md`: 技術契約。
- `docs/README.md / STATUS.md / PRODUCT.md / ARCHITECTURE.md / VOCABULARY.md / DEVELOPMENT.md / ROADMAP.md / AUDIT.md / DOCUMENT_REGISTER.md`: CURRENT。
- `docs/work/`: Work Package。登録済みpackageの機械的状態は`docs/harness.json`。未登録のWP-010〜018は対象CardとSTATUSで確認し、未登録を未実装と解釈しない。
- `docs/ai/ASTRA_OPERATING_RULES.md`: CURRENT。Astra専用のworker運用規約。他workerへ自動適用しない。
- `docs/ai/WEB_SUBCOMMANDER_CARD.md`: CURRENT REFERENCE。新規Webサブコマンダーの就任・読む順序・返却契約。役割権限はDEVELOPMENT、現在地はSTATUSが所有する。
- `docs/ai/2026-10-03-navigation-audit.md`: REFERENCE。就任カード発行時の導線検査・修正範囲・残る文書課題。現在の実装指示ではない。
- `docs/ai/INOCHI2D_EDIT_ROUNDTRIP_CAPABILITY.md`: REFERENCE。WP-019限定調査のSDK/API/runtime証拠。現在の実行契約はWP-019。
- `docs/ai/2026-10-03-rig-backend-implementation-proposal.md`: REFERENCE。限定追加調査後のbackend導入・保存境界・次の一件の設計提案。採用/schema変更/実装の承認ではない。
- `docs/ai/2026-10-03-curated-font-audit.md`: REFERENCE。WP-021の27書体取得・追加監査/保留リスト・Browser検証。実装契約はWP-021、現在地はSTATUS。
- `docs/ai/2026-10-04-font-organization-proposal.md`: REFERENCE。ホイール選択・一軸ツリー・Eドライブ保管の比較案。Owner案A承認後の実装範囲はWP-022、現在地はSTATUS。
- `docs/work/WP-022-font-organization.md`: CURRENT。外部実体・場面別一軸ツリー・wheel/手動順の限定実装カード。
- `docs/work/WP-023-font-auto-local.md`: CURRENT。個人開発server限定のloopback自動参照。通常接続UI非表示、公開buildへ実体とbridgeを含めない。
- `docs/work/WP-024-font-comparison.md`: CURRENT。比較page・warm見本・先読みの限定UI/runtime改善。
- `docs/work/WP-025-editable-manga-lettering.md`: CURRENT。Owner指定の再編集文字・曲線・少点変形。画素の保存/出力正本を維持。
- `docs/ai/2026-10-04-editable-lettering-result.md`: REFERENCE EVIDENCE。WP-025の実装・実engine/Project/Browser検証とOwner未受入の範囲。Card/製品コードを上書きしない。
- `docs/ai/2026-10-04-font-comparison-result.md`: REFERENCE。応答時間・比較pageとruntime cacheの検証記録。
- `docs/ai/2026-10-04-font-auto-local-result.md`: REFERENCE。自動参照の配信範囲と検証記録。
- `docs/ai/2026-10-04-font-organization-result.md`: REFERENCE。初期場面分類の根拠、外部保管、検証記録。
- `docs/ai/2026-10-03-manga-font-feasibility.md / 2026-10-03-manga-font-conditions.md`: REFERENCE。漫画用文字タブの事前検討と一次12候補の取得前調査。後続の取得・実装はWP-021と監査記録を参照。
- `docs/handoffs/2026-09-06-wp002-to-wp003.md`: HANDOFF SNAPSHOT。新チャット用の読み順・最初のSlice・除外範囲。現在地の正本はSTATUSのまま。
- `docs/handoffs/2026-10-02-pen-ruler-to-next.md`: HANDOFF SNAPSHOT。ペン刷新・DPR・定規の完了点、Ownerの好み、次の候補（集中線ほか）、環境メモ。現在地の正本はSTATUSのまま。
- `docs/legacy/PROGRESS.md / ARCHITECTURE.md / PHASE4Z_BOUNDARY.md / NEXT_CHAT_HANDOFF.md / CODEX_MULTI_MODEL_WORKFLOW.md`: SUPERSEDED ROUTING。
- `task-codex/phase9q.md`: PAUSED。A〜D証拠と未完Eを残す。
- `docs/UI_DESIGN_AUTHORITY_MAP.md`: CURRENT REFERENCE。styleの所有先、phase別checkpointを区別。
- `docs/reference/TRANSFORM_SESSION_BOUNDARY.md`: REFERENCE。局所履歴。現在のSOURCE/ANIMATEはdocs/ARCHITECTURE。
- `docs/reference/interaction/TEGAKI_OSS_GUI_INTERACTION_RESEARCH_2026-09-18.md`: REFERENCE。OSS・GUI・Timeline・Gesture等の調査・比較バンク（検討用参考資料）。現在の実装指示・製品正本ではない。
- `docs/reference/interaction/TIMELINE_POINTER_TERMINAL_EVIDENCE_2026-09-18.md`: REFERENCE。Timeline / Layer D&Dの異常終端（pointercancel）およびRetime再描画負荷の計測・実機証拠記録。現在の実装指示・製品正本ではない。
- `docs/OWNER_VERIFICATION_BACKLOG.md`: REFERENCE。制作受入の証拠。後のOwner受入を古いNG文より優先。
- `docs/reference/EXTERNAL_WEB_REVIEW_REQUEST_TEMPLATE.md`: REFERENCE。現行workflowはdocs/DEVELOPMENT。
- `Claude_GPT_Review/GITHUB.txt`: CURRENTの外部案内。仕様/現在地の第二正本にしない。

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
原文にある相対pathは元の配置から解釈する。現行読者は上記の移動先またはdocs/READMEを経由する。

`Claude_GPT_Review/GITHUB.txt`だけは上記の現行案内。そのほかの`Claude_GPT_Review/`、`関連ツール/`、非登録資料は外部参考/未分類。今回全件精読していない。CURRENTへ自動昇格しない。
`開発用資料保管庫/実装したいことメモ.txt`はOwner向け簡略要望。実装カードへ落とす時に現行コードと照合する。
保護されたBackup/PastFilesは登録・内容探索の対象外。

## 維持すること

新規の正本文書を増やす場合は、どの失敗を防ぎ、どの既存正本を置き換えるかを先に示す。
現行docのlink、登録漏れ、カード依存は`development-harness.mjs check`で検査する。
古い資料の削除や全Phaseの改名は必要条件にしない。現在と履歴の入口が混ざらないことを優先する。
