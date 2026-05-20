# Phase 3f — 表示中レイヤー参照バケツ MVP

> Phase 3e で `FillTool.settings` と `LayerSystem.createCompositeDrawingSnapshot()` の足場が入った。
> 次はツール数を増やす前に、実用頻度が高い「他レイヤーを境界参照して、編集レイヤーへ塗る」バケツを小さく有効化する。

---

## 目的

- 線画を別レイヤーに置いたまま、アクティブな塗りレイヤーへ通常バケツで塗れるようにする。
- 塗り先は必ずアクティブレイヤーの `RenderTexture` のままにする。
- 境界判定だけ、背景と UI 補助を除いた表示中描画レイヤー合成 snapshot を参照する。
- 消しバケツ、編集レイヤーのみバケツ、G キー循環の正式実装に進む前に、参照バケツの動作を確認する。

---

## 背景判断

- 一般的な用途では、線画レイヤーを参照して下の塗りレイヤーへ塗る「他レイヤー参照バケツ」が最も使われやすい。
- `fill-tool.js` の `settings.referenceAllLayers` は既にあるが、現状は UI やツールモードから有効化されていない。
- `gapClosePixels` はまだ実装されていないため、この Phase では隙間閉じを深追いしない。
- 投げ縄塗りは暫定補助として残すが、選択ツール + バケツで代替できる可能性があるため、これ以上の図形塗り追加は保留する。

---

## 実装対象

```text
tegaki_work/system/drawing/fill-tool.js
tegaki_work/system/drawing/brush-core.js
tegaki_work/system/drawing/brush-settings.js
tegaki_work/config.js
tegaki_work/ui/quick-access-popup.js
tegaki_work/ui/settings-popup.js
tegaki_work/PROGRESS.md
```

---

## 実装方針

### 1. 表示中レイヤー参照バケツをデフォルトにする

- `fill` ツールの通常動作を、まず `referenceAllLayers: true` として扱う。
- 塗り先は現在のアクティブレイヤーのみ。
- 背景レイヤー、透明市松、UI 補助表示は境界 snapshot に混ぜない。
- フォルダレイヤーや背景レイヤーがアクティブな場合は、現状通り塗らない。

### 2. 編集レイヤーのみバケツは後続に備える

- 既存の現在レイヤー参照バケツは失わない。
- ただし、この Phase では専用 UI を増やさず、内部で切り替えられる形に留めてもよい。
- 将来的には `fill-reference-all` / `fill-erase` / `fill-current-layer` のようなサブモード整理を検討する。

### 3. 消しバケツは設計メモまで

- 消しバケツはよく使われるため、後続 Phase で扱う候補にする。
- 実装する場合は、塗り色を透明にするだけでなく、RenderTexture への `erase` ブレンドや履歴の扱いを確認してから行う。
- この Phase では消しバケツ本実装をしない。

### 4. G キー循環は設計だけ記録

- 将来案:
  1. `G` 1回目: 表示中レイヤー参照バケツ
  2. `G` 2回目: 消しバケツ
  3. `G` 3回目: 編集レイヤーのみバケツ
  4. 以後ループ
- この Phase では、必要なら `PROGRESS.md` に設計メモとして残す。
- 環境設定で順序入れ替え・削除できるようにするのは後続。

---

## Gemini に任せる範囲

- `settings.referenceAllLayers` を安全に有効化する最小実装。
- 表示中レイヤー参照時に、線画レイヤーを参照して別の塗りレイヤーへ塗れることの確認。
- 現在レイヤー参照経路を消さないこと。
- `npm.cmd run build` の実行。
- `PROGRESS.md` への結果記録。

Gemini が独自判断で以下をしないこと。

- 消しバケツの本実装。
- G キー循環の本実装。
- gap close の本実装。
- 多角形、楕円、矩形塗りの追加。
- 保存形式、履歴形式、レイヤー構造の変更。
- クイックパネルの大規模再設計。

---

## 確認条件

- 線画レイヤーを上、塗りレイヤーを下に置き、塗りレイヤーをアクティブにしてバケツを使うと、線画を境界として塗れる。
- 編集レイヤー自身に線がある従来ケースでも、塗りが破綻しない。
- 背景色や透明市松が境界判定に混ざらない。
- Undo / Redo で塗り前後に戻れる。
- サムネイルが更新される。
- `npm.cmd run build` が成功する。
