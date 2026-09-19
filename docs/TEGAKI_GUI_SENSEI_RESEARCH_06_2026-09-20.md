# TEGAKI GUI先生ツール研究 06 — Animation Table・再生操作・Text/Context の配置

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
保存予定先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_06_2026-09-20.md`  
接続：研究01〜05、とくに02（LYRICAの文脈編集）・05（WARP右面の操作密度）  
注意：TEGAKIの最新未commit production差分、実ブラウザ操作、LYRICA最新版の実アプリ操作は今回検証していない。

## 0. 今回の問い

前回のWARP右側操作面から一段下がり、**中央Canvas／右Workspace／下Animation Tableの役割分担**を考える。特に、(a) Tableを大きく開かなくても再生と現在Frameを扱えるか、(b) 描画・Transform・RIG・Textを切り替えても時間文脈を失わないか、(c) Timeline上の直接操作と数値入力をどう両立するか、を調べる。

この回は「LYRICAの見た目をそのまま移植する」結論ではない。製品間の対象データ・入力装置・編集transactionは異なる。

## 1. 外部資料で確認できた事実：LYRICA

### 1.1 時間編集を中心に置く制作ループ

2026年9月17日公開のWindows版を含め、LYRICAは楽曲と歌詞を読み込み、BPM基準のTimelineでclipを配置し、beatへsnapし、結果をpreviewするMV制作用ツール。Steam公式の機能説明とPC WatchのWindows版記事で確認できる。Mac版のみという初期研究の記述は**2026-09-17以降の現状では古い**ため、本研究では更新情報として併記し、元文書01〜05は無断編集しない。 [L1][L2]

公開された第三者の逆引きリファレンスの目次には、Library／Preview／Timeline／Clip Editor／MASTER FX／Bottom Bar が個別の説明対象としてある。ただし有料の本文を読んだわけではなく、**目次から具体的な寸法・固定位置・内部状態遷移までは確定できない**。 [L3]

### 1.2 テキストとClipへの作業分解

公式説明で確認できるのは、歌詞の入力とTimelineへのclip配置という制作過程。さらにMac App Storeのv1.1 release noteには、複数clipをまとめたstyle/effect編集、プロジェクト単位の新規Text clipの既定Font・Size・Color設定が追加された旨がある。 [L4]

TEGAKIへの**推論**：QTP内のTextを必ずその場で全設定するより、Canvas上の文字配置（direct operation）と右側のText Context（内容・書式・対象）および下側の時間情報を分担する比較価値がある。ただし文字入力中のIME／selection／Undoは独立した技術契約を持つため、この資料では移設を承認しない。

### 1.3 時間操作の実際の配置：未確定

LYRICAの最新版における**再生ボタン・loop・playhead・clip editorの正確なCSS px位置、Panelのcollapse挙動、右側でどのTabが残るかは未取得**。写真や動画を見ないまま「LYRICAと同じ位置へ」と指定するのは危険。Steam・App Storeの機能説明は、UIの厳密なレイアウト証拠と区別する。 [L1][L4]

## 2. 外部資料で確認できた事実：ToonSquid

公式Handbookによると、Timelineは下部にあり、畳むとCanvas用の空間を増やせる。レイヤー数が増えても高さを際限なく増やすのではなく、一定数から内部scrollへ移行する。Playback ToolbarはTimelineを畳んだ後も表示される。またToolbar自体をドラッグしてTimeline高さを変えられる。 [T1]

この再生Toolbarには前後Frame、再生／停止、loop、現在Scene等の時間文脈がまとまり、FPSなどの低頻度設定もある。すべてをTEGAKIに常設移植すべきという意味ではない。 [T1]

公式Handbookでは、Timeline上のdrawingをドラッグして別Layerへ移動し、retime handleで長さを変更できる。drag中には配置先のpreviewを表示する。Keyframing modeには自動key追加という挙動があり、誤って有効のまま作業しないようHandbookが注意している。 [T1]

**TEGAKIへの推論**：Tableが閉じても「再生・現在Frame・最小の移動」だけは独立した細いTime Stripとして残せるかを比較する。ただしTEGAKIではpending edit時のFrame移動guardとKEY明示確定がある。ToonSquidのkeyframing modeを、そのままTEGAKIのANIMATE modeと同一視してはいけない。

## 3. 外部資料で確認できた事実：Callipeg

Callipegの公式Timeline解説では、Timelineは下部に置かれ、上へ伸ばすことができ、描画のために非表示にもできる。Sheetを選択したとき、その対象に適したAction PanelがTimeline上部に現れる。選択したsheet／clipの長さは確認でき、操作の種類も選択対象のLayer typeに応じる。 [C1]

Timeline上ではsheetをdrag移動でき、端のhandleで長さを調整できる。一定の長さを素早く指定する経路に加え、より長い尺は手動数値指定する導線もある。これらは**direct manipulation＋正確な数値指定の補完関係**を考える材料になる。 [C1]

Timelineを閉じたときはCanvas上で複数指gestureを使うFlip系の操作もある。一方でこれはiPad入力・慣れたgestureの前提があるため、TEGAKIのmouse・pen・keyboardへ無条件に移植しない。 [C1]

## 4. 利用者の摩擦を設計証拠として扱う

LYRICAのApp Storeレビューには、動画編集ソフト経験者に分かりやすいという個別の意見がある。一方、旧versionで日本語を含むclip名の扱いやcopy時のclip長に問題を感じたという報告もある。Release noteでは長いtrack名によりmute／lockが押せなくなる問題、Text clip double-clickの反応などの修正が記録されている。**一件のレビューを現行版の品質評価にはしない。** [L4][L5]

ToonSquidのReddit投稿（2025年4月）にはTimelineを高くできないと感じた利用者がおり、返信で「Timeline上部から引き上げる」と説明されている。公式には調整可能でも、**操作入口を発見できない場合がある**という限定的な事例である。 [U1][T1]

別のToonSquid利用者はTimelineのzoom／現在時刻の状態を誤認して、frameとaudioが消えたと感じたという投稿をしている。操作不能の不具合と断定せず、**現在地・表示範囲・縮尺の可視化**が初学者の理解を助け得るという研究仮説に留める。 [U2]

## 5. TEGAKI：Time／Canvas／Right Workspace の責務境界

以下は既存Research Handoff・Owner要件と外部比較からの**設計仮説**。製品仕様ではない。

| 領域 | 第一責務 | 置かないもの／注意 |
|---|---|---|
| 中央Canvas | 描画結果、Transform／WARP／RIGの空間直接操作 | 再生UIや右面の常設増設でCanvasを塞がない |
| 右Single Workspace | Drawing／Transform／RIG／将来Textの現在能力と数値・設定 | Layer treeとTransformの横並置、第二Time model、暗黙KEY確定 |
| 下Animation Table | lane・clip・sheet・key等の時間構造とdrag編集 | 常設巨大PanelでCanvasを遮る前提にしない |
| 折り畳みTime Strip（候補） | 再生・停止、現在Frame、必要最小限の移動、Table展開入口 | 高頻度操作のみ。詳細Frame/KEY編集の第二正本にしない |

### 5.1 Table開閉は編集mode切替と別軸

例えば「ANIMATE／WARP BRUSH／pending」の状態でTableだけを畳んだ場合、CAFの選択対象、pending candidate、右のWARP modeがTableの見た目に引きずられて消えるべきではない。ただし、**実際のproduction terminalがTable開閉をどう扱うかは未監査**。新Time Stripからguardを迂回して次Frameへ移動させてはいけない。

### 5.2 Time Stripの実験条件

最低限の比較状態は、Drawing＋Table開／閉、ANIMATE Transform＋Table開／閉、pending中の再生・前後Frame押下、KEY確定後の再生。見た目上残っていても押せない状態では意味がないため、disabled理由やpending表示とセットで確認する。Time Stripの位置・高さは実画面で測る。今回寸法は決めない。

### 5.3 「LYRICAの再生部分をそのまま欲しい」への対応

移植候補はデータやCSSではなく、**再生に必要な機能を小さな一定位置に保つ操作文法**として切り出す。LYRICAの実画面を取得するまでは、その具体的位置を出典付きの仕様にしない。確認できている強い先例はToonSquidのcollapsed Timeline＋常設Playback Toolbarである。 [T1]

## 6. TextをQTPから右へ移す前に分けたい二つの体験

**作成**：Canvas上で文字を置く・打ち始める。短い作業であればQTP／Canvas近傍を残す余地がある。

**編集**：既にあるText対象を選び、内容・font・size・align・時間・transformを連続調整する。右WorkspaceへContextを置く候補。

TEGAKIではText対象がDrawing／Animationとどのauthorityで結び付くか、IME合成中のfocus喪失、入力途中のHistory、直書き／clip型textの違いが未整理。**右面へ移した方がよいと断定しない。** LYRICAのtext workflowから得たのは「作成と継続編集の責務を分ける」という研究候補である。 [L1][L4]

## 7. 「ドラッグ中心＋数値入力＋複数トラックを跨ぐパス」の扱い

確認できた直接操作：ToonSquidではTimeline上のdrawingをdragして別Layerへ移し、移動先previewを示す。Callipegではsheetのdrag・retime handle・手動の尺指定がある。 [T1][C1]

TEGAKIの将来候補：

- 移動drag中、現在のlane・frame・drop可否をghostと数値ラベルで表示する。
- precise editorとして開始Frame／終了Frame／durationを明示入力できるか比較する。
- 複数トラックを跨るmotion pathやdrag経路が、時間の再配置なのかCanvas空間のmotion pathなのか、**用語と見た目を分離**して検討する。

未実証：LYRICAに「trackを跨ぐパスによる時間編集」があるという事実は、今回の資料では確認できなかった。存在を仮定してTEGAKIの機能として指示しない。Timeline drag／numericは既存TEGAKIのRetime・Clip Move等のterminal／History契約の上に載せる。

## 8. 情報密度・視覚設計についてこの回で採用しないこと

「LYRICAはモダンだから右Panelをそのままコピーする」「再生バーを常時大きくする」「Tableを畳んだら独自の第二Timelineを生成する」は採用しない。

配色は引き続き`main.css`の`--futaba-*`系列。LYRICAの色やMacの外観をTEGAKIの新色正本へしない。半透明・擦りガラス表現はCanvasへ重なる面の可読性／pointer遮蔽と合わせて別回で実証する。

## 9. 今回の暫定Capability Bank

| 候補 | 外部で確認した先例 | TEGAKIでの検証課題 | 現状 |
|---|---|---|---|
| Playback persists on collapse | ToonSquid [T1] | Table閉鎖後の最低限の時間操作、pending guard | 比較候補 |
| Contextual timeline actions | Callipeg [C1] | 選択したclip／sheet／KEY別の操作表示、既存authority | 比較候補 |
| Drag preview＋precise editing | ToonSquid [T1]／Callipeg [C1] | lane／frame／drop結果とHistory | 比較候補 |
| Text create vs edit context | LYRICA [L1][L4] | QTPとText authority／IME／入力focus | 仮説 |
| Timeline height discoverability | ToonSquid利用者投稿 [U1] | 展開handleの見つけやすさ | 負の参考例 |
| Timeline range／zoom orientation | ToonSquid利用者投稿 [U2] | frame表示／現在範囲／time metric | 負の参考例 |

今回、採用するproduction部品やimplementation sliceは決定しない。

## 10. Confidence／未確認

**確認済み（外部一次資料）**：LYRICAのBPM基準Timeline・beat snap・Text/clip workflow、2026-09-17のWindows版公開。ToonSquidのTimeline collapse／常設Playback Toolbar／drag移動先preview。CallipegのTimeline収納・伸縮／選択に依存するAction Panel。 [L1][L2][T1][C1]

**利用者の個別意見**：LYRICAの経験者向けUI評価、旧versionでの不具合報告。ToonSquidのTimeline高さ・現在範囲についての戸惑い。普遍的な品質評価や現行版の再現事実とは扱わない。 [L5][U1][U2]

**UNKNOWN**：LYRICA最新版の再生controlの具体的配置・右Clip Editorの実寸と開閉規則。TEGAKIに独立Time Stripを入れる際のFrame/History／pending guardとの接続。TextのQTP→右Workspaceの安全な移管。Timeline dragを跨ぐ経路とCanvas motion pathのUX上の区別。

## 11. 第7回への引継ぎ

次回は**最小Time StripとAnimation Tableの情報設計**に範囲を絞る。LYRICAの公開された実画面・操作動画を一次材料として探し、未取得なら未取得と記す。ToonSquid／Callipegと比較して「Table開・閉」「pending」「Text・Transform・RIG同時文脈」の表示状態をワイヤーフレームで複数案検討する。数値や再生ボタンの位置は製品仕様として決めない。実装はまだ発行しない。

---

## 12. Sources（2026-09-20確認）

[L1] LYRICA Steam製品ページ（Windows公開・公式機能説明）：https://store.steampowered.com/app/5106770/Lyrica/  
[L2] PC Watch、Windows版公開記事（2026-09-17）：https://pc.watch.impress.co.jp/docs/news/2141781.html  
[L3] 第三者「LYRICA逆引きリファレンス」、公開目次のみ（2026-09-18）：https://note.com/platypus2000jp/n/n98c0c1076af0  
[L4] LYRICA Mac App Store、公式説明とVersion履歴：https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12  
[L5] LYRICA App Store個別レビュー：https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12&platform=mac&see-all=reviews  
[T1] ToonSquid公式Handbook／Timeline：https://toonsquid.com/handbook/interface/timeline/  
[C1] Callipeg公式Timeline：https://callipeg.com/learn-timeline/  
[U1] Reddit、Timeline高さを見つけられなかった個別投稿（2025-04-07）：https://www.reddit.com/r/ToonSquidAnimators/comments/1jtv556  
[U2] Reddit、Timeline現在範囲を誤認した個別投稿（2025-01-23）：https://www.reddit.com/r/ToonSquidAnimators/comments/1i8dd6y  
[H1] 既存内部研究：`TEGAKI_OSS_GUI_Interaction_Research_Handoff_2026-09-18.md` のLYRICA／Right Dock／Temporal Overview Strip関連節。内部候補であり外部一次資料ではない。
