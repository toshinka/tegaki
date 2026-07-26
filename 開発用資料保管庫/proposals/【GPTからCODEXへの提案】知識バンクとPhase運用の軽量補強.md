# CODEX提案: 知識バンク・Phase運用の軽量補強

更新日: 2026-07-18

## 結論

現行の知識バンク駆動・Phase契約駆動の運用は概ね良好であり、全面再編は行わない。

提案段階では、次の二つを一つの文書にまとめてCodexへ渡す。

1. Phase文書の判断トレースを軽量に補強する。
2. Markdownへ最小限の機械可読メタデータを追加し、Codexが読む資料を絞りやすくする。

両者は関連するが責務が異なるため、単一仕様へ混ぜず独立した節として扱う。

- 判断トレース: 人間が「なぜこの方針になったか」を追うための補助。
- 機械可読メタデータ: Codexが「どの文書を読むべきか」を判断するための補助。

独立ADR群、OKF準拠、専用知識管理システムは導入しない。

## 現行運用

```text
番号付きproposal・調査文書
    ↓ 必要な知識と判断を抽出
現行Phase指示書
    ↓ 実装・検証
PROGRESS.md
    ↓ 完了
Archive / closeout
```

- 番号付きproposal: 将来候補、調査結果、設計知識、未実装案を保持する知識バンク。
- 現行Phase: 現在採用する判断、対象外、実装順、gate、検証、完了条件を持つ実行契約。
- `PROGRESS.md`: 実装中に確認された事実、回帰、検証結果、残件。
- Archive / closeout: 完了Phaseの結果と証拠。
- `TEGAKI.md` / `AGENTS.md`: 複数Phaseを越えて守る確定契約。

## なぜ提案書は一束化するか

別々の改善提案として渡すと、CodexがADR導入とOKF導入を別制度として実装し、proposal・Phase・metadata間の正本関係を複雑化するおそれがある。

一つの提案書にまとめ、共通目的を次に限定する。

> 現行文書を作り直さず、判断の探索性とCodexの文書選択精度だけを改善する。

ただし、判断トレースとメタデータは相互に必須依存させない。

## 提案A: Phase文書の判断トレース

### A1. 抽出した判断

中規模以上のPhaseでは、proposal群から今回採用した設計判断だけを短く列挙できる。

```markdown
## 抽出した判断

- 固定Warp Grid v1は軽量互換機能として維持し、旧Projectを自動変換しない。
- 可変密度矩形Gridと自由点はWarp v2ではなくControl Meshへ統合する。
- Control Meshは独立schemaを持ち、Warpの16点keyへ代理保存しない。
- CPU referenceを一致判定のoracleとして維持し、Pixi / 将来WebGPUはadapterとする。
```

運用条件:

- proposal本文を複製しない。
- 3〜7項目程度に抑える。
- 実装手順ではなく設計判断だけを書く。
- 既存の`維持する契約`と重複する場合は統合する。
- 小規模Phaseでは追加しない。

### A2. 判断変更

Phase中に設計方針そのものを撤回・変更した場合だけ記録する。

```markdown
## 判断変更

### 2026-07-17: GRID RANGE / CAGE案を撤回

- 変更前: 固定Warpの範囲変更UIをControl Meshへの入口候補とする。
- 変更後: 固定WarpはPOINTS編集へ戻し、四隅操作は将来のmulti-select / cage gestureとして再検討する。
- 理由: 実機上で描画制限のように見え、可変密度や自由点Meshへの入口として機能しなかった。
- 互換影響: Warp v1 schema、sampling、Project保存、exportは変更しない。
```

対象:

- 保存schema、migration方針、正本所有者、評価順の変更。
- 採用済みUI概念や機能境界の撤回。
- 後続Phaseの責務分離へ影響する変更。

単純なバグ修正、ファイル名変更、UI位置調整、内部実装だけの変更は対象外。

### A3. 最終判断

Phase完了時に、設計上確定した結果だけを短く残す。Phase本文またはcloseout文書のどちらか一方に置き、二重記録しない。

```markdown
## 最終判断

- 固定Warp Grid v1は互換機能として維持する。
- Control Meshは独立schemaとして採用する。
- 旧Warp ProjectをControl Meshへ自動変換しない。
- CPU reference rendererを比較oracleとして維持する。
- 自由点追加・削除とTopology変更Historyは後続Phaseへ送る。
```

## 提案B: 最小限の機械可読メタデータ

### 目的

Markdown本文を置き換えず、Codexが次を判断しやすくする。

- 現在activeなPhase。
- Phaseが判断を抽出したproposal。
- proposal、Phase、Archive、全体契約の区別。
- archived文書を現行指示として誤読しないこと。
- 関連文書だけを段階的に読むこと。
- リンク切れ、重複ID、status不一致の検査。

### OKFから借りる部分

- Markdownを知識の本体として維持する。
- YAMLフロントマターを薄いメタデータ層として使う。
- indexから必要な文書だけを読む。
- 未知のfieldを削除・拒否しない。
- 専用サービスや固定分類へ依存しない。

### OKFから借りない部分

- OKF準拠を目標にしない。
- ファイルパスを永続IDとして使わない。
- 一概念一ファイルへ強制分割しない。
- `log.md`を追加して`PROGRESS.md`と履歴を重複させない。
- 全既存Markdownへ一括変換しない。

## 推奨フロントマター

### proposal例

```yaml
---
type: proposal
id: tegaki.proposal.deformer-roadmap
status: active
title: 変形アニメーション・メッシュ・GPU画材ロードマップ
description: Deformer、Control Mesh、Bone、GPU画材の段階計画
tags:
  - animation
  - deformer
  - control-mesh
updated: 2026-07-17
---
```

### Phase例

```yaml
---
type: phase
id: tegaki.phase.6b
status: active
title: Warp互換維持・Control Mesh移行gate
tags:
  - warp
  - control-mesh
  - compatibility
sources:
  - tegaki.proposal.short-mid-roadmap
  - tegaki.proposal.deformer-roadmap
previous:
  - tegaki.phase.6
updated: 2026-07-17
---
```

### Archive例

```yaml
---
type: phase
id: tegaki.phase.6
status: archived
title: 固定Warp Grid / Morph Deformer基盤
next:
  - tegaki.phase.6b
updated: 2026-07-17
---
```

## 最小field

試験導入時は次だけでよい。

- `type`
- `id`
- `status`
- `title`
- `updated`

Phaseだけ必要に応じて追加:

- `sources`
- `previous`
- `tags`

推奨値:

- `type`: `proposal / phase / contract / progress / archive / index`
- `status`: `active / proposed / deferred / archived / superseded`

`completed`は実装状態と設計判断状態を混同しやすいため、初期fieldには使わない。

## ID方針

ファイルパスをIDにしない。Phase文書は完了後にArchiveへ移るため、固定IDを使う。

```yaml
id: tegaki.phase.6b
```

移動、rename、Archive後もIDを維持する。

## Codexの読み取り規則

```markdown
## 文書読み取り規則

1. `status: active`のPhaseを現在の実行契約とする。
2. active Phaseの`sources`にあるproposalを設計背景として優先して読む。
3. `previous`は互換契約とcloseout結果の確認に使う。
4. `status: archived`のPhaseを現行指示として扱わない。
5. proposal内の候補は、active Phaseへ抽出されていない限り実装しない。
6. `contract`文書は全Phase共通の不変条件として扱う。
7. 未知のfrontmatter fieldを削除・正規化しない。
8. frontmatterと本文が矛盾する場合は矛盾を報告し、本文の明示契約を優先する。
```

## indexへの流用

`00_計画索引.md`は人間が管理する正本として維持し、必要なら末尾へ機械生成の検査結果だけを追加する。

```markdown
## 自動検査

<!-- BEGIN GENERATED CHECK -->

- Active Phase: tegaki.phase.6b
- Broken references: 0
- Duplicate IDs: 0
- Archived files with active status: 0

<!-- END GENERATED CHECK -->
```

索引本文を全面生成・並べ替えしない。

## 判断トレースとメタデータの関係

```text
frontmatter
  → どの文書を読むか

抽出した判断
  → その文書から何を採用したか

判断変更
  → 実装中に何が変わったか

最終判断
  → Phase完了後に何が確定したか
```

どちらか一方だけでも運用可能にする。

## 上位文書へ昇格する条件

同じ判断が複数Phaseで恒久的に必要になる場合、独立ADRではなく既存の全体契約文書へ昇格する。

候補:

- `TEGAKI.md`
- `AGENTS.md`
- `PROGRESS.md`の`維持する契約`
- 適切なproposalの`境界`または`判断`

条件:

1. 現行Phase固有ではない。
2. 複数の後続Phaseで違反すると正本、互換性、exportが破損する。
3. 実装結果または固定入力で妥当性が確認されている。
4. 将来案ではなく現在確定している。

## 適用しないこと

- `docs/adr/`を新設しない。
- OKF validatorや専用catalogを最初から導入しない。
- 過去Phaseを一括して書き換えない。
- 全文書へfrontmatterを強制しない。
- proposal本文を細分化しない。
- metadataを新しい仕様正本として扱わない。
- `sources`にあるproposalの全項目を採用済みとみなさない。
- PROGRESSの実装履歴をPhaseへ再転記しない。
- indexを完全自動生成へ置換しない。

## Phase 6bへの適用判断

Phase 6bはすでに目的、読むもの、Slice、互換方針、gate、将来系列、維持契約、検証、完了条件、撤回理由を持つため、大幅変更は不要。

試す場合は次だけでよい。

1. 冒頭へ最小frontmatterを追加する。
2. closeout時に`最終判断`を追加する。

`抽出した判断`と`維持する契約`が大きく重複する場合は追加しない。

## 導入順

### Stage 0: 提案のみ

- 本提案をCodexへ渡す。
- 既存ファイルは変更しない。
- 重複管理や過剰な仕様化が起きないか確認する。

### Stage 1: 一つの新規Phaseで試験

- 新規Phaseへ最小frontmatterを付ける。
- `抽出した判断`または`最終判断`の片方だけを試す。
- CodexにID、status、sources、リンク切れを検査させる。

### Stage 2: 2〜3 Phase評価

- 読む資料が減ったか。
- proposalの未採用候補を誤実装しにくくなったか。
- 確定判断を探しやすくなったか。
- metadataと本文の二重更新が負担になっていないか。
- Codexがfrontmatterを過剰に正規化しないか。

### Stage 3: 必要な範囲だけ展開

効果が確認できた場合だけ、active Phase、現在参照中のproposal、全体契約文書、新しくArchiveするPhaseへ展開する。古いArchiveの一括変換は行わない。

## 分冊する条件

提案段階では本書一冊を維持する。次の場合だけ分冊する。

### metadata validatorを実装する場合

frontmatter schema、ID検査、リンク検査、自動index生成の技術仕様を別文書へ分ける。

```text
CODEX提案_知識バンクとPhase運用の軽量補強.md
KNOWLEDGE_METADATA_SPEC.md
```

### 判断トレースを正式テンプレート化する場合

複数Phaseで正式採用したら、短い規則を`AGENTS.md`またはPhase templateへ移す。

### OKF互換出力が必要になった場合

外部ツールや別リポジトリと知識交換する必要が出た場合だけ、OKF互換層を別仕様として検討する。

## 採用条件

- Codexが現在読むべきPhaseとproposalを短時間で特定できる。
- proposal内の未採用候補を実装対象と誤認しにくくなる。
- Phaseの設計判断と実装手順を区別できる。
- Archive移動後も文書IDが維持される。
- proposal、Phase、PROGRESS、Archiveの内容重複が増えない。
- metadataなしでも既存運用が継続できる。
- 既存の維持契約、検証、完了条件を弱めない。

## 不採用・撤回条件

- Codexがfrontmatterを本文より優先して誤実装する。
- IDやstatus更新が負担になる。
- `sources`更新漏れで必要資料が読まれなくなる。
- `抽出した判断`がproposal本文のコピーになる。
- index、Phase、metadata間の同期修正が頻発する。
- 文書選択精度や探索時間が改善しない。

## 最終提案

Codexへは本書一冊を入口として渡す。

現行運用を維持し、次の二つを独立した任意補助として小さく試す。

1. Phase内の判断トレース:
   - `抽出した判断`
   - `判断変更`
   - `最終判断`

2. Markdownの最小メタデータ:
   - `type`
   - `id`
   - `status`
   - `title`
   - `updated`
   - Phaseでは必要に応じて`sources / previous / tags`

提案段階では分冊しない。

正式採用後は、Codexの入口を増やすのではなく、用途ごとに既存文書へ配置する。

- Phaseテンプレート規則: `AGENTS.md`またはPhase template。
- metadata技術仕様: validatorを実装する場合だけ別文書。
- 全Phase共通契約: `TEGAKI.md` / `AGENTS.md`。
