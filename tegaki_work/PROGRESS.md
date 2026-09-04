# Tegaki Progress

更新日: 2026-09-04

## 現在地

- レイヤーパネル／アニメコンテキスト UI/UX再構築（C案：Frame Compass + CAF Parent Header採用）を完了した。
  - **Stage A (Hierarchy)**: `LayerPanelRenderer.render()` のDOM挿入順序を `Frame Compass → CAF Parent Header → 暫定LAYERS|RIG Switch → Content Body` に再構成。CAF identityヘッダー生成（`createCafContextHeader()`）とレイヤー本文（`createCafLayerContent()`）を分離し、RIGビュー切替時でもCAF名・レーン名・可視性等のCAFコンテキストが消失しない構造を確立。将来Switchが廃止されても破綻しない階層関係とした。
  - **Stage B (Semantics)**: 2つのGhost問題を解消。時間方向オニオンスキン（Timeline Onion）はGhostアイコンを維持し、他レーン参照（Lane Reference）には新設の専用アイコン（`UI_ICONS.laneReference`: Lucide `rows-3` 相当）を導入。両ボタンのラッパー構造（`.frame-control-icon`）を統一し、再生ボタンもSVG化（`UI_ICONS.play` / `stop`）。日本語ツールチップと `aria-pressed`, `aria-label` を更新。
  - **Stage C (Alignment)**: 再生ボタン（旧18px）を含む全コントロールの寸法を `--ui-frame-control-size` (20px) に統一。flex centeringとSVGブロック化により垂直中心線を厳密に整列。
  - **Stage D (Surface & Polish)**: Frame Compass（`border-radius: 6px;`）とCAF Content Group（`border-radius: 6px 6px 0 0;`）の間に3pxのsmall gapを設定。Lane Referenceのactive配色を `--futaba-maroon` 背景 + `--futaba-background` 前景とし、Timeline Onion（橙系）と明確に差別化。
  - 新設の `build/verify-layer-panel-animation-context-ux.mjs` および更新した `build/verify-layer-panel-frosted-focus-followup.mjs` を含む全関連verifier（全18件以上）、production build、headless Edgeブラウザ実機検証（console error 0件、アニメテーブル開閉・RIG切替・レイヤー復帰）、生成物清掃を通過した。
- 長時間描画性能劣化 改修（第2回改修指示書 Stage A〜C）を完了した。
  - **Stage A**: 通常Raster Brushの `layerData.pathsData` への不要な点列累積を停止し、スナップショット生成時の `includePathCollections: false` および復元時の `restorePathCollections: false` オプションを導入。これにより400ストローク描画時でも点列ディープコピー時間（旧47ms）が **0ms** に完全解消し、legacy path collections の保護契約（空配列による上書き防止）を維持した。
  - **Stage B**: Pen / Eraser 限定で dirty rect ピクセルパッチ方式 History（`raster-patch-history.js`）へ移行。安全マージン（`padding = Math.max(8, Math.ceil(settings.size) + 4)`）による包絡、CPU crop、Pixi `frame` 抽出、unpremultiply 契約の完全統一、CPU 上書きによる Undo/Redo Pixel Exact 復元、bounds 不一致・例外時の full fallback を実装。実機 Edge/PixiJS v8.19.0 にて `frame extract == CPU crop of full extract` の byte-for-byte 完全一致を実証。History 1件あたりの消費容量が 11.5MB → 数十KB へ縮小し、1200×1200 キャンバスにおいて 256MB に到達する遥か手前（19.1MB）で目標通り `maxSize=250` 件に到達することを確認した。
  - **Stage C**: 通常ストローク完了時のサムネイル通知（`source: 'brush-stroke'`）を約120msデバウンスで coalesce する機構を `thumbnail-system.js` へ導入。連続描画中の毎ストローク全画面 GPU readback を抑制し、レイヤー切り替えや既存 `immediate: true`（Import/Transform等）の即時更新を維持した。
  - 新設の `build/verify-long-drawing-degradation-fix.mjs` および全既存 verifier、production build、生成物清掃を通過した。
- Phase 5a〜9pを完了した。詳細記録は`開発用資料保管庫/Archive/`へ保存し、Owner制作確認の残りは`OWNER_VERIFICATION_BACKLOG.md`へ分離している。
- Phase 9bはUI Design Authority / Animation Table Style Boundary Gate。palette / semantic token / component static style / runtime geometry / behavior正本を`UI_DESIGN_AUTHORITY_MAP.md`へ固定し、Phase 9a Playback headerの静的appearanceだけを`styles/components/animation-table-playback.css`へ限定抽出した。DOM / event / ARIA / model / History / save / runtime geometryを維持し、全102 verifier / build / Browser narrow実表示 / console 0件 / 生成物清掃、SOL final review=`A`で技術closeした。
- Phase 9cはCanvas-first Visual Language / Skin Baseline Comparison Gate。Gate 1=`GO — B: Warm Canvas-first`とし、最初のproduction componentをAnimation Table Playbackだけへ限定した。中央playを通常32×28px / coarse 44×38pxへ強め、Playback / Range群の枠競争を抑え、設定済みOUTと再生中Playを橙背景＋Futaba茶へ補正した。DOM / event / ARIA / History / save / wheel / runtime geometryを維持し、全103 verifier / build / Browser 1280×720・480×800 / console 0件 / 生成物清掃、SOL final review=`A`で技術closeした。QTP / Layer Panelのproduction skinは別Phaseへ分離する。
- Phase 9dはQTP Canvas-first Surface / Component Style Boundary Gate。narrow再表示のfadeIn scale不整合をlayout寸法 / 座標へ限定補修し、QTP root / header static appearanceだけを`styles/components/quick-access-popup.css`へ一正本化した。geometry / DOM / event / ARIA / storageとPalette / tool / preset / slider / Text / Help / Positionを維持し、全104 verifier / build / Browser 1280×720・480×800 / Q・Position・Help・Text・tool・preset / console 0件 / 生成物清掃、SOL final review=`A`で技術closeした。
- Phase 9eはAnimation Table Primary Playback / Header Attention Gate。CSS order＋左右auto marginだけで主playを第一header rowへ戻し、栗色面＋Futaba背景色抜き、playing橙、coarse 44×38pxを固定した。Phase 9fのOwner follow-upで通常時だけ28×24pxへ一回り縮小した。
- Phase 9fはAnimation Table Attention Hierarchy / Inactive Border Gate。Gate 0=`GO — B: Quiet Resting`として、休止中のSCOPE / PREVIEW / Onion / zoom / 非破壊補助actionだけをtransparent border＋淡いsurfaceへ下げ、hover / open / focus / activeでsemantic borderを戻した。Selected Clip / Delete / close、hit area、DOM / event / ARIA / model / History / save / wheel / dragは維持した。全105 verifier / build / Browser fixture・wide・700px narrow / console 0件 / 生成物清掃、SOL final review=`A`で技術closeした。
- Phase 9gはQTP Palette / Tool Slot Attention Hierarchy Gate。Gate 0=`GO — B: Borderless Resting＋Selected Ring`としてPalette color / tool / preset cellだけをtransparent borderへ下げ、cream色は14%内側contrast、selectedは橙ring、focus-visibleは2px橙outlineとした。Main / Sub、slider、Text、event / storage / Canvas inputは維持した。全106 verifier / build / Browser fixture・production / console 0件 / 生成物清掃、SOL final review=`A`で技術closeした。
- Phase 9hはSidebar Rail Attention Hierarchy / Active Surface Gate。Gate 0=`GO — B: Quiet Resting＋Hover Surface＋Active Ring`として休止中borderをtransparentへ下げ、hover / focus / active / disabledのsurfaceを`styles/components/sidebar-rail.css`へ一正本化した。30 / 38px hit、tool順、icon、event / shortcutを維持し、全107 verifier / build / Browser wide・700px narrow / console 0件、SOL final review=`A`で技術closeした。
- Phase 9iはSidebar Action Semantics / Close Sync Gate。8入口を6 popup launcher / 1 one-shot command / 1 temporary modeへ分類し、native button、popupの`aria-expanded`、Vの`aria-pressed`、Importの状態属性なしを既存visibility / mode正本へ投影した。内部close、別popup、Escape、Enter / Spaceを同じaction / hide経路へ揃え、全108 verifier / build / Browser wide・narrow / console 0件、SOL final review=`A`で技術closeした。
- Phase 9jはRight Layer Panel Theme Surface / Static Authority Gate。現行computed valueを`--ui-layer-*`と`styles/components/layer-panel-surface.css`へ一正本化し、rendererのinline styleをwidth / indentだけへ限定した。通常Layer / Folder / D&DとCAF header / internal mirror / Folder開閉、全109 verifier / build、console 0件を確認し、Current warm維持、SOL final review=`A`で技術closeした。
- Phase 9kはIntegrated Outer Shell Luminance / Theme Comparison Gate。Owner Gate 0=`GO — D: Floating dark rails`として左右operation railだけをFutaba light-maroon 98→88% gradient、shadowなし、不透明on-dark trash橙`#ffb87e`へ限定接続した。関連4 verifier / 全111 verifier / production build / Browser / console 0件を通過し、Owner visual受入、SOL final review=`A`でcloseした。同じ数値の橙・grayでも周辺明度で知覚が変わる同時対比をStyle Guideへ記録し、actual surface比較と数値contrastを併用する。長時間制作、mouse / pen / touchのSpace＋dragはOwner確認台帳へ分離した。
- Phase 9lはGate 0=`GO — D: Flat CAF context＋unified layer list`としてcloseした。右Panelは選択CAF一件の薄いcontextとそのinternal Layer / Folderだけを投影し、current targetを橙surface一つで示す。CAF asset列挙とinternal Layer Pointer D&Dを右Panelから外し、CAF順序・階層・複数CAF切替・D&DをAnimation Tableへ寄せた。Folder collapse時の選択focus、visibility / clipping、複数CAF切替、Table close / reopen、全113 verifier、build、Browser、console 0件を通過し、SOL final review=`A`。`1 UI engine / 2 data adapter`、TimelineModel / ClipAsset / DrawingSnapshot、History / saveは維持した。
- Phase 9mはAnimation Table Utility Split / Low-Zoom LOD Comparison Gate。Stage B `C first`、Playback End、Bottom utility、Clip visual LOD、一行header、固定幅Playback Range、OUT限定I / O、borderless FPS / FRAMES / PREVIEW、Bottom Lucide COPY / DELETEをproduction接続した。Browserのrange / PREVIEW位置不変、I / O設定・解除とCanvas I非干渉、COPY、SVGを確認し、全118 verifier、`node --check`、build、生成物清掃を通過。Ownerが2026-08-29に実画面受入し、SOL final review=`A`でcloseした。Clip Focus、dark top / bottom、Lane濃淡、外枠削減は独立候補として保持する。
- Phase 9nはRIG / Motion Responsibility / Contextual Right RIG Inspector Gateとしてcloseした。D3で右RIGをoverview / next action / handoff、既存single floating windowをmode別`RIG WORKSPACE / CLIP MOTION / WARP WORKSPACE`とするhost ownershipを固定した。right RIGからのopen、mode往復、close / reopen、Table closed再入場、History不変、480×800横overflow 0、console 0件、全129 verifier、buildを通過した。schema / solver / History / save authorityは変更していない。現RIG WORKSPACE layoutと上位tab分類は最終UX受入ではない。
- Phase 9oはLayer Transform Interaction Grammar / Focus Lens Gate。Gate 1=`GO — D: Tegaki hybrid`とし、BASIC Move / corner Uniform Scale / Rotate / quiet 4辺one-axis Scale、content-center Anchor、一本線Scale、last-touched入力、flip後再展開、capture喪失時preview維持、拡大中exact-pixel samplingを固定した。Ownerは2026-09-01に問題解決としてStage B4を受入した。全131 verifier、production build、Browser、console 0件、生成物清掃を通過し、schema / History / source Raster / exportを変更せずcloseして`Archive/phase9o.md`へ移した。A / B / C、side midpointなし、閉じる／決定button、virtual grid / snapは再試行・後続候補として保持する。
- Phase 9pはTransform-to-Clip Key Bridge / Interaction Context Gateとしてcloseした。Gate 0=`GO — C`、Gate 1=`GO — B: Transform-local indicator`、Gate 2=`GO — B: split owner + synchronous adapter`。Owner実機確認でroot Clip Motionの内部Layer行echo / working Raster一括proxy案を修正し、active internal Rasterだけの`ClipInstance.layerTransformTracks`を追加した。root `transformKeyframes`はCAF全体Motionのまま維持し、兄弟Layer非干渉、RIG / Mesh / clipping排他、Project serialize / delete / copy / bake / retime、Timeline History、単色丸KEYを接続した。全141 verifier、production build、BrowserのF1 / F10、Undo / Redo、console 0件、生成物清掃を通過した。
- 現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate。最初にnormal Raster / CAF internal Raster / root Clip / FolderのWARP authority、History、save、compositor順序、RIG / Mesh / clipping境界を監査し、Layer Transform `WARP`と既存`WARP WORKSPACE`の入口案を選定する。production実装はGate 0後。担当はSOL / MAX、Antigravity2は境界固定後のread-only比較候補とする。
- Phase 6gではQTP開閉用`Q`、既存Layer Transform経路の`V`、Plan Aの最小sidebar、tooltip撤去、icon比率、`square-dashed`選択iconを確定した。削除済み描画tool専用の到達不能handlerも残存監査で除去した。
- Phase 6hではBrowser 100%のまま主要UIを従来80%表示相当へ縮小し、Canvas / pointer座標を変えず、`pointer: coarse`だけ主要hit areaを従来寸法へ戻した。sidebar、Layer Panel、QTP、CAF、Animation Table、status、Resize、Settings、Layer Transformを固定入力で受入れた。
- QTPの選択tool表示、Animation Table表示中のPixel Selection変形preview、CAF化後にTableを閉じた状態の矩形overlayを、既存PixelSelection状態・selection event・working Layer adapterへ接続して修正した。preview / confirm / Table close後の位置は固定入力で一致し、Historyは1操作1件、console errorなしを確認した。
- 通常Layer / Table表示中CAF / Table閉鎖後CAFの選択系横断リファクタリングはproposal 14へ記録した。Raster確定位置、Undo / Redo、保存 / 再openの破損が再現しない限りRig系列を止めない。
- Phase 6i Gate 0では、CAF内部Layer / Folder IDをPart identityとして再利用し、表示親`parentLayerId`とrig親`parentPartId`を分離する`GO`判定を確定した。preview / exportは同じ純粋FK結果を使い、copy / pasteは共通ID mapで参照を再mapする。
- Phase 6jではoptional Part schema、validation、共通ID remap、root Motionと共有するtransform-track sampler、stateless rigid FKを実装した。Rigなし保存shape、Project / History round-trip、CAF copy、structured Bake、2段FK、random seekを固定入力で受入れた。
- Phase 6kでは一つのCAF内部Folder subtreeを一つのRenderIslandとして解決する共通render planを実装し、Pixi preview / playback / onionとCanvas compositor / Bake / exportへ同じworld matrixを接続した。clipping分断はRaster fallbackとし、negative bounds、root Motion / WARP順、Table開閉後のactive poseを固定入力とBrowserで受入れた。
- Phase 6lでは一つのFolder Partに限定し、選択CAFのAnimation Table子行、Folder Part登録、既存`rigMotion.partTracks`へのkey編集、Canvas handleを接続した。オーナー実機受入を得て`GO`でcloseした。
- Phase 6mではCAF内部Folder枠を通常Raster thumbnailから分離し、Animation Table Laneを26pxへ調整した。オーナー実機で受入済み。
- Phase 6nでは既存Rig正本へoptional Bone schema、validation、共有ID remap、3段のstateless FKを追加した。Project / CAF copy / Bake / random seekを固定入力で受入れ、`GO`でcloseした。
- Phase 6oでは一つのroot BONEを一つのFolder Partへ明示bindingし、inverse bind deltaを既存Folder RenderIslandへ接続した。preview / playback / onion / Bake / exportは同じplanを使い、通常描画とconsole errorなしをBrowserで確認した。
- Phase 6pでは一つのroot BONE + binding、Bone key、Canvas tip rotation、全Folder候補Lane、`RIG → MOTION → WARP`のRIG-first導線、CAF / Folder対象tab、単一Inspectorを実装しcloseした。
- Phase 6qではCAF + 全Folder PIVOT、遅延Rig登録、青Setup / 橙Motion、親BONE接続、nested剛体FKを共通render planへ接続し、オーナー実機でRigと親子Motionを受入れた。親dropdownを維持したまま、Canvas上のPIVOT長押し接続、接続線dragによる付け替え、空drop解除も同じ`parentBoneId` setterへ接続した。保存Bone長は維持し、表示stemだけを短縮した。
- Phase 6rは保存容量・KEY選択・tab復帰・通常Layer選択の安定化Sliceとしてcloseした。多数Folder / Layer / Motion keyで旧`Invalid string length` crashが再現しない状態を維持し、Motion / WARP / Bone / legacy Part KEYのCtrl/Cmd複数選択と一括drag、通常押下だけの一時表示、再Ctrl/Cmd click解除、設定済みLaneのlast-used tab復帰、PIVOT設定済み`✓`、Project採取前のV Layer Transform確定、同一Assetの内部Layer選択保持を完了した。CLIP MOTION内のnative `title` tooltipはFutaba paletteの`data-tooltip`へ統一し、pointerupでもKEY選択toggleをcommitしてCtrl/Cmd OFF後の◆表示を通常へ戻す。外部paste / Canvas resizeを含むV save / reopenは既知残存として後続検査へ引き継ぐ。
- Phase 6sはFolder別WARP GRID、Project / Album round-trip、容量、Bake / export共有経路をSOL review 4とOwner実機で受入れcloseした。`Folder subtree合成 → Folder WARP → Part/Bone matrix → Folder opacity/blend → root WARP → root Motion → Lane`を維持する。
- Phase 6tは固定長2-Bone IKを既存Bone Pose keyへ確定するPose Bake方式で実装し、SOL review 3判定`A`とOwner実機受入によりcloseした。pure solver、root / joint rotationだけの書込み、1 gesture 1 History、cancel rollback、固定segment、通常FK、random seek、Project / Bake / Folder RenderPlanを固定した。target track、Constraint、stretch、Mesh、weightは追加していない。
- Phase 6uはSOL review 2判定`A`でStage A / Bを受入れcloseした。新規WARP GRIDはCAF / Folderのeffective-visible alpha実内容へauto-fitし、巨大boundsをCanvasへfallbackせず拒否する。Raster privateのbarycentric / epsilonは`warp-triangle-point-map.js`へ抽出し、既存topology / placementだけでBind Project点をPose Project点へ写すpure helperを固定した。全26 verifier、node --check、build、Stage A Browser smoke、生成物清掃を通過した。Gate 1は、Asset static RigとInstance Folder WARPを跨ぐConstraint所有、Bone評価後の再pass、cycle、ID remap / validationが未確定のため`HOLD`とし、子PIVOT追従は後続Phase候補へ送った。
- Phase 6v〜6yでは、一つのCAF内部Rasterへ複数Mesh BONEを置く限定Skinning系列を完了した。`ClipAsset.meshDefinitions / skinBindings`をoptional static Setup、既存`rigDefinition.bones`をBind、`ClipInstance.rigMotion.boneTracks`をFrame Poseとして分離し、inverse-bind LBSをCPU / Pixi共通render planへ接続した。RIG / MOTIONのRaster target、`＋ BONE`、既存親接続、Bone key、Alpha-fit `AUTO GRID` / `GRID再生成`、最大2 distance weight、Raster更新時`STALE`を実装した。全29 verifier、変更JS / mjsの`node --check`、build、Browser軽量確認、console errorなし、生成物清掃を通過した。
- Phase 6zでは重いProjectの緊急復旧checkpointをOwner設定へ接続した。操作中の定期記録、5秒〜5分の最短間隔、tab非表示・終了時の記録を独立設定でき、OFF切替は未開始のdebounce / idle / retryをcancelする。通常Ctrl+S保存とは別機能であることをUIへ明示し、Project / checkpoint shapeは変更していない。Owner制作Projectでは5秒設定でAnimation Table操作の周期的遅延が継続し、1分で解消したため、新規既定を1分へ変更して短周期を高負荷設定と明示した。定期Ctrl+Sは重複serializeを避けるsingle-flight Gateまで未実装とする。
- Phase 7aはcloseした。通常Layer／Table表示中CAF／Table閉鎖後CAFのrow順・depth、active / selected / working ID、Panel全DOM再構築、clipping全走査をdebug限定で計測し、軽量三状態の階層一致を確認した。CAF内部Layer追加時のPanel由来clipping refreshはmicrotask集約で6回からdirect 1 + Panel 1の2回へ削減した。制作Projectの継続遅延は5秒周期の全Project緊急復旧serializeと判定した。
- Phase 7bはSOL最終判定`A`とOwner実機受入によりcloseした。WARP `SELECT`（square-dashed）の矩形replace、Ctrl/Cmd toggle、選択点一括dragを既存key / 1 gesture 1 Historyへ接続し、selectionはClip / Folder / topology単位のruntimeだけに限定した。通常click／3px未満のpointer揺れはkey・Historyを増やさず、Undo / Redo後も別topologyへ選択indexを持ち越さない。
- Phase 7cはSOL review 5=`A`とOwnerの軽量確認後close許可によりcloseした。Folder WARP anchor → direct-child PIVOT追従は、static relationを`ClipAsset.rigDefinition`、Frame poseを既存`ClipInstance.folderDeformers` / `rigMotion`へ分離し、実deformer / triangle内だけON保存、dormant / stale時の通常FK fallback、display-only成立表示を固定した。軽量BrowserでWARP未作成 / GRID外拒否、BRUSH変形時のanchorと子PIVOT同量追従、OFF復帰、Undo / Redo、Table再開、onion / playback、console error 0件を確認した。深い制作Project、GIF / APNG、source / target削除、pen / touchは継続監視とする。20件のJS / mjs node check、全33 verifier、buildを通過し、生成物は清掃済み。
- Phase 7dはSOL review 1 / 2 / final=`A`とOwner受入によりcloseした。表示階層、Rigグラフ、描画所属を分離し、Folder PartとCAF直下Root Raster Partを保存field追加なしのgeneric RenderIsland planへ統合した。pure reparent Gateは描画所属・Folder WARP・clipping contractが変わる移動をmutation前に拒否し、同一親reorderとdisplay-only移動だけを許可する。Folder無し`+RIG`、Setup青の連結node + `RIG` chip、CLIP Motion中のplain Space + dragを完了した。全36 verifier、build、限定Browserを通過し、深い制作Project、GIF / APNG、pen / touchは継続監視とする。
- Phase 7eはWARP `GRID` Bind回転のProject座標補正としてcloseした。GRID rotation / rotation-handleだけを既存`applyWarpPlacementToPoints()`へ接続し、非正方形boundsでもProject辺長・角度・中心を維持する。全37 verifier、node check、build、SOL review 1=`A`を通過し、Browserでは横長4×4を約45°／90°へ連続回転して長短比と平行辺、1 gesture 1 History、Undo / Redo、Table close / reopen、console error 0件を確認した。OwnerがGRID回転で形状が崩れないことを実機受入した。Folder / Control Mesh深部、Project reload、playback / onion、Bake / GIF / APNG、pen / touchは継続監視とする。
- Phase 7fはWARP Bind Setupの`FRAME / CORNER / EDGE`操作分離としてcloseした。一corner／一edgeのProject deltaをtopology比率で配るpure helper、既存rebase、runtime segmented control、edge midpoint handleを接続し、GRID toolとBind submodeだけを既存deformer Bind青へ変更した。全38 verifier、Browserの横長8×8、Owner実機で回転不変、青semantic、FRAME / CORNER / EDGEを受入れた。fixed 4×4、Folder、Project reload、playback / onion、Bake / GIF / APNG、Shift + wheel実modifier、pen / touchは継続監視とする。
- Phase 7gはWARP `RADIAL` topologyとしてOwner受入でcloseした。center + 16 segments × 3 ringsの決定的な49点／80 triangleを既存free Control Meshへ保存し、新規作成だけの青い`RADIAL`入口、POINT / SELECT、1 Historyへ接続した。free topologyではFRAME / CORNER / EDGEをdisabledにし、新しい保存flag、renderer分岐、既存key変換を追加していない。変更34 JS / mjsのnode check、全39 verifier、build、Browser実操作、Owner実機確認を通過した。
- Phase 7hはAuto Shape alpha contour foundationから限定production接続までStage A〜E、SOL review 1〜5=`A`、Owner軽量実機受入を完了してcloseした。4-connected contour、hole / island FILL、topology検査付き輪郭削減、透明guard、256 vertex budgetを既存Mesh / Skinへ接続した。Setup青RIG内で`AUTO GRID`と`AUTO SHAPE`が並存し、最大2 weight、CURRENT / STALE、明示再生成、CAF asset一操作一History、CAF / Raster複製、Project round-tripを既存正本で維持する。Browserで`SHAPE → GRID → Undo / Redo`、Raster追記STALE、再生成、Mesh Bone key、playback、onion、console error 0件を確認した。LINE、manual weight / topology、WARP共有は未実装。完了記録は`開発用資料保管庫/Archive/phase7h.md`。
- Phase 7h close前後のPhase横断小改修として、通常Folderの「複製」を子孫Folder / Raster込みの既存`layer-block`コピー正本へ統合した。Animation Table上部headerの通常wheelはTimeline zoom、Lane列wheelは上下を維持し、Timeline grid wheelはPhase 8a入口で左右キー正本と同じFrame±1へ変更した。CanvasのH / Shift+H反転はcanvas全体中心ではなく、現在viewport中心下のProject座標を固定する。入れ子Folder複製とUndo / Redo、header wheel `87% → 100%`、拡大後H反転、console error 0件をBrowserで確認し、全45 verifier / buildを通過した。
- Animation Table / CLIP MOTIONの軽量導線監査では、Table既定高をLane一行分だけ拡張し、WARPのGRID / RADIAL / 4×4作成、GRID / FRAME Bind編集を明るいSetup青へ統一した。続くPhase 7lでheaderを明示二段へ限定整理し、上段`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`、下段`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`へ固定した。既存ID / event / wheel三領域 / drag / model / History / saveは変更していない。
- Phase 7i〜7oは各Gate=`GO`、実装Stage、最終SOL review=`A`、関連verifier / node check / build / Browser確認を再監査し、2026-08-12のOwner指示に基づきSOL技術closeした。LINE / Ribbon、Deformer三形状SELECT、Text to Raster、Table二段header、read-only Motion Graph、Resize直接framing、Motion Easing 12 presetの保存・History境界は変更していない。制作Project、長尺CAF、reload / export、pen / touch等のOwner未確認項目は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離し、不具合が見つかった場合は閉じたPhaseを暗黙に再OPENせず限定bug fixまたは新Phaseで扱う。完了記録は`開発用資料保管庫/Archive/phase7i.md`〜`phase7o.md`。
- Phase 7p Motion Easing Clipboardは、Motion値clipboardと分離したruntime tagged payloadでHOLD / LINEAR / custom cubicだけをCOPYし、現在またはCtrl / Cmd複数選択Motion keyへ1 Historyで原子的に貼り付ける。HOLDはCurve入力read-onlyのままclipboard操作を許可し、terminal混在は全体を拒否する。SOL review 1=`A`、全57 verifier、build、BrowserのHOLD copy / paste、Undo / Redo、terminal拒否、console 0件で技術closeした。完了記録は`開発用資料保管庫/Archive/phase7p.md`。
- Phase 7q Motion Graph Key Navigation / Easing Bridgeは、explicit Motion key markerのmouse / keyboard seekと既存EASING CURVEへの明示導線を追加し、SOL review=`A`で技術closeした。Graph値編集、Motion Path、manual Mesh、Project / History schema、Graph専用selection、sampler / preview / exportは変更していない。全57 verifier、build、Browserの5 group、History非増加、HOLD read-only、terminal / playback無効、Graph / Curve再開、console 0件を通過した。完了記録は`開発用資料保管庫/Archive/phase7q.md`。
- Phase 7rはGate 0=`GO`で、既存explicit Motion keyのactive一channel値dragを既存複合key mutationへ接続した。POSITION / SCALE channel selector、degree / percent単位変換、live preview、pointerup 1 History、cancel rollback、再生中拒否を固定し、Motion time move、key追加、複数key、Motion Path、保存schemaは変更していない。SOL review=`A`、全58 verifier、build、Browserの5 group / Undo・Redo / playback / close-reopen / console確認まで完了した。build/.viteの追跡済み基準を復元し、生成asset 5件とVite log 2件を清掃したため、2026-08-13に技術closeして`Archive/phase7r.md`へ移した。Owner制作確認は台帳へ分離する。
- Phase 7sはPixiJS 8.17.0→8.19.0互換更新をWebGPU採用と分離し、package / lock / runtime固定、公式Agent Skills参照境界、affected API自動Gateを追加した。全59 verifier、production build、Vite devのESM import graph 151 module / HTTP失敗0 / runtime 8.19.0、生成物清掃を通過し、SOL review=`A`で2026-08-13に技術closeした。Codex側Browser制御transportがTegaki起動前に閉じたため、WebGL / 描画 / mask / WARP / exportのBrowser実操作は通過済みとせずOwner確認台帳へ明示分離した。完了記録は`開発用資料保管庫/Archive/phase7s.md`。
- Phase 7t Codex Multi-Model / External Web Review WorkflowはStage 0〜2、project-scoped `tegaki_luna_worker`、AGENTS規則、詳細workflow、External Review templateを完了した。LUNA / MAXのread-only probe=`A`、workspace-write限定pilot、GitHubURL鮮度verifier、全60 verifier、build、生成物清掃を通過し、SOL最終review=`A`で技術closeした。nested CLIはtoken / 待ち時間が重いため導入・再現検査へ限定し、新runのapp直接spawnを優先する。主task model自動変更、複数write agent、外部report自動採用は行わない。完了記録は`開発用資料保管庫/Archive/phase7t.md`。
- Phase 7u Vite / Build Tool Security PatchはVite 8.0.16 exact、PostCSS 8.5.26、Nanoid 3.3.18へ限定更新し、`npm audit` high 3 / total 3を0件へした。PixiJS 8.19.0、Vite script、application production sourceを維持し、全61 verifier、build、dev serverの`/` / Vite client / core initializer HTTP 200、生成物清掃を通過してSOL review=`A`で技術closeした。完了記録は`開発用資料保管庫/Archive/phase7u.md`。
- Phase 7vはMotion数値scrubとCanvas root Motionを既存Motion Graphの`changed / mutated / rollback`契約へ揃えた。tap / step 0 / micro moveはHistory 0、実変更pointerupはHistory 1、pointercancel / lost capture / Escapeと元値復帰はrollbackする。pure同値比較、限定verifier、全62 verifier、build、生成物清掃を通過し、SOL review=`A`で技術closeした。Browser制御transportがpage操作前に閉じたためgesture実操作はOwner確認台帳へ分離した。完了記録は`開発用資料保管庫/Archive/phase7v.md`。
- Phase 7wはMotion Graph途中点追加をguarded `ADD POINT` Modeとして実装した。既存Bezier solverを共有し、De Casteljau分割、implicit boundary materialize、HOLD / blendMode、active以外の全parameter sample不変をpure planで固定した。既存12 preset×6位置は72件中68件成功、現行X control 0..1で正確に表せない`STRONG IN-OUT` / `CIRCULAR IN-OUT`中央4件はmutation前に理由付き拒否する。全63 verifier、build、SOL review=`A`で技術closeし、Browser未確認はOwner台帳へ分離した。完了記録は`Archive/phase7w.md`。
- Phase 7xはGate 0=`GO`で、既存runtime Timeline selectionをGraphへ投影し、選択済みanchorだけ同一Clip Motion keyのactive一channelをdisplay deltaでatomic編集する。未選択anchorは従来どおり単独、異種key選択は維持してfilterする。partial key / clamp / no-op / duplicate Frame / old Projectをpure planで固定し、Ctrl / Cmd toggle、橙ring、History 1、cancel rollbackへ接続した。全64 verifier、build、SOL review=`A`で技術closeし、Browser未確認はOwner台帳へ分離した。完了記録は`Archive/phase7x.md`。
- Phase 7yはGate 0=`GO`でMotion Easing Overshoot / Backを実装した。X controlは0..1、Y controlは-1..2、Clip Motionだけraw ratio、opacity / blendStrengthは補間後clamp、Part / Boneは従来clampを維持する。Back三preset、clipboard / Project round-trip、Setup青`ALLOW OVERSHOOT`、標準0..1帯、ADD POINT exact split / 理由付き拒否を固定し、全65 verifier、build、SOL review=`A`で技術closeした。Browser制御transportで未通過の実操作はOwner台帳へ分離した。完了記録は`Archive/phase7y.md`。
- Phase 7zは一枚Raster人体の`Chain-local Joint Skin`安全Gateを技術closeした。最寄りBoneのrigid領域、直結親子だけの短いjoint band、曖昧branch / jointの非mutation拒否をpure helperへ固定し、明示`AUTO SHAPE`だけ`weightMode: chain-local-joint-v1`へ接続した。45° / 90° / 135°stripで現行distanceより幅・長さ誤差を改善し、branch外weight 0、triangle winding、最大2 normalized weightを通過した。cleanな緊急checkpointがRasterを強制再captureしてMeshをSTALE化する既存不整合も通常dirty判定へ戻した。全69 verifier、build、Browserの`SHAPE JOINT`、Undo / Redo、checkpoint後CURRENT、Timeline grid wheel、console 0件を通過し、SOL review=`A`。Owner制作確認は台帳へ分離し、完了記録は`Archive/phase7z.md`。
- Phase 7z入口でAnimation Tableのdominant-axis wheel routingを固定し、Root Raster方式が成立済みのCAFへ追加した直下Rasterだけ初期Part / Boneを継承するようにした。Layer削除は専有Rig / Motion / Mesh / Skinを明示cascadeし、共有Boneと外部子Rigは理由付き拒否する。多Bone Canvasは名前AUTO / ON、hover名、明色underlayへ限定改善し、Layer別Mesh Bone groupとTable折りたたみはproposal 15の後続Gateへ分離した。Stage A baselineでは現行global distanceがhead頂点にも別branchの第2weightを配ることをpure fixtureで再現した。
- Phase 8aは選択Raster / Mesh / Boneのread-only weight診断をSetup青RIG内へ接続し、SOL review=`A`で技術closeした。既存`skinBindings`とFrame Skin evaluatorだけからweight 0 / 微小漏れ / blend / rigidを導出し、固定6 SVG path、Futaba cream二重outline、pan / zoom時group matrix、pointer非参加、target消失時解除を固定した。全71 verifier、変更JSの`node --check`、build、Browserの生成前disabled、ON / OFF、target / tab切替、Table close、console 0件を通過した。Owner制作確認は台帳へ分離し、active Raster focusとTable group / collapseはPhase 8bへ送った。
- Phase 8bはAnimation Tableの多Bone表示密度Gateを技術closeした。rigid binding / 正weight Skin influenceから一意target、複数target `SHARED / CONNECTION`、targetなし`UNASSIGNED`をpure分類し、同一target 2 Bone以上だけruntime collapse見出しを左右Tableへ接続した。singletonは従来行、既定展開、active Bone / Ctrl・Cmd選択KEYを同時通知し、selection / History / Project / Timeline modelを変更しない。全73 verifier、変更JSの`node --check`、build、Browserのcollapse / 再展開 / selection保持 / History不変を通過し、SOL review=`A`。Owner制作確認は台帳へ分離した。
- Phase 8cはGate 1=`GO — 選択頂点の離散補正`、SOL final review=`A`で技術closeした。Setup青RIGの`CORRECT` modeからstable vertexへ`BONE ONLY / PARENT BLEND / NO INFLUENCE`を既存`skinBindings[].vertexWeights`へ直接確定し、補正済み再生成の明示確認、no-op History 0、実変更1 History、Undo / Redoを固定した。前提導線としてRIG / Motion対象Rasterを既存binding / 正weight Skinから投影し、非対象の絵を半透明、未接続BoneのMotion入力を拒否する。全77 verifier、build、Browser、console 0件を通過し、Owner制作確認は台帳へ分離した。
- Phase 8dは一枚Rasterの`RIG設定 → BONE追加 → AUTO GRID → Motion`、別の`全体PIVOT`、未接続Gate、対象art focus、`WEIGHT確認`復帰を固定した。全78 verifier、build、BrowserのGRID接続 / Bone key / WEIGHT復帰、console 0件とOwner初期制作確認を受入れ、Architecture Gateは`B: Canvas-first Workspaceの段階導入`を選定してcloseした。形状追従Mesh / Topology / 自由Weight paintは別Gate、Owner深部確認は台帳へ残す。
- Phase 8eはRIG / Motionで一つのread-only WEIGHT runtime request / diagnostic / overlayを共有し、Motionのまま`WEIGHT表示 / WEIGHT ON`を切り替えられるようにした。Motion数値変形へoverlay geometryを追従し、CORRECTはRIGだけ、再生中は一時非表示として出力へ混ぜない。全79 verifier、build、Browserの一枚Raster → BONE → AUTO GRID → Motion → WEIGHT → X変形 → playback / F1復帰、console 0件を通過し、SOL final review=`A`で技術closeした。Owner深部確認は台帳へ分離する。
- Phase 8fはCLIP MOTIONの可逆Focus shellを技術closeした。通常茶`CANVAS / DETAIL`でRIG / Motionの数値詳細だけを畳み、mode / target / BONE / AUTO GRID系 / Motion key / WEIGHTを維持する。WARPは詳細固定、runtime compact要求は往復復帰し、viewport内clamp以外のpopup位置、保存 / History / evaluatorを変更しない。全80 verifier、build、1280×720 / 720×720 Browser、Table close→通常ペン→再open、console 0件、SOL final review=`A`を通過した。Owner制作確認は台帳へ分離する。
- Phase 8gはUI semantic contrast / workflow density Gateを技術closeした。通常描画、Animation Table、CLIP MOTIONのcomputed stateを実測し、淡い橙背景へ白文字を継承していた`DETAIL` activeだけを既存茶文字へ限定補正した。1.15:1→9.36:1、全80 verifier、build、expanded / compact / RIG / focus-visible Browser、SOL final review=`A`を通過した。Tableの押せるinactive `LANE` 3.91:1は別componentとしてPhase 8hへ分離した。
- Phase 8hはAnimation Table inactive controlのcontrast Gateを技術closeした。常に操作可能な`SCOPE` inactiveのopacityを0.6から既存playback群と同じ0.68へ揃えて3.91:1→4.81:1とし、browser既定黒focusをFutaba茶outlineへ限定補正した。全80 verifier、build、Browser、SOL final review=`A`を通過し、header DOM、wheel三領域、playback群は変更していない。
- Phase 8iはMesh / Skin正本、stable vertexId、History、STALE / regenerate、CPU / Pixi / exportをread-only監査し、Gate 1=`GO — B: 固定topology Weight brush`、SOL final review=`A`で技術closeした。既存離散補正はfallbackとして維持し、Manual Topologyは別PhaseへHOLDした。
- Phase 8jはAUTO GRID / AUTO SHAPEのCURRENT Meshへ限定したFixed-topology Skin Weight Brushを技術closeした。stable vertexIdへのsigned deltaを既存`skinBindings[].vertexWeights`へ最大2 normalized influenceとして確定し、ADD / SUB、radius / strength、SVG vertex hit、1 gesture 1 History、cancel / failure rollback、Undo / Redoを固定した。全83 verifier / build、BrowserのADD / SUB / Undo / Redo、SOL final review=`A`を通過した。Owner制作確認は台帳へ分離する。
- Phase 8kはRaster Mesh形状編集をWeight brushから分離した。vertex x / yがBind位置とsource sampling位置を兼ねることを監査し、stable ID / triangle / weight / generator sourceを維持、source bounds外、winding反転、degenerate、triangle重なりを非mutationで拒否するpure / Model planと、Setup青の明示`MESH EDIT`、12px vertex hit、1 gesture 1 History / cancel rollbackをproduction UIへ接続して技術closeした。point追加・triangle分割・AUTO LINE・Motion中authoringは後続Gateへ分離する。
- `Claude_GPT_Review/rig-mesh-evaluation-and-followup.md`を現行コードへ照合した。Auto Line拒否toastへ別Raster分離 / 線整理 / AUTO SHAPE等の次操作を追加し、Setup青をpopup内RIG / MESH static Setup actionへ使える境界をUI/CSSガイドへ明記した。実受理率、異種generator誤置換、再生成HistoryはOwner確認台帳へ置き、manual weight補正と分岐Ribbon自動分割は第二正本・複数Mesh境界を先に決める別Gateとしてproposal 15へ積んだ。
- Owner制作操作で、一枚の人物Raster + `AUTO SHAPE` + 11 Mesh BONEでも肘から腕を曲げ、手足を独立操作できることを確認した。一方、全Bone距離上位2本weightによる顔への影響漏れと、LBS関節blendによる腕幅／長さの変化を確認した。既存`skinBindings`を唯一の正本とする`Chain-local Joint Skin`（branch別影響資格、肢内部weight 1、短い関節band、既定stretch off）をproposal 15へ積み、Phase 7yへは混ぜない。
- Web外部AI向け`tegaki_work/GitHubURL.txt`を現行正本へ同期した。main push後にPhase 8k完了記録、Owner確認台帳、Mesh / Weight / Topology関連のpure helperとverifier、統合proposal 15 / 16を辿れる。local欠損0・重複0をverifierで固定するnavigationであり、`TEGAKI.md` / PROGRESS / 現行Phase指示書より上位の正本にはしない。
- proposalは現行14文書。Phase 7tの旧proposal 16はArchive済みで、今回の`16_制作Workspace・UI・外部Handoff構造ロードマップ.md`は外部原案とClaudeReviewを統合した別の現行Architecture Gate正本である。標準入口は`開発用資料保管庫/proposals/00_計画索引.md`。

## 完了基盤の要約

### Animation / CAF

- Lane / Timeline / CAF Group、複数選択、copy / paste、Folder clipping、Lane visibility、onion、preview / playback / export境界を段階実装した。
- Clip Motionは既存`ClipInstance.transform` / `transformKeyframes`を正本とし、position、scale、rotation、anchor、opacity、blend、HOLD / LINEAR / cubic-bezierを同じClip-local Frame契約でsampleする。
- Animation Tableは単押し`A`で開閉する。CLIP MOTIONは未設定CAFの初回だけRIGへ入り、以後は最後に閉じたRIG / Motion / WARP tabへ復帰する。

### WARP

- 固定4×4 WARPと可変GRIDを維持する。
- GRIDは全Frame共通のBind Setupで、GRIDの移動・拡縮・回転だけではRasterを動かさない。
- POINT / BRUSHだけがFrame Poseを変形し、LENSはWarp key内placementを操作する。
- 元Rasterを保持し、Bind triangle領域だけをWarp結果へ差し替える部分合成をCPU / Pixiで共有する。
- 白mask、座標ずれ、透明境界、Raster外、部分重複、GRID / POINT / BRUSH、B / N、preview / playback / Bake / GIF / APNGは固定入力、Browser、オーナー実機で受入済み。
- 旧Project、key無しCAF、固定4×4 WARP、既存可変GRIDはoptional field欠損をidentityとして維持する。

### Raster Mesh / Bone Skinning

- Raster画素はClipAsset内部Layer / DrawingSnapshot、static Mesh / SkinWeightはClipAsset、Bone Poseは既存ClipInstance rigMotionを正本とする。
- Frame頂点は`evaluateRasterBoneSkinning()`でstatelessに導出し、preview / playback / onionとCPU compositor / Bake / exportへ同じ結果を渡す。
- Alpha-fit Gridはwide 8×4、tall 4×8、square 6×6のdeterministic初期値。生成後は固定し、Raster更新時は`STALE`表示だけを行う。
- clipping owner / sourceへ参加するRaster、active Folder WARP / rigid RenderIsland内Rasterは初期proofでは明示unsupported。自動fallbackしない。

### Bake / 容量

- flatten BakeとLayer構造保持Bakeを分離した。
- Bake結果は最上段の新Laneへ作り、元Clipを非表示で保持する。
- Layer構造保持Bakeは逐次生成、容量preflight、cancel、原子的rollback、1 Historyを維持する。
- 400×400、1 Raster Layer、240 Frame実測では処理完走後の同期checkpointに強いmemory pressureが出たため、校正済み安全上限を1GiBへ固定した。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。
- Folder clipping、通常Layer / CAF内部Layerのdata adapter境界を維持する。
- 新しいMotion、mask、Mesh、physics正本を既存経路と並行して作らない。

## 既知残存と再開条件

- sidebar / Layer Panel / QTP / CAF / Animation Tableのcompact表示はBrowser固定入力とオーナー実機で成立した。実pen / touchのcoarse hit areaは継続監視する。
- 重いAnimation Projectでは、緊急復旧Project serialization / IndexedDB checkpointとpointer event queue待ちが重なる場合がある。pen / Airbrush確定自体は実測1ms未満だったため、描画結果やHistory上限を変更せず凍結監視する。
- 複数Motion / WARP Projectの`JSON.stringify`失敗は、保存先への書き込み前に発生する。OneDriveだけを原因とせず、Phase 6rでSnapshot参照数、decoded pixel bytes、JSON長、serialize時間を採取した。Stage DではFolder WARPを含むProject JSON round-tripと、循環JSONを例外化しないsave結果を固定検証した。初回native pickerはDownloadsを開始位置のhintとするが、既存handleとOS / browserのfolder選択を上書きしない。
- 通常modeでLayer Panel選択とV変形Rasterが食い違う例、Table表示有無でFolder / Layer card順が揺れる例はPhase 6rで限定修正した。外部paste / Canvas resizeを含むV save / reopenだけは後続の固定入力へ残し、保存round-trip受入れ前に横断リファクタリングへ広げない。
- Browserで再現したTable閉鎖後のCAF内部Layer selection / working adapterずれは、同じAssetに存在する`selectedInternalLayerId`をFrame同期で保持して修正した。通常 / Table表示 / Table閉鎖後のV確定・EscapeとPanel順は一致した。
- Folder別WARPはPhase 6sでcloseした。target配下に別Part / 別Folder WARP targetがあるnested非線形境界とcross-boundary clippingは明示unsupportedを維持し、制作中に必要性が出た時だけ別Gateで再開する。
- V保存ずれは全Layer一律ではなく、Canvas resizeを挟んだ外部clipboard貼付Rasterが候補。配置を保持する貼付例もあるため、Slice 3で`外部paste → resize → V → save/reopen`を固定入力にしてから限定修正する。
- 添付画像のBrowser file chooser投入はネイティブchooser待ちで完了しなかったため、実機のOS clipboard / file chooser入力へ委譲する。`ImageImporter`のresize前後snapshot、working Layer capture、ProjectManagerのtransform commit待ちはコード監査済みで、現時点では追加修正を入れない。
- 末端の手から前腕・上腕を追従させるrotation-only 2-Bone IKはPhase 6tでcloseした。伸縮と周辺画素の曲げはrotation limit / chain参加 / Mesh・weightと分離したまま維持する。
- Raster Skinningは一Raster / 一Meshの初期proofまで。Auto Shape FILLとLINE Ribbonは既存Mesh / Skinへの明示生成まで接続し、AUTO GRID / AUTO SHAPEの固定topology Weight brushはPhase 8j、既存vertex位置のproduction `MESH EDIT`はPhase 8kで実装した。point追加・triangle分割、AUTO LINE topology編集、Mesh Bone IK、SkinとFolder WARP / clippingの同時適用は未実装。Phase 7cはrigid child PIVOTのtranslation追従だけで、Skin / Mesh同時変形へ広げない。
- 遅延またはcrashが再現した場合は、`TegakiPerf`のevent queue / handler、Long Task、Project export時間、heap、texture残留を同時採取し、AirbrushやHistory件数を先に原因と決めない。詳細は`開発用資料保管庫/Archive/phase6e.md`。
- Layer Panelは通常Layerのflat合成順＋`parentId`と、CAF内部Layerの`parentLayerId` mirrorを別adapterとして維持する。軽量Browserでは通常→Table表示→Table閉鎖後CAF→内部Folder＋子Layerの順序・深度は一致した。多階層時の再現では全DOM再構築時間、active / selected / working ID、`refreshClippingMasks()`全走査時間を三状態で採取し、Lane常時同期や正本統合へ進まない。
- CAF内部Layerの表示親`parentLayerId`とRig親`parentPartId` / `parentBoneId`を同期しない。Folder Partはsubtree、Root Raster PartはCAF直下一枚だけを描画所属とし、reparent前後で有効Part / WARP / clipping ownerが同じなら表示移動を許可する。所属が変わる時だけ理由付きで拒否し、Rigリンクを自動解除・暗黙再接続しない。Setup青の連結node + `RIG`表示は明示登録したFolder / Root Rasterだけへ既存正本から導出する。
- WebGPU brush、SDF / MSDF、水彩・油彩、本格物理、真の無限Canvasは正式な研究Phaseまで凍結する。
- PSD全CAF一括export、通常LayerへのPSD import、再編集可能Text、Camera Track、Folder group完全合成は未実装proposalとして維持する。

## 次の入口

1. `AGENTS.md`
2. `TEGAKI.md`
3. 本書
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. `task-codex/phase9p.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md`
8. `開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`
9. `開発用資料保管庫/Archive/phase9o.md`
10. `tegaki_work/system/animation/transform-edit-context.js`
11. `tegaki_work/system/animation/clip-transform-layer-gesture.js`
12. `tegaki_work/system/animation/clip-transform-key-upsert.js`
13. `tegaki_work/system/animation/transform-edit-transaction.js`
14. `tegaki_work/ui/animation-table-popup.js`
15. `tegaki_work/system/layer-system.js`
16. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
17. `開発用資料保管庫/proposals/00_計画索引.md`
18. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
19. `tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`

Phase 7i〜9pはclose済み。Phase 9pではroot `transformKeyframes`とinternal Raster `layerTransformTracks`を対象範囲で分離し、Layer Transformからactive internal RasterだけへF1 / F10 keyを設定できる。現行Phase 9qはDrawing WARP Gate 0で、既存WARP authority / History / save / compositor境界の監査から開始する。

## 資料

- Phase 6c完了: `開発用資料保管庫/Archive/phase6c.md`
- Phase 6d完了: `開発用資料保管庫/Archive/phase6d.md`
- Phase 6e完了: `開発用資料保管庫/Archive/phase6e.md`
- Phase 6f完了: `開発用資料保管庫/Archive/phase6f.md`
- Phase 6g完了: `開発用資料保管庫/Archive/phase6g.md`
- Phase 6h完了: `開発用資料保管庫/Archive/phase6h.md`
- Phase 6i完了: `開発用資料保管庫/Archive/phase6i.md`
- Phase 6j完了: `開発用資料保管庫/Archive/phase6j.md`
- Phase 6k完了: `開発用資料保管庫/Archive/phase6k.md`
- Phase 6l完了: `開発用資料保管庫/Archive/phase6l.md`
- Phase 6m完了: `開発用資料保管庫/Archive/phase6m.md`
- Phase 6n完了: `開発用資料保管庫/Archive/phase6n.md`
- Phase 6o完了: `開発用資料保管庫/Archive/phase6o.md`
- Phase 6p完了: `開発用資料保管庫/Archive/phase6p.md`
- Phase 6q完了: `開発用資料保管庫/Archive/phase6q.md`
- Phase 6r完了: `開発用資料保管庫/Archive/phase6r.md`
- Phase 6s完了: `開発用資料保管庫/Archive/phase6s.md`
- Phase 6t完了: `開発用資料保管庫/Archive/phase6t.md`
- Phase 6u完了: `開発用資料保管庫/Archive/phase6u.md`
- Phase 6v完了: `開発用資料保管庫/Archive/phase6v.md`
- Phase 6w完了: `開発用資料保管庫/Archive/phase6w.md`
- Phase 6x完了: `開発用資料保管庫/Archive/phase6x.md`
- Phase 6y完了: `開発用資料保管庫/Archive/phase6y.md`
- Phase 6z完了: `開発用資料保管庫/Archive/phase6z.md`
- Phase 7a完了: `開発用資料保管庫/Archive/phase7a.md`
- Phase 7b完了: `開発用資料保管庫/Archive/phase7b.md`
- Phase 7c完了: `開発用資料保管庫/Archive/phase7c.md`
- Phase 7d完了: `開発用資料保管庫/Archive/phase7d.md`
- Phase 7e完了: `開発用資料保管庫/Archive/phase7e.md`
- Phase 7f完了: `開発用資料保管庫/Archive/phase7f.md`
- Phase 7g完了: `開発用資料保管庫/Archive/phase7g.md`
- Phase 7h完了: `開発用資料保管庫/Archive/phase7h.md`
- Phase 7i完了: `開発用資料保管庫/Archive/phase7i.md`
- Phase 7j完了: `開発用資料保管庫/Archive/phase7j.md`
- Phase 7k完了: `開発用資料保管庫/Archive/phase7k.md`
- Phase 7l完了: `開発用資料保管庫/Archive/phase7l.md`
- Phase 7m完了: `開発用資料保管庫/Archive/phase7m.md`
- Phase 7n完了: `開発用資料保管庫/Archive/phase7n.md`
- Phase 7o完了: `開発用資料保管庫/Archive/phase7o.md`
- Phase 7p完了: `開発用資料保管庫/Archive/phase7p.md`
- Phase 7q完了: `開発用資料保管庫/Archive/phase7q.md`
- Owner制作確認台帳: `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
- Phase 7c移行記録: `開発用資料保管庫/Archive/PHASE7C_HANDOFF.md`
- 整理前Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-28.md`
- 現行proposal索引: `開発用資料保管庫/proposals/00_計画索引.md`
- Phase 7t完了: `開発用資料保管庫/Archive/phase7t.md`
- Phase 7u完了: `開発用資料保管庫/Archive/phase7u.md`
- Phase 7v完了: `開発用資料保管庫/Archive/phase7v.md`
- Phase 7w完了: `開発用資料保管庫/Archive/phase7w.md`
- Phase 7x完了: `開発用資料保管庫/Archive/phase7x.md`
- Phase 7y完了: `開発用資料保管庫/Archive/phase7y.md`
- Phase 7z完了: `開発用資料保管庫/Archive/phase7z.md`
- Phase 8a完了: `開発用資料保管庫/Archive/phase8a.md`
- Phase 8b完了: `開発用資料保管庫/Archive/phase8b.md`
- Phase 8c完了: `開発用資料保管庫/Archive/phase8c.md`
- Phase 8d完了: `開発用資料保管庫/Archive/phase8d.md`
- Phase 8e完了: `開発用資料保管庫/Archive/phase8e.md`
- Phase 8f完了: `開発用資料保管庫/Archive/phase8f.md`
- Phase 8g完了: `開発用資料保管庫/Archive/phase8g.md`
- Phase 8h完了: `開発用資料保管庫/Archive/phase8h.md`
- Phase 8i完了: `開発用資料保管庫/Archive/phase8i.md`
- Phase 8j完了: `開発用資料保管庫/Archive/phase8j.md`
- Phase 8l完了: `開発用資料保管庫/Archive/phase8l.md`
- Phase 8m完了: `開発用資料保管庫/Archive/phase8m.md`
- Phase 8n完了: `開発用資料保管庫/Archive/phase8n.md`
- Phase 8o完了: `開発用資料保管庫/Archive/phase8o.md`
- Phase 8p完了: `開発用資料保管庫/Archive/phase8p.md`
- Phase 8q完了: `開発用資料保管庫/Archive/phase8q.md`
- Phase 8r完了: `開発用資料保管庫/Archive/phase8r.md`
- Phase 8s完了: `開発用資料保管庫/Archive/phase8s.md`
- Multi-Model運用正本: `tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`
- Phase 8t完了: `開発用資料保管庫/Archive/phase8t.md`
- Phase 8u完了: `開発用資料保管庫/Archive/phase8u.md`
- Phase 8v完了: `開発用資料保管庫/Archive/phase8v.md`
- Phase 8w完了: `開発用資料保管庫/Archive/phase8w.md`
- Phase 8x完了: `開発用資料保管庫/Archive/phase8x.md`
- Phase 8y完了: `開発用資料保管庫/Archive/phase8y.md`
- Phase 8z完了: `開発用資料保管庫/Archive/phase8z.md`
- Phase 9a完了: `開発用資料保管庫/Archive/phase9a.md`
- Phase 9b完了: `開発用資料保管庫/Archive/phase9b.md`
- Phase 9c完了: `開発用資料保管庫/Archive/phase9c.md`
- Phase 9d完了: `開発用資料保管庫/Archive/phase9d.md`
- Phase 9e完了: `開発用資料保管庫/Archive/phase9e.md`
- Phase 9f完了: `開発用資料保管庫/Archive/phase9f.md`
- Phase 9g完了: `開発用資料保管庫/Archive/phase9g.md`
- Phase 9h完了: `開発用資料保管庫/Archive/phase9h.md`
- Phase 9i完了: `開発用資料保管庫/Archive/phase9i.md`
- Phase 9j完了: `開発用資料保管庫/Archive/phase9j.md`
- Phase 9k完了: `開発用資料保管庫/Archive/phase9k.md`
- Phase 9l完了: `開発用資料保管庫/Archive/phase9l.md`
- Phase 9m完了: `開発用資料保管庫/Archive/phase9m.md`
- Phase 9n完了: `開発用資料保管庫/Archive/phase9n.md`
- Phase 9o完了: `開発用資料保管庫/Archive/phase9o.md`
- Phase 9p完了: `開発用資料保管庫/Archive/phase9p.md`
- Transform / Warp / Animation / RIG Focus Lens提案: `開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
- Transform / RIG Authoring Interaction追補: `開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_2026-08-31.md`
- 次チャット引き継ぎ: `tegaki_work/NEXT_CHAT_HANDOFF.md`
- Transform-centric導線純化追補: `開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md`
- 現行Phase: `task-codex/phase9q.md`（Drawing WARP Authority / Layer Transform Integration Gate、Gate 0の既存WARP authority監査から開始）
