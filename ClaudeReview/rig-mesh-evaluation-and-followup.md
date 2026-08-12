# Rig / Mesh Setup — 反映確認・比較評価・追加所見（CODEX引き継ぎ用 / 前回レビューの続報）

更新日: 2026-08-12
レビュー担当: 外部AI（Web版Claude）
前提資料: `rig-mesh-setup-ui-review.md`（2026-08-11付、初回レビュー）
対象範囲: 初回レビュー指摘への対応状況の確認、Rig/Mesh設計思想の他ツール比較評価、追加のアドバイス・疑問点・代替案
確認方法: GitHub `main` branch rawの再取得による差分確認（2026-08-10取得分 → 2026-08-12取得分）。Browser実機・pen/touch確認は行っていない。

> 本書も前回同様に提案・所見であり実装契約ではない。`AGENTS.md` 8章の通り、採否は実コード照合の上でCODEX側・Ownerが判断してください。

---

## 1. Git反映の確認結果

反映を確認した。`PROGRESS.md` / `task-codex/phase7i.md` / `tegaki_work/ui/animation-table-popup.js` / `tegaki_work/styles/main.css`はいずれも前回取得時点から更新されており、`phase7i.md`は「状態: OPEN（Stage A〜D完了、SOL review 1〜4=`A`、Owner一括確認待ち）」、`PROGRESS.md`には次の記述が追加されていた。

> Claude外部レビューからAUTO系の安定group化、Setup青、表示辞書、select option再構築抑制を採用し、LINE理由messageのmode scope漏れを修正した。

### 1.1 初回レビュー指摘への対応状況（実コード照合済み）

| # | 初回レビューの指摘 | 対応状況 | 実コード確認箇所 |
|---|---|---|---|
| 1 | `.anim-rig-mesh-bone-controls`行がAUTO GRID/SHAPE/LINEで密集する | **採用** — `.anim-rig-mesh-bone-source`（BONE select + ＋BONE）と`.anim-rig-mesh-generate-group`（AUTO 3ボタン）へ分割。generate-groupは`flex-wrap: nowrap`で3ボタンの分断折返しを禁止 | `animation-table-popup.js` 16088-16094行 / `main.css` 4296-4304行 |
| 2 | generator種別のラベル/メッセージのネスト三項演算子 | **採用** — `RASTER_MESH_SETUP_MODES` / `RASTER_MESH_GENERATOR_UI` / `AUTO_LINE_FAILURE_MESSAGES`の3辞書＋`getRasterMeshSetupFailureMessage(mode, reason)`へ整理 | `animation-table-popup.js` 226-288行 |
| 3 | `_syncRigSetupContext()`内でBONE select / parentSelectを毎回`replaceChildren`で全再構築 | **一部採用** — `syncSelectOptions()`でJSON署名を比較し、内容不変ならスキップ | `animation-table-popup.js` 291-301行 |
| 4 | `_syncRigSetupContext()`内の`querySelector`呼び出し自体（12箇所以上）のキャッシュ化 | **保留**（理由: 実測根拠不足） | `PROGRESS.md` Stage D結果セクション |
| 5 | BONE select / parentSelectの同名Folder衝突（識別不能） | **保留**（理由: 別UX契約が必要） | 同上 |
| 6 | RIG folder treeの8pxフォントによる識別性低下 | **保留**（測定・契約不足） | 同上 |
| 7 | 生成ボタンにSetupを示す色差がない | **採用** — `.anim-rig-mesh-generate-btn`へ既存`--deformer-bind-line` / `--deformer-bind-point`（青）を新規変数追加なしで転用 | `main.css` 4351-4364行 |

### 1.2 レビューでは指摘していなかったが、CODEX側で独自に検出・修正した点

- LINE専用の失敗理由メッセージが、GRID/SHAPE生成失敗時にも漏れて表示され得るscopeの取り違えを、辞書化のレビュー過程で発見・修正した。
- 100頂点超の一時preview Meshが共有`GlMeshAdaptor`に入り、破棄済みTextureSourceを共有BindGroupが保持し続ける寿命競合をBrowser確認で検出し、同期bake専用Meshをbatch経路へ固定して解消した。

これは机上レビューでは出てこない類の問題で、`verify-*.mjs`によるpure層のGateとBrowser実機確認を両輪で回している証左として評価している。

### 1.3 保留判断そのものへの所見

3件とも、「まず実測・契約を先に決めてから」という初回レビュー側の前提条件を律儀に守った保留であり、妥当な判断だと考える。ただし#4〜#6は「やらない」ではなく「先送り」であるため、2章末の追加提案で軽量な代替案を添えておく。

---

## 2. リギング/Mesh設計思想の比較評価

### 2.1 アーキテクチャ上の位置づけ

Tegakiの現行設計は「手描きラスターに対する、決定的（deterministic）・自動生成・段階Gate型のリギング」であり、Live2D Cubismとは思想的に対極、Spineとも異なる第三の立ち位置にある。

| | Live2D Cubism | Spine | ToonSquid | **Tegaki（現状）** |
|---|---|---|---|---|
| Mesh生成 | 完全手動（ArtMesh配置・頂点編集） | 自動Mesh＋手動weight paintが基本 | 簡易矩形/自動Mesh | 完全自動（Alpha-fit Grid / Auto Shape Fill / Auto Line Ribbon）。手動編集は現状不可 |
| Weight設定 | Deformer階層（Warp/Rotation）への暗黙追従＋物理演算 | 手動weight brush＋自動weight | 簡易自動 | 自動のみ（最大2 influenceのlinear blend）。weight brushは明示的に非対象 |
| Bone/IK | Parameter駆動のDeformer中心。Bone概念自体が薄い | 階層Bone＋IK/Path/Transform constraint群 | 単純な親子Bone | 親子FK＋回転のみの2-Bone IK（stretch無し） |
| 線・ストローク専用処理 | 無し | 無し | 無し | **Auto Line Ribbon — 独自の強み** |
| 物理/二次揺れ | 標準搭載 | Physics constraint搭載 | 簡易 | 未実装（roadmap上でCandidate Hとして凍結中） |
| 非破壊性・Undo規律 | 一般的な範囲 | 一般的な範囲 | 一般的な範囲 | 一操作一History、STALE検知、rollback必須という強い規律 |
| 対象ユーザー層 | 専業リガー・スタジオ | 専業リガー・ゲーム開発 | 個人・軽量制作 | イラストを描く人がそのまま軽く動かす |

### 2.2 評価表（10点満点。専業リギングソフトとしてではなく「手描きツール内蔵のRig機能」として評価）

| 評価軸 | 点数 | コメント |
|---|---|---|
| 導入のしやすさ・学習コスト | 8/10 | Boneを置いてAUTO GRID/SHAPE/LINEを押すだけで動く。専業ツールが最も苦手とする「とりあえず動かす」を最短で満たす |
| 生成品質の再現性・安全性 | 8/10 | pure関数＋verifier＋fixtureのGate運用は、AIエージェント開発下の品質担保として手堅い。STALE検知・rollback・複製source rebaseまで一貫 |
| 表現の自由度・作り込みの深さ | 3/10 | 手動topology編集・weight brush・物理演算が無く、専業リガーが「ここだけ手で直したい」と思った瞬間に詰まる。Live2D/Spineとの最大の差 |
| 線画特化の工夫（LINE Ribbon） | 7/10 | 曲げ時の線痩せ/膨張対策は他の主要ツールにない独自アプローチ。ただし単一island・穴なし・分岐なしという制約が強く、実際の毛束や輪郭線の多くが弾かれる可能性が高い（3.1で後述） |
| UI導線（Rig/Motion/Warp分離） | 6/10 | Setup(RIG)/Animate(MOTION)/WARPを色と状態文で分離する発想はLive2D/Spineの「モード切替」文化と同方向。ただし1 popup内の情報密度が高く、階層が深いキャラクターでは窮屈になりやすい |
| コード/開発プロセスの健全性 | 8/10 | Gate 0比較→pure実装→verifier→SOL review→Owner受入の多段階レビューが機能しており、外部レビューの取り込みサイクルも実証された |
| 総合（現段階のスコープでの完成度） | **6/10** | 「ちゃんと動く最小限」は高水準。「作り込める余地」がまだ薄いのが素直な弱点 |

### 2.3 トレードオフ（バーター）についての所見

欠陥ではなく意図的な選択と見ている。理由は3つ。

1. **開発体制に見合った選択。** CODEX（実装）＋外部AI（レビュー）＋Owner（最終判断）という体制と、`TEGAKI.md`が明言する「二重実装、循環依存、暗黙のfallback、黙ったstate修復」禁止という強い制約下では、「手動mesh編集＋weight brush＋物理演算」まで一気に広げると品質担保が追いつかなくなるリスクが高い。自動生成＋厳格Gateへ絞ったのは体制相応の現実的な判断。
2. **対象ユーザーの違い。** `TEGAKI.md` 1章が操作感の参考にAdobe Fresco / ToonSquid / Procreate Dreamsを挙げている時点で、専業リガーではなく「絵を描く人が延長線上で軽く動かす」ことが目標。評価表の「学習コスト8点・自由度3点」という非対称さは狙い通りと考えられる。
3. **「実装できない」ではなく「順番を守っている」。** `15_キャラクターRig・Mesh・Perform統合ロードマップ.md`にmanual topology/weight、物理演算、Constraint系はCandidate G/Hとして構想済みで、各Phase指示書が毎回「pure閾値の調整、manual topology / weight…へ広げない」と明記しているのは範囲外というより優先順位の問題。

---

## 3. 追加のアドバイス・疑問点・代替案の考察

初回レビューでは触れていなかった観点を、疑問点／代替案／軽量な追加提案の3種類に分けて記す。いずれも即実装を求めるものではなく、Owner判断の材料として提示する。

### 3.1 疑問点（Owner / SOL側で判断材料が必要と思われる点）

**Q1. Auto Line Ribbonの実データ受理率は計測されているか。**
`phase7i.md`のGate条件（単一4-connected component、holeなし、分岐なし、open pathのみ）は、pure fixtureでの検証は十分だが、実制作のイラストレイヤー（特に複数本が交差・分岐する毛束、閉じた輪郭線）にそのまま当てると相当数がreject候補になる可能性がある。PROGRESS.mdも「Owner受入では適合alpha fixtureで確認する」としており、まだ結論は出ていない認識で合っているか。もし受理率が低い場合、「LINE機能があるのに実制作ではFILLしか通らない」という体感ギャップが生まれる。

**Q2. 3ボタン（AUTO GRID/SHAPE/LINE）が横並びになったことによる誤生成のリスクは検討済みか。**
Stage Dで3ボタンが常設されたことで、既存MeshがSHAPEで生成済みの状態で誤ってLINEを押すと、既存Meshを別generatorで上書き生成することになる（History 1件でrollback可能とはいえ、Undo操作が挟まる）。特にBrowser上でのペン操作中は誤タップが起きやすい。確認ダイアログを挟むか、現在のgeneratorTypeと異なるボタンを押した時だけ軽い警告を出す等の余地はないか。

**Q3. LINE拒否理由のトースト文言は、非エンジニアの制作者に伝わる粒度になっているか。**
`AUTO_LINE_FAILURE_MESSAGES`の文言（例:「AUTO LINEは分岐のない中心線だけに対応します」）は正確だが、「では次にどう直せばLINEが通るのか」という行動指針までは示していない。「毛束を1本ずつ別Layerへ分けてください」のような具体的な次アクションを添えられると、Gateの厳しさが体験としての詰みに感じられにくくなる。UI/CSSガイドのtooltip機構（`data-tooltip`）を使って、拒否理由の隣に一般的な回避策の補足を出す程度なら軽量に思えるが、これはUXコピーの領域なのでOwner判断が必要。

**Q4. AUTO GRID→SHAPE→LINEの試行錯誤がHistory件数上限を圧迫しないか。**
`TEGAKI.md` 6章の「件数上限と推定メモリ上限の両方を適用」という既存の仕組みで技術的には守られているはずだが、生成系操作は比較的大きなbyteSizeを持つ可能性がある（Mesh/Skin丸ごと）。複数回の再生成を試すユーザー行動を想定した実測は行われているか。

### 3.2 他の選択肢の考察（代替アプローチとして検討の余地があるもの）

**A. Weight brushの「全面手動」ではなく「補正スライダー」という中間案。**
現行方針は「manual topology / weight、weight brush…禁止」だが、これは恐らく「Live2D的な自由編集」を指していると解釈している。その手前に、自動生成された特定頂点の影響半径や2 influence間のblend比率だけをスライダーで補正する、という軽量な着地点はあり得る。pure生成結果の上に「後から比率を動かすだけ」なら、決定的生成そのものは壊さずに済む可能性がある。ただし新しい保存fieldが必要になるため、現行のGate規律（`TEGAKI.md`「Control Mesh、WARP、rigid bindingへ同じtopology / weight / Poseを重複保存しない」）との整合は別途Gate 0が必要な規模の話であり、あくまで将来候補としての提示。

**B. LINE Ribbonの分岐対応を「拒否」ではなく「自動分割の提案」にする経路。**
現状は分岐を検出したら理由付きでreject一択だが、将来的には分岐点で複数の独立Ribbon候補へ自動分割し、候補をUIで提示してユーザーが採用/却下する、というLive2D的な「最終判断は人間」を残したまま自動化率を上げる方向もあり得る。これはpure層の拡張（分割アルゴリズムの追加）になるため、Stage Dの範囲を大きく超える別Phase相当の提案として記録だけしておく。

**C. Setup青の適用範囲の再確認。**
`UI_CSSスタイルガイド.md` 11章は「青系はCanvas上の基準範囲編集中に限定し…」と記しており、今回の対応で生成ボタン（Canvas操作ではなくpopup内のボタン）にも同じ`--deformer-bind-line`を転用した。これは`AGENTS.md`の「Setupの青…は役割が明確な場合だけ」という別の記述には沿っているが、UI/CSSガイド側の「Canvas上の基準範囲編集中に限定」という文言とは適用範囲が広がっている。実害は無さそうだが、次回のUI/CSSガイド監査（Phase 5e相当）のタイミングで、ガイド側の文言を「Setup工程を示す青」へ一般化するか、現状を例外として明記するかを整理しておくと、将来別のcontributorが同じ判断に迷わずに済む。

**D. Rig folder treeの識別性向上は、フォントサイズより先にアイコン差分を検討する。**
初回レビューで「8pxフォントの識別性」を指摘したが、フォントサイズ変更は他の密なUI要素との整合を崩しやすい（`TEGAKI.md`が目指す「液タブのペン操作で成立する簡潔なUI」との兼ね合い）。文字を大きくする代わりに、Bone有無・Mesh種別（GRID/SHAPE/LINE）ごとに1〜2pxの小さな色付きインジケータを`anim-rig-pivot-indicator`の隣へ追加する方が、既存レイアウト幅を壊さずに識別性を上げられる可能性がある。

### 3.3 実装の話ではないが記録しておきたい所感

- Live2D/Spineとの機能ギャップ（手動編集・物理演算）を「埋めるべきもの」として急ぐ必要は無いと考えている。むしろ手動編集を将来入れる場合、現行のpure/deterministic/Gate規律とどう共存させるかが設計上の大きな分岐点になるはずで、着手前に「自動生成結果に対する部分上書きを、どこまでpure生成の再現性契約の中に収めるか」という設計判断をOwner/SOLで先に固めておくことを勧める。あとから場当たり的に足すと、`TEGAKI.md`が最も嫌う「二重実装・暗黙のfallback」に陥りやすい領域だと感じる。
- 今回、外部レビュー→実コード照合→採用/保留の判断→さらに独自のBrowser bug検出、という一連の流れが実際に機能したことは、Web外部AIによる計画書を「そのまま実装契約にせず、存在するfile・event・classと照合してから`task-codex/`へPhase化する」という`AGENTS.md` 8章の運用方針が意図通り機能している具体例だと考える。

---

## 4. 未検証・対象外

- 実Browser（Chrome最新）、pen/touch実機での確認は行っていない。本書の指摘・評価はコード読解とGitHub上のPhase文書に基づく。
- Auto Line Ribbonの実受理率（3.1 Q1）は、私の側では検証手段がないため推測にとどまる。
- Live2D Cubism / Spine / ToonSquidの現行最新バージョンの機能詳細は、一般的に知られているアーキテクチャ水準での比較であり、各ツールの最新アップデートの逐一確認は行っていない。
