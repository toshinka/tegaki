# PHASE4Z HANDOFF — アニメテーブル / ClipAsset内部Layer基盤

作成日: 2026-05-25  
作業対象: `tegaki_work/`  
現在地: **Phase 4z9 — ClipAsset Internal Layer Order MVP 完了**

---

## 新チャットのCodexが最初に読む順番

必ずこの順番で読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`（このファイル）
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z6.md`
7. `task-gemini/phase4z6_report.md`
8. `task-gemini/phase4z7.md`
9. `task-gemini/phase4z7_report.md`
10. `task-gemini/phase4z8.md`
11. `task-gemini/phase4z8_report.md`
12. `task-gemini/phase4z9.md`
13. `task-gemini/phase4z9_report.md`
14. `tegaki_work/system/animation/animation-data-model.js`
15. `tegaki_work/ui/animation-table-popup.js`

補足:

- `phase4n_preview_scope_note.md` は、Preview / Frame Composite / 選択Clip単独表示 / Playback Scope の設計メモなので、今後アニメテーブル、Lane、Clip、Preview、Exportに触る時は必読。
- `phase4z6` 以降はClipAsset内部Layer基盤の連続作業なので、レポート込みで読む。
- `PROGRESS.md` が最新ログの正本。古いチャット文脈より優先する。

---

## AI役割分担

このプロジェクトは、オーナーが複数AIを使い分けて進めている。

- **Codex**
  - ローカル実ファイルの調査、重要判断、軽微だが確実性が必要な補修、高難度改修、指示書作成、Gemini成果物レビュー。
  - バグや構造上の危険が見えた場合は、指示書作成より直接修正を優先してよい。
- **Gemini CLI**
  - 棚卸し、反復的な実装、限定範囲のUI/モデル追加、ビルド確認、レポート作成、`PROGRESS.md` 更新。
  - トークン節約のため、難度が低めで量がある作業はGeminiに回す。
- **Claude**
  - Web/GitHub経由のセカンドオピニオンや大きめの設計相談。
  - Claude向け依頼書はGitHub Raw URL前提で書く。
- **オーナー**
  - 実機動作確認、最終判断、GitHub push。

新チャットのCodexは、Geminiに任せてよい棚卸しと、Codexが直接触るべき重要部分を都度判断する。

---

## 現在までにできたこと

### アニメテーブルの大枠

- 左サイドバーのアニメアイコンから新アニメテーブルを開く導線がある。
- 旧タイムラインではなく、新しいLane/Clip型のアニメテーブルへ移行中。
- テーブルはフローティングパネルで、ドラッグ移動、横/縦スクロール、左右キーによるフレーム移動が入っている。
- Clipの配置、削除、duration変更、D&D移動、COPY/PASTE、UNIQUEが実装済み。
- Preview、Onion、AUTO、EDIT、Scope ALL/LANE/SETが暫定実装済み。

### データモデル

主なモデル:

- `TimelineModel`
- `LaneModel`（旧Track互換）
- `ClipInstanceModel`（旧Cel互換）
- `ClipAssetModel`
- `DrawingSnapshotModel`
- `ClipAssetFolderModel`
- `ClipAssetInternalLayerModel`

現状の方向性:

- Timeline上に置くのはClipInstance。
- ClipInstanceはClipAssetを参照する。
- ClipAssetはDrawingSnapshotと内部Layer構造を持つ。
- 背景レイヤーはClipAsset内部Layerには含めない。
- 現行Previewはまだ `ClipAsset.drawingSnapshotId` / `TimelineModel.getSnapshotForCel()` が正本。
- 内部Layer合成Previewは未実装。

### ClipAsset内部Layer

Phase 4z6〜4z9で以下が完了。

- `ClipAssetInternalLayerModel` 追加。
- `ClipAssetModel.internalLayers` のモデル化とserialize対応。
- Blank/CAPTURE/Auto-Seed/Make Unique時の内部Layer生成/補完。
- Asset Library内にInternal Layers Inspector追加。
- 内部Layerの追加、削除、リネーム、visible切替。
- 最後の内部Layer削除ガード。
- 内部Layerの上下順序変更。

順序方針:

- Inspector表示では、配列先頭が上/前面。
- 将来の合成Previewでは、末尾から描画して先頭が前面に見えるようにする案が `phase4z9_report.md` に記録されている。
- まだ合成Preview実装で固定したわけではない。

---

## 重要な設計判断

### 背景レイヤー

Tegakiの背景レイヤーは共有キャンバス下地であり、ClipAsset内部Layerに含めない。

- 透明キャンバスを見やすくするためのツール装置。
- 絵としての背景ではない。
- 絵の背景が必要な場合は、ユーザーが通常Layer/ClipAsset側に描く。
- 線だけのClipは合成時に下のClipが透ける。遮蔽したい場合は各Clip側で塗りLayerを作る。

### Preview / 表示スコープ

標準Previewは「現在Frameにある全Clip合成」が基本。

ただし将来は以下を分ける。

- Frame番号クリック: そのFrameの全Clip Composite。
- Clipクリック: 選択Clip単独、またはClip内部編集。
- 再生: 基本はALL。必要に応じてLANE/SET。
- 内部Layer編集: ClipAsset内部のみを扱うVirtual Layer Panelへ切替。

詳細は `task-gemini/phase4n_preview_scope_note.md`。

### CAPTURE / AUTO / EDITの暫定性

現行のCAPTURE/AUTO/EDITは、ClipAsset内部LayerやVirtual Layer Panelが整うまでの暫定UI。

- `CAPTURE` は名前が分かりにくい。
- 将来の「複数Lane再生対象をキャプチャする」概念と衝突する可能性がある。
- Lane/ClipAsset/Virtual Layer Panel整備後に名称・位置・意味を整理する。

---

## 既知の注意点

- `animation-table-popup.js` はかなり肥大化している。大きなDOM/CSS置換は危険。
- CSS注入ブロックの重複が増えている。見た目の大整理は後でまとめて行う方がよい。
- Inspectorの内部Layer操作はまだPreviewに反映されない。
- visible/順序/opacity/blendModeはデータとしてあるが、内部Layer合成には未接続。
- Asset LibraryやInspectorは作業用UIで、最終UIではない。
- レイヤーパネルD&D系の既知不安定が過去にあった。D&D追加は慎重に。
- `dist/` はビルドで変わるが成果物に含めない。確認後は差分除外する。

---

## 次にやる候補

次Phase指示書は新チャットのCodexが、最新ファイル確認後に作るのが望ましい。

候補は以下。

### 候補A: Phase 4z10 — Internal Layer Composite Preview Foundation

目的:

- ClipAsset内部Layerの配列順、visible、opacityを使い、Asset内を合成したPreview用Snapshot/Textureを作る足場。

向いている理由:

- 4z6〜4z9で内部Layerデータが整った直後なので自然。
- Virtual Layer Panel前に「複数内部Layerが見える」基盤を作れる。

注意:

- RenderTexture / Pixi Container / Snapshotキャッシュに絡むため、Codexが設計確認してからGeminiへ投げるか、Codexが直接触る判断もあり。
- いきなり本格合成に行かず、まずは関数・キャッシュ・fallback方針の棚卸しをGeminiに依頼してもよい。

### 候補B: Phase 4z10 — Virtual Layer Panel Plan / Shelf

目的:

- 通常レイヤーパネルをClipAsset内部Layer編集へ切り替えるための接続点を棚卸しする。

向いている理由:

- 高リスクなので、先に棚卸しと設計メモを作る価値が高い。
- レイヤーパネルは過去にD&D/表示更新周りで問題が出たため、いきなり実装しない方がよい。

### 候補C: Phase 4z10 — Animation Table Handoff / Cleanup

目的:

- 新チャット開始後、4z系の状態を点検し、古い暫定UIやCSS重複、ドキュメント読み順を整理する。

向いている理由:

- かなり長く実装が続いたため、次の大改修前に地ならしできる。

---

## 新チャット開始時の推奨初手

新チャットでは、いきなり次Phase指示書を作らず、まず以下を行う。

1. 上記「最初に読む順番」を読む。
2. `git status --short` で現在の差分を確認。
3. `tegaki_work/system/animation/animation-data-model.js` の内部Layer周辺を確認。
4. `tegaki_work/ui/animation-table-popup.js` のAsset Library / Internal Layer Inspector周辺を確認。
5. `dist/` 差分があれば除外。
6. 次Phaseを `Composite Preview` へ進めるか、`Virtual Layer Panel棚卸し` にするか判断する。

Geminiへ回してよい作業:

- 関連ファイル棚卸し。
- 小さく閉じたUI追加。
- レポート作成。
- `npm.cmd run build`。

Codexが見るべき作業:

- RenderTextureやPixi Containerを触るPreview合成。
- LayerSystem/通常レイヤーパネルを触る改修。
- 保存形式やAlbum/Exportに影響する改修。
- D&Dをレイヤーパネルや内部Layerに広げる改修。
- バグが起きた時の根本原因修正。

---

## 直近の確認結果

- Phase 4z9はCodex確認済み。
- `npm.cmd run build` 成功。
- 生成された `dist/` 差分は除外済み。
- 現在の `PROGRESS.md` は Phase 4z9完了状態。

