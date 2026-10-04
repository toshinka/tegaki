# WP-026 Rive画像rig Browser proof 結果

状態: **TECHNICAL PROOF PASS / Owner制作受入待ち**。WP-026の独立proofだけを実装し、製品コード、Project/History/Layer/Export、renderer、package/lock、旧RIGへ接続していない。baselineは `main / f245c354f63b808e3f5c89facfed19f5b0184eaf`。開始時に存在したWP-023/024/025その他のdirty/untrackedは保持した。

## 実装範囲

- `tegaki_work/advanced/rive-proof/run-proof.ps1` — 公式CLI/runtimeのhash、PNG境界、fixtureのCLI検査、専用serverの起動を一経路化。
- `tegaki_work/advanced/rive-proof/proof-server.mjs` — `127.0.0.1:18726`だけで固定RML/画像を公式CLIへ渡し、最後の成功source/buildを保持するloopback companion。
- `tegaki_work/advanced/rive-proof/proof.html` / `proof-client.js` — 400x300 artboardを、表示用800x600 preview canvasと、native rendererで同じartboardを描く400x300の1x output canvasへ分離する独立GUI。角度一値、scrub、save/reopen/cancel、拒否、PNG取得だけを持つ。
- `tegaki_work/.cache/rive-authoring-proof/` — ignoredのCLI/runtime、RML、画像、`.riv`、log、manifest、Browser proof JSON/PNG。

### 再実行

```powershell
cd D:\GitHub\tegaki
& .\tegaki_work\advanced\rive-proof\run-proof.ps1
& .\tegaki_work\advanced\rive-proof\run-proof.ps1 -StartServer
# Browserの新規専用tabで http://127.0.0.1:18726/?v=wp026-10 を開く
# 証跡取得後は記録された自分のPIDだけを停止する
```

`run-proof.ps1` の `-StopServer` は、環境の `Win32_Process`照会がAccess Deniedを返したため安全側にHOLDした。Browser/保存画像runの自プロセスPID `55040`、saved破損起動・復旧runのPID `53680`、静的検証restartのPID `41484`、最終PNG validator restartのPID `24436`を、それぞれ`server.pid.json`のcommand line、`127.0.0.1:18726`のlisten socket、Node process名で照合して停止済みである。未知のPIDは停止していない。`server.pid.json`には最後の停止時刻を記録し、最終確認時に18726のlistenerはない。

## 公式配布物とfixture

| 対象 | 固定値 / 証跡 |
| --- | --- |
| CLI | `rive 1.3.0`; archive `https://releases.rive.app/cli/v1.3.0/rive-windows-x64.tar.gz`; SHA-256 `F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF` |
| CLI executable | `cli-1.3.0/rive.exe`; SHA-256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9` |
| Web runtime | `@rive-app/canvas-advanced@2.44.0`; tarball `https://registry.npmjs.org/@rive-app/canvas-advanced/-/canvas-advanced-2.44.0.tgz`; expected SHA-512 integrity `1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA==` |
| runtime files | `canvas_advanced.mjs` 65,910 bytes / SHA-256 `8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`; `rive.wasm` 1,992,302 / `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`; `rive_fallback.wasm` 2,002,958 / `A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5` |
| image fixture | transparent RGBA PNG 240x160, color type 6, 4,536 bytes; corner alpha 0; SHA-256 `006A2197E367BCEAB651C707FF9D5C6FEC43911B5E31095B4B6CA348BDF25F56` |
| Rive fixture | artboard `RiveRigProof` 400x300; asymmetric image mark; four mesh vertices / two triangles (`AAECAAID`); root + child bone; `EndPose` 60 fps / 60 frames; endpoint 30°→60°; normal blend; no script, mask, physics, IK or auto mesh |

The first CLI source attempt used `main: main`, which produced the one allowed schema correction to `main: RiveRigProof`. The next `--verify`/build succeeded with zero errors and warnings; no additional schema or CLI failure was pursued. `inspect.json` reports the intended image/mesh/skin/tendon/weight and timeline. Its informational `no-default-state-machine` warning is recorded and does not affect the explicit animation seek used by the Browser runtime.

## CLI / bridge evidence

- `run-proof.ps1` passed PowerShell parse, archive/runtime integrity checks, `rive --version`, `--verify --format=json`, `--once --format=json`, and `inspect --json`.
- Compiled `.riv`: 5,056 bytes, SHA-256 `AFB8C63EC22BCA830510242A327EE3D5DD37757C40A184228BD13B00F63315DC`.
- Browser final state records source SHA-256 `AE66AD07F374B941B6E3A9292DCA96E1DC1B632A82D9AF79C481FD46954D3E24` and current `.riv` SHA-256 `AFB8C63EC22BCA830510242A327EE3D5DD37757C40A184228BD13B00F63315DC`.
- CLI analytics was explicitly disabled with the official `rive analytics off` command and verified with `rive analytics`: `RIVE_HOME=D:\GitHub\tegaki\tegaki_work\.cache\rive-authoring-proof\rive-home`, `RIVE_ANALYTICS=0`, process-only scope, and `PATH` unchanged. The runner/server write `cli-environment.json`; command output is in `analytics-off.log` and `server-analytics-*.log`. No system/user environment or auto-download is changed.
- Relevant ignored evidence: `run-manifest.json`, `cli-environment.json`, `analytics-off.log`, `verify.log`, `once.log`, `inspect.json`, `project/build/rive.log`, `project/build/problems.log`, `server-verify.log`, `server-once.log`, `server-inspect.json`, `server-analytics-*.log`, `server.pid.json`, `server.stdout.log`, `server.stderr.log`.
- The root-level accidental-looking `D:\GitHub\tegaki\0` was confirmed to be this proof's CLI screenshot output and moved into the ignored cache as `cli-screenshot-0.png`; no root `0` remains.

## Browser native runtime proof

操作は既存のMANGA/Vite tabとは別のCodex In-app Browser新規専用tabだけで行った。`canvas_advanced.mjs` は `canvas_advanced.wasm`を同梱 `rive.wasm`へ解決し、runtime instance、artboard、animation、preview renderer、1x output rendererをdispose/recreateしている。表示canvasを2倍にしても、PNGは同じnative artboardを400x300へ描いた別output canvasから取得する。

Clean timing run (`browser-proof.json`, `phase: final`):

| 操作 | 観測結果 |
| --- | --- |
| 初期30° | 0 / 0.5 / 1秒のbone rotationは全て `0.523599`; 1x output `pixelDiffPose0To1=0`（2x previewも0）。1x alpha `25792` pixels、bbox `56,88–263,211`; 2x preview alpha `104500`、bbox `111,175–528,424`。 |
| 60°編集 | rotation `0.523599 → 0.785398 → 1.047198`; 1x alpha `25792 → 25711 → 24498`、bbox `56,88–263,211` → `52,91–277,258`; 1x `pixelDiffPose0To1=23585`。対応する2x previewは alpha `104500 → 102604 → 97376`、`previewPixelDiffPose0To1=94547`。 |
| save → dispose → source再build → 新runtime | `beforeBuildId`と異なる新buildで60°を再読込。1x三点の姿勢、alpha、bboxが再現し `pixelDiffPose0To1=23585`; 2x previewは `previewPixelDiffPose0To1=94547`。 |
| 75° unsaved edit → cancel | 75°は1x `pixelDiffPose0To1=28563`（2x `previewPixelDiffPose0To1=114147`）。cancel後は保存済み60°へ戻り、1x/2x双方の三点証跡を再取得。 |
| reject | `NaN`/120°、壊れたsource bundle、16-byte corrupt `.riv`を各々拒否。全て最後の成功buildを保持し、`.riv`はnative Web runtimeでも拒否後に60°を再読込。`rejectAngle`は`getState()`前の`beforeBuildId`を比較し、保持判定を正しく記録した。 |
| 角度範囲 | `-45°`をAPIへbounded compileし成功、続けて60°へ戻した。validator/GUIは有限値 `-90〜90°`を契約とする。 |
| PNG | 1x output `pose-1x-pose-0.png` 8,969 bytes / SHA-256 `68C1514ADA3241F4EE563E38F60C7657E8F2D901621A0A93301FD2F14589A54F`、`pose-1x-pose-0-5.png` 21,983 / `A3C30C18CF486530C86BBB9269B84757CFDF8041DB6D0C30275D15599920BC3A`、`pose-1x-pose-1.png` 23,002 / `ACCAC216A478F30C3BCB6387BA7C7F7EC6AE07017CA3981F8B707D1C0CA438C3`を取得。全て400x300 RGBAの透明背景上の非空画像である。表示用2x previewは別名 `pose-2x-*`（34,934 / 51,511 / 54,582 bytes）に保存し、旧800x600証跡は `legacy-2x-*` として保持した。PNGは64KiB JSON/base64枠を避けるため`application/octet-stream`のbinary uploadで保存した。 |
| timing | 最終runのscrub 0.5は総処理（描画+PNG encode/upload）`28.8 ms`、render-only `8.3 ms`。source compile開始から新runtimeの三点描画完了まで `340 ms`。前runの総処理`27.9 ms`は監査値として保持し、render-onlyとは扱わない。 |

Browser画面の最終screenshotは専用tabの800x600 previewで取得・目視確認し、同じsource/runtimeからの400x300 1x PNGと分離した2x preview PNGをcacheへ保存した。Browser証跡の機械可読正本は `browser-proof.json`、過去runも含めた監査用束は `browser-proof-final.json`。

## Mutation gate / saved source-image evidence

- `mutation-gate-evidence.json` は`Origin: http://127.0.0.1:18726`とstartup nonceを全mutation endpointへ要求することを確認した。foreign originは403 `origin-rejected`、bad nonceは403 `nonce-rejected`、70,014-byte bodyは413 `body-too-large`（上限`MAX_BODY=65,536`）で、いずれもbuild id / angle / saved angleを保持した。nonceの公開値はstateのSHA-256だけを記録する。
- `saved-image-rejection-evidence.json` は保存済み`fixture.png`を一時退避した状態で、`/api/reopen`と`/api/cancel`が409 `saved-state-rejected`を返し、最後の良好buildを保持することを記録した。画像を復元すると60°の保存source+imageを再buildして成功した。reopen/cancelはdraftやproject originalへフォールバックしない。
- `startup-corrupt-saved-evidence.json` は既存saved bundleの画像欠損を`startup-fallback` / 30° / `savedBundleStatus=corrupt`として検出し、欠損bundleを上書きしないこと、画像復元後の再起動で`startup-saved` / 60° / `valid`へ戻ることを記録した。
- 既存のsaved bundleを初回起動で30°へ上書きしないよう、valid bundleは`scene.rml`と`fixture.png`から再buildしてそのまま保持する。保存時もsource、image、`.riv`を同一bundleとして更新する。

## Evidence tiers

| tier | status | 境界 |
| --- | --- | --- |
| static / source | **PASS** | PowerShell parse、Node `--check`、`git diff --check`、harness check。 |
| official CLI authoring | **PASS** | 固定CLI/runtime hash、verify/build/inspect、実画像asset、mesh/skin/timeline。 |
| Browser native runtime | **PASS** | 新規runtime instanceでload/seek/render/dispose/reloadを実操作。 |
| Browser visual / PNG | **PASS** | 非対称markの三点差分、透明背景、400x300 1x native output、800x600 2x preview、bbox/alpha/centroid、PNG、screenshot。 |
| performance | **RECORDED** | この小fixture/このhostでのscrubとcompile→reloadの観測値。作品規模の上限や液タブ操作感は推定しない。 |
| product integration | **NOT RUN / OUT OF SCOPE** | TEGAKI Project/History/Layer/Export/rendererへimportしていない。 |
| Owner acceptance / push | **PENDING** | agentは採用、制作受入、commit、pushを承認しない。 |

## 行数、patch数、依存、local companion

| 責務 | source | 行数 |
| --- | --- | ---: |
| bridge + deterministic fixture compile/serve | `proof-server.mjs` | 546 |
| fixture source (ignored) | `project/scene.rml` / `rive.yaml` | 37 / 9 |
| GUI | `proof.html` / `proof-client.js` | 60 / 366 |
| validator / runner | `run-proof.ps1` | 190 |
| tracked implementation total | 上記4 files | **1,162** |

Patch unitsは新規実装4 files + 結果report 1 file。CLI schema correctionは1回（`main` artboard名）、Card再照合後のbounded契約修正は角度範囲1回、1x output/2x preview分離1回、mutation origin/nonce/body gate、official analytics process-only、saved source/image rebuildとstartup preservation、`rejectAngle` retained比較修正を追加した。engine/fixture/schemaの追加修復はない。直接依存はNode built-ins (`node:http`, `node:fs`, `node:path`, `node:crypto`, `node:child_process`, `node:url`) と、cacheした公式Rive Web runtimeだけで、`package.json`/lock変更やnpm installはない。authoringにはlocal companionが**必要**（公式 `rive.exe 1.3.0` + Node loopback server）；login、cloud、publish、CLI再配布は使っていない。

この結果は独立した技術proofの成立を示す。Rive backendの採用、公開製品へのCLI/editor組込み、既存RIGとの互換、Owner制作受入は次の判断として残る。
