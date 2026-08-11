# Phase 7l — Animation Table / CLIP MOTION UI品質

更新日: 2026-08-11
担当: SOL / XHigh（Gate・review）、限定DOM / CSS実装はLUNA / MAXまたはSOL
状態: OPEN（Gate 0=`GO`、Stage A完了、SOL review 1=`A`、Owner一括確認待ち）

> Phase 7i / 7j / 7kは実装済み・Owner一括確認待ちのままOPENを維持する。本Phaseは各機能の保存正本や受入状態を変更しない。

## 1. 目的

Animation Table headerの幅依存な自動折返しを、意味の明確な二段へ限定整理する。CLIP MOTIONの`RIG` Setup青と`MOTION / WARP` Frame作業橙、Tableの既存操作、wheel三領域、drag、shortcutを維持し、設定から実行へ左から右に読める導線を固定する。

## 2. Gate 0結果

- Table headerのcontrolは`animation-table-popup.js`の一つのtemplateに集約され、eventは既存IDへ接続されている。wrapper追加とDOM順変更だけならEventBus、TimelineModel、History、保存schemaを変更しない。
- header通常wheelは`.anim-table-header`一箇所、Lane列 / Timeline grid wheelは`.anim-table-viewport`内の領域判定で分離済み。二段wrapperを増やしてもevent target契約を維持できる。
- header dragはbutton / input / labelと既存control groupを除外している。空白部だけをdrag surfaceとして残せる。
- `is-narrow`はpanel幅760px以下で付与される。明示rowをflex-wrap可能にし、closeを右上固定すれば既存最小幅460pxを維持できる。
- Table既定高は直前の軽量監査で240pxから266pxへLane一行分拡張済み。header二段化でpanel全体をさらに増やさず、viewportが残ることをBrowserで確認する。

判定は`GO`。DOM / CSS / UI preference既定高の既存移行だけに限定し、Motion Graph、TimelineModel、key、preview / exportへ広げない。

## 3. Stage A — 明示二段header

1. 上段は`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`とし、設定から実行へ左から右に並べる。
2. 下段は`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`とし、表示設定からclip操作、破壊操作へ進める。
3. 既存controlのID、class、title / aria、event listenerを維持する。新しいcommand、EventBus、shortcut、保存stateを追加しない。
4. `anim-table-header-row`は固定layout classだけとし、runtime stateを持たない。狭幅では各row内だけをwrapし、行の意味順を跨いで並べ替えない。
5. Setup青 / Frame作業橙、disabled / hover / focusは直前のsemanticを維持する。

## 4. 非対象

- Motion Graph / Motion Path / Easingの追加。
- Timeline key、CAF配置、History、Project / Recovery、preview / playback / onion / Bake / exportの変更。
- CLIP MOTION内部のRIG / MOTION / WARP control再編。
- Tableの自由toolbar custom、panel resize仕様変更、mobile bottom sheet。
- 既存classの一括rename、inline styleのCSS移行。

## 5. 受入条件

- 1280px相当で明示二段、1024px相当の`is-narrow`でも意味順を維持し、controlがTable外へはみ出さない。
- Table高266px、下端位置、close / reopen、resize保存を維持する。
- header通常wheelはTimeline zoom、number input / onion固有wheelは既存動作、Lane列wheelは上下、Timeline grid wheelは左右。
- header空白drag、button / input上でdragしない契約を維持する。
- CLIP MOTION open、RIG / MOTION / WARP tab、Setup青 / Frame作業橙を維持する。
- console warning / error 0件、全verifier、node check、buildを通過し、生成差分を残さない。

## 6. 停止条件

- 二段化にmodel / History / save state追加が必要になる。
- 既存wheel三領域かheader dragを別実装へ置換しないと成立しない。
- 460px幅で三段以上への自然wrapを許しても操作不能になる。
- Table viewportが実用的なLane表示高を失い、panel全体をさらに常設拡大する必要がある。

## 7. Stage A結果 / SOL review 1

- headerをruntime stateを持たない`playback` / `clip`の明示二段wrapperへ分け、既存control ID、listener、shortcut、model / History / save stateを維持した。
- 上段は`FPS / FRAMES → SCOPE → LOOP / END / IN / OUT → PREVIEW / onion → Play`、下段は`Timeline zoom / LIB → DURATION → CLIP MOTION → copy / paste / group / delete → close`で固定した。
- Browser 1280px相当ではpanel `960×266px`、header約64px、viewport約202pxで二段に収まり、狭幅実操作ではpanel `460×266px`、row内wrap、controlはみ出し0件だった。
- 実wheelでTimeline zoom `80% → 87%`、close / reopen、resizeによる`is-narrow`遷移を確認した。favicon 404を除くapp console warning / errorは0件。
- `verify-animation-table-header-layout.mjs`を追加し、二段順序、主要ID一意性、狭幅wrap、header wheel listener、既定高266pxと旧260 / 240px設定移行を固定した。
- 変更JS / verifierの`node --check`、全51 verifier、`npm.cmd run build`を通過し、`dist/`と`node_modules/.vite/`の生成差分を残していない。

SOL review 1は`A`。Phase 7i / 7j / 7kと同じOwner一括確認待ちとしてOPENを維持し、Owner明示受入前にcloseしない。
