# Phase 7p — Motion Easing Clipboard

更新日: 2026-08-12  
担当: SOL / XHigh（Gate・pure契約・review）、限定UI adapterはLUNA / MAXまたはSOL  
状態: CLOSED — Gate 0 `GO`、Stage A / B、SOL review 1=`A`、2026-08-12 SOL技術close。Owner制作確認は別紙で追跡

## 1. 目的

Phase 7oの既存Motion Easing正本を維持したまま、現在segmentの`interpolation / easing`だけをコピーし、現在keyまたはCtrl / Cmd複数選択Motion keyへ原子的に貼り付ける。Motion値clipboardとは別のruntime tagged payloadとし、position / scale / rotation / opacity / blendを上書きしない。

## 2. Gate 0

判定: `GO`

- 保存正本は既存`ClipInstance.transformKeyframes[].interpolation / easing`だけで、新しいProject / History schemaは不要。
- 現行`motion-key-clipboard.js`はMotion値を含むため再利用せず、`kind: tegaki-motion-easing`の別payloadに分離する。
- Phase 7oの複数選択解決、terminal拒否、`updateClipTransformKeyframesFromExternal()`による1 Timeline Historyを共有できる。
- UIは既存`EASING CURVE` popup内のCOPY / PASTEへ限定し、Animation Table headerやCLIP MOTION主headerを増やさない。

## 3. Stage A — pure clipboard

- payloadは`kind / version / interpolation / easing`だけを持ち、source Clip / Frame、preset名、Motion値を持たない。
- HOLD / LINEAR / custom cubicを正規化し、HOLD / LINEAR貼付では古いcurveを除去する。
- N key貼付は1件でもterminal、missing、invalid payloadなら全体を非mutation拒否する。
- target keyのMotion値と対象外keyのobject identityを維持する。

## 4. Stage B — 限定UI adapter

- EASING CURVE popupへCOPY / PASTEを置く。COPYは右区間を持つ現在segmentだけ、PASTEは現在keyを含むMotion複数選択または現在keyへ適用する。HOLDはcurve編集を無効のまま維持し、popupをread-only表示してCOPY / PASTEだけ許可する。
- clipboardはruntime fieldだけに保持し、Project save / reload、Timeline Historyへ含めない。
- paste成功は既存`updateClipTransformKeyframesFromExternal()`へ一度だけ渡す。再生中、terminal、clipboard空、no-opではHistoryを増やさない。

## 5. 非対象

- Motion値clipboardのpayload変更・統合。
- system clipboard、Clip間永続clipboard、preset名保存。
- Graph編集、Motion Path、Bounce / Elastic / Loop、overshoot、parameter別easing。
- Warp / Bone / Part keyへの適用。

## 6. 検証

- pure verifier: HOLD / LINEAR / custom cubic、複数key、値維持、terminal混在、missing、別tag、非mutation。
- UI verifier: 専用runtime field、COPY / PASTE、専用source、複数選択経路。
- 変更JS / mjsの`node --check`、全`verify-*.mjs`、`npm.cmd run build`。
- Browser: custom curve copy →別key paste、複数key paste、Motion値不変、Undo / Redo、terminal拒否、console error。

## 7. close条件

Stage A / BとSOL reviewを通過すれば技術close可能。Owner制作確認が未実施の場合は`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`へ項目を追加して分離する。

## 8. 実装結果

- `motion-easing-clipboard.js`へMotion値を含まない`tegaki-motion-easing` version 1 payloadと、原子的な複数key貼付を追加した。HOLD / LINEAR / custom cubicを正規化し、対象keyの全Motion値と対象外key identityを維持する。
- EASING CURVE popupへSetup青のCOPY / PASTEを追加した。HOLDはcurve入力をread-onlyのまま維持し、右区間を持つ場合だけclipboard操作を許可する。
- BrowserではHOLD copy、単一貼付、1 History、Undo / Redo、Ctrl複数選択、terminal混在拒否、console warning / error 0件を確認した。実操作中に見つかった「HOLD編集不可がCOPYも無効化する」問題は、read-only popupを許可する限定修正で解消した。
- 変更JS / mjsの`node --check`、全57 verifier、`npm.cmd run build`を通過し、`dist/` / `node_modules/.vite/`の生成差分だけを清掃した。

## 9. SOL review 1

判定: `A`

保存schema、Motion値clipboard、sampler / preview / export、Graph、Warp / Rigへ波及せず、tagged payload、atomic rejection、1 History、HOLD境界、UI semanticがPhase契約内に閉じている。追加修正なしで技術closeする。Owner制作Projectでの長尺CAF、Clip間copy、pen / touchは`tegaki_work/OWNER_VERIFICATION_BACKLOG.md`で追跡する。
