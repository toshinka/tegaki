# WP-037 新RIG 追従率数値欄の可読性 実装結果

状態: 限定CSS実装・静的検証 COMPLETE。Browser寸法/操作、Native、不変画素、Owner受入は未検証であり、実装担当の自己承認は行わない。

## 対象と境界

- 開始・終了確認: `main` / `4760db9c16f2af50345916381d45559cec7b1733`。既存のdirty差分と他者の未追跡ファイルは保持した。
- `tegaki_work/advanced/rive-editor/editor.html` のlocal `<style>`だけを変更した。weight row内のinputとEnd/Root説明を1列に積み、説明を折り返し、inputへ`min-width: 64px`を与えた。
- quadの`.weight-grid` 2列、grid3の3列、hidden行、既存の色・focus・選択・disabled規則は維持した。markup、id、testid、ARIA、input type/range/value、イベント、JS/controller/model/runtime/server/native/save/Historyは変更していない。
- 既存の `input[type="number"] { width: 100%; min-width: 0; }` と組み合わせ、各列のinput border boxが説明のauto幅で圧迫されない配置にした。grid3の狭い列では`output`が`overflow-wrap:anywhere`で折り返す。
- 実行中の共有RIGプロセス、Ownerプロセス、18729/5174/18840等のserver/session/saved/native状態は停止・再起動・mutationしていない。

## 実装側の限定検証

- `node tegaki_work/build/verify-rive-editor-weights.mjs`: **PASS**（63 checks、native=UNVERIFIED、browser=UNVERIFIED、cache=cache-valid）。
- `node tegaki_work/build/verify-rive-editor-grid.mjs`: **PASS**（96 checks、native=PASS、pixels=PASS、browser=UNVERIFIED）。
- `node tegaki_work/build/verify-rive-influence-map.mjs`: **PASS**（46 checks、native=UNVERIFIED、browser=UNVERIFIED）。
- `npm.cmd run build`（cwd=`tegaki_work`）: **PASS**。Vite build完了。既存のchunk-size warningとbrowser externalization warningのみ。
- `git diff --check`: **PASS**。既存のWindows改行変換警告のみ。
- `node tegaki_work/build/development-harness.mjs check`: **FAIL (RELATEDではない既存文書状態)**。`docs/STATUS.md`に `work/WP-030-manga-tools-follow-through.md#current-slice--制作時のフォルダ順序縦書きcanvas選択2026-10-05` のanchorが無いという出力であり、本Sliceの対象外ファイルは修正していない。

## 未検証階層

- Browser: controls内幅228pxおよび360px viewportのquad4/grid9各列の実border box（各64px以上）、0/5/50.2/100、空欄caret、spinner、実際のEnd/Root折返し、横overflow、focus/選択/disabledは未実施。
- Browser操作: 点選択→input focus→raw `5`/空欄→Discard/Apply、focusだけでdraft/compile/save/History/native poseが変わらないことは未実施。
- Native/画素: RGBA/透明1x PNG/source不変と、Apply時だけ公式native経路が変化することは未実施。
- 液タブ/性能/Owner: 未実施。上記の静的verifierやbuildはこれらの受入を代替しない。

## 生成物

- `tegaki_work/advanced/rive-editor/editor.html`（local CSSの限定差分）
- `tegaki_work/.cache/rive-editor/wp037/wp037-weight-readability-verification.json`

