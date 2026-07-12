# PHASE4Z_BOUNDARY — CAF / Lane / Layer Panel Responsibility Lock

作成日: 2026-05-27
対象: Phase 4z 系アニメテーブル / ClipAsset / CAF 移行作業

---

## 目的

Phase 4z では、通常レイヤー由来の暫定アニメテーブルから、CAF / ClipAsset / ClipInstance / Lane を使う構造へ段階移行している。

この文書は、以後のAI作業で責務が混ざらないようにするロック文書である。

特に、Layer Panel側を先に作り込みすぎると、まだ未確定のCAF/Lane構造と食い違うため、以下の境界を正本として扱う。

---

## 用語と責務

### 3D Matrix Model

Phase 4z以降のアニメ構造は、単なる2次元マトリクスではなく「3次元マトリクス」として扱う。

- X軸: Frame。時間方向。
- Y軸: Lane。アニメテーブル上の配置行。
- Z軸: ClipAsset内部Layer/Folder。1つのFrame/Lane上に建つClipの内部階層。

イメージとしては、Frame/Laneの2D盤面の上に、Clipという小さなビルが建ち、そのビルの階層がZ軸になる。

通常Layer PanelのLayer/Folderは、最終的にはこのZ軸編集の入口になる。Laneと通常Layerを同一視してはいけない。

### Background

- BackgroundはX/Y軸のLaneではない。
- Backgroundは常にZ軸最下層にいるキャンバス基底要素として扱う。
- アニメテーブル上にBackground Laneを表示しない。
- BackgroundにはClipInstanceを置かない。
- Backgroundに内部Layer/CAFを作らない。
- Background側で許可する操作は、表示/非表示、背景色変更などに限定する。

### Lane

- アニメテーブルのY軸上の配置行。
- 表示順、重なり順、時間方向の配置を扱う。
- 現状は通常Layer由来の暫定足場が残っている。
- 最終仕様では、通常Layerそのものではなく、ClipInstanceを置く行になる。

### CAF

- ClipAsset Folderの略称。
- アニメ文脈では、現在Frame上にあるClipAsset群をまとめて見せる上位単位として扱う。
- Layer Panel側では通常フォルダより上位の概念として表示される候補。
- CAF自体の配置、Frame移動、Lane移動、コピー、削除はアニメテーブルが正本。

### ClipAsset

- 再利用可能な素材本体。
- 内部Layer構造、Snapshot、将来の内部フォルダ構造を持つ。
- 「犬」「猫」「表情差分」などの素材単位になる候補。

### ClipInstance

- アニメテーブル上のFrame/Laneに配置されたClipAsset参照。
- duration、Frame位置、Lane位置、将来のtransform/opacityなどはここへ寄せる。
- Layer Panel側からClipInstance自体を移動・削除・コピーしない。

### ClipAsset Internal Layer

- ClipAsset内部の線画、塗り、影など。
- 現在は内部Layerミラー表示と、visible / rename / select の橋渡しまで入っている。
- 将来はCAF内部編集の本体になるが、通常LayerSystemと同一視しない。

---

## 操作権限

### アニメテーブルが持つ操作

以下はアニメテーブル側が正本として扱う。

- CAF / ClipInstanceの作成。
- CAF / ClipInstanceの削除。
- Frame間移動。
- Lane間移動。
- コピー / ペースト。
- duration変更。
- UNIQUE / asset分岐。
- 将来のClipInstance transform / opacity / rotation。
- Laneの追加、削除、順序、表示名。

Layer Panel側は、これらを直接操作するUIを持たない。

### Layer Panelが持つ操作

Layer Panelは現在Frameの反映表示と、CAF内部編集の入口に限定する。

- 現在Frameに存在するCAFを表示する。
- CAF名とLane補助表示を分けて見せる。
- CAFを開閉表示する候補は許可。
- CAF内部のLayer/Folderを表示する候補は許可。
- CAF内部Layerの選択、visible、renameなど、狭い編集操作は許可。
- 将来、CAF内部Layer/Folderの移動は許可候補。ただしCAF自体の移動ではない。

Layer Panel側で禁止する操作:

- CAF自体のD&D。
- CAF自体のコピー。
- CAF自体の削除。
- CAF自体のFrame/Lane移動。
- CAFを通常Layer/通常Folderと同じSortableJS対象へ混ぜること。

---

## UI方針

TegakiのUI原点は「はっちゃん」の潔さであり、CAF表示も同じ方向へ寄せる。

- 濃紺カード、ダッシュボード風カード、強すぎる別世界のUIは避ける。
- 通常Layer行に馴染む簡素な行表示を優先する。
- CAFは通常フォルダと区別するが、独立パネルのように見せすぎない。
- CAF名とLane番号は別概念として表示する。
- CAFはLane間を移動できるため、CAF番号とLane番号を同一視しない。
- Lane表示は補助情報として控えめに出す。
- CAF自体のopacityやtransformはLayer Panelでは操作しない。将来はClipInstance側の属性としてアニメテーブルで扱う。

---

## 現在の暫定橋渡し

以下は移行用の暫定足場であり、最終仕様として固定しない。

- `Lane = LayerSystemの通常Layer由来` の同期。
- `syncWithLayers()` によるLane生成。
- `sourceLayerId` 依存のPreview / Capture / Clip作成経路。
- Layer Panel上部のCAF簡易表示。
- 選択ClipAssetの内部Layerミラー表示。

これらを一気に破棄しない。移行はCodexまたはオーナー確認済みの小Phaseで行う。

---

## Gemini作業制限

Geminiは、明示指示なしに以下を変更してはいけない。

- `syncWithLayers()` の根本変更。
- `LaneModel` / `ClipInstanceModel` / `ClipAssetModel` の責務変更。
- 保存形式、serialize / deserialize の構造変更。
- EventBusの新イベント名追加。
- 既存イベントpayloadの変更。
- Layer PanelのDOM構造大幅変更。
- SortableJS設定の変更。
- CAF自体のD&D / copy / delete UI追加。
- Virtual Layer Panel化。
- 内部Layerへの直接描画。
- 通常Layer一覧の置換。
- 濃紺カード等の大きなデザイン再導入。

Geminiに任せてよい作業は以下に限る。

- 指定ファイルの棚卸しと報告。
- 既存イベント・メソッド参照の一覧化。
- `npm.cmd run build`。
- 明示されたCSSセレクタの小修正。
- Codexが作った指示書に書かれた狭い範囲の実装。
- `PROGRESS.md` と `task-gemini/*_report.md` の更新。

---

## Codexが担当すべき作業

以下はCodex側で直接確認、またはCodexが詳細指示を作ってから行う。

- Lane独立化の設計と実装。
- `syncWithLayers()` からの段階移行。
- ClipInstance / ClipAsset / CAF の責務整理。
- Layer Panelとアニメテーブルの操作境界変更。
- EventBus契約変更。
- 保存形式変更。
- RenderTexture / Snapshot / Preview合成経路の変更。
- D&DやSortableJSに関わる変更。
- Layer Panelの構造的なUI変更。

---

## 次の安全な進め方

次はLayer Panelをさらに作り込まない。

優先するのは、アニメテーブル側でLane/CAFをどう独立させるかの棚卸しである。

推奨順:

1. `syncWithLayers()` と `sourceLayerId` 依存の棚卸し。
2. Laneを通常Layer名ではなく独立した`Lane 1`等として扱うための最小データ案。
3. ClipInstanceがFrame/Lane上の正本になるために必要な変更点整理。
4. Layer Panel側CAF表示は、アニメテーブル構造が固まるまで小修正以上を行わない。
