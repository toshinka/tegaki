# Phase 2 Handoff

> 新チャット用の短い引き継ぎ。最初に `TEGAKI.md`、`tegaki_work/PROGRESS.md`、このファイル、`task-gemini/phase2.md` を読む。

---

## 現状

- 作業対象は `tegaki_work/`。
- Phase 1m まで完了扱い。
- 描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- ペン/消しゴム筆圧、履歴、リサイズ、PNG出力、アルバムHTML書き出し/読み込みは基礎復旧済み。
- アニメ本体は未接続。`animationSystem.init()` は有効化しない。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結中。

---

## Phase 1m の完了内容

- アルバムは `localStorage` の `tegaki_album` を正本として運用。
- `現在の状態を保存` で現在のキャンバスをアルバムへ追加。
- アルバムカードクリックで `projectData` から復元。
- アルバムHTML書き出しは、サムネイル表示と `tegaki-album-data` JSONをHTML内に埋め込む。
- アルバム読み込みは新HTML形式と旧JSON形式に対応。
- アルバム選択は一括削除/一括書き出し用。popupを閉じると選択解除。
- ドラッグ並べ替えは動作するが、Windows風の半透明ホバー追従には未達。必要なら後続で独自ドラッグUIとして扱う。

---

## Phase 2 の主題

レイヤー/UI編集基盤。

優先順：

1. レイヤーパネルの責務と表示密度の棚卸し。
2. レイヤー複製、結合、クリッピング、フォルダの仕様整理。
3. 複数レイヤー選択と一括操作の土台。
4. レイヤー透明度、削除ボタン、目/クリップ状態/名前/サムネイル表示の整理。
5. ToonSquid風のレイヤーUI配置は参考にするが、大改修前に設計確認する。

---

## 触らないこと

- 描画パイプラインの再設計。
- 保存/履歴/アルバム形式の大変更。
- アニメ本体の再接続。
- WebGPU / SDF / MSDF 系の復活。
- 物理演算、動画タイムライン、漫画向け特殊ツール。

---

## 重要ファイル

- `tegaki_work/system/layer-system.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/system/layer-transform.js`
- `tegaki_work/system/drawing/thumbnail-system.js`
- `ui/ui-icons.js`
- `styles/main.css`
- `tegaki_work/ARCHITECTURE.md`
- `task-gemini/phase2.md`

---

## 確認コマンド

```powershell
cd tegaki_work
npm.cmd run build
```

`dist/` は成果物として必要ない限り差分に残さない。
