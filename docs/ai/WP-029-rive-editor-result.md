# WP-029 Rive editor first path — 実装結果

## 判定

WP-029 の限定実装と専用 Browser proof は完了した。これは **TECHNICAL / ROUGH PRODUCT PASS** であり、通常 Canvas への mount、Project/History/UndoRedo、Owner の制作受入は未測定である。製品の Project schema、History authority、save authority、canonical renderer は変更していない。

## 実装範囲

write-owner は次の専用ファイルだけである。

- `tegaki_work/advanced/rive-editor/model.mjs` — PNG 制約、固定 native template、snapshot、source metadata、sha256。
- `tegaki_work/advanced/rive-editor/server.mjs` — `127.0.0.1:18729` の same-origin + startup nonce、専用 cache、公式 CLI build/inspect、save/reopen/cancel、frame PNG。
- `tegaki_work/advanced/rive-editor/runtime.js` — WP026 の公式 `@rive-app/canvas-advanced@2.44.0` を読み、native 1x canvas を描画。
- `tegaki_work/advanced/rive-editor/editor.js` / `editor.html` — PNG素材、終点角、スクラブ、保存/再読込/取消、現在フレーム PNG、snapshot inspector。
- UI は snapshot diagnostics を `<details>` で折り畳め、artboard 全体/native 1x、素材原寸、枠外は出力枠で切れること、RGBA8 正規化を説明する。
- `tegaki_work/advanced/rive-editor/run-editor.ps1` — 固定 cache の hash/version gate、process-only `RIVE_HOME`、server ownership gate。
- `tegaki_work/build/verify-rive-editor-model.mjs` — model/source/PNG の bounded verifier。

実装 line count: model `372`、server `521`、runtime `194`、editor JS `414`、editor HTML `86`、launcher `198`、model verifier `81`。結果 report は補正追補を含む現行内容である。

### Native/cache 契約

- 公式 CLI: `rive 1.3.0`, executable SHA-256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`。
- 公式 CLI archive SHA-256: `F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF`。
- 公式 Web runtime archive SHA-512: `1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA==`。
- runtime source: `tegaki_work/.cache/rive-authoring-proof/runtime-2.44.0/package`。
- served runtime SHA-256: `canvas_advanced.mjs=8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`, `rive.wasm=A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`, `rive_fallback.wasm=A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5`。launcher が served 3 files を検査し manifest に記録する。
- editor cache: `tegaki_work/.cache/rive-editor/`、専用 port `18729`、`RIVE_HOME` は同 cache 内、analytics は `off`。PATH、system install、login、download は行っていない。
- 最終 server は owner process として停止済み。`server.pid.json` に最終 PID `57108` と `stoppedAt` を記録し、最終確認で `127.0.0.1:18729` の listener は無かった。

### Model/CLI proof

`node tegaki_work/build/verify-rive-editor-model.mjs` は PASS。

- fixture: `fixture-320x200.png`, RGBA8, `320×200`, `1649` bytes, `64000` pixels。WP-026 の `240×160` fixture とは別寸法である。
- fixture SHA-256: `9a4a425f8b517e97ea3b41b4f8a7ab0fd1117afa9170f96568a5de390604f538`。
- limits: axis `1024`, area `1,048,576`, PNG `8 MiB`, control JSON `64 KiB`, rest `30°`, end angle `-90..90°`。
- PNG validator は IHDR の軸/面積を先に検査し、zlib 展開にも期待 scanline 長を `maxOutputLength` として渡す。
- source は artboard が PNG 実寸、Image center `(W/2,H/2)`、Root `(0,H/2)`、bone length `W/2`、mesh bounds `[-W/2,+W/2]×[-H/2,+H/2]` の 2 bones / 4 vertices / 2 triangles、`EndPose` `60 fps / 60 frames`。無言の `.6W×.8H` mesh 縮小は verifier が拒否する。
- 検証角度 `-90 / 30 / 60 / 90` はすべて実寸 bounds metadata 検証を通り、invalid angle/progress は reject。post-fix source hash は `-90=4a971c3b3149f52128efac9ea64f2f36a6ab2becc1581044ec44af4322e319c3`, `30=641bca389046a15ada8e93f6673a48d1842505b7d0c8de52edace387cd512905`, `60=ba13175f7ee91d7a77d0d4fbdf8c33b347a5bd3968eb9332cec39eaeb79d2810`, `90=65cd8c8bcf1b8da24b84273c32910241a4efc00baaa7a8420643983b5fac81fe`。
- 公式 CLI `--verify`, `--once`, `inspect` は PASS。post-fix derived `.riv` は `2167` bytes。`no-default-state-machine` は CLI warning であり、verify/build error ではない。旧 `.6W×.8H` run の source/artifact 数値は現行 proof として採用していない。

## Browser proof

実行 URL は `http://127.0.0.1:18729/?v=wp029-1`。native canvas の描画、DOM snapshot、Browser console error/warn 無しを確認した。

1. startup: `ready`, rest `30°`, `320×200`, `dirty:true`、source hash `641bca389046a15ada8e93f6673a48d1842505b7d0c8de52edace387cd512905`。UI の終点角 input も `30` を表示する。
2. file chooser から `wp029-upload-300x180.png` を実際に読み込み、ブラウザ `createImageBitmap` decode、実寸照合、透明 RGBA8 Canvas 正規化を通した。snapshot は `image-load-rgba8-normalized`, `300×180`, `dirty:true`, source hash `0a189097d0108db693d40780a4d4d8c680152b884474aec79a7d3c823d6d1daf`。UI には「RGBA8透明PNGへ正規化」と表示される。
3. scrub `0.50` → `60°` compile: build `1791112115296-a8e3ce`, source hash `8e81a46ff012218185b6b720b81f506a913cbef98e760f3f7be67656ec98bb3b`, `dirty:true`。
4. 保存: `dirty:false`, saved angle `60°`。再読込は新 build `1791112132017-efcfc7`、angle `60°`, progress `0`, `dirty:false`。
5. `75°` unsaved build `1791112140866-0d50e0` → 取消: build `1791112149068-98ad9a`, 保存済み `60°`, `dirty:false`。runtime candidate load/dispose/reload をこの経路で通した。
6. scrub `0.75` で「PNG保存」: `300×180`, `17778` bytes, SHA-256 `9d4842fe1f9ba96212c3e0446e610c7b269e5ae8c010e688d86541442d11e527`。保存先は `tegaki_work/.cache/rive-editor/browser-png/frame-0-7500.png`。PNG validator は RGBA8 を確認し、alpha `0` が `31025` pixels、非透明が `22975` pixels。artboard 全体の透明1xを素材原寸で出力し、枠外へ変形した部分は出力枠で切れる。
7. 破損 PNG を同じ file chooser で送った場合は `PNGヘッダーを読み取れません。` と表示され、snapshot/runtime は直前の `ready` good state を保持した。

最終 snapshot は次の形で、nonce や PNG bytes を含まない。

```json
{
  "schema": "tegaki.rive-editor.state.v1",
  "status": "ready",
  "documentId": "rive-editor-c5ff7ab4-fddf-4507-b72c-c9233fe8fb81",
  "buildId": "1791112149068-98ad9a",
  "sourceHash": "8e81a46ff012218185b6b720b81f506a913cbef98e760f3f7be67656ec98bb3b",
  "image": { "name": "wp029-upload-300x180.png", "width": 300, "height": 180 },
  "angle": 60,
  "progress": 0.75,
  "dirty": false,
  "reason": "scrub"
}
```

最終 saved image はブラウザ正規化後の `tegaki_work/.cache/rive-editor/saved/fixture.png`（`300×180`, SHA-256 `F126966391C5168D71ED1F23687B110CAC7D5FE249F54319882164F11B96137B`）である。server を停止して再起動した run でも `reason:"startup-saved"`, `300×180`, angle `60`, `dirty:false`, `savedBundleStatus:"valid"` を確認した。

## Protocol/static proof

`editor.js` は protocol version `1`、hash の `session`、HTTP loopback の parent origin を読み、state を `tegaki:rive-editor:state` として検証済み origin にだけ送る。native load 中は `loading`、ready 後だけ frame request を許可する。UI operation guard は compile/save/reopen/cancel/image/frame を一件に限定し、controls を disabled にする。frame request は `event.source === window.parent`、origin、session、version を全て確認し、requestId を一度だけ処理する。返却は `tegaki:rive-editor:frame` の transferable `ArrayBuffer`、`buildId/documentId/width/height/progress` 付きである。拒否は `tegaki:rive-editor:error`。wildcard target、`*` origin、nonce の snapshot 混入はない。runtime は candidate を成功させてから旧 instance を release する。

`node --check`（model/server/runtime/editor）、PowerShell AST parse、`git diff --check`、`node tegaki_work/build/development-harness.mjs check`、host-side `node tegaki_work/build/verify-rive-editor-entry.mjs` は PASS。Browser console の error/warn は空配列だった。

## 司令補正追補（standalone 限定）

司令指定の補正は通常 Canvas、Project、History の受入判定と混ぜず、standalone editor の限定証拠として追補した。

- `editor.html` は「素材は原寸のまま、枠外へ変形した部分は出力枠で切れます。現在フレームはartboard全体をnative 1xで返します。」と明示する。snapshot details は初期 closed、file/number input は `min-width:0; width:100%` である。
- `editor.js` の image/compile/save/reopen/cancel/frame/scrub rejection は、良好な build/source/image/runtime の snapshot を `status:"ready"` のまま保持し、`image-load-rejected`、`compile-rejected`、`save-rejected`、`reopen-rejected`、`cancel-rejected`、`frame-png-rejected`、`scrub-rejected` を reason に記録する。UI には具体的な error message を表示し、snapshot JSON に nonce は含めない。
- Browser decode rejection 限定確認では、`wp029-correction-bad.png`（破損 bytes）を実際の chooser から投入した。投入前は build `1791113972288-a01abe`、source hash `64c5daacc89799b0e402d0059299fc236ab32017ed3afb2ee439a5323611d695`、`300×180`、angle `70°`、progress `0.75`、reason `scrub`。拒否後は同じ build/source/image/angle/progress/dirty と `status:"ready"` を保ち、reason は `image-load-rejected`、UI は `PNGヘッダーを読み取れません。` となった。拒否前後に保存した frame はともに `300×180`、`17720` bytes、SHA-256 `9d4c9944b7f65192b22b8914ccc681b13ede33d955d42d9354a7a4b257a6d002` で、sourceHash と画素は不変である。
- `runtime.js` は `_capture/_assign` に最後の seek progress を含め、候補 fetch/load failure の rollback で `previous.progress` を再 seek する。専用 cache Browser fixture で valid artifact を `.75` に pose した後、`/artifact-missing.riv` の candidate fetch `404` を発生させた。rollback 後は progress `0.75`、canvas/resources `300×180`/retained、PNG SHA-256 `9d4c9944b7f65192b22b8914ccc681b13ede33d955d42d9354a7a4b257a6d002`、pixel SHA-256 `e997ccaf023daef81f5ff31b4b5e2b92486984e8edd3a7be6593b6b97c105f8d` が before/after で一致した。
- 補正後の限定静的確認は `node --check`（model/server/runtime/editor）、`node tegaki_work/build/verify-rive-editor-model.mjs`、`node tegaki_work/build/verify-rive-editor-entry.mjs`、`git diff --check` を実施する。旧 Browser proof 全機能は再走していない。
- 補正専用の main server `127.0.0.1:18729` (PID `64012`) と runtime fixture server `127.0.0.1:18730` (PID `54644`) は停止済みで、最終確認に listener は無い。

## 拒否/保持 proof

専用 nonce と正しい origin を使った API probe の結果:

| probe | 結果 |
|---|---:|
| angle `120` | `400 input-rejected` |
| foreign Origin | `403 origin-rejected` |
| bad nonce | `403 nonce-rejected` |
| control body `>64 KiB` | `413 body-too-large` |
| corrupt frame PNG | `400 frame-rejected` |
| `1025×1` PNG | `400 image-rejected / png-dimensions` |

保存済み `fixture.png` を一時的に欠落させた `reopen` は `409 saved-state-rejected` となり、現行の良好な `60°/300×180` build は保持された。保存素材を復元後の `reopen` は `200`。さらに起動前に保存 PNG を `not-a-png` に置換した server は、fallback fixture を使わず `status:error`, `reason:startup-rejected`, `artifactUrl:null`, `savedBundleStatus:corrupt` で停止した。geometry 修正前の旧 saved bundle も source contract mismatch として同様に拒否され、互換 fallback は行わない。各テスト後は現行の正規化 saved bundle に復元した。

## Cache precondition / 未測定

この経路は WP026 の公式 CLI/runtime cache が存在し、上記 hash が一致することを前提にする。cache が無い場合に SDK を修復したり platform を切り替えたりせず、HOLD とする。editor cache の fixture/project/session/saved/artifact/log は証跡として生成済みである。`saved-pre-geometry-20261004/` は旧 template 拒否を確認するための cache-only archive で、現行の保存正本ではない。

次はこの write slice の受入範囲外である。

- `tegaki_work/ui/rive-editor-entry.js` の host import、iframe mount、host footer の実表示。
- Commander 所有の `right-workspace-frame.js`、通常 Canvas への native frame 新 Raster 生成、History 一件、Undo/Redo、実 Project load。
- production Owner acceptance、liquid tablet/coarse pointer、長時間 GPU/Native runtime 受入。

したがって本 report は standalone editor の static/CLI/Browser/native frame proof を返し、host integration と制作受入は Commander/Owner の別証跡に委ねる。
