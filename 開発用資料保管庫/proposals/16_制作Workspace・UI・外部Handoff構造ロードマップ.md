# 制作Workspace・UI・外部Handoff構造ロードマップ

更新日: 2026-08-29
状態: Phase 9l Right Layer / CAF FocusをGate 0=`GO — D`、SOL final review=`A`でclose。現行Phase 9mはAnimation Table Utility Split / Low-Zoom LOD Comparison Gate、一行header技術checkpoint済み・Owner visual再確認待ち

## 1. 位置づけ

外部提案`Tegaki 次期構造再設計提案書 — 提出要旨`、`UI-UX再設計提案書`、`UI-UX・アニメーション基盤 再設計提案書`と、ClaudeReviewのUI / file構成 / PixiJS診断を現行コードへ照合した統合結果である。原案は`開発用資料保管庫/Archive/`へ保存し、本書だけを後続Phase選定の正本とする。

Tegakiの中心は描画、セルアニメーション、Rig / Mesh Setup、Motion制作とする。動画編集、音声、最終コンポジットを内製する前提にはせず、必要時は明示的なhandoff packageで外部toolへ渡す。

## 2. 採用する原則

- Canvas Firstとprogressive disclosureを維持し、通常描画時に高度なRig / Graph / export UIを常設しない。
- 外部toolは水平参照に使うが、人気・新しさ・共通配置をそのまま正本にしない。Tegakiの制作頻度、pen操作、Futaba文化、既存model / History / save境界へ戻して、常設 / contextual / mode内の深度文法だけを採否判断する。
- Workspace / popup / Timeline subviewは意志の焦点lensとして、明示入口、現在mode / 対象、breadcrumb / Back、予測可能なclose / reopenを一組で比較する。通常selectionを深いmode進入へ暗黙転用しない。
- `Q` / `V` / `H`、Space + drag、header / Lane / Timeline gridのwheel三領域、半透明popup、既存Panel位置保存を互換契約とする。
- Setup青はstatic設定、橙はFrame作業 / 実行に限定する。一般buttonを意味なく青・橙へ塗り分けない。
- Rig Workspaceを開く場合も、保存正本は既存`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、Frame正本は既存`ClipInstance.rigMotion`とする。Workspace専用Rig、Mesh、selection、Historyを保存しない。
- 静止SetupとAnimationは同じSkin / deformer evaluatorを使う。preview / playback / onion / Bake / export用の別solverを作らない。
- `animation-table-popup.js`の全面分割は行わない。pure projection、overlay、gesture planの境界が固定したものだけを段階抽出する。
- QTPを通常描画の`Painter's Palette`、sidebarを大分類 / 管理 / recoveryのperipheral railとして扱い、両方を同格のtoolboxへ戻さない。
- hit areaと見えるsurfaceを分離し、通常はpanel surfaceとspacing、hover / active / focus時だけcontrol surfaceを強める。色だけでclickabilityやSetup / Motion状態を伝えない。
- Canvasと中心視で扱うQTP / Layer Panel / Animation Tableは現行の淡色warm surfaceを基準とする。外周を濃くする場合は左右railと背景を一体で比較し、大面積maroon / pure blackを避けた低彩度umberを候補とする。半透明 / blurはnarrow体感・可読性・描画負荷を測るまで決め打ちしない。
- 半透明はCanvasとの連続性を示すfloating surfaceへ限定し、input / tooltip / warning / modalは必要な不透明度を保つ。全面glass化しない。
- UI複雑さはcontrol総数だけでなく、到達段数、Canvas遮蔽、close / reopen復帰、pointer種別ごとのhit areaで比較する。
- Brush / Eraser / Selection / Layer / Timeline等の一般概念は学習転移を優先し、独自化はQTP、Rig / Mesh / Perform等で制作上の利益が説明できる場合に限定する。

## 3. 第一候補 — Rig Workspaceの段階抽出

現行CLIP MOTIONのSetup青RIGを、Canvasを主面とする専用Workspace表示へ段階的に拡張する。ただし第一Stageは新画面を作ることではなく、次を実コードで監査するArchitecture Gateとする。

1. 既存RIG panel / Canvas overlay / Animation Table子行の読取・mutation・History入口を列挙する。
2. 現行popup内のtarget、Bone、Mesh、Skin、diagnosticのruntime stateを、保存正本を増やさずWorkspace shellへ投影できるか比較する。
3. Table dock、Inspector折りたたみ、popup維持の三案を1280px / narrow / pen・touch導線で比較する。
4. Workspaceを閉じても通常描画、CAF working Layer、selection、Panel位置、shortcut、wheelを変えない復帰契約を固定する。

最初からDOM全置換、主要class再構成、Animation Table常時dock、top-level MESH tab追加を行わない。

### 思考の水位と比較fixture

制作UIは機能数ではなく、現在の作業で理解すべき概念の深さを制御する。

1. 第一水位は通常描画とCanvas操作。Layer、brush、undo、pan / zoom以外の内部構造を常時要求しない。
2. 第二水位は目的選択。一枚絵を`全体PIVOT`で動かすか、`曲げBONE`で変形するかを明示する。
3. 第三水位は順序付きSetup。成功率を優先した基準導線`BONEを置く → AUTO GRID → Motion`を示し、未接続Motionから同じactionへ戻れるようにする。`AUTO SHAPE / AUTO LINE`は形状に適した高度generatorとして同じSetup内に残す。
4. WEIGHT / CORRECT、generator差、Bone group診断は制作上必要になった時だけ開く。最初の成功より前へ常設しない。

比較対象はCallipeg Studio、Adobe Fresco、CLIP STUDIO PAINT Simple Modeとする。CallipegのCanvas / timeline / pen ergonomics、FrescoのCanvas中心workspaceとtool配置、Simple ModeのCanvas面積とStudio Modeへの可逆切替を、外観模倣ではなく到達段数・占有面積・復帰契約のfixtureとして使う。

contrastはWCAG 2.2を基準資料とし、通常文字4.5:1、large text 3:1を最低監査線にする。非文字control境界、focus、active、disabledは別fixtureで測り、Setup青 / Motion橙だけに意味を依存させない。現行Stage BのSetup青CTAはBrowser computed colorで通常文字4.57:1を確認したが、Workspace全体の監査完了を意味しない。

公式資料:

- https://callipeg.com/learn-interface/
- https://callipeg.com/features/
- https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html
- https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm
- https://www.w3.org/TR/WCAG22/

### Stage Bで先行した既存導線修正

Workspace shell選定に依存しないため、一枚Rasterの`+RIG` / `+BONE`競合を先に是正した。LaneのRaster入口は非mutationの`RIG設定`、曲げ導線は`BONE追加 → AUTO GRID → Motion`、rigid方式は明示`全体PIVOT`とする。未接続Motionはkeyを拒否しつつ対象絵と同じAUTO GRID actionを見せる。接続後は選択Boneを保った`WEIGHT確認`で診断へ戻り、mixed stateは確認付きの明示切替だけで復旧する。未設定Root Rasterの仮targetをCanvas BONEとして見せず、自動初期BONEも作らない。保存schema、solver、History正本は増やさない。

### Phase 8d Gate選定、Phase 8e proof、Phase 8f Focus shell

Ownerの一枚Raster / 6 Bone / AUTO GRID 6×6 / Motion / WEIGHT初期制作確認と、Animation Table + floating CLIP MOTIONがCanvasを覆う固定fixtureから、`B: Canvas-first Rig Workspaceを段階導入`を選定した。現行popupは通常描画への互換fallbackとして維持し、常設dock / InspectorのC案は保留する。

Phase 8eは大きなshell変更から始めず、Motionのまま既存read-only WEIGHT overlayを表示する一つのruntime projectionを実装した。RIG / Motionで診断とtoggleを共有し、current pose追従、再生中一時非表示、RIG-only CORRECTを全79 verifier / build / Browserで固定してSOL技術closeした。

Phase 8fはAnimation Table compact化を見送り、既存CLIP MOTION内の詳細折りたたみ一つだけを採用した。runtime `CANVAS / DETAIL`でRIG / Motionの主要actionを残して数値詳細を畳み、WARPはexpanded固定、close / reopenと通常描画往復でcompact要求を復帰する。全80 verifier / build / 1280×720・720×720 Browser、console 0件、SOL final review=`A`で技術closeした。Workspace保存state、第二selection / History、Mesh / Skin仕様は追加していない。

Phase 8gはFocus shell active、Phase 8hはAnimation Table SCOPE inactive / focusを、それぞれ一componentだけ補正してcloseした。Phase 8hは3.91:1→4.81:1、browser既定黒focus→Futaba茶outlineを全80 verifier / build / Browserで固定した。Phase 8iはWorkspace shellを広げず固定topology Weight brushを選び、Phase 8jでADD / SUB、SVG vertex hit、1 gesture 1 History、cancel / failure rollbackまで技術closeした。Phase 8kは既存vertex位置編集のpure / Model / production `MESH EDIT`、全86 verifier / build / Browserを通過して技術closeした。

### Phase 8l — UI Surface Constitution / Semantic Token Boundary

GUIの早期刷新は全面リスキンではなく、既存Futaba paletteとcomponent寸法tokenの上へ意味surface層を置くところから始める。現行実測では`main.css`のCSS変数は163件だが汎用surface / radius / opacity層はなく、QTPは2,748行のJS内へ静的CSSを注入しながら`main.css`にも同名ruleが残る。`ui-icons.js`は43 SVG、辞書外直書きはAnimation Table 37 / Timeline 6 / DOM Builder 4 / Transform Anchor 1の計48件であり、外部レビューの旧件数を実装契約にしない。

最初のGateは次の順を固定する。

1. `UI_CSSスタイルガイド.md`へSurface state、hitbox分離、Familiarity / Complexity fixtureを正本化する。
2. `--ui-surface-* / --ui-border-* / --ui-radius-* / --ui-shadow-*`を既存値のsemantic aliasとして追加し、sidebar / QTPの見た目を変えないtoken bridgeで検証する。
3. QTP / sidebarだけでCurrent / borderless / restrained-depthを比較する。Stage Cでは完全borderlessを棄却し、QTP外殻だけへ弱い境界とshadowを残すrestrained-depthを選定した。通常event、tool state、Q shortcut、localStorage位置、pen / touch hitは変更しない。
4. OwnerはQTP prototypeを受入れ、Phase 8qでText入口をOPACITY後のcompact utilityへ、Phase 8rで6 Pen presetをsize ring＋active / focus summaryへ限定整理した。QTP全体density / position、Layer Panel、Dock、自由rail編集、Simple / Expert二重UI、Animation Table DOM再構築は別Gateへ残す。

Animation Table横展開時は、Phase 7lの二段headerを完成形と見なさず、`Glance / Choice / Context action`の三層へ情報露出を再配分する。SCOPEは現在値一button＋比較可能なanchored popoverを第一案、LOOPは常時状態が読めるtoggleを維持、END / IN / OUTは再生範囲Choice layerへまとめる比較案とする。Clip copy / duplicate / group / deleteは選択時Action Panelを第一案とし、long pressは既存move / retime / pen gestureと競合するため唯一の入口にしない。大きい選択肢を焦点位置へ届けるFocus Deckは、標準popover semanticsを維持した静的prototypeから評価する。

## 4. 後続候補

### Project-local Rig Library

既存ClipAssetまたは明示複製を再利用し、最初から新しいRig preset schemaを作らない。source Asset更新の伝播、参照切れ、Project外共有が実制作で必要と確認された後だけ、immutable template / import-export境界を別Gateで検討する。

### Video Handoff Package

PNG sequence / APNG / GIF等の既存exportを壊さず、必要になった時だけFrame、FPS、alpha、Canvas size、色・順序metadataをまとめる汎用packageを比較する。特定編集software固有ProjectをTegaki正本にしない。

### UI基盤

Design tokenや共通controlの整理は`UI_CSSスタイルガイド.md`を正本とする。既存`--futaba-*`をpalette正本として維持し、その上へ意味surface aliasを置く。button / popup / scrollbarの局所重複を、QTP / sidebarから触るcomponent単位で段階修正する。大規模CSS rename、全面neutral化、全面glass化、全画面同時移行はしない。

### 性能 / WebGPU

PixiJS 8.19互換更新は完了済み。WebGPU renderer、GPU Skin、GPU paintは、CPU / WebGLの時間、upload量、texture lifetime、export負荷を固定fixtureで計測してから開く。外部診断の「CPU Skinが主ボトルネック」「Raster上限 / Bake上限が最優先」は未計測仮説として扱い、現行コードとOwner制作Projectで再現するまでproduction変更しない。

## 5. 外部レビュー採否

- 採用: generator別UI辞書、Setup青、select option再構築抑制、Canvas first、段階抽出、profiling first、外部handoff。
- 既に実装済み: Rig / Mesh Setupの密度整理、WEIGHT診断、多Bone group、PixiJS 8.19、Multi-Model / External Review運用。
- Phase 8fで完了: 既存popup fallback、CLIP MOTION可逆Focus shell、RIG / Motion主要action維持、WARP詳細固定、normal drawing復帰、narrow clamp。
- Phase 8g / 8hで完了: Workspace contrastをcomputed styleで監査し、Focus shell activeとAnimation Table SCOPEだけを補正した。Phase 8i〜8kで固定topology Weight brushと既存vertex位置`MESH EDIT`を技術closeした。同名Bone / target識別、11 Bone密集、異種generator誤操作、拒否後の次操作はOwner台帳と既存後続Gateを維持する。
- Phase 8lで採用: QTP Painter's Palette、peripheral rail、semantic surface state、hitbox / visual分離、selective translucency、Familiarity / Complexity fixture。Stage B token bridgeはSOL review 1=`A`、Stage C三案比較は完全borderlessを棄却しrestrained-depthを限定反映、全87 verifier / build / BrowserとOwner visual受入を通過してcloseした。
- Phase 8mで採用・実装済み: Animation Table情報露出を`Glance / Choice / Context action`へ分け、最初のSliceをSCOPE current-state一button＋anchored Focus Deckに限定した。既存三ID / setter、History / save、wheel / Clip gestureを維持し、keyboard / pointer closeとnarrowを固定してcloseした。選択Clip Action Panelは別Slice、long pressは補助候補とし、既存move / retime / pen gestureを優先する。
- Phase 8nで採用・実装済み: SCOPEはMonitorだけへ置換せず`category icon＋current value`、LOOPはRepeat / Repeat Off＋surface / ARIA、IN / OUTは範囲marker `I / O` chip、onionはcountを残す。実表示幅による狭幅Gateを含め、全89 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8oで採用・実装済み: Copy / Group / Delete Clipを選択時header stripへ投影し、PasteとLane delete、旧button / handler、move / retime / multi-selectを維持した。全90 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8pで採用・実装済み: END / IN / OUTを`RANGE summary＋anchored Focus Deck`へまとめ、既存Playback保存正本 / History / scope別range計算を維持した。OUT未設定警告、keyboard / outside close、narrowを含む全91 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8qで採用・実装済み: Text入口をOPACITY後の62px `T / TEXT` utilityへ移し、FONTとSIZE / BOLD / current colorを二段化した。Phase 7kのText Raster正本と既存ID / handlerを維持し、全92 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8rで採用・実装済み: 6 Pen presetの直接性を保ちながら、6 slotの番号＋size ring、既存status行のactive / focus summary、focus preview / blur復帰、非対応tool disabledをproduction接続した。保存key / shape、brush engine、Text、QTP全体densityは変更せず、全93 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8sで採用・実装済み: Phase 8pのPlayback保存・History正本を維持し、Repeat隣を全称終端source＋inline I / Oへ限定整理した。Focus Deckは三終端比較だけに残し、全94 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8tで採用・実装済み: `DURATION`だけを単一かつ非GroupedのSelected Clip contextへ送り、LIB、retime / History / ClipAssetを維持した。全95 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8uで採用・実装済み: `LIB`を既存共通Asset Library iconのcompact直接入口へ置き換え、一操作開閉と既存Asset Library / ClipAsset / History正本を維持した。全96 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8vで採用・実装済み: QTP headerの四隅deckからviewport内へ移し、自由drag、共有clamp、保存x / yだけへ確定した。Preset ID / 利き手flag / Projectを追加せず、全97 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 8wで採用・実装済み: Gate 1=`GO — B`で、Pen / Eraser / Airbrushの6 presetを維持し、Preset非対応toolだけsectionをruntime退避した。全98 verifier / build / Browser、生成物清掃、SOL final review=`A`でcloseした。
- Phase 8xで採用・実装済み: shortcut実行正本とSettings / contextual displayの境界を監査し、Gate 1=`GO — B`とした。表示descriptor、Settings全global action projection、QTP Pen一controlのhintを全99 verifier / build / Browser、SOL final review=`A`でcloseした。shortcut再割当、command実行palette、学習state保存は行っていない。
- Phase 8yで採用・実装済み: Phase 8xの受入patternをQTP内7つのglobal tool controlへ限定展開した。canonical tooltip / `aria-keyshortcuts`、通常pointer action、全99 verifier / build / Browser、生成物清掃、SOL final review=`A`でcloseした。
- Phase 8zで採用・実装済み: touch到達性を一つの独立Gateとして、Settings-only / long press / 明示deck / help modeを比較した。現行`pointerdown`即時実行と競合するlong pressを棄却し、QTP headerの明示`?`から開くread-only 7-tool shortcut deckをGate 1=`GO — C`とした。I / P / E / B / G / L / M、198px viewport clamp、coarse 24px hit、deck内drag遮断、Position排他、Escape / outside / close復帰を全100 verifier / build / Browserで確認した。通常tap、Canvas gesture、shortcut割当、保存stateは変えず、SOL final review=`A`で技術closeした。
- Phase 9aで採用・実装済み: Ownerの実使用頻度を視覚階層へ反映し、Range sourceのSetup青を通常surfaceへ戻し、未設定I / Oを文字だけの淡い独立panel、設定後を5px間隔、再生 / 停止を幅追従する中央主actionへ整理した。Playback / History / save / wheel / Clip操作を維持し、全101 verifier / build / wide・narrow Browser、console 0件、生成物清掃、SOL final review=`A`で技術closeした。
- Phase 9bで採用・実装済み: palette / semantic token / component static style / runtime geometry / behavior正本を`UI_DESIGN_AUTHORITY_MAP.md`へ固定し、Playback headerの静的appearanceだけをcomponent stylesheetへ抽出した。DOM / event / ARIA / model / History / save / runtime geometryを維持し、全102 verifier / build / Browser、SOL final review=`A`で技術closeした。
- Phase 9cで採用・実装済み: Animation Table / QTP / Layer Panelの三surfaceをCurrent FutabaとWarm Canvas-firstで比較し、Gate 1=`GO — B`を選んだ。最初のproduction適用はAnimation Table Playbackだけとし、中央play、低頻度Range surface、橙state contrast、coarse hit areaを全103 verifier / build / Browserで固定してSOL final review=`A`でcloseした。
- Phase 9dで採用: narrow再表示のfadeIn scaleによるclamp不整合をlayout寸法 / 座標へ限定補修し、QTP root / headerのstatic appearanceだけを`styles/components/quick-access-popup.css`へ一正本化した。geometry / DOM / event / ARIA / storageとPalette / tool / preset / slider / Text / Help / PositionはJS側に維持し、header下は高さを変えずtransparent borderで競争だけを減らした。
- Phase 9eで採用: 主playを専用rowから第一header rowへ戻し、DOM / eventを変えないCSS order＋左右auto margin、栗色面＋Futaba背景色抜き、playing橙、coarse 44×38pxへ限定した。全104 verifier / build / Browser wide・700px narrow / console 0件、生成物清掃、SOL final review=`A`でcloseした。
- Phase 9fで採用: Gate 0=`GO — B: Quiet Resting`。通常playを28×24pxへ一回り縮小し、休止中のSCOPE / PREVIEW / Onion / zoom / 非破壊補助actionだけをtransparent border＋淡いsurfaceへ下げ、hover / open / focus / activeでsemantic borderを戻した。header dark案はHOLD、Selected Clip / Delete / closeと全behaviorを維持し、全105 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9gで採用: Gate 0=`GO — B: Borderless Resting＋Selected Ring`。Palette color / tool / preset cellだけをtransparent borderへ下げ、cream色は薄い内側contrast、selectedは橙ring、focus-visibleは2px橙outlineとした。Main / Sub、slider、Text / deck、event / storage / Canvas inputを維持し、全106 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9hで採用: Gate 0=`GO — B: Quiet Resting＋Hover Surface＋Active Ring`。resting borderをtransparentへ下げ、hover / focus / active / disabledをsemantic surfaceで戻し、30 / 38px hitを維持した。static appearanceは`styles/components/sidebar-rail.css`へ一正本化し、全107 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9iで採用: Sidebar 8入口を6 popup launcher / 1 one-shot command / 1 temporary modeへ分類し、native button、popupの`aria-expanded`、Vの`aria-pressed`、Importの状態属性なしを既存stateへ投影した。内部close / 別popup / Escape / Enter / Spaceを同じaction / hide経路へ揃え、全108 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9jで採用: Layer / Folder / CAF cardの現行appearanceを`--ui-layer-*`＋`styles/components/layer-panel-surface.css`へ一正本化し、rendererのinline styleをwidth / indentへ限定した。通常Layer / Folder / D&D、CAF header / internal mirror / Folder開閉、全109 verifier / buildを通過し、Current warm維持、SOL final review=`A`でcloseした。
- Phase 9k close: Owner Gate 0=`GO — D: Floating dark rails`。左右operation railだけをFutaba light-maroon 98→88% gradient、shadowなし、不透明on-dark trash橙`#ffb87e`へ限定接続し、Owner visual受入、全111 verifier / build / Browser、SOL final review=`A`でcloseした。同じ数値の橙・grayでもsurround明度で知覚が変わる同時対比をStyle Guideへ記録し、actual surface比較と数値contrastを併用する。Settings rail切替、自動sampling、全面dark化、Table Bottom splitは凍結 / 別Gateを維持する。
- Phase 9l close: Gate 0=`GO — D: Flat CAF context＋unified layer list`。右Panelは選択CAF一件の薄いcontextとそのinternal Layer / Folderだけを投影し、current targetを橙surface一件で示す。CAF asset列挙とinternal Layer Pointer D&Dを右Panelから外し、CAF管理とD&DをAnimation Tableへ寄せた。通常Layer D&D、Table内移動、`1 UI engine / 2 data adapter`、TimelineModel / ClipAsset / DrawingSnapshot、History / saveを維持し、全113 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9m Stage 0 / A / B: right Layer Panelのcompact磨りガラスsurface、Bottom utility、Clip surface / visual LOD、Playback End直接cycle、OUT限定I / O、一行header follow-upは技術checkpoint済み。三行化は760px compact境界と三cluster 100%幅が作る不連続と再現し、620px境界の三列grid＋trailing局所wrapへ限定修正した。Attention / Clip Focus水平調査では通常clickをselectionへ残し、明示`FOCUS`から同じTableをin-place modeへ切り替え、Dope Sheet / Motion Graphをsubview化する案を第一候補とした。比較はFresco / CSP Simple、Callipeg Studio / ToonSquid 2.0 / Procreate Dreams 2、Live2D / Spine、After Effects / Premiereの役割別watchlistで継続し、公式資料の鮮度を各Gateで確認する。dark top / bottomとLane濃淡は独立appearance軸として比較する。Owner header Gateと独立したappearance SliceではSelected Clip contextの重複外枠 / shadow / separator / resting button枠だけを落とし、Futaba面＋橙dot、hover、keyboard focusを維持した。Owner header visual再確認まではClip Focus fixture / productionへ進まない。全118 verifier / build / Browserを通過し、25% / major gridは引き続き保留する。

### Animation Table低倍率・Bottom utilityポンチ絵（Owner知見 2026-08-27）

- headerは一行に収め、第一actionのplayを中央へ置く。Timeline zoom、Asset Library、Selected Clipのduration / copy / delete等はBottom utilityへ分離し、header / Lane / Timeline gridのwheel三領域は維持する。
- 選択Clipは多重outlineと端矢印を重ねず、橙の単一solid block＋小さい角丸を第一案、非選択ClipはFutaba中間色surfaceを第一案とする。resize handle / 左右矢印は45〜50%前後から段階的に弱め、それ以下では隠す比較を行う。
- 現行33%未満のzoom開放は、cell width、frame hit、wheel frame-step、Clip drag / retime、key読取の最低幅を先に監査する。低倍率ではTimeline縦grid線をmajor intervalだけ、さらに低倍率では省略するLODをfixed fixtureで比較する。
- `SCOPE`はLane visibilityと同義と証明できるまで削除しない。現行`playbackScope=set`の選択集合・保存・range評価を監査する。CAF内部子行はCAF選択だけで自動展開せず、全体Lane概要から明示`Clip Focus`へ入り、breadcrumbで戻る表示policyを第一候補とする。SCOPEを別意味へ暗黙転用しない。
- Phase 9m Stage Aの一DOM static fixtureとfixed verifierを完了し、Gate 0=`GO — C first / D staged HOLD`とした。Stage Bは33%下限のCだけをproductionへ接続し、Browser 1280 / 420、header / Bottom zoom、grid F1→F2、Duration 1F→2F→1F、console 0件、全116 verifier / build / 生成物清掃を通過した。これはStage B時点の技術checkpointであり、後続のOwner visual follow-upで三行headerを未受入としたためcloseしない。Dの25% / major gridはFrame hit / wheel / move / retime / key gesture固定までHOLDし、SCOPE SET、History / saveは変更しない。Folder / CAF thumbnailは既存内容から導出する別の情報密度Gateとして保存bitmap / flagを増やさない。
- Phase 9m Owner playback follow-upは、Playback Endを`TIMELINE → LAST CLIP → OUT MARKER`の直接cycleへ変更し、OUT時だけI / Oを隣接展開した。F9–F18の非loop停止 / loop復帰 / Project round-tripを固定し、再生 / 停止はhitを維持したままvisible面と中央CSS glyphを小さく揃えた。左右同幅grid clusterでplayを中央列へ置き、I / Oをoverlayで分断せず、header / Bottom separatorをframelessへ下げた。全117 verifier / build / Browser、console 0件を通過。次GateはPREVIEW配置、Bottom zoom左右、Lane見出しSCOPEのdisplay-only focus、明示`Clip Focus`＋Dope Sheet / Motion Graph切替を一DOMで比較する。SCOPE SET、Lane visibility、ClipAsset / History / saveを暗黙統合せず、素材棚は既存Asset Libraryを拡張する。
- Owner visual follow-upで未受入だった三行headerは、760px / 762px境界のBrowser再現を経て620px compact境界、三列grid、trailing局所wrapへ限定修正した。Timeline / Lane stackを主面、header / Bottomを最小高の操作lens、Playを反転色とglyphで強調して専用行を作らない方針を維持する。Owner再確認後の別Sliceで、CAF選択時のFolder / BONE / Motion既定露出を`Clip Focus`へ分離する。
- 別Gateへ保留: 小utility統合、Auto Line実受理率 / 再生成History実測、Raster / Bake上限、CPU Skin / Raster profiling、Project-local Rig参照schema、GPU Skin、動画編集統合、AI自動化。
- 保留: Animation Table全面dock、常設Inspector、Callipeg式CLIP操作標準化、Simple / Expert二重UI、自由custom rail。固定fixtureで現行popup / Canvas-first shellより優位と確認できるまで採用しない。
- 棄却: 保存正本をWorkspace / UIへ複製する案、外部proposalを実コード照合なしでPhase契約にする案、`animation-table-popup.js`の一括分割。

2026-08-20のStage B後にClaudeReview 4本を再読した。UIレビューは主要項目が既に反映済み、file整理レビューは段階抽出だけ採用、PixiJS / resource診断は未計測仮説として維持する。2026-08-26には`gui-skin-redesign-revision-2026-08-25.md`と`color-philosophy-background-panel-icon-balance.md`を現行codeへ照合し、Layer Panelのtoken境界と「中心Panelは淡色、外周だけを統合比較」の順序を採用した。旧main snapshotの行番号やPhase状態は現行判断へ持ち込まない。

## 6. Phase化条件

- SOL / XHighが現行event、state、History、save / reload、Panel復帰を横断監査する。
- Gate前はproduction DOM / CSSを大幅変更しない。
- 一つの限定Sliceへ対象file、Acceptance Criteria、Browser fixtureが固定した場合だけLUNA / MAXへ委譲できる。
- Ownerすり合わせが必要なのは、Workspaceをpopup / dock / mode切替のどれとして見せるか、通常描画とRig制作をどの操作で往復するかである。保存schemaやsolverを先に増やして回答しない。
