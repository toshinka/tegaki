# Tegaki レイヤーパネル / アニメコンテキスト UI/UX再構築 — 実装指示書

更新日: 2026-09-04  
対象: 現行ローカル `tegaki_work`  
担当: GEMINI（新規チャット）  
位置づけ: Layer Panel / Animation Context UX 独立Slice  
Owner実機Acceptance前のGit push: 禁止

---

# 0. 新規チャット開始時の最初の行動

この作業は、過去チャットの会話内容を前提にしない。

最初にローカルRepositoryの現在状態を読み、
この指示書と現行コードからcontextを再構築すること。

GitHub `main` よりローカルworkspaceが新しい場合、
**ローカルworkspaceを正本**とする。

禁止:

- Ownerの未commit変更をreset / checkout / cleanする
- Backupから自動復元する
- 現行Phaseの別作業を混ぜる
- 読まずに過去Phaseの記憶だけで実装する

---

# 1. 最初に読む資料 — 必須順序

以下を順番に読む。

## Tier 1 — Project正本

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. `task-codex/phase9q.md`

現在Phase 9qには、
Animation Table / Layer Panel全体再配置を
Drawing WARP作業と並走しないというNO-GOがある。

今回の作業はOwnerが別件として依頼した
**独立UX Slice**である。

したがって:

- Phase 9qのWARP authority
- WARP save
- WARP History
- WARP compositor
- WARP Canvas UI

を今回変更しない。

同一ファイルにPhase 9qの未commit変更が見つかった場合は、
勝手にmergeせずSTOPして報告する。

---

## Tier 2 — UI境界・過去設計

6. `PHASE4Z_BOUNDARY.md`
7. `UI_CSSスタイルガイド.md`
8. `開発用資料保管庫/Archive/phase9m.md`
9. `開発用資料保管庫/Archive/phase9n.md`
10. `開発用資料保管庫/Archive/phase9p.md`

特に確認:

- Layer Panelは現在Frameの反映表示とCAF内部編集入口
- 通常Layer / CAF internal Layerは同一UI engine + data adapter
- working Layerは保存正本ではない
- 右RIG viewはoverview / handoffであり第二authorityを作らない
- Tableを閉じてもCAF edit contextは継続する
- semantic surface tokenを使用する

---

## Tier 3 — 今回の提案資料

11. `開発用資料保管庫/proposals/Tegaki_アニメテーブル・レイヤーパネル周りUI_UX再構築_提案書.md`

本資料の問題提起は重要だが、
その実装案を無条件に正本扱いしない。

現行コードとこの指示書を優先する。

---

## Tier 4 — Production実装

12. `tegaki_work/ui/timeline-ui.js`
    - `createLayerPanelFrameIndicator`
    - `updateLayerPanelIndicator`
    - Frame prev / next
    - playback
    - Timeline Onion
    - Lane Reference

13. `tegaki_work/ui/layer-panel-renderer.js`
    - `render`
    - `createCafReadonlyHeader`
    - CAF identity / visibility / expand
    - `_createContextDockViewSwitch`
    - RIG context view
    - CAF internal Layer mirror

14. `tegaki_work/ui/ui-icons.js`

15. `tegaki_work/styles/main.css`
    - `.frame-indicator`
    - Frame control sizes
    - layer panel geometry tokens

16. `tegaki_work/styles/components/layer-panel-surface.css`
    - CAF surface
    - Context view switch
    - RIG view
    - semantic tokens

---

## Tier 5 — Verifier

17. `tegaki_work/build/verify-layer-panel-frosted-focus-followup.mjs`

18. Layer Panel / CAF / RIG / Animation Table関連Verifierを検索し、
現在の契約を確認する。

既存Verifierを削除・弱体化して通すことは禁止。

---

# 2. 今回の問題定義

現在のAnimation Context時の右Layer Panelは概ね、

```text
Frame transport
< F1 >  Play  Ghost  Ghost

LAYERS | RIG

CAF1
Lane 1

Layer 1
Background
```

となっている。

問題は単純なspacingではない。

**情報の親子関係とDOM表示順が一致していない。**

論理構造は本来:

```text
現在編集しているAnimation Cel / Clip
    CAF1
    Lane 1
    Current Frame F1
    Timeline Onion
    Lane Reference
    Playback

    編集View
        LAYERS
        RIG

    Content
        internal Layers
        または RIG Inspector
```

である。

---

# 2.1 Owner Decision — C案を正式採用

比較検討の結果、Owner判断としてC案を正式採用する。

採用レイアウトの核:

```text
Frame Compass
↓ small gap
CAF Parent Header
↓
Layer / Folder Content
```

現行 `LAYERS | RIG` Switchは将来Layer Transform / deformation系UIへ吸収され、
Layer Panelから廃止される可能性が高い。

今回の実装はこのSwitchを恒久的な情報階層として扱わないこと。

---

# 3. 現行コードで確認すべき根本原因

現行`LayerPanelRenderer.render()`では、

1. Context View Switch
2. RIG Inspector または CAF Header / CAF content

の順にappendされる。

そのため`LAYERS | RIG`がCAF contextより上へ入り込む。

またRIG view選択中は、
CAF headerの代わりにRIG inspectorが出るため、
CAF identityが視覚上消える。

一方`TimelineUI.createLayerPanelFrameIndicator()`は
`.frame-indicator`を`#layer-panel-container`先頭へ
独立挿入している。

つまり、

- Frame transport = TimelineUI
- CAF identity / body = LayerPanelRenderer

が異なるDOM lifecycleを持つ。

**今回このownership自体は壊さない。**

---

# 4. 採用方針

## 採用: C案 — 「Frame Compass + CAF Parent Header」

今回の正式採用は、FrameとCAFを無理に1つの親子カードへ統合しないC案とする。

情報構造を以下の2系統へ明確に分ける。

1. **Frame = 時間座標を示す独立ナビゲーション**
2. **CAF = 下に並ぶLayer群の親コンテキスト**

目標表示:

```text
┌────────────────────────────┐
│ <  F1  >  ▶  👻1  ≡       │  ← Frame Compass / WHEN
└────────────────────────────┘

          small gap

┌────────────────────────────┐
│ 🎞 CAF1              👁    │  ← Content Parent / WHAT
│    Lane 1                  │
├────────────────────────────┤
│ Layer 1                    │
│ Layer 2                    │
│ Background                 │
└────────────────────────────┘
```

現時点で `LAYERS | RIG` が存在する場合は、

```text
┌────────────────────────────┐
│ <  F1  >  ▶  👻1  ≡       │
└────────────────────────────┘

          small gap

┌────────────────────────────┐
│ 🎞 CAF1              👁    │
│    Lane 1                  │
├─────────────┬──────────────┤
│   LAYERS    │     RIG      │  ← 暫定Context Switch
├─────────────┴──────────────┤
│ Layer rows / RIG Inspector │
└────────────────────────────┘
```

とする。

ただし `LAYERS | RIG` は将来廃止され、
Layer Transform / deformation側のUIへ吸収される可能性が高い。

そのため今回のDOM / CSS設計は、
**このSwitchが存在してもしなくても成立する構造**
にすること。

重要:

- Frame stripをCAFの子として見せない。
- CAFをFrame stripの子として見せない。
- CAFはLayer群の直接の親見出しとして扱う。
- `LAYERS | RIG` が将来消えても、`Frame → CAF → Layers` の情報階層が崩れないこと。

---

# 5. C案の採用理由

C案を採用する理由は、FrameとCAFの役割を分離した方が、
TegakiのAnimation TableとLayer構造の両方へ自然に対応できるためである。

## 5.1 Frameは「時間の羅針盤」

Animation Tableでは時間軸が支配的であり、
似た絵が連続するFrame間では `F1 / F12 / F120` のような現在位置が非常に重要になる。

特にAnimation Tableを閉じてCanvas中心で描いている時、
右Layer Panel上部のFrame stripは現在時間を示す主要ナビゲーションになる。

Tableを開いている時:

```text
下部Animation Table = 主時間軸
右Frame strip       = compact compass
```

Tableを閉じている時:

```text
右Frame strip       = 主時間ナビ
```

同じ位置・同じgeometryで役割の重要度だけが自然に変わることが望ましい。

## 5.2 CAFはLayer群の親

絵の情報構造ではCAFが内部Layer群を統合する親である。

したがって、

```text
CAF1
 ├ Layer 1
 ├ Layer 2
 └ Background
```

という関係をそのまま視覚化し、
CAF headerをLayer / Folder群の直上へ置く方が理解しやすい。

CAFを最上段へ置き、その中にFrame controlsを含める案では、
`F1` がCAF固有属性であるように見えやすい。

しかしFrameはTimeline全体を横断する時間座標でもあるため、
C案では両者を兄弟的なcontextとして分離する。

## 5.3 認知順序

右Panelを見た時の理解順を、

```text
今いつ？       → F12
何を触ってる？ → CAF1 / Lane 1
中身は？       → Layer 1 / Layer 2
```

とする。

時間位置確認とLayer階層理解を混同させない。

## 5.4 将来拡張

`LAYERS | RIG` のSwitchが将来廃止されても、

```text
Frame
CAF
Layers
```

という核構造はそのまま残る。

今回のレイアウトを一時的なRIG Switchの存在へ依存させない。

---

# 6. DOM責務

## 6.1 Frame CompassとCAF Content Groupを分離

Layer Panelを概念的に:

```text
layer-panel-container
    frame-indicator                 // independent temporal compass

    animation-content-group         // CAF parent context
        animation-context-identity  // CAF / Lane
        context-view-switch         // optional / transitional
        layer-panel-items           // Layers or RIG body
```

へ整理する。

重要:

- `.frame-indicator` は `animation-content-group` の外側。
- CAF identityはLayer bodyの直上。
- `context-view-switch` は存在する場合のみCAF group内部。
- 将来Switch廃止後はCAF identity直下がそのままLayer bodyになる。

`layer-panel-items`はContent Bodyだけを持つ。

Content Body:

- LAYERS時 → CAF internal Layers
- RIG時 → RIG inspector
- 通常非Animation時 → normal Layer list

---

## 6.2 TimelineUIの責務を維持

`timeline-ui.js`は引き続き:

- frame prev
- frame next
- current F display
- playback
- Timeline Onion
- Lane Reference

のDOM / event listener / updateを所有する。

LayerPanelRendererへFrame mutationロジックを移植しない。

---

## 6.3 LayerPanelRendererの責務を維持

`layer-panel-renderer.js`は:

- CAF identity
- CAF name
- Lane name
- CAF visibility
- CAF expand / collapse
- LAYERS / RIG switch
- Body content

を所有する。

Timeline playback stateを第二stateとして持たない。

---

# 7. CAF Headerの分離

現行`createCafReadonlyHeader()`が、

CAF identityとCAF internal Layer bodyを
1つの返却構造へまとめている場合、
今回ここを整理する。

推奨:

```text
createCafContextHeader()
createCafLayerContent()
```

または同等の責務分離。

命名は現行コードに合わせてよい。

重要なのは、

**CAF identityだけをContent Bodyから独立して描画できること。**

---

# 8. CAF identity row

表示する情報:

- Animation / CAF icon
- CAF名
- Lane名
- visibility
- 既存expand / collapse操作が必要ならその入口

保持する既存操作:

- CAF visibility toggle
- CAF name rename
- Lane name rename
- CAF selection
- expand / collapse semantics

UI再配置を理由に既存操作を削除しない。

---

# 9. LAYERS / RIG switch — 暫定要素として扱う

現行 `LAYERS | RIG` Switchは今回の主役ではない。

将来的にLayer Transform / deformation側のUIへ吸収され、
Layer Panelから消える可能性が高い。

したがって今回の実装では:

- SwitchをCAF identityより上へ置かない
- Frame stripとCAFの間へ割り込ませない
- Switchの存在を前提にContext geometryを固定しない
- Switch削除時に大規模DOM再設計が不要な構造にする

現行で残す場合の位置は:

**CAF identityの直下、Content Bodyの直上**

とする。

意味:

```text
CAF1 / Lane 1
    ├ LAYERS view
    └ RIG view
```

である。

TabsがCAFの親ではない。

将来Switchが廃止された場合:

```text
CAF1 / Lane 1
Layer rows
```

へ自然に縮退すること。

---

# 10. RIG view時の暫定契約

現行RIG Switchを残す期間中は、
RIGを選択してもCAF identityを消さない。

RIG viewでも:

- CAF name
- Lane name
- Frame
- Onion states
- visibility

を維持する。

RIG InspectorだけがBodyを置き換える。

ただしこのSwitch自体は将来廃止候補であるため、
RIG専用の新しい親Surfaceや第二Context Headerを今回追加しない。

---

# 11. Animation Table open / closed

Table visibilityをcontext authorityに使用しない。

既存契約通り、

Animation Tableを閉じても
CAF contextが存在するならContext Stackを残す。

またTable open / closedで
右パネルの主要control位置を変えない。

理由:

- muscle memory維持
- full canvas作画とtable作業の連続性
- DOM layout shift回避

Table open時だけcontrolを丸ごと隠すことは禁止。

必要なら`is-table-closed`等で
背景濃度を微調整する程度に留める。

---

# 12. 2つのGhost問題

現在:

- Timeline Onion
- Lane Reference

が同じGhost icon。

これは廃止する。

## Timeline Onion

Ghostを維持。

意味:

**時間方向の前後Frame**

表示:

- Ghost icon
- active時 count badge `1`〜`4`

Tooltip:

`オニオンスキン: 前後Nフレーム`

OFF:

`オニオンスキン: OFF`

---

# 13. Lane Reference icon

Ghostを使用しない。

また`layers` iconも第一候補にしない。

理由:
LAYERS tabのstack iconと意味衝突する。

Film iconも避ける。

理由:
CAF / Animation Table identityと衝突する。

推奨:

**横方向の複数track / rowを示す専用icon**

例:
Lucide系の`rows-3`相当。

`ui-icons.js`へ

`laneReference`

等のsemantic nameで追加する。

TimelineUIへraw SVGを散在させない。

意味:

**別Lane / 別TrackをCanvas参照表示**

Tooltip:

`他レーン参照: ON`
`他レーン参照: OFF`

---

# 14. 状態は色だけで区別しない

Role区別:

- Timeline Onion → Ghost形状
- Lane Reference → Rows / Track形状

State区別:

- OFF / ON背景
- aria-pressed
- tooltip
- count badge

色はsecondary cue。

---

# 15. 配色

既存semantic tokenを優先。

新しいhex直書きを増やさない。

## Timeline Onion active

推奨:

- background: `--ui-layer-surface-focus`
  または `--ui-layer-surface-accent-selected`
- foreground: `--futaba-maroon`
- active accent: `--active-border`

## Lane Reference active

Timeline Onionと同じactive色にしない。

推奨:

- background: `--futaba-maroon`
- foreground: `--futaba-background`

ただし既存style guideとcontrastを確認する。

新tokenが必要なら、

`--ui-layer-lane-reference-active-*`

のようにsemantic aliasを1箇所へ定義する。

---

# 16. Frame control alignment

現在の、

- nav = 20px
- onion = 20px
- play = 18px

という不一致を解消する。

すべて:

`--ui-frame-control-size`

へ統一。

現時点の基本desktop値:

20px

---

# 17. Flex alignment

以下すべて:

- prev
- frame display
- next
- play
- timeline onion
- lane reference

に対し、

```css
display: inline-flex;
align-items: center;
justify-content: center;
```

を共通化する。

SVG:

```css
display: block;
```

を基本とする。

---

# 18. Onion icon wrapper

現行Timeline Onionだけ、

```text
button
  span.frame-onion-icon
    svg
```

となっており、
Lane ReferenceとDOM階層が非対称。

以下のどちらかへ統一:

A:
両方SVGをbutton直下

または

B:
両方同一`.frame-control-icon` wrapper

Bを採る場合wrapperは:

```css
display: inline-flex;
align-items: center;
justify-content: center;
line-height: 0;
```

とする。

inline baselineへ依存しない。

---

# 19. Play / Stop icon

Unicode `▶` / `■` は
font baseline差が出る。

可能なら`ui-icons.js`へ:

- `play`
- `stop`

を追加しSVG化する。

ただし今回のScopeが拡大しすぎる場合は、
最低限line-height / flex centeringで揃えてもよい。

Verifier / Browser screenshotで
Y中心が揃うことを優先する。

---

# 20. Frame Display

`F1`は単なるlabelに見えすぎないよう、

- fixed/min height = frame control size
- inline-flex center
- min-widthを確保

する。

ただしbutton化しない。

既存wheel navigationが効くことを維持する。

---

# 21. Visual grouping

今回はFrameとCAFを同一Stackへ完全統合しない。

## 21.1 Frame Compass

Frame stripは独立したcompact navigation surfaceとして扱う。

- 独立したradius
- CAF groupとは3〜5px程度のsmall gap
- Canvas上で視認できる程度の存在感
- ただし巨大なheaderにしない

## 21.2 CAF Content Group

CAF identityとその配下のLayer rowsは同一groupとして見せる。

```text
CAF1 / Lane 1
[optional LAYERS | RIG]
Layer rows
```

- CAF header = group top
- optional Switch = middle
- Layer body = content

Switchが無くなればCAF headerとLayer bodyが直接接続される。

FrameとCAFのSurfaceを完全に同じカードへ融合しない。

TegakiのCanvas主役を維持する。

---

# 22. Layer cardとの分離

Context Stackと実Layer rowsは
明確に一段分離する。

```text
Context
Context
Tabs

small gap

Layer 1
Layer 2
Background
```

ContextとLayer cardを同じカード群に見せない。

---

# 23. 通常Layer mode

Animation contextがない場合:

- CAF identityを表示しない
- Frame indicatorを表示しない
- RIG switchも既存契約通り不要なら表示しない

通常Layer Panelの既存layoutを壊さない。

今回のUX改修をAnimation context限定にする。

---

# 24. Lane-only / NO FRAME

既存:

`NO FRAME`

およびprev / next disable contractを維持。

CAF / Lane contextが存在するなら
Identity rowは残す。

Frame controlsだけdisabled semanticsにする。

---

# 25. Narrow width / touch

既存right panel width契約内で
横overflowを出さない。

最低確認:

- desktop標準
- 480×800相当
- coarse pointer media

20px controlsを無理にtext label付きへしない。

意味はicon + tooltip + ariaで補う。

---

# 26. Accessibility

最低限:

- button `aria-label`
- toggle `aria-pressed`
- disabled
- tooltip/title
- focus-visible
- icon `aria-hidden=true`

を維持。

色だけに意味を持たせない。

---

# 27. Scope Freeze

Production変更を許可する候補:

- `tegaki_work/ui/timeline-ui.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/ui/ui-icons.js`
- `tegaki_work/styles/main.css`
- `tegaki_work/styles/components/layer-panel-surface.css`

Verifier:

- 新規 `tegaki_work/build/verify-layer-panel-animation-context-ux.mjs`
- 必要に応じ既存Layer Panel verifier

これ以外のProduction fileを変更する必要が出た場合、
実装を続けず理由を報告する。

---

# 28. 絶対に触らない

- Animation data schema
- TimelineModel
- ClipAsset schema
- History
- Project save
- CAF save
- layerTransformTracks
- transformKeyframes
- WARP authority
- RIG authority
- RIG WORKSPACE
- Canvas drawing
- BrushCore
- PointerHandler
- QTP
- Layer drag/drop semantics
- Layer hierarchy adapter
- Clip internal hierarchy adapter
- thumbnail generation
- playback algorithm
- Onion rendering algorithm
- Lane Reference rendering algorithm

今回は**UI projection / layout / icon / state presentation**だけ。

---

# 29. 実装Stage

## Stage 0 — Read-only inventory

実装前に以下を報告可能な状態まで理解する:

- current DOM tree
- TimelineUI owner
- LayerPanelRenderer owner
- CAF header return structure
- RIG switch insertion order
- Table open / closed state
- Onion button state source
- Lane Reference state source
- current CSS source file
- existing verifier coverage

その後実装へ進んでよい。

Ownerへ途中確認を求める必要はないが、
Phase9q未commit conflictがあればSTOP。

---

## Stage A — C案 hierarchy

1. Frame indicatorを独立した最上段Temporal Compassとして維持
2. CAF identityをLayer bodyから分離
3. Frame indicatorとCAF groupの間にsmall visual gapを設ける
4. CAF identityをLayer / Folder群の直接の親headerとして配置
5. `LAYERS | RIG` を残す場合はCAF identity直下へ置く
6. Bodyをその下へ配置
7. RIG viewでもCAF identityを維持
8. Switchが将来削除されても `Frame → CAF → Layers` が成立するDOM/CSSにする

このStageではicon色やfine alignmentを必要以上に触らない。

---

## Stage B — Onion / Lane Reference semantics

1. Timeline Onion = Ghost
2. Lane Reference = dedicated row/track icon
3. title / aria-label更新
4. active color差
5. count badge維持

---

## Stage C — Pixel alignment

1. 全control高さ統一
2. flex centering
3. SVG block
4. icon wrapper対称化
5. Play visual center
6. Frame display vertical center

---

## Stage D — Surface polish

1. Context Stackの角丸
2. row間gap
3. bodyとのgap
4. Table open / closedの同一geometry
5. narrow viewport確認

大規模なtheme redesignは禁止。

---

# 30. Verifier — Structure

新規:

`build/verify-layer-panel-animation-context-ux.mjs`

最低限:

1. Animation context時にFrame indicatorが存在
2. Animation context時にCAF identityが存在
3. Frame indicatorがCAF content groupより上
4. Frame indicatorがCAF content groupの子ではない
5. CAF identityがContent Bodyより上
6. View Switchが存在する場合、CAF identityより下かつContent Bodyより上
7. RIG active時もCAF identityが存在
8. RIG active時もFrame indicatorが存在
9. RIG active時にLayer bodyはRIG inspectorへ切替
10. Layersへ戻すとinternal Layers復帰
11. Animation contextなしではAnimation Context UI非表示
12. Table closed + animation contextでFrame / CAF context維持
13. View Switch要素を仮に除去しても、Frame → CAF → ContentのDOM orderが成立する

---

# 31. Verifier — Button semantics

11. Timeline Onion ID維持
12. Lane Reference ID維持
13. Timeline OnionはGhost icon
14. Lane ReferenceはGhostではない
15. Timeline Onion count 1〜4維持
16. aria-pressed維持
17. tooltipが役割を区別
18. Frame prev / next IDs維持
19. playback button ID維持
20. wheel handlersのevent contract維持

---

# 32. Verifier — CAF interactions

21. CAF visibility action維持
22. CAF name rename維持
23. Lane rename維持
24. CAF expand / collapse維持
25. internal Layer select維持
26. internal Layer visibility維持
27. internal Layer clipping維持

UI移動でdelegated selectorが壊れていないこと。

---

# 33. Verifier — Visual contract

可能な範囲でstatic CSS contract:

- frame control size共通
- playだけ18pxに戻っていない
- inline-flex center
- Context row radius order
- horizontal overflowを作る固定width追加なし

ただしpixel-perfect最終確認はBrowserで行う。

---

# 34. Browser Acceptance

## A. Animation Table open

- CAF1 / Lane 1表示
- Frame F1表示
- prev / next
- play / stop
- Timeline Onion 0→1→2→3→4→0
- Lane Reference ON/OFF
- LAYERS/RIG
- internal Layers

## B. RIG切替

RIG選択後も:

- CAF1
- Lane 1
- F1
- Onion state
- Lane Reference state

が消えない。

Layersへ戻して正常復帰。

## C. Table closed

Tableを閉じてもanimation contextが残る場合:

- Context Stack維持
- frame navigation可能
- onion操作可能
- lane reference可能

## D. Non-animation

通常Layer documentでは
不要なAnimation Context UIが出ない。

---

# 35. Visual Acceptance

添付時に問題となっていた以下を人間目視で確認:

- 最上段のFrame stripから「今どのFrameか」を即座に読める
- Frame stripがCAFの子情報には見えない
- CAF1 / Lane 1がLayer群の親見出しとして読める
- Layer rowsがCAF配下に属して見える
- LAYERS/RIGがCAFの親に見えない
- LAYERS/RIGが将来消えても不自然にならない構造に見える
- Ghostが2つ並んで見えない
- Timeline OnionとLane Referenceを説明なしでも区別しやすい
- `< F1 > ▶ icons`のY中心が揃う
- Frame CompassとCAF Content Groupが近すぎず離れすぎない
- Layer rowsはCAF Content Groupの中身として理解できる

---

# 36. 既存Verifier / Build

新規Verifierに加えて:

- `verify-layer-panel-frosted-focus-followup.mjs`
- Layer Panel関連全Verifier
- Animation Table関連primary verifier
- RIG context関連primary verifier
- `npm run build`

を通す。

既存テストを削除・skipして通さない。

---

# 37. Git / Workspace

禁止:

- `git reset`
- `git checkout .`
- `git clean`
- unrelated formatter
- Phase9q production変更の取り込み
- Git push

Owner実機Acceptanceまではローカル変更で停止。

---

# 38. 完了報告

以下を報告する。

## 1. Changed Files

## 2. Before / After DOM hierarchy

ASCII treeで示す。

## 3. Ownership

- TimelineUI
- LayerPanelRenderer

の責務が変わっていないこと。

## 4. CAF Header

identity/body分離方法。

## 5. RIG

RIGでもCAF contextを維持した証拠。

## 6. Onion / Lane Reference

- icon
- active state
- aria
- tooltip

## 7. Alignment

button / iconサイズ。

## 8. Table open / closed

両方の確認。

## 9. Verifier / Build

## 10. Browser

console error含む。

## 11. Unexpected Diff

0件であること。
存在すれば列挙。

報告後STOP。

---

# 39. 最終Acceptance

今回の成功条件は、

「見た目を豪華にする」

ことではない。

右パネルを見た瞬間に、

1. **今いつか** — `F1`
2. **何を編集しているか** — `CAF1 / Lane 1`
3. **その中身は何か** — Layer rows
4. **時間 / 他Lane参照状態** — Onion / Reference
5. **必要な場合のみ表示切替** — `LAYERS / RIG`

が自然に理解できること。

中心構造は:

```text
Frame Compass
CAF Parent Header
Layer / Folder Content
```

である。

`LAYERS | RIG` は現行の暫定要素として扱い、
将来廃止されても中心構造を崩さない。

Canvas主役を維持し、
情報階層だけを整理する。
