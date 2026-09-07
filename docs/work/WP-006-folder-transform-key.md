# WP-006 — CAF Folder Transform KEY

## Goal

CAF内部FolderをVで選び、Folder自身のMotion KEYとして移動・拡縮・回転を保存する。評価時点のFolder子孫全体へ効かせ、KEY作成後に子Rasterを追加しても同じFolder Motionへ含める。

## Owner decision

2026-09-07、Ownerは「現在の子Rasterへ同時に個別KEYを打つ方式」ではなく「Folder自身のKEY（追加設計）」を選択した。未RIG Folderを暗黙にRig Part登録せず、個別`layerTransformTracks`へ展開しない。

## Scope

読む: [Animation評価と出力](../ARCHITECTURE.md#animation評価と出力)、[Transform session](../ARCHITECTURE.md#transform-session)。

変更候補:

- 新規pure module `tegaki_work/system/animation/clip-folder-transform.js`
- `animation-data-model.js`のClipInstance正規化・serialize・duplicate/remap/retime
- `folder-part-render-plan.js`とCPU/Pixi preview consumerの共有評価
- `transform-edit-context.js` / `transform-edit-transaction.js` / `layer-system.js` / `animation-table-popup.js`のFolder bridge
- 関連するmodel、render-plan、Project往復、History、Browser verifier

SOURCE Folderの既存一括Raster bake、Rig schema、Folder WARPの保存正本、WP-004以降の出力terminal方針は変更しない。

## Contract

### Data

- ClipInstanceへoptional `folderTransformTracks`を追加する。各trackは`folderLayerId`、Project座標の`pivotX/pivotY`、Clip-local `keyframes`を持つ。
- KEY fieldは個別Layer Motionと同じ`x/y/scaleX/scaleY/rotation`。補間、同Frame末尾優先、範囲外key無視は既存sampler契約を共有する。
- 対象はClipAssetの`type: folder`だけ。dangling、重複target、非finite、範囲外Frameを検証し、旧Projectのfield欠損は空collectionとして読む。
- 子孫Raster IDはKEYへ保存せず、各Frameの評価時に現在のAsset階層から解決する。これにより後からFolderへ追加したRasterもMotion対象になる。
- nested Folder Motion trackは初回sliceでは明示拒否する。ancestor/descendant両方のtrackを黙って二重適用しない。
- 評価順は子RasterのWARP/MotionとFolder内部合成の後、対象Folder Motion、その後root WARP/root Motion。Folder内部だけで完結するclippingはまとまりとして移動し、境界を跨ぐclippingは既存plan同様に明示拒否する。
- 同じFolderのRig Part Motionとの重複は拒否する。Folder WARPとの組合せはWARP後にFolder Motionを一度適用できる場合だけsupportedとし、consumer間で一致しない場合は初回sliceで拒否する。

### Editing

- Folder選択中はFolder用authority/transactionを固定し、代表working Rasterは入力adapterとしてだけ使う。preview boundsと表示対象は全子孫Rasterのunion。
- 入場だけではKEY/Historyを作らない。変更ありの明示確定はFolder trackへKEY 1件、Timeline History 1件。cancel/no-op/Frame移動は0件。
- KEY確定後はpanel/handlesを維持し、prev/next/wheel、Undo/Redo、save/reopenでFolder選択とKEY表示を一致させる。
- begin/preview/finishの全段階で同じClip、Frame、Folder IDを検証する。代表Raster IDへ縮退した場合はmutation前に拒否する。

## Tasks

1. pure schema、validate/sample/upsert/remap/remove/retimeを実装し、Project JSON往復を固定する。
2. 共有RenderPlanへFolder Motion islandを追加し、CPU/Pixi preview/bake/exportの固定入力を比較する。
3. Folder選択bridgeを専用authorityへ接続し、全子孫bounds/previewとKEY/Historyを実装する。
4. 2子Raster、後から子追加、兄弟Folder、nested拒否、Rig/clipping競合、Undo/Redo/save/reopenを検証する。

## Acceptance

- FolderのV操作で子Raster全体が同じ剛体変形を受け、個別Raster trackは増えない。
- KEY後に追加した子Rasterが既存Folder Motionへ含まれる。
- CPU/Pixi preview/bake/exportが固定入力で一致するか、未実施consumerを明記する。
- 一回の確定はHistory 1、cancel/no-op 0。旧Project読込と新Project往復に破壊なし。
- nested/競合はmutation前にreason付きで拒否し、既存effectとpixelを保持する。

## Verification

```powershell
node tegaki_work/build/development-harness.mjs test transform
node tegaki_work/build/development-harness.mjs test animation
node tegaki_work/build/development-harness.mjs test project
```

pure schema/model往復、CPU固定pixel、実Pixi preview、BrowserのFolder V操作を分けて記録する。技術passとOwner制作受入を混同しない。

## Completion

schema/互換、全consumerの同じ評価順、Folder bridge、Historyと保存往復をleadが確認する。Browserまたは実Pixi未実施は未確認として残し、Ownerの操作感受入を別記する。

## Stop

nested Folder Motionの合成、複数Folder同時編集、Rig Partとの合成、clipping境界変更が必要なら初回sliceへ推測で混ぜず、固定入力とconsumer差をOwnerへ返す。

### 2026-09-07 Slice 1 — pure schema / model

- `clip-folder-transform.js`を追加。Folder ID、Project座標pivot、既存Motionと同じ5 transform fieldを正規化・検証・sample/upsert/remap/remove/retimeする。
- 子孫IDを保存せず、Folder targetだけを許可。重複/dangling/non-finite/範囲外Frameとancestor/descendantの二重trackを拒否する。
- ClipInstanceのoptional `folderTransformTracks`へ接続。旧Projectはfieldなしを空として読み、空ならserializeから省略する。
- model setterはFolder WARPまたはRig Partと同じFolderへのMotion追加をmutation前に拒否する。内部Folder複製ではtrackを新IDへ複製し、Folder削除ではdangling trackを除去する。
- pure/model verifierでsample、no-op置換、pivot不一致、nested/non-finite拒否、retime、Project往復、複製/remap、削除cleanupを確認。
- Animation 33/33、Project 7/7、Transform 13/13、変更JS構文、Vite buildが成功。buildはTemp出力でdist不変。RenderPlan/Pixi/Browser/V bridgeは未実施。

### 2026-09-07 Slice 2 — RenderIsland / Clip metadata

- 既存の共有`createRigPartRenderPlan()`へ`folder-motion` islandを追加。対象Folderの現在のsubtreeを評価時に収集し、子Raster全枚へ同じworld matrixを一度だけ割り当てる。root兄弟はisland外へ保持する。
- 後から追加した子Rasterも同じtrackへ含む。Folder Motionと子のLayer Motion、Mesh/Skin、Rig island、clipping境界splitはunsupportedとして明示拒否する。
- 初回sliceでは同一FolderのWARP/Motion併用をmodel setterの両登録順とRenderPlanで拒否する。
- bounds固定入力で子二枚のunionだけが移動し、root兄弟は不変となることを確認。Timeline CPU/Pixi consumerは既存world-matrix適用経路を共有するが、実Pixi画素は未確認。
- Clip History snapshot、CAF copy/paste、Asset ID remap、retime snapshot、1 Frame bakeへ`folderTransformTracks`を接続した。retimeは既存Clip Motionと同じく終端KEYだけを新終端へ移す。
- Animation 34/34、UI 45/45、Transform 13/13、Project 7/7、変更JS構文、Vite buildが成功。Folder V bridgeとBrowserでのFolder KEY操作は次Slice。

### 2026-09-07 Slice 3 — Folder bridge / Browser / conflict close

- Transform context/transactionへFolder専用authorityを追加。Table展開後も選択Folder IDを固定し、代表working Rasterは入力adapterとしてだけ使用する。
- Folder subtreeの現行drawable Rasterを毎回解決し、DrawingSnapshot boundsのunionをhandlesへ渡す。preview/確定は`folderTransformTracks`だけを更新し、個別`layerTransformTracks`へ展開しない。
- Browser実画面で2子RasterをFolderへ収納し、2Frame CAFへ変更後にFolder Vを起動。2枚を囲むunion bounds、同時移動、F1 KEY確定、History 7→8の1件、panel維持、F2継続を確認した。
- 同じBrowser sessionでUndoによりKEY消失/History 7、RedoによりKEY復元/History 8、Folder Motion dotの再投影を確認した。Ownerの制作操作感受入は未実施。
- Rig、Mesh/Skin、clipping、Folder WARPとの排他を両登録順でmutation前に検査する。共有Assetの別ClipにFolder Motionがある場合もstatic effect登録を拒否し、無関係Assetを巻き込まない。
- Project JSON往復、複製/remap、削除cleanup、retime、1 Frame bake metadataをmodel verifierで確認。BrowserのAlbum保存/再読込とexport実画素はWP-004のterminal/output監査へ引き継ぐ。
- 全153 verifier、構文、harness、Vite buildを最終確認する。実Pixi previewはBrowserで確認済み、CPU/exportの実画素一致とOwner受入は未確認として分離する。
