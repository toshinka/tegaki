# TEGAKI GUI先生ツール研究 10 — Time UIの所有権と現行Table局所抽出Gate

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
保存先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_10_2026-09-20.md`  
接続：研究06（Canvas・Right・Timeの役割）、07（Time UIのA/B/C三案）、08・09（現行Tableの部分棚卸し）。以前の資料を上書きしない。  
**到達度：PARTIAL。ローカルD:の現行ソースにはアクセスできず、巨大な`animation-table-popup.js`の本文も取得できなかった。** この資料は「実際にTable内部を抽出した結果」ではない。公開GitHubの固定commitにある**周辺経路**を追加確認し、次に必要な局所抽出と判定条件を定義する。  
公開コードの参照commit：`b5e38265b250d4d7ddfc085c761709a6c42238bd`。ユーザーの最新HEAD・未commit差分と一致する保証はない。実Browser操作・性能計測は未実施。

## 0. この回で進める問い

新しいTime Stripを作る必要が本当にあるか。既存Animation Tableのheader／再生controlを再利用できるか。前回09は一般的PopupManagerのshow／hideを確認したが、**Table固有の内部所有者と編集契約は未確認**。今回は、少なくとも起動時にTableとTransformがどう結ばれるかを一段追い、`Time UIの画面設計`と`既存モデルや編集adapterの変更`を分離する。

## 1. 新たに確認した公開コード：Tableは単なる見た目のPopupではない

固定commitの`tegaki_work/core-engine.js`では、`AnimationTablePopup`と`PopupManager`をimportし、`CoreEngine`が`animationSystem`と`layerSystem`を持つ。UI初期化時には`animationTable`として`AnimationTablePopup`を`PopupManager`に登録し、`layerSystem`と`animationSystem`を注入する。その後に`popupManager.initializeAll()`を実行し、`popupManager.get('animationTable')`で得た実体から`createLayerTransformEditAdapter()`を呼び、`layerSystem.setTransformEditAdapter(...)`へ渡している。これは**登録・初期化・編集adapter取得**までの確認事実である。 [G1]

**帰結（設計推論）：** TableのDOMを閉じたりheaderだけ別の場所へ移したりする変更は、表示だけに限る設計でも、Tableインスタンスの寿命・初期化・adapter提供を無断で変えてはならない。ただし、`Tableをhideするとadapterが壊れる`とまでは、このソースだけでは言えない。hide時の内部動作は未読のためUNKNOWN。

`PopupManager.show(name)`が`hideAll(name)`を呼び、ほかのPopupを非表示にする一般的な排他制御を持つ点は前回09で確認済み。したがって、常設のPlayback UIを作るなら、通常のPopupを一つ追加するだけでよいと考えない。既存Popupの排他動作、Time UIの生存、QTPとの併用を別途確認する。 [G2]

**重要：** `system/animation-system.js`に`AnimationSystem`クラスと`playbackTimer`等が存在するが、それだけでCAFのplayhead・Table再生・KEY確定の唯一のauthorityだと決めない。CoreEngineはTableへ`animationSystem`を渡している一方、Transform edit adapterはTable自身から取得している。実際のPlayback handlerがどこへ委譲するかはTable内部の局所読込が必要。 [G1][G3]

## 2. 確認済み入口と未確認の核心：Capability Ledger v0.2

| Capability | この回までに確認できた入口／関係 | 未取得の核心 | 判定 |
|---|---|---|---|
| Table起動 | Sidebar `#gif-animation-tool` の`data-popup-name="animationTable"`とPopupManagerの登録・show／hide。 [G1][G2][G4] | Table固有の`show()`／`hide()`と実DOM | PARTIAL |
| 再生／停止 | CoreEngineから`animationSystem`をTableへ注入。 [G1] | 現行Tableの再生buttons→listener→handler→真正のplayback owner | UNKNOWN |
| 前後Frame／現在Frame | TransformのKEY stripに前後Frame buttonとFrame表示が存在。 [G4] | Table固有の前後Frame、playhead label、frame guardとの合流点 | PARTIAL |
| KEY確定／pending | Transform KEY stripが存在し、CoreEngineはTableからTransform edit adapterを取得。 [G1][G4] | Table内KEY・pending表示、commit guard、Table収納時の生存 | PARTIAL |
| Table本体収納 | PopupManagerは一般的hide／toggleを提供。 [G2] | Table固有のheader／body分離、`collapse`／`minimize`の有無 | UNKNOWN |
| move／resize | Tableは独立Popupとして登録。 [G1] | 実header、drag grip、resize、scroll owner、focus、z-index | UNKNOWN |
| CAF Layers／RIG | 過去のOwner実画面では旧切替が存在。 | 現行HEADのTable内部と右Workspaceの重複／入口移管状況 | UNKNOWN |
| Table収納とTransform継続 | adapter取得の起動時接続は確認。 [G1] | `show`／`hide`が編集session・再生・pendingに及ぼす影響 | UNKNOWN |

このLedgerは「コードに存在する」ことと「実Browserで押せる・機能する」ことを別の列で扱うための土台。`PopupManager.hide()`をそのまま「Table本体のみ収納」に割り当てない。

## 3. 重複回避：時間操作のラベルが似ても役割を混ぜない

`#layer-transform-key-prev-btn`と`#layer-transform-key-next-btn`はTransformのKEY文脈にある。これを根拠に、Tableのglobalな前後Frame buttonと同一の意味・同一のguardだとは言えない。Research 09の区別を維持する。 [G4]

Time Stripの候補は**既存の時間正本を閲覧し、既存の再生・Frame移動APIへ委譲する薄い入口**である。新しい`currentFrame`の第二state、別再生Timer、第二History、第二KEY commit handlerを作らない。既存Tableのheaderにこれらがすでに結び付いていれば、まずその生存条件を評価する。

`Table全体のhide`、`lane gridだけcollapse`、`Playbackのpause／stop`、`Transform sessionの終了`は4種類の異なる行為。見た目の`×`／`▾`に同じ意味を持たせる前に既存terminalを確認する。

## 4. 次に必要な現行ローカル抽出：巨大source全読込は不要

この会話の作業環境はユーザーの`D:\GitHub\tegaki`を直接開けない。GitHub連携では固定commitの`ui/animation-table-popup.js`は約1.22MBで、範囲指定を含む取得でも本文が空になった。公開sourceの入口情報を、ローカル実装の証拠と取り違えない。

次はLuna MAX等の**読取専用の局所抽出を1回**行い、その結果をWebSOLへ返すのが最短。全文貼付、長いgrep出力、subagent、改修は不要。

### 4.1 Pre-flight

```powershell
Set-Location 'D:\GitHub\tegaki'
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
```

これらを実行するだけではworktreeは変更されない。研究01〜10の`.md`が追加・未commitでも触らない。

### 4.2 Table内部のシンボル候補を少数抽出

```powershell
$p = 'tegaki_work/ui/animation-table-popup.js'
rg -n -i 'playback|play\(|pause\(|stop\(|loop|nextFrame|previousFrame|currentFrame|frame.*(prev|next)' $p | Select-Object -First 65
rg -n -i '(^|[[:space:]])(show|hide|toggle|collapse|minimize|resize)[[:space:]]*\(|header|toolbar|playback.*(button|btn)|play.*(button|btn)' $p | Select-Object -First 65
rg -n -i 'pending|canConfirm|commit.*key|confirm.*transform|createLayerTransformEditAdapter|rig.*tab|layers.*tab' $p | Select-Object -First 65
```

**注意：** コマンドは発見用の候補検索にすぎない。65行上限内に目的のシンボルが出てこなくても「存在しない」とは言わない。頻出すぎる単語は`rg`のpatternを狭める。すべてのhitを読み直さず、見つかった**関数本体と直接の呼出し元1箇所**だけを開く。regexにhitしない場合はUNKNOWNとして返す。PowerShell上で`rg`が利用できない場合は同一ファイルに対する`Select-String`で代用し、環境構築しない。

### 4.3 必要な出力：最大10行のOwner/Call-path Ledger

以下の表を最大10項目、各項目短文で埋める。該当行番号と`CONFIRMED / PARTIAL / UNKNOWN`を必ず添える。

| 対象 | DOM/既存ラベル | listener→handler | authority/guard | Table hide後 | 再利用判定 |
|---|---|---|---|---|---|
| 再生／停止 | | | | | |
| 現在Frame | | | | | |
| 前／次Frame | | | | | |
| loop | | | | | |
| Table show／hide | | | | | |
| 本体collapse／resize | | | | | |
| KEY／pending | | | | | |
| CAF Layer／RIG入口 | | | | | |

再利用判定は`AS-IS / PROJECTION ONLY / NEEDS ADAPTER / UNKNOWN`のいずれかとし、裏付けのない`AS-IS`を避ける。

## 5. Research 07の3案への暫定扱い

A：独立Time Strip — Table本体がtransportを消してしまい、既存handlerを外部表示から安全に呼べることが確認できた場合の代替候補。新しいcontrollerや第二Timerは作らない。

B：既存headerを残す — 既存headerのDOM・listener・bodyとの分離・表示ライフサイクルが証明された場合に比較Fixtureへ進める。**この時点では「最小実装」と認定しない。**

C：Canvas下端chip — 追加floating surfaceやQTPとの競合、操作位置の変動が見込まれるため、ほかの案と同じ画面条件で比較する予備候補。デザインだけで採用しない。

GUIの先生側の根拠はResearch 06・07のToonSquid／Callipegと、未確認点を残したLYRICAを引き継ぐ。今回は先生ツールに新事実を加えない。

## 6. WebSOLが次に判定すべきGate

1. Tableがhideされても、既存の編集adapterやTime authorityが保持されるか。Popup visibilityと編集sessionを分けられるか。
2. 既存headerに再生・Frame表示・開閉入口が同居しているか。bodyだけ収納するDOM境界があるか。
3. 既存の再生・Frame listenerを一度だけ所有し、Time UIがそのstateを投影する構成が可能か。
4. 既存pending／KEY guardを通すか。見た目だけのdisabled、UI単独のFrame stateを増やさないか。
5. Tableを閉じても再生の入口を残すために必要な変更は、表示のprojectionか、それとも既存controllerの分離か。

**この5点を確認するまでは、A/B/Cの採用決定やTime UIのproduction Cardを発行しない。** ただし、ローカル抽出により独立したUI-only fixtureが成立すると判明した場合、model不変更を条件に比較へ進める。

## 7. 出典とConfidence

[G1] `core-engine.js` 固定commit、imports／初期化・adapter接続：
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/core-engine.js#L37-L50  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/core-engine.js#L336-L378

[G2] `system/popup-manager.js` 固定commit、register／get／show／hide／hideAll：
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/system/popup-manager.js#L21-L283

[G3] `system/animation-system.js` 固定commit、AnimationSystemのclass／playbackTimer等：
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/system/animation-system.js#L183-L219

[G4] `ui/dom-builder.js` 固定commit、Sidebar／Transform KEY strip：
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js#L55-L125  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js#L395-L460

[H6–H9] 同じdocs直下に保存した研究06～09。いずれもResearch Bankであり、production sourceの正本ではない。

CONFIRMED：固定公開commitの`CoreEngine`がTableを登録・初期化し、Table作成のTransform adapterを`LayerSystem`へ渡している。`PopupManager`の一般的排他・表示制御とSidebar／Transform KEYの入口がある。

PARTIAL：Time UI側から既存APIを使い回す可能性。個々のTable handlerは未確認。

UNKNOWN：ローカル現行HEADのTable内部、再生UI owner、最小barの可否、hide／collapse時のsession・pending、KEY／History、実Browserでの表示品質。

**NEXT：** `animation-table-popup.js`現行ローカル版から局所Ledgerを取得し、WebSOLが研究07のA/B/Cを再評価する。今回もproduction・docs正本・WPは変更しない。
