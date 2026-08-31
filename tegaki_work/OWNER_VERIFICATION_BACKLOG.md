# Owner実機確認バックログ

更新日: 2026-09-01
状態: ACTIVE — Phase 7i〜9nはclose済み、Owner制作環境では未確認項目あり

## 目的

SOLの実装監査・固定verifier・Browser確認でcloseした機能について、Ownerが制作環境へ戻った時にまとめて確認する項目を保持する。ここに残る項目は「未確認」であり、「不具合確認済み」または「Phase未完了」を意味しない。

- Owner確認で問題がなければ各項目を完了へ更新する。
- 問題が見つかった場合は、閉じたPhaseを暗黙に再OPENせず、再現条件に応じたbug fixまたは新しい限定Phaseを立てる。
- 既存Projectを破壊し得る確認は複製Projectで行う。

## 未確認項目

### Phase 9o — Layer Transform D / BASIC Stage B4 Owner correction再確認

- OwnerはStage A1でD Tegaki hybridを選定し、Gate 1=`GO — D: Tegaki hybrid`。Stage B1 production画面、Stage B2 corner Uniform Scale、Stage B3 Rotate handleを2026-08-31に確認・承認した。
- Stage B4でquiet 4辺中点だけをone-axis Scaleへ接続した。mouse / penで可視10px＋透明28px hit（coarse 36px）がcornerと取り違えず掴め、上 / 下=`scaleY`、左 / 右=`scaleX`、回転後local axisへ追従するかを確認する。corner / sideをAnchor越しへ動かした時は中央で止まらず、期待どおり水平 / 垂直 / 両軸flipへ連続することを見る。
- 4 corner + 4 side + Rotate + Anchorが静止中に絵へ過剰な注意を奪わず、hover / drag時だけFutaba cream + 茶から橙へ上がるかを見る。煩雑なら、実装前比較で保持したside midpointなし案へ戻す。
- 左端へ分離した中心buttonが押しやすく、single clickで明示Anchor編集、double clickで現描画範囲中央へ見た目を跳ばさず復帰すること、そこからCanvas Move / handle操作してもAnchorがboxへ追従することを確認する。既存ResetはCanvas中心へ戻る。
- 拡大previewで短いdabや細線がlinear blurによる途切れに見えず、exact-pixel表示として読めること、V confirm後は元samplingで一回だけBakeされることを見る。pixel edgeはvector化ではなく原Raster忠実表示である。
- V confirm、Escape cancel、既存Canvas Move / Shift Rotate / Scale / Anchor / precise Uniform Scaleのfallbackが衝突しないことを確認する。
- A / B / Cも再試行候補としてfixtureと`task-codex/phase9o.md`へ保持した。D選定後に不満が出た場合は、同じ比較条件へ戻して再評価する。
- SOL Browserではwideの横 / 縦分離、約45°回転後local axis、Anchor / boxのMove `+90 / +30px`一致、side Anchor越えflip、preview History不変、V confirm 1、Undo / Redo、Escape復元を確認した。480×800の4 side hit、中心button、210px panel、横overflow 0、全131 verifier、build、通常scaleのconsole 0件も通過した。意図的な巨大scale確定stressでは既存max-texture guard warning 1件だけを確認した。この技術proofはOwnerの掴み心地、注意量、previewの見え方を代替しない。
- Owner acceptance後はStage B5で永続的なCanvas中心 / 描画範囲中心の明示切替が必要かをGate判断し、不要ならBASIC close条件を選定する。DISTORT / WARP、Interaction Context / Animation bridgeは並走しない。

### Phase 9n — RIG / Motion responsibility / single RIG WORKSPACE（技術close後）

- SOL Browserではright RIG → `RIG WORKSPACE`、RIG / Motion / Warp往復、close / reopen、Table closed再入場、History不変、480×800横overflow 0、console 0件、全129 verifier / buildを確認した。
- Owner / 外部Web AIは、right RIG overviewからstatic authoring hostへ迷わず移れるか、LayerとRIG切替回数、left / right配置、複数Raster時の対象理解、Motionへ戻る手掛かりを評価する。
- current RIG WORKSPACEの横長layout、常設数値欄、button density、`RIG / MOTION / WARP`上位tab、floating / vertical inspector選択は最終UX受入ではない。Phase 9o Transform-first / Focus Lens比較前に作り込まない。

### Phase 9m — Layer Panel frosted compact / Animation Table utility follow-up（技術close後）

- 明るい絵 / 暗い絵、wide / narrowで、Frame control＋CAF / Lane contextが128px幅の一つの上下接続stackとして読め、28px row / 20px thumbnail、shadowなしの磨りガラスsurfaceがCanvasを過度に隠さないことを確認する。
- current Layerの54%橙surfaceが攻撃的すぎず、橙がthumbnail上下へ連続しながら20px hit内の18px contentは無着色であること。0pxのmeta/name gap、3pxのrow列間、outlineを外したclip / visibility action、背景rowとのcompact基準が読め、Folder子の縦線がrow端で半端に切れないこと。
- Table表示中にinternal Layerをthumbnail側から並べ替え、Folderへ投入し、Undo / Redo、Folder開閉、Table close / reopen、Project reload後も順序・depth・active targetが一致すること。通常modeのLayer / Folder D&Dも退行しないこと。
- Frame左右矢印上のwheel、Timeline onion、Lane onionをmouse / pen / touchで確認する。CAF / Lane上下移動の意味は未確定のため、現段階では新しい矢印controlを追加していない。
- 通常Folder / CAF内部Folderのicon投影は現存する。内容合成Folder / CAF thumbnailは未実装であり、将来Gateで内容導出、更新時機、stale表示、性能、visibility / clippingとの関係を決め、保存用thumbnail flagは作らない。
- Playback Endは`TIMELINE → LAST CLIP → OUT MARKER`の直接循環となり、OUT MARKER時だけ隣接するI / Oが現れる。制作環境でF9〜F18等の短い範囲を設定し、非LoopがOで停止、LoopがIへ戻り、Table close / reopen後もOUT MARKERとI / O表示が一致することを確認する。
- 第一行のPlay / Stopはhit areaを維持したまま可視面を抑え、三分割gridの中央へ置いた。wide / narrow、mouse / pen / touchでPlayとStop glyphが同じ中心に見え、header / Bottom境界線が二重barに見えず、Playback controlsへ重ならないことを確認する。
- 2026-08-28のOwner実画面では、十分な横幅でもheaderが設定 / Play / Playbackの三行へ分裂し、Timeline / Laneより面積を取るためvisual NGとなった。次の限定修正後に、一行header、最小高Bottom、Play / Stop中心、OUT時I / O、Timeline開始位置を再確認する。CAF選択だけでRIG / Motion詳細が一気に展開されないことは後続`Clip Focus` Gateで確認する。
- BrowserではFrame / CAF / row / 背景=128px、right-panel=172px、row=28px、20px hit / 1px padding / 18px content / 0px details gap / 3px列間 / action border transparentを確認した。thumbnailからFolder投入、Undo / Redo、Frame wheel F1↔F2、Lane onion反転色＋ARIA、OUT MARKER F9〜F18停止・close / reopen復帰、console warning / error 0件まで確認済み。全117 verifier / production buildを通過したが、上記visual NGによりPhaseはcloseしない。

### Phase 9l — Right Layer / CAF Focus D Flat projection（技術close後）

- 多数CAFと長い内部Layer / Folderを持つ制作Projectで、右Panelが選択CAF一件だけへ追従し、CAF名 / Lane名、現在internal target、peer、visibility、clipping、RIG chipを迷わず読めることを確認する。
- Animation TableでCAF切替、内部Layer順序変更、CAF copy / pasteを反復し、右PanelへCAF asset cardや第二D&D正本が復活せず、橙current targetが常に一件であること。Table close / reopen後も同じ`selectedCelId / selectedAssetId / selectedInternalLayerId`へ戻ること。
- 内部Folderの開閉、選択子Layerを含むFolder collapse、mouse / pen / touch、narrow / low viewportを確認する。問題時はPhase 9lを再OPENせず、projection / selection focus / Table D&Dのどれかへ再現条件を分けた限定bug fix Gateを立てる。
- 全113 verifier / production build / Browserの追加・選択・visibility・clipping・Folder collapse・複数CAF・Table close / reopen / console warning・error 0件 / 生成物清掃、SOL final review=`A`で技術closeした。

### Phase 9k — Integrated Outer Shell / Floating dark rails（技術close後）

- Ownerの短時間visual確認ではFutaba light-maroon 98→88% gradient、shadowなし、enabled trashの不透明on-dark橙`#ffb87e`を受入済み。制作Projectの明色 / 暗色 / 高彩度artで、左右railのgradientが汚れや壁に見えず、cream glyph、Setup青、Motion橙、delete橙が沈みすぎないことを長時間確認する。
- 同じ数値の橙・grayでもsurround明度で知覚が変わるため、数値contrastだけでなくactual surface上のrest / hover / active / popup-open / disabledを比較する。色だけで状態を読む必要がなく、surface / outline / icon形状も同時に読めること。
- Sidebar toolをmouse / pen / touchで開いた直後のSpace＋dragがCanvas panへ戻り、keyboard focus中のEnter / Spaceは従来どおりbuttonを操作することを確認する。問題時はPhase 9kを再OPENせず、rail visualまたはfocus復帰の限定bug fix Gateへ分離する。
- 関連4 verifier / 全111 verifier / production build / Browser computed style / console warning・error 0件 / 生成物清掃、SOL final review=`A`で技術closeした。

### Phase 9h — Sidebar Quiet Resting / Active Ring（技術close後）

- 制作環境の明色 / 暗色Canvas周辺、OS表示倍率、wide / narrowで、resting iconがCanvasより静かでも入口を見失わず、hover / keyboard focus / Q・V・A active / disabledがsurfaceと輪郭で読めることを確認する。
- normal 30×30px / coarse 38×38pxのhit area、Q / V / A / Settings、Album / Import / Export / Resizeをmouse / pen / touchで確認する。Phase 9hではtool順、icon、shortcut、popup内部skinを変更していない。
- Animation Table内部×後のA stale activeと、Settings等のgeneric element / ARIA差はPhase 9iへ既知課題として分離済み。Phase 9hのskinを戻して隠さず、問題時はvisual hierarchyとaction semanticsのどちらかへ再現条件を分ける。
- 全107 verifier / build / Browser 1280×720・700×720 / console error 0件、SOL final review=`A`で技術closeした。

### Phase 9g — QTP Palette / Tool / Preset selected ring（技術close後）

- 制作環境の明色 / 暗色Canvas周辺で、resting Palette / tool / preset cellが静かになっても現在色・現在tool・現在presetの橙ringを即座に読めることを確認する。cream / `#ffffee` / whiteの色chipがQTP背景へ消えないこと。
- hover / keyboard focus / selected / editing、Eraser系mode、Preset非対応tool、Main / Sub、slider、Text / Help / Position deckを見失わないこと。
- mouse / pen / touchで色、tool、preset、slider、QTP drag、close / reopenを確認する。問題時はPhase 9gを再OPENせずQTP cell hierarchy限定bug fixへ分離する。
- 全106 verifier / build / Browser fixture・production / console error・warning 0件 / 生成物清掃、SOL final review=`A`で技術closeした。

### Phase 9f — Animation Table quiet resting hierarchy（技術close後）

- 制作環境のwide / narrow / low-height / OS表示倍率で、通常28×24px / coarse 44×38pxの主playが最上位に見え、休止中SCOPE / PREVIEW / Onion / zoom / Asset / Motion / Copy / PasteがCanvasやClipより前へ出すぎないことを確認する。
- hover / keyboard focus / SCOPE・Range open / PREVIEW・Onion active / Motion keyがborderとsurfaceで復帰し、Selected Clip / Delete / closeの文脈を見失わないことを確認する。
- mouse / pen / touchでPlay / Stop、Table resize、header空白drag、header wheel、Lane wheel、grid wheel、close / reopenを確認する。問題時はPhase 9fを再OPENせずAttention Hierarchy限定bug fixへ分離する。
- 全105 verifier / build / Browser fixture・wide・700px narrow / console error・warning 0件 / 生成物清掃、SOL final review=`A`で技術closeした。

### Phase 9e — Animation Table compact primary playback（技術close後）

- 制作環境のwide / narrow / low-height / OS表示倍率で、主playが専用行を作らず第一header row中央付近にあり、FPS / FRAMES・SCOPEとRange / PREVIEW / Onionへ重ならないことを確認する。
- resting栗色面＋Futaba背景色抜き、hover / focus、playing橙、disabledが識別でき、Phase 9f後のnormal 28×24px / coarse 44×38pxの操作面をmouse / pen / touchで失わないことを確認する。
- Play / Stop、Loop、Range / I / O、SCOPE、PREVIEW、Onion、header空白drag、header wheel zoom、Lane wheel、grid wheel Frame±1、close / reopenを確認する。問題時はPhase 9eを再OPENせずPlayback first-row layout限定bug fixへ分離する。
- 全104 verifier / build / Browser wide・700px narrow / console error・warning 0件 / 生成物清掃、SOL final review=`A`で技術closeした。

### Phase 9d — QTP root / header component style boundary（技術close後）

- 制作環境のwide / narrow / low-height / OS表示倍率で、QTP外殻のrestrained border / radius / shadowとheader下のtransparent edgeがCanvas上で境界を失わず、過剰な横線競争だけを減らしていることを確認する。
- QTP自由drag、四隅Position、viewport resize、Q close / reopen、Help / Text排他、tool / 6 preset / Size / Opacity、mouse / pen / touchで寸法・位置・hit areaがPhase 9d前と同じことを確認する。
- 全104 verifier / build / Browser 1280×720・480×800、close / reopen 3回drift 0、console error / warning 0件、生成物清掃、SOL final review=`A`で技術closeした。問題時はPhase 9dを再OPENせず、QTP root/header skinまたはposition clampの該当surfaceだけに限定したbug fix Gateへ分離する。

### Phase 9c — Warm Canvas-first / Animation Table Playback skin（技術close後）

- wide / narrow / pen・touch環境で、通常32×28px / coarse 44×38pxの再生 / 停止がTable幅の中央主actionとして見え、Scope / Range / Preview / Onionと競合しすぎないことを確認する。
- Playback / Range groupの枠を弱めても、LAST CLIP等のsource、未設定I / O、設定済み`I F<n>` / `O F<n>`、Focus Deckのまとまりを見失わないこと。橙背景＋Futaba茶の再生中Play / OUT markerを暗色Canvas周辺でも読み分けられること。
- 長尺CAF、低height、Panel重なり、Table resize / close / reopen、Project reload、mouse / pen / touchでPlay / Stop、Range deck、I / O、wheel三領域が従来どおり動くこと。
- 全103 verifier / build / Browser 1280×720・480×800、console error / warning 0件、生成物清掃、SOL final review=`A`で技術closeした。QTP / Layer Panel skinは未適用であり、問題時はPhase 9cを再OPENせずPlayback skin限定bug fix Gateへ分離する。

### Phase 9a — Animation Table Playback Priority Hierarchy（技術close後）

- wide / narrow / pen・touch環境で再生 / 停止がAnimation Table幅の中央に見え、他のheader操作より主actionとして一操作到達できることを確認する。
- LAST CLIP / TIMELINE / OUT MARKERが通常のふたば系surfaceで読め、Setup青の設定actionに見えないこと。未設定I / Oは淡い独立panelで文字だけ、設定後は`I F<n>` / `O F<n>`として値との間隔が読めることを確認する。
- Scope、Loop、Preview、Onion、Zoom wheel、Timeline grid wheel、DURATION、LIB、Clip Copy / Delete、resize、close / reopenが従来どおり動くことを確認する。
- 全101 verifier / build / wide・narrow Browser、console error / warning 0件、SOL final review=`A`で技術closeした。問題時はPhase 9aを暗黙に再OPENせず、Playback header visual hierarchy限定bug fix Gateへ分離する。

### Phase 8y — QTP Canonical Shortcut Hint Coverage

- QTPのEyedropper / Pen / Eraser / Airbrush / Fill / Lasso Fill / Rect Selectionをmouse hover / keyboard focusした時、I / P / E / B / G / L / Mと説明が一致し、平常button面へkeyが増えていないことを確認する。
- mouse / pen / touchの通常tap、Q開閉、QTP drag / Position、Preset、Fill参照strip、Text、Colorが従来どおり一操作で使えることを確認する。
- Touch専用説明入口はPhase 8yへ含めていない。Phase 8zの明示read-only shortcut deckで扱い、Phase 8yを再OPENしない。
- 全99 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はQTP 7-tool canonical hint限定bug fixへ分離する。

### Phase 8z — QTP Touch Shortcut Help Reachability（技術close後）

- QTPを開いた状態でheaderの`?`へmouse / pen / touchで一操作到達し、Eyedropper / Pen / Eraser / Airbrush / Fill / Lasso Fill / Rect Selectionの7行と`I / P / E / B / G / L / M`がwide / narrow / coarseで読めることを確認する。
- deckはread-onlyの一時表示であり、開閉、再click、outside pointer、Escape、QTP close / reopenで閉じ、Position deckと同時表示されないこと。shortcutの実行、tool切替、History、Project保存が増えないことを確認する。
- deck表示中はその領域が一時的な説明面として入力を占有するため、背後の通常toolを使う場合は`?`を閉じてから従来どおり一操作で切り替わることを確認する。これはStage Bの意図したfocus境界であり、遮蔽が制作上問題ならclose前に限定UI修正へ戻す。
- QTP drag / Position、Preset、Text、Color、Canvas描画、QTP close / reopen、Project reload、mouse / pen / touch、console error / warning 0件を確認する。問題があればPhase 8zを暗黙に再OPENせず、deckの配置・閉じる境界・7行の正本投影を固定した限定bug fix Gateを立てる。
- SOL reviewでcompact幅のlabel clipを補正し、198px viewport clamp、coarse 24px hit、deck内drag遮断、全100 verifier / build / Browser、console 0件を通過してfinal review=`A`で技術closeした。本項はOwner制作確認の残りであり、問題時はPhase 8zを暗黙に再OPENせず限定bug fix Gateを立てる。

### Phase 8x — Canonical Shortcut Learning proof

- Settingsの「ショートカット」でPenが`P`と表示され、tool / edit / layer / animation / panelのglobal action一覧がscrollして読めることを確認する。
- QTP Pen buttonは平常面へkeyを常設せず、mouse hover / keyboard focusで`ペンツール · P`へ到達し、click / pen / touchの通常tool切替とQ開閉を妨げないことを確認する。
- Touch専用long-press説明は未実装である。通常tap二段化やCanvas gestureと競合させずに到達性が必要な場合はPhase 8xを再OPENせず、別のtouch help Gateで扱う。
- 全99 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はcanonical descriptor / Settings projection / QTP Pen hintの限定bug fixへ分離する。

### Phase 8w — QTP Progressive Density

- Pen / Eraser / Airbrushで6 presetが直接選択のまま表示され、Fill / Lasso Fill / Selectionでは非対応Preset sectionだけが退避することを確認する。
- Pen系へ戻した時に使用中slotとSIZE / OPACITYが維持され、COLOR / tool / Text / Position deck / Q開閉 / 自由dragの到達性が悪化しないことをwide / narrow / coarseで確認する。
- 全98 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はPhase 8wを暗黙に再OPENせず、QTP Progressive Density限定bug fixへ分離する。

### Phase 8v — QTP Position Preset

- QTP headerの四隅入口が位置commandとして読め、左上 / 右上 / 左下 / 右下へ移動後も自由dragで微調整できることを確認する。
- 1280×720 / 720×720、normal / coarse、Animation Table開閉、Q close / reopen、Project reload、mouse / pen / touchでCanvas遮蔽とviewport clampを確認する。
- 保存は従来のx / yだけで、Preset IDや利き手設定が増えていない。全97 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はPhase 8vを暗黙に再OPENせず、QTP Position Preset限定bug fixへ分離する。

### Phase 8u — Asset Library icon exposure

- Animation Table下段のAsset Library iconが「再利用Assetの入口」と読め、mouse / pen / touchで一操作開閉できることを確認する。
- wide / narrow、Clip未選択 / 選択、Asset 0件 / 複数件、Table close / reopen、Project reloadで開閉stateと内容が破綻しないことを確認する。
- 全96 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はPhase 8uを暗黙に再OPENせず、Asset Library Exposure限定bug fixへ分離する。

### Phase 8t — Selected Clip Duration context

- 単一かつ非Grouped Clip選択時にSelected Clip Action strip内へ`- / <n>F / +`が表示され、未選択、複数選択、Groupedで退避することを確認する。
- Clip edgeのright retimeと±の結果が一致し、1 Frame Clip、隣接Clip push、terminal key、Undo / Redo、Table close / reopen、Project reload、mouse / pen / touchで破綻しないことを確認する。
- `LIB`はPhase 8tで移動していない。後続Phase 8uで既存共通Asset Library iconの一操作入口へ限定変更した。
- 全95 verifier / build / Browser、SOL final review=`A`で技術closeした。問題時はPhase 8tを暗黙に再OPENせず、Duration Context限定bug fixへ分離する。

### Phase 8s — Playback Range full label / inline I / O

- Repeatの隣で`TIMELINE / LAST CLIP / OUT MARKER`が全称表示され、I / Oを現在Frameへ直接設定し、同Frameでもう一度押すと解除できることを確認する。
- wide / narrow、長尺Timeline、IN / OUT別Frame、OUT未設定警告、Focus Deckのkeyboard / outside close、Table close / reopen、Project reload、playback中変更、mouse / pen / touchを確認する。
- `DURATION` / `LIB`はPhase 8sで移動していなかった。後続Phase 8tでDURATIONだけをSelected Clip contextへ送り、LIBはPhase 8uへ分離した。
- 全94 verifier / build / wide・701px narrow Browser、SOL final review=`A`で技術closeした。問題時はPhase 8sを暗黙に再OPENせず、Playback Range Inline限定bug fixへ分離する。

### Phase 8r — QTP Pen Preset / Density（技術close後）

- Pen / Eraser / Airbrushで6 presetの直接click、tool別active slot、SIZE / OPACITY同期、adjacent循環を確認する。
- compact 136px / coarse 170px、QTP open / close / drag / reopen、Project reload、mouse / pen / touchでslot番号・size ring・active summaryが読め、非active focus previewがmutationなしでblur復帰することを確認する。
- Fill / Lasso Fill / Selectionではslotがdisabledかつ`not used`となり、clickしてもBrush値・History・保存が変わらないことを確認する。Phase 8qの`T / TEXT`、COLOR、tool grid、slider wheel / click、Q shortcutの順序とhit areaも回帰確認する。
- SOL final review=`A`、全93 verifier / build / Browserで技術closeした。問題時はPhase 8rを暗黙に再OPENせず、preset表示・focus・tool切替を固定した限定bug fix Gateへ分離する。

### 横断制作知見 — 一枚Raster / Mesh BONE / Auto Shape（2026-08-13）

確認済み:

- 一枚の人物Rasterへ`AUTO SHAPE`と11本のMesh BONEを設定し、Layer分割なしでも腕を肘から曲げ、他の手足を独立して動かせることをOwner制作操作で確認した。
- 曲げ角や手先の移動量によって、顔へ変形が漏れる、前腕／手先が細く・太くなる、意図以上に伸びる現象を確認した。現行の全Bone距離上位2本weightとLBS関節blendに対応する既知設計課題として、proposal 15の`Chain-local Joint Skin`候補へ記録した。

後続Gateで確認すること:

- 肩→肘→手首chainだけへ影響資格を限定し、顔、胴の遠隔部、反対肢がepsilon内で不動になること。
- 上腕／前腕の中央を剛体weight 1、肘近傍だけを親子blendとして、45° / 90° / 135°で幅、長さ、輪郭、triangle反転を比較すること。
- 伸縮は既定offとし、必要時だけ別のlimited stretchとして比較すること。weight可視化は顔等への微小漏れを発見できること。

Phase 7z Gate 1 / Stage B-Cで固定済み:

- pure fixtureではbranch外weight 0、rigid区間、短い親子joint band、45° / 90° / 135°の幅・長さ改善、triangle windingを通過した。曖昧な兄弟／別rootは無言選択せず生成を拒否する。
- 明示`AUTO SHAPE` / `SHAPE再生成`だけ新しい`SHAPE JOINT` weightを作る。既存Projectの旧`SHAPE FILL`保存weightは自動再生成しない。
- Browser軽量fixtureでは`SHAPE JOINT`生成、UndoでMeshなし、Redo復元、5秒緊急checkpoint後もCURRENT、Timeline grid wheel、console 0件を確認した。全69 verifier / build、SOL review=`A`で技術close済み。

Owner制作環境で追加確認すること:

- 既存の一枚人物Raster + 11 Boneを複製し、明示`SHAPE再生成`後に顔、胴の遠隔部、反対肢が不動になること。曖昧拒否が出る場合は対象vertex付近のBone配置と親子関係を記録する。
- 肩、股関節のようなoff-axis child joint、同じ親から複数の手足が分岐する箇所、肘／膝を45° / 90° / 135°にした輪郭を確認する。旧Projectは先に上書きしない。
- `SHAPE FILL`旧保存表示、`SHAPE JOINT`新生成表示、Undo / Redo、STALE / 再生成、Project reload、preview / playback / onion / random seek / Bake / GIF / APNG、console error、可能ならpen / touchを確認する。

本項はPhase 7zのOwner制作確認であり、Phase未完了を意味しない。問題が見つかった場合はPhase 7zを暗黙に再OPENせず、Raster、Bone tree、失敗vertex / surfaceを固定した限定bug fix Gateを立てる。read-only weight可視化はPhase 8aで技術closeし、多Bone表示密度はPhase 8bへ分離した。manual editingへ自動拡張しない。

### Phase 8a — Raster Skin Weight Diagnostics

- 一枚人物Raster + 多Boneの制作Projectで、Setup青`WEIGHT`をONにし、選択Boneの影響なし、微小漏れ、親子blend、rigid 1を読み分けられること。
- 顔、胴、反対肢へlow帯が出ないことと、肘／膝の45° / 90° / 135°でjoint bandが意図した範囲だけに出ること。旧`SHAPE FILL`と新`SHAPE JOINT`を比較する。
- 256 vertex級、暗色線画、pan / zoom、Space + drag、Bone / target切替、Layer追加 / 削除、Undo / Redo、CAF複製、Table close / reopenで操作遅延やstale overlayがないこと。
- Project reload後はWEIGHTがruntime OFFで開始し、preview / playback / onion / random seek / Bake / GIF / APNGの出力自体を変えないこと。console error、可能ならpen / touchを確認する。

本項はPhase 8aのOwner制作確認であり、Phase未完了を意味しない。表示値または対象が誤る場合はPhase 8aを暗黙に再OPENせず、Raster / Mesh / Bone / Frameを固定した限定bug fix Gateを立てる。manual weight編集へ直接広げない。

### Phase 8b — Animation Table Bone Group / Dense Rig Focus

- 一枚人物Raster + 11 Bone級で、同一target 2 Bone以上だけgroup見出しが出て、singleton targetは従来の1 Bone行のままか確認する。
- `SHARED / CONNECTION`、`UNASSIGNED`が別groupとして明示され、別Rasterへ勝手に吸収されないこと。active BoneとCtrl / Cmd選択KEY数が同時に見え、collapse / expand後も選択、Frame、Historyが変わらないこと。
- Layer追加 / 削除、Rig cascade、CAF複製、Undo / Redo、Table close / reopen、Project reload後にstale groupを残さないこと。長尺Table、狭いwindow、pen / touch、console errorも確認する。

本項はPhase 8bのOwner制作確認であり、Phase未完了を意味しない。問題が見つかった場合はPhase 8bを暗黙に再OPENせず、Asset / group / Bone / keyを固定した限定bug fix Gateを立てる。Canvas Bone自動非表示や保存Bone色へ直接広げない。

### Phase 8c — RIG / Motion対象focusと限定Skin補正

- 一枚人物Rasterで、Boneだけ作成した未接続状態ではMotion入力がdisabledになり、AUTO GRID / SHAPE / LINEの案内が理解できること。Skin接続後はMotionで絵が追従すること。
- RIG / Motion停止編集中は対象Rasterが通常表示、非対象Raster / Folderが半透明になり、対象tab / Bone切替、複数Raster、Folder target、CAF scopeで誤った絵を対象に見せないこと。preview / playback / onion / Bake / GIF / APNGの出力へ半透明focusが混ざらないこと。
- Setup青`CORRECT`でWEIGHTが同時に見え、stable vertexだけを選択できること。`BONE ONLY / PARENT BLEND / NO INFLUENCE`で顔への漏れ、肘／膝のblend、前腕等のrigid区間を制作上直せること。
- 同値補正History 0、実補正1 History、Undo / Redo、mode cancel、CAF複製、Project reload、source更新STALE、Table close / reopenを確認すること。
- 補正済みMeshのGRID / SHAPE / LINE再生成で確認が出て、cancelは非mutation、acceptは補正を明示的に置換すること。console error、可能ならpen / touchも確認すること。

本項はPhase 8cのOwner制作確認であり、Phase未完了を意味しない。問題が見つかった場合はPhase 8cを暗黙に再OPENせず、Raster / Mesh / Skin / Bone / vertex / Frameを固定した限定bug fix Gateを立てる。自由weight brush、第二Shape zone正本、multiple Mesh、DQS、stretchへ直接広げない。

### Phase 8d Stage B — 一枚Raster RIG onboarding

- 1 Frame CAFと伸ばしたCAFの両方で、未設定Laneの`RIG未設定: 未設`行 / cellがHistoryを増やさずtarget / Frame選択だけを行い、右RIGの`曲げRIG / 全体PIVOT / 親子RIG`またはCLIP MOTION内の明示`RIGを設定 >`からSetupへ入れること。
- 曲げる場合は`1. BONE追加 → 2. AUTO GRID → MOTION`だけで絵が追従し、未接続中は対象絵が通常濃度、key / Canvas dragは拒否、非対象絵だけが半透明になること。AUTO SHAPE / LINEで接続済みの場合もMotion可能であること。
- 絵を曲げない場合だけ`全体PIVOT`を使え、曲げBONE / Meshがある時は併用できないこと。
- 既存mixed stateを複製Projectで開き、`曲げBONEへ切替`の確認acceptで対象Raster Part / rigid Bone / 対応Motionだけが消え、未接続Mesh Boneが残ること。cancel、外部child接続中の拒否も確認する。
- Bone drag後にMOTION件数が1以上になり、絵全体の点線矩形ではなくBone overlayが操作対象になること。Undo / Redo、Table close / reopen、Project reload、console error、可能ならpen / touchを確認する。

本項はPhase 8d Stage BのOwner制作確認であり、macro Workspace shell選定の完了を意味しない。AUTO SHAPEを第一導線とする旧表示はStage CでAUTO GRID基準へ改訂した。

### Phase 8d Stage C — AUTO GRID基準導線 / WEIGHT復帰

- Mesh未生成のRasterで、仮の青いLayer名PIVOTがCanvasへ出ず、`1. BONE追加`で作成した明示BONEだけが表示されること。自動初期BONEやHistoryが増えないこと。
- BONE追加後は`2. AUTO GRID`だけが太いSetup青境界で強調され、`2. 絵へ接続`という別actionに見える文言がないこと。AUTO SHAPE / LINEは選択肢として残ること。
- 未接続Motionの`RIGを設定 >`がHistoryを増やさずRIG Setupへ移り、そこで`2. AUTO GRID`からSkin接続でき、Motionへ戻ってBone dragで絵が追従すること。Shape / Lineで接続済みの場合もMotionが阻害されないこと。
- 接続済みMotionの`WEIGHT確認`で、選択Boneを維持してRIGのWEIGHT診断へ戻れること。GRID人体fixtureで脚Boneが手へ与える微小weightを発見できること。
- Undo / Redo、Table close / reopen、Project reload、console error、可能ならpen / touchを確認すること。自由Weight brushとMesh point編集は本項の受入条件にしない。

2026-08-20 Owner初期確認では、一枚Raster、6 Bone、AUTO GRID 6×6、Motion key、WEIGHT可視化までを制作操作し、Phase 8d closeに十分な初期受入とした。深い制作Project、reload / export、pen / touch、branch漏れの補正品質は継続確認とし、close済みPhaseを未完了扱いにはしない。

### Phase 8e Stage 1 — Motion中のread-only WEIGHT

- Skin接続済みBoneをMotionで選択し、RIGへtab移動せず`WEIGHT表示`をON / OFFできること。
- Bone drag、数値scrub、Frame±1 / random seekで、選択Boneを維持したheatmapがcurrent pose上で追従すること。Motion key値やHistory件数をWEIGHT表示が変えないこと。
- WEIGHT ONでもBone操作、Space + drag、Timeline wheelを妨げず、`CORRECT`や頂点mutationはMotionへ露出しないこと。
- playback開始 / 停止、Table close / reopen、source / target削除、Project reload runtime OFF、console error、1280×720 / narrow、可能ならpen / touchを確認すること。
- 形状追従Mesh最適化、point追加・triangle切断、自由Weight paintはPhase 8e Stage 1の受入条件にしない。

2026-08-20のSOL Browser fixtureでは、一枚Raster → 2 Frame CAF → BONE → AUTO GRID 4×8 → Motion → `WEIGHT表示` → X数値変形を通し、Motion tab維持、current pose追従、再生中一時非表示、F1復帰後の`WEIGHT ON`復帰、console error / warning 0件を確認して技術closeした。本台帳の深い制作Project、Bone drag / random seek、close / reopen、reload、narrow、pen / touchは継続確認であり、Phase未完了を意味しない。

### Phase 8j — Fixed-topology Skin Weight Brush

- 一枚人物Raster + 複数BoneのAUTO GRID / AUTO SHAPE CURRENT Meshで、Setup青RIGの`WEIGHT → BRUSH`を使い、ADD / SUB、radius、strengthで顔・反対肢への漏れと肘／膝の勾配を制作上直せること。Motion側にmutation操作が出ないこと。
- 長いstrokeでもHistory一件、no-opは0件、Escape / pointercancel / 外release / target変更 / Table closeは開始前へ戻ること。ADD / SUBのclamp、Undo / Redo、CORRECTとの排他、Space + dragを確認すること。
- STALE、AUTO LINE、playback、active Folder WARP / rigid競合ではmutationせず、次操作が理解できること。補正済みGRID / SHAPE再生成では確認が出て、cancelはweightを維持すること。
- CAF / Raster複製、source / target / Bone削除、Project reload、preview / playback / onion / random seek / Bake / GIF / APNGで同じ既存Skin weightが使われること。長尺／多Bone、console error、可能ならpen / touchも確認すること。

2026-08-20のSOL Browserでは、空の一枚Rasterから2 Bone + AUTO GRID 6×6を作成し、BRUSH ADD / SUBが各一件のHistoryとなり、Undo / Redoと`GRID 6×6 · WEIGHT`表示が一致することを確認した。全83 verifier / build、SOL final review=`A`で技術closeした。深い制作Projectと上記横断項目は未確認であり、問題時はPhase 8jを暗黙に再OPENせず限定bug fix Gateを立てる。Manual Topology、AUTO LINE brush、Motion中authoring、DQS、stretchへ同時に広げない。

### Phase 8k — Existing Raster Mesh Vertex Position Edit

- 一枚人物RasterのAUTO GRID / AUTO SHAPE CURRENT Meshで、Setup青RIGの`MESH EDIT`から既存頂点を一つずつ輪郭・関節へ合わせられること。stable vertex ID、triangle、Skin weightが維持され、Motion側やAUTO LINEへ編集入口が出ないこと。
- source bounds外、triangle反転 / degenerate / overlapになるdragがHistoryを増やさず開始前へ全rollbackし、理由が制作上理解できること。no-op、Escape、pointercancel、外release、target / tab / mode切替、Table closeも同じcancel境界になること。
- CORRECT / BRUSH / PIVOTとの排他、Space + drag、Undo / Redo、GRID / SHAPE再生成の明示確認、STALE、clipping / Folder WARP / rigid競合の拒否を確認すること。
- CAF / Raster複製、source / target / Bone削除、Project reload、preview / playback / onion / random seek / Bake / GIF / APNGで既存Skin evaluatorと同じ編集Meshが使われること。256 vertex級、多Bone、console error、可能ならpen / touchも確認すること。

2026-08-21のSOL BrowserではAUTO GRID 6×6の36頂点表示、1頂点dragのHistory一件、`EDITED`表示、Undo / Redo座標一致、bounds外dragのHistory 0 / 全rollback、PIVOT復帰、Table close / reopen、console error / warning 0件を確認した。全86 verifier / build、SOL final review=`A`。Owner制作確認はPhase未完了を意味せず、問題時はPhase 8kを暗黙に再OPENせずRaster / generator / vertex / triangleを固定した限定bug fix Gateを立てる。point追加、triangle split / delete、edge編集、全面manual topologyへ同時に広げない。

### Phase 8l — QTP restrained-depth / semantic surface

- OwnerはQTPのrestrained-depth外観を実機で受入済み。full-width `TEXT TO RASTER`の占有、FONT / SIZE label、縦書き、Windows local font導線はPhase 8lの未完了ではなくproposal 14の別Text Gateで扱う。
- 残る確認は狭幅 / 低height、QTP drag / close / reopen、mouse / pen / touchで19px / coarse 24px hit areaを維持し、淡い絵／暗い絵でも外殻、hover / active / focusを識別できること。問題時はPhase 8lを再OPENせずcomponent限定bug fixを立てる。

### Phase 8m — Animation Table SCOPE Focus Deck

- SOL Browserでは1280×720 / 720×720でSCOPE現在値一button、anchored Focus Deck、keyboard、再click / focusout / outside pointer close、History 0、console error 0件を確認し、全88 verifier / buildとSOL final review=`A`で技術closeした。
- Owner制作確認では長尺CAF、Panel重なり、低height、mouse / pen / touch、close / reopen後の`ALL / LANE / SET`復帰を確認する。Monitor / Repeat / `I / O`等の省スペース案はPhase 8mの不具合ではなくPhase 8nの比較Gateとして扱う。

### Phase 8n — Playback Glance icon / marker semantics

- SOL BrowserではSCOPE Focus DeckのkeyboardとHistory不変、Loop ON / OFF、IN / OUT設定・解除、onion `0..4`循環、1280×720 / 720×720、狭幅overflowなし、console error / warning 0件を確認し、全89 verifier / build、SOL final review=`A`で技術closeした。
- Owner制作確認では長尺CAF、低height、Panel重なり、Project close / reopen、mouse / pen / touchでMonitor＋現在値、Repeat Off、設定済み`I / O`、onion countが誤読されないことを確認する。問題時はPhase 8nを再OPENせずPlayback header限定bug fixを立てる。onion過去 / 未来の別設定やPlayback Rangeは未実装の別Gateである。

### Phase 8o — Selected Clip Context Action strip

- SOL Browserでは単一 / 複数選択、Group / Ungroup、選択解除、空Frame Paste、Clip限定Delete、Undo、Table close / reopen、narrow resize、console error / warning 0件を確認し、全90 verifier / build、SOL final review=`A`で技術closeした。
- Owner制作確認では長いAsset / Layer名、多数Lane、長尺CAF、Clip move / retime直後、Lane-only delete、Project close / reopen、mouse / pen / touchでstripがstaleにならず、Pasteが選択なしでも到達できることを確認する。問題時はPhase 8oを再OPENせずSelected Clip Action限定bug fixを立てる。long press専用化や旧button削除は未実装の別Gateである。

### Phase 8p — Animation Table Playback Range Focus Deck

- SOL Browserでは閉状態summary、Timeline / Last Clip / OUT marker、IN F1 / OUT F4、OUT未設定警告、Arrow / Escape / focus復帰、outside close、narrow resize、console error / warning 0件を確認し、全91 verifier / build、SOL final review=`A`で技術closeした。
- Owner制作確認では長尺CAF、低height、Panel重なり、Project close / reopen、playback中の変更、IN > OUT補正、totalFrames短縮、scope別Last Clip、mouse / pen / touchでsummaryと実再生終端が一致することを確認する。問題時はPhase 8pを再OPENせずPlayback Range限定bug fixを立てる。Timeline直接range handleは未実装の別Gateである。

### Phase 8q — QTP Text Entry / Panel Density

- SOL BrowserではOPACITY後の62px `T / TEXT`、open panel 124px内、FONT / SIZE label overlapなし、Rasterize / Ctrl+Enter / Cancel、History / Undo / Redo、Q close / reopen、console error / warning 0件を確認し、全92 verifier / build、SOL final review=`A`で技術closeした。
- Owner制作確認では長文 / 複数行、日本語 / ASCII、Sans / Serif / Mono、8〜256px、BOLD / current color、QTP drag、低height / 狭幅、Project close / reopen、PNG / PSD、mouse / pen / touchを確認する。問題時はPhase 8qを再OPENせずQTP Text Entry限定bug fixを立てる。vertical text、local font、再編集可能Textは未実装の別Gateである。

### Phase 8h — Animation Table SCOPE inactive / focus

- ALL / LANE / SETの押せるinactiveがdisabled風に薄く見えず、active橙、hover、keyboard focusのFutaba茶outlineを識別できること。
- narrow、Table resize、header wrap、mouse / pen / touch、wheel三領域でheader寸法や操作が変わらないこと。

2026-08-20のSOL Browserではinactiveを3.91:1から4.81:1へ補正し、ALL / LANE / SET選択、inactive SET focus、ALL復帰、全80 verifier、buildを通過して技術closeした。

### Phase 8g — UI Semantic Contrast / Focus shell active

- CLIP MOTION expandedの`DETAIL`が淡い橙背景＋茶文字、compactの`CANVAS`がcream背景＋茶文字となり、active / compact / focus-visibleを見失わないこと。
- 1280×720 / narrow、長いLayer名、RIG / Motion / WARP往復、popup drag後、pen / touchで文字・橙border・focus ringが視認できること。

2026-08-20のSOL Browserでは`DETAIL` activeを1.15:1から9.36:1へ限定補正し、expanded / compact / RIG切替 / keyboard focus-visible、全80 verifier、buildを通過して技術closeした。Table inactive controlは同時変更せずPhase 8hへ分離した。

### Phase 8f Stage 2 — CLIP MOTION Canvas-first Focus shell

- 一枚人物Raster / 6〜11 BoneでRIG / Motionの`CANVAS`を押し、mode、target、BONE追加、AUTO GRID / SHAPE / LINE、Motion key、WEIGHTを残したままCanvas可視面が増えること。
- `DETAIL`でbind数値、親select、Motion secondary数値が戻り、selected CAF / Layer / Bone、Frame、Motion key、WEIGHT ON、Table zoom / scroll、Canvas pan / zoomが変わらないこと。
- compact要求中にWARPへ切り替えると詳細固定になり、RIG / Motionへ戻るとcompactが復帰すること。CLIP MOTION close / reopen、Table close→通常描画→reopen、Project reload runtime初期値も確認する。
- 1280×720 / narrow、長いLayer名、11 Bone密集、popup drag後のviewport resize、Q / V / H、Space + drag、wheel三領域、console error、可能ならpen / touchを確認する。

2026-08-20のSOL BrowserではRIG約180.9px→134.9px、Motion約95.3px、720×720の4px margin内clamp、WARP往復、close / reopen、通常ペン復帰、console 0件を確認して技術closeした。Ownerの制作Project確認は未実施であり、問題時はPhase 8fを暗黙に再OPENせず限定bug fixを立てる。

### Phase 7i — Auto Shape LINE / Ribbon

- 適合する細長いalpha fixtureでAUTO LINE成功、0° / 45° / 90°、preview / playback / onion、random seek。
- GRID / SHAPE / LINE相互再生成、STALE / rebase、Table close / reopen。
- 腕、髪束、交差線、分岐、閉輪郭等の制作sampleで成功 / 拒否理由を記録し、LINEの実受理率と理由messageの次操作が理解できるかを確認する。
- 現在と異なるgeneratorをpen / touchで誤って押す頻度、`再生成`表示・status・Undoで十分に回復できるか、連続再生成時のHistory / memoryを確認する。実測前にmodal確認は追加しない。
- 制作Project、pen / touch、console error。

### Phase 7j — Deformer SELECT Stage 2

- Control MeshとFolder別WARPでRECT / CIRCLE / POLY、複数点move、Undo / Redo。
- 制作Project、pen / touch、Table close / reopen、console error。

### Phase 7k — Text to Raster

- 通常制作Projectでzoom / pan後のviewport中心配置、日本語 / ASCII / 複数行。
- Project reload、PNG / PSD、狭幅、pen / touch。CAF working Layerでは拒否されること。

### Phase 7l — Animation Table二段header

- 液タブ制作環境で1280px相当 / 狭幅の配置、設定から実行への左→右導線、Setup青 / 実行橙。
- header zoom、Lane上下、Timeline gridのFrame±1 wheel三領域、resize保存、close / reopen。

### Phase 7m — Motion Graph Viewer

- 長尺CAFで5 group、key / boundary / cursor、random seek / playback、Table close / reopen。
- narrow / low viewport、無効target、Clip外`OUT`、console error。

### Phase 7n — Resize Preview Direct Framing

- 通常Layer / CAF snapshotを含む制作Projectで「内容」drag / wheel / align / Apply。
- Undo / Redo、Project reload、mode離脱、close / reopen、pen / touch。

### Phase 7o — Motion Easing Preset Palette

- 制作Projectで単独 / Ctrl・Cmd複数Motion key、terminal混在拒否、Undo / Redo。
- Project reload後のpreset再識別、CUSTOM curveとの往復、random seek / playback / Graph表示。

### Phase 7p — Motion Easing Clipboard

- 制作ProjectでHOLD / LINEAR / CUSTOMを別Motion key・別ClipへCOPY / PASTEし、Motion値が変わらないこと。
- Ctrl / Cmd複数選択、terminal混在拒否、Undo / Redo、Table / Curve close-reopen、長尺CAF、pen / touch。

### Phase 7q — Motion Graph Key Navigation / Easing Bridge

- 長尺CAFで5 groupのexplicit key markerをmouse / pen / touchとkeyboardで選択し、Timeline、Graph cursor / status、CLIP MOTION数値、Canvas previewが同じFrameへ同期すること。
- implicit boundary / path / grid / cursorではseekせず、再生中はmarker activationとEASING編集を拒否し、Historyが増えないこと。
- HOLD read-only Curve、terminal disabled、Graph / Curve / Table close-reopen、random seek、narrow / low viewportでheader操作が重ならないこと、console error。

### Phase 7r — Motion Graph Existing-Key Value Editing

- 長尺CAFでPOSITION / SCALE / ROTATION / OPACITY / BLENDの既存explicit key値dragを確認し、channel切替、Canvas / CLIP MOTION数値 / Graph表示の一致、random seek / playbackを確認する。
- Undo / Redo、drag cancel / Escape / pen / touch、Graph / Table close-reopen、Project reload、console error。
- narrow / low viewport、外release、Owner制作Projectでの複数Clip・長尺データを確認する。問題があればPhase 7rを再OPENせず、再現条件に応じた限定bug fix Gateへ分離する。

### Phase 7s — PixiJS v8.19 Compatibility

- 最新ChromeでrendererがWebGLのまま起動し、通常描画、消しゴム、clipping / inverse、Layer visibility、zoom / pan、Undo / Redoを確認する。
- Animation Tableでpreview / playback / onion、WARP / Mesh、Bake、GIF / APNGをsmokeし、Project save / reloadと表示・export結果が一致することを確認する。
- console error、制作Project、端末別GPU、pen / touchを確認する。Phase 7sのSOL close時はCodex側Browser制御transportがTegaki起動前に閉じたため、この実操作は未通過である。
- 問題があればPhase 7sを暗黙に再OPENせず、再現fixtureと影響surfaceを固定した限定bug fix Gateを立てる。WebGPU / Canvas rendererや8.19新機能採用へ同時に広げない。

### Phase 7v — Motion Gesture Cancel / No-Move History

- Motion数値scrubでtap、4〜5pxのstep 0、実値drag、clampで元値不変、pointercancelを比較し、Historyが順に0 / 0 / 1 / 0 / 0となることを確認する。
- Canvas root Motionでtap / 2px未満move / 実drag / 元位置へ復帰 / pointercancel / 外release / Escapeを確認し、実変更pointerupだけHistory 1、cancel系は表示とkeyが開始前へ戻ることを確認する。
- POSITION / ROTATION / SCALE / OPACITY / BLEND、Shift directional transform、Easing数値scrub、Undo / Redo、playback中拒否、Table close / reopen、Project reload、console errorを確認する。
- mouseに加えて可能ならpen / touchで確認する。Phase 7vのSOL close時はCodex側Browser制御transportがpage操作前に閉じたため、この実操作は未通過である。
- 問題があればPhase 7vを暗黙に再OPENせず、gesture種類とevent順を固定した限定bug fix Gateを立てる。

### Phase 7w — Motion Graph Guarded ADD POINT

- Motion GraphでSetup青`ADD POINT`をONにし、POSITION / SCALE / ROTATION / OPACITY / BLENDの空白位置へ途中点を追加する。追加Frameへcursorが移動し、active channelだけが指定値、他channel / Easing / blendModeが挿入前と一致することを確認する。
- LINEAR / HOLD / EASE各種、explicit / implicit境界、部分key、Undo / Redo、random seek / playback、Table / Graph close-reopen、Project reloadを確認する。
- 既存key、Clip端、正確に分割できない`STRONG IN-OUT` / `CIRCULAR IN-OUT`中央付近でHistory 0の理由付き拒否となり、別FrameまたはLINEARの案内が出ることを確認する。
- mouse / pen / touch、狭幅 / 低height、青Modeの視認性、EASING / group / channelとの導線、console errorを確認する。Phase 7wのSOL close時はCodex側Browser制御transportがpage操作前に閉じたため、この実操作は未通過である。
- 問題があればPhase 7wを暗黙に再OPENせず、curve control、左右key Frame、insert Frameを固定した限定bug fix Gateを立てる。

### Phase 7x — Motion Graph Multi-Key Value Drag

- TimelineまたはGraph markerでCtrl / Cmd複数Motion keyを選択し、Graphの選択済みanchorを縦dragすると同一Clip Motion keyのactive一channelだけが同じdisplay deltaで変わること。未選択anchorは単独dragになること。
- POSITION X / Y、SCALE X / Y、ROTATION、OPACITY、BLENDで、他channel、Frame、Easing、blendModeが維持されること。opacity / blend clamp、一部clamp、全clamp no-opを比較する。
- WARP / Bone / Partを混ぜたTimeline選択で異種keyを変更・解除せず、Graph上はMotion keyだけに橙ringと選択数が投影されること。
- tap / no-op / cancel / lost capture / EscapeはHistory 0、実変更pointerupはHistory 1。Undo / Redo、random seek / playback拒否、Table / Graph close-reopen、Project reload、mouse / pen / touch、console errorを確認する。
- Phase 7xのSOL close時はCodex側Browser制御transportがpage操作前に閉じたため、この実操作は未通過である。問題があれば本Phaseを暗黙に再OPENせず、Clip ID、選択Frame、channel、clamp状態を固定した限定bug fix Gateを立てる。

### Phase 7y — Motion Easing Overshoot / Back

- `BACK IN / OUT / IN-OUT`とcustom OvershootをPOSITION / SCALE / ROTATIONへ適用し、通常0..1 Easingとの差、random seek / playback / preview / onionを確認する。OPACITY / BLENDは常に0..100%へ留まること。
- EASING CURVEの`ALLOW OVERSHOOT` OFFでY=0..1、ONでY=-1..2、Xは常に0..1であること。Back preset / Easing paste / Project reload時は青Modeと標準0..1帯が正しく表示され、Yを0..1へ戻すまでMode OFFを拒否すること。
- Motion値COPY / PASTEとEasing専用COPY / PASTEの両方でBack curveを維持し、Motion値またはEasing以外を上書きしないこと。Ctrl / Cmd複数選択、Undo / Redo、Table / Curve / Graph close-reopenを確認する。
- Motion Graph `ADD POINT`は正確に分割できるBack位置だけ成功し、表現範囲外または非active OPACITY / BLEND clampで同値を失う位置はHistory 0の理由付き拒否になること。
- Bake / GIF / APNG / Project reload、制作Project、mouse / pen / touch、console errorを確認する。Phase 7yのSOL close時はCodex側Browser制御transportがpage操作前に閉じたため、HTTP dev smoke以外の実操作は未通過である。
- 問題があればPhase 7yを暗黙に再OPENせず、curve 4値、左右key Frame、active parameter、失敗surfaceを固定した限定bug fix Gateを立てる。

## close根拠

Phase 7i〜7rは各指示書のGate=`GO`、最終SOL review=`A`、関連Browser確認を完了した。Phase 7sはGate=`GO`、SOL review=`A`、全59 verifier、production build、dev ESM graph 151 module / runtime 8.19.0、生成物清掃を通過したが、Codex側Browser制御transportのblockerにより実操作は未通過である。Phase 7t / 7uは運用導入とbuild dependency更新のため別の限定runtime / build smokeでcloseした。Phase 7v / 7w / 7x / 7yは全62 / 63 / 64 / 65 verifier、production build、SOL review=`A`を通過したが、同じBrowser transport blockerにより実操作は未通過である。Phase 7s / 7v / 7w / 7x / 7yのBrowser項目は本書へ分離し、通過済みとは扱わない。
