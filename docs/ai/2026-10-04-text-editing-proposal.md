# 漫画「文字」タブへの移植と曲線・変形編集の提案

状態: REFERENCE / 調査・提案のみ。Owner指示は調査と提案。製品コード・Project schema・Animeは変更していない。実行契約を発行する前の判断資料。

確認日: 2026-10-04。checkout `D:\GitHub\tegaki`、main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。既存WP-023/024差分を保持。

追加指示反映: 旧QTP文字toolのコード継承は不要、新設/作り直し可。移植するのは文字編集の導線と目的で、旧rasterizerの維持を条件にしない。[OSS候補調査](2026-10-04-text-vector-oss-shortlist.md)ではHarfBuzz.js＋Bezier.jsの小さな品質proofを推奨。以下の現行コード表は接点確認であって、継承義務ではない。

後続の[独自骨格と共用範囲の仮設計](2026-10-04-text-vector-draft-design.md)では、欲しい操作を先に試し、曲線の自作/部品採用を同じ試験で比較する。HarfBuzz.js＋Bezier.jsの採用決定や、完成済frameworkを土台にする決定ではない。

## 推奨

漫画タブを **コマ / 吹き出し / 文字 / 集中線** とし、文字タブでタイトル・擬音・独立したモノローグを作る。Canvasを編集面、左panelを入力・書体・設定、必要時の右pageを比較・詳細編集にする。大きな補助previewとフォント説明の開閉式は継承する。

文字入力・組版、線に沿わせる配置、文字全体の変形を分ける。普段は少数の点とプリセット、深い編集だけ追加の点を見せる。新しい文字toolで文字列・書体・配置を再編集できる状態を作り、曲線・変形を段階的に足す。

## 現行コードから確認できたこと

| 箇所 | 現在 | 移植への影響 |
|---|---|---|
| `ui/quick-access-popup.js` / `system/text-rasterizer.js` | 横書き、標準3family、サイズ8–256、太字、現在メイン色。視野中央に通常Rasterを追加。文字列はruntime-only | UIの移動だけでは確定後の文字変更ができない。既存Rasterから文字を復元する情報はない |
| `ui/manga-tabs.js` | popupを同位置で切替、最後のtabをUI設定へ記録 | 「文字」popupの追加で導線を作れる。全漫画popupの統合classは不要 |
| `system/lettering-raster.js` | CSSの日本語縦/横組版 → SVG foreignObject → RGBA。font埋込みはruntime、限定cacheあり | 日本語表示の比較基準と再利用候補。曲線表示が同じ品質になるとは未検証、新toolへの継承は必須でない |
| `ui/balloon-popup.js` / `system/project-manager.js` | Rasterにoptional `balloon`再編集情報、Project export/loadの明示処理あり | 文字だけの再編集情報も明示保存・正規化・History復元が必要。UI状態だけのlocalStorageでは代替できない |
| `system/animation/warp-grid-deformer.js` | 4×4、16点、version 1を正規化時に要求 | 文字用の可変ポイント列や9点編集をそのまま既存WARP payloadへ渡せない |
| `system/ruler-geometry.js` / `ui/panel-layout-popup.js` | 角度吸着、コマ分割点吸着など | 共通座標・許容距離の考え方は利用可能。文字の2軸grid・ガイド吸着が完成済みとは扱わない |

QTPの `text:rasterized` はコード検索で発火元のみ。移植時は送受信を再確認する。`verify-text-to-raster`、`verify-qtp-text-entry-layout`、`verify-qtp-progressive-density` は旧QTP文字UIの存在を要求するため、移植先の意味を検証するよう更新が必要。

## 公式資料の比較と採用判断

製品の事実はリンク先の公式資料による。右列はTegaki向けの提案であり、既存Tegaki機能の説明ではない。製品の優劣や購入推奨の比較ではない。

| 参考 | 確認した操作・機能 | 採用するヒント |
|---|---|---|
| [Apple Motion：文字の線上配置](https://support.apple.com/guide/motion/create-text-on-a-path-motn159c1a37/mac) / [Path Options](https://support.apple.com/guide/motion/text-path-options-controls-motn159c07bc/mac) | Canvasで点の移動、ダブルクリック追加、点の削除。円/楕円・矩形・波線。B-Splineは接線handleを使わず、点は線から外れる | 点を直接触る入口と形プリセットを主参考にする。Ownerの「線上の点」に合わせ、初期UIは線を通る編集点。B-Splineの線外の点は既定にしない |
| [After Effects：Text animation](https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html) | 線上の始端/終端margin、向き、均等配置。範囲selectorで文字への効果量を制御 | 始端・終端・中央の配置handleと、先頭→末尾の効果量。Timelineや多数のanimatorを静止文字UIへ持ち込まない |
| [Cavalry：Text Shape](https://cavalry.studio/docs/nodes/shapes/text-shape/) / [Range Falloff](https://cavalry.studio/docs/nodes/utilities/range-falloff/) | 形をText Pathへ接続、Path Travel/Push、文字範囲への効果 | 「線に沿う位置」と「線からの距離」を別操作にする。後段の文字サイズ勾配に始端/終端の値を使う。node graphは持ち込まない |
| [Illustrator：Type on a path](https://helpx.adobe.com/illustrator/using/creating-type-path.html) / [Envelope](https://helpx.adobe.com/ie/illustrator/desktop/manage-objects/reshape-transform-objects/distort-objects-with-envelopes.html) | 線上文字の移動・反転、envelopeのwarp/mesh、点編集 | 基準線・文字間隔・反転、外枠で文字全体を変形する考え方。任意mesh密度と大量の接線handleは初期対象外 |
| [Affinity Designer 2：Path text](https://affinity.help/designer2/English.lproj/pages/Text/pathText.html) / [Vector Warp](https://affinity.help/designer2/English.lproj/pages/ObjectControl/warp.html) | 始端/終端・baseline、楕円の角度吸着。Arc/Bend/Fish Eye/四隅、接点追加と接点/guide吸着。変形中も元の文字を編集可能 | 変形preset＋少数の点、guide吸着、書体/文字修正を維持する編集 |
| [Inkscape：Text on path](https://inkscape-manuals.readthedocs.io/en/latest/putting-text-on-path.html) / [Live Path Effects](https://inkscape-manuals.readthedocs.io/en/latest/live-path-effects.html) | 文字と線の連動、線のnode編集、元形状を保つeffect | 文字と配置線を別データにする。文字アウトライン化やeffect積層の管理は初期対象外 |

AffinityはDesigner **2**資料。Appleは取得時のMotion **6.4**ガイド、AE/Cavalryは現行オンライン資料（固定build番号なし）。各製品の実機操作速度は計測していない。

## 実装方式の評点

5点満点。再編集50%、簡便な操作30%、実装負担の小ささ20%。要求との適合を判断する仮評点で、試作前の主観評価。

| 案 | 再編集 | 操作 | 負担の小ささ | 加重得点 | 判断 |
|---|---:|---:|---:|---:|---|
| A：QTP UI移動＋確定済Rasterを既存WARPで変形 | 1 | 4 | 5 | 2.7 | 早いが文字変更・書体変更に弱い。今回の着地点には不足 |
| **B：再編集できる文字＋曲線配置＋少点envelope** | **5** | **5** | **3** | **4.6** | **推奨**。漫画用途と操作の簡便さを両立、段階実装が可能 |
| C：全ベクター文字・自由mesh・effect積層 | 5 | 2 | 1 | 3.3 | 初期範囲には過大。保存/組版/rendererまで負担が広がる |

## 具体的な操作案

### 線に沿わせる

- 「直線 / 弧 / 波 / 楕円 / 折れ線」を選び、Canvasをdragして大きさを決める。楕円/多角形の汎用描画toolの完成を依存条件にしない。まず文字配置専用の形として作り、将来は純粋な幾何helperの共用を検討する。
- 初期の自由曲線は3点。線上をダブルクリック、または「点を追加」で近い区間へ追加し、dragで移動。ペンでもbutton入口を使える。選択した点は削除/角/なめらかを選べる。
- 追加だけで線が跳ねないことを試作の条件にする。内部では曲線区間の分割と自動接線を使えるが、ユーザーにBezier handle管理を要求しない。曲線方式はこの条件を確かめてから固定する。
- 線の始端・終端と文字中央のhandleで区間と位置を調整。字間は別。既定は文字の自然な長さ、必要時に「区間に均等配置」。長すぎる文字を黙って潰したり切らず、線の延長/字間/サイズ調整を表示する。
- 「線に沿って文字を回す / 文字を直立させる」は後段の切替。単なる線上配置では各字形を曲げない。

### 文字全体を変形する

「なし / 平行四辺形 / 遠近 / 弧 / 波 / 膨らみ（魚眼風） / 先細り」を用意する。これがenvelope/WARPに相当する。魚眼風は文字の2D変形で、写真のレンズ補正の再現ではない。

初期は四隅。必要時だけ辺中央と中心を追加表示し、操作点を最大9点程度に抑える。詳細gridの分割数と画面上の操作点数は分けて設計し、粗いgridをそのまま曲線品質の上限にしない。自由mesh増設や複数envelopeの積層は後段。

「12→20」は意味を区別する。一括の文字サイズ変更は再組版、先頭12/末尾20は文字ごとのサイズ勾配、外枠を台形にするのは字形全体の変形。漫画の「ドォォン」はサイズ勾配、「ゴゴゴ」のうねりは配置線、歪んだタイトルはenvelopeを選べる。サイズ勾配は途中の文字サイズを補間する操作で、envelopeだけで代用すると字間や線の太さも変わる。

### Grid・Snap

普段は薄い局所grid。grid吸着、他の編集点とのX/Y整列、文字枠の中央/端、楕円の四分点を候補にする。複数の吸着が競合したら最も近い一つとguideを表示し、離れたら解除する。許容距離は画面px基準、座標は文書/文字local基準として拡大率に追従させる。

点の複数選択・X/Y整列・等間隔、矢印微調整は追加可能。Shiftの軸制限と一時的な吸着解除は、Canvasショートカットとの衝突確認を条件にする。文字・点・全体移動の現在対象は明示し、Escは一段戻る/編集終了として確定と取り消しを混同しない。

## 技術方針と重大判断

1. **画素を保存/出力の正本として維持**する。再編集用の文字列・font ID・組版設定・配置線・変形設定は、version付きoptional情報をLayerへ追加する案。仮称 `lettering`。これは新しい保存fieldの提案であり、今回追加していない。`balloon`へ偽装収納しない。Projectの旧読込互換・sanitizer・Historyの画素と情報の同時復元を、次Cardで明示する。
2. フォント実体・embedCss・geometry cacheはProjectへ保存しない。font不在でも保存済画素の表示/出力は維持。再生成時は不足書体を示し、別書体へ無言置換しない。過去のQTP文字Layerは画素だけなので、自動的な文字再編集への変換はできない。
3. フォント選択/tree/比較の共用は小さな部品とhost adapterで行い、巨大なBalloonPopupを丸ごと複製/統合しない。host別DOM ID、focus、warm queue、比較pageの開閉所有を確認する。吹き出し内の文字編集は従来の場所に残す。
4. 新toolの第一proof候補はHarfBuzz.jsの組版/輪郭とBezier.jsの配置線。現在のCSS縦/横組版や [SVG textPath](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/textPath) は品質比較・OS font経路の候補として残す。約物・結合濁点・字間・輪郭・外接寸法を試し、既存foreignObject組版との一致を仮定しない。曲線の縦書きは初期の対応範囲と試験を別にする。導入依存はproof後に決める。
5. envelopeは元の組版済輪郭を毎回評価し、最後にRasterへ確定する案を優先。連続dragで既に歪めた画素/輪郭をさらに歪めず、元文字からのpreviewと確定を分ける。font bytesを取得できない経路では画像変形も比較候補。大サイズ/大変形の品質と応答は未検証。旧画像変形方式への継承を条件にしない。
6. 文字Layerへの手描き加筆や外部Transformの後に、古いrecipeで全体を上書きすると加筆/配置を失う。再編集情報の整合検出と、合わない場合は新規Layerへの再生成を次Cardの条件とする。既存文字の「更新」は情報と画素が一致する対象に限定する。
7. 既存SOURCE/ANIMATE/WARPの所有と4×4保存形式は変更しない。純粋な幾何計算の再利用と保存形式の再利用は別。UI表示、runtime cache、保存情報の所有を分け、previewだけの点操作からLayerのHistoryを量産しない。

## Anime・モーフィングへの備え

今はAnimeに接続しない。曲線/変形を「形の定義」と「その時点の点座標/パラメータ」に分け、点に安定ID、local正規化座標、接続順・開閉・角/なめらか・versionを持たせる設計候補にする。評価関数はTimelineに依存させない。

将来、同じ点ID/接続構造なら座標を補間できる余地がある。途中で点数や並びを変更した形には対応付け/再サンプリングの方針が必要で、自動モーフ可能とは約束しない。文字の変形/サイズ/位置の補間と、別文字・別書体の輪郭をモーフすることも別。後者は字形構造の対応が必要な別件。

## 着手順の提案

| 段階 | 作るもの | 制作例と確認条件 |
|---|---|---|
| 1 | 新しい漫画「文字」tab、共通font選択、横/縦、配置/回転/拡縮、再編集 | タイトル/モノローグを作成→font/文字修正→保存load→更新→Undo/Redo。旧QTP文字UI/codeは新経路の確認後に撤去可能、旧画素Layerは表示/出力を維持 |
| 2 | プリセット線＋点の追加/移動/角/なめらか、grid/snap | 波線の「ゴゴゴ」、楕円の見出し、折れ線配置。追加で形が跳ねず、camera zoom/rotation/flipでもhit/snapが一致 |
| 3 | 四隅・少点envelope、形preset | 「ドン」の傾き/遠近、膨らんだタイトル。元文字変更後も変形維持、折返し/画素欠け/mesh折畳みを検知、出力品質を確認 |
| 4 | 文字範囲・サイズ勾配・個別の位置/角度 | 先頭12→末尾20、1文字だけ強調。濁点/合字/emojiをUTF-16の1単位で分断しない。Animeは依然別Card |

段階2と3の順位は用途で入替可能。推薦はまず1、続いてOwnerが求めた線上point操作の2。実装前の小さな品質proofでは、CSS平文と曲線候補、波/楕円、結合濁点、小かな/約物、縦の基本、12/20pxと大きな擬音、輪郭付きの文字を少数の既取得fontで試す。英語見本だけの成功を漫画文字の受入にしない。

## 調査運用・今回の検証

ベクター系の限定公式調査をLUNA MAX 1人へ委任（3製品/最大8ページ、read-only、file writeなし）。leadが現行コード・動画系資料・保存境界を調べ、推奨を統合。途中pollなし、完了通知一度を利用。追加SOL workerは起動せず、同じ資料を複数workerへ再読させていない。

今回は静的接点確認と公式資料調査、文書の整合確認のみ。新しい曲線/変形のBrowser速度・画素品質・Owner制作受入は未検証。既存WP-024の動作測定を新機能の性能保証へ流用しない。未commit/未push、既存差分保持。
