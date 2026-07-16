# Phase 6: 固定Warp Grid / Morph Deformer基盤

更新日: 2026-07-16

## 目的

ClipAsset / DrawingSnapshotのRaster正本を変更せず、ClipInstance単位の非破壊deformerを導入する。最初は固定4×4 Warp Gridだけを対象にし、保存schemaと純粋samplingを先に安定させてからpreview / export / UIを接続する。

任意Triangle Mesh、Bone、physics、WebGPUを同時に導入しない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/00_計画索引.md`
6. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
7. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
8. `開発用資料保管庫/proposals/【他GPT作成・参考用】TEGAKI_animation_architecture_notes.md`
9. `開発用資料保管庫/proposals/【他GPT作成・参考用】TEGAKI_ToonSquid2_feature_UI_reference.md`
10. `開発用資料保管庫/proposals/【他GPT作成・参考用】TEGAKI_Callipeg_feature_UI_reference.md`
11. `開発用資料保管庫/proposals/【他GPT作成・参考用】TEGAKI_FigmaMotion_AfterEffects_UI_motion_reference.md`
12. `tegaki_work/system/animation/animation-data-model.js`
13. `tegaki_work/system/animation/warp-grid-deformer.js`
14. `tegaki_work/system/animation/timeline-frame-compositor.js`
15. `tegaki_work/ui/animation-table-popup.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Slice 0 — deformer正本と純粋sampling

- `ClipInstance.deformer` を任意propertyとし、`type: 'warp-grid'` のversion 1だけを受理する。ClipAssetへRaster複製や変形後pixelを保存しない。
- Gridは固定4×4、row-major 16点。任意Topology、Delaunay、weight、Boneを追加しない。
- `bindBounds` はClipAsset合成のProject座標範囲、`bindPoints / points / keyframe.points` はその範囲に対する正規化座標とする。点は0..1外も許可する。
- keyframe FrameはClip-local 0-based。全16点poseを持ち、同一Frameは配列末尾、Clip範囲外はsampling時に無視する。
- `hold / linear` は左keyが右区間を所有する。static `points` を暗黙の始点 / 終点とし、keyのない旧Projectはdeformerなしで従来表示と一致する。
- Project保存、Timeline History、CAF copy / paste、Duration終端key移動で同じinline schemaを維持する。
- Slice 0ではsamplerを描画へ接続しない。現行preview / export / onion / thumbnailはpixel完全一致を維持する。

## Slice 1 — CPU prototypeと描画一致

- ClipAsset合成後、Clip Motion transform前の完成Clip一枚へWarpを適用する単一評価順を固定する。
- 4×4 control pointから内部3×3 cellを一貫した対角線で18 triangleへ分割する。
- まず固定入力のCPU reference rendererでalpha、負origin、欄外Raster、oversized guardを評価する。
- Animation Table preview、閉Table再生、TimelineFrameCompositor / animation exportを同じsample結果へ接続する。preview専用の別pose正本を作らない。
- CPU referenceを描画一致のoracleとして先に固定する。オーナーはPhase 6でのWebGPU採用再検討を許可しているため、固定入力一致、device loss、WebGL fallback、readback / export境界を満たし、計測上の利点がある場合は正式Sliceとして採用できる。採用開始時に `TEGAKI.md` / `AGENTS.md` の凍結記述を同時更新し、CPU referenceは一致判定に残す。

## Slice 2 — Bind / Animate UI

- Bind状態とAnimate状態を分離する。Bindは範囲と基準格子、Animateは現在Frameのpose keyを編集する。
- Canvas overlayはdisplay-onlyとし、Lane / Timeline onionのstateや保存画像へ混ぜない。
- point dragはpointerup 1 History。Canvas、数値、Timeline markerが同じdeformer key正本を操作する。
- CLIP MOTION表示中はTimeline markerの時刻編集を優先し、CAF本体の移動 / retimingを抑制する。Motion丸marker / Warp菱形markerはheader iconで対象を切り替え、Clip範囲内の横dragだけを許可する。同一Frame衝突はmergeせず拒否する。
- Grid未作成Clip、duration 1、再生中、blocked working restoreのdisabled理由を明示する。
- 非破壊deformerの入口はCLIP MOTIONに置き、任意で提示されたLucide `grid-3x3` を候補とする。Layer TransformはRaster確定編集なので同じ入口を置かず、将来の破壊的Warpが必要なら別操作として明示する。

### Warp編集時の操作契約

- Clip Motionは完成Clip全体のposition / scale / rotation正本、Warp Gridはその前段の16点pose正本とし、同じFrameでも別key配列に保存する。評価順は `Warp -> Clip Motion` を維持する。
- Warp Grid button ON中はCanvas dragを点編集専用にし、Motion数値欄、Motion key、回転中心、MotionのCanvas / wheel gestureを消灯・無効化する。GRID内外による暗黙のmode切替は行わない。
- 点dragは現在Clip-local Frameへ全16点poseを作成 / 置換し、pointerupでHistory 1件とする。Motion keyは暗黙作成しない。
- 既存Grid buttonは編集開始 / 終了に限定する。実制作確認後、Grid全削除はcontext actionへ分離する。Bind再設定、複数点選択は後続の明示操作とする。
- Grid buttonで初回作成またはkeyなしFrameから編集を始める時は、sample済みposeを現在Clip-local Frameの明示Warp keyとして先に追加する。keyのないFrameを直接drag可能にせず、Timeline上ではMotionの丸markerと区別した菱形Warp markerを表示する。

### 参考資料から採用するUI境界

- 3参考資料は実装契約ではなく、現行schema / compositor / Historyと照合して採否を決める。存在しない任意Mesh、property track、effect stackを資料だけから先行追加しない。
- ToonSquid系からは「Canvas control point、数値、Timeline markerが同じ正本を操作する」「control pointのhit / drag / snap / Historyを将来共通controllerへ寄せる」を採用する。Warp / Shape / Boneの保存schemaは共通化しない。
- Callipeg系からは常設toolbarを増やさず、選択中modifierだけに前後key、reset、現在key削除、全体削除を出すcompactなcontext actionを採用する。
- Figma Motion / AE 2026系からは、Canvas直接操作と選択対象だけを出すContextual Inspectorを併用し、Property全trackを常時展開しない。現在Warp keyが所有する次区間の`LINEAR / HOLD`をcontextから編集し、`KEY / SAMPLED`状態とdisabled理由を明示する。
- Auto KeyはPhase 6で導入しない。Grid buttonの明示操作で現在Frameをkey化する安全契約を維持し、将来導入時はDRAWへの移行、Project open、History、警告表示を一体で設計する。
- DRAW / ANIMATE / DEFORMの全体Shell、Property別Diamond、Preset、Command Palette、Text、Property Link、Value / Speed Graphは有用な後続候補だが、固定Warp正本の安定前にUI名だけを先行実装しない。
- 自動選択だけでBind / Animate / Clip Motionを切り替えない。現行は `WARP · ANIMATE` を明示し、Bind編集はbindBounds / bindPoints契約を別Sliceで確定してから解放する。
- Bake / Flattenは非破壊Clipを保持して整数CAF列へ展開する出口とし、UI整理だけを理由にPhase 6 Slice 2へ混ぜない。

### Warp context action契約

- Warp Gridを持つ選択Clipだけに `WARP · ANIMATE` contextを表示し、現在Local Frameが明示`KEY`か補間`SAMPLED`かを区別する。
- 前 / 次key移動はFrame表示だけを変更し、空きFrame CAF生成やHistory追加を行わない。
- Resetは現在の明示Warp keyを`bindPoints` poseへ戻す。現在key削除はそのFrameだけを削除してsampleへ戻し、Warp全削除はdeformerと全Warp keyを削除する。各変更はTimeline History 1件とする。
- 区間補間は現在の明示Warp keyだけが次keyまでを所有し、`LINEAR / HOLD`を変更する。補間Frameの`SAMPLED`状態から暗黙keyを作らず、選択欄をdisabledにする。
- 現在key削除またはWarp全削除後はpoint editを終了する。keyなしFrameのGrid buttonは従来どおりsample poseを明示key化してから編集を開始する。

## Slice 3 — Bakeと後続gate

- Warp結果を整数Frameの新しいCAF列へ展開し、元Clipを保持する非破壊Bakeを既定とする。
- alpha、bounds、Clip Motion適用順、Folder clipping、Lane前面順をpreview / exportと一致させる。
- 固定4×4で表現不足が実制作確認された場合だけ任意Meshを別Phase化する。
- BoneはWarp正本安定後の別Phaseとし、Lane順を暗黙の親子階層にしない。

## 対象外

- 任意点追加Triangle Mesh、Topology編集、Delaunay。
- Bone、IK、constraint、physics、Perform記録。
- WebGPU brush、SDF / MSDF、WebGL描画基盤の置換。
- Motion Graph、Camera Track、Resize UI再設計、Asset Library再設計。
- 旧Animation JSONから存在しないdeformerを推測生成するmigration。

## 維持する契約

- stroke中working Layer、preview staging交換、preview container順、上側Lane前面。
- PSD record順、Lane / Timeline onionのdisplay-only境界、Folder clipping。
- `rasterBounds` は保存RasterのProject座標正本。Project frameは表示・出力範囲。
- CAF working Layerは表示・入力adapter、TimelineModel / ClipAsset / DrawingSnapshotはRaster保存正本。
- Keyなし・deformerなし旧Projectは従来描画と完全一致する。

## 検証

- 変更JSを `node --check` する。
- 4×4既定点、duplicate / out-of-range key、hold / linear、static endpointを固定入力で確認する。
- ClipInstance / TimelineModel serialize round-trip、CAF copy / paste、History、Duration終端keyを段階確認する。
- `npm.cmd run build` を行う。
- 描画接続後はBrowserでpreview / 再生 / onion / export / Undo / Redo / Project復元とconsole errorなしを確認する。
- build後に `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## Slice 0完了条件

- Warp Grid schemaがClipInstanceにだけ保存され、ClipAsset / DrawingSnapshotを変更しない。
- 正規化とsamplingがDOM / Pixi / Canvasへ依存しない。
- Project / History / copyでdeformerが欠落せず、コピー先は独立したplain dataになる。
- deformerなしの既存Projectと現行描画経路に表示差分がない。

## Slice 0完了状態

- `warp-grid-deformer.js` に固定4×4 schema、既定16点、version / topology拒否、正規化、hold / linear純粋samplingを実装した。
- `ClipInstanceModel` / Timeline serialize、History、CAF copy / paste、外部更新History入口、Duration終端key移動へ `deformer` を接続した。ClipAsset / DrawingSnapshotは変更していない。
- 固定入力で16点、linear中間、hold、duplicate末尾、範囲外無視、static endpoint、Clip / Timeline round-trip、clone独立性、終端key移動を確認した。
- 変更JSの`node --check`、build、Browserで通常stroke→CAF生成、従来表示、console errorなしを確認した。次はSlice 1のCPU reference rendererで、まだユーザー表示へWarpを接続しない。

## Slice 1進行状態

- `warp-grid-rasterizer.js` に固定4×4 / 18 triangleのCPU reference rendererを追加した。Project座標bounds、負origin、欄外点、premultiplied-alpha bilinear、degenerate triangle skip、axis / 16MP事前guardを純粋関数として扱う。
- `TimelineFrameCompositor` はClipAsset内部Layerを一枚へ合成した後にdeformerをclip-local Frameでsampleし、Warp後に既存Clip Motionを適用する。これによりanimation export経路は単一評価順へ接続した。
- 固定入力でidentity、負origin、整数移動、透明RGB正規化、oversized guardを確認し、`node --check`、build、ブラウザ初期表示とconsole errorなしを確認した。
- Animation Table preview / 閉Table再生は、CAF内部Layerを既存順でRenderTextureへ一枚化し、CPU referenceと同じsample / 16点 / 18 triangleをPixi Meshへ渡すadapterへ接続した。snapshot texture cacheは所有せず、preview専用RenderTextureだけをpreview child破棄時に解放する。
- CLIP MOTION headerへLucide `grid-3x3` を追加した。2 Frame以上・停止中の選択CAFで固定Gridを作成 / 削除し、bindBoundsは作成時の可視ClipAsset Raster unionを固定する。操作はTimeline History 1件でUndo / Redoできる。
- `TEGAKI.md` / `AGENTS.md` はPhase 6の検証済みPixi Mesh adapterだけ許可する契約へ更新した。renderer既定はWebGLのままで、WebGPU renderer採用やWebGPU brushは開始していない。
- Browserで2 Frame CAF、Motion window、Grid作成、identity preview、再生、Undo / Redo、console errorなしを確認した。次はBind / Animate overlayと16点pose key編集で、animation exportの変形実像まで確認する。
- Slice 2の最小Animate UIとしてdisplay-only SVG overlay（16点 / 24線）を追加した。Grid編集ON中はMotion入力とMotion gestureを排他し、現在Frameの点dragを既存`ClipInstance.deformer.keyframes`へ直接upsertする。別のWarp pose正本やMotion X/Yへの代理書込みは作っていない。
- overlayはTable / Motion window / 対象CAF / 再生状態を毎Frame検査し、編集条件を失った時点で自動停止する。Camera zoom / panは描画済みPixi transform cacheを待たず、現在のcamera transformからDOM座標を直接計算して追従する。
- overlay終了時はDOMを非表示に留めず削除し、module再読込時も孤立した旧overlayを清掃する。これによりMotion window / Tableをどの経路で閉じてもGrid DOMを残さない。
- 3参考資料の比較から、選択Warp専用のcompact context actionを追加した。`WARP · ANIMATE`、`KEY / SAMPLED`、有効key数、前後key移動、Bind pose reset、現在key削除、Warp全削除を表示し、既存Grid buttonはkey作成 / point edit開始終了へ限定した。
- key一覧・完全一致・前後key探索は`warp-grid-deformer.js`の純粋helperへ置き、UI固有のkey列を作っていない。同一Frame末尾優先、Clip範囲外除外をcontext / sampler間で共有する。
- BrowserでkeyなしFrame移動時のoverlay終了、2 key前後移動でHistory不変、点drag後のReset、Warp全削除、Undo / Redo、console errorなしを確認した。次はanimation exportの変形実像、Project復元を実制作確認し、結果に応じてBind編集または非破壊Bakeへ進む。
- Figma Motion / AE 2026資料のうちContextual InspectorとProperty区間責務を限定採用し、現在の明示Warp keyが所有する次区間へ`LINEAR / HOLD` selectorを追加した。SAMPLED Frameでは`NO KEY`を表示してdisabledとし、Motion Transform補間や暗黙Warp keyを変更しない。BrowserでHOLD変更がHistory 1件、Motion補間は独立、F2移動で`SAMPLED`・overlay削除・History不変、console errorなしを確認した。
- Project保存復元は既存Timeline inline schemaで`deformer`を往復する。固定入力でJSON round-trip、HOLD区間、clone独立性を確認し、Project reset / restore時は旧Warp point editを明示終了して同一Clip IDへoverlay runtime stateを持ち越さない。
- 実Warp keyを持つ4 Frame CAFからanimation export previewを生成し、`TimelineFrameCompositor`の`ClipAsset合成 -> Warp -> Clip Motion`経路で200×200 APNG blobが得られ、console errorなしを確認した。保存・export gateにschema追加や別deformer正本は不要だったため、次はBind編集時の既存pose rebase契約を先に固定し、非破壊Bakeはその後へ送る。
- Bind rebaseは、Bind変更を意図どおり反映しながら、static poseと全keyが旧Bindから持つ変形量をProject座標pxで維持する。範囲比率による変形量の勝手な伸縮、既存key初期化、見かけだけの別poseは採用しない。`rebaseWarpGridBind()`を純粋関数として追加し、入力不変、bounds変更、HOLD保持、不正入力拒否を固定入力で確認した。
- Context actionへ「現在Raster範囲へBindを合わせる」を追加した。作成時boundsと一致中は理由付きdisabled、Raster範囲が変わった時だけ全poseを上記契約でrebaseし、Timeline History 1件とする。Browserで作成直後のdisabled理由とconsole errorなしを確認した。任意Bind点dragはtexture基準三角形を変える高影響操作なので、専用Bind modeと明示警告を整えてから解放する。
- `WARP · ANIMATE / WARP · BIND`を明示切替する専用Bind modeを追加した。Bind中の16点dragは`bindPoints`だけを直接置換せず、`rebaseWarpGridBind()`でstatic pose / 全keyを同時再基準化する。Frame keyの有無と独立し、SAMPLED Frameでも暗黙keyを作らない。Animate用のkey移動、Reset、削除、補間はBind中disabledとする。
- pointerupがCanvas外へ流れる入力経路でもgestureとHistoryを確実に閉じるため、window captureと`lostpointercapture`を終了条件へ追加した。Canvas再接続時は旧window listenerを解除する。BrowserでBind開始警告、16点表示、点dragのHistory 1件、SAMPLED Frame移動のHistory不変・key数不変、Bind終了時overlay削除、console errorなしを確認した。
- Slice 3の非破壊Bakeを開始した。`TimelineFrameCompositor.renderClipFrameSurface()`は選択Clipだけを既存`ClipAsset合成 -> Warp -> Clip Motion`順で評価し、背景・通常Layer・他Laneを混ぜず、負origin / 回転 / 反転を含むProject座標tight boundsを返す。Clip blendはRasterへ潰さず、baked Clipのstatic blend mode / strengthへ引き継ぐ。
- Bake UIは点編集終了中だけ有効で、各整数Frameを独立DrawingSnapshot / ClipAsset / duration 1 CAFへmaterializeする。全Frame成功後だけ既存image-sequence transactionへ渡し、元Clipは削除せず非表示で保持する。各Snapshotはtight rasterBoundsを保ち、総pixel量がHistory上限を超えた時はTimeline変更前に中止する。
- 固定入力でidentity、負origin、scale / move、90°回転・反転のtight boundsを確認した。Browserで4 Frame Clipから元Clip 1＋baked CAF 4、History 5→6、Undoで1 Clip、Redoで5 Clip、toast、console errorなしを確認した。次はProject round-tripとanimation exportでbaked列が元非破壊Clipと一致することを確認し、Phase 6 closeoutを判定する。

## Phase 6完了状態

- 固定4×4 Warp GridのClipInstance正本、純粋sampling、CPU reference、Pixi preview、animation export、Project round-trip、Bind / Animate UI、key marker、History、非破壊Bakeまでを同じ評価順へ接続した。
- Motion丸key / Warp菱形keyのTimeline横drag、対象切替、CAF移動 / retiming抑制はオーナー実機確認済み。
- 固定Warp v1は互換正本として凍結する。任意Topologyや可変密度化のためにv1 schemaを黙って読み替えない。
- Bake後CAF列の長期Project実制作と各export形式の見た目一致は継続確認事項だが、固定Warp基盤の完了を妨げる実装残件とはしない。Phase 6bの最初の回帰gateとして再確認する。
- 2026-07-16にPhase 6を完了し、次をPhase 6bへ分離する。
