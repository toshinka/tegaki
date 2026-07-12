# Phase 5v - Folder clipping優先実装

## 目的

通常Layer FolderとCAF内部Folderを既存の `none / normal / inverse` clipping契約へ段階的に載せる。Folder blendの完全なgroup合成は本Phaseの必須条件にせず、Folder clippingの保存・表示・History・preview/export一致を優先する。

## 監査結果

- 通常Folderは空のPixi `Container` で、配下Layerは `currentFrameContainer` のflat childrenと `parentId / children` metadataで管理される。Folder blend値をContainerへ置くだけでは配下へ作用しない。
- 通常clippingは単一RasterのRenderTextureをmask Spriteにする。Folder target/sourceを全面解放するにはmask合成とnested規則が必要。
- CAF preview / onion / Frame compositorは再帰構造を持ち、祖先Folderをclipping ownerとして扱えるため先行実装可能。
- 現行HEADではPhase 5iのCAF `clippingMode` 契約がbooleanへ回帰し、属性popup、保存、inverse、半透明alphaが一致していなかった。
- 通常FolderのProject保存は `blendMode / clippingMode` を落としていた。

## 判断

- Slice 0でCAF 3状態契約と通常Folder属性保存を先に復元する。
- Slice 1はCAF Folder clippingを正式化し、preview / onion / Frame compositor / History / save-loadを揃える。
- Slice 2は通常Folder targetを「同一parent直下のRaster source」に限定して実装可否を判断する。子自身のclipping、Folder source、複雑なnested構造を黙って近似しない。
- Folder blendの正確なライブgroup合成はdirty管理付きgroup RenderTextureが必要なため低優先度で棚上げする。

## Slice 3 実機報告による契約修正

- 通常クリッピングはsource alphaの濃度を対象へ乗算せず、alphaが1以上の領域を不透明なシルエットmaskとして扱う。半透明線でも対象Layer自身のalphaは維持する。
- inverseは同じ二値シルエットの内外を反転する。通常Layer、CAF preview、merge/export用CPU合成で同じhelperを使う。
- Folderをclip sourceにする場合、配下SpriteのContainerを直接maskへ渡さない。配下可視Rasterのalphaをproject frame寸法の単一mask textureへ合成する。
- 通常Folder自身もclip targetにできる。直下の下位きょうだいをsourceとし、Folder配下Raster containerへ同じmask textureの個別Spriteを割り当てる。子Raster固有のclippingはlayerSprite側に残し、祖先Folder maskと合成する。
- 通常Folder cardと属性popupへclip buttonを表示する。

## Slice 3 回帰修正とCAF表示契約

- Folder target用の内部mask Spriteを `currentFrameContainer` 直下へ置くと、実Layerとして列挙され、削除不能な空Layer、Project export例外、Canvas消失を起こす。内部maskはowner Folder配下へ隔離する。
- Pixi mask Sprite / RenderTextureは即destroyせず専用poolへ戻し、render-groupの旧instructionによる破棄済みresource参照とstrokeごとのVRAM増加を防ぐ。
- CAF internal Layerのclip owner、直下source、Folder配下Raster列挙は `internal-layer-clipping-contract.js` へ集約する。通常Layer/CAFの正本とHistoryは統合しない。
- animation working LayerはRasterだけを表示adapterにする。祖先Folderを実Layer化せず、共有契約で解決した表示modeとsource working Layer ID群をLayerSystemへ渡す。
- Table展開preview、Table閉後working Layer、Frame compositorは同じ二値source alpha契約を使う。

## Slice 4 clipping / transform負荷対策

- CAF Folder属性変更時にworking Layer用clip契約を再計算する。PREVIEW中は非表示working LayerのGPU mask生成を同期実行せずidleへ送り、通常表示へ戻す前にflushする。
- clipped preview textureがcache済みなら、全Canvasのmask alpha走査前にcache hitさせる。再生中に同じCAFをFrameごとに再合成しない。
- 単一CAF LayerのV変形確定は対象LayerだけをDrawingSnapshotへcaptureする。従来のCAF内全Raster再captureを避ける。
- Folder一括V変形は複数Layerの原子的確定とrollbackのため全対象captureを維持する。巨大Canvas×多数Layerを非同期化するにはHistory/rollback境界の中規模改修が必要なため、本Phaseでは既存size preflightとoperation indicatorを維持し、将来の負荷計測課題とする。
- 現時点の遅延原因はメモリ/VRAM枯渇の証拠ではなく、同期的なGPU readback、RGBA buffer複製、mask再生成の重複である。Worker化だけではGPU readback/uploadをmain threadから除けないため、安易に導入しない。

## Slice 0 - clipping正本回復と保存境界

- `ClipAssetInternalLayerModel` に `clippingMode` を復元し、互換booleanと同期する。
- CAF toggle、属性popup、duplicate、clipboard、通常LayerからCAF作成、working Layer同期で共通helperを使う。
- CAF previewの固定thresholdをalpha乗算へ戻し、inverseを反転alphaとして扱う。
- source不在・非表示・空maskはclip対象を透明にする。
- 通常FolderのProject保存へ `blendMode / clipping / clippingMode` を含める。
- CAF Folderの属性popupにも既存clip buttonを表示する。通常FolderのUIはまだ解放しない。

実装状態:

- `ClipAssetInternalLayerModel` の3状態、serialize、toggle循環を復元済み。
- popup setter、History metadata、working Layer往復、clipboard/duplicate/import経路を共通modeへ接続済み。
- preview alpha乗算/inverse/source不在透明化を復元済み。
- 通常Folder属性のProject保存を追加済み。
- 固定入力で旧boolean=`normal`、serialize/constructor round-trip、Folder toggleの `normal -> inverse -> none` を確認済み。
- BrowserでCAF Folder作成、通常/逆clipping表示、1操作1 History、Undo/Redo、console errorなしを確認済み。
- 実Projectファイルによる通常Folder属性とCAF Folder modeの保存復元確認は残る。

## Slice 1 - CAF Folder clipping

- Folder自身をclipping ownerとして、配下Raster全体を同一parent直下sourceでclipする。
- sourceがFolderの場合は配下の可視Raster alphaをmask sourceにする。
- preview、onion、Frame compositor、Folder merge、Undo/Redo、Project保存復元を確認する。
- 描画中working Layerはflat adapterのまま。stroke中とstroke後previewの差が残る場合は明示し、入力経路をgroup Containerへ置換しない。

実装状態:

- Folder owner / Raster source、Folder owner / Folder sourceをpreview alpha合成へ接続済み。
- 半透明maskの固定入力でtarget alpha 200、mask alpha 128に対しnormal=100、inverse=100を確認済み。
- source不在、空source、非表示Folder sourceはnormal/inverseともtarget alpha 0へ統一済み。
- Folder merge時はFolder自身の `clippingMode` を置換Rasterへ保持し、内部Layer mergeの空mask/inverseも透明化する。
- ProjectManagerのanimation独自serializeで落ちていたPhase 5u `clipGroups` も保存対象へ復元した。
- BrowserでCAF FolderへLayerをD&D配置、通常/逆切替、Undo/Redo、console errorなしを確認済み。

## 条件付きSlice 2 - 通常Folder target

- 最初は同一parent直下RasterをsourceとするFolder targetだけを対象にする。
- Folder配下Rasterへancestor maskを適用し、子自身のclipと競合しない合成方法を固定入力で確認する。
- Folder source、Folder同士、nested Folder、子自身のclippingとの安全な合成ができない構成はUIでdisabled理由を示す。
- 保存・History・source非表示/削除/D&D後の再探索を通常Layer契約へ含める。

## Slice 3 - Folder visibilityとFolder source

- 通常Folder / CAF内部Folderのeye操作が、開閉状態に依存せず配下全体のCanvas、preview、onion、exportへ反映されるようにする。
- 同一parent直下でLayerの下にFolderがある場合、Folder配下の可視Raster合成alphaをそのLayerのclip sourceとして使う。
- Folder sourceの非表示、空、削除、D&D、nested Folderでsource探索と透明化契約を維持する。
- Folder targetとFolder sourceを混同せず、sourceは配下alpha、targetは配下group全体を意味する。

実装状態:

- 通常Folder visibilityを祖先Folderまで解決し、eye OFF時に配下LayerのPixi表示もOFF、再表示時は子自身のvisibilityを復元するよう修正済み。
- 通常Raster targetの直下sourceがFolderの場合、配下の可視Raster RenderTextureをmask Containerへ束ねるライブ表示経路を追加済み。
- 空Folder、非表示Folder、可視Rasterを持たないFolderは無効sourceとしてtargetを透明化する。
- 固定入力でFolder visibilityのOFF/再表示/子自身OFFと、Folder source探索・非表示拒否を確認済み。
- Browserで通常LayerをFolderへD&D、Folder eye往復、Folder直上Layerのclipping ON、console errorなしを確認済み。
- 描画済みピクセル、inverse、source削除/D&D後、通常animation exportの実操作確認は残る。

## 条件付きSlice 4 - Folder group effect

- Folderの加算、乗算、Overlayは、子Layerへmodeを伝播せず、配下を一度group合成した結果へ適用する。
- OverlayがライブCanvas、CAF preview、Folder merge、PNG/animation exportのどこで無効・近似になるかを固定色で比較する。
- 正確な表示にdirty group RenderTextureが必要な場合、Visibility / Folder clipping完了を優先し、このSliceだけを別Phaseへ送る。

監査結果:

- `pixi.js/advanced-blend-modes` は初期化時にimport済みで、単体RasterのOverlay登録は存在する。
- Canvas2D compositorも `globalCompositeOperation = 'overlay'` を持つ。
- 通常Folderは空Containerなので、FolderへOverlay/add/multiplyを設定しても配下groupへ作用しない。現状の「Overlayが効かない」主因はmode未登録ではなく表示構造である。
- CAF previewとanimation exportは再帰group経路を持つが、通常Canvasと通常PNG/Folder mergeとの一致は保証できない。完全修正はdirty group RenderTexture候補として残す。

## Slice 5 - Table展開時の表示正本と入力負荷

- CAF previewへFolder nodeを含め、`parentLayerId` の参照先を保持する。全internal Raster非表示は処理済みblankとし、旧primary snapshotへfallbackしない。
- internal Layer順、parent、visibility、opacity、blend、clipping、snapshot revisionをpreview keyへ含め、D&Dやeye変更をFrame切替なしで反映する。
- stroke captureはRaster内容だけをCAF正本へ戻し、working Layerの実効visibilityをFolder子自身のvisibilityへ逆流させない。
- Table Previewが一時的に変更するruntime `visible` と、clipping source探索用の永続 `layerData.visible` を分離する。Folder target抑制時は元のruntime visibilityを保存して解除時に復元する。
- stroke開始時は属性・階層がdirtyでない既存clipping maskを再利用する。VドラッグはPixi transformを各入力で更新しつつ、DOM値更新・`layer:updated`・thumbnail要求だけを1 animation frameへ集約する。
- CAF mirrorの名前領域はsingle clickで選択色を即時反映し、実working Layer同期をdouble-click判定後に一経路で行う。double-click renameは維持する。

確認:

- オーナー実機でTable展開時のFolder子表示と各種clipping一致を確認済み。
- BrowserでFolder preview、全非表示blank、D&D即時反映、Table閉/再展開、stroke中/確定後表示、CAF名single click選択、double-click rename、console errorなしを確認済み。
- 400×400のTable展開中stroke反復は自動操作で約138-239ms/操作。Vキーを保持した実ペン/マウス操作の体感確認はオーナー実機確認を残す。

## Slice 6 - ペン入力GPU集約とCAF一括削除

- 高Hz penの `getCoalescedEvents()` は全sample、筆圧、補間、StrokeRecorder記録を維持し、pen segmentごとのGraphicsを同一Containerへ積んでRenderTexture描画だけを親pointermoveごとに1回へ集約する。mouse、eraser、airbrushの経路は変更しない。
- Animation Table全面の `backdrop-filter` はCanvas更新のたびに背景再合成を誘発するため撤去し、ほぼ不透明な背景色へ置換する。
- Ctrl/Cmd複数選択とCAF Group選択は同じ `selectedCelIds` を削除正本とする。全clip IDを変更前に検証し、一件でも不明なら無変更、成功時は全Laneから一括削除してGroup整合を一度だけ再計算する。
- 単体削除は既存 `caf-clip-delete`、複数削除は `caf-clips-delete` とし、いずれもUndo/Redo一回で配置、Group、選択集合を復元する。ClipAsset / DrawingSnapshot / clipboardは削除しない。

確認:

- `removeClips()` の不明ID混在時の原子的拒否、重複ID排除、Group全member削除時のGroup除去を固定入力で確認済み。
- Browserで3件Ctrl選択、Group化、一括削除、Undo/Redo、Group解除後の一括削除、`Alt+Delete`、選択集合復元、console errorなしを確認済み。
- オーナー実機で複数選択CAFとCAF Groupの一括削除を確認済み。
- オーナー実機ではPC再起動後に通常/Table展開時のpen描画とVキー移動が滑らかへ復帰した。長時間ブラウザ/GPU状態またはHUION Kamvas 22 Gen 3ドライバの一時状態が関与した可能性があり、アプリ変更単独の効果とは断定しない。再発時は同一Projectで再起動前後とdriver versionを併記して計測する。

## Closeout回帰 2026-07-13

- `ProjectManager.exportProject()` → `loadProject()` の固定入力で、通常Folderのparent/children、visibility、opacity、blend、normal/inverse clippingを往復確認した。
- Project animation serialize → `TimelineModel` 復元の固定入力で、CAF内部Folderのparent、visibility、blend、inverse clippingを往復確認した。
- CAF clipping共有契約の固定入力で、inverse ownerのFolder source、複数Raster子孫、source非表示、source削除、D&D順変更後のsource再探索を確認した。
- Browserで2 Frameの異なる描画を作成し、Timeline onion前Frame暖色表示、8 FPS再生/停止、GIF 1–2 Frameプレビューの400×400 Blob生成、console errorなしを確認した。
- GIFダウンロード操作はpopupを正常終了しconsole errorなし。Blob anchor経由のためBrowserのdownload eventでは捕捉できず、生成ファイル内容の目視はオーナー確認へ残す。

最終オーナー確認:

- 実描画を持つ `Raster→Raster / Folder→Raster / Raster→Folder / Folder内複数Raster` のnormal/inverse構成を実Projectファイルで保存・再読込し、Canvas表示と属性が一致すること。
- 同じ複合Folder構成をonion、playback、GIF/WEBP/APNGへ出力し、previewと生成ファイルのclipping結果が一致すること。
- 2026-07-13、オーナー実機で問題なしを確認済み。

## Slice 7 - 大量Frame時のscrollbarとTimeline縮小

- Timeline zoom controlをTable右下のabsolute配置からheader rightへ移し、Frame数・Table高さ・水平scrollbar thumb長に依存しない配置へ変更する。
- 既存60%を境界とし、47%・40%・33%の縮小段階を追加する。60%未満ではFrame番号だけを非表示にし、秒境界、current Frame色、IN/OUT marker、CAFセルは維持する。
- Browserで240 Frame、通常幅と543px狭幅、60%/47%/40%/33%を確認した。33%では240セルと30個の秒境界を保持し、zoom controlとviewportは非重複、水平scrollbarは全面操作可能、console errorなし。

## 低優先度 - Folder blend

- Folder配下を一度RenderTextureへgroup合成してから親へblendする完全実装は、Visibility / Folder clippingより低優先度とする。
- 現行のselect値だけを子Layerへ書き換える近似は採用しない。
- 将来実装する場合はdefault Folderの性能を維持し、non-default Folderだけdirty cache付きgroup RenderTexture化する別Phaseとする。

## Phase完了

- 2026-07-13、Folder clipping、visibility、通常/CAF表示、Project metadata、onion/playback/export preview、入力負荷、CAF一括削除、大量Frame UIの確認を完了した。
- Folder group blend完全合成は本Phase残件に含めず、dirty group RenderTextureを要する別Phase候補として棚上げする。

## 代替案

| 案 | 適合度 | 安定性 | 扱い |
| --- | ---: | ---: | --- |
| CAF Folder clipping先行 | 9/10 | 8/10 | 採用 |
| 通常Folder target限定 | 8/10 | 7/10 | 条件付き |
| 子Rasterへ破壊的にclipを適用 | 6/10 | 9/10 | fallback |
| dirty group RenderTexture | 10/10 | 3/10 | 別Phase |
| 本格Layer mask | 9/10 | 4/10 | 将来候補 |

## 維持する契約

- 通常LayerとCAFはUI actionを共有してもHistory正本を分離する。
- source探索は同一parentの直下きょうだいだけとし、Folder境界を越えない。
- `clippingMode` を正本、`clipping` を互換booleanとする。
- 上側Lane前面、preview staging/container順、PSD record順、working Layer表示契約へ無関係な変更を入れない。
- WebGPU、Canvas2Dのstroke描画混入、通常Layer/CAFモデル統合、Layer mask本格実装を混ぜない。

## 検証

- 変更JSの `node --check` と `npm.cmd run build`。
- none / normal / inverse、半透明alpha、source不在/非表示/空mask。
- CAF Folder clipのpreview、onion、Frame export、Folder merge、Undo/Redo、Project保存復元。
- 通常Folder属性のProject保存復元。
- Browser console errorなし。
- build後の `dist/` と `node_modules/.vite/` 生成差分を残さない。
- 実機構成: Raster→Raster、Folder→Raster、Raster→Folder、Folder内複数Raster、normal/inverse、半透明source。
- 複数CAF/Group CAF削除、単一History Undo/Redo、削除後もclipboard paste可能、`Alt+Delete`。
