# Phase 4s — SAVE: Album IndexedDB 正本化MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4r2.md`
4. `task-gemini/phase4r2_report.md`
5. `tegaki_work/ui/album-popup.js`
6. `tegaki_work/system/project-manager.js`
7. `tegaki_work/system/emergency-recovery-store.js`
8. `tegaki_work/ARCHITECTURE.md` の「保存・エクスポート」
9. `tegaki_work/NOTES.md` のアルバム保存まわり

## 背景

現行アルバムは `localStorage` の `tegaki_album` が正本になっている。

各アルバム項目は `thumbnail` と `projectData` を持ち、`projectData.layers[].image` には PNG dataURL が入る。つまり1件あたりのデータが大きい。

実機確認では、10件程度で保存容量が厳しくなる兆候がある。今後アニメ ClipAsset / DrawingSnapshot / 複数レイヤー保存が増えると、`localStorage` 正本のままではかなり危ない。

Hospital Recovery は IndexedDB 正本にしたことで容量面の不安が減った。通常アルバムも IndexedDB 正本へ移す。

## 目的

アルバム保管の正本を `localStorage` から IndexedDB へ移行する。

Phase 4s は保存基盤のMVPであり、UI大改造や保存形式の大変更はしない。

## 基本方針

- 新規アルバム保存は IndexedDB に保存する。
- アルバム一覧は IndexedDB から読み込む。
- 削除、並べ替え、インポート後の追加も IndexedDB に反映する。
- 既存の `localStorage tegaki_album` は旧データの移行元として読む。
- HTMLエクスポート/インポート形式は現行維持する。
- Hospital Recovery の IndexedDB ストアとは混ぜない。

## 実装方針

### 1. 通常アルバム用 IndexedDB ストレージを新設

新規ファイル候補:

- `tegaki_work/system/album-storage.js`

責務:

- IndexedDB 初期化。
- Snapshot 一覧取得。
- Snapshot 追加。
- Snapshot 一括保存/並べ替え反映。
- Snapshot 削除。
- 旧 `localStorage tegaki_album` からの初回移行。

DB候補:

```js
dbName: 'TegakiAlbumStorage'
version: 1
storeName: 'snapshots'
keyPath: 'id'
index: 'timestamp'
```

API候補:

```js
async init()
async getAllSnapshots()
async addSnapshot(snapshot)
async putSnapshot(snapshot)
async putAllSnapshots(snapshots)
async deleteSnapshots(ids)
async importSnapshots(snapshots)
async migrateFromLocalStorage()
```

一覧順序は現行 `this.snapshots` の順序を維持できるよう、`order` フィールドを持たせる。

```js
{
  id,
  timestamp,
  order,
  thumbnail,
  currentFrame,
  frameStates,
  projectData
}
```

### 2. localStorage 旧データの移行

初回起動時、IndexedDB が空で、`localStorage.getItem('tegaki_album')` が存在する場合だけ移行する。

移行成功後:

- 旧データはすぐ削除しない。
- 事故防止のため `localStorage.setItem('tegaki_album_migrated', 'true')` 程度のフラグを置く。
- 旧 `tegaki_album` はバックアップとして残してよい。

注意:

- IndexedDB に既にデータがある場合は、localStorage から自動で重複追加しない。
- どうしても再移行が必要な場合は後続タスクで手動導線を作る。

### 3. AlbumPopup を非同期ストレージへ寄せる

現在の `AlbumPopup` は constructor で同期的に `_loadSnapshots()` している。

Phase 4s では、以下の形へ寄せる。

- constructor では `this.snapshots = []` のまま。
- `initializeStorage()` または `_loadSnapshots()` を async 化。
- `show()` の前後で IndexedDB 読み込みを完了させる。
- 読み込み中は gallery を壊さず、空表示でもよい。

候補:

```js
this._storageReady = this._initStorage();

async _initStorage() {
  await albumStorage.init();
  await albumStorage.migrateFromLocalStorage();
  this.snapshots = await albumStorage.getAllSnapshots();
}
```

`show()` では:

```js
await this._storageReady;
this._renderGallery();
```

ただし既存 `show()` が同期前提の呼び出し元から呼ばれる可能性があるため、`show()` 自体を async にしなくても、中で `.then()` して再描画する形でもよい。

### 4. `_saveToStorage()` を IndexedDB へ置き換える

既存の `_saveToStorage()` は `localStorage.setItem('tegaki_album', JSON.stringify(data))`。

Phase 4s では、以下へ変更する。

- 並べ替え時: `putAllSnapshots(this.snapshots)`。
- 追加時: `addSnapshot(snapshot)` または `putAllSnapshots(this.snapshots)`。
- 削除時: `deleteSnapshots(ids)`。
- インポート時: `importSnapshots(newSnapshots)`。

MVPでは `_saveToStorage()` を async 化し、内部で `albumStorage.putAllSnapshots(this.snapshots)` でもよい。

注意:

- `_saveToStorage()` 呼び出し元が同期のままでも破綻しないよう、必要なら fire-and-forget + catch で扱う。
- 保存失敗時は `console.error` と alert を出してよいが、旧 `localStorage` へ fallback 保存しない。容量問題を再発させるため。

### 5. HTMLエクスポート/インポートは現行維持

`_exportAlbum()` は `this.snapshots` から HTML を作るので、IndexedDB 読み込み後の配列を使えばよい。

`_handleAlbumImport()` は現行の `tegaki-album-data` JSON 読み込み互換を維持する。

インポート後の保存先は IndexedDB。

### 6. 通常アルバムと Hospital は分離

Hospital:

- `TegakiEmergencyRecovery`
- `snapshots`
- 最新1件

通常アルバム:

- `TegakiAlbumStorage`
- `snapshots`
- 複数件

この2つを混ぜない。

### 7. ARCHITECTURE / PROGRESS の更新

`ARCHITECTURE.md` の「アルバム保管」が `localStorage` 正本のままなので、Phase 4s 完了時に更新する。

更新方針:

- 現行UIでは `AlbumPopup` が担当。
- 正本は IndexedDB `TegakiAlbumStorage`。
- `localStorage tegaki_album` は旧データ移行元。
- HTML書き出し/読み込み形式は継続。
- `VirtualAlbum` はアニメーションblob用の未接続/別系統として残る。

## このPhaseでやらないこと

- アルバムUIの大改造。
- 複数世代バックアップUI。
- Hospital Recovery との統合。
- HTMLエクスポート形式の刷新。
- アニメ ClipAsset / DrawingSnapshot の正式保存形式設計。
- プロジェクトJSON圧縮。
- History圧縮。
- localStorage 旧データの自動削除。

## 注意点

- `localStorage` への新規保存 fallback を入れない。容量問題が再発する。
- `VirtualAlbum` は既存のアニメーションblob向け実装なので、通常アルバム正本として無理に流用しない。
- IndexedDB 処理は async なので、`show()` / `_renderGallery()` / Sortable `onEnd` のタイミングに注意する。
- 保存失敗時に `this.snapshots` だけ増えて IndexedDB に保存されない状態を避ける。失敗時はロールバックするか、明確にエラー表示する。
- `dist/` の生成物は作業対象にしない。

## 完了条件

- [ ] 通常アルバム用 IndexedDB ストレージが新設されている。
- [ ] 新規アルバム保存が IndexedDB に保存される。
- [ ] アルバム一覧が IndexedDB から復元される。
- [ ] 削除・並べ替え・インポート後追加が IndexedDB に反映される。
- [ ] 旧 `localStorage tegaki_album` から初回移行できる。
- [ ] `localStorage` への新規保存に依存しない。
- [ ] 既存HTMLエクスポート/インポートが維持される。
- [ ] Hospital Recovery と通常アルバムのDBが分離されている。
- [ ] `ARCHITECTURE.md` の保存・エクスポート記述を更新する。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4s_report.md` を作成し、移行仕様・残課題・容量面の改善範囲を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
