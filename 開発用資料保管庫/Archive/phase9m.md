# Phase 9m — Animation Table Utility Split / Low-Zoom LOD Comparison Gate

作成日: 2026-08-28

状態: CLOSED — Stage B `C first`＋一行header＋stable Playback Range / borderless resting / Bottom Lucide icon follow-upをOwnerが2026-08-29に実画面受入。全118 verifier / build / Browser checkpoint、SOL final review=`A`をclose根拠とし、Clip Focusは未着手の別候補として保持する

## 1. 目的

Phase 9a〜9fで固定した中央playとquiet resting、Phase 8m〜8uで固定したGlance / Choice / Context action、Phase 9lで確定したCAF管理責務を維持しながら、Animation Tableの情報を`Playback header / Timeline content / Bottom utility`へ分ける。最初にOwner follow-upとして、右Panel上段のFrame・Timeline onion・Lane onionを時間軸／参照軸barの一正本として維持し、CAF identity / internal Layer projectionへ共通の磨りガラスsurfaceと低圧active surfaceを限定接続する。

## 0. Close判定

- Ownerが2026-08-29にproduction実画面を確認し「9mはこれでクローズで良い」と明示した。
- stable一行header、固定幅Playback Range、OUT時I / O、borderless FPS / FRAMES / PREVIEW、Bottom duplicate / trash iconを受入対象とする。
- 直前checkpointの全118 verifier、変更JSの`node --check`、production build、Browserのrange位置不変 / I・O / COPY / SVG / console 0件を維持し、SOL final review=`A`でcloseする。
- Clip Focus、dark top / bottom、Lane濃淡、Animation Table外枠削減、25% zoomはPhase 9mへ戻さず別Gate候補として保持する。

Ownerポンチ絵を入口に、一行header、中央play、Bottom utility、選択Clipの単一solid surface、低倍率時のhandle / grid LODを同一DOM・同一stateで比較する。productionへ入れる前に、wheel三領域、Frame hit、Clip move / retime、SCOPE、range、History / saveの不変境界を固定する。

## 2.1 Owner follow-up Stage 0

- `TimelineUI.createLayerPanelFrameIndicator()`をFrame左右、再生、Timeline onion、Lane onionの唯一の右Panel投影正本とする。CAF identity行へ同じtoggleや第二stateを複製しない。
- Frame bar、CAF identity、CAF internal Layer / Folderは`--ui-surface-float / --ui-backdrop-float`から派生する同一磨りガラスsemanticを使う。全popupやmodalへ一括展開せず、component単位で文字・icon contrastとfallbackを検証する。
- current internal targetは橙surface一件を維持しつつ54% alphaへ下げる。active橙はrow外周へ連続させ、20px thumbnail hit内のcontentだけを1px insetして18px相当に保護し、磨りガラスcontent-boxでRaster / Folder情報を橙から保護する。
- Frame操作行とCAF / Lane情報行はDOM正本を混ぜず、128px幅で上下を接続した一つの磨りガラスcontext stackとして読む。Frame左右buttonとFrame表示上のwheelは同じ前後Frame setterへ接続する。CAF / Lane identityの上下移動は意味確定前に複製しない。
- CAF internal Layer / Folderと背景rowは28px行・20px thumbnail hitをcompact基準とし、opacityと名称はgap 0、thumbnail / details / clip / visibilityの列間は3pxとする。row actionはresting outlineを外して同じsurface内へ沈め、階層guideはrow上下端へ突き抜けず、active橙はthumbnail内容へ被せない。
- Lane onion有効時はFutaba light-maroon面＋background色glyphの反転表示とし、Timeline onionの前後Frame色semanticとは混同しない。
- CAF / Lane上下buttonは意味が`active Lane移動`、`同一Lane内CAF移動`、`current FrameのClip移動`で分かれるため、productionへ先行追加しない。Animation Table側の選択正本と同じfixtureで役割を確定してから既存setterへ接続する。
- Phase 9lで外した右Panel internal Layer pointer D&D入口はOwner実機指摘により復旧する。ただし新しいmutationを作らず、既存`_getClipLayerMirrorCardDragOptions()`からAnimation Tableの`moveInternalLayerToPosition()`へ接続し、TimelineModel / History正本は変更しない。
- 通常Folderの`createFolderThumbnail()`とCAF内部Folderの`_createClipLayerMirrorCardOptions()`は既存のFolder icon投影を維持する。内容合成thumbnailは未実装のまま将来の情報密度Gateへ積み、static placeholderや新しい保存fieldを本Sliceで追加しない。
- DOM、ARIA、TimelineModel / ClipAsset / DrawingSnapshot、History / save authorityを変更しない。

### Stage 0 Acceptance Criteria

- 明るいart / 暗いart上でFrame bar、CAF identity、非active rowが一つの磨りガラス文化として読める。
- active rowは明確だが、全面不透明橙より圧が低い。橙はthumbnail上下へ連続し、内側content-boxの色・alphaは橙で汚さない。
- internal Layer / Folderと背景rowが28pxへ揃い、20px D&D hit内の18px相当thumbnail、0pxのmeta/name gap、3pxのrow列間隔が一つのcompact cardとして読める。階層guideがrow端で半端に切れない。
- Timeline onionとLane onionのactive / offを色だけでなく既存ARIA / titleでも判別できる。
- Table open / closed、Frame左右click / wheel、再生、両onion、Layer / Folder選択・pointer D&D、visibility / clipping、CAF切替で既存動作を維持し、console errorがない。

### Stage 0 SOL検証

- Browser computed styleでFrame / CAF context / internal row / 背景を128pxへ整列し、right-panel全幅188px→172px、row 28px、active row=`rgba(255, 140, 66, 0.54)`、thumbnail hit 20px、padding 1px、visual content 18px、details gap 0px、row列間3px、action border transparentを確認した。Frame / CAF contextは上下接続して一surfaceに見せるが、DOM / state正本は統合していない。
- internal Layerを20px thumbnail hitからFolderへ投入し、Undo / Redoで親子順序が往復すること、Frame wheel F1↔F2、Lane onion ARIA / class、console warning / error 0件を確認した。関連verifier、全114 verifier、production buildを通過し、`dist/`生成差分は清掃した。PhaseはOwner visual再確認までOPENを維持する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9l.md`
7. `開発用資料保管庫/Archive/phase9f.md`
8. `開発用資料保管庫/Archive/phase9a.md`
9. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
10. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/styles/components/animation-table-playback.css`
14. `tegaki_work/build/verify-timeline-wheel-routing.mjs`
15. `tegaki_work/build/verify-animation-table-selected-clip-actions.mjs`

## 3. Stage A inventory

- Playback / range / SCOPE / onion / Clip contextのDOM、event、ARIA、runtime state、History / save正本は`animation-table-popup.js`に残る。static appearanceだけをcomponent CSSへ段階抽出する。
- header通常wheelはTimeline zoom、Lane列wheelは上下scroll、Timeline grid wheelは左右キー相当Frame±1。Bottom utilityへvisual位置を変えても、この三領域とSpace＋dragを変更しない。
- Timeline zoom、Asset Library、Selected Clip duration / copy / deleteは再生状態より低頻度であり、Bottom utility候補。ただしpen / touchで到達できる明示入口を維持する。
- 主playは第一header rowの視覚中央を維持する。専用rowを再作成せず、通常28×24px / coarse 44×38pxの現行hit契約をbaselineとする。
- 選択Clipは橙solid surface一つ、非選択ClipはFutaba中間surfaceを第一案とする。多重outlineと左右矢印を同時に強調しない。
- Clip端handleは45〜50%付近から段階的に弱め、低倍率で隠す候補。33%未満を開く場合はvertical gridをmajor intervalまたは非表示へ落とすが、Frame hit / wheel / move / retimeの論理幅をvisual LODと混同しない。
- `SCOPE SET`はLane visibilityと同義と証明されていないため削除しない。CAF内部子行auto-expandは別の表示policyであり、SCOPEへ転用しない。

## 4. Gate 0比較案

- A Current: 現行一行header＋既存utility row＋33%下限。behavior欠落のないbaseline。
- B Bottom utility: headerはPlayback glanceへ集中し、zoom / Asset / Selected Clip actionをbottomへ移す。Clip / grid表示は現行。
- C Bottom utility＋Clip LOD: Bに単一solid selected Clip、非選択Futaba中間surface、倍率別handle弱化を加える。zoom下限は33%のまま。
- D Bottom utility＋Low-zoom LOD: Cに25%前後の比較用zoomとmajor / hidden grid LODを加える。production採用はFrame hit / gesture固定後だけ。

## 5. Stage A最初の限定Slice

1. 現行DOM order、CSS owner、wheel listener、Clip edge / body hit、zoom clamp、selected Clip action projectionを`rg`で列挙する。
2. 同じLane / Clip / key / selected stateをA〜Dへ投影する一DOM static fixtureを作る。
3. wide / narrow、120 / 50 / 33 / 25%、selected / unselected、single / multi Clipを切り替える。
4. header高さ、play中心、Bottom utility、Clip active surface、handle visibility、major grid、overflowをfixed verifierで固定する。
5. SOLがGate 0を判定し、GO案のselector / event / ARIA / hit / wheel Acceptance Criteriaを確定するまでproductionを変更しない。

## 6. Acceptance Criteria

- 初見で最頻のplay、現在SCOPE / range / preview / onion、Timeline本体、選択Clip actionの視覚階層を順に読める。
- 1280px、720px、420pxでheader / content / bottomの役割が混ざらず、横overflowやplay中心の大幅な偏りがない。
- visual LODを変えてもFrame seek、grid wheel Frame±1、Clip body move、edge retime、key選択のhit authorityを変更しない。
- SCOPE、range、onion、playback、Asset、Selected Clip actionは既存setter / History / saveへ接続し、第二stateを作らない。
- Futaba paletteと既存semantic tokenを使い、pure black / white / neutral grayを追加しない。
- Stage A fixtureはproduction DOM / event / CSS / model / History / saveを変更しない。

## 7. No-go

- SCOPE SET削除、Lane visibilityとの暗黙統合、SCOPEの子行展開policyへの転用。
- Timeline model、Clip geometry、retime / move / key selection、History / Project schemaの変更。
- long pressを唯一のClip action入口にすること、mouse / pen / touch通常tapの遅延。
- Animation Table全面dock、主要DOMの100行超置換、`animation-table-popup.js`一括分割。
- Right Layer Panelのmodel / DOM責務変更、QTP、RIG / Mesh / WARP、Text、exportの同時変更。Stage 0のstatic surface投影、既存TimelineUI control、既存internal Layer pointer D&D adapter再接続だけを例外とする。
- 33%未満をproductionへ先行解放すること。

## 8. model分担

- inventory、wheel / gesture / model境界、Gate 0、production Slice、final review / close: SOL / XHigh。
- fixture DOM、状態matrix、selector、Acceptance Criteriaが固定された一つのstatic SliceだけLUNA / MAXへ委譲可。
- Clip hit、retime、History、save、SCOPE意味の判断が必要になった場合はLUNAで変更せずSOLへ返す。

## 9. 停止条件

- static比較でplay中央、Bottom utility、narrow、Clip LODの一つでも現行より読みにくい場合はproductionへ進まない。
- 低倍率でvisual gridと論理Frame hitが分離できない場合はDをHOLDし、33%下限を維持する。
- selectorのために主要DOM再構成や第二stateが必要になった場合はSliceを中止してSOLで再設計する。

## 10. Stage A source audit開始記録

- production DOMは`.anim-table-header-row--playback`と`.anim-table-header-row--clip`の二行。playback行はFPS / FRAMES、SCOPE、LOOP / Range / I / O、PREVIEW、onion、中央playを持つ。clip行はzoom、Asset、CLIP MOTION、legacy copy / paste / group / delete、selected Clip duration / copy / group / delete、closeを持つ。Bottom utility候補は新actionではなく、この既存第二行の表示責務移動である。
- Timeline zoom正本は`TIMELINE_ZOOM_STEPS = [10, 12, 14, 18, 22, 24, 26, 30, 36, 44]`。30pxを100%とするため現行下限10pxは約33%。25%比較にはfixtureだけ8px相当を追加し、production constantはGate前に変更しない。
- Motion / WARP key markerは`timelineCellWidth >= 18`でのみ投影され、既に60%相当のvisual LODを持つ。Clip edge handleは全倍率でDOMに存在し、duration 1だけbottom resize gripを追加する。45〜50%以下のhandle弱化は既存key marker LODと別のhit / visual分離Gateである。
- Timeline header wheelは`_handleTimelineHeaderWheel()`からzoom。viewportは`resolveTimelineViewportWheelAction()`でCtrl / Cmd=zoom、Shiftまたはtrack list=縦scroll、それ以外のgrid=Frame±1。Space＋dragはbutton / form / Clip block / handle / gripを除外してpan、Shift＋Space dragをzoomとする。DOM位置変更後も同じlistenerと除外selectorを共有する。
- pointerdownはCtrl / Cmd複数選択をhandleより先に判定し、その後`anim-cel-handle`をretime、`anim-cel-block`本体をmoveへ振り分ける。penのduration 1は内側をmove、外側2pxまたはbottom gripだけretimeとする既存競合回避を持つ。visual handleを隠してもこのauthorityを暗黙変更しない。
- selected Clip actionはlegacy copy / group / delete buttonのdisabled / hidden / active / ARIAを既存projectionへ写し、durationは単一かつ非Grouped Clipだけ表示する。Bottom移動時も新setterや第二History入口を作らない。
- Clip / handle / selected appearanceの一部は現在も`_injectStyles()`に残り、Playback static appearanceはcomponent CSSへ分離済み。Stage A fixtureはこの所有分断を記録するだけとし、runtime CSS抽出やpalette一括是正を同時実施しない。

## 11. Stage A fixture / Gate 0結果

- `build/phase9m-animation-table-utility-lod-fixture.html`でA Current / B Bottom utility / C Clip LOD / D Low-zoom LODを一つのheader / utility / Lane / Clip DOMへ投影した。1280 / 720 / 420、120 / 50 / 33 / 25%、selected / unselected、single / multiを同じstate shellで切り替える。
- fixtureはClip visual handleと8pxのlogical edge hit zoneを別要素として保持する。C / Dは50%でhandleを弱め、33%以下でvisualだけを隠す。Dの25%は4 Frameごとのmajor gridへ落とすが、`data-authority="retime"`のedge hitは維持する。
- Browser実測では1280 / 720 / 420のpage / Table / header / utilityに横overflowなし、play中心差0px。AはutilityがTimeline前、B〜DはTimeline後。C 50%はkey非表示、handle opacity 0.28、D 25%はvisual handle opacity 0、logical hit 8px / pointer-events auto、console warning / error 0件だった。
- Gate 0は`GO — C first / D staged HOLD`。Bottom utilityと単一solid selected Clip、Futaba中間色のresting Clip、33%までのhandle visual LODを最初のproduction候補とする。Dのmajor grid方向は採用候補だが、25% zoom constant解放はFrame seek / wheel / Clip body move / edge retime / key hitをproduction gestureで固定する次GateまでHOLDする。
- `build/verify-animation-table-utility-lod-fixture.mjs`は一DOM / state matrix / Bottom order / play寸法 / visual-handleとlogical-hit分離 / Futaba palette、production zoom clamp / marker LOD / wheel helper / pointer priority / SCOPE SET / selected action authority、fixture stateのproduction非混入、GitHubURL露出を固定する。

### Stage B最初のproduction Slice境界

1. 33%下限と`TIMELINE_ZOOM_STEPS`を維持する。
2. 既存第二header rowのzoom / Asset / selected Clip actionを新action / 第二stateなしでBottom utilityへ投影する。既存listener、button ID、ARIA、disabled / hidden projectionを再利用する。
3. selected Clipを橙single surface、resting ClipをFutaba中間surfaceへ限定し、多重outline / direction glyphの競争を下げる。edge logical hit DOMとpointer priorityは変更しない。
4. 50%でvisual handleを弱め、33%でvisualだけを隠す。Motion / WARP markerの既存60% LOD、Frame grid、Clip move / retime / key selectionは変更しない。
5. production DOMの大規模再構成が必要、またはheader wheel / viewport wheel / Space gestureのlistener共有を維持できない場合はBottom移動を中止し、CSS / DOM境界をSOLで再設計する。

## 12. Stage B `C first` production結果

- `animation-table-popup.js`は既存第二header rowのDOM / button ID / listener / ARIA / disabled・hidden投影を作り直さず、mount時に同じutility rowをTimeline viewport後へ移した。closeだけを第一playback rowへ戻し、headerとBottom utilityは既存`_handleTimelineHeaderWheel()`を共有する。Timeline grid wheel / Space gesture / Clip pointer priority / SCOPE SET / model / History / saveは変更していない。
- static appearanceは`styles/components/animation-table-utility-lod.css`へ限定した。playは側方control幅から独立して第一行中央、desktop 460px基準は`100vw`へ譲り、420pxではpanel / header / utilityを画面内へ収める。Bottom utilityはwide / 420pxとも34px一行を維持する。
- primary selected Clipは`--active-border`一面、border / shadow / scaleなし。resting ClipはFutaba medium familyへ下げた。47%相当ではresize grip opacity 0.34、33%ではvisual gripだけ0とし、logical handle DOM / pointer hitは維持する。`TIMELINE_ZOOM_STEPS`と33%下限、Motion / WARP markerの既存LODは変更していない。
- Browser実測は1280×720 / 420×720でpage / panel / header / Bottom utility横overflow 0、play中心差0px、420px close右余白約8px。header wheel 87→100%、Bottom wheel 100→87%、grid wheelはzoom 87%のままF1→F2、Durationは1F→2F→1Fへ既存actionで往復した。selected Clipは`rgb(255, 140, 66)` / border 0 / shadow none / transform none、console warning / error 0件。
- `build/verify-animation-table-utility-lod-production.mjs`を追加し、既存attention / header verifierも共有wheel契約へ追従した。全116 verifier、`node --check`、production buildを通過し、`dist/`と`.vite`生成差分は清掃した。Dの25% / major grid、SCOPE SET整理、child auto-expand、model / History / save変更は引き続きHOLDする。
- この時点ではOwner visual確認をclose条件としていたが、後述のOwner visual follow-upで三行headerを未受入とした。Stage Bの技術checkpointは維持し、一行headerの再現・限定修正後に差分と対象外変更を再監査する。

## 13. Owner playback follow-up / 次Gate境界

- Owner実機で、Focus DeckのOUT選択後も閉状態labelが`LAST CLIP`へ見える経路と、実再生がOを越える症状を確認した。Playback Endは三候補popoverを廃止し、現在値buttonを`TIMELINE → LAST CLIP → OUT MARKER`の直接cycleへ接続した。`OUT MARKER`時だけI / Oを同じgroup内へ隣接展開し、非OUT時はhiddenとする。正本は既存`TimelineModel.playback.endMode / inFrame / outFrame`、`_applyPlaybackSetting()`、History、serializeのままで、第二stateを作らない。
- `build/verify-animation-table-playback-out-marker.mjs`でF9–F18を固定し、F18到達後の非loop停止、loop時F9復帰、Project round-trip後のOUT mode / I / O保持を確認した。Browserでは`LAST CLIP → OUT MARKER`、I F9 / O F18設定、非loop再生F18停止、Table close / reopen後のOUT labelとI / O再表示、console warning / error 0件を確認した。
- play / stopは通常28×24px / coarse 44×38pxのhitを維持し、visible面だけ通常26×24px / coarse 30×28pxへ下げた。font glyphをやめ、中央CSS triangle / 8px squareへ統一して停止のbaseline偏りを除いた。左右を同幅grid clusterへ分け、playはabsolute overlayせず中央列へ置くため、Playback EndとI / Oの連続性を遮らない。header / Bottom utilityのfull-width separatorは0へ下げ、外枠の二重bar感を増やさない。
- follow-up後は全117 verifier、`node --check`、production buildを通過した。ただし後述のOwner visual follow-upで三行headerを未受入としたため、Phaseは一行headerの再現・限定修正までOPENを維持する。
- ToonSquidはTimeline上端の常設Playback toolbarへplay / onion / loopをまとめ、CLIP STUDIOもTimeline Paletteへzoom / play-stop / loop / onionを並べる。Live2DはPlayback群とTrack / Timeline表示を分け、Dope Sheet / Graph Editorを明示切替する。よってTegakiでもplay / stop、loop、onionは時間確認群としてheader候補を維持し、低頻度PREVIEWとTimeline zoomのBottom左右配置だけを次の一DOM fixtureで比較する。
- PREVIEWはtransportではなくCanvas / Timeline表示連動である。次Gateは`A: header quiet text / B: Bottom view utilityでzoom隣 / C: right Frame-onion context隣`を比較し、状態の常時可読性、pen到達、narrow、暗色top / bottom候補を固定する。現Phaseでは移動しない。
- ZoomをBottom右へ移すことが一般則とは公式資料から確定できず、現UI右下のresize gripとも競合する。`左=global view、中央=selected Clip action、右=zoom＋resize手前`と現行左配置をfixtureで比較し、既存header / Bottom wheelを維持する。
- SCOPEを`+ / Lanes`見出しへ寄せる案は次Gateへ採用候補として積む。`ALL / ACTIVE / SET`はPlayback scopeの投影であり、Lane visibility eyeの第二正本にしない。ACTIVE時に他Laneを低alphaで表示する案はdisplay-onlyとし、Canvas visibility / saveを変更しない。SET削除は利用実態と複数Lane契約を監査するまでHOLDする。
- CAF内部子行は通常Timelineへ自動展開せず、選択Clipから明示的に`Clip Focus`へ入り、breadcrumbでLane Timelineへ戻る案を第一候補とする。同じTimeline UIをLane adapter / Clip-internal adapterで切り替え、Dope Sheet / Motion Graphをsubview化する。素材蓄積は既存Asset Library / ClipAssetを使い、別Stock modelや第二保存正本を作らない。

公式比較資料:

- ToonSquid Timeline: https://toonsquid.com/handbook/interface/timeline/
- CLIP STUDIO Timeline Palette: https://help.clip-studio.com/en-us/manual_en/600_animation/Timeline_Palette.htm
- Procreate Dreams Timeline: https://help.procreate.com/dreams/handbook/1.0/interface-and-gestures/timeline
- Live2D Timeline Palette / Graph Editor: https://docs.live2d.com/en/cubism-editor-manual/timelinepalatte/ / https://docs.live2d.com/en/cubism-editor-manual/grapheditor/

## 14. Owner visual NG / 次チャット境界（2026-08-28）

- Owner実画面では、通常編集に十分な横幅があるAnimation Tableでも、`FPS / FRAMES / SCOPE`、Play、Playback End / PREVIEW / Onionが三行へ分裂した。Timeline / Lane編集が主面であるのにheaderが専用三行を占有するため、Phase 9m Stage Bのvisual結果は未受入とする。全117 verifier / build / F18停止の技術checkpointは維持するが、Phaseをcloseしない。
- スクリーンショットの並びは`.is-narrow`時の`animation-table-utility-lod.css`、すなわちheader leftをwrapし、leading / primary / trailing clusterを各`flex-basis: 100%`へする分岐と一致する。コード上は`_updateHeaderNarrowState()`が`min(_panelSize.width, renderedWidth) <= 760`でclassを決めるため、次チャットは推測修正せず、実画面で`classList.contains('is-narrow')`、`_panelSize.width`、`getBoundingClientRect().width`、viewport幅をopen / reopen / resize前後で採取して原因を確定する。
- 情報階層の不変条件を更新する。Animation Tableの主面はTimeline / Lane stackであり、header / Bottom utilityは存在を読める最小高に留める。Play / Stopは最頻actionとして反転色とglyph寸法で焦点を得るが、専用行を要求しない。標準幅は一行headerを必須とし、狭幅も三行へ積む前に低頻度PREVIEW、SCOPE choice、marker未使用時I / O、補助labelを既存Bottom / anchored choiceへ段階退避する。hit area、keyboard、pen到達は表示面縮小と分離する。
- CAF選択時の情報露出も同じ焦点原則で見直す。現行renderは選択CAFのLane直後へ全Folder targetを追加し、`_rigBoneGroupCollapsed`が空の初期状態では複数Bone groupも展開する。大量CAFを全体編集する文脈では選択だけでRIG / Motion情報が流出してTimelineの焦点を奪う。既定はLane / Clip概要までとし、選択Clipから明示`Clip Focus`へ入った時だけinternal Layer / Part / BONE / Motion trackを投影し、breadcrumbで全体Laneへ戻る案を第一候補とする。既存collapseはFocus内の局所密度制御として残し、CAF選択の代用にしない。
- このfollow-upの第一Sliceはheader 3行化の再現と一行化だけへ限定し、後述の技術checkpointまで完了した。CAF `Clip Focus`はOwner visual再確認後、原因・表示policy・同一Timeline UIのadapter境界をfixtureへ固定する第二Sliceとし、同時実装しない。SCOPEのLane見出し移設、PREVIEW配置、25% / major gridも比較候補のままHOLDする。
- No-go: Fontやhit areaだけを無条件に縮める、Timeline高を削ってheaderを守る、CAF選択時に全詳細を別の常設Inspectorへ移す、第二selection / stock / Timeline / save stateを作る、`animation-table-popup.js`を全面再構成する。Playback Endの直接cycle、OUT時だけI / O、F18停止、wheel三領域、Clip move / retime、History / save正本は維持する。

## 15. 一行header follow-up 技術checkpoint（2026-08-29）

- 1280×720のBrowserでTable幅760pxへresizeすると`.is-narrow=true`となり、header 91.78px、leading / Play / trailingが三行へ分裂することを再現した。close / reopen後も保存幅760pxと三行状態を保持し、762pxでは`.is-narrow=false`、header 36pxの一行へ戻った。原因は内容不足ではなく、`_updateHeaderNarrowState()`の760px境界と、`.is-narrow`で三clusterすべてを`flex-basis: 100%`へするCSSが作るbreakpoint不連続だった。
- compact判定を`ANIMATION_TABLE_HEADER_COMPACT_WIDTH = 620`へ限定し、compact playback行は`leading / primary / trailing`の三列gridとした。leadingとPlayはnowrapを維持し、さらに狭い幅で必要な場合だけtrailing内部を局所wrapする。既存ID / listener / ARIA、Play / Stop hit、Playback End直接cycle、OUT限定I / O、Timeline / Bottom wheel handlerは再作成していない。
- Browser実測では760 / 762 / 1280相当でheader 36px一行、620pxのOUT表示でも36px一行、460pxの通常表示でも36px一行を維持した。460 / 420pxでOUTのI / Oまで表示した時だけtrailing内部が二段となるが、leading / Play / trailing全体の三行積み、panel / header / Bottom utility横overflow、control重なりはない。close / reopen後も保存幅とOUT / I / Oを維持した。
- 実操作では非loop OUT F9–F18がF18で停止し、header wheel 80→87%とBottom wheel 87→80%はFrame不変、Timeline grid wheelはzoom 80%のままF1→F2、Lane list wheelはzoom不変で縦scrollした。Clip本体を1セル移動して復元し、下辺gripでDuration 1F→2F→1Fを確認した。Bottom utilityは34px一行 / overflow 0、console warning / errorは0件。
- `node --check`、関連verifier、全117 verifier、production buildを通過し、`dist/` / `.vite`生成差分を清掃した。Phase 9mはOwner実画面で標準幅headerを再確認するまでOPENとし、受入前に`Clip Focus`、SCOPE / PREVIEW配置、25% / major gridへ進まない。

## 16. Attention / Clip Focus 水平調査境界（2026-08-29）

- 調査・比較の一正本は`開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`の同名checkpoint。役割別priority watchlistを、modern drawing / 段階露出=`Adobe Fresco / CLIP STUDIO Simple Mode`、pen / touch animation=`Callipeg Studio / ToonSquid 2.0 / Procreate Dreams 2`、Rig / property密度=`Live2D Cubism / Spine`、video / motion=`After Effects / Premiere`として固定した。Riveはselected-only focus、maintenance modeのAdobe Animateはframe / span文法の補助反例とする。支持優先度はOwnerの定性的評価であり市場占有率とは断定せず、各Gateで公式資料の確認日を更新する。visual attention、mode error、zebra striping、choice reaction、focus+context研究も照合し、外観や多数決ではなく常設 / selection後 / mode内の深度文法だけをTegakiへ翻訳する。
- 注意priorityは明度、色、面積、位置だけでなく、task goal、選択履歴、scene意味で変わる。contrastは可読性下限であり、注目順位ではない。header / Bottom / selected Clip / warningを同時に強くせず、常時action group、高contrast面、trigger-to-result距離、window / mode数、戻るcost、誤進入で意志の拡散を比較する。
- Clip通常clickはselection / move / retimeのまま維持し、深い編集を自動openしない。次Gateの第一候補はselected CAFのBottom contextual `FOCUS`＋keyboard `Enter`から、同じAnimation Table bodyをin-place `CLIP FOCUS`へ切り替える案。`LANES / CAF名 / DOPE|MOTION` breadcrumb、mode / 対象名、Back / Escapeを常時表示し、Dope Sheet / Motion GraphをFocus内subviewとする。
- 比較面は`A current auto detail / B anchored Clip window / C in-place Table mode / D Lane overview＋detail split`。Cを第一候補とするが、Table close / reopenでFocusをresumeするかOverviewへ戻すかを含め、Owner Gate前に確定しない。double click / double tapは補助候補であり唯一のpen入口にしない。global Clip mode toggleは対象不在時の意味が弱いため第一候補にしない。
- appearanceはfocus behaviorと独立して、`current warm / dark top / dark bottom / dark bothまたはFocus時だけ`をFutaba-derived surfaceで比較する。Laneは`uniform＋divider / 低差Futaba zebra / semantic Folder・group band / selected周辺attenuation`を比較し、偶奇へ保存上の意味を持たせず、selected / current / hidden / onion / D&D surfaceを常に上位とする。
- file責務は、普遍理念=`TEGAKI.md`、operational rule=`UI_CSSスタイルガイド.md`、調査matrix=`proposal 14`、Phase停止条件=本書、production authority=component CSS＋既存JavaScript / modelへ一正本化した。AI向けheaderは責務、入口、state / History / save authority、No-go、verifierを短く残し、Phase履歴を積まない。
- `build/verify-ui-attention-lens-philosophy.mjs`を追加し、水平参照、役割別watchlist / 公式資料鮮度、attention budget、Futaba哲学、AI向けheader、dark / Lane比較、明示Clip Focus、Owner停止条件、authority routingを固定した。関連verifierと全118 verifierを通過し、production source / DOM / CSS / modelは変更していない。
- 停止条件: Ownerが一行headerを実画面受入する前はClip Focus fixture / productionへ進まない。受入後も最初は一DOM static fixtureだけとし、SCOPE / PREVIEW移設、25% / major grid、TimelineModel / ClipAsset / History / save、Animation Table全面dockを混ぜない。

## 17. Selected Clip Context Border Quieting（2026-08-29）

- Owner header Gateを越えない独立appearance Sliceとして、Bottom utilityのSelected Clip contextだけを監査した。Timeline本体のprimary selected Clipが橙single surfaceで選択を示す一方、context stripも橙外枠・active面・二重shadow、Duration区切り、各button枠を重ね、同じselectionを二度強調していた。
- official UI grammarでは、CallipegのAction Panelはsheet選択時だけ現れ、Procreate Dreamsも選択後のcontextual menu / mode別trackへ段階露出する。ここから採るのは「selection後に関連actionを近接提示する」深度文法までとし、枠線の数値や外観はTegakiのFutaba surfaceと既存Timeline selectionから判断した。modernという理由だけで全枠を一括除去しない。
- `styles/components/animation-table-utility-lod.css`をSelected Clip static appearanceの正本とし、context strip外枠 / shadowを0、Durationの常設separatorを0、子buttonのresting border / backgroundをtransparentへ下げた。選択との対応は低差Futaba面＋4px橙dot、hoverは既存control-hover面、keyboard focusは2px橙outline、Deleteは栗色text＋hover面で維持する。`animation-table-popup.js`から重複static ruleだけを除き、DOM / ID / listener / ARIA / disabled・hidden projectionは変更していない。
- Browserではwideと470px narrowでaction stripのoverflowなし、outer border 0 / shadow none、hover面、focus-visible outline、Duration 1F→2F→1F、Clip選択解除でhidden、再選択とTable close / reopenで再表示を確認した。console warning / errorは0件。`verify-animation-table-selected-clip-actions.mjs`へCSS正本、quiet surface、active dot、separator除去、frameless resting、focus outlineを追加し、全118 verifier、`node --check`、production buildを通過、`dist/`生成差分を清掃した。
- Phase 9mは引き続きOwnerの一行header実画面受入までOPEN。次はheader確認を最優先し、受入後だけClip Focus一DOM比較へ進む。その次に、Timeline cell / major grid / focus / state境界を残す構造枠と、resting decorationだけの枠を分けるAnimation Table border inventoryを行う。Clip Focus、SCOPE / PREVIEW配置、25% / major gridを並走実装しない。

## 18. Stable Playback Range / Bottom Lucide Follow-up（2026-08-29）

- Owner画像では一行headerへ戻った状態を入口に、`OUT MARKER`だけがI / O展開時にrange群を58px伸ばし、後続PREVIEW / Onionを動かす点を未受入とした。Playback Rangeはdesktop 80px / coarse 116pxの固定footprintとし、`TIMELINE / LAST CLIP / OUT MARKER`の切替で後続controlを動かさない。OUT時はvisibleな`OUT MARKER` summaryを隠し、I / Oだけを表示する。mode cycle用hitとtitle / ARIAは維持し、長い可視labelを幅拡張で解決しない。
- I / Oは`aria-keyshortcuts`とtooltipを持ち、Animation Table内pointer contextかつTable visible / OUT mode / modifierなしの`I` / `O`だけを既存marker setterへ渡す。Canvas contextの`I` Eyedropperを奪わず、model / History / serializeは既存正本のまま。FPS / FRAMES inputはresting border 0＋focus ring、PREVIEWはresting / activeとも常設borderを透明化し、focus-visibleだけ橙outlineを残した。
- BottomのCOPY / DELETEは`UI_ICONS.duplicate / trash`を再利用し、可視textを12px currentColor SVGへ置換した。hitは22×18px、resting border 0、copy件数とshortcut / destructive意味はtitle / ARIAへ残し、既存ID / listener / clipboard / delete authorityを変更しない。SVG採用順とLucide風customの条件は`UI_CSSスタイルガイド.md`の`4C`へ固定した。
- Browser実測は三End modeともrange 80px、PREVIEW x座標不変、FPS / FRAMES border 0、PREVIEW border transparent。OUTでI / O shortcutの設定・解除、Canvas contextでIがmarkerへ誤爆しないこと、COPY実操作、COPY / DELETE 22×18px、SVG 12×12px / currentColorを確認した。全118 verifier、変更JSの`node --check`、production buildを通過し、`dist/` / `.vite`生成差分を清掃した。
- Animation Table外枠は、Futaba-derived dark top / bottomを採る場合に不要となる可能性を比較条件へ残し、今回単独では削除しない。次はOwnerがこのstable header / Bottom iconを実画面確認し、受入ならPhase 9m closeと次Phase選定へ進む。未受入なら実Table幅と該当controlだけを限定補正し、Clip Focus、dark top / bottom、Lane濃淡、border inventoryを並走実装しない。
