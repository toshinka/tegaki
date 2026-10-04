# 漫画パネル — 制作動線と密度の再設計

状態: REFERENCE / DESIGN PROPOSAL。2026-10-04、`D:\GitHub\tegaki`、main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。Owner指定の調査・設計ターン。製品実装、Project schema、History、rendererは変更していない。既存WP-025の機能検証をUIの制作受入と同一視しない。本稿は未承認の次作業の候補であり、自動実行指示ではない。

## 追加検討 — 書体集約・4目的tab・Transform操作（2026-10-04）

WP-027実装後のOwner指摘を現行コードに照合した改訂案。この節は下記の初回設計にある3tab配置・font情報の置き方を提案として更新する。製品の追加実装、保存契約の変更、次Cardの発行はしていない。既存WP-027の検証結果と新機能の受入を混同しない。

### 書体選定と整理を集約する

推薦は、現在の比較pageを「見本比較 / 情報・整理」の2tabにすること。左の場面別treeと選択書体を維持し、右側の内容を切り替える。お気に入り・Primary・短評・メモ・収納先・手動順・対応文字・ライセンスを情報tabへ集める。実ファイルのfolder作成は従来どおりWindowsで行い、この画面は既存の表示分類・順序の設定を扱う。

主文字panelには、常設の標準フォント選択と比較入口を残す。同じ行の小さな情報入口から、選択書体の「情報・整理」へ直接開ける。大きなfont詳細を常設headerへ移すと、入力・基本サイズ・4tab・footerを残すための高さを消費するので、全文詳細の二重配置は避ける。比較へ吸収するまでの暫定配置ならフォント直下・サイズ直前が自然だが、最終案は比較へ集約する。

hoverは見本だけを一時変更し、編集対象となる書体を動かさない。clickで書体を固定してから整理する。収納先変更・favorite変更で本文の書体を勝手に変更しない。比較の現在の`canMove: false`を一律解除せず、情報・整理modeだけで既存treeの移動規則を利用する。吹き出しと文字のfont詳細を共通部品にし、同じ情報を二つの実装で保持しない。

### 文字panelは4目的tabにする

常設部は「文字入力 → 標準フォント＋比較/情報 → 基本サイズ・縦横・太字・基本色 → 4tab」。本文だけscroll、確定/更新・取消を置く固定footer、Ctrl+Enterの現行終端は維持する。tabを変えても、別tabで設定した効果は残す。

| tab | 設定のまとまり | Canvasでの主な対象 |
|---|---|---|
| 書式 | 基本色、縁取り色・幅など、見た目の仕上げ | 文字全体の枠 |
| 配置 | 字間・行送り、位置/回転/拡縮/反転、配置線preset、点追加・削除、grid/snap | 「全体 / 線」の短い対象切替で枠と線の点を選ぶ |
| 変形 | 全体envelope、外へ膨らむpreset、9点操作。別groupで先頭/中央/末尾サイズ | 全体の変形点 |
| 文字別 | 選択文字の書体・色・サイズ・回転・配置線に沿う/離れる移動・局所変形 | 1文字または複数文字の選択 |

配置線tabは「配置」へ改称する。字間と行送りは組版位置に影響するためここへ移す。位置・回転・拡縮の精密数値は折畳みとし、Canvas操作を主にする。「配置」内の全体/線切替は設定tabとは別のruntime選択で、既存の`whole/curve/envelope`をそのまま4tabの保存値に増やす設計にはしない。

共通の標準フォント欄は常に全文の既定値を変更する。「文字別」には選択文字用の書体入口を置き、同じ比較pageを「選択『ゴ』1文字へ適用」と対象を示して開く。比較画面を重複生成する必要はない。全体の既定値を変えても、明示した個別の書体・色などは保持する。「個別指定を解除」でその属性を全体からの継承に戻す。

### Transformと同じ手の動きに揃える

現行`config.js`、`layer-transform.js`、`transform-math.js`、keyboard/cameraの送受信を確認した。次の操作を文字編集対象にも接続する案。

| 操作 | 効果 |
|---|---|
| 対象をdrag | 移動 |
| Shift＋対象drag | 最初の主方向で固定。横なら回転、縦なら拡縮 |
| V操作中＋wheel | 拡縮 |
| V操作中＋Shift＋wheel | 回転 |
| V操作中＋Shift＋上下key | 拡大/縮小 |
| V操作中＋Shift＋左右key | 15度ずつ回転 |
| V操作中＋H / Shift＋H | 水平/垂直反転 |

Vの扱いは既存のTransform操作文法と揃える。文字編集中はその入力を文字draftの対象へrouteし、既存LayerのTransform sessionへ同時入場させない。未選択文字を暗黙に変形せず、文字別では選択文字群、その他では文字全体を対象にする。SpaceでCanvas操作を優先する規則、入力欄・IME・数値wheelの所有を保持する。

純粋な方向判定と変形計算は`transform-math.js`を再利用できる。LayerTransformのclass/session、確定時のbake、SOURCE/ANIMATEやHistoryの終端は移植しない。cameraとLayerのcanvas wheel listenerが既に存在するため、listener追加だけでは二重操作になる。入力の所有を先に定め、一つの操作は一対象で消費する。

現行Layer wheel/key拡縮にはscaleXの絶対値からscaleYも同じ大きさにする処理がある。文字への接続では手の動きを揃えつつ、既存の縦横比と反転符号を保持する。回転/拡縮の中心もCanvas中心ではなく、文字全体または選択文字群の表示中心とする。点drag中にShiftを使う意味と衝突するので、この文法は枠/文字本体のdragに限定し、点そのものは点編集として扱う。

### 外へ膨らむ変形

現行modelの9点座標は[-4, 4]を扱えるが、UIの点dragは[0, 1]へclampしており枠外へ出せない。範囲を有界に保ったまま枠外dragを許し、点が枠外へ出てもhit areaと選択枠を追従させる。drag基準は変形前の枠で固定し、変形後の枠で毎回再正規化して操作が加速しないようにする。

現行`bulge`は境界に近づくと係数が1へ戻るため外周が固定される。「内部の膨らみ」は残し、外周の辺も外へ広がる「外へ膨らむ」を別presetにする。既存9点の外側制御点へpresetを展開する実装が第一候補。旧bulgeの式を書き換えて旧作品を変形させない。頂点が交差する強い変形、負方向、縦書き、局所変形との併用も評価する。

### 先頭・中央・末尾と文字別サイズ

全体の基本サイズは常設の一値。「変形」のサイズ変化groupは均一/先頭→末尾/先頭→中央→末尾で必要な値だけ表示する。内部は基本サイズに対する倍率、UIは実効pxをその場に表示し、基本サイズの変更で全体の比率を保つ。中央は読み順50%の制御位置であり、偶数文字でも使用できる。

進捗は一行の編集単位の先頭0、末尾1として求める。1単位は先頭値、2単位では中央を通る文字がないことを説明する。多行は行ごとに再開、縦書きも読み順で評価する案。区分線形を最初の仕様とし、滑らかさの新controlは初回に増やさない。既存recipeの末尾値は従来の評価を維持し、新profileを選んだ時だけ新仕様へ移る。

サイズ変更はglyphの輪郭だけでなくadvanceも反映して配置し直す。演出的な重なりは字間や文字別位置で調整できる。文字別サイズは全体profileとの積で作用させ、片方を設定するともう片方が消える仕様にはしない。

### 1文字の選択・組版・保存条件

Canvas上の文字clickとShiftによる複数選択、入力欄の文字範囲選択を同じ編集対象へ対応させる。「文字別」では線の点を選択対象にしない。線からの移動は接線方向と垂直方向で行い、線を直した時に追従する。個別回転も線の接線に対する角度とする。局所変形は文字の枠/少点を主にし、Bezier輪郭の編集は導入しない。

「あ＋結合濁点」などの見た目の1文字は`Intl.Segmenter`のgraphemeで扱い、HarfBuzzのclusterへ対応させる。graphemeとclusterは同じではなく、合字などでは複数の入力文字が一つの描画単位になる。その場合の回転・変形はcluster全体を対象と明示する。書体の変更境界はrunを分けて再組版し、単純なglyph差替えで幅やkerningを失わない。根拠: [HarfBuzz clusters](https://harfbuzz.github.io/clusters.html)、[Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)。

現在のfont engineのcluster番号はcode point単位で、textarea/SegmenterのUTF-16位置と一致しない場合がある。選択用の対応表を設ける。glyph番号はfontや組版で変わるので、個別指定の保存先にしない。

保存案は既存のtextを唯一の本文とし、その範囲へ疎な属性指定を持たせること。選択・hit bounds・font bytes・outline cacheはruntime-only。入力の挿入・削除・置換に応じて範囲を更新し、同じ文字の検索で別位置へ個別指定を付け直す方法を採らない。挿入は範囲内部ならその指定を継承、境界なら既定値、削除は該当範囲を縮め/除去、置換は選択先頭の指定を継承する案。IMEを含む編集後の再対応を次Cardの受入条件にする。

評価は「本文＋書体runの組版 → 全体profile/文字別サイズと字間による配置 → 配置線 → 接線座標で文字別移動・回転・局所変形 → 全体envelope → 全体位置/回転/拡縮」。同じ結果をpreviewと確定時Raster化へ使う。個別色のため描画styleも文字範囲ごとに扱う。

正式Vector Layerはこの追加の前提にしない。通常Raster＋再編集recipe、一つの文字作品につき一Layer、追加/更新は既存の一回のHistoryを維持する。recipeの新しい属性・version・sanitize・旧作品互換は次の確定Cardで定める。WP-027の限定UI作業へ保存/renderer拡張を混ぜない。

### 実装の区切りと評価例

1. 書体比較の情報/整理mode、書式→配置への設定移動。保存modelを変更しない独立UI slice。
2. Transform入力の対象route、外への9点dragと外へ膨らむpreset。既存の保存可能なparamsで成立する範囲を検証する。
3. 3点サイズprofile・文字別tab・書体run・範囲属性を一つのrenderer/再編集契約として追加。最初の境界仕様を確定してから対象fileを限定する。

制作評価は、曲線に置いた「ゴゴゴ」で中央だけ別書体/色/回転、文字の挿入・削除後も指定が追従、3点サイズと全体envelopeの同時使用、結合濁点・英字合字・多行/縦書き・flip/zoom、再編集→Project往復→Undo/Redoで同じ結果になること。全体/選択文字/Canvasが同時に動かないこと、比較hoverで指定が変わらないこと、warm fontの再取得ゼロと長い本文の入力応答も確認する。

追加検討ターンでは現行コードと公式組版資料を調査し、文書のみ更新した。製品build/Browser/画素受入は新機能について未実施。次Cardの自動開始指示ではない。

## 初回設計 — 判断

推薦は、**共通の入力欄＋目的別の設定tab＋常時見える確定欄**。幅は他の漫画panelと同じ316 CSS pxを出発点とし、最初の入力・書体・サイズ調整・追加にscrollを要さない構成へする。文字だけを小さくする修正では、操作目的と表示欄の不一致は解消しない。

外側のtabは「コマ / 吹き出し / 文字 / 集中線」。内側は各toolの作業目的に沿った少数tab。選んだ内側tabは、表示する設定とCanvas上の編集対象を一緒に切り替える。tool間のtab切替は即時、サイドバーから新しく開く時だけ既存のopen表現を使う。

入力や基本値を常時残すことで、線や変形を見ながら言葉・書体・基本サイズを変更できる。tab切替は未確定の設定を消さず、非表示の効果を無効化せず、確定も行わない。

## 現行実装の監査

専用loopback Viteと新規Browser tabで確認。1280×720 CSS px、通常Canvas、源暎アンチック。Ownerの画像とはviewport/DPRが異なり、画像の物理pxを直接比較していない。作品の追加・更新はしていない。

| 項目 | 文字 | 他の漫画panel / 原因 |
|---|---|---|
| 幅 | 356px | コマ・吹き出しは316px。文字は約13%広い |
| 本文 / button | 12px / 12px、button高30px | 共通漫画CSSは本文11px、button10px / 高24px。Anime headerの9pxを全controlへ転用する根拠にはしない |
| 背景 | opacity 94%、独自paper色 | コマは既存Futaba背景の64%。文字もblur(14px)自体は効くが、ほぼ不透明な上書きがある。`--futaba-paper`はmain.cssで未定義のため専用fallback色に落ちる |
| 内容の高さ | font情報open時1215px、閉時965px。可視高672px | 縦積みの項目量が大きい。情報を閉じるだけでは解決しない |
| 配置線mode | Canvas対象だけ切替 | `_setMode`は設定panelを切り替えない。情報を閉じても配置線summaryは画面Y約777px、追加は約955pxにある。summaryも閉じたまま |
| 数値 | range＋number＋同じ値のtext | 1行のrange実幅約108px。重複値が横幅を食い、数値と単位の視線が離れる |
| wheel | 書体のみ接続 | 数値range/numberは未接続。文字サイズrange上のwheel後も64のまま。コマ・吹き出し・集中線には`attachNumericField`が既にある |
| font情報 | 初期openをコードで固定 | 吹き出しは開閉状態を保持している。文字は`fontCard.open = true`で、既存の使い分けを引き継いでいない |
| 外側tab切替 | 別popupをhide/show | `.popup-panel.show`の300ms / scale(0.9→1)が再生される。tab内容切替にも新規openの演出がかかる |
| 吹き出し | 形・しっぽが先、セリフが後 | 補助previewとfont情報を閉じても内容737px、確定Y約746px。セリフを素早く入れる経路を上段へ置く余地がある |
| コマ / 集中線 | 大きな補助previewが上段を占有 | Canvas overlayを使う制作では、設定への到達距離を伸ばす。previewの利用場面を残しつつ既定を再検討する |

根拠source: [文字UI](../../tegaki_work/ui/lettering-popup.js)、[文字CSS](../../tegaki_work/styles/components/lettering-popup.css)、[漫画共通CSS](../../tegaki_work/styles/components/panel-layout-popup.css)、[tab切替](../../tegaki_work/ui/manga-tabs.js)、[PopupManager](../../tegaki_work/system/popup-manager.js)、[数値helper](../../tegaki_work/ui/numeric-field.js)、[main.css](../../tegaki_work/styles/main.css)、[Anime panel](../../tegaki_work/ui/animation-table-popup.js)。

## 文字の推薦配置

上から次の順。通常の主機能は316px幅 / 720px高で一画面に収めるのを受入条件とする。詳細情報や長文編集まで無理に一画面へ詰め込まない。

1. 共通漫画tab、close。重複する大きな「文字」見出しを減らし、必要な状態表示「新規 / 再編集：Layer名」に使う。
2. 文字入力を2行程度。改行を保持し、長文は欄を広げられる。新規と再編集の状態で値を勝手に消さない。
3. 書体選択＋比較button。書体wheelは現行仕様を保持。詳細・favorite・整理は要求時に開く。
4. 基本サイズ、縦横、太字、文字色。数値と単位を一つにまとめる。主要controlのhit areaは24 CSS px以上。
5. 内側tab「書式 / 配置線 / 変形」。内容が変わる位置を揃える。
6. 選択tabの設定。細かい情報のoverflowはこの領域だけで受け、共通入力・tab・確定欄は残す。
7. 常設の状態/エラー欄とaction欄。新規時は「追加」、再編集時は「更新」を主buttonにする。「別レイヤーに追加」は副actionとして明示し、現在の追加と更新の二重primaryをなくす。

| 内側tab | 主に表示するもの | Canvasの編集対象 |
|---|---|---|
| 書式 | 字間、行送り、縁取りと色。配置の詳細（X/Y・回転・拡縮）は折畳み | 文字全体の移動・回転・四隅拡縮 |
| 配置線 | 形preset、点追加・削除・角/滑らか。grid間隔・snap | 配置線の点。文字全体の選択枠は補助表示 |
| 変形 | envelopeの形、該当する強さ、9点の操作。サイズ変化group | envelope点。サイズ変化はglyphの大きさの分布 |

同時適用されている配置線/変形はtab名の小さな設定済み表示などで残す。現在のtabを切り替えただけで効果をOFFにしない。曲線と変形を同時に編集するための二列常時表示は既定にせず、後で実際の往復が多いと判明した場合に比較する。

preset依存のcontrolを出す。例: 9点変形でpresetの「強さ」sliderを効くように見せず、点編集を出す。波の振幅/周期など、今ない機能はレイアウト整理へ紛れ込ませない。追加する場合は、手動点編集を数値再生成で失わない規則まで別に決める。

回転のUI単位は度を推薦し、内部radへ変換する。作品の保存単位を変更しない。X/Yは精密補助であり、最初から5つの配置入力を開いておく必要はない。

## 確定の置き方を比較

5段階の設計上の評価。実ユーザーテストの成績ではない。

| 案 | 素早い入力 | 調整中の確定 | Canvas面積 | 操作の統一 | 合計 |
|---|---:|---:|---:|---:|---:|
| **固定フッター＋目的tab（推薦）** | 5 | 5 | 4 | 5 | 19/20 |
| 上部に主確定＋目的tab | 5 | 4 | 4 | 4 | 17/20 |
| 幅を広げて全設定を二列常時表示 | 4 | 5 | 2 | 3 | 14/20 |

下端そのものが問題というより、そこへscrollしないと到達できない構造が問題。推薦はpopup内flex/gridでbodyだけをscroll可能にし、footerをその兄弟に置くこと。長いscroll領域の末尾へ`sticky`を足すだけでは、初めからfooterが見える保証にならない。

上部確定案は連続する短文に強いが、文字入力の最短位置と競合し、Layer操作と書体操作が混ざりやすい。上下に主buttonを重複させる案は採らない。高さが十分小さく、固定footerに常に到達できれば、まず一つに揃えて比較する。

keyboardによる確定は候補としてCtrl+Enter。導入前に既存keyboard routingと衝突、IME変換中の`isComposing`を調べる。通常Enterは改行のまま。現行の編集内Ctrl+ZとLayer Undoの所有を変更せず、再編集状態/エラーの表示を固定action近くに置く。値の連続入力を1操作としてUndoへまとめるかは別の狭い検証事項で、UIだけの変更として黙って変えない。

## 数値操作

sliderは連続量で見た目の調整が役立つ箇所（サイズ・字間・変形強さ等）だけにする。X/Y、grid間隔などはcompactなnumber中心。通常行は「label / slider / 数値＋単位」、二つのcompact値は必要な箇所でだけ同列へ置く。slider＋常設number＋重複した値表示は廃止候補。

- rangeと数値欄の上でwheel増減。上で増、下で減。Shiftは大きい刻み。細かい刻みは値の意味とmodelの精度に合わせる。
- wheelを取るのは実control上だけ。label、余白、本文のwheelはpanel scroll、Canvasのwheelは既存camera経路へ残す。数値wheelからCanvas zoomが発生しない。
- disabled/readonly・解析失敗・最小最大値の説明を保持。入力途中の空欄やIMEを即座に0へ書き戻さない。
- 既存`attachNumericField`を利用する。ただし現状のAlt=0.1刻みは元のstepへの丸めで消える場合があるので、精度の仕様を先に決める。新しいnumber常設型はoptional引数で接続し、既存callの挙動は維持する。第三のwheel helperやdocument全体のlistenerは新設しない。
- trackpadの細かいwheelに対する累積/刻みとfont jogの動作は別に扱う。numericとfontで対象が違うことをtooltip/ARIAでも示す。

## 先頭・中央・末尾サイズ

まず「文字サイズ」は均一な基本サイズとして入力欄のそばに残す。「サイズ変化」は変形の中で、envelopeと別groupにする。配置線・サイズ変化・envelopeは併用できるが、各groupは一つの効果を担当する。

推薦model案は、基本サイズに対する率のprofile（均一 / 開始→終了 / 開始→中央→終了）。均一なら追加値を見せず、2点なら2値、3点なら3値だけを表示。例: 基本12px、開始100%、中央150%、終了166.7%で約12→18→20px。値のすぐ近くに実効pxも出す。profileを使わなければ、基本サイズの1値だけで制作できる。

重要な未決定点は、文字順に対する「中央」と、位置に対する「中央」を混同しないこと。現行rendererの`endFontSize`はglyphの組版座標 / 全体のextentから進捗を求め、glyphの輪郭を元anchor周りで拡縮する。advanceの再組版とは別であり、最後のglyphが指定終了値へ達する保証や、多行の読み順に沿ったprofileを既に実装したとは扱わない。

3点profileの次設計では、日本語の結合濁点・ligatureをglyph数ではなく組版clusterとして保ち、一行単位を既定とする。1clusterは開始値、2clusterは開始/終了（中央は対象がないと説明）、3以上は読み順0..1で線形または区分線形。縦書きも同じ読み順を使う。拡大後に間隔を再計算するか/重なりを許す演出かは明示して比較する。

この変更はoptional recipe、sanitize、旧Project、History、組版に及ぶ。先に現行の末尾値を「変形→サイズ変化」へ移すUI整理を行い、3点profileは別Cardでrenderer/保存の契約を確定してから実装する。旧`fontSize/endFontSize`を新profileへ無言変換し、旧作品の外見を変えない。

## 漫画ツールをまとめる

| 外側tab | 常時の近道 | 内側のまとまり案 |
|---|---|---|
| コマ | 割付preset、選択コマの操作、確定 | 割付 / 線・余白。選択コマ/線/頂点に必要な値を近くへ出す |
| 吹き出し | セリフ入力、書体・縦横・基本サイズ、確定 | 形・しっぽ / セリフ。形presetは入口に短く残し、しっぽ・線・塗りは形groupへ |
| 文字 | 文字、書体・縦横・サイズ、確定 | 書式 / 配置線 / 変形 |
| 集中線 | preset、中心をCanvasで動かす、確定 | 線・密度 / 範囲・ばらつき。本数と細/太は近い場所に、抜け幅はrangeへ |

補助previewはCanvasを操作できる時は既定で閉じる案。overlay OFFの時には開けるようにし、Canvasと補助previewの両方を閉じて編集不能にはしない。previewは削除しない。コマを一覧で見る場合や、拡大中のCanvasから全体を確認する場合に役立つ。font比較は書体選定の独立した作業なので、必要時に横のpageを開く現行方針を保持する。

共通にするのは「窓・入力・action・数値操作・tab切替」の見た目と操作規則。吹き出しのセリフと独立文字のmodelはこのUI改修だけで統合しない。rendererや保存責務を万能な漫画editorへ集約しない。

Anime Dock、Resize、右Workspaceは比較対象として読んだ。9pxへ全体を縮める、Dock用glass shellを全popupへ一括適用する、Resizeを同時に再構成する作業は提案に含めない。文字/漫画の一件で規則を確かめ、共通部品として有効と証明した所から後に横展開する。

## 見た目と即時切替

既存Futaba palette / popupのglass規則へ戻す。本文11px、重要値11〜12px、heading12px、desktop control高24〜26pxを比較の出発点とする。これは画面縮小率ではなくCSS px。低密度/高密度の新設定や独自の色名を増やさない。入力は読めるsurfaceを保ち、親opacityで文字・SVG・controlを薄くしない。

開閉式詳細は初回閉を推薦し、現行UI設定の保持方法に沿う。未定義`--futaba-paper`fallback、独自のprimary/hover色、専用slider色などを棚卸しし、既存tokenへ接続する。すべてのpanelを同じopacityにするかは、popupの既存64%とworkspace glass72%を明るい絵/暗い絵/文字の背後で比較して決める。Anime Dock用のshell所有は保つ。

外側tabは`switchMangaTab`からのopen理由を識別してanimationを0にする狭い接続を推薦。全popupの`fadeIn`を消さない。共通tabの位置とwindowの上端を固定し、targetのlayout寸法でviewport内へfitする。現在の切替はshowの後で前窓のrectをコピーするため、target側fitより後に大きいwindowを下へ置くケースも検証する。transformアニメ途中のrectを保存位置に採らない。

## 参考とTegakiへの採用範囲

- [Adobe Premiere Properties panel](https://helpx.adobe.com/ca/premiere/desktop/add-text-images/stylize-text/about-properties-panel.html): 選択対象に応じて頻用propertyをまとめる公式設計。Tegakiではtool/内側tabに応じた設定panelへ応用するという推論。Adobeの全workspaceやtimeline構造の導入は提案しない。
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): tabとpanelの対応、左右key、表示遅延がない時の自動activation。漫画tabの即時切替とfocusの確認に使う。
- 数値wheelは外部UIの模倣よりも現行`numeric-field.js`と既存3漫画toolを第一根拠とする。外部Blender資料は検索では得られたが本文取得が失敗したので、詳細仕様の正本には採っていない。

## 次実装へ分ける場合

1. **文字の一画面動線**: 共通入力 / 目的tab / 固定action、密度とglass、number wheel。現行params/renderer/recipeを維持。対象候補: `ui/lettering-popup.js`, `styles/components/lettering-popup.css`, `ui/numeric-field.js`の互換optional接続。
2. **漫画共通の切替とまとまり**: 外側tab即時切替、window位置/狭幅fit、コマ/吹き出し/集中線の目的groupと固定action/preview。候補: `ui/manga-tabs.js`, `system/popup-manager.js`の局所option、共通CSS、各popup UI。保存や生成geometryは対象外。並行writeをしない。
3. **サイズprofile**: 3点/cluster/行の意味、間隔・旧recipe・保存を一件として確定。前2件のレイアウト変更へ混ぜない。

受入は、単なるCSS/構文passで終えない。1280×720、1600×900、360×720で基本入力→書体wheel→サイズwheel→追加までscroll0、すべての確定/取消は可視。配置線tabでpresetと点操作がすぐ見え、変形tabでは対応する操作だけが出る。初回openとtab切替のanimationを別測定し、後者はscale0/遅延なし。本文IME/改行/数値編集/ARIA/focus、overlay hit、font比較、文字の両効果保持、閉じる・取消・手描き保護・Project往復・UndoRedoが退行しないことを実Browserで確認する。液タブ/coarseはOwnerの制作受入として別に残す。

設計見取り図は配置・操作の比較用であり、実書体・HarfBuzz・curve/warpの画素品質を検証するものではない。実装を変更しない本ターンでは製品build/回帰suiteを再実行していない。

本ターンの確認: 調査対象の製品10fileは開始/終了SHA-256一致。文書harnessと対象差分のwhitespace確認PASS。見取り図のJS構文、2つの配置案、目的tabの設定切替、3点→2点profileの表示切替、9点で強さを隠す動作、360px幅での横はみ出しなしをBrowserで確認。見取り図console errorなし。別作業のRIG関連差分とSTATUSの現在地は変更していない。commit/pushなし。
