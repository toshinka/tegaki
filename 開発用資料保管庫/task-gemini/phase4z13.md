# Phase 4z13 — CAF Layer Panel Display Plan

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z11.md`
7. `task-gemini/phase4z11_report.md`
8. `task-gemini/phase4z12.md`
9. `task-gemini/phase4z12_report.md`
10. `tegaki_work/system/animation/animation-data-model.js`
11. `tegaki_work/ui/animation-table-popup.js`
12. `tegaki_work/ui/layer-panel-renderer.js`
13. `tegaki_work/system/layer-system.js`

## 重要な注意

- 今回は **レイヤーパネルへCAF相当の上位概念を表示するための設計棚卸し** だけを行う。
- JS/CSSの実装変更はしない。
- レイヤーパネルDOMを変更しない。
- 通常レイヤーパネルをClipAsset内部Layer表示へ切り替える実装は今回しない。
- ClipAssetFolder / ClipAsset / 内部Layerへの直接描画は今回しない。
- Timeline Y軸を `Lane 1 / Lane 2...` へ変更しない。
- `syncWithLayers()`、LayerSystem、SortableJS D&D、保存/復元形式は変更しない。
- `animation-table-popup.js` と `layer-panel-renderer.js` は肥大化・高リスクなので、問題を見つけても勝手に修正しない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z12で、以下の設計前提が明確になった。

- 編集対象の正本は、最終的には通常レイヤーではなく ClipAssetFolder / ClipAsset / ClipAssetInternalLayer 側へ寄せる。
- そのフレーム上に存在する ClipAssetFolder またはそれに相当する上位単位は、将来的にレイヤーパネル側にも表示される。
- レイヤーパネル上では、通常フォルダのさらに上位概念として ClipAssetFolder 相当のフォルダが見える想定。
- 通常フォルダとCAFを混同しないため、色・ラベル・別系統の表示などで視覚的に区別する必要がある。

ただし、現行の `layer-panel-renderer.js` は通常Layer / 通常Folder / SortableJS D&D / active操作 / opacity / clipping / thumbnail が密接に絡んでいる。

そのため、いきなりCAFをレイヤーパネルへ実表示すると、通常描画・レイヤーD&D・フォルダ開閉が壊れるリスクが高い。

Phase 4z13では、実装前にレイヤーパネル側の表示方針と疎通点を棚卸しする。

## 目的

CAF相当の上位概念をレイヤーパネルに表示するための、最小実装前の設計メモを作る。

目的は以下。

- 現行レイヤーパネルの通常Folder表示構造を把握する。
- CAFを通常Folderより上位概念として表示する場合のDOM/CSS候補を整理する。
- 通常FolderとCAFを視覚的に区別する案を出す。
- いきなり実装してはいけない危険箇所を明確にする。
- 次に進める小Phase候補を作る。

## 今回やること

### 1. 現行レイヤーパネルの表示構造を棚卸しする

以下を中心に読む。

- `ui/layer-panel-renderer.js`
  - `render()`
  - `createFolderElement()`
  - `createLayerElement()`
  - `createFolderThumbnail()`
  - `_createFolderToggleIcon()`
  - `_calculateIndentLevel()`
  - SortableJS初期化とfolder D&D関連
- `system/layer-system.js`
  - `createFolder()`
  - `addLayerToFolder()`
  - `moveLayerIntoFolder()`
  - `toggleFolderExpand()`
  - `getFolderChildren()`
  - `LayerModel`の `isFolder` / `parentId` / `children` 利用箇所

報告書に以下を書く。

- 通常Layer行と通常Folder行のDOM構造。
- 通常Folderの開閉状態・子行表示・インデントがどこで決まるか。
- D&DがどのDOM属性やclassに依存しているか。
- CAF表示を混ぜると危険な箇所。

### 2. CAF表示の候補を3案出す

以下の3案を比較する。

#### 案A: レイヤーパネル内に読み取り専用CAFヘッダーを出す

- 選択中Frameに存在するCAF/ClipAssetを、通常Layer一覧の上または区切り内に読み取り専用で表示する。
- まだクリックしても通常Layer構造は変えない。

#### 案B: 通常Folderに似たCAF行を出すが、D&D対象外にする

- `.layer-item` とは別classにする。
- 通常Folderより濃い色、別系統色、`CAF` ラベルなどで区別する。
- 開閉UIだけ試す可能性はあるが、LayerSystemのfolderとは別物として扱う。

#### 案C: 別パネル/サブセクションとして `Frame Assets` を出す

- 既存LayerPanel本体を触らず、同じ右サイドバー内に小さなセクションを追加する。
- CAF表示の実験としては安全だが、最終的なレイヤーパネル統合からは一段遠い。

報告書に以下を書く。

- 各案の利点。
- 各案の危険。
- Gemini Flashで実装してよい最小範囲。
- Codex判断へ戻すべき範囲。

### 3. 視覚区別案を出す

通常FolderとCAFを混同しないための見た目案を出す。

候補:

- 通常Folderより濃い背景色。
- 通常Folderとは別系統のアクセント色。
- `CAF` / `ASSET` / `CLIP` など短い英字ラベル。
- フォルダアイコンとは別アイコン。
- インデントや左線の太さで上位概念を示す。

注意:

- 実装はしない。
- 色は既存パレットから大きく外しすぎない。
- ただし通常Folderとの差が分かることを優先する。

### 4. 表示対象のデータ解決案を書く

レイヤーパネルにCAF相当を表示する時、どのデータから表示対象を取るか整理する。

候補:

- 現在Frameに存在するClipInstanceを集める。
- 各ClipInstanceの `assetId` からClipAssetを取得する。
- ClipAssetの `folderId` からClipAssetFolderを取得する。
- `Uncategorized` Assetは仮フォルダ扱いにするか、単独ClipAssetとして表示するか検討する。

報告書に、最小表示用の疑似手順を書く。

例:

```text
currentFrame
  -> tracks/laneを走査
  -> frameに存在するClipInstanceを収集
  -> assetIdでClipAsset取得
  -> folderIdでClipAssetFolderごとにgroup化
  -> CAF行 / ClipAsset行 / InternalLayer行の候補を作る
```

### 5. 次の小Phase候補を出す

次に実装できる小Phase候補を3つ出す。

候補例:

1. `Phase 4z14 — Layer Panel CAF Readonly Header`
   - 選択FrameにあるCAF/ClipAssetを、レイヤーパネル上部に読み取り専用で表示する。
   - D&D、編集、内部Layer切替はしない。

2. `Phase 4z14 — Frame Asset List Helper`
   - `AnimationTablePopup` または `TimelineModel` に、現在FrameのClipAsset一覧を返す純データヘルパーだけを追加する。
   - UIはまだ変えない。

3. `Phase 4z14 — CAF Visual Token CSS Draft`
   - 実DOMは増やさず、CAF行に使うCSS class候補だけを設計メモ化する。

Geminiは候補を出すだけで、実装しない。

### 6. 危険箇所と禁止すべき一括変更を書く

報告書に、次に絶対やらない方がよいことを書く。

例:

- `.layer-item` をCAFにも流用してSortableJS対象にする。
- LayerSystemの `LayerModel.isFolder` をCAFにも使う。
- 通常Folderの `parentId` / `children` にClipAssetやInternalLayer IDを混ぜる。
- レイヤーパネルのD&DへCAFを同時に入れる。
- CAF表示と内部Layer直接描画を同時に入れる。
- 保存形式を同時に変更する。

## 今回作る成果物

以下の報告書を作成する。

- `task-gemini/phase4z13_report.md`

この報告書は、次のCodex判断に使う設計メモであり、実装完了報告ではない。

報告書の推奨構成:

```md
# Phase 4z13 — CAF Layer Panel Display Plan (GEMINI報告)

## 1. 現行レイヤーパネル構造

## 2. CAF表示案 A/B/C

## 3. 視覚区別案

## 4. 表示対象データの解決案

## 5. 次の小Phase候補

## 6. 危険箇所・禁止すべき一括変更

## 7. Codexに判断してほしい点
```

## 今回やらないこと

- JS/CSSの実装変更。
- レイヤーパネルDOM変更。
- CAFの実表示。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- Timeline Y軸変更。
- Laneデータモデル変更。
- D&D追加。
- 保存/復元形式変更。

## 受け入れ条件

- `task-gemini/phase4z13_report.md` が作成される。
- 現行レイヤーパネルの通常Layer/通常Folder表示構造が具体的なメソッド名つきで整理されている。
- CAF表示案が3つ以上あり、それぞれ利点・危険・実装可能な最小範囲が書かれている。
- 通常FolderとCAFを視覚的に区別する案が複数書かれている。
- 現在FrameからCAF/ClipAsset表示対象を解決する疑似手順が書かれている。
- 次の小Phase候補が3つ以上ある。
- 危険な一括変更が明記されている。
- `tegaki_work/PROGRESS.md` の最上部にPhase 4z13の棚卸し完了ログが追記される。
- コード変更をしていないこと。もし必要に迫られて変更した場合は、その理由と変更ファイルを明記すること。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z13 棚卸し完了ログを追記する。

最低限、以下を書く。

- Phase 4z13 の目的。
- 読んだ主なファイル。
- 作成した報告書。
- CAF表示案の要約。
- 次の小Phase候補。
- Codexに判断してほしい点。

