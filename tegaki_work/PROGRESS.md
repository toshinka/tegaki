# Tegaki Progress

更新日: 2026-08-12

## 現在地

- Phase 5a〜7pを完了した。詳細記録は`開発用資料保管庫/Archive/`へ保存している。
- Phase 6gではQTP開閉用`Q`、既存Layer Transform経路の`V`、Plan Aの最小sidebar、tooltip撤去、icon比率、`square-dashed`選択iconを確定した。削除済み描画tool専用の到達不能handlerも残存監査で除去した。
- Phase 6hではBrowser 100%のまま主要UIを従来80%表示相当へ縮小し、Canvas / pointer座標を変えず、`pointer: coarse`だけ主要hit areaを従来寸法へ戻した。sidebar、Layer Panel、QTP、CAF、Animation Table、status、Resize、Settings、Layer Transformを固定入力で受入れた。
- QTPの選択tool表示、Animation Table表示中のPixel Selection変形preview、CAF化後にTableを閉じた状態の矩形overlayを、既存PixelSelection状態・selection event・working Layer adapterへ接続して修正した。preview / confirm / Table close後の位置は固定入力で一致し、Historyは1操作1件、console errorなしを確認した。
- 通常Layer / Table表示中CAF / Table閉鎖後CAFの選択系横断リファクタリングはproposal 14へ記録した。Raster確定位置、Undo / Redo、保存 / 再openの破損が再現しない限りRig系列を止めない。
- Phase 6i Gate 0では、CAF内部Layer / Folder IDをPart identityとして再利用し、表示親`parentLayerId`とrig親`parentPartId`を分離する`GO`判定を確定した。preview / exportは同じ純粋FK結果を使い、copy / pasteは共通ID mapで参照を再mapする。
- Phase 6jではoptional Part schema、validation、共通ID remap、root Motionと共有するtransform-track sampler、stateless rigid FKを実装した。Rigなし保存shape、Project / History round-trip、CAF copy、structured Bake、2段FK、random seekを固定入力で受入れた。
- Phase 6kでは一つのCAF内部Folder subtreeを一つのRenderIslandとして解決する共通render planを実装し、Pixi preview / playback / onionとCanvas compositor / Bake / exportへ同じworld matrixを接続した。clipping分断はRaster fallbackとし、negative bounds、root Motion / WARP順、Table開閉後のactive poseを固定入力とBrowserで受入れた。
- Phase 6lでは一つのFolder Partに限定し、選択CAFのAnimation Table子行、Folder Part登録、既存`rigMotion.partTracks`へのkey編集、Canvas handleを接続した。オーナー実機受入を得て`GO`でcloseした。
- Phase 6mではCAF内部Folder枠を通常Raster thumbnailから分離し、Animation Table Laneを26pxへ調整した。オーナー実機で受入済み。
- Phase 6nでは既存Rig正本へoptional Bone schema、validation、共有ID remap、3段のstateless FKを追加した。Project / CAF copy / Bake / random seekを固定入力で受入れ、`GO`でcloseした。
- Phase 6oでは一つのroot BONEを一つのFolder Partへ明示bindingし、inverse bind deltaを既存Folder RenderIslandへ接続した。preview / playback / onion / Bake / exportは同じplanを使い、通常描画とconsole errorなしをBrowserで確認した。
- Phase 6pでは一つのroot BONE + binding、Bone key、Canvas tip rotation、全Folder候補Lane、`RIG → MOTION → WARP`のRIG-first導線、CAF / Folder対象tab、単一Inspectorを実装しcloseした。
- Phase 6qではCAF + 全Folder PIVOT、遅延Rig登録、青Setup / 橙Motion、親BONE接続、nested剛体FKを共通render planへ接続し、オーナー実機でRigと親子Motionを受入れた。親dropdownを維持したまま、Canvas上のPIVOT長押し接続、接続線dragによる付け替え、空drop解除も同じ`parentBoneId` setterへ接続した。保存Bone長は維持し、表示stemだけを短縮した。
- Phase 6rは保存容量・KEY選択・tab復帰・通常Layer選択の安定化Sliceとしてcloseした。多数Folder / Layer / Motion keyで旧`Invalid string length` crashが再現しない状態を維持し、Motion / WARP / Bone / legacy Part KEYのCtrl/Cmd複数選択と一括drag、通常押下だけの一時表示、再Ctrl/Cmd click解除、設定済みLaneのlast-used tab復帰、PIVOT設定済み`✓`、Project採取前のV Layer Transform確定、同一Assetの内部Layer選択保持を完了した。CLIP MOTION内のnative `title` tooltipはFutaba paletteの`data-tooltip`へ統一し、pointerupでもKEY選択toggleをcommitしてCtrl/Cmd OFF後の◆表示を通常へ戻す。外部paste / Canvas resizeを含むV save / reopenは既知残存として後続検査へ引き継ぐ。
- Phase 6sはFolder別WARP GRID、Project / Album round-trip、容量、Bake / export共有経路をSOL review 4とOwner実機で受入れcloseした。`Folder subtree合成 → Folder WARP → Part/Bone matrix → Folder opacity/blend → root WARP → root Motion → Lane`を維持する。
- Phase 6tは固定長2-Bone IKを既存Bone Pose keyへ確定するPose Bake方式で実装し、SOL review 3判定`A`とOwner実機受入によりcloseした。pure solver、root / joint rotationだけの書込み、1 gesture 1 History、cancel rollback、固定segment、通常FK、random seek、Project / Bake / Folder RenderPlanを固定した。target track、Constraint、stretch、Mesh、weightは追加していない。
- Phase 6uはSOL review 2判定`A`でStage A / Bを受入れcloseした。新規WARP GRIDはCAF / Folderのeffective-visible alpha実内容へauto-fitし、巨大boundsをCanvasへfallbackせず拒否する。Raster privateのbarycentric / epsilonは`warp-triangle-point-map.js`へ抽出し、既存topology / placementだけでBind Project点をPose Project点へ写すpure helperを固定した。全26 verifier、node --check、build、Stage A Browser smoke、生成物清掃を通過した。Gate 1は、Asset static RigとInstance Folder WARPを跨ぐConstraint所有、Bone評価後の再pass、cycle、ID remap / validationが未確定のため`HOLD`とし、子PIVOT追従は後続Phase候補へ送った。
- Phase 6v〜6yでは、一つのCAF内部Rasterへ複数Mesh BONEを置く限定Skinning系列を完了した。`ClipAsset.meshDefinitions / skinBindings`をoptional static Setup、既存`rigDefinition.bones`をBind、`ClipInstance.rigMotion.boneTracks`をFrame Poseとして分離し、inverse-bind LBSをCPU / Pixi共通render planへ接続した。RIG / MOTIONのRaster target、`＋ BONE`、既存親接続、Bone key、Alpha-fit `AUTO GRID` / `GRID再生成`、最大2 distance weight、Raster更新時`STALE`を実装した。全29 verifier、変更JS / mjsの`node --check`、build、Browser軽量確認、console errorなし、生成物清掃を通過した。
- Phase 6zでは重いProjectの緊急復旧checkpointをOwner設定へ接続した。操作中の定期記録、5秒〜5分の最短間隔、tab非表示・終了時の記録を独立設定でき、OFF切替は未開始のdebounce / idle / retryをcancelする。通常Ctrl+S保存とは別機能であることをUIへ明示し、Project / checkpoint shapeは変更していない。Owner制作Projectでは5秒設定でAnimation Table操作の周期的遅延が継続し、1分で解消したため、新規既定を1分へ変更して短周期を高負荷設定と明示した。定期Ctrl+Sは重複serializeを避けるsingle-flight Gateまで未実装とする。
- Phase 7aはcloseした。通常Layer／Table表示中CAF／Table閉鎖後CAFのrow順・depth、active / selected / working ID、Panel全DOM再構築、clipping全走査をdebug限定で計測し、軽量三状態の階層一致を確認した。CAF内部Layer追加時のPanel由来clipping refreshはmicrotask集約で6回からdirect 1 + Panel 1の2回へ削減した。制作Projectの継続遅延は5秒周期の全Project緊急復旧serializeと判定した。
- Phase 7bはSOL最終判定`A`とOwner実機受入によりcloseした。WARP `SELECT`（square-dashed）の矩形replace、Ctrl/Cmd toggle、選択点一括dragを既存key / 1 gesture 1 Historyへ接続し、selectionはClip / Folder / topology単位のruntimeだけに限定した。通常click／3px未満のpointer揺れはkey・Historyを増やさず、Undo / Redo後も別topologyへ選択indexを持ち越さない。
- Phase 7cはSOL review 5=`A`とOwnerの軽量確認後close許可によりcloseした。Folder WARP anchor → direct-child PIVOT追従は、static relationを`ClipAsset.rigDefinition`、Frame poseを既存`ClipInstance.folderDeformers` / `rigMotion`へ分離し、実deformer / triangle内だけON保存、dormant / stale時の通常FK fallback、display-only成立表示を固定した。軽量BrowserでWARP未作成 / GRID外拒否、BRUSH変形時のanchorと子PIVOT同量追従、OFF復帰、Undo / Redo、Table再開、onion / playback、console error 0件を確認した。深い制作Project、GIF / APNG、source / target削除、pen / touchは継続監視とする。20件のJS / mjs node check、全33 verifier、buildを通過し、生成物は清掃済み。
- Phase 7dはSOL review 1 / 2 / final=`A`とOwner受入によりcloseした。表示階層、Rigグラフ、描画所属を分離し、Folder PartとCAF直下Root Raster Partを保存field追加なしのgeneric RenderIsland planへ統合した。pure reparent Gateは描画所属・Folder WARP・clipping contractが変わる移動をmutation前に拒否し、同一親reorderとdisplay-only移動だけを許可する。Folder無し`+RIG`、Setup青の連結node + `RIG` chip、CLIP Motion中のplain Space + dragを完了した。全36 verifier、build、限定Browserを通過し、深い制作Project、GIF / APNG、pen / touchは継続監視とする。
- Phase 7eはWARP `GRID` Bind回転のProject座標補正としてcloseした。GRID rotation / rotation-handleだけを既存`applyWarpPlacementToPoints()`へ接続し、非正方形boundsでもProject辺長・角度・中心を維持する。全37 verifier、node check、build、SOL review 1=`A`を通過し、Browserでは横長4×4を約45°／90°へ連続回転して長短比と平行辺、1 gesture 1 History、Undo / Redo、Table close / reopen、console error 0件を確認した。OwnerがGRID回転で形状が崩れないことを実機受入した。Folder / Control Mesh深部、Project reload、playback / onion、Bake / GIF / APNG、pen / touchは継続監視とする。
- Phase 7fはWARP Bind Setupの`FRAME / CORNER / EDGE`操作分離としてcloseした。一corner／一edgeのProject deltaをtopology比率で配るpure helper、既存rebase、runtime segmented control、edge midpoint handleを接続し、GRID toolとBind submodeだけを既存deformer Bind青へ変更した。全38 verifier、Browserの横長8×8、Owner実機で回転不変、青semantic、FRAME / CORNER / EDGEを受入れた。fixed 4×4、Folder、Project reload、playback / onion、Bake / GIF / APNG、Shift + wheel実modifier、pen / touchは継続監視とする。
- Phase 7gはWARP `RADIAL` topologyとしてOwner受入でcloseした。center + 16 segments × 3 ringsの決定的な49点／80 triangleを既存free Control Meshへ保存し、新規作成だけの青い`RADIAL`入口、POINT / SELECT、1 Historyへ接続した。free topologyではFRAME / CORNER / EDGEをdisabledにし、新しい保存flag、renderer分岐、既存key変換を追加していない。変更34 JS / mjsのnode check、全39 verifier、build、Browser実操作、Owner実機確認を通過した。
- Phase 7hはAuto Shape alpha contour foundationから限定production接続までStage A〜E、SOL review 1〜5=`A`、Owner軽量実機受入を完了してcloseした。4-connected contour、hole / island FILL、topology検査付き輪郭削減、透明guard、256 vertex budgetを既存Mesh / Skinへ接続した。Setup青RIG内で`AUTO GRID`と`AUTO SHAPE`が並存し、最大2 weight、CURRENT / STALE、明示再生成、CAF asset一操作一History、CAF / Raster複製、Project round-tripを既存正本で維持する。Browserで`SHAPE → GRID → Undo / Redo`、Raster追記STALE、再生成、Mesh Bone key、playback、onion、console error 0件を確認した。LINE、manual weight / topology、WARP共有は未実装。完了記録は`開発用資料保管庫/Archive/phase7h.md`。
- Phase 7h close前後のPhase横断小改修として、通常Folderの「複製」を子孫Folder / Raster込みの既存`layer-block`コピー正本へ統合した。Animation Table上部headerの通常wheelはTimeline zoom、Lane列wheelは上下、Timeline grid wheelは左右を維持する。CanvasのH / Shift+H反転はcanvas全体中心ではなく、現在viewport中心下のProject座標を固定する。入れ子Folder複製とUndo / Redo、header wheel `87% → 100%`、拡大後H反転、console error 0件をBrowserで確認し、全45 verifier / buildを通過した。
- Animation Table / CLIP MOTIONの軽量導線監査では、Table既定高をLane一行分だけ拡張し、WARPのGRID / RADIAL / 4×4作成、GRID / FRAME Bind編集を明るいSetup青へ統一した。続くPhase 7lでheaderを明示二段へ限定整理し、上段`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`、下段`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`へ固定した。既存ID / event / wheel三領域 / drag / model / History / saveは変更していない。
- Phase 7i〜7oは各Gate=`GO`、実装Stage、最終SOL review=`A`、関連verifier / node check / build / Browser確認を再監査し、2026-08-12のOwner指示に基づきSOL技術closeした。LINE / Ribbon、Deformer三形状SELECT、Text to Raster、Table二段header、read-only Motion Graph、Resize直接framing、Motion Easing 12 presetの保存・History境界は変更していない。制作Project、長尺CAF、reload / export、pen / touch等のOwner未確認項目は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ分離し、不具合が見つかった場合は閉じたPhaseを暗黙に再OPENせず限定bug fixまたは新Phaseで扱う。完了記録は`開発用資料保管庫/Archive/phase7i.md`〜`phase7o.md`。
- Phase 7p Motion Easing Clipboardは、Motion値clipboardと分離したruntime tagged payloadでHOLD / LINEAR / custom cubicだけをCOPYし、現在またはCtrl / Cmd複数選択Motion keyへ1 Historyで原子的に貼り付ける。HOLDはCurve入力read-onlyのままclipboard操作を許可し、terminal混在は全体を拒否する。SOL review 1=`A`、全57 verifier、build、BrowserのHOLD copy / paste、Undo / Redo、terminal拒否、console 0件で技術closeした。完了記録は`開発用資料保管庫/Archive/phase7p.md`。
- Phase 7q Motion Graph Key Navigation / Easing Bridgeは、explicit Motion key markerのmouse / keyboard seekと既存EASING CURVEへの明示導線を追加し、SOL review=`A`で技術closeした。Graph値編集、Motion Path、manual Mesh、Project / History schema、Graph専用selection、sampler / preview / exportは変更していない。全57 verifier、build、Browserの5 group、History非増加、HOLD read-only、terminal / playback無効、Graph / Curve再開、console 0件を通過した。完了記録は`開発用資料保管庫/Archive/phase7q.md`。
- Phase 7rはGate 0=`GO`で、既存explicit Motion keyのactive一channel値dragを既存複合key mutationへ接続した。POSITION / SCALE channel selector、degree / percent単位変換、live preview、pointerup 1 History、cancel rollback、再生中拒否を固定し、Motion time move、key追加、複数key、Motion Path、保存schemaは変更していない。SOL review=`A`、全58 verifier、build、Browserの5 group / Undo・Redo / playback / close-reopen / console確認まで完了した。追跡済みbuild基準は復元済みだが、新規生成`dist/assets` 5件とBrowser確認用Vite log 2件の清掃が実行環境の承認制限で残るため、PhaseはOPENのまま`task-codex/phase7r.md`に保持する。
- `ClaudeReview/rig-mesh-evaluation-and-followup.md`を現行コードへ照合した。Auto Line拒否toastへ別Raster分離 / 線整理 / AUTO SHAPE等の次操作を追加し、Setup青をpopup内RIG / MESH static Setup actionへ使える境界をUI/CSSガイドへ明記した。実受理率、異種generator誤置換、再生成HistoryはOwner確認台帳へ置き、manual weight補正と分岐Ribbon自動分割は第二正本・複数Mesh境界を先に決める別Gateとしてproposal 15へ積んだ。
- Web外部AI向け`tegaki_work/GitHubURL.txt`を現行正本へ同期した。main push後に、必読順、Phase 7i〜7qの完了記録、現行Phase 7rとOwner確認台帳、Phase 6v〜7h経緯、現行proposal、Rig / Mesh外部follow-up、LINE / SELECT / Text / Table二段header / Motion Graph / Resize Direct Framing / Motion Easing preset・clipboard・Graph値編集のpure・UI adapterとverifierをRaw URLで辿れる。全168 URLはローカル存在照合で欠損0・重複0。navigationであり、`TEGAKI.md` / PROGRESS / 現行Phase指示書より上位の正本にはしない。
- proposalは現行10文書へ整理した。標準入口は`開発用資料保管庫/proposals/00_計画索引.md`。外部AI原案、レビュー、整理前長文、解決済み監査は`proposals/過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`へ原文保存している。

## 完了基盤の要約

### Animation / CAF

- Lane / Timeline / CAF Group、複数選択、copy / paste、Folder clipping、Lane visibility、onion、preview / playback / export境界を段階実装した。
- Clip Motionは既存`ClipInstance.transform` / `transformKeyframes`を正本とし、position、scale、rotation、anchor、opacity、blend、HOLD / LINEAR / cubic-bezierを同じClip-local Frame契約でsampleする。
- Animation Tableは単押し`A`で開閉する。CLIP MOTIONは未設定CAFの初回だけRIGへ入り、以後は最後に閉じたRIG / Motion / WARP tabへ復帰する。

### WARP

- 固定4×4 WARPと可変GRIDを維持する。
- GRIDは全Frame共通のBind Setupで、GRIDの移動・拡縮・回転だけではRasterを動かさない。
- POINT / BRUSHだけがFrame Poseを変形し、LENSはWarp key内placementを操作する。
- 元Rasterを保持し、Bind triangle領域だけをWarp結果へ差し替える部分合成をCPU / Pixiで共有する。
- 白mask、座標ずれ、透明境界、Raster外、部分重複、GRID / POINT / BRUSH、B / N、preview / playback / Bake / GIF / APNGは固定入力、Browser、オーナー実機で受入済み。
- 旧Project、key無しCAF、固定4×4 WARP、既存可変GRIDはoptional field欠損をidentityとして維持する。

### Raster Mesh / Bone Skinning

- Raster画素はClipAsset内部Layer / DrawingSnapshot、static Mesh / SkinWeightはClipAsset、Bone Poseは既存ClipInstance rigMotionを正本とする。
- Frame頂点は`evaluateRasterBoneSkinning()`でstatelessに導出し、preview / playback / onionとCPU compositor / Bake / exportへ同じ結果を渡す。
- Alpha-fit Gridはwide 8×4、tall 4×8、square 6×6のdeterministic初期値。生成後は固定し、Raster更新時は`STALE`表示だけを行う。
- clipping owner / sourceへ参加するRaster、active Folder WARP / rigid RenderIsland内Rasterは初期proofでは明示unsupported。自動fallbackしない。

### Bake / 容量

- flatten BakeとLayer構造保持Bakeを分離した。
- Bake結果は最上段の新Laneへ作り、元Clipを非表示で保持する。
- Layer構造保持Bakeは逐次生成、容量preflight、cancel、原子的rollback、1 Historyを維持する。
- 400×400、1 Raster Layer、240 Frame実測では処理完走後の同期checkpointに強いmemory pressureが出たため、校正済み安全上限を1GiBへ固定した。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。
- Folder clipping、通常Layer / CAF内部Layerのdata adapter境界を維持する。
- 新しいMotion、mask、Mesh、physics正本を既存経路と並行して作らない。

## 既知残存と再開条件

- sidebar / Layer Panel / QTP / CAF / Animation Tableのcompact表示はBrowser固定入力とオーナー実機で成立した。実pen / touchのcoarse hit areaは継続監視する。
- 重いAnimation Projectでは、緊急復旧Project serialization / IndexedDB checkpointとpointer event queue待ちが重なる場合がある。pen / Airbrush確定自体は実測1ms未満だったため、描画結果やHistory上限を変更せず凍結監視する。
- 複数Motion / WARP Projectの`JSON.stringify`失敗は、保存先への書き込み前に発生する。OneDriveだけを原因とせず、Phase 6rでSnapshot参照数、decoded pixel bytes、JSON長、serialize時間を採取した。Stage DではFolder WARPを含むProject JSON round-tripと、循環JSONを例外化しないsave結果を固定検証した。初回native pickerはDownloadsを開始位置のhintとするが、既存handleとOS / browserのfolder選択を上書きしない。
- 通常modeでLayer Panel選択とV変形Rasterが食い違う例、Table表示有無でFolder / Layer card順が揺れる例はPhase 6rで限定修正した。外部paste / Canvas resizeを含むV save / reopenだけは後続の固定入力へ残し、保存round-trip受入れ前に横断リファクタリングへ広げない。
- Browserで再現したTable閉鎖後のCAF内部Layer selection / working adapterずれは、同じAssetに存在する`selectedInternalLayerId`をFrame同期で保持して修正した。通常 / Table表示 / Table閉鎖後のV確定・EscapeとPanel順は一致した。
- Folder別WARPはPhase 6sでcloseした。target配下に別Part / 別Folder WARP targetがあるnested非線形境界とcross-boundary clippingは明示unsupportedを維持し、制作中に必要性が出た時だけ別Gateで再開する。
- V保存ずれは全Layer一律ではなく、Canvas resizeを挟んだ外部clipboard貼付Rasterが候補。配置を保持する貼付例もあるため、Slice 3で`外部paste → resize → V → save/reopen`を固定入力にしてから限定修正する。
- 添付画像のBrowser file chooser投入はネイティブchooser待ちで完了しなかったため、実機のOS clipboard / file chooser入力へ委譲する。`ImageImporter`のresize前後snapshot、working Layer capture、ProjectManagerのtransform commit待ちはコード監査済みで、現時点では追加修正を入れない。
- 末端の手から前腕・上腕を追従させるrotation-only 2-Bone IKはPhase 6tでcloseした。伸縮と周辺画素の曲げはrotation limit / chain参加 / Mesh・weightと分離したまま維持する。
- Raster Skinningは一Raster / 一Meshの初期proofまで。Auto Shape FILLとLINE Ribbonは既存Mesh / Skinへの明示生成まで接続したが、manual weight、weight brush、manual topology、Mesh Bone IK、SkinとFolder WARP / clippingの同時適用は未実装。Phase 7cはrigid child PIVOTのtranslation追従だけで、Skin / Mesh同時変形へ広げない。
- 遅延またはcrashが再現した場合は、`TegakiPerf`のevent queue / handler、Long Task、Project export時間、heap、texture残留を同時採取し、AirbrushやHistory件数を先に原因と決めない。詳細は`開発用資料保管庫/Archive/phase6e.md`。
- Layer Panelは通常Layerのflat合成順＋`parentId`と、CAF内部Layerの`parentLayerId` mirrorを別adapterとして維持する。軽量Browserでは通常→Table表示→Table閉鎖後CAF→内部Folder＋子Layerの順序・深度は一致した。多階層時の再現では全DOM再構築時間、active / selected / working ID、`refreshClippingMasks()`全走査時間を三状態で採取し、Lane常時同期や正本統合へ進まない。
- CAF内部Layerの表示親`parentLayerId`とRig親`parentPartId` / `parentBoneId`を同期しない。Folder Partはsubtree、Root Raster PartはCAF直下一枚だけを描画所属とし、reparent前後で有効Part / WARP / clipping ownerが同じなら表示移動を許可する。所属が変わる時だけ理由付きで拒否し、Rigリンクを自動解除・暗黙再接続しない。Setup青の連結node + `RIG`表示は明示登録したFolder / Root Rasterだけへ既存正本から導出する。
- WebGPU brush、SDF / MSDF、水彩・油彩、本格物理、真の無限Canvasは正式な研究Phaseまで凍結する。
- PSD全CAF一括export、通常LayerへのPSD import、再編集可能Text、Camera Track、Folder group完全合成は未実装proposalとして維持する。

## 次の入口

1. `AGENTS.md`
2. `TEGAKI.md`
3. 本書
4. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
5. `開発用資料保管庫/Archive/phase7q.md`
6. `開発用資料保管庫/Archive/phase7p.md`
7. `開発用資料保管庫/Archive/phase7o.md`
8. `開発用資料保管庫/Archive/phase7i.md`
9. `開発用資料保管庫/proposals/00_計画索引.md`
10. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
11. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
12. `開発用資料保管庫/proposals/10_Motion_Graph・Easing・Motion_Path設計.md`
13. `開発用資料保管庫/proposals/12_Camera_Frame・Resize_UI将来設計.md`
14. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`

Phase 7i〜7qはSOL技術close済み。Phase 7rは実装・review・Browser確認まで完了し、untracked生成物7件（asset 5 / log 2）の清掃後に技術closeする。次候補は、今回の監査で見つかった数値scrub / Canvas root Motionのcancel・no-move History統一を小さなbug fix GateとしてP4より先に比較する。P4の途中点追加、Motion Path、manual Meshへ自動で広げない。

## 資料

- Phase 6c完了: `開発用資料保管庫/Archive/phase6c.md`
- Phase 6d完了: `開発用資料保管庫/Archive/phase6d.md`
- Phase 6e完了: `開発用資料保管庫/Archive/phase6e.md`
- Phase 6f完了: `開発用資料保管庫/Archive/phase6f.md`
- Phase 6g完了: `開発用資料保管庫/Archive/phase6g.md`
- Phase 6h完了: `開発用資料保管庫/Archive/phase6h.md`
- Phase 6i完了: `開発用資料保管庫/Archive/phase6i.md`
- Phase 6j完了: `開発用資料保管庫/Archive/phase6j.md`
- Phase 6k完了: `開発用資料保管庫/Archive/phase6k.md`
- Phase 6l完了: `開発用資料保管庫/Archive/phase6l.md`
- Phase 6m完了: `開発用資料保管庫/Archive/phase6m.md`
- Phase 6n完了: `開発用資料保管庫/Archive/phase6n.md`
- Phase 6o完了: `開発用資料保管庫/Archive/phase6o.md`
- Phase 6p完了: `開発用資料保管庫/Archive/phase6p.md`
- Phase 6q完了: `開発用資料保管庫/Archive/phase6q.md`
- Phase 6r完了: `開発用資料保管庫/Archive/phase6r.md`
- Phase 6s完了: `開発用資料保管庫/Archive/phase6s.md`
- Phase 6t完了: `開発用資料保管庫/Archive/phase6t.md`
- Phase 6u完了: `開発用資料保管庫/Archive/phase6u.md`
- Phase 6v完了: `開発用資料保管庫/Archive/phase6v.md`
- Phase 6w完了: `開発用資料保管庫/Archive/phase6w.md`
- Phase 6x完了: `開発用資料保管庫/Archive/phase6x.md`
- Phase 6y完了: `開発用資料保管庫/Archive/phase6y.md`
- Phase 6z完了: `開発用資料保管庫/Archive/phase6z.md`
- Phase 7a完了: `開発用資料保管庫/Archive/phase7a.md`
- Phase 7b完了: `開発用資料保管庫/Archive/phase7b.md`
- Phase 7c完了: `開発用資料保管庫/Archive/phase7c.md`
- Phase 7d完了: `開発用資料保管庫/Archive/phase7d.md`
- Phase 7e完了: `開発用資料保管庫/Archive/phase7e.md`
- Phase 7f完了: `開発用資料保管庫/Archive/phase7f.md`
- Phase 7g完了: `開発用資料保管庫/Archive/phase7g.md`
- Phase 7h完了: `開発用資料保管庫/Archive/phase7h.md`
- Phase 7i完了: `開発用資料保管庫/Archive/phase7i.md`
- Phase 7j完了: `開発用資料保管庫/Archive/phase7j.md`
- Phase 7k完了: `開発用資料保管庫/Archive/phase7k.md`
- Phase 7l完了: `開発用資料保管庫/Archive/phase7l.md`
- Phase 7m完了: `開発用資料保管庫/Archive/phase7m.md`
- Phase 7n完了: `開発用資料保管庫/Archive/phase7n.md`
- Phase 7o完了: `開発用資料保管庫/Archive/phase7o.md`
- Phase 7p完了: `開発用資料保管庫/Archive/phase7p.md`
- Phase 7q完了: `開発用資料保管庫/Archive/phase7q.md`
- Owner制作確認台帳: `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
- Phase 7c移行記録: `開発用資料保管庫/Archive/PHASE7C_HANDOFF.md`
- 整理前Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-28.md`
- 現行proposal索引: `開発用資料保管庫/proposals/00_計画索引.md`
- 現行Phase: `task-codex/phase7r.md`（Stage A / B、SOL review=`A`、Browser完了。build生成差分の清掃待ち）
