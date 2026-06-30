# PHASE5N_HANDOFF — Phase 5n完了記録

更新日: 2026-06-28

## 現在状態

- Phase 5mは完了。
- pen入力profileをdebug限定で追加し、PointerEvent / coalesced / local座標 / StrokeRecorder / 補間 / preview-final境界を記録できる。
- 短いpen strokeの大丸化は、極短入力だけ初期pressureをcapすることで抑制した。
- pen opacity 50%前後の濃度溜まりは、一時RenderTextureへstrokeを集め、preview / commitで一度だけ全体opacityを掛ける経路へ変更した。
- opacity 50%でAAが弱く見えた件は、一時RenderTextureにも `antialias: true` を付けて通常Layer RenderTextureと揃えた。
- `筆圧で濃度を変える` と `筆圧濃度` を追加し、OPACITY上限内で筆圧alphaを変えられるようにした。
- 墨・水彩的な蓄積、にじみ、濃淡混色はGPU Brush Lab / WebGPU側の検討へ棚上げした。WebGPUを試す場合も、まずスプレー/粒子系で効果と負荷を測ってからpen本体へ広げる。
- Phase 5m指示書とhandoffは `開発用資料保管庫/Archive/` へ移動した。
- Phase 5nの最初の修正で、通常Layer上の `V` 単独キーによるLayer全体変形入口は動作した。`M` キーで範囲指定した後の `V` キーselection変形も動作した。
- Animation Table / CAF working Layer上でも `V` 単独でLayer全体変形へ入るようにした。
- V中の矢印操作はAnimation TableのFrame移動へ流さず、Layer変形へ送るようにした。
- CAF working Layerの変形確定は通常Layer Historyへ記録せず、焼き込み後にCAF internal Layer Historyの `caf-internal-layer-transform` として記録する。
- CAF上で `V`開始、矢印移動、Escape cancelではHistoryが増えないことを確認した。
- CAF上で短いpen描画後、`V` / ArrowRight / `V` 確定によりHistoryが1/500から2/500へ増え、Undoで1/500、Redoで2/500へ戻ることを確認した。Frame 1維持、Browser console errorなし。
- `V`変形確定後、Album保存とAlbumカード復元を確認した。復元後の新規console errorなし。
- Phase 5n完了後の次Phase候補として、画像ファイルimportと外部クリップボード画像の `Ctrl+V` 貼り付けを予約する。

## Phase 5nの目的

選択範囲が無い状態で `V` キーを押した時、アクティブ通常Layer全体の移動・変形sessionが確実に開始することを確認し、必要なら最小修正する。

selectionがある時はselection変形を優先し、selectionが無い時はLayer全体変形へ戻る。Folder、Background、ClipInstance transformへ広げない。CAF working Layer上では通常Layer Historyへ誤接続せず、CAF internal Layer Historyへ記録する。

## 最初に読む順序

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

## 作業開始時の必須確認

最初に以下を実行し、既存変更を維持する。

```powershell
git status --short --untracked-files=all
```

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Phase 5n Slice 1

最初は実装より固定操作監査を優先する。

- 選択範囲なし、通常Raster Layerで `V` を押す。
- drag移動、`V` 再入力でconfirm、Undo / Redo。
- drag移動、Escapeでcancel、Historyが増えないこと。
- 選択範囲ありで `V` を押し、selection変形が優先されること。
- selection解除後に `V` を押し、Layer全体変形へ戻ること。
- Background / FolderではLayer全体変形が開始しないこと。
- Animation Table表示中またはCAF working Layer上ではCAF internal Layer Historyへ接続し、通常Layer Historyへ誤接続しないこと。

## やらないこと

- Transform UIの全面再設計。
- `Ctrl+T` 採用、`T` キー採用、ショートカット体系の大幅変更。
- Folder全体変形。
- ClipInstance transform / keyframe / easing。
- 回転・拡縮・flipの高品質化、永続transform state、保存形式変更。
- WebGPU、SDF/MSDF、WebGL2 Mesh。

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
