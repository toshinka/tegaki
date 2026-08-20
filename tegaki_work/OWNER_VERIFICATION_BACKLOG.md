# Owner実機確認バックログ

更新日: 2026-08-20
状態: ACTIVE — Phase 7i〜8jはSOL技術close済み、Owner制作環境では未確認項目あり

## 目的

SOLの実装監査・固定verifier・Browser確認でcloseした機能について、Ownerが制作環境へ戻った時にまとめて確認する項目を保持する。ここに残る項目は「未確認」であり、「不具合確認済み」または「Phase未完了」を意味しない。

- Owner確認で問題がなければ各項目を完了へ更新する。
- 問題が見つかった場合は、閉じたPhaseを暗黙に再OPENせず、再現条件に応じたbug fixまたは新しい限定Phaseを立てる。
- 既存Projectを破壊し得る確認は複製Projectで行う。

## 未確認項目

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

- 1 Frame CAFと伸ばしたCAFの両方で、Laneの`RIG設定`が正本やHistoryを増やさずSetupを開くこと。
- 曲げる場合は`1. BONE追加 → 2. AUTO GRID → MOTION`だけで絵が追従し、未接続中は対象絵が通常濃度、key / Canvas dragは拒否、非対象絵だけが半透明になること。AUTO SHAPE / LINEで接続済みの場合もMotion可能であること。
- 絵を曲げない場合だけ`全体PIVOT`を使え、曲げBONE / Meshがある時は併用できないこと。
- 既存mixed stateを複製Projectで開き、`曲げBONEへ切替`の確認acceptで対象Raster Part / rigid Bone / 対応Motionだけが消え、未接続Mesh Boneが残ること。cancel、外部child接続中の拒否も確認する。
- Bone drag後にMOTION件数が1以上になり、絵全体の点線矩形ではなくBone overlayが操作対象になること。Undo / Redo、Table close / reopen、Project reload、console error、可能ならpen / touchを確認する。

本項はPhase 8d Stage BのOwner制作確認であり、macro Workspace shell選定の完了を意味しない。AUTO SHAPEを第一導線とする旧表示はStage CでAUTO GRID基準へ改訂した。

### Phase 8d Stage C — AUTO GRID基準導線 / WEIGHT復帰

- Mesh未生成のRasterで、仮の青いLayer名PIVOTがCanvasへ出ず、`1. BONE追加`で作成した明示BONEだけが表示されること。自動初期BONEやHistoryが増えないこと。
- BONE追加後は`2. AUTO GRID`だけが太いSetup青境界で強調され、`2. 絵へ接続`という別actionに見える文言がないこと。AUTO SHAPE / LINEは選択肢として残ること。
- 未接続Motionの`AUTO GRIDを作成`からSkin接続でき、Bone dragで絵が追従すること。Shape / Lineで接続済みの場合もMotionが阻害されないこと。
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
