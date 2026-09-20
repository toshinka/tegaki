# TEGAKI GUI先生ツール研究 14 — Timeline倍率・単一Status所有者・Bottom Dock表示仕様

作成日：2026-09-20  
分類：Owner要件反映／Visual Design Decision／Research Bank。**実装Card・現行コード正本ではない。**  
想定保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_14_2026-09-20.md`  
接続：研究12（公式画像・説明書の参照先）、13（Bottom Dock／右手操作／Left preset）とOwnerの今回の補足。旧文書を上書きせず、研究13のUNKNOWNと試作配置を本書で更新する。

## 0. 今回Ownerが確定させた事項と今回の決定

**OWNER確定**：Table footer左下に表示される `33%` は**Timelineの表示倍率**。既存のwheel操作でも調整できるため、`−／33%／＋` のクリック頻度は高くない。Canvas倍率でも動画のFPSでもない。倍率の意味・wheelによる変更・表示更新の契約を改変せず、操作群の**置き場**を右下へ移す候補とする。

**OWNER許容**：アプリ共通Statusは、Table展開時に別のStatus表示へ切り替える方法でも、既存所有者を保ち表示位置・重なり順を変える方法でもよい。既存Floating廃止に向けて無駄のない方をWebSOLが選ぶ。

**WebSOLの設計決定**：**Statusは一つの所有者・一つの表示投影を維持し、Dock状態に応じて置き場をレイアウト上で確保する。** Table専用の第二Status controllerを作らない。`z-index`を上げるだけで重なりを隠す手法も採用しない。最初の実験は、アプリの下端に低い共通Status帯を残し、Tableの高さ計算でその帯の分を先に予約する方式。Status帯は**左下を起点とする情報領域**、Timeline zoom・Table高さ等は**Dockの右下を起点とする操作領域**とする。後でStatusの一部を非表示にする場合もデータ・event正本を別に作らない。

**この決定が解決しないこと**：現行DOMの親子関係、固定位置・z-index、Tableのdrag/resize、Canvasのcamera reflow、status項目の意味。これらは現行ソースとBrowserで局所確認してから変更する。

## 1. 研究13からの差分・訂正

| 研究13での状態 | 今回の更新 | 区分 |
|---|---|---|
| `33%` はCanvas倍率かTimeline倍率か未確定 | Timeline倍率で確定。左下から右下への**表示位置だけ**を試作対象とする。wheelを維持する。 | OWNER |
| 左下の `− 33% ＋` を右へ移す高頻度操作案 | Zoomはwheel経路があるため**補助的な明示操作**。右下の誤操作しない一群にまとめる。 | OWNER＋PROPOSAL |
| StatusをTable footerへ統合するか、第二表示を作るか未決定 | 共通Statusを単一所有者で保持。Dock footerには**Table固有の選択・時間情報のみ**。重複するFrame／Layer等を二重表示しない。 | PROPOSAL |
| StatusとTable footerの衝突は配置未決定 | 下端の共通Status slotを予約し、その**上**にDockを置く。`z-index`だけで前面に出す解決はしない。 | PROPOSAL |
| Left presetへ切替える可能性 | Bottomを先行。将来Leftを選んでも共通Statusの所有者は不変。Zoomの右手側配置を可能な限り保つ。 | PROPOSAL |

## 2. 標準Bottom Dock：画面の領域モデル

以下は**GUI配置の試作仕様**。既存の実DOMでも先生ツールのピクセル再現でもない。

```text
┌──────┬───────────────────────────────────────────┬───────────────┐
│左Tool│              CANVAS VIEW                  │ Right single  │
│Rail  │       絵・骨・Transform handle            │ Workspace     │
│      │       （Tableが侵入しない）                │ Layers /      │
│      │                                           │ Transform     │
│      ├───────────────────────────────────────────┤               │
│      │ TIME TRANSPORT:  ◀ F1 ▶  Play  [Table ▾]  │               │
│      │ time ruler / lane / clip / key grid       │               │
│      │ （Compact/Expandedでは内部scroll）         │               │
│      │ Table selection info   [− 33% ＋] [高さ] │               │
├──────┴──────────── COMMON STATUS SLOT ───────────┴───────────────┤
│ Canvas/Tool 等の必要最小情報を左起点で表示。操作clusterは置かない。 │
└───────────────────────────────────────────────────────────────────┘
```

- Table本体は浮動パネルではなく、Canvasと**同時に表示されるレイアウト領域**。開閉・高さ変更でCanvas *viewport* を再計算するが、400×400などの作品解像度やFrame modelを変更しない。
- 共通Statusは**Tableの上にかぶせない**。現状固定位置なら、必要に応じて下端slotへ移す。Status帯の高さとDockの高さはそれぞれのlayout変数で扱い、画面幅・高さに応じて衝突しないようにする。
- 右操作領域はTable幅の右下。右Single Workspaceや右のLayer action railと被せず、Tableを左Tool Railから右Single Workspace手前までで区切る試作から始める。フッターの右端は**Table内の右端**であり、画面右端の最外レールに無理に重ねない。
- 再生／現在FrameはTableの収納・通常・展開で**同じ意味を持つ一組**。旧`frame-indicator`とTable headerを双方常設しない。Transform KEY確定は別の編集terminalとして右側に残す。

### 2.1 表示状態

| 状態 | 常に残す要素 | 消える・縮む要素 | 下端Status | 右下Zoom |
|---|---|---|---|---|
| Collapsed | transport／現在Frame／明示的な「Tableを開く」入口（アニメ文脈がある時） | grid・lane詳細・Table footer | 下端に単一表示、要らない項目のみ非表示 | **原則隠す**。wheelの既存作用先は勝手に変更しない。開く入口は保持 |
| Compact | transport、短いlane／grid、Table footer | 長大なlaneは内部scroll | 単一表示 | `− 33% ＋` をfooter右下に表示 |
| Expanded | transport、増えた可視lane、Table footer | 表示上限超のlaneは内部scroll | 単一表示 | Compactと同じ右下 |
| Left preset（後段） | 左Time Dock／共通Statusは同じauthority | Bottom gridは同時展開しない | 同じ下端slot | **右手アクセスを保持する専用投影が必要か別検討**。第二Zoom modelを作らない |

Collapsed中にZoom UIを消すか否かは、wheelをどの領域へ掛けているかを既存コードで確認してから最終決定する。**Table収納時にも倍率変更が必要**なら、collapsed transportの右端に倍率を一組だけ残す案へ変更する。Wheelのみを唯一の発見可能な経路にはしない。

### 2.2 Header／Footerの意味分離

- **Transport（Table上端）**：再生・停止、Frame前後、現在Frame、Table開閉。Time model／KEY書込みの第二正本は作らない。
- **Table grid（中央）**：lane、clip、cel、frame ruler、時間に対するdrag編集。Table高さが増えても**transport/footerは固定**し、gridのみ内部scroll。
- **Table footer左**：選択中lane・現在範囲・clip duration等、時間編集の結果・現在地の**表示**。すでにtransportや右Workspaceにある文言は重複させない。
- **Table footer右**：Timeline倍率 `− 33% ＋`、必要なfocus/fit、高さ変更・プリセットの明示的入口。Zoomと高さ変更のアイコンは形・tooltip・領域で区別し、wheelの従来イベントを維持。
- **共通Status（画面最下端、左起点）**：アプリ全体の軽い情報。Tableの所有者ではなく、右下操作群の操作領域に侵入しない。

## 3. Statusの実装所有権：二重表示より「単一Owner＋独立slot」

### 3.1 二重Ownerにしない理由

Table展開時だけTableがStatusを再生成すると、Tool、Layer、Canvas寸法、Historyの変化を**二つの表示controllerへ配信・同期**する必要が生じる。Tableを閉じるたびに表示owner・focus・更新タイミングを切り替えることにもなる。今回の目的はDock配置の整理なので、その複製は不要。

「一つの正本から複数のread-only projectionを出す」設計は一般には可能だが、今回は共通StatusをTableへ移す実益が小さい。**単一のStatus DOM／既存更新ロジックを保持**したまま場所と表示項目だけ調整する方針。

### 3.2 `z-index`を上げるだけでは不足する理由

前面に出しても、StatusとDock footerが同じ画面座標を奪うこと、背面操作のpointer hitを塞ぐこと、Canvas viewportが下端帯を認識せず隠れることは解決しない。Floatingを廃止するなら、**高さの取り合いをレイアウトに返す**必要がある。

採用する初期仕様は、**共通Statusの高さを常に先取りし、その上側にDockが伸縮する**方式。`z-index`はpopover等の局所的な重なり順の解決に限る。Statusが常に最前面にあることをDockの衝突解決手段にしない。

### 3.3 Status内の表示項目

| 現状項目 | 通常表示の提案 | 保存するもの・調査条件 |
|---|---|---|
| 座標X/Y | 通常時は隠す。必要ならDebug/Infoで確認 | 座標追跡・描画座標計算そのものは変更しない |
| 現行 `FPS: 60` | 通常時は隠す | **描画性能FPSとproject animation FPSの区別**を現行コードで確認。project FPSの設定・表示責務は別に保持 |
| Canvas 400×400 | 状態確認の必要がある画面だけ短縮表示 | 作品の解像度・export設定は維持 |
| Tool／Layer | 現在の右Workspaceに同じ対象名が見えるならStatusで二重表示しない | Drawing／Transformで対象が消失しないか視覚確認 |
| History | Ownerのデバッグ用に必要なら低優先の情報として維持 | Undo/Redo/History modelは一切変更しない |

表示の非表示はCSSだけで決めず、Statusの更新経路がどのDOMを期待しているか調べる。数値を更新する主体を削除・複製しない。「FPSが死んでいる」というOwnerの現場感と、コード上のFPSの意味は別途区別する。

## 4. 先生参照：「何をどの画像で比較するか」

前回12・13で収録済みの**公式資料リンクを再掲**する。今回はページを新規ブラウザ計測していないため、現行最新UIのボタン位置やpx値を新たに確認したものではない。

| 先生・状態 | 開くURLと画像位置 | TEGAKIで照らす部位 |
|---|---|---|
| ToonSquid：Timeline収納／展開、Playback Toolbar | https://toonsquid.com/handbook/interface/timeline/ — `Expand and Collapse`、`Playback Toolbar`、`Custom Timeline Height`の図・説明 | bodyを収納してもtransportを残す、上端から高さ変更、時刻controlsのまとまり |
| Callipeg：Timeline下部配置 | https://callipeg.com/learn-timeline/ — Timeline冒頭の図・説明 | Canvasと時間Dockの境界、gridとcontrolsの並び |
| Callipeg：Bottom Bar | https://callipeg.com/learn-interface-bottom-bar/ — `The Bottom Bar`の図・説明 | 左右で性格の異なる機能を分離し、右側をzoom/focusの操作群に使う見せ方 |
| Krita：Animation Timeline Docker | https://docs.krita.org/en/reference_manual/dockers/animation_timeline.html — Docker overviewの図と各セクション | 浮動Timelineでなく編集領域として時間軸を扱うdesktopの対照例 |
| LYRICA：製品実画面 | https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12 、https://store.steampowered.com/app/5106770/Lyrica/ — screenshot/media欄 | 造形密度を視覚比較する入口。**transport固定位置／左右footer配置はまだ未実証** |

先生画像との比較は「同じ状態」（Table collapsed/compact/expanded、少数lane/多数lane、アニメ文脈有無）で行う。カラーは先生ツールから模写せず、`tegaki_work/styles/main.css`の`--futaba-*`系列を基準にする。ボタンの光学サイズ／押下領域、ヘッダーの厚み、余白、影・枠の強さを実画像で照合する。

## 5. 実装前の局所Ownership Gate（次の単一作業）

**責務は設計の再議論でなく「所有者の現物確認」だけ**。Luna MAXに現行ローカルbranch／HEAD／worktreeの確認後、read-onlyで次の箇所を数行の証拠表へ落としてもらう。実装・commit・pushは禁止。

| 対象 | ローカルで確認すべき一点 | 判定目的 |
|---|---|---|
| `− 33% ＋` | 現行DOM owner、zoom handler、wheel handler、双方の共通更新先 | 場所移動でtimeline scale modelを複製しない |
| Table header／footer | DOM親子、scroll owner、transportとfooterの実体、現在のresize/drag terminal | gridだけを伸縮・収納するための最小所有単位 |
| 共通Status | DOM owner、現行update/render owner、現行position/z-index、必要なDOM ID | Status DOMを一つだけ残して独立slotへ配置できるか |
| Bottom DockとCanvas | Canvas親要素、現在のpopup位置とRight Workspaceのレイアウト関係 | view reflowのUI-only境界、Status帯とDockが競合しない配置 |
| 既存Frame fallback 2ファイル | START HEAD / dirty worktree /修正取込状態のみ | 未commit安全修正へ無断上書きしない。過去Gate全体は再実行しない |

検索／読込は `animation-table-popup.js` の関係するDOM・function・CSSだけ。巨大ファイル全文、全repoの再調査、Timeline／History／CAF／KEYの変更はしない。Browserは必要なら現状wide＋narrowを表示計測する**一回のみ**。前述のレイアウト仕様とコードが両立しない場合は、偽装してPASSにせず、阻害箇所を報告してSTOP。

## 6. 実験Fixture／受入観点

| ID | 状態 | 見た目の受入 | 機能を変えない条件 |
|---|---|---|---|
| D0 | Drawing／Table collapsed | Canvasが広く、再生・現在FrameとTable展開入口が見つかる。画面最下端Statusは必要なら左から読める。 | 旧indicatorとDockで再生を二重表示しない |
| D1 | Drawing／Compact／少数lane | Tableの不要な空白が大きくない。共通Statusを覆わない。右下に`− 33% ＋`。 | 同じTimeline倍率をwheel／buttonで調整できる |
| D2 | Drawing／Expanded／多数lane | transportと右下Zoomがscrollで消えず、gridのみ内部scroll。Canvasは最小可視寸法を保つ。 | Frame/clip drag、pointer captureを維持 |
| D3 | Transform ANIMATE／Compact | Right KEYと時間transportの意味が区別でき、Canvas上のhandleを見られる。 | 既存pending拒否・Frame移動修正・Historyに触れない |
| D4 | 768×600／Compact↔Expanded | StatusがDock・右Workspace・Canvasへ重ならず、Zoomと高さ変更を右手側で押せる。 | 旧Floating eventがhiddenでも残って入力を奪わない |
| D5 | Tableを閉じてDrawing／animation contextあり | Timeline操作は一組のまま、Statusは一つのowner。 | wheel操作を別倍率へ誤接続しない |

**受入前の確認事項**：今回の設計図はBrowser試作の結果ではない。具体的なstatus帯高・Dock高・Canvas最小可視寸法・押下領域は、現行アプリで計測しOwnerが画面を見て決める。強い影や分厚いButtonを増やさず、maroon/creamを主とした軽いUIへ寄せる。

## 7. 結論／停止条件

**GUI配置の決定**：Timeline zoomは右下へ移すが意味とwheel契約は変えない。Statusは単一owner＋独立下端slotを標準とし、第二Status ownerを新設せず、z-indexだけで重なりを隠さない。Bottom Dockはcollapsed/compact/expanded、Left vertical presetは別段階。Transportは一組、右Single Workspaceの排他表示を維持。旧RIG Workspaceは移管が確認できるまで残す。

**次の作業は一件のみ**：Lunaによる局所read-only Ownership Gateを経て、WebSOLがBottom Dockの実装責務を一つに絞り、必要なときだけAstra LOWへDOM/visual境界を狭く裁定させる。未解決を理由に全体監査へ拡大しない。

実装前にFrame fallback修正が現在のworktreeへどう入っているか確認する。実装と同じ未commit差分へ安全修正を無断混在させない。今回はコード変更・テスト実行を行っていない。
