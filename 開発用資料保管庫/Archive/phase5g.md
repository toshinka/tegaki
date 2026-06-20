# Phase 5g — Airbrush描画境界整理と重ね塗り品質修正

更新日: 2026-06-20
状態: 完了

## 目的

エアブラシで同じ色を重ねた時に、選択色へ収束せず黒ずむ、またはモアレ状の模様が出る問題を、
現行PixiJS / RenderTexture経路で再現・計測し、原因に応じて修正する。

同時に、`StrokeRenderer` が直接参照している設定globalと、分散している既定値を整理し、
エアブラシの設定・dab生成・合成責務を後続改修から追跡しやすい境界へ分離する。

## 現状確認

- `BrushCore` はstroke lifecycle、入力座標、active RenderTextureへのリアルタイム焼き込み、History接続を持つ。
- `StrokeRenderer` はpen / eraser / blurに加え、airbrushのspacing、dab配置、texture生成、flow、scatterまで持つ。
- `BrushSettings` は `airbrushSpacingRatio = 0.18`、`airbrushFlow = 0.22` を既定値として持つ。
- Settings UIは `airbrushFlow = 0.08`、`airbrushSoftness = 0.8`、`airbrushScatter = 0.0` を既定値として扱う。
- `StrokeRenderer` はflow / softness / scatterを `window.TegakiSettingsManager` から直接読み、spacing fallbackは `0.08`。
- 同じ意味の値が複数箇所にあり、描画時にどの値が有効かを呼び出し契約だけでは判定できない。
- dabはCanvas由来の白色radial textureへtintとalphaを設定し、active RenderTextureへ逐次 `clear: false` で焼き込む。
- PixiJSのCanvas texture upload、premultiplied alpha、tint、逐次合成のどこで黒ずむかは未確定。

## 設計境界

### 維持する責務

- `BrushCore` はstroke開始・継続・終了、pressure、selection制限、History、CAF working Layer同期の正本を維持する。
- 本番描画はPixiJS RenderTextureへのライブラスター焼き込みを維持する。
- `StrokeRenderer` のpen / eraser / blur経路を同時に全面再構成しない。
- SettingsのlocalStorage keyと既存UI操作は互換維持する。

### 整理する責務

- 描画開始時にairbrush設定を1つの正規化済みsnapshotへまとめる。
- renderer内部から `window.TegakiSettingsManager` を直接参照しない。
- spacing、flow、softness、scatterの既定値と範囲を1箇所で定義する。
- airbrush固有のspacing、dab texture cache、dab配置は小さい専用moduleへ移す。
- scatterの乱数は必要なら注入可能にし、固定seedまたは固定値で再現確認できるようにする。

推奨配置:

```text
system/drawing/
  brush-core.js
  brush-settings.js
  stroke-renderer.js
  airbrush-dab-renderer.js
```

`AirbrushDabRenderer` はdab列を生成する描画部品とし、stroke lifecycle、History、Layer、CAFを所有しない。
名前は実装前に既存class検索を行い、同義実装があれば新設せず統合する。

## Slice

### Slice 1 — 再現条件とpixel計測 `完了`

- 透明背景と不透明背景で、同一座標または一定距離へ同色dabを重ねる再現条件を固定する。
- 暗色・中間色・高彩度色、flow / softnessの代表値、dab回数を記録する。
- `renderer.extract.pixels()` 等の既存PixiJS APIで中心pixelと周辺pixelを読み取る。
- RGB、alpha、選択色との差、dab回数に対する変化を比較し、黒ずみと模様の発生段階を特定する。
- 診断helperやlogを残す場合は `TEGAKI_CONFIG.debug` 配下に限定する。
- このsliceでは見た目を推測して合成方式を変更しない。

計測結果:

- debug時だけ実行可能な `StrokeRenderer.diagnoseAirbrushComposition()` を追加した。
- 現行のdab texture、tint、sprite alpha、RenderTexture逐次合成をそのまま再現する。
- 透明 / 不透明背景、同一点 / 直線、任意色、任意反復回数の中心RGBAと直線profileを取得できる。
- flow 0.08の単一dabは選択色を維持した。
- flow 0.08の直線は1 stroke内のdab重複だけで色差が発生した。
  - `#800000` は中心で `#780000` 相当。
  - `#2c1810` は中心で `#26190d` 相当。
  - `#ff8c42` は中心で `#ff8742` 相当。
- 同じ直線を反復するとalphaが249付近で飽和し、`#800000` は `#7d0000` 相当で停止した。
- flow 0.22では同条件の `#800000` が `#800000` から `#810000` の範囲を維持した。
- 色ずれは単一texture生成ではなく、低alpha dabを同一8bit RenderTextureへ高密度に逐次合成する時のpremultiplied値の丸め蓄積が主因候補。
- moiréはscatter 0の固定直線profileで輝度差を計測可能にした。視覚判定とspacing / softness比較はSlice 4で継続する。

判定する候補:

1. Canvas dab texture生成時のalpha分布。
2. Canvas texture upload時のalpha mode。
3. white texture + tint + sprite alphaの組み合わせ。
4. 1 pointer segment内とsegment間での重複dab数。
5. active RenderTextureへ逐次焼き込む回数とblend mode。

### Slice 2 — Airbrush settings contract `完了`

- spacing、flow、softness、scatterを含む正規化済み設定snapshotを定義する。
- `BrushSettings.getSettings()` または専用resolverからrendererへ明示的に渡す。
- `StrokeRenderer` から `window.TegakiSettingsManager` 直接参照を除く。
- 既定値を正本へ集約し、UI表示、保存値未設定時、描画fallbackを一致させる。
- 既存localStorage値は移行またはfallbackで維持する。
- 設定変更eventの既存payloadを変更する場合は送受信側を全検索する。

実装状態:

- `TEGAKI_CONFIG.BRUSH_DEFAULTS` へspacing 0.18、flow 0.08、softness 0.8、scatter 0を集約した。
- 現行実描画で使われていた値を正規値とし、このsliceでは描画密度・見た目を意図的に変更していない。
- `SettingsManager.getDefaults()` とvalidatorへflow / softness / scatterを追加した。
- 既存localStorage key `airbrushFlow`、`airbrushSoftness`、`airbrushScatter` を維持した。
- `BrushSettings` へSettingsManagerを注入し、`getAirbrushSettings()` からfreeze済みsnapshotを返す。
- `BrushSettings.getSettings()` はspacing / flow / softness / scatterを全て含む。
- `StrokeRenderer` のairbrush spacing、dab alpha、scatter、texture生成は渡されたsettingsだけを参照する。
- `StrokeRenderer` のairbrush経路とdiagnostic経路から `window.TegakiSettingsManager` 直接参照を除いた。
- `brush:airbrush-settings-changed` は既存の `airbrushSpacingRatio` / `airbrushFlow` を維持し、softness / scatterを追加した。
- Settings popupでflow変更、再読込後の保存復元、0.08への復帰、airbrush描画、新規console errorなしを確認した。

### Slice 3 — Airbrush dab責務の抽出 `完了`

- airbrushのspacing residual計算、dab配置、texture cacheを専用moduleへ移す。
- `StrokeRenderer.renderAirbrushSegment()` は互換入口として維持し、専用moduleへ委譲する。
- `BrushCore` のairbrush stateとRenderTexture bake順序は維持する。
- 乱数scatterを無効化した決定的な入力で、同じdab列を生成できるようにする。
- pen / eraser / blur / polygon描画のclass分割は行わない。

実装状態:

- `system/drawing/airbrush-dab-renderer.js` を追加した。
- `AirbrushDabRenderer` がspacing residual、dab配置、pressure size、flow alpha、scatter、texture cacheを所有する。
- stroke lifecycle、RenderTexture bake、History、Layer / CAFは所有しない。
- `StrokeRenderer.renderAirbrushSegment()` は既存signatureを維持し、専用moduleへ委譲する。
- `BrushCore` のairbrush stateとRenderTextureへの焼き込み順序は変更していない。
- scatterの乱数関数はconstructor注入可能とし、固定値で同じdab位置を再現できる。
- spacing 0.18、flow 0.08、softness 0.8、scatter 0の診断値は分離後も選択色 `#800000` を維持した。
- Browserで通常airbrush描画、新規console errorなしを確認した。
- pen / eraser / blur / polygon描画は分割していない。

### Slice 4 — 原因に応じた合成修正 `完了`

Slice 1の計測結果から、最小の修正を選ぶ。

- alpha modeまたはtexture生成が原因なら、その境界だけを修正する。
- tint経路が原因なら、precolored dab texture等を比較し、cache量と色変更時の破棄を確認する。
- 逐次焼き込みが原因なら、1 stroke用の一時RenderTextureへdabを蓄積してからactive Layerへ合成する方式を比較する。
- 一時RenderTexture方式はmemory、消しゴム相当、selection mask、CAF working Layer同期への影響を計測してから採用する。
- 修正後は同色重ね塗りが選択色へ単調に収束し、黒方向へ逸脱しないことをpixel値で確認する。
- softness由来の規則的な縞が視認できないことをブラウザで確認する。

実装状態:

- 低flowの各色dabをLayer RenderTextureへ直接反復合成する方式を廃止した。
- stroke中は白色dabを専用の一時RenderTextureへalpha maskとして蓄積する。
- 一時maskは選択色でtintしたSpriteとしてactive Layer上へ表示し、追従previewを維持する。
- pointerup時はmaskから新しいcommit Spriteを作り、選択色でLayer RenderTextureへ1回だけ合成する。
- preview Spriteはmask / scene所属状態を持つため、commit Spriteとして再利用しない。
- stroke開始時のtarget Layerをstateへ固定し、Animation Tableの表示更新後も同じworking Layerへ確定する。
- 透明スプレーは同じmaskを `erase` blendで1回だけ合成する。
- pointer cancel時はmaskとpreviewだけを破棄し、Layer Rasterを変更しない。
- 既存のstroke前Snapshot、selection constrain、通常Layer History、CAF capture event順序を維持した。
- spacing 0.08 / flow 0.01の高密度条件でも、中心色は `#800000` に一致した。
- flow値の下限clampやUI意味変更は行っていない。
- Browserで通常Layer描画、Undo / Redo、selection内描画、CAF working Layer描画とAnimation Table再表示、新規console errorなしを確認した。
- flow 0.08、spacing 0.18、softness 0.8、scatter 0の既定値を維持した。

### Slice 5 — 回帰と文書同期 `完了`

- pen、eraser、blur、airbrush、pressure、opacity、selection制限を確認する。
- 通常LayerとCAF working Layerで描画、Undo / Redo、Frame切替、保存・復元を確認する。
- Settings popupのflow / softness / scatter変更が即時反映され、再読込後も一致することを確認する。
- 修正方式と測定結果を `PROGRESS.md` と描画proposalへ短く記録する。
- Phase完了時に本指示書を `開発用資料保管庫/Archive/` へ移す。

実装・確認結果:

- pointerdown直後の筆圧0をairbrush dabへ変換せず、最初の移動segmentから描画するよう変更した。
- 筆圧有効時は0.02以下のdabを省略し、線頭へ孤立する小点を残さない。
- 筆圧なしのmouse / touch tapはpointerup時に単独dabとして確定する。
- 既定spacingを0.18から0.10へ詰め、固定dabの周期的な輪郭を軽減した。
- flowはspacing 0.18を基準にdab alphaを補正し、spacing変更だけで線全体の濃度が大きく変わらないようにした。
- Browserでtap、長いstroke、透明スプレー、selection制限、Undo / Redo、CAF working Layer、Animation Table再表示、pen、eraserを確認した。
- Settings popupでflow 0.08、softness 0.80、scatter 0.00と説明文を確認し、新規console errorなし。
- 現行PixiJS / RenderTexture経路で解消できたため、本不具合をWebGPU移行条件にはしない。
- WebGPUは大量dab、高度な質感、性能改善を計測する長期研究候補としてのみ残す。

## 受け入れ条件

- 同色を重ねてもRGBが黒方向へ逸脱せず、選択色へ収束する。
- 透明背景と不透明背景の両方で、不自然な格子・輪・縞が増幅しない。
- flow / softness / scatter / spacingの描画時有効値を1つの設定snapshotから追跡できる。
- renderer内部にairbrush設定のglobal直接参照がない。
- Settings UIの既存値と保存互換を壊さない。
- pen / eraser / blur、selection制限、通常Layer History、CAF Historyに回帰がない。
- 計測用logを通常実行へ残さない。

上記を満たした。ブラウザで見えた既存のAnimation Table popup未登録warningはPhase 5g変更由来ではなく、新規errorはない。

## 対象外

- WebGPU、SDF / MSDF、WebGL2 Meshの導入。
- 全brushを統合するstamp engine全面置換。
- `StrokeRenderer` 全体のclass再設計。
- 全描画設定のglobal廃止。
- Brush UIの全面変更、preset管理、ブラシ素材import。
- Raster変形の反復劣化、Timeline再生仕様、Lane表示モード。

## 検証

```powershell
node --check tegaki_work/system/drawing/brush-settings.js
node --check tegaki_work/system/drawing/stroke-renderer.js
node --check tegaki_work/system/drawing/airbrush-dab-renderer.js
node --check tegaki_work/system/drawing/brush-core.js
Set-Location tegaki_work
npm.cmd run build
```

Browser:

1. 透明Layerで同一点へ暗色・中間色・高彩度色を重ね、pixel値と見た目を確認する。
2. 不透明背景上で同じ確認を行う。
3. flow / softness / scatterを変更し、設定反映と再読込後の値を確認する。
4. 長いstroke、遅いstroke、往復strokeで縞・黒ずみを確認する。
5. selectionを跨ぐairbrush strokeが範囲内だけへ反映されることを確認する。
6. 通常LayerとCAF working LayerでUndo / Redo、Frame切替、保存・復元を確認する。
7. pen / eraser / blurの基本描画とconsole errorを回帰確認する。

build後は `tegaki_work/dist/` とVite cacheの生成差分を残さない。
