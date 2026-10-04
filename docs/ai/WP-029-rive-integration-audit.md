# WP-029 — 司令のnative / 製品接続監査

状態: REFERENCE EVIDENCE。2026-10-04、main `871c51ed850f436aa0d49deb049bf7276c3a9655`。実装契約は[WP-029](../work/WP-029-rive-editor-first-path.md)、現在地は[STATUS](../STATUS.md)。この資料は製品採用・Owner受入を承認しない。

## 成立した一経路

通常Drawingの「新RIG（試作）」から独立editorを開き、公式native runtimeで描いた300×180 PNGを、hostの「現在フレームを新レイヤーへ」で新しい通常Rasterへ一回追加した。既存LayerSystem APIとHistoryを使用し、Project schema / renderer / SOURCE authorityを変更していない。`right-workspace-frame.js`の接続差分はimport / mount / destroyだけ。旧RIGの内部への互換層は追加していない。

model/template、CLI companionと独立source保存、native runtime、GUI/state、製品adapterを分離した。AIは`tegaki.rive-editor.state.v1`のsnapshot、JSON inspector、安定したdata-testidと日本語labelから状態を読める。snapshotは保存の第二正本ではない。

## 司令の実測

専用editor18729、製品18829、IABの独立tabだけを使用。launcherで固定CLI1.3.0 / canvas-advanced2.44.0の実hashと公式verify/build/inspectを確認した。

standalone editorの実Browserで300×180 PNGをnative decodeして同寸RGBA8へ正規化し、70°へ編集・compile・保存・再読込、75°編集から取消で70°復元、progress .75のnative透明PNG出力を実施。保存source+PNGを再buildした後、製品hostを閉じて開き直し、新しいembedded runtimeで同じ70°sourceをロードした。製品へ渡したframeはprogress 0、動きの検証とは分ける。

| 対象 | SHA256 / 実寸 |
|---|---|
| 保存scene.rml（70°） | `64c5daacc89799b0e402d0059299fc236ab32017ed3afb2ee439a5323611d695` |
| 保存素材fixture.png | `f126966391c5168d71ed1f23687b110cac7d5fe249f54319882164f11b96137b` / 300×180 |
| sourceからbuildした保存current.riv | `2a48efc83a6dde3d6e8bcb2d4448a4a8073ec1b6f58b78d9aaf3e845234b01bc` |
| standalone native PNG（70° / .75） | `9d4c9944b7f65192b22b8914ccc681b13ede33d955d42d9354a7a4b257a6d002` / 17,720 bytes |
| 製品追加Rasterのcanonical RGBA | `70a851fa26d179eff0ba72e925ba66bf95b7cd378ef7e8af7305d67b29f7bf7b` / 300×180 |
| 製品最終ExportのRGBA | `9bfbd0189cc774c64d1fe49f846a95617304b082bdc6dac16c2c218ab5063400` |

`build/wp029-rive-browser.html`の可視操作で、実製品に元絵Rasterを用意→新入口→native frame追加→検証ボタンを実行した。表示された全項目:

- 新入口一件、native load完了後だけ受渡し。
- 新Raster一件 / `rive-frame-import` History一件、元絵canonical画素不変。
- 透明原寸1xの300×180 RasterをProject Canvas中央へ配置し、製品Exportへ描画。
- Undoで追加だけを撤回し元Exportへ復元、Redoで同じ画素へ復元。
- 実`ProjectManager.exportProject()` → `loadProject()`で追加LayerとExport画素が一致。

JSONだけの往復、独自の変形、Timelineの再構成をnative / Project証拠にしていない。CLI screenshotもBrowser証拠の代用にしていない。

固定CLI実体SHA256は`285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`。served runtimeのmjs / rive.wasm / fallback.wasm SHA256はそれぞれ`8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9` / `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74` / `A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5`。archiveと実体の検査はlauncherとcacheの`run-manifest.json`に記録。

source / 保存素材 / riv / nativePNG / manifest / own process停止記録を`.cache/rive-editor/commander-audit-20261004/`へ限定保存した。SDK実体や生成物は成果fileへ混ぜない。司令PID39056 / 43864はNode実体・loopback listener・記録PIDを照合して停止し、司令tabも閉じた。他担当のserviceは停止していない。

## 検証階層と残る確認

自前実装量（最終sourceのraw行数、空行/header含む）: 製品host 200、native wrapper 194、CLI companion 521、model/template/PNG validator 372、GUI JS 414＋HTML 86、launcher 198、限定validator二件 81＋45、製品fixture 54。共通frame側は接続3行。engine/CLI/runtime本体patchは0、旧RIG互換層は0。新しいauthoring GUIとsource/CLI bridgeの維持責任はTEGAKI側に残る。hashの対応はcacheの`commander-final-module-hashes.json`。

JS/PowerShell構文、host境界verifier、model verifier、harness、製品buildはPASS。hostはwrong origin/source/session/version、重複/stale/build/progress、PNG寸法/size、loading/building/error、Canvas/History/描画/変形/CAFを拒否する限定static検証。実製品Browserの接続 / Undo / Redo / Project往復は上記の別実測でPASS。

LUNAの[standalone結果](WP-029-rive-editor-result.md)はsource/asset欠落・破損・上限・取消・native frameの担当証拠。司令監査で修正した原寸mesh、Browser decode、load完了後ready、served runtime hashは修正後の実行で確認した。最終限定修正も完了し、枠外crop説明と初期closedな診断、input幅制約、失敗reasonのsnapshotをsourceで照合した。破損PNG投入前後の実native PNG二filesは17,720 bytes / 同一hashで、担当のJSON receiptとも一致した。この最終破損fixtureはheader拒否であり、native decoder内部の失敗だけを狙った実測とは区別する。

司令は修正後`runtime.js`を専用cache fixtureで12:01 UTCに独立再実行。公式runtimeが300×180 `.riv`をprogress .75で描画した後、候補の404を発生させ、直前progress / 寸法 / resources保持、native PNG hash `9d4c9944b7f65192b22b8914ccc681b13ede33d955d42d9354a7a4b257a6d002`、RGBA hash `e997ccaf023daef81f5ff31b4b5e2b92486984e8edd3a7be6593b6b97c105f8d`のbefore/after一致をBrowser可視結果で確認した。これはfetch failureの再実測で、あらゆるload failureの網羅ではない。限定verifier二件も再PASS。専用server18730のown PID62160をNode実体/listener/起動session照合後に停止し、tabを閉じた。receiptはcacheの`commander-final-browser-receipt.json`と`commander-final-runtime-process.json`。

embedded editorのtrusted file chooser / compile clickはBrowserツールのnested iframe制御が停止したためUNVERIFIED。同じeditorのstandalone操作と、新しいembedded runtimeのload / state / host footer追加は実測済み。これをembedded全操作のPASSへ広げない。

液タブ/coarse pointer、長時間性能、Owner制作受入、公開CLI同梱/利用条件、製品backend採用は未受入または未測定。保存/reopen時のscrub位置は0へ戻る。次Cardで扱うUX候補であり、今回source保存契約を拡張しない。多部品/IK/物理/Timeline直接接続は次Cardを発行するまで実行しない。
