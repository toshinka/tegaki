# WP-030 — 漫画ツールの後続整理

状態: ACTIVE。Owner指示: 2026-10-04、残った候補を実装しやすい順に構成して順に開始。最終制作受入とpushはOwner。

## Goal

漫画制作の操作を小さくまとまったGUIへ整える。既存の通常Raster・再編集recipe・History・font libraryを維持し、保留候補を依存順に進める。

## Sequence

| 順 | 範囲 | 理由・検証 |
|---|---|---|
| 1 | フォント比較の情報・整理へ管理を集約 | 既存font library/比較を再利用。分類・取り込みを一元化。狭幅、再読込、既存文字/吹き出しとの同期。画面右下入口案はOwner訂正で撤去 |
| 2 | 吹き出しのcompact GUI、輪郭点編集、二連本体 | Canvas直接操作を主にする。本体別文字領域、旧recipeの無変更、結合境界、Project/Historyを固定してから実装 |
| 3 | 複数しっぽ、曲線／折れ／丸列、離れた本体のつなぎ | 本体/しっぽを独立選択。回転・移動・根元追従、重複線と文字領域を確認 |
| 4 | コマ・集中線の目的別groupと常設確定 | 成熟したUIを流用。各tool固有のpreview/操作・保存を保持 |
| 5 | 文字別の局所9点編集 | 全体9点の操作を局所座標へ適用。既存grapheme属性/recipeを維持し、他文字への影響なし |
| 6 | 追加フォント監査・取得 | 既存監査/OCRを再利用。場面別、MV、手書きの多様性を優先。上位のみEへ取得し実体/許諾/字形を照合 |

将来の自由手描き輪郭、形の個人preset、コマ外clipは候補として保持する。全将来機能を最初のSliceへ混ぜない。

## Current slice — 図形の線/内側色・多角形・Canvas集中線

### Owner follow-up — 図形の線/内側色・多角形・Canvas集中線（2026-10-05）

Ownerが調査後の実装を指示。クリスタ公式の線/塗り別設定とMediBang公式の多角形/選択境界からの吹き出しを参照し、閉領域の入力とpaintを共用する。参考: [線・塗り](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/は行.htm)、[選択境界の描画](https://medibangpaint.com/use/2019/08/speech-bubble/)。

確定Slice: QTP図形で空くpreset領域を内側色へ使用。旧欠損設定は四角/楕円=線のみ、投げ縄=旧単色塗りを保持。明示paintは線のみ/線と同色/自由色（初期Canvas Background色、黒0も有効）。線幅はQTP SIZE。不透明度は塗りと線を合わせた結果へ一回だけ。閉じた領域はSVG previewと確定で同じcontour/線polygonを使い、既存選択mask/通常Raster/一History/Projectを保持。自己交差塗りはeven-odd、多角形点は有限・最大256、手描き投げ縄は有限な採取点列を保持し、作品へ編集点を新保存しない。新多角形は点click追加、既存点drag、始点click/Enter確定、Backspace末尾取消、Esc破棄、Shift45度補助。途中previewは画素/Historyへ書かず、3点未満は確定しない。既存Space Camera/global Transformを優先。

worker SHAPE_WRITE: `system/shape-tool.js`、`system/selection-area-tools.js`、`system/pixel-selection-system.js`、`system/drawing/fill-tool.js`、new `system/polygon-shape-tool.js`/`system/closed-shape-paint.js`、限定pure verifier。既存shapeの確定時CPU compositorを共用し、live pen strokeへCanvas2Dを混入しない。QTP UI/slots/CSS/共通icon・docsはleadのみ。

worker FOCUS_WRITE: `ui/balloon-popup.js`（明示あり/なしのみ）、`ui/focus-lines-popup.js`/`ui/focus-lines-overlay.js`、`system/focus-lines.js`/`system/focus-lines-raster.js`、new集中線CSSと限定verifier。集中線の小preview/overlay OFF UIを外し、Canvas常時表示と共通glass密度/目的別context/固定footer。既存params/旧放射polygon評価は保持。ウニの閉輪郭はoptional `body={kind:'outline'|'ring',lineWidth,fillColor:null|hex,inset}` のv1 recipe（欠損時旧出力）。閉輪郭は角度順の谷/先端点と有界jitter、ringは同じ輪郭の中心縮小で入れ子を保ち中心を透明にする。outlineは背景色の初期塗り/透明切替、線幅と色を編集。SVG/PNGは同じpure contourを使用。放射/枠/二重枠(中抜き)を明示、outline/ringで本数を256以内、手動drawn領域はCanvas寸法へclip。旧rayの機能/Project/再編集/Undoを保持。本文は既存文字ツールを重ねる入口、本文統合や新Layer schemaは今回なし。

lead WRITE: QTP UI/slots/icons/CSS、新Browser fixture、関連verifier/harness/当Card/STATUS。他担当の一般Raster保存block/WP033/RIGはread-only。workerは同checkoutに他担当がいるため既存差分を戻さず、担当外のfileを変更しない。報告だけでcloseせずleadが実Browser・保存画素/Undo・1280/360px・関連test/buildを監査。最終制作受入/pushはOwner。ネーム/AI配置/部品union/ベクターレイヤーは今回対象外。

### 図形paint・Canvas集中線の結果（2026-10-05）

TECHNICAL COMPLETE / OWNER REVIEW。吹き出しの選択中しっぽへ明示「あり/なし」。QTP図形の空く筆preset棚に線のみ/同色/自由色とCanvas背景色への追従を配置し、ペンへ戻ると従来6スロットを復帰する。矩形/楕円/多角形と明示paintの投げ縄は、共通 `closed-shape-paint.js` で線と塗りを合成してからopacityを一回だけ適用する。選択maskと通常Raster/既存Historyを使用し、拡張前snapshotを保持、描けない場合の空拡張もrollbackする。新多角形は最大256点、点追加/移動/始点またはEnter確定/Backspace/Esc/Shift45度。手描き投げ縄は採取済みの有限点列を保持し、256点で切らない。欠損/legacy投げ縄は旧GPU塗りを保持。

集中線はCanvas常設へ移し、小previewとoverlay OFF UIを撤去。共通glass、形/線・配置・ばらつきcontext、固定footerと数値wheel。旧5preset/放射方向/再編集を維持。optional v1 bodyの外枠/二重枠は谷と先端の交互点（最大256本）をseedから生成し、ringは同じ輪郭を中心縮小して透明な中央を作る。枠線の幅・色・内側塗りを編集でき、本文は文字tabで重ねる。枠で無効な放射幅/尖らせ、外枠で無効な中抜きは表示しない。SVGはviewportのbody直下に置き、現在のCamera投影、zoomに対応する線幅、回転Canvasの四辺clipを使う。Project/History/rendererの正本、手描きpen pipelineは変更しない。

- 実Chromium `build/wp030-shape-paint-browser.html`: 四角dragと編集中SIZE、自由色/輪郭色/opacity一回、背景黒0、内側透明、線と塗りの選択mask、空拡張rollback/拡張前boundsへのUndo、凹多角形の点移動/Backspace/Enter/Esc/Shift45度/始点確定、513点投げ縄のlegacy GPUと明示paint、ペン6スロット復帰、実Project export/loadとPNG全画素一致、1280/360px PASS。
- 実Chromium `build/wp030-focus-body-browser.html`: 明示しっぽなし/復帰、旧ウニフラpreset/向き、外枠/透明塗り/透明中央の二重枠、Canvas中心drag、zoom線幅/回転clip、SVGviewport原点、1History、実Project/PNG全画素一致、recipe再編集/更新UndoRedo、数値wheel/Space Camera、1280×720・360×640/400で確定操作、現在Cameraの投影 PASS。gesture/wheelは製品のhandlerへ合成eventを送るfixtureであり、液タブ/native連続drag完走の証明ではない。
- 通常の製品tabでも実buttonでモード/内側色と線幅keyboard、外枠/二重枠のCanvas位置を確認。確認画像はworkspace外 `wp030-shape-paint-final.png`、`wp030-focus-body-final.png`、`wp030-focus-ring-final.png`。iframe fixture初期化にMutationObserver error（起点未確定）が記録されたが、通常の製品tabは同errorなし。当Sliceの操作/保存結果とは分離し、RIG所有fileへ修正を広げない。
- 構文、area-tools5/focus-lines2/balloon5/tool-slots1/Project11、QTP preset/progressive density/static style、harness check、production build、対象diff-check PASS。buildの既存module externalization/chunk-size warningは保持。公開font原本の追加はゼロ。

main/e0f353ed、開始871c51ed。途中のOwner/external commitで先行差分の一部がHEADへ入ったが、lead/workerはcommit/pushしていない。並行WP033/034・RIGと全既存dirtyを保持。Owner制作/液タブ受入は未。フォント追加取得、ネーム/AI配置、union/後編集可能な輪郭部品、正式Vector Layerは次の独立判断であり、今回へ進めない。

### Owner follow-up — 入力先表示・吹き出しCtrl操作（2026-10-04）

Ownerは漫画panelが入力先なら橙枠、Canvasへ移ったら枠を外す表示を指示。「吹き出しが操作できない」はCtrl+drag/wheelと回答。現行のCtrl対象callbackはコマだけで、吹き出しに未接続だった。限定WRITE: 共通manga-tabs/input表示、manga-canvas-navigation、balloon popup/overlay、pure balloon-gestures（new）、対象CSS/fixture/純検証、当Card/STATUS。letteringのlocal Vは表示した入力先と一致するよう既存入口にscope gateを追加してよい（Ctrl+Enter等の既存確定契約は保持）。

- 表示はruntime-onlyの入力対象。show/tab/漫画内pointer/focus、draft overlayの操作で橙枠、Canvas/他UI操作で解除。Space Camera/global V Transform中は解除。Canvas pointer操作時に漫画入力欄の古いfocusを残さない。作品・Project・Historyへ保存しない。
- Ctrl+dragは吹き出し本体内で全体移動。旧中心handleと同じ本体/全tail tip/本文相対追従。Ctrl+wheelは全体を本体中心から一様拡縮、全tail tip追従。本文font指定sizeと線幅/しっぽ幅は保持し、autoFitは既存評価。文字contextでも全体操作と明記。
- 通常の本体内hitは描画へ透過。Ctrl中だけ捕捉し、Space/global Vへ譲る。修飾release/blur/hideで残留させない。Shift/Altは新rotationへ割当せず既存Camera/snapを保持。回転保存属性や新形状schemaは追加しない。
- 検証は中心/全tip/二連/本文領域の相対追従とfont/線幅保持、旧recipe/保存画素/Undo、入力先表示/比較窓/Canvas/Space/V/入力欄、実Browser hit/pointer/wheel/狭幅、syntax/関連harness/build。

後半の図形＋合成吹き出し、ネームtab/番号対応/JSON・AI配置は調査設計の候補で、今回の製品実装へ混ぜない。

### 入力先表示・吹き出しCtrl操作の結果（2026-10-05）

TECHNICAL COMPLETE / OWNER REVIEW。共通 `manga-input-focus.js` は漫画4tab/比較窓/draftの入力対象をruntimeの橙枠で示し、Canvas/他UI操作、Space Camera、global V Transformへ移ったら解除する。Canvas/SVGクリックで古い漫画control focusを外す。文字のlocal V/wheelもこの表示に従い、Canvas入力時は既存global Vへ譲る。Ctrl+Enterの既存確定契約は保持。

吹き出しに欠けていたCtrl callbackを接続。本体内部はCtrl中だけwhole-object移動hitを持つ。pure `balloon-gestures.js` が既存rect/全tail tipを移動・中心一様拡縮し、二連/本文相対frame/輪郭は追従する。手動font size/線幅/しっぽ幅は保持。通常の本体内は描画へ透過、Space/global Vを優先。Shift/Alt rotation、新recipe属性、保存/History正本は追加していない。footerに全体操作の短いhintを置いた。

- 実Chromium `build/wp030-manga-input-browser.html`: 全4tabの単一橙枠、Canvas/入力欄blur/比較窓、実DOMの本体内 `elementFromPoint`、Ctrl pointer連続移動とwheel拡縮、全tip/二連/本文追従、manual font/線幅/Camera/History不変、Space/V優先、Project recipe/全PNG画素一致、更新Undo、lettering local/global V切替 PASS。gestureは製品へ合成eventを送るfixture検証であり、native修飾drag/wheel完走と区別する。
- 既存 `wp028-lettering-browser.html`、`wp030-manga-gestures-browser.html`、`wp030-balloon-text-browser.html` 回帰PASS。本文fixtureは360px/低高footerも確認。実UI clickで橙枠→Canvas右clickで解除→漫画tab clickで復帰を確認。確認画像は `wp030-manga-input-primary.jpg`（workspace外のローカル検証成果）。native連続Ctrl drag/wheel・液タブ・制作受入はOwner未確認。
- syntax、balloon5/editable-lettering9/panel-layout2/fonts7/Project10、shortcut-learning、production build、diff-check PASS。共通harness checkは初回84 documents/324 linksでPASS、最終は並行追加されたWP033のGoal見出し不一致で停止（当Slice対象外、他担当のCardは変更しない）。既存buildのmodule externalization/chunk-size warningは残る。

main/871c51ed、既存文字/並行RIG差分保持、未commit/未push。検証後に並行WP033の一般Raster PNG block更新を確認。上記Project画素結果は更新前の本Slice実測であり、WP033後の全体保存受入は同Cardの担当へ委ねる。図形合成とネームは以下の調査設計だけを追加し、製品未実装。

### 図形・セリフ・ネームの分担案（2026-10-05、調査のみ）

Owner案の「楕円/矩形/自由輪郭を作る→重なりを合成→しっぽを接続→必要な線を直す」は筋がある。[CSP公式の吹き出し](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/フキダシ【PRO__47_EX】.htm)にも図形/ペン/しっぽ別ツール、同一layerの重なり結合、制御点編集、本文sizeを維持した本体編集がある。自動化全体が未成熟と総括せず、輪郭・組版・読み順を異なる編集責務として扱う。

推奨は閉じた輪郭の部品を残す非破壊合成。表示はunion外周、元の楕円/自由線/しっぽは再編集できる。合成境界だけを直接編集する場合は、元部品の編集から「輪郭として編集」への明示変換にする。元部品のつまみ操作と、合成後の任意線編集を同時に正本にしない。接続しっぽは元の点列と補正後形状を分け、角を残す/滑らかの強さを選べる方がよい。自己交差・穴・離れた本体・合成後のしっぽ根元は新しいgeometry/recipe検証を伴い、今回の小修正ではない。

| 入口 | 共用候補 | 漫画固有の追加 |
|---|---|---|
| 楕円・矩形・多角形・自由線 | 座標/点/curve/grid/snap/線と塗り | 後編集可能な輪郭部品、union、しっぽ接続、共通線幅 |
| 投げ縄・投げ縄多角形 | 入力gestureと閉領域の点列 | 閉じる補正、角の保持、編集用点列の保存。塗り済み画素だけを輪郭正本にしない |
| ギザギザ・ウニフラ | seed/半径/線polygon等のpure評価 | 背景と輪郭、内側文字領域。現行focus-linesは線polygon列で、閉じた吹き出しと同一出力ではない |
| セリフ | 共通paragraph/書体/文字editor | 通常は吹き出しと関連付け、高度編集は独立文字。clipboard貼付だけを同期方法にしない |
| ネーム | 本文編集・コマ一覧 | コマ/セリフID、表示順、話者、用途、配置案と手動固定 |

ネームから配置する先例はある。[Comic Life 3のScript Editor](https://plasq.com/2015/02/using-the-script-editor-in-comic-life-3/)は脚本のキーワードからコマ/セリフ等を認識して、pageへdrag配置できる。[CSPのStory Editor](https://help.clip-studio.com/ja-jp/manual_jp/570_pages/ストーリーエディターを使う.htm)は複数pageの本文を一覧入力/編集する。Comic Lifeの[公式説明](https://plasq.com/2014/05/scripting-comics-in-the-classroom/)ではscriptからpageへ進んだ後の編集がscriptへ自動反映されないとされる。これは同期が双方向かをTegakiで先に決める参考になり、自動最適配置の実在証拠とはしない。

Tegaki案は `コマ → 読み順のセリフ一覧 → 配置案 → ユーザー補正`。コマ番号/吹き出し番号は表示用とし、並替え後も同じ対象を指せる安定IDで関連付ける。本文は一つ、Canvas文字とネームは同じ本文への複数入口。初期fitは余白・文字size下限・読み順を守る有界proposalとして生成し、手動補正した座標/sizeはロックして再計算で上書きしない。

将来JSONの候補はpage/panel/dialogue IDs、本文/話者/用途/順序、書式preset、候補矩形、手動固定field。AIはその制約内の配置案を返し、ID/範囲/本文保持を検証してpreview→明示適用する。Project保存正本をAI出力へ置換しない。参照対象ID・本文同期・Historyと保存契約は次の別Cardで確定する。今回JSON形式もネームtabも未実装。

### 承認された順序分の結果（2026-10-04）

TECHNICAL COMPLETE / OWNER REVIEW。常設font/基本サイズ/二連本文対象、輪郭と独立した文字領域の移動・resize・収め直す、外周/本文衝突/下限overflow警告、共通paragraph adapter、合計4本までのしっぽ、Canvas直線・斜線分割、コマ/分割/全体contextと固定footerを実装。分割のShift水平/垂直、連動コマのCtrl境界操作とフリーコマの移動/拡縮/回転、Space Camera優先、global V ownerへ譲る境界、T文字tab開閉を確認。通常Raster/optional v1 recipe/既存Historyの所有を保持する。

コマpopupは内容に応じた高さ（viewport上限あり）とし、初回openで最初のコマを選択。通常連動コマの内側は描画へ透過、分割mode・Ctrl対象操作・選択freeの内側は操作面とする。native dragで旧stroke-only hitがペン描画へ抜けることを発見して修正。修正後は実Browserの`elementFromPoint`で本体内側へのhitを検証。自動操作器のnative dragはSVG再描画中に停止したため、修正後のnative連続drag完走は未確認。fixtureのpointer連続操作/Camera/保存はPASSであり、native完走と区別する。

実Chromium:

- `build/wp030-balloon-text-browser.html`: font wheel、輪郭変更で領域保持、領域移動/折返し・size不変、本文①②対象と重なり警告、収め直す、outside raster bounds、Project/画素/Undo、SpaceとT、360px幅/640・400px高footer PASS。
- `build/wp030-paragraph-browser.html`: system/実外部書体×縦横×align3種の12組、従来requestとの寸法/全RGBA一致、指定改行とunsupported属性拒否 PASS。共用範囲は矩形単一書体/第一フチ。HarfBuzz自動禁則折返し・高度文字属性のparagraph移植は未実装。
- `build/wp030-manga-gestures-browser.html`: 複数しっぽ選択/移動/全先端追従/上限/削除、Project/画素/Undo、コマ斜線/Shift/短線拒否、Ctrl連動境界・free変形、内側hit/修飾解除、Camera/global V、clip群のProject/再編集/UndoRedo、360px footer/context PASS。斜線/free/clip群のProject画素差0、復元12件。
- `build/wp030-balloon-editor-browser.html`、`build/wp028-lettering-browser.html` 回帰PASS。native T開閉/textarea入力優先、コマGUI表示を確認。

構文、balloon4/fonts7/editable-lettering9/panel-layout2/Project10、shortcut-learning、harness check、production build PASS。制作受入/液タブ/修正後nativeコマdragはOwner確認待ち。main/871c51ed、既存文字/並行RIG差分保持、未commit/未push。

残る候補: しっぽの折れ/離れた本体のつなぎ、集中線context整理、文字別局所9点、追加font監査・取得。コマの辺別枠ON/OFF・任意多角形/曲線は上記調査候補で、今回完了に含めない。

### 実装続行 — 常設書体・文字領域・Camera優先（2026-10-04）

Ownerは調査提案の順序を承認し、Space/ShiftのCamera操作と修飾キーでの対象操作も提案。現在の限定Sliceは常設font/サイズ、本文①②の対象表示、独立文字矩形の直接移動/resize/収め直す、収まり/衝突表示、Camera優先。WRITEはballoon popup/overlay/raster/geometry、独立pure `balloon-text-layout.js`、対象CSS/検証、当Card/STATUS。geometry/layout担当とUI担当のwriteは分離。既存文字renderer/keyboard/Cameraはまずread-onlyで割当を監査し、既存grammarに衝突する修飾を新設しない。

- optional `text.frame` / `double.frame` は各本体rectに相対的な `{x,y,w,h}`。欠損recipeの旧配置は保持する。新規形変更/明示「収め直す」で領域を初期化し、輪郭点dragで初期化済み領域を変えない。本体移動/resizeには相対追従、文字size変更とは別。
- 二連初期化は本文矩形同士の重なりを解消する。内容は別正本①②のまま。文字の移動/resizeは選択本文だけ、書体・基本書式は今の共通書式を保持して対象表示を明記。
- フチを含む確定前文字boundsの本体外/本文衝突を表示し、見えないclipで隠さない。下限で収まらない場合も表示する。勝手に本文を書換えない。
- Cameraの既存Space/Shiftを優先し、Space中のoverlay hitをCameraへ譲る。T/Ctrl/Altは監査後に確定する。保存/History/renderer正本とSOURCE/ANIMATE grammarは変更しない。
- pure sanitize/旧互換/相対追従/衝突、本物Browserの領域drag/折返し/フォントwheel/Camera/保存画素/再編集/Undo/低高footer、syntax/関連harness/buildを検証する。

監査後の追加WRITE: `config.js` / `ui/keyboard-handler.js` の既存popup actionにTの文字tab開閉を追加。`ui/settings-popup.js` の既存shortcut分類にも同actionを追加し、表示と実行の正本を揃える。入力欄/IME中は既存keyboard gateに従い、確定キーにはしない。Ctrlによるコマ操作は後段のコマSliceで対象選択と既存Transformとのowner境界を定義してから追加する。Altは既存snap解除のため再割当しない。

共通文字エンジンproof→複数しっぽ→コマ直接分割はこのSliceの検証後に限定契約を更新して順に進める。

### 共通paragraph proofと限定移植（2026-10-04）

WRITE追加: `system/lettering-paragraph.js`（new共通model→browser paragraph adapter）、`system/lettering-vector-renderer.js` のsystem paragraph request/measure/render分岐のみ、吹き出し組版caller、専用Browser fixture。当Sliceの独立領域・旧recipe互換のBrowser PASS後に開始。browser paragraphとHarfBuzz outlineは用途別backendとして保持する。新adapterは矩形折返し・指定改行・縦横・単一書体・第一フチの共通model属性を扱い、文字別/第二フチ/曲線/envelope/sizeProfileを黙って捨てずunsupportedで拒否する。吹き出しに未対応UIを増やさない。既存advanced imported branchは変更しない。

移植前proof: system/imported font、縦横・禁則を含む本文/改行・第一フチ・align・trackingで従来browser requestと新adapterの寸法/確定画素一致、属性拒否を検証。その後に同じadapterへ吹き出しと独立文字system branchを接続する。これは矩形paragraphの共用であり、HarfBuzzの自動禁則折返しや高度文字属性をparagraphへ移植した完了証拠とは扱わない。

### 複数しっぽの限定契約（2026-10-04）

共通paragraph proofの全12組（system/外部、縦横、align3種）の寸法/全画素一致とunsupported拒否、既存文字8検証PASS後に開始。WRITE: balloon geometry/popup/overlay/CSS、専用pure/Browser検証。既存 `tail` を第一しっぽとして保持、optional `extraTails` を最大3件追加（合計4）。各追加しっぽは既存と同じenabled/style/tip/width/curve、Canvas world tip。欠損/空配列は保存キーを追加しない。描画は既存本体＋tail polygon stroke/fill経路、根元は本体union外周で求める。本体全体移動に全先端追従、本文領域は無関係。番号選択と追加/削除でしっぽcontextの設定対象を明示し、Canvas先端選択も同期。primaryは削除せずOFF、extraは削除可。旧recipe/画素互換、複数尖り/丸混在、sanitize上限、Project再編集/Undo/PNGを検証する。History/保存schema/renderer正本は変更しない。

### コマ直接分割・compact GUI・修飾操作（2026-10-04）

WRITE追加: `ui/panel-layout-popup.js` / `ui/panel-layout-overlay.js` / 対象CSS、new `system/panel-layout-gestures.js` / `ui/manga-canvas-navigation.js`、関連pure/Browser fixture、balloon navigation caller。既存分割木/凸四角形/normal Raster/既存group Historyを維持する。Canvas「線で分割」modeのdragを対辺の分割比/傾きへ写し、短いdrag・対辺を横断しない線・既存傾き上限外は明示拒否する。Shiftは線の水平/垂直吸着。プレビュー線はruntime-only、pointerupで既存splitPanelへ一回適用、Space/blur/cancelは破棄。

GUIはコマ/分割/全体contextと固定footer、補助previewは開閉式。Space+drag/wheelとShiftのCamera grammarをoverlay上でも維持。Ctrl+dragは連動コマの親境界移動、フリーコマ移動。Ctrl+wheelは連動コマの親境界比（Shiftで傾き）、フリーコマは中心拡縮（Shiftで回転）。normalを勝手にfree化しない。global V Transform中はCtrl aliasを使わず既存ownerへ譲る。Altは既存吸着解除。Tは漫画文字tab開閉。native Browser/geometry/保存clip群/Undo/Project/低高footerで検証する。

Browser切分けで斜線/回転フリー/clipのProject往復に1623channel差、12件のgroup member復元を確認。追加WRITEは `system/project-manager.js` の既存PNG生成branch条件のみ。コマも既存lettering/balloonと同じ正規straight-alpha snapshotからencodeし、extract後の再alpha変換を避ける。新保存正本/schema/PNG形式を作らず、画素一致とProject suiteを再実行する。


### Owner follow-up — 文字領域と漫画ツールの調査設計（2026-10-04）

状態: 調査完了 / 設計提案（後続実装は上記限定契約と下記結果を参照）。この調査時点では製品実装を変更していない。Ownerは一元化を「編集・エンジンの共用、出入り口はマルチ」と訂正。セリフ側の直接font選択/wheelを保持し、本体/しっぽ編集中でも使える共通headerにfontと基本サイズを置く案を推奨する。詳細書式/文字領域操作は文字context、管理/分類は既存比較窓の情報・整理。共有しても、開いた入口の編集対象を窓に明記する。

現行codeで確認した問題:

- `balloonTextArea`は自由輪郭の最小radiusで中央矩形全体を縮める。200×260px/線3pxの同じ本体で、一点のradiusを1→0.5にすると文字矩形は142×186.4→68×90.2px。局所的な凹みのために空いた側も狭くなる。
- 二連は別々の入力を各本体へ置き、一本の文章を自動で渡す機能はない。初期dy=0.5/scale=0.85の上記本体では、文字矩形同士が高さ41.97px重なる。実際の文字衝突を必ず意味する値ではないが、最大限入力すると重なる余地があり、独立autofitだけでは防げない。
- 自動文字サイズの下限8pxでも収まらない場合の明示的overflow判定がない。無言で極小化/欠落させず、収まらない状態を扱う設計が必要。
- fontLibrary/FontComparisonは共通だが、吹き出しは`lettering-raster.js`のbrowser矩形組版、独立文字は`lettering-vector-renderer.js`（imported outline / system paragraphの既存分岐）。高度文字側のHarfBuzz組版は改行を基に配置しており、矩形の自動折返しをそのまま置換できるとは未証明。

公式資料から確認した操作（アプリの実機操作・内部source確認は未実施）:

- [CLIP STUDIOの吹き出し](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/フキダシ【PRO__47_EX】.htm): 本体の制御点、しっぽだけの選択/変形、重ねた本体の見た目上の結合。吹き出しの拡縮で文字サイズを変えず配置を調整する。[テキストフレーム](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/か行.htm)は矩形内折返しと文字サイズを分けて操作できる。任意輪郭に沿う自動段組みの存在は、この調査では確認していない。
- [CLIP STUDIOのコマ割り](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/コマ割り【PRO__47_EX】.htm): ドラッグ分割、隣接コマの連動、コマ内の絵を変形しない枠編集、個別制御点、裁ち切り。[分割設定](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/わ行.htm)には直線/折れ線/スプラインと通過点の増減がある。
- [MediBang Paint Androidの漫画制作](https://medibangpaint.com/use/2022/01/how-to-make-a-comic-1-android/): 吹き出しは手描き、楕円＋折れ線の選択領域から境界描画、素材の利用。[MediBang Palettaのコマ](https://medibangpaint.com/medibang-pro/manual/objects/comic-frame/)はドラッグ分割/90度吸着/枠選択後の文脈メニュー。PalettaとPaintの操作は別製品の説明として扱う。

文字配置の候補評価（5点満点、Tegakiでの操作安定性・日本語セリフ・既存実装への適合に対する設計判断。実測UX評点ではない）:

| 案 | 評点 | 判断 |
|---|---:|---|
| 輪郭とは別の文字矩形＋自動初期配置＋直接移動/拡縮 | 5 | 推奨。輪郭変更で毎回改行を変えず、必要時だけ「収め直す」。改行/指定サイズを保ち、領域の修正を優先 |
| 輪郭断面に沿って行/列ごとに自動配置 | 3 | 後段候補。日本語禁則、縦書き、凹み、二連の読み順、drag中の改行変化を検証する必要がある |
| 文字量に合わせて本体を常時自動変形 | 2 | 常時動作はコマ内の絵・しっぽ・二連配置を崩す。「文字に合わせて本体を広げる」の明示操作なら候補 |

推奨設計: 吹き出し外周、本文、文字領域を別々に編集する。本文は一つの正本を保ち、自動改行は評価結果にだけ持つ。新規時は本体内の余白付き矩形を提案し、文字領域を手動調整後は輪郭点dragで改行/位置を勝手に再計算しない。本体全体の移動には追従させ、拡縮時の領域追従は意味を固定する。文字領域の幅/高さ変更は折返しの変更とし、文字サイズ/warp操作とは分ける。内側に収まるかは本体形状＋線幅/余白で判定し、しっぽは文字領域から除外。確認にはフチを含む文字boundsを使用する。

二連は「本文①／本文②」を明示し、Canvasで本体/文字領域を選択すると入力と設定対象を同期。二つの安全領域を求め、結合部での重なりは警告・領域移動で直せる。まず別本文を保持し、「続きへ送る」方式は明示区切り＋一つの本文を基にした派生配置として後段検討する。空の第2本文へ第1本文を無言で複製/分割しない。

一元化の次の技術proof: 共通文字model/rendererに矩形内paragraphの評価を渡せるadapterを検証する。吹き出し側へ文字editorそのものを複製しない。縦横折返し/禁則/指定改行/外部とsystem font/フチ/文字別指定/測定と確定の一致を先に固定する。既存browser paragraph経路を保持したまま移植できることを証明してから統合する。作品は引き続き通常Raster＋optional recipe、編集入口ごとのadapterが既存History/保存を担当する。Vector Layer新設は必要条件にしない。

コマの着地点: 簡単漫画専用として機能を止める根拠はまだない。現行`panel-layout.js`には直線分割木、隣接追従、間隔、吸着、裁ち切り、コマ内コマ/フリー化がある。一方、コマは常に凸四角形で、任意多角形・凹形・曲線は現行の小改修ではない。

| 優先 | 次の候補 | 適合と境界 |
|---|---|---|
| 高 | 共通glass/context/固定footerとCanvas直線ドラッグ分割 | 既存分割・吸着を利用できる。縦横＋斜線を分割比/傾きへ写す試作から始める |
| 中 | 辺単位の枠線ON/OFF、連動/独立の分かるCanvas操作 | ぶち抜き・開いたコマを簡単にする。枠線表示と描画clipの意味を別々に検証 |
| 中 | 独立した多角形/曲線コマ | 図形/輪郭の評価部品を再利用できる。ただし保存sanitize、hit、clip、raster、再編集を揃える別Cardが必要 |
| 後 | 曲線分割まで隣接コマを自動追従 | topology/間隔処理が大きく変わる。独立コマで必要性を評価してから決める |

共用候補は座標変換、点選択/追加削除、grid/snap、曲線評価、文字計測/描画。コマの隣接分割木、本体と本文の関連、しっぽ根元の追従はtool固有に残す。既存clipを輪郭変形から文字の欠落を隠す手段として使わない。

次の実装順提案は「常設font/サイズと対象表示 → 文字領域の直接編集・収まり/二連衝突の扱い → 共通組版proof/移植 → 複数しっぽ → コマのCanvas分割とcompact GUI」。これは上表Sequenceの開始前調整案であり、今回の調査から製品変更を自動開始しない。

### 段階2 — compact吹き出し・輪郭点・二連（2026-10-04）

Ownerは管理/分類の初期展開、比較/情報の入口統合と次改修を指示。WRITE: `ui/balloon-popup.js`、`ui/balloon-overlay.js`、`system/balloon-geometry.js`、`system/balloon-raster.js`、対象CSS、文字のfont入口、管理部品、関連verifier/fixture、当Card/STATUS。pure geometryとUIはfile所有を分ける。

- 管理/分類は初期展開。一つの「書体」buttonで比較窓へ入り、見本/情報の既存tabを使う。
- 吹き出しは本体/しっぽ/文字context、固定footer、共通glass密度11px/幅316px。previewは補助として既存開閉を保持。数値wheelは既存NumericField。
- custom輪郭はrectに相対的な角度/radius点（4–24個）をoptional paramsへ保存、連続曲線をpure evaluatorで評価。Canvas point drag/選択/追加/削除/戻す。grid/snapはUI設定で作品へ混ぜない。
- doubleは重なる二楕円の外周として評価。secondaryの相対位置・一様size・別contentのみoptional paramsへ保存。両body文字は同じ書式、別文字領域。重なりを維持し内部線を出さない。移動/resizeで相対配置維持。
- 旧4shapeのparams/評価結果は変更しない。通常Rasterとoptional v1 balloon recipe、既存Project sanitize/History経路を利用し、新正本/schema/rendererを作らない。全preview/確定は同じpolygon evaluatorと文字画像を使用。
- 検証: geometry旧shape比較/悪値sanitize/点追加削除/二連外周と文字領域、実Browser Canvas drag・相対移動・結合境界/本文2件・Project/PNG/UndoRedo、1280/360pxと固定footer。
- 今回の次改修は段階2まで。複数しっぽなど段階3以降は後続。

Browserで旧楕円にもProject往復361channelの縁画素差を再現。追加WRITEは`system/project-manager.js`のPNG生成branchのみ。吹き出しも既存Letteringと同じLayerSystem straight-alpha snapshotをPNGへencodeし、余分なalpha変換を避ける。画素/PNG形式/保存項目/読み込み正本は維持、rendererや新schemaは変更しない。旧楕円・輪郭・二連を画素完全一致で再検証し、Project suiteを実行する。

### Owner follow-up — 情報・整理へ集約（2026-10-04）

画面右下入口を撤去し、文字・吹き出しの既存比較「情報・整理」へ取り込みと表示分類を集約する。lead WRITE追加: `ui/balloon-popup.js`、`ui/lettering-popup.js`、`ui/font-library-management.js`（分類/importだけのUI部品）、対象CSSとBrowser fixture。比較ボタンは両方「比較」。吹き出しCanvas overlayは常時操作可能とし、旧OFF設定でも表示、補助previewの開閉は独立保持。保存API/作品/Historyは変更しない。単独管理窓部品は残すが製品の自動生成は外す。Browserで両tabの集約・実分類操作・狭幅・旧設定を確認する。

## Scope

以下の初回共通窓契約は履歴として保持する。現在の入口と配置は上記Owner follow-upを優先する。

初回共通窓の実装範囲は以下に保持する。現在の対象は上記段階2の限定契約。後続の順序は上表で管理し、保存項目・Canvas操作を変更する段階は開始前に限定契約を追記する。

### WRITE

lead owns `ui/font-library-window.js`（new）、`ui/font-comparison.js`（host optionとIME close guardのみ）、`styles/components/font-library-window.css`（new）、`styles/components/panel-layout-popup.css`（比較selectorの共通host追加）、`core-engine.js`（一インスタンス接続）、`index.html`（CSS一行）、`ui/keyboard-handler.js`（既存比較focus guardへ追加）、専用verifier/Browser fixture、既存情報比較verifierのhost option対応、当Card/STATUS/work索引/登録簿/harnessの対象箇所。`right-workspace-frame.js`はread-only。既存main/871c51edと全dirty、独立WP029/031を保持。

## Contract

WP024/028の技術検証済みコードを利用する。Owner最終制作受入が未完のためmanifest上のDONE依存には昇格させない。

- 共通status panel内の小さな書体button。既存status nodeがAnime dockへ移されるので同じbuttonも追従する。新しいdock/status ownershipを作らない。
- FontComparisonをstandalone hostとして再利用。既存の比較caller、文字全体/選択文字、吹き出しへの適用経路は維持する。
- 管理窓の選択は窓内だけ。作品params/Layer/Historyへ参照を持たない。favorite/Primary/メモ/収納/手動順は既存fontLibrary APIだけで更新。
- 見本比較と整理・管理の2tab。管理は選択書体の短評/coverage/作者・許諾リンク、favorite/Primary/メモ/収納、folder CRUD、import。folder削除は書体を親へ戻し、実体削除ではない。
- imported bytesは既存IndexedDB、選定実体はE自動bridge。外部ON/OFF、実体のGit再導入、別の永続font cacheは作らない。
- 非同期一覧はtokenで古い応答を拒否し、変更通知が連続してもprojectionを戻さない。visible/近傍warmは既存Comparison上限を使用する。
- 共通Futaba glass、共通scrollbar/controls、密度11px程度。狭幅は横にはみ出さず、必要な内容だけ縦scroll。keyboard focus/Escape/IMEを局所へ閉じる。
- module headerに責務・依存・保存境界・検証入口。新しいwindow互換global、汎用bus、font保存正本は作らない。

## Tasks

共通書体window moduleとCSS、既存比較のstandalone host option、status入口の一インスタンス接続、GUIと非同期更新/取り込みの検証。

## Acceptance

作品の書体やHistoryを変えずに見本比較・分類・取り込みができ、既存文字/吹き出しの分類表示へ同期する。dock/狭幅でも入口と操作が見える。

## Verification

構文、fonts/balloon/editable-lettering関連、harness/build。実Chromiumで入口/2tab/選択とhoverの作品不変、folder作成/rename/収納/順/削除（font保持）、favorite/メモ/Primary/importとreload同期、dock内入口、360px/1280px、keyboardとclose、font実体Git混入なしを確認する。Owner液タブ・制作受入は別。

## Stop

font実体DLはこのSliceに混ぜない。Project/History/renderer、RIG、schema正本の変更が必要ならこのSliceを拡げず次の限定契約を作る。既存font UIの大規模置換は行わない。

## Completion

段階1の初回案（以下は訂正前の検証記録）: TECHNICAL COMPLETE / OWNER REVIEW。2026-10-04、main/871c51ed、未commit/未push。

共通statusの書体入口、独立glass window、既存比較の見本／整理・管理、favorite/Primary/メモ/収納/上下/表示ソート、folder作成/改名/解除、既存importへ接続。設定はfontLibraryのみ、作品への参照は持たない。非同期projectionの古い応答・閉じた窓・失敗をverifierで確認。変更通知を32ms集約し、明示refreshで自分の通知timerを消すため、連続の上下操作が古い順序を参照しない。

実Chromium `build/wp030-font-library-browser.html`: E27一覧、hover/選択と管理の作品・History不変、folder CRUD/収納/上下/favorite/短評/Primary、実font bytesのimport＋収納、既存文字/吹き出しの分類同期、IME中Escape保護/通常Escape/focus、再open、1280×720/360×640と横overflowなしPASS。360px時の入口bounds x232.7..278.5、y616.9..638.9で画面内。試験設定と順序は元へ復元、試験importは除去。別の実製品tabでAnimeドックの共通statusへ入口が移り、native clickで開いて管理tabへ切替できることを確認。OS file chooser/液タブ/Owner制作受入は未検証。画像はworkspace外 `wp030-font-library.png`。

構文・fonts7・editable-lettering8・balloon1・harness・production build PASS。既存WP028の実Browser文字別/Project/PNG画素/再編集/UndoRedo・360px/400px高回帰もPASS。保存正本・外部E接続・public実体ゼロを維持。並行RIG filesは変更しない。

初回案完了時点では段階2以降は未実装。現在の段階2結果は下記に記す。

### Owner訂正後の結果

情報・整理への集約 TECHNICAL COMPLETE / OWNER REVIEW。画面右下の自動入口撤去。吹き出しの既存管理/表示分類nodesはlistenerを保持して比較情報hostへ移動。文字は独立`FontLibraryManagement`部品を同じ情報hostへ追加し、分類/importのみ既存APIを呼ぶ。両方「比較」文字button、Canvas overlay常時・旧OFF設定拒否、補助preview独立を維持。

実Chromium `build/wp030-font-information-browser.html`: 両入口/集約、旧OFF、分類作成/改名/解除、実font bytes import＋分類収納、吹き出し同期、管理による作品/History不変、360px境界/横overflowなし/末尾到達PASS。試験font/分類は除去し順序復元。旧fixture URLは新fixtureへ案内。既存WP028 Browserの個別書体/二重フチ/Project/PNG/UndoRedo/狭幅・低高回帰PASS。native clickで文字/吹き出しの情報tabを開いて表示確認。fonts7/文字8/balloon1・harness・構文・production build PASS。外部27実体はGitへ入らない。制作受入/液タブ/OS chooserはOwner確認待ち。段階2以降へこの訂正ターンで進めない。

### 段階2と入口統合の結果（2026-10-04）

TECHNICAL COMPLETE / OWNER REVIEW。文字・吹き出しの入口を一つの「書体」buttonへ統合し、見本比較/情報・整理の最終tabを再openで保持。管理と表示分類は初期展開。取り込み・分類は既存fontLibraryだけを使用。

吹き出しを幅316pxの共通glass、本体/しっぽ/文字context、常設本文、固定footerへ再編。自由輪郭は8点初期/4–24点、選択点の隣への追加・削除・移動・戻す、UI grid/snap。二連は重なる二楕円の外周だけを描き、二つ目の本体の移動/一様拡縮、独立した2件のセリフを実装。pure geometryと表示/入力/文字合成を分離し、旧4shape、通常Raster、optional version-1 recipeとHistoryを保持。複数しっぽは未追加。

実Chromium `build/wp030-balloon-editor-browser.html`: Canvas輪郭点drag/選択/追加削除、gridと数値wheel、二連の移動/拡縮/全体移動の相対配置、結合境界のfill/内部線なし、本文2件、1Layer/1History確定、Project recipe復元/PNG画素完全一致、再編集更新/UndoRedo、360px幅・640/400px高の固定footer/各context PASS。旧楕円にも存在したProject PNGの361channel差は、既存LayerSystem snapshot経由のencodeに揃えて修正し、旧楕円/輪郭/二連すべて差ゼロ。公開font実体追加なし。

更新した情報fixtureと既存WP028 Browser回帰もPASS。実製品tabで二連presetとcompactレイアウトをnative click/画像で確認。構文、balloon2/fonts7/editable-lettering8/Project10、harness check、production build PASS。Owner制作・液タブ・OS pickerは未検証。main/871c51ed、並行RIG/既存文字差分保持、未commit/未push。

次はSequence段階3の複数しっぽと形のバリエーション。開始時に対象file・選択/根元追従・結合線・保存/再編集の限定契約を確定する。段階3以降へこのターンでは進めない。
