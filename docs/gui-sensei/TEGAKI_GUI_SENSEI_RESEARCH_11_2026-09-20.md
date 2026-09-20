# TEGAKI GUI先生ツール研究 11 — 既存Frame Indicator発見／Time UI再利用の前提変更

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
保存先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_11_2026-09-20.md`  
接続：06（時間軸と右側の責務）→07（三つのTime UI案）→08–10（既存実装の部分棚卸し）。01–10は上書きしない。  
調査のコード基準：公開GitHubの**固定commit `b5e38265b250d4d7ddfc085c761709a6c42238bd`**。ローカル現行HEAD・未commitのSingle Right Workspace Frameを検証したものではない。実Browser操作も未実施。

> **今回の新規到達：`animation-table-popup.js` 以外の既存ファイルから、すでに「Frame前後移動／現在Frame／再生／オニオン／他レーン参照」をまとめた `frame-indicator` がLayer Panel内に存在することを確認した。** 第07回の独立Time Strip新設案やTable header温存案を比較する前に、この既存部品の配置・生存・安全性を調べる必要がある。Table本体を読めない状態が続いても、「何も分からない」わけではなくなった。

## 1. 実コードで確認した表示部品

固定commitの `tegaki_work/ui/timeline-ui.js` は、旧TimelineのUIクラスを含む一方、Layer Panelの先頭に別の `frame-indicator` を生成する。

`createLayerPanelFrameIndicator()` のDOM構成：

| DOM / control | 役割・イベント先（確認できた範囲） |
|---|---|
| `#layer-panel-container .frame-indicator` | Layer Panel先頭へ挿入されるFrame操作一式。単なる旧Timeline popup headerではない。 |
| `#frame-prev-btn` / `#frame-next-btn` | `goToPreviousFrameSafe()` / `goToNextFrameSafe()` へ。wheel操作も備える。 |
| `#frame-display` | `F{currentFrame+1}` または `NO FRAME` 等。wheelで前後移動。 |
| `#frame-play-toggle-btn` | `AnimationTablePopup.togglePlayback()` に直接委譲。表示icon/labelはTableの `isPlaying` に応じて更新。 |
| `#frame-timeline-onion-btn` | Tableのonion-skin操作へ委譲。 |
| `#frame-lane-reference-btn` | Tableの他レーン参照操作へ委譲。 |

出典：[`timeline-ui.js` L799–879](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L799-L879)、[L882–953](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L882-L953)。

**重要な設計帰結：** 再生・現在FrameをTable外へ残すという外部先生ツールからの発想は、TEGAKIの固定commitではすでに部分的に実装されている。新しい「もう一本の再生バー」を追加すると、これと重複し得る。現行productionでこのindicatorが有効か、表示位置が妥当かを先に見る。

## 2. Tableを閉じた状態を既に想定したコード

`updateLayerPanelIndicator()` は `animTable.isVisible` だけでなく、Tableの `model` にtrackかclipAssetがあるかを調べ、`isAnimationTableVisible || hasAnimationContext` でindicator表示を決める。Tableが閉じていてもanimation contextが残れば `is-table-closed` classを付ける。TableのcurrentFrame、lane-only selection等によってFrame文字列と前後ボタンの状態を変える。

参照：[`timeline-ui.js` L882–959](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L882-L959)。

ただし**コード上でindicatorを生成・表示設定することと、現行GUIで常に到達可能なことは別**。indicatorは `#layer-panel-container` の子である。Owner判断で進めたSingle Right Workspace FrameではTransform中に通常Layer Panelを非表示にする設計のため、ローカル版でも同じDOMならTransform中はこのindicatorまで見えなくなる可能性が高い。ローカルDOMを未確認なので実際の表示を断定しない。

またファイル冒頭のコメントには「Table表示中だけ有効化」とあるが、上記実装条件は「Tableが閉じてもanimation contextがあれば表示」。**コメントより実装分岐を優先**して記録する。

## 3. UIControllerと旧Timelineの関係

`ui/ui-panels.js` の `toggleAnimationTable()` は、旧 `window.timelineUI` が表示中なら先に `hide()` し、その後 `PopupManager.toggle('animationTable')` を呼ぶ。Table開閉後のtool表示も更新する。

`core-engine.js` は `timeline-ui.js` を読み込み、 `TimelineUI` を初期化して `window.timelineUI` に置く一方、`AnimationTablePopup` をPopupManagerへ登録・初期化する。したがって「旧Timelineは画面で使わない」と「そのファイル内のFrame Indicatorまで不要」は同義ではない。

参照：[`ui-panels.js` L80–106](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/ui-panels.js#L80-L106)、[`core-engine.js` L264–276](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/core-engine.js#L264-L276)、[L360–378](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/core-engine.js#L360-L378)。

旧Timelineのheaderにも `#play-btn` / `#repeat-btn` / `#playback-time` 等があるが、`timelinePanel.style.display = 'none'` で生成され、新Tableへの切替操作も旧UI側にある。**旧Timeline headerをそのまま新しいTime Stripの基準部品に選ばない。** 現行で有効なIndicatorと現行Animation TableのPlaybackを先に追う。

参照：[`timeline-ui.js` L245–340](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L245-L340)、[L530–557](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L530-L557)。

## 4. 編集安全性に関する未解決：Frame前後移動のfallback

`goToPreviousFrameSafe()` / `goToNextFrameSafe()` は、最初に `goToAnimationTableFrameByDelta(±1)` を試す。これはTableの `model.playback.currentFrame` が数値なら `animTable.moveTimelineFrameByDelta(delta) === true` を返す。

**その呼び出しが `false` を返した場合は旧 `animationSystem` のFrame移動経路へ落ちる。** 戻り値 `false` が「Table非対応」なのか「pending等により移動禁止」なのかは、Table本体の実装が未取得なので分からない。もし後者を含むなら、表示位置だけの改修でもガード迂回を起こし得る。**脆弱性や現行バグと確定しないが、実装・再利用前の最優先Gateとする。**

参照：[`timeline-ui.js` L688–734](https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/timeline-ui.js#L688-L734)。

別の安全上の境界：`#frame-play-toggle-btn` のclickは `togglePlayback()` に直接入る。Table収納／ANIMATE pending時にそのterminalがどう扱うかはTable本体と実Browserで確認する。見た目を移設するために新しいPlayback modelや独自のFrame変更を追加しない。

## 5. 第07回のA/B/C案を更新：D＝既存Indicatorの位置再検討

| 比較案 | 今回の新しい前提 | 採用前の確認事項 |
|---|---|---|
| A：独立Time Strip新設 | 既存Indicatorとの二重化リスクが判明 | 新しい表示面が必要な固有理由はあるか。 |
| B：Table Headerだけ残す | 表示用でなくTable編集機能との結合を確認する必要がある | DOM owner・Popup hideと縮小の区別。 |
| C：Canvas下端chip | Canvas遮蔽の懸念は残る | QTP、Overlay、pen hit areaとの競合。 |
| **D：既存Frame Indicatorを再利用／再配置** | `timeline-ui.js` に実物が存在する。Table閉鎖時もanimation contextを想定。 | Layer Panel非表示のTransform時にどこへ置くか。frame fallbackのguard、安全なevent sink、現行DOM/CSS。 |

Dも**採用決定ではない**。「もうあるから動かせばよい」ではなく、既存イベント先・状態同期・所有権と安全性が保てることを条件とする。特に右Frameへ寄せるとTransform時の狭い172px操作面／KEYと取り合うため、時間操作は右Contextを増設するより下部に寄せる案を同じ条件で比較する。

## 6. 今回のCapability Ledger更新

| 項目 | 判明したこと | 残るUNKNOWN |
|---|---|---|
| 再生操作のTable外既存部品 | `#frame-play-toggle-btn` があり、Tableの `togglePlayback()` を呼ぶ | 現行ローカルでの視認性、pendingの返答、Table側headerとの重複 |
| 前後Frame・現在Frame | `#frame-prev-btn`／`#frame-next-btn`／`#frame-display`。Table経路＋legacy fallback | fallbackがguard拒否を区別するか、異なるFrame modelの同期 |
| Table閉鎖時の生存 | modelにanimation contextがあれば `is-table-closed` | CSS・Frame置換・narrow viewportで見えるか |
| 右Frameとの衝突 | Indicatorは `#layer-panel-container` の子 | Transform中のhide/inertと時間操作の到達性 |
| 旧Timelineとの二重性 | `timeline-ui.js` は旧Timelineと現行indicatorを同じclassで作る | 現行bootstrapや将来整理でIndicatorごと消さないか |
| Table固有header | 依然Table本体が未取得 | 既存再生barの配置・展開・scroll／drag／resize |

## 7. Luna MAX：次の一回だけの局所読取Card（提案、未実行）

**MODEL:** Codex Luna MAX  
**MODE / TASK TYPE:** READ-ONLY / Targeted Capability Audit  
**REPOSITORY:** `D:\GitHub\tegaki`  
**BRANCH / EXPECTED HEAD:** 現行branchとHEADを最初に報告。研究の基準は公開 `b5e38265...` だが、ローカルは自動一致と仮定しない。  
**EXPECTED WORKTREE:** 未commitのGUI Frame変更があり得る。`git status --short`を読み、変更・移動・stash・reset禁止。  
**OWN FILES:** なし。研究01–11、他docs、source、testsを変更しない。  
**DO-NOT-TOUCH:** History/CAF/KEY model、Animation Table、Transform、CSSを含む全productionファイル。

**唯一の責務：** 既存 `frame-indicator` の「Table閉鎖・Transform右Frame・pending」での生存とイベント先を局所的に確定する。巨大な `animation-table-popup.js` は全読込・全文転記せず、`togglePlayback`、`moveTimelineFrameByDelta`、`show`、`hide`、`updateLayerPanelIndicator` の定義・呼出・guard部分のみを前後60行以内で抽出。直接の別helperが不可欠な場合だけ最大3関数追跡。`ui/timeline-ui.js`、`ui/ui-panels.js`、右Frame関連のDOM/CSSを必要範囲だけ読む。

**証拠表（必須）：**

| 状態 | Indicator可視・到達 | Frame表示の正本 | 前後Frameの実際のsink/guard | 再生のsink/guard | Table重複control |
|---|---|---|---|---|---|
| Drawing／Table開 | | | | | |
| Drawing／Table閉（animation context有） | | | | | |
| Transform SOURCE／Table閉 | | | | | |
| Transform ANIMATE pending／Table閉 | | | | | |
| Transform ANIMATE pending／Table開 | | | | | |

各セルを **PROVEN（file:line またはBrowser state）／UNKNOWN** で埋める。推測でPASSにしない。可視/到達の最終確認はBrowserを用い、環境不能ならUNKNOWN。pointer/keyboardからの正常な操作と、pending中の移動拒否を分ける。KEY確定／Historyの既存Luna Edit Boundary Gate結果がないなら「Gate未報告」と明記し、勝手に追試・結果生成しない。

**予算:** ファイル本文の探索は上記周辺とTable定義5つまで、tool呼出最大15、Browser確認1 pass（環境障害の再試行は最大1回）、全suite実行なし。  
**報告:** 事実最大8件、未確定最大5件、比較案A/B/C/Dの実現条件各1文、次の作業提案は最大1件。  
**停止:** READ-ONLYでCommanderへ報告してSTOP。実装・commit・push・自動次Card・subagentは行わない。隣接課題は報告のみ。

## 8. WebSOLへの次の判断入力

Luna結果を受けた後、まず「既存IndicatorをTable外でも使える操作入口として残し、配置だけ変える」「Tableのheaderを残してindicatorを統合する」「両方を現状維持し最小整形する」を、**同じ機能数・同じguard・同じCanvas占有**で比較する。Time UIはKEYの第二正本にならない。

今回の研究で実装Cardは発行しない。第12回で進めるなら、Lunaの証拠が返るまでは動画系先生ツールの視覚資料（LYRICAの実画面／再生位置・Tool density）へ戻る。`animation-table-popup.js`の全体取得失敗を繰り返して研究01–10と同じ未確定の結論を再生成しない。
