# TEGAKI GUI先生ツール研究 13 — Animation Tableの非Floating化・Dock Preset・右手操作領域

作成日：2026-09-20  
区分：Visual Research / Owner要件統合 / 初期画面仕様案。**Research Bankであり、実装Card・コード正本ではない。**  
保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_13_2026-09-20.md`  
同梱の今回の現状画像：`./TEGAKI_GUI_CURRENT_TABLE_DRAWING_2026-09-20.png`  
前提文書：`TEGAKI_GUI_SENSEI_RESEARCH_12_2026-09-20.md`（先生画像URL付き下部Dock案）。過去資料01–12の一般論より、今回明示されたOwnerの配置・右手操作の希望を優先して比較する。

## 0. 今回の差分・読み方

前回12は「下部Dock＋単一transport」を初期案とした。今回Ownerは、Animation TableのFloatingを通常機能から退役し、**下部固定・高さ調整・収納、将来的な左側の縦型preset**を希望。ステータス・拡縮controlsの右左配置について、右利きの操作動線まで指定した。本書はその希望を**具体的な画面仕様候補、公式先生の掲載画像・説明書リンク、移行の順序、未確定箇所**に変える。

表記：**OBSERVED**＝今回のOwner画面から見えること、**OWNER**＝今回の明示要望、**SOURCE**＝先生の公式資料から確認できる事項、**PROPOSAL**＝TEGAKI向け配置方針、**UNKNOWN**＝コード・実機で未確定。CSS pxの試作値は先生の実測値ではない。

## 1. 現状画面と、直す対象を固定

![Owner提供：Drawing + Animation Table の現状](./TEGAKI_GUI_CURRENT_TABLE_DRAWING_2026-09-20.png)

**OBSERVED**：左ツールレール、中央の400×400 canvas、右のLayer/CAFと`< F1 >`／再生等のindicator、下方に浮いた大きなAnimation Tableが同時に見える。Table上端はCanvasの下部へかかる。Table header中央に大きな再生button、Table左下に`− 33% ＋`、右下にresize grip、最下段に`Canvas / Tool / Layer / 座標 / FPS / History`等のstatus。右Layer上にも再生・F1がある。画像は挙動、DOM owner、単位や各controlの用途を証明しない。

**OWNER**：Tableは浮動で移動するより、下部固定を主とし、上下伸縮・アコーディオン収納する。将来、左サイド側に縦型として切替可能なpresetも検討。右利きのため高頻度操作を右下に寄せる。左下には情報表示を割り当てる。座標と現状のFPS statusは有用性が低いので削除／非表示候補。旧RIG Workspaceは部品置き場として残し、移管済みの能力から段階退役。

**最初の設計判断（PROPOSAL）**：Bottom Dockを製品の標準画面にする。Floating位置移動は通常UIから廃止。Left Verticalは**別の第2 preset**として意味のあるtimeline投影と右Workspaceとの競合を試作してから実装する。Bottomの動作確認より前にBottomとLeftを同時に全面実装しない。

## 2. 先生ツール：参照する「画面状態」と正確なURL

| ID | 公式資料の該当状態・掲載画像を開く | 本書への寄与と限界 |
|---|---|---|
| TS-01 | **ToonSquid公式 Timeline** — `Expand and Collapse`、`Custom Timeline Height`、`Playback Toolbar`、それぞれの説明画像。https://toonsquid.com/handbook/interface/timeline/ | 下部Timelineを明示buttonで収納し、Playback Toolbarは残留。Toolbarドラッグによる高さ調整と、一定レイヤー数以降の内部scroll。**Bottom Dock／compact transport**の直接的な先例。TEGAKIへのDOM流用を意味しない。 |
| TS-02 | **ToonSquid公式 Editor / Overview** — `Timeline`の全景および右下の展開入口。https://toonsquid.com/handbook/interface/editor/ | CanvasとDockの相対位置、展開入口の発見性を比較する。 |
| CP-01 | **Callipeg公式 Timeline** — 冒頭の下部Timeline、伸長・収納の掲載画像。https://callipeg.com/learn-timeline/ | Canvasを空けるための収納と、高さを増やして時間編集する切替の先例。 |
| CP-02 | **Callipeg公式 Bottom Bar** — `The Bottom Bar`の画像。https://callipeg.com/learn-interface-bottom-bar/ | 左に隣接sheetの動作設定、右にtimelineのfocus／fit controlsを分離。**情報・低頻度設定と右側のzoom/focus操作を別群にする**視覚参考。ただしOwnerの右手優先はTEGAKI固有判断。 |
| CP-03 | **Callipeg mini公式 Timeline** — 横向きと縦向きの両方の図。https://callipeg.com/learn-mini-interface-timeline/ および日本語 https://callipeg.com/ja/mini-%E3%82%BF%E3%82%A4%E3%83%A0%E3%83%A9%E3%82%A4%E3%83%B3/ | 縦横の表示条件に応じTimelineの置き場を切り替える実例。**公式では縦向き＝下、横向き＝右**。TEGAKIの「左へ配置」の実例として誤記しない。左右位置・時間軸の向きは別仕様である。 |
| KR-01 | **Krita公式 Animation Timeline Docker** — Overview画像、`Utilities`／`Settings`／`Layer List`／`Frames Table`節。https://docs.krita.org/en/reference_manual/dockers/animation_timeline.html | desktopのDock型Timelineでtransportを集約し、低頻度設定はsubmenu側へ分離する比較対象。**KritaのDock UIがTEGAKIの左縦Timelineそのものを証明するわけではない**。 |
| LY-01 | **LYRICA公式製品メディア** — App Store screenshots／Steam media。https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 と https://store.steampowered.com/app/5106770/Lyrica/ | video/DAW系の造形・密度の補助比較。最新画面の再生button位置・Dock切替は未実証。配置寸法の先生に昇格させない。 |

**見るべき観点**：再生がどの面に所属するか、折り畳んでも残る範囲、右下の展開／zoom操作の置き方、panelの縁とCanvas境界、同時に大きなFloating面が発生するか。先生のアイコン形状をそのまま転載するのでなく、意味・光学サイズ・線幅・選択状態の一貫性を参照する。

## 3. WebSOL決め打ち：標準Bottom Dockは4領域のレイアウト

**PROPOSAL**：アニメーション文脈での標準画面は、左Tool Rail／Canvas／右Single Workspace／下Time Dockを**レイアウト領域として分割**する。Canvas上へTableを重ねて浮かせない。下部のTableはTool Railや右Workspaceを無理に覆わず、横幅の最終範囲は現行DOMとresizable panelとの依存を見て決める。右WorkplaceはDrawing⇄Transformの排他的置換を維持。

```text
┌──────┬──────────────────────────────────────────┬──────────────┐
│ Tool │                                          │ Single Right │
│ Rail │                CANVAS                    │ Workspace    │
│      │       image + overlays visible           │ Drawing /    │
│      │                                          │ Transform    │
│      ├──────────────────────────────────────────┤              │
│      │ TIMELINE TRANSPORT  (一組のみ)        [▾]│              │
│      │ lane labels │ time ruler / clips / KEY   │              │
│      │ ──────────────────────────────────────── │              │
│      │ INFO（左・非操作）        Zoom  − 33% ＋  │              │
│      │                                  Fit  [↑]│              │
└──────┴──────────────────────────────────────────┴──────────────┘
```

図は**要素の所属のみ**。Tableが右Workspaceの真下にも横断するか、Canvas領域内だけで横幅を終えるかは、実寸比較の小課題。右端に常に操作領域を確保するため、Table内部の右下を固定control clusterとする。外側の右操作レールがTableの右隣へ残る場合は、Table zoomがそのレールと干渉しないよう境界を設ける。

### 3.1 Dock状態の見え方

- **Collapsed（収納）**：細いTransport＋`Tableを開く`のみ。アニメ文脈の再生／現在Frameを残し、lane、grid、footer編集buttonsは隠す。Canvasの縦スペースが増える。
- **Compact（通常）**：Transport＋時間ruler＋1–数lane＋右下操作cluster。現在画像程度の内容で、巨大な空白領域を持つ浮動Tableにしない。少数laneなら内容に応じた高さ、上限を超えればgrid内部scrollを使う。
- **Expanded（時間編集）**：Dockの上端が上へ移動し、表示lane数を増やす。Canvasの描画領域は減るが、常に同じ描画ビュー／操作対象へ戻れる。高さはユーザー操作で変えられ、収納／通常／展開に戻せる。**画面いっぱいに伸ばしてCanvasが実質消える状態は上限で防ぐ**。

「Accordion」は**コンテンツを収納した時にDock自体の高さが変わること**。CSS opacityや`visibility:hidden`だけでスペースが残る状態をAccordionと呼ばない。`hide()`によるPopup閉鎖とbodyのみのcollapseは、現行編集sessionとPopupManagerがどう扱うかを読んで別にする。

### 3.2 Drag移動をやめても、高さ変更は残す

- **廃止対象**：Table全体をCanvas上の自由位置へドラッグするfloating位置指定と、任意の四隅からの自由resize。
- **残す候補**：Dock上端の境界handleを上下にドラッグする高さ変更、明示buttonの`収納／通常／展開`、keyboardでも使える入口。
- 高さ変更時は**Canvas viewをレイアウトとして再計算**し、描画作品の実寸／Frameモデルを変えない。Camera fitやスクロール復帰の挙動は別fixtureで確認。
- FloatingのDOM event handlersをCSSで隠すだけの実装は避ける。pointer capture、focus、Popupのcloseと一緒に局所整理する。

## 4. 右利きの操作地図：右下は操作、左下は情報

現在のTable左下`− 33% ＋`は、右下に移設する候補。**画像だけでは33%がCanvas倍率かTimeline倍率か確定しない**ため、移す前にlistener／更新対象を1か所確認する。倍率UIの意味は移設前後で変えない。

```text
Dock footer:
┌───────────────────────────────────────────────────────────────────────┐
│  [Lane 1 / Frame 1 · 現在地] [選択範囲 · 必要時のみ]     [−] [33%] [+] │
│  （情報＝左下）                                         [Fit] [高さ▴▾] │
└───────────────────────────────────────────────────────────────────────┘
```

**右下（指・pointerが向かう高頻度／精密操作）：** Table倍率`−／値／＋`、fit／現在位置へfocus、Dock高さ切替・preset切替の明示入口。低頻度のpreset変更はzoom群と誤操作しない位置／menuへ。右下だからといって全操作を詰め込まない。

**左下（読む情報）：** Lane名・現在Frame／選択の時間範囲・必要ならstatusの最小情報。クリックを要求するものは原則置かない。現在画像の`Canvas 400×400px / Tool / Layer / 座標 / FPS / History`を丸ごと残すのでなく、役割ごとに仕分ける。

**Statusの整理（Owner希望を基準にした提案）：**

| 現行status項目 | 初期レイアウトでの扱い | 事前確認 |
|---|---|---|
| 座標 X/Y | 通常時は非表示。必要時にInfo／Debugへ退避。 | Canvasに直接描画中の状態提示が別途必要かだけ確認。 |
| FPS: 60 | 現行最下段の数値は通常時非表示候補。**動画プロジェクトのFPS設定まで削除しない**。 | 表示がrender性能FPSかproject frame rateかをコードで区別。重要なscene FPSならTimelineの正規設定面に残す。 |
| Canvas size / Tool / Layer | 一行全表示を当然としない。現在targetは右Workspaceに既にある場合重複しない。必要なcanvas sizeなどは折畳み情報面へ。 | DRAWING/ANIMATEで情報がどこに残るか。 |
| History | 常時表示の必要性をOwnerが判断。非表示化してもUndo／Redo／History機能自体は変更しない。 | 開発用カウンタかユーザーの主要状態表示か。 |

**Foot bar衝突回避**：Dockの`footer`とアプリ共通の`status-panel`を同じ画面座標に重ねない。共通Statusは左下の独立した控えめな情報帯へ配置するか、Table左footerへ意味のある項目だけ統合する。Table収納時に情報が必要なら同じ左下側へ残す。右下のzoom clusterへstatus文字を押し込まない。

## 5. Left Vertical preset：配置オプションとして保持、仕様はまだ別段階

**OWNER希望**：左サイド側へ縦型に変更できるpresets。これを単純な「90度回転させたBottom Table」として実装しない。時間の読み順・lane選択・frame drag・数値input・scroll directionが一変するからである。

**PROPOSAL（比較用）**：Tool Railを維持し、その**右隣**に左Time Dockを置く。Tool RailそのもののbuttonをTimelineに置換しない。右Single Workspaceとの二重panel増殖を避ける。

```text
┌──────┬────────────────┬───────────────────────────┬──────────────┐
│ Tool │ LEFT TIME DOCK │          CANVAS           │ Right        │
│ Rail │ transport      │                           │ Workspace    │
│      │ frame/lane      │  drawing / bone / WARP    │              │
│      │ selected items  │                           │              │
│      │ timeline view   │                           │              │
│      │ (再設計必須)    │                           │              │
└──────┴────────────────┴───────────────────────────┴──────────────┘
```

**調査すべき設計分岐（未決定）：**

- L1: 時間軸は横向きのまま、狭い横幅をh-scroll／mini-mapで扱う。短いclipに向く可能性があるが、全体時間把握が難しくなる。
- L2: 時間軸を縦に再投影し、上→下へFrame、横へlaneを置く。縦方向の操作語彙（drag／shift／wheel／playhead）まで設計し直す必要がある。
- L3: 左Dockは詳細編集表でなくFrame／clip／laneの縦リストと概要に特化し、詳細時間編集はBottom presetへ切替える。左位置を選べる利点はあるが「同じ能力の二つの配置」という意味ではなくなる。

**重要な出典上の留保**：Callipeg miniの縦横切替は公式ではBottom⇄Rightであり、Leftの先例ではない。左Dockは今回のOwner要望に基づくTEGAKI独自の第2案。ToonSquidの右利き／左利きtoolbar配置やCallipegのPencil ergonomicsは利き手でcontrolを動かせる根拠だが、Timeline左配置を証明するものではない。

**移行順序**：Bottom Dockの同一control／同一model／同一guard・Canvas reflowを先に完了。Leftは別fixtureでCanvas幅、右Frame、track横断drag、時間目盛とScrollの可読性を比較。Left presetを選べない画面幅では無理に表示せず、利用不可理由とBottomへの復帰入口を示す。

## 6. Playbackの一元化と既存guardを両立

第11回Luna報告で、Drawing／Table閉鎖の`frame-indicator`が右Layer Panelにあり、TransformのSingle Right Workspaceでは非表示・inert、Table自体にもcurrent Frame、Play、Onionの重複があることが判明。後続LunaのFrame navigation修正は`handled:false`と`handled:true,moved:false`を分け、guard拒否後にlegacy fallbackへ進まない4条件をtargeted verifierでPASSした**というOwner提供報告**。この時点の最新commit状況／差分内容は本書では未確認。

**PROPOSAL**：Time transportはDock上端に一組だけ見せる。Table収納中も同じ群を保つ。Layer Panel内の旧indicatorを単に隠すのではなく、既存event sink／focus／Table headerとの重複を整理してsingle projectionにする。右Transform KEY stripの前後Frameと`KEY確定`は固有transactionを持つため、見た目の類似だけで統合しない。`SOURCE→Animation Table`の編集文脈切替は維持。Tableのbody collapseをSOURCE/ANIMATE終了と同義にしない。

**実装前条件**：GUI Layoutの作業開始時点のbranch／HEAD／worktreeとFrame navigation 2ファイルの取り込み状態を一度確認し、別未commit修正にGUI差分を上書きしない。Popup hide／show、pointer terminal、Transform pending、History、Canvas cameraを同時に全面改修しない。

## 7. 先生に寄せる「見た目」を具体化：初期visual grammar（WebSOL試作値）

| 部位 | 見る先生画像 | TEGAKI試作値／見た目候補 | 実機受入 |
|---|---|---|---|
| Bottom transportとTable header | TS-01のPlayback Toolbar、CP-01のTimeline全景 | 常設細帯。Playと前後Frameのiconは同一stroke・同じoptical size帯。大きい中央独立Playを廃止。Current FrameとPlay群を近接配置。 | Collapsed／Compact／Expandedで再生を探し直さない。 |
| 展開／収納・height | TS-01のbottom-right入口とheight drag | 右端に方向を示すcompact button、上端のresize hit areaは外見より広く。状態変化をtooltipと`aria-expanded`で明示。 | Mouse・pen・keyboardから発見できる。 |
| Footerの役割分離 | CP-02の左右機能分担画像 | 左：情報labelを薄い一群。右：`− 33% ＋`＋Fit／height等の実行control。Zoomの数字は現行値の意味を継承。 | 右下操作でCanvas上の絵を塞がない。 |
| ボタン装飾 | TS-01 / CP-02 の押下群 | Futaba maroon／creamで平面、弱い境界線。Playだけ過剰な巨大立体buttonにしない。Active、disabled、KEYEDは色差だけでなく形・textを併用。 | 光学サイズ・余白を実画面で対照比較。 |
| 左Verticalの密度 | CP-03の縦横掲載画像（方向変更の**概念のみ**） | 既存Tool Railを保持し、左Dockは専用timeline projection。Tableの横幅を細くするだけで済むと仮定しない。 | 右利きでも右下の主要controlが消えない／遠くへ移動しない。 |

**寸法について**：前回12の16–18 CSS px程度のicon／32–36 CSS px程度のpointer button、touch時44 CSS px級は**試作候補**。先生の実測値ではない。今回のOwner画面に合わせて、外枠padding・主要controlの高さ・Timeline内部の横目盛密度をBrowserで測って調整する。視認性とpointer hit sizeを先に守り、アプリ全体の一律縮小をしない。

## 8. 実物の比較Fixtureと受入条件

| Fixture | 画面状態 | 成功を目指す目視条件 | contract上の注意 |
|---|---|---|---|
| B0 | Drawing、animation contextあり、Dock収納 | 同じ場所に最小transport＋展開入口。Canvasが広い。右Layer indicatorと二重再生しない。 | 既存Frame modelのみ。 |
| B1 | Drawing、Dock Compact、Lane 1と少数Frame | Canvasの絵とLayerが見える。再生は1群。footer左は情報、右はzoom。Table空白がCanvasを過度に奪わない。 | 33%の更新対象は現行と同じ。 |
| B2 | Drawing、Dock Expanded、多lane／長時間 | Dock高さに上限、lane/grid内scroll、Transportは視認可能。Resizeとzoomのhit areaが別。 | Drag/drop・pointercaptureを破壊しない。 |
| B3 | Transform ANIMATE、Table Dock Compact、KEYED | Canvas上の変形handleを観察でき、右KEYと下Playbackの意味が混ざらない。 | 保存／取消／KEY／History現行契約を保持。 |
| B4 | Transform SOURCEからTable表示 | 表示文脈移行として理解できる。Source操作終了を勝手なKEY commitに置換しない。 | Owner意図に沿う既存session terminal。 |
| B5 | 旧RIG Workspaceが必要時のみ開、Dock Compact | 旧RIGの未移管機能へ到達可能だが、普段はCanvasを覆わない。 | 旧RIG workspace削除なし。 |
| L0 | Left preset概念fixture、右Single Workspace同時 | Tool Rail・Canvas・Right Workspaceを維持し、左時間panelが意味のある時間編集／現在地を提供する。 | BottomとLeft同時展開なし。操作権限の複製なし。 |
| N0 | 768×600、Dock収納／Compact | Canvas、Right KEY、再生、右下zoomの最低限が残る。 | 利用不可のLeft presetを無理に表示しない。 |

各画面のDOM bounding box、Canvas可視領域、status/footerの重なり、上下伸縮端末、pointer／keyboard focusを記録する。先生の画像と同一の画面状態で並べ、実際の見た目の判断はOwnerへ返す。

## 9. 次の一回だけの仕事／停止条件

**WebSOLが決めること**：まずBottomを標準Dockとし、Transport一群、右下のzoom／height操作、左下の情報、Dockの収納／通常／展開をUI fixtureの対象とする。Left Verticalは第2 preset候補として保持するが、意味と表示構造の裁定なしにBottomを90°回転しない。Floatingの移動・自由resize廃止は移行完了後であり、既存handlerを先に削らない。

**次の単一作業**：`Animation Table Bottom Dock — B0/B1/B2 display ownership fixture`。現行HEADのUI layout・Table transport・footer zoom／33%・status barのDOM/CSS ownerを局所抽出し、上記3状態の**表示だけ**の画面仕様をLunaまたはAstra用に固定する。現時点でTable model・Frame terminal・History・KEY・RIGの改修は指示しない。必要ならAstra LOWには**「Bottom表示骨格・再利用するDOM・Left preset切替時の唯一のowner」だけ**を狭く判断させる。実装Cardはlocal source確定後に別途。

**UNKNOWN**：現在のlocal HEADとFrame fallback修正の最終取込状態。33%の倍率対象、現行statusのFPSの意味、Animation Table自身のDOM／drag／resize/popup排他、Bottom DockとRight Workspaceの正しい幅境界、Left Verticalの最終時間軸方向とdrag語彙。UNKNOWNを解消するために全repo調査を行わない。

---

## 10. 出典・文書index

先生公式（2026-09-20にページを確認／本書はスクリーンショットの全画像寸法を実測していない）：

- [TS-01] https://toonsquid.com/handbook/interface/timeline/ — Expand and Collapse / Custom Timeline Height / Playback Toolbar / Bottom Toolbar
- [TS-02] https://toonsquid.com/handbook/interface/editor/ — Editor / Timeline全景
- [CP-01] https://callipeg.com/learn-timeline/ — Timeline全景とshow/hide
- [CP-02] https://callipeg.com/learn-interface-bottom-bar/ — Bottom Bar左側の編集方式と右側のzoom/focus
- [CP-03] https://callipeg.com/learn-mini-interface-timeline/ 、https://callipeg.com/ja/mini-%E3%82%BF%E3%82%A4%E3%83%A0%E3%83%A9%E3%82%A4%E3%83%B3/ — mini縦/横でBottom/Right
- [KR-01] https://docs.krita.org/en/reference_manual/dockers/animation_timeline.html — Dock内のTransport/Settings/Layer List/Frame Table
- [LY-01] https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 、https://store.steampowered.com/app/5106770/Lyrica/ — GUI比較入口（正確な位置・遷移未実証）

内部：研究12、Owner提供の今回のDrawing＋Table画像、Owner提供のLuna Frame Navigation Fallback Boundary報告。**今回local sourceは読んでいない／productionは変更していない。**
