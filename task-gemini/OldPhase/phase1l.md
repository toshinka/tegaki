# Phase 1l — アルバム管理基盤拡張

> Phase 1k で UI アイコンと小ボタンの共通化は完了扱い。
> Phase 1l は、オーナーメモ追加分3を受けて、アルバムを「保存した絵が並ぶ場所」から「管理できる場所」へ少し進める。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0/` は参照のみ。通常作業では編集しない。
`dist/` は成果物として必要ない限り差分に残さない。

---

## 前提

- 標準描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- Phase 1l では描画、履歴、レイヤー構造、アニメ本体の挙動を変えない。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。
- `animationSystem.init()` は有効化しない。
- アルバム保存形式の大変更はしない。互換性が壊れそうな場合は Codex 判断へ戻す。

---

## 現状

主な対象：

- `tegaki_work/ui/album-popup.js`
- `tegaki_work/system/virtual-album.js`
- `tegaki_work/system/project-manager.js`
- `tegaki_work/ui/ui-icons.js`
- `tegaki_work/styles/main.css`

現状の注意：

- `AlbumPopup` は `localStorage` にスナップショット配列を保存している。
- `VirtualAlbum` は IndexedDB にアニメーション blob を保存する旧/別系統の仕組み。
- 現行のアルバム復元は `projectManager.exportProject()` / `loadProject()` に依存している。
- HTMLエクスポート/インポートは保存形式と互換性の影響が大きいため、初回で本実装しない。

---

## 目的

1. アルバムカードをドラッグで並べ替えられるようにする。
2. アルバムカードの選択状態を導入し、複数選択の土台を作る。
3. 個別削除/個別PNG保存の既存導線を壊さない。
4. 一括削除、一括エクスポート、アルバムHTML保存/読込の設計を記録する。
5. `AlbumPopup` と `VirtualAlbum` の責務差を明確にし、正本をどうするか判断材料を残す。

---

## 優先タスク

### 1. アルバム保存経路の棚卸し

確認する：

- `AlbumPopup._saveSnapshot()`
- `AlbumPopup._saveToStorage()`
- `AlbumPopup._loadSnapshots()`
- `AlbumPopup._renderGallery()`
- `ProjectManager.exportProject()`
- `ProjectManager.loadProject()`
- `VirtualAlbum`

`PROGRESS.md` に記録する：

- 現在のアルバム正本は localStorage か IndexedDB か。
- `VirtualAlbum` は現行UIで使われているか。
- HTMLエクスポート/インポートに必要なデータは何か。

### 2. ドラッグ並べ替え

実装候補：

- 既存依存の `sortablejs` を使う。
- `#albumGallery` 内のカードをドラッグ可能にする。
- 並べ替え後に `this.snapshots` の順番を更新し、`_saveToStorage()` で保存する。

受け入れ条件：

- アルバムカードをドラッグして順番変更できる。
- popupを閉じて開き直しても順番が維持される。
- カードクリックで復元する既存挙動が壊れない。
- ダウンロード/削除ボタンのクリックがドラッグや復元クリックと干渉しない。

### 3. 選択状態の土台

実装候補：

- `this.selectedSnapshotIds = new Set()` を `AlbumPopup` に持つ。
- カードに選択状態 class を付ける。
- `Ctrl+クリック` または `Shift+クリック` で複数選択できるようにする。
- 通常クリックは従来どおり復元にするか、選択モード時だけ選択にするかを検討する。

初回の推奨：

- まずは `Ctrl+クリック` で選択トグル。
- 通常クリックは復元のまま維持。
- 選択カードの見た目だけ実装し、一括操作ボタンは最小限または設計記録まで。

### 4. 一括操作とHTML保存の設計

初回で無理に実装しないもの：

- アルバム全体HTMLエクスポート。
- HTMLインポート。
- フォルダ/階層構造。
- ドラッグ範囲選択。

`NOTES.md` または `PROGRESS.md` に設計メモとして書く：

- HTMLに含めるべき情報：canvasサイズ、背景、layers、thumbnail、順番、作成日時、アプリバージョン。
- 画像だけではなく `projectData` を持つ必要がある。
- 大量データ時のファイルサイズ問題。
- 旧保存データとの互換性。

---

## 完了条件

- `npm.cmd run build` が成功する。
- Console に致命的エラーがない。
- アルバムカードの並べ替えが保存される。
- 既存のアルバム保存/復元/個別PNG保存/削除が壊れていない。
- 複数選択の土台がある、または実装困難なら理由が記録されている。
- HTMLエクスポート/インポートは、本実装したかどうかに関わらず設計メモが残っている。
- `dist/` 差分を成果物として残さない。

---

## Codex判断へ戻す条件

- localStorage から IndexedDB への移行が必要になる。
- 既存アルバムデータの互換性を壊す必要がある。
- `ProjectManager` の保存形式を変更する必要がある。
- ドラッグ操作がカードクリック復元と衝突して安定しない。
- 一括エクスポートやHTML保存が大きな設計変更を要求する。
