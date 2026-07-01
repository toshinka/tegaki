# アニメーション・CAF・変形計画

更新日: 2026-07-01

## 現在の到達点

- Lane / ClipInstance / ClipAsset / CAFのモデル足場。
- CAF内部Layer/Folder、選択、表示、クリッピング、名前変更、並べ替え。
- ClipとCAF内部Layerのコピー・ペースト。
- CAF保存・復元、Album往復。
- 通常Layer PanelとCAF内部Layer PanelのカードUI・Pointer D&D共通化。

責務境界は `tegaki_work/PHASE4Z_BOUNDARY.md` を正本とする。

## 直近の不具合

- 多枚数CAFの重化・クラッシュはPhase 5kで、snapshot / History / thumbnail / Texture cacheの常駐量計測と上限・破棄境界を追加済み。
- 同種の再発が出た場合だけ、cold frame退避やHistory state delta化を再検討する。
描画中の非アクティブCAF表示回帰はPhase 5aで修正済み。

## 直近候補

### アニメテーブルのホイール操作 `候補`

- 標準ホイール: Lane領域の縦スクロール。
- Shift+ホイール: Timelineの横スクロール。
- Ctrl+ホイール: タイムラインズーム。
- ホイールだけで現在Frameを切り替える操作は誤操作を避けるためPhase 5aへ含めない。
- ブラウザズーム、パネルスクロール、ペン操作との競合を先に確認する。

### Lane完全独立化 `部分`

- 現在残る `sourceLayerId` と通常Layer由来同期を棚卸しする。
- Laneを配置行、ClipInstanceをFrame/Lane上の正本にする。
- CAF内部LayerをZ軸編集の正本とし、通常LayerSystemと統合しない。

### 描画ターゲット切替 `部分`

- 選択CAF内部Layerへ直接描画する最終経路。
- working Layerは移行用互換層として段階的に縮小する。
- 通常描画モードを壊さず、明示的なアニメ編集状態で切り替える。

### Phase 5j: 再生終端・ループ・範囲指定 `完了`

- Animation Tableからloop、終端基準、IN / OUT markerを操作できる。
- `ALL / LANE / SET` は再生対象Lane、IN / OUTは時間範囲として分離した。
- last-clip終端は再生開始時に固定したscope対象Lane集合で計算する。
- playback設定はTimelineModelのproject保存対象とし、Export popupの範囲入力とは分離した。
- 完了記録は `開発用資料保管庫/Archive/phase5j.md`。

### Phase 5k: 多枚数CAFのメモリ・VRAM安定化 `完了`

- 多枚数CAF作成時の重化・クラッシュを固定入力で再現し、snapshot / History / thumbnail / Texture / RenderTextureの常駐量を計測する。
- オーナー環境は64GB RAM / RTX4070無印。低性能PCへ過度に合わせず、ただしブラウザ内のJS heap / WebGL texture制約を前提に上限を設計する。
- 現在Frameと表示中Frameだけを熱いcacheにし、非表示FrameのTexture / thumbnailを上限付きで破棄する方針を優先する。
- IndexedDB / Blob退避やWorker圧縮は冷たいFrame向けの比較候補。描画中CAFへ同期的に使わない。
- WebGPUはメモリ上限の直接解決策ではないため、Phase 5kへ混ぜない。まずWebGL / PixiJS v8.17経路で常駐copyを減らす。
- 完了記録は `開発用資料保管庫/Archive/phase5k.md`。

### Phase 5q: Animation Tableを閉じた時のLane表示モード `完了`

- 現在Frameの表示を「アクティブCAFのみ」「対象Laneを通常合成」「非アクティブLaneをonion表示」から選べるようにする。
- 時間方向の前後Frame onion skinと、同一Frameの別Laneを薄く表示するLane onionを別概念・別stateにする。
- 初期候補はLane onion。選択中CAFを主表示し、関連Laneを低opacityで確認できる状態とする。
- Layer PanelのFrame切替領域に小型buttonを置く案を優先し、共有 `onionSkin` ghost iconを使う。
- Animation Tableを閉じても表示モードを維持するが、保存画像・export・Layer visibility正本は変更しない。
- `ALL / LANE / SET` のPlayback Scopeと責務を重複させず、表示だけのmodeとして設計する。
- 完了: Lane onionはTable閉状態のdisplay-only参照として実装した。Timeline onionも同じ `onionSkin` ghost iconを使うbuttonへ揃え、ふたばカラーの単一countで前後4フレームまで順送り表示できる。

## 出力と編集

### Clipboard context routing `部分`

- Canvasが最後に操作された場合、Ctrl+Cは選択範囲を保持し、Ctrl+Vは新規通常Layerとして貼り付ける。
- Animation Tableが最後に操作された場合、Ctrl+Cは選択CAFを保持し、Ctrl+Vは最新のCAFコピーまたはCanvas選択範囲から新規CAFを作る。
- Folder配下の複数Layerを選択範囲でまとめ、Folder構造ごとCAFへ変換する経路は、複数Layer clipboardとcomposite history設計後に扱う。

### アニメプレビュー・GIF/APNG出力 `候補`

- 指定範囲を200px前後の小型領域で、アスペクト比を保ってループ再生する軽量プレビュー。
- previewと連番PNG、APNG、GIFは同じFrame compositorを使用する。
- 出力FPS、範囲、背景、透過を明示する。
- GIF、APNG、連番PNGの優先順位を決めてから実装する。

### Timeline編集強化 `候補`

- Lane追加・削除・並べ替え。
- ClipInstanceのFrame/Lane移動、duration、複製、UNIQUE化。
- FPSごとの秒境界強調。
- EventBusや保存形式の変更は同一Phaseで送受信・migrationを揃える。

## 変形・物理・Perform

### Phase 5h: Raster変形の反復劣化 `完了`

- Vキー変形は確定ごとにRenderTextureへ再サンプリングするため、移動・拡縮・回転を何度も確定すると画質が劣化し得る。
- Phase 5cでは1回のconfirmにつき再サンプリング1回であることを維持し、意図しない二重bakeを防ぐ。
- 単純移動の整数pixel化、変形session中の元Snapshot維持、非破壊transform stateの保持を比較する。
- 描画再開時、保存時、export時のどこで最終bakeするかを決めずに、原画像cacheだけを追加しない。
- Phase 5dのfloating selectionと共通の「開始時Snapshot + preview transform + 1回のconfirm」境界から拡張する。
- まず整数平行移動を非再サンプリング経路に分離し、拡縮・回転の高品質化や非破壊transform stateは保存互換を含む別sliceで比較する。
- Phase 5hでは通常Raster Layerとpixel selectionの純粋な整数平行移動をRGBA shiftで確定する。
- 回転・拡縮・flipは現行の1回bakeを維持し、永続transform stateや原画像cacheは導入しない。
- 固定計測と通常Raster Layer・pixel selectionの整数平行移動を完了した。
- clipping、Folder、保存復元、PNG preview、表示反転、CAF境界の最終回帰も完了した。
- 完了記録は `開発用資料保管庫/Archive/phase5h.md`。

### Phase 5n: selectionなしVキーLayer全体変形入口 `完了`

- 選択範囲が無い状態で `V` キーを押した時、通常Raster Layer全体の移動・変形sessionへ確実に入ることを確認する。
- selectionがある時はselection変形を優先し、selection解除後はLayer全体変形へ戻る。
- Background、Folder、ClipInstance transformへ対象を広げない。
- Phase 5hの整数平行移動非再サンプリング経路、confirm / cancel、Undo / Redo、保存復元を維持する。
- 通常Layerに加え、Animation Table / CAF working Layer上でも `V` 単独でLayer全体変形へ入り、確定結果をCAF raster Historyへ記録する。
- 完了記録は `開発用資料保管庫/Archive/phase5n.md`。

### Phase 5p: 無限キャンバス / 欄外ラスター保持 `完了`

- 詳細設計は `開発用資料保管庫/proposals/06_無限キャンバス.md`。
- Phase 5nのLayer全体移動とPhase 5oの画像importにより、アニメ素材をProject frame外へ逃がす操作が現実的になった。
- 現行の固定RenderTexture契約では、欄外へ出たpixelが変形確定やsnapshot保存時に切り捨てられる。
- Project frame、Timeline frame、通常export範囲は固定し、通常Raster Layer / CAF internal Raster Layerの保存矩形だけを `rasterBounds` として可変化する。
- CAF working Layer restore / capture、DrawingSnapshot、CAF raster History、Frame compositor、保存復元をbounds対応する。

### ClipInstance transformとkeyframe `候補`

- position、rotation、scale、opacityをClipInstance側へ保持する。
- CAF内部画像データと配置transformを混同しない。
- easingはkeyframe基盤後に追加する。

### Perform記録 `保留`

- 再生中の変形操作をkeyframeへサンプリングする。
- 記録頻度、簡略化、Undo単位を先に設計する。

### 物理演算・メッシュ `保留`

- 物理計算はAPI非依存の数値モデルとして分離する。
- Live2D風メッシュは保存・編集・出力基盤が整ってから扱う。
