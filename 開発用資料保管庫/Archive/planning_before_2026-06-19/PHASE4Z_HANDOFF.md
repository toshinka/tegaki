# PHASE4Z HANDOFF — アニメテーブル / ClipAsset内部Layer基盤

作成日: 2026-05-25  
更新日: 2026-06-18
作業対象: `tegaki_work/`  
現在地: **Phase 4z26完了 — 次Phase調査待ち**

---

## 2026-06-18 新チャット用引き継ぎ

### 最初に読む順番

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_BOUNDARY.md`
5. `tegaki_work/PHASE4Z_HANDOFF.md`
6. `tegaki_work/ui/layer-panel-renderer.js`
7. `tegaki_work/system/layer-system.js`

過去の `task-gemini/phase4z*.md` / report群は、現在のTask5を進めるだけなら全読込不要。設計経緯が必要になった箇所だけ参照する。

### 現在地

- レイヤーパネル統合のTask1〜Task4は完了。
- **Task5「旧レイヤーパネル側の操作・生成経路をCAFカード基準へ寄せる」は完了扱い**。
- 旧SortableJSは撤去済み。旧Layer/FolderカードとCAF内部カードは共通Pointer D&D基盤を使用する。
- 外部レイヤーをフォルダ配下の子レイヤー間へ挿入する経路と、そのUndo/Redo復元を追加済み。
- 通常カード/CAF内部カードは、共通のrow model、class/data/style、button/name/meta/thumbnail/details/action、content parts生成へかなり寄っている。
- DOM版とHTML版は描画方式が異なるため、完全に同一関数へ無理に押し込まない。互換classとイベントselectorを壊さないことを優先する。
- `legacy-layer-card-*` / `clip-layer-mirror-*` の残存は、variant selector、カード種別固有配置、drop適用先モデル差として維持する。内部カード生成は共通DOM rendererへ統一済み。
- 静的構文確認とbuildは2026-06-18に成功。実機回帰確認は下記項目をオーナーが確認する。
- Task6でCAF内部名前編集の二重完了例外と、通常LayerのFolder投入History欠落を限定補修済み。
- マウスD&Dでは通常/CAF双方のFolder投入、CAF Folder内子順序変更、Undo/Redoを確認済み。残りは液タブペンでの同等確認。
- D&D実装はPointer EventsとPointer Captureを共通使用し、`pointerType` でmouse限定していない。液タブ確認はコード残作業ではなくオーナー受入項目。
- Task7ではPhase 4z26を閉じ、次は旧LayerSystem混線の追加棚卸しを第一候補とする。
- Task7の最初の棚卸しとして、アニメテーブル非表示時のLayer追加/複製を確認。モデル存在基準でCAF内部操作へ分岐し、通常Layerは生成されなかったため追加修正不要。
- Task8で、ProjectManager version 2の `animation` フィールドへTimelineModel全体を保存・復元する接続を追加。AlbumとHospital Recoveryも同じ `projectData` 経由でCAF対応になる。
- Task9で `animationState` を追加し、選択Clip/Lane/InternalLayer/playback scopeを有効IDだけ復帰。選択Clipがあればworking LayerをClipAssetから再構築する。
- Task10でAlbum実導線の保存→CAF内部Layer削除→ロードを実施し、内部階層、選択InternalLayer、ステータス表示の復元を確認。
- **Phase 4z26は完了扱い**。次はVキー変形/ClipInstance transform整合、またはCAF Composite出力を調査Taskとして開始する。
- 追加補修として、旧AlbumのFolder `children` 形式から子Layerの `parentId` を復元する互換map、import snapshotの旧projectData正規化を追加。
- 左サイドバー起点PopupはLayer Panelより上へ表示する。`.canvas-area` はstacking contextを作らず、`.popup-panel` はz-index 3000。

### Task5直近の実装入口

- 旧カードDOM生成: `_createLegacyLayerCardElement()`
- CAF内部カードHTML生成: `_createClipLayerMirrorCardHtml()`
- 共通row model: `_createLayerPanelCardRowModelFromOptions()`
- 共通content parts: `_createLayerPanelCardContentParts()`
- DOM反映: `_populateLayerPanelCardElement()`
- HTML反映: `_createLayerPanelCardRowHtmlFromParts()`
- 共通Pointer D&D開始: `_startLayerPanelCardDrag()`
- 旧カードdrop適用: `_applyLegacyLayerCardDropFromPointer()`
- CAF内部カードdrop適用: `_applyClipLayerMirrorCardDropFromPointer()`

### 次Phaseの初手

1. `git status --short --untracked-files=all` を確認する。
2. `PROGRESS.md` 先頭のTask10完了記録を読む。
3. オーナーが可能なら液タブペンD&Dを受入確認する。
4. 次の調査対象をVキー変形またはAlbum/Export Compositeから1つに限定する。
5. 調査結果を小Taskへ分けるまで、カードrendererや保存形式を変更しない。

### Task5完了前の回帰確認

- Layer/Folder/背景カードの表示と選択。
- ダブルクリック/F2名前変更。
- 可視、クリッピング、フォルダ開閉。
- マウスと液タブペンでのD&D。
- 同階層並べ替え、フォルダ投入、フォルダ子間挿入。
- Undo/Redo後の親子関係、順序、アクティブ状態。
- CAF内部カード側の同等操作に退行がないこと。

### 検証コマンド

```powershell
node --check tegaki_work\ui\layer-panel-renderer.js
node --check tegaki_work\system\layer-system.js
Set-Location tegaki_work
npm.cmd run build
```

build後は `tegaki_work/dist/` の生成差分を作業成果へ含めない。

---

## 2026-05-31 新チャット用クイック現況

新チャットでは、このセクションを読んだうえで `PROGRESS.md` の最新ログを正本として扱う。

### 現在の状態

- アニメ構造は、X=Frame / Y=Lane / Z=ClipAsset内部Layer/Folder の3次元マトリクス方針で進行中。
- Laneは通常Layerから完全独立済みではないが、`syncWithLayers()` の自動輸入は初回寄りに抑制され、独立Laneの作成/削除/履歴/名前編集の足場が入っている。
- ClipはFrame/Lane上の小さい箱として扱う方向へ移行中。新規Blank Clipは既存Z軸束をコピーせず、内部Layer 1枚から開始する。
- Layer PanelはCAF/内部Layerの反映表示と狭い内部編集入口。CAF自体のFrame/Lane移動、コピー、貼り付け、削除、Duration変更はアニメテーブルが正本。
- CAF表示と操作は大きく整理済み。CAF内部Layer/Folderの作成、削除、名前変更、開閉、D&D、可視/クリッピング、下結合、履歴化は概ね入っている。
- アニメテーブル側は、CAFセル移動、両端伸縮、押し出し伸縮、単セルペン用下部グリップ、伸縮/不可フィードバック、FPS/FRAMES、Timeline zoom、パネル位置/サイズ保存まで入っている。
- 右サイドバーの通常Layer/Folder追加や通常Layer操作は、アニメ文脈ではCAF内部操作へ寄せるか吸収し、CAF外通常Layer/Laneへ誤流入しないよう暫定ガード済み。
- `CAPTURE` / `AUTO` / `EDIT` / `UNIQUE` は現行UI上では退避または撤去済み。互換用内部経路が残っている箇所はある。

### 直近の描画系補修

- Phase 4z24/4z25で、Space+Pen移動、LazyBrush/筆圧周辺、点描時の描き始め不整合が調整された。
- 2026-05-31 Codex補修で、筆圧ONペンの開始点だけを `0.0` 固定にし、点描中に時々大きな `●` が出る経路を抑制した。
- `pointer-handler.js` の生pointerdownログは `TEGAKI_CONFIG.debug` 限定へ戻した。
- 古い `proposals/GEMINI_PEN_STARTUP_FIX.md` は、現在方針と逆向きで読み込みノイズになるため削除済み。

### 次に優先するなら

1. 通常レイヤーパネル統合: アニメテーブル展開前後で、通常Layer/FolderカードとCAF内部Layer/Folderカードの操作差・表示差を縮める。旧SortableJS D&DはCAF側Pointer D&Dを参考に置き換える候補。
2. 旧LayerSystem混線の追加棚卸し: テーブルを閉じた状態、保存/復元、Vキー変形、Album/Export、通常ショートカットがCAF正本から外れないか確認する。
3. 保存/復元と出力: TimelineModel / ClipAsset / ClipInstance / transformメタ / 内部Layer階層が保存やAlbum出力で落ちないか確認する。
4. 描画レスポンス確認: アニメテーブル表示中の描画遅延が残る場合、Pointer/LazyBrushより先にLayerPanel同期頻度とPreview再描画頻度を疑う。

### 新チャットで触る前の注意

- `PHASE4Z_BOUNDARY.md` を正本として、Layer Panel側へ大きく作り込まない。
- Geminiへは、CAF/Lane根幹、SortableJS、保存形式、RenderTexture合成、LayerSystem境界変更を丸投げしない。
- `task-gemini/` の古いPhase指示は履歴として読む。現在状態の正本は `PROGRESS.md` とこのHandoff。
- `画像資料/点描をしてると時々●が出現する.png` は、点描バグの実例資料として残す。

---

## 新チャットのCodexが最初に読む順番

必ずこの順番で読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_BOUNDARY.md`
5. `tegaki_work/PHASE4Z_HANDOFF.md`（このファイル）
6. `task-gemini/phase4n_preview_scope_note.md`
7. `task-gemini/phase4z6.md`
8. `task-gemini/phase4z6_report.md`
9. `task-gemini/phase4z7.md`
10. `task-gemini/phase4z7_report.md`
11. `task-gemini/phase4z8.md`
12. `task-gemini/phase4z8_report.md`
13. `task-gemini/phase4z9.md`
14. `task-gemini/phase4z9_report.md`
15. `task-gemini/phase4z10.md`
16. `task-gemini/phase4z10_report.md`
17. `task-gemini/phase4z11.md`
18. `task-gemini/phase4z11_report.md`
19. `task-gemini/phase4z12.md`
20. `task-gemini/phase4z12_report.md`
21. `task-gemini/phase4z13.md`
22. `task-gemini/phase4z13_report.md`
23. `task-gemini/phase4z14.md`
24. `task-gemini/phase4z14_report.md`
25. `task-gemini/phase4z15.md`
26. `task-gemini/phase4z15_report.md`
27. `task-gemini/phase4z16.md`
28. `task-gemini/phase4z16_report.md`
29. `task-gemini/phase4z17.md`
30. `task-gemini/phase4z17_report.md`
31. `task-gemini/phase4z18.md`
32. `task-gemini/phase4z18_report.md`
33. `task-gemini/phase4z19.md`
34. `task-gemini/phase4z19_report.md`
35. `task-gemini/phase4z20.md`
36. `task-gemini/phase4z20_report.md`
37. `task-gemini/phase4z21.md`
38. `task-gemini/phase4z21_report.md`
39. `task-gemini/phase4z22.md`
40. `tegaki_work/system/animation/animation-data-model.js`
41. `tegaki_work/ui/animation-table-popup.js`
42. `tegaki_work/ui/layer-panel-renderer.js`

補足:

- `phase4n_preview_scope_note.md` は、Preview / Frame Composite / 選択Clip単独表示 / Playback Scope の設計メモなので、今後アニメテーブル、Lane、Clip、Preview、Exportに触る時は必読。
- `phase4z6` 以降はClipAsset内部Layer基盤の連続作業なので、レポート込みで読む。
- `PHASE4Z_BOUNDARY.md` は、CAF / Lane / Layer Panel の責務ロック文書。Phase 4z22以降は必読。
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
- Clipの配置、削除、duration変更、D&D移動、COPY/PASTEが実装済み。
- `UNIQUE` ボタンと `makeClipAssetUnique()` は、Clipごとの小箱化が進んだためPhase 4z23で撤去済み。共有Asset判定は既存Clip表示の互換情報として残す。
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
- Blank/CAPTURE/Auto-Seed時の内部Layer生成/補完。
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

### Layer Panel CAF表示と選択ブリッジ

Phase 4z15〜4z21で以下が完了。

- 現在FrameのCAF/ClipAsset概要をLayer Panel上部へ表示する簡易CAF表示を追加。
- CAF表示内のAssetクリックから、アニメテーブル上の該当Clipを選択する橋渡しを追加。
- 選択中ClipAssetの内部LayerをLayer Panel側へミラー表示。
- 内部Layerミラーから、select / visible toggle / clipping toggle をアニメテーブル側へ同期。renameはカード面ではなく既存の属性/Inspector系導線へ寄せる。
- 濃紺カード風の表示はPhase 4z20で弱め、通常Layer Panelへ馴染む簡素表示へ寄せた。
- CAF自体の移動、コピー、削除、Frame/Lane移動はLayer Panel側へ持たせない方針をPhase 4z21で確認。
- Phase 4z21後、`render()` 末尾からのLayer Panel同期emitは更新ループ化し得るためCodexが削除し、構造変更箇所の明示同期へ寄せた。

注意:

- Layer Panel側CAF表示はまだ過渡的な反映表示であり、最終UIではない。
- 以後のLayer Panel追加改修は `PHASE4Z_BOUNDARY.md` に従い、Codex判断なしで広げない。

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

### CAF / Lane / Layer Panel 境界ロック

Phase 4z22以降は `PHASE4Z_BOUNDARY.md` を正本として扱う。

- アニメテーブルは、CAF / ClipInstanceの作成、削除、移動、コピー、Frame/Lane配置の正本。
- Layer Panelは、現在FrameのCAF反映表示と、CAF内部Layer編集の入口。
- CAF名とLane番号は別概念。CAFはLane間を移動できるため、CAF番号とLane番号を同一視しない。
- Layer Panel側でCAF自体のD&D、コピー、削除、Frame/Lane移動UIを作らない。
- GeminiにはLayer Panel構造変更、`syncWithLayers()` 根本変更、EventBus追加、保存形式変更、SortableJS変更を任せない。

---

## 既知の注意点

- `animation-table-popup.js` はかなり肥大化している。大きなDOM/CSS置換は危険。
- CSS注入ブロックの重複が増えている。見た目の大整理は後でまとめて行う方がよい。
- ClipAssetFolder UIはMVP状態。保管庫としての最低限の操作はできるが、Timeline配置やD&Dは未実装。
- 内部Layer合成Previewは入ったが、内部Layerへの実描画やVirtual Layer Panelは未実装。
- レイヤーパネルにCAF相当の上位概念を表示する簡易処理は入ったが、過渡表示であり最終UIではない。
- CAF表示用のデータ取得ヘルパーは `getFrameAssetTree()` として実装済み。
- Asset LibraryやInspectorは作業用UIで、最終UIではない。
- レイヤーパネルD&D系の既知不安定が過去にあった。D&D追加は慎重に。
- `dist/` はビルドで変わるが成果物に含めない。確認後は差分除外する。

---

## 次にやる候補

直近完了Phaseは `task-gemini/phase4z22.md`。

Phase 4z22は実装ではなく調査専用として完了済み。

目的:

- `syncWithLayers()` と `sourceLayerId` 依存を棚卸しする。
- `Lane = 通常Layer由来` から独立Laneへ移るための危険箇所を整理する。
- 次の小Phase候補を、Codex担当 / Gemini担当に分ける。

4z22ではLayer Panel、CSS、DOM、保存形式、EventBus、SortableJS、Lane独立化本実装を触らない。

4z22の結論:

- `syncWithLayers()` によりLaneは通常Layerの数、順序、名前に強く依存している。
- `sourceLayerId` はClip作成、CAPTURE、AUTO、PREVIEW、Clip移動、COPY/PASTEに広く使われている。
- Lane独立化は表示名だけの問題ではなく、描画先とSnapshot取得元の切り離しが最大リスク。
- 次はCodex側で、独立Laneの最小モデル変更をするか、先にClip生成/描画ターゲットの安全な中継案を作るか判断する。

Phase 4z23 Codex実装:

- `syncWithLayers()` に初回同期済みフラグを追加し、アニメテーブル初回同期後に通常Layerを増やしても次回表示時に新規Laneへ輸入しないようにした。
- CAF内部Layerミラーの幅を通常Layerカードと同じ160pxへ戻し、可視ボタンを既存 `UI_ICONS.eye/eyeOff` に統一。ホバーリネームはカード面から外し、紙クリップを内部Layerの即時クリッピング操作へ寄せた。
- アニメテーブル表示中の右サイドバー `+` は通常Layer作成へ流さず、選択中ClipAssetの内部Layer追加に分岐する。Clip未選択時は通常作業Layerを増やさない。
- アニメテーブル表示中の右サイドバーFolder `+` は通常Folder作成へ流さない。CAF内部Folderの正式操作は未設計なので、現時点では誤生成防止を優先する。
- CAF配下の内部Layerミラーは、細いメタ情報行ではなく通常Layerカードに近いサムネイル/透明度/名前/クリッピング/可視ボタン構成へ寄せた。
- 内部Layerの既定名は `レイヤー1` / `レイヤーN` へ寄せ、英字/カナ混在を抑制した。
- アニメテーブル内の閉じるボタンだけ `position: static` に戻し、`LIB` ボタンとの重なりを解消した。
- `syncWithLayers()` は初期同期後に新規通常Layer/FolderからLaneを自動生成しない。Lane追加はアニメテーブル内のLane `+` が正本。
- CAF行を通常フォルダ風に戻し、`CAF1` 名、左フォルダアイコン、右側Lane表示へ変更。内部LayerミラーにはSnapshotサムネイルを表示する。
- `ANIMATION TABLE` 表記を削除し、COPY/PASTEをSVGアイコンボタン化。Asset Libraryボタンは `LIB` へ短縮した。
- 通常Layer Panel側の通常フォルダは、アニメテーブルのLane一覧/Timelineグリッドから除外した。通常フォルダはX/Y盤面ではなくClip内部Z軸側の概念として扱う。
- アニメClip選択中は通常作業レイヤー行をLayer Panelに出さず、CAFの下に内部Layerミラーだけを表示する。内部Layerミラーには左アクセント線を追加した。
- アニメテーブル初回表示直後にLayer Panel同期を明示発火し、Frame/Lane移動を挟まないとCAFが出ない経路を抑制した。
- `CAPTURE` / `AUTO` / `EDIT` は、現在の自動保存・Scope設計ではUI上の意味が曖昧になったため表示から外した。互換用の内部メソッドは残している。
- アニメテーブルの濃いMaroonヘッダーを淡いヘッダーへ変更し、中央操作の文字重なりと `ASSETS` 文字切れを軽減した。
- `PHASE4Z_BOUNDARY.md` に、X=Frame / Y=Lane / Z=ClipAsset内部Layer/Folder の3次元マトリクス概念を追記した。BackgroundはX/Y軸のLaneではなく、Z軸最下層の基底要素として扱う。
- アニメテーブルのLane一覧/Timelineグリッド/Preview合成/Clip配置対象からBackgroundを除外した。独立Lane追加時もBackgroundの下ではなく手前に挿入する。
- `getFrameAssetTree()` のLane番号計算からBackground/Folderを除外し、Layer PanelのCAF補助表示を実際のアニメLane番号へ寄せた。
- アニメClip選択中は、Clip同期で余った非表示の通常作業レイヤー行をLayer Panelへ出さない。Layer Panel上の表示は内部Layerミラー側へ寄せる。
- 新規Blank ClipAssetの初期内部Layer名を `レイヤー1` に変更し、英字/カナ混在を抑制。
- 空セルへのClip作成と既存Clip削除は `Alt + クリック` のトグルへ統一。`Alt + ↑/↓` でアクティブLaneを移動する足場を追加。
- Preview中にCAPTURE対象が空になる問題を補修。Previewは実レイヤーを一時的に隠すため、ClipAssetへの取り込みは `layer.visible` ではなく `layerData.visible` を基準にする。
- 選択Clipがある状態では、AUTOチェックの有無に関わらず描画完了時に作業レイヤー内容を選択ClipAssetへ保存する。
- 対象Lane/FrameにClipがない場合、通常作業レイヤーをすべて非表示にし、Layer Panel側もアニメテーブル表示中かつ選択Clipなしなら通常作業レイヤー行を出さない。
- Frameヘッダー移動、左右キー移動、別Clip選択、再生開始前に、現在選択中Clipへ作業レイヤー内容を退避するようにした。Frame移動だけで未保存描画が消える経路を抑制。
- 空セルの通常クリックではClipを作らない。既存Clipは通常クリックで選択、空セルへの新規Blank Clip作成と既存Clip削除は `Alt + クリック` のトグルに限定。
- 選択中Laneを `activeLaneId` として保持し、Frame移動・Clip選択・Clip新規作成時に、対象ClipAssetの内部Layerを通常作業レイヤーへ復元する暫定同期を追加した。
- 対象Lane/FrameにClipがない場合は、作業レイヤーを空にして前Frameの内容を残さないようにした。これは最終的なVirtual Layer Panelではなく、Frame/Laneごとの「小さい箱」思想へ寄せるための橋渡し。
- Preview Scopeの意味を補修。選択ClipがあってもALLは現在Frame全体合成を維持し、選択Clip単独表示へ勝手に切り替えない。
- Onion Skinも選択Clipだけに固定せず、現在のScopeに従って前後Frameを合成する。
- Layer Panelの `CLIP LAYERS` ミラーは、アニメテーブル上で選択中のClipAssetがある場合だけ表示する。Asset Library選択だけでは表示しない。
- 初回Seed時に、現在表示中の通常レイヤー群を1つのClipAsset内部Layer構造へ取り込むようにした。LaneはアニメテーブルY軸、通常レイヤー群はClip内Z軸という方向へ寄せた。
- 別Frame/Laneへ新規作成するClipは既存Z軸束をコピーせず、Blank ClipAsset（内部Layer 1枚）から始める。
- `CAPTURE` はLane元レイヤー1枚ではなく、現在表示中の通常レイヤー束を選択ClipAssetの内部Layer群として更新する。
- 複数内部Layerを持つClipAssetのPreviewでは、Lane元レイヤーのopacity/blendModeを重ね掛けせず、各内部Layerのopacity/blendModeで合成する。
- `ClipInstance.visible` と `ClipAssetInternalLayer.clipping` をモデルへ追加。Layer Panel上のCAF目アイコンでClip単位の表示/非表示、内部Layer紙クリップでクリッピングON/OFFを切り替えられる。これはScope SETとは別の表示制御。
- Clipを別Lane/Frameへドラッグ移動した直後に、`currentFrame` / `activeLaneId` / `selectedCelId` / 作業Layer復元を移動先へ同期するよう補修。移動直後にキャンバスとLayer Panelが別Frame/Laneを参照する経路を抑制した。
- アニメテーブルを閉じる前に選択Clipへ作業Layer内容を保存し、閉じた後にLayer Panelへ再同期通知を出すよう補修。
- ONION/PREVIEWチェック後にチェックボックスへフォーカスが残り、左右キーでFrame移動できない経路を抑制。変更直後にblurし、この2つのチェックボックスに限り左右キー処理を通す。
- ClipAsset同期に使う通常Layerへ `isAnimationWorkingLayer` を付与し、Layer Panelではアニメテーブルモデルが存在する間はその作業バッファ行を表示しない。CAF内カードを正本に寄せ、CAF外の旧カードへD&D等を積まない方針。
- アニメテーブルを一度開いてモデル/ClipAssetが存在する状態では、テーブルを閉じていても右サイドバーのレイヤー `+` / フォルダ `+` を通常Layer/Folder作成へ流さない。CAF外通常Layerが次回表示時にCAFへ吸われる/ゴースト化する入口を絞るための暫定ガード。
- Layer Panelのサムネイル更新は `data-layer-index` 一致のDOM行へ反映する。アニメ作業Layerを非表示にしてDOM行数が減った時、全レイヤー逆順indexで背景カードへ誤反映される経路を抑制済み。
- CAF内部Layerミラー/Inspectorで内部Layerを選択した時は、対応する一時作業LayerをLayerSystem側のアクティブLayerにも同期する。ClipAsset再キャプチャ時は内部Layer IDが再生成されるため、選択はIDではなく配列位置で引き継ぐ。
- アニメテーブルを閉じていても選択Clipが残っている場合は、描画完了時にClipAssetへ保存し、Layer Panel更新を要求する。テーブル非表示時の描画反映遅れを抑制するための暫定同期。
- `LaneModel` に `displayName` / `sourceName` / `kind` / `orderIndex` / `sourceMissing` / `isBackground` を追加。
- `TimelineModel.createIndependentLane()` を追加し、`sourceLayerId: null` のアニメ専用Laneをモデル上で作れる足場を用意。
- `syncWithLayers()` を完全置換型から非破壊同期寄りへ変更し、独立Laneと、元Layerが消えてもClipを持つLaneを保持する。
- `TimelineModel.getLaneDisplayName()` を追加し、Timeline表示とAsset名生成が通常Layer名へ戻らないようにした。
- アニメテーブルのLaneヘッダーに `+` を追加し、独立Laneを手動追加できる最小UIを入れた。
- 独立Lane上にはBlank Clipを配置できる。ただし実レイヤー由来の `CAPTURE` と `EDIT` はまだ成立しないため、EDITは無効化し、CAPTUREは警告して中断する。
- まだLane削除/並べ替えUI、Clip生成の完全な `sourceLayerId` 脱却、Virtual Layer Panel、描画ターゲット切替は未実装。

---

## 新チャット開始時の推奨初手

新チャットでは、いきなり次Phase指示書を作らず、まず以下を行う。

1. 上記「最初に読む順番」を読む。
2. `git status --short` で現在の差分を確認。
3. `tegaki_work/system/animation/animation-data-model.js` の内部Layer周辺を確認。
4. `tegaki_work/ui/animation-table-popup.js` のAsset Library / Internal Layer Inspector周辺を確認。
5. `dist/` 差分があれば除外。
6. `PHASE4Z_BOUNDARY.md` を読み、Layer Panel側へ不用意に作業を広げない。
7. Phase 4z22の結果がある場合は、`phase4z22_report.md` を読んでLane独立化の次手を判断する。

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

- Phase 4z26はCodex実装継続中。CAF/Lane/Layer Panelの境界整理、Clip小箱化、CAF内部Layer/Folder編集、CAFセルD&D/伸縮、History/Ghost抑制、UIレスポンス調整が大きく進んだ。
- Phase 4z24/4z25はGemini実装とCodex補修により、Space+Pen移動と筆圧/点描周辺を調整済み。
- `npm.cmd run build` は2026-05-31時点で成功。
- 生成された `dist/` 差分は除外済み。
- 現在の `PROGRESS.md` は Phase 4z26 の詳細ログが最新。
