# WP-036 新RIG素材影響マップ 実装結果

状態: TECHNICAL COMPLETE / Browser・Native visible・Owner acceptance UNVERIFIED。実装担当の自己承認は行わない。

## 対象と境界

- 開始確認: `main` / `4760db9c16f2af50345916381d45559cec7b1733`。既存のdirty差分は保持した。
- `influence-map.js` は `mesh-profile.mjs` のprofile・source order・UVだけを読み、原画像URLをSVGへ表示する編集器ローカルの派生view。変形後頂点、heatmap補間、skinning evaluator、server/API/native pose変更は追加していない。
- `WeightEditorController.getSelectionView()` がconfirmed/draft/raw/valid/selectedの単一派生viewを提供する。選択用 `selectVertex()` は入力値を変更せず、focus/選択だけでdraft・compile・save・Historyを開始しない。
- `editor.js` は `imageUrl`、`selectionSpace: source-uv`、`selectionProfile`、`selectedEndPercent`、`selectedWeightValid`、`weightDraftActive` をruntime-only snapshotへ投影し、画像世代tokenとbusy/pending/disposeの無効化を接続した。
- `editor.html` は既存native canvas面と分離した360px以内のsource-map、4/9点ボタン、End（橙）/Root（えんじ）凡例、未適用・未確定・native確認済み説明を追加した。
- `server.mjs` の変更は `/influence-map.js` のstatic route一件だけ。既存API/CLI/health/security/saved経路は変更していない。
- 実行中の共有RIGプロセス、Ownerプロセスは停止・再起動・API mutationしていない。新規のWP036検証出力は`wp036` cacheへ限定した。関連回帰verifierは既存の契約どおり各自のbounded evidence出力を更新し得るが、WP036実装の保存正本にはしていない。

## 実装側の限定検証

`node tegaki_work/build/verify-rive-influence-map.mjs`

- 初回報告後の司令actual-editor監査補正を反映し、`PASS (checks=46)`。
- quad/grid3全点のsource index/UV、300×180異方画像、source画像URLの再bind抑止、stale load、busy/pending相当の無効化、dispose/listener解除を検証した。
- click/Enter/Spaceの同一点選択、入力focus、focusだけでdraftが始まらないこと、raw `5`保持、空欄保持、invalid選択の`未確定`表示、profile派生viewを検証した。
- `deriveInfluenceSnapshotFields()`をeditorの実snapshot経路へ組み込み、current WeightEditor viewをspread済み旧snapshotより優先するよう修正した。first input、quad→grid3 draft、invalid、Discard、Apply、load、明示null/falseを実controller派生viewで回帰した。
- profile再作成前にSVG groupのclick/keydown listenerを解除する専用所有へ分離した。quad/grid反復でlistener数を固定し、旧group callback=0、新group callback=1、同profile syncのDOM保持を検証した。
- 見出しを`素材上の点（変形前）`へ変更し、SVG内は短い日本語位置ラベルだけに整理した。full internal name/比率はボタン・選択欄・ARIAへ集約し、表示用marginと元UV viewBox属性でedge clippingを避けた。
- 追加監査で確認されたstatus残留を修正し、current viewの確定・未適用draft・invalidを`imageReady`後の各syncで再表示するようにした。Apply/Discard/seek後に未適用draft表示が残らないこと、invalid draftが未確定と表示されることをcontroller回帰した。専用verifierは`PASS (checks=43)`。
- 画像error状態をimage key単位で保持し、同じ失敗世代の再syncでは「表示できません」かつdisabledを維持し、新しいimage keyだけ「読み込み中」へ戻すようにした。stale load/token/dispose境界は維持し、この遷移を実controllerで回帰した。専用verifierは`PASS (checks=46)`。
- `native=UNVERIFIED`、`browser=UNVERIFIED`はこのverifierの境界であり、失敗ではない。

## 回帰・build evidence

- `node --check`（influence-map / weight-editor / editor / server / WP036 verifier）: PASS。
- `node tegaki_work/build/verify-rive-editor-grid.mjs`: PASS、96 checks、native PASS、pixels PASS、Browser UNVERIFIED。
- `node tegaki_work/build/verify-rive-editor-weights.mjs`: PASS、63 checks、native/Browser UNVERIFIED。
- `node tegaki_work/build/verify-rive-editor-playback.mjs`: PASS、48 checks、native/Browser UNVERIFIED。
- `node tegaki_work/build/development-harness.mjs check`: PASS（94 documents / 362 local links / 25 proposals / 27 packages）。
- `npm.cmd run build`（`tegaki_work`）: PASS（Vite build完了）。既存のchunk-size warningのみ。
- `development-harness.mjs list/test transform`: list PASS。testは20件中19件PASS、`verify-transform-preview-capture.mjs`だけ既存 `shape-tool.js:356 paint.append is not a function` でFAIL。WP036の対象file外で、今回の差分との因果は確認できないRELATED/UNRELATED候補として司令監査へ返す。Browser/Owner受入の代替にはしない。
- `git diff --check`: errorなし。既存のWindows改行警告のみ。

## 未検証階層

- Browser: 実editor runnerでの点click/Enter/Space、入力focus、profile 9点→四隅の無効点復元、再読込同期、CSS縮小時の横overflow、再生中の画像再fetch=0は未実施。
- Native: 選択前後のRGBA/透明1x PNG同値、選択だけでnative pose不変、Apply後だけ公式CLI/native変化は未実施。WP035既存native evidenceは本Sliceの選択受入を証明しない。
- Owner: 実制作受入、通常入口、host frame追加、採用、commit、pushは未実施。

## 生成物

- `tegaki_work/advanced/rive-editor/influence-map.js`
- `tegaki_work/build/verify-rive-influence-map.mjs`
- `tegaki_work/build/wp036-rive-influence-browser.html`
- `tegaki_work/.cache/rive-editor/wp036/wp036-influence-map-verification.json`

