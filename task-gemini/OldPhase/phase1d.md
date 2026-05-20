# Phase 1d — 基盤整理・ログ整理・次機能準備

> Phase 1c で「描ける・消せる・サムネイルへ反映される・基本バケツが動く」状態まで戻した。
> Phase 1d は新機能を急いで足すフェーズではなく、Phase 1c の修復で増えた複雑さを整理し、次の機能追加に耐える形へ整える。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` は参照のみ。通常作業では編集しない。

---

## 前提

- WebGPU / SDF / MSDF は凍結継続。Phase 1d の初手で復活させない。
- ペンと消しゴムは現状で機能しているため、大きな描画方式変更はしない。
- バケツは基本塗り復旧済み。囲い塗り・隙間閉じは後続の設計対象で、Phase 1d の必須実装ではない。
- レイヤーサムネイルはキャンバス描画反映復活済み。Phase 1d では過剰診断ログと責務境界を整理する。
- `dist/` は成果物として必要ない限り差分に残さない。

---

## 目的

1. Phase 1c の一時診断ログを整理する。
2. 重複名・責務の曖昧さ・ヘッダーのズレを修正する。
3. UI とサブシステムの ESM 化・依存関係を点検する。
4. Vキー変形・履歴・サムネイル・バケツなど、次フェーズで重くなりそうな境界を明文化する。
5. WebGPU / SDF / MSDF を採用するかどうかは実装せず、必要なら調査項目として記録する。

---

## 優先タスク

### 1. 診断ログ整理

対象候補：

- `system/drawing/pointer-handler.js`
- `system/drawing/drawing-engine.js`
- `system/drawing/thumbnail-system.js`
- `system/drawing/fill-tool.js`
- `system/layer-system.js`

方針：

- 高頻度ログは削除、または `TEGAKI_CONFIG.debug` 条件へ入れる。
- 残すログには目的をコメントか `PROGRESS.md` に書く。
- 通常のペン描画で Console が流れ続けない状態を完了条件にする。

### 2. ファイルヘッダーと責務整理

対象候補：

- `core-engine.js`
- `system/drawing/*.js`
- `system/layer-system.js`
- `ui/*.js`

方針：

- 実際の import / export / EventBus / window 登録とヘッダーを一致させる。
- 同じ責務のクラス・singleton・グローバル名が複数ないか `rg` で確認する。
- 大規模なリネームをする場合は、先に影響範囲を報告する。

### 3. UI/ESM 整理

対象候補：

- `ui/`
- `core-runtime.js`
- `core-initializer.js`

方針：

- 既存の `window.*` 依存を急に全撤廃しない。
- まず「どこが ESM、どこがグローバル依存か」を棚卸しする。
- 小さく安全に直せる箇所だけを修正する。

### 4. Vキー変形と bake の調査

対象候補：

- `system/layer-transform.js`
- `system/layer-system.js`
- `system/history.js`

確認する問題：

- 変形でキャンバス外へ出た描画が bake 時に失われる可能性。
- bake 範囲がキャンバス固定なのか、変形後 bounds を見ているのか。
- undo/redo と RenderTexture の整合。

Phase 1d では、原因調査と小規模修正まで。無限キャンバス化や大規模設計変更は別フェーズへ送る。

### 5. バケツ高機能化の設計メモ

対象：

- `system/drawing/fill-tool.js`
- `tegaki_work/NOTES.md`

扱い：

- 囲い塗り、隙間閉じ、参照レイヤー合成塗りは Phase 1d の必須実装にしない。
- 実装する場合は、しきい値・参照対象・速度・履歴を設計してから行う。

---

## 禁止

- Phase 1d の初手で WebGPU / SDF / MSDF 経路を復活させること。
- ペン描画方式を大きく変えること。
- サムネイル修正を理由に黒ピクセルを透明扱いすること。
- `dist/` を不要に差分へ残すこと。
- `PastFiles/` を通常作業で編集すること。
- 既存グローバル名を確認せずに新しい `window.*` を増やすこと。

---

## 完了条件

- 通常操作時の Console が過剰ログで埋まらない。
- `TEGAKI.md` / `GEMINI.md` / `PROGRESS.md` と実装方針が矛盾していない。
- 主要 JS ファイルのヘッダーが現行依存と一致している。
- `ThumbnailSystem` など重複しやすい名前の責務が明確になっている。
- Vキー変形のキャンバス外クリップ問題について、原因・対応案・実装する/しない判断が `PROGRESS.md` に記録されている。
- `npm.cmd run build` が成功する。

---

## 作業後の報告

必ず `tegaki_work/PROGRESS.md` に追記する。

- 変更ファイル
- 変更理由
- 削除・debug化したログ
- ヘッダー修正内容
- build 結果
- ブラウザ確認結果
- 後続フェーズへ送る項目
