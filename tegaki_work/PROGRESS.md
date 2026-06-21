# PROGRESS — 現在状態

更新日: 2026-06-21

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
Phase 5jのTimeline再生範囲・終端・ループ制御は部分実装。
2026-06-21監査で未完了と判定し、次Phaseへ進まず修正継続する。
指示書は `task-codex/phase5j.md`、監査は `tegaki_work/PHASE5J_AUDIT.md`、
引き継ぎは `tegaki_work/PHASE5J_HANDOFF.md`。

## Phase 5j監査状態

- `TimelineModel.playback` の新field、range helper、範囲対応advanceは追加済み。
- `play()` がscopeを渡さず、LANE / SETのlast-clip終端が実再生へ反映されない。
- playback正規化methodはconstructor、総Frame変更、History / project復元へ未接続。
- loop、終端mode、IN / OUT設定・解除UI、History、marker CSSは未実装。
- model固定入力、`node --check`、buildは成功。
- Browserで追加control不在と既存Animation Tableのconsole新規errorなしを確認した。
- PixiJS v8.19はWebGPU既定化ではないため、Phase 5jとWebGPU移行を混ぜない。

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
- Settingsへ自動調整、50/100/250/500件、128/256/512/1024MB、現在使用量を追加した。
- `navigator.deviceMemory` を安全な初期値の参考にし、手動設定をlocalStorageへ保存する。
- History欄のcheckbox、select、option、使用量表示をFutaba paletteへ統一した。

### 確認

- オーナー実機: Frame preview / download成功、最終CAF残置なし、CAF増加後の描画遅延なし。
- ブラウザ: CAF A描画 → CAF B切替 → Undo / RedoでCAF AとFrame 1へ復帰し、描画が消去・再表示される。
- ブラウザ: History使用量表示は `--futaba-maroon`。
- `npm.cmd run build` 成功。

Phase 5b指示書は `開発用資料保管庫/Archive/phase5b.md` へ移動した。

## 既知残存

- Phase 5bの既知残存なし。
- Layer Panel / CAF共通UI、Pointer D&D、押しのけ表示の既知残存なし。
- Phase 5hの既知残存なし。回転・拡縮・flipの高品質化や永続transform stateは対象外として未着手。
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

- Phase 5j修正を開始する。最初はscope別last-clip実再生とplayback正規化を直す。
- 次にloop / endMode / IN / OUT UI、History、保存復元を接続する。
- Phase 5j完了前に次Phaseへ進まない。
- PixiJS v8.19依存更新はWebGPU有効化と分離した互換監査候補とする。

## 現在の重要境界

- `tegaki_work/PHASE4Z_BOUNDARY.md` をCAF / Lane / Layer Panel責務の正本として維持する。
- CAF、ClipInstance、Frame / Lane移動はAnimation Table正本。
- Layer Panelは通常Layer / FolderとCAF internal Layer / Folderの編集入口。
- animation working Layerは描画adapterであり保存正本ではない。
- WebGPU、SDF/MSDF、WebGL2 Meshは正式Phaseまで凍結。

## 検証

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` 差分を残さない。
