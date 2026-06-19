# PROGRESS — 現在状態

更新日: 2026-06-19

> 現在状態だけを記録する正本。
> 詳細計画は `開発用資料保管庫/proposals/00_計画索引.md` から読む。
> 過去ログと完了文書は `開発用資料保管庫/Archive/` に退避。

---

## 現在のPhase

Phase 4z26のLayer Panel / CAFカードUI統合は完了。

- 通常Layer/FolderとCAF内部Layer/Folderは共通DOM rendererを使用。
- 選択、名前変更、表示、クリッピング、Folder開閉は共通event delegationとadapterを使用。
- Pointer D&D、ghost、drop判定、押しのけanimationは共通engineを使用。
- LayerSystemとClipAsset内部モデル、History、working Layer同期はadapter境界で分離。
- Albumの通常Layer/FolderとCAF保存・復元を接続済み。

## 残存

Layer Panel統合作業としての既知残存はない。追加修正は実機回帰が出た場合に限定する。

意図的に残す差:

- 通常カードとCAFカードの幅、depth、背景等のvariant表示。
- Backgroundは通常Layer Panel専用。
- データ正本とHistoryはLayerSystem / ClipAssetで分離。

## 次期Phase

調査結果から、次の4 Phaseへ分割した。

1. `task-gemini/phase5a.md`
   - アニメ描画中の非アクティブCAF一時消失。
   - アニメ未使用時のFrame indicator非表示。
   - アニメテーブルのホイール操作。
2. `task-gemini/phase5b.md`
   - CAF / Timeline共通Frame compositor。
   - 既存APNG/GIF exporterの新Timeline接続。
3. `task-gemini/phase5c.md`
   - 現在表示中心を保つキャンバスビュー反転。
   - Vキー変形のラスター確定・履歴監査。
   - 将来selectionと共有するtransform session境界。
4. `task-gemini/phase5d.md`
   - 矩形pixel selection MVP。
   - Layer全体変形と共通基盤を使うselection変形。

着手順は原則5aからとする。5bと5cは相互依存が薄く、5a完了後の優先判断で入れ替え可能。5dは5c完了を前提とする。

独立候補:

- エアブラシ重ね塗りの黒ずみ・モアレ調査。

詳細は以下を参照:

- `開発用資料保管庫/proposals/01_描画・編集・出力.md`
- `開発用資料保管庫/proposals/02_UI・操作・カラー・アルバム.md`
- `開発用資料保管庫/proposals/03_アニメーション・CAF・変形.md`

## 現在の重要境界

- `tegaki_work/PHASE4Z_BOUNDARY.md` をCAF / Lane / Layer Panel責務の正本として維持する。
- CAF自体、ClipInstance、Frame/Lane移動はアニメテーブル正本。
- Layer Panelは通常Layer/FolderとCAF内部Layer/Folderの表示・編集入口。
- WebGPU、SDF/MSDF、WebGL2 Meshは正式Phaseまで凍結。

## 検証

```powershell
node --check tegaki_work\ui\layer-panel-renderer.js
node --check tegaki_work\ui\animation-table-popup.js
node --check tegaki_work\system\layer-system.js
node --check tegaki_work\system\project-manager.js
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` 差分を残さない。
