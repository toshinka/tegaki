# Phase 6r: Animation Project保存容量・Layer選択安定化

## 目的

複数Folder / LayerへMotion・WARPを重ねたProjectで、保存前の緩慢化、`JSON.stringify`の`RangeError: Invalid string length`、Album外部保存失敗を解消する。保存round-tripを受入れた後、通常modeとAnimation Table表示 / 閉鎖後でLayer Transform対象やLayer Panel順がずれる残存を再現監査する。IK / Stretchへ進む前の安定化Gateとする。

## Owner再現条件

- 400×400程度のCAFへ複数Folder / Raster Layerを作る。
- 複数BONE MotionとWARP keyを重ね、Project quick saveまたはAlbum snapshotを行う。
- 失敗例は`project-manager.js`のファイル書き込み前、`JSON.stringify(projectData)`で`RangeError`になる。OneDriveへの実書き込みより前に発生するため、保存先だけを原因と決めない。
- 通常modeでは、Layer Panelで選んだRasterとV変形対象が異なる、Folder / Layer cardの順・位置がTable表示時と食い違う場合がある。保存問題の受入れ後に別Sliceで扱う。

## Slice 0: 保存shape・肥大化監査（完了）

- animation working Layerの強制captureごとに新しいDrawingSnapshot世代を追加し、旧世代を回収していなかった。
- asset-backed Clipでも互換`rasterSnapshot`をtrack JSONへ残せるため、同じRasterがDrawingSnapshotとcelの双方へ重複し得た。
- RGBA TypedArrayを数値ArrayとしてJSON化すると、4byte画素が複数文字の数値と区切りへ膨張する。Motion / WARP key正本自体の重複ではない。
- Albumは軽量参照を保持し、外部Project JSONが再編集正本である既存境界を維持する。

## Slice 1: Project JSON compaction（実装）

- `TimelineModel.collectUnreferencedDrawingSnapshots()`で、ClipAsset / internal Layerから現在参照されるSnapshotだけをProject正本へ残す。Historyは従来どおり各stateの画素を所有する。
- working Layer強制captureの前後と通常capture後に旧世代を回収し、編集中・保存時の世代蓄積を止める。
- Project JSON境界だけRGBAをbase64へ符号化する。Runtime / History / DrawingSnapshot正本は`Uint8ClampedArray`のまま、`pixelEncoding`未指定の旧Array Projectも読み込む。
- asset-backed celは現行DrawingSnapshotが解決できる場合だけ互換`rasterSnapshot`を省略する。旧celの直接Rasterはbase64で維持する。
- `JSON.stringify`失敗を未処理例外にせず、保存失敗結果とFutaba UI toastへ変換する。
- 初回native pickerはDownloadsを開始位置のhintとする。既存FileSystemFileHandleがある場合はその保存先を維持する。

## Slice 2: 実Project round-trip / latency受入れ（継続観察）

1. オーナー再現規模または同等fixtureで、保存前後のDrawingSnapshot数、decoded pixel bytes、JSON長、serialize / stringify時間を採取する。
2. Project quick save、Album外部snapshot、file import / direct loadを確認し、Folder、内部Layer、Rig、Motion、WARP、active編集contextをround-tripする。
3. saveを繰り返してSnapshot数とJSON長が単調増加しないこと、UI操作が保存処理後に復帰すること、console errorがないことを確認する。
4. Downloads hintはOS / browserの記憶やfolder redirectに従うため、OneDrive回避を保存仕様へ固定しない。必要なら将来、明示的な保存先表示を別UI Sliceで検討する。

Owner実機では2026-08-01時点で、多数Folder / LayerとMotion keyを置いても以前の`Invalid string length` crashは再現していない。最終closeまでは連続save / reopenを継続観察する。

## Slice 2.5: CLIP MOTION小修正（実装）

- CAF全体Motion / WARP keyの既存drag正本を増やさず、子LaneのBone / legacy Part keyも既存`rigMotion.boneTracks / partTracks`内でFrame移動できるようにした。移動先にkeyがある場合は上書きしない。
- 未設定CAFは初回だけRIGを開く。設定済みCAFの再openは、明示的に最後に選んだRIG / MOTION / WARP tabをUI preferenceから復帰する。自動RIG誘導ではlast-usedを上書きしない。
- Browser固定入力でBone keyのF1→F2 drag、WARP tabを選択した後のclose / reopen復帰、console errorなしを確認した。
- Project layer採取前に既存V Layer Transform確定経路を通す。animation working Layerは`transform-exit`後のcaptureを1 Frame待ってからserializeし、画面だけ変形済みで旧RenderTextureを保存する状態を避ける。

## Slice 2.6: KEY複数選択・tab復帰・配色修正（実装）

- CAF自体の既存Ctrl/Cmd複数選択規約をKEYへも適用する。Motion / WARP / Bone / legacy Part KEYはCtrl/Cmd+clickで加除し、選択KEYのdragは同一Frame差分で一括移動する。
- 通常clickはpointerdown中だけ移動可能表示を出し、release後は固定選択へ残さない。Ctrl/Cmd+clickだけを複数KEYの待機状態とし、同じKEYの再clickで解除する。通常dragした未選択KEYも固定選択へ昇格させない。
- 一つでも移動先が未選択KEYと衝突する場合は全体を変更しない。複数選択はruntime UI状態であり、Project / Historyへ新正本として保存しない。Historyは一括移動を1操作として記録する。
- 設定済みBone / FolderのLane選択はeditor tabをRIGへ奪わない。未設定FolderのSetupだけRIGへ案内し、再openはglobal last-usedのRIG / MOTION / WARPを復帰する。
- BONE PIVOT設定済み表示はMotion KEYの`◆`と区別して`✓`へ変更する。未styleだったBone KEY buttonにもPart KEYと同じふたばpaletteを適用し、browser既定の黒 / grayを除く。

## Slice 3: 通常Layer選択 / V変形 / Panel順監査（予約）

- 通常Layer、CAF working Layer、Table表示中、Table閉鎖後の4状態で、選択ID、表示adapter、V変形対象、確定 / Escape、Panel card順を同じ観測表で比較する。
- 通常LayerSystemとTimelineModelを統合しない。「1 UI engine、2 data adapters」を維持し、共有可能なのはtarget解決と座標代数だけとする。
- 再現前に大規模リファクタリングを始めない。誤対象Raster、順序破損、Undo / Redo、save / reopenの固定入力を得てから限定修正する。
- 関連headerにはTable表示有無で分岐するadapter境界と、変更時に両経路を検証する注意を記載する。
- 2026-08-01 Browser監査では、Table表示中にCAF内部`レイヤー3`を選択した後、Tableを閉じるとstatus / working activeが`レイヤー1`へ戻る例を再現した。Panel UI選択、working adapter active、Timeline内部Layer IDを分けて観測する最初の固定入力とする。
- 原因はFrame同期が同一Assetでも`selectedInternalLayerId`をnullへ落とし、先頭Rasterをworking activeへ再選択していたことだった。同じAssetにIDが残る時だけ選択を保持し、Browserで`レイヤー3`のTable閉鎖、V確定、再open、V Escape、Panel順不変を確認した。
- Owner追試ではV変形の保存ずれは全Layerで一律ではなく、Canvas resizeを挟んだ外部clipboard貼付Rasterが候補となった一方、複数貼付の一部は意図配置を保持した。広域修正せず、`外部paste → resize → V確定 → save/reopen`を固定入力へ加えて対象adapterを特定する。
- Browserのfile chooser経由で添付画像を投入する試行は、ネイティブchooser待ちで完了しなかった。これは製品コードの失敗とは扱わず、OS clipboard / native file chooserを使うオーナー実機の受入入力として残す。`ImageImporter.importImageData()`のresize前後snapshot、working Layerのdrawing capture、ProjectManagerのtransform commit待ちはコード監査済み。

## 次Phase候補: Folder別WARP GRID

- 現行`ClipInstance.deformer`はCAF全体一件の正本であり、Folder tabを有効にするだけでは髪・顔等の同時個別WARPを保存できない。Phase 6rへ新正本を混ぜない。
- 次Phase Gate 0では、既存deformer型を再利用するoptional target collection、stable internal Folder ID、Folder RenderIsland、copy ID remap、History、Project round-tripを一つの契約として決める。
- 評価順の第一候補は`Folder subtree合成 → Folder-local WARP → Bone / Part world matrix → CAF合成 → 既存CAF root WARP → root Motion`。Pixi previewだけでなくCPU compositor / Bake / exportを同時に通す。

## 維持する契約

- stroke中working Layer表示、preview staging交換とpreview container順、上側Lane前面。
- Lane / Timeline onionのdisplay-only境界、PSD record順、Folder clipping。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Motion、WARP mask、Mesh、physicsの正本を重複実装しない。
- 旧Project Array raster、旧cel直接`rasterSnapshot`、CAF copy ID remap、History round-tripを維持する。

## このPhaseで行わないこと

- IK、Pin、Follow、Stretch、Constraint
- Mesh、SkinWeight、Morph、Perform、physics、自動Mesh
- WARP正本追加、Text、Deformer SELECT、WebGPU / SDF / MSDF
- LayerSystemとTimelineModelの統合、Panel DOM全面置換

## 検証

- 変更JSへ`node --check`。
- Project JSON compaction verifier、全Rig verifier、関連Bake / WARP / Project round-trip verifier、`npm.cmd run build`。
- BrowserでProject quick save、Album外部snapshot、再open、Rig / Motion / WARP保持、連続save、操作遅延、console errorを確認する。
- Slice 3では通常 / Table表示 / Table閉鎖後のV確定・Escape、Layer選択、Panel順、Undo / Redoを確認する。
- build後は`dist/`と`node_modules/.vite/`の生成差分を残さない。
