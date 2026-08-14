# Codexマルチモデル・外部Webレビュー運用

更新日: 2026-08-13  
状態: Phase 7tで実装完了。運用正本は`tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`

## 目的

TegakiのPhase方式とOwner Gateを維持しながら、SOLを主taskの設計・監査主体に固定し、明確な限定SliceだけをLUNA subagentへ委譲する。外部Web GPTは節目のsecond opinionに限定し、`GitHubURL.txt`同期と依頼準備、返却後の採否整理を半自動化する。

## 採用する構成

```text
Owner
  ↓
SOL main task
  ├─ 正本確認 / Phase設計 / 委譲判定
  ├─ SOL自身で実装
  └─ 明確な限定Sliceのみ tegaki_luna_worker
                              ↓
                         verifier / report
                              ↓
SOL diff / boundary review
  ↓
Browser / Owner Gate
```

主task自体のmodelを自動で切り替えるのではない。OwnerはSOLを選んだままにし、SOLが必要な時だけLUNA custom agentをspawnする。

## LUNA委譲条件

- 仕様、対象file、既存契約、完了条件、検証方法が確定している。
- 既存設計内の局所変更で、rollbackが容易。
- 新しいArchitecture、保存schema、History、Layer / CAF / Rig / Mesh境界判断を必要としない。
- 想定外判断が出たら変更せず`BLOCKED`でSOLへ戻せる。

曖昧な要望整理、原因不明bug、Phase設計、外部review採否、close、次Phase選定はSOLが担当する。

## External Web Review Gate

発動は大きな機能群、Architecture境界、数Phase後のロードマップ再点検、Owner要求時に限定する。日常のCSS調整、局所bug fix、verifier追加では原則使わない。

Codex側:

- `GitHubURL.txt` local鮮度・欠損・重複検査。
- review request作成。
- branch / commit / push状態の明示。
- 返却reportの実コード照合と採否分類。

Owner側:

- commit / push。
- Web GPTへの依頼とreport回収。
- Owner判断項目の決定。

外部reportは正本ではない。採用時もSOLが根拠、変更点、投入Phaseを明示する。

## 段階導入

1. Phase 7t Stage 0: 公式仕様・local環境調査、計画化。
2. Owner承認後: project-scoped LUNA workerを1件だけ追加。2026-08-13承認・導入。
3. read-only probeでmodel / reasoning / sandbox / routingを確認。2026-08-13、LUNA / MAX / read-only、fallbackなし、変更0でSOL判定`A`。
4. production code以外の限定write pilot。
5. SOL監査後、External Review request / URL verifierを導入。2026-08-13実装・同期。
6. 実績が良い場合だけworker用途を拡張する。

複数write agent、外部Web GPTの完全自動送受信、自動採用、複数Phase連続消化は導入しない。

## 現環境の注意

- repoの`.codex/`は空で、project agentは未導入。
- global configはSOL / XHighだが、global設定は変更しない。
- 公式仕様はLUNA custom agentを許す一方、現sessionのspawn override一覧はLUNAを表示していない。新taskでread-only probeを通るまでwrite委譲しない。
- Desktop同梱binaryとnpm CLIは別経路。CLIだけの成功をDesktop成功と読み替えない。

## 正本と原案

完了記録は`開発用資料保管庫/Archive/phase7t.md`、運用正本は`tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`。Web GPT作成の長文原案は`開発用資料保管庫/Archive/Tegaki_Codex_マルチモデル開発・外部Webレビュー半自動化_原案_2026-08-13.md`へ保存する。本書も実装済み計画としてPhase close時にArchiveへ移す。

## 公式資料

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://developers.openai.com/api/docs/models
