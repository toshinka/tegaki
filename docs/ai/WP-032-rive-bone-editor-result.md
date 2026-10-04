# WP-032 — 新RIG End骨の直接編集 実装結果

## 判定

WP-032の限定実装は **TECHNICAL / PURE PASS**。固定native editorを使ったBrowser確認も、独立bone moduleを実配信した状態でEnd骨の表示、信頼入力の直接編集、progress=1 preview/compile、取消、明示保存、再読込まで通過した。通常Canvasへの受渡し、Project/History/UndoRedo、Owner制作受入はこのsliceでは未測定で、Commander/Ownerの受入に残す。

- START: `main` / `871c51ed850f436aa0d49deb049bf7276c3a9655`。
- FINAL: 同じ`main` / `871c51ed850f436aa0d49deb049bf7276c3a9655`。既存のdirty/untrackedは保持し、commit/pushは行っていない。
- WP-032のwrite範囲だけを変更した。`server.mjs`は司令が許可した`/bone-editor.js`と`/bone-projection.mjs`の静的配信2行だけを追加し、API/CLI/health/securityは変更していない。`model.mjs`、`dev-companion.mjs`、HTTP bridge、Vite、package/lock、host UI、Project/History/rendererは変更していない。

## 実装

### Native projection / gesture

- `bone-projection.mjs`はnativeからコピーした`End`骨の行列、length、`rive.computeAlignment()`由来のalignmentを使う表示投影/逆投影だけを担当する。ownedな`computeAlignment()`結果はコピー後にdeleteし、borrowedな`bone.worldTransform()`はコピーだけを行う。角度は`-90..90°`に制限する。
- `bone-editor.js`はpointer capture、pointermove preview、pointerup一回確定、keyboard矢印/Shift/Enter/Escape、実際のlostpointercapture、blur、focusout、teardown取消を独立machineとして実装した。self-release由来のlost captureは無視し、実際の喪失は取消する。preview中は操作をbusyにし、取消は元progress/angle/dirtyを復元する。遅延commitはdispose後にUIを復活させず、pending commitはabortする。SVG overlayは`hidden` propertyだけに依存せず、`hidden`属性を明示的に追加/削除する。
- `runtime.js`は既存load/seek/resource lifetimeを維持したまま、native `artboard.bone('End').rotation`へ候補角を設定し、`artboard.advance(0)`と既存native drawを通す`previewEndBone`/`restorePose`/projection取得を追加した。preview/compileはnative frame `progress=1`で行い、取消だけ元progressへ戻す。PNGや画像頂点を変形しない。

### Editor / UI

- `editor.js`は`bone-editor.js`と`runtime.js`を直接importし、既存`/api/compile`へpointerup/Enterの確定を一度だけ接続し、成功後にfresh runtimeを読み直す。preview中はframe/PNG/save/他operationを拒否し、snapshotへ`selectedBone`、`editPhase`、`previewAngle`を診断値として投影する。確定source/image/angleをpreview中にcanonical mutationしない。dispose/token境界で遅延応答を無効化する。
- 固定`18729` serverには司令が許可した2つの静的routeを追加し、Browserでも独立`bone-editor.js`/`bone-projection.mjs`を実際に読み込ませた。editor/runtimeのinline controller・projection fallbackは残していない。
- `editor.html`にeditor scopedのSVG overlay、`data-testid="rive-bone-end"`、ARIA slider、24px以上のhit area、短い日本語導線「骨を動かす → 保存 → 現在フレームを追加」を追加した。overlayは`role="group"`で名称を保持し、子のEnd sliderをAXへ露出する。`#bone-overlay[hidden] { display: none !important; }`でhidden属性が残るSVGも確実に非表示にする。補助線/ハンドルはcanvas PNG/native frameへ入らない。
- `editor.js`の状態details内に診断専用「native画素を記録」ボタンとpreを追加した。canvasのRGBAを捕捉時snapshot（angle/progress/editPhase/previewAngle/sourceHash）とともに読み、width/height、透明pixel数、alpha/bbox、RGBA SHA-256を表示する。SVG overlayは合成せず、SHA-256 await中の状態変化は`staleDuringHash`へ記録する。compile/save/frame/record/Historyへ接続せず、preview中もボタンをdisableしない。pointerdownはpreventDefaultでpointer previewのfocusを保持し、keyboard Tabによるfocusout取消は維持する。
- editor-local CSSは狭幅でもgrid子を`min-width:0`で縮小し、mediaの1列を`minmax(0, 1fr)`へ固定した。pixel診断preのSHA-256は`overflow-wrap:anywhere`でviewport内に折り返す。native canvasの300×180と投影計算は変更していない。
- `verify-rive-bone-editor.mjs`はprojection roundtrip、matrix ownership、gesture cancel/commit数、stale/abort、progress=1配線、frame guard、static route、module wiring、overlay hidden属性/CSS/AX role、pixel診断、狭幅CSS、fixtureのsynthetic event不使用を54 checksで検査する。
- `wp032-rive-bone-browser.html`は実runtime/CLIへの公開buttonと可視結果を備えたBrowser fixtureで、trusted mouse/touch/pen/keyboard確認とsynthetic static確認を分離した。

## Verification

| 種別 | 結果 |
|---|---|
| `node --check`（WP-032 JS/MJS） | PASS |
| `node tegaki_work/build/verify-rive-bone-editor.mjs` | **PASS (54 checks)**。固定cacheは`cache-valid`、verifier自身は18729をspawnしないためnative欄は`UNVERIFIED` |
| `git diff --check`（WP-032対象） | PASS |
| `node tegaki_work/build/development-harness.mjs check` | PASS（84 documents / 324 local links / 25 proposals / 23 packages） |
| `development-harness.mjs list/test transform` | PASS（20 selected / 0 failed） |
| `npm.cmd run build` | PASS。font publicationもPASS。Viteの既存chunk-size warningのみ。 |

固定cacheの検査値はWP031から継承した。CLI/runtimeのinstallation IDは`57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab`。検証結果は`tegaki_work/.cache/rive-editor/wp032-rive-bone-verification.json`に保存した。

## Native / Browser evidence

専用companionを自分で起動し、固定cacheを使う`http://127.0.0.1:18729/`をChromeで確認した。serverの静的routeから`/bone-editor.js`と`/bone-projection.mjs`を直接読み込んだ状態で、コンソールのerror/warnは空配列だった。

- native entryは`Rive native editor準備完了（300×180）。`、canvas `300×180`、artboard `RiveEditorProof`、selected bone `End`。橙色のnative image上にpivot→tipの補助線と`rive-bone-end` slider handleが表示された。
- scrubを`0.50`にしてhandleへtrusted keyboard `ArrowRight`を送ると、独立module経由で`status=building`、controls disabled、snapshot `progress=0.5`、`editPhase=preview`のnative previewになった。`Enter`後はfresh instanceのready snapshotが`progress=1`、progress controlが`1.00`、angle `56`、dirty `true`になり、compile後のnative frameを`progress=1`へ固定する契約を確認した。
- handleからfocusを外すtrusted操作では、previewが`bone-edit-focusout`で取消され、元angle `55`、元progress `0.5`、dirty `false`へ戻った。別のtrusted pointer drag（画面座標`[473,285]`→`[425,205]`）は独立module経由でready `8.981°`、progress `1`、dirty `true`になった。
- handleへtrusted keyboard `ArrowRight`を送るとnative previewになり、操作controlsがdisabledになった。`Escape`で元angleへ戻り、controlsが有効化され、`骨のプレビューを取り消しました。`を表示した。取消中にsave/compile/historyを追加する挙動は観測していない。
- serverの「取消」で保存済み`55°`へ戻した後、明示「保存」で`source＋PNGを55°で保存しました。`、続く「再読込」で`保存済み55°を再読込しました。`を確認した。最終snapshotはready、angle `55`、progress `0`、dirty `false`。
- 自分が起動したcompanionは確認後に停止し、最終のport `18729` listenerは`0`。識別不能な他processは停止していない。
- 可視性追補は司令のnative監査中にsource/staticだけで適用した。追補後の18729/18832起動・Browser再測定・server操作は行っていないため、End handleのAX再出現は司令の再測定へ残す。

操作値とUI観測は`tegaki_work/.cache/rive-editor/wp032-rive-bone-native-browser.json`に保存した。Browser上のnetwork request数そのものは独立計測していないため、compile countはcacheでも`UNVERIFIED`とし、1回制約はstatic/pure verifierと実装経路で確認した。

## 未測定 / Commander・Owner境界

- 追補後のoverlay AX tree再出現とpixel report実測、preview中のhost frame requestを実際に送った拒否、Browser network上のcompile request数、数値入力と直接dragの同角度pixel一致、透明native 1x PNG、通常Raster一件/History一件、Undo/Redo、Project load、host iframe entry、CSS縮小・狭い画面・liquid tablet/coarse pointerは未測定。
- 固定native/CLI runtimeの実在はcache/hash gateで確認したが、長時間GPU受入とOwnerの制作受入は未判定。
- `.riv`は引き続きderived previewであり、source/image/save authority、canonical renderer、Project schema、History authorityを変更していない。

`docs/STATUS.md`、`docs/TECHNICAL.md`、Card、`docs/DEVELOPMENT.md`は司令所有のため変更していない。
