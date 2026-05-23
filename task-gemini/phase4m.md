# Phase 4m — 実レイヤー非破壊のアニメプレビュー層MVP

## 目的

Phase 4k では、セルに保存した `rasterSnapshot` をプレビュー時に実レイヤーへ一時復元して表示した。
これは動作確認には有効だったが、今後 `ClipAsset` / 内部レイヤー / 保存形式へ進むには、実レイヤーを直接汚染しない表示経路が必要。

Phase 4m では、アニメテーブルのプレビュー表示を、実レイヤーの `visible` や RenderTexture へ直接書き戻す方式から、Pixi の表示専用 Container / Sprite へ出す方式へ切り替えるMVPを作る。

## 背景

長期方針では、アニメテーブルは以下の構造へ移行する。

- `Lane`: タイムライン上のY方向の行。
- `ClipInstance`: Lane上の時間範囲に置かれるセル/クリップ。
- `ClipAsset`: クリップ本体。内部レイヤー構造や物理演算情報を持つ。
- `DrawingSnapshot`: 描画内容の最小保存単位。

現在の `Track = Layer` と `Cel.rasterSnapshot` は暫定足場。
このPhaseでは、まだ本格的な ClipAsset 化はしない。
まず「アニメ再生表示は実レイヤーと別の場所に描く」状態を作る。

## 現状の問題

`ui/animation-table-popup.js` の `_applyVisibilityPreview()` は、現在以下を行っている。

- `LayerSystem.getLayers()` から実レイヤーを取得。
- 対応トラックにセルがあるかで `layer.visible` を直接変更。
- `cel.rasterSnapshot` がある場合、`restoreLayerRasterSnapshot()` で実レイヤーへ Snapshot を直接復元。
- 終了時に `_restoreVisibility()` でバックアップから戻す。

この方式は、復元漏れ・プレビュー中の編集・将来のClipAsset化で事故りやすい。

## 実装方針

### 1. アニメプレビュー専用 Container を用意する

既存の Pixi stage / canvas layer 構造を確認し、通常描画レイヤーより上、UIより下の適切な位置に、アニメプレビュー専用の `Container` を追加する。

候補名:

- `animationPreviewContainer`
- `animationPreviewLayer`

配置場所は既存構造に合わせること。
新規に大きな描画階層を作る前に、必ず `rg "Container"`、`rg "stage"`、`rg "layerContainer"` などで既存の描画階層を確認する。

### 2. プレビュー中は実レイヤーを書き換えない

PREVIEW ON で現在フレームを表示する時:

- 実レイヤーの `visible` は変更しない。
- 実レイヤーの RenderTexture へ `restoreLayerRasterSnapshot()` しない。
- `cel.rasterSnapshot` を表示専用 Sprite / Texture として `animationPreviewContainer` へ描画する。

Phase 4mでは、Snapshotがあるセルの表示を優先する。
Snapshotがないセルについては、既存の「セル有無で実レイヤー表示ON/OFF」を無理に再現しなくてよい。
必要なら `TODO` として残す。

### 3. プレビュー層のクリアと再描画

現在フレームが変わった時、セルを伸縮/削除した時、PREVIEW ON/OFF が変わった時:

- `animationPreviewContainer` の子をクリアする。
- 現在フレームに該当する Snapshot 持ちセルだけを表示する。
- PREVIEW OFF またはアニメテーブルを閉じる時は、プレビュー層を空にする。

### 4. 表示位置・スケール

Phase 4mでは、まずキャンバス原点に一致する位置へ、Snapshotを等倍で表示できればよい。
カメラズーム・パンへの追従は既存のレイヤーContainer配下に置けば自然に合う可能性がある。
もし合わない場合は、無理に大修正せず、原因と次Phase候補を `phase4m_report.md` に記録する。

### 5. 既存バックアップ復元ロジックの扱い

Phase 4mで実レイヤーへの Snapshot 復元をやめられた場合:

- `_backupSnapshots` は不要になる可能性が高い。
- ただし一気に削除して壊すより、まず未使用化・安全側に倒すこと。
- `_restoreVisibility()` は「プレビュー層をクリアし、必要なら visible を元に戻す」程度へ縮小してよい。

既存の実レイヤー表示ON/OFFプレビューが必要な場合でも、`layerData.visible` を破壊しない条件は維持すること。

## このPhaseでやらないこと

- `ClipAsset` クラスの本格追加。
- 保存/ロード形式の変更。
- Export連携。
- セル移動・コピー・複数選択。
- セル内部編集モード。
- メインレイヤーパネルをセル内部レイヤーへ切り替える実装。
- 物理演算、メッシュ、ボーン。
- 旧 `animation-system.js` の復活。
- `timeline-ui.js` の大改修。

## 注意点

- `animation-table-popup.js` は過去にテンプレート文字列・CSS注入ブロックの閉じ忘れで `Expected a semicolon` が複数回出ている。HTML/CSSテンプレートを触ったら、必ず該当メソッド全体を読み返す。
- 大きなDOM置換や100行超の一括削除は避ける。
- コメントだけでなく挙動が変わるため、必ず `npm.cmd run build` を実行する。
- ビルド後に `dist/` の生成物が差分化しても、コミット対象にしない。

## 完了条件

- [ ] PREVIEW ON で、Snapshotを持つ現在フレームのセルがキャンバス上に表示される。
- [ ] PREVIEW中に実レイヤーの RenderTexture へ `restoreLayerRasterSnapshot()` しない。
- [ ] PREVIEW中に実レイヤーの `visible` を直接切り替えない、または切り替える場合も既存仕様より破壊リスクが増えていない。
- [ ] フレーム移動、再生、セル削除、duration変更後にプレビュー層が更新される。
- [ ] PREVIEW OFF / アニメテーブルを閉じると、プレビュー層が空になる。
- [ ] 既存の通常描画、レイヤーパネル、セル配置・選択が退行しない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4m_report.md` を作成し、実レイヤー非破壊化できた範囲と残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
