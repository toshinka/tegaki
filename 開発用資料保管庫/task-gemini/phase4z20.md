# Phase 4z20 — CAF / Lane UI Philosophy Alignment

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z17_report.md`
6. `task-gemini/phase4z18_report.md`
7. `task-gemini/phase4z19_report.md`
8. `tegaki_work/ui/layer-panel-renderer.js`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/system/animation/animation-data-model.js`
11. `tegaki_work/styles/main.css`

## 重要な方針修正

Phase 4z15〜4z19で、CAFヘッダーと `CLIP LAYERS` ミラーを上部カードとして追加してきた。

しかし現状UIは濃紺カードが強すぎ、Tegaki本来の簡素なレイヤーパネル思想から外れ始めている。

今回のPhase 4z20は、内部Layer操作を増やすのではなく、以下の思想へ表示を寄せるための調整Phaseとする。

- CAFは通常フォルダより上位の概念。
- アニメ文脈では、Layer Panel上にCAFフォルダが見える。
- CAFフォルダの中に内部Layer/通常フォルダ相当が入る、という見え方へ寄せる。
- TimelineのY軸は、通常レイヤー名ではなく `Lane 1`, `Lane 2` のような配置行として見せ始める。
- CAF自体はTimeline上を自由に動くClipAsset Folderであり、CAF名とLane番号は別概念として表示する。
- Layer Panel側ではCAFの中身を編集・確認するが、CAF自体の移動/コピー/削除/別Lane移動はアニメテーブル専管とする。
- `NO FRAME` はアニメ文脈がない時だけ。アニメタイムラインに同期している時は `Frame 1` 等を表示する。
- ただし今回はデータ構造の完全移行はしない。見た目と表示概念の整合を先に取る。

## 今回の目的

CAF / Lane / Layer Panelの見え方を、最終思想に近い方向へ揃える。

目的は以下。

- 濃紺カード風のCAF/CLIP LAYERS表示をやめ、通常レイヤーパネルに馴染む簡素な表示へ寄せる。
- Layer Panel側でCAFを「通常フォルダより上位のフォルダ」として視認できるようにする。
- CAF名とLane表示を分け、CAFが置かれているLaneは補助情報として控えめに表示する。
- Timeline Y軸を暫定的に `Lane 1`, `Lane 2` 表示へ寄せ、通常Layer名との混同を減らす。
- Frame表示を `NO FRAME` 固定ではなく、アニメタイムラインの現在Frameに同期する。
- 既存の選択同期、visible切替、renameは壊さない。

## 今回やること

### 1. CAF / CLIP LAYERSの見た目を通常レイヤーパネル寄りに弱める

対象:

- `main.css`
- `layer-panel-renderer.js`

現状の `.caf-readonly-header` / `.clip-layer-mirror` は濃紺カード風で主張が強い。

今回の方向:

- 背景は通常レイヤーパネルと同系の薄い色にする。
- アクセントはオレンジ系の細い枠線や小さな `CAF` ラベル程度に留める。
- box-shadowや強い濃紺背景は削る、またはかなり弱める。
- `FRAME ASSETS` / `CLIP LAYERS` という独立ダッシュボード風の見え方を弱める。
- 2枚目の参考画像のように、CAF行が通常レイヤー行の一部として自然に見える方向へ寄せる。

注意:

- `.layer-item` はまだ使わない。
- SortableJS対象にしない。
- ただし見た目は通常Layer/Folder行へ近づける。

### 2. Layer Panel上のCAF表示名を「CAFフォルダ」寄りにする

現在は `FRAME ASSETS` の中に `[CAF] Uncategorized` とAsset名が出ている。

今回の表示方針:

- Frame上にCAFがある場合、Layer Panel側にはCAFフォルダ相当の行を表示する。
- 表示例:

```text
Frame 1
[CAF] フォルダ1
  レイヤー1
```

または暫定的に:

```text
Frame 1
CAF  Uncategorized
  Asset for レイヤー1
```

重要:

- CAF自体はLayer Panel側では移動不可。
- CAF自体のコピー、削除、別Lane移動、Frame移動もLayer Panel側では行わない。
- それらのCAF単位操作はアニメテーブル側で行い、その結果をLayer Panel側に反映する。
- CAFの中身も今回はD&Dしない。
- 既存の選択/visible/renameボタンは維持してよいが、派手な独立カードではなく、CAF配下に見えるようにする。

### 2.1. CAF名とLane表示を分離する

CAFはTimeline上のClipInstanceとして自由に移動できるため、CAF番号/CAF名とLane番号を同一視しない。

Layer Panel側の表示方針:

- CAF名は通常フォルダの名前欄に相当する位置へ表示する。
- Lane番号は補助情報として小さく表示する。
- 通常Layerの `100%` 表示位置に近い場所へ `Lane 1` / `Lane 2` のように表示する案を優先する。
- フォルダSVG下や小ラベル位置にLane番号を置く案も可。ただしCAF名欄と混同させない。
- CAF行のopacity欄に見える場所へ `Lane 1` を置く場合、CAF自体の透明度操作がLayer Panel側に存在するように見えないデザインにする。

注意:

- CAFの透明度、移動、回転などは将来的にアニメテーブル上のClipInstance操作で扱う。
- Layer Panel側でCAF自体のopacity/transform操作を作らない。
- Layer Panel側でできるのはCAFの開閉とCAF内部のLayer/Folder編集に限定する。
- 現PhaseではCAF内部のD&Dもまだ行わない。D&D可能化は後続で別Phaseにする。

### 3. `NO FRAME` 表示をアニメFrameに同期する

Layer Panel上部、または現在 `NO FRAME` と出ているUIを確認する。

作業:

- アニメテーブルが存在し、`animationTable.model.playback.currentFrame` が取得できる場合は `Frame 1` のように表示する。
- 表示上は1始まりにする。
  - `currentFrame = 0` なら `Frame 1`
  - `currentFrame = 1` なら `Frame 2`
- アニメテーブルが未初期化、またはアニメ文脈がない場合のみ `NO FRAME` を表示する。

注意:

- 現在Frameを変更する処理は追加しない。
- 表示同期のみ。
- 既存の左右移動ボタンがある場合、挙動は壊さない。

### 4. Timeline Y軸表示を暫定的にLane名へ寄せる

現在のTimeline Y軸は通常レイヤー名由来で `レイヤー1` などが出ている。

今回の方針:

- データ構造はまだ変えない。
- 表示だけ `Lane 1`, `Lane 2`, `Lane 3` へ寄せる。
- フォルダtrackや背景由来trackの扱いは実装を確認し、安全な範囲で表示する。
- 既存の `track.name` を破壊的に書き換えるのではなく、描画時の表示名ヘルパーで対応するのが望ましい。

候補メソッド:

```js
_getDisplayLaneName(track, visibleLaneIndex)
```

注意:

- `syncWithLayers()` のデータ構造を変更しない。
- `sourceLayerId` 依存を外さない。
- Lane追加/削除モデルはまだ触らない。
- Timeline Y軸を見た目だけ独立させる。

### 5. 既存機能を壊さない

Phase 4z16〜4z19で入った以下は維持する。

- CAFヘッダー/CAF行からClip/Asset選択。
- `CLIP LAYERS` ミラーの内部Layer選択。
- 内部Layer visible切替。
- 内部Layer rename。

ただし見た目は簡素化してよい。

## 今回やらないこと

- Laneデータモデルの独立化。
- `syncWithLayers()` の根本変更。
- CAFの保存形式変更。
- CAF/内部LayerのD&D。
- 内部Layerの追加/削除/順序変更。
- 内部Layerへの直接描画。
- Virtual Layer Panelとして通常Layer一覧を完全置換すること。
- ClipAssetをTimelineへ配置する新UI。
- Export連携。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- CAF / CLIP LAYERS表示が濃紺カード風ではなく、通常レイヤーパネルに馴染む簡素な見た目になる。
- Frame表示がアニメタイムラインの現在Frameに同期し、`Frame 1` 等で表示される。
- アニメ文脈がない場合のみ `NO FRAME` 表示になる。
- Timeline Y軸が暫定的に `Lane 1`, `Lane 2` のように表示される。
- Layer Panel側のCAF行では、CAF名とLane番号が別情報として読める。
- Layer Panel側でCAF自体の移動/コピー/削除/別Lane移動ができるUIになっていない。
- 既存のClip/Asset選択、内部Layer選択、visible切替、renameが動く。
- CAF/Internal Layer表示に `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていない。
- SortableJSの通常レイヤーD&Dが従来通り動く。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、サムネイルが壊れない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z20_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開く。
3. Frame 1にClipAssetがある状態で、Layer Panel上部が `Frame 1` 系表示になることを確認する。
4. CAF表示が濃紺カードではなく、通常レイヤーパネルに馴染む表示になっていることを確認する。
5. Timeline Y軸が `Lane 1`, `Lane 2` のように表示されることを確認する。
6. CAF/Asset選択、内部Layer選択、visible切替、renameが従来通り動くことを確認する。
7. 通常Layer行のクリック、表示切替、D&Dが従来通り動くことを確認する。
8. Consoleにエラーがないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z20_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- CAF / CLIP LAYERS表示をどう簡素化したか。
- Frame表示の同期方法。
- Timeline Y軸のLane表示方法。
- Layer Panel側でCAF名とLane表示をどう分離したか。
- CAF自体の操作権限をアニメテーブル側に限定した方法。
- 既存の選択/visible/renameを維持した確認結果。
- SortableJS対象外を維持した方法。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z20 完了ログを追記する。

最低限、以下を書く。

- Phase 4z20 の目的。
- CAF / CLIP LAYERS表示の簡素化内容。
- Frame表示同期。
- Timeline Y軸のLane表示。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
