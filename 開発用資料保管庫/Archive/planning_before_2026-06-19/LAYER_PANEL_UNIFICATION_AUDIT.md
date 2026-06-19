# Layer Panel / CAF Engine Unification Audit

更新日: 2026-06-18
対象: Phase 4z26以降の通常Layer Panel / CAF内部Layer Panel統合

## 大目的

アニメテーブルを開く前の通常Layer Panelと、開いた後のCAF内部Layer Panelを同一カードエンジンで描画・操作する。

カードの寸法、アイコン、D&D追従、drop表示、名前表示などは一箇所の変更で双方へ反映する。
通常LayerSystemとClipAsset内部Layerモデルは正本が異なるため、データ更新処理だけadapterで分離する。

## 現在共有されている部分

- 共通row model:
  - `_createLayerPanelCardRowModel()`
  - `_createLayerPanelCardRowModelFromOptions()`
- 共通class / data / CSS variable生成。
- 共通content parts:
  - thumbnail / details / name / meta / action / child-line
- 共通アイコン解決。
- 共通Pointer D&D:
  - Pointer Capture
  - drag開始閾値
  - ghost生成と追従
  - before / after / inside判定
  - drop marker
  - pointerup / cancel cleanup
- `.layer-panel-card-*` 共通CSS。

## 意図的に残す差分

### variant固有表示

- row幅、margin、depth、背景、opacityなど、通常LayerとCAF内部Layerの配置文脈に必要な差。
- Backgroundは通常Layer Panel専用variant。
- selector classは共通engineがadapterと表示variantを識別するために維持する。

カード寸法、アイコン寸法、thumbnail上限、D&D ghost / marker / animationは共通化済み。

### データ正本

- 通常Layerは `LayerSystem` のindex / layerId / parentId / Folder.children。
- CAFは `TimelineModel` / `ClipAsset` のassetId / internalLayerId / parentLayerId。

データ正本は統合しない。共通UIからadapter APIを通して操作する。

### 選択状態と履歴

- 通常Layerは `setActiveLayer()` と複数選択Set。
- CAFは `selectedAssetId` / `selectedInternalLayerId` とworking Layer同期。
- Historyとworking Layer同期は各adapter内部の既存APIを維持する。

## 完了した構造

共通カードUI層を維持し、通常/CAF差はadapterへ限定する。

adapter契約:

```text
select(payload)
rename(payload)
toggleVisible(payload)
toggleClipping(payload)
toggleFolder(payload)
move(payload)
```

共通row data候補:

```text
id
kind
name
depth
isFolder
isCollapsed
isVisible
isClipping
isSelected
isActive
thumbnail
metaLabel
```

## 完了判定

- 通常Layer/FolderとCAF内部Layer/Folderは共通DOM renderer、共通event delegation、共通Pointer D&Dを使用する。
- variant差は配置文脈、Background、selector識別に限定。
- モデル更新、History、working Layer同期はadapter境界で分離。
- 本監査で予定したStep 1〜Step 6と旧HTML経路cleanupは完了。

## 2026-06-18 実機回帰修正

- 通常Layerのドラッグghost左側に、階層線由来の分離した小矩形が表示される問題を修正。
- drag ghost生成時にchild-lineとdrop marker状態classを除去。
- CAF内部カードは従来すべての行へchild-lineを生成していたため、`parentLayerId`を持つFolder配下の子だけに限定。
- CAF自体やCAF直下のLayerにはFolder収納線を表示しない。
- 追加実機画像で、通常カードDOM全体のcloneがbody直下でパネル用grid/styleを失い、縦長の枠ghostとして分離することを確認。
- drag ghostをカードDOM cloneから、レイヤー名だけを表示する専用preview要素へ変更。
- CAF外枠背景をFolder色から薄いアイボリー系へ変更し、枠主体の非動的コンテナとして見分けやすくした。
- D&Dのbefore / after表示を横線だけでなく、移動元と挿入位置の間にあるカード群が1行分押し出されるreorder previewへ変更。
- 通常側では後段の `.layer-item:hover` が共通押しのけtransformを上書きしていたため、D&D shiftを優先するよう修正。
- 押しのけ後の移動済みDOMを再hit-testしてtargetが往復していたため、drag開始時に取得した共通row座標を判定正本へ変更。
- 通常側はdrag開始時の先行 `setActiveLayer()` がパネル再描画を予約し、drag中のrow DOMを破棄していたため先行選択を撤去。通常クリック選択は共通event delegation側で維持。

## 安全な実装順

1. アイコン・thumbnail・row寸法を共通CSS variableへ移す。完了。
2. variant固有のD&D ghost classを共通classへ統一する。完了。
3. 通常/CAFの操作をadapter関数へ包み、rendererから直接モデルを触らない。カード主要操作は完了。
4. CAFのHTML文字列生成をDOM rendererへ寄せ、カード生成を単一化する。実表示経路は完了。
5. 名前変更、visible、clipping、Folder開閉を共通event delegationへ統一する。完了。
6. 最後にD&D animationを一箇所で刷新する。完了。

## 2026-06-18 Step 1完了

- `.layer-panel-card-row` にthumbnail、action、SVG、Folder icon寸法の共通CSS変数を追加。
- 通常カード固有の16px action / 12px SVG overrideを撤去。
- 通常/CAFのthumbnail上限を共通 `_getLayerPanelCardThumbnailBounds()` へ集約。
- Folder SVGのJS側width/height属性指定を撤去し、CSS変数を正本にした。
- ブラウザcomputed styleで通常/CAF双方のgrid、thumbnail、action寸法が一致することを確認。

## 2026-06-18 Step 2完了

- `clip-layer-mirror-drag-ghost` を廃止し、通常/CAF双方を `.layer-panel-card-drag-ghost` に統一。
- variant configとdrag optionsから `ghostClass` 分岐を削除。
- ghost opacity / rotation / scale / shadow、drag元opacityを共通CSS変数へ集約。
- ghost追従transformは共通CSS変数を読み、通常/CAFで同じ計算を使用。
- ブラウザで通常Layer D&DとCAF内部Layer D&Dの並び替えを確認。

## 2026-06-18 Step 3完了

- `legacy-layer-card` / `clip-layer-mirror` に共通adapter契約を追加。
- adapter契約:
  - `select`
  - `rename`
  - `toggleVisible`
  - `toggleClipping`
  - `toggleFolder`
  - `move`
- カード選択、可視、クリッピング、Folder開閉、Pointer dropをadapter経由へ変更。
- CAFのworking Layer同期・Historyと通常LayerSystemのHistoryは各adapter内部の既存APIを維持。
- ブラウザで通常可視、CAF可視/クリッピング、CAF D&Dを確認。
- 属性popupなどカード外操作の直接呼出しは次のevent delegation統合時に扱う。

## 2026-06-18 Step 4完了

- CAF内部Layer/Folderカードの実表示経路をHTML文字列からDOM Element生成へ変更。
- 通常カードと同じ以下の共通DOM rendererを使用:
  - `_createLayerPanelCardRowElement()`
  - `_populateLayerPanelCardElement()`
  - `_createLayerPanelCardThumbnailElement()`
  - `_createLayerPanelCardDetailsElement()`
  - `_createLayerPanelCardActionButtonElement()`
- CAFヘッダー自体のテンプレートは維持し、内部カードだけDOMとしてappendする境界にした。
- 可視、クリッピング、選択、Pointer D&DがDOM化後も動作することをブラウザ確認。
- 旧HTMLカードhelperは現時点で未使用。100行超の一括削除を避け、後続の安全なcleanup対象として残す。

## 2026-06-18 Step 5完了

- 通常Layer/FolderとCAF内部Layer/Folderのクリック操作をコンテナ単位の共通event delegationへ統合。
- variant設定の `row / name / thumbnail / visibility / clipping` selectorから操作種別を解決。
- rowの共通data属性から通常Layer用 `index / layerId`、CAF用 `assetId / internalLayerId` payloadを生成。
- 選択、名前変更、visible、clipping、Folder開閉を共通adapterへ接続。
- 通常カードに残っていた行、名前、可視、クリッピング、Folder thumbnailの直接listenerを削除。
- Backgroundは従来どおり選択・名前変更・Folder開閉の対象外とし、可視操作は維持。
- 属性popup、背景色、削除/複製/下結合などカード主要操作外の独立UI listenerは維持。
- `node --check ui/layer-panel-renderer.js` と `npm.cmd run build` 成功。

## 2026-06-18 Step 6完了

- 通常Layer/FolderとCAF内部Layer/FolderのD&D animationを `.layer-panel-card-row` 共通classへ集約。
- pointermoveごとのdrop marker全解除・再追加をやめ、target rowまたはplacementが変わった時だけclassを更新。
- before / after時は対象カードを共通offsetで退避し、挿入空間を視覚化。
- inside時は共通scale / outline / shadowでFolder収納候補を強調。
- drag元の縮小、drop marker出現animation、transition時間とeasingを共通CSS variable化。
- `prefers-reduced-motion` ではtransitionとmarker animationを無効化。
- `node --check ui/layer-panel-renderer.js` と `npm.cmd run build` 成功。

## 2026-06-18 完了後cleanup

- Step 4で未使用化したCAF内部カード専用HTML rendererと関連HTML helperを削除。
- CAFヘッダーのHTMLテンプレート生成は現行境界として維持。
- 共通カードの実表示経路はDOM rendererのみになった。
- 旧HTML経路だけで使用していたタイトル、asset、visibility表示CSSと未使用text HTML helperを削除。
- 完了済みの旧Phase handoffとPROGRESS旧詳細ログを `開発用資料保管庫/Archive/` へ移動。

## 境界

- Lane / ClipInstance / CAF自体の移動はアニメテーブル正本。
- Layer Panelで共有するのは通常Layer/FolderカードとCAF内部Layer/Folderカード。
- Backgroundは通常Panel専用variantとして残してよい。
- LayerSystemとClipAsset内部モデル自体は統合しない。
- UI engineと操作契約を共有し、データ正本はadapterで分ける。
