# Phase 1b — コア整理・レイヤー復元・ペン完成

> **このフェーズでやること：初期化の正常化・レイヤー動作・ペン/消しゴムの完成。**
> UIの見た目・アニメーション・GIFテーブルは触らない。

---

## 完了条件

- [ ] `[BrushCore] Already initialized` がコンソールに出ない
- [ ] レイヤーパネルにレイヤーが1枚以上表示される
- [ ] レイヤーの追加・削除・切り替えができる
- [ ] ペンで描いた線がperfect-freehandの輪郭で描画される
- [ ] 消しゴムがBlendMode.ERASEで動作する（白塗りでない）
- [ ] フォールバック実装（`_renderFinalStrokeLegacy`）が存在しない
- [ ] コンソールにエラーがない状態

---

## 作業1：BrushCore二重初期化の根本修正

**問題：** `brushCore`はESMシングルトンとして起動時に自動でinitが走り、
さらに`core-engine.js`の`initialize()`内でも`brushCore.init()`が呼ばれている。

**修正方針：**
- `brushCore`の自動init（コンストラクタ・モジュール読み込み時の自動実行）を削除
- `core-engine.js`の`initialize()`内で、以下の順序を厳守して1回だけ呼ぶ：

```javascript
// この順番を守ること
window.layerManager = this.layerSystem;       // 1. layerManager登録
window.strokeRecorder = this.strokeRecorder;  // 2. strokeRecorder登録
window.strokeRenderer = this.strokeRenderer;  // 3. strokeRenderer登録
window.brushSettings = this.brushSettings;    // 4. brushSettings登録
brushCore.init();                              // 5. 全部揃ってからinit
```

**確認：** `brush-core.js`の`init()`冒頭の`Already initialized`チェックが
コンソールに出なければ修正成功。

---

## 作業2：レイヤー階層の復元

**問題：** レイヤーパネルが空でレイヤーが表示されていない。

**確認手順：**
1. `layer-system.js`の`init()`が呼ばれているかコンソールで確認
2. 初期レイヤーが`createInitialLayer()`等で作成されているか確認
3. `layer-panel-renderer.js`がEventBus経由でレイヤー追加イベントを受信しているか確認

**修正方針：**
- `LayerSystem.init()`完了後に`layer:structure-changed`または相当するイベントを
  EventBus経由で発火してパネルを再描画させる
- 初期レイヤー（「レイヤー1」）が確実に1枚作られることを確認

---

## 作業3：perfect-freehandの正式接続

**問題：** `stroke-renderer.js`が`perfect-freehand`を直接importしておらず、
`GLStrokeProcessor`経由の迂回路になっている。

**修正方針：**

```javascript
// stroke-renderer.js の先頭に追加
import { getStroke } from 'perfect-freehand';
```

`_renderWithPerfectFreehand()`を以下の構造に書き直す：

```javascript
_renderWithPerfectFreehand(strokeData, settings) {
    const inputPoints = strokeData.points.map(p => [p.x, p.y, Math.max(p.pressure, 0.02)]);

    const outlinePoints = getStroke(inputPoints, {
        size: settings.size,
        thinning: 0.7,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false
    });

    if (!outlinePoints || outlinePoints.length < 3) return null;

    const graphics = new PIXI.Graphics();
    graphics.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
    for (let i = 1; i < outlinePoints.length; i++) {
        graphics.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
    }
    graphics.closePath();
    graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });

    return graphics;
}
```

`GLStrokeProcessor`への依存をこのメソッドから完全に外す。

---

## 作業4：消しゴムの完全移行

**問題：** プレビュー段階（`renderPreview`）が白塗り（0xFFFFFF）になっている。

**修正方針：**
`renderPreview()`のeraserケースをblendMode='erase'に統一：

```javascript
// 変更前（禁止）
graphics.fill({ color: 0xFFFFFF, alpha: 0.5 });

// 変更後
graphics.blendMode = 'erase';
graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
```

最終描画（`_renderEraserStroke`）はすでに`blendMode = 'erase'`なので変更不要。

---

## 作業5：フォールバック削除

**問題：** `renderFinalStroke()`にtry/catchと`_renderFinalStrokeLegacy()`が残っている。
TEGAKI.mdの「フォールバック禁止」に違反している。

**修正方針：**
- `_renderFinalStrokeLegacy()`メソッドを完全削除
- `renderFinalStroke()`のtry/catchを削除
- 失敗時はconsole.errorを出して処理を止める（黙って継続しない）

```javascript
// 変更後のrenderFinalStroke()
async renderFinalStroke(strokeData, providedSettings = null) {
    const settings = this._getSettings(providedSettings);
    const mode = this._getCurrentMode(settings);

    if (mode === 'eraser') {
        return this._renderEraserStroke(strokeData, settings);
    }

    return this._renderWithPerfectFreehand(strokeData, settings);
}
```

---

## やってはいけないこと

- GIFアニメーションテーブルの修正（Phase 2）
- バケツツールの修正（Phase 1c以降）
- UIレイアウトの変更
- アニメーション機能への着手
- `tegaki_phase0`への変更

---

## エラーが出た場合

- `getStroke is not a function` → perfect-freehandのimport確認
- `layerManager is undefined` → 初期化順序の確認（作業1参照）
- `blendMode 'erase' not working` → PixiJS v8.17.0の`BlendMode.ERASE`定数確認
- 解決できない場合はPROGRESS.mdに状況を記録してClaudeに相談

---

## 完了時のPROGRESS.md更新内容

```
### YYYY-MM-DD Phase1b完了
- BrushCore二重初期化：解消
- レイヤー表示：復元（レイヤー追加・削除・切り替えOK）
- perfect-freehand：正式接続
- 消しゴム：BlendMode.ERASEに統一
- フォールバック：削除完了
- 次フェーズ：phase1c（筆圧・サイズ・消しゴム品質）
```
