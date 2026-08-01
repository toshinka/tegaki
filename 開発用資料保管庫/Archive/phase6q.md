# Phase 6q: 複数PIVOT Bind Setup / 兄弟Folder剛体Rig

## 目的

RIGを開いた直後からCAFと全内部FolderのPIVOTをCanvas上で同時に確認・選択・配置できるようにする。UI専用PIVOT正本は作らず、操作されたFolderだけを既存`rigDefinition.parts / bones / rigidBindings`へ昇格する。

## Owner HMI契約

- CAF + 全FolderのPIVOTをRIG中は常時表示する。activeは青 / 水色、inactiveは薄い中心 + 栗茶輪郭、Folder名tagを添え、MOTIONの橙Pose操作と区別する。
- Canvas上のPIVOT選択で対象を切り替える。対象tabへ手を伸ばさなくてもよい。
- 中心dragでX / Y、尻尾dragまたは尻尾上wheelで初期角度を変更する。数値欄と双方向同期する。
- `PIVOT配置`を押す前提にしない。未設定Folderは内容bounds中心から導出表示し、最初の実操作でPart + Bone + bindingへ遅延昇格する。
- UIを開いただけでは旧Projectの保存shapeとHistoryを変えない。

## Slice 0: 現行境界監査（完了）

- Part / Bone / bindingのoptional schemaは複数定義を保持でき、FK evaluatorも複数rootを評価できる。
- 描画側だけが一つのRenderIslandへ制限されていた。兄弟Folderならsubtreeが重ならないため、既存clipping検証を各Islandへ適用して拡張できる。
- nested Folder Partは相対Island合成が必要で、同じ拡張へ混ぜると二重transformになるため別Sliceとする。

## Slice 1: 全PIVOT表示と複数root Bind Setup（実装済み）

- `rig-pivot-overlay.js`をdisplay / gesture adapterとして追加した。保存正本とHistoryは所有しない。
- CAF PIVOTと全Folder PIVOTを同時表示し、Canvas選択、中心drag、尻尾drag、wheel、X / Y / Rotation入力を接続した。
- 未設定Folderは選択だけでは保存データを増やさず、最初の変形で既存Part + root Bone + rigid bindingへ一括昇格する。
- 複数の兄弟Folder Part / root Bone bindingを独立RenderIslandとしてpreview / playback / onion / Bake / export共通planへ接続した。
- Slice 1時点ではnested Folder Partとchild Bone bindingをfallbackとし、Slice 2で開く境界を分離した。

## Slice 1b: Owner実機フィードバック健全化（実装）

- CLIP MOTION表示中のCanvas左入力は、RIG / MOTION / WARP操作だけを受け付け、handleを外した入力を描画engineへ流さない。panelを閉じれば通常描画へ戻す。
- 未設定Folderの直接操作で遅延昇格する際は、導出表示と同じ38px相当の初期Bone長を維持し、内容bounds再計算による尻尾の急伸長を防ぐ。
- 重なったPIVOTはtarget tabで選択したactive要素をhit-test最前面へ上げる。RIGの中心 / 楔hit areaを18pxへ拡張する。
- MOTIONのroot Bone overlayも中心 + 楔へ統一し、中心dragをX / Y Pose、楔dragをRotation Poseへ接続する。保存正本は既存`rigMotion.boneTracks`のままとする。
- headerの長いnative tooltipを撤去し、現在tabの操作だけを表示する明示`?`popoverへ置き換える。
- 自動Mesh、線画 / 塗り別generator、SkinWeight配置案はproposal 15へ記録するだけとし、このPhaseでは実装しない。

## Slice 2: 親子接続線と剛体FK authoring（実装・Browser確認）

1. PIVOT間の線は`parentBoneId`の可視化とし、RIG Inspectorの親BONE選択から明示接続する。表示Folder階層を親BONEへ自動保存しない。
2. 親変更はBind world位置を維持してlocal Bindへ再基底化し、循環を拒否する。
3. nested Folderを最寄り登録ancestorのRenderIslandへ排他的に割り当て、親 / 子Partの二重transformを除去した。
4. 初期挙動はforward kinematicsとする。親の移動・回転は子孫へ伝播し、子の操作は親を動かさない。
5. RIGとMOTIONのCanvasには全設定済みBONE PIVOTと接続線を表示する。RIGは青、Motion activeは橙とする。
6. 近接PIVOTの18px hit areaが重なる場合は、DOM順ではなくpointerに最も近いroot / 楔へdrag / wheelを割り当てる。
7. Motion主UIはBONEへ一本化する。Folder Part trackは旧Project互換schemaとして残すが、Folder / BONEの二択を表示しない。

## Slice 2b: Canvasだけで完結する親BONE authoring（実装）

- Inspectorの親BONE dropdownを維持しつつ、RIG中は設定済みPIVOT中心の長押しから接続線を引き、別PIVOT中心へdropして親を設定できる。
- 既存接続線は太い透明hit areaから直接dragして付け替える。接続先のない場所へdropすると親を解除し、Escape / pointer cancelは変更しない。
- Canvas gestureは既存`parentBoneId` setterへ委譲し、world Bind位置の再基底化、循環拒否、Historyを重複実装しない。
- 保存Bone長38pxは変えず、Canvas表示だけを16〜24pxへ短縮した。中心円と楔の対応を保ちながら密集時の判別を優先する。

### 操作役割の決定

- RIG: PIVOT位置、初期角度、親BONE。
- MOTION: BONE PoseのX / Y / Scale / Rotation。親Poseは子孫へ剛体FK伝播する。
- WARP: GRID点と将来の四隅handleによる自由変形。平行四辺形化をMotionやFolder transformへ重複実装しない。
- Layer Transform / 矩形選択: 通常Raster編集。将来四隅自由変形を共通化する場合もWARPと同じ変形代数を検討し、現Sliceへ混ぜない。
- 手をeffectorとして動かすIK、腕の自動伸縮、先端だけのMesh変形は別Phase。rigid FKへ暗黙実装しない。

## 維持する契約

- static Bind SetupはClipAsset、Frame PoseはClipInstance。animation working Layerは保存正本ではない。
- Part / Bone / Clip root Motion / WARPの合成結果を保存正本にしない。
- Pixi preview / playback / onionとCanvas / Bake / exportは同じrender planを使う。
- Folder clipping、上側Lane前面、preview staging / container順、PSD record順を維持する。
- 一操作一History、Escape cancel、Project round-trip、CAF copy ID remapを維持する。

## このPhaseで行わないこと

- IK、Pin、Follow、Stretch、Constraint
- Mesh、SkinWeight、Morph、Perform、Draw Order、Dynamics、physics
- WARPのFolder別正本、Text、Deformer SELECT、WebGPU / SDF / MSDF
- toolbarカスタマイズ、選択tool横断リファクタリング

## 検証

- 変更JSへ`node --check`、全Rig verifier、`npm.cmd run build`。
- Browserで4 PIVOT表示、選択、active色、遅延昇格時の尻尾長維持、X / Y / Rotation、MOTION中心 / 楔操作、Canvas描画防止、`?`popover、複数兄弟Part Motion、Table閉 / 再open、console errorを確認する。
- build後は`dist/`生成差分を残さない。

### 2026-07-30実施結果

- 全Rig verifier、Clip Bake、structured Bake、WARP回帰、production buildは成功した。
- BrowserでCAF + 3 Folderの4 PIVOT、Canvas選択だけではHistory不変、active / inactive色分離、初回数値操作での遅延昇格、X / Y / Rotation同期、兄弟2 root、Bone rotation key、Table閉 / 再open後の保持を確認した。
- Layer Panel同期後もactive PIVOTが消えないよう、Canvas表示の対象判定をInspectorと同じancestor解決へ統一した。console error / warningはなかった。
- Slice 1bではBrowserで、CLIP MOTION中の空振りdragがHistory不変、panel close後の描画復帰、遅延昇格前後の尻尾長38px維持、RIG active青、MOTION楔橙を確認した。
- 重なった2 Folderはtarget tab選択でactive PIVOTが最前面になり、両方を独立移動できた。MOTION切替直後もworking Layer ancestorから楔を復元し、中心dragでX / Y、楔dragでRotationだけが更新され、長さ38pxを維持した。
- `?`は現在tabの説明だけをクリーム / 栗茶popoverへ表示し、headerのnative tooltipは出ない。console error / warningはなかった。
- 実pen / touchはオーナー実機確認を残す。
- Slice 2では4段nested FolderをBrowser上で作成し、全FolderのPIVOT / BONE登録、親BONE dropdown、3本の接続線、親PIVOT移動・初期角度変更の子孫伝播、末端PIVOTの独立移動・回転を確認した。
- alpha-tight内容boundsをSetup PIVOT導出へ使い、400×400 snapshot boundsへ全PIVOTが重なる状態を避けた。nested RenderIslandは最寄り登録ancestorへ排他的に所属し、child Bone world deltaを一度だけ適用する固定入力を追加した。
- CAF内部Folder選択をworking Layerのactive同期とRaster capture後の一時選択で上書きしないようにし、Table表示 / 非表示を跨ぐV変形の対象選択を安定化した。非空Folderの小移動は、Table表示中 / 閉鎖後とも確定でHistory 1件、EscapeでHistory不変、Folder選択維持をBrowser確認した。
- Motionでは親Boneの90度回転keyが子孫PIVOTと内容へ追従し、近接PIVOTはpointer距離優先で選択されることをBrowser確認した。RIG wheelはbind角度、MOTION wheelはscaleを更新し、各gestureをHistory 1件へまとめる。
- 残りは実pen / touchと、実機でShiftを保持したMOTION wheel / dragの修飾入力をオーナー確認すること。IK / Stretch / Meshは次Phase候補とする。

### 2026-08-01 close判定

- オーナー実機で複数BONEのRig設定と親子FK Motionを受入れた。
- Canvas親接続gestureをdropdownと同じsetterへ接続し、PIVOT表示のstemを短縮した。全Rig verifierとproduction buildは成功した。
- 中規模Motion / WARP Projectの保存肥大化と、通常modeでのV変形・Layer Panel選択差はPhase 6rへ切り離す。安定化をIK / Stretchより先に行う。
