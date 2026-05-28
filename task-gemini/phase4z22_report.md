# Phase 4z22 — Lane / CAF Dependency Audit (GEMINI報告)

## 1. 読んだファイル一覧
- `tegaki_work/system/animation/animation-data-model.js`
- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/PHASE4Z_BOUNDARY.md`

## 2. `syncWithLayers()` の現状
`animation-data-model.js` における `syncWithLayers()` の動作を解析しました。

- **入力**: `LayerSystem` から取得した実レイヤーの配列 (`layers`) とアクティブインデックス。
- **動作**:
    - 実レイヤー配列を逆順（前面が上）に走査し、`LaneModel` (Track) のリストを再構築。
    - 既存の `LaneModel` があれば ID (`sourceLayerId`) で照合して再利用し、名前・タイプ・アクティブ状態を更新。
    - 存在しない ID のレイヤーがあれば新規に `LaneModel` を生成。
- **依存点**: 
    - タイムライン上の Lane の数は、常に通常レイヤーの数に強制同期されている。
    - Lane の並び順は、レイヤーパネルの並び順に依存している。
    - **リスク**: この同期がある限り、アニメ専用の独立した Lane（レイヤーパネルに存在しない行）を追加することができない。

## 3. `sourceLayerId` 使用箇所一覧
`tegaki_work` 内を検索し、`sourceLayerId`（および互換用の `layerId`）の使われ方を分類しました。

| 用途 | ファイル:メソッド | 内容 |
| :--- | :--- | :--- |
| **識別/同期** | `animation-data-model.js`: `syncWithLayers` | 実レイヤーと Lane を 1:1 で紐付ける主キー。 |
| **検索** | `animation-data-model.js`: `getLaneForSourceLayer` | 特定のレイヤーが描画された際、対象の Lane を特定する。 |
| **描画抽出** | `animation-table-popup.js`: `_captureSelectedClip` | Snapshot 作成時、どの実レイヤーからピクセルを取るかの解決。 |
| **Preview制御** | `animation-table-popup.js`: `_applyVisibilityPreview` | 合成プレビュー中、対応する実レイヤーを隠すための照合。 |
| **属性継承** | `animation-table-popup.js`: `_renderCelPreview` | プレビュー時、実レイヤーの不透明度や合成モードを Snapshot に適用。 |
| **新規作成** | `animation-table-popup.js`: (各所) | Clip 作成時、所属 Lane の `sourceLayerId` を Clip へコピー。 |

## 4. アニメテーブル操作ごとの通常Layer依存表

| 操作 | 依存度 | 依存の内容 |
| :--- | :--- | :--- |
| **Clip作成 (Click)** | **強** | 作成先 Lane の `sourceLayerId` を継承する。 |
| **CAPTURE** | **強** | `sourceLayerId` を元に `LayerSystem` から Snapshot を生成する。 |
| **AUTO** | **強** | `drawing:stroke-completed` イベントのレイヤーIDと `sourceLayerId` を照合する。 |
| **PREVIEW** | **強** | 合成プレビュー中、対応する実レイヤーを ID 指定で非表示にする。 |
| **Clip移動** | **強** | 移動先の Lane が持つ `sourceLayerId` へ Clip の ID を書き換える。 |
| **COPY / PASTE** | **強** | アクティブな実レイヤーに対応する Lane を探し、その ID を付与する。 |
| **UNIQUE** | **弱** | アセットの複製が主であり、ID 依存は継承のみ。 |
| **duration変更** | **無** | モデル内の純粋な数値変更。 |
| **Frame移動** | **無** | 再生ヘッドの移動のみ。 |
| **Lane表示名** | **中** | Phase 4z20 で「Lane 1」表示に寄せたが、データ上は実レイヤー名に同期している。 |

## 5. Lane独立化へ向けたリスク
- **同期解除のジレンマ**: `syncWithLayers()` を止めると、レイヤー名変更や順序入れ替えがタイムラインに反映されなくなる。
- **描画先の喪失**: 現在は「EDIT モード = 実レイヤーへの描き込み」であるため、実レイヤーと紐づかない Lane を作ると、その Lane の Clip をどう描画・修正するかが課題となる（Virtual Layer Panel が必須）。

## 6. 次Phase候補

### Phase 4z23 — Lane Model Independence MVP (Codex担当)
- **内容**: `LaneModel` が `sourceLayerId` を持たずとも成立するようにモデルを改修。手動で Lane を追加・削除・リネームできる機能の追加。
- **理由**: モデル構造の変更および `syncWithLayers()` の抜本的な見直し（同期ではなくインポート化）が必要なため。

### Phase 4z23 — Lane Label Logic Refinement (Gemini担当)
- **内容**: 現在 `render()` 内で一時的に計算している `Lane 1, 2...` という表示インデックスを、`LaneModel` の永続的なプロパティ（または表示優先度）として整理。
- **理由**: UI表示と単純なデータ保持のみの改修であるため。

### Phase 4z24 — Clip Creation without SourceLayer (Codex担当)
- **内容**: `sourceLayerId: null` の状態で Clip/Asset を生成し、キャプチャ時のみ「一時的な作業レイヤー」を指定するワークフローの試作。
- **理由**: レイヤーシステムとアニメーションシステムの接続方法を根本から変える必要があるため。

## 7. Codexに判断してほしい点
1. **同期の「格下げ」**: `syncWithLayers()` を「常に同期」から「初回インポート時のみ」または「明示的な同期ボタン実行時」へ変更してよいか。
2. **Lane 命名規則**: ユーザーが自由命名できるようになった場合、デフォルト名を `Lane X` に固定してよいか。

---
本フェーズは調査専用のため、コードの変更はありません。
`npm.cmd run build` は未実行です。
