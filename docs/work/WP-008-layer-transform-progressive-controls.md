# WP-008 — Layer Transform Progressive Controls

状態: **PLANNED — DESIGN / AUDIT FIRST**  
Production実装: **未開始**  
作成時参照HEAD: `8d33e7e1144c220edb019ce4ba62d6e8ae2ec5de`

## Goal

Layer Transformを、常時は軽く・必要な時だけ高度な操作を展開できる編集面へ育てる。

現在の`BASIC | WARP`を第一水位として維持し、その下に各mode専用の第二水位を設ける。WARP Workspaceに既に存在する高度機能をそのままUIごと移植するのではなく、Layer Transformで日常的に使う操作へ絞って再配置する。

このWPは、UIを先に増やすためのものではない。

最初に、

- BASIC / WARPそれぞれの責務
- 第二水位で露出すべき機能
- 既存WARP Workspaceから再利用できる実装
- Simple 4x4 WARPとAdvanced WARPの境界
- Animation編集との接続
- 将来のediting-session抽出で必要になる境界

をread-onlyで整理し、その後にGUI設計とproduction実装を段階的に行う。

---

## Background

WP-005でLayer TransformへSimple 4x4 WARPを接続した結果、Canvas上の直接操作としては理解しやすく、通常用途では軽量な入口になった。

一方、既存WARP Workspaceには以下のような高度機能が存在する。

- WARP分割数 / grid density
- bounding box / cageの移動
- bounding box / cageの回転
- bounding box / cageの変形
- 各種変形ブラシ
- その他Advanced WARP操作

既存Workspaceは機能量が多く、日常操作の入口としては情報密度が高い。

Layer Transform側では、

> 必要ない時には隠す。必要になった時だけ一段深く開く。開いた先も用途を絞る。

という段階露出を採用候補とする。

---

## Product Principle

Layer Transformは「高度機能を全部見せるWorkspace」にはしない。

第一水位:

```text
BASIC | WARP
```

は、対象を選んですぐ操作するための主要面とする。

第二水位はmode-localとする。

概念例:

```text
┌──────────────┬──────────────┐
│    BASIC     │     WARP     │
└──────────────┴──────────────┘

BASIC選択中:
[ BASIC 拡張 ▾ ]

WARP選択中:
                    [ ▾ WARP 拡張 ]
```

視覚設計候補:

- BASIC側拡張入口は左寄せ
- WARP側拡張入口は右寄せ
- 非選択modeの拡張内容を常時表示しない
- 第一水位の主要操作を第二水位の設定群で押し下げない
- 詳細を閉じればSimple操作へ即座に戻れる

最終GUIはOwner / GUI相談で決める。上記はarchitecture上の情報階層候補であり、pixel-level仕様ではない。

---

## Relation to WP-005

WP-005はSimple WARP UIの完成を担当する。

以下はWP-005に残す。

- Simple 4x4 / 16 points
- normal SOURCE
- CAF SOURCE
- CAF ANIMATE
- live preview
- V / explicit KEY confirm
- History / cancel terminal
- Export terminal
- Simple WARPのOwner acceptance
- KEY確定後の連続Animation編集を既存WP-003契約へ揃える限定補修

WP-008へ移さない。

WP-008はWP-005のOwner acceptanceを迂回して開始しない。

---

## Relation to WP-003

WP-003のAnimation操作契約を壊さない。

Layer Transformの時間編集は原則として、

```text
編集
→ KEY確定
→ panel / handlesを維持
→ prev / next / strip wheel
→ 次Frameを編集
```

という連続編集文法を共有する。

WP-008でWARPの高度機能を追加する場合も、独自のFrame移動・KEY terminalを新設しない。

---

## Relation to Existing WARP Workspace

既存WARP Workspaceは削除対象ではない。

初期方針:

```text
Existing WARP Workspace
= advanced implementation / algorithm source

Layer Transform
= reduced daily-production surface
```

WP-008で確認するのは「何を再利用できるか」であり、「WorkspaceをLayer Transformへ丸ごと移植するか」ではない。

以下を必ず分離して監査する。

1. UI
2. Pointer / gesture controller
3. Warp mathematics
4. Grid / topology representation
5. Brush algorithms
6. Cage / bounds operations
7. Preview renderer
8. History boundary
9. Save / Project authority
10. Animation key authority

UIが再利用不能でもalgorithmが再利用可能な場合がある。  
逆にUIだけ似ていても保存authorityが異なる場合は統合しない。

---

# Scope

## A. Mode-local Progressive Disclosure

BASIC / WARPそれぞれに第二水位を設ける設計。

確認対象:

- 開閉状態
- mode切替時の表示
- session中の切替可否
- panel高さ
- Canvasを隠しすぎない配置
- Animation Table展開時の狭い作業面
- keyboard / pen中心操作との両立

第一水位のBASIC / WARP切替契約を壊さない。

---

## B. WARP — Grid Density

将来候補としてWARP分割数を第二水位へ置く。

例:

```text
GRID
4 × 4
6 × 6
8 × 8
...
```

ただし現行Simple WARPは固定4x4 / 16 pointsが正本であり、non-4x4は`advanced-layer-warp-required`として明示拒否する。

したがって最初に確認する。

- 既存Workspaceのgrid topology schema
- Layer WARPの保存schema
- `ClipInstance.layerDeformers`との互換
- keyframe間でdensityを変えられるか
- density変更が既存keyへ何を意味するか
- Project roundtrip
- CPU compositor
- Pixi preview
- Export
- duplicate / remap / delete / retime

これらが未整理のままUIだけ分割数選択を追加しない。

---

## C. WARP — Cage / Bounding Box

第二水位候補。

必要機能:

- WARP対象bounds全体の移動
- 回転
- scale
- skew / corner transform候補
- control meshとboundsの関係表示

重要:

BASIC TransformとWARP Cageは似た操作を持つ可能性があるため、authorityを二重化しない。

確認事項:

```text
BASIC matrix
WARP cage transform
control point mutation
Layer Motion
```

の関係。

「Cageを動かしたらBASIC matrixを書き換える」のか、  
「WARP pointsを一括変換する」のか、  
「別のdeformer stateを持つ」のか、

を実装前に決める。

新しい保存正本を安易に増やさない。

---

## D. WARP — Deformation Brushes

WP-008で最重要の高度操作候補。

既存WARP Workspaceに実装済みのbrush群を調査する。

最低限、各brushについて記録:

- 何を入力とするか
- 何をmutationするか
- points / mesh / rasterのどれを変えるか
- radius
- strength
- falloff
- direction
- pressure対応
- Undo単位
- pointermove preview cost
- CPU / Pixi依存
- Animation keyとの接続可否
- Simple 4x4で意味があるか
- 高密度gridが必須か

変形ブラシは操作性上重要なため、採用する場合は深い「詳細設定の中のさらに詳細」へ埋めない。

第二水位を開いた後、少ない操作でbrushへ到達できることをGUI要件とする。

---

## E. BASIC Extension Candidates

BASIC側にも第二水位を設ける前提で監査する。

ただし現段階では機能を増やすこと自体をGoalにしない。

候補:

- pivot / anchor
- precise position
- rotation
- scale
- numeric transform
- reset / normalize
- local / canvas coordinate display
- Animation Motion key関連補助

現在すでに「詳細 — 数値で正確に調整」が存在する場合、それを第二水位へどう整理するか確認する。

BASIC側だけ別のUI体系にしない。

---

# Information Architecture

Layer Transformは概念的に次の3水位までに抑える。

## Level 1 — Immediate

毎回見える。

```text
BASIC | WARP
current edit status
confirm / cancel
minimum frame/key guide when ANIMATE
```

## Level 2 — Mode Extension

必要な時だけ開く。

BASIC例:

```text
POSITION
ROTATION
SCALE
PIVOT
```

WARP例:

```text
GRID
CAGE
BRUSH
```

## Level 3 — Local Fine Controls

Level 2で選んだ機能に必要な最小設定。

例:

```text
Brush:
radius
strength
falloff
```

Level 3を越えて設定階層を増やす場合は、専用Workspaceへのhandoffも比較する。

---

# Animation UX

Animation Table展開時でもLayer TransformのCanvas直接操作を主役にする。

目標操作感:

```text
Frame F2
→ deform
→ KEY確定
→ wheel / next
→ F3
→ deform
→ KEY確定
→ wheel / next
→ F4
```

高度WARP操作を使用していても、この時間編集文法を維持する。

未確定candidate中のFrame移動は、既存契約を維持して明示拒否する。

暗黙commitは導入しない。

---

# GUI Handoff / Astra Consultation

GUI相談へ渡す前に、このWPのDesign/Audit Sliceで「動かせないarchitecture条件」を整理する。

Astra等へ渡す資料には最低限以下を含める。

## Fixed

- BASIC / WARPが第一水位
- Canvas直接操作が中心
- Animation Tableと同時表示される
- Layer Transformを巨大Inspectorにしない
- mode-local progressive disclosure
- 未確定 / KEYEDを明確に区別
- confirm / cancelは見失わせない
- Previewはinteractive
- 保存authorityはUIから独立
- Advanced機能を常時展開しない

## Flexible

- extension buttonの形
- icon
- label
- open direction
- accordion / popover / inline tray
- parameter layout
- brush presetの見せ方
- narrow viewport layout

GUI案は複数案比較を前提とする。

---

# Design / Audit First Slice

WP-008の最初のSliceではproduction codeを変更しない。

読む範囲を限定して以下を作る。

## 1. Existing WARP Capability Map

表形式:

| Capability | Current UI | Controller | Model | Preview | History | Project | Layer Transform reuse |
|---|---|---|---|---|---|---|---|
| Grid density | | | | | | | |
| Cage move | | | | | | | |
| Cage rotate | | | | | | | |
| Cage deform | | | | | | | |
| Brush A | | | | | | | |
| Brush B | | | | | | | |

---

## 2. Authority Map

各操作についてmutation authorityを一つに絞る。

例:

```text
Simple WARP points
Advanced grid
Cage transform
Brush deformation
BASIC transform
Layer Motion
```

二つの正本が同じ見た目を所有しないこと。

---

## 3. Reuse Classification

各既存機能を以下へ分類。

```text
R1 — reuse as-is
R2 — reuse algorithm/controller with new UI
R3 — adapter required
R4 — incompatible with Layer Transform authority
R5 — redesign required
```

---

## 4. UI Requirement Sheet

Astra / GUI相談用に、

- task
- frequency
- visibility level
- primary gesture
- secondary settings
- error / blocked states
- ANIMATE states
- narrow-screen constraints

をまとめる。

---

## 5. Implementation Slices Proposal

Design/Audit結果から初めて実装順を決める。

仮候補:

```text
Slice A
Mode-local extension shell only

Slice B
BASIC existing detailed controls relocation / cleanup

Slice C
WARP Cage using existing compatible authority

Slice D
WARP Grid density if schema/evaluator compatibility is proven

Slice E
WARP Brush minimum viable set

Slice F
Animation / Export / Save / Owner acceptance
```

監査結果によって順序・採否を変えてよい。

---

# Architecture Constraints

## Save Authority

UI stateをProject正本にしない。

既存Project authorityを優先する。

Simple WARP:

```text
normal SOURCE:
Raster bake

CAF SOURCE:
DrawingSnapshot authority

CAF ANIMATE:
ClipInstance.layerDeformers
```

Advanced機能で新しいauthorityが必要に見えた場合は、その時点でSTOPし、architecture decisionを要求する。

---

## Preview Authority

既存決定を維持。

```text
CPU compositor / Bake / Export
= canonical pixel authority

Pixi
= interactive GPU proxy
```

高度WARP機能追加を理由にpointermoveごとのcontinuous CPU final previewへ戻さない。

---

## History

一つのユーザー確定操作は原則History 1。

pointermoveはHistory 0。

gesture endはsession endではない。

confirm / cancel terminalを各brushごとに新設しない。

---

## Export

pending Layer Transformは既存WP-007契約を使用。

Advanced WARPでも独自のExport bypassを作らない。

---

## Project Compatibility

既存Projectを自動移行しない。

Legacy fileで新fieldがない場合のidentity behaviorを維持する。

---

# Editing Session Boundary Relation

ROADMAP上の「一つの編集session境界の抽出」は、このWPの設計監査結果を参照してから具体化する。

理由:

将来Layer Transformへ、

- cage
- variable topology
- brush gesture
- numeric extension
- Animation continuation

が接続される可能性がある。

現在のSimple WARPだけを見て狭すぎるsession facadeを固定すると、直後に再分割が必要になる。

ただしWP-008自身が巨大Popup分割を実行してはいけない。

このWPは「将来通す必要のある入力/状態/terminal」を設計材料として渡す。

---

# Non-Goals

WP-008のDesign/Audit段階では行わない。

- production UI実装
- WARP Workspace削除
- WARP Workspace全面移植
- arbitrary mesh schema追加
- root Clip WARP変更
- Folder WARP設計
- RIG integration
- Mesh/Skin composition redesign
- clipping redesign
- F-007
- Physics
- AI deformation
- renderer rewrite
- Project schema rewrite
- History framework rewrite
- AnimationTablePopup全面分割
- BasePopup rewrite
- 全Inspector再設計

---

# Decision Gates

## DG-1 — Progressive Disclosure

BASIC / WARP mode-local第二水位を採用するか。

Owner + GUI review。

---

## DG-2 — Advanced WARP Authority

variable grid / cage / brushを現在のLayer WARP authorityへ接続可能か。

技術review。

---

## DG-3 — Existing Workspace Reuse

既存WARP Workspaceから何を再利用するか。

能力単位で判断する。

---

## DG-4 — Brush Minimum Set

Layer Transformへ最初に持ち込むbrushを何種類に絞るか。

Owner操作頻度と技術費用で判断。

---

## DG-5 — Dedicated Workspace Boundary

Level 2 / 3で収まらない機能をLayer Transformへ入れるか、既存Workspaceへのhandoffに残すか。

GUI review。

---

# Design Acceptance

Design/Audit Sliceの完了条件:

- Existing WARP capability mapがある
- Grid / Cage / Brushのmutation authorityが説明できる
- Simple 4x4との境界が明確
- non-4x4の保存・Animation key互換の有無が説明できる
- reuse classificationがある
- BASIC / WARP第二水位の情報構造案がある
- narrow Animation Table表示を考慮している
- Astra / GUI相談用requirementsがある
- editing-session抽出へ必要な将来境界を渡せる
- production codeを変更していない

---

# Production Acceptance — Future

実装段階へ進んだ場合の最終条件候補。

- Simple BASIC / Simple WARPの速度を悪化させない
- 第二水位を閉じれば現在の軽いUIへ戻る
- mode切替で他modeの詳細が残留しない
- Animation KEY継続編集を維持
- pending中のFrame移動契約を維持
- pointer gesture History 0
- confirm History 1
- cancel History 0
- Export guard維持
- Project roundtrip
- CPU final authority維持
- Pixi interactive preview維持
- existing WARP Workspaceを壊さない
- Owner操作受入
- narrow viewportでCanvasが実用可能

---

# Status Transition

現在:

```text
PLANNED — DESIGN / AUDIT FIRST
NO PRODUCTION IMPLEMENTATION
```

Design/Audit開始時:

```text
ACTIVE — DESIGN / AUDIT
```

GUI要件確定後:

```text
DESIGN READY — IMPLEMENTATION NOT YET APPROVED
```

Production実装承認後のみ:

```text
ACTIVE — IMPLEMENTATION
```

Owner受入後:

```text
DONE
```

---

# Dependencies

開始条件:

- WP-005 Owner acceptanceが完了していること
- WP-005のSimple WARP authorityを再オープンしないこと
- WP-003のKEY継続編集契約が維持されていること
- WP-007 Export terminal guardが維持されていること

Design/Audit自体は、production実装より先に資料整理だけ行ってよい。

---

# Stop Conditions

以下が判明した場合、その場で実装へ進まずGPT / Architecture reviewへ戻す。

- variable gridに新Project schemaが必須
- keyframe間topology変更の意味が未定義
- brushがRaster破壊とdeformer編集の両方を混在
- CageとBASIC matrixが二重authorityになる
- existing Workspace algorithmのlicense / dependency / runtime境界が不明
- CPU/Pixi評価順の変更が必要
- Export contract変更が必要
- History複数件が避けられない
- current Layer Transform session facadeでは表現不能
- UI案がCanvas作業域を過度に圧迫
- RIG / Mesh / Skin / clippingへscopeが漏れる

---

# Expected Deliverables

Design/Audit Slice終了時:

```text
docs/work/WP-008-layer-transform-progressive-controls.md
docs/design/...               optional
Existing WARP capability map
Authority map
Reuse classification
GUI requirements handoff
Implementation slice proposal
GPT review report
```

Astra / GUI相談を行う場合、その上納資料はこのWPの派生資料とし、WP自体をGUI案で上書きしない。

---

# Notes

このWPの目的は「機能を増やすこと」ではなく、

```text
高頻度の直接操作を軽く保つ
+
低頻度の高度操作を必要時だけ近くへ出す
```

こと。

既存WARP Workspaceが持つ機能量をLayer Transformへそのまま移すと、再び情報密度の高い操作面になる。

Layer Transformでは、機能の存在より「いつ見えるか」「何手で触れるか」「現在の作業を邪魔しないか」を同じ重要度で扱う。
