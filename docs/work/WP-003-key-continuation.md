# WP-003 — KEY確定後の連続編集

## Goal

Layer Transformを閉じずにKEYを確定し、矢印/strip wheelで同じClipの次Frameを編集できる。前作業のpanel消失を解決する。

## Scope

読む: [Transform session](../ARCHITECTURE.md#transform-session)、[F-004](../AUDIT.md)。
変更可: `tegaki_work/system/layer-system.js`、`system/layer-transform.js`、`ui/animation-table-popup.js`のbridge/session箇所、必要時のみ`ui/keyboard-handler.js`と`ui/ui-panels.js`のV同期、関連実行型verifier。
新しいKEY/schema、全Popup分割、WARP UI、原画bake品質、旧履歴の巻戻しは禁止。

## Contract

- LayerSystemが入力session、PopupがClip KEY/Timeline Historyを所有する既存同期adapterを維持。
- pendingは淡色丸。明示確定後は濃色丸/設定済み表示、History一件。
- 未変更確定とFrame移動は新しいHistoryを作らない。
- 未確定中のFrame strip移動は現行どおり拒否し、先にKEY確定を促す。暗黙commitへの変更は別判断。
- 移動は同じClip内、通常wheelはCAFを作らない。SOURCEでstripを出さない。

## Tasks

1. 2Layer/2Frame以上のCAFで再現。commit→finish→resumeのactive ID、working target集合、adapter begin reasonをdebug限定で一回捕捉。
2. 実際の失敗原因へ限定補修。根拠なしのrAF再試行や全state再初期化で覆わない。
3. 失敗経路もpanel/toolbar/Keyboard/Camera V/sessionを一貫させる。既存event送受信を全検索してpayloadを維持。
4. 実production経路を呼ぶ回帰を追加。関数名のsource assertだけで再入場成功と判定しない。

## Acceptance

- 変形→KEY確定後、同Frameでpanelとhandlesが維持され、再操作可能。
- 設定済みdot/Frame表示が一致し、Timelineは対象internal Layer行だけへ単色丸。
- prev/next/wheel、Clip両端、兄弟Layer非干渉を確認。
- Escape、Table close、V再入力、失敗したbeginで幽霊session/toolbar状態なし。
- 一回のKEY確定はHistory 1、Frame移動/入場は0、Undo/Redoとsave/reopen後KEY一致。

## Verification

```powershell
node tegaki_work/build/development-harness.mjs test transform
node tegaki_work/build/development-harness.mjs test ui
```

変更JS構文/build、Browser実操作、console、History件数を記録。前作業の「F2 commitでpanel消失」が修正後再現しないことを示す。

## Stop

Frameを跨ぐ新しい永続session、暗黙KEY、保存正本の移動、既存KEY消去が必要なら根拠を整理。異なるUI案を修復へ混ぜない。

## Completion

原因と修正、実行型回帰、上記Browser結果、未確認範囲をleadが確認。最終の操作感はOwner受入として別記する。

### 2026-09-06 調査・限定補修の証拠

- 開始HEAD `743ce53a`とWP-002追補を保持。途中のOwner commit後は`da092c9f`を確認。下記補修もこのcommitへ取り込まれ、その後verifierを追補した。
- 再入場拒否時に`layer:transform-exit`が出ない経路を、production continuation methodを実行する隔離host回帰で再現（通知件数 actual=0 / expected=1）。補修後は1件。成功済みKEY/Historyを保持し、元のtarget/confirmedを通知。UIControllerも同eventでV buttonを解除する。
- `verify-clip-transform-continuation.mjs`: commit成功、no-op、pending中移動拒否、移動時History 0、拒否時History保持・再試行なし、production UI listenerによるtoolbar解除を確認。adapter/History/rendererはhost mockでありBrowser統合とは区別する。
- Transform 12/12、UI 45/45、History 5/5、effect-target-conflicts、変更JS構文、Vite build成功。buildはTemp出力、dist不変。既存util externalization/chunk警告のみ。
- 修正前後の新規正常Raster（stroke＋複製の2Layer、2Frame CAF）でF1/F2のKEY確定は各History +1。panel/handles維持、対象internal Layer行だけの丸、prev/next/wheelの同Clip内移動を確認。入場/Frame移動はHistory不増。BrowserはCodex IAB、修正後1280×720、canvas 400×400。DPRは未計測。
- debug診断でF1/F2のbegin成功、active/working ID一致を捕捉。初期の「resume拒否がpanel消失の原因」という推測は、この正常Rasterでは成立しなかった。
- **実機で捕捉したpanel消失の経路**: KEY確定後に`EmergencyRecoveryStore._trySave → performSave → ProjectManager.exportProject → _commitActiveLayerTransform → LayerSystem.exitLayerMoveMode`が到達。exit optionsは`{deferredForBusyIndicator:true, source:'project-save'}`。直前のresumeは成功し、Keyboard/V/bridgeがtrue、同じLayer/Frameだった。自動保存が後からlive sessionを終了している。
- 診断時刻 2026-09-06 08:22 UTC頃。Layer ID末尾`gkxuutql8`、index=2、F2。terminal payloadは`confirmed:false, cancelled:false, target:'clip-layer-transform-key'`。終了後Keyboard/V/bridge=false。未確定状態で自動保存が入ると、Escape前にHistory +1になる場面も観測した。
- `build/wp003-browser-diagnostic.html`は独立診断入口。production class/methodをwrapperで観測し、ログは`TEGAKI_CONFIG.debug`配下。通常index/configには診断変更を残していない。
- 新規V入場→変形→EscapeはHistory 0、V終了を診断で確認。KEY後の再現には自動保存のタイミングが関係する。Undo/Redo・save/reopen・失敗beginの実機注入・Owner受入は未完。

### Scope追加 — Owner承認済み（2026-09-07継続）

Ownerが追加改修を許可。ProjectManagerの保存前確定を迂回せず、次の限定変更を実施する。

- 追加file: `tegaki_work/system/emergency-recovery-store.js`と関連実行型verifierだけ。
- `_trySave`と`performSave`の既存描画中延期条件へ、activeなTimeline Transform sessionを追加。`getActiveTransformEditTarget()`と既存`isTransformTimelineKeyTarget()`で判定する。
- `force !== true`の通常自動保存だけ、`_pendingSave=true`と既存retryへ戻す。V終了後に確定済みstateを自動保存する。
- 手動save、export、pagehide/visibility-hiddenのforced checkpoint、SOURCE保存処理、schema、KEY確定規則は変更しない。WP-004や未確定編集一般のterminal設計へ広げない。
- 注意: Vを長時間開いたままだと、その間の周期checkpointは古いままになる。forced checkpointは現行どおりsessionを終了し得る。この区別も受入条件へ明記する。
- 検証: 実RecoveryStoreの`_trySave`/`performSave`でV編集中のexport呼出0、V終了後1、pending保持、既存描画延期とforced経路不変。Browserで周期保存間隔を跨いでF1/F2 KEY継続、cancel/no-op 0、手動save/reopen・Undo/Redoを確認する。

RecoveryStoreの両入口へ延期条件を実装。`verify-clip-transform-recovery.mjs`は実クラスでroot/個別Layerの延期、pending保持、終了後保存、forced保存不変を確認。既存recovery scheduling/settings回帰もpass。Browserで周期を跨ぐ確認は継続中。

Owner追報: 立上げ/編集中にもV自動解除が多い。Folder選択で子2/3の一括変形にならず代表Layer2だけを操作し、KEYも設定できない（添付F11画像）。自動保存補修の後にFolder routingを調査する。別の保存正本や未承認のFolder KEY schemaを作らず、既存経路との差を確定してから補修範囲を整理する。
