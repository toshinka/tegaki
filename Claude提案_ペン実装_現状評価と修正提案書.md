# ペン実装 現状評価と修正提案書

**作成者：** Claude  
**宛先：** Codex（ローカル調査・修正指示書作成用）  
**日付：** 2026-05-18  
**対象フェーズ：** Phase 1c（現行作業の優先課題として扱う）

---

## 1. 前提：採用アーキテクチャの評価

以前のClaudeチャットで提案され、GeminiとCodexが実装したペンパイプラインは以下の構成。

```
PointerEvent（筆圧取得）
  ↓
perfect-freehand（輪郭ポリゴン生成）
  ↓
PixiJS v8 Graphics.poly()（ポリゴン塗りつぶし）
  ↓
RenderTexture 焼き込み（ラスター確定）
```

**この設計自体は2026年現在でも正しく、モダンである。**  
tldraw・Excalidrawと同等の構成であり、破棄・全面作り直しは不要。

問題はアーキテクチャではなく、**パイプラインのつなぎ目が複数箇所で壊れていること**にある。

---

## 2. 現状の照合：提案通りに動いていない箇所

| 提案書の方針 | 現状（HANDOFF確認済み） | 評価 |
|---|---|---|
| PointerEvent.pressure で筆圧取得 | `pointer-handler.js` で対応済み。ただし液タブで `button: 2` を `drawing-engine.js` 側がまだ return している可能性あり | △ |
| perfect-freehand でストローク生成 | 採用済み。ただし `smoothing: 0.4` / `streamline: 0.3` のデフォルトが強すぎて補正過多 | △ |
| Graphics.poly() でポリゴン描画 | 採用済み。高速ストロークで三角ノイズが発生中 | △ |
| BlendMode.ERASE で消しゴム | `renderPreview(mode:'eraser')` が `stroke-renderer.js` 側で空を返すため、**リアルタイム消去が実質未動作** | ✕ |
| RenderTexture 焼き込み | 基本動作はしているが、サムネイル崩れが残存 | △ |

**一言でまとめると：「モダンな設計図を持ちながら、施工が途中で止まっている状態」。**

---

## 3. 修正すべき問題（優先度順）

### 🔴 Priority 1：消しゴムのリアルタイム消去が動いていない

**問題の根本：**

```
現状のフロー（壊れている）：
renderPreview(mode:'eraser') を呼ぶ
  → stroke-renderer.js 側が eraser preview を空で返す
  → 何も焼き込まれない → 消えない
```

**正しいフロー：**

```
消しゴムのリアルタイム消去フロー（目標）：
pointermove
  → eraser 専用 Graphics を別生成
  → BlendMode.ERASE を設定
  → RenderTexture に直接 render（実焼き込み）
  → pointerup で Graphics を破棄
```

提案書の原文：「ペンと全く同じパイプラインで、ブレンドモードを切り替えるだけ」  
→ この通りに実装されていれば本来シンプルなはずが、`renderPreview` 経由にしたことで経路が分岐して壊れている。

**Codexへの調査依頼：**
- `stroke-renderer.js` の eraser 分岐がどこで空を返しているか特定してほしい
- eraser 用の `Graphics` を `renderPreview` を通さず直接 `RenderTexture` に焼き込む経路が作れるか確認してほしい
- undo 用のストローク記録との両立方法も合わせて検討してほしい（焼き込んだ後に undo できるか）

---

### 🔴 Priority 2：液タブペンの描画が止まる問題

**問題：**

液タブペンが `pointerType: 'pen'` かつ `button: 2` として来るケースで、  
`pointer-handler.js` 側は通すよう修正済みだが、  
`drawing-engine.js` 側でまだ `if (info.button === 2) return;` している可能性がある。

**設計方針（確認済み）：**
- マウス右クリック（`pointerType: 'mouse'` かつ `button: 2`）は描画しない
- 液タブペン（`pointerType: 'pen'` かつ `button: 2`）は描画を許可する

**正しいガード条件：**

```js
// ❌ 現状（疑い）
if (info.button === 2) return;

// ✅ 正しい
if (info.pointerType === 'mouse' && info.button === 2) return;
```

**Codexへの調査依頼：**
- `drawing-engine.js` の `button` チェック箇所を全て特定し、上記の条件に修正されているか確認してほしい
- `pointer-handler.js` から `drawing-engine.js` への `info` オブジェクトに `pointerType` が含まれているか確認してほしい

---

### 🟡 Priority 3：perfect-freehand のデフォルト値が補正過多

**問題：**

現在のデフォルト設定が「補正が効きすぎ」で、細かい絵で線が勝手に丸まる・補正される。  
ユーザーはこの感触を強く嫌っている。

**提案書が注意点として明記していた内容そのままが未対応：**

```js
// ❌ 現状（疑い）
getStroke(points, {
  smoothing: 0.4,    // 強すぎる
  streamline: 0.3,   // 強すぎる
  simulatePressure: false,
})

// ✅ 推奨デフォルト（リニア寄り）
getStroke(points, {
  smoothing: 0.2,    // 控えめに
  streamline: 0.0,   // デフォルトは手ブレ補正なし
  simulatePressure: false,
})
```

**設計方針：**
- デフォルトは「書いた通りに出る」リニア寄り
- `streamline`・`smoothing` はスライダー設定で上げた時だけ効く
- `settings-manager.js` の設定値を `stroke-renderer.js` に接続する経路を確認してほしい

**Codexへの調査依頼：**
- 現在の `getStroke()` 呼び出し時のオプション値を特定してほしい
- `settings-manager.js` の smoothing/streamline 設定が `stroke-renderer.js` に渡されているか確認してほしい

---

### 🟡 Priority 4：高速ストロークの三角ノイズ

**問題：**

高速入力時に `Graphics.poly()` が異常に大きいポリゴンを描画してしまいノイズが出る。  
`MIN_DIST = 0.25` の近接点対策では高速時の異常輪郭には不十分。

**提案書後半に記載されていた対処（未実装と思われる）：**

```js
// getStroke() 後の輪郭ポリゴンを検査する
const outline = getStroke(points, options);

// bounds を計算
const xs = outline.map(p => p[0]);
const ys = outline.map(p => p[1]);
const width  = Math.max(...xs) - Math.min(...xs);
const height = Math.max(...ys) - Math.min(...ys);

// 異常に大きいポリゴンは採用しない
const MAX_REASONABLE_SIZE = brushSize * 20; // 例：ブラシサイズの20倍まで
if (width > MAX_REASONABLE_SIZE || height > MAX_REASONABLE_SIZE) {
  // 丸線 fallback（細い円で代替）
  drawCircleFallback(x, y, brushSize * pressure);
  return;
}
```

**設計方針（確認済み）：**
- WebGL2 Mesh 経路は復活させない
- 異常ポリゴン → 採用せず、丸線 fallback へ切り替える

**Codexへの調査依頼：**
- `stroke-renderer.js` または `drawing-engine.js` にポリゴン検査のロジックが存在するか確認してほしい
- fallback として `Graphics.circle()` 等が呼ばれる経路があるか確認してほしい

---

### 🟢 Priority 5：筆圧ゼロ付近のゴミ点対策

**問題：**

ペンを浮かせる直前に `pressure: 0` に近い値が誤送信され、幅ゼロに近いゴミ点が出ることがある。  
提案書に具体的な対処コードが記載されていたが、実装されているか不明。

**必要な処理（2行）：**

```js
// 最小筆圧クランプ（完全ゼロを避ける）
const pressure = Math.max(event.pressure, 0.02);

// または一定以下は描画しない
if (event.pressure < 0.01) return;
```

**Codexへの調査依頼：**
- `pointer-handler.js` または `drawing-engine.js` に筆圧クランプ処理が存在するか確認してほしい
- なければ追加箇所を特定してほしい（`pointermove` ハンドラの入口が最適）

---

## 4. PixiJS v8.17.0 新機能の活用検討

現在 v8.17.0 を採用済みのため、追加インストールなしで以下が使える。  
レイヤー操作が「弄ると爆発しやすい」という問題への対処として特に有効。

| 機能 | 用途 | 優先度 |
|---|---|---|
| `container.reparentChild(child)` | レイヤー移動時にビジュアル位置を維持したまま親を変更。レイヤー並び替えの安定化に直結 | **高** |
| `container.getGlobalTransform()` | `camera-system.js` の座標変換を簡略化。変形後の座標爆発対策 | 高 |
| `element.setMask({ inverse: true })` | 逆マスク。消しゴム実装のバリエーション追加 | 中 |
| `graphics.pixelLine` | グリッド・補助線を常に1px幅で描画 | 低 |

**特に `reparentChild` はレイヤーパネルのD&D実装（別提案書参照）とも連動する。**  
D&Dでレイヤーを別フォルダに移動する際、`reparentChild` を使えばスケール・位置がずれない。

---

## 5. Codexへの依頼事項まとめ

以下を優先度順に調査・報告してほしい。

### 必須調査（Priority 1〜2）

1. `stroke-renderer.js` の eraser 分岐を追跡し、どこで空を返しているか特定する
2. eraser を `renderPreview` を通さず `BlendMode.ERASE` で直接焼き込む経路の実現可否を判断する
3. `drawing-engine.js` の `button: 2` ガード条件が `pointerType` を考慮しているか確認する
4. `pointer-handler.js` → `drawing-engine.js` の `info` オブジェクトに `pointerType` が含まれているか確認する

### 推奨調査（Priority 3〜5）

5. `getStroke()` 呼び出し時の現在のオプション値を特定する
6. `settings-manager.js` の smoothing 設定が `stroke-renderer.js` に接続されているか確認する
7. 高速ストロークのポリゴン検査・fallback ロジックの有無を確認する
8. `pointer-handler.js` の筆圧クランプ処理の有無を確認する

### 検討事項（PixiJS新機能）

9. `reparentChild` をレイヤー移動処理に組み込める箇所を特定する
10. `getGlobalTransform()` で `camera-system.js` を簡略化できる箇所を特定する

---

## 6. まとめ

**破棄・全面作り直しは不要。パイプラインは正しい。**

修正すべきは以下の3本柱：

```
1. 消しゴム    → renderPreview 経路を迂回し、BlendMode.ERASE で直接焼き込む
2. 液タブペン  → button:2 ガードを pointerType で分岐させる
3. 描画品質    → perfect-freehand デフォルト値をリニア寄りに戻す
```

Codexがローカル調査で上記5箇所のコードを特定したら、  
その結果を受けてGeminiへの修正作業指示書を作成する。

---

*Claude作成 / 2026-05-18*
