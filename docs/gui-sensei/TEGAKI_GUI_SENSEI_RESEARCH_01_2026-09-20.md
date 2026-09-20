# TEGAKI GUI先生ツール研究 — 01 / レイアウト・時間操作・初期比較

- 調査日: 2026-09-20
- 状態: RESEARCH BANK / NOT PRODUCT AUTHORITY / 未完了
- 対象: Lyrica（リリックMV制作アプリ）、ToonSquid、Callipeg、Procreate Dreams、CLIP STUDIO PAINT Simple Mode、Adobe Fresco
- 本文のラベル: **確認**＝出典の記述から確認、**Owner観測**＝TEGAKI利用時の指摘、**仮説**＝TEGAKIへの応用案、**UNKNOWN**＝資料不足。アプリのバージョン・端末・画面状態が異なる比較を、現行UIの同条件比較と呼ばない。
- 本文は既存 `TEGAKI_OSS_GUI_Interaction_Research_Handoff_2026-09-18.md` の追補。そちらの設計候補・歴史的NEXT ACTIONは製品承認ではない。

## 0. 今回の問い・Owner要件

1. Canvasを主役とし、常設UIを増やさず作業面を置換する。Transformは右側の既存領域へ収め、Floatingを基本導線にしない。
2. Animation Tableの再生／停止／前後移動／ループ等は、動画・アニメーション編集者が見慣れた位置と操作文法を調べる。
3. 右側のContext面は、選択対象に必要な情報だけを出す。文字入力をQTPから動画編集側へ移す案も比較するが、既存入力モデルの所有権は現段階で変更しない。
4. 情報密度・余白・文字サイズ・button/slider状態・半透明化は、静止画の美観だけでなく、CanvasとTimeline同時利用、視認性、pointer遮蔽を評価する。
5. 「再生周辺をLyricaからそのまま移植したい」はOwnerの視覚的な希望。**公式画面上の厳密な座標・各buttonの意味・操作時の挙動を確認するまでは実装仕様へ昇格させない。**

## 1. Lyrica — 今回の第一調査対象

### 1.1 同定と資料の性格

**確認:** 対象はリリックアニメーション特化のMV制作ツール「Lyrica」。Mac App StoreではMac用と説明され、音楽の読み込み、歌詞入力、クリップ配置、BPM基準Timeline、複数トラック、テキストエフェクトを案内している。Steamの製品説明も同種の用途を示す。iPad向けツールとして分類しない。

出典: https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 ; https://store.steampowered.com/app/5106770/Lyrica/

**既存Research Bankの記載:** 「中央＝visual result／右＝context/property editing／下＝temporal editing」。これは過去の画面研究の整理であり、2026-09-20時点の画面全状態の検証ではない。既存資料の第10〜12章ではRight Dock案とHierarchy Spine案を検討しているが、現在のOwner判断ではTransform中の通常Layer tree常時表示は要件ではない。

**UNKNOWN:** 公式サイト https://lyrica.jp/ は今回Web取得ができなかった。再生barの正確な配置、右panelの幅、panel切替・collapse・window transparency、数値inputの操作文法について公式画面・動画の細部をまだ検証していない。App Storeの製品説明や別著者の索引だけで断定しない。

### 1.2 TEGAKIへの暫定応用

- **仮説:** Lyricaを「動画編集の入口」の基準にして、Canvas中央／右context／下Timelineを別の意味の領域として設計する。ただしTransformでは、Contextを既存Layer Panelへ**追加**せず**置換**する。
- **仮説:** 再生／一時停止・現在時刻・前後移動・ループは下部Tableの常時到達できるtransportにまとめる。単純な再生操作と、Clip編集／KEY確定の操作面は区別する。
- **仮説:** Text入力は「Canvas上のオブジェクトとしての文字」と「時間軸上の文字Clip」で用途が異なる。QTPからの全面移管を前提にせず、文字を追加する入口、Canvas配置、Timeline上の期間編集、右側propertiesのそれぞれを比較する。
- **保留:** BPM基準の時間・ビート同期はLyrica固有の主軸。TEGAKIの既存Frame/KEY/History正本を置き換える理由にはしない。

### 1.3 初期ユーザー反応（代表的な発言。統計ではない）

**確認:** Mac App Storeの少数レビューには画面構成・初見の扱いやすさを評価する声がある一方、スタイルの一括変更やローカルfont等を望む声もある。また素材名・Clip複製・タイミングの問題を訴える投稿がある。App Store記載の後続updateには複数Clipの一括編集や、コピー／貼り付け・UI表示・Timeline zoomの修正項目があるため、古い報告を現在も未修正と決めつけない。

出典: https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12&platform=mac&see-all=reviews ; https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12

**TEGAKI向け検証問い:** 「美しい画面」だけでなく、一括スタイル変更・再編集・Timeline上の複数選択時に、どこに対象の情報と操作が現れるかを実画面で確認する。

## 2. 他の先生ツールとの初期対照

### 2.1 ToonSquid — Timelineの伸縮とtransportの位置

**確認:** 公式Handbookでは、Timelineは下部で展開／折り畳み可能。再生toolbarはTimeline上部にあり、Timelineを畳んだときも残る。Layer増加時に一定高さまで伸び、それ以上はLayer一覧をscrollする。toolbarをドラッグしてTimeline高さを変えられる。前後Frame、loop、play/pause、FPSなどの説明がある。

出典: https://toonsquid.com/handbook/interface/timeline/

**応用仮説:** TEGAKIのTableを畳んでも再生の最低限の操作面を残す案は、右Inspectorを肥大化させずCanvasを確保する方法として比較する価値がある。transportの具体配置はLyricaの画面検証後に比較する。

**注意:** ToonSquidでは自動KEY追加のON/OFFがTimelineのkeyframing modeと関係する。TEGAKIの既存pending→明示KEY確定を、説明なく自動KEYへ置き換えない。

### 2.2 Callipeg — LayerとTimelineの領域共有

**確認:** 公式資料ではLayer一覧はTimeline側に表示され、Timelineの表示切替や領域のドラッグ調整がある。再生には前後Frame・先頭／末尾・play/pauseが用意され、panelの移動／スケール調整にも言及がある。

出典: https://callipeg.com/features/ ; https://callipeg.com/learn-mini-layers/

**応用仮説:** Animation Table内のLayer行に十分な対象選択能力を持たせれば、Table展開中に右側へ旧LAYERS/RIG一覧を重複表示する必要を減らせるかもしれない。ただし、TEGAKIのLayer/CAF adapterとRIG入口を保持できることが条件。

### 2.3 Procreate Dreams 2 — StageとTimelineの比率、および編集モード

**確認:** 公式2.x HandbookはStage／TimelineとCompose・Perform・Keyframe等のmodeを説明する。StageとTimelineの表示比率は境界操作で変更できる。PerformではStage上の直接操作を時間的なkeyframeとして記録する。

出典: https://help.procreate.com/dreams/handbook/2.1/interface-and-gestures/interface ; https://help.procreate.com/dreams/handbook/2.0/interface-and-gestures/timeline ; https://help.procreate.com/dreams/handbook/2.0/keyframes-and-performing/performing

**応用仮説:** 「Canvasで触る空間操作」と「Timelineで編集する時間操作」の現在地を明瞭にする。TEGAKIは現行KEY semantics維持が条件であり、Performの自動記録をそのまま移植しない。

### 2.4 CLIP STUDIO PAINT Simple Mode — 深い機能への段階的入口

**確認:** 公式マニュアルではSimple ModeはCanvas領域を大きく取る基本機能中心のUIで、Studio Modeへ行き来できる。Simple ModeにもLayer palette、tool sliderがある。Simpleで利用できない機能を含むLayerはStudioへ戻る必要がある。

出典: https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm ; https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm

**応用仮説:** TEGAKIのFocus Lensも現在地・戻り道を残して詳細を段階的に開く。ただし「Simple→Studio」をTEGAKI内の新たな全面モード複製と解釈しない。

### 2.5 Adobe Fresco — Canvas優先とtool entry

**確認:** 公式資料ではLayer関連のTaskbar、tool controlsの左右位置設定、Transform tool、Touch Shortcut、Pencil入力の設定を案内する。Keyboard Shortcut資料ではTransformやBrushなどに入口がある。

出典: https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html ; https://helpx.adobe.com/fresco/desktop/introduction/keyboard-shortcuts.html

**応用仮説:** Transformは右のcontextへ寄せ、Canvas上の操作を主とする。ショートカットの具体的なkeyをAdobeと一致させる必要はない。TEGAKIのVやpending guardとの整合を先に取る。

## 3. 批判的ユーザー反応から得るテスト項目

**ToonSquidの個別投稿:** Timelineを高くする操作を発見できない、drawing layerとtimeline layerの違いで戸惑う、設定画面が多いと狭いiPadでCanvasを圧迫する、という声がある。別の利用者が調整方法を回答する例もある。これらは一部ユーザーの体験であり全体評価・現行全バージョンの仕様とは見なさない。

出典:
- https://www.reddit.com/r/ToonSquidAnimators/comments/1jtv556
- https://www.reddit.com/r/ToonSquidAnimators/comments/1m1it07
- https://www.reddit.com/r/ToonSquidAnimators/comments/1ondlsp

**TEGAKI向け評価問い:** Timeline高さ変更を初見で発見できるか。LayerとTrackの意味が混同されないか。機能を多数見せたためにCanvasが狭くならないか。ボタン／直接gesture／keyboardの代替経路を示しつつ同一操作の第二正本を作らないか。

## 4. 暫定比較・今回の非決定

| 設計領域 | 出典に基づく比較材料 | TEGAKIでの現段階 |
|---|---|---|
| 下部Transport | ToonSquidはTimeline折り畳み時も再生toolbarを維持 | Lyricaとの画面比較を待ち、Table上部の再生帯を候補に保持 |
| 時間と空間 | DreamsはStage／Timelineと編集modeを明示 | CanvasとTableの責務を分け、KEYの既存意味は固定 |
| Layer／Timeline | CallipegではLayer表示がTimelineと結びつく | Table展開中の右側重複を削減できるか別途検証 |
| 右properties | Lyrica研究Bankでは右context・下時間という見取り図 | 実画面とClip editorの動きを確認するまで移植不可 |
| 段階的機能 | CSP Simple／Studioの入口 | Focus Lensの現在地・復帰路を明示 |

**未決定:** Lyricaの再生バーをそのまま模倣するか、TextのQTPからの移管、WARP panelのpadding/button/slider、RIG relation表示、panelのガラス感・blur量。GUI tokenと技術primitiveの取捨選択は後続pass後に裁定する。

## 5. 次の調査Pass（開始条件・停止条件）

**Pass 02 / Lyrica画面状態の実見比較（最優先）**

公式最新版の画像・操作動画・manualまたはOwner提供の実画面を使い、(a)再生toolbarとTimeline折り畳み、(b)右Clip Editorの選択なし／単体／複数選択／Text／画像Clip、(c)Timeline drag・numeric編集、(d)文字入力→配置→時間編集、(e)狭いwindowの5状態を記録する。各項目で配置位置、クリック数、状態変化、見えなくなる操作、Canvas占有率を区別する。実画面未入手ならUNKNOWNで返し、想像図で埋めない。

**Pass 03 / iPad先生ツール実画面:** Adobe Fresco／CSP Simple／ToonSquid／Callipeg／DreamsのTransform・animation同時利用・focus・compact parametersを同じ操作シナリオで比較する。公式画面／動画と利用者の不満を別欄へ置く。

**Pass 04 / TEGAKI Capability Selection:** 既存GUI／Interaction Research Handoffと照合し、「そのまま使う・adapterで再利用・概念だけ学ぶ・採用しない・UNKNOWN」に分類。WebSOL一次監査→狭いAstra裁定→必要な実装Cardの順とする。

## 6. 運用・ファイル配置

このファイルをOwnerが `D:\GitHub\tegaki\docs\` に一時配置する。既存SSOT（PRODUCT／STATUS／UI_DESIGN_AUTHORITY_MAP）への自動昇格は禁止。各Passの末尾に「変更履歴／確信度／既知の反証・更新版」を追記し、旧説を黙って上書きしない。後日Luna MAXに、重複排除・適切なdocs格納先・相対リンク・参照register更新だけを別Cardで任せる。設計の採否やproduction変更はその整理Cardに含めない。
