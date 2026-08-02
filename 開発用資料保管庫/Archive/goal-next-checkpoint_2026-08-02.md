# Tegakiを次のアーキテクチャ安全地点まで進めるGoal

> [!NOTE]
> 本文は当初Goalの契約記録。Ownerの後続指示でPhase 6v〜6yまで実装上限を拡張し、
> 2026-08-02にRaster Mesh / Bone Skinning MVPまでcloseした。次Goal開始前にArchiveへ移す。

## 目的

Tegakiの現行コード、進捗資料、Phase指示書、後続proposalを照合し、既に実装・検証済みの項目を再実装せずスキップする。

その上で、現在進行中の一つの責務系列について、欠けているStageだけを実装・検証し、次の新しい責務へ入る直前の安定した区切りまで到達する。

単にproposalの項目数を消化することを目的にしない。既存の保存正本、History、描画経路、互換性を維持しながら、実コードと検証結果で証明できる地点を完了地点とする。

## 最初に読むもの

次の順で確認する。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `git status --short --untracked-files=all`
5. `task-codex/`内の現行または最新Phase指示書
6. `proposals/00_計画索引.md`
7. `proposals/01_短中期ロードマップ.md`
8. 現行Phaseまたは次候補から直接参照されるproposal
9. 必要な場合だけ該当する`Archive/`文書

ファイル名に連番や重複suffixがある場合は、リポジトリ内の実ファイル名を確認して読み替える。

過去計画フォルダは、現行正本だけでは判断材料が不足する場合に限って読む。過去資料そのものを実装契約として使用しない。

## 正本の優先順位

記述が衝突する場合は、次の順で確認する。

1. `TEGAKI.md`と`AGENTS.md`
2. 現行`task-codex/phase*.md`
3. `tegaki_work/PROGRESS.md`
4. 現行コードとテストで確認できる実際の挙動
5. `00_計画索引.md`
6. 各proposal
7. Archiveおよび過去計画

proposalをそのまま実装指示書として扱わない。

文書のPhase番号や「現行」という記述が食い違う場合は、更新日だけで機械的に決めず、コード、テスト、Archive、現行Phase指示書から実際の到達点を確定する。

## 実装済み判定

各候補を次のいずれかに分類する。

* `VERIFIED_IMPLEMENTED`
* `IMPLEMENTED_UNVERIFIED`
* `PARTIAL`
* `NOT_IMPLEMENTED`
* `SUPERSEDED`
* `DEFERRED_BY_GATE`
* `BLOCKED`

関数名、schema、UI部品が存在するだけでは実装済みと判定しない。

原則として、次が該当範囲で確認できた場合に`VERIFIED_IMPLEMENTED`とする。

* 保存と再読込
* Undo / RedoとHistory境界
* copy / paste時のstable ID remap
* preview / playback / onion / Bake / exportでの共通評価
* 旧Projectおよび機能未使用Projectの互換性
* pointer cancel / lost capture時のrollback
* 対応するcheck、test、verifier、buildまたはBrowser smoke

既に正しく実装されている機能は書き直さない。名称変更、抽象化、リファクタリングも、現在のGoal達成に不可欠でない限り行わない。

一部だけ不足している場合は、Phase全体を再実装せず不足箇所だけを対象にする。

## 進捗台帳

作業開始時に`task-codex/GOAL_LEDGER.md`を作成または更新する。

最低限、次を記録する。

| 項目 | 状態 | 根拠となるコード | 検証 | 残作業 | 判断 |
| -- | -- | -------- | -- | --- | -- |

さらに、常に次を短く維持する。

* 現在のcheckpoint
* 完了して検証済みの項目
* スキップした実装済み項目
* 変更したファイル
* 実行済み検証コマンドと結果
* 未検証項目
* blocker
* 次の一手

同じ監査やテストを理由なく繰り返さない。再実行する場合は、前回結果を無効にする変更が何かを台帳へ記録する。

## 作業範囲の選択

最初に、現行Phaseと後続proposalを実コードへ照合し、依存関係を壊さず実施できる最初の未完了vertical sliceを選ぶ。

現在の資料が有効なら、第一候補は次の系列である。

* 現行Phase 6s Gate 0の完了
* Folder別WARPの既存deformer再利用境界の確定
* stable Folder ID、copy remap、validation、History、Project round-tripの確認
* CPU / Pixi / preview / onion / Bake / exportが同じsample結果を使うことの確認
* root WARP、Bone / Part world matrix、Folder RenderIslandとの評価順の確認
* Gate結果が`GO`で、実装Stageが現行Phase指示書で十分限定されている場合だけ、その限定Stageを実装
* 必要な検証とcloseout文書更新

ただし、実コード上でこの系列が既に完了している場合は再実装しない。証拠を台帳へ記録し、次候補のGate 0へ進む。

## このGoalの上限

このGoalでは、一つの既存責務系列のcloseoutまでを実装上限とする。

現行資料に基づく標準上限は、Folder別WARP系列のcloseoutである。

次は別の保存正本、solver、topology、入力方式または研究境界を開くため、このGoalでは実装を開始しない。

* 任意Triangle Meshの本実装
* SkinWeightとBONE Skinning
* IK、Pin、Follow、Stretch
* Quick Rig、Primitive Cage、Auto Contour、Ribbon
* Motion Perform
* Draw Order track
* Dynamics、Collider、Rigid Body、接触変形
* Motion Graphの編集機能
* Animation Camera Track
* 再編集可能Text Layer
* Folder blend完全group合成
* WebGPU画材
* AI連携
* 本格物理

現在の責務系列が既に完了している場合は、依存順で次になる候補についてGate 0を行ってよい。

その場合は次を成果物として作成する。

* 現行構造図
* 再利用可能module一覧
* 重複実装の危険一覧
* 不足契約とrisk
* Plan A / Plan B比較
* 最小prototypeまたは固定入力案
* Phase分割案
* `GO / REVISE / STOP`判定
* 次の`task-codex/phase*.md`

ただし、新しい責務の製品実装には入らず停止する。

## 維持する契約

作業中は少なくとも次を維持する。

* 現行の描画、保存、Historyを壊さない
* 一つのPhaseで一つの正本境界だけを拡張する
* `ClipInstance.transformKeyframes`等の既存Motion正本を重複させない
* 既存WARP deformerのBind、Pose、placement、samplingを別名で再実装しない
* UI state、dense sample、solver cache、GPU bufferをProject正本にしない
* previewとexportで別のsolver、sampler、evaluatorを作らない
* 新機能未使用Projectのpixelを変えない
* optional field欠損をidentityまたは既定値として安全に扱う
* invalid ID、cycle、clipping分断、topology不整合を無言修復しない
* 1 gesture = 1 History
* cancel時にProject、History、cacheへ変更を残さない
* 既存の未commit変更を維持し、無関係な変更をreset、上書き、整形しない

## 実施手順

各checkpointで次を繰り返す。

1. 現況を監査する。
2. 実装済み、部分実装、未実装を証拠付きで分類する。
3. 現在の限定Stageに必要な変更だけを計画する。
4. 変更前に停止条件へ該当しないことを確認する。
5. 最小変更を実装する。
6. node check、対象test、verifier、buildを実行する。
7. 利用可能なら固定入力またはBrowser smokeで実挙動を確認する。
8. diffをレビューする。
9. `GOAL_LEDGER.md`を更新する。
10. 次のcheckpointへ進めるか判定する。

テスト失敗は、今回の変更による回帰、既存失敗、環境依存を分けて報告する。既存失敗をGoal達成のために無関係な範囲まで修正しない。

## 停止条件

次の場合は推測で実装を続けず、変更を安全な状態にして停止する。

* 新しい保存正本を追加しないと進められない
* 既存正本と同じ責務を別schemaへ重複保存する必要がある
* previewとexportで別実装が必要になる
* Folder clippingまたはRenderIsland境界を説明できない
* CPUとPixiで異なる座標契約が必要になる
* 旧Project互換を維持できない
* topologyやbinding変更が既存Animationを無言破壊する
* 容量上限、dispose、cancel、rollbackを定義できない
* 現行Phase指示書にない大規模なarchitecture変更が必要になる
* 新しい依存package、外部service、権限変更が必要になる
* ownerの実機操作、視覚判断、touch評価がないとGO / HOLDを決められない
* 複数の有力設計案があり、コードから一意に決められない
* 無関係な既存変更と安全に分離できない

停止時は、何が完了済みで、何が未完了で、どの判断だけが必要かを明記する。

## 完了条件

次をすべて満たした時にこのGoalを完了とする。

1. 現行Phaseと直接関係する後続候補が、実装済み・部分実装・未実装に証拠付きで分類されている。
2. 既に実装された機能を再実装していない。
3. 現在の一つの責務系列が、実装、検証、文書更新まで完了している。
4. 対象範囲のcheck、test、verifier、buildが成功しているか、既存失敗との差が説明されている。
5. preview / playback / onion / Bake / export等の共通経路が対象範囲で確認されている。
6. `tegaki_work/PROGRESS.md`が実際の現在地、既知残存、次の入口を示している。
7. 完了Phase文書が必要に応じてArchiveへ移されている。
8. proposal内の明らかに古い「現行Phase」記述が、履歴を失わない形で整理されている。
9. 次の新しい責務については、Gate 0とPhase指示書までに留め、製品実装を開始していない。
10. 最終報告に、変更、スキップ、検証結果、残存risk、次の推奨Phase、owner確認項目が含まれている。

この条件を満たすまで、同じ責務系列内の未完了項目について監査、修正、検証を継続する。
