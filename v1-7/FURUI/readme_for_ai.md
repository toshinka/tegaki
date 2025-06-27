# 📘 README\_for\_AI.md（更新版）

## 🎯 目的

このプロジェクトは、`core-engine.js` を軸に開発・AI支援を進める構造になっています。必要なときに関連ファイルだけを段階的に提示できるよう、責任分離されたファイル構成を採用しています。

AIが「不足している機能」や「過去の実装の所在」を適切に認識できるよう、構造と役割をこのドキュメントで明記します。
また、`HTMLファイル`はできるだけAIに渡さずに済むよう、HTMLに関係する要素を `core-engine.js` 側から集中管理する設計とします。

---

## 🧱 提示の基本方針

* 最初に提示するのは `core/core-engine.js` のみ。
* 必要に応じて他のフォルダ内ファイルを段階的に提供。
* 過去の処理や分離済みのロジックは**削除せず、ツール・UI等の専用モジュールに移動して保持**します。
* `index.html` は原則AIに渡さないため、HTMLとの連携が必要な要素は `core-engine.js` 側からハンドリングできるよう明記・定義する必要があります。
* HTML側の `<script>` タグで直接複数のjsファイルを呼ぶのではなく、**`core-engine.js` ひとつを入口にし、内部で各モジュールをインポート・実行する構成を推奨**します。

---

## 📁 フォルダ構成（概要）

```plaintext
js/
├─ core/                      ← 描画・レイヤー・履歴など中核
│   ├─ core-engine.js         ← メイン中核ファイル（最初に提示）
│   ├─ rendering-bridge.js    ← 描画API抽象層
│   ├─ webgl-engine.js        ← WebGL実装（必要時のみ提示）
│   └─ history-manager.js     ← Undo/Redo（必要時）
│
├─ tools/                     ← ツール群（肥大化したら分割）
│   ├─ toolset.js             ← ToolRegistry と基本ツール
│   ├─ pen.js / eraser.js     ← 各ツール個別定義（必要時）
│
├─ ui/                        ← UI/入力処理
│   ├─ shortcut-manager.js    ← キー入力・ショートカット管理
│   └─ settings-panel.js      ← 設定UI（将来拡張）
│
├─ data/
│   ├─ constants.js           ← 色、サイズ、ショートカット定義など
│   └─ user-settings.js       ← ユーザー保存設定（LocalStorage等）
│
├─ utils/
│   └─ utils.js               ← 汎用関数（色処理、補間等）
```

---

## 🔗 ファイル別 役割と導入タイミング

| ファイル名                      | 提示フェーズ      | 内容・役割                            |
| -------------------------- | ----------- | -------------------------------- |
| `core/core-engine.js`      | Phase 0     | 描画・レイヤー・履歴の中核処理。最初に提示する唯一のファイル   |
| `tools/toolset.js`         | Phase 1     | ToolRegistry + ペン/消しゴム等の共通ツール    |
| `ui/shortcut-manager.js`   | Phase 1.5〜2 | ショートカット入力処理の集中管理                 |
| `core/rendering-bridge.js` | Phase 2     | 描画APIの抽象化レイヤー（Canvas2D/WebGL両対応） |
| `data/constants.js`        | Phase 3     | キー定義、色、サイズなどの共通設定                |
| `utils/utils.js`           | Phase 3     | ベクトル補間・色処理・数値制限などのユーティリティ        |
| `core/webgl-engine.js`     | Phase 4     | GPU描画処理、Shader、FBO操作など（必要時のみ提示）  |
| `data/user-settings.js`    | 任意          | ユーザー設定保存（例: ショートカスタマイズ）          |

---

## 🤖 AI側へのお願いと判断基準

* `ToolRegistry` や `this.tool.draw(...)` が未定義 → → `tools/toolset.js` を要求
* `DrawingEngine.draw(...)` が不明 → `rendering-bridge.js` を要求
* `COLORS.RED` や `SHORTCUTS.UNDO` など定数 → `constants.js` を要求
* `isColorSimilar()` などの関数 → `utils.js` を要求
* ショートカット制御関数が不明 → `shortcut-manager.js` を要求
* 「以前の描画処理はどこ？」→ `tools/pen.js` または `toolset.js` を確認
* `document.getElementById()` 等HTML要素参照が見られる → core側で管理されているか確認

---

## 🛡 安全設計ポリシー（AIによる誤消去を防ぐための指針）

* 古いロジックは必ずコメントアウトまたは別モジュールに移動（消去禁止）
* ファイル冒頭に「このファイルが参照する他ファイル」をガイドコメントとして明記
* core-engine.js はあくまで「制御と接続の中核」であり、描画・UI・設定処理の本体は分離モジュールに委譲する設計とする
* `index.html` に依存するDOM構造やID指定などは `core-engine.js` に集中させ、HTMLをAIに渡す必要を最小限に抑える
* HTMLファイルは **`<script src="js/core/core-engine.js">` だけを読み込む構成**とし、他のスクリプト連携は core 側で内包・制御する

---

## ✅ まとめ

* `core-engine.js` だけでもAIは主要機能を理解・拡張できる構造
* 他機能は必要時に `README_for_AI.md` に従って順次提示可能
* HTMLとの連携も `core` 側で抽象化するため、AIへのHTML提示が不要になる設計が可能
* スクリプト連携は `core-engine.js` を中心とした統合管理方式を推奨
* 機能肥大化に応じて自然な単位で責任分離されており、AIの補完精度を高く保てます
