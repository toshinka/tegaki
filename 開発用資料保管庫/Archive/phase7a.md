# Phase 7a — Layer Panel三状態・clipping負荷診断

更新日: 2026-08-08
担当: Sol High / XHigh（設計・計測・最終判定）、Luna MAX（限定修正Stageのみ）
状態: 完了

## 目的

通常Layer、Animation Table表示中CAF、Table閉鎖後CAF編集で、Layer Panelの表示階層・選択対象・操作応答が違うというOwner報告を、正本IDと処理時間を同時に採取して再現条件へ落とす。

実測前にLane同期、DOM再設計、clipping差分更新へ進まず、原因が一つの限定経路へ絞れた場合だけ修正する。

## 現状判断

- Layer Panelは一つのUI engineと二つのdata adapterを維持する。
  - 通常: `LayerSystem.getLayers()`のflat合成順と`layerData.parentId`
  - CAF: `ClipAsset.internalLayers`の順と`parentLayerId`
- Tableを閉じても選択CAFの編集contextは継続する。Table visibilityを通常Layer / CAFの正本切替には使わない。
- animation working Layerは表示・入力adapterであり、Panel順や保存階層の正本ではない。
- 軽量Browser確認では内部Folderと子Rasterのrow順・depthは一致し、階層破損は未再現。
- `LayerPanelRenderer.render()`は更新ごとに全DOMを再構築する。
- `refreshClippingMasks()`はstroke / content変更 / Panel更新等から呼ばれ、一操作内で直接呼出し後に`_emitPanelUpdateRequest()`から再度呼ばれる候補がある。

## Stage A — debug計測基盤

`TEGAKI_CONFIG.debug === true`の時だけruntimeに最大120 sampleを保持する。

採取項目:

- Panel更新要求数、force数、16ms内のcoalesce数、D&D中defer数
- 三状態別の`render()`回数、合計・平均・最大時間
- DOM rowの`cardKind / assetId / layerId / depth / folder`
- adapter正本側のrow順・parent・depthとDOM一致判定
- active Layer ID、selected internal Layer ID、working Layer ID列
- `refreshClippingMasks()`の呼出元、Layer数、clipping owner数、source数、mask数、合計・平均・最大時間

計測はProject、History、Album、Emergency Recoveryへ保存しない。通常時のconsoleへ連続出力せず、`window.layerPanelRenderer.getDiagnosticsSnapshot()`でOwner / Browser検証から取得する。

## Stage B — 固定シナリオ

1. 通常Layerで複数Folder / Rasterを作成し、入れ子、選択、D&D、V変形、Undo / Redoを行う。
2. Animation Tableを開いてCAF化し、内部Folder / Raster、clipping、Motion / WARP keyを追加する。
3. Tableを閉じたCAF編集contextで内部Layer追加、選択、描画、V変形を行う。
4. 各区間前に計測をresetし、row順・depthと3 ID、render / clipping時間を保存する。
5. Ownerの重い制作Projectで同じ採取を行い、軽量固定入力との差を比較する。

## Stage C — 修正Gate

次のいずれかを実測できた場合だけ、一つずつ限定修正する。

- `hierarchyMatches === false`: 該当adapterのrow生成か選択同期を修正する。`parentId`と`parentLayerId`は統合しない。
- 同一操作で同内容のclipping refreshが同期的に連続する: caller側の明示重複だけを除く。mask結果やFolder clipping契約は変更しない。
- DOM再構築が主因で、row数に比例して操作blockが実測される: まず不要な更新eventのcoalesceを行う。incremental DOM / virtualizationは別Gate。
- active / selected / working IDだけが不一致: working adapter復元経路を限定修正し、TimelineModel / ClipAsset正本をLayerSystemへ移さない。

## 維持する契約

- stroke中working Layer表示
- preview staging交換とcontainer順
- 上側Laneが前面
- Lane / Timeline onionのdisplay-only境界
- PSD record順
- animation working Layerは表示・入力adapterであり保存正本ではない
- Folder clipping契約
- Motion、WARP、Mesh、Skin、physicsの正本を増やさない
- 通常LayerとCAF内部Layerは一つのUI engine・二つのdata adapter

## 非対象

- Table非表示中の`syncWithLayers()`常時同期
- LaneとLayerSystem、`parentId`と`parentLayerId`の統合
- Layer Panel DOMの大幅置換、virtualization、全面的incremental DOM
- clipping mask algorithm、blend、inverse clippingの変更
- V変形、Motion、WARP、Mesh、IKの機能拡張
- 定期Ctrl+S、Project serialization再設計

## 検証

- `node build/verify-layer-panel-diagnostics.mjs`
- 変更JS / mjsの`node --check`
- 全`build/verify-*.mjs`
- `npm.cmd run build`
- Browserで通常／Table表示中CAF／Table閉鎖後CAFの計測sampleとconsole errorを確認
- 修正Stageへ進んだ場合、Folder作成・内部Layer追加・D&D・選択・V変形・Undo / Redo・clippingを実操作確認
- build後に`dist/`と`node_modules/.vite/`の生成差分を残さない

## 停止条件

- 再現にOwnerの制作Projectが必要で、軽量入力から原因を断定できない。
- 修正がLane正本変更、通常Layer / CAF統合、Folder clipping semantics変更を要求する。
- 計測結果がProject JSON、History、保存shapeへの新規fieldを要求する。
- 100行超の削除、主要class再構成、DOM構造の大幅置換が必要になる。

## SOL review項目

- debug OFF時に計測用配列やDOM走査が増えていないか。
- row一致判定が折り畳みFolder / CAFを誤検知しないか。
- clipping refreshの削減がmask更新漏れを作らないか。
- Table visibilityを正本切替にしていないか。
- active / selected / working IDを自動修復して症状を隠していないか。

## Stage A軽量実測（2026-08-08）

- 通常2 row、Table表示中CAF、Table閉鎖後CAF、内部Folder + depth 1 Rasterで`hierarchyMatches === true`を確認した。
- 軽量入力のPanel renderは通常約0.8〜2.2ms、Table表示中約2.1ms、閉鎖後CAF約1.1〜1.5msで、DOM再構築単体のblockは未再現。
- Table閉鎖後CAFで内部Rasterを1枚追加すると、Panel更新要求11回は既存16ms coalesceによりrender 1回になったが、clipping refreshは6回（Panel 5 + direct 1）だった。
- Panel要求由来のclippingだけを同一microtaskへcoalesceし、同じ操作をdirect 1 + Panel 1の2回へ削減した。directな描画／working Layer同期は変更していない。
- clipping ownerを有効化した状態、Undo / Redo、Table再表示後もrow順・depthは一致し、console errorは発生しなかった。
- この時点ではOwner制作Projectでの多Layer / 多Folder / clipping / Motion / WARP負荷は未実測だったため、次のOwner実測まで判定を保留した。

## Owner制作Project実測とclose判定（2026-08-08）

- Animation Tableを開いた制作Projectで、緊急復旧の最短間隔を5秒にすると周期的な遅延が継続し、1分へ変更すると問題が解消した。
- 現行経路は`history:changed`後にProject全体を`exportProject()`する。Phase 6zの重いCAF実測（約1.9〜3.8秒）とも整合し、今回の継続遅延の主因はLayer Panel階層変換ではなく短周期の全Project serializeと判定する。
- 新規環境の既定値を1分へ変更し、5 / 10 / 30秒は既存互換のため残すがSettings上で高負荷／注意と明示した。Ownerが明示選択した既存設定は自動移行しない。
- 軽量三状態で階層不一致は再現せず、Panel由来clipping refreshの明示重複は6回から2回へ削減済み。Phase 7aをcloseする。
- 将来row順・depth・active / selected / working IDの不一致が再現した場合は、debug限定診断を再利用して該当adapterだけを再度Gateする。
