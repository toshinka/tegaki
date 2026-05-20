# Phase 1h — アルバム保管と出力ポップアップ復旧

> Phase 1g で PNG エクスポート、レイヤー複製、下レイヤー結合、サムネイル更新の主要問題は実機確認で良好。
> Phase 1h は、サイドバーの記録ボタンを「JSONダウンロード」ではなく、旧来のアルバム保管として復旧する。出力ポップアップは PNG/GIF/WEBP/PSD のプレビュー付き出力導線へ戻す。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0` は参照のみ。通常作業では編集しない。
`dist/` は成果物として必要ない限り差分に残さない。

---

## 前提

- 標準描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- レイヤーは `Container + Sprite(RenderTexture)`。
- 背景レイヤーは不透明な `backgroundGraphics` を持つ特殊レイヤー。通常レイヤーとして merge/save/load しない。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。
- Canvas2D を本番描画へ混ぜない。ただし保存/読み込み時の PNG dataURL 変換には使ってよい。
- 内部 2 倍化、`resolution: 2` は使わない。
- Phase 1f/1g の履歴、リサイズ、レイヤー複製/結合、サムネイル更新を壊さない。

---

## 目的

1. サイドバー先頭の記録ボタンを本棚アイコンのアルバム導線へ戻す。
2. アルバム内の「現在の状態を保存」で、現在キャンバスのサムネイルカードを追加できるようにする。
3. カード一覧から PNG ダウンロード、削除、可能なら状態復元ができるようにする。
4. 出力ポップアップを PNG/GIF/WEBP/PSD に整理し、倍率指定を表に出さない。
5. PNG/GIF/WEBP は CUT/フレーム数に応じて静止画/アニメを自動判定する。PSD は開発中表示でもよい。
6. ペン/消しゴム/バケツ、PNG エクスポート、レイヤー複製/結合、アンドゥ/リドゥ、リサイズを退行させない。

---

## アルバム保管の扱い

アルバムは、ユーザーが手早く「今描いた状態」を並べて保管する場所。
サイドバーの記録ボタンを押して即 JSON がダウンロードされる挙動にはしない。

初期実装の保存先は `localStorage` の既存 `tegaki_album` を優先してよい。
カードには現在キャンバスの PNG サムネイルを表示する。
可能ならカードクリックで状態復元する。難しい場合は、復元は後続に送り、PNG ダウンロードと削除を優先する。

## 内部プロジェクト形式

状態復元用の内部データとして JSON + PNG dataURL を使うのは可。
ただし初期導線として、サイドバー押下で JSON ファイルを直接ダウンロードしない。

初期案：

```js
{
  version: 1,
  app: "tegaki",
  canvas: { width, height },
  background: { color, visible },
  layers: [
    {
      id,
      name,
      visible,
      opacity,
      blendMode,
      image: "data:image/png;base64,..."
    }
  ]
}
```

注意：

- 通常レイヤーだけを `layers` に入れる。背景は `background` として別扱い。
- 透明ピクセルを保持する PNG dataURL を使う。
- レイヤー順は画面表示/編集順と一致させる。
- 初期実装では transform、mask、clipping、folder は保存対象外でよい。保存対象外にしたものは `PROGRESS.md` に明記する。

---

## 優先タスク

### 1. 棚卸し

対象候補：

- `ui/album-popup.js`
- `system/virtual-album.js`
- `system/export-manager.js`
- `system/exporters/png-exporter.js`
- `system/layer-system.js`
- `system/data-models.js`
- `ui/export-popup.js`
- `ui/dom-builder.js`

確認すること：

- 現行の album 機能が何を保存しているか。
- localStorage / IndexedDB / download JSON のどれが既存導線に近いか。
- RenderTexture を PNG dataURL 化する既存処理があるか。
- PNG dataURL から RenderTexture へ復元する既存処理があるか。
- UI に保存/読み込みボタンまたは導線があるか。

### 2. アルバム保管

受け入れ条件：

- 現在のキャンバスサイズを保存できる。
- 背景色と背景表示状態を保存できる。
- 通常レイヤーの名前、表示状態、不透明度、画像を保存できる。
- サイドバーの本棚アイコンでアルバムを開く。
- アルバム内の「現在の状態を保存」でカードが増える。
- カードには現在キャンバスのサムネイルを表示する。
- カードのダウンロードボタンで PNG を保存できる。
- カードの削除ボタンでアルバムから削除できる。
- JSON ダウンロードは表導線に出さない。

### 3. 出力ポップアップ

受け入れ条件：

- フォーマットは PNG / GIF / WEBP / PSD。
- 倍率指定は表示しない。出力サイズは現在キャンバスサイズと一致させる。
- PNG/GIF/WEBP はフレーム数が 2 以上ならアニメ系出力へ自動判定する。
- プレビューを押すとサムネイル領域で静止画またはアニメが確認できる。
- PSD はボタンを置くが、未実装の場合は開発中メッセージでよい。

### 4. 履歴の扱い

初期実装では、プロジェクト読み込み後に履歴をクリアしてよい。

ただし以下を守る：

- 読み込み直後に `Ctrl+Z` で壊れない。
- 読み込み後に描いた線は履歴に載る。
- 履歴をクリアした場合はステータスの `History:` 表示も同期する。

---

## 実装せず Codex 判断へ戻すもの

- 独自バイナリ形式。
- PSD 互換保存。
- IndexedDB を使う大きな保存管理UI。
- folder / clipping / mask / transform を含む完全保存。
- レイヤー階層モデルの大幅変更。
- History command 形式の大幅変更。
- RenderTexture 保持方式の変更。
- WebGPU / SDF / MSDF / WebGL2 Mesh の復活。

---

## 受け入れ条件

- `npm.cmd run build` が成功する。
- 保存したデータを読み込んで、見た目が概ね一致する。
- 読み込み後に描画、消しゴム、バケツ、PNG エクスポートが動く。
- レイヤーサムネイルが読み込み後に更新される。
- 通常状態の Console が過剰ログに埋まらない。
- 保存対象外にした情報と理由が `PROGRESS.md` に残っている。

---

## 作業後の報告

必ず `tegaki_work/PROGRESS.md` に追記する。

- 変更ファイル
- 保存形式
- 保存対象
- 保存対象外
- 読み込み復元の流れ
- 履歴の扱い
- `npm.cmd run build` 結果
- ブラウザ確認結果
- 残った問題
- Codex / Claude に判断してほしい点
