# WP-030 — 漫画ツールの後続整理

状態: ACTIVE。Owner指示: 2026-10-04、残った候補を実装しやすい順に構成して順に開始。最終制作受入とpushはOwner。

## Goal

漫画制作の操作を小さくまとまったGUIへ整える。既存の通常Raster・再編集recipe・History・font libraryを維持し、保留候補を依存順に進める。

## Owner follow-up — 漫画原稿プリセット（2026-10-05）

Owner明示指示により、`ui/resize-popup.js`の「漫画原稿」presetだけを4960×7016から2150×3035へ変更。名称を保持し、tooltipをB5/300dpi相当・全面RGBAバッファ約26MBへ更新。既存大原稿をresizeせず、手動入力上限・Canvas resize transaction・Project/History/renderer契約を維持。`build/verify-canvas-size-presets.mjs`のpreset期待値だけ追従し、大原稿のsafe-pixel budget検証は保持。

TECHNICAL COMPLETE / OWNER REVIEW。JS syntax、canvas-size-presets/resize-direct-framing/resize-direct-ui-adapter、font-publication、production build PASS。独立した実Chromeの製品tabで表示・選択2150/3035・適用後Canvas寸法・Undo400×400・Redo2150×3035と一Historyを確認。ビルド成果は一時出力後に除去。描画速度・液タブの制作受入は未測定、commit/pushなし。

遅延調査はread-only。`brush-core.js`にstroke開始時の全面GPU baseline copy、Layer寸法のmask、対応GPUでrgba16float、同寸法のlive-tip composite、条件付きpen-upの入り抜き/ヒゲ/角ペン追従再構築がある。patch Historyのidle readbackとtexture poolは既に実装。今回の実機症状の支配原因は未計測。局所化とlive/final一致を改善候補とし、アプリ化・描画engine変更はこのpreset変更へ混ぜない。

## Sequence

| 順 | 範囲 | 理由・検証 |
|---|---|---|
| 1 | フォント比較の情報・整理へ管理を集約 | 既存font library/比較を再利用。分類・取り込みを一元化。狭幅、再読込、既存文字/吹き出しとの同期。画面右下入口案はOwner訂正で撤去 |
| 2 | 吹き出しのcompact GUI、輪郭点編集、二連本体 | Canvas直接操作を主にする。本体別文字領域、旧recipeの無変更、結合境界、Project/Historyを固定してから実装 |
| 3 | 複数しっぽ、曲線／折れ／丸列、離れた本体のつなぎ | 本体/しっぽを独立選択。回転・移動・根元追従、重複線と文字領域を確認 |
| 4 | コマ・集中線の目的別groupと常設確定 | 成熟したUIを流用。各tool固有のpreview/操作・保存を保持 |
| 5 | 文字別の局所9点編集 | 全体9点の操作を局所座標へ適用。既存grapheme属性/recipeを維持し、他文字への影響なし |
| 6 | 追加フォント監査・取得 | 既存監査/OCRを再利用。場面別、MV、手書きの多様性を優先。上位のみEへ取得し実体/許諾/字形を照合 |

将来の自由手描き輪郭、形の個人preset、コマ外clipは候補として保持する。全将来機能を最初のSliceへ混ぜない。

## Current slice — 再編集の元表示とコマへの素材配置（2026-10-05）

Owner追加指示: 再編集中の元の形を薄く残し、二重のCanvasを避ける。白コマを土台にclippingした内容Folderへ吹き出し/文字/集中線を配置できる入口を共用する。新しい白コマ出力は枠・内容Folder（内描画Raster）・白で生成し、既存コマは明示素材追加時だけ必要な内容Folderを作る。既存の手動clipped Folderは白へのclip先を照合して再利用する。

lead WRITE: capture-safe preview registryの表示alpha拡張、4漫画toolの再編集lifecycleと確定後の重複preview解除、通常Layerへの素材配置helper/UI、通常Folderの明示相対配置、既存白コマ生成、関連検証/Card/STATUS。既存Folder/parentId/clip mode/panelLayout recipeだけを使い保存schemaを増やさない。既存Normal History commandを一操作へまとめ、CAF追加経路・制作stroke・他WPへ広げない。元の表示は20%を目安とするruntime-only ghost、採取/Project/Exportは元の確定画素と属性を保持する。

Acceptance: 4toolの再編集元が半透明、更新/初期化/閉/取消/外部変更で復帰、Folder合成・PNG/Project採取にghostが混入しない。3toolの共通配置先選択、Canvas選択の従来追加、白コマへの内容Folder/素材追加・適切なZ順・clip・一History/UndoRedo/Project往復、旧コマ/手動Folder再利用、非同期対象切替/欠損時拒否。syntax/build/関連suite/実Browser・狭幅とOwner制作受入を区別。commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

4漫画toolの再編集元はruntime Sprite表示だけ20%へ。コマは白/枠だけを薄くし、内容の絵を保持する。閉じる/取消/初期化/更新/外部変更/Undoで元表示へ戻す。既存のcapture-safe registryが元のalphaとrenderableを復帰し、入れ子の合成採取も最外の採取が終わるまで確定表示を保つ。LayerDataのopacity、確定画素、History、Projectを変更しない。トーンの元表示抑制は既存仕様のまま。吹き出し/文字の確定後は素材previewを止め、Guide/hitは保持して確定clip結果を見せる。

new `ui/manga-panel-target.js` は通常Canvasの3素材toolへ共通の「配置先」選択を提供する。コマ内の選択Layerから初期候補を推定し、明示選択をtab間で共用。更新は元Layerの場所を保ち、新規追加だけが選択コマへ入る。新しい「白コマ＋クリッピング」は枠/内容Folder（内描画Raster）/白を一Historyで生成。内容Folderだけを白へclipし、文字→吹き出し→効果→内描画を標準のZ順にする。既存の白コマは明示素材追加時だけ内容Folderを作り、旧内描画を画素不変で収納しclipをFolderへ引き継ぐ。白をclip元に持つ手動Folderは名称によらず再利用。生成/収納/clip変更を既存Normal History commandの一操作へまとめる。

実Browserで明示相対配置の最下端挿入がfree reorderの境界判定へ流れてFolderから外れる不具合を確認。`LayerSystem._applyLayerNearLayerInFolder` は明示した親を保持し、既存の子孫block整列とmask更新だけを行う。自由並べ替えの出入り判定は保持。非同期文字preview開始時に配置先tokenを捕捉し、処理中に対象を変えた時は変更なしで拒否する。helperは既存panelLayout metadataから白コマを照合し、新たな保存fieldやセリフノートの保存modelを作らない。将来のノート側は同じ配置処理を呼べる。

- JS syntax 11 files、editable-lettering 9 / balloon 5 / focus-lines 3 / tone 1 / panel-layout 2 / folder-composite 2 / history 6 / project 11、font-publication、production build PASS。harnessは96 documents / 369 links。開始時の他WP依存状態は並行更新で解消し、WP030の旧anchorはPrevious sliceへ追従して再確認。
- 実Browser `build/wp030-manga-panel-target-browser.html` **51 checks PASS**。4tool ghost、白/枠/文字/吹き出しの確定PNG、Project採取・往復、閉/取消/初期化/編集中Undo、3tool共通選択、Canvas追加、旧内描画の画素保持、手動/入れ子Folder再利用、Z順/clip、一History/UndoRedo、非同期変更拒否、入れ子採取を確認。
- 既存Browser回帰: 複数しっぽ/コマ操作 **52**、密ウニ **42**、トーン **27**、Folder/縦書き/漫画入力 **40**、Animation入口/素材追加/静止画コピー **30 checks PASS**。旧「元を非表示」「内描画個別clip」の期待だけ新仕様へ追従。
- 実プルダウンのCanvas→コマ1、実適用/再編集、文字の実入力とコマ収納、密ウニpresetからの収納を確認。1280×720と360×640で確認し、狭幅の4toolは各固定ボタン/配置先の実DOM境界を測定。確認画像 `wp030-ghost-panel-wide.png` / `wp030-ghost-panel-narrow.png`、検証ログと境界JSONはworkspace外のローカル成果。

main/4760db9c16f2、既存差分と他WP保持。Owner制作受入、液タブ、大原稿/多Layerでの性能は未確認。対象選択は「白コマ＋クリッピング」で生成した通常コマのみ。手作りRasterからの任意コマ認識、CAF recipe再編集、セリフノート自体は当Slice外。補助previewは任意入口として保持し、別Canvasを増設しない。commit/pushなし。

## Design estimate — 稲妻・連続ウニ（2026-10-05、実装未着手）

Owner依頼は設計見積もりのみ。「集中線の見本から稲妻を選ぶ」「大小のウニを配置し、必要なら稲光で接続する」を候補とする。以下は提案であり、採用済み仕様・実装Card・制作受入ではない。現在のSliceや他WPを進めず、製品codeは変更しない。

### 結論と範囲比較

集中線パネル内の派生toolとして実現可能。ただし現在のpresetは一つの中心・楕円のparamsを差し替える入口であり、preset定数を追加するだけでは複数配置と接続を作れない。ウニのpure geometryを部品として使い、複数点と接続線を評価する別のgeometryを同じ適用/更新の入口へ渡す構成を推奨する。

| 案 | 操作と出力 | 難度 | 開発工数の概算 |
|---|---|---|---|
| A: 大小の連続ウニ、接続は手描き | 範囲内に3〜5個を配置し、個別の位置・寸法を調整。一つの効果Layerへ適用。接続は別Layerへ描く | 小〜中 | 1〜2作業日 |
| B: 走路に沿うウニ＋自動接続 | 始終点と途中点で走路を指定。その周辺に大小のウニを配し、太さを変えた折れ線で接続。接続OFFでAとしても使う | 中、推奨 | 合計3〜5作業日 |
| C: 広い範囲へ自動分岐・複数走路 | 分岐の編集、密集/交差の回避、分岐ごとの強弱まで制御 | 大 | 合計1〜2週間以上 |

各工数は同じ既存基盤から着手する場合の目安で、B/CはAへの追加日数ではない。限定的な技術検証・Browser操作・保存往復を含む通常の開発工数換算。実測や納期保証ではなく、制作表現の修正回数・液タブの受入・大原稿の性能調整は別に見積もる。特にCは求める絵の範囲が未確定のため幅が大きい。

### 推奨する初版B

- 新しい大分類tabは増やさず、集中線/密ウニ/荒ウニと同じ見本群から「稲妻」を選ぶ。選択直後から中央に使える見本とorange Guideを出す。
- 最短動線は見本選択→Canvas上で始終点をdrag→上部の適用。途中点は必要な時だけ追加/移動する。走路の指定中は既存漫画入力gateでpenへ流さず、Space/Vの既存優先を守る。
- 初期候補は一本の走路、3〜5個の大小の発光点。位置は走路沿いの順序を守り、横ずれ・間隔・寸法を有界に揺らす。Canvas全面への無作為配置と、任意の点を近い順につなぐ方式は初版へ入れない。これは交差と意図しない配置の手直しを減らすための設計判断。
- 常用controlは発光点の個数、大きさ、接続線の太さ、乱れ、接続ON/OFF、二色/交換。発光点のトゲ本数と長さの揺れ、横ずれ等は詳細へ。発光点の個数と一本のウニの線数を同じ「本数」にしない。小さい発光点でも150本を無条件に固定せず、寸法と密度に合う初期値を制作見本で調整する。
- 発光点は既存両端taperのウニを流用し、基本は中心も効果色で塗る。接続線は同色の角張った帯を新規生成し、線の太さと折れの大きさを別々に扱う。継ぎ目が透ける/太い塊になる/鋭角が異常に伸びる例を確認する。必ず同じpure geometryからCanvas previewと確定Rasterを描く。
- 白フラは作品のCanvas色slotから開始できる。UIのcreamは使わない。効果周囲は透明、背景を暗くする指定は別の明示操作。既存ウニの「外ベタ」を各発光点で繰り返すと、後の点が前の点や接続線を覆うためそのまま反復しない。必要なら背景を一回だけ塗り、効果全体の形を重ねる。
- 位置/太さの調整だけで全乱数を再抽選しない。全体seedから発光点と区間ごとに安定した乱数を導き、「別の形」で明示再抽選する。追加/削除による既存点の扱いは実装Cardで定める。
- 一つの効果Layer、一回の適用/更新History。既存のコマ配置先とwhiteへのclipping、再編集元20%表示、固定上部actionを共用。通常Canvasで再編集でき、CAFは既存通り新規焼き込みだけ。手描き接続は別Layerへ置き、生成効果の更新で消さない。

### 流用・追加と実装前の境界

流用できるものは `system/focus-flash-geometry.js` の決定的なウニ、`system/focus-lines-presets.js` の寸法比率/見本入口、`ui/focus-lines-popup.js` の適用/更新、`ui/manga-panel-target.js` の収納/clip、既存表示専用ghost。追加は複数点/走路のpure geometry、そのGuideと選択/drag、複合geometryを描くSVG/局所Rasterの入口。現行 `focus-lines-raster.js` は単一flashを判定するため、複数flashを渡すだけでは動かない。

再編集には走路・発光点・接続の設定を保持する必要がある。現行 `normalizeFocusLinesParams` / `sanitizeFocusLinesData` は未知paramsを落とすため、通常Rasterのoptional recipe拡張を次の実装Cardで明示する。新しいProject正本、Project schema version変更、CAF recipe、Layer階層/History/renderer authorityの変更は候補に含めない。旧集中線/ウニrecipeの幾何を保持する。

初版の検証は400×400、2150×3035、4960×7016での大小と局所Raster bounds、同じseedの再現、始終点一致、短い/折れた/重なる走路、白/色交換、継ぎ目・鋭角、Guide dragと描画抑止、狭幅の上部action、コマclip、一History/UndoRedo、実Project保存再読込、確定PNGとpreviewの形、再編集元の復帰。技術PASSと漫画の制作受入を分ける。全自動で人物を避ける配置、自然放電の再現、分岐editorは後段。

推奨順はAの複数ウニを部品として整える→同じtoolへBの接続ON/OFFを追加する。Aだけで止めても手描き接続の時短として使用でき、Bへ進む時も別toolを作り直さずに済む設計とする。

## Previous slice — 制作時のフォルダ順序・縦書き・Canvas選択（2026-10-05）

Ownerの制作フィードバックによる不具合修正。通常Canvasの文字FolderをコマFolderへ入れる/吹き出し上へ移す操作で子孫が旧Z位置に残る、縦書き改行が左→右、コマ内クリックが描画へ通ることを対象とする。補助プレビューは保持し、削除/復活をその場へ置く。新たなサブウィンドウは入力の修正後に必要性を判断する。

lead WRITE: `system/layer-system.js` の通常Folder配置/既存History復元とclipping派生表示、new `system/normal-layer-clipping-alpha.js`、`system/lettering-font-engine.js` の日本語列順、`ui/manga-input-focus.js` / `manga-tabs.js` のruntime編集/描画切替、コマpopup/overlayとCSS、関連限定検証。当Sliceは通常Layerを対象としCAF内部Layer/保存schema/renderer authority/既存stroke terminal/他WPを変更しない。Pixi公式scene/container skillを既存責務内で参照。

Acceptance: 閉じたFolder/入れ子Folderの移動と他Folderへの出し入れで子孫Z順を維持、一History/UndoRedo/Project画素往復。文字Folder→吹き出し→コマベースのclipを表示/書出しで確認。縦書きは通常/文字別/サイズprofileで右→左、横書き不変。4漫画tabで初期Canvas編集時はpen/fill/選択塗りへ流れず、明示描画と閉じた後は通常入力、Space/Vは既存操作へ譲る。コマ本体クリック選択と補助preview削除/復活、1280×720/360×640。syntax/関連suite/build/harness/実Browserを分離して記録。制作受入とpushはOwner。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

通常FolderはPixiの兄弟として置く既存構造を保持し、論理子孫を含む描画順のblockとして移す。閉じた/入れ子Folder、別Folder内への移動と取り出しを同じ処理へ集約。通常並べ替えのUndoは既存placement snapshotで階層・子孫順・active Layerを戻す。一回の操作に一Historyを維持する。

clipping元を生のRaster alphaだけで評価していたため、文字Folderがclip先の吹き出しの未clip領域まで表示されていた。表示派生helperで元自身と祖先Folderの既存clipを合成し、文字Folder→吹き出し→コマベースの制限を継承する。mask再利用keyへ依存Layerとclip modeを含め、元の更新で追従する。既存mask texture/renderer/Project保存を使用し、保存用の新しいalpha正本は作らない。

日本語縦書きは改行ごとに右→左へ列を進める。通常の実書体、文字別属性/書体、サイズprofileを同じ向きへ揃え、横書きは保持。既に確定したRaster画素は変更せず、再編集→更新で修正後の列順を反映する。

4漫画tabの初期Canvas入力は「編集」。共通headerの小型橙buttonで「描画」へ明示切替でき、再open/tab選択時は編集へ戻る。コマ内部を選択面とし、裸のCanvas入力もpen/fill/選択塗りへ渡さない。Space/Camera・global V/Transformは従来どおり優先する。描画時はoverlayのhitを譲り、閉じた後は通常入力へ戻る。補助previewは保持し、選択コマの削除/復活を直上へ併設する。入力を直した上で別窓の必要性を判断するため、今回サブウィンドウは追加しない。

- syntax、editable-lettering 9 / folder-composite 2 / panel-layout 2 / Project 11 / History 6 / animation 36 / drawing 7、font-publication、production build、harness check（94 documents / 362 links）PASS。
- 実Browser `build/wp030-manga-layer-repair-browser.html` **40 checks PASS**。通常LayerSystemの移動/入れ子/一History/UndoRedo/Project画素、連鎖clipと半透明Folder・PNG合成、実書体の縦3列、4tab×pen/fill/lasso-fill拒否、明示描画と閉じた後の入力、preview削除/復活を検証。操作はfixtureの既存製品API/pointer eventから実行。
- 回帰: manga-input **25 checks**、manga-gestures **52 checks PASS**。Camera/Space/V/文字用V、Ctrl操作、分割と実Canvas hit判定、Project/PNG/UndoRedo、360×640/400の固定actionを確認。初回回帰で古いCSSの`pointer-events:stroke`が内部選択を上書きすることを実hit判定で発見し、基底hitを`all`へ修正。
- Native Browser inputではコマ内部クリックで2→3へ選択変更しHistory 11のまま、previewの削除→復活、共通buttonの編集→描画→編集を確認。1280×720/360×640で共通tab/切替/固定適用が画面内。小型切替は狭幅で約30×20px。ログ `wp030-manga-layer-repair-checks.txt` / `wp030-manga-input-regression.txt` / `wp030-manga-gestures-regression.txt`、画像 `wp030-manga-layer-repair-wide.png` / `wp030-manga-layer-repair-narrow.png` はworkspace外のローカル成果。

main/4760db9c16f2、既存漫画/QTP/Rive差分を保持、commit/pushなし。CAF内部配置、複数のclipped祖先Folderが重なる全組合せ、空sourceのinverse clip、液タブ、大原稿のmask性能、Owner制作受入は今回未検証。通常Canvasの報告された制作経路を修正し、保存/History/rendererの所有と既存stroke terminalを維持する。

## Previous slice — 漫画とアニメの明示入口・素材追加・静止画コピー（2026-10-05）

Owner承認: テーブル表示とCAF化を分離し、通常Canvasのコピーを残して明示開始。漫画の不可操作を適用前に表示し、文字/集中線/吹き出しの新規Rasterを選択CAFへ追加。CAF素材を静止画Projectとして既存アルバムへコピーし、原アニメを維持する。完全な再編集recipe往復、コマのCAF構築、現在FrameのMotion/RIGを焼いたコピーは後段。

lead WRITE: `ui/animation-table-popup.js` の入口/既存CAF追加terminal、限定workflow/helper、`ui/album-popup.js` の既存normal Project変換とコピー入口、漫画popup/文字adapterの対象判断、関連CSS/Browser fixture/Card/STATUS。並列writeなし。通常LayerとCAFのHistoryを混同せず、CAFは既存DrawingSnapshot/internal Layer/asset Historyを使用。Project schema/renderer/production stroke/他WP不変。共有CAFへの追加は同じAssetの全Clipへ効くことをUIで明示。開始前コピーの保存失敗/対象変更/復元失敗時はfail closed。

Acceptance: 初回open/closeでLayer画素/recipe/HistoryとCAF数が不変。明示開始前にnormal Projectコピーがアルバムへ保存され、既存CAF再open/Project reloadは開始待ちへ戻らない。CAF文字/集中線/吹き出し追加は一asset History、UndoRedo/Project往復/共有CAFと別Assetへの影響、処理中CAF切替拒否を確認。再編集/コマ/トーンの制限を先に表示。静止画コピーは通常Raster/Folder/opacity/blend/clipping/boundsを保持しanimation=null、元CAF/History不変、既存loadProjectで通常Canvasとして開ける。1280×720/360×640の入口・主操作、syntax/build/関連suite/harness/実Browser。制作受入はOwner、commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

`animation-canvas-workflow.js`が初回の明示入口とコピー導線を所有。Table open/closeはnormal Layer/recipe/Historyを変更せず、開始時だけ既存Albumへnormal Projectを保存し、既存loadProject境界で履歴を分離してCAF seedへ委譲する。開始前コピーの保存失敗/対象変更ではCAF化しない。開始復元失敗は保存済みnormal Projectへ戻す。新しいmode/backup/保存schemaを作らない。開始待ちはCanvasを圧迫しないheader寸法のdockで、開始/閉じるを直接表示する。

`caf-manga-target.js`が選択Clip/Asset/model tokenと追加可否を共用し、文字・吹き出し・集中線の既存renderer出力を新規DrawingSnapshot/internal Rasterへ追加。表示用Layer capacityの増設は既存Raster追加と同じ`isApplying`区間とし、一asset Historyだけを記録する。通常`layer-create`commandを二重に残さない。CAF recipe保存・更新・再編集は許可しない。文字system adapterへはpopupからcallbacksを注入し、system→UI importを作らない。コマ/トーンも固定action領域で通常Canvas専用と表示し、normalへ戻るとcontrolsを復帰する。

Albumの既存CAF→normal Project変換をコピーにも共用。CAFの上→下をnormal Projectの下→上へ変換し、Folder/opacity/blend/inverse clip/raster boundsを保持する。画像欠損は部分保存しない。元CAFとHistoryは変更せず、新しく保存したコピーだけを選択・表示し、既存の通常Projectロードを即使用可能にする。元Animation Projectの保存は既存Project保存経路のまま。SOURCEコピーなのでMotion/RIG評価やCAFのrecipe再編集往復は含まない。

- syntax 10 files、editable-lettering 9 / balloon 5 / focus-lines 3 / panel-layout 2 / tone 1 / project 11 / animation 36、font-publication、production build PASS。NodeからTableを読む既存検証を維持するためCSSはmain stylesheetから読み込む。
- 実Browser `build/wp030-animation-manga-browser.html` **30 checks PASS**。open/close、保存/開始復元/CAF追加復元失敗、既存asset History/UndoRedo/共有Clip/別CAF不変、実3renderer、非同期対象切替/描画中拒否、normal recipe回帰、実Project往復、copy属性/レイヤー順とコピーの選択を確認。ログはworkspace外の `wp030-animation-manga-checks.txt`。
- 実ボタンから明示開始→漫画tab→CAF密ウニ追加→静止画コピー→Albumの通常Projectロードを確認。1280×720/360×640で入口の開始・閉じるとCAF追加/制限表示が画面内に収まる。画像はworkspace外の `wp030-animation-entry-wide.png` / `wp030-animation-entry-narrow.png` / `wp030-manga-caf-wide.png` / `wp030-manga-caf-narrow.png`。

初回の一括patchは自動承認レビューが変更範囲と未検証rollbackを理由に拒否。補助file/独立Browser proofで失敗復元・一History・Projectコピーを先に実証し、その後限定して製品接続。working capacity生成を単なるrecording suppressionへ入れると既存createLayerのdoが実行されないため、既存Raster adapterと同じ区間へ修正した。通常Project loadが用意する空の作業Layerは今回変更せず、コピーされたsource IDsのZ順を確認する。

main/4760db9c16f2、既存差分と他WP保持。制作受入/液タブ/大原稿でのコピー保存性能/全画素のCAFとnormal合成一致は未確認。完全なモード往復、コマ/トーンのCAF編集、recipe往復、Motion/RIGを含む現在Frameの取り出しは後段。commit/pushなし。

## Previous slice — QTP図形一行化と投げ縄の表示（2026-10-05）

Owner追加指示: 図形の線/塗りと内側色の2段を一行へ。塗りON/OFFは共有バケツSVG、同色/指定色は色付き●/◯、内側色変更は区別したスポイトSVG、輪郭とCanvas色リセットは小型化。消し投げ縄は作品Canvas色を主体とする可視guide。点滅/丸い角で確定形を見誤らない。

lead WRITE: `ui/shape-paint-controls.js` / `ui/ui-icons.js` / QTP色同期とCSS、`system/lasso-erase-tool.js`とguide CSS、BrushCoreの投げ縄previewだけと表示専用helper、既存Browser fixture、当Card/STATUS。既存の設定key・明示輪郭OFF・色/点列/確定terminal/選択mask/UndoRedoを維持。新しい保存・History・renderer authorityなし、production pen/eraser stroke・他WPを変更しない。

Acceptance: 1280×720/360×640/400で全設定が一行、SVGのみでもtitle/ARIA/keyboardで意味を確認できる。同色は描画色へ追従、指定色pickerとCanvas色resetが直接使える。消しguideはCanvas色と対比色の連続二色線、角は採取点の折れ線を維持し色が一致する面でも可視。投げ縄塗りpreviewは既存確定と同じ色/輪郭geometryを表示し、編集中はRaster/History/Exportを変えない。取消/確定、輪郭OFF、Camera/Space、既存図形35と領域消し40の回帰、syntax/build/harness/実Browserを確認。制作受入はOwner、commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

図形設定は塗りON/OFFのバケツ、輪郭、描画色に追従する●/指定色◯、内側色picker、Canvas色resetを一行へ。バケツONはfillで差別化し、輪郭とresetを22×24pxへ縮小。従来の色radioと設定keyを使い、SVGだけでもtitle/ARIA/native keyboardで意味と状態を保持。内側pickerは同色中から直接指定色へ移れ、主線色を変えない。共有icon registryへ既存スポイトと区別した内側色pickerの創作SVGを追加。

消し投げ縄は同じ採取点の折れ線へ、作品Canvas色の1.5px coreと明暗に応じた対比色の3px haloを重ねる。連続線/miterで面塗り・点滅・角の丸めをなくし、背景色と同じ面をまたいでも縁が見える。per-moveの画素readbackや新blend engineを使わず、Guideは表示だけ。投げ縄塗りのpreviewを表示専用 `system/drawing/lasso-paint-preview.js` へ分離し、指定色/Canvas色/輪郭OFF/SIZEと既存closed-shapeの輪郭polygon計算を参照。以前の薄い描画色・round角の表示を置換し、確定terminal/点の記録/Historyを変更しない。

- JS syntax 6 files、area-tools 5 / drawing 7 / tool-slots 1、font-publication、production build、harness（92 documents / 350 links）、scoped diff-check PASS。
- 実Browser `build/wp030-area-erase-browser.html` **61 checks PASS**。前回40に、バケツ切替・色dot同期・pickerの主線色不変・一行bounds、実Graphics描画の鋭角/内側色と同じ点列の確定後一致、輪郭OFF/線のみ/内側Opacity、明暗2背景のGuide/角/非点滅/取消を追加。Project/PNG/UndoRedo/Camera/Spaceの回帰を保持。
- `build/wp030-shape-paint-browser.html` **35 checks PASS**。旧action radioだけを新SVG toggle経由へ追従し、描画・保存・point・表示受渡しの既存確認を保持。
- Native mouseでバケツOFF→実SpaceキーでONを確認。消しGuideのfixture capture表示を、同じ画面の暗色/Canvas色面の両方で視覚確認。`wp030-qtp-one-row.jpg` / `wp030-lasso-erase-contrast.jpg` / `wp030-qtp-one-row-checks.txt` はworkspace外のローカル検証成果。

main/4760db9c16f2、他WP/既存差分保持。通常Rasterの消去範囲、保存/History/rendererの所有とproduction pen/eraser strokeは不変。液タブの操作感・大原稿での長い投げ縄preview性能・全画素のpreview/確定一致・Owner制作受入は未確認。commit/pushなし。

### Owner follow-up — 図形設定を仲間スロット寸法へ（2026-10-05）

Owner追加指示: 上のスロット位へ小型化。色の選択は橙枠の移動でもよく、SVGのONは小さい橙面＋抜き色で見分ける。WRITEは `styles/components/quick-access-popup.css` の図形設定行と当Card/STATUSだけ。既存DOM/ARIA/title/色選択と保存設定・消しの文字switchは保持する。

TECHNICAL COMPLETE / OWNER REVIEW。図形設定を既存QTP寸法tokenと6列幅へ揃え、実Browserで上の仲間と各設定セルは19×19px、SVG11×11px、行124×19pxを確認。塗り/輪郭とCanvas色追従のONはorange面とcream icon、●/◯は色を保持して選択枠を移す。coarse-pointerでは既存tokenの24px/14pxへ追従するが、液タブ実操作は未確認。

- 実Browserの既存領域消し61 checks PASS（1280×720/360×640/360×400の一行boundsを含む）。NativeバケツclickでOFF→SpaceでON、同色→指定色の選択移動を確認。
- tool-slots、font-publication、production build、harness/diff-check PASS。CSSだけの変更。確認画像 `wp030-qtp-compact-controls.jpg` と結果 `wp030-qtp-compact-checks.txt` はworkspace外のローカル成果。
- 他WP/既存差分を保持、commit/pushなし。制作受入はOwnerへ返す。

## Previous slice — 投げ縄の輪郭と領域消し（2026-10-05）

Owner明示指示: 投げ縄塗りはCanvas色を初期の内側色とし、Canvas色リセットを共有SVGで同じ行へ。輪郭線ありを既定とし、なしも選択可能。消しゴムの仲間へ多角形消しと投げ縄領域消しを追加する。

lead WRITE: shape-paint-controls/QTP/tool-slotsと関連CSS、AreaToolController/PixelSelectionSystemの既存capture入口、polygon editorと限定lasso erase editor、既存closed-shape CPU compositorのerase合成、lasso fillの輪郭指定、関連verifier/Browser fixture、当Card/STATUS。並列writeなし、既存差分を保持。背景色で覆わずalphaをeraseし、通常Rasterの既存snapshot/Historyへ一回だけ確定。Background/Folder/Animation working layerは既存closed-shape端末の対応範囲へ広げない。Project schema/保存正本/production stroke/renderer/他WP変更なし。

Acceptance: 内側のswitch・色・SVG resetを一行に収め、輪郭ON/OFFを独立保持。旧UIが自動OFFにした設定はONへ移し、新UIで明示OFFにした選択はreloadで保持。消しゴム棚/順送りに2種、点追加/移動/始点・Enter確定と手描きの離筆確定、Esc/cancel、選択mask/Camera/Space/Vを維持。RGBA透明化・部分Opacity・範囲外不変・空操作のHistoryなし・UndoRedo・実Project/PNG往復、狭幅のboundsを実Browserで確認。syntax/関連suite/build/harnessとOwner制作受入を区別。commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

投げ縄塗りの内側色は共有switch・色・`rotateCcw` SVGのCanvas色リセットを一行へ集約。初期値は作品Background色を参照する指定色＋輪郭ON。輪郭は独立したSVG switchでOFFにもでき、新しい明示OFFはreloadで保持する。旧UIが塗り選択時に自動保存したOFFだけをONへ移す。UI設定key、共有icon registry、6列のpreset棚を保持する。

消しゴム棚へ「多角線消し」「投げ縄塗り消し」を追加。多角線消しは既存の点編集・始点/Enter確定を使い、SIZE幅の「線のみ」を初期値とし「領域」も選択できる。投げ縄塗り消しは囲んで離筆すると内側を消す。専用capture editorは既存closed-shape端末へalpha eraseを渡すだけで、通常Rasterのsnapshot/Historyを共用する。部分Opacity、選択mask、空操作のHistoryなし、既存Raster範囲の維持を確認。未確定の投げ縄はEsc/pointer cancel/tool・Layer切替で取消。capture入口のSpace優先も修正し、最初のSpace＋dragをCameraへ渡す。

- JS syntax、area-tools 5 / tool-slots 1 / drawing 7 / Project 11、font-publication、production build、harness check（92 documents / 349 links）PASS。
- 実Browser: `build/wp030-area-erase-browser.html` **40 checks PASS**。Canvas色/輪郭ON・旧設定移行・明示OFF復元、通常DrawingEngineの投げ縄塗り、2種の消しゴム、実RGBA/部分Opacity/選択mask/UndoRedo/空操作、Camera回転・Space移動、実Project/PNG往復、1280×720・360×640/400の一行boundsを確認。
- 回帰: `build/wp030-shape-paint-browser.html` **35 checks PASS**。矩形/楕円/多角形/投げ縄の塗りと線、輪郭OFF、点編集、安定した表示受渡し、保存画素と狭幅を確認。
- Native: 多角線消しを3点→Enterで確定し、線の透明化と内側の絵の保持を確認。領域モードの三角形消去とCtrl+Z / Ctrl+Shift+Z、実reloadで輪郭OFF保持→ON切替も確認。投げ縄領域消しのcaptureはBrowser fixtureのpointer eventで検証し、native手描き操作と区別する。検証画像 `wp030-lasso-canvas-reset-final.jpg` / `wp030-area-erase-native.jpg`、記録 `wp030-area-erase-checks.txt` はworkspace外のローカル成果。

main/4760db9c16f2、既存漫画/原稿preset/WP034/WP035差分を保持。Background/Folder/Animation working layerの領域消しは対象外。Project schema/History/rendererの所有・production strokeは変更なし。液タブの手描き操作感・大原稿性能・Owner制作受入は未確認、agent commit/pushなし。

## Previous slice — 上部操作とフリーコマの吸着（2026-10-05）

Owner明示指示: トーンの重複titleを除き再編集/初期化も固定上部へ。漫画のコマ/吹き出し/文字/集中線も適用・更新・再編集・初期化を上部へ移す。コマの出力ラベルを収め、フリーコマへ隣辺の延長/既定間隔の吸着と編集のundo/redo SVGを付ける。文字「書式」へ6枠のサイズ登録、クリック呼出しと既存基本サイズsliderによる選択枠編集。GUIの意見を既存設計文書へ蓄積し、固定正本へ昇格させない。

lead WRITE: 5 popup/UI（tone/panel-layout/balloon/lettering/focus-lines）、共有UI action mount helper、文字サイズUI helper、各CSS、panel-layout-gesturesのpure吸着、panel-layout-overlayのguide、関連fixture/verifier、当Card/STATUS/既存GUI設計メモ。既存差分を保持し同file並列writeしない。Project/保存recipe/確定History/renderer/原稿サイズ/他WPは変更しない。コマundo/redoは適用前のruntime draftだけ、文字サイズ枠は既存UI設定keyのみ。

Acceptance: 1280×720・360×640/400で上部操作固定、footer二重ボタンなし、出力文字に横overflowなし。再編集→移動→更新/新規→適用と既存取消/CtrlEnter/History/Projectを維持。フリー頂点/本体の移動で隣辺・間隔吸着、Alt解除/回転Camera倍率の画面6px閾値、undo/redoに確定画素/History変化なし。サイズ6枠のクリック・slider/number/wheel更新とreload、読込/新規操作では枠上書きなし。syntax/関連suite/build/harness、実BrowserとOwner制作受入を区別。commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

共有 `ui/manga-edit-actions.js` が既存の各toolボタンを固定上部へ移し、重複titleと空のfooterを除去。再編集→初期化/新規/取消→出力（コマ）→新規適用/更新の配置と短いorange状態表示を共用する。確定handler・busy guard・取消・CtrlEnterは各toolのまま。白コマ＋クリッピングは狭幅で折り返す。文字サイズ6枠は `ui/lettering-size-slots.js` に分離し、クリック呼出し、上の基本サイズslider/数値/wheelで選択枠を上書き。既存UI prefsへmergeし、font情報の開閉設定を保持。新規/再編集/取消では選択だけ解除し、登録値を保持する。

フリーコマの吸着は `system/panel-layout-gestures.js` のpure関数。隣コマの辺の延長、外向きに既定gapV/gapHを空けた平行線、その交点へ画面6px以内で吸着。全体移動は四辺を保持する一つの平行移動補正で、2本のGuideが揃う位置を優先。Alt解除、Camera90°/倍率換算、橙Guideを実装。SVGの戻す/進めるは最大60件のruntime draftだけ。確定/再編集読込/初期化で区切り、分岐編集でredoを捨てる。確定Raster/recipe/Historyは変更しない。

- syntax、panel-layout 2 / editable-lettering 9 / tone 1 / balloon 5 / focus-lines 3 / Project 11、font-publicationとproduction build PASS。
- 実Browser: 新 `build/wp030-manga-top-actions-browser.html` 84 checks。5パネル×1280×720/360×640/360×400の固定・横overflow・ボタン単一、登録枠のslider/数値/wheel・実reload、読込時保持、フリー角/本体/Alt/Camera回転の吸着、SVG undo/redoと確定画素/recipe/History不変を確認。
- 回帰: コマ/複数しっぽ52、トーン27、密ウニ42、文字compact41 checks。更新/UndoRedo/実Project/PNG一致、狭幅の主要操作を確認。fixtureの合成eventとnative操作を区別する。
- Native: 通常製品入口でサイズ枠click→実wheel64→65→上部適用→再編集→Canvas中心drag→CtrlEnter更新/close、History 1→2を確認。GUI意見は[既存設計メモ](../ai/2026-10-04-manga-panel-workflow-design.md#gui実用メモ2026-10-05)へ追記。確認画像 `wp030-top-actions-lettering.jpg` はworkspace外のローカル検証成果。

main/4760db9c16f2、既存漫画/原稿preset/WP034/WP035差分を保持。Project schema/保存authority/renderer/確定History契約不変。液タブの操作感・大原稿の調整性能・Owner制作受入は未確認、commit/pushなし。

## Previous slice — トーン再編集とQTP図形の操作整理（2026-10-05）

Ownerの実用フィードバック: トーン再編集で元確定画素とdraftを重複表示しない。網点の濃度を同一行へまとめ、見本/適用/更新を常設、sliderは共有色へ。投げ縄/図形は線と塗りの選択、内側同色/指定色の選択を分ける。多角形の点を着色し、確定時の暗転を調査して除く。

WRITE ownershipはleadのみ: `ui/tone-panel.js`, 新規表示専用tone draft helper, `ui/quick-access-popup.js`, `ui/shape-paint-controls.js`, `styles/components/quick-access-popup.css`, `styles/main.css`のpolygon表示、`system/polygon-shape-tool.js`, `system/closed-shape-paint.js`, `system/drawing/fill-tool.js`の投げ縄outline指定、`system/selection-area-tools.js`のUI設定、既存capture-safe preview registry、対象verifier/Browser fixture、当Card/STATUSの漫画段落。Pixi sprite/mask/captureの現在の契約に従う。Project schema、確定Raster/History authority、RIG/他WPの差分は変更しない。

Acceptance: 元toneを表示だけ隠し、新draftは既存のclip/変形/opacityへ追従。hide/tab切替/外部変更/Undoで復帰し、編集中のPNG/実Projectの確定画素は変化ゼロ。update一History/UndoRedo。presetの改名/保存枠を維持し、1280×720・360×640/400で見本と確定常設。投げ縄同色/指定色の塗りと線、矩形/楕円/多角形、点移動/確定/Undo、暗転の実Browser観測。syntax/関連suite/build/harness、技術確認とOwner制作受入を区別。commit/pushなし。

### Result — TECHNICAL COMPLETE / OWNER REVIEW

- トーン再編集は表示専用 `ui/tone-draft-display.js` のSpriteへ置換。元Spriteのrenderableだけを隠し、clip/mask・親Layerの移動/回転/Opacityを共有する。既存capture-safe registryへ一時Sprite除外を追加し、PNG captureでは確定済み画素を表示、finallyでdraftへ戻す。update/外部content・History/選択先変更/Project読込/tab・popup hideで表示を復帰する。確定Raster/Project/Historyの保存正本は変更しない。
- 見本・適用・更新は固定、設定だけscroll。網点5濃度を1行、他5枠は2列へ。改名・上書き保存は既存枠のまま。rangeはQTP共有色。投げ縄は線/塗りと同色/指定色を2段のradio switchに分離し、指定色の塗りも輪郭なし。矩形/楕円/多角形はSIZE輪郭と内側色を共用。多角形は始点を橙・他点を薄茶、guideの面着色を除去し、確定画素を既存stageへ描いてからSVGを外す。
- 実Chromium: `build/wp030-tone-draft-browser.html` **27 checks PASS**。PNG/実Projectにdraft混入なし、更新前後の表示画素差ゼロ、clip/移動/回転/Opacity、UndoRedo・hide/外部Undo/Project読込、改名、1280×720・360×640/400で固定見本・適用・更新を確認。`build/wp030-shape-paint-browser.html` **35 checks PASS**。投げ縄同色/指定色/線・切替保持、図形、着色点、移動/確定/Undo、実Project/PNG往復、確定stage受渡しと直後6frameで背景暗転なし。native mouseで線/塗り切替、点作成・drag・Enter、網点呼出し・濃度wheel 30→35%・scroll中の更新を確認。
- JS syntax 11 files、area-tools 5/tone 1/tool-slots 1、editable-lettering-layer/numeric-field、production build、harness check（90 documents/342 links）PASS。共有preview registryのcapture復帰をpure検証へ追加。従来のliteral 6-column棚を保持。大原稿での継続調整性能、液タブ、Owner制作受入は未測定/未受入。main/4760db9c、既存・並行WP034差分保持、agent commit/pushなし。

## Previous slice — Guideの復帰とテンプレからのコマ制作（2026-10-05）

Ownerの実用フィードバックに基づく限定follow-up。新規/範囲配置中の集中線Guideを常設し、復帰/初期化を区別する。帯の深さは既存0.05〜1の評価式を変えず上限3へ拡張する。コマはテンプレ選択→Canvas分割/調整→出力・適用の順に整える。出力方式は固定footer、テンプレは初期open、数値設定と選択コマの詳細は開閉group。`append(null)`由来の不要文字を除く。

WRITE ownershipはleadのみ: `ui/focus-lines-popup.js`, `ui/focus-lines-overlay.js`, `system/focus-flash-geometry.js`, focus用CSS/検証、`ui/panel-layout-popup.js`, `styles/components/panel-layout-popup.css`, 対象Browser fixture、当Card/STATUSの漫画段落。公式調査agentはread-only。共有Layer/Project/History/renderer/Canvas resize/RIG正本、保存済みコマtreeとflashの既存範囲の出力は変更しない。原稿用の基本枠/裁ち落とし・個人template保存・Canvas変更は調査して別Sliceの契約案へ。テンプレは既存9種を見える入口へ戻す。

Acceptance: preset選択時/範囲指定中の3handle実入力、Guide復帰/初期化、depth>1の有限geometry/出力、コマtemplate可視/null文字なし/出力常設、既存Canvas分割/修飾操作/追加更新/Project/Undo、1280×720・360×640/400のfooterと主要入口。syntax/関連suite/harness/build、実Browserで確認。技術確認とOwner制作受入を区別、commit/pushなし。

### Guide・コマ制作動線の結果

TECHNICAL COMPLETE / OWNER REVIEW。配置surfaceの後に3handleを描画し、preset選択直後/範囲配置中も直接操作できる。handle操作は範囲配置を解除してpenへ透過。「Guideを戻す」は形/数値を保持（中心が作品Canvas外なら中央へ復帰）、「初期化」は新規標準へ戻し確定Layerを変更しない。深さは300%まで、新旧の同じ0.05〜1入力の式は不変。「詳細」を「ばらつき」へ改称。

コマは9種の小見本/コマ数を初期openで提示し、Canvas寸法をpx表示。余白/間隔/線色と選択コマ/境界の詳細は独立した開閉group。分割の主ボタン、出力方式/追加/更新は常設。DOMを別paneへ動かしてから再検索する二段構築を撤去し、`append(null)`による文字混入を除く。summaryをpopup dragの除外対象に加え、native clickで開閉できる。コマをCanvas端へ伸ばす既存操作は「端まで伸ばす」と表記。

- 実Chromium: `wp030-manga-gestures-browser.html` 52 checks、`wp030-dense-flash-browser.html` 42 checks、`wp030-focus-body-browser.html` 26 checks PASS。template/Guide/初期化/深さ200%のProject往復/実SVGとRaster形状/追加更新/UndoRedo/既存clipと修飾操作/1280×720・360×640/400の確定可視。fixtureのgestureは合成event。
- 通常製品tabでもnative center drag（範囲配置中→解除、screen中心640,358→668,378）、200%直接入力→Canvas範囲drag、summary native clickでopenを確認。CSSの共通`:is` selectorと詳細用ruleのspecificity競合を補正し9見本が一列。画像 `wp030-guide-depth-final.png` / `wp030-template-workflow-final.png` はworkspace外の検証成果。
- syntax、focus suite3＋pure flash、panel suite2、numeric-field、harness 90 documents/342 links、production build PASS。従来のexternalization/chunk-size warning保持。main/4760db9c、並行WP034等の差分を保持、agent commit/pushなし。液タブ/制作評価はOwner未受入。

### コマの後続設計 — 調査済み、未実装

公式資料7ページに限定したread-only agent調査と現行codeで判断。CSPは新規作成時のtemplate指定と既存Canvasへの貼付けを持ち、基本枠があればそこへ配置する。[公式の読込方法](https://support.clip-studio.com/ja-jp/faq/articles/20210080)。MediBangは原稿の外枠・重要情報の内枠・塗り足しを区別する。[原稿用紙設定](https://medibangpaint.com/use/2015/12/setting-draft/)。テンプレ先行で最初の判断量を減らせるという判断はTegakiへの推論であり、全作家の使用実態を断定しない。

| 順 | 次の限定Slice案 | GUIと維持条件 |
|---|---|---|
| 1 | コマ数別のtemplate追加 | 1/2/3/4/5/6以上を一つの絞り込みから選び、小見本一覧へ。template選択→同じCanvas編集→同じ出力footer。小規模の現状9種は全表示、数が増えた時に分類を追加する |
| 2 | 自作template登録/再利用 | 現行UI設定のtree/params/色/出力方式と登録時Canvas寸法を、名前と見本付きのlocal UI libraryへ。作品画素/Project全体を含めない。初期は同寸法で再利用。free quadは絶対座標なので、異なる寸法の伸縮は一律の無言補正にしない。登録/削除・容量/書出しの契約を次Cardで確定 |
| 3 | 原稿サイズ/枠のprofile | 400×400/1700×2400/4960×7016のCanvas pxと、コマ配置の基本枠、印刷の仕上がり/塗り足しを分離。pxだけで判型/印刷品質を断定しない。Canvas変更は既存resize transaction経由の明示操作、CAF/HistoryやProject authorityを独自追加しない。通常コマのratio treeとfree quadの扱いを先に固定 |

個人templateは[CSP素材登録](https://help.clip-studio.com/ja-jp/manual_jp/630_material/自作の素材を登録する【PRO__47_EX】.htm)、[MediBang雛型再利用](https://medibangpaint.com/use/2023/04/mangatutorialforbeginners17/)を参照。前者の独立素材登録と後者のProject雛型を同じ保存仕様として混ぜず、Tegakiでは小さいコマ配置の再利用を先行する。これら後続のschema/resize実装は本Sliceに含めていない。

## Previous slice — 両端を払う密ウニと制作動線（2026-10-05）

Ownerの追加指示により実装へ進む。目的は「ウニを選択した時点で使える形」と、塗り/反転/基本調整まで迷わない導線。新規ウニは150本、両端taperの線列。旧ray/bodyの評価式と欠損recipeの出力を保持する。

- 新optional v1 params `flash={kind:'tapered',depth,fill:'none'|'inside'|'outside',paperColor,ellipse:'none'|'fill'|'outline',ellipseWidth}`。中心の楕円を帯の基準にしdepthは短径比、幅は作品px。内/外ベタは帯中央の楕円まで同じ線色で塗る。外ベタはCanvas全面へ明示適用、透明中抜きと背景色塗りを区別。追加楕円は内側の安全領域へ紙色fillまたは輪郭線。作品Background色をUIで解決してrecipeへhex保存、外部font/Project/renderer正本は不変。
- 完成形の小見本→Canvas配置/中心と縦横handle→本数/太さ/帯の深さ→固定footer適用。3preset（集中線/密ウニ/荒ウニ）、新規の寸法は短径に比例。150本を初期値とし100〜600本も直接編集。色二slot/交換、塗りなし/中ベタ/外ベタと楕円を同じcontext。詳細のみ開閉。旧外枠/二重枠は旧recipe再編集を維持する入口に残す。
- previewは出力濃度、guide/編集中のorange表示で区別。既存確定Layerとdraftの重複は表示のみ抑制する既存境界を使い、Export/Project/Historyの確定画素を変更しない。新規確定後はdraftを非表示にし、次の明示編集で再表示。通常pen/Space/global Vの入力優先を保持。
- 今回はコマ/選択clipの新機構、連続stamp、人物輪郭、破線/soft、稲妻、個人preset、ネーム/union/Vector Layerへ拡張しない。外塗りは明示Canvas全面と表示する。

WRITE ownership: LUNA5.6 max workerはnew `system/focus-flash-geometry.js`, `system/focus-lines-presets.js`, `build/verify-focus-flash.mjs`だけ。pure決定的geometry/正規化helper/preset比率/旧非依存の検証を担当。leadは `system/focus-lines.js`, `system/focus-lines-raster.js`, `ui/focus-lines-popup.js`, `ui/focus-lines-overlay.js`, `styles/components/focus-lines-editor.css`, new `build/verify-focus-lines-flash-integration.mjs`, new/既存focus Browser fixture, 当Card/STATUSを所有。Layer/Project/History/renderer/Vite/RIG/package/共通登録はread-only、同file並列writeなし。workerは他担当の差分を戻さない。worker完了後はpure fileのwriteをleadへ返し、安全楕円の縦横比を保つ限定補正をleadが行う。

Acceptance: 400/1700×2400/4960×7016の形比率、両端細/中央太・150本・seed再現/悪値有界、旧geometry不変、SVGとPNGの同一geometry/塗り順、二色/反転/楕円、追加/再編集/UndoRedo/実ProjectとPNG、Camera投影/Space、1280×720と360×640の主要操作/固定footer。syntax/関連verifier/build/harnessを実行。技術/Browser/Owner制作受入は分離、pushはOwner。

### 密ウニ・制作動線の結果（2026-10-05）

TECHNICAL COMPLETE / OWNER REVIEW。新規の集中線/密ウニ/荒ウニを完成形のSVG小見本から選ぶ。ウニは両端が点・中央が太い150本の線列、内外の長さに独立した有界揺らぎ、seed/線番号による再現。短辺比率の寸法と線幅、縦横の直接handle/範囲drag、基本数値を常設。中ベタ/外ベタ/なし、線と作品Background色の二slot/交換、内側の安全楕円を下地色塗りまたは輪郭線として追加。普通の集中線にも二slotの入口がある（第二色はUI設定、選んだ線色だけrecipeへ）。外ベタは明示Canvas全面、他はeffect周囲に絞ったRaster確保。保存済みray/bodyの幾何は旧HEADのgolden hashと一致、新flashのみoptional v1属性。

半透明MAROONの旧共有CSSによる色上書きを除き、SVGと確定rasterは同じgeometry/色/塗り順。表示専用の既存capture-safe registryで再編集元を抑制し、Export/Project/snapshotは確定画素を採取。確定/hide/外部content変更/UndoRedoで表示を復帰。編集中UndoRedoはdraftを解除して復元recipeへ同期する。配置はpresetから範囲dragで入り、完了後はpenへ透過。Space/global Vを優先。主要確定は固定footer。px数値は比率で生じた小数を保持して表示2桁、wheelは従来の操作単位。

- 実Chromium `build/wp030-dense-flash-browser.html`: 36 checks PASS。150本/同一基本領域/範囲drag、crop/中外ベタ/二色交換/追加楕円/Background黒0/wheel、実SVGと確定Rasterのalpha形状差が全160k pixelsの0.25%未満、7k原稿でも局所effectだけの確保、通常Raster一History、実Project load/全PNG一致、再編集元の表示抑制中Export、更新/UndoRedo/編集中Undo/hide復帰/Space、1280×720・360×640で基本操作scroll不要/固定確定。
- 旧 `build/wp030-focus-body-browser.html`: 26 checks PASS。旧5preset/方向/外枠/二重枠/透明中央、zoom枠線幅/回転Canvas clip、旧recipe/実Project/PNG/更新Undo、wheel/Space、1280/360幅と360×400 footerを保持。fixture gestureは合成eventと区別する。
- 通常製品tabの実button/native入力でも、密ウニ選択→Canvas範囲drag→解除、数値wheel150→151、本数150へpreset復帰、短い数値表示を確認。画像 `wp030-dense-flash-final.png` はworkspace外の検証成果。hidden iframeのviewport往復直後はGPU表示とSVG更新の時差があり、制作画像は通常製品tabで採取した。液タブ/制作表現のOwner受入へ広げない。
- syntax、focus suite3＋new pure flash1、Project11、balloon5、numeric-field、harness check（90 documents/342 links/25 proposals/25 packages）、production build（1017 modules）、対象diff-check PASS。既存externalization/chunk-size warning保持。font原本のGit/build追加ゼロ。

main/4760db9c、既存docs/並行WP034 RIG差分を保持。agent commit/pushなし。コマ/選択clipの新連携、個人preset/連続配置、人物輪郭、破線/soft、稲妻は次の独立Slice。制作受入はOwner。

## Investigation — 集中線・フラッシュの制作動線を再設計（調査のみ）

### Owner follow-up — 完成形と速さからの見直し（2026-10-05）

状態: **DESIGN REVIEW / 製品実装なし**。Ownerの最新指示は、過去の個別要望へ追従する前に「漫画で何が作れるべきか／それを素早く作れるか」で集中線とウニを見直すこと。前Sliceの保存・操作の技術PASSは漫画表現の制作受入ではなく、今回の実用フィードバックを優先する。調査baselineはmain/4760db9c、開始clean。製品file、Project/History、RIG、別projectは変更しない。

調査分担: LUNA6 maxが公式toolの限定比較、SOL6.1 highが作画者本人の制作工程・摩擦を調査。leadが現行source・pure geometryを監査して設計をまとめる。独立read-only、file writeなし、完了通知だけを受け、重複する進捗巡回はしない。稲妻の自動線、ネーム、自由部品union、正式Vector Layerは今回の実装対象にしない。

### 現行の使いにくさの根拠

| 観測 | 現行sourceで確認した状態 | 設計上の影響 |
|---|---|---|
| 選んですぐ使えるウニにならない | `focus-lines.js` のflashは48本・太さ10〜34px・outer260px・外向きの片端taper。閉輪郭bodyは谷/先端の交互polygon、ringはその縮小コピー | 手描きウニの「内外を払う線の密な帯」と、叫びのギザ枠が混在。本数変更だけでは形の違いを解消できない |
| 原稿sizeで初期形状が壊れる | 同じflashをdefaultへpatchするpure実測: 400×400は線長中央値166.36px。1700×2400は48本中47本が2px未満、4961×7016は48本全部が2px未満（中央値はいずれも約1px） | innerはCanvas比率、outer/線幅は固定pxなので逆転する。工程0で直す。実製品の漫画原稿presetは4960×7016であり、4961は近傍検証値 |
| 普通の集中線もsize基準が混在 | defaultのinnerは短辺22%、幅は1〜5px固定、count120、outerは最遠隅まで伸びる | ウニと違い線長は潰れないが、大原稿を同じ表示寸法へ縮小すると線だけ細くなる。新規presetの線幅/密度と保存済みabsolute値を分ける |
| 本数まで辿り着く前に迷う | FIELDSのcount/width/taperはvariance context。形/線では結果に大きく効く数値を触れない | 頻出調整を同じ画面へ常設。詳細の整理と、主要操作を隠すことを分ける |
| 仕上がりを確定前に判断しにくい | CSSはray opacity0.72、body0.62を固定。再編集元Layerの通常画素とdraft overlayの併置もsource上残る | 通常は出力どおりの不透明度。編集中は文字/橙のguideで表す。元Layerとdraftの二重表示を防ぐ |
| 大原稿で無駄な確保がある | rasterizeFocusLinesは小さなウニでもCanvas全面のRGBAを生成。UIのinner上限1200/outer2400もengine4000/8000と違う | 小さなeffectは有界boundsで確定。全面effectだけ必要範囲を確保。上限は意味と実測を揃える |
| コマclipがまだ前提になっていない | focus applyにはclip設定がなく、tone-panelには通常Rasterへのclip適用経路がある | 見えているpreviewにも同じclipを適用し、対象を表示する。toneの処理をそのままコピーせずHistory/配置を照合する |

実測はproduction pure関数 `defaultFocusLinesParams → flash patch → buildFocusLines` をNodeで実行したもの。新たなBrowser制作操作、印刷品質、速度benchを実施した結果ではない。

### 公式toolと作画者の制作工程

2026-10-05に一次資料を確認。toolの機能表と、本人が示した制作工程を分けた。

| 一次資料 | 確認できたこと | Tegakiでの判断 |
|---|---|---|
| [CSP公式・流線/集中線](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/%E6%B5%81%E7%B7%9A%E3%83%BB%E9%9B%86%E4%B8%AD%E7%B7%9A%E3%80%90PRO__47_EX%E3%80%91.htm)、[フキダシ/フラッシュ](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/%E3%83%95%E3%82%AD%E3%83%80%E3%82%B7%E3%80%90PRO__47_EX%E3%80%91.htm) | 種類を選んでCanvasをドラッグして生成、後から中心/形状を編集。フラッシュは集中線Layer | 完成形を先に選ぶ入口と、Canvas配置/後調整を主にする |
| [MediBang公式・集中線](https://medibangpaint.com/use/2019/10/concentrated-line-tool/)、[ibisPaint公式・漫画機能](https://ibispaint.com/lecture/index.jsp?no=185) | 選択範囲/コマを先に指定し、中心や線を調整して確定。MediBangは編集previewが選択外にも出るが、確定時に削る | Tegakiはclip結果をpreviewにも反映する方が完成を判断しやすい、と推論。既存UIを模倣する必然性はない |
| みうらあきの制作メイキング [工程⑤](https://tips.clip-studio.com/ja-jp/articles/1479)、[工程⑦](https://tips.clip-studio.com/ja-jp/articles/1481) | 素材を配置/縮小、選択範囲へ集中線、制作途中でウニ素材を2回配置し個別変形。内側白塗りを追加して背景を隠す | preset配置、複数配置、下地の塗りは実際のページ制作工程にある。講座原稿の工程であり全作家の習慣ではない |
| [佐原未来執筆・CSP公式の集中線実践](https://tips.clip-studio.com/ja-jp/articles/1444) | 雛形を作る→配置→成形。顔に被る部分を制御点で逃がす、別領域をmask、白線の重ね、定規で描き足す | 楕円の速い作成を先に完成し、人物向けの局所輪郭調整/選択clipを後段に用意。本文末尾の作者名を確認 |
| [平井太朗/heytaroh・フラッシュのコツ](https://tips.clip-studio.com/ja-jp/articles/9382) | 小さな生成で破綻する例と、大きく作って縮小する回避、調整済みLayerの素材化、ウニの複数重ねを説明 | 原稿環境とeffect寸法に合う初期値、個人preset、連続配置を重視。記事内のfolder合成mode説明は矛盾があり、そのまま実装仕様にしない |
| [櫻木リト・本人のアナログ作画/練習記録](https://note.com/sakuragirito1023/n/nfcb0a8eb011e) | 3楕円を目安に中間から外へ/内へ払い、出発点を合わせた菱形状の線を並べる。過去の投稿作品も掲載 | 密なウニの基本は、外向き三角形の輪だけではない。太い中間帯と、内外別々の細い端を持たせる |

素材販売者の宣伝だけを実作業の声として数えない。自動toolを使い、素材化し、定規で手を加える併用は確認できた。一方「プロの多くが自動toolを避ける」という割合は不明。破線/柔らかいウニや連続stampの一般的な使用頻度も今回の限定調査では確定していない。

### 作れるべき完成形

| 完成形 | 基本の構造/最初の状態 | 優先 |
|---|---|---|
| 普通の集中線（まばら/密/太い） | 内向きtaper、中央は透明、外は対象コマ/Canvas端へ。外向きも同じ場所から変更可能 | P0 |
| 密なウニ（細かい/強弱/荒い） | 中間が太く内外の端を払う多数の線。中央/外側の輪郭の揺れと太さを別々に制御 | P0 |
| 中ベタのフラッシュ | 中央の塗りと外向きspike。塗り色と線色は二slotで指定 | P0 |
| 白/下地色のフラッシュ | 同じ形状へslot交換。必要時のみ対象範囲を他slotで塗り、局所stampなら外側は透明 | P0〜P1（clip/塗りscope） |
| 叫びのギザ枠、二重ギザ枠 | 閉じたstroke輪郭。現行bodyはこの用途として保持し、密なウニと明示的に分ける | 既存維持 |
| 二連/多連ウニ、寸法/本数を変えた連続配置 | 一つずつ形/seedを変え、白/下地の塗りを含めて重ねる。連結線は手描き可能 | P2 |
| 人物に沿う集中線/ウニ | 基準の内側輪郭を少点で調整、選択maskで顔/身体を保護。中心は別に保持 | P3 |
| 破線、柔らかい線、複数band、稲妻 | 前3系統の品質と制作受入後に派生。稲妻の走路自動化は別task | 後段 |

新規入口のpreset案は6見本: 基本集中/細い集中/太い集中/ウニ標準/ウニ荒め/中ベタ。白フラは二slot交換で作り、色違いを形のpresetとして増殖させない。ギザ枠は別見本群へ残す。名称・数・初期密度はOwnerの制作評価で調整する。

### 推奨GUIと作業フロー

**見本を選ぶ → Canvasで囲む/置く → 密度・太さ・帯の深さを少し直す → 確定**を主にする。

1. 上部へ2行程度の小見本付きpreset。見本は実evaluatorから作り、名前だけ/装飾iconだけにしない。大きな第二preview canvasは復活させない。
2. その下に色2slot（線/塗り）と交換、内側=透明/下地色/描画色、適用範囲=Canvas/選択/クリップ先を集約。選べないscopeは理由付きでdisabledにする。
3. Canvasはドラッグで外形boundsを指定。楕円の横長/縦長はそのままgestureから得る。中心移動とinner/outer handlesが直接触れ、初期形はgestureの大きさへfitする。クリック配置は最後のboundsを基準にする。
4. 同じ基本画面に「密度」「太さ」「帯の深さ/線の長さ」と「別の形（seed変更）」を常設。密度は本数も併記、wheel/直接数値入力対応。片端/両端と内外方向は完成形に合う既定を選び、同じ場所で変更できる。
5. 自由な輪郭、個別の入り/抜き、角度/長さjitter、正確な座標は詳細へ。現在の3tabを主要操作の分断に使わない。Basic常設＋詳細の開閉を推奨し、詳細が増えた段階でだけ内部tabを設ける。
6. footerは固定、橙で「新規を編集中」/「レイヤーを再編集中」。適用/更新、取消、再編集が同じ場所。確定後はdraftを消し、必要なら「次を配置」で新規draftにする。再編集元とdraftの二重表示を避ける。

操作目標（最初の形/色が合う状態）: tool open後、**見本選択1回＋Canvas drag1回＋適用1回**で単独ウニ。白フラはslot交換/対象内塗りの指定が追加。常用presetなら前回の選択を使い、形の数値調整を必須にしない。人物を避ける局所修正は追加操作として測る。これは設計上の目標で、計測済みの速度ではない。

### 色・下地・clip・previewの判断

- 二slotは描画色（初期maroon）と**作品CanvasのBackground色**を初期値にする。CSSの `--futaba-background` / UIのcreamを読み取らない。黒0も有効。自由色は従来のpickerで変更できる。
- 新規配置中はBackground参照を追従させ、確定時には解決済み色をrecipeへ固定。後でBackgroundが変わっても保存作品の色を勝手に変えない。再編集中の色も保持し「現在の背景色を使う」は明示操作にする。
- 内側が透明なら下の絵が見える。下地色で塗る場合は不透明な色で絵を隠す。白い線、白い内部、透明抜きは別々の指定。
- 外側まで暗くする反転フラは**「対象範囲をslot色で塗る」**を明示ONにする。局所ウニのpreset選択でCanvas全面を自動塗りしない。指定コマ/選択scopeならその範囲だけ。通常レイヤーへclipする場合も下地と線を同じclipへ入れる。
- 初期は未設定scopeをCanvasと表示。前段のコマtool選択や通常clipの所有者を検証できた場合にだけ対象を使い、無関係な直下layerへ黙ってclipしない。既存clipのparent/orderと1Historyのredoを先に固定する。
- **出力どおりの色/不透明度のpreviewを既定**とする。橙guideとpanelの編集statusでdraftを示す。線そのものを固定半透明にしない。「下絵を透かして調整」は任意の補助表示であり、作品opacityへ保存しない。
- 出力の全図を見たい時はguideを一時非表示にする。Camera zoom/flip/rotateの投影とclipも一致させる。元Layerの一時display抑制は既存文字editorの境界を参考にし、Export/Project/snapshotは元の確定画素を使う。二つ目の浮動確定popupは増やさない。

### 解像度と多様性

推奨は**配置範囲に応じて形状/線幅を組み立てるpreset**。400/1700/7000用の固定数値表だけでは、同じ紙面内の大小のコマと小さな吹き出しに対応できない。

- 参照は指定effect bounds（または対象コマ）とし、Canvas全体は未配置時の初期boundsだけに使う。幅/内外band/抜けは基準寸法への比率、確定時は作品pxへ解決する。
- 密度/本数は完成図の印象と連動させる。出力解像度を17.5倍にしたから本数も17.5倍にする方式にはしない。縦長/横長でも帯の見え方を比較してcalibrateする。
- 同一比率で配置した400×400、1700×2400、4960×7016を比較し、別々の固定presetを操作者に選ばせず形を保つ。高解像度から縮小した出力と、小解像度の直接出力を見比べる。1px線の可読性は別check。
- 乱数は単なる全field独立randomにせず、細い線の集合/太いアクセント/局所の線長揺れを役割別にする。整った/荒いは完成shapeのpresetで選べるようにする。
- seedは現在のdrag/resize中は固定、明示「別の形」または次の配置時だけ変更。count変更時の揺れは急な全再配置を避ける設計を試験する。レシピ再読込は同じseedから再現する。
- 個人presetは既存UI設定へ形状比率/密度/色方針を保存する候補。Projectやfont管理に第二のpreset正本を追加しない。

### コードの責務と互換方針（仮設計）

既存のpure幾何、SVG表示、確定raster、通常Layer/Historyの分離は使える。UI全体の作り直しや新rendererを必要条件にしない。

| 責務 | 現行/変更候補file | 限定する内容 |
|---|---|---|
| 正規化・recipe互換 | `system/focus-lines.js` | 旧recipeは旧evaluatorで同じ形を保つ。新ウニを識別するoptional項目と上限は実装Cardで決める。schema versionを独自に上げない |
| presetの完成形・寸法解決 | 候補 `system/focus-lines-presets.js` | 完成形id、ratio、UI label、target bounds→解決値。旧absolute presetを新規用に再定義しても旧保存dataへpatchしない |
| 両端taper/band geometry | 候補 `system/focus-flash-geometry.js` | DOM/Pixi依存なし。inner/middle/outer、細線/強線、seedと揺れ。旧ray/bodyと責務を分ける |
| Canvas表示・gesture | `ui/focus-lines-overlay.js`、`ui/focus-lines-popup.js` | 同じgeometryでpreview、中心/内外/新規bounds入力。Camera/Space/global Vを優先し、通常penの入力を横取りしない |
| 確定画素・paint範囲 | `system/focus-lines-raster.js` | 同じgeometry、線/内側/外側paint、target clip、small effectのbounds。全面RGBAを毎drag作らない |
| 追加/更新/取消・History | 候補 `system/focus-lines-layer-adapter.js` | popupのapply/updateを限定分離。通常Raster/optional再編集情報/画素guard、clip/orderを一Historyで扱う。generic command busを作らない |
| GUI/色・preset選択 | popup + `styles/components/focus-lines-editor.css` | common部品/semantic tokens。カメラ投影・UI位置・runtime previewをrecipeへ保存しない |

新fileは責務が明確になる場合だけ作る。既存fileの小helperに収まる仕事まで分割しない。headerにauthority/invariants/関連入口を記し、将来のAIが旧系/新系・保存/preview・presetを見分けられる配置にする。正式なファイル所有・境界は次の実装Cardで発行する。

### 実装順と受入条件

| 順 | Slice | 必須の確認/止めどころ |
|---|---|---|
| 0 | 現行rayの寸法/preview/scopeの修正 | 400/1700/4960で線が潰れない、旧recipe画素不変、元Layerの二重表示なし。不透明な見本で工程1の品質を判断できる |
| 1 | ウニ標準・荒め・中ベタのgeometryとpreset | 添付の系統を初期選択で識別できる。両端が細い、密な帯/強弱/縦横の多様性。seed再現。presetだけで制作可能になるまで局所点/特殊線へ進めない |
| 2 | 小見本・基本調整常設・Canvas drag・二slot | 見本→drag→適用の3操作で配置。数値tab探索不要、密度/太さ/wheel/seed、色交換/内側塗り、1280×720/360×640固定footer |
| 3 | コマ/選択clipと対象内塗り | preview/確定scope一致、人物/コマ外へ漏れない、clip parent/order保持、追加/再編集/UndoRedo/Project/PNG。同時に有界rasterで高原稿の確保量を測る |
| 4 | 個人presetと連続配置 | 再openでpreset利用、次の配置は新seed、数/寸法に程よい差。各placementをUndoできる。初期は個別Layerで既存再編集を保ち、複数objectの新保存schemaを要求しない |
| 5 | 人物の周りの少点輪郭、破線/柔らかい派生 | innerの部分修正で顔を逃がす、編集前後の品質/seed保持。選択maskで足りる制作を先に評価。稲妻の自動走路は別Card |

制作受入の最小場面: (a)普通の集中線を1コマへ、(b)セリフ用の縦長の密ウニ、(c)暗いコマへ下地色のフラッシュ、(d)人物の顔へ線を入れない配置、(e)大小3つのフラッシュを続けて配置。完成形を見るまでのclick/tab/scroll、調整の往復、previewと確定の差を記録する。Node/pure/保存PASSだけで「使える」を承認しない。

次の限定着手は0〜1の「原稿寸法に合う初期値＋実用ウニの形」を推奨する。今回作った二種類の線列比較はworkspace外の模式図であり、製品実装/品質受入とは別。製品実装はOwnerの次の指示後、各Sliceの確定Cardで行う。

## Previous slice — 図形の線/内側色・多角形・Canvas集中線

### Owner follow-up — 図形の線/内側色・多角形・Canvas集中線（2026-10-05）

Ownerが調査後の実装を指示。クリスタ公式の線/塗り別設定とMediBang公式の多角形/選択境界からの吹き出しを参照し、閉領域の入力とpaintを共用する。参考: [線・塗り](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/は行.htm)、[選択境界の描画](https://medibangpaint.com/use/2019/08/speech-bubble/)。

確定Slice: QTP図形で空くpreset領域を内側色へ使用。旧欠損設定は四角/楕円=線のみ、投げ縄=旧単色塗りを保持。明示paintは線のみ/線と同色/自由色（初期Canvas Background色、黒0も有効）。線幅はQTP SIZE。不透明度は塗りと線を合わせた結果へ一回だけ。閉じた領域はSVG previewと確定で同じcontour/線polygonを使い、既存選択mask/通常Raster/一History/Projectを保持。自己交差塗りはeven-odd、多角形点は有限・最大256、手描き投げ縄は有限な採取点列を保持し、作品へ編集点を新保存しない。新多角形は点click追加、既存点drag、始点click/Enter確定、Backspace末尾取消、Esc破棄、Shift45度補助。途中previewは画素/Historyへ書かず、3点未満は確定しない。既存Space Camera/global Transformを優先。

worker SHAPE_WRITE: `system/shape-tool.js`、`system/selection-area-tools.js`、`system/pixel-selection-system.js`、`system/drawing/fill-tool.js`、new `system/polygon-shape-tool.js`/`system/closed-shape-paint.js`、限定pure verifier。既存shapeの確定時CPU compositorを共用し、live pen strokeへCanvas2Dを混入しない。QTP UI/slots/CSS/共通icon・docsはleadのみ。

worker FOCUS_WRITE: `ui/balloon-popup.js`（明示あり/なしのみ）、`ui/focus-lines-popup.js`/`ui/focus-lines-overlay.js`、`system/focus-lines.js`/`system/focus-lines-raster.js`、new集中線CSSと限定verifier。集中線の小preview/overlay OFF UIを外し、Canvas常時表示と共通glass密度/目的別context/固定footer。既存params/旧放射polygon評価は保持。ウニの閉輪郭はoptional `body={kind:'outline'|'ring',lineWidth,fillColor:null|hex,inset}` のv1 recipe（欠損時旧出力）。閉輪郭は角度順の谷/先端点と有界jitter、ringは同じ輪郭の中心縮小で入れ子を保ち中心を透明にする。outlineは背景色の初期塗り/透明切替、線幅と色を編集。SVG/PNGは同じpure contourを使用。放射/枠/二重枠(中抜き)を明示、outline/ringで本数を256以内、手動drawn領域はCanvas寸法へclip。旧rayの機能/Project/再編集/Undoを保持。本文は既存文字ツールを重ねる入口、本文統合や新Layer schemaは今回なし。

lead WRITE: QTP UI/slots/icons/CSS、新Browser fixture、関連verifier/harness/当Card/STATUS。他担当の一般Raster保存block/WP033/RIGはread-only。workerは同checkoutに他担当がいるため既存差分を戻さず、担当外のfileを変更しない。報告だけでcloseせずleadが実Browser・保存画素/Undo・1280/360px・関連test/buildを監査。最終制作受入/pushはOwner。ネーム/AI配置/部品union/ベクターレイヤーは今回対象外。

### 図形paint・Canvas集中線の結果（2026-10-05）

TECHNICAL COMPLETE / OWNER REVIEW。吹き出しの選択中しっぽへ明示「あり/なし」。QTP図形の空く筆preset棚に線のみ/同色/自由色とCanvas背景色への追従を配置し、ペンへ戻ると従来6スロットを復帰する。矩形/楕円/多角形と明示paintの投げ縄は、共通 `closed-shape-paint.js` で線と塗りを合成してからopacityを一回だけ適用する。選択maskと通常Raster/既存Historyを使用し、拡張前snapshotを保持、描けない場合の空拡張もrollbackする。新多角形は最大256点、点追加/移動/始点またはEnter確定/Backspace/Esc/Shift45度。手描き投げ縄は採取済みの有限点列を保持し、256点で切らない。欠損/legacy投げ縄は旧GPU塗りを保持。

集中線はCanvas常設へ移し、小previewとoverlay OFF UIを撤去。共通glass、形/線・配置・ばらつきcontext、固定footerと数値wheel。旧5preset/放射方向/再編集を維持。optional v1 bodyの外枠/二重枠は谷と先端の交互点（最大256本）をseedから生成し、ringは同じ輪郭を中心縮小して透明な中央を作る。枠線の幅・色・内側塗りを編集でき、本文は文字tabで重ねる。枠で無効な放射幅/尖らせ、外枠で無効な中抜きは表示しない。SVGはviewportのbody直下に置き、現在のCamera投影、zoomに対応する線幅、回転Canvasの四辺clipを使う。Project/History/rendererの正本、手描きpen pipelineは変更しない。

- 実Chromium `build/wp030-shape-paint-browser.html`: 四角dragと編集中SIZE、自由色/輪郭色/opacity一回、背景黒0、内側透明、線と塗りの選択mask、空拡張rollback/拡張前boundsへのUndo、凹多角形の点移動/Backspace/Enter/Esc/Shift45度/始点確定、513点投げ縄のlegacy GPUと明示paint、ペン6スロット復帰、実Project export/loadとPNG全画素一致、1280/360px PASS。
- 実Chromium `build/wp030-focus-body-browser.html`: 明示しっぽなし/復帰、旧ウニフラpreset/向き、外枠/透明塗り/透明中央の二重枠、Canvas中心drag、zoom線幅/回転clip、SVGviewport原点、1History、実Project/PNG全画素一致、recipe再編集/更新UndoRedo、数値wheel/Space Camera、1280×720・360×640/400で確定操作、現在Cameraの投影 PASS。gesture/wheelは製品のhandlerへ合成eventを送るfixtureであり、液タブ/native連続drag完走の証明ではない。
- 通常の製品tabでも実buttonでモード/内側色と線幅keyboard、外枠/二重枠のCanvas位置を確認。確認画像はworkspace外 `wp030-shape-paint-final.png`、`wp030-focus-body-final.png`、`wp030-focus-ring-final.png`。iframe fixture初期化にMutationObserver error（起点未確定）が記録されたが、通常の製品tabは同errorなし。当Sliceの操作/保存結果とは分離し、RIG所有fileへ修正を広げない。
- 構文、area-tools5/focus-lines2/balloon5/tool-slots1/Project11、QTP preset/progressive density/static style、harness check、production build、対象diff-check PASS。buildの既存module externalization/chunk-size warningは保持。公開font原本の追加はゼロ。

main/e0f353ed、開始871c51ed。途中のOwner/external commitで先行差分の一部がHEADへ入ったが、lead/workerはcommit/pushしていない。並行WP033/034・RIGと全既存dirtyを保持。Owner制作/液タブ受入は未。フォント追加取得、ネーム/AI配置、union/後編集可能な輪郭部品、正式Vector Layerは次の独立判断であり、今回へ進めない。

### Owner follow-up — 入力先表示・吹き出しCtrl操作（2026-10-04）

Ownerは漫画panelが入力先なら橙枠、Canvasへ移ったら枠を外す表示を指示。「吹き出しが操作できない」はCtrl+drag/wheelと回答。現行のCtrl対象callbackはコマだけで、吹き出しに未接続だった。限定WRITE: 共通manga-tabs/input表示、manga-canvas-navigation、balloon popup/overlay、pure balloon-gestures（new）、対象CSS/fixture/純検証、当Card/STATUS。letteringのlocal Vは表示した入力先と一致するよう既存入口にscope gateを追加してよい（Ctrl+Enter等の既存確定契約は保持）。

- 表示はruntime-onlyの入力対象。show/tab/漫画内pointer/focus、draft overlayの操作で橙枠、Canvas/他UI操作で解除。Space Camera/global V Transform中は解除。Canvas pointer操作時に漫画入力欄の古いfocusを残さない。作品・Project・Historyへ保存しない。
- Ctrl+dragは吹き出し本体内で全体移動。旧中心handleと同じ本体/全tail tip/本文相対追従。Ctrl+wheelは全体を本体中心から一様拡縮、全tail tip追従。本文font指定sizeと線幅/しっぽ幅は保持し、autoFitは既存評価。文字contextでも全体操作と明記。
- 通常の本体内hitは描画へ透過。Ctrl中だけ捕捉し、Space/global Vへ譲る。修飾release/blur/hideで残留させない。Shift/Altは新rotationへ割当せず既存Camera/snapを保持。回転保存属性や新形状schemaは追加しない。
- 検証は中心/全tip/二連/本文領域の相対追従とfont/線幅保持、旧recipe/保存画素/Undo、入力先表示/比較窓/Canvas/Space/V/入力欄、実Browser hit/pointer/wheel/狭幅、syntax/関連harness/build。

後半の図形＋合成吹き出し、ネームtab/番号対応/JSON・AI配置は調査設計の候補で、今回の製品実装へ混ぜない。

### 入力先表示・吹き出しCtrl操作の結果（2026-10-05）

TECHNICAL COMPLETE / OWNER REVIEW。共通 `manga-input-focus.js` は漫画4tab/比較窓/draftの入力対象をruntimeの橙枠で示し、Canvas/他UI操作、Space Camera、global V Transformへ移ったら解除する。Canvas/SVGクリックで古い漫画control focusを外す。文字のlocal V/wheelもこの表示に従い、Canvas入力時は既存global Vへ譲る。Ctrl+Enterの既存確定契約は保持。

吹き出しに欠けていたCtrl callbackを接続。本体内部はCtrl中だけwhole-object移動hitを持つ。pure `balloon-gestures.js` が既存rect/全tail tipを移動・中心一様拡縮し、二連/本文相対frame/輪郭は追従する。手動font size/線幅/しっぽ幅は保持。通常の本体内は描画へ透過、Space/global Vを優先。Shift/Alt rotation、新recipe属性、保存/History正本は追加していない。footerに全体操作の短いhintを置いた。

- 実Chromium `build/wp030-manga-input-browser.html`: 全4tabの単一橙枠、Canvas/入力欄blur/比較窓、実DOMの本体内 `elementFromPoint`、Ctrl pointer連続移動とwheel拡縮、全tip/二連/本文追従、manual font/線幅/Camera/History不変、Space/V優先、Project recipe/全PNG画素一致、更新Undo、lettering local/global V切替 PASS。gestureは製品へ合成eventを送るfixture検証であり、native修飾drag/wheel完走と区別する。
- 既存 `wp028-lettering-browser.html`、`wp030-manga-gestures-browser.html`、`wp030-balloon-text-browser.html` 回帰PASS。本文fixtureは360px/低高footerも確認。実UI clickで橙枠→Canvas右clickで解除→漫画tab clickで復帰を確認。確認画像は `wp030-manga-input-primary.jpg`（workspace外のローカル検証成果）。native連続Ctrl drag/wheel・液タブ・制作受入はOwner未確認。
- syntax、balloon5/editable-lettering9/panel-layout2/fonts7/Project10、shortcut-learning、production build、diff-check PASS。共通harness checkは初回84 documents/324 linksでPASS、最終は並行追加されたWP033のGoal見出し不一致で停止（当Slice対象外、他担当のCardは変更しない）。既存buildのmodule externalization/chunk-size warningは残る。

main/871c51ed、既存文字/並行RIG差分保持、未commit/未push。検証後に並行WP033の一般Raster PNG block更新を確認。上記Project画素結果は更新前の本Slice実測であり、WP033後の全体保存受入は同Cardの担当へ委ねる。図形合成とネームは以下の調査設計だけを追加し、製品未実装。

### 図形・セリフ・ネームの分担案（2026-10-05、調査のみ）

Owner案の「楕円/矩形/自由輪郭を作る→重なりを合成→しっぽを接続→必要な線を直す」は筋がある。[CSP公式の吹き出し](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/フキダシ【PRO__47_EX】.htm)にも図形/ペン/しっぽ別ツール、同一layerの重なり結合、制御点編集、本文sizeを維持した本体編集がある。自動化全体が未成熟と総括せず、輪郭・組版・読み順を異なる編集責務として扱う。

推奨は閉じた輪郭の部品を残す非破壊合成。表示はunion外周、元の楕円/自由線/しっぽは再編集できる。合成境界だけを直接編集する場合は、元部品の編集から「輪郭として編集」への明示変換にする。元部品のつまみ操作と、合成後の任意線編集を同時に正本にしない。接続しっぽは元の点列と補正後形状を分け、角を残す/滑らかの強さを選べる方がよい。自己交差・穴・離れた本体・合成後のしっぽ根元は新しいgeometry/recipe検証を伴い、今回の小修正ではない。

| 入口 | 共用候補 | 漫画固有の追加 |
|---|---|---|
| 楕円・矩形・多角形・自由線 | 座標/点/curve/grid/snap/線と塗り | 後編集可能な輪郭部品、union、しっぽ接続、共通線幅 |
| 投げ縄・投げ縄多角形 | 入力gestureと閉領域の点列 | 閉じる補正、角の保持、編集用点列の保存。塗り済み画素だけを輪郭正本にしない |
| ギザギザ・ウニフラ | seed/半径/線polygon等のpure評価 | 背景と輪郭、内側文字領域。現行focus-linesは線polygon列で、閉じた吹き出しと同一出力ではない |
| セリフ | 共通paragraph/書体/文字editor | 通常は吹き出しと関連付け、高度編集は独立文字。clipboard貼付だけを同期方法にしない |
| ネーム | 本文編集・コマ一覧 | コマ/セリフID、表示順、話者、用途、配置案と手動固定 |

ネームから配置する先例はある。[Comic Life 3のScript Editor](https://plasq.com/2015/02/using-the-script-editor-in-comic-life-3/)は脚本のキーワードからコマ/セリフ等を認識して、pageへdrag配置できる。[CSPのStory Editor](https://help.clip-studio.com/ja-jp/manual_jp/570_pages/ストーリーエディターを使う.htm)は複数pageの本文を一覧入力/編集する。Comic Lifeの[公式説明](https://plasq.com/2014/05/scripting-comics-in-the-classroom/)ではscriptからpageへ進んだ後の編集がscriptへ自動反映されないとされる。これは同期が双方向かをTegakiで先に決める参考になり、自動最適配置の実在証拠とはしない。

Tegaki案は `コマ → 読み順のセリフ一覧 → 配置案 → ユーザー補正`。コマ番号/吹き出し番号は表示用とし、並替え後も同じ対象を指せる安定IDで関連付ける。本文は一つ、Canvas文字とネームは同じ本文への複数入口。初期fitは余白・文字size下限・読み順を守る有界proposalとして生成し、手動補正した座標/sizeはロックして再計算で上書きしない。

将来JSONの候補はpage/panel/dialogue IDs、本文/話者/用途/順序、書式preset、候補矩形、手動固定field。AIはその制約内の配置案を返し、ID/範囲/本文保持を検証してpreview→明示適用する。Project保存正本をAI出力へ置換しない。参照対象ID・本文同期・Historyと保存契約は次の別Cardで確定する。今回JSON形式もネームtabも未実装。

### 承認された順序分の結果（2026-10-04）

TECHNICAL COMPLETE / OWNER REVIEW。常設font/基本サイズ/二連本文対象、輪郭と独立した文字領域の移動・resize・収め直す、外周/本文衝突/下限overflow警告、共通paragraph adapter、合計4本までのしっぽ、Canvas直線・斜線分割、コマ/分割/全体contextと固定footerを実装。分割のShift水平/垂直、連動コマのCtrl境界操作とフリーコマの移動/拡縮/回転、Space Camera優先、global V ownerへ譲る境界、T文字tab開閉を確認。通常Raster/optional v1 recipe/既存Historyの所有を保持する。

コマpopupは内容に応じた高さ（viewport上限あり）とし、初回openで最初のコマを選択。通常連動コマの内側は描画へ透過、分割mode・Ctrl対象操作・選択freeの内側は操作面とする。native dragで旧stroke-only hitがペン描画へ抜けることを発見して修正。修正後は実Browserの`elementFromPoint`で本体内側へのhitを検証。自動操作器のnative dragはSVG再描画中に停止したため、修正後のnative連続drag完走は未確認。fixtureのpointer連続操作/Camera/保存はPASSであり、native完走と区別する。

実Chromium:

- `build/wp030-balloon-text-browser.html`: font wheel、輪郭変更で領域保持、領域移動/折返し・size不変、本文①②対象と重なり警告、収め直す、outside raster bounds、Project/画素/Undo、SpaceとT、360px幅/640・400px高footer PASS。
- `build/wp030-paragraph-browser.html`: system/実外部書体×縦横×align3種の12組、従来requestとの寸法/全RGBA一致、指定改行とunsupported属性拒否 PASS。共用範囲は矩形単一書体/第一フチ。HarfBuzz自動禁則折返し・高度文字属性のparagraph移植は未実装。
- `build/wp030-manga-gestures-browser.html`: 複数しっぽ選択/移動/全先端追従/上限/削除、Project/画素/Undo、コマ斜線/Shift/短線拒否、Ctrl連動境界・free変形、内側hit/修飾解除、Camera/global V、clip群のProject/再編集/UndoRedo、360px footer/context PASS。斜線/free/clip群のProject画素差0、復元12件。
- `build/wp030-balloon-editor-browser.html`、`build/wp028-lettering-browser.html` 回帰PASS。native T開閉/textarea入力優先、コマGUI表示を確認。

構文、balloon4/fonts7/editable-lettering9/panel-layout2/Project10、shortcut-learning、harness check、production build PASS。制作受入/液タブ/修正後nativeコマdragはOwner確認待ち。main/871c51ed、既存文字/並行RIG差分保持、未commit/未push。

残る候補: しっぽの折れ/離れた本体のつなぎ、集中線context整理、文字別局所9点、追加font監査・取得。コマの辺別枠ON/OFF・任意多角形/曲線は上記調査候補で、今回完了に含めない。

### 実装続行 — 常設書体・文字領域・Camera優先（2026-10-04）

Ownerは調査提案の順序を承認し、Space/ShiftのCamera操作と修飾キーでの対象操作も提案。現在の限定Sliceは常設font/サイズ、本文①②の対象表示、独立文字矩形の直接移動/resize/収め直す、収まり/衝突表示、Camera優先。WRITEはballoon popup/overlay/raster/geometry、独立pure `balloon-text-layout.js`、対象CSS/検証、当Card/STATUS。geometry/layout担当とUI担当のwriteは分離。既存文字renderer/keyboard/Cameraはまずread-onlyで割当を監査し、既存grammarに衝突する修飾を新設しない。

- optional `text.frame` / `double.frame` は各本体rectに相対的な `{x,y,w,h}`。欠損recipeの旧配置は保持する。新規形変更/明示「収め直す」で領域を初期化し、輪郭点dragで初期化済み領域を変えない。本体移動/resizeには相対追従、文字size変更とは別。
- 二連初期化は本文矩形同士の重なりを解消する。内容は別正本①②のまま。文字の移動/resizeは選択本文だけ、書体・基本書式は今の共通書式を保持して対象表示を明記。
- フチを含む確定前文字boundsの本体外/本文衝突を表示し、見えないclipで隠さない。下限で収まらない場合も表示する。勝手に本文を書換えない。
- Cameraの既存Space/Shiftを優先し、Space中のoverlay hitをCameraへ譲る。T/Ctrl/Altは監査後に確定する。保存/History/renderer正本とSOURCE/ANIMATE grammarは変更しない。
- pure sanitize/旧互換/相対追従/衝突、本物Browserの領域drag/折返し/フォントwheel/Camera/保存画素/再編集/Undo/低高footer、syntax/関連harness/buildを検証する。

監査後の追加WRITE: `config.js` / `ui/keyboard-handler.js` の既存popup actionにTの文字tab開閉を追加。`ui/settings-popup.js` の既存shortcut分類にも同actionを追加し、表示と実行の正本を揃える。入力欄/IME中は既存keyboard gateに従い、確定キーにはしない。Ctrlによるコマ操作は後段のコマSliceで対象選択と既存Transformとのowner境界を定義してから追加する。Altは既存snap解除のため再割当しない。

共通文字エンジンproof→複数しっぽ→コマ直接分割はこのSliceの検証後に限定契約を更新して順に進める。

### 共通paragraph proofと限定移植（2026-10-04）

WRITE追加: `system/lettering-paragraph.js`（new共通model→browser paragraph adapter）、`system/lettering-vector-renderer.js` のsystem paragraph request/measure/render分岐のみ、吹き出し組版caller、専用Browser fixture。当Sliceの独立領域・旧recipe互換のBrowser PASS後に開始。browser paragraphとHarfBuzz outlineは用途別backendとして保持する。新adapterは矩形折返し・指定改行・縦横・単一書体・第一フチの共通model属性を扱い、文字別/第二フチ/曲線/envelope/sizeProfileを黙って捨てずunsupportedで拒否する。吹き出しに未対応UIを増やさない。既存advanced imported branchは変更しない。

移植前proof: system/imported font、縦横・禁則を含む本文/改行・第一フチ・align・trackingで従来browser requestと新adapterの寸法/確定画素一致、属性拒否を検証。その後に同じadapterへ吹き出しと独立文字system branchを接続する。これは矩形paragraphの共用であり、HarfBuzzの自動禁則折返しや高度文字属性をparagraphへ移植した完了証拠とは扱わない。

### 複数しっぽの限定契約（2026-10-04）

共通paragraph proofの全12組（system/外部、縦横、align3種）の寸法/全画素一致とunsupported拒否、既存文字8検証PASS後に開始。WRITE: balloon geometry/popup/overlay/CSS、専用pure/Browser検証。既存 `tail` を第一しっぽとして保持、optional `extraTails` を最大3件追加（合計4）。各追加しっぽは既存と同じenabled/style/tip/width/curve、Canvas world tip。欠損/空配列は保存キーを追加しない。描画は既存本体＋tail polygon stroke/fill経路、根元は本体union外周で求める。本体全体移動に全先端追従、本文領域は無関係。番号選択と追加/削除でしっぽcontextの設定対象を明示し、Canvas先端選択も同期。primaryは削除せずOFF、extraは削除可。旧recipe/画素互換、複数尖り/丸混在、sanitize上限、Project再編集/Undo/PNGを検証する。History/保存schema/renderer正本は変更しない。

### コマ直接分割・compact GUI・修飾操作（2026-10-04）

WRITE追加: `ui/panel-layout-popup.js` / `ui/panel-layout-overlay.js` / 対象CSS、new `system/panel-layout-gestures.js` / `ui/manga-canvas-navigation.js`、関連pure/Browser fixture、balloon navigation caller。既存分割木/凸四角形/normal Raster/既存group Historyを維持する。Canvas「線で分割」modeのdragを対辺の分割比/傾きへ写し、短いdrag・対辺を横断しない線・既存傾き上限外は明示拒否する。Shiftは線の水平/垂直吸着。プレビュー線はruntime-only、pointerupで既存splitPanelへ一回適用、Space/blur/cancelは破棄。

GUIはコマ/分割/全体contextと固定footer、補助previewは開閉式。Space+drag/wheelとShiftのCamera grammarをoverlay上でも維持。Ctrl+dragは連動コマの親境界移動、フリーコマ移動。Ctrl+wheelは連動コマの親境界比（Shiftで傾き）、フリーコマは中心拡縮（Shiftで回転）。normalを勝手にfree化しない。global V Transform中はCtrl aliasを使わず既存ownerへ譲る。Altは既存吸着解除。Tは漫画文字tab開閉。native Browser/geometry/保存clip群/Undo/Project/低高footerで検証する。

Browser切分けで斜線/回転フリー/clipのProject往復に1623channel差、12件のgroup member復元を確認。追加WRITEは `system/project-manager.js` の既存PNG生成branch条件のみ。コマも既存lettering/balloonと同じ正規straight-alpha snapshotからencodeし、extract後の再alpha変換を避ける。新保存正本/schema/PNG形式を作らず、画素一致とProject suiteを再実行する。


### Owner follow-up — 文字領域と漫画ツールの調査設計（2026-10-04）

状態: 調査完了 / 設計提案（後続実装は上記限定契約と下記結果を参照）。この調査時点では製品実装を変更していない。Ownerは一元化を「編集・エンジンの共用、出入り口はマルチ」と訂正。セリフ側の直接font選択/wheelを保持し、本体/しっぽ編集中でも使える共通headerにfontと基本サイズを置く案を推奨する。詳細書式/文字領域操作は文字context、管理/分類は既存比較窓の情報・整理。共有しても、開いた入口の編集対象を窓に明記する。

現行codeで確認した問題:

- `balloonTextArea`は自由輪郭の最小radiusで中央矩形全体を縮める。200×260px/線3pxの同じ本体で、一点のradiusを1→0.5にすると文字矩形は142×186.4→68×90.2px。局所的な凹みのために空いた側も狭くなる。
- 二連は別々の入力を各本体へ置き、一本の文章を自動で渡す機能はない。初期dy=0.5/scale=0.85の上記本体では、文字矩形同士が高さ41.97px重なる。実際の文字衝突を必ず意味する値ではないが、最大限入力すると重なる余地があり、独立autofitだけでは防げない。
- 自動文字サイズの下限8pxでも収まらない場合の明示的overflow判定がない。無言で極小化/欠落させず、収まらない状態を扱う設計が必要。
- fontLibrary/FontComparisonは共通だが、吹き出しは`lettering-raster.js`のbrowser矩形組版、独立文字は`lettering-vector-renderer.js`（imported outline / system paragraphの既存分岐）。高度文字側のHarfBuzz組版は改行を基に配置しており、矩形の自動折返しをそのまま置換できるとは未証明。

公式資料から確認した操作（アプリの実機操作・内部source確認は未実施）:

- [CLIP STUDIOの吹き出し](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/フキダシ【PRO__47_EX】.htm): 本体の制御点、しっぽだけの選択/変形、重ねた本体の見た目上の結合。吹き出しの拡縮で文字サイズを変えず配置を調整する。[テキストフレーム](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/か行.htm)は矩形内折返しと文字サイズを分けて操作できる。任意輪郭に沿う自動段組みの存在は、この調査では確認していない。
- [CLIP STUDIOのコマ割り](https://help.clip-studio.com/ja-jp/manual_jp/540_comic/コマ割り【PRO__47_EX】.htm): ドラッグ分割、隣接コマの連動、コマ内の絵を変形しない枠編集、個別制御点、裁ち切り。[分割設定](https://help.clip-studio.com/ja-jp/manual_jp/810_subtools/わ行.htm)には直線/折れ線/スプラインと通過点の増減がある。
- [MediBang Paint Androidの漫画制作](https://medibangpaint.com/use/2022/01/how-to-make-a-comic-1-android/): 吹き出しは手描き、楕円＋折れ線の選択領域から境界描画、素材の利用。[MediBang Palettaのコマ](https://medibangpaint.com/medibang-pro/manual/objects/comic-frame/)はドラッグ分割/90度吸着/枠選択後の文脈メニュー。PalettaとPaintの操作は別製品の説明として扱う。

文字配置の候補評価（5点満点、Tegakiでの操作安定性・日本語セリフ・既存実装への適合に対する設計判断。実測UX評点ではない）:

| 案 | 評点 | 判断 |
|---|---:|---|
| 輪郭とは別の文字矩形＋自動初期配置＋直接移動/拡縮 | 5 | 推奨。輪郭変更で毎回改行を変えず、必要時だけ「収め直す」。改行/指定サイズを保ち、領域の修正を優先 |
| 輪郭断面に沿って行/列ごとに自動配置 | 3 | 後段候補。日本語禁則、縦書き、凹み、二連の読み順、drag中の改行変化を検証する必要がある |
| 文字量に合わせて本体を常時自動変形 | 2 | 常時動作はコマ内の絵・しっぽ・二連配置を崩す。「文字に合わせて本体を広げる」の明示操作なら候補 |

推奨設計: 吹き出し外周、本文、文字領域を別々に編集する。本文は一つの正本を保ち、自動改行は評価結果にだけ持つ。新規時は本体内の余白付き矩形を提案し、文字領域を手動調整後は輪郭点dragで改行/位置を勝手に再計算しない。本体全体の移動には追従させ、拡縮時の領域追従は意味を固定する。文字領域の幅/高さ変更は折返しの変更とし、文字サイズ/warp操作とは分ける。内側に収まるかは本体形状＋線幅/余白で判定し、しっぽは文字領域から除外。確認にはフチを含む文字boundsを使用する。

二連は「本文①／本文②」を明示し、Canvasで本体/文字領域を選択すると入力と設定対象を同期。二つの安全領域を求め、結合部での重なりは警告・領域移動で直せる。まず別本文を保持し、「続きへ送る」方式は明示区切り＋一つの本文を基にした派生配置として後段検討する。空の第2本文へ第1本文を無言で複製/分割しない。

一元化の次の技術proof: 共通文字model/rendererに矩形内paragraphの評価を渡せるadapterを検証する。吹き出し側へ文字editorそのものを複製しない。縦横折返し/禁則/指定改行/外部とsystem font/フチ/文字別指定/測定と確定の一致を先に固定する。既存browser paragraph経路を保持したまま移植できることを証明してから統合する。作品は引き続き通常Raster＋optional recipe、編集入口ごとのadapterが既存History/保存を担当する。Vector Layer新設は必要条件にしない。

コマの着地点: 簡単漫画専用として機能を止める根拠はまだない。現行`panel-layout.js`には直線分割木、隣接追従、間隔、吸着、裁ち切り、コマ内コマ/フリー化がある。一方、コマは常に凸四角形で、任意多角形・凹形・曲線は現行の小改修ではない。

| 優先 | 次の候補 | 適合と境界 |
|---|---|---|
| 高 | 共通glass/context/固定footerとCanvas直線ドラッグ分割 | 既存分割・吸着を利用できる。縦横＋斜線を分割比/傾きへ写す試作から始める |
| 中 | 辺単位の枠線ON/OFF、連動/独立の分かるCanvas操作 | ぶち抜き・開いたコマを簡単にする。枠線表示と描画clipの意味を別々に検証 |
| 中 | 独立した多角形/曲線コマ | 図形/輪郭の評価部品を再利用できる。ただし保存sanitize、hit、clip、raster、再編集を揃える別Cardが必要 |
| 後 | 曲線分割まで隣接コマを自動追従 | topology/間隔処理が大きく変わる。独立コマで必要性を評価してから決める |

共用候補は座標変換、点選択/追加削除、grid/snap、曲線評価、文字計測/描画。コマの隣接分割木、本体と本文の関連、しっぽ根元の追従はtool固有に残す。既存clipを輪郭変形から文字の欠落を隠す手段として使わない。

次の実装順提案は「常設font/サイズと対象表示 → 文字領域の直接編集・収まり/二連衝突の扱い → 共通組版proof/移植 → 複数しっぽ → コマのCanvas分割とcompact GUI」。これは上表Sequenceの開始前調整案であり、今回の調査から製品変更を自動開始しない。

### 段階2 — compact吹き出し・輪郭点・二連（2026-10-04）

Ownerは管理/分類の初期展開、比較/情報の入口統合と次改修を指示。WRITE: `ui/balloon-popup.js`、`ui/balloon-overlay.js`、`system/balloon-geometry.js`、`system/balloon-raster.js`、対象CSS、文字のfont入口、管理部品、関連verifier/fixture、当Card/STATUS。pure geometryとUIはfile所有を分ける。

- 管理/分類は初期展開。一つの「書体」buttonで比較窓へ入り、見本/情報の既存tabを使う。
- 吹き出しは本体/しっぽ/文字context、固定footer、共通glass密度11px/幅316px。previewは補助として既存開閉を保持。数値wheelは既存NumericField。
- custom輪郭はrectに相対的な角度/radius点（4–24個）をoptional paramsへ保存、連続曲線をpure evaluatorで評価。Canvas point drag/選択/追加/削除/戻す。grid/snapはUI設定で作品へ混ぜない。
- doubleは重なる二楕円の外周として評価。secondaryの相対位置・一様size・別contentのみoptional paramsへ保存。両body文字は同じ書式、別文字領域。重なりを維持し内部線を出さない。移動/resizeで相対配置維持。
- 旧4shapeのparams/評価結果は変更しない。通常Rasterとoptional v1 balloon recipe、既存Project sanitize/History経路を利用し、新正本/schema/rendererを作らない。全preview/確定は同じpolygon evaluatorと文字画像を使用。
- 検証: geometry旧shape比較/悪値sanitize/点追加削除/二連外周と文字領域、実Browser Canvas drag・相対移動・結合境界/本文2件・Project/PNG/UndoRedo、1280/360pxと固定footer。
- 今回の次改修は段階2まで。複数しっぽなど段階3以降は後続。

Browserで旧楕円にもProject往復361channelの縁画素差を再現。追加WRITEは`system/project-manager.js`のPNG生成branchのみ。吹き出しも既存Letteringと同じLayerSystem straight-alpha snapshotをPNGへencodeし、余分なalpha変換を避ける。画素/PNG形式/保存項目/読み込み正本は維持、rendererや新schemaは変更しない。旧楕円・輪郭・二連を画素完全一致で再検証し、Project suiteを実行する。

### Owner follow-up — 情報・整理へ集約（2026-10-04）

画面右下入口を撤去し、文字・吹き出しの既存比較「情報・整理」へ取り込みと表示分類を集約する。lead WRITE追加: `ui/balloon-popup.js`、`ui/lettering-popup.js`、`ui/font-library-management.js`（分類/importだけのUI部品）、対象CSSとBrowser fixture。比較ボタンは両方「比較」。吹き出しCanvas overlayは常時操作可能とし、旧OFF設定でも表示、補助previewの開閉は独立保持。保存API/作品/Historyは変更しない。単独管理窓部品は残すが製品の自動生成は外す。Browserで両tabの集約・実分類操作・狭幅・旧設定を確認する。

## Scope

以下の初回共通窓契約は履歴として保持する。現在の入口と配置は上記Owner follow-upを優先する。

初回共通窓の実装範囲は以下に保持する。現在の対象は上記段階2の限定契約。後続の順序は上表で管理し、保存項目・Canvas操作を変更する段階は開始前に限定契約を追記する。

### WRITE

lead owns `ui/font-library-window.js`（new）、`ui/font-comparison.js`（host optionとIME close guardのみ）、`styles/components/font-library-window.css`（new）、`styles/components/panel-layout-popup.css`（比較selectorの共通host追加）、`core-engine.js`（一インスタンス接続）、`index.html`（CSS一行）、`ui/keyboard-handler.js`（既存比較focus guardへ追加）、専用verifier/Browser fixture、既存情報比較verifierのhost option対応、当Card/STATUS/work索引/登録簿/harnessの対象箇所。`right-workspace-frame.js`はread-only。既存main/871c51edと全dirty、独立WP029/031を保持。

## Contract

WP024/028の技術検証済みコードを利用する。Owner最終制作受入が未完のためmanifest上のDONE依存には昇格させない。

- 共通status panel内の小さな書体button。既存status nodeがAnime dockへ移されるので同じbuttonも追従する。新しいdock/status ownershipを作らない。
- FontComparisonをstandalone hostとして再利用。既存の比較caller、文字全体/選択文字、吹き出しへの適用経路は維持する。
- 管理窓の選択は窓内だけ。作品params/Layer/Historyへ参照を持たない。favorite/Primary/メモ/収納/手動順は既存fontLibrary APIだけで更新。
- 見本比較と整理・管理の2tab。管理は選択書体の短評/coverage/作者・許諾リンク、favorite/Primary/メモ/収納、folder CRUD、import。folder削除は書体を親へ戻し、実体削除ではない。
- imported bytesは既存IndexedDB、選定実体はE自動bridge。外部ON/OFF、実体のGit再導入、別の永続font cacheは作らない。
- 非同期一覧はtokenで古い応答を拒否し、変更通知が連続してもprojectionを戻さない。visible/近傍warmは既存Comparison上限を使用する。
- 共通Futaba glass、共通scrollbar/controls、密度11px程度。狭幅は横にはみ出さず、必要な内容だけ縦scroll。keyboard focus/Escape/IMEを局所へ閉じる。
- module headerに責務・依存・保存境界・検証入口。新しいwindow互換global、汎用bus、font保存正本は作らない。

## Tasks

共通書体window moduleとCSS、既存比較のstandalone host option、status入口の一インスタンス接続、GUIと非同期更新/取り込みの検証。

## Acceptance

作品の書体やHistoryを変えずに見本比較・分類・取り込みができ、既存文字/吹き出しの分類表示へ同期する。dock/狭幅でも入口と操作が見える。

## Verification

構文、fonts/balloon/editable-lettering関連、harness/build。実Chromiumで入口/2tab/選択とhoverの作品不変、folder作成/rename/収納/順/削除（font保持）、favorite/メモ/Primary/importとreload同期、dock内入口、360px/1280px、keyboardとclose、font実体Git混入なしを確認する。Owner液タブ・制作受入は別。

## Stop

font実体DLはこのSliceに混ぜない。Project/History/renderer、RIG、schema正本の変更が必要ならこのSliceを拡げず次の限定契約を作る。既存font UIの大規模置換は行わない。

## Completion

段階1の初回案（以下は訂正前の検証記録）: TECHNICAL COMPLETE / OWNER REVIEW。2026-10-04、main/871c51ed、未commit/未push。

共通statusの書体入口、独立glass window、既存比較の見本／整理・管理、favorite/Primary/メモ/収納/上下/表示ソート、folder作成/改名/解除、既存importへ接続。設定はfontLibraryのみ、作品への参照は持たない。非同期projectionの古い応答・閉じた窓・失敗をverifierで確認。変更通知を32ms集約し、明示refreshで自分の通知timerを消すため、連続の上下操作が古い順序を参照しない。

実Chromium `build/wp030-font-library-browser.html`: E27一覧、hover/選択と管理の作品・History不変、folder CRUD/収納/上下/favorite/短評/Primary、実font bytesのimport＋収納、既存文字/吹き出しの分類同期、IME中Escape保護/通常Escape/focus、再open、1280×720/360×640と横overflowなしPASS。360px時の入口bounds x232.7..278.5、y616.9..638.9で画面内。試験設定と順序は元へ復元、試験importは除去。別の実製品tabでAnimeドックの共通statusへ入口が移り、native clickで開いて管理tabへ切替できることを確認。OS file chooser/液タブ/Owner制作受入は未検証。画像はworkspace外 `wp030-font-library.png`。

構文・fonts7・editable-lettering8・balloon1・harness・production build PASS。既存WP028の実Browser文字別/Project/PNG画素/再編集/UndoRedo・360px/400px高回帰もPASS。保存正本・外部E接続・public実体ゼロを維持。並行RIG filesは変更しない。

初回案完了時点では段階2以降は未実装。現在の段階2結果は下記に記す。

### Owner訂正後の結果

情報・整理への集約 TECHNICAL COMPLETE / OWNER REVIEW。画面右下の自動入口撤去。吹き出しの既存管理/表示分類nodesはlistenerを保持して比較情報hostへ移動。文字は独立`FontLibraryManagement`部品を同じ情報hostへ追加し、分類/importのみ既存APIを呼ぶ。両方「比較」文字button、Canvas overlay常時・旧OFF設定拒否、補助preview独立を維持。

実Chromium `build/wp030-font-information-browser.html`: 両入口/集約、旧OFF、分類作成/改名/解除、実font bytes import＋分類収納、吹き出し同期、管理による作品/History不変、360px境界/横overflowなし/末尾到達PASS。試験font/分類は除去し順序復元。旧fixture URLは新fixtureへ案内。既存WP028 Browserの個別書体/二重フチ/Project/PNG/UndoRedo/狭幅・低高回帰PASS。native clickで文字/吹き出しの情報tabを開いて表示確認。fonts7/文字8/balloon1・harness・構文・production build PASS。外部27実体はGitへ入らない。制作受入/液タブ/OS chooserはOwner確認待ち。段階2以降へこの訂正ターンで進めない。

### 段階2と入口統合の結果（2026-10-04）

TECHNICAL COMPLETE / OWNER REVIEW。文字・吹き出しの入口を一つの「書体」buttonへ統合し、見本比較/情報・整理の最終tabを再openで保持。管理と表示分類は初期展開。取り込み・分類は既存fontLibraryだけを使用。

吹き出しを幅316pxの共通glass、本体/しっぽ/文字context、常設本文、固定footerへ再編。自由輪郭は8点初期/4–24点、選択点の隣への追加・削除・移動・戻す、UI grid/snap。二連は重なる二楕円の外周だけを描き、二つ目の本体の移動/一様拡縮、独立した2件のセリフを実装。pure geometryと表示/入力/文字合成を分離し、旧4shape、通常Raster、optional version-1 recipeとHistoryを保持。複数しっぽは未追加。

実Chromium `build/wp030-balloon-editor-browser.html`: Canvas輪郭点drag/選択/追加削除、gridと数値wheel、二連の移動/拡縮/全体移動の相対配置、結合境界のfill/内部線なし、本文2件、1Layer/1History確定、Project recipe復元/PNG画素完全一致、再編集更新/UndoRedo、360px幅・640/400px高の固定footer/各context PASS。旧楕円にも存在したProject PNGの361channel差は、既存LayerSystem snapshot経由のencodeに揃えて修正し、旧楕円/輪郭/二連すべて差ゼロ。公開font実体追加なし。

更新した情報fixtureと既存WP028 Browser回帰もPASS。実製品tabで二連presetとcompactレイアウトをnative click/画像で確認。構文、balloon2/fonts7/editable-lettering8/Project10、harness check、production build PASS。Owner制作・液タブ・OS pickerは未検証。main/871c51ed、並行RIG/既存文字差分保持、未commit/未push。

次はSequence段階3の複数しっぽと形のバリエーション。開始時に対象file・選択/根元追従・結合線・保存/再編集の限定契約を確定する。段階3以降へこのターンでは進めない。
