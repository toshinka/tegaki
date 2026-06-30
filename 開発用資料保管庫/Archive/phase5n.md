# Phase 5n — VキーLayer全体変形入口の再確認と修正

更新日: 2026-06-28

## 完了メモ

- 通常Layer上の `V` 単独キーによるLayer全体変形入口は動作した。
- `M` キーで範囲指定した後の `V` キーselection変形は動作した。
- Animation Table / CAF working Layer上でも `V` 単独でLayer全体変形へ入るようにした。
- V中の矢印操作はAnimation TableのFrame移動へ流さず、Layer変形へ送るようにした。
- CAF working Layerの変形確定は通常Layer Historyへ記録せず、焼き込み後にCAF internal Layer Historyの `caf-internal-layer-transform` として記録する。
- CAF上で `V`開始、矢印移動、Escape cancelではHistoryが増えないことを確認した。
- CAF上で短いpen描画後、`V` / ArrowRight / `V` 確定によりHistoryが1/500から2/500へ増え、Undoで1/500、Redoで2/500へ戻ることを確認した。Frame 1維持、Browser console errorなし。
- `V`変形確定後、Album保存とAlbumカード復元を確認した。復元後の新規console errorなし。

## 目的

選択範囲が無い状態で `V` キーを押した時、アクティブ通常Layer全体の移動・変形sessionが確実に開始することを確認し、必要なら最小修正する。

Phase 5d / 5hでselection変形とLayer全体変形は同じショートカットを共有している。Phase 5nでは、selectionがある時はselection変形を優先し、selectionが無い時はLayer全体変形へ戻るルーティングを崩さず確認する。

## 最初に読むファイル

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE5N_HANDOFF.md`
5. `task-codex/phase5n.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`
8. `tegaki_work/ui/keyboard-handler.js`
9. `tegaki_work/system/layer-system.js`
10. `tegaki_work/system/layer-transform.js`
11. `tegaki_work/system/pixel-selection-system.js`
12. `tegaki_work/system/raster-translation.js`
13. `tegaki_work/system/transform-math.js`

## 対象

- `V` 単独入力のルーティング。
- selection有無による `PixelSelectionSystem.requestTransform()` と `LayerSystem.enterLayerMoveMode()` の優先順位。
- 通常Raster LayerのLayer全体変形開始、preview、confirm、cancel、Undo / Redo。
- Background、Folderでの既存除外挙動。
- CAF working Layer / Animation Table表示中のLayer全体変形開始、preview、confirm、cancel、Undo / Redo。
- Phase 5hの整数平行移動非再サンプリング経路が維持されること。

## やらないこと

- Transform UIの全面再設計。
- `Ctrl+T` 採用、`T` キー採用、ショートカット体系の大幅変更。
- Folder全体変形。
- ClipInstance transform / keyframe / easing。
- 回転・拡縮・flipの高品質化、永続transform state、保存形式変更。
- WebGPU、SDF/MSDF、WebGL2 Mesh。

## Slice 1 — 固定操作監査

固定操作:

- 選択範囲なし、通常Raster Layerで `V` を押す。
- drag移動、`V` 再入力でconfirm、Undo / Redo。
- drag移動、Escapeでcancel、Historyが増えないこと。
- 選択範囲ありで `V` を押し、selection変形が優先されること。
- selection解除後に `V` を押し、Layer全体変形へ戻ること。
- Background / FolderではLayer全体変形が開始しないこと。
- Animation Table表示中またはCAF working Layer上ではCAF internal Layer Historyへ接続し、通常Layer Historyへ誤接続しないこと。

実機確認メモ:

- 通常Layer上の `V` 単独キーによるLayer全体変形入口は動作した。
- `M` キーで範囲指定した後の `V` キーselection変形は動作した。
- Animation Table / CAF working Layer上でも `V` 単独でLayer全体変形へ入り、確定はCAF internal Layer Historyへ記録する。

確認するもの:

- `keyboard:vkey-state-changed` の発火条件。
- `LayerSystem.enterLayerMoveMode()` が対象Layer IDと開始時transformを保持していること。
- `LayerSystem.exitLayerMoveMode()` のconfirm / cancelでsessionが残らないこと。
- `PixelSelectionSystem.requestTransform()` がselection有りの場合だけ優先されること。
- `layer-transform-panel` 表示、status表示、thumbnail更新、clipping mask再構築。

## 次Phase検討予約

Phase 5n完了後に、画像ファイルimportと外部クリップボード画像の `Ctrl+V` 貼り付けを先行候補として検討する。

- 既存のLayer / CAF / Folder clipboard契約と競合させない。
- OS / ブラウザ由来の画像Blobだけを外部画像として判定する。
- 新規通常Layerへ取り込み、アスペクト比を保ってキャンバス内へ縮小する入口を優先する。

## Slice 2候補 — 入口修正

Slice 1で回帰が確認できた場合だけ実装する。

- selection状態の判定を明確化し、空selectionや解除済みselectionでLayer全体変形が塞がれないようにする。
- Vキー状態、Layer transform session、selection transform sessionの終了時同期を揃える。
- 既存EventBus payloadを変える場合は送受信側を全検索し、同一Phase内で更新する。

## 検証

```powershell
node --check tegaki_work/ui/keyboard-handler.js
node --check tegaki_work/system/layer-system.js
node --check tegaki_work/system/layer-transform.js
node --check tegaki_work/system/pixel-selection-system.js
node --check tegaki_work/system/raster-translation.js
node --check tegaki_work/system/transform-math.js
Set-Location tegaki_work
npm.cmd run build
```

Browser確認:

- 通常Raster Layer: `V`開始、drag、`V`確定、Undo / Redo。
- 通常Raster Layer: `V`開始、drag、Escape cancel、History増加なし。
- selectionあり: `V`でselection変形、selection解除後はLayer全体変形。
- Background / Folder: `V`で誤変形しない。
- CAF working Layer / Animation Table表示中: `V` 単独でCAF working Layer全体変形へ入り、確定はCAF internal Layer Historyへ記録する。通常Layer Historyへ誤接続しない。
- 保存復元、console errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
