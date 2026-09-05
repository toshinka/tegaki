# 正式語彙と互換名

状態: CURRENT。コード/保存名を一括renameする指示ではない。
新しい名前を作る前に、同じ対象・責務がここにないか確認する。

| 正式概念 | 意味・所有 | 現行コード/保存名・避ける誤解 |
|---|---|---|
| Project Frame | 出力枠と寸法 | config.canvas / Project geometry。View Cameraとは別 |
| View Camera | 編集表示のpan/zoom/rotation/flip | CameraSystem。出力画像へ焼かない |
| Animation Camera | 将来の最終合成sceneへの時間変形 | 未実装候補。既存View Cameraを転用しない |
| Raster Layer | 絵のpixelと属性を持つ描画単位 | 通常はLayerSystem、CAF内部はClipAsset/Snapshot |
| Background | Project最下層の特別な不透明Layer | Lane/Clip/通常消去対象ではない |
| Layer Folder | Layer表示・合成の階層 | 通常FolderとCAF internal Folderでdata adapterが異なる |
| Lane | 時間配置の行、重なり順 | LaneModel。互換TrackModel、保存tracks |
| Frame | 時間位置 | 内部0-based、UI F1等は1-based。Clip-local Frameを区別 |
| ClipInstance | Laneに配置したAsset参照・duration・時間effect | ClipInstanceModel。互換CelModel、保存cels。「素材そのもの」と呼ばない |
| ClipAsset | 再利用可能な原画、内部Layer、Rig/Mesh Setup | 複数ClipInstanceが同じAssetを参照できる |
| CAF | UIで扱う選択ClipとそのAsset内部編集の文脈 | 歴史的ClipAsset Folder表記。新しい保存object名として使わない |
| ClipAssetFolder | Asset Libraryの素材整理フォルダ | CAF内部Layer FolderやLane Folderとは別 |
| DrawingSnapshot | 原画のpixelsとrasterBounds等 | Snapshot ID参照。単なる表示thumbnailではない |
| working Layer | CAFを既存描画engineへ接続するruntime adapter | 通常Layerと似た形でも保存正本ではない |
| internalLayerId | Asset内部Layerの安定した対象ID | working Layer ID/active indexとは別。明示mapを使う |
| parentLayerId | 表示・合成階層の親 | parentPartId/parentBoneIdと混同しない |
| SOURCE | 原画を編集するTransform context | commit時Raster bake。永続非破壊effect stackではない |
| ANIMATE | 現在Frameの時間変化を編集するcontext | READY/KEYED/PENDINGはUI projectionで保存しない |
| KEY | 明示的な時間サンプル | 入場/選択だけでkeyを作らない。暗黙端点との違いを守る |
| Clip Motion | CAF全体の時間変形 | ClipInstance.transform/transformKeyframes |
| Layer Motion | CAF内部Raster一枚の時間変形 | ClipInstance.layerTransformTracks。root keyのechoではない |
| WARP | 面の形状を変える編集/評価の総称 | root deformer / folderDeformers / layerDeformersの対象を明記 |
| Bind | 変形前の基準 | Poseと区別。World/Clip/Layerの座標系も併記 |
| Pose | 時刻で評価される位置・形状 | static Setupへ書き戻さない |
| LENS / placement | 既存WARPの配置境界 | UI思想のFocus Lensと同じ保存概念ではない |
| Focus Lens | 必要な操作へ注目を絞るUIの考え方 | 新しいdata model名ではない |
| Part | Rigで扱う論理対象 | RigDefinition内の対象。任意の表示Folderと自動同一化しない |
| BONE | 親子・Bind・Poseを持つRig操作単位 | UI日本語「ボーン」。BORNは過去の誤記 |
| RigDefinition | static Part/Bone/接続の定義 | ClipAsset.rigDefinition |
| Rig Motion | 配置ごとのFrame Pose | ClipInstance.rigMotion。RigInstanceMotionは設計文書上の概念名 |
| Mesh | vertices/UV/trianglesの静的形状 | Control MeshとRaster Skin Meshのschemaは同一ではない |
| SkinWeight | BoneからMesh vertexへの影響率 | ClipAsset.skinBindings。UI heatmapは派生表示 |
| RenderIsland | clipping/group effect上、分離変形できない描画単位 | render planの評価結果。一般的な新しい保存配列にしない |
| AUTO GRID/SHAPE/LINE | 明示的なMesh生成method | Raster更新のたびにtopology/weightを無言で再生成しない |
| STALE | 元RasterとSetupの対応確認が必要な状態 | 自動修復済み/使用不能と一律に同義ではない |
| Motion Graph | 既存KEY/easingの編集表示 | Graph専用の第二KEY正本を作らない |
| Motion Perform | gestureを時間記録する将来入力方式 | 現在の単一Frame dragと区別。solver実装済みを意味しない |
| Bake | 評価結果を明示的に固定化する操作 | SOURCE Raster bake、Clip structured bake、exportを区別 |
| History command | 線形Undo/Redoの一件 | do/undo。redoという別メソッド名へ再発明しない |
| Technical verified | 指定した自動/実機checkを通過 | 全組合せ・Owner制作受入の意味ではない |
| Owner accepted | Ownerが指定範囲を実機受入 | 未確認の長尺/pen/旧Projectまで拡大解釈しない |

旧`sourceLayerId/layerId`や`tracks/cels`は互換名。新しい責務を足す口実にしない。
廃止名を消す場合はProject read/write、copy、History、外部URL、verifierの移行を一緒に計画する。
