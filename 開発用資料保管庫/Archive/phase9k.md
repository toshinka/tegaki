# Phase 9k — Integrated Outer Shell Luminance / Theme Comparison Gate

作成日: 2026-08-27

状態: CLOSED — Gate 0=`GO — D: Floating dark rails`、Owner visual受入、SOL final review=`A`

## 1. 目的

Phase 9jで分離したtheme / component境界を使い、Canvasと中心視Panelの淡色を維持したまま、外周と左右railの明度関係を統合比較する。Current warm、低彩度umber外周、半透明umber外周、淡色外周＋暗色floating rail、暖色中間外周＋淡色railを同じDOM・状態・絵で比較し、図地分離、狭さ、可読性、長時間制作、描画負荷のどれを優先するかをGate 0で決める。

本Phaseは全面dark mode実装Phaseではない。fixture比較とproduction適用を分離し、Ownerが選定したDだけを左右operation railへ限定適用する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9j.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
9. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
10. `ClaudeReview/gui-skin-redesign-revision-2026-08-25.md`
11. `ClaudeReview/color-philosophy-background-panel-icon-balance.md`
12. `tegaki_work/styles/main.css`
13. `tegaki_work/styles/components/sidebar-rail.css`
14. `tegaki_work/styles/components/layer-panel-surface.css`
15. `tegaki_work/styles/components/quick-access-popup.css`
16. `tegaki_work/styles/components/animation-table-playback.css`

## 3. Stage A inventory

- `body` / `.canvas-area`は`--futaba-background`を共有し、Canvasと外周の明度差がほぼない。
- 左Sidebarは`--ui-surface-rail`、右control railは`--ui-layer-surface-rail`を持つが、左右を同一theme setとして切り替える上位tokenはまだない。
- QTP / Layer Panel / Animation Tableは中心視で文字・thumbnail・操作精度を扱うため、現行warm surfaceを比較基準として固定する。
- Phase 9jでLayer / Folder / CAFのstatic appearanceとruntime geometryは分離済み。第二rendererや保存stateなしでfixture比較できる。
- 現行paletteのmaroonは文字・icon・stateの小面積では十分なcontrastを持つが、大面積背景へそのまま使わない。新候補はfixture内だけの低彩度umberとする。

## 4. Gate 0比較案

- A Current warm: 現行の淡い外周と左右rail。軽さと開放感のbaseline。
- B Opaque muted umber shell: 左右railとCanvas外側だけを低彩度umberへし、QTP / Layer / Animation Table / Canvasは淡色を維持する。図地分離を優先する。
- C Translucent muted umber shell: Bと同じ役割分担で透過率を下げ、狭く感じる壁感を緩和する。blurは別変数としてoff / smallを比較し、広範囲へ決め打ちしない。
- D Floating dark rails: 外周は淡色のまま、左右の小面積操作railだけを低彩度umber＋淡色iconへする。Canvas最大化時にも操作面を失わず、暗色面積を限定するCallipeg型の比較。
- E Warm-mid surround + light rails: Canvas外側を暖色中間明度へ下げ、左右railは淡色＋Futaba茶iconを維持する。既存semantic色への負担を抑えながらCanvas境界を作るSimple Mode型の比較。
- Layer Panelだけのcontrolled inverse、pure black / white、全面maroon、全Panel同時dark化は比較対象にしない。

## 5. Stage A最初の限定Slice

1. 同一DOMで左Sidebar、右rail、QTP、Layer Panel、Animation Table、Canvasを含む五案fixtureを作る。
2. 明るい絵、暗い絵、高彩度の絵を同じ位置へ置き、1280×720、720×720、narrowで比較する。
3. resting / hover / active / selected / disabled、Setup青、Motion橙、破壊赤の状態を各案へ同時表示する。
4. candidate umber、opacity、blurはfixture局所tokenに置き、`main.css`のproduction paletteへ追加しない。
5. verifierでCanvas / Panel淡色固定、左右rail＋外周の同時切替、theme / save state未追加を固定する。

## 6. Gate後の評価

- SOLがfixtureとBrowser screenshotを比較し、明度境界、文字 / icon contrast、Panelの浮き方、narrowの圧迫感を判定する。
- Ownerは可能な時に30分程度の制作でA〜Eを比較し、Canvas↔rail視線移動、狭さ、疲労、暗い絵 / 明るい絵の読みやすさを確認する。D / Eは外枠なしを基準とする。
- 半透明 / blurをproduction候補へ上げる場合だけ、Long Task、Frame落ち、GPU / compositing負荷を固定入力で確認する。

## 7. Acceptance Criteria

- fixtureは同じDOM / 寸法 /操作状態で、theme tokenだけを変える。
- Canvas、QTP、Layer card、CAF card、Animation Table contentは淡色warmを維持する。
- B / Cは左Sidebar、右control rail、外周背景を一体で変更する。Dは左右railだけを同じdark token setへ、Eは外周を同じwarm-mid token、左右railを同じlight token setへ揃え、左右で別文化にしない。
- Setup青、active橙、warning / destructive赤の意味を変えない。
- Stage A fixtureではproduction DOM / CSS / event / ARIA / hit area / Project / History / save / modelを変更しない。Gate 0後のProduction Sliceは共通rail tokenと状態CSSだけを変更する。
- fixed verifier、Browser wide / square / narrow、console、必要時だけ負荷測定を行う。

## 8. No-go

- production dark mode、theme picker、Project / localStorage保存flag。
- Canvas色、作品色、thumbnail samplingの変更。
- QTP / Layer Panel / Animation Tableの全面反転、left Sidebar tool順 / icon / behavior変更。
- 新しいrender layer、第二UI engine、第二data adapter、appearance専用model state。
- 大面積`backdrop-filter`の計測前採用、pure black / white / neutral gray中心palette。
- production Animation Table footer化、inline SVG集約、Rig / Mesh / WARPの同時改修。Table utilityの上部集中 / bottom分離はfixtureだけで比較する。

## 9. model分担

- Stage A inventory、umber候補、明度 / contrast、左右統合境界、Gate 0、Owner比較設計、close: SOL / XHigh。
- Gate後に候補token、対象selector、opacity / blur値、Acceptance Criteriaが固定されたfixture / CSS限定Slice: LUNA / MAXへ委譲可。
- production theme state、保存schema、DOM / adapter / behavior判断が必要になった場合はLUNAで広げずSOLへ返す。

## 10. Stage A実施記録

- `build/phase9k-integrated-outer-shell-fixture.html`を追加した。一つのDOMをtheme tokenだけでA Current warm / B Opaque muted umber / C Translucent muted umberへ切り替える。
- 1280×720 / 720×720 / 420×720、Light / Dark / Vivid art、resting / hover / active / selected / disabled、Setup青 / Motion橙 / destructive赤を同じfixtureへ固定した。
- Canvas、QTP、Layer Panel、Animation Tableは三案とも同じ淡色tokenを使う。B / Cだけが左Sidebar、右control rail、外周背景を一体で変更する。
- Cだけ`blur: off / small 6px`を分離比較できる。blurはproduction候補へ採用しておらず、負荷測定もGate 0後まで行わない。
- `build/verify-integrated-outer-shell-fixture.mjs`でone DOM、三theme、三viewport、三art、左右rail共通token、中心Panel固定、production sourceへのcandidate state非流入を固定した。
- BrowserではA wide / Light、B wide / Dark、C narrow / Vivid、C blur off / smallを操作した。720×720 / 420×720とも全surfaceがshell内へ収まり、fixture URLのconsole warning / errorは0件だった。

### SOL preliminary visual判定

- Aは軽さと開放感が最も高いが、Canvasと外周の明度境界は弱い。
- Bは中心PanelとCanvasの図地分離が最も明確だが、広い不透明umberが壁として見え、wide / narrowとも重さが増す。
- CはBより壁感を緩め、淡色Panelの可読性も維持する。背後の色と狭さに見え方が依存するため、短いfixture観察だけでproduction値を決めない。
- technical Gateは`GO`。三案を同条件で比較でき、productionへ候補stateは流入していない。
- Gate 0 visualは`HOLD — Owner制作環境比較待ち`。OwnerがA / B / Cを確認するまでproduction CSS、theme picker、保存flagへ進まない。

## 11. Stage A2 semantic contrast calibration

- B / Cの暗いrailへ現行light-surface用Setup青`#2f67a8`、Motion橙`#d86228`、destructive赤`#a63a32`をそのまま置くと、graphical object基準の3:1を下回ることを検出した。不透明railでは約1.02〜1.77:1、半透明Mid railでも約1.33〜2.32:1となる。
- fixture内だけに同じsemantic hueのon-dark候補を追加した。Setup`#9fc6f2`、Motion`#ffc08a`、destructive`#f3aaa2`。中心視Panelでは従来semantic tokenを維持する。
- on-dark候補は不透明railで3.45〜4.09:1、半透明Soft / Mid / Deepの二種類の明るいunderlayを含むworst caseでも最低3.58:1を維持する。通常rail glyphのcreamは6.46:1以上。
- CのalphaをSoft 56% / Mid 70% / Deep 82%へ分け、rail alphaも72% / 82% / 90%へ連動させた。C以外ではalpha controlとblur controlをdisabledに戻す。
- BrowserでBのon-dark三semantic色、Cの三alpha、Current復帰、420×720全surface収容、console warning / error 0件を確認した。
- 全110 verifierと`npm.cmd run build`を通過した。build生成物は追跡済み基準へ戻し、production CSS / theme stateへの差分は残していない。
- SOL preliminaryではSoftは外周境界が弱く開放感寄り、DeepはBに近い壁感、Midが比較上の中間候補。ただしproduction値の採用ではなく、Owner Gate 0の比較材料とする。

## 12. Stage A3 floating rail / warm-mid surround / Table utility

- Owner提示のCallipeg型は「全面dark」ではなく、Canvasを広く保ち、左右の小面積操作railだけを暗色floating surfaceへするD案として追加した。外周はCurrent warm、railは低彩度umber＋淡色icon、Setup / Motion / destructiveはStage A2のon-dark候補を使う。
- CLIP STUDIO PAINT Simple Mode型はE案として、暖色中間外周`#b9aaa0`＋淡色railを追加した。淡色rail上では現行Setup / Motion / destructiveが最低3.50:1、通常Futaba茶glyphが10.40:1を維持する。
- 外枠は`Gap only`を既定とし、比較位置を見失う場合だけ`Outline guide`へ切り替える。これはfixture guideであり、production outer frameを新設しない。
- Animation Tableは同じDOMで`Top stack`と`Bottom split`を切り替える。再生 / SCOPE / RIG / MOTIONを上、Timeline zoom / Selected Clip情報 / COPY / DELETEを下へ分けるBottom splitを既定比較にした。wheel、Clip gesture、event、ARIAはfixture外のproductionで変更していない。
- BrowserでD / E、Gap only / Outline guide、Top stack / Bottom split、wide / narrow / vividを切り替えた。420×720でも左右rail、QTP、Layer Panel、Animation Table、Canvasはshell内へ収まり、console warning / errorは0件。
- SOL preliminaryではDが暗色面積を最も抑えつつ左右railを一文化でき、現行の軽さと透過感を残す第一比較候補。Eは既存semantic色を維持しやすい安全案だが、中間色の大面積がDより密度を感じる。Bottom splitは機能の文脈分離に有効だが、production適用はtheme Gateと分離した限定Sliceで扱う。

## 13. Gate 0 Owner判定とProduction Slice 1

- Ownerは候補Dを第一production候補として選定した。不足が制作確認で見えた場合だけEを再比較する。よってGate 0=`GO — D: Floating dark rails`。
- Production Slice 1は左Sidebarと右Layer operation railだけを共通dark surfaceへ変更し、通常glyphをcream、Setup / Motion / destructiveをon-dark semantic tokenへ揃える。fixtureの低彩度umberは比較用に限定し、production色はOwner follow-upでFutaba paletteから導出する。
- Canvas、workspace背景、QTP、Layer / CAF card、Animation Table contentは現行warm-light surfaceを維持する。DOM、tool順、icon、event、ARIA、hit area、Project / History / save / modelは変更しない。
- active / popup-openはactive橙surface＋淡色glyphへ一方向にまとめ、hoverは暗色面上の小面積light overlayだけ、disabledは既存opacityを維持する。
- 右railはLayer Panel card本体から分離済みの`.layer-controls-row`だけを対象にする。Layer / CAF cardの反転は本Sliceへ含めない。
- rail表示切替 Gate=`FROZEN — dark rail production調整を優先`。暗色railを現行skinの正本として詰め、Settings UI、theme picker、Project / localStorage保存flag、自動画面判定は追加しない。将来、新しい制作上の不足が実測された場合だけ別Gateとして再検討する。
- Animation Table utilityのBottom splitはDと独立した導線Sliceとして扱い、本Sliceへ混ぜない。

### Production Slice 1 実施結果

- `styles/main.css`へ左右共通`--ui-rail-*`を追加し、既存`--ui-surface-rail / --ui-layer-surface-rail`を同じdark surfaceへ接続した。中心視surface tokenは変更していない。Owner follow-upではproduction surfaceを独立umberから`--futaba-light-maroon`の上端98%→下端88% gradientへ変更し、ふたば色の連続性、上端の安定感、下端の透過感を両立した。
- `styles/components/sidebar-rail.css`はrest / hover / focus / popup-open / pressed / disabledをon-dark階層へ接続した。`styles/components/layer-panel-surface.css`は`.layer-controls-row`内だけを同じ文化へ揃え、Layer / Folder / CAF cardを反転していない。
- Browser 1280×720で左右railの同一Futaba light-maroon半透明surface、通常cream glyph、QTP popup-open時の橙active＋淡色glyph、borderなしhover、右operation hover、destructive hover、QTP / Layer card / Canvasの淡色維持を確認した。console warning / errorは0件。
- `build/verify-integrated-outer-shell-production.mjs`を追加し、左右共通token、center surface非流入、contrast、geometry / interaction非変更、theme state未追加を固定した。全111 verifierと`npm.cmd run build`を通過し、dist / `.vite`生成差分は清掃した。
- 状態は`HOLD — Owner production短時間確認待ち`。Dで不足がなければSOL final review後closeし、不足があればproductionを広げずE fixtureを再比較する。

## 14. Owner follow-up: Futaba rail / focus復帰 / 後続境界

- production railは`linear-gradient(180deg, light-maroon 98%, light-maroon 88%)`を正本とする。上端は安定したdark rail、下端は透過感を明示する。Owner案の下端82%は明るいart上でSetup青2.65:1、旧trash橙2.95:1となるため、全semantic色がgraphical contrast 3:1以上を保つ88%を下限とした。fixture B / C / Dのmuted umberは比較記録として残すが、production paletteへ昇格しない。
- dark railの外側shadowは`none`とし、淡色面で有効だった存在感用blurを暗色面へ持ち込まない。透過はrail backgroundだけに限定し、enabled trashはactive橙へ少し寄せた不透明on-dark橙`#ffb87e`、SVGも`opacity / stroke-opacity: 1`を正本とする。この色は両端alphaと三種artの最悪値で3.17:1を保つ。
- restingは淡色glyph、hoverは18%の淡色surfaceだけ、active / popup-open / pressedは橙surface＋`--futaba-background` glyphへ整理した。activeでcream面＋橙border＋暗色railを同時競争させず、focus-visibleだけkeyboard位置を橙outlineで残す。
- pointer / penでSidebar toolを起動した後はbutton focusを解放し、次のSpaceをCanvas cameraへ返す。keyboard生成clickはfocusを維持し、Enter / Spaceによるbutton操作を壊さない。`.main-layout`は非編集text選択を抑え、input / textarea / contenteditableだけ選択可能に戻す。
- Browserではpointer click後の`document.activeElement=BODY`、直後のSpaceでpopup再toggleなし、keyboard focus中のSpaceでpopup toggle維持、hover / active computed style、非編集textの選択なし、console warning / error 0件を確認した。Space＋dragのCamera handler自体は変更していないため、Ownerはmouse / penで一度だけ実gestureを確認する。
- follow-up後に変更JSの`node --check`、全111 verifier、`npm.cmd run build`を再通過した。build生成hash assetと追跡済み`dist`基準差分だけを限定清掃し、`dist / node_modules/.vite`へ生成差分を残していない。
- 前回rail follow-upではBrowser computed styleで左右とも88→95% gradient、`box-shadow: none`、enabled trash / SVGとも`rgb(255, 192, 138)`・`opacity: 1`を確認し、console warning / errorは0件だった。関連4 verifier、全111 verifier、production buildを再通過し、生成dist差分を個別清掃した。
- 今回のOwner follow-upでは左右railを98→88%へ広げ、trashを`#ffb87e`へ寄せた。Browser computed styleは左右とも98→88% gradient / shadowなし、trash / SVGは`rgb(255, 184, 126)`・opacity 1、hoverは同色border＋16% surfaceで、console warning / errorは0件だった。関連4 verifier、全111 verifier、production buildを再通過し、追跡済みdist / `.vite`基準を復元、生成hash 5件を個別清掃した。
- 右Layer / CAF card本体のdark化、CAF header / internal Layerの簡素化、CAF順序や階層操作をAnimation Tableへ寄せる案、CAF間cut / copy / pasteは別の設計Gateとする。`1 UI engine / 2 data adapter`、Timeline / ClipAsset / DrawingSnapshot正本、History / saveを変えず、static fixtureで情報量と操作責務を比較してからPhase化する。

## 15. Owner受入とSOL final review

- OwnerはFutaba light-maroon 98→88% gradient、shadowなし、enabled trashの不透明on-dark橙`#ffb87e`を短時間実表示で受入れた。暗色surround上では同じ数値の橙が淡色surround上より沈んで知覚されるため、現在値をさらに弱めずproduction正本とする。
- 同時対比はcontrast計算の代替にしない。同一橙・同一grayでも周辺明度で知覚上の強さが変わることをactual surrounding surfaceで比較し、必要ならon-light / on-dark semantic tokenを分ける。ただし状態は色の錯視だけに依存せず、surface / outline / icon shape / labelを併用する。
- 関連4 verifier、全111 verifier、production build、Browser computed style、console warning / error 0件、dist / `.vite`生成物清掃を再監査した。production DOM / event / ARIA / hit area / Project / History / save / modelの追加変更はない。
- SOL final reviewは`A`。Phase 9kをcloseする。mouse / pen / touchでの長時間制作、明暗art横断、Sidebar tool直後のSpace＋dragはOwner制作確認台帳へ残し、不具合が出た場合はPhase 9kを再OPENせず限定bug fix Gateを立てる。
- 後続はRight Layer / CAF Focus simplificationを独立設計Gateとする。Animation Table Bottom split、Panel全面dark化、theme切替、自動art samplingは混ぜない。
