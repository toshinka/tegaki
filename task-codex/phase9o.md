# Phase 9o — Layer Transform Interaction Grammar / Focus Lens Gate

作成日: 2026-08-31
更新日: 2026-09-01

状態: ACTIVE — Gate 1=`GO — D: Tegaki hybrid`。Stage B1〜B3はOwner acceptance済み。Stage B4 Owner correction 2（描画範囲中央Anchor / 一本線Scale / 重なりhandle優先）はproduction技術proof完了、Owner再確認待ち

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
7. `開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_2026-08-31.md`
8. `開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`
9. `開発用資料保管庫/Archive/phase9n.md`
10. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
11. `tegaki_work/system/layer-transform.js`
12. `tegaki_work/system/transform-math.js`
13. `tegaki_work/system/transform-overlay-geometry.js`
14. `tegaki_work/ui/layer-transform-basic-overlay.js`
15. `tegaki_work/system/layer-system.js`
16. `tegaki_work/ui/transform-anchor-site.js`
17. `tegaki_work/ui/dom-builder.js`
18. `tegaki_work/system/layer-transform-preview-sampling.js`
19. `tegaki_work/build/verify-phase9o-basic-transform-production.mjs`

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
| D Tegaki hybrid | BASIC中の直接操作が最短 | 中 | common handle＋Focus Lens＋precise二次水位。Owner選定済み、Gate 1=`GO` |

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
- source / static契約verifierを含む全131 verifier、build、生成物清掃を通過し、技術proof完了。build warningは既知の`ag-psd` util externalizationとchunk sizeのみ。Ownerのproduction実画面での注意量・Canvas遮蔽・ハンドル存在感は別のvisual acceptanceとし、未承認のままinteractive handleへ進まない。

Ownerは2026-08-31にStage B1のproduction実画面を確認し、visual acceptanceを与えた。

## 7.2 Stage B2 — corner Uniform Scale（限定production Slice）

四隅だけを最初のinteractive handleとする。side midpoint、Rotate、Origin / Anchor gesture、DISTORT / WARP、numeric scrub、Animation bridge、RIG再設計は並走しない。

契約:

1. 可視cornerは直径12px、pointer hitは通常直径28px、coarse pointerは直径36pxとし、visual markerとhit areaを分ける。
2. pointer開始時の既存Anchorとtransformを固定し、Anchorからpointerまでのscreen距離比を`scaleX / scaleY`へ同倍率で掛ける。camera zoomに依存せず、反転符号と既存の縦横比を保つ。
3. scaleは既存`TEGAKI_CONFIG.layer.minScale / maxScale`へclampする。cornerをAnchorの反対側へ越えてflipする機能は本Sliceへ入れない。
4. overlayはpointer captureとDOM入力だけを扱い、transform正本、Pixi preview、History、confirm、saveを所有しない。`LayerTransform`が既存session transformへ適用する。
5. pointerupはpreviewを終えるだけでHistoryを作らない。V再入力confirmで既存1 History、Escapeでsession開始前へ復元する。pointercancel / lost captureはそのcorner gesture開始値へ戻す。
6. Canvas drag Move、Shift directional Rotate / Scale、wheel、arrow、slider、flip、Anchor、normal / Folder / CAF confirm経路をfallbackとして維持する。Pixel Selectionは既存adapterのまま非対象。

Stage B2技術proof（2026-08-31）:

- `transform-overlay-geometry.js`へ入力transformを変更しないscreen距離比helperを追加し、反転符号、非等倍比、min / max clampを固定入力で検証した。
- SVGの可視cornerと透明hit circleを分離し、mouse / pen / touch向けpointer capture、document capture fallback、cancel rollbackをcallback境界で接続した。hover / drag中だけcornerを橙へ上げ、静止時はFutaba cream + 茶を維持する。
- 1280×720でcorner拡大 / 縮小、preview中History不変、V confirm 1件、Undo / Redo、Escape復元と再入場bounds一致を確認した。480×800でもcorner操作、210px panel、横overflow 0を確認した。
- source / static契約を含む全131 verifier、production build、新規Browser tabのconsole warning / error 0件を通過し、`tegaki_work/dist/`生成差分を清掃した。build warningは既知の`ag-psd` util externalizationとchunk sizeのみ。
- Rotate handle、side midpoint、Origin gesture、DISTORT / WARP、numeric scrub、Animation / RIGには接続していない。

Ownerは2026-08-31にStage B2 corner Uniform Scaleをproduction実画面で操作確認し、受入れた。

## 7.3 Stage B3 — Rotate handle（限定production Slice）

上部rotation handleだけを次のinteractive handleとする。box外drag、side midpoint、Origin / Anchor gesture、DISTORT / WARP、numeric scrub、Animation bridge、RIG再設計は並走しない。

契約:

1. 可視rotation markerは直径14px、pointer hitは通常直径28px、coarse pointerは直径36pxとし、visual markerとhit areaを分ける。
2. pointer開始時の既存Anchor、transform、screen上のpointer角を固定し、移動ごとの最短角差を累積してrotationへ適用する。±π境界で逆回転へ跳ばず、camera水平 / 垂直反転時もhandleがscreen上のpointerへ追従する向きを保つ。
3. rotationは既存`minRotation / maxRotation / rotationLoop`へ従い、x / y、scaleX / scaleY、Anchorを変更しない。Shift snapや別のrotation保存値を追加しない。
4. overlayはpointer captureとDOM入力だけを扱い、transform正本、Pixi preview、History、confirm、saveを所有しない。`LayerTransform`が既存session transformへ適用する。
5. pointerupはpreviewを終えるだけでHistoryを作らない。V再入力confirmで既存1 History、Escapeでsession開始前へ復元する。pointercancel / lost captureはrotation gesture開始値へ戻す。
6. Canvas drag Move、Shift directional Rotate / Scale、wheel、arrow、slider、flip、Anchor、normal / Folder / CAF confirm経路をfallbackとして維持する。Pixel Selectionは既存adapterのまま非対象。

Stage B3技術proof（2026-08-31）:

- `transform-overlay-geometry.js`へ±π境界を最短角差へ正規化するpure helperと、入力transformを変更せずscreen累積角をrotationへ適用するhelperを追加した。camera反転はscreen座標変換のorientationだけで補正し、第二transform modelを作っていない。
- SVGの可視rotation markerと透明hit circleを分離し、mouse / pen / touch向けpointer capture、document capture fallback、cancel rollbackをcallback境界で接続した。静止時はFutaba cream + 茶、hover / drag時だけmarkerを橙、drag時だけstemを橙へ上げる。
- 1280×720でhandleがpointer終点へ追従し、preview中History 1のまま、V confirmで2、Undoで1、Redoで2、EscapeでHistory不変かつ再入場bounds一致を確認した。480×800でもrotation操作、210px panel、横overflow 0を確認した。
- source / static契約を含む全131 verifier、production build、Browser console warning / error 0件を通過した。build warningは既知の`ag-psd` util externalizationとchunk sizeのみ。
- box外drag、side midpoint、Origin gesture、DISTORT / WARP、numeric scrub、Interaction Context / Instant Animation / Lazy Lane Disclosure、RIGには接続していない。

Ownerは2026-08-31にStage B3 Rotate handleをproduction実画面で操作確認し、受入れた。

## 7.4 Stage B4 — side midpoint one-axis Scale（限定production Slice）

### 実装前比較

| 案 | 長所 | 懸念 / 再試行条件 | 判定 |
|---|---|---|---|
| A: side midpointなし | overlayの注意量が最小。非等倍Scaleは詳細操作へ委ねられる | direct manipulationの学習済み文法が欠け、横幅 / 高さだけを変える入口が隠れる | Ownerが4辺を煩雑と判断した時のfallbackとして保持 |
| B: quiet 4辺中点 | CSP系を含む長年の学習済み文法を、cornerより小さいmarkerで直接使える | 8 handle全体が絵より目立つ可能性。小さい対象ではhitが近接する | `GO`。visual / hit分離とrest / hover差で注意量を抑える |

最新toolの外見を模倣するのではなく、desktop / pen双方で一軸Scaleの意図が直接伝わる学習済み文法を引き取る。Aも棄却して削除せず、本表をOwner visual NG時の切替条件として保持する。

契約:

1. 4辺中点の可視markerは直径10px、pointer hitは通常直径28px、coarse pointerは直径36px。cornerより静かにし、通常はFutaba cream + 茶、hover / drag中だけ橙へ上げる。
2. 上 / 下は`scaleY`だけ、左 / 右は`scaleX`だけを変更する。pointer開始時の既存Anchor、transform、screen上のbox二軸を固定し、回転済み対象でもlocal axis projection比でhandleがpointerへ追従する。
3. x / y、rotation、反対軸scale、Anchorを変更しない。初期proofでは既存反転符号を保ち、Anchor越えを`minScale`で止めたが、Owner操作で学習済みのflip期待と不一致になったため、後述7.5で符号反転へ改訂した。
4. overlayはpointer captureとDOM入力だけを扱い、transform正本、Pixi preview、History、confirm、saveを所有しない。`LayerTransform`が既存session transformへ適用する。
5. pointerupはpreviewを終えるだけでHistoryを作らない。V再入力confirmで既存1 History、Escapeでsession開始前へ復元する。pointercancel / lost captureはそのside gesture開始値へ戻す。
6. precise panel同期はsliderの`onChange`を再発火させず、one-axis値をuniformへ戻さない。single Scale slider自体は従来どおり明示操作時のUniform Scaleとして維持する。
7. Canvas drag Move、Shift directional Rotate / Scale、wheel、arrow、slider、flip、Anchor、normal / Folder / CAF confirm経路をfallbackとして維持する。Pixel Selectionは既存adapterのまま非対象。

Stage B4技術proof（2026-08-31）:

- `transform-overlay-geometry.js`へ4辺中点、screen上の斜交可能なbox二軸分解、一軸projection比を追加した。初期proofではpure固定入力でx / y分離、既存反転符号、Anchor越えclamp、min / max、入力非mutationを検証したが、Anchor越えclampはOwner操作後に7.5のflipへ置換した。
- SVGへ可視10px + 透明28px / coarse 36pxの4辺中点を追加し、回転角に追従するresize cursor、pointer capture、document fallback、cancel rollbackを既存callback境界へ接続した。
- 最初のwide実操作でpanel表示更新がScale sliderの`onChange`を返し、非変更軸までuniform化するfeedbackを検出した。`updateTransformPanelValues()`をsilent同期へ限定修正し、既存sliderの明示操作semanticは維持した。
- 1280×720で横一軸`197×94 → 345.28×94`、続く縦一軸`345.28×94 → 345.28×455.54`、preview中History 1、V confirm 2、Undo 1、Redo 2、Escape後の再入場bounds一致を確認した。約45°回転後も`197×94 → 319.86×94`とlocal x軸だけが変化した。
- 480×800で横一軸`148×64 → 428.69×64`、4 side hit、210px panel、横overflow 0を確認した。最終browser passでapplication warning / errorは観測されず、全131 verifierとproduction buildを通過した。build warningは既知の`ag-psd` util externalizationとchunk sizeのみ。
- box外drag、Origin / Anchor gesture、DISTORT / WARP、numeric scrub、Interaction Context / Instant Animation / Lazy Lane Disclosure、RIGには接続していない。

## 7.5 Stage B4 Owner correction — Anchor / flip / preview quality（限定production Slice）

Ownerの2026-09-01操作結果から、B4の対象内で次の三点を補正した。Project / Layer schema、History semantic、確定Bake、Animation、DISTORT / WARPへは広げない。

1. Anchor表示callbackがTransform開始時のobjectを保持したまま、辺Scale / Rotate側がMap内を新objectへ差し替えていた参照世代ずれを解消した。Anchor表示 / dragは毎回現行session transformを解決し、Canvas Move、handle Scale、Rotate、flip後もboxと同じdelta / matrixへ追従する。
2. panelのAnchor buttonを操作群の左端へ分離し、resting時もFutaba palette内の淡い橙surfaceで識別する。single clickは従来の明示Anchor編集、double clickは現runtime content-tight bounds中央へ`rebaseTransformAnchor()`で復帰し、見た目を跳ばさない。この時点ではdefault / ResetのCanvas正規化`0.5 / 0.5`を維持したが、Owner実使用後に7.6で描画範囲中央へ改訂した。永続toggleや保存fieldは追加しない。
3. corner / side handleがAnchorを越えた時は、倍率の符号を許して水平 / 垂直 / 両軸flipへ連続移行する。exact zeroだけを避ける最小絶対倍率と既存`maxScale`でmatrixを安定化し、x / y、rotation、Anchor、非対象軸を維持する。
4. 確定前previewは元Rasterを破壊していなかったが、拡大時のlinear samplingが短いdab間までぼかし、線を途切れたように見せていた。runtime sessionが参照するunique textureのsamplingを拡大中だけ`nearest`へ切り替えるdisplay-only helperを追加し、cancel / confirmのBake前に必ず元filterへ戻す。半ベクターstroke replay、source Raster再生成、History、exportは追加しない。

技術proof（2026-09-01）:

- 1280×720でcontent-center復帰後のAnchorとboxをCanvas Moveし、両者が正確に`+90px / +30px`追従した。preview中Historyは`1/500`のまま。
- 右辺handleをAnchor越しへdragし、`scaleX`符号反転、`scaleY`維持、History不変を確認した。cornerもpure固定入力で両軸符号反転を検証した。
- enlarged preview中はsource pixelを再Bakeせずexact-pixel表示へ切り替わり、V confirm時は元samplingへ戻して既存一回Bake / History `1→2`となることを確認した。巨大拡大時のpixel edgeは意図した原画忠実表示であり、vector品質の約束ではない。
- 480×800で210px panelの横overflow 0、Anchor button左端、4 handle群と中心表示を確認した。全131 verifier、production build、通常scaleの最終Browser passでconsole warning / error 0件を通過し、`tegaki_work/dist/`生成差分を清掃した。意図的な巨大scale確定stressでは既存max-texture guardのwarning 1件を確認したが、Raster mutation / History追加は行われない。build warningは既知の`ag-psd` util externalizationとchunk sizeのみ。
- Owner visual acceptanceは未完了。技術proofは中心buttonの押しやすさ、flipの期待感、exact-pixel previewの見え方を代替しない。

## 7.6 Stage B4 Owner correction 2 — content-center default / collapsed handle priority

Ownerの2026-09-01再操作では、Canvas中心より絵／変形枠の中心を初期Anchorとする方が、double clickの復帰先と一致して自然だった。また既存Scale下限ではside handleが重なる前に止まり、一本線まで潰せないことが確認された。B4内の直接操作だけを次のように補正し、保存schema、History、確定Bake、slider / wheelの安全下限へは広げない。

1. V開始時にAnchor値が未設定なら、runtime content-tight bounds中央をCanvas正規化Anchorへ変換し、`rebaseTransformAnchor()`で見た目を維持してsessionへ設定する。ResetとAnchor button double clickも同じ描画範囲中央へ戻す。boundsを取得できない場合だけCanvas中心`0.5 / 0.5`へfallbackする。Anchor単独差はno-op / History判定へ含めず、Project fieldも増やさない。
2. Canvas上のcorner / side handleに限り、Scale下限を非特異行列を保つ`0.0001`へ下げ、ほぼ一本線まで縮小してそのままAnchor越えflipできるようにする。exact zeroは作らず、panel slider / wheelの既存`TEGAKI_CONFIG.layer.minScale`と確定Bakeの最小1px境界は維持する。
3. handleが重なった時は、最後にpointerdownされたvisual + transparent hit pairをSVG末尾へ移し、見た目と次回入力の双方で最前面にする。固定z-indexの別規則は作らない。
4. 極細時は28pxのtransparent hit内の掴み位置をScale比の原点にしない。gesture開始時の実handle中心をScale基準とし、pointerの掴みずれはdeltaとして加える。一本線からの再展開／反転を鈍らせず、掴んだ瞬間のjumpも避ける。

技術proof（2026-09-01）:

- 1280×720の新規sessionで描画範囲box中心と初期Anchorがともに`596 / 326.5px`となることを確認した。
- 右side handleをAnchorへdragし、box幅が`172px → 0.0172px`まで縮小した。重なり時のDOM / hit最前面は最後に触れた右side `index=1`。
- 重なった右handleを中心から6px外側で掴んで反対側へdragし、符号反転したboxが幅約`202px`まで自然に再展開した。hit半径由来の縮小停滞はない。
- Owner visual acceptanceは未完了。一本線近傍のhandle密度、最後に触れた側の理解、mouse / penの再展開感はOwner確認を要する。

後続案として、Canvas中心や任意整列を必要とする場合は、永続Anchor位置toggleより先にvirtual grid / snapを比較する。格子間隔を数値指定し、線／交点へ吸着する任意modeとし、将来のfreehand／放物線Motion Pathでも同じ投影候補を再利用できる。ただしTransform sessionとTimeline keyの保存・History正本は統合しない。この案はBASIC直接操作とMotion Pathの各Gate後に検討し、Phase 9oでは実装しない。

## 7.7 Transform / RIG Authoring Addendumの採否

`開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_2026-08-31.md`はWorking Addendumであり、一括実装契約にしない。現行codeと照合し、次のように分類する。

改訂追補`開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`では、Interaction Context、Instant Animation、Lazy Lane Disclosureが追加された。これは現行Transformのstatic preview / confirm契約を上書きせず、次のAnimation Bridge Gateで優先比較するWorking Proposalとして保持する。

2026-08-31にAdobe Animate / CLIP STUDIO PAINT / Procreate / Live2D / ToonSquid / Riveの公式資料を照合し、Root / Joint連続配置、Auto Mesh、corner / midpoint / rotation handle、Distort / Warp分離、Auto / Manual Meshの記述を確認した。Adobe Animateはmaintenance modeのため最新トレンドの正本にはしないが、長年磨かれたonboarding patternを捨てる理由にもならない。良い文法を抽出してTegakiのFocus Lensへ再構成し、外見や古い全体構造は模倣しない。最新toolの支持や多数派も絶対視せず、比較根拠とOwner実使用でTegakiの分析がより良い場合は独自案を優先する。

Phase 9oの評価軸へ採用:

- Canvas direct manipulation → keyboard / 左手device → numeric precision、かつpen-only fallbackのinput priority。
- rotation handleはquietな通常表示、hover / selected / dragだけを橙にし、色だけへ識別を依存させない。Stage B1 read-only表示ではcream fill + Futaba茶outline / stemへ反映済み。
- Originは通常状態で誤操作させず、既存の明示Anchor modeでだけ編集する。visual markerとhit areaを分離する。
- DISTORTは四隅 / skew / perspective-like、WARPはgrid pointの非線形局所変形とし、Layer Warp GridとRig Meshを同一modelにしない。
- label → selected contextual hint → hover tooltip → `?`の説明水位。pen / touchで使えないhover-only helpにしない。

後続BASIC Sliceで比較してから契約化:

- corner Uniform Scaleとquiet side midpoint one-axis Scaleは別Sliceでproductionへ接続した。side midpointなし案も、注意量が過剰な場合のfallbackとして本Phaseへ保持する。
- bounds-center Originは推奨度が高い。7.5ではAnchor button double clickだけを採用し、Owner再操作後の7.6で初期値 / Resetもruntime content-bounds中央へ揃えた。Canvas中心が必要な用途は、永続Anchor位置toggleを増やす前にvirtual grid / numeric spacing / line・intersection snapを比較する。
- `◀ [scrubbable value] ▶`はslider代替候補。Transformからpilotするが、interactive Canvas handleと並走させず、Layer opacity等へ機械的に波及させない。
- Transform Origin / Rig Joint / Bone Controllerのvisual familyは有力。data modelは統合せず、Current refined / Lever / Joint-chain hybridをRIG後続fixtureで比較する。

現PhaseでHOLD:

- Root-first Joint authoring、AutoMesh-first、AUTO / GUIDE / MANUAL、Hard / Soft、Freeze / Protect、TEST POSE、Animation ACTIVE / BRANCH / ALL / PIN。
- これらはPhase 9nのsingle static host authorityを維持しつつ、Transform BASICとDrawing Warp / Animation bridgeの後に別Gateで扱う。
- `Animation Table OPEN = ANIMATE`、baseline + current Auto Key、Top Bar Edit Target indicator、ACTIVE / KEYEDのlazy materializeは有力だが、source edit / existing key rebaseとHistory authorityを先にGate化する。Phase 9oのBASIC handle Sliceへ接続しない。

## 8. Acceptance Criteria

- Current / CSP-like / Procreate-like / Tegaki hybridを一画面で比較できる。
- fixtureはproduction module、save、History、EventBusへ接続しない。
- Basic / Distort / Warpの注意水位と表示条件が明文化される。
- Layer Warp GridとRig Meshが別語彙で説明される。
- AnchorはCanvas上で見えるが、初期段階では時間keyにならない。
- normal Raster、Folder、CAF working Layer、selection、SVG / path metadataの現行差が欠落なく記録される。
- productionへ進む前にOwnerがvisual comparisonを選べる。

## 9. 検証

Stage A1ではfixture verifier、wide / 480×800 Browser、keyboard / pointer / pen相当hit、document overflow、console warning / errorを確認する。Stage B1ではpure geometry / production shell契約verifier、wide / 480×800初期起動、Move / confirm / cancel / Undo / Redo、History、consoleを追加する。Stage B2ではcorner拡大 / 縮小、反転符号 / clamp、pointer cancel、preview History 0、V confirm 1、Escape復元、Undo / Redo、wide / 480px overflowを追加する。Stage B3では±π境界、camera反転方向、rotation pointer追従、preview History 0、V confirm 1、Escape復元、Undo / Redo、wide / 480px overflowを追加する。Stage B4ではx / y分離、回転後のlocal axis projection、slider feedback遮断、Anchor越えflip、Anchor現行session追従、初期 / Reset / double clickのcontent-center、Scale`0.0001`、重なりhandleのlast-touched優先、hit位置非依存の再展開、preview sampling復帰、preview History 0、V confirm 1、Escape復元、Undo / Redo、wide / 480px overflowを追加する。

production Sliceへ進んだ場合だけ、変更対象`node --check`、全verifier、`npm.cmd run build`、生成物差分清掃、実操作のconfirm / cancel / Undo / Redo / save前commitを追加する。

## 10. model分担

- Stage A1のinteraction grammar、Focus Lens、比較軸、Gate判定はSOL / MAX。
- pure geometry、fixture、既存契約が確定した単一SliceだけLUNA / MAX候補。
- History、CAF adapter、save、schema、Warp topology、RIG境界判断をLUNAへ委譲しない。

## 11. 次作業予告

Phase 9o Stage B4 Owner correction 2は技術proof完了。次taskはOwnerが初期 / Reset / double clickの描画範囲中央Anchor、一本線までのside縮小、重なり時のlast-touched入力、反転後の再展開をmouse / penで再確認すること。併せて従来のAnchor追従と拡大previewも見る。受入後はStage B4を閉じ、BASIC close条件の選定へ進む。virtual grid / numeric spacing / line・intersection snapとfreehand / 放物線Motion Path連携は後続Gate候補として保持し、今は実装しない。作業担当はSOL / MAX。DISTORT / WARP、Interaction Context / Animation bridgeは並走しない。
