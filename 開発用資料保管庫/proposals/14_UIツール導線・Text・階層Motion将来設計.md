# UIツール導線・Text・階層Motion将来設計

更新日: 2026-08-11

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

Phase 7bはRECT、Phase 7jはCIRCLE / drag式POLYまで既存Warp key / selection move / Historyへ接続した。Phase 7jはSOL review 1=`A`、Owner一括確認待ちでOPEN。soft weight、回転 / 拡縮handle、Mesh vertex選択、effect maskは未実装のまま維持する。

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

### UI密度の後続監査

- オーナーは現在Browser 80%表示を常用している。後続UI整理では、Browser 100%のままsidebar icon、Layer Panel、popup、文字、余白を現状80%相当の視覚密度へ縮小することを目標にする。
- `body`やapp全体への一括`transform: scale(0.8)`は採用しない。Canvas / pointer座標、popup配置、D&D hit test、devicePixelRatio境界を巻き込むため、component共通tokenとCSS変数で段階調整する。
- 視覚寸法と操作hit areaを分離する。pen / touch向け最小hit areaを確保したままiconと文字を縮小できる構造を優先する。
- sidebar、Layer Panel、Animation Table、QTP、各popup、status、tooltip、formの順に現行px値と文字倍率を監査し、Browser 100%、OS表示倍率、狭幅、pen / touchで比較する。
- Phase 6gの局所icon調整とは分離し、Phase 6hで固定入力監査、共通token、component単位のBrowser受入を行う。

### Animation Table / CLIP MOTION導線監査（現行Phase 7l）

- 2026-08-11の軽量監査では、Table既定高をLane一行分だけ拡張した。CLIP MOTIONは`RIG`をSetup青、`MOTION / WARP`のactiveを橙とし、WARP内でもGRID / RADIAL / 4×4作成とGRID / FRAME Bind編集だけを明るいSetup青へ統一した。POINT / SELECT / BRUSH、key、Bake等のFrame作業は橙系を維持する。
- 現行の大分類は`RIG → MOTION → WARP`、対象選択、mode固有設定、key操作の順で左から右に読めるため維持する。青は濃い全面塗りを避け、濃い青文字・borderと淡い青背景を第一候補とする。
- Phase 7lでは幅依存の偶発的な折返しをやめ、上段を`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`、下段を`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`の明示二段へ限定整理した。
- wrapperはruntime stateを持たず、既存ID / event / shortcut / History / model正本を維持する。header通常wheelのTimeline zoom、Lane列wheelの上下、Timeline grid wheelの左右、header空白dragも既存listenerを共有する。
- Browser 1280px相当ではpanel `960×266px`、viewport約202px、狭幅実操作では`460×266px`、row内wrap、controlはみ出し0件。実wheel `80% → 87%`、close / reopen、favicon取得を除くconsole warning / error 0件、全51 verifier、buildを通過した。
- Setup青 / Frame作業橙とTable高266pxは維持した。coarse pointer、制作Projectでのpopup重なり、pen / touchはOwner一括確認で継続監視し、明示受入前にPhase 7lをcloseしない。

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
- local font access / file import、再編集可能Text、CAF内Text、outline / shadow / vertical textはPhase 7kへ含めない。Owner一括確認前にcloseしない。

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
5. Deformer SELECTはPhase 7b / 7jでRECT / CIRCLE / POLYまで実装しOwner一括確認待ち。
6. Text to RasterはPhase 7kで通常Rasterへのone-shot確定まで実装しOwner一括確認待ち。次候補はMotion Graph / Motion Path以降から再選定する。

各UI Phaseは次を確認する。

- keyboard / mouse / pen / touch
- popup reopenと最後のtool復帰
- 狭幅とCanvas遮蔽
- hover / focus / disabled理由
- shortcutのinput / contenteditable除外
- Project / Historyへruntime UI stateを混ぜないこと
- Browser実操作とconsole error
