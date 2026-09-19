# TEGAKI GUI先生ツール研究 09 — Animation Table表示経路の部分追跡／Time UI再利用判定の前提

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
ユーザー保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_09_2026-09-20.md`  
前提：研究06〜08。特に08の「Table本体未取得」という到達限界を引き継ぐ。  
参照コード：公開GitHubの**固定commit `b5e38265b250d4d7ddfc085c761709a6c42238bd`**。ユーザーの最新ローカルHEAD／未commit差分とは一致すると保証できない。実Browser未検証。

> **今回の到達度：PARTIAL／表示経路を一段だけ進めた。** `PopupManager` の一般的な表示・非表示・排他ロジックと、Sidebar／Transform側のDOM入口を照合した。中心となる約1.22 MBの `ui/animation-table-popup.js` 本文は、公開GitHub接続からの取得が空となり、Table内部の再生・header・resize・pending guardの検証は未達。**「Table headerを収納時に残せる」「既存UIを移動するだけで完成」とは判定しない。**

## 0. 今回の問い

第07回で比較した最小Time UI（A：独立strip、B：Table header残留、C：Canvas下端chip）のうち、既存Tableの部品を再利用できる根拠はどこまであるか。新しい時間操作UIを作るより先に、**表示所有者・Table自身のhide／toggle・編集terminalへの接続**を区別する。

今回は公式先生ツールの新情報を増やさない。外部比較は研究06・07を参照し、TEGAKIの実装証拠を追加する。元研究01〜08は編集しない。

## 1. 新規確認：PopupManagerはTable専用の収納機構ではない

固定commitの `system/popup-manager.js` の関連箇所で確認した内容：

| public method | コード上の役割 | Time UI設計への含意 |
|---|---|---|
| `register(name, PopupClass, ...)`／`initialize(name)` | `PopupClass`をインスタンス化し、`show`／`hide`／`toggle` メソッドを要求する。 | Tableに個別のライフサイクルがある可能性を示す。内部実装は未確認。 |
| `get(name)` | 管理済みインスタンスを返し、未readyなら初期化を試みる。 | UIから `animationTable` の既存メソッドを再利用する入口候補。ただし新UIが自由に呼んでよいという意味ではない。 |
| `show(name)` | `hideAll(name)` の後、対象インスタンスの `show()` を呼び、activePopupと `popup:show` を更新。 | Tableのshowには**他popupの非表示**が伴い得る。時間barが必要とする「収納」とは別の意味かもしれない。 |
| `hide(name)`／`toggle(name)` | `instance.hide()` を呼ぶ／visibleに応じてshow・hideを切替え、イベントを発火。 | `hide()`がTable内の再生・CAF文脈・focusへ何をするかを読まない限り、「外枠だけ畳める」とは言えない。 |
| `hideAll(exceptName)` | 管理対象の他popupをhideし、さらに汎用 `.popup-panel` の `show` classを除く処理を持つ。 | **汎用popupの非表示と、Table内容だけのcollapseを混同しない**こと。Table専用の収納が既にあるかはTable本体で確認する。 |
| `isVisible(name)` | インスタンスの `isVisible === true` に依存。 | Time Stripの「Tableを展開中」という表示を単純なDOM classのみから再定義しない。 |

証拠：[`popup-manager.js`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/system/popup-manager.js#L21-L283)。

**注意：** `PopupManager` が提供しているのは一般的なshow／hide／toggleであり、**Table headerのみ残す `collapse()` や playback controller共有APIの存在は、このsourceからは確認できない**。表示切替の際に他popupへ与える影響は、現行アプリの実装・呼出し元ごとに確認が必要。

## 2. 既存の時間操作入口：何が判明し、何が未判明か

| 現在確認できる入口 | 場所／source | この回で確認できた範囲 | Table閉鎖時の生存／実動作 |
|---|---|---|---|
| Animation Table起動 | `ui/dom-builder.js` の `buildSidebar()`、`#gif-animation-tool`。`data-popup-name="animationTable"` | Sidebarで起動buttonのDOMを生成。実際のevent handlerはこの場所にない。 | LauncherをTable本体や再生barそのものと混同しない。実BrowserはUNKNOWN。 |
| Transformの前後Frame／KEY | 同 `buildLayerTransformPanel()` 内の `#layer-transform-key-prev-btn`／`#layer-transform-key-next-btn`／`#layer-transform-key-commit-btn` | **Transform専用KEY stripのDOM**。KEY未設定の初期ラベルと `hidden` 属性を持つ。 | Playback barの代用品とみなさない。handlers、guard、Table閉鎖後の挙動はUNKNOWN。 |
| Animation関連keyboard | `ui/keyboard-handler.js` 内 `PopupManager.get('animationTable')` 等 | 一部の操作を既存Tableの `handlePlaybackMarkerShortcutKeyDown`、`selectAdjacentInternalLayerByDirection`、`toggleMotionWindow` 等へ委譲。 | shortcutContext・対象widgetのvisibility・既存guardの組合せを無条件の再生操作とみなさない。 |
| Popup表示共通入口 | `system/popup-manager.js` | `show`／`hide`／`toggle`でTableインスタンスへ委譲可能な基盤。 | **どの操作がTable自体のclose、内部bodyのcollapse、再生停止、文脈終了につながるか未確認。** |
| 汎用status表示 | `ui/status-display-renderer.js` | `fps-info` 等の表示projection。 | FPSを「現在Frame番号」の既存正本として転用する根拠はない。 |

証拠：[`dom-builder.js`（Sidebar）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js#L55-L125)、[`dom-builder.js`（Transform）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js#L345-L455)、[`keyboard-handler.js`](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/keyboard-handler.js#L72-L125)、[`status-display-renderer.js`](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/status-display-renderer.js#L40-L80)。

**調査上の補正：** 公開 `ui/animation-table-popup.js` の存在と大きさ、KeyboardHandlerからの呼出しは確認できるが、Table内部のどのUIがどこで作られるかは未読。前回08の「Table内Playback UIとTransform KEY stripが重複するかもしれない」は引き続き**仮説**である。

## 3. 実装設計へ進めない理由：三つのライフサイクルが未分離

最小Time UIを設計する前に、少なくとも次の三つを独立させて証拠化する必要がある。

**A. Popup visibility** — Tableのウィンドウそのもののshow／hide。PopupManager経由なら他popupへの排他挙動を伴う場合がある。

**B. Table body collapse** — Timeline lane・frame gridだけを畳み、transport／現在Frameなどのheaderを残せるか。**既存実装の有無はUNKNOWN**。新しいUI状態として実装が必要かもしれない。

**C. Editing and playback terminal** — Tableを畳む・隠すことが、再生停止、Frame移動、CAFの編集session、pending guard、KEY確定、focusへどう影響するか。**Table自身の `show()`／`hide()` と既存controller経路を読まずに決めない。**

研究07の案Bは、A/B/Cを区別した後に初めて「Table headerだけ残す最少変更」と評価できる。`PopupManager.hide('animationTable')` をそのままTime Stripのcollapseに割り当てるCardは、現時点では出さない。

## 4. 次の局所抽出で作るべきCapability Ledger

巨大sourceを冒頭から読み直す必要はない。**現行ローカルHEADの限定範囲で、既存の関数・DOM・呼出し先を拾う**。

| 質問 | Table本体から必要な証拠 | 最終的に判定すること |
|---|---|---|
| 既存transport | 再生／停止／loop／前後Frame／現在FrameのDOM生成箇所、listener、呼出すcontroller | playback UIの単一所有者と再利用可能性 |
| headerとbody | header／toolbar／grid／laneのmount関係、ID、CSS class、scroll owner | 同一headerを残してbodyだけ畳める構造か |
| Table開閉 | `show()`／`hide()`／`toggle()` および専用collapse／minimizeの有無 | popup非表示とbody収納の相違、残るcontrol |
| drag／resize | header pointer listener、resize grip、position保存、pointer capture、z-index | headerを固定・移動すると既存操作を壊すか |
| Frame移動／KEY guard | UIからのcall chain、disabledの更新箇所、pending時の拒否先 | 新入口がguardを迂回しないか |
| 右Workspaceとの重複 | Table内 `LAYERS／RIG`・CAF対象操作のrender箇所、右Frame側の入口 | 移設前に保持必須な入口、削除候補を分ける |

必ず「事実／推論／UNKNOWN」を各行で区別する。名前が似た関数を同じauthorityと決めない。Timeline modelの書換えやroot cause監査には広げない。

### ローカル抽出の再現用コマンド案（Luna等へ限定Card化する場合）

作業Directory：`D:\GitHub\tegaki`。**read-onlyで実行する。**

```powershell
 git branch --show-current
 git rev-parse HEAD
 git status --short --untracked-files=all
 rg -n -i 'play|pause|stop|loop|transport|currentframe|previousframe|nextframe|frame.*(prev|next)|toggle|collapse|minimi|header|resize|pointerdown|pointerup' tegaki_work/ui/animation-table-popup.js
 rg -n -i 'pending|guard|keycommit|commit.*key|show\(|hide\(|isVisible|popup:' tegaki_work/ui/animation-table-popup.js
 rg -n -i 'animationTable|popup:show|popup:hide|gif-animation-tool' tegaki_work/system/popup-manager.js tegaki_work/ui/keyboard-handler.js tegaki_work/ui/dom-builder.js
```

**この検索出力そのものを長文で提出しない。** 大量のhitからplayback/header/show/hide/guardに関係する関数とその前後だけを局所抽出する。各対象の「DOM → listener → handler → authority／guard」を一度追えない場合はUNKNOWNとする。`animation-table-popup.js` の巨大な全文読込、全repo search、full suite、Browser環境再構築は行わない。

## 5. 研究07の三案への暫定影響

**A（独立Time Strip）**：既存transportを投影するだけなら成立し得るが、二重controller／第二Frame正本を作るべきではない。新規barの縦幅と位置に合理性があるか未確定。

**B（Table header残留）**：headerの既存DOMとPopupManagerの `hide()` がどう接続しているか未確認。**先に調査する案であって、現在の最小改修案と断定しない。**

**C（Canvas下端chip）**：Canvas遮蔽、QTP等との競合、mode切替によるボタン移動の問題を維持。外部先生ツールに存在するかどうかより、TEGAKIの直接操作を阻害しないかで評価する。

**共通条件：** 時間UIの見た目を変えても、Frame／Playback／KEY／Historyの正本は既存の所有者。Animation Tableの開閉だけでpendingを勝手にcommit／rollbackしない。`main.css` の `--futaba-*` 系列を配色の基準とし、今回新しい色を設計しない。

## 6. WebSOL監査時の判定Gate

研究09の段階では「Time UIの実装要否」は未決定。次回の局所ledgerを得てから、以下の順で整理する。

1. 既存transport／headerがすでに必要機能を提供するか。
2. それを畳んだ際にも表示するため、内部bodyのcollapseだけで足りるか。PopupManager側のhideと混同しないか。
3. 追加するなら表示projectionのみで済むか。control／handlerの複製が必要なら理由を明示する。
4. pending／KEY／Frame guard、TableとRight Workspaceの作業モードが既存のまま保たれるか。
5. 実画面で再生UI位置の一貫性、Canvas遮蔽、縦スクロール、pen/mouseの到達性をOwnerが確認できるか。

**ここでA／B／Cの採用判断やproductionの実装Cardはまだ出さない。**

## 7. Confidence／次回の停止条件

- **CONFIRMED（固定公開commitの静的コード）**：PopupManagerは一般的なshow／hide／toggleと排他管理を持ち、Tableインスタンス自身に委譲する。SidebarにはTableのlauncherが存在する。Transform KEY stripには前後FrameとKEY入口がある。
- **PARTIAL**：KeyboardHandlerからの一部のTable委譲。Table内部のhandler実体は未取得。
- **UNKNOWN**：現行ローカルのTable内部DOM、transport、header、collapse、drag／resize、popup hideと編集guardの結合、最新未commit差分、実ブラウザの操作結果。
- **STOP**：取得できない巨大sourceを読んだものとして補完しない。未確認のまま新規transportを実装しない。第二playhead・第二History・第二KEY authorityを提案しない。

## 8. Source Index

[G1] [`PopupManager`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/system/popup-manager.js) — この回で新規確認。  
[G2] [`DOMBuilder`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js) — Sidebar／Transform KEY strip。  
[G3] [`KeyboardHandler`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/keyboard-handler.js) — Tableへの一部委譲。  
[G4] [`StatusDisplayRenderer`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/status-display-renderer.js) — 汎用status。  
[G5] [`AnimationTablePopup`（固定commit）](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/animation-table-popup.js) — 存在のみ確認、本文を取得できていない。内部挙動の根拠には使わない。  
[H7] `TEGAKI_GUI_SENSEI_RESEARCH_07_2026-09-20.md` — 画面構成三案。  
[H8] `TEGAKI_GUI_SENSEI_RESEARCH_08_2026-09-20.md` — Table本体未取得の先行調査。  

**次回の優先事項：** ローカルの現行 `animation-table-popup.js` から関連する関数・DOM・handlerのみを抽出し、Capability Ledgerを埋める。AstraへのTime UI実装裁定はその後。
