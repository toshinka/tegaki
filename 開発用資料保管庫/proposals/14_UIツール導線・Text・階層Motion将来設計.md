# UIツール導線・Text・階層Motion将来設計

更新日: 2026-08-24

## 位置づけ

- 本書はUI案の現行正本である。左sidebar / Quick Tool Panel再編だけはPhase 6gで着手し、変形選択、Text、CAF内部階層Motionは後続Phaseへ分ける。
- 各案はUIが近くても保存正本と検証範囲が異なるため、同じPhaseへまとめない。
- 既存のRaster、ClipAsset / DrawingSnapshot、ClipInstance Motion / WARP、Layer Transform、Historyを置換せず、それぞれの正本へ接続する。
- CAF Part、BONE、任意Mesh、Perform、Draw Order、Dynamicsのデータと評価順は`15_キャラクターRig・Mesh・Perform統合ロードマップ.md`を正本とする。本書は入口と画面構成だけを扱う。

## 1. 変形control pointの範囲選択

### 操作案

- WARPの`SELECT`入口はLucide `square-dashed`を主iconとする。選択shapeは`M`またはactive button再clickで`RECTANGLE -> CIRCLE -> POLYLINE`を巡回する。将来Meshへの転用は別Gateとする。
- Phase 7jの`POLYLINE`はpointer pathを2px間隔で間引くdrag式lassoとして実装した。clickで頂点追加しEnter / 始点clickで閉じるpolygon方式は、pen / touch一括確認でdrag式が不適合な場合だけPlan Bとして再検討する。
- 現行WARPでは`M`がBRUSH mode巡回に使われているため、shortcutはactive tool内で解決する。`SELECT`中のMはshape巡回、`BRUSH`中のMはMOVE / INFLATE / PINCH / SMOOTH巡回とし、通常描画やPixel Selectionへ漏らさない。
- rectangle / circle / polylineはcontrol pointのmulti-selectと一時weightを作るUIであり、WARPのeffect mask、Bind bounds、topology、Raster選択範囲にはしない。
- 選択shape、選択中point、soft weightはruntime UI stateとし、Project正本へ保存しない。確定gestureだけを既存`deformer.keyframes`のposeへ1 Historyで書く。

Phase 7bはRECT、Phase 7jはCIRCLE / drag式POLYまで既存Warp key / selection move / Historyへ接続した。Phase 7jはSOL review 1=`A`で2026-08-12にSOL技術closeし、Owner制作確認は別紙で追跡する。soft weight、回転 / 拡縮handle、Mesh vertex選択、effect maskは未実装のまま維持する。

### icon path候補

```html
<!-- square-dashed -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/></svg>

<!-- circle-dashed -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/></svg>

<!-- trending-down -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></svg>
```

## 2. 左sidebarとQuick Tool Panelの再編

- pen / eraser / airbrush / fill / selection等、Quick Tool Panel内と重複する常設iconを最終的にsidebarから外し、`Q`表記の単一buttonをQuick Tool Panel開閉入口にする。
- ただし一括削除は行わない。先にQ button、Q shortcut、現在tool表示、keyboard help、touch時の再表示導線を追加し、QTPが未初期化・画面外・閉状態でもtoolを失わないことを確認してから重複iconを段階削除する。
- Layer Transformは独立した破壊的Raster確定操作なので、QTP内の描画toolへ埋めず、sidebarへ専用iconを置く候補とする。既存V shortcut、panel、transform正本をそのまま呼び、新しいtransform stateを持たせない。
- Text入口は下記Text Phaseの初期実装ではQTP候補とする。使用頻度とpen導線を実測し、常設T iconが必要な場合だけsidebarへ昇格する。

### モダンUIの第一候補と代替

Plan AはCanvas優先の細いrailとcontextual panelである。

- sidebarにはLibrary / import / resize等の大分類、QTP用Q、Layer Transform、Animation Table、Settings等の入口だけを残す。
- pen / eraser / airbrush / fill / selection等の高頻度描画toolはQTPへまとめる。
- 選択toolのoptionはCanvas上部または近接するContextual Inspectorへ出し、全toolの設定を同時常設しない。
- desktopはhover説明とshortcut、touchは長押し説明と十分なhit areaを持つ。
- 狭幅ではQTPをsidebar横popupではなくbottom sheetへ切り替えられる構造にする。

Plan Bは「QTP集約後も常用toolだけsidebarへ残す」方式である。次の場合に採用する。

- QTPを開く1操作がpen / eraser往復で明確な負担になる。
- touchでQTPがCanvasを隠す。
- toolの現在状態がQ buttonだけでは判別しにくい。
- 初心者が基本toolを発見できない。

Plan Cのユーザー自由カスタムrailは、Plan A / Bの実制作検証後まで導入しない。並び順保存、旧設定、touch編集、reset UIという新しい責務が増えるためである。

Q buttonは現在toolのiconまたは小さなstatus indicatorを併記できる余地を残す。常時文字Qだけで分かりにくい場合のPlan Bであり、別のtool正本は作らない。

### QTP Painter's Palette / Surface Gate（Phase 8l）

- QTPは通常描画の`Painter's Palette`、sidebarはLibrary / import / resize / Animation Table / Settings等の大分類・管理・recovery入口とする。両方へ描画toolを重複常設しない。
- visual iconとinteractive hit areaを分離する。通常controlは透明または弱いsurface、hover / active / focus時だけ明確な面差・境界を出し、clickabilityを失わない。
- `quick-access-position`の自由位置保存を維持し、Preset配置は既存x / yを明示座標へ揃える補助として後続比較する。Project schemaや第二position正本を作らない。
- QTP FULL / COMPACT / HIDDEN、左右上下Preset、borderless / restrained-depthは同時実装しない。まずsemantic token bridge、次にQTP一箇所のvisual prototype、Owner受入後に配置・densityの順で開く。
- 比較は1280×720 / 720×720、Browser 100%、明暗art、mouse / pen / coarse pointer、Q close / reopen、current tool、shortcut `Q`、Canvas遮蔽、到達段数、復帰costを固定する。
- Concepts / Procreate / Callipeg / Fresco / CSP Simple / ToonSquidは外観模倣でなく、movable palette、身体到達性、animation ergonomics、Canvas中心、初心者継続、高機能progressive disclosureの役割別fixtureとして参照する。
- Phase 8l Stage CではCurrent / borderless / restrained-depthを同一fixtureで比較し、完全borderlessは淡いCanvasでpopup境界が消えるため棄却した。QTP外殻だけへ弱い境界・gradient・shadowを残し、通常tool cellは低刺激、hover / activeで面を出すrestrained-depthを採用した。sidebarは現行railを維持した。
- Phase 8vはPreset / densityのうちPosition Presetだけを独立Gate化し、Gate 1=`GO — B`で技術closeした。headerの四隅deckを既存自由drag、共有viewport clamp、保存x / yへ限定接続し、Preset ID、利き手flag、Dock / edge snapを追加しなかった。全97 verifier / build / Browser、SOL final review=`A`を通過した。
- Phase 8wは残したQTP全体densityだけを独立比較し、Gate 1=`GO — B`を選定した。Pen / Eraser / Airbrushの6 preset直接性を維持し、Preset非対応toolだけsectionをruntime退避した。Position deck、Text utility、保存正本を変えず全98 verifier / build / Browser、生成物清掃、SOL final review=`A`で技術closeした。
- Phase 8xはshortcut learningを独立Gateとし、Settingsのstatic listを全global actionのcanonical projectionへ置き換え、QTP Pen一controlへ平常密度を増やさないhintを接続した。Phase 8yは同じcanonical patternをQTP内7 toolへ展開し、全99 verifier / build / Browser、SOL final review=`A`で技術closeした。
- Phase 8zはtouch到達性を別Gateとした。QTP toolは`pointerdown`で即時実行するためlong pressは通常tap遅延または意図しないtool変更となり棄却した。headerの明示`?`からread-only 7-tool shortcut deckを開き、198px viewport clamp、coarse 24px hit、deck内drag遮断を実装した。通常tap、Canvas gesture、保存state、component-local commandは変更せず、全100 verifier / build / Browser、SOL final review=`A`で技術closeした。Owner制作確認は台帳へ分離する。

### UI密度の後続監査

- オーナーは現在Browser 80%表示を常用している。後続UI整理では、Browser 100%のままsidebar icon、Layer Panel、popup、文字、余白を現状80%相当の視覚密度へ縮小することを目標にする。
- `body`やapp全体への一括`transform: scale(0.8)`は採用しない。Canvas / pointer座標、popup配置、D&D hit test、devicePixelRatio境界を巻き込むため、component共通tokenとCSS変数で段階調整する。
- 視覚寸法と操作hit areaを分離する。pen / touch向け最小hit areaを確保したままiconと文字を縮小できる構造を優先する。
- sidebar、Layer Panel、Animation Table、QTP、各popup、status、tooltip、formの順に現行px値と文字倍率を監査し、Browser 100%、OS表示倍率、狭幅、pen / touchで比較する。
- Phase 6gの局所icon調整とは分離し、Phase 6hで固定入力監査、共通token、component単位のBrowser受入を行う。

### Animation Table / CLIP MOTION導線監査（Phase 7l完了）

- 2026-08-11の軽量監査では、Table既定高をLane一行分だけ拡張した。CLIP MOTIONは`RIG`をSetup青、`MOTION / WARP`のactiveを橙とし、WARP内でもGRID / RADIAL / 4×4作成とGRID / FRAME Bind編集だけを明るいSetup青へ統一した。POINT / SELECT / BRUSH、key、Bake等のFrame作業は橙系を維持する。
- 現行の大分類は`RIG → MOTION → WARP`、対象選択、mode固有設定、key操作の順で左から右に読めるため維持する。青は濃い全面塗りを避け、濃い青文字・borderと淡い青背景を第一候補とする。
- Phase 7lでは幅依存の偶発的な折返しをやめ、上段を`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`、下段を`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`の明示二段へ限定整理した。
- wrapperはruntime stateを持たず、既存ID / event / shortcut / History / model正本を維持する。header通常wheelのTimeline zoom、Lane列wheelの上下、Timeline grid wheelの左右キー相当Frame±1、header空白dragも既存listenerを共有する。Timeline gridの横位置調整はSpace + dragを使う。
- Browser 1280px相当ではpanel `960×266px`、viewport約202px、狭幅実操作では`460×266px`、row内wrap、controlはみ出し0件。実wheel `80% → 87%`、close / reopen、favicon取得を除くconsole warning / error 0件、全51 verifier、buildを通過した。
- Setup青 / Frame作業橙とTable高266pxは維持した。Phase 7lは2026-08-12にSOL技術closeし、coarse pointer、制作Projectでのpopup重なり、pen / touchはOwner確認台帳で継続監視する。

### Animation Table Progressive Exposure Gate（Phase 8m）

Phase 7lの二段headerは機能順序とwheel領域を固定する仮設であり、最終的な情報露出量を確定したものではない。SCOPE、LOOP、END、IN / OUT、Clip copy / paste / group / deleteが常時横一列に見えるため、初見では「全てを今理解する必要がある」ように見える。機能自体を削らず、次の三層へ分ける。

1. **Glance layer**: 現在SCOPE、LOOP状態、PREVIEW、onion、Playなど、再生前に状態を即読できる最小表示。
2. **Choice layer**: SCOPE三択、終端基準、IN / OUT等、押した時だけ比較する設定。現在値buttonからanchored popoverを開く。
3. **Context action layer**: Clipのcopy / duplicate / group / delete等。Clip選択時だけAction Panelを出し、対象との因果を空間的に示す。

SCOPEは`ALL / LANE / SET`を順送りするbuttonだけにはしない。三状態を覚えないと目的値へ到達できず、現在値以外を比較できないためである。第一案は`SCOPE: ALL ▾`の一buttonを残し、click / Enterで三候補と一行説明を持つanchored popoverを開く。Owner提案の「大きい選択肢をこちらから届ける」Focus Deckは、通常のmenu semantics、Escape、矢印key、外側click close、pointer targetを維持した上で、選択肢の面積と説明量だけを通常menuより強める比較案とする。全面modalや不均一な意味順にはしない。

LOOPは再生結果へ直結し現在状態を常時知る価値が高いため、単独toggleをGlance layerへ残す。詳細modeや範囲はchevron / hold / secondary popoverへ送れる。ENDとIN / OUTはTimeline上のmarker表示と組み合わせ、再生範囲buttonからChoice layerへまとめる案を比較する。markerを隠したり、holdだけを唯一の入口にしない。

Clip actionは選択時だけ上部または選択Clip近傍へAction Panelを出す案を第一候補とする。Callipegはsheet / clip選択時にTimeline上部へ内容依存Action Panelを出し、Adobe Frescoは選択frameをtapするとduplicate / copy / deleteを表示する。ToonSquidも選択Drawingへretiming handleを出し、timeline toolbarとtap / holdの追加操作を併用する。Tegakiでは既にClip本体pointerdownが移動、左右端がretiming、Ctrl / Cmdが複数選択の正本なので、long pressを主入口へ直結するとpen移動と競合する。右click / long pressは将来の補助入口とし、最初は通常選択でAction Panelが現れる形を比較する。

Pasteは選択Clipへ従属しない場合があるため、Action Panelへ完全吸収しない。keyboard paste、空cellのsecondary action、または現在Frameのclipboard affordanceを最低一つ維持する。Top barのcopy / paste / deleteを消すのは、mouse / pen / touch / keyboardで同じactionへ到達でき、selection解除時とTable再open後の復帰をBrowser固定fixtureで確認した後だけとする。

実装順:

1. 現行state / event / Historyを変えない静的wireframeで`現行 / compact current-state / Focus Deck`を比較する。
2. SCOPE一button＋anchored popoverだけを限定実装し、既存三button IDまたは同一setterへのadapterを維持する。
3. Clip選択Action Panelを別Sliceで追加し、move / retime / multi-selectの3px threshold、pointercancel、pen / touchを固定する。
4. Owner受入後だけ旧top bar actionの常時露出を段階的に減らす。長押し専用、全面header再構築、保存state追加は行わない。

2026-08-22のPhase 8m Stage B / Cでは、同一fixtureの1280×720 / 720×720比較でFocus Deckを選び、SCOPEだけをproductionへ限定接続した。閉状態は現在値一button、開状態は既存三ID / `playbackScope` setterを使う`menuitemradio`三択とし、Arrow / Home / End、Enter / Space、Escape / Tab、再click / focusout / outside pointer close、History 0を固定した。全88 verifier / build / Browser / console 0件、SOL final review=`A`で技術closeした。Owner制作確認は台帳へ分離し、実装順3のClip Action Panel、Playback Range Choice、long press補助は本Sliceへ混ぜていない。

### Playback Glance icon / marker semantics（Phase 8n）

- SCOPEのMonitorはcategory iconであり、`ALL / LANE / SET`現在値の代替にしない。閉状態の第一案は`Monitor＋現在値＋chevron`で、Phase 8mのFocus DeckをChoice layerとして維持する。
- LOOPのRepeat / Repeat Offは形状差を増やす補助として採用可能。active surface、状態title、`aria-pressed`を併用し、斜線または色だけへ依存しない。
- `I / O` chipはTimeline range markerの省スペース表現として比較する。IN / OUT文字、左右位置、title / aria-label、active状態を併用し、palette外の白を直書きしない。
- onionは現状「前後N」の単一設定で、過去 / 未来を独立操作する保存正本を持たない。青 / 橙の過去未来squareをrange marker色へ流用せず、別設定を導入するPhaseまでvisual proposalとして保留する。
- Gate 1は`GO — B: icon＋現在値のHybrid semantic compact`。icon / color only案を棄却し、Monitor＋現在SCOPE、Repeat / Repeat Off、`I / O` marker chip、ghost＋countをproductionへ限定接続した。1280×720 / 720×720、keyboard、Loop / marker / onion実操作、全89 verifier / build、SOL final review=`A`でPhase 8nを技術closeした。Owner制作確認は台帳へ分離する。

公式比較資料:

- Callipeg Timeline: https://callipeg.com/learn-timeline/
- Adobe Fresco animation timeline: https://helpx.adobe.com/uk/fresco/using/apply-motion-to-artwork.html
- ToonSquid Timeline: https://toonsquid.com/handbook/interface/timeline/

### Selected Clip Context Action Gate（Phase 8o）

- 第一比較案は通常選択後だけCopy / Group / Deleteをheaderまたは選択Clip近傍へ出すAction Panel。対象未選択時のContext actionをGlance layerから外す一方、既存top barはGate中に削除しない。
- Pasteは選択Clipへ完全従属しないため、clipboardあり＋current Frame / empty cellから到達できる入口を別に維持する。
- long pressはClip move / retime / pen gestureと競合するため唯一の入口にしない。通常選択Action Panelが成立した後の補助候補に限定する。
- 最初は`selectedCelId / selectedCelIds`、group、既存四button、History、shortcut、3px move threshold、pointercancelをread-only監査し、1280×720 / 720×720の静的三案比較から始める。

Gate 1は`GO — B: header内Selected Clip Action strip`。選択中だけ対象名 / Frameまたは選択数とCopy / Group / Delete Clipを投影し、PasteとLane deleteは別context、旧button / handlerは互換入口として維持した。Clip DOM、retime、Ctrl / Cmd multi-select、4px超move threshold、clipboard / History / saveを変更せず、全90 verifier / build / Browser、SOL final review=`A`でPhase 8oを技術closeした。Owner制作確認は台帳へ分離する。

### Playback Range Choice Gate（Phase 8p）

- 保存正本は既存`TimelineModel.playback.endMode / inFrame / outFrame`。`getPlaybackRange()`、scope別Last Clip、`clampPlaybackSettings()`、既存Historyを変更しない。
- Phase 8pでは閉状態で終端sourceとIN / OUT設定値を要約し、開状態でTimeline / Last Clip / OUT marker三択とcurrent Frameへのmarker設定を比較できる`RANGE summary＋anchored Focus Deck`を採用した。Phase 8sではOwner制作所見を受け、略号`C`を全称`LAST CLIP`へ、I / Oを閉状態の同一outlined groupへ直接投影する。
- IN / OUTを完全に隠さず、icon / colorだけにも依存しない。未設定OUTで`out-marker`を選んだ状態を誤読しない文言とARIAを持つ。
- Timeline上の直接range handleはFrame seek / Clip move / retimeとのhit authorityと新gestureを要するためPhase 8pの最初のSliceから外す。Loop / SCOPE / onionも同時変更しない。
- Gate 1=`GO — B`。閉状態は`C / L / O · I… O…` summary、開状態はTimeline / Last Clip / OUT markerとIN / OUT設定を同一Focus Deckへ置いた。既存Playback正本 / History / range計算、Loop / SCOPE / onion、Timeline gestureを維持し、OUT未設定警告、keyboard / outside close、narrowを含む全91 verifier / build / Browser、SOL final review=`A`でPhase 8pを技術closeした。Timeline直接handleは別Gateへ残す。
- Phase 8s Gate 1=`GO — B: full end label＋inline I / O`。Repeat隣を`LAST CLIP ▾ | I— | O—`のSetup群とし、終端sourceは三値とも全称、I / Oは現在Frameへの設定・同Frame解除を既存setterへ直接接続した。Focus Deckは三終端比較だけを維持し、全94 verifier / build / Browser、SOL final review=`A`で技術closeした。
- Phase 8t Gate 1=`GO — B`として、常設`DURATION:`を単一かつ非Grouped ClipのSelected Clip Action strip内`- / <n>F / +`へ限定移設した。Clip edge drag、retime / History / 隣接push、LIB独立入口を維持し、全95 verifier / build / Browser、SOL final review=`A`で技術closeした。
- Phase 8u Gate 1=`GO — B: Asset iconのcompact直接入口`。残した`LIB`を既存共通Asset Library iconへ置き換え、tooltip / aria-label / 開状態と一操作到達を維持した。Asset Library内容 / ClipAsset正本を変えず、全96 verifier / build / Browser、SOL final review=`A`で技術closeした。

### Pixel Selection / CAF状態共通化（後続候補）

- 通常Layer、Animation Table表示中のCAF working Layer、CAF選択を維持したTable close後の3状態を同じ固定入力matrixで比較する。Popup visibilityを選択可否、座標変換、保存、Historyの正本にしない。
- 正本は`PixelSelectionSystem.toolActive / state / transformSession`、CAF側は`selectedCelId`とClipAssetに対応するworking Layer adapterである。status、QTP、sidebar active表示はこの状態から派生させ、逆向きに状態を復元しない。
- Phase 6hでは、Table close後の矩形overlay欠落だけを、選択中Clipとworking Layerの既存対応を返すpredicateへ接続して修正した。確定時の追加の下ずれは固定入力で再現せず、preview / confirm / close後の位置は一致した。
- 後続リファクタリングを開く場合は、tool表示resolver、CAF編集context resolver、preview停止 / 復帰、selection event購読を監査し、共通化できる判定と座標変換だけを小さいhelperへ集約する。主要class再構成や一括DOM置換は行わない。
- 各関連fileのheaderへ、Popup開閉非依存、working Layerはadapter、selection boundsはProject / Layer座標のどちらか、確定時だけ既存Historyへ書く、という注意を残す。
- 次のRig Gate 0を止める条件は、同じ固定入力でRasterまたはDrawingSnapshotの確定位置がpreviewと不一致になる、Undo / Redoで位置が変わる、保存 / 再openで座標が変わる場合に限定する。表示上の低頻度不整合だけなら再現手順を保持して後続UI品質Phaseへ回す。

## 3. PC優先Text

### 段階案

1. 最初はTextを指定fontでRaster Layerへ確定する`Text to Raster`とし、Project / PSD / export / Historyが現在のRaster契約だけで完結する入口を作る。
2. 再編集可能Text Layerは別Phaseとする。`content / font identity / size / alignment / line spacing / transform`のschema、font欠損fallback、Project round-trip、PSD互換を先に決める。
3. Text Layerを導入する場合もCanvas表示・export用raster cacheは派生物とし、文字列とstyleの二重正本を作らない。

### local font境界

- Web appから`C:\Windows\Fonts`をpath走査する実装にはしない。desktop Chromiumで利用できる場合は、明示clickと権限許可を伴う`window.queryLocalFonts()`でfamily / fullName / PostScript名を列挙する。
- API非対応、権限拒否、mobileではbundled font / generic familyとfont file明示importへfallbackする。font file bytesは容量とlicenseの問題があるためProjectへ既定埋め込みしない。
- local fontの存在を保存の前提にせず、Raster確定結果は再open時にも同じpixelを保つ。編集可能Text Layerでは使用font名とfallback状態を明示する。
- 参考: [Local Font Access API draft](https://wicg.github.io/local-font-access/)、[Chrome for Developers: Local Font Access](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts)

### Phase 7k実装状態

- 初版はQTPの既存6-tool gridを維持し、その下へone-shot `T / TEXT TO RASTER`と小さい入力panelを追加した。active drawing tool、sidebar常設icon、新しいshortcutにはしていない。
- generic Sans / Serif / Mono、8〜256px、bold、現在のmain color、日本語 / ASCII / 複数行だけを受け、確定後は文字列 / optionを保存しない。通常Raster pixelが唯一の正本である。
- viewport中心を既存CameraでProject座標へ戻し、tight raster boundsの新規通常LayerへLayer作成 + pixelを1 Historyで確定する。Animation Tableのworking Layerでは理由付き拒否する。
- local font access / file import、再編集可能Text、CAF内Text、outline / shadow / vertical textはPhase 7kへ含めない。Phase 7kは2026-08-12にSOL技術closeし、Owner制作確認は別紙で追跡する。

### Text入口 / panel再設計Gate（Owner feedback 2026-08-22）

- 現行のfull-width `T / TEXT TO RASTER`はPhase 7kのone-shot入口を明示する仮設であり、使用頻度に対して常時占有が大きい。active drawing toolではないため、現時点で既存6-tool gridへ通常toolとして混ぜない。
- 第一比較案は、`6-tool grid → pen slots → SIZE / OPACITY`の連続性を維持し、その後へ小型の`T` SVG launcherを置く形とする。押すとText panelを開き、確定後は元のdrawing contextへ戻る。Text / 吹き出しがCanvas上で継続編集するpersistent modeへ発展した場合だけ、通常tool gridまたは専用slotへの昇格を再評価する。
- 現行panelのFONT / SIZE labelは狭い幅で重なって見える。次のvisual redesignでは単一列または明示した二段rowへ分け、font family selectorの横に将来の`SYSTEM FONTS` / file import affordanceを置ける余白を確保する。現在のproduction DOMをこのメモだけで変更しない。
- 縦書きは単純なCSS `writing-mode`追加ではなく、Canvas2D raster確定器の別Gateとする。horizontal / vertical mode、日本語句読点・括弧の向き、Latin回転、縦中横、行送り、tight bounds、History / Project / export一致を固定してから実装する。
- Windows登録fontは既存方針どおり明示操作＋権限付き`window.queryLocalFonts()`を第一候補とし、path走査しない。非対応 / 拒否時のbundled / generic / file import fallbackと、選択中font・fallback状態をpanel内で読めることをAcceptance Criteriaに含める。

Phase 8qはこの入口を独立Gateとして技術closeした。`6-tool grid → pen slots → SIZE → OPACITY → compact T / TEXT utility`を採用し、persistent drawing toolの列へ混ぜず、open stateだけをsemantic active surface / ARIAで示す。既存Text Raster service、DOM ID / handler、Ctrl / Cmd+Enter、通常Raster Layer＋1 Historyを維持し、FONTとSIZE / BOLD / current colorを二段fieldへした。全92 verifier / build / Browser、SOL final review=`A`を通過した。vertical text、local font、再編集可能Text、QTP全体densityは未実装の別Gateである。

### QTP Pen Preset / Density Gate（Phase 8r）

- Pen / Eraser / Airbrush別6 presetのtool別active slot、SIZE / OPACITY同期、adjacent循環、localStorageを正本として固定し、現行6値同時露出、6 size ring＋active / focus summary、3×2 larger cardを136px / coarse 170pxで比較した。Gate 1は`GO — B`。
- LUNA限定Sliceでは6 slotを番号＋size ringへ圧縮し、activeのsize / opacityを既存`qa-preset-status`へ集約した。非active slotはkeyboard focus時だけ同じsummaryへpreviewし、blurでactiveへ戻る。opacity値DOM、既存click / setter / storage、非対応tool disabledを維持し、QTP全体position / density、Text、COLOR、brush engineへ広げない。
- `verify-qtp-preset-density.mjs`、既存Text verifier、全93 verifier / build / Browserでcompact高さ、slot切替、SIZE / OPACITY同期、Fill disabled、focus preview / blur復帰、console error / warning 0件を確認した。SOL final review=`A`で技術closeし、Owner制作確認は台帳へ分離した。Preset位置、long press / Focus Deck化、brush parameter再設計は別Gateへ残す。

### Animation Table / QTP visual hierarchy follow-up（Owner feedback 2026-08-24）

- Animation Tableの再生 / 停止を視覚中央の第一actionとするconceptは維持する。Phase 9eでは専用一行を廃止し、DOMを変えずCSS order＋左右auto marginで第一header row内へ戻した。Phase 9fのOwner follow-upで通常28×24px / coarse 44×38px、maroon fill＋Futaba background抜き、playing橙を確定した。
- Phase 9fはinactive controlを文字 / icon＋淡いsurface、hover / active / focusでborderという三段へ限定整理した。header全面dark化はCanvas・Clip・Setup青・警告との競争が増すためHOLD。Selected Clip / Delete / closeはcontextual / destructive境界としてflat化しない。次はQTP一componentでPalette swatch / tool / presetへ同じ考えをそのまま当てず、現在色・現在tool・現在presetの識別をfixture比較する。
- Phase 9gはQTP Palette color / tool / preset cellへ、transparent resting border、cream色の薄い内側contrast、selected橙ring、focus-visible橙outlineを限定適用した。Main / Sub swatch、slider、Text / Help / Position、pressure、preset schemaは維持した。次はSidebar rail一componentで、utility / mode入口の役割差とpopup close後active同期を先に監査してから同じ三段を比較する。
- Phase 9hはSidebar railでGate 0=`GO — B: Quiet Resting＋Hover Surface＋Active Ring`を採用し、resting borderをtransparentへ下げ、hover / focus / active / disabledをsemantic surfaceへ限定した。30 / 38px hitと既存tool順を維持し、static appearanceをcomponent CSSへ一正本化した。監査で再現したAnimation Table内部×後のA stale active、Q / Vだけbutton＋ARIAである差はPhase 9iのrole / close sync Gateへ分離し、CSSの疑似activeで隠さない。
- SCOPEは`ALL / LANE`だけへ減らす案があるが、現行`SET`は「目の表示」と同義ではない可能性がある。`playbackScope=set`の選択集合・保存・range評価を監査し、完全同義を証明できるまで削除しない。LOOPの一押し切替は既存toggleと整合する。
- Range sourceは現在値を常時読めるまま、`OUT MARKER`選択時だけI / O設定を展開する案を比較する。keyboard `I / O`、Timeline marker、未設定警告、既存保存正本を隠さない。Timeline zoomのfooter移動は、header / Lane / gridの三領域wheel契約とpen操作入口を維持できる別Gateとする。
- QTP color swatchはsolidでborderless寄りにできるが、選択 / focus /淡色swatchの識別をringまたはsurfaceで残す。Pen presetの左上番号を外す案も、keyboard順・6 slot識別・active summaryを同一fixtureで比較してから行う。
- Pen / Eraserの筆圧ON / OFFはFill modifierの見た目だけを流用せず、現行Brush settings / preset保存shape / shortcut / disabled理由を監査する独立Gateとする。小さい線形toggleを広いsquare hitへする案はvisualとhitboxを分離して評価する。
- Text utilityは左端`T`＋横書き / 縦書き切替を将来候補とする。縦書きはlauncher skinではなくRaster確定器、句読点・Latin回転・縦中横・bounds・History / exportまでを含む別Phaseであり、Phase 9dへ混ぜない。
- 公式比較の採用点は外観模倣ではない。CallipegはTimelineをCanvas確保のため隠せ、選択中sheet / clipへAction Panelを出す。CLIP STUDIO Simple ModeはCanvas面積と直接操作を優先する。Tegakiではこの二点を`主要actionの常時直接性`と`低頻度 / context actionの段階露出`へ翻訳する。

## 4. CAF内部Folderの階層Motion

データ所有、BONE、Mesh、Perform、Draw Order、Dynamicsの詳細は`15_キャラクターRig・Mesh・Perform統合ロードマップ.md`へ統合した。本節は最初のUI投影だけを定める。

### 正本境界

- CAF内部Folderへ`TimelineModel`を再帰的に持たせる「mini CAF」は採用しない。再生範囲、Frame、History、export評価器が階層ごとに分裂するためである。
- 共有素材である`ClipAsset`側には、動かせる内部Folder / partのID、親子関係、rest transform等のrig定義だけを置く。
- 各配置である`ClipInstance`側には、内部part ID別のtransform keyを置く。同じClipAssetを複数Laneへ配置しても、各ClipInstanceの演技を独立させる。
- CAF内部Folderの通常opacity / blend / clipping / z-order正本は維持する。Motion親子順と表示順を同一視しない。

### UI案

- Animation TableのLaneは親CAF行を開閉し、選択Clipの内部Motion partだけを子行として投影する。子行は新しいCAFや独立Laneではなく、同じClipInstance内trackの編集UIとする。
- 通常Folderへ`Motion part`属性を明示付与する方式を第一候補とし、別種類のFolderを増やさない。属性を外してもRaster階層は失わず、Motion trackの保持／削除を確認する。
- 親Folder Motionは子・孫の評価済みtransformへ継承する。循環禁止DAG、親欠損時、channel別inherit、anchor / rest poseを明示し、暗黙にLane縦順へ依存しない。

第一候補はAnimation Tableの親CAF行を開閉し、Part trackを子行として表示する方式。小規模RigでMotion keyと構造を同じ場所に見せやすい。

Plan Bは専用Rig Inspector / treeへ構造編集を分離し、Timelineには選択trackだけを表示する方式。子行が増えてTimelineが狭くなる、SetupとAnimateが混同される、BONE / Weight / Collider設定が行内に収まらない場合に切り替える。どちらも同じ正本から投影し、UI方式をProject schemaへ保存しない。

### 導入順

1. 1 CAF内の親Folder -> 子Folderのposition / scale / rotation継承だけをpreview / playback / Bake / exportで一致させる。
2. 子行の開閉、選択、key、Undo / Redo、Project / CAF copyを接続する。
3. 明示constraintと少数Boneを追加し、BoneからWARP / Mesh control pointへのweightを別gateで扱う。
4. gravity / spring等のphysicsは決定的parameter trackとして評価し、確定時にkeyへBakeできるようにする。
5. 親子間の表示階層変更はMotion transformと分離し、既存Folder D&D・clipping・上側前面契約を壊さない独立操作として監査する。

## 5. Phase順と受入gate

1. Phase 6gでQTP開閉、sidebar段階縮小、Layer Transform入口を完了した。
2. Phase 6hでBrowser 100%のUI密度を従来80%相当へ段階調整する。
3. Phase 6h後は`15`のGate 0を独立して行い、CAF内部Part / Folderの所有とAnimation Table子行投影を固定する。
4. 階層Motionは親子Part transformだけを独立Phase化し、その後に少数BONEのrigid FKへ進む。BONE Skinning / weight / physicsを同時実装しない。
5. Deformer SELECTはPhase 7b / 7jでRECT / CIRCLE / POLYまで実装し、Phase 7jをSOL技術closeした。
6. Text to RasterはPhase 7kで通常Rasterへのone-shot確定まで実装し、SOL技術closeした。次候補はMotion / Mesh系列から再選定する。

各UI Phaseは次を確認する。

- keyboard / mouse / pen / touch
- popup reopenと最後のtool復帰
- 狭幅とCanvas遮蔽
- hover / focus / disabled理由
- shortcutのinput / contenteditable除外
- Project / Historyへruntime UI stateを混ぜないこと
- Browser実操作とconsole error
