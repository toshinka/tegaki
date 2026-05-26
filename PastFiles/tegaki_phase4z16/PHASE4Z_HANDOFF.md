# PHASE4Z HANDOFF — アニメテーブル / ClipAsset内部Layer基盤

作成日: 2026-05-25  
更新日: 2026-05-26
作業対象: `tegaki_work/`  
現在地: **Phase 4z14 — Frame Asset Tree Helper 完了**

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
14. `task-gemini/phase4z10.md`
15. `task-gemini/phase4z10_report.md`
16. `task-gemini/phase4z11.md`
17. `task-gemini/phase4z11_report.md`
18. `task-gemini/phase4z12.md`
19. `task-gemini/phase4z12_report.md`
20. `task-gemini/phase4z13.md`
21. `task-gemini/phase4z13_report.md`
22. `task-gemini/phase4z14.md`
23. `task-gemini/phase4z14_report.md`
24. `tegaki_work/system/animation/animation-data-model.js`
25. `tegaki_work/ui/animation-table-popup.js`

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
- Previewは、内部Layerが有効な場合は `ClipAsset.internalLayers` を合成表示し、使えない場合は `ClipAsset.drawingSnapshotId` / `TimelineModel.getSnapshotForCel()` へfallbackする。
- ClipAssetFolderは純データに加え、Asset Library上でフォルダ作成・リネーム・Asset移動・件数表示ができるMVP状態。
- 現在FrameのClipAsset/CAF構造は `TimelineModel.getFrameAssetTree(frameIndex, options)` で純データとして取得できる。
- Laneはまだ通常Layer由来の暫定行であり、最終的な「キャラクター/素材 x 時間」の2次元マトリクスではない。

### ClipAsset内部Layer

Phase 4z6〜4z10で以下が完了。

- `ClipAssetInternalLayerModel` 追加。
- `ClipAssetModel.internalLayers` のモデル化とserialize対応。
- Blank/CAPTURE/Auto-Seed/Make Unique時の内部Layer生成/補完。
- Asset Library内にInternal Layers Inspector追加。
- 内部Layerの追加、削除、リネーム、visible切替。
- 最後の内部Layer削除ガード。
- 内部Layerの上下順序変更。
- Preview時に内部Layerを末尾から先頭へ合成表示し、配列先頭が前面に見えるようにした。
- `visible` / `opacity` / `blendMode` がPreviewに反映される。

順序方針:

- Inspector表示では、配列先頭が上/前面。
- Previewでは末尾から描画して先頭を前面にする方針を実装済み。

### ClipAssetFolder UI

Phase 4z11で以下が完了。

- Asset Library左列を `ASSET FOLDERS` として表示。
- `Uncategorized` とユーザー作成フォルダを表示。
- フォルダごとのAsset件数を表示。
- Asset Folderの新規作成とリネーム。
- `Uncategorized` のリネーム禁止。
- 選択Assetを任意Folderまたは `Uncategorized` へMOVE。
- フォルダ切替・新規作成時のAsset/InternalLayer選択クリア補修。

未実装:

- Asset/Folder D&D。
- Folder削除。
- ClipAssetをFolderからTimelineへ配置する処理。
- Laneを通常Layer依存から切り離す処理。

### Frame Asset Tree

Phase 4z14で以下が完了。

- `TimelineModel.getFrameAssetTree(frameIndex, options)` を追加。
- 指定FrameのClipInstanceをTimeline Y軸順に抽出。
- ClipInstanceの `assetId` からClipAssetを解決。
- ClipAssetの `folderId` からClipAssetFolderへgroup化。
- `Uncategorized` groupと `missingAssets` を返す。
- UI非依存の純データヘルパーで、レイヤーパネルCAF表示やVirtual Layer Panelの共通入力にできる。

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

### ClipAssetFolder と Lane の関係

最終的には、通常レイヤー/通常フォルダを直接Laneの正本として扱うのではなく、ClipAssetFolder内のClipAsset/内部Layerを時間軸上に配置する方向へ進む。

- ClipAssetFolderは「犬」「猫」「背景素材」などをまとめる保管庫/作業単位になる候補。
- ClipAssetはそのフォルダ内の素材本体。
- ClipAsset内部Layerは、その素材の線画/塗り/影などを持つ。
- Timeline/Laneは、それらのClipAssetを時間方向へ配置・再生するための表になる。
- 現在のLane = LayerSystem実レイヤー対応は移行用の暫定足場であり、最終仕様として固定しない。

### レイヤーパネルへの将来表示

最終的には、そのフレーム上にあるClipAssetFolderまたはそれに相当する上位単位が、レイヤーパネル側にも表示される。

- レイヤーパネルでは、通常フォルダのさらに上位概念としてCAF相当のフォルダが見える想定。
- CAF配下にClipAsset、その内部に線画/塗り/影などの内部Layerがある。
- 通常フォルダとCAFを混同しないよう、濃い色、別系統の色、英字ラベルなどで視覚的に区別する候補がある。
- ただし、レイヤーパネル側表示は一気に実装しない。まずは棚卸し、表示骨格、疎通確認の小Phaseへ分ける。

---

## 既知の注意点

- `animation-table-popup.js` はかなり肥大化している。大きなDOM/CSS置換は危険。
- CSS注入ブロックの重複が増えている。見た目の大整理は後でまとめて行う方がよい。
- ClipAssetFolder UIはMVP状態。保管庫としての最低限の操作はできるが、Timeline配置やD&Dは未実装。
- 内部Layer合成Previewは入ったが、内部Layerへの実描画やVirtual Layer Panelは未実装。
- レイヤーパネルにCAF相当の上位概念を表示する処理は未実装。
- CAF表示用のデータ取得ヘルパーはあるが、まだレイヤーパネルDOMには接続していない。
- Asset LibraryやInspectorは作業用UIで、最終UIではない。
- レイヤーパネルD&D系の既知不安定が過去にあった。D&D追加は慎重に。
- `dist/` はビルドで変わるが成果物に含めない。確認後は差分除外する。

---

## 次にやる候補

次Phase指示書は新チャットのCodexが、最新ファイル確認後に作るのが望ましい。

候補は以下。

### 候補A: Phase 4z12 — ClipAsset / Lane Migration Plan

目的:

- 現在の `Lane = 通常Layer由来` の暫定構造から、ClipAssetFolder / ClipAsset / 内部Layerを時間軸へ置く将来構造への移行計画を作る。

向いている理由:

- 4z11で保管庫UIが最低限使えるようになったため、次はいきなり実装せず、Y軸/Lane表示・CAF配置・内部Layer編集の境界を整理する価値が高い。

注意:

- Gemini Flashに丸投げするより、Codexが設計整理してから小さな実装Phaseへ切る方が安全。

### 候補B: Phase 4z12 — Virtual Layer Panel Plan / Shelf

目的:

- 通常レイヤーパネルをClipAsset内部Layer編集へ切り替えるための接続点を棚卸しする。

向いている理由:

- 高リスクなので、先に棚卸しと設計メモを作る価値が高い。
- レイヤーパネルは過去にD&D/表示更新周りで問題が出たため、いきなり実装しない方がよい。

### 候補C: Phase 4z12 — Animation Table Handoff / Cleanup

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
6. 次Phaseを `ClipAsset / Lane移行設計` へ進めるか、`Virtual Layer Panel棚卸し` にするか判断する。

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
- Phase 4z10はCodex確認済み。内部Layerの壊れたSnapshot参照では従来Previewへfallbackする補修済み。
- Phase 4z11はCodex確認済み。新規フォルダ作成時の選択クリアとMOVE番号入力検証を補修済み。
- Phase 4z12はCodex確認済み。編集対象の正本はCAF/ClipAsset側へ寄せ、将来はCAF相当の上位概念をレイヤーパネルにも表示する前提を報告書へ追記済み。
- Phase 4z13はCodex確認済み。次はレイヤーパネルDOMへ入る前に、現在FrameのClipAsset/CAFツリーを返す純データヘルパーを優先する判断。
- Phase 4z14はCodex確認済み。`getFrameAssetTree()` はUI非依存の純データヘルパーとして実装済み。
- `npm.cmd run build` 成功。
- 生成された `dist/` 差分は除外済み。
- 現在の `PROGRESS.md` は Phase 4z14完了状態。
