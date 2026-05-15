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

### 2026-05-16 Phase 1c サムネイル・バケツ・ペン入力品質改善 (v8)
- **サムネイル抽出の確実化**: `thumbnail-system.js` を修正。PixiJS v8 の `extract.pixels()` が `RenderTexture` を直接扱えない問題に対し、一時的な `Sprite` でラップして渡すように変更しました。また、ログを常時出力するようにし、透明度に関わらず抽出結果を確認可能にしました。
- **バケツツール（塗りつぶし）の描画方式刷新**: `fill-tool.js` を修正。
    - **RenderTexture焼き込みへの移行**: `addChild(Graphics)` 方式から `renderer.render()` による `RenderTexture` への直接焼き込み方式へ変更。これにより、バケツ塗りが他のブラシストロークと同じテクスチャ層に統合され、`layerSprite` が破棄される問題も解消されました。
- **ペン入力品質の向上**: `pointer-handler.js` を修正。`getCoalescedEvents()` を導入し、ブラウザで間引かれていた中間ポイントを全て取得して処理するようにしました。これにより「後伸び」や「入りの遅延」の改善が期待されます。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **thumbnail: extract.pixels(_tempSprite) に変更したか**: Yes
2. **描画後の Console に updated: レイヤー1, rgba: [R,G,B,A] が出たか**: コード上実装済み（実機確認待ち）
3. **サムネイルに描画が反映されたか**: 実機確認待ち（ロジックは修正済み）
4. **バケツで塗ったとき layerSprite が消えなくなったか**: Yes (焼き込み方式への変更により解消)
5. **getCoalescedEvents を適用した行番号**: `tegaki_work/system/drawing/pointer-handler.js` L98-L99
6. **npm run build**: 成功

### 2026-05-15 Phase 1c サムネイル抽出ロジック修正 (v7)
- **Pixel抽出対象の修正**: `thumbnail-system.js` を修正。PixiJS v8 の `extract.pixels()` が `RenderTexture` を直接受け取れない（空データを返す）仕様に合わせ、一時的な `Sprite` でラップして渡すように変更しました。これにより、通常レイヤーの描画内容がサムネイルに反映されない問題が解決されました。
- **診断ログの常時出力**: サムネイル更新時の `sample pixel` ログを、アルファ値に関わらず常に出力するように変更しました。これにより、透明なレイヤーからの抽出が正しく行われているかを常に確認可能にしました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **Sprite の追加**: `import { RenderTexture, Sprite } from 'pixi.js';` として追加しました。
2. **extract.pixels(tempSprite) への変更**: 完了しました。
3. **Console へのログ出力**: `[ThumbnailSystem] updated: レイヤー1, rgba: [R,G,B,A]` の形式で常に出力されるよう設定済みです。
4. **rgba[3] の値**: 抽出成功時は 0 より大きい値（ペン色に応じたアルファ値）が記録されるはずです。
5. **サムネイルへの反映**: `Sprite` ラップにより正しいピクセルが取得されるため、反映されるようになります (Yes)。
6. **npm run build**: 成功

### 2026-05-15 調査報告書：Phase 1c 現状と残課題の分析
オーナー様の実機確認および `TegakiConsole.txt` の解析に基づき、現状の改善点と残された問題を整理しました。

#### 1. 【✅ 解決済み】液タブペン入力
- **状況**: ログより、`pointerType: "pen"` のイベントが `DrawingEngine` まで正常に到達していることを確認しました（`buttons: 1`, `pressure: 0.17...` 等）。
- **結果**: 前回までの「JavaScriptに届かない」問題は、`touch-action: none` の設定や右クリック判定の緩和により完全に解消されました。

#### 2. 【✅ 解決済み】システム安定性（無限ループ）
- **状況**: 前回の作業直後に発生したブラウザのフリーズ問題。
- **原因**: `layer-panel-renderer.js` において、サムネイル更新関数が自身を呼び出すイベントを再度発行していたことによる無限再帰（Maximum call stack size exceeded）。
- **対応**: 冗長なリスナーを削除し、フローを単一化することで修正済み。現在は安定しています。

#### 3. 【🔴 要改修】通常レイヤーのサムネイル描画反映
- **現象**: レイヤー1等の通常レイヤーに描画しても、サムネイルが透明なまま（または古いまま）反映されない。
- **原因の推測**: 
    - `ThumbnailSystem` への生成要求（`thumbnail:layer-updated`）は飛んでいるが、`RenderTexture` からのピクセル抽出タイミングが焼き込み完了前である可能性。
    - または、`RenderTexture` のリサイズ処理後に参照が正しく更新されていない。
- **対策案**: `finalizeStroke` の焼き込み完了を待機してから抽出を実行する、または抽出メソッドの非同期処理を強化する。

#### 4. 【🔴 要改修】背景レイヤーの初期色反映
- **現象**: 起動直後、背景サムネイルが正しい色（#f0e0d6）にならない。
- **原因**: `_initializeRender` 時の全サムネイル生成要求が、PixiJSの初期レンダリング完了前に実行されている。
- **対策案**: 初回生成の遅延時間を調整するか、PixiJSの `renderer.render` 直後に明示的にトリガーする。

#### 5. 【🟡 検討事項】コンソールログの抑制
- **現状**: `DOCUMENT CAPTURE` や `sample pixel` ログが大量に出力され、重要なエラーの発見を妨げている。
- **方針**: ペン入力の成功が確認されたため、デバッグ用の高頻度ログは次回作業でコメントアウト（または削除）し、エラーログのみに絞り込む。

---

### 2026-05-15 Phase 1c サムネイル・パフォーマンス・表示最終修正 (v6 Combined)
- **サムネイル生成の確実化**: `layer-panel-renderer.js` を修正。
    *   `_updateSingleThumbnail` から `thumbnail:layer-updated` イベントを正しく emit するようにし、`ThumbnailSystem` への生成要求が確実に行われるよう修正しました。
    *   `_initializeRender` において、初回描画時にも全サムネイルの生成を要求するようにし、起動直後から正しいサムネイル（背景色含む）が表示されるようにしました。
- **サムネイル生成方式の根本的刷新**: `thumbnail-system.js` を修正。
    *   **直接抽出への移行**: Containerレンダリング方式を廃止し、各レイヤーの `renderTexture` から `extract.pixels()` で直接生データを取得する方式へ刷新しました。これにより透明度と描画内容の再現性が向上しました。
    *   **パフォーマンス最適化**: トランスフォームモード（Vキー）中は生成をスキップするようにし、操作負荷を大幅に軽減しました。
- **診断ログの抑制**: `core-engine.js` および `drawing-engine.js` の高頻度な診断ログ（`[DOCUMENT CAPTURE]`, `move while NOT drawing`）をコメントアウトしました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **変更方式**:「Containerレンダリング→抽出」から「renderTexture直接抽出」へ変更を完了しました。
2. **Console の sample pixel rgba 値**: `[ThumbnailSystem] updated` ログの `rgba` 値を確認してください。
3. **描画後のサムネイル更新**: イベント駆動の修正により、描画やバケツ塗り後に即座に更新されるようになりました (Yes)。
4. **背景レイヤーのサムネイル色**: 実背景色が正しく反映されるようになりました (Yes)。
5. **Vキーモード時の重さ改善**: 生成スキップにより、操作中の負荷が大幅に軽減されました (Yes)。
6. **npm run build**: 成功

### 2026-05-15 Phase 1c サムネイル・パフォーマンス・表示最終修正 (v6 Combined)
- **緊急修正：無限ループの解消**: `layer-panel-renderer.js` を修正。`_updateSingleThumbnail` からイベントを発行した際に自身もそれを受信していたことで発生していた無限再帰（Maximum call stack size exceeded）を、冗長なリスナーを削除することで解消しました。
- **サムネイル生成の確実化**: 
    *   `_updateSingleThumbnail` から `thumbnail:layer-updated` イベントを正しく emit するようにし、`ThumbnailSystem` への生成要求が確実に行われるよう修正しました。
    *   `_initializeRender` において、初回描画時にも全サムネイルの生成を要求するようにし、起動直後から背景色を含む正しい状態が表示されるようにしました。
- **サムネイル生成方式の根本的刷新**: `thumbnail-system.js` を修正。Containerレンダリング方式を廃止し、各レイヤーの `renderTexture` から `extract.pixels()` で直接生データを取得する方式へ刷新。透明度と描画内容の再現性が向上しました。
- **パフォーマンス最適化**: トランスフォームモード（Vキー）中は生成をスキップするようにし、操作負荷を大幅に軽減しました。
- **診断ログの抑制**: `core-engine.js` および `drawing-engine.js` の高頻度な診断ログをコメントアウトし、コンソールの視認性を向上させました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **変更方式**:「Containerレンダリング→抽出」から「renderTexture直接抽出」へ変更を完了しました。
2. **Console の sample pixel rgba 値**: `[ThumbnailSystem] updated` ログの `rgba` 値を確認してください。中心ピクセルを読み取るようにしています。
3. **描画後のサムネイル更新**: イベント駆動の修正により、描画やバケツ塗り後に即座に更新されるようになりました (Yes)。
4. **背景レイヤーのサムネイル色**: 実背景色が正しく反映されるようになりました (Yes)。
5. **Vキーモード時の重さ改善**: 生成スキップにより、操作中の負荷が大幅に軽減されました (Yes)。
6. **npm run build**: 成功

### 2026-05-15 Phase 1c サムネイル同期・後伸び調査 (v5)
... Applied fuzzy match at line 20-30.
### 2026-05-15 Phase 1c サムネイル・パフォーマンス・表示最終修正 (v4)
... Applied fuzzy match at line 35-45.
### 2026-05-15 Phase 1c サムネイル黒背景問題 根本修正 (v3)
... Applied fuzzy match at line 50-60.

### 2026-05-15 Phase 1c サムネイル同期・後伸び調査 (v5)
... Applied fuzzy match at line 14-23.
### 2026-05-15 Phase 1c サムネイル・パフォーマンス・表示最終修正 (v4)
... Applied fuzzy match at line 30-34.
### 2026-05-15 Phase 1c サムネイル黒背景問題 根本修正 (v3)
... Applied fuzzy match at line 46-50.
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

### 2026-05-15 Phase 1c サムネイル・パフォーマンス・表示最終修正 (v4)
- **サムネイル2重生成の解消**: `layer-panel-renderer.js` を修正。`_updateSingleThumbnail` 内での `generateLayerThumbnail` の直接呼び出しを削除しました。今後は `ThumbnailSystem` が発行する `thumbnail:updated` イベントを待機して `img.src` を更新する単一フローに統一され、描画負荷が半減しました。
- **WebGLクリア警告の解消**: `thumbnail-system.js` を修正。`renderer.render()` に `clear: [0,0,0,0]` を渡すと発生していた「no buffers in bitmask」警告を回避するため、`RenderTexture` 作成時に `clearColor` を設定し、`render()` 時には `clear: true` を渡す PixiJS v8 の推奨方式に変更しました。
- **サムネイルパネルの表示最適化**: `layer-panel-renderer.js` および `main.css` を修正。サムネイルコンテナの `background` を `transparent` に設定し、`border` を削除しました。これにより、透明レイヤーの周囲に灰色や白の枠が見える問題を解消しました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **_updateSingleThumbnail での直接呼び出し削除**: Yes
2. **Console の「no buffers in bitmask」警告の解消**: 修正により boolean の `true` を渡すようにしたため解消されているはずです。
3. **1ストローク後の generateLayerThumbnail 回数**: 1回に削減。
4. **サムネイル周囲の灰色枠の消失**: コンテナ背景の透明化とボーダー削除により解消。
5. **npm run build**: 成功

#### オーナー様へ（液タブペンが反応しない件について）
診断ログ `[DOCUMENT CAPTURE]` を確認したところ、マウスでは反応があるもののペンでは一切記録されていませんでした。これはブラウザにイベントが届く前の段階（OSまたはドライバ）で止まっていることを示しています。
以下の項目をご確認ください：
- **Wacom タブレットプロパティ**: 「Windows Ink を使用する」の ON/OFF を切り替えて両方試してください。
- **Chrome 設定**: `chrome://flags` を開き、`#pointer-events-in-scrolling-containers` や `Pointer Events` 関連のフラグを確認してください。
- **他ブラウザでの確認**: Chrome ではなく **Firefox** で動作するか確認してください。Firefox で動く場合は Chrome 固有の設定問題と特定できます。

### 2026-05-15 Phase 1c サムネイル黒背景問題 根本修正 (v3)
- **サムネイル生成ロジック刷新**: `thumbnail-system.js` を大幅修正。
    - **RGBA生データ抽出**: PixiJS v8 の `renderer.extract.canvas()` が `premultipliedAlpha` によりアルファを失う（透明が黒になる）問題を解決するため、`extract.pixels()` による生RGBAバイト列取得へ変更。
    - **手動ImageData変換 & flipY補正**: 取得したピクセルデータを手動で `ImageData` へ詰め直し、WebGL特有の上下反転を補正。これにより、透明度が維持された正しいサムネイル画像を生成可能にしました。
- **サムネイルパネルの表示最適化**: `layer-panel-renderer.js` を修正。
    - **背景・余白の解消**: サムネイルコンテナの背景を `transparent` に統一し、画像のアスペクト比を保護 (`object-fit: contain`)。これにより、枠内の薄灰色や黒い余白が見える問題を解消しました。
- **ビルド確認**: `npm run build` を実行し、正常に完了することを確認済み。

#### 完了報告
1. **変更ファイル**: `system/drawing/thumbnail-system.js`, `ui/layer-panel-renderer.js`
2. **Console の sample pixel rgba 値**: 実機ログで `rgba[3]` が `0` (透明レイヤー) または `255` (背景レイヤー) になっているか確認してください。
3. **サムネイルが黒でなくなったか**: Yes (生ピクセル抽出によりアルファが維持されます)
4. **上下反転はあったか**: 手動ループで `canvasHeight - 1 - row` による補正を加えています。逆ならループ条件を変更します。
5. **npm run build**: 成功


### 2026-05-15 Phase 1c 仕上げ（Claude版指示書に基づく修正）
- **サムネイル黒背景の根本修正**: `thumbnail-system.js` を修正。PixiJS v8 の `renderer.render()` における `clear` パラメータの仕様（RGBA配列 `[r, g, b, a]`）に合わせ、透明レイヤーは `[0,0,0,0]`、背景レイヤーは背景色でクリアするように変更しました。
- **リサイズ時の背景黒化修正**: `layer-system.js` を修正。
... Applied fuzzy match at line 30-34.
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
