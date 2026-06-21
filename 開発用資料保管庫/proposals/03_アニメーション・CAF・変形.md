# アニメーション・CAF・変形計画

更新日: 2026-06-20

## 現在の到達点

- Lane / ClipInstance / ClipAsset / CAFのモデル足場。
- CAF内部Layer/Folder、選択、表示、クリッピング、名前変更、並べ替え。
- ClipとCAF内部Layerのコピー・ペースト。
- CAF保存・復元、Album往復。
- 通常Layer PanelとCAF内部Layer PanelのカードUI・Pointer D&D共通化。

責務境界は `tegaki_work/PHASE4Z_BOUNDARY.md` を正本とする。

## 直近の不具合

現時点で再現確認中の重大不具合なし。
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

### Phase 5j: 再生終端・ループ・範囲指定 `実装途中・監査修正中`

- `TimelineModel.playback.loop` と終端時の停止処理は存在するが、Animation Tableから明示的に切り替えるUIが不足している。
- 再生終端は「総Frame末尾」だけでなく「最後に配置されたCAFの終端」またはユーザー指定OUT markerを選べるようにする。
- 停止 / ループを小型buttonで切り替え、現在状態をアイコンとtooltipで明示する。
- Timeline上のIN / OUT markerで部分再生範囲を指定する。
- 修飾clickはCtrl+ClickのCAF作成・削除、Shift操作、Timeline panと競合を監査してから決める。先にキーを固定しない。
- marker、loop、終端基準をproject保存対象にするか、UI session状態に留めるかをPhase化時に決める。
- Phase 5jではTimelineModelのproject保存対象とし、Export popupの範囲入力とは分離する。
- 実行指示書は `task-codex/phase5j.md`。
- 2026-06-21監査でmodel helperは確認したが、scope別実再生、正規化、UI、History、
  marker CSSが未完了。`tegaki_work/PHASE5J_AUDIT.md` に沿って修正する。

### Animation Tableを閉じた時のLane表示モード `候補`

- 現在Frameの表示を「アクティブCAFのみ」「対象Laneを通常合成」「非アクティブLaneをonion表示」から選べるようにする。
- 時間方向の前後Frame onion skinと、同一Frameの別Laneを薄く表示するLane onionを別概念・別stateにする。
- 初期候補はLane onion。選択中CAFを主表示し、関連Laneを低opacityで確認できる状態とする。
- Layer PanelのFrame切替領域に小型buttonを置く案を優先し、`square-stack` 相当のLucide iconを候補とする。
- Animation Tableを閉じても表示モードを維持するが、保存画像・export・Layer visibility正本は変更しない。
- `ALL / LANE / SET` のPlayback Scopeと責務を重複させず、表示だけのmodeとして設計する。

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
