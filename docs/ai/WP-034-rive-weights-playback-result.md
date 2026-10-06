# WP-034 Slice A/B — 四隅 weight と native playback 実装結果

状態: **Slice A/B 実装完了 / static・pure/controller PASS / native・Browser・Owner 未受入**。Slice B は native runtime の `seek` を注入する再生スケジューラまでを実装し、実機受入は行っていない。

## Slice B — native playback

- `advanced/rive-editor/playback-controller.js` を追加した。既定は `idle`・loop OFF・autoplayなし。`runtime.seek(progress)` だけを最大30fpsで呼び、RAF chainは常に一本に制限する。状態 snapshot は再生中最大10Hz、開始・停止・pause・終端では即時通知する。Playを終端から押すと0へ戻り、loop OFFは1で終了、loop ONは0へ折り返す。
- `editor.js` は Play/Pause/先頭/終端/loop を接続し、AI snapshotへ `playbackState`、`playbackLoop`、`progress` を追加した。再生tickには画素読出し、PNG化、API、record、Historyを置かず、pause/scene load/visibility/blurとscrub、bone、weight draft/commit、compile、image、save/reopen/cancel、PNG、frame requestの境界で停止して同じprogressのnative frameを取得する。
- `editor.html` は4操作とloop checkboxを追加した。再生部品は `min-width: 0` と `minmax(0, 1fr)` を使い、既存の狭幅制約内に収めた。server static routeは `/playback-controller.js` の1件だけを追加した。
- `build/verify-rive-editor-playback.mjs` はclock/RAF/seek/captureを注入した純粋検証、static配線、loop/終端/停止・stale RAF・30fps・10Hz契約を確認する。`build/wp034-rive-playback-browser.html` はtrustedな手動Play/Pause/先頭/終端/loop/scrub/visibility確認を案内し、synthetic eventを生成しない。

### B司令監査追補への限定修正

- 修正前は clock `0→990→1000ms` の終端で `controller=ended/progress=1` でも注入runtimeが `0.99` のままになり、最後のnative seekが欠けていた。終端だけは30fps capを越えて `seek(1)` を明示同期し、seek失敗時は `ended` を出さず停止するようにした。
- 修正前は stop→start後の旧RAF callbackが世代不一致でも共有 `rafId` を `null` にし、pause後の注入RAF mapに現行一件が残った。callback自身のframe idが現行所有ならnull化する条件へ変更し、旧世代callbackは新chainの所有権を保持する。
- `onPlaybackState` のnative seek後に既存 `boneController.refresh()` を呼び、再生通知（最大10Hz）と停止通知で投影を追従させた。新しい投影計算、PNG/readback、API呼出しは追加していない。
- 追補後の純粋/static verifierは48 checks PASS。実配信 `/playback-controller.js` は司令確認で404の世代が残っているため、Browser/native/Ownerの受入は引き続き **UNVERIFIED** と分離する。

## Slice B 検証

| 検証 | 結果 |
|---|---|
| `node --check`（playback-controller/verify/editor/server） | PASS |
| `node tegaki_work/build/verify-rive-editor-playback.mjs` | PASS (48 checks; fixed cache valid; native/browser UNVERIFIED) |
| `node tegaki_work/build/verify-rive-editor-weights.mjs` | PASS (63 checks) |
| `node tegaki_work/build/verify-rive-editor-model.mjs` / `verify-rive-bone-editor.mjs` | PASS / PASS (54 checks) |
| `npm.cmd run build` (`tegaki_work`) | PASS |
| `node tegaki_work/build/development-harness.mjs check` | PASS (90 documents / 342 links) |
| `node tegaki_work/build/development-harness.mjs test transform` | 20 selected中19 PASS。既存の別lead `shape-tool.js` mock mismatch（`paint.append is not a function`）で1件FAIL、Slice B変更による失敗ではない。 |
| Browser/native runtime・実frame・GPU・Owner acceptance | **UNVERIFIED** |

固定専用 port の既存 server `127.0.0.1:18729`（親司令確認の PID 43016）と product `5174`（PID 16008）は停止・再起動・置換していない。新しい static route の実HTTP receipt、Browserでの trusted操作、native frame一致、狭幅のページ全体 `scrollWidth` は未確認である。BのUI部品自体は幅を増やさない静的制約を持つが、既存の90° sceneとdiagnostics展開による `scrollWidth=414 / clientWidth=345` は残り、ページ全体360px PASSとは判定しない。

## 実装

- `advanced/rive-editor/weight-model.mjs` に、固定 vertex 順、End byte 検証、百分率の一回量子化、Root/End の packed encode/decode を追加した。Root は tendon 1、End は tendon 2、混合値は `indices=513` かつ byte 合計255を要求する。
- `model.mjs` の source生成・限定的な四頂点 parser・snapshot に weight bytes を接続した。既定 `[0,255,255,0]` の既存 source は保存済み source と byte-identical だった。
- `server.mjs` は confirmed source bytes を state の唯一の weight authority として保持し、image/angle/bone compile で省略値を維持する。明示 `body.weights` は CLI 前に厳格検証し、`meta.json` には weight を追加していない。static route は `/weight-model.mjs` と `/weight-editor.js` の二件だけを追加した。
- `weight-editor.js` と `editor.js`/`editor.html` は入力・preset を draft として表示し、Apply だけが既存 `/api/compile` を一度呼ぶ。入力中の raw text（例 `5`）は `5.1` へ即時書換せず、四欄全体の validity を Apply 直前にも検証する。空欄は他欄の入力で復元しない。focusだけではdraft/compile/dirtyを発生させず、selectedVertexだけを観測する。Discard は confirmed snapshot、dirty、native scene を復元する。draft/pending 中は既存 operation/frame/bone を拒否し、operation controls を disabled にする。native load 後の非同期 record が完了するまで `ready` を出さず、Apply の stale/teardown/double guard と AI snapshot の `weightEditPhase`、`weightDraft`、`selectedVertex` を持つ。
- `verify-rive-editor-weights.mjs` と `wp034-rive-weights-browser.html` を追加した。Browser fixture は trusted な手動操作だけを案内し、synthetic input/pointer/keyboard event を生成しない。

## 保存バンドル保全

既存 `tegaki_work/.cache/rive-editor/saved/` は変更せず、開始時に一度だけ `tegaki_work/.cache/rive-editor/wp034-saved-backup/` へ複製した。`manifest.json` に4ファイルの SHA-256/byte数を保存し、実行後も saved と backup の hash は一致している。

## A司令監査追補への修正

司令提供の root cache reproducer を再実行し、`rawAfterFirstDigit: "5"`、空欄TopLeftは別欄TopRight=`50`入力後も空欄のまま、`fieldValidity.TopLeft: false`、`apply.ok: false`、`calls: 0` を確認した。focus-only は selectedVertex だけを更新し、draft/compile/dirtyを開始しない。deferred Apply は pending 中の二重適用を拒否する。native load 後の weight commit は非同期 `record` が終わるまで `building` を保持し、成功時にのみ confirmed snapshot へ戻る。

## 検証

| 検証 | 結果 |
|---|---|
| `node --check`（model/server/editor/weight-model/weight-editor） | PASS |
| `node tegaki_work/build/verify-rive-editor-weights.mjs` | PASS (63 checks; fixed cache valid)。raw `5`保持、空欄→別欄でもinvalid保持、focus-only、deferred Apply二重防止を含む。 |
| `node tegaki_work/build/verify-rive-editor-model.mjs` | PASS |
| `node tegaki_work/build/verify-rive-bone-editor.mjs` | PASS (54 checks) |
| `npm.cmd run build` (`tegaki_work`) | PASS |
| `node tegaki_work/build/development-harness.mjs check` | PASS (88 documents / 339 links) |
| `node tegaki_work/build/development-harness.mjs test transform` | 20 selected中19 PASS。既存の別lead `shape-tool.js` mock mismatch（`paint.append is not a function`）で1件FAIL、WP-034変更による失敗ではない。 |
| native CLI/inspect・native pixels・実Browser・通常host Project/History | **UNVERIFIED** |

固定専用 port `127.0.0.1:18729` は親司令が確認した既存 PID `43016`（product `5174` は PID `16008`）を停止・再利用せず、このSliceでは own server を起動していない。CIM identity が Access Denied で、own start/receipt/listener を証明できないため、listenerも変更していない。専用 Browser/native と Owner acceptance は司令の監査へ返す。

この観測は `tegaki_work/.cache/rive-editor/wp034-server-observation.json` に保存した。

採用、制作受入、commit、push は行っていない。

