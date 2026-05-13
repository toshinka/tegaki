# Phase 1c — 液タブペン対応・消しゴム修正・サムネイル

> **このフェーズでやること：液タブペンで描けるようにする・消しゴムを正しく直す。**
> PNG書き出し・アニメテーブルは触らない。

---

## 完了条件

- [ ] 液タブ（Wacom等）のペンでキャンバスに描ける
- [ ] 消しゴムが透明で消える（白塗りでない・下レイヤーが透ける）
- [ ] `Stroke completely outside camera frame - rejected` が液タブペン使用時に出ない
- [ ] レイヤーサムネイルが表示される（工数が大きい場合は次フェーズに延期可）
- [ ] コンソールにエラーがない

---

## 作業1：液タブペン座標の修正（最優先）

**原因：** `pointer-handler.js` または `coordinate-system.js` で
`pointerType === 'mouse'` と `pointerType === 'pen'` で座標変換が分岐しており、
ペン入力が修正前のパスを通っている。

**確認手順：**

```javascript
// pointer-handler.js の pointerdown/pointermove ハンドラに一時的に追加
console.log('pointerType:', e.pointerType, 'clientX:', e.clientX, 'clientY:', e.clientY);
```

液タブペンで描いたときの `clientX/Y` の値を確認する。
その後 `coordinate-system.js` の `screenClientToCanvas()` に同じ値を
手動で渡したときの出力値も確認する。
`gl-stroke-processor.js` のカメラフレーム範囲（何px×何px）と照合する。

**修正方針：**
- `pointerType` による座標変換の分岐を**撤廃する**
- マウス・ペン・タッチを問わず同一の変換パイプラインを通す：

```
PointerEvent.clientX/Y（pointerType問わず）
  → screenClientToCanvas()
  → canvasToWorld()
  → worldToLocal()
  → localX/Y確定
```

- 確認用 `console.log` は修正完了後に必ず削除する

---

## 作業2：消しゴムの透明消去を確実に動作させる

**問題：** 消しゴムが白塗りで動作しており、下レイヤーが透けない。
`blendMode = 'erase'` の設定が実際の描画に反映されていない。

**確認手順：**

`stroke-renderer.js` の `_renderEraserStroke()` を確認する。
`graphics.blendMode` が実際に `'erase'` または `PIXI.BlendMode.ERASE` に
設定されているか確認する。

**PixiJS v8.17.0 での正しい記述：**

```javascript
import { Graphics, BlendMode } from 'pixi.js';

_renderEraserStroke(strokeData, settings) {
    const inputPoints = strokeData.points.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
    const outlinePoints = getStroke(inputPoints, {
        size: settings.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false
    });

    if (!outlinePoints || outlinePoints.length < 2) return null;

    const graphics = new Graphics();
    graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
    graphics.fill({ color: 0xffffff, alpha: 1.0 });
    graphics.blendMode = BlendMode.ERASE;  // ← これが必須

    return graphics;
}
```

プレビュー（`renderPreview()`）の消しゴムケースも同様に修正する。

---

## 作業3：レイヤーサムネイルの表示（工数確認してから着手）

**問題：** レイヤーパネルにサムネイルが表示されない。

**確認手順：**
1. `thumbnail-system.js` の `generateThumbnail()` が呼ばれているかを確認
2. 呼ばれていない場合 → `layer:content-changed` イベントの発火を確認
3. 工数が大きい場合はこのフェーズでは飛ばして次フェーズに回す

---

## 作業4：フォルダのアーカイブ（作業完了後に実施）

Phase 1cの全作業完了・`vite dev` 動作確認後に以下を順番に実行する。
詳細ルールは `TEGAKI.md` の「フェーズ完了時のアーカイブ手順」を参照。

**ステップ1：3ファイルを `tegaki_phase1a/` 直下に集約する**
```
tegaki_phase1a/PROGRESS.md       ← このフェーズの記録を追記してから配置
tegaki_phase1a/GitHubURL.txt     ← 最新のURL一覧
tegaki_phase1a/TegakiConsole.txt ← phase1c完了時点のコンソールログ
```
これらが `tegaki/` ルートにある場合は `tegaki_phase1a/` 内に移動する。

**ステップ2：作業フォルダをコピーしてリネーム**
```
コピー元: tegaki_phase1a/         ← 移動・削除しない
コピー先: PastFiles/tegaki_phase1c[連番]/

初回完了時   → PastFiles/tegaki_phase1c1/
修正パッチ後 → PastFiles/tegaki_phase1c2/
さらに修正後 → PastFiles/tegaki_phase1c3/
```
- 修正・パッチが発生するたびに連番を上げて別保存する（上書きしない）
- 不要な中間スナップショットは後からオーナーが整理して削除してよい

**ステップ3：コピー先のGitHubURL.txtのパスを一括置換する**
```
PastFiles/tegaki_phase1c1/GitHubURL.txt を開き：
置換前: tegaki_phase1a/
置換後: PastFiles/tegaki_phase1c1/
```
tegaki_phase1a/GitHubURL.txt（作業中のもの）は書き換えない。

**ステップ4：GitHubにpush**

⚠️ `tegaki_phase0` は絶対に触らない

---

## やってはいけないこと

- PNG書き出し機能の修正
- GIFアニメーションテーブルへの着手
- バケツツールの修正
- `tegaki_phase0` への変更
- 工数の読めない機能の追加

---

## 完了時のPROGRESS.md更新内容

```
### YYYY-MM-DD Phase1c完了
- 液タブペン描画：修正済み（pointerType分岐を撤廃）
- 消しゴム透明消去：BlendMode.ERASEで動作確認
- サムネイル：○（対応済み）/ △（次フェーズに延期）
- アーカイブ：PastFiles/tegaki_phase1c1 に格納済み
- 次フェーズ：phase1d（PNG書き出し・品質調整）
```
