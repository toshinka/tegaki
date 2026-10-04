# 文字・曲線・変形編集に使うOSS候補

状態: REFERENCE / 調査・提案。2026-10-04、main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。製品実装・依存導入・保存schema変更は未実施。既存差分を保持。

Owner追加指示: 旧QTP文字コードの継承は要件ではない。快適で十分な編集機能のために、新しい文字toolへ作り直してよい。[操作案](2026-10-04-text-editing-proposal.md)の目的は維持し、旧rasterizerの再利用を必須条件から外す。

後続の[仮設計](2026-10-04-text-vector-draft-design.md)で、libraryを土台にすること自体は目的ではないと明示。以下の推薦は部品候補の評価で、製品の編集データ・操作をlibraryへ合わせる指示ではない。非商用研究は直接流用候補から外しても、制作に有効な設計ヒントの参考対象には残す。

## 結論

開発を短縮できる候補はある。ただし「文字入力、日本語組版、線上配置、自由変形、点操作、保存」を単一の軽い部品で満たす候補は今回確認できなかった。文字toolを新設し、曲線計算・字形処理・変形の必要な部分を利用する方式を推奨する。

推奨proofは **HarfBuzz.jsによる組版・輪郭生成＋Bezier.jsによる配置線の幾何**。輪郭を文字の元データにせず、元の文字列・書体・設定から再生成する。大きな擬音やタイトルも、変形済み画像を何度も再変形せず、元輪郭から評価できる。

既存の軽いフォント見本表示は維持し、輪郭解析は編集する書体だけに限定する。font ID/ファイル識別子をkeyとするruntime cache、入力変更時の組版、drag中の幾何評価を分ける。全書体の輪郭を比較画面の起動やwheel選択ごとに解析する案は採らない。

## 曲線・操作・変形の候補

評点は5点満点の仮評価。今回の用途への適合50%、開発短縮30%、統合負担の小ささ20%。実測や完成度ランキングではない。異なる役割の候補なので、得点順に全部を入れる意味はない。

| 候補 / 役割 | 適合 | 短縮 | 統合の軽さ | 得点 | 採用判断 |
|---|---:|---:|---:|---:|---|
| **Bezier.js / 配置線の幾何** | 5 | 4 | 5 | **4.7** | 最優先。点追加・曲線長・接線・近い点の計算を短縮 |
| Paper.js / 広いベクター幾何 | 5 | 5 | 2 | 4.4 | 将来のベクター編集を広く進める場合の対案。Bezier.jsとの同時導入を既定にしない |
| Moveable / 全体変形の操作枠 | 4 | 5 | 3 | 4.1 | 移動・回転・拡縮・guide吸着の条件付き候補 |
| Warp.js / SVG輪郭の変形 | 4 | 4 | 3 | 3.8 | 小さな変形proofの候補。完成済envelope editorではない |
| svg-path-properties / SVG線の測定 | 3 | 3 | 5 | 3.4 | 任意SVG path取込やDOM外評価が必要になった場合のみ |

### Bezier.js — MIT、第一候補

[公式API](https://pomax.github.io/bezierjs/)は曲線分割、長さ、接線、法線、近傍点を提供する。`split(t)`は元の曲線と同等の二区間を返すため、点を追加する瞬間に線を変えない処理の足場になる。長さと近傍点は数値近似で、パラメータtの等間隔と弧長の等間隔は異なる。文字を自然な字間で置くには弧長から位置を求めるadapterが必要。

[repository](https://github.com/Pomax/bezierjs)の確認時packageは6.1.4、ESM/browser entryあり、runtime dependencies欄なし。[実LICENSE](https://raw.githubusercontent.com/Pomax/bezierjs/master/LICENSE.md)はMIT。npm最新公開版やTegakiでの速度は未確認。

自作するのは、線を通る編集点・自動接線・角/なめらか・drag後の局所更新・hit判定・grid/snap。追加直後に全区間を再平滑化すると線が変わる可能性があるため、分割時の曲線を保持し、点を動かした時の更新範囲を明示する。

### Paper.js — MIT、ベクター基盤の対案

[Path API](https://paperjs.org/reference/path/)には点/区間、分割、長さに沿う評価、曲線平滑化、簡略化がある。Catmull-Rom等の平滑化は点位置を変えずhandleを調整する。同じ構造のpath間の補間もあり、将来の形補間を考える参考になる。

[repository](https://github.com/paperjs/paper.js)の確認時packageは0.12.18。[実LICENSE](https://github.com/paperjs/paper.js/blob/develop/LICENSE.txt)はMIT。Canvasと独自Project/Layerを含む広い基盤なので、純粋な幾何に限定して使うadapterの負担を試す必要がある。TegakiのProject/History/rendererをPaper側へ移す提案ではない。

「今回の文字だけを早く」ならBezier.js。「次に汎用shape/node編集も進める」と決めるならPaper.jsを同じ小proofで比較する。文字輪郭化・日本語組版・専用UXは別途必要。

### Moveable — MIT、操作部品として条件付き

[公式README](https://github.com/daybrush/moveable)はvanilla JSとSVG、移動・回転・拡縮・guide吸着を提供する。[実LICENSE](https://raw.githubusercontent.com/daybrush/moveable/master/LICENSE)はMIT。`warp`使用例は`matrix3d`を更新する。これを曲線envelopeや魚眼変形の完成実装とは扱わない。

DOM/SVGの編集proxyに使い、結果をTegakiの文書/文字local座標へ戻す必要がある。cameraのzoom/rotation/flip、画面px一定のhandle、pointer/focus/keyboard所有をproofする。既存overlayを使う方が軽い場合は導入しない。追加selection等のpluginは今回ライセンス監査していない。

### Warp.js — MIT、輪郭変形の試作候補

[repository](https://github.com/benjamminf/warpjs)はSVG pathの点を任意関数で変換し、変形用の点補間も提供する。[実LICENSE](https://raw.githubusercontent.com/benjamminf/warpjs/master/LICENSE)はMIT。確認時packageは1.0.8、古いwebpack/Babel構成。現在のVite/browser統合は未検証。

[source](https://raw.githubusercontent.com/benjamminf/warpjs/master/src/Warp.js)の対象は`path`。SVGの`text`/foreignObjectを渡すだけで日本語輪郭へ変換してくれるわけではない。字形処理後の輪郭を受ける部品としてのみ評価する。非線形変形の精度、複雑な漢字の点数、穴、輪郭線、折り返しを確認する。元の輪郭から毎回評価し、前frameの変形結果を入力にしない。

外枠9点の意味、補間関数、変形preset、反転/折畳み検出は自作部分。Warp.jsの内部補間点と、利用者が触る点は区別する。

### svg-path-properties / SVG.js / Flubber

- [svg-path-properties](https://github.com/rveciana/svg-path-properties): [MIT](https://raw.githubusercontent.com/rveciana/svg-path-properties/master/LICENSE)。長さ・その距離の位置/接線をDOMなしで求める。任意SVG pathを扱う時に便利。自前Bezier列とbrowser SVGの測定だけで足りるなら不要。
- [SVG.js](https://github.com/svgdotjs/svg.js): [MIT](https://raw.githubusercontent.com/svgdotjs/svg.js/master/LICENSE.txt)。SVG DOM操作を楽にするが、今回必要な点editor・日本語組版・envelopeが揃うわけではない。native SVGで足りる範囲に新依存を増やさない。
- [Flubber](https://github.com/veltman/flubber): [MIT](https://raw.githubusercontent.com/veltman/flubber/master/LICENSE)。閉じた形の補間候補。ただし公式READMEの`interpolate`は穴や複数形を無視して最初の外形を使う。穴を持つ漢字の文字モーフ基盤としては採用しない。Animeへの接続も今回行わない。

## 日本語組版・輪郭生成

同じ評価軸での仮評点はHarfBuzz.js 4.6（適合5/短縮5/統合3）、fontkit 3.8（4/4/3）、opentype.js 2.7（2/3/4）。今回の日本語文字tool全体への適合評価であり、輪郭抽出単独の優劣ではない。fontkitはlicense本文確保を採用条件とする。

### HarfBuzz.js — 第一候補、MIT / 本体Old MIT

[現行README](https://github.com/harfbuzz/harfbuzzjs/blob/main/README.md)に、font bytesから`Blob/Face/Font`を作り、`Buffer`の文字を`shape`し、glyph ID/cluster/位置情報と`font.glyphToPath()`のSVG輪郭を取り出す経路がある。組版と輪郭取得を一つのengineで試せるため、別のparserを重ねる必要性を減らせる。現行mainはv1 API。旧`hbjs.js`/v0のサンプルをそのまま採用しない。

[Buffer source](https://github.com/harfbuzz/harfbuzzjs/blob/main/src/buffer.ts)に`setDirection(Direction.TTB)`、言語/script設定、cluster情報がある。[shape source](https://github.com/harfbuzz/harfbuzzjs/blob/main/src/shape.ts)は`Feature[]`を受ける。縦方向`vert`等は[本体の公式feature資料](https://github.com/harfbuzz/harfbuzz/blob/main/docs/usermanual-opentype-features.xml)を参照する。ただしwrapperでの`vrt2`の具体的な指定/適用結果と、手持ちfontの結合濁点・縦約物は未検証。縦向きのglyphを生成できることと、禁則・改行・縦中横・行送りを備えた日本語段落組版は別で、後者はtool側の責務。

browser exampleとnpm/release配布経路があり、採用のために毎回Emscripten buildする必要があるとは扱わない。独自buildする場合はEmscriptenと`make`。配布WASMは`HB_TINY`で一部APIを省くため、必要APIとbundleを固定する。

[wrapper実LICENSE](https://github.com/harfbuzz/harfbuzzjs/blob/main/LICENSE)はMIT。[本体COPYING](https://github.com/harfbuzz/harfbuzz/blob/main/COPYING)はOld MITと個別通知を指定する。採用したWASMに入る本体version/通知を確認し、wrapperのMIT表示だけで全binaryの条件を済ませない。WOFF/WOFF2の直接読込やTTC face選択は今回未検証。最初は実TTF/OTFで試す。

### fontkit — 純JSの比較候補、MIT宣言・本文不足

[repository](https://github.com/foliojs/fontkit)はTTF/OTF/WOFF/WOFF2/TTC/dfont、GSUB/GPOS/AAT、`font.layout()`、SVG/path、browser CJS/ESMを提供する。[DefaultShaper](https://github.com/foliojs/fontkit/blob/master/src/opentype/shapers/DefaultShaper.js)には`ccmp/locl/rlig/mark/mkmk`の適用処理がある。`VERTICAL_FEATURES=['vert']`は宣言だけで、今回取得sourceの既定適用処理には使われていない。「日本語縦書き完成済」と扱わない。縦advance、feature指定、約物をproofする。

README/packageはMIT宣言だが、確認した現行rootにはLICENSE本文がなく、[追加要望issue](https://github.com/foliojs/fontkit/issues/255)もある。採用配布物のlicense本文/著作権通知を確保するまで正式導入は保留。WASMを避けたい場合、また圧縮format対応の比較用として価値がある。

### opentype.js — 輪郭抽出の補助候補、MIT

[repository](https://github.com/opentypejs/opentype.js)と[実LICENSE](https://github.com/opentypejs/opentype.js/blob/master/LICENSE)はMIT。TTF/OTF/WOFFの読込とglyph path生成、browser経路がある。WOFF2は追加の解凍経路を要する。日本語`vert/vrt2`、`mark/mkmk`や結合濁点の必要な処理は今回根拠不足。輪郭抽出には使えても、日本語shapingの第一候補にはしない。HarfBuzz側で輪郭まで取れれば追加しない。

現在のfont-libraryはTTF/OTF/WOFF/WOFF2/TTCを受け付ける。選ぶ輪郭engineが同じ形式を読めるとは限らない。Eの原本/本人importはbytesを読めるが、CSSのOS font family名だけでは元font bytesを取得できない。OS fontはbrowser組版経路も検討する。

## Hugging Faceの位置づけ

| 調べた例 | 利用方法・条件 | 今回の判断 |
|---|---|---|
| [Word-As-Image](https://huggingface.co/spaces/SemanticTypography/Word-As-Image) | diffvgの輪郭control pointをStable Diffusionで最適化しSVGへ。GPUと時間のかかる生成処理。[Space LICENSE](https://huggingface.co/spaces/SemanticTypography/Word-As-Image/blob/main/LICENSE)はCC BY-NC-SA 4.0 | 非商用条件が今回の条件に合わず、製品コードの流用候補から除外。手動point editorでもない |
| [Font-To-Sketch](https://huggingface.co/spaces/bkhmsi/Font-To-Sketch) / [GitHub](https://github.com/BKHMSI/Font-To-Sketch) | Word-As-Image派生。TTF入力、PyTorch/diffvg/Stable Diffusion。[LICENSE file](https://github.com/BKHMSI/Font-To-Sketch/blob/main/LICENSE)はあるが今回本文取得不能で条件UNKNOWN。紹介される対応文字種一覧に日本語なし | 条件・日本語品質・GPU依存から採用保留。日本語が技術的に絶対不可能という判定ではない |

手動で再現可能な点編集と、AIが見た目を生成するsemantic typographyは別の用途。demo公開、repositoryのコードlicense、model weightsのlicense、利用fontのlicenseを混同しない。Stable Diffusion weightsの条件はSpaceのコードlicenseで代用できない。今後調べた全HF候補が不向きという結論ではなく、今回の2例が直接の開発shortcutには合わないという判断。

## 新しいtoolの構成案

1. 文字列・font ID・縦横・字間・色・縁取り等を元データとして持つ。旧QTP実装を複製する必然性はない。フォントtree/比較は共用部品として利用できる。
2. 組版でglyphとcluster/位置を求め、輪郭をruntime生成。line配置と字形自体の変形を分ける。「線に沿って回す」と「直立」を区別する。
3. 配置線は内部Bezier区間、UIは線上の点。初期は直線/弧/波/楕円/折れ線、点追加/移動、角/なめらか、grid/snap。線上追加で形を保持できることを先に試す。
4. envelopeは四隅と必要時の辺中央/中心。平行四辺形/遠近/弧/波/膨らみ/先細り。12→20の文字サイズ勾配は別操作。文字列を変えた後も同じ変形を再評価する。
5. 確定時は既存Raster/History経路へ渡す。再編集情報のoptional保存追加は次Cardの重大判断。今回schemaを追加しない。font実体・組版cache・一時outlineをProjectへ詰めない。

点ID・接続構造・local座標と評価器を分離すれば、文字以外のshape編集へ応用しやすい。今回の少点editorを汎用ベクターUIの先行例にはできるが、汎用scene graph・SVG全体編集・SOURCE/ANIMATE再構成まで同時に引き受けない。旧toolの作り直し許可は既存の保存/History正本を破棄する許可ではない。

## 次に行う小さな品質proofの提案

製品へ組み込む前に、保存を持たない独立pageで比較する。font比較は既取得のセリフ・角字・筆文字の少数。全27fontを一括解析しない。

- 文字: `ドォォン！ ゴゴゴ… あ゙ 田 漫画（） ABC123`（あ＋U+3099）、縦の括弧・長音・小かな、ASCII濁点併記。fontに存在しない字形とengineの失敗を区別する。
- 曲線: 3点の波と楕円。点追加の前後で同形、点移動は局所的で予測可能。逆向き/始端/終端、字間、複数codepointのclusterを確認。
- 変形: 平行四辺形、膨らみ、波。12/20pxと大きな擬音、細線/穴/縁取りを確認。元文字を変更して変形を保持する。
- 応答: 初回font解析とwarm入力/dragを別測定。drag中のDOM更新、glyph path量、メモリ、font再fetch有無を記録。英字demoの速度を日本語全体の性能保証へ流用しない。
- Browserとの日本語表示比較で字形・縦書き・濁点が不足したらengineを選び直す。採用version/commit、配布bundleと依存licenseのnoticeを固定してから製品へ入れる。

「HarfBuzz.jsで組版/輪郭＋Bezier.js」で十分ならWarp.js/Moveable/Paper.jsは必要な部分だけ追加する。fontkitは純JSの比較候補。全部入り導入や汎用editorの移植を最初の作業にしない。

## 証拠と調査運用

GitHubのREADME/API/sourceと実LICENSEを確認。top候補のpackage値は取得時repositoryの値で、npm最新versionや将来の安定性の保証ではない。実LICENSE確認は各候補の本体についてで、最終bundleの全推移依存まで監査済ではない。

LUNA MAXは既存research workerを再利用し、日本語字形engine3候補とHF最大2例だけをread-onlyで担当。leadは幾何/操作/変形を担当。途中pollなし、完了通知で統合。受領後の一点補足とleadの現行API/source確認で、fontkitの縦書き既定適用という初報の誤判定を訂正した。製品build・新機能Browser・Owner操作感は今回未検証。調査資料と文書整合だけを検証する。未commit/未push。

文書検証: `development-harness.mjs check`は64 documents / 240 local links / 25 proposals / 15 packages OK。`git diff --check`はPASS。HEADは開始時と同じ。製品codeへの今回の追加差分はない。
