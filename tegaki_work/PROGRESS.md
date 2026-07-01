# PROGRESS — 現在状態

更新日: 2026-07-01

> 現在状態、既知残存、次の入口だけを記録する。
> 詳細計画は `開発用資料保管庫/proposals/00_計画索引.md`、
> 完了文書は `開発用資料保管庫/Archive/` を参照する。

## 現在のPhase

Phase 5a、Phase 5b、Phase 5c、Phase 5dは完了。
Phase 5eの構造・UIスタイル整合監査も完了。
Phase 5fのFolder selection clipboardも完了。
指示書は `開発用資料保管庫/Archive/phase5f.md` へ移動した。
Phase 5gのAirbrush描画境界整理と重ね塗り品質修正も完了。
指示書は `開発用資料保管庫/Archive/phase5g.md` へ移動した。
Phase 5hのRaster変形反復劣化低減も完了。
指示書と引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5iの通常・逆クリッピング統合は完了。
指示書と引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5jのTimeline再生範囲・終端・ループ制御も完了。
指示書、監査、引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5kの多枚数CAFメモリ・VRAM安定化は完了。
指示書は `開発用資料保管庫/Archive/phase5k.md` へ移動した。
Phase 5lの大容量CAF保存・復元・Album参照カード化も完了。
指示書は `開発用資料保管庫/Archive/phase5l.md` へ移動した。
Phase 5mのペン入力点・筆圧・補間品質改善も完了。
指示書と引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5nのVキーLayer全体変形入口の再確認と修正も完了。
指示書と引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5oの画像import / 外部クリップボード画像貼り付けも完了。
完了記録は `開発用資料保管庫/Archive/phase5o.md`。
Phase 5pの無限キャンバス / 欄外ラスター保持も完了。
指示書と引き継ぎは `開発用資料保管庫/Archive/` へ移動した。
Phase 5qは `task-codex/phase5q.md` として立ち上げた。Animation Tableを閉じた時のLane表示モードを、保存正本へ混ぜないdisplay-only改善として扱う。

## アニメ画像import追記

- GIF/APNG読み込み時、2フレーム以上に分解できる場合は現在FrameからCAFセルを連番作成し、各CAF assetの内部Raster Layerへ各フレーム画像を収納する。
- APNGは既存依存の `upng-js` で合成済みフレームへ分解する。GIFはブラウザ `ImageDecoder` が使える環境で分解し、未対応環境では従来どおり静止画importへフォールバックする。
- FPS / per-frame duration同期は未実装。まず絵を各CAFへ分解収納することを優先した。
- Resize popupに対象切替（キャンバス / 内容 / 両方）と内容基準（幅 / 高さ / 全体 / 見切れ）を追加した。
- 旧 `DOMBuilder` 由来のResize popupが残っていても起動時に新UIへ差し替え、キャンバスのみ / 内容 / 両方の各モードで軽量プレビューを表示する。
- Resize popupは横長2カラムへ圧縮し、内容単独モードでは拡縮を現在内容比の `%` スライダーとして表示する。プレビューはalpha bounds矩形だけでなく合成サムネイルを同じ枠内へ表示する。
- Resize popupの幅 / 高さ / 内容拡縮%表示はダブルクリックで直接数値入力でき、Enter / blurで反映、Escapeでキャンセルできる。
- 内容拡縮は通常Raster LayerとCAF DrawingSnapshotのalpha bounds unionを基準に同一scaleで変換し、Undo / Redoは通常Layer snapshotとTimeline stateをまとめて復元する。
- 画像importボタンは読み込み設定popupを開き、キャンバス内フィット / 原寸貼り付け / 画像サイズへキャンバス変更を選んでからファイルを選べる。clipboard画像は従来どおりキャンバス内フィットを維持する。
- 左サイドバーは右サイドバーに合わせて背景濃度 / gap / 角丸を揃え、低い画面高でもアイコンを縮小・内部スクロールせず画面外へ自然に切れる固定サイズ表示へ変更した。
- レイヤーパネルと右サイドバーの間隔は、通常Layerでは短いカード幅のまま詰め、CAF展開時だけCAFカード幅へ広げる。レイヤー数が多くスクロールバーが必要な時だけスクロール余白を内側に戻す。
- Quick tool presetsは横幅をさらに抑え、COLOR / TOOL / SLOTS / sliderを短く小型化した。TOOLとSLOTSは6枠化し、矩形選択もQuickから選べる。COLOR / TOOL / SLOTSの固定ラベルは削り、bucketの全レイヤー参照切替はbucketボタン上バーへ移した。SIZE / OPACITYの値表示はダブルクリックで直接入力できる。

## フォルダ機能追記

- 通常フォルダ選択時、配下Raster Layerがある場合はVキー変形を開始できる。preview中は配下Raster Layerへ同じ一時transformを同期し、確定時に各Layerへbounds込みsnapshotとして焼き込む。
- フォルダopacityは配下Layerへ祖先フォルダopacityを掛けたeffective alphaとして反映する。通常Layer自身のopacity値は `layerData.opacity` に残し、フォルダ階層の表示だけを合成時に調整する。
- CAF内部フォルダもopacityを配下Rasterへ累積反映する。animation preview / onion / export compositor / working Layer表示のalphaを同じeffective opacityで同期する。
- CAF内部フォルダ選択時、Vキー前に最初の配下working Rasterを代表Layerとしてactive化し、preview中のtransformを他の配下working Rasterへ同期する。V確定時は代表以外の配下working Rasterも同じLayer transform確定経路で焼き込み、CAF assetへ保存する。
- CAF内部フォルダ選択時に代表working Rasterをactive化しても、選択正本はCAF内部フォルダのまま維持する。これにより、CAF内部フォルダのVキー変形で子Layer選択へ落ちず、通常フォルダと同じ「フォルダ選択のまま一括変形」契約になる。
- CAF内部フォルダのV変形中は、開始時のCAF asset / folder / working Layer群を一時セッションとして保持する。active working Layer同期が子Layerへ寄っても内部フォルダ選択へ戻し、フォルダ一括変形対象を維持する。
- CAF内部フォルダのV変形確定前に、対象working Layer群の変形後boundsがRenderTexture上限・安全ピクセル数を超えないか事前検査する。危険な場合は確定を止め、壊れたpreview状態をCAFへ保存しない。
- CAF working Layer変形の確定が失敗 / cancel扱いになった場合は、`_saveSelectedClipFromWorkingLayers(force)` へ流さずCAF正本からworking Layerを復元する。
- CAF文脈でV変形パネルの反転 / リセットボタンがdisabledになる問題を修正した。activeがanimation working Layerの場合はボタン操作もショートカットと同じtransform経路へ通す。
- Vキー回転 / 拡縮 / flip確定は、プレビューと同じ中心変換行列で変形後AABBを計算し、Raster boundsを拡張して焼き込む。通常Layer / 通常フォルダ / CAF内部フォルダで、枠外へ出た部分を旧RenderTextureサイズで欠けさせない。
- V変形パネルのスライダーは慣性なしにし、回転値がpointer up後に流れ続けないようにする。
- フォルダVプレビュー中は配下Rasterごとのサムネ更新を行わず、Sprite transform同期だけに抑える。複数Layerのフォルダ変形確定時は右下に処理中indicatorを出してから確定する。
- 通常フォルダ / CAF内部フォルダの属性popupでblend modeを選べるようにした。CAF preview / onion は内部Layer親子をPixi Containerへ再帰描画し、フォルダopacity / blendをグループへ適用する。
- Timeline export compositorは通常Layerフォルダ / CAF内部フォルダをCanvas2D上で再帰合成し、フォルダ配下を一枚のgroup canvasへ描いてから親へopacity / blend適用する。`add` はCanvas2Dの `lighter` へ変換する。
- フォルダblendはPhotoshop / CLIP STUDIO PAINT系の標準に合わせ、子Layerのblend modeを変更せず、フォルダ配下をgroupとしてまとめた後にフォルダ自身のopacity / blendを親へ適用する方針にする。子が乗算、親フォルダが加算の場合は両方を段階的に機能させ、子設定を上書きしない。
- フォルダ単位clippingは未実装。次の入口は、フォルダgroup canvas自体をclip source / clip targetとして扱う契約を決めること。

## PSD連携追記

- 通常Layer / Folder構造を保持したPSD exportを追加した。既存PSDボタンの開発中throwを外し、`ag-psd` でPSD Blobを生成する。
- 通常Raster Layerは `createLayerRasterSnapshot()` のunpremultiply済みRGBAと `rasterBounds.x/y` を使い、PSD layerの `imageData` / `left` / `top` へ渡す。Project frame外に保持した欄外Rasterも、PSD上では負座標またはキャンバス外座標として残す。
- TegakiのLayer配列は下から上、PSD `children` は上から下のため、root / Folder内とも直下siblingsを逆順でPSD treeへ変換する。
- FolderはPSD groupとして `children` を持たせ、開閉、表示/非表示、opacity、blend modeを渡す。Folderの通常blendはPhotoshop標準に合わせて `pass through` として出力する。
- 通常clippingのみPSD `clipping` へ渡す。逆クリッピングとFolder単位clippingはPSD初回exportでは未対応。
- Export popupのPSD出力に通常Layer / アクティブCAFのscope切替を追加し、選択中CAFの内部Layer / Folder構造をPSD treeへ出力できるようにした。
- アクティブCAF PSD exportは、出力直前にworking LayerをCAF assetへ保存し、DrawingSnapshotの `rasterBounds.x/y` をPSD layerの `left` / `top` へ渡す。
- Album popupからアクティブCAFを `active-caf` snapshotとして保存できるようにした。保存時は選択CAF asset、内部Layer / Folder、参照DrawingSnapshotを標準化payloadとして保持し、AlbumカードへCAF badgeを表示する。
- Album上の `active-caf` snapshotを開くと、現在選択中のCAFへ内部Layer / FolderとDrawingSnapshotを取り込み、Timeline Historyへ `caf-import-album-active-caf` として記録する。
- Album toolbarは通常Project保存 / アクティブCAF保存、通常Projectロード / アクティブCAFロードを本アイコンの色違いで分ける。`active-caf` snapshotはアクティブCAFへ取り込むだけでなく、通常ProjectのLayer / Folder構造として開くこともできる。
- 画像読み込みボタンでPSDファイルも選べるようにし、`.psd` の場合は選択中のアクティブCAFへPSD Layer / Folder構造を取り込む。PSD childrenはTegaki内部Layer順へ反転し、Layer `left/top` はDrawingSnapshot `rasterBounds.x/y` として保持する。
- PSD importの取り込み先は `selectedAssetId` を優先し、未同期の場合は選択中セルの `clip.assetId` をフォールバックする。初回CAF1選択直後でもアクティブCAFへ取り込みやすくする。
- PSD import時に `selectedAssetId` と `selectedCelId` がずれている場合は、対象assetを参照するclip/celへ明示的に切り替えてから同期する。CAF1へPSD取り込み後にCAF2へ再取り込みしても、working Layer復元が別CAFを参照しない契約にする。
- PSD import時はLayer imageDataの透明余白をalpha boundsで刈り込んでDrawingSnapshot化する。読み込み中は処理中indicatorを表示し、重いPSDでも操作不能に見えにくくする。
- PSD importは画像import popupのキャンバス内フィット / 原寸 / 画像サイズへキャンバス変更を反映する。巨大PSDはWebGL context loss回避のため、Tegaki最大キャンバスサイズ・RenderTexture上限・安全ピクセル数を超えないscaleへ縮小して取り込む。
- アクティブCAFへのPSD import履歴はTimeline全体ではなく、対象CAF assetと参照DrawingSnapshotだけを保存する。Undo / Redoで全Timeline snapshot配列を丸ごと差し替えず、PSD再読み込み時のメモリ圧迫とworking Layer再同期の不安定さを抑える。
- Working Layer復元時、RenderTexture上限や安全ピクセル数を超えるsnapshotは復元を拒否し、CAF working Layerを同期済み扱いにしない。これにより巨大PSD由来の表示不能状態を避ける。
- PSD import前のCAF保存はdirty時だけ行い、履歴復元後のworking Layerを無条件に再キャプチャしない。PSD再読み込み / Undo / RedoではCAF preview containerとSnapshot texture cacheを即時破棄してからCAF assetを復元する。
- PSDをCAF1へ取り込み後、CAF2へ同PSDを再取り込み、またはPSD由来CAF内部フォルダをV変形した時のCanvas表示欠落対策として、CAF内部Layer操作履歴を対象CAF asset scopedへ寄せ、全Timeline snapshot配列の丸ごと差し替えを避ける。
- Working Layer / Album active-caf / PSD importの復元でsnapshot pixel length不一致やRenderTexture復元失敗を検出した場合、同期済み扱いにせず取り込み前assetへ戻す。サムネイルだけ生きてCanvas表示が死ぬ状態へ進みにくくする。
- CAFセル選択時に `selectedCelId` だけでなく `selectedAssetId` / `selectedAssetFolderId` も同期する。PSD import / Album active-caf importは選択中セルのassetを第一候補にし、CAF1選択のassetが残ったままCAF2へ連続importするズレを避ける。
- 通常Project / Albumロード時のLayer画像復元は、PNGを直接Pixi Texture化せずCanvas2Dへ正規化してからRenderTextureへアップロードする。保存rasterBoundsより復元PNGが小さい場合は警告を出す。
- エアブラシの一時mask RenderTextureを開始時に透明クリアする。未初期化RenderTextureを `clear:false` で加筆して大面積欠落・消し込みに見える経路を塞ぐ。
- Pixi mask解除は `target.mask = null` だけでなく `setMask({ mask: null, inverse: false })` で `_maskOptions.mask` も消す。PSDをCAF1→CAF2へ連続importした後に、破棄済みclipping mask参照がAlphaMaskPipeへ残ってCanvas描画が停止する経路を塞ぐ。
- PSD importではPSD由来のクリッピングをCAF内部Layer属性として残さず、取り込み時に対象DrawingSnapshotのalphaへ焼き込んで `clipping=false` にする。完全互換よりTegaki内部ラスター化を優先し、連続CAF import時にPixi alpha mask経路へ戻る余地を減らす。
- CAF previewのSnapshot texture cacheは、即時invalidate指定でもTexture破棄を2フレーム遅延させてからGCする。Containerから外した直後のPixi render instructionsが破棄済みTexture / mask参照を踏む経路を避ける。
- オーナー実機で `TEST.psd` のCAF1→CAF2連続import、PSD由来CAF内部フォルダのV拡縮 / 回転、PSD再読み込みがCanvas表示を破壊しないことを確認した。初回PSD import時だけ既存working Layer初期化由来と思われるHistory増加が残るが、二回目以降は対象CAF asset単位の1履歴へ収まる。
- Album active-caf importもPSD importと同じく、選択中セル / assetのズレを補正して対象clipを固定し、適用前後でCAF preview runtimeをresetしてからworking Layerへ同期する。
- PSD再取込 / Album端欠け / エアブラシ欠落の調査記録は `開発用資料保管庫/proposals/psd_caf_import_failure_investigation_2026-07-01.md` を入口にする。現状は破壊再発時の再調査資料として残し、通常導線は継続する。
- CAF全体PSD export、通常LayerへのPSD import、CAFモードからアクティブCAF以外を破棄して通常モードへ戻す操作は後続候補として残す。

## Clipboard / CAF table追記

- 通常 / CAF Layer panelのフォルダサムネクリックで、カードdragを開始せずフォルダ開閉へ通す。
- CAF Layer panel mirrorのサムネ / 表示 / クリッピング / 名前操作部は、div製アイコンでもカードdragを開始しない。マウス操作でもフォルダ開閉と表示/非表示がクリックとして通る。
- `Ctrl+V` は内部clipboard（通常Layer / Folder、CAF内部Layer / Folder、CAFセル、選択範囲）を優先する。OS / ブラウザ画像clipboard貼り付けは `Shift+Ctrl+V` に移した。
- 通常Layer / Folderの `Ctrl+C` はbounds込みRaster snapshotを持つ `layer-block` payloadを作り、通常Layer panel上の `Ctrl+V` では同構造を一括ペーストする。
- CAF table上の `Ctrl+V` は、直近にコピーされた通常Layer / FolderまたはCAF内部Layer / Folderを、新しいCAF asset / celとして現在Frame / Laneへ貼り付けられる。
- アニメテーブルの `ArrowUp` / `ArrowDown` は、CAFが無い空セル状態でもactive Laneを移動できる。
- ショートカット文脈がcanvas側の時はAnimation Tableの枠と中身を薄くし、CAF / canvasのどちらへショートカットが向くかを視覚的に区別する。
- CAF Layer panel mirrorの内部フォルダサムネクリックは、選択同期やAnimation Table再描画を挟まず、mirrorの開閉状態だけを反転するようにした。
- CAF内部フォルダの表示/非表示をLayer panelから切り替えた場合、選択中の子Layerが別でもworking Layerの表示属性を同期する。
- Animation preview中の選択CAFは、他CAFと同じ合成previewへ二重に出さず、working Layer側を表示してフォルダ表示/非表示と編集対象表示を一致させる。フォルダblendの本番的なgroup表示はpreview / onion / export compositor側を正本にする。
- 通常Layerカードの `100%` 表示は旧opacityドラッグ部品ではなく単なるmeta表示として扱い、カードD&D開始を阻害しない。通常Layer名はDOM再描画でブラウザdblclickが途切れても、同一Layerへの短時間2回pointer入力として名前編集へ入る。

## Phase 5p完了状態

### Slice 1 — Raster bounds契約の追加から開始

- Project frame、背景Layer、通常export範囲は固定したまま、通常Raster Layer / CAF internal Raster Layerの保存矩形を可変化する方針にした。
- 現行の固定RenderTexture前提は `LayerModel.initializeTexture()`、`LayerSystem.createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()`、`confirmLayerTransform()`、`ImageImporter`、`DrawingSnapshotModel`、`AnimationTablePopup`、`ProjectManager` に集中している。
- 最初のsliceでは `RasterBounds` helper、Layer snapshot、DrawingSnapshot、restore正規化を追加し、既定挙動はProject frame固定のまま維持する。
- 次の価値は、純粋な整数Layer移動を `translateRgbaPixels()` ではなく `rasterBounds.x/y` 更新で確定し、欄外へ出たpixelを失わないこと。
- その後、画像import、Layer duplicate / merge、CAF working Layer、selection / fill / clipping、保存復元、Frame compositorへ段階接続する。
- WebGPU、DPR 2倍化、内部2倍RenderTexture、tiled canvas本格導入、Project frame自体の無限化、PSD import、ClipInstance transform / keyframeはPhase 5pへ混ぜない。
- Slice 1として `system/raster-bounds.js` を追加し、`LayerModel`、通常Layer raster snapshot、`DrawingSnapshotModel`、CAF互換 `rasterSnapshot`、Project JSON layer metadataへ `rasterBounds` の正規化・clone・serializeを接続した。
- boundsなし旧データは `{ x: 0, y: 0, width, height }` へ正規化し、既定挙動はProject frame固定のまま維持する。
- `LayerSystem` はdebug時だけsnapshot pixel length / bounds size不一致を警告する。
- まだV移動、画像import合成先拡張、CAF working Layerの非0 bounds編集、selection / fill / clippingの挙動は変えていない。次はSlice 2の通常Layer整数移動を `rasterBounds.x/y` 更新で確定する。
- Slice 2として、通常Layerの純粋な整数V移動確定はpixel bufferをshiftせず、`rasterBounds.x/y` を更新して復元する経路へ切り替えた。Undo / RedoとProject保存復元はsnapshot内boundsを通る。
- CAF working Layerの整数移動はまだSlice 4対象のため、通常Layer History混入を避けて既存のpixel shift経路を維持する。
- 非0 `rasterBounds` の通常Layerへ追描画すると入力位置と表示位置がずれる問題を確認し、通常Layerのstroke開始時に `current bounds ∪ Project frame` へRenderTextureを拡張する経路を追加した。
- pen / eraser / airbrush のRenderTexture焼き込みは `-rasterBounds.x/y` を適用し、pen opacity preview / airbrush previewは `rasterBounds.x/y` に表示位置を同期する。blurはmask点をraster座標へ変換する。
- Layer thumbnailはProject frame cropを既定に戻し、Layer間の位置比較を維持する。Project frame外に保持中のRasterがあるLayerには小さな欄外バッジを表示する。
- 画像import / 外部clipboard画像貼り付けはProject frame中央配置を維持しつつ、合成前にLayer boundsを配置矩形まで拡張する。Undo / Redoはbounds込みsnapshotで復元する。
- merge downは上Layerと下Layerのbounds unionへ下Layerを拡張し、Project座標上の位置を保って焼き込む。
- CAF working Layerの整数V移動も通常Layerと同じbounds移動へ切り替え、通常Layer HistoryではなくCAF raster Historyへ記録する境界は維持する。
- CAF working Layerの描画開始時も通常Layerと同じく `current bounds ∪ Project frame` へRenderTextureを拡張し、V移動後にProject frame内の描画可能範囲が描画物と一緒にずれないようにした。
- Timeline frame compositorとCAF previewはDrawingSnapshotの `rasterBounds.x/y` を反映し、出力・previewのProject frame cropは維持する。
- CAF内部Layerサムネも通常Layerと同じProject frame cropを使い、Project frame外にalpha pixelが残る場合だけ欄外バッジを表示する。
- 欄外バッジは通常Layer / CAF内部Layerともサムネ右下へ統一する。状態がラスターサムネに属することを優先し、CAFカード全体の状態に見えないようにする。
- CAF working Layer上のbucket fillはpen strokeと同じ `drawing:stroke-started` / `drawing:stroke-completed` 境界へ接続し、通常Layer Historyへ混ぜずCAF raster Historyへ記録する。
- CAF working Layer上のbucket fillは、boundary snapshot取得前に `drawing:stroke-started` を発火してworking Layerを表示対象へ戻す。CAF preview中に作業Layerが非表示のまま判定され、線内塗りが全体塗りになる不安定さを避ける。
- bucket fill開始時もpenと同じく `current bounds ∪ Project frame` へRenderTextureを拡張する。V移動後、penを一度入れた時だけfill範囲が広がる不安定さを避ける。
- 欄外保持でLayer boundsが大きい場合でも、Project frame内クリックのbucket fillはProject frame範囲へboundaryをcropしてBFSし、探索レスポンス悪化を抑える。
- 描画中PreviewでもOnion skinを維持し、選択中Clipだけ除外してworking Layerと前後フレームpreviewを同時表示する。
- 選択範囲制限はbefore / after snapshotのbounds差をProject座標で照合し、RT拡張後も選択外pen / fillをbefore pixelsへ戻す。
- BrushCoreでは通常History用beforeとselection制限用beforeを分離し、CAF working Layerでもselection制限用beforeだけは保持する。CAF上のpen描画も選択範囲外をbefore pixelsへ戻す。
- BrushCore / FillTool / PixelSelectionSystem のヘッダーへ、Phase 5pの共通契約としてProject frame拡張、CAF History分離、selection制限のProject座標照合を明記した。
- V移動 / selection V変形中は描画入力を受け付けない。pen / eraser / fill / airbrush等へ切り替える時は、進行中のLayer transform / selection transformを先に確定してからツールを切り替える。
- 選択範囲の破線は濃色塗り上でも見えるよう、薄い縁取りshadowを付ける。
- 通常Layerのclipping maskはsource Layerの `rasterBounds.x/y` に配置し、source / target boundsが違ってもProject座標上のalpha位置でmaskする。
- CAF previewの内部clippingはDrawingSnapshotのbounds差をProject座標で見てalpha maskを作る。
- fill / eraser-fillはクリック座標、boundary snapshot、target RenderTextureのbounds差を補正し、reference all layersでもProject frame cropを維持する。
- 通常selectionのcopy / delete / V移動とFolder selectionのLayer交差計算は `rasterBounds.x/y` を差し引いてRaster座標へ変換する。
- selection paste / paste as new layerはProject frameへclampせず、コピー元Project座標を維持する。貼り付け先Layerは必要に応じてboundsを拡張し、Undo / cancelは拡張前snapshotへ戻す。
- lasso fillは投げ縄点群のProject座標範囲までboundsを拡張し、RenderTexture描画時に `rasterBounds.x/y` を差し引く。CAF working Layerでも `drawing:stroke-completed` を発火してCAF raster History境界へ接続する。
- 欄外データ回収UIとして、通常Layer / CAF内部Layerの「外」バッジを押すと対象RasterをProject frame中央へ戻す操作を追加した。通常Layerは通常History、CAF working LayerはCAF raster Historyへ記録する。
- Phase 5pの必須sliceは完了。Project frame自体の無限化、全bounds export、tiled canvas、欄外表示モードは後続候補として残す。

## Phase 5o完了状態

### Slice 1 — アクティブRaster Layerへの外部画像貼り付け

- `system/image-importer.js` を追加し、外部画像BlobをアクティブRaster Layerへ中央貼り付けできるようにした。
- 左サイドバーへ「画像をアクティブレイヤーへ読み込み」ボタンを追加し、file inputから同じ貼り付け経路へ流す。
- OS / ブラウザの画像clipboard貼り付けは `Shift+Ctrl+V` へ移動した。`Ctrl+V` は内部Layer / Folder / selection / CAF clipboardの貼り付けを優先する。
- 通常Raster Layerでは `image-import-to-layer` として通常Historyへ記録する。
- CAF working Layerでは通常Layer Historyへ記録せず、既存の `drawing:stroke-started` / `drawing:stroke-completed` 経路を使ってCAF raster Historyへ記録する。
- 画像がキャンバスより大きい場合だけ、アスペクト比を維持してキャンバス内へ縮小する。小さい画像は等倍で中央へ貼る。
- Browserで通常Layer上の画像clipboard `Ctrl+V`、Undo / Redo、CAF working Layer上の画像clipboard `Ctrl+V`、Undo / Redo、画像import用サイドバーボタンとhidden file input、console errorなしを確認した。
- PSD読み込み、複数Layer import、新規Layer自動作成、貼り付け直後の配置変形UIは後続Phaseへ棚上げする。

## Phase 5n完了状態

### Slice 1 — VキーLayer全体変形入口の固定操作監査

- 選択範囲なし、通常Raster Layerで `V` を押した時にLayer全体変形へ入ることを確認する。
- selectionがある時はselection変形を優先し、selection解除後はLayer全体変形へ戻ることを確認する。
- Background / FolderでLayer全体変形が開始しないこと、CAF working Layer / Animation Table表示中はCAF internal Layer Historyへ接続し、通常Layer Historyへ誤接続しないことを確認する。
- Phase 5hの整数平行移動非再サンプリング経路、confirm / cancel、Undo / Redo、保存復元を維持する。
- Ctrl+T / T単独採用、Folder全体変形、ClipInstance transform / keyframe / easing、保存形式変更、WebGPUは対象外。
- `KeyboardHandler` のVキー入口で、通常Layer変形を開始できない状態（Folder / Background / Animation context）では `vKeyPressed` を立てないようにした。
- `layer:transform-exit` で `KeyboardHandler` 側のVキー状態も落とし、LayerSystem側の実変形状態とローカルshortcut stateがずれないようにした。
- Browserで通常Raster LayerのV開始、矢印移動、V終了確定、Undo / Redo、selectionありV優先、Ctrl+D解除後のLayer全体V復帰、Folder上のV拒否、Folder拒否後の通常Layer V復帰を確認した。
- `node --check` は `keyboard-handler.js`、`layer-system.js`、`layer-transform.js`、`pixel-selection-system.js`、`raster-translation.js`、`transform-math.js` で成功。`npm.cmd run build` 成功。Browser console errorなし。
- オーナー実機で、`V` 単独キーによる通常Layer全体編集と、`M` キーで範囲指定した後の `V` キーselection変形が可能になったことを確認した。
- Animation Table / CAF working Layer上でも `V` 単独でLayer全体変形へ入り、V中の矢印操作はFrame移動へ流さずLayer変形へ送るようにした。
- CAF working Layerの変形確定は通常Layer Historyへ記録せず、焼き込み後の `layer:transform-exit` でCAF internal Layer Historyの `caf-internal-layer-transform` として記録する。
- CAF上で `V`開始、矢印移動、Escape cancelではHistoryが増えないことを確認した。
- CAF上で短いpen描画後、`V` / ArrowRight / `V` 確定によりHistoryが1/500から2/500へ増え、Undoで1/500、Redoで2/500へ戻ることを確認した。Frame 1維持、Browser console errorなし。
- `V`変形確定後、Album保存とAlbumカード復元を確認した。復元後の新規console errorなし。

## Phase 5m完了状態

### Slice 1 — ペン入力点・筆圧・補間品質の固定計測

- 参考資料は `開発用資料保管庫/proposals/tegaki_pen_quality_research_2026-06-27.txt`。
- 最初の対象は `pointer-handler.js`、`drawing-engine.js`、`brush-core.js`、`stroke-recorder.js`、`pressure-handler.js`、`stroke-renderer.js`。
- `getCoalescedEvents()`、筆圧補正、距離filter、補間点生成、preview/final stroke一致を固定入力で確認する。
- WebGPU、SDF/MSDF、WebGL2 Mesh、Canvas2D本番stroke混入、DPR/内部2倍化、保存形式変更は対象外。
- 最初はdebug限定profileと固定入力比較を優先し、coalesced event取り込みやStrokeQualityFilterは有効性確認後に限定実装する。
- `PointerHandler`、`DrawingEngine`、`BrushCore`、`StrokeRecorder` へ `TEGAKI_CONFIG.debug === true` 限定の `StrokeInputProfile` を追加した。
- profileはPointerEvent単位のraw/補正pressure、pointerType、client/local座標、`getCoalescedEvents()` 有無・件数・座標/筆圧分布、LazyBrush後座標、StrokeRecorder点数・距離・筆圧差分、補間生成点数、realtime/final bake境界をconsoleへ出す。
- `window.TegakiStrokeInputProfiler` を追加し、debug中のevent/finalize profileをring bufferへ保持する。実機固定入力では `setEnabled(true)`、`clear()`、`setLabel('pen-4-pressure-on-slow-taper')`、`summary()`、`getStrokes()` を使って入力別に比較する。
- opacity 50%前後のpenで「インクがこぼれる」ように濃く太る原因候補として、短いライブ線分を同じRenderTextureへ `alpha=opacity` で反復合成する経路を確認した。
- penのopacityが1未満の場合だけ、一時RenderTextureへ不透明strokeとして集め、previewとcommitで一度だけopacityを掛ける経路へ変更した。opacity 100%、eraser、airbrush、blurは従来経路を維持する。
- 筆圧急変の切り分け用に、profileへpressure correction / curve、PressureHandler baseline / calibrated / distanceFilter、StrokeRecorderの最大距離・最大筆圧差分を追加した。
- 添付実機例でopacity 100%でも短い点線strokeに大丸が出たため、原因候補を短距離pen strokeの初回realtime segment / final dot fallbackに絞った。pen筆圧ONかつ0.75px前後の点入力・1.25px以下の極短入力だけpressureを小さくcapし、通常の連続線、mouse、固定幅penには適用しない。
- `pressureCurve` の「軽め/重め」表示と式が逆だったため、軽めは弱筆圧を反応しやすく、重めは強く押さないと太くならない式へ修正した。
- pen opacity 50%で筆圧による透明度変化が消え、ジャギーが目立つ可能性があったため、設定に「筆圧で濃度を変える」を追加した。既定ONで、pen opacity isolation中も一時RenderTexture内にpressure alphaを保持し、commit時に全体opacityを一度だけ掛ける。
- 50%線の境界が100%より荒く見える直接差分として、pen opacity isolation用の一時RenderTextureだけ `antialias: true` が無いことを確認した。通常Layer RenderTextureと同じAA指定へ揃え、DPR/内部2倍化/WebGPUには踏み込まない。
- 筆圧濃度が強く効くと内部alphaが下がり、1px単位のcoverage差も目立ちやすいため、`筆圧濃度` スライダーを追加し、既定0.65で濃淡を残しつつ半透明境界が過度に薄くならないようにした。
- `筆圧濃度` 1.00では、OPACITY 50%なら筆圧alphaは0%から50%まで変化する。既定0.65は弱筆圧側を少し残し、境界の荒れを抑える。
- 墨・水彩的な蓄積、にじみ、濃淡混色はPhase 5mのopacity/coverage補正とは別領域のため、GPU Brush Lab / WebGPU側の検討として棚上げする。WebGPU化を試す場合も、まずスプレー/粒子系で効果と負荷を測ってからpen本体へ広げる。
- debug無効時はprofile生成・console出力を行わず、mouse入力は従来通り筆圧なし扱いを維持する。
- `node --check` と `npm.cmd run build` 成功。
- Browserでdebug=falseの通常回帰としてpen、eraser、airbrush、Undo/Redo、Album保存復元、CAF working Layer上のpen描画を確認した。新規console errorなし。既存の `animationTable not registered` warning 1件のみ。
- オーナー実機で短strokeの大丸抑制、opacity 50%のAA改善、筆圧濃度最大時の境界ぼかしが確認された。
- coalesced event取り込みとStrokeQualityFilterは、今回の症状解消に必須ではないため未実装のまま棚上げする。再発または速筆点不足が明確になった場合だけ、debug profile結果を根拠に限定実装する。
- Phase 5m指示書とhandoffは `開発用資料保管庫/Archive/` へ移動した。

## Phase 5l実装状態

### Slice 1 — 大容量CAF保存・復元・Export計測

- 肥大化したアニメは保存時にディレイしたり、クラッシュすることがあったため、Project保存/Album保存のserialize・JSON化負荷を優先確認する。
- 最初の対象は `ProjectManager.exportProject()`、`TimelineModel.serialize()`、`DrawingSnapshotModel.serialize()`、Album保存、Project復元、Export前後の状態保持。
- 固定入力は400x400 / 120F / 5 internal raster Layer、800x800 / 60F / 3 internal raster Layer、1200x1200 / 30F / 3 internal raster Layerを優先する。
- `ProjectManager.exportProject({ profile: true })` と `profileProjectExport()` を追加し、保存形式を変えずにProject export / animation serialize / JSON.stringifyの時間とpayloadサイズを計測できるようにした。
- Project保存時のanimation serializeは `TimelineModel.serialize()` 一括呼び出しではなく、同じpayload形状をProjectManager側で組み立て、DrawingSnapshot serialize中に短いyieldを挟むようにした。
- profileへ `animationSerializeYields` を追加し、保存ディレイ緩和のために何回ブラウザへ制御を返したか確認できる。
- Album snapshot保存は `TEGAKI_CONFIG.debug === true` の時だけ、projectDataサイズ、thumbnail文字数、project export時間、thumbnail生成時間、JSON.stringify時間をconsoleへ出す。
- Album popupへ保存領域表示を追加し、Album内概算サイズ、件数、ブラウザorigin全体の `navigator.storage.estimate()` 使用量/上限を確認できるようにした。
- Album保存前のProject payload概算が100MB以上の場合は、Album保存かファイル保存かを確認する。ファイル保存を選んだ場合は、直前にcaptureした `projectData` を再利用してdownloadし、再exportによる二重負荷を避ける。
- 実機で `Album 801.6 MB (25件) / ブラウザ 120.4 MB / 10.12 GB` が観測された。これはquota超過ではなく、Tegaki側Album payload概算が大きい状態として扱う。
- 単なる通常/CAFタブ分けでは巨大CAF projectDataをIndexedDBとJS heapへ抱える問題が残るため、Phase 5lの次sliceはAlbum一覧のmetadata/thumbnail軽量化を優先する。
- CAFを含むProjectは最新Chromium系のFile System Access APIを第一候補に、Ctrl+Sで外部ファイルへ上書き保存する導線をPhase 5l内の後続sliceへ追加する。
- Albumは通常作品の軽量保管を維持し、CAFはthumbnail/更新日時/保存先参照だけを持つ参照カードへ寄せる方針に更新した。

### Slice 2 — Album一覧metadata/thumbnail軽量化

- `AlbumStorage` をversion 2へ更新し、既存 `snapshots` storeとは別に `snapshotMetadata` storeを追加した。
- metadataにはid、order、timestamp、thumbnail、currentFrame、projectData有無、thumbnail/project/合計概算byteを保存する。
- 既存Albumは初回だけ `snapshots` からmetadataをバックフィルする。
- Album popupの初期表示、通常一覧、選択、削除、並べ替え、保存領域表示はmetadata/thumbnailだけを読む。
- 復元とAlbum HTML export時だけ、選択IDから本体snapshot/projectDataを読む。
- Album保存領域表示を `Album概算` に変更し、Tegaki側payload概算とブラウザorigin usage/quotaを混同しないようにした。
- 新規保存、import、delete、sortはmetadata storeも同期する。

### Slice 3 — CAF外部ファイル保存とCtrl+S導線

- `ProjectManager.quickSave()` を追加し、現在ProjectにCAF/animation dataがある場合だけ外部Project保存を処理する。
- Ctrl+Sは先に `ProjectManager.quickSave()` を呼び、CAF/animation dataがなければ従来どおりAlbum quick saveへfallbackする。
- 最新Chromium系で `showSaveFilePicker()` が使える場合、初回Ctrl+Sで保存先を選択し、以後は保持した `FileSystemFileHandle` へ上書き保存する。
- 保存先handle取得は重いProject export前に行い、ユーザー操作のtransient activationを失いにくくした。
- File System Access APIが使えない環境では、従来download保存へfallbackする。
- 保存完了は `project-save-toast` の短い表示にした。
- ショートカット説明は「現在の状態を保存」へ変更した。

### Slice 4 — Album参照カード化入口

- CAF/animation dataを含むProjectでAlbum保存ボタンを押した場合、AlbumへprojectData本体を保存せず、先に外部Project保存を行う。
- File System Access APIで保存先handleを保持できた場合だけ、Albumにはthumbnail、timestamp、fileName、fileHandle要約を持つ参照カードを保存する。
- download fallbackしかできない場合は、読み戻せない参照カードを作らず、外部ファイル保存だけで完了する。
- Album metadataへ `projectReference` 要約を追加し、参照カードをFILEバッジ付きで表示する。
- 参照カード復元時は保存先fileHandleからProject JSONを読み、`ProjectManager.loadProject()` へ渡す。
- Album importでTegaki Project JSONを選んだ場合はAlbumへ追加せず、Album popupを閉じて直接 `ProjectManager.loadProject()` へ渡す。
- Project JSON import後はfile名を現在保存先表示へ反映する。ただしfile input経由ではFileSystemFileHandleを得られないため、次回Ctrl+Sでは保存先選択が必要。
- Album popupへ現在のProject保存先表示と保存先再選択ボタンを追加した。
- オーナー実機で、Ctrl+S初回保存先選択、同一箇所への上書き、Album保存ボタンからの外部保存、Project JSON importのキャンバス直展開、Album popupでの保存先変更を確認した。
- `node --check` と `npm.cmd run build` 成功。`dist/` とVite cache差分は除去済み。

## Phase 5k完了状態

### Slice 1 — CAFメモリ計測入口

- `system/animation/caf-memory-profiler.js` を追加し、DrawingSnapshot、ClipInstance rasterSnapshot互換copy、CAF raster History、AnimationTablePopup texture cache、LayerSystem RenderTexture推定byteをdebug集計する。
- `AnimationTablePopup.getCafMemoryProfile()` / `logCafMemoryProfile()` を追加し、`window.PopupManager.get('animationTable')` 経由で固定入力計測へ使えるようにした。
- 最新Chromium系では `performance.measureUserAgentSpecificMemory()` をfeature detectし、使えない場合はerror情報と `performance.memory` 補助値だけに留める。

### Slice 2 — snapshot Texture cache明示LRU

- `_snapshotTextureCache` をWeakMapからsnapshot keyのMapへ変更し、entryごとにTexture、推定byte、lastUsed、sourceUpdatedAtを持たせた。
- `TEGAKI_CONFIG.animation.snapshotTextureCache` を追加し、初期上限を96件 / 512MBにした。
- stale、LRU、Animation Table close、project load、ClipAsset削除、snapshot差し替えでTextureを `destroy(true)` する。
- current frame、選択CAF、前後1frameのsnapshotはeviction候補から優先保護する。
- clipping合成後の一時snapshotもsource snapshot群のid/updatedAtからcache keyを作り、mask更新時に別entryへ切り替える。
- Animation Table表示後に複数CAF作成または描画のタイミングでキャンバスが消える/飛ぶ症状が観測されたため、表示中Preview Spriteが参照中のTextureは即破棄せず、preview containerから外れた後に遅延破棄するよう修正した。

### Slice 3 — copy/paste History肥大化とruntime重複削減

- レイヤー1枚に数字を書いたCAFのcopy/paste連続で35frame前後から鈍化し、36frame前後でクラッシュする実測がある。
- Slice 3対策後、レイヤー2枚CAFのcopy/pasteで240Fまで到達した。容量面の主因はHistory肥大化だった可能性が高い。
- 参照共有と差分byte見積り後、レイヤー3枚CAFのcopy/pasteで120Fまで到達し、全Undo後にRedoで同等地点へ戻れることを確認した。History表示は128/500程度まで残った。
- Project保存用 `TimelineModel.serialize()` は維持し、Animation TableのTimeline Historyだけ専用runtime cloneへ変更した。
- History内のDrawingSnapshotは `Array.from(pixels)` せず、`Uint8ClampedArray` cloneで保持する。
- Timeline HistoryのDrawingSnapshot pixelsは既存snapshot bufferを参照共有し、commandの推定 `byteSize` は全状態合算ではなくsnapshot差分とassetなしfallback分にした。
- Timeline History commandへ推定 `byteSize` を渡し、HistoryManagerのメモリ上限で古い履歴が破棄されるようにした。
- Timeline History commandのmetaへsnapshot参照統計を入れ、CAF memory profilerでHistory内の参照増加を見られるようにした。
- asset参照済みClipInstanceの互換 `rasterSnapshot` はruntimeではpixelを持たない参照メタデータへ寄せた。assetなしfallbackのみpixelを保持する。

### Slice 4 — History予算のリッチPC対応

- 400x400、レイヤー5枚、単純な数字、120FのCAF copy/pasteでHistory使用量が約374MB / 512MB、履歴135 / 500程度になる実測がある。
- `SettingsManager.getAutomaticHistoryDefaults()` を更新し、`navigator.deviceMemory` と Chromium系 `performance.memory.jsHeapSizeLimit` を補助的に見て、自動上限を最大4GBまで上げる。
- Settingsの手動Historyメモリ上限を128MB / 256MB / 512MB / 1GB / 2GB / 4GB / 8GB / 12GB / 16GBへ拡張した。
- `CoreEngine._applyHistorySettings()` の既存接続により、起動時と設定変更時に `HistoryManager.configureLimits()` へ反映される。
- SettingsのHistory使用量表示に80%以上「高め」、95%以上「上限付近」の状態表示を追加した。

## Phase 5j完了状態

- `TimelineModel.playback` の `loop / endMode / inFrame / outFrame` をconstructor、総Frame変更、History復元、project復元へ正規化接続した。
- `AnimationTablePopup.play()` が再生開始時のscope対象Lane集合を固定し、同じ集合をlast-clip rangeと `advanceFrame()` へ渡す。
- currentFrameが有効範囲外の状態から再生した場合、timer tickを待たずeffective startへ移動し、renderとframe-changedを行う。
- Animation Tableにloop、終端基準、IN、OUTの小型controlを追加し、1操作1Historyへ接続した。
- IN / OUT markerの表示CSSを追加し、同一Frame clickで解除できる。
- Export popupの範囲入力、PixiJS更新、WebGPU有効化は変更していない。
- model固定入力、`node --check`、`npm.cmd run build`、ブラウザで追加control、Undo / Redo、LANE + last-clip実再生、console errorなしを確認した。
- 多枚数アニメ作成中に重くなってからクラッシュする実機症状はPhase 5kで対策済み。CAF / DrawingSnapshot / History / thumbnail / GPU textureの常駐量計測と上限・解放境界を追加した。

## Phase 5i実装状態

### Slice 1-2 — 固定alpha / 通常Layer 3状態・History

- `system/clipping-mode.js` に `none / normal / inverse` の正規化、循環、旧boolean互換を集約した。
- target alpha 200、mask alpha 255 / 128 / 0でnormal 200 / 100 / 0、inverse 0 / 100 / 200を固定確認した。
- `LayerModel` に `clippingMode` を追加し、互換boolean `clipping` を同期した。
- 通常Layer cardと属性popupを `none -> normal -> inverse -> none` へ変更した。
- mode変更を `layer-clipping-mode` 1 History commandへ接続し、Undo / Redoで同じLayer IDを復元する。
- EventBusは `clipping`, `clippingMode`, `inverse` を同時通知する。
- layerSprite、描画child、pen preview、airbrush previewへ同じPixi inverse maskを適用する。
- Pixi v8.17のmask解放と初回inverse bounds差を局所補正し、破棄済みmask参照を残さない。
- Browserで3状態、履歴増分、Undo / Redo、属性popup同期、inverse描画を確認した。
- 修正後の操作でconsole error件数が増えないことを確認した。
- CAF internal Layer、保存復元、CAF preview / Frame compositorはSlice 3-4で接続する。

### Slice 3 — CAF internal Layer / CAF専用History / 共通UI

- `ClipAssetInternalLayerModel` へ通常Layerと同じ `clippingMode` 契約を追加した。
- 旧 `clipping: true` はnormalとして読み、serializeはmodeと互換booleanを保持する。
- CAF mirror cardと属性popupを `none -> normal -> inverse -> none` へ変更した。
- CAF mode変更は既存CAF専用History snapshot 1件でUndo / Redoする。
- working Layerへの反映とworking LayerからCAFへの同期でmodeと互換booleanを同時更新する。
- duplicate、internal clipboard、Folder clipboard、通常LayerからCAF作成でmodeを保持する。
- 逆状態は通常Layerと同じtitleと `is-inverse-clipping` classで表示する。
- BrowserでCAF 3状態、履歴増分、Undo / Redo、属性popup同期、新規console errorなしを確認した。
- CAF preview / merge、Frame compositor、project / Album保存互換はSlice 4で接続する。

### Slice 4 — CAF preview / merge / Frame compositor / 保存互換

- CAF previewの固定128 thresholdを廃止し、normalはmask alpha乗算、inverseは反転alpha乗算へ変更した。
- source不在、非表示source、空maskではclip対象を透明にする。
- internal Layer mergeはnormal=`destination-in`、inverse=`destination-out`を使う。
- Timeline Frame compositorへ同じmodeを接続し、PNG/APNG/GIF等の共通frame列へ反映した。
- 通常Layer project保存へ `clippingMode` と互換booleanを保持する。
- 旧booleanのみの通常Layer / CAFデータはnormalとして復元する。
- CAFはTimelineModel serialize、AlbumはprojectData経路でmodeを保持する。
- inverse mask付きLayerのproject復元ではmask解除を1描画フレーム先行し、旧Pixi描画命令参照を残さない。
- Browserでnormal / inverse preview差、PNG preview、internal merge、CAF / 通常LayerのAlbum往復を確認した。
- Album復元後もinverse title / classを維持し、復元操作による新規console error増加なしを確認した。

### Slice 5 — 最終回帰 / closeout

- 通常Layerのsource非表示、source削除、Undo、Layer D&D後のsource再計算を確認した。
- inverse LayerでselectionとV操作後もmodeとmask再構築を維持した。
- 固定半透明alphaと空mask、source不在時の透明化を確認した。
- 通常Layer HistoryとCAF専用Historyのcommand境界を維持した。
- PNG、2フレームAPNG、GIF previewを確認した。
- 通常Layer / CAFのAlbum保存復元でinverse modeを維持した。
- 新規console errorなし。`node --check` と `npm.cmd run build` 成功。
- `dist/` とVite cache差分は除去済み。

## Phase 5h実装状態

### Slice 1-3 — 固定計測 / 通常Layer・pixel selection整数平行移動

- 64x48固定Rasterを10往復し、整数10pxではLayer bake / selection Canvas2DともRGBA差分0を確認した。
- 小数10.25pxでは両経路とも1623 channel変化、alpha差30104、非透明pixel数547から1005となった。
- `system/raster-translation.js` に純粋平行移動判定とRGBA整数shiftを追加した。
- 通常Layerの純粋平行移動は開始時Snapshotを整数dx / dyだけshiftし、RenderTexture再サンプリングを通さず確定する。
- canvas外pixelは破棄し、空き領域は透明化する。
- pathは丸め後の同じdx / dyで更新する。
- History 1件、clipping再構築、thumbnail、座標cache、panel更新の既存境界を維持する。
- 回転・拡縮・flip・複合変形は現行1回bakeへ残した。
- Browserで通常Layer移動、cancel、Undo / Redo、path付きLayer、回転・拡縮fallback、console errorなしを確認した。
- pixel selectionの純粋平行移動も同じRGBA整数shiftへ接続した。
- move-selectionは切り取り後base、floating pasteは未変更baseへ既存source-over合成を行う。
- selection boundsは整数dx / dyへ同期し、canvas外pixel破棄、cancel、Undo / Redoを維持する。
- 回転・拡縮・flipはselectionでも現行Canvas2D fallbackを維持する。
- Browserでselection移動、既存strokeへの重なり、cancel、Undo / Redo、canvas端、回転・拡縮fallback、console errorなしを確認した。
- clipping Layer、Folder内Layer、H表示反転、zoom中の整数移動を確認した。
- Album保存前とPNG preview前の未確定selection自動commitを確認した。
- Album復元後もFolder階層、clipping、Raster内容を維持した。
- Animation Table表示中はselection変形だけCAF経路へ流れ、selection解除後の通常Layer V変形を抑止した。
- `node --check` と `npm.cmd run build` 成功。`dist/` とVite cache差分は除去済み。

## Phase 5g実装状態

### Slice 1 — Airbrush固定再現とpixel計測

- debug限定の `StrokeRenderer.diagnoseAirbrushComposition()` を追加した。
- 実描画と同じdab texture、tint、alpha、RenderTexture逐次合成を一時target上で再現する。
- 中心RGBA、選択色との差、直線上のalpha / 輝度profileを反復回数ごとに取得する。
- flow 0.08では単一dabの色は正しいが、高密度な直線1 strokeだけで暗化した。
- `#800000` は約 `#780000`、`#2c1810` は約 `#26190d` となり、低alphaのpremultiplied値を8bit targetへ反復合成する丸め蓄積が主因候補。
- flow 0.22では同条件の色差がほぼ消えたため、dab texture単体よりflowと重複回数の組み合わせを優先して調べる。

### Slice 2 — Airbrush settings contract

- `BRUSH_DEFAULTS` へspacing 0.10、flow 0.08、softness 0.8、scatter 0を集約した。
- `SettingsManager` がflow / softness / scatterのdefault、validation、localStorage保存を持つ。
- `BrushSettings.getAirbrushSettings()` が正規化済みfreeze snapshotを返す。
- `BrushSettings.getSettings()` から全airbrush設定をstroke開始時に渡す。
- `StrokeRenderer` のairbrush描画とdiagnosticはsettings引数だけを参照し、設定globalを読まない。
- Settings popupの既存keyと表示値を維持し、flow変更と再読込後の保存復元を確認した。
- Browserでairbrush描画とconsole errorなしを確認した。

### Slice 3 — Airbrush dab責務分離

- `system/drawing/airbrush-dab-renderer.js` を追加した。
- spacing residual、dab配置、pressure size、flow、scatter、texture cacheを専用moduleへ移した。
- `StrokeRenderer.renderAirbrushSegment()` は互換入口として維持し、専用moduleへ委譲する。
- `BrushCore` のstroke lifecycle、airbrush state、RenderTexture bake、History境界は変更していない。
- scatterの乱数関数を注入可能にし、固定入力でdab位置を再現できる。
- 分離前後で既定設定のpixel値が変わらず、Browserでairbrush描画とconsole errorなしを確認した。

### Slice 4 — Airbrush stroke mask合成

- 色付き低alpha dabをLayerへ逐次焼き込む方式を廃止した。
- stroke中は白dabを一時RenderTextureへalpha maskとして蓄積する。
- maskを選択色でtintしたSpriteとしてpreview表示する。
- pointerup時はmaskから新しいcommit Spriteを作り、Layerへ1回だけ合成する。
- preview Spriteのmask / scene状態を確定描画へ持ち込まない。
- stroke開始時target Layerをstateへ固定し、CAF表示更新後も同じworking Layerへ確定する。
- 透明スプレーは同じmaskをerase blendで合成する。
- cancel時はLayerを変更せず、一時maskとpreviewを破棄する。
- spacing 0.08 / flow 0.01でも中心色 `#800000` を維持した。
- 通常Layer描画、Undo / Redo、selection制限、CAF working Layer描画とAnimation Table再表示、新規console errorなしを確認した。

### Slice 5 — 始点dot・周期dab修正と最終回帰

- pointerdown直後の筆圧0 dabを抑止し、最初の移動segmentから描画する。
- 筆圧有効時は0.02以下のdabを省略し、線頭へ孤立する小点を残さない。
- 筆圧なしのtapはpointerup時に単独dabとして確定する。
- spacingを0.10へ詰め、0.18基準のflow補正で線全体の濃度を維持しながら周期的な丸い重なりを軽減した。
- Browserでtap、長いstroke、透明スプレー、selection、Undo / Redo、CAF working Layer、Animation Table再表示、pen、eraser、Settings値を確認した。
- 新規console errorなし。現行PixiJSで解消できたため、WebGPUは大量dab・高度な質感・性能研究だけを長期候補として残す。

## Phase 5f実装状態

### Slice 1 — Folder target resolver / clipboard payload

- Folder選択時の矩形selectionをCanvas座標で保持するscopeを追加した。
- `LayerSystem.getFolderSelectionTargets()` で入れ子Folderを含む配下要素を順序付き列挙する。
- Canvas矩形を各Raster Layerのlocal boundsへ逆変換する。
- 回転・拡縮Layerではlocal AABBに含まれるCanvas矩形外pixelを透明化する。
- `folder-pixel-selection` version 1 payloadへ階層、表示属性、transform、local bounds、TypedArrayを保持する。
- payload validatorとCoreRuntimeのread-only取得・検証APIを追加した。
- Folder cut / deleteはSlice 3、CAF変換はSlice 4で接続済み。複数Layer transformは対象外。
- `node --check` と `npm.cmd run build` 成功。
- BrowserでFolder配下Layerの矩形overlay、Ctrl+A全域選択、Ctrl+C、新規console errorなしを確認した。

### Slice 2 — 通常Layer Folder paste / composite History

- Folder clipboardから新規root Folderと配下Folder / Raster Layerを一括生成する。
- 相対順序、親子、名前、visibility、opacity、blend、clipping、transformを復元する。
- 選択pixelだけを元のLayer local位置へ配置し、範囲外は透明にする。
- 個別create Historyを抑止し、`folder-selection-paste` 1 commandへまとめる。
- Historyの`byteSize`へclipboard TypedArray合計を計上する。
- Undo 1回で作成Folder block全体を除去し、元のactive / multi-selectionを復元する。
- Redo 1回で同じID、階層、Raster、Folder selection scopeを復元する。
- BrowserでFolder copy / paste、階層、Undo / Redo、新規console errorなしを確認した。
- Folder cut / deleteはSlice 3、CAF変換はSlice 4で接続済み。

### Slice 3 — Folder cut / delete / composite History

- Folder scopeのDelete / Backspaceを全対象Rasterへ適用する。
- 回転・拡縮Layerは各pixel中心をCanvas座標へ戻し、矩形内pixelだけを透明化する。
- Ctrl+XはFolder clipboard作成後に同じ一括削除を行う。
- Deleteを`folder-selection-delete`、Cutを`folder-selection-cut`のHistory 1 commandへまとめる。
- Undo / Redoで全対象Raster snapshotを一括復元する。
- Historyの`byteSize`へbefore / after pixel量を計上する。
- Folder scopeのV変形はPhase 5f対象外として安全なno-opを維持する。
- BrowserでDelete、Cut本体、Undo / Redo、新規console errorなしを確認した。

### Slice 4 — Folder clipboardからCAF作成

- Folder clipboardをCAF internal root Folderと配下Folder / Raster Layerへ変換する。
- RasterごとにCanvas寸法のDrawingSnapshotを作成し、元transformをCanvas座標へ焼き込む。
- visibility、opacity、blend、clipping、親子、表示順をCAF内部へ維持する。
- 現在Frameの空きLaneを探し、必要時は独立Laneを追加する。
- `caf-clip-paste-folder-selection` Timeline History 1 commandでUndo / Redoする。
- Historyの`byteSize`へ全DrawingSnapshot pixel量を計上する。
- Browserで内部Folder / Raster、空きLane追加、Undo / Redo、Album保存復元、新規console errorなしを確認した。

## Phase 5e実装状態

### Settings / Export popup UI / CSS監査

- `settings-popup.js` の固定max-height / overflow、Help tab寸法、Help見出し装飾をCSS classへ移した。
- `export-popup.js` の固定幅、説明文装飾、status色、progress、form、disabled表示を既存palette変数へ揃えた。
- Export popupの初期DOMを生成する `dom-builder.js` に同じclass契約を反映した。
- Settings popupとExport previewへ `.ui-scrollbar` を適用し、共通scrollbarへFirefox設定とpalette変数参照を追加した。
- 動的位置、slider / progress率、show / hideはJS管理を維持した。
- popup mount、drag、close、preview、download構造は変更していない。
- `node --check` と `npm.cmd run build` 成功。
- ブラウザでSettings全tab、History form、status toggle、scroll、drag、closeと、Export format切替、preview、download、error status、progress、drag、closeを確認した。
- `dist/` とVite cacheの生成差分は除去済み。

### EventBus / global / History / transform監査

- Settings eventの正規payloadを `{ value }` と確認し、筆圧カーブの不正な `{ curve }` 二重送信を削除した。
- active Layerへのpaste履歴を `{ name, do, undo, meta }` と `record()` の現行契約へ修正した。
- Raster snapshotを保持する主要commandのbyteSize計上を確認した。
- `window.*` は初期化順、既存UI、旧animation、診断、保存復元の互換境界として参照が残るため削除しない。
- Layer全体変形とselection変形は共有transform数学を維持し、CAF internal Layerは通常Layer Historyへ接続しない。
- BasePopup、EventBus全件定数化、global全廃、History class階層、IDrawingTargetは導入しなかった。
- 詳細監査結果は `開発用資料保管庫/Archive/PHASE5E_AUDIT.md` に記録した。
- Phase 5e指示書、handoff、構造改善proposalはArchiveへ移動した。
- Browserで筆圧カーブ切替とLayer paste → Undo / Redoを確認し、新規console errorなし。

## Clipboard context routing

- 最後にpointer操作した領域をCanvas / Animation Tableのshortcut context正本とする。
- CanvasのCtrl+Cは選択範囲pixelを保持し、Ctrl+Vは新規通常Layer「選択範囲のコピー」として貼り付ける。
- Animation TableのCtrl+Cは選択CAFを保持し、Ctrl+Vは最新のCAFコピーまたはCanvas選択範囲から新規CAFを作る。
- CAFコピーと貼り付け先Frame/Laneの空き判定、CAF複製、選択CAF更新、History記録を既存Animation Table契約へ接続した。
- BrowserでCanvas / Animation Tableのcontext切替、CAFコピー後の貼り付けbutton有効化、空きFrameへのCAF複製、新規console errorなしを確認した。
- Folder配下全Layerへ同じ選択範囲を適用し、Folder構造ごとコピーする機能は複数Layer clipboardとcomposite historyが必要なためproposalへ設計待ちとして記録した。

## Phase 5d実装状態

### 矩形selection基盤

- `system/pixel-selection-system.js` を追加した。
- selection stateの正本は対象Layer ID、Layerローカルbounds、active、transform session状態とする。
- Mキーと左サイドバーから矩形選択へ切り替える。
- 単独Mは矩形選択ツールのON / OFFとし、選択中に再入力すると未確定変形を確定してselectionを解除する。
- Animation Table表示中も選択ツールを使用でき、選択中は対象CAFのworking Layerを編集表示する。
- Animation working Layer上のselection変形は確定、Undo、Redo時にCAF DrawingSnapshotへ同期する。
- Shift+Mは将来の円形・折れ線等の選択形状切替候補として未割当を維持する。
- Ctrl+Aでアクティブ通常Raster Layerのキャンバス全域を選択する。
- 選択ツール中は通常strokeを開始しない。通常ツールへ戻すと選択入力を解除する。
- canvas外dragをRenderTexture範囲へclampする。
- SVG polygon overlayは描画pixelへ焼き込まず、pan / zoom / 表示反転 / Layer transform後に再投影する。
- Escape、Layer切替、対象Layer削除、canvas resizeで選択を失効する。
- Animation Table表示中は対象CAFのworking Layerで選択を開始できる。

### 基本編集

- Delete / Backspaceでselection内pixelだけを消去する。
- Ctrl+Cはselection内pixelを専用clipboardへ保持する。
- Ctrl+Xはcopy後にselection内pixelを消去する。
- Ctrl+Vはclipboard pixelを新規通常Layerとして生成する。floating selection変形は既存Layer上のV操作で維持する。
- selectionがある状態のVで選択pixelだけをfloating化し、drag移動する。V再入力で確定、Escapeで取消する。
- 既存Layer変形パネルをselection sessionへルーティングし、移動、scale、rotate、水平・垂直反転、resetを共用する。
- Layer全体変形とselection変形は `system/transform-math.js` の中心基準行列を共有する。
- 移動・貼り付け確定は前後Raster snapshotを1つのHistory commandとして保持する。
- Undo / Redo時はpixelとselection boundsを同時に復元する。
- selection削除は前後Raster snapshotを1つのHistory commandとして保持し、Undo / Redoできる。
- project保存、画像preview、download前に未確定floating selectionを自動commitする。
- Ctrl+Dでselectionを解除する。floating変形中は確定してから解除し、未確定pixelを失わない。
- selection保持中に通常ツールへ戻した場合、ペン、消しゴム、エアブラシ、ぼかし、バケツ、消しバケツ、投げ縄塗りの確定結果をselection範囲内へ制限する。
- バケツは探索開始点と探索領域自体をselection内へ限定し、selection外クリックでは何も変更しない。
- selection変形中のH / Shift+Hは水平 / 垂直反転へ優先ルーティングし、camera反転へ流さない。

### 自動確認

- 矩形drag位置とoverlay位置が一致する。
- H表示反転後にselection polygonが対象pixelへ追従する。
- selection削除 → Undoで対象pixelが復帰する。
- selection移動 → V確定 → Undo / Redoでpixelとselection boundsが追従する。
- selection移動中のEscapeで開始位置へ戻り、History件数が増えない。
- 変形パネルからscale、45度rotate、水平・垂直反転、resetがselection pixelだけへ反映される。
- selection変形確定後のUndo / Redoで変形前後を復元する。
- 出力preview開始時にfloating selectionが自動commitされ、Historyへ1件記録される。
- selectionを跨ぐペンstrokeは範囲内だけが残り、Undo対象も制限後Rasterになる。
- バケツはselection内だけを塗り、selection外クリックではHistoryが増えない。
- selection変形中のH / Shift+Hが水平 / 垂直反転となり、camera反転badgeが出ない。
- Ctrl+Dで通常selectionを履歴追加なしに解除する。
- M再入力でselection解除と選択ツールOFFが行われ、Animation Tableは閉じない。
- 選択ツールから既存ペンモードへ戻した場合もselection入力が残留しない。
- `node --check` と `npm.cmd run build` 成功。`dist/`生成差分は除去済み。

### Phase 5d完了境界

- 通常Raster Layerの矩形pixel selection MVPは完了。
- 2026-06-20追補の描画制限、H系反転、Ctrl+D解除まで完了。
- CAF internal Layer自体を通常Layer Historyへ接続せず、animation working Layer経由で選択変形結果をDrawingSnapshotへ同期する。
- 自由投げ縄、色域選択、feather、perspective / mesh / warpは後続計画へ残す。
- Phase 5d指示書は `開発用資料保管庫/Archive/phase5d.md` へ移動した。

### ショートカット整理

- Layer全体変形の入口はV単独を維持する。
- Vを再入力すると従来通りconfirm、Escapeでcancelする。
- Ctrl+TはChromeの新規タブ予約、T単独は将来のText tool候補のため採用しない。
- 内部互換event名 `keyboard:vkey-state-changed` と既存state名は段階移行のため維持する。
- selectionが存在する時にLayer全体を誤変形しないよう、Vをselection側へ優先ルーティングする。
- Animation Tableの空セルに新規CAFを配置・既存CAFを削除する修飾をAlt+ClickからCtrl+Clickへ変更した。
- アニメ操作全体のCtrl化は通常編集shortcutと衝突するため、最後に操作した領域を正本とするcontext routing設計後に行う。
- Browser確認: Tは未割当、VでLayer変形開始・再入力で確定、Ctrl+ClickでCAF作成、Alt+Clickでは作成されない。

## Phase 5c実装状態

### キャンバス表示反転

- 既存のH / Shift+Hによるcamera水平・垂直反転経路を監査した。
- 反転後のwheel zoom、Space+Shift拡縮、`setZoom()`が負scaleを失う問題を修正した。
- horizontal / vertical flip stateを保ったままscale magnitudeだけを更新する。
- flip、zoom、rotation前後でキャンバス中心の画面位置を維持する。
- 反転中の描画座標はpointer位置と一致し、解除後はLayer内容を変更せず反対側へ戻る。
- 反転中badgeをFutaba paletteへ統一した。

### VキーLayer変形

- 通常Raster Layerのpreview、RenderTexture bake、変形後の描画継続を確認した。
- Escapeで開始時transformへ戻すcancel sessionを追加した。cancelはRasterとHistoryを変更しない。
- canvas dragへpointer capture / cancel処理を追加した。
- Undo時に変形前Snapshotへpreview transformを再適用していたため見た目が戻らない問題を修正した。
- confirm後にclipping maskを再構築する。
- direct数値入力のinline配色をCSS classと既存palette参照へ移した。
- 共有境界を `TRANSFORM_SESSION_BOUNDARY.md` に記録した。

### 自動確認

- H反転中の描画とwheel zoom、H再入力による表示復帰。
- V preview → Escapeで元位置へ復帰し、History件数が増えない。
- V confirm → Undoで元位置、Redoで変形後位置へ復帰。
- V confirm後も通常strokeを追加できる。
- Browser上の新規console errorなし。
- `npm.cmd run build` 成功。

### 実機確認

- 反復変形のRaster劣化を除き、表示反転とV変形の実機確認完了。
- V変形を反復確定した際のRaster劣化。現行はconfirmごとに1回再サンプリングするため、非破壊化は後続設計候補。

Phase 5c指示書は `開発用資料保管庫/Archive/phase5c.md` へ移動した。

## Phase 5b完了

### Frame出力

- `system/animation/timeline-frame-compositor.js` を追加。
- TimelineModel / ClipAsset / DrawingSnapshotからFrame画像列を生成する。
- 連番PNG、APNG、GIF、Export previewが同じcompositorを共有する。
- export中に現在Frame、CAF選択、Layer選択、visibilityを恒久変更しない。
- animation working Layerを通常Layerとして全Frameへ重ねない。
- 空Frameと最終CAF残置を含む出力回帰を修正済み。

### popup stacking

- Album / Export / Resize / SettingsとLayer transform panelを共通overlay rootへmountする。
- `canvas-area` のstacking contextに閉じ込められる問題を解消した。
- 透過・ぼかしの既存デザインを維持する。

### CAF描画履歴

- 描画開始時の全ClipAsset / 全DrawingSnapshot serializeを廃止。
- 対象CAF / internal Layer / 前後DrawingSnapshotだけをTypedArrayで保持する。
- animation working Layerの通常Layer用stroke snapshot取得を省略する。
- CAF切替後のUndo / Redoで対象CAF、Frame、internal Layerへ編集文脈を復帰する。
- 参照されないDrawingSnapshotを回収する。

### History容量

- commandへ `byteSize` 契約を追加。
- 件数上限と推定メモリ上限を適用する。
- Settingsへ自動調整、50/100/250/500件、128MB〜16GBの手動メモリ上限、現在使用量を追加した。
- `navigator.deviceMemory` と `performance.memory.jsHeapSizeLimit` を安全な初期値の参考にし、手動設定をlocalStorageへ保存する。
- History欄のcheckbox、select、option、使用量表示をFutaba paletteへ統一した。

### 確認

- オーナー実機: Frame preview / download成功、最終CAF残置なし、CAF増加後の描画遅延なし。
- ブラウザ: CAF A描画 → CAF B切替 → Undo / RedoでCAF AとFrame 1へ復帰し、描画が消去・再表示される。
- ブラウザ: History使用量表示は `--futaba-maroon`。
- `npm.cmd run build` 成功。

Phase 5b指示書は `開発用資料保管庫/Archive/phase5b.md` へ移動した。

## 既知残存

- Phase 5lの既知残存なし。file input経由のProject JSON importではブラウザ仕様上FileSystemFileHandleを得られないため、次回Ctrl+Sで保存先選択が必要。
- Phase 5bの既知残存なし。
- Layer Panel / CAF共通UI、Pointer D&D、押しのけ表示の既知残存なし。
- Phase 5hの既知残存なし。回転・拡縮・flipの高品質化や永続transform stateは対象外として未着手。
- Phase 5mの既知残存なし。coalesced event取り込み、StrokeQualityFilter、墨・水彩的な蓄積/にじみは実機必要性が出るまで保留。
- Phase 5dの既知残存なし。
- Phase 5eの既知残存なし。
- Phase 5fの既知残存なし。
- Phase 5gの既知残存なし。始点dot、周期dab、低flow重ね塗りを現行PixiJS経路で修正済み。
- 追加修正は実機回帰が出た場合に限定する。

意図的に維持する差:

- 通常LayerとCAF cardの幅、depth、背景等のvariant。
- Backgroundは通常Layer Panel専用。
- data正本とHistory復元先はLayerSystem / ClipAssetで分離。

## 次の入口

- Phase 5qは、Animation Table preview / onionの既存描画経路を監査し、Tableを閉じた状態でも現在Frameの別Lane / 別CAFを薄く参照できるLane onion表示をMVPにする。保存画像、export、Layer visibility、ClipAsset / DrawingSnapshot正本は変更しない。
- Phase 5pの既知残存なし。Project frame自体の無限化、全bounds export、tiled canvas、欄外表示モードは後続候補。
- GIF選択時の出力は `.gif` filenameへ修正した。アニメフレームがない場合も現在Project frameを1フレームGIFとして生成する。
- Phase 5kのクラッシュ対策後に再発が出た場合だけ、cold frame退避やHistory state delta化を再検討する。
- PixiJS v8.19依存更新はWebGPU有効化と分離した互換監査候補とする。

## 現在の重要境界

- `tegaki_work/PHASE4Z_BOUNDARY.md` をCAF / Lane / Layer Panel責務の正本として維持する。
- CAF、ClipInstance、Frame / Lane移動はAnimation Table正本。
- Layer Panelは通常Layer / FolderとCAF internal Layer / Folderの編集入口。
- animation working Layerは描画adapterであり保存正本ではない。
- Phase 5pの無限キャンバスはProject frameではなくRaster保存矩形の可変化として扱う。
- WebGPU、SDF/MSDF、WebGL2 Meshは正式Phaseまで凍結。

## 検証

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` 差分を残さない。
