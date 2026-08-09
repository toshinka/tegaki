# Phase 6z — 緊急復旧の発火制御と保存二系統Gate

更新日: 2026-08-08
担当: Sol High / XHigh（設計・実装・最終監査）

## 目的

重いProjectで入力queueを塞ぐことが実測済みのEmergency Recoveryについて、保存shapeや復元正本を変えず、Ownerが操作中の記録有無・最短間隔・tab非表示時の記録を設定できるようにする。

通常Project保存（Ctrl+S）と緊急復旧（IndexedDB latest）をUI上・設計上で区別し、二つの独立timerが同じProjectを重複serializeする構成は作らない。

## 現状と採否

- `history:changed`は`EmergencyRecoveryStore.scheduleCheckpoint()`へ接続され、既定1秒debounce / 5秒interval後にProject全体をexportする。
- Phase 6e実測では重いCAFのcheckpoint全体が約1.9〜3.8秒、直後のpointer queue待ちが約0.6〜1.0秒だった。
- `自動保存設定UI_実装提案書.md`の設定UI案は採用する。ただし「自動保存」という語を通常Project保存と混同させず、「緊急復旧」と表示する。
- 操作中の定期記録と`pagehide` / hidden時の記録は別設定にする。両方OFFなら自動checkpointは行わない。
- 定期Ctrl+Sは本Phaseで実装しない。現行`ProjectManager.quickSave()`はFile System Access handleが無ければpickerを要し、緊急復旧とは別timerで全Project exportすると遅延・peak memoryを重複させる。

## Slice 1 — 緊急復旧設定

### 設定正本

`SettingsManager`へ次を追加する。

- `emergencyRecoveryEnabled: boolean`、既定`true`
- `emergencyRecoveryIntervalSeconds: 5 | 10 | 30 | 60 | 180 | 300`。初期実装は既定`5`だったが、Owner制作Projectで短周期serializeによる継続遅延を確認したため、Phase 7a close時に既定`60`へ変更した。
- `emergencyRecoveryOnHide: boolean`、既定`true`

設定正本は`SettingsManager`だけとする。`EmergencyRecoveryStore`のruntime fieldは設定を反映した派生状態であり、別の永続正本にしない。

### Store契約

- `configure()`で設定とEventBusを受ける。
- 操作中記録OFFへ切り替えたら、未開始のdebounce / idle / retryをcancelし、pendingを下ろす。
- interval変更は有限の許可値だけを受ける。
- `scheduleCheckpoint()`は操作中記録OFFなら何も予約しない。
- `forceCheckpointSoon({ reason: 'pagehide' | 'visibility-hidden' })`は`emergencyRecoveryOnHide`がOFFなら開始しない。
- forceはdrawing / interval / idle待ちだけを迂回する。master設定を迂回しない。
- 保存成功時だけ既存EventBusへ`emergency-recovery:saved`を発火し、UIへtimestamp / reasonを渡す。Project保存shapeは変更しない。

### UI

Settingsの設定tabに「緊急復旧」を追加する。

- 「操作中に定期記録」checkbox
- interval select
- 「タブ非表示・終了時にも記録」checkbox
- runtime状態（最終記録時刻、記録中／待機中、両方OFF）
- 「Ctrl+SのProject保存とは別。重いProjectでは間隔を長くできる」説明

既存Futaba paletteと共通form classを使い、白・黒・neutral grayやnative tooltipを増やさない。

## 保存二系統Gate（本Phaseでは設計のみ）

将来の通常ファイル自動保存は、次を満たす別Phaseまで実装しない。

1. 一つのdirty revisionをProject変更正本として持つ。
2. 同一revisionのProject exportを一つのsingle-flight coordinatorで共有する。
3. 保存先Aは既存FileSystemFileHandleがあり、permissionが有効な時だけ通常Projectへ書く。handle無しでpickerを自動表示しない。
4. 保存先BはEmergency RecoveryのIndexedDB latest。
5. 通常保存と復旧保存が同時に別々の`exportProject()`を走らせない。
6. failure / cancel / permission lossを別々に表示し、Ctrl+Sの手動保存契約を弱めない。

## Layer Panel診断の扱い

`レイヤーパネル_アニメテーブル階層不整合_診断書.md`は症状の入口として保持するが、次を修正判断とする。

- Table非表示中に`syncWithLayers()`を常時走らせる案は採用しない。Laneは通常Layerと別正本で、初回以降の新規通常LayerをLaneへ自動追加しない現行挙動は意図された移行境界である。
- Layer Panelの階層表示は通常Layerの`currentFrameContainer.children`順と`parentId`、CAF時はClipAsset internal Layerの`parentLayerId`とmirror adapterを監査する。
- 状態を「通常」「Table表示」「Table閉鎖後のCAF編集」に分け、各状態で表示順、active ID、選択ID、working Layer ID、render回数／時間を採取する。
- `LayerPanelRenderer.render()`は現在DOMを全消去・再構築するため、多Layer時の応答悪化候補として計測する。計測前にincremental DOMやvirtualizationへ進まない。
- `addLayerToFolder()`の未使用断定や削除は全call siteと互換APIを再確認してから扱う。

Layer Panelの挙動変更はSlice 1へ混ぜず、監査結果からPhase 7aへ切り出す。

## 維持する契約

- Emergency checkpointの復元正本は既存`projectData`で、thumbnailは`null`。
- 通常Project保存、Album、Hospital、Project JSON shapeを変えない。
- stroke中working Layer表示、preview staging交換とcontainer順、上側Lane前面、Lane / Timeline onion display-only、PSD record順を維持する。
- animation working Layerを保存正本にしない。
- Folder clipping、Motion、WARP、Mesh、Skin、physicsの正本を増やさない。
- 通常LayerとCAF adapter、LaneとLayerSystemを統合しない。

## 非対象

- `exportProject()`の分割serialize / 差分保存
- 定期Ctrl+S本体
- FileSystemFileHandleの永続化
- Lane独立化や`syncWithLayers()`根本変更
- Layer Panel DOMの大幅置換／virtualization
- clipping mask最適化
- Raster Skin / Mesh / IK / WARP拡張

## 検証

- 固定入力で設定default / validation / EventBus反映を確認する。
- 操作中OFFでscheduled idleが残らない。
- interval変更がrate limitへ反映される。
- hidden記録OFFでforce saveを開始せず、ONでdrawing中でもforceする。
- 保存成功eventとcheckpoint shapeを確認する。
- 変更JSへ`node --check`。
- `node build/verify-emergency-recovery-scheduling.mjs`。
- `npm.cmd run build`。
- BrowserでSettings表示、各toggle / interval、reload後設定保持、最終記録表示、console errorを確認する。
- build後に`dist/`と`node_modules/.vite/`の生成差分を残さない。

## 停止条件

- 設定変更だけでProject JSON shape、History、CAF/Lane schema変更が必要になる。
- force checkpointの完了保証に`beforeunload`同期処理や描画blockが必要になる。
- 通常保存と復旧保存のsingle-flightをSlice 1へ混ぜないと安全を保てない。
- Layer Panel修正がLane正本変更や大幅DOM再構成を要求する。

## Close結果（2026-08-08）

- Slice 1を実装し、SettingsManagerを唯一の永続設定正本として、操作中記録、最短間隔、非表示時記録をEmergencyRecoveryStoreへ反映した。
- 操作中記録OFFでは未開始のdebounce / idle / retryをcancelし、callback raceでも非force保存を開始しない。間隔は`5 / 10 / 30 / 60 / 180 / 300`だけを受ける。
- checkpointの`id: latest`、`thumbnail: null`、`projectData`、`reason: auto-checkpoint`を維持し、成功通知だけをUI用EventBusへ追加した。
- Browserで設定表示、OFF、間隔変更、非表示時記録、reload後保持、最終記録時刻、console errorなしを確認した。
- Layer Panel軽量監査では、通常→Table表示→Table閉鎖後CAF→内部Folder＋子Layerの順序とDOM深度が一致した。多階層時の応答悪化は全DOM再構築とclipping全走査を次Goalの計測候補へ送り、Lane常時同期は採用しなかった。
- 定期Ctrl+Sは未実装。dirty revision / single-flight serialize / FileSystemFileHandle permissionを先に固定するGateを維持する。
