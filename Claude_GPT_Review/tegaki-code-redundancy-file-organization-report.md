# Tegaki 診断書 — コード冗長化・ファイル整理状況・命名法則・リファクタリング評価

更新日: 2026-08-14
レビュー担当: 外部AI（Web版Claude）
確認方法: GitHub `main` branch（sparse clone + `git pull`で最新確認）のコード読解。Tegaki自身のコード（`ui/`、`system/`、トップレベルJS）147ファイル・約88,700行を対象とした。`node_modules`、`dist`、`libs`（ffmpeg.wasm等の外部バンドル）は対象外。Browser実機での動作確認は行っていない。

> 本書は提案・所見であり実装契約ではない。採否は`AGENTS.md`の運用方針に従い、実コード照合の上でCODEX側・Ownerが判断してください。

---

## 1. 概要（結論の要約）

- **命名法則は非常に一貫している**。147ファイル中145ファイルがkebab-case、例外はトップレベルのビルドスクリプト2本のみ。
- **ファイルサイズの分布に強い二極化がある**。`ui/animation-table-popup.js`が21,706行・約500メソッドの単一classという、他を大きく引き離す「巨大ファイル」である一方、`system/animation/`配下は55ファイルに細かく分割されており、最小は21行しかない。この非対称さ自体が組織構造上の特徴として目立つ。
- **コードの冗長化は複数箇所で確認できた**。いずれも軽量なutility関数（バイト数フォーマット、clamp、ID生成）が3〜9箇所で独立に再実装されている、という「小さいが積み重なる」タイプの重複で、致命的ではないが直す価値はある。
- リファクタリングの重さ・有効性を天秤にかけると、**utility統合は低コスト・中程度の効果、animation-table-popup.jsの分割は高コスト・高リスクで今は非推奨**、という評価になった。詳細は4章にまとめた。

---

## 2. コードの冗長化

### 2.1 バイト数フォーマット関数が3箇所で独立実装

`ui/album-popup.js`（189-190行）と`system/animation/caf-memory-profiler.js`（35-36行）は、**一字一句同一**のロジックを持っています。

```js
if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
```

さらに`ui/settings-popup.js`（837-839行）にも、MB単位から変換する少し違う実装（`formatLimit`）が存在します。3ファイルとも同じ目的の関数を別々に持っており、共通化されていません。

### 2.2 `clamp(value, min, max)`が最低3箇所で独立実装

```
system/text-rasterizer.js:20        function clamp(value, min, max) {...}
system/animation/chain-local-joint-skin.js:24   function clamp(value, minimum, maximum) {...}
system/animation/two-bone-ik.js:21              function clamp(value, min, max) {...}
```

（`clamp01`、`clampOpacity`、`clampEasingCurveY`等、0-1範囲や用途特化のバリエーションは別物として妥当なので対象外にしています。）

### 2.3 ID生成パターンが約9ファイルで重複、しかも共通実装が既に存在する

`` `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` ``という同一パターンが、`system/data-models.js`、`system/animation-system.js`（4箇所）、`system/drawing-clipboard.js`、`system/drawing/brush-core.js`（2箇所）、`system/drawing/stroke-renderer.js`で、`layer_`・`frame_`・`path_`・`stroke_`・`cut_`など異なる固定prefixを埋め込んだ形で個別に書かれています。

興味深いことに、**`system/state-manager.js`（90行）には既にprefixを引数に取る汎用版が存在**します。

```js
return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

つまり共通化の受け皿は既にあるのに、他の8箇所はそれをimportせず、同じロジックをその都度書き直している状態です。

### 2.4 Raster面サイズ上限の定数が7箇所に埋め込まれている（前回レポートとの関連）

前回の診断書でも触れましたが、`maxPixels: 16 * 1024 * 1024`という同一の数値リテラルが、`system/psd-importer.js`、`system/layer-system.js`、`system/animation/timeline-frame-compositor.js`（3箇所）、`ui/resize-popup.js`、`ui/animation-table-popup.js`の計7箇所に個別に書かれています。これは`system/raster-bounds.js`側のデフォルト値と完全に同じ値なので、実質的には「デフォルトのままでいい箇所でわざわざ明示している」重複です。数値を変える際に7箇所を漏れなく直す必要がある、という保守コストを生んでいます。

### 2.5 深いコピーの手法が割れている（軽微）

`structuredClone()`を使っている箇所が11ファイル、`JSON.parse(JSON.stringify(...))`を使っている箇所が6ファイルありました。後者は関数・undefined・Dateなどを正しく扱えない制約付きの手法なので、意図的な使い分け（あえてJSON互換な値だけを残したい場合等）であれば問題ありませんが、単に書いた時期やコードを書いた人の癖で分かれているだけなら、緩やかに`structuredClone`へ統一していく余地があります。個別に確認はしていないため、意図的な使い分けかどうかは要確認です。

---

## 3. ファイルの整理状況・命名法則の妥当性

### 3.1 命名法則: 非常に良好

147ファイル中、kebab-caseから外れているのは以下の2つだけで、いずれもトップレベルのビルド補助スクリプトです。

```
build_ffmpeg.js
build_freehand.js
```

アプリケーション本体（`ui/`、`system/`）には命名の乱れが見当たりませんでした。ディレクトリ構成も`ui/`（UI層）、`system/`（ロジック層）、`system/animation/`・`system/drawing/`・`system/exporters/`・`system/processing/`（サブドメイン別）と役割で綺麗に分かれており、迷いにくい構造です。

### 3.2 ファイルサイズの分布: 強い二極化

主要ディレクトリのファイルサイズ上位を並べると、際立った特徴が見えます。

| ディレクトリ | 最大ファイル | 行数 | 2番目 | 行数 |
|---|---|---|---|---|
| `ui/` | `animation-table-popup.js` | **21,706** | `layer-panel-renderer.js` | 4,301 |
| `system/` | `layer-system.js` | 5,336 | `pixel-selection-system.js` | 1,753 |
| `system/animation/` | `animation-data-model.js` | 2,894 | `part-rig.js` | 1,595 |

`ui/animation-table-popup.js`だけが突出しています。中身を見ると、**この21,706行は`export class AnimationTablePopup`というただ1つのclassで構成されており、メソッド数は概算で約500個**でした。RIG Setup、WARP、Timeline、CAF合成preview、Mesh生成、Bone、IK、Motion Graph、Easingなど、これまで個別にレビューしてきた機能のほとんどがこの1ファイル・1classに集約されています。

対照的に`system/animation/`は55ファイルに分かれており、`motion-gesture-state.js`（22行）や`control-mesh-rasterizer.js`（21行）のように、1つの責務だけを持つ小さなpure関数ファイルが数多く存在します。これは`verify-*.mjs`によるGate検証文化と相性が良い設計で、責務が明確・テストしやすいという点でむしろ良い実践だと思います。「小さすぎて分かりにくい」というほどの過剰分割ではなく、意図的な設計だと評価しています。

つまり、**system層は模範的に分割されている一方、UI層の中核部分だけが1ファイルに寄せられている**という非対称な状態です。これは自然に増えていったというより、UIの結線コード（イベントリスナー、DOM更新、popup状態管理）は分割しにくい性質がある、という事情もありそうです。

### 3.3 ファイル冒頭コメントの規約: おおむね統一、一部欠落

多くのファイルは以下のような構造化されたdocblock、またはそれに準じた自由文形式の責務説明を持っています。

```js
/**
 * ファイル名: system/animation/two-bone-ik.js
 * 責務: Fixed-length, rotation-only 2-Bone IK authoring math...
 */
```

ただし`system/animation/motion-gesture-state.js`のように、**冒頭コメントが一切なく、いきなりコードから始まるファイル**も見つかりました。致命的ではありませんが、規約の徹底という意味では小さな穴です。

---

## 4. リファクタリングの重さと有効性の評価

見つかった懸念それぞれについて、直す労力（コスト・リスク）と得られる効果を天秤にかけました。

### 4.1 utility関数の統合（2.1〜2.3） — 低コスト・中程度の効果、推奨

バイト数フォーマット、clamp、ID生成は、いずれも**状態を持たない純粋関数**で、History・EventBus・DOMに依存していません。`system/format-utils.js`のような共有ファイルを1つ作り、重複箇所をimportに置き換えるだけの機械的な変更で完結します。

- **コスト**: 低い。関数の中身自体は変更不要で、置き場所を移してimportし直すだけ。既存の`verify-*.mjs`Gate文化なら、置き換え前後で出力が一致することを機械的に確認できます。
- **効果**: 中程度。今すぐバグを起こしているわけではありませんが、「片方だけ直して片方を直し忘れる」将来のバグの温床です。特にID生成は`state-manager.js`に既に汎用版があるので、そこへ寄せるだけで済みます。
- **判定**: **やる価値のある低リスクな改善**。ただし急ぎではないので、他の作業のついでに少しずつ片付ける程度で十分だと思います。

### 4.2 `ui/animation-table-popup.js`の分割 — 高コスト・高リスク、今は非推奨

21,706行・約500メソッドの単一classを機能単位（RIG Setup、WARP、Timeline、CAF合成preview等）に分割すれば、可読性・変更影響範囲の面で理論上は大きな効果が見込めます。ただし現実的なコストは非常に高いと判断しました。

- **コスト**: 非常に高い。500個のメソッドが同じ`this`を共有しており、どのメソッドがどの内部状態（フィールド）に依存しているかを1つずつ洗い出さないと、安全に切り出せません。イベントリスナーの結線、`_syncRigSetupContext()`のような相互参照メソッド、popup間の状態同期など、暗黙の依存が大量にあると予想されます。
- **リスク**: 高い。この一つのファイルは、これまで確認してきた通りPhase 7i〜8cにわたって継続的に手が入っており、現在進行中のGate（Phase 8c）もこのファイルを対象にしています。`AGENTS.md`が「JSファイル全体の置換を避ける」と明記している通り、今のこのプロジェクトの安全な変更の単位（小さなdiff・都度Browser確認）とは相性が悪い規模の作業です。
- **効果**: 理論上は高いが、今すぐ困っているという証拠（バグの温床になっている、変更のたびに壊れている等）はPROGRESS.md上には見当たりませんでした。
- **判定**: **今は着手すべきではない**。やるとしても一括分割ではなく、既に境界がはっきりしている部分（例えば`data-rig-*`属性で閉じているRIG Setup panel関連のメソッド群など）から少しずつ、独立したverifierで検証しながら切り出す、という段階的なアプローチでない限り、コストに見合いません。

### 4.3 `system/animation/`の粒度 — 問題なし、現状維持を推奨

55ファイルという数だけ見ると過剰分割に見えるかもしれませんが、中身は1責務1ファイルの原則に忠実で、`verify-*.mjs`によるGate検証と噛み合っています。ここは「直すべき懸念」ではなく、他の部分（特に4.2）が見習うべき設計だと評価しています。

### 4.4 ファイル冒頭コメントの統一（3.3） — 低コスト・低い効果、優先度は最下位

ドキュメントのみの変更で挙動には一切影響しないため、リスクはゼロに近いですが、影響も小さいです。新規ファイル作成時のテンプレート徹底や、既存ファイルに他の理由で手を入れたついでに直す、程度の扱いで十分だと思います。

---

## 5. 優先順位まとめ

| 優先度 | 項目 | コスト | 効果 | 判定 |
|---|---|---|---|---|
| 中 | utility関数の統合（バイト整形・clamp・ID生成） | 低 | 中 | 推奨。低リスクなので着手しやすい |
| 低 | `maxPixels`定数の一元化 | 低 | 低〜中 | 前回レポートの推奨（4.3）と合わせて対応するとよい |
| — | `animation-table-popup.js`の分割 | 高 | 理論上は高いが実害は未確認 | 今は非推奨。段階的抽出のみ検討 |
| — | `system/animation/`の粒度 | — | — | 問題なし、現状維持 |
| 最低 | ファイル冒頭コメントの統一 | 極低 | 低 | 優先度最下位、ついで対応で十分 |

---

## 6. 未検証・対象外

- `ui/animation-table-popup.js`内の500メソッドについて、実際にどの程度相互依存しているか（分割の実現可能性そのもの）までは踏み込んで調査していません。数値は概算です。
- ID生成・deep clone等の重複について、意図的な使い分け（例えば特定箇所だけ`JSON.parse(JSON.stringify)`でないと困る事情があるか等）は個別に確認していません。
- `dist/`配下のビルド済みバンドルは対象外としています。
