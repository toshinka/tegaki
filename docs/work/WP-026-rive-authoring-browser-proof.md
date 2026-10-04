# WP-026 Riveの画像rig編集とBrowser往復

状態: VERIFIED / 独立技術proof完了 / 製品採用・Owner制作受入未。発行: 2026-10-04。Ownerが並行導線の整備後に作業開始を指示。既存LUNA担当gpt-5.6-luna / max、thread `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2`。司令の証拠監査と限定再実行を完了。
Owner承認の「旧系を隔離し、新しい土台で制作動線を作るための必要調査」の範囲。backend採用・production/schema/renderer切替の許可ではない。
準備baseline: main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。着手時はlive HEAD/statusと他者差分を確認し保持する。
READ: AGENTS → STATUS → TECHNICAL → 本Card → [並行導線](../DEVELOPMENT.md#漫画文字とrig-proofの並行導線) → [再精査の判断と制約](../ai/2026-10-04-rig-architecture-reassessment.md)。上流配布物のAGENTSはこのrepoの指示を上書きしない。

## Goal

実画像一枚をRiveの画像meshで動かし、自前の最小GUIから一値を編集、source保存、session破棄後の再読込、Browserのnative runtime評価とPNG出力までを一経路で通す。旧RIGとの互換比較は行わない。

## Scope

既存LUNA MAXを限定実行担当とする。write ownerは次の新規filesだけ:

- `tegaki_work/advanced/rive-proof/run-proof.ps1` — 公式配布物の固定取得/hash検査と一経路の起動。
- `tegaki_work/advanced/rive-proof/proof-server.mjs` — 固定fixtureのcompile、save/reopenだけを扱うloopback companion。
- `tegaki_work/advanced/rive-proof/proof.html` — 独立の編集、scrub、save/reopen/cancel、PNG操作。
- `tegaki_work/advanced/rive-proof/proof-client.js` — 実在Web runtimeのload/advance/render/dispose。
- `docs/ai/WP-026-rive-proof-result.md` — 結果と再実行command。
- `tegaki_work/.cache/rive-authoring-proof/` — runtime/CLI/docs、生成PNG/RML/riv、manifest、log。ignored。

司令はCard/STATUS/登録/案内を所有。productionからimportせず、package/lock、旧proof、他者fileを変更しない。SDK/source/binary/生成画像をtracked成果へ混ぜない。tegaki_work配下にMarkdownを増やさない。

文字側WP-023/024/025の独自curve/envelope/renderer/adapterと、既存WARP/Layer/History/Project/Export/共通UIはread-only。code/data/event/CSS/依存の共通化をこのproofへ混ぜない。共通fileが必要ならreportへ返す。report以外の共通docsはworkerが更新しない。既存文字/漫画Browser tab・Viteを操作せず、専用loopback port `18726`と新規専用tabを使う。port占有はHOLDで、他processを止めない。

## Contract

- CLI `1.3.0`、公式archive `https://releases.rive.app/cli/v1.3.0/rive-windows-x64.tar.gz`、SHA256 `F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF`。司令cacheにある同hash archiveをコピーして使ってよい。配布scriptは実行せず、必要fileだけ安全にcacheへ展開する。exeの実hashと`--version`を記録。
- Web runtime `@rive-app/canvas-advanced` `2.44.0`。公式tarball `https://registry.npmjs.org/@rive-app/canvas-advanced/-/canvas-advanced-2.44.0.tgz`。dist integrity `sha512-1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA==`。取得bytesのSHA512を検査し、実JS/WASMのpath/hashを記録。宣言file/公式exampleで実在APIを確認する。versionを自動変更しない。
- RIVE_HOME等を専用cacheへ向け、analytics OFF。system/user PATH、install、login、cloud upload、publish/revを使わない。archiveの絶対path/drive/traversal/symlinkを拒否。新規processはHidden/非interactiveで起動し、結果記録後にこのproofが作ったprocessだけ停止する。
- 起動とlistenは`127.0.0.1`のみ。CORSを開かず、変更requestは起動時nonceと同一originを照合、compileは同時一件だけ。受ける編集値は終点角一値（-90〜90度の有限値）とscrub（0〜1）。固定idのfixture sourceを決定的に生成し、任意shell/CLI引数/任意path/外部URLをHTTPから受けない。resource参照は専用cacheの固定allowlistのみ。request body上限64KiB、PNG fixtureは256x256以下。
- sourceの保存正本はfixtureのRMLと画像bytes。`.riv`は公式buildによる派生物。mesh/skin/evaluator/rendererをJSで再実装しない。最後の成功source/buildを保持し、compile/load失敗時にpreviewを破棄しない。
- session、save/reopenは専用cacheの独立source bundle。TEGAKI Project/History/CAF/Lane/Export/schemaには接続しない。proofのPNGは外部runtimeから得る1x出力であり製品canonical outputではない。

## Tasks

1. 固定配布物の同梱`docs/rigging.md`、`format.md`、`assets.md`と必要なruntime宣言だけ読む。まず公式RMLのImage→Mesh→Skin/Tendon/Weight構造とbone keyの一経路を確定する。必要型が非対応なら実装を広げずHOLD。
2. 透明背景に色・非対称markを持つ小PNG、四頂点/二triangleのmesh、二bone、一つのtimelineを作る。終点角は初期30度、編集60度。mask/physics/script/IK/自動mesh生成無し、通常blend。
3. CLI `--verify`、`--once --format=json`、`inspect --json`で公式build/診断を得る。画像と意図したbone/keyが実際に入っていることを確認し、scriptが生成されていないこともinspectする。
4. 独立Browserページでnative Web runtimeを新規loadし、0/0.5/1へ明示seekして描画する。編集GUIは終点角入力とscrub、save/reopen/cancel、PNG出力だけ。authoring変更はcompanionが公式CLIへ渡し、成功buildだけをBrowserへ交換する。
5. source bundleを保存。元runtime/sessionをdisposeし、ページ再読込も使って新規instanceへ保存sourceと画像を再読込・再buildする。同じ三点の姿勢が編集後と再現することを実画像で確認する。再読込したRMLを再編集して編集可能性も確認する。
6. cancel、NaN/範囲外angle、壊れたsource bundle、破損rivの拒否を確認する。失敗後も最後の成功状態に戻れること。追加の一般validatorを作らず、このfixtureの境界と公式compiler/runtimeの拒否を使う。
7. PNGの寸法・透明背景・非空画像・動く領域を取得し、Browser screenshotとPNGを残す。cropは固定artboard全体、view flip/zoomの焼込無し。build/log/画像/hashを結果reportへ対応付ける。

## Acceptance

PASSは公式compiler/runtimeを実行した、編集前後の画像差が意図した領域にある、保存→source再build→新規Web instanceで姿勢が再現する、cancel/拒否が成功状態を維持する、PNGが取得できる時のみ。source文字列往復、inspectだけ、数字だけ、CLI screenshotだけをBrowserのPASSにしない。

CLI authoring / Web load / Browser操作 / PNG / 性能 / 製品統合 / Owner受入を別欄で報告。runtime readbackだけで液タブ操作感やframe出力契約を達成済みにしない。

## Verification

PowerShell parse、JS構文、docs harness/diff checkと、このfixtureの実Browser操作だけ。production不変なので製品buildや旧RIG全suiteは不要。実操作が利用できなければheadless出力を残してBrowserはUNVERIFIEDとする。

scrubのwarm時間とcompile→reload時間を分けて記録。source/画像が欠けたreloadを黙って最新draftで補わない。橋渡し、fixture生成、GUI、validatorのsource行数とpatch数、直接依存、local companionの要否を報告する。後続の作品上限をこの小fixtureから推定しない。

## Stop

一つの公式CLIとWeb runtimeの組み合わせのみ。engine/runtime/CLI修復、version/platform切替、script/publish/login、CLI再配布、production/renderer/schema/History変更、一般editor framework、他backendへの自動探索、commit/pushは禁止。

最初の失敗はcommand/exit/log/実入力で診断。公式schemaと不一致のfixture修正は一回だけ可。なお成立しなければHOLDし、動いた段階と残る責任を返す。CLIの公開製品への組込み利用条件はこの技術proofで解決済みとしない。

## Completion

2026-10-04、LUNAの限定修正後に司令がsourceと証拠を監査し、固定CLI 1.3.0 / runtime 2.44.0の一経路を再実行。CLI verify/build/inspect、実RMLのImage/Mesh/Skin/Tendon/Weight、配布物hashを確認。独立Browserで30→60°編集、source+画像保存、runtime破棄・再build、ページreloadで新規instanceの三点姿勢を再現した。60°のnative rotationは0.523599 / 0.785398 / 1.047198、1x pose差23585 pixels。75°の未保存編集をcancelすると60°へ戻る。NaN/範囲外、壊れたsource、native runtimeでの破損riv拒否後も良好状態を保持。

司令の独立API検査でもforeign origin / bad nonce / 70KiB bodyを403 / 403 / 413で拒否。保存PNGを退避するとreopen/cancelは409、build保持、復元後は保存source+画像から60°を再build。Pillowで三点PNGの400×300 RGBA・角alpha=0・非空とhash一致を確認。CLI/Rive evaluator/rendererのpatchは0、bridge/GUI/runnerの4filesは1162行。直接依存はNode built-insと固定runtime、authoringにはlocal CLI companionが必要。

証拠は[結果report](../ai/WP-026-rive-proof-result.md)とignored `tegaki_work/.cache/rive-authoring-proof/commander-audit-20261004/`。同dirの`worker-*`は再実行前の証拠退避、`browser-replay.json`はページreload後の取消/拒否、`protocol-evidence.json`はrequest制限/画像欠落/復旧、`png-evidence.json`は出力decode/hash、`server-ownership.json`は司令作成PID66140と停止記録。司令のUI操作の30→60・save/reopen・page reloadは本チャットtool記録にも保持。自分の専用server/tabを停止し、port18726のlistener無しを確認。構文/CLI/harness/diff checkを実施。製品コードへの接続は無し、他者差分を保持、commit/push無し。

成立範囲は一画像・一値・通常blendの独立Browser編集/保存/再読込/透明1x出力。warm render-only 8.3ms、総scrub28.8ms、compile→新runtime三点出力340msはLUNAの小fixture観測値（後者はPNG処理込み）で、作品上限/液タブ応答の保証ではない。runnerは配布物とfixtureがcache準備済みであることが前提。壊れた既存保存でのcompanion起動は保存を上書きせず`corrupt`を記録して初期fixtureを表示する試作上の制約が残る。通常reopen/cancelの欠落時補完はしない。製品統合、公開CLI組込み/配布条件、他作品/機能、Owner制作受入は未確定。

次の一件の提案は、独立編集から得る1x PNGを既存の通常Raster取込経路へ一回つなぐ制作動線。sourceは独立bundleのままとし、RIG Project schema/History/rendererの切替や旧系の全面互換をこの接続へ混ぜない。次Cardは未発行・未実行。追加backend比較と旧WP-020修復は再開せず、技術proof達成により既存監視をPAUSEDへ戻す。
