# アニメーション・CAF・変形計画

更新日: 2026-06-19

## 現在の到達点

- Lane / ClipInstance / ClipAsset / CAFのモデル足場。
- CAF内部Layer/Folder、選択、表示、クリッピング、名前変更、並べ替え。
- ClipとCAF内部Layerのコピー・ペースト。
- CAF保存・復元、Album往復。
- 通常Layer PanelとCAF内部Layer PanelのカードUI・Pointer D&D共通化。

責務境界は `tegaki_work/PHASE4Z_BOUNDARY.md` を正本とする。

## 直近の不具合

### 描画中に非アクティブCAFが消える `不具合`

- 同一Frame上のアクティブCAF以外が、pointerdownからpointerupまで一時的に非表示になる。
- working Layer同期、ライブ描画対象、Frame composite previewの切替順を確認する。
- pointerup後に戻るため、永続visible値を書き換える修正は行わない。

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

## 出力と編集

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

### Raster変形の反復劣化 `調査`

- Vキー変形は確定ごとにRenderTextureへ再サンプリングするため、移動・拡縮・回転を何度も確定すると画質が劣化し得る。
- Phase 5cでは1回のconfirmにつき再サンプリング1回であることを維持し、意図しない二重bakeを防ぐ。
- 単純移動の整数pixel化、変形session中の元Snapshot維持、非破壊transform stateの保持を比較する。
- 描画再開時、保存時、export時のどこで最終bakeするかを決めずに、原画像cacheだけを追加しない。
- Phase 5dのfloating selectionと共通の「開始時Snapshot + preview transform + 1回のconfirm」境界から拡張する。

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
