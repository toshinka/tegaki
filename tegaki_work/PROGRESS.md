# Tegaki Progress

更新日: 2026-07-14

## 現在地

- Phase 5aから5rまで完了。
- Phase 5rではLane visibilityの保存・preview/playback/export除外、閉Table Timeline onion、閉Table再生、Frame/Lane/CAF内部Layerの操作契約、PSDアクティブCAF初期選択を完了した。
- オーナー実機でLane visibility、PSD record順、通常再生のCanvas反映を確認済み。
- Phase 5sを完了。viewportの既存一経路を維持したまま、Lane並べ替えHistory、FPS連動の秒境界、compact Frame indicator、複数Laneを跨ぐドラッグ＆ドロップを確認した。
- Lane順変更はドラッグ＆ドロップ専用とし、余分な▲▼buttonを撤去した。`reorderLaneTo()` はLane D&Dの単一経路として維持する。
- Phase 5tを完了。Ctrl/Cmd複数選択、通常activeと選択集合の表示分離、相対Lane/frameを維持した原子的一括移動、衝突全体拒否、単一History Undo/Redoを実装した。
- オーナー実機で複数Laneを跨ぐ一括移動と、障害CAFがある場合に全件移動しないことを確認済み。
- Phase 5uを完了。複数CAF copy/pasteとCAF Groupを同じ相対配置payload・原子的一括配置へ載せた。
- Phase 5u Slice 0を完了。単体pasteはClipAsset/DrawingSnapshotを複製する独立コピーで、clipboardはruntime UI state、貼付け結果だけがproject保存対象となる契約を確認した。
- Slice 1で複数payload、相対Lane/frame paste、選択内Asset共有関係の維持、衝突/Lane不足の全体拒否、単一History Undo/Redoを実装した。単体paste回帰とproject round-trip確認が残る。
- Slice 2でTimeline直下のCAF Group、隣接連結判定、folder button、作成/解除、member click全体選択、History、保存復元を実装した。非連結選択はdisabled理由を表示する。
- 単体paste回帰、Group作成/解除/Undo/RedoはBrowser確認済み。Group paste時に新Group IDを払い出す処理を追加し、実操作確認が残る。
- オーナー実機でGroup移動・copy/pasteを確認済み。同一Lane連続Groupは外周破線へ統合し、Group中の個別retiming handle、↔、Duration ±を無効化した。
- Browserで中央memberからの一括D&D、Duration不変、中央member削除時の自動解除、Undo復元を確認した。Project保存は既存 `TimelineModel.serialize()` / constructor経路で `clipGroups` をround-tripする。
- CAF Groupの時間比率伸縮はTegaki側では原則実装しない。将来の別動画WEBUI側でkeyframe/retimingを正本にし、整数FrameへbakeしたCAF列を戻す長期案としてロードマップへ記録した。
- Phase 5vを開始。Folder blend完全合成は低優先度で棚上げし、Folder clippingを優先する。Slice 0でCAF `clippingMode` 3状態契約の回帰と通常Folder属性のProject保存欠落を修復する。
- Phase 5v Slice 0を実装。CAF `clippingMode` のモデル/serialize/toggle/clipboard/working Layer/preview alpha契約を復元し、通常Folderの `blendMode / clippingMode` をProject保存へ追加した。BrowserでCAF Folderの通常/逆、Undo/Redo、console errorなしを確認済み。実Project round-tripが残る。
- Phase 5v Slice 1でCAF Folder target/sourceの半透明alpha、inverse、source不在/空/非表示時の透明化、Folder merge後mode維持を実装した。Phase 5u `clipGroups` のProject serialize欠落も修復した。
- 後続はFolder visibility、Layerの直下Folderをclip sourceにする経路を優先する。Folder add/multiply/overlayは子へ伝播せずgroup全体へ適用する要望として監査し、完全group RenderTextureが必要なら低優先度の別Sliceへ送る。
- 通常Folder visibilityを配下Pixi Layerへ反映し、Folder直上Rasterのclip sourceとして配下可視Raster alphaを束ねるmask Container経路を追加した。固定入力、BrowserのFolder D&D/eye往復/clipping ON、node check、build、console errorなしを確認済み。
- オーナー実機報告から、mask ContainerではFolder配下Rasterが実maskへ反映されず、alpha乗算で半透明化する問題を確認した。通常/CAFのclip alphaを二値シルエットへ統一し、Folder sourceを単一textureへ合成する経路へ置換した。通常Folder card/属性popupのclip buttonと、Folder配下全Rasterを下位きょうだいsourceで切り抜くtarget経路も追加した。
- node check、build、二値alpha固定入力、BrowserでFolder clip buttonのnormal切替とconsole errorなしまで確認済み。Folder内複数Rasterのsource/target、inverse、Project round-tripはオーナー実機確認待ち。
- Folder target内部maskが通常Layer一覧へ混入する回帰を修正し、内部maskをowner Folder配下へ隔離した。mask resourceは専用poolで再利用し、OFF後の再ON、Album保存、Layer数不変、console errorなしを確認した。
- CAF化後のTable展開中/閉後でFolder clipping契約が変わる問題を修正した。CAF owner/source/Folder子孫解決を共有helperへ集約し、working Layerへ表示用mode/source ID群を橋渡しする。Frame compositorも二値maskへ統一した。
- Browserで通常Folder target構成をCAF化し、Table展開中と閉後の表示一致、Folder階層/clip ON維持、console errorなしを確認済み。上位LayerからFolder sourceを使う複合構成は固定入力済みで、オーナー実機確認が残る。
- CAF Folder clip切替時の遅延を調査し、working Layer契約の再計算漏れと、previewでcache確認前に全Canvasを再走査する重複を修正した。PREVIEW中のworking mask生成はidleへ送り、通常表示へ戻す前にflushする。
- 単一CAF LayerのV変形確定は対象Layerだけをsnapshot更新する。Browserの400×400複合CAFでclip切替、clip状態の再生、単一Layer V変形、console errorなしを確認した。
- Folder一括V変形は原子的rollbackのため全対象焼込みを維持する。巨大Canvas×多数Layerでは高コストになり得るため、既存size preflightを維持し、非同期分割は中規模History改修候補として棚上げする。
- Table previewのFolder node欠落、全非表示時の旧snapshot fallback、working実効visibilityのCAF正本への逆流を修正した。internal構造revisionをpreview keyへ含め、D&D/eye変更はFrame切替なしで反映する。
- Tableの一時runtime visibilityをclipping source正本から分離し、Folder target抑制解除時は元の表示を復元する。stroke開始時の不要な全mask再生成も除去した。
- Vドラッグ中はPixi transformを毎入力へ反映し、DOM/イベント/thumbnail副作用だけを1 animation frameへ集約した。CAF名single click選択とdouble-click renameも両立した。
- BrowserでTable展開中stroke反復、CAF名single/double click、console errorなしを確認済み。オーナー実機でVキー保持中のXY/回転/拡縮の体感再確認が残る。
- 高Hz penのcoalesced sample処理は全入力点と筆圧を維持し、RenderTextureへの同期描画だけを1 pointermove 1回へ集約した。Animation Table全面のbackdrop blurも撤去した。
- オーナー実機ではPC再起動後に通常/Table展開時のpen描画とVキー移動が滑らかへ復帰した。長時間ブラウザ/GPU状態またはHUION Kamvas 22 Gen 3ドライバの一時状態が関与した可能性があり、アプリ変更単独の効果とは断定しない。
- Ctrl/Cmd複数選択とCAF Group選択を原子的な一括削除へ接続した。BrowserでGroup/未Group各3件の一括削除、ボタンとAlt+Delete、Undo/RedoによるGroup・選択集合復元、console errorなしを確認済み。
- オーナー実機で複数選択CAFとCAF Groupの一括削除を確認済み。
- ProjectManagerの固定入力で通常Folderのparent/children、visibility、blend、normal/inverse clippingをexport/load往復確認し、CAF内部Folderもanimation serialize/TimelineModel復元を確認した。
- CAF inverse Folder sourceの複数Raster子孫、source非表示・削除・D&D順変更後の再探索を固定入力で確認した。Browserでは2 Frame描画のTimeline onion暖色表示、8 FPS再生/停止、GIF 1–2 Frameの400×400プレビューBlob生成、console errorなしを確認済み。
- オーナー実機で、実描画を持つ複合Folder構成の保存・再読込と出力に問題がないことを確認した。
- 大量Frame時にTimeline zoom controlが水平scrollbarを覆う問題を修正し、controlをheader rightへ移した。Timeline縮小は33%まで拡張し、60%未満ではFrame番号だけを隠して秒境界を維持する。Browserで240 Frame、通常幅/543px狭幅、33%/40%/47%/60%、scrollbar非重複、console errorなしを確認済み。
- Phase 5vを完了。Folder group blend完全合成はdirty group RenderTextureを要する別Phase候補として棚上げする。
- Overlay高度blend自体は登録済み。通常Folderが空Containerのため配下groupへ作用しないことが原因で、完全group effectはdirty group RenderTextureを要する低優先度Sliceとして残す。
- Phase 5wを開始する。既存ClipInstanceの静的transform、未定義形のtransformKeyframes保存枠、compositorの静的描画経路を監査済み。最初はkeyframe schemaとhold / linear samplingを固定し、position / scale / rotationを同一Frame契約へ載せる。
- Phase 5w Slice 0でClip-local 0-based Frame、同一Frame後勝ち、範囲外無視、欠損parameter継承、rotation radian、左keyのhold / linear契約を純粋sampling helperへ実装し、TimelineFrameCompositorへ接続した。rotationは負値と360°超の連続回転を保持する。固定入力とbuildは完了し、Browser実操作が残る。
- Phase 5w Slice 1の保存経路を監査。Project serialize/constructor、単体・複数CAF copy/paste、CAF Group paste、Timeline History snapshotは既存の `transformKeyframes` clone経路でround-tripする。固定入力でProject JSON、Group、旧Projectのkeyframe無し互換を確認済み。Browserでcopy/paste・Undo/Redo・保存再読込の実操作確認が残る。
- Phase 5w Slice 2で選択CAF・現在Frameへtransform keyを追加/削除する独立MOTION windowを追加した。position、scale、rotation（UI degree / 正本radian）、hold / linearだけを既存Timeline History経路で編集し、Clip範囲外では無効化する。Table headerはsquare-activity iconの入口buttonだけとし、編集面をbody直下へ分離した。開閉は共通popup CSSと競合しない明示display制御を使う。Browserで入力・補間・Undo/Redoの実操作確認が残る。
- MOTION windowは共通 `attachPopupDrag()` を使う移動可能popupへ揃え、closeを1個へ正規化、数値色をふたばmaroonへ統一した。key入口はmap-pin icon、Timeline上は明示motion keyを小markerで表示し、旧snapshot白丸は撤去した。60%未満ではmarkerを省略し、単Frame CAFではmotion編集を無効化する。
- 静的transformを暗黙のClip始点/終点とし、中間key後は終点へ戻るsamplingへ更新。Table preview、閉Table再生、Timeline onionのPixi previewにも同じsample結果を適用した。固定入力で最終Frame X=26/R=10°への補間と、中間Y=20から終点0への復帰を確認済み。
- MOTION数値変更後もcurrent Frameを維持し、再生・Timeline移動中は選択CAFのsample値をwindowへ追従表示する。pin active色、form focus/selection色、native number spinner撤去、Scale X/Yの説明を追加した。回転中心のVキー十字site共用と、MOTION外の灰色/黒form control全体監査はproposal 09の後続項目へ記録した。
- 右端retimingでは旧終端の明示motion keyだけを新終端へ追従し、中間keyはFrame位置を維持する。preview用retiming snapshotにもkeyframeを含め、キャンセル/可否判定でmotion正本を変えない。Clip Motion shortcutはV変形との意味対応を優先してShift+Vとし、両modeは同時表示しない。
- MOTION window active中のCanvas直接操作を追加。dragはscreen→world差分によるposition、wheelは縦横scale、Shift+wheelは5°単位rotationとして現在Frame keyへ入る。Canvas eventをcaptureして操作中だけ描画/Camera入力を止め、1 drag / 1 wheel burstを各1 Historyへまとめる。V変形のgesture量・scale上限を踏襲し、raster transform stateは共有しない。
- 共通 `transform-anchor-site` を追加し、MOTION locate buttonはClipInstance.transform.anchorX/Y、V locate buttonはLayer transform anchorへ同じCanvas十字dragを接続した。V panelの左右/上下反転はcenterline SVG、resetはrotate-ccw SVGへ変更。MOTION windowは共通popup自動close追加の対象外としてclose重複を防ぐ。
- anchor変更時は `(I - rotationScale) * pivot差分` をX/Yへ補正し、変更前後の表示matrixを不変にする。site表示は現在transform後のpivot、pointer位置はinverse matrixでlocal anchorへ戻す。V bake正規化でもanchorX/Yを保持し、preview/確定座標を一致させた。anchor mode中はCamera全面guideを隠して短い十字siteだけを表示する。Vの4 SVG操作は横一列・共通active配色へ整理した。
- 回転中心siteはV / CLIP MOTIONを開いた時点からpassive表示し、locate button ON中だけdrag可能にした。全面の縦横guideは表示せず、centerはLayerまたはClip単位で1つ、Canvas外座標も許可し、Frame keyを自動作成しない。MOTION fieldsは1行配置へ整理し、LINEAR / HOLDのhover説明を追加。CAFのV変形中は「原画編集・合成モーション一時非表示」を明示する。
- V panelの旧縦配置を起動時注入していた `ui-panels.js` の重複CSSを撤去し、4 SVG buttonを `main.css` の横一列へ統一した。Browserでpassive/active site、MOTION 720px一列、Vとの排他表示、console errorなしを確認済み。Canvas外anchorは固定入力でmatrix不変を確認した。
- V panelを `LAYER TRANSFORM` ヘッダー付きのcompact構成へ整理し、CLIP MOTIONと変形系popupの外観classを共用した。中心編集時は共通site横へ終了方法を示す追従hintを表示する。BrowserでV / MOTIONの排他、compact寸法、hint非重複、LINEAR / HOLD説明、console errorなしを確認済み。
- CLIP MOTIONのFrame key / 回転中心buttonをheaderへ移し、入力列を約488pxへ詰めた。Frame keyは丸marker対応のcircle、Clip単位anchorは将来Bone rootを想起できるhead付き楔形siteとし、Vキー十字siteとは表示だけを分けた。
- Phase 5wを完了。position / scale / rotation、hold / linear、anchor、Canvas操作、preview/playback/onion、copy/paste、Undo/Redo、旧Project互換を同じClipInstance正本へ接続した。Project JSON round-tripは固定入力済み。大容量Albumへの追加実操作は既存約105MBデータで長時間化したため再試行しない。
- Phase 5xを開始。Animation Tableの右方向キーによる空Frame CAF自動生成を設定checkboxで無効化できるようにし、既定ONを維持した。BrowserでOFF時はF3へ移動してもCAF 1件、ON時はF4に2件目を生成、Undoで1件へ復帰、設定再表示でOFF保持を確認した。後続は共通form/controlのふたばカラー監査とする。
- Phase 5x Slice 1を開始。CLIP MOTION header actionをLAYER TRANSFORMと同じ `flip-button` 外観へ揃え、現在Frameにkeyがある時はcircleからtrashへ切り替える。Clip pivotのheadを中心、0°tailを上向きとし、tailはsampled rotationへ追従する。
- Motion / VのShift+drag主方向判定と適用計算を `transform-math.js` の純粋helperへ共用化した。横dragはrotation、縦dragはuniform scaleで、通常dragのpositionとwheel契約は維持する。Boneのrest axis / tail長と個別Motion key clipboardはproposal 09へ送り、既存Rotation入力やClipInstance正本へ混ぜない。
- BrowserでMotion / Layer Transform header actionが同じ28×24px・同じふたば配色、0°tail上向き、90°tail右向き、key有りtrash / 削除後circle、FPS inputのspinnerなし・橙focus枠を確認した。Shift+dragは共通helper固定入力で横60→+1.2rad、縦-40→scale 1.4、反転scale符号維持を確認した。
- Phase 5xを完了。Clip pivotは楔形SVGだけをsampled rotationへ追従させ、中心編集hintは回転の影響を受けず水平表示する。Animation Libraryのrename、Folder / Asset action、blank、disabled、Lane追加controlを既存ふたばpaletteへ統一し、Browserでcomputed styleとconsole errorなしを確認した。
- Phase 5yを開始する。最初はCAF clipboardと分離したruntime Motion-key clipboardを監査し、単一keyの値だけをcurrent Clip-local Frameへ1 Historyでcopy / pasteする。複数key、Bake、subframe、opacity / easing、Bone / meshは混ぜない。
- Phase 5y Slice 0-1を実装。Motion key clipboardはruntime UI stateだけに `position / scale / rotation / interpolation` を保持し、source Clip ID / FrameやProject JSONへ混ぜない。CLIP MOTION headerのcopy / paste、current Clip-local Frameでの同Frame置換、既存Timeline Historyの1操作Undo / Redoへ接続した。Browserとオーナー実機でbutton経路、HOLD、720°、disabled条件を確認済み。shortcutはCAF / Layer clipboardのdocument captureと数値input focusが競合するため採用せず、明示buttonを正式入口とする。
- Phase 5yを完了し、Phase 5z1を開始。選択Clipに2件以上あるMotion keyを一括消去するheader buttonを追加し、静的transform / anchorを維持したまま1 Timeline Historyで空配列へ置換する。Browserで3 key作成、一括消去、Undo / Redo、再生中disabled、console errorなしを確認済み。次はMotion / CAF / Layer共通のcopy feedback経路を監査する。
- Phase 5z1を完了。Motion / CAF / Layer copyを種別・件数だけ表示する共通toastへ接続し、Project保存通知も同じhelperへ統合した。BrowserでCAF / Motion表示、自動消去、ARIA status、console errorなしを確認し、Layer複数件文言は固定入力済み。Phase 5z2ではopacityをClip Motionの最初の表現parameterとして監査する。
- Phase 5z2を完了。Clip Motion opacityを既存transform samplerへ追加し、静的既定1、0..1 clamp、欠損継承、hold / linearをTimelineFrameCompositorとTable previewの既存alphaへ乗算する。UIは0-100%、Motion clipboardはv2へ更新し、v1貼付けはopacityを変更しない。固定入力・Project round-trip・build、実描画CAFの100/50/0%、HOLD、再生、Timeline onion、Project保存download、console errorなしを確認した。
- Phase 5z3を完了。「OL」はOVERLAYへ統一し、Clip MotionへNORMAL / ADD / SUBTRACT / MULTIPLY / OVERLAYを追加した。modeは左key HOLDの離散値、`blendStrength` は0..1（UI 0–100%）のhold / linear連続scalarで、指定blendで合成するClipのopacityとする。CAF内部Layer合成後の完成Clipへ適用し、Layer blendとClip blendは順番に両方作用する。Motion windowは二段化し、Rotationを幾何変形の上段へ、pivot/BORNをkey button直後へ移動した。Motion metadata変更時のpreview cache無効化とcached texture解除を追加し、旧NORMAL/Strength表示が残る回帰を修正した。clipboardはv4。animation exportとの見た目一致は実制作中の継続確認へ移す。
- Phase 5z4を開始する。Animation TableのFPS / FRAMESをkeyboardなしでも変更できるnumber入力wheel操作と、Table上のwheelによるTimeline移動を対象にする。既存のnumber入力、縦Lane scroll、Shift+wheel横scroll、Ctrl/Cmd+wheel zoomを壊さず、操作契約を先に監査する。
- Phase 5z4 Slice 1でFPS / FRAMESとCLIP MOTIONのnumber inputへhover / focus中のwheel 1 step調整を共通bindingで追加した。field上ではTable scrollへ伝播せず、Ctrl/Cmd/Alt、disabled、read-onlyは奪わない。custom▲▼ / slider popupは重複実装せずpen実機で不足が出た場合へ送り、独自sliderのLAYER TRANSFORMは`SliderUtils`監査後の候補とする。
- Phase 5z4 Slice 2-3でTable Timeline領域の通常wheelを横scrollへ変更し、Lane名側だけ縦scrollを維持した。Quick SIZE / OPACITY、Layer Panel Frame表示、Table / Layer Panel Timeline onion数、Layer card opacityも既存更新正本へwheel操作を接続した。Lane onionはON/OFFのまま、LAYER TRANSFORM独自sliderは未変更。
- BrowserでQuick SIZE 10.0→10.5px、OPACITY 100→99%、Layer Panel Frame F1→F2、Timeline onion前後数1→2のTable / Layer Panel同期、Timeline通常wheelの横scroll 0→約240px・縦位置不変、console errorなしを確認した。Layer card opacityは表示時だけ有効な既存card経路へ限定し、compact表示を増やさない。
- Phase 5z4 Slice 4でTable viewportの通常wheelを全域横scroll、Shift+wheelをLane縦scrollへ整理した。Timeline onionは0=非表示、1～4=前後数の既存正本をwheelでも往復する。
- Transform popupは外観とactionだけを揃え、入力密度は用途別に維持する。CLIP MOTION number inputへ横drag scrubを追加し、6pxごとにfield固有stepをライブ反映、pointer終了時に1 Historyへまとめる。LAYER TRANSFORMはpen向け可視sliderを維持する。BrowserでX 0→10、Undo 1回でkey無しへ復帰、onion 0→1→0、console errorなしを確認した。
- Lane panel上の通常wheel縦scrollを復活し、Timeline側通常wheel横 / Shift+wheel全域縦を維持した。Lane onionはwheel上=ON / 下=OFF。LAYER TRANSFORM直接入力はnative灰色spinnerを茶系▲▼へ置換し、CLIP MOTION Rotationには次 / 前の45°倍数へ揃える常設▲▼を追加した。BrowserでLane縦scroll、331→360 / 315、Lane onion往復、Transform 0→1、console errorなしを確認済み。
- Phase 5z4を完了。FPS / FRAMES、Motion / Quick / Layer数値wheel、Timeline横 / Lane縦scroll、Timeline / Lane onion、Motion number scrub、Rotation 45°snap、Transform茶系stepperまでBrowser確認済み。記録は `開発用資料保管庫/Archive/phase5z4.md`。
- Phase 5z5を開始する。最初は既存transform key全read / write経路を監査し、左key区間のcubic-bezier easing schema、欠損linear互換、hold無視、純粋samplingを固定する。preset / graph UIはsamplingとround-trip確認後、mesh / morphはPhase 6へ分離する。
- Phase 5z5 Slice 0-1でcubic-bezier easingの純粋helperを追加した。左keyがlinear区間を所有し、holdは無視、欠損 / 不正値は旧linear、control pointは0..1とする。Newton法に二分探索fallbackを持ち、同じratioをposition / scale / rotation / opacity / blendStrengthへ適用する。
- Project / History / CAF・Group copy / retimingは既存の汎用key cloneでmetadataを保持する。数値編集、Canvas gesture、anchor rebaseの明示key再構築もeasing保持へ修正し、Motion clipboardはv5へ更新した。旧v1〜v4貼付けは貼付先easingを維持する。固定入力とnode checkは完了し、round-trip補強と最小preset UIが残る。
- Phase 5z5 Slice 2-3でProject / History相当復元、CAF / Group clone、retiming終端key、preset / customの固定入力を補強した。CLIP MOTIONへ `LINEAR / EASE IN / EASE OUT / EASE IN-OUT / HOLD` を追加し、未知curveはCUSTOM表示で保持する。
- BrowserでEASE IN-OUT始点とX=120終点の中間Frame X=50.6449、preset変更Undo、curve付きMotion key copy / paste、panel横幅内、console errorなしを確認した。
- 再生開始時にTimeline選択を解除する既存契約でMotion表示対象も失っていたため、windowが開いている場合だけ開始時Clip IDをdisplay-onlyに退避した。F6 X=50.6449から再生し、F11 X=118.0511への数値追従とconsole errorなしをBrowser確認した。Phase 5z5の実装残件は解消し、graph / waveform editorは後続とする。
- Phase 5z5を完了し、記録を `開発用資料保管庫/Archive/phase5z5.md` へ移した。Phase 5z6は同じcubic-bezier正本を小型別windowで編集するcurve editorとし、単一区間・0..1・pointerup 1 Historyへ限定する。
- Phase 5z6 Slice 0-1を実装。CLIP MOTIONの現在keyが所有する右区間を、独立した移動可能な `EASING CURVE` windowで編集する。0..1 graph、2 control handle、X1/Y1/X2/Y2入力は既存 `key.easing` だけを更新し、画面Y反転とclampは純粋helperへ集約した。
- preset選択はhandleへ同期し、custom値は既存selectのCUSTOM表示へ戻る。明示keyなし、HOLD、Clip終端keyは理由付きdisabled。再生中は区間を所有する左keyのcurveをread-only表示し、途中Frameで空表示になる回帰を修正した。
- drag中は既存previewをlive更新し、pointerupで1 Timeline History、pointercancelで開始状態へ復元する。固定入力、Project相当save/restore、Motion clipboard、build、Browserのpreset/HOLD/終端/Undo/Redo/再生read-only/copy-paste/配置を確認し、ペン・マウスのhandle dragとCUSTOM切替もオーナー実機確認済み。Phase 5z6を完了し、記録を `開発用資料保管庫/Archive/phase5z6.md` へ移した。
- Ultra監査でAnimation Table欄外Raster欠落を、初回CAF capture前の未確定V変形、TimelineFrameCompositorのtransform前crop、CAF mergeのunion bounds欠落へ分離した。現行Phase 5z7はcapture / composite順を修正し、live preview / playback / exportを一致させる。
- Canvas ResizeではProject frame変更がRenderTextureを破壊的cropする経路、CAF正本とworking adapterの分裂、Cameraの無条件再中心化を確認した。これはPhase 5z8の非破壊Resize transaction / Camera分離へ送る。Motion Graphは別proposalで段階管理する。
- opacity、色補間、easing、Perform、簡易warp / morph、bone、WebGPU brush、水彩・油彩はPhase 5wへ混ぜず、`proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md` で段階管理する。

## 維持する契約

- Animation Table上では上側LaneをCanvas前面とする。
- stroke中の選択CAFは実working Layerで表示し、他CAFとonionだけをsnapshot previewへ回す。
- previewは非表示stagingで完成させてから一括交換する。表示中containerを空にして順次addしない。
- PixiJS v8の `removeChildren()` 戻り順を再利用しない。移送前の `children.slice()` の順を維持する。
- preview container順は `background -> back preview -> currentFrameContainer -> front preview` とし、同じ親上の連続 `setChildIndex()` へ戻さない。
- Lane onion / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。通常LayerSystemは配列順をそのまま、前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。

## 許容している残り

- CAF切替時に0.1秒未満の表示再構成が見える場合がある。stroke中の安定を崩してまで追わない。
- StrokeQualityFilter、墨・水彩的な蓄積、WebGPU brushは実機必要性と計測結果が出るまで保留。
- PSD全CAF一括export、通常LayerへのPSD import、CAF編集状態から通常モードへ戻す明示操作は未実装。
- Phase 5z7は初回CAF capture、compositorの最終crop、CAF merge union bounds、oversized working restore guardを扱う。Canvas Resize / CameraはPhase 5z8、Motion Graph / Motion Pathは後続proposalへ分離する。

## 資料

- Phase 5q完了: `開発用資料保管庫/Archive/PHASE5Q_CLOSEOUT_2026-07-10.md`
- Phase 5q表示順の技術記録: `開発用資料保管庫/Archive/PHASE5Q_PREVIEW_ORDER_NOTES.md`
- Phase 5t完了: `開発用資料保管庫/Archive/PHASE5T_CLOSEOUT_2026-07-11.md`
- Phase 5u完了: `開発用資料保管庫/Archive/PHASE5U_CLOSEOUT_2026-07-11.md`
- Phase 5v完了: `開発用資料保管庫/Archive/PHASE5V_CLOSEOUT_2026-07-13.md`
- Phase 5z6完了: `開発用資料保管庫/Archive/phase5z6.md`
- Motion Graph設計: `開発用資料保管庫/proposals/10_Motion_Graph・Easing・Motion_Path設計.md`
- 欄外Raster / Resize監査: `開発用資料保管庫/proposals/11_Animation_Table欄外Raster・Canvas_Resize整合性監査.md`
- 現行Phase: `task-codex/phase5z7.md`
- 旧Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-10.md`
- 現行ロードマップ: `開発用資料保管庫/proposals/00_計画索引.md`
