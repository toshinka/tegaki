# WP-034 Slice A — 四隅 weight 実装結果

状態: **Slice A 実装完了 / static・pure PASS / native・Browser・Owner 未受入**。Slice B の playback-controller は実装していない。

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

固定専用 port `127.0.0.1:18729` は既存 PID `32532` が `/health` を返していた。CIM identity が Access Denied で、own start/receipt/listener を証明できないため、既存 process を停止・再利用せず、このSliceでは own server を起動していない。したがって own PID cleanup は不要で、listener も変更していない。専用 Browser/native と Owner acceptance は司令の監査へ返す。

この観測は `tegaki_work/.cache/rive-editor/wp034-server-observation.json` に保存した。

採用、制作受入、commit、push は行っていない。

