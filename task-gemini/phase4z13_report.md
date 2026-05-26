# Phase 4z13 — CAF Layer Panel Display Plan (GEMINI報告)

## 1. 現行レイヤーパネル構造の棚卸し

現在の `layer-panel-renderer.js` および `layer-system.js` は、PixiJS の Container 階層と 1:1 で対応した通常レイヤー（およびフォルダ）の描画に特化しています。

### 1.1. レイヤー行の構成 (`createLayerElement` / `createFolderElement`)
- **共通構造**: `.layer-item` クラスを持つ `div` 要素。`display: grid` を使用し、サムネイル、詳細（不透明度・名前）、クリッピング、可視性の 4 カラム構成。
- **フォルダ行**: `.folder-item` クラスを追加。背景色（`#cf9c97` 等）や、子要素がある場合のインデント（`_calculateIndentLevel`）によって階層を表現。
- **依存属性**: `data-layer-index`（配列インデックス）および `data-is-folder="true"`（フォルダ判定）を DOM に保持。

### 1.2. 開閉・インデント・D&D
- **状態管理**: フォルダの開閉は `LayerModel.folderExpanded` で保持。`LayerSystem.toggleFolderExpand()` で変更され、イベント経由で `render()` が再発火する。
- **インデント**: `parentId` を再帰的に辿って算出。最大 3 段階に制限。
- **D&D依存**: SortableJS が `.layer-item` クラスを対象に動作。ドラッグ終了時に `data-layer-index` を元に `LayerSystem.reorderLayers()` や `moveLayerIntoFolder()` を呼ぶ。

---

## 2. CAF表示案 A/B/C

| 案 | 概要 | 利点 | 危険・懸念 |
| :--- | :--- | :--- | :--- |
| **案A** | 読み取り専用ヘッダー | レイヤーパネル上部に CAF/ClipAsset 名を羅列。 | 実装が非常に安全。既存機能を壊さない。 | リストが分断され、階層構造が分かりにくい。 |
| **案B** | 独立したCAF行 | 通常フォルダの上位として `.caf-item` 行を挿入。 | 最終的な統合イメージに近い。視認性が高い。 | SortableJS が誤反応して D&D が壊れるリスク。 |
| **案C** | サブセクション化 | 右パネル内に `Frame Assets` セクションを追加。 | 既存の描画ロジックと完全に分離できる。 | 操作が煩雑。将来の統合時に二度手間になる。 |

---

## 3. 視覚区別案

通常フォルダと CAF（ClipAssetFolder）を直感的に区別するためのデザイン案：

- **背景色**: 通常フォルダ (`#cf9c97`) より暗い、または別系統（例: 紺色 `#2c3e50` や深緑）を採用。
- **ラベル**: 名前の前に `[CAF]` や `[CLIP]` といったバッジを表示。
- **アイコン**: フォルダアイコンの代わりに、アセットを象徴する独自のアイコン（立方体や鎖マークなど）を使用。
- **左線**: レイヤー行の左側に太いアクセント線（CAF専用色）を引く。

---

## 4. 表示対象データの解決案（疑似手順）

現在フレーム（`currentFrame`）の構成要素を抽出するロジック：

1. `currentFrame` を取得。
2. `TimelineModel.tracks` を全走査。
3. `lane.getCelAtFrame(currentFrame)` で配置済みクリップを収集。
4. 各クリップの `assetId` から `ClipAsset` を取得。
5. `ClipAsset.folderId` があれば `ClipAssetFolder` ごとにグループ化。
6. なければ `Uncategorized` または単独アセットとしてリストアップ。
7. **表示順**: 原則としてタイムラインの Y 軸（Lane）の並び順に従う。

---

## 5. 次の小Phase候補

1. **Phase 4z14 — Frame Asset List Helper**
   - **内容**: `TimelineModel` に「現在フレームの全使用アセットをツリー構造で返す」純データヘルパーを実装。
   - **リスク**: 低。UI 変更なし。
   - **完了条件**: コンソールからメソッドを叩き、正しい階層構造が得られること。

2. **Phase 4z14 — Layer Panel CAF Header Draft** (案A相当)
   - **内容**: レイヤーパネルの `render()` の冒頭で、収集したアセット名を非対話的なテキストとして出力する。
   - **リスク**: 低。既存 DOM の上に追加するだけ。
   - **完了条件**: 現在フレームのクリップ名がパネル上部に表示され、通常のレイヤー操作が支障なく行えること。

3. **Phase 4z14 — CAF Class Identity Mapping** (案B用)
   - **内容**: `.caf-item` や `.caf-internal-layer-item` といった CAF 専用の CSS クラスと DOM 構造のみを定義し、通常レイヤーと「物理的に混ざらない」ためのガード条件（SortableJS フィルタ等）を設計する。

---

## 6. 危険箇所・禁止すべき一括変更

- **CAF 行への `.layer-item` クラス流用**: SortableJS が通常レイヤーとして扱い、不正な `layer-reorder` イベントが発火してデータが破損します。
- **`LayerSystem` への CAF オブジェクト投入**: `Pixi.Container` 前提のロジック（サムネイル生成等）で実行時エラーが発生します。
- **インデント算出の共通化**: CAF 階層と通常レイヤー階層が混ざると、無限ループや表示崩れの原因になります。

---

## 7. Codexに判断してほしい点

1. **配置順序**: レイヤーパネル内での CAF の表示順は、タイムラインの Y 軸（Lane）に合わせるべきか、それとも Asset Library のフォルダ順を優先すべきか。
2. **排他表示**: 「ClipAsset 内部レイヤーを表示している間は、対応する通常レイヤー（Lane）を非表示にする」といった排他制御を入れるべきかどうか。

---

## 8. Codex確認追記

報告内容は概ね妥当。次の実装は、レイヤーパネルDOMへ直接入る前に、まず **現在FrameのClipAsset/CAFツリーを返す純データヘルパー** を作るのが安全。

Codex判断:

1. CAF表示順は、プレビュー/タイムラインの見た目と一致させるため、初期実装では **タイムラインY軸順を優先** する。Asset Library順は保管庫内整理の順序であり、Frame上の表示順とは別扱い。
2. 排他表示はまだ入れない。ClipAsset内部Layerをレイヤーパネルに見せる段階になってから検討する。現時点で通常レイヤー非表示制御まで入れると、Preview/EDIT/LayerSystemの責務が混ざる。
3. 次Phase候補は `Frame Asset List Helper` を最優先にする。UI変更なしの純データ関数として、後続のCAF Header / CAF行 / Virtual Layer Panel の共通入力にする。
4. レイヤーパネルに実表示する場合は、`.layer-item` を流用せず、SortableJS対象外の専用classから始める。
