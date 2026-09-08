# WP-008 — Astra / GUI Requirements Handoff Draft

状態: **DRAFT — ARCHITECTURE REVIEW REQUIRED**  
この資料はGUI相談へ渡すための下書きであり、production implementation instructionではない。

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

この下書きはAstra/Owner review後に正式仕様へ昇格する。現時点ではWP-008 production implementationを開始しない。
