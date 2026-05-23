# Phase 4n — Frame Composite Preview 正本化MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4m_report.md`
4. `task-gemini/phase4n_preview_scope_note.md`

`phase4n_preview_scope_note.md` の方針を優先する。

## 目的

Phase 4m で、キャプチャ済みセルの Snapshot 表示は、実レイヤーへ復元せず `animationPreviewContainer` へ Sprite として出す方式になった。

Phase 4n では、再生・フレーム移動時の PREVIEW を **現在フレームに存在する全セル/全クリップの合成表示** として扱う方向へ寄せる。

これは、将来の Lane / ClipInstance / ClipAsset / Export の土台になる。

## 現在の注意点

`ui/animation-table-popup.js` の `_applyVisibilityPreview()` は、Phase 4m 時点で以下の状態。

- Snapshotを持つセルは `animationPreviewContainer` に Sprite を出す。
- Snapshotを持つセルの対応実レイヤーは、一時的に `visible = false` にしている。
- Snapshotを持たないセルについては、まだ実レイヤーの `visible` 制御に頼っている。
- `Track = Layer` は暫定接続であり、最終仕様ではない。

Phase 4n では、完全な Lane / ClipAsset 化はしない。
ただし、プレビューの考え方を「選択セル単独」ではなく「現在フレームの合成表示」へ明確に寄せる。

## 実装方針

### 1. Frame Composite Preview を明示する

`_applyVisibilityPreview()` の責務を以下として整理する。

- 現在フレームに存在する全トラック/セルを調べる。
- Snapshotを持つセルを、表示順に `animationPreviewContainer` へ追加する。
- 表示順は現行トラック順に従う。将来 Lane 順へ置き換える前提でコメントを残す。
- セルクリックで選択セルが変わっても、標準PREVIEWは選択セル単独表示にしない。

### 2. 実レイヤー `visible` 制御を縮小する

Phase 4n の理想は、PREVIEW中に実レイヤーの `visible` を直接切り替えないこと。

ただし、現行MVPで Snapshotなしセルを完全に表示できない場合は、以下のどちらかを選ぶ。

- A案: SnapshotありセルだけをプレビューContainerで表示し、Snapshotなしセルはキャンバス表示に反映しない。
- B案: Snapshotなしセルだけ暫定的に実レイヤー visible を使う。ただし `TODO` として明記し、`layerData.visible` は絶対に変更しない。

可能なら A案を優先する。
「空セルはまだ見えないが、キャプチャ済みセルは全体合成で見える」状態でよい。

### 3. 選択セルとプレビュー表示を分離する

- セルクリックは選択状態を変えるだけ。
- PREVIEWは現在フレーム上の全Snapshotセル合成。
- 選択セルだけの単独表示は、今後の `Clip Solo Preview` または `Clip Edit View` で扱う。

### 4. プレビュー層クリアと更新

以下の操作で `animationPreviewContainer` が正しく更新されること。

- フレームヘッダークリック
- 左右キー
- Play/Stop 再生中のフレーム進行
- セル追加
- セル削除
- duration変更
- Capture
- PREVIEW ON/OFF
- アニメテーブルを閉じる

### 5. Texture cache の扱い

Phase 4m確認時に、Snapshot本体へ Pixi Texture を直接持たせないよう `WeakMap` キャッシュへ補修済み。

- `rasterSnapshot._pixiTexture` を復活させない。
- Snapshotオブジェクトは将来保存/serialize対象になり得るため、Pixi固有オブジェクトを混ぜない。
- 既存の `_snapshotTextureCache` を使う。

## このPhaseでやらないこと

- `ClipAsset` クラスの本格追加。
- `LaneModel` への改称や大規模移行。
- 保存/ロード形式の変更。
- Export実装。
- セル内部編集モード。
- レイヤーパネルをクリップ内部レイヤーへ切り替える実装。
- レーン単独再生、セル単独再生、Solo/Mute。
- オニオンスキン。
- セルD&D移動/コピー。
- 物理演算、メッシュ、ボーン。
- 旧 `animation-system.js` の復活。

## 注意点

- `animation-table-popup.js` はテンプレート文字列・CSS注入ブロックの閉じ忘れで過去に何度もビルドエラーが出ている。HTML/CSSテンプレートを触った場合は、必ず該当メソッド全体を読み返す。
- 大きなDOM置換や100行超の一括削除は避ける。
- 実レイヤーの RenderTexture へ `restoreLayerRasterSnapshot()` しない。
- `layerData.visible` は変更しない。
- ビルド後に `dist/` の生成物が差分化しても、コミット対象にしない。

## 完了条件

- [ ] `task-gemini/phase4n_preview_scope_note.md` の方針を踏まえた実装になっている。
- [ ] 再生/フレーム移動時、現在フレーム上のSnapshotありセルが全体合成として表示される。
- [ ] セルを選択しても、標準PREVIEWが選択セル単独表示へ変わらない。
- [ ] 実レイヤーの RenderTexture へ `restoreLayerRasterSnapshot()` しない。
- [ ] `rasterSnapshot._pixiTexture` のように Snapshot 本体へ Pixi Texture を混ぜない。
- [ ] PREVIEW OFF / アニメテーブル close でプレビュー層が空になる。
- [ ] 既存のセル配置、選択、削除、duration変更、Captureが退行しない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4n_report.md` を作成し、Snapshotなしセルの扱いを A案/B案どちらにしたか明記する。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
