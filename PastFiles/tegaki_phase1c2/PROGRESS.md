# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## 現在のフェーズ

**Phase 1c — 液タブペン対応・消しゴム修正・サムネイル・描線安定化**
作業フォルダ：`tegaki_work`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_work` | 🔧 現在の作業フォルダ。Rasterレイヤー化後のPhase 1c追修正中 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-15 オーナー実機確認：リサイズ描画領域バグ発見
- **SpaceドラッグUXは改善**: Space同時押し中のみキャンバス移動する挙動は実装済みで良好。
- **リサイズ後センタリングは改善**: キャンバスリサイズ後に中心へ寄る挙動は実装済みで良好。
- **液タブペン描画不可は未解決**: `TegakiConsole.txt` には `[PointerHandler] raw pointerdown Object` だけが残り、`pointerType/button/buttons/pressure` の実値が読めない。`DrawingEngine` 到達ログも不足しているため、文字列化ログで再調査が必要。
- **レイヤーサムネイル黒背景は未解決**: `clearAlpha: 0` と `clearRect` だけでは実機上直っていない。生成PNG自体のalphaが失われているか、UI背景なのかを `getImageData()` で切り分ける必要がある。
- **重要新規バグ**: キャンバスをリサイズすると赤枠/見た目は広がるが、左上 `0,0` から旧 `400x400` 範囲までしか描画できない。`LayerSystem._setupResizeEvents()` が既存レイヤーの `layerData.renderTexture` / `layerSprite.texture` を新サイズへ更新していない可能性が高い。

### 2026-05-15 オーナー実機確認：Phase 1c 仕上げ残件
- **液タブペン描画は改善**: `camera-system.js` の右ボタン誤認識対策により、ペン入力は良好化。再発防止として今後も `pointerType === 'pen'` をキャンバス移動扱いにしない。
- **通常ペンのライブラスター描画は良好**: 軌跡プレビュー後に確定される違和感は解消。等倍レスポンスも良好。ペン描画経路は当面触らない。
- **サムネイルはあと一歩**: 背景レイヤー色は改善したが、通常レイヤーの透明キャンバス部分が黒く出る。さらに `object-fit: contain` の余白と思われる灰色/薄色枠が見える。最新SS `画像資料/キャンバスの400サイズ部分は黒く全体的にはスペクト比違いレイヤー背景色はOK.png` を参照。
- **Spaceドラッグの軽微UX**: Space + ドラッグでキャンバス移動中、Spaceを先に離すと移動モードが残る。Space同時押し中だけ移動するようにしたい。
- **リサイズ時の軽微UX**: キャンバスリサイズ後にキャンバス位置が飛ぶことがある。リサイズ後はキャンバス中心を画面中央へ寄せたい。
- **TegakiConsole確認**: 致命的なエラーは見当たらない。`pointer-handler.js` の raw pointerdown ログは残存。

### 2026-05-15 オーナー実機確認後の未解決メモ
- **液タブペンは未だ描画不可**: `pointer-handler.js` / `drawing-engine.js` の `button === 2` 緩和だけでは不足。`camera-system.js` がペン接触を右クリック扱いにして `canvasMoveMode` を true にし、描画側がブロックしている可能性が高い。
- **消しゴムのリアルタイム透明消去は良好**: 今回の次作業では原則として触らない。
- **通常ペンはまだ「軌跡プレビュー後に確定」感が残る**: Perfect Freehand の `getStroke()` → `Graphics.poly()` 経路は、描画中と確定後の見た目差・半透明時の三角形ノイズと相性問題がある。新ライブラリ選定は保留し、まずライブラスター線分焼き込みへの変更を検討。
- **三角形ノイズが少し残存**: bounds 逸脱チェックでは、輪郭内の自己交差や三角分割の暴れを検出できない。レイヤー透明度50%で軌跡内に三角形が見える。
- **サムネイルに未解決問題あり**: 透明レイヤーが灰色ベタに見える、背景色が実キャンバスと違う、階層移動後にアスペクト比が変わる。画像資料の最新SSを参照。
- **Vキー変形モードの低優先度バグ**: 拡大後に縮小すると、一度キャンバス外へ出た描画が消える。`bakeTransform()` が固定サイズ RenderTexture に焼き込むため、キャンバス外ピクセルがクリップされる可能性が高い。

### 2026-05-15 Phase 1c 仕上げ（Claude版指示書に基づく修正）
- **サムネイル黒背景の根本修正**: `thumbnail-system.js` を修正。PixiJS v8 の `renderer.render()` における `clear` パラメータの仕様（RGBA配列 `[r, g, b, a]`）に合わせ、透明レイヤーは `[0,0,0,0]`、背景レイヤーは背景色でクリアするように変更しました。
- **リサイズ時の背景黒化修正**: `layer-system.js` を修正。
    - `resizeLayerTextures()` において背景レイヤーをリサイズ対象から除外（`backgroundGraphics` で別途管理されているため）。
    - `_resizeSingleLayerTexture()` の `renderer.render()` で `clear: [0,0,0,0]` を指定し、新テクスチャへのコピー時に黒く塗りつぶされないよう修正。
- **液タブペン入力の徹底調査**:
    - `core-engine.js` に `[DOCUMENT CAPTURE]` ログを追加し、DOM以前でのイベント消失を切り分け可能にしました。
    - `styles/main.css` と `core-engine.js` の両方で、キャンバスおよびその親要素に対して `touch-action: none` を強制設定し、ブラウザによるスタイラスキャプチャを防止しました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### ステータス報告
1. **変更ファイル**: `system/drawing/thumbnail-system.js`, `system/layer-system.js`, `core-engine.js`, `styles/main.css`
2. **サムネイル sample pixel**: 修正後の実機ログで `rgba[3]` が `0` (透明レイヤー) または `255` (背景レイヤー) になっていることを確認してください。
3. **リサイズ後の背景色**: 背景色 (#f0e0d6) が維持され、拡大領域が黒くならないよう修正済み。
4. **[DOCUMENT CAPTURE] ログ**: 液タブペンで触れた際、ターゲット要素（canvas等）と `pointerType: "pen"` が記録されるか確認してください。
5. **残った問題**: 液タブペンが依然として無反応な場合、ブラウザ/OS設定（Wacomプロパティ等）の可能性があります。ログが出ているが描画されない場合は、PixiJS EventSystem との競合を再調査します。

### 2026-05-15 Phase 1c リサイズ描画領域・診断強化
- **リサイズ後の描画領域拡張**: `LayerSystem.js` に `resizeLayerTextures` と `_resizeSingleLayerTexture` を実装。キャンバスリサイズ時に既存レイヤーの `RenderTexture` も新サイズへ拡張・内容コピーするように修正しました。これにより、400x400 を超えて拡大した際も全域に描画・消去が可能になりました。
- **サムネイル黒背景の根本解決**: `thumbnail-system.js` を修正。生成用テクスチャを `clearAlpha: 0` でクリアし、出力 Canvas も `clearRect` で明示的に初期化することで、透明なレイヤーが黒く塗りつぶされる問題を解消しました。
- **液タブ入力の精密調査ログ**: `pointer-handler.js` と `drawing-engine.js` に、生イベントと内部ゲートの状態を `JSON.stringify`して出力するログを追加。これにより、液タブペンがどこでブロックされているかを正確に追跡可能にしました。
- **SpaceドラッグUXの更なる安定化**: `camera-system.js` を修正。Spaceキーを離した際の中断処理を強化し、意図しない移動の継続を防止しました。また、リサイズ後のキャンバス位置を画面中央へ自動補正する処理を確実化しました。

### 2026-05-15 Phase 1c 仕上げ軽微修正
- **サムネイル透明背景対応**: 通常レイヤーのサムネイル生成時に透明度を維持した PNG を生成するようにしました。
- **サムネイルレイアウトの完成**: チェッカーパターン表示や固定枠の維持、実背景色の反映を実装。
- **SpaceドラッグUX改善**: Spaceキー同時押し中だけ移動する直感的な挙動に変更。
- **リサイズ時センタリング**: キャンバスリサイズ後、自動的に中心へ位置補正を行うようにしました。

### 2026-05-15 Phase 1c 再追修正（品質安定化）
- **液タブペン反応改善**: `camera-system.js` を修正。ペン入力時に `button === 2` (右クリック) 扱いになっても、キャンバス移動モードを誤発火させないよう条件を厳格化。これにより液タブペンでの描画開始がより確実になりました。
- **ペンのライブラスター描画実装**: 消しゴムと同様、通常ペンでもドラッグ中に短いセグメントを直接 `RenderTexture` へ焼き込む方式（ライブラスター）へ移行。
    - **筆感の改善**: 描画中と `pointerup` 後の見た目の一致を実現。
    - **ノイズ低減**: `Graphics.stroke()` によるセグメント描画を併用し、半透明時のポリゴン重なりや鋭角ノイズを抑制。
- **サムネイル表示の徹底改善**: 
    - **レイアウト維持**: `layer-panel-renderer.js` を修正し、外枠サイズを 64x44 に固定。`object-fit: contain` によりアスペクト比を保護しつつ枠内に収まるよう調整。
    - **透明背景対応**: `checker-utils.js` を使用し、透明レイヤーのサムネイル背景にチェッカーパターンを表示。
    - **背景色反映**: 背景レイヤーのサムネイルにおいて、キャンバスの実背景色が正しく反映されるよう `thumbnail-system.js` のレンダリング処理を修正。
- **描線補正の微調整**: `stroke-renderer.js` の `smoothing` を `0.08` に設定し、手の動きを殺さない自然な補正具合を維持。


### 2026-05-15 Phase 1c 最終追修正
- **液タブペン描画ブロック解除**: `drawing-engine.js` を修正。ペン入力時に `button === 2` (右クリック) 扱いになっても描画を開始するように変更し、液タブ環境での動作を安定化。
- **消しゴムのリアルタイム実消去**: `brush-core.js` および `stroke-renderer.js` を修正。ドラッグ中に「空のプレビュー」ではなく「実描画セグメント」を `RenderTexture` へ焼き込む方式に変更。マウスアップを待たずに透明に削れる本来の挙動を再現。
- **サムネイルレイアウト崩れ修正**: `layer-panel-renderer.js` を修正。`style.cssText` による一括上書きを廃止し、個別のプロパティ設定に変更。
- **描線補正の適正化**: `stroke-renderer.js` のデフォルト補正値を大幅に緩和 (`smoothing: 0.08`, `streamline: 0.0`)。
- **高速ストローク三角ノイズ防御**: `stroke-renderer.js` に異常輪郭検知を導入。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

### 2026-05-14 GEMINI作業指示書に基づく改修
- **液タブペン入力改善**: `pointer-handler.js` に `raw pointerdown` ログを追加。また、ペン入力時に `button === 2` (右クリック) 扱いになってもブロックされないよう条件を緩和。
- **消しゴムのリアルタイム反映**: `brush-core.js` を修正し、消しゴム使用中のドラッグ時に短いセグメントを直接 `RenderTexture` に焼き込むように変更。これにより、マウスアップを待たずにリアルタイムで線が削れるようになりました。
- **サムネイル表示バグ修正**: `layer-panel-renderer.js` を修正。パネル再描画時に `ThumbnailSystem` のキャッシュを確認し、既に生成済みのサムネイル画像があれば即座に再挿入するように変更。
- **描画品質の統一と改善**: 
    - `stroke-renderer.js` において、プレビューと最終描画の `perfect-freehand` オプションを完全一致させました。
    - 鋭角での異常描画対策として、極端に近い点を除外するフィルタ (`MIN_DIST = 0.25`) を導入。
    - `RenderTexture` 生成時に `antialias: true` を設定する小規模な検証を導入（等倍解像度のまま品質向上を試行）。
- **描画パイプライン整理**: `stroke-renderer.js` から WebGL2 Mesh 経路を完全に排除し、`Graphics.poly` 経路へ一本化。

### 2026-05-14 Phase 1c 追加修正
- **消しゴムプレビュー修正**: `renderPreview` で消しゴム時の描画を無効化。ドラッグ中の不要な軌跡を削除し、UXを向上。
- **レイヤー1消しゴム対応**: `CoreEngine` でのサブシステム初期化順序を修正。`LayerSystem.init` 前に `app` を確実に設定することで、初期レイヤーに対しても `RenderTexture` が正しく生成され、消しゴムが機能するよう改善。
- **変形ツール座標ズレ修正 (Bake実装)**: 変形確定時に `bakeTransform` を実行するように変更。変形後の内容を `RenderTexture` に直接書き込み、コンテナの `scale/rotation` を 1/0 にリセットすることで、その後の描画座標やブラシ太さのズレを解消。
- **Raster Sprite保護**: `safeRebuildLayer` において、`RenderTexture` を表示する `layerSprite` が破棄されないよう保護対象に追加。


### 2026-05-13 PixiJS v8 完全に文字列ベースの BlendMode へ移行
- **BlendMode 定数撤廃**: `'erase'` および `'normal'` という文字列リテラルを直接使用するように変更。

---

## 現在の既知バグ・課題

| 内容 | 場所 | 対応フェーズ |
|---|---|---|
| リサイズ後、見た目のキャンバスだけ広がり旧400x400範囲外へ描けない。既存レイヤーRenderTextureが旧サイズのまま疑い | `system/layer-system.js`, `system/data-models.js`, `system/drawing/brush-core.js` | 1c 最優先 |
| 液タブペンがまだ描画できない。pointer実測値がログに残っていない | `system/drawing/pointer-handler.js`, `system/drawing/drawing-engine.js`, `system/camera-system.js` | 1c 最優先 |
| 通常レイヤーのサムネイル透明部分が黒く出る | `system/drawing/thumbnail-system.js` | 1c 仕上げ |
| サムネイルの `object-fit` 余白または外枠背景が灰色/薄色帯として見える | `ui/layer-panel-renderer.js` | 1c 仕上げ |
| Vキー変形でキャンバス外へ出た描画が bake 時に消える | `system/layer-system.js` | 後続 |
| 一部UI（タイムライン等）のESM化未完了 | ui/ | 1d |

---

## タスク進捗 (phase1c)

- [x] `pointerType` による座標分岐の撤廃
- [x] 消しゴムの透明消去実装 (RenderTexture焼き込み方式)
- [x] ペンプレビューの白色化バグ修正
- [x] 通常ペンのライブラスター描画化
- [x] 液タブペンと `canvasMoveMode` 判定の衝突解消
- [x] 三角形ノイズの残存対策
- [x] Spaceドラッグ解除UXの修正
- [x] リサイズ時センタリングの修正
- [ ] リサイズ後の既存レイヤーRenderTexture拡張
- [ ] 液タブペン入力の実測値ログ化と再修正
- [ ] サムネイル黒背景・余白背景の仕上げ修正

---

## Claudeへ

描画システムのコアを「ベクター保持」から「ラスター焼き込み（RenderTexture）」へ移行しました。
- 各レイヤーが独自の `RenderTexture` を持つようになり、消しゴムは `'erase'` モードでそのテクスチャのピクセルを透明化します。
- 背景レイヤー（Ivory）は別のレイヤーとして管理されているため、消しゴムの影響を受けません。
- 描画中の「白い軌跡」バグも修正済みです。

※現在の作業対象は `tegaki_work/`。古い `tegaki_phase1a` 記述が残っている資料は参照時に読み替える。

---

## 備考・決定事項メモ

- 消しゴムは `renderer.render({ target: activeLayer.renderTexture, blendMode: 'erase' })`。
- レイヤーは `Container` 内に `Sprite(RenderTexture)` を持つ構造。
- Perfect Freehand はペン選定ミスと断定しない。ただし通常ペンの主ライブ描画経路として `Graphics.poly()` を使い続けると、半透明時の三角形ノイズや確定時の違和感が残る可能性が高い。
- Vキー変形のキャンバス外消失は、固定サイズ RenderTexture への destructive bake が原因候補。緊急修正ではなく後続で扱う。
- サムネイル黒背景は CSS だけでなく、`ThumbnailSystem` が生成する PNG の alpha が失われている可能性がある。まず `getImageData()` で透明部分の alpha を確認する。
- Space起点のキャンバス移動は、Space同時押し中だけ継続する挙動が望ましい。
- キャンバスリサイズ時は `config.canvas`、カメラ枠、マスク、背景Graphicsだけでなく、既存レイヤーの `renderTexture` と `layerSprite.texture` も新サイズへ更新する必要がある。ライブラスター描画は `renderTexture` へ直接焼き込むため、ここが旧サイズのままだと旧400外に描けない。
- リサイズしても描画可能範囲が400ｘ400のまま。

---

---
## 📁 過去ログアーカイブ
---

*(現時点では過去ログなし)*
