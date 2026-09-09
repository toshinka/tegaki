# WP-008 — Astra / GUI Requirements Handoff Draft

状態: **DRAFT — ACTUAL PRODUCT REVIEW REQUEST**
この資料は、Owner許可で実装したWP-008 rough product passの画面をAstra/Ownerが批評するための下書きであり、追加実装のblank-slate instructionではない。

## Review target update — 2026-09-09

実装済みのLayer Transformを対象に、次を画面上で確認する。Level 1のBASIC/WARP/status/KEY strip、BASIC extensionの既存numeric controls、WARP POINT/BRUSH、MOVE/INFLATE/PINCH、radius/strength/hardness、既存glass `.72` / `blur(3px)`、Animation Table併用時のfootprintとfocus lensである。Astraは「何を追加すべきか」ではなく「何が煩雑で、何を削り、どの入口位置が自然か」を批評する。

レビュー結果として、(1)BASIC/WARP分離の有効性、(2)extension入口の位置と閉じた時の軽さ、(3)POINT/BRUSH切替の自然さ、(4)brush fine controlsをLayer Transform内に置く妥当性、(5)4×4 brushのworkflow価値、(6)glassとCanvas視認性、(7)narrow Animation Tableでの操作面を記録する。改善方向は最大3案までとし、variable topology、Cage、pivot schema、RIG/MOTION、renderer/session rewriteを提案段階でproductionへ昇格させない。

## Background

Layer Transformの第一水位は現在の`BASIC | WARP`を維持する。Simple WARPはCanvas上の4×4/16点直接操作、CAF ANIMATEでは`ClipInstance.layerDeformers`、明示KEY、既存History/Export境界を使う。既存WARP Workspaceには可変GRID、CAGE/BIND、LENS、BRUSHがあるが、Layer Transformへそのまま移植してはいけない。

## User task

ユーザーが通常のLayer Transformで、必要な時だけ次の詳細を開けるようにする。

1. BASICで位置・回転・拡縮・pivotを数値またはCanvas操作で調整する。
2. WARPでSimple point操作を続ける。
3. 必要な場合だけGRID/CAGE/BRUSHの詳細へ進む。
4. ANIMATEでは`deform → KEY確定 → 次Frame`を同じ操作文法で続ける。

## Fixed architecture

- Level 1: `BASIC | WARP`、status、confirm/cancel、ANIMATE KEY guide。
- Level 2: mode-local extension。BASICは数値/transform、WARPはGRID/CAGE/BRUSH候補。
- Level 3: 選択した機能のradius/strength/falloffなど局所設定。
- Canvas直接操作を主役にし、Layer Transformを巨大Inspectorにしない。
- Save authorityはUI stateではなく既存Project/model境界。
- CPU compositor / Bake / Exportがpixel authority、Pixiはinteractive proxy。
- pending Frame移動は拒否し、暗黙commitをしない。
- explicit KEY confirmは既存のHistory 1、cancel/no-op 0、panel/handles保持契約を継承する。

## Screen constraints

- Animation Table展開中の狭いCanvasでも、BASIC/WARP switch、主要point hit area、confirm/cancelを押し下げない。
- 非選択modeのLevel 2 controlsを残さない。
- Level 2を閉じると現行Simple surfaceへ戻る。
- brush controlsを常時表示しない。数値入力・wheel・pen操作のいずれかを比較する。
- label、icon、accordion、popover、inline tray、open directionはGUI案の比較対象であり固定しない。

## Capability candidates

| Mode | Level 2 candidate | Level 3 candidate | Current technical note |
| --- | --- | --- | --- |
| BASIC | POSITION / ROTATION / SCALE / PIVOT | numeric fine values | Existing transform authorityを再利用する。 |
| WARP | GRID density / CAGE / BRUSH | radius / hardness / strength / falloff | Current Layer Transformは4×4固定。variable topology/cage/brushは未決定。 |

## ANIMATE workflow requirement

最低操作は次の形を維持する。

```text
F2 → WARP詳細を開く → deform → explicit KEY
→ panel / handles保持 → next / prev / strip wheel → F3
→ deform → explicit KEY
```

pending中のFrame移動は拒否する。詳細操作がWorkspace deformerを直接書き換えてLayer Transform sessionを迂回してはいけない。

## Required GUI outputs

GUI案では少なくとも次を比較する。

- BASIC extension left / WARP extension rightの案
- accordion、inline tray、popoverのnarrow viewport比較
- Level 1 statusとLevel 2 controlsの視覚的優先順位
- WARPのpoint/grid/cage/brush切替時のfocusとclose動作
- pending / KEYED / blocked / unsupportedの表示
- Canvas hit area、Animation Table、Export blocked表示との干渉

## Open architecture questions

- variable GRIDを`layerDeformers`へ接続するか、現行Workspaceに留めるか。
- CAGEはBind pointsのrebase、key-local placement、別authorityのどれか。
- topologyをFrame間で変更できるか。変更禁止ならUIでどう説明するか。
- brushはどの最小種類（MOVE、INFLATE/PINCH、SMOOTH）をLayer Transformへ持ち込むか。
- brush pointermove previewとexplicit KEYのHistory boundaryをどう示すか。
- Level 2/3に収まらない機能をWorkspace handoffに残すか。

## Must not change in GUI proposal

- Project schema / migrationを提案だけで追加しない。
- BASIC matrixとWARP cageの二重authorityを作らない。
- root Clip WARP、Folder WARP、RIG/Mesh/Skin、clippingの合成境界を再定義しない。
- CPU final parityを理由にcontinuous CPU renderやPixi Mesh削除を前提にしない。
- AnimationTablePopup全面分割やsession抽出をこのWPのGUI案へ混ぜない。

## Requested review result

1. Level 1/2/3の情報構造案を2〜3案。
2. narrow Animation Table同時表示でのCanvas/panel footprint比較。
3. WARP詳細の最小到達手数とkeyboard/pen操作の比較。
4. 上記open questionsのうちGUIで判断できるもの、Architectureへ返すものの仕分け。

この下書きはAstra/Owner review後に正式仕様へ昇格する。現時点では実装済みrough passの画面を対象にレビューし、最終GUI採用や追加production設計へ自動進行しない。

## Actual review evidence — 2026-09-09

- Production BrowserではBASIC simple/expanded、WARP POINT、BRUSH MOVE/INFLATE/PINCH、Esc rollbackを確認し、console error/warnは`0`だった。glassはsurface alpha `.72`、backdrop `blur(3px)`の実効値を確認した。
- Animation Table単独のglass表示は確認したが、通常Raster fixtureでは既存Table開閉境界がV sessionを終了するため、TableとLayer Transformの同時表示は未受入である。これはWP-008でterminal境界を変更せず、`PARTIAL / GPT review required`としてレビュー対象に残す。
- 技術回帰は全verifier `172 selected / 0 failed`、harness check `34 documents / 140 local links / 25 proposals / 9 packages`。Owner操作感、実PNG、最終GUI採用は未判定である。

## Added review material — WARP ownership and Anchor/Pivot presets (2026-09-09)

WP-005の最終interaction safety sliceでは、WARP modeのCanvas body dragをBASIC Motionへ落とさない局所gateを採用した。将来の統合gesture候補は、U1（body=BASIC / point=WARP）、U2（body時だけBASIC submode）、U3（現行の完全分離）として比較対象へ残す。confirm authority、History 1/2、status/key marker、Undo/Redo、Escape、Frame移動、pen操作が未決定のため、Astraはこの候補を実装へ昇格しない。

Anchor / pivotのproduction enableは保留する。現行CAF ANIMATE Layer Motionはtrack-global `pivotX/pivotY`、Frame keyはx/y/scale/rotationのみで、pivot変更は既存全FrameのAffine評価へ影響する。SOURCE AnchorとANIMATE pivotはauthorityとHistory semanticsが異なるため、同一UIとして扱わない。詳細なQ1〜Q7回答は[WP-008 audit](../work/WP-008-progressive-controls-design-audit.md)に記録した。

Ownerのpreset案は、中心軸アイコンがONの時だけ`キャンバス中央` / `対象中央`を小さく表示するprogressive disclosure候補とする。`対象中央`はBASICではRaster/content bounds、WARPではcurrent bind bounds / WARP範囲という意味差を明示し、Transform ResetやWARP point変更と混同させない。selectorの上下、icon/text、narrow Animation Tableでのfootprint、WARP pointとの視覚的分離をAstra/Ownerへ確認したい。

このhandoffはGUI/design review用であり、ANIMATE `allowAnchorEdit`、pivot schema、History、renderer、WARP body統合、WP-008 production codeの変更を指示しない。
