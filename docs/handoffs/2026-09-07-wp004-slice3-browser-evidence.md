# WP-004 Slice 3 実行指示 — Browser / Canvas evidence

状態: EXECUTION HANDOFF（2026-09-07）。進捗正本は`docs/STATUS.md`、作業契約は`docs/work/WP-004-output-terminal.md`、結果正本は`docs/work/WP-004-results.md`。この文書を第二の正本にしない。

## 目的

WP-004を閉じるため、既に対象となっている未確定編集のsave/export境界とCPU compositorの実Canvas結果を確認する。今回、製品runtimeのExport terminal仕様は変更しない。広い再監査、新しい状態空間、HD-005の実装へ進まない。

## 開始

1. `AGENTS.md`、`docs/STATUS.md`、`docs/TECHNICAL.md`、`docs/work/WP-004-output-terminal.md`、`docs/work/WP-004-results.md`を読む。
2. `git rev-parse HEAD`と`git status --short --untracked-files=all`を確認し、既存差分を保持する。記録時点のHEADは`c5ddf8c45fe5df40122497112f53d1b352b60950`。
3. WP-004から参照されるoutput terminal資料、対象production caller、既存`verify-output-terminal-*`だけを必要な範囲で読む。

Animation Contextの右Layer Panel選択問題はOwner実確認で解消済み。追加調査・修正をしない。

## 固定境界

- product runtimeはread-only。Export自動commit、明示停止、一時sampling、History、保存schema、session lifecycleを変更しない。
- WP-006、Simple WARP UI、F-007、Layer Panel、関連しないrefactorへ広げない。
- Ownerの既存Chrome/tab/projectを使用しない。専用の小さなfixtureと隔離したBrowser tabを使う。
- DownloadやOS dialog自体が受入条件でない限り、`skipDownload`、preview Blob、project serializationで置き換える。
- Computer Useは、実BrowserのCanvas/runtimeまたは実UI event順序でしか確認できない項目に限定する。

## Slice 3A — 1ページの自己診断

必要なら`tegaki_work/build/wp004-browser-diagnostic.html`と、それを静的検査する限定verifierだけを追加してよい。production module/class/methodをimportし、fake Canvasで実画素passを主張しない。

診断ページは一度の起動で結果をJSONまたは表としてDOMへ表示する。入力画像は移動・欠落が判別できる非対称patternを使い、実`HTMLCanvasElement`からpixel hash、非透明bbox、代表pixelを採る。

最低限、次を確認する。

1. ready Layer MotionがCPU compositorとExport/Preview surfaceに同じ変形結果を出す。
2. ready Folder Motionが現行subtree全体へ同じ変形結果を出す。
3. unsupported overlapが`renderFrame`、`renderClipFrameSurface`、Export callerの各入口でdrawing/mutation前にreason付きで失敗し、成功扱いにならない。
4. Floating Selection、通常SOURCE Layer Transform、CAF SOURCE internal Layer Transform、ANIMATE Layer Motion、ANIMATE Folder Motionについて、Project serializationとExport/Preview直呼び出し前後のsession、working layer、History、出力反映を記録する。

Project Saveは可能なら保存UIではなくproductionのproject serializationを呼び、隔離fixtureへ読み戻す。Exportは可能ならBlobをImageDataへdecodeし、実downloadを発生させない。

## Slice 3B — 差が出る入口だけのUI確認

Slice 3Aで得られないevent順序だけを最小操作で確認する。直呼び出し結果と混同しない。

1. 通常SOURCEで実Export/Preview UIを1回操作し、click前のblurがLayer Transformを確定するかを記録する。
2. CAF SOURCEで通常SOURCEとhandler/event順序が異なる場合だけ同じ確認を1回行う。
3. ANIMATE Layer MotionでExport/Preview開始後に編集sessionが残るか、Escapeで元へ戻るかを確認する。
4. ANIMATE Folder Motionでも同じ確認を行い、子2枚の出力反映とsession残留を記録する。
5. Floating Selectionは既存自動確認でUI固有差が残る場合だけ追加する。

同じ操作をSave、Export、連番、Previewへ総当たりしない。共通callerであることを静的に確認できる入口は代表1件にまとめ、未確認の入口を結果表へ明記する。

## 記録形式

`docs/work/WP-004-results.md`へ、各ケースについて次を一行で記録する。

| case | entrance | pre-session | terminal action | committed/finalized | output reflected | post-session | History delta | canvas evidence | limitation |
|---|---|---|---|---|---|---|---:|---|---|

direct manager、actual UI click、Project serialization/reloadを明確に分ける。技術pass、Browser pass、Owner操作感受入も分ける。

HD-005は既存のA: export前commit、B: 一時sampling、C: 明示停止を、得られた結果だけで比較する。推奨が一意でなければ、現象・原因・選択肢・影響を記録してGPT判断待ちにする。runtimeへ採用しない。

## 検証

変更が診断資産と文書だけなら、関連output-terminal verifier、`node tegaki_work/build/development-harness.mjs check`、追加JSの構文確認、`git diff --check`を行う。product buildや全verifierは、product codeを変更していない限り要求しない。Browser evidenceは自動verifierの代用とも、その逆とも記録しない。

## 終了

Browser/Canvas evidence、terminal比較、HD-005判断材料を`docs/work/WP-004-results.md`へ反映し、`docs/STATUS.md`を更新して停止する。WP-004を独断でDONEにせず、製品runtimeの次の修正はGPT指示を待つ。
