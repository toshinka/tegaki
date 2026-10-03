# 選定フォントの取得・追加監査

状態: REFERENCE / WP-021の取得・監査・検証記録。確認日: 2026-10-03。
実装の現在地は[STATUS](../STATUS.md)、範囲は[WP-021](../work/WP-021-curated-font-library.md)。開始 main / `b7d7fddfa9f77ce1a8f2b703c03a7f6a2f330bd3`。既存QTP差分を保持、commit/pushなし。

## 今回の結果

先行8書体と追加上位19書体、計27書体を導入。既定Primaryは源暎アンチック。形の分類、用途タグ、短評、選択中の見本、自分用メモ、お気に入り優先、Primary指定、作者/ライセンスへのリンクを吹き出しタブに追加した。ユーザー取り込み・フォルダ管理も併用できる。

27実体の合計は132.8 MiB。元TTF/OTFを改変・サブセット化せず、一書体一ウェイトを基本とした。起動時の検証では選択中のPrimary一件だけ取得し、一覧の全実体を一括ロードしない。大きい851手書き雑は約27.3 MiBで、初回選択の読み込み負担がある。

500枚はWindows日本語OCRでローカル抽出（500枚すべて異なるhash、処理エラー0）。画像はアップロードしていない。OCRは候補名の手掛かりであり、許諾の正本ではない。先行12、追加の表示18・手書き14・表現12・OCRからの追加5の候補を絞って調べた。**全500候補/全851書体を公式条件まで監査したという結果ではない。** 今回の取得リストと保留リストで重複をまとめ、名称の誤認・収録範囲を補正した。

## 導入した上位リスト

短評と順位は創作用途についての提案。最終制作受入ではない。漢字欄は実体のUnicode対応から集計し、TrueTypeでは輪郭が空のスロットを除外。JIS規格適合の証明ではない。漢字があることと、その難しい文字が揃うことは別なので、使う文字を見本で確認する。

| 書体・公式 | 形の分類 | 極短評 | 漢字/かな・濁点 |
|---|---|---|---|
| [源暎アンチック](https://okoneya.jp/font/) **Primary** | アンチック | 読みやすい王道セリフ。Primary候補。 | 漢字12,721字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [F910新コミック体](https://www.font910.jp/font-list/conposite-comic.html) | アンチック | かながやや大きい、親しみのあるセリフ。 | 漢字7,919字 / ひらがな84 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [源暎Nuゴシック EB](https://okoneya.jp/font/) | 極太角ゴ | 力強い怒り・強調・擬音。 | 漢字12,204字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [源暎ラテゴ Medium](https://okoneya.jp/font/) | ラテン仮名混植 | 電話・放送越しの声。機械的な語りに。 | 漢字12,744字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [源暎ぽっぷる Black](https://okoneya.jp/font/) | ポップ丸文字 | 丸く大きく弾むPOP。タイトル向き。 | 漢字6,721字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [源暎こぶり明朝 Regular](https://okoneya.jp/font/) | 明朝 | 細身で静かな声・地の文。 | 漢字12,719字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [851チカラヨワク](https://pm85122.onamae.jp/851fontpage.html) | 手書き細字 | 細く弱々しい手書き。小声や繊細な役。 | 漢字2,330字 / ひらがな83 / カタカナ86 / 結合濁点U+3099なし・漫画外字未確認 |
| [851チカラヅヨク A](https://pm85122.onamae.jp/851fontpage.html) | 手書き太字 | 太く勢いのある手書き。叫び・擬音。 | 漢字3,086字 / ひらがな84 / カタカナ86 / 結合濁点U+3099なし・漫画外字未確認 |
| [無心](https://modi.jpn.org/font_mushin.php) | 手書きラフ | ザクザクした筆跡。荒い声や手紙に。 | 漢字6,720字 / ひらがな84 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [黒薔薇ゴシック Bold](https://modi.jpn.org/font_kurobara-gothic.php) | 棘付き角ゴ | 棘のあるゴス文字。妖しさとクールなMV。 | 漢字5,265字 / ひらがな84 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [せのびゴシック Regular](https://modi.jpn.org/font_senobi.php) | 長体角ゴ | すらりと背の高い文字。クールな見出し。 | 漢字5,178字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [851テガキカクット](https://pm85122.onamae.jp/851H_kktt.html) | 手書き角字 | 斜めの角文字。SF・ロボットの声に。 | 漢字4,349字 / ひらがな83 / カタカナ86 / 結合濁点U+3099なし・漫画外字未確認 |
| [851手書き雑フォント](https://pm85122.onamae.jp/851fontpage.html) | 手書きラフ | ボールペンの生活感。自然なキャラの声。 | 漢字20,950字 / ひらがな86 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [851ゴチカクット](https://pm85122.onamae.jp/851Gkktt.html) | 工業角字 | 電機文字風。SF見出し・MVの強いアクセント。 未完成版・使用文字の見本確認推奨。 | 漢字4,377字 / ひらがな83 / カタカナ86 / 結合濁点U+3099なし・漫画外字未確認 |
| [たぬき油性マジック](https://tanukifont.com/tanuki-permanent-marker/) | 手書きマーカー | 丸く太い油性マジック。温かいPOPや声に。 | 漢字6,687字 / ひらがな84 / カタカナ86 / 結合濁点U+3099なし・漫画外字未確認 |
| [ドットゴシック16](https://github.com/fontworks-fonts/DotGothic16) | ドット | 16ドットのゲーム文字。電子音・レトロMV。 | 漢字6,714字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [ロックンロール One](https://github.com/fontworks-fonts/RocknRoll) | ポップ丸文字 | 丸い点と線の強弱。明るく軽快なMV。 | 漢字6,714字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [レゲエ One](https://github.com/fontworks-fonts/Reggae) | ポップ鋭角文字 | 鋭い末端が弾む。勢いのある擬音とMV。 | 漢字6,714字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [よもぎ](https://github.com/google/fonts/tree/main/ofl/yomogi) | 手書き細字 | 極細で癖のある筆跡。独白や余白の小さな声。 | 漢字6,684字 / ひらがな84 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [はちまるポップ](https://github.com/google/fonts/tree/main/ofl/hachimarupop) | レトロ丸文字 | 80年代の丸文字。少女の声とレトロPOP。 | 漢字6,682字 / ひらがな84 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [だるまドロップ One](https://github.com/google/fonts/tree/main/ofl/darumadropone) | 民芸かな文字 | 達磨落とし風のかな。民芸ロゴ・軽快な擬音。 | ひらがな・カタカナ・英数字・記号／漢字なし / 結合濁点U+3099なし・漫画外字未確認 |
| [ステッキ](https://github.com/google/fonts/tree/main/ofl/stick) | 直線文字 | 直線的で幼い形。牧歌的な声やギャグ。 | 漢字6,714字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [トレイン One](https://github.com/google/fonts/tree/main/ofl/trainone) | 二重線文字 | 二重線の抜け感。速度のあるタイトルとMV。 | 漢字2,966字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [ランパート One](https://github.com/google/fonts/tree/main/ofl/rampartone) | 立体文字 | 影付きブロック。重量感のある立体タイトル。 | 漢字6,714字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [デラゴシック One](https://github.com/google/fonts/tree/main/ofl/delagothicone) | 極太角ゴ | 平たい極太文字。悪役の声・力強い見出し。 | 漢字7,654字 / ひらがな84 / カタカナ90 / 結合濁点U+3099あり・組版未検証 |
| [佑字 肅](https://github.com/google/fonts/tree/main/ofl/yujisyuku) | 筆文字 | 端正な筆文字。和風・儀礼・筆文字の擬音。 | 漢字6,746字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |
| [チョーク体](https://font.cutegirl.jp/chalk-font-free.html) | 手書きチョーク | ざらざらした板書。教室や思い出のMVに。 | 漢字7,916字 / ひらがな86 / カタカナ90 / 結合濁点U+3099なし・漫画外字未確認 |

## 後で選ぶ候補

`B`は役割の追加や見た目を比べて選ぶ候補。`HOLD`は同梱条件、取得導線、実体の問題がある。創作上の魅力と同梱できるかは別軸で、かな専用を理由に下位へ落とさない。下表は今回新しくDLしていない（ブラウザNGの2件は検査用の取得のみ）。

| 書体・公式出典 | 形・極短評 / 制作上の優先 | 後回し・保留の理由 |
|---|---|---|
| [マメロン](https://moji-waku.com/mamelon/) | 小型丸ゴ・読みやすい声 / 高 | 商用・Webfont・文字編集用途は許可。無断二次配布禁止のためGit同梱は保留。本人取得後のローカル取り込み向き。 |
| [ポプらむ☆キュート](https://moji-waku.com/poprumcute/) | 変体少女文字・明るく遊ぶ / 高 | マメロンと同じ。漢字が限定でも創作優先度は高い。 |
| [ピグモ00/01](https://moji-waku.com/pigmo/) | 崩した手描き・実験的 / 高 | [もじワク条件](https://moji-waku.com/mj_work_license/)の二次配布禁止。00/01は見本比較で選ぶ。 |
| [殴り書きクレヨン](https://font.sumomo.ne.jp/font_2.html) | 太いクレヨン・子どもの声 / 高 | 商用成果物可、フォント再配布禁止。ローカル取り込み候補。 |
| [仕事メモ書き](https://font.sumomo.ne.jp/shigoto.html) | 小さく真面目なメモの声 / 高 | 商用成果物可、フォント再配布禁止。ローカル取り込み候補。 |
| [装甲明朝](https://booth.pm/en/items/1028555) | 軍用ステンシル・荒い明朝 / 高 | OFL案内あり。BOOTHの直接取得導線はloginに移るため取得保留。 |
| [瀞ノグリッチ黒体](https://booth.pm/ja/items/3041172) | ノイズ・サイバーMV / 高 | OFL案内あり。BOOTH取得と同梱LICENSEの照合が残る。 |
| [零ゴシック](https://booth.pm/ja/items/2658538) | 割れたガラス・衝撃や恐怖 / 高 | OFL案内あり。BOOTH取得と同梱LICENSEの照合が残る。 |
| [不知火](https://booth.pm/ja/items/7666814) | 力強い筆・擬音 / 高 | 商用成果物可。フォントデータ/program再配布禁止のため同梱しない。 |
| [スミカク](https://booth.pm/ja/items/8183402) | 正方形＋隅付き括弧・ロゴ / 高 | 商用作品可、再配布禁止。アプリ/Webfont条件不足。 |
| [おとぎの明朝](https://booth.pm/ja/items/7888134) | 柔らかい童話の明朝 / 高 | 無料はかな中心。再配布禁止、アプリ/Webfont条件不足。 |
| [せだむ free](https://booth.pm/ja/items/8184241) | ぷっくり多肉・カタカナPOP / 高 | かな制限は問題にしない。アプリ/Webfontには連絡・追加許諾が必要。 |
| [鳩とブリキのワンダランド](https://booth.pm/ja/items/7485568) | 極太レトロ看板かな / 高 | サーバー利用・再配布・同梱禁止。ローカル取り込み候補。 |
| [ようじょふぉんと](https://tanukifont.com/yojo-font/) | 幼いひらがな・3種類の字形 / 高 | 商用作品可、出版社の収録時に一報。取得元TTFをChromium FontFaceが `Invalid font data in ArrayBuffer.` と拒否したため製品から除外。元ファイルは取得cacheに保持。 |
| [コーポレート・ロゴ ver3 Bold](https://logotype.jp/corporate-logo-font-dl.html) | 縦長かな・現代ロゴ / 中 | OFL、元OTFをChromium FontFaceが上記と同じ理由で拒否。改変せず保留。 |
| [ニコモジ](https://nicofont.pupu.jp/nicomoji.html) | ニコ動風ロゴ・かな/英数 / 中 | 商用可だが再配布禁止。アプリ埋込みの条件不足。 |
| [チルアウト](https://typingart.net/?p=471) | 幅が揺れるゆるい手書きかな / 中 | 商用可だがアプリ/Webfont/再配布の一次条件不足。 |
| [ラノベPOP V2](https://flopdesign.booth.pm/items/2328262) | 弾むマーカー・見出し / 高 | 配布ページPrivate・取得login。同梱M+条件の照合が残る。 |
| [押出Mゴシック](https://tanukifont.com/oshidashi-m-gothic/) | スマート角ゴ・明朝アクセント / 中 | 制作利用・埋込み可の案内。旧M+条件の取得物照合と、今回の角ゴとの比較を後段へ。 |
| [けいふぉんと！](https://font.sumomo.ne.jp/font_1.html) | 丸いアニメ調・見出し / 中 | Apache案内のある合成書体。取得物の源泉通知確認が必要。役割の重なりを後で比較。 |
| [07やさしさゴシック](https://www.fontna.com/blog/yasashigothic.html) | 柔らかい標準ゴシック / 中 | M+/IPA混植の条件と取得物照合。一般枠なので追加は後段へ。 |
| [しょかきうたげ](https://booth.pm/downloadables/1078813?variation_id=2355367) | 筆の個性・手書き声 / 中 | 無料/有料で文字範囲と条件が違う。改変・再配布など禁止、BOOTHlogin。取得導線は作者ページの代用ではない。 |
| [g_達筆(笑)](https://material.animehack.jp/font_gbrushtappitsu.html) | 脱力した筆の声 / 中 | 無料は約1059漢字。再配布禁止、Webfontに連絡/表示条件、取得login。 |
| [しねきゃぷしょん](https://www.vector.co.jp/soft/data/writing/se314690.html) | 映画字幕・独特の穴 / 高 | 作者サイト停止、版ごとに商用連絡条件の情報が衝突。再配布元の紹介だけでは決めない。 |
| [アンニャントロマン](https://inatsuka.com/extra/toroman/) | ゆるい飾りかな・Latin / 高 | 現行公式規約を確認できず、第三者情報が衝突。条件未確認。 |
| [水明、夏へきらめく Mini](https://palf-strage.booth.pm/items/8107279) | 夏のきらめき・少女MV / 高 | 現ページPrivate、抽出可能な埋込み/サーバー/Webfont禁止。フル版のSNS条件も今回の取得条件に合わない。 |
| [推しゴ](https://atelierkotatu.booth.pm/items/5635169) | 太い応援文字・アイコン / 中 | 再配布禁止、配布Private。かな/限定漢字自体は減点しない。 |
| [略字少なめトゲトゲ](https://nukosuki.booth.pm/items/2998290) | 尖ったロックの声 / 中 | 配布Private、条件照合待ち。今回のレゲエと比較して選ぶ。 |
| [源暎ラテミン / ちくご明朝](https://okoneya.jp/font/)・[しっぽり明朝](https://github.com/fontdasu/ShipporiMincho) | 横太の装飾 / 落ち着いた活字 / B | 先行条件表の予備。普通の明朝を増やす前に、こぶり明朝で役割を確認する。 |
| [源界明朝](https://flopdesign.booth.pm/items/1028548) | 崩れた恐怖明朝 / 高 | 前件で配布状況保留。今回取得していない。 |

名称「黒薔薇アンティーク」はMODIの現行一覧で確認できなかった。「黒薔薇シンデレラ」等と同一視せず、名称未同定として保留。「ぜんのびゴシック」は「せのびゴシック」、「ワンダーランド」は作者表記「ワンダランド」へ補正。

[パンダベーカリー](https://suzukimemo.com/post-6057)は[有料配布](https://designpocket.jp/font/detail/24047)のため、今回のフリー取得対象から除外。必須SNS・連絡条件のある経路は即時取得へ進めていない。

## 許諾・実体・濁点の扱い

- OFL/Apache等の元LICENSE、作者readme、851の公開条件のテキストを同梱。原本のbyteは保持し、UIから読めるUTF-8版も添付。[カタログ](../../tegaki_work/public/fonts/catalog.json)、[実体検査/取得hash](../../tegaki_work/public/fonts/inspection.json)、[選定入力](../../tegaki_work/build/curated-font-selection.json)に版・SHA256・公式URLを記録。
- [851作者条件](https://pm85122.onamae.jp/851fontTerm.html)は商用、再配布、Webfont、ソフトウェア埋込みを許可し、単体販売等に制約がある。[MODI表](https://modi.jpn.org/licence.php)もWebfont・アプリ埋込み・再配布を許可。今回の提供経路に合うことを、制作物の商用可と別に確認した。
- 「あ\"」のASCII引用符と漫画用濁点は同じではない。U+3099の実体対応、PUA外字数、作者説明を別々に扱う。U+3099ありという検査は、任意の仮名で位置が綺麗に揃う証明ではない。全27書体の漫画的濁点位置・縦横の組版を網羅採点した結果ではなく、濁点はUIでも未検証表示を残す。
- カタカナキーに別のひらがな字形を割り当てる「ようじょ」のような例があるため、コードポイント数と作者の意味上の収録を混同しない。

## 実装・検証

同梱IDも既存の `fontKind:'imported' / fontId` 経路を使う。作品には再編集参照と確定画素が残り、フォント実体はProject/Historyへ入らない。UIのfavorite/Primary/メモはlocalStorage、本人取り込みは既存IndexedDB。既存の作品・保存済み設定をPrimaryで上書きしない。

構文チェック、curated-font-library verifier、balloon verifier、development-harness check、Vite buildがPASS。Chromium実ブラウザ（headless、SwiftShader）で以下を確認した。

- 27書体のFontFace読み込み、初回Primary、選択中の見本、favorite先頭、Primary/自分用メモの再読込保持。
- 縦書きの新規Layer確定、横書きへの再編集更新、追加/更新それぞれのUndo/Redo、実 `ProjectManager.exportProject()` → `loadProject()` でfontId保持。書き出しにフォント実体なし。
- UIからの本人フォント取り込み/フォルダ作成、再読込後の実体ロード、フォルダ削除で未分類へ移動、本人font削除、同梱font削除拒否。
- 通信失敗を選択見本で未適用と表示し、復旧後の再選択で再試行。IndexedDB障害で同梱一覧まで消えないことはbehavior verifierで確認。
- favorite直後のメモ入力が非同期再描画で消えるraceを再現して修正し、同じ操作と再読込を再検証した。

Browser結果はOwner液タブ操作・全字形/全OSの合格ではない。Owner制作受入・pushは未実施。今回のテスト用Projectは一時ブラウザcontextのみで、Ownerの作品や設定を編集していない。

文字タブの移設、タイトル/擬音の独立文字Layer、曲線配置、control point/grid吸着、WARP/エンベロープ、スロットは別件として残す。

## エージェント運用

[Anthropicの一次運用報告](https://www.anthropic.com/engineering/multi-agent-research-system)を参照し、独立した広域調査だけを分担し、目的/対象/出力/停止条件を固定した。多agentなら自動的にtoken節約になるという扱いはしない。

表示書体・手書き/表現をLUNA maxの限定バッチへ割り当て、実装workerのwrite所有を別fileへ限定。親は500枚OCR、取得・LICENSE・実体検査・Browser検証を進めた。全文履歴の定期読取りはせず、完了通知を受けて次の限定指示を渡した。必要な巡回は10〜15分間隔を上限頻度とし、同じ候補の再検索と全画像の再読込を避けた。実token使用量の計測値は得ておらず、節約率は主張しない。
