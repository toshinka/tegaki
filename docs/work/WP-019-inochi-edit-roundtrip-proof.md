# WP-019 — Inochi2D 編集・保存・再読込の最小proof

状態: BLOCKED / Slice A 技術調査・司令監査完了、native roundtrip未達。発行: 2026-10-03。
Owner依頼: Inochi2Dだけで「編集して保存し直せる」一件の最小検証を実行する。担当は既存のTEGAKI｜実装 LUNA。Local Commanderが契約確定・差分/証拠監査を担当する。
読む順序: AGENTS → STATUS → TECHNICAL → 本Card → ARCHITECTUREのデータ所有 / Animation評価と出力 → 必要なupstream source。

## Goal

既製モデルの再生だけでなく、最小のRaster Partとparameter/keyformを編集し、保存したnative modelを破棄後に再読込して、編集後の評価結果を再現できるか実証する。
TEGAKIへの正式採用やproduction保存schema変更を決めるCardではない。

## Scope

最初の限定Slice（A）は、公式配布SDK/authoring API/native formatのcapability preflightだけ。
LUNAのwrite owner:
- `docs/ai/INOCHI2D_EDIT_ROUNDTRIP_CAPABILITY.md`（根拠・API・必要なbridge・実行可能経路）。
- `tegaki_work/.cache/inochi-roundtrip/`（公式SDK/source抜粋、取得metadata、hash、必要なローカルprobe生成物。gitignore済み）。
このSliceではproof実装ファイルを追加しない。完了時に司令へ結果を返し、次のSlice Bのfile/実行契約はこのCardへ追補してから渡す。
司令だけが本Card、STATUS、索引/登録/案内、manifestを更新する。workerはこれらを変更しない。

## Contract

- 開始checkout `D:\GitHub\tegaki` / `main` / HEAD `2165a6010f2d64a100ee33efc927637af83c8cc1`。開始時のAGENTS/TECHNICAL/GITHUB、就任カード/導線整備の全dirty差分を保持。
- production JS/CSS、package/lock、Project schema、History、Pixi renderer、Native RIGを変更しない。別project/Backup/PastFilesを探索しない。
- 実際の公式loader/evaluatorを使わず、JSON.stringify/parseだけや自作変形計算をnative roundtrip PASSにしない。
- main sourceと配布SDKの世代差を記録する。配布tagだけでsource一致を保証しない。取得URL、日時、SDK bytesのSHA256、source SHA/ABIを識別する。
- source読解、Node/native runtime、Browser、画素、Project統合、Owner受入を別判定にする。
- ダウンロードは公式Inochi2DのSDK/sourceだけ。配布物はcache内、アーカイブは絶対path/`..`を検査してから展開する。システムへのtoolchainインストールや上流の大幅forkはしない。

## Tasks

Slice A:
1. 現行worktreeを確認し、範囲外dirtyを保持する。
2. 公式SDKの入手とWASM import/export/付属header/wrapperを確認。実行可能なら最小のinstantiate probeまで行う。
3. nativeモデルのPart Mesh、1D parameter binding/keyform、保存/再読込のsource経路を特定する。load/setParameter/update/draw、編集setters、serialize/write native payloadを区別する。
4. 「既存native payloadを外部編集して再ロード」「上流authoring setter→上流serializer」「必要な小bridge」を別案として比較。どこをTEGAKIが自作するか示す。
5. 次の実行Slice Bに必要なexact files/API/SDK/fixture/commandsと、missing APIを報告する。未知のAPIを実装済みと推測しない。

## Acceptance

Slice A: 下記をcapability reportに明記できたら完了。
- 取得した公式配布物・source・hashと世代差。
- Part mesh/keyform編集、native serialize、native reload/evaluateの実在APIと未公開API。
- 実行経路の最小案と、成立しない場合の具体的blocker。
- Slice Bのfile listと、成功判定に必要な実測。

最終proofの目標（Slice Bの契約確定前は実行しない）:
1つの小さなPart、1つのparameter/keyformを編集し、native loader/evaluatorで0 / 0.5 / 1の評価結果を得る。保存bytes→新規instance→再評価が一致し、元モデルとの意図した差を確認する。編集を元へ戻す経路と壊れた入力の拒否を確認する。
Native model自体の操作proofと、TEGAKI GUI/Project統合の成立を混同しない。

## Verification

source証拠はpinned SHA + path/line/API。runtime probeはcommand、imports/exports、エラーと入力を保存する。
cache生成物はuntracked成果へ混ぜない。ダウンロード失敗は経路と原因を記録し、可能なら通常の承認付きnetwork操作で公式取得を試す。同じ失敗を無制限に反復しない。
worker完了後、司令が報告と根拠を監査し、次Sliceの契約を確定する。独自validator/bridge/patchの量を記録する。

## Stop

新しい保存正本、production統合、renderer変更、システムtoolchain導入、第三のrig evaluator、対象file追加、大幅upstream patchが必要なら止め、具体的な最小判断を返す。
配布WASMと現行sourceが違う場合は、差を解消せずに現行APIが使えると扱わない。
他Card/他候補へ自動継続しない。次の担当への送信はしない。ローカル担当と司令の往復だけで進める。

## Completion

2026-10-03 司令監査結果: [capability report](../ai/INOCHI2D_EDIT_ROUNDTRIP_CAPABILITY.md)のsource根拠、WASM exports、取得hashを確認し、instantiate/init probeを再実行してPASS。モデルload/update/draw、編集、保存、reloadの実行成功ではない。現配布WASMにはmesh setter/native保存APIがなく、対応するmain sourceのbinding復元helperはnullを返し、binding保存もコメントアウトされている。source世代とbinaryの一致はActions日時/APIに基づく推定で、埋込みSHAによる直接証明ではない。

Slice Bは開始しない。Cardの最終目標を満たすには、旧v0.8系と一致する再現可能なWASM buildの確保、またはmain binding経路の修復とauthoring/save bridgeのbuildが必要。toolchain導入と大幅upstream patchは現CardのStopに該当するためHOLD。次契約の推奨は旧系のsource/build固定から必要bridge量を調べること。backend採用の可否は未決定。

製品231 filesのaggregate SHA256は開始時と同一（97A5F7C015A753CE907EA50E0F14CFE60A3D7E62377D955069CAC4D027CF423D）。AGENTS/TECHNICALの開始時hashも同一。HEADは開始時と同一。Browser/画素/TEGAKI統合/Owner受入は未実施。監視は具体的blocker整理により停止し、他Cardへ自動継続しない。

workerはSTATUS（完了したSlice / BLOCKED）、START / FINAL HEAD、worktree、取得物/変更file、根拠、実行結果、PROVEN / INFERRED / UNKNOWN、Slice Bの最小案を返す。
完了通知を優先し、司令の進捗確認は10〜15分間隔を上限にし、短い間隔で全文logを読み返さない。新しい失敗・完了・Owner入力には必要な時だけ対応する。
Local Commanderが最終proofを監査し、成立範囲と残る責任を返す。Owner受入・push・backend採用は別判断。
