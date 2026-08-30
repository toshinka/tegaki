# Phase 9o — Layer Transform Interaction Grammar / Focus Lens Gate

作成日: 2026-08-31
更新日: 2026-08-31

状態: ACTIVE — Gate 1=`GO — D: Tegaki hybrid`。Stage B1 BASIC shell + read-only overlayは技術proof完了、Owner visual acceptance待ち

## 1. 目的

既存`V` Layer Transformを、Tegaki全体の「絵を直接掴んで変形する共通語彙」へ刷新できるかをArchitecture / Interaction Gateで比較する。

学習順序の中心仮説は次とする。

```text
DRAW
  → TRANSFORM: Move / Rotate / Scale / Anchor / Distort / Warp
  → ANIMATE: 同じ変形へ時間を付ける
  → RIG: 反復する直接操作をController / Parent / Boneで構造化する
  → RIG MESH / WEIGHT: 変形品質を詳細調整する
```

Phase 9nの成果は破棄しない。右RIGはoverview / next action / handoff、single floating `RIG WORKSPACE`は現時点のstatic authoring hostとして維持する。ただし現RIG WORKSPACEのlayoutや`RIG / MOTION / WARP`上位分類は最終UXとして受入れず、本Phase以降で再評価する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
7. `開発用資料保管庫/Archive/phase9n.md`
8. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
9. `tegaki_work/system/layer-transform.js`
10. `tegaki_work/system/transform-math.js`
11. `tegaki_work/system/layer-system.js`
12. `tegaki_work/ui/transform-anchor-site.js`
13. `tegaki_work/ui/dom-builder.js`
14. `tegaki_work/ui/keyboard-handler.js`
15. `tegaki_work/ui/animation-table-popup.js`
16. `tegaki_work/system/animation/clip-transform-sampler.js`

## 3. 正本と禁止境界

- 通常Layer transformの実装正本は既存`LayerTransform` / `LayerSystem` / `transform-math.js`。第二transform modelを作らない。
- 通常Rasterはpreview中にPixi Container transform、confirm時に一度だけRasterへbakeする。整数平行移動、path座標、clipping再構築、1 Historyを維持する。
- CAF原画はanimation working Layerを表示 / 入力adapterとし、通常Layer Historyへ混ぜず既存`caf-internal-layer-transform`へ戻す。
- Pixel Selectionは既存selection adapterを維持する。Layer全体との違いは対象bounds / mask / source snapshotであり、別の操作数学を新設しない。
- `ClipInstance.transform / transformKeyframes`はAnimationの時間正本。Drawing側のstatic transformと統合・migrationしない。
- Layer Warp Grid、Rig Mesh、Controller / Bone / Deformerを同一概念にしない。
- Anchor animation、Pin / Puppet Warp、TEST POSE、全体PIVOT migration、RIG model統合、Skin / AutoMesh / Weight algorithm変更、Animation Table全面置換は非対象。
- 既存保存データのmigration、Project schema追加、History semantic変更は本Gateで行わない。

## 4. Stage 0 — Current inventory（checkpoint完了）

### 現行入口

- Sidebar / `V`はtemporary mode。selectionがあればselection transformへ委譲し、Animation contextでは選択中working Layerだけを許可する。
- normal drawingではBackgroundを拒否し、Rasterと描画対象を含むFolderを許可する。CAF working LayerではMotion windowを閉じ、既存working restore / CAF History境界を通る。

### 現行Canvas grammar

- 通常dragはMove。Shift+dragは最初の主方向で横=`Rotate`、縦=`Uniform Scale`を決める。
- Anchor siteはCanvas上に存在し、明示toggle中だけdrag可能。anchor変更時は`rebaseTransformAnchor()`で見た目のmatrixを維持する。
- floating panelはX / Y / Rotation / Scale slider、flip、Anchor、Resetが第一水位。bounding box、8方向handle、rotation affordance、Distort、Drawing Warp Gridはまだ無い。

### preview / confirm / History

- `LayerTransform.transforms`はsession中のruntime preview state。Pixi Containerへ適用し、保存正本にしない。
- normal Raster confirmは整数translationを非resampling shiftし、回転 / scale / flip / 複合変形を一度bakeする。path metadataがあれば同じmatrixを適用し、clippingを再構築して1 Historyを記録する。
- Folderは子Raster群のpreview / confirmを既存LayerSystem adapterで扱う。
- CAF internal Layerはworking Layer confirm後、AnimationTablePopupが前後stateを`caf-internal-layer-transform`として記録する。通常Layer Historyを二重記録しない。
- save / export前は未確定Layer transformを既存ProjectManager経路でcommitする。

### Animation bridge

- Clip Motionは`transformKeyframes`と`clip-transform-sampler.js`が時間正本で、Move / Rotation / Scale / Anchor値をsamplingする。
- Drawing VとClip Motionは`transform-math.js`のdirectional drag等を部分共有するが、Canvas上の共通bounding box / handle grammarはまだ持たない。
- 明示的なSVG object Layer authorityは現行data modelから確認できない。SVG / vector parityを約束せず、import後Raster / path metadataの実態をStage A1でfixture化する。

## 5. Stage A1 — Static fixture comparison（checkpoint完了）

productionを変更せず、同一DOM / 同一fixtureで次を比較する。

### A — Current

- floating slider中心
- Canvas drag + Shift modifier
- 現行Anchor site

### B — CSP-like

- bounding box
- corner / side handles
- rotation affordance
- anchor / reference point
- modeはsecondary disclosure

### C — Procreate-like

- `UNIFORM / FREEFORM / DISTORT / WARP`
- Canvas-first mode strip
- Warp gridをTransform系列として見せる

### D — Tegaki hybrid（第一仮説）

- 第一水位を`BASIC / DISTORT / WARP`
- BASICはMove / Rotate / Scale / AnchorだけをCanvasへ表示
- precise X / Y / Rotation / Scaleは`詳細`へ下げる
- WARP選択時だけgrid / divisions / Resetを表示
- Futaba palette、Tegaki icon、pen / touch densityを維持する

### 成果物

- 比較fixture: `tegaki_work/build/phase9o-layer-transform-interaction-grammar-fixture.html`
- 契約verifier: `tegaki_work/build/verify-phase9o-layer-transform-interaction-grammar-fixture.mjs`
- 同じ絵、同じ「右へ移動 → 30°回転 → Anchor確認」、同じCanvas面積でA〜Dを一DOMへ配置した。
- Dは初期`BASIC`、`DISTORT` / `WARP`選択時だけ追加controlを開き、X / Y / Rotation / Scaleは`詳細`へ下げた。
- fixture内へnormal Raster / Folder / CAF working Layer / Pixel Selection / SVG-path metadataのAuthority Matrixと`Layer Warp Grid ≠ Rig Mesh`境界を置いた。
- fixtureはimport、EventBus、History、storage、network、save、production moduleへ接続していない。

### 比較所見

| 案 | 初見推測 | 注意水位 | 保持する価値 / 再試行条件 |
|---|---|---|---|
| A Current | Canvas drag場所とShift文法が弱い | 中 | precise値と現行契約の基準。handle導入で窮屈な時のfallback |
| B CSP-like | desktop制作tool経験者に強い | 中〜高 | bounding box / 8 handleの学習済み文法。Dの簡略handleで不足する時に再比較 |
| C Procreate-like | touch主体のmode全体像は明白 | 高 | 4 mode常設の理解性。Dの段階開示でWARP発見性が不足する時に再比較 |
| D Tegaki hybrid | BASIC中の直接操作が最短 | 中 | common handle＋Focus Lens＋precise二次水位。SOL第一候補だがOwner未選定 |

技術比較ではDを第一候補、Bを次点とした。Ownerは2026-08-31にDを選定した。選ばれなかったA / B / Cもfixtureと本表に保持し、実装後の不満時に同じ条件で再試行できるようにする。

### Browser checkpoint

- default 1280×720ではA〜Dが同一列に収まり、各cardは300px幅、document横overflowなし。
- 480×800では一列stack、各card約449px幅、document横overflowなし。
- C `DISTORT`、D `WARP`、D `詳細`を操作し、local `data-transform-mode`と`aria-selected`、WARP grid / mode panelの表示条件が同期した。
- coarse pointer CSSはmode / quiet action / details summaryを38px以上とし、Canvas handleはvisual 12〜18pxに対して周囲hitを拡張した。
- console warning / errorは0件。
- fixture verifierを含む全130 verifierと`npm.cmd run build`を通過した。build warningは既知の`ag-psd` util externalizationとchunk sizeのみで、`tegaki_work/dist/`差分は残していない。

## 6. 評価軸

- 初見で「絵を掴んで動かす」と推測できるか。
- sliderを探さずMove / Rotate / Scaleを完了できるか。
- learned conventionとTegaki固有性のバランスが取れるか。
- Basic中にWarp / RIG advanced controlsが注意を奪わないか。
- bounding box / handle / anchorが絵とCanvasを過度に隠さないか。
- pen / touch targetとmouse精度を両立できるか。
- 通常Raster / Folder / CAF working Layer / selectionで同じ文法を再利用できるか。
- save / History / bake / clipping / path metadataの既存境界へ接続できるか。
- 480×800とwideで、panel自体よりCanvas上の対象が主役に見えるか。

## 7. Gate 1判定

Stage A1のfixtureとBrowser比較後、Ownerが2026-08-31にDを選定した。

Gate 1=`GO — D: Tegaki hybrid`

- 第一水位は`BASIC / DISTORT / WARP`。初期Focus LensはBASIC。
- BASICはCanvas上のMove / Uniform Scale / Rotate / Anchorを共通語彙とする。
- X / Y / Rotation / Scaleのprecise値は`詳細`へ下げる。
- DISTORT / WARPはBASIC production受入後の後続Stage。先行してmodel、button動作、Warp topologyを作らない。
- A / B / Cを却下案として削除せず、Dへの不満時の再試行fixtureとして維持する。

GO時もproduction SliceはBasic Transformだけに限定する。

1. bounds projection / handle geometryのpure helper
2. Canvas overlayのread-only表示
3. Move
4. Uniform Scale
5. Rotate
6. Anchor
7. confirm / cancel / Reset / History接続

DistortとWarpはBasic production受入後の別Stage。Drawing WarpをTimeline keyへ同時接続しない。

## 7.1 Stage B0 — BASIC production boundary（確定）

最初のproduction proofは既存操作を置換せず、Dの表示文法だけを接続する。

1. `system/transform-overlay-geometry.js`をpure geometry正本とし、既存`transform-math.js`のmatrixからsource bounds四隅とrotation affordanceを導出する。
2. normal Raster / Folder / CAF working LayerはV開始時のRaster alphaからcontent-tight boundsをruntime算出する。Project / Layer schemaへ保存しない。失敗時だけ既存Raster surface boundsへfallbackする。
3. `ui/layer-transform-basic-overlay.js`はread-only BASIC overlay。box、4 corner、rotateを表示するがpointer eventを取らず、transform / History / saveを所有しない。
4. Anchorは既存`transform-anchor-site.js`を維持する。Anchor animationへ接続しない。
5. panelはBASICをactive表示し、precise sliderを`詳細`へ下げる。DISTORT / WARPは後続Stageとしてdisabled表示する。
6. 既存Canvas drag / Shift+drag、wheel、arrow、flip、confirm / cancel / Reset、normal / CAF History、save前commitを変更しない。
7. Pixel Selectionは既存selection overlay / floating adapterを維持する。共通interactive handle接続はnormal / Folder / CAFのread-only proof受入後に行う。

Stage B1のAcceptance Criteria:

- BASIC開始時にcontent-tight box、4 corner、rotate、既存Anchorが同時に読める。
- overlayはcamera pan / zoom、Layer preview Move / Rotate / Scaleへ追従する。
- `詳細`を閉じた初期状態でCanvas上の対象がpanelより主役に見える。
- DISTORT / WARPは押せず、未実装操作を示唆してmodel mutationを起こさない。
- V再入力confirm、Escape cancel、Reset、normal / Folder / CAF working Layerの既存結果とHistory件数を変えない。

Stage B1技術proof完了（2026-08-31）:

- `BASIC / DISTORT / WARP`のD shellをproduction panelへ反映し、BASICだけをactive、DISTORT / WARPはdisabledとした。precise sliderは初期closedの`詳細`へ下げた。
- Raster alphaから求めるruntime-only tight bounds、既存matrix、coordinate systemを分離し、pointerを取らない4 corner + rotateのSVG overlayを接続した。既存Anchor siteは保持した。
- 1280×720でMove preview追従、`詳細`開閉、Escape cancel、V confirm、Undo / Redo後の再入場とbounds復元、History 1→2を確認した。
- 480×800の初期起動でCanvas内のcontent-tight box、4 corner、rotate、Anchor、210px panelが収まり、横overflow 0、console warning / error 0件を確認した。途中viewport resizeでCanvasごと現在camera位置を維持するのは既存camera挙動であり、overlay独自のずれではない。
- source / static契約verifier、全verifier、build、生成物清掃を通過後に技術proof完了とする。Ownerのproduction実画面での注意量・Canvas遮蔽・ハンドル存在感は別のvisual acceptanceとし、未承認のままinteractive handleへ進まない。

## 8. Acceptance Criteria

- Current / CSP-like / Procreate-like / Tegaki hybridを一画面で比較できる。
- fixtureはproduction module、save、History、EventBusへ接続しない。
- Basic / Distort / Warpの注意水位と表示条件が明文化される。
- Layer Warp GridとRig Meshが別語彙で説明される。
- AnchorはCanvas上で見えるが、初期段階では時間keyにならない。
- normal Raster、Folder、CAF working Layer、selection、SVG / path metadataの現行差が欠落なく記録される。
- productionへ進む前にOwnerがvisual comparisonを選べる。

## 9. 検証

Stage A1ではfixture verifier、wide / 480×800 Browser、keyboard / pointer / pen相当hit、document overflow、console warning / errorを確認する。Stage B1ではpure geometry / production shell契約verifier、wide / 480×800初期起動、Move / confirm / cancel / Undo / Redo、History、consoleを追加する。

production Sliceへ進んだ場合だけ、変更対象`node --check`、全verifier、`npm.cmd run build`、生成物差分清掃、実操作のconfirm / cancel / Undo / Redo / save前commitを追加する。

## 10. model分担

- Stage A1のinteraction grammar、Focus Lens、比較軸、Gate判定はSOL / MAX。
- pure geometry、fixture、既存契約が確定した単一SliceだけLUNA / MAX候補。
- History、CAF adapter、save、schema、Warp topology、RIG境界判断をLUNAへ委譲しない。

## 11. 次作業予告

Phase 9o Stage B1は技術proof完了。次taskはOwnerがproduction実画面のBASIC shell + read-only overlayをvisual acceptanceするかの確認。承認後の実装taskはinteractive Uniform Scale handleの一Slice、作業担当はSOL / MAX。Rotate / Anchor gesture、DISTORT / WARP、Animation bridgeは並走しない。
