# WP-037 — 新RIG 追従率の数値欄を読みやすくする

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerの2026-10-05「作業を進めてください」に基づく限定Slice。現在地/担当/turn/cursorはSTATUSが所有する。制作受入/採用/pushはOwner。

## Goal

素材上の点を選んだ後、追従率の数値を読み、入力し、既存Apply/Discardへ進めるようにする。quadのcontrols内幅228pxで数値inputが約15.78pxへ縮む実測不足を解消する。End/Root説明のauto幅が入力を圧迫するため、editor-local配置だけで入力幅と折り返しを確保する。操作・保存・native描画の意味は変更しない。

READ: AGENTS→STATUS→TECHNICAL→本Card→DEVELOPMENT「漫画文字とRIG proofの並行導線」→ARCHITECTURE「データの所有」→対象header。過去監査全文のpreloadは不要。

## Scope

開始main/4760db9c16f2af50345916381d45559cec7b1733、live再照合。他者がいるcheckoutであり漫画/文字を含む既存dirtyを保持する。新chat/agent無し、既存TEGAKI｜実装 LUNAへ割当。

LUNA exact WRITE:

- `tegaki_work/advanced/rive-editor/editor.html` のlocal `<style>`内、weight-row/input/outputの配置に必要な最小CSSのみ。quad2列/grid3 3列を維持し、inputとEnd/Root説明を縦に分け、説明を折り返す等で入力幅を確保する。markup/id/testid/ARIA/型/数値範囲/イベントは変更しない。grid専用の重複規則は必要範囲で整理可。
- `docs/ai/WP-037-rive-weight-readability-result.md` NEW: 変更理由、正確な差分、実command結果、未実測を記す。
- `tegaki_work/.cache/rive-editor/wp037/` のみ。司令commander-*はread-only。

司令WRITE: 本Card/STATUS RIG/DEVELOPMENT対象段落/登録/harness/work索引/GITHUB案内/限定audit/cache/Browser測定。同file並列write無し。workerは18729/5174の停止・再起動・API/session/savedへのmutationをしない。CSSは通常配信で読まれるためserver変更/再起動を目的にしない。

## Contract

source唯一正本・公式native出力・raw入力と派生percentの分離を維持する。今回の変更責務はlocal表示配置だけ。

## Tasks

1. LUNAはlocal CSSの最小変更と関連検証を行いreportを返す。
2. 司令は報告/sourceを監査し、actual Browserの各列寸法・raw操作・native不変を限定確認する。
3. 技術結果/UNKNOWNを文書へ反映し監視をPAUSEDへ戻す。

## Acceptance

- quad4欄/grid9欄、controls内幅228pxおよび360px viewportで入力border boxを各64px以上確保する。0/5/50.2/100を読める幅、空欄のcaret、spinnerが数値領域を押し潰さない配置を実Browserで確認。各列を測り、合計幅だけでPASSにしない。
- End/Root説明は入力の下等へ配置し折り返す。既存hidden行、quad2列/grid3 3列、配色/focus/選択/disabledを維持。診断閉状態の横overflowを増やさない。
- 点選択→input focus→raw入力→Discard/Applyの既存動線を維持。5は5、空欄は他点focus/input後も空欄。focus/選択のみdraft/compile/save/History/native pose変更0。派生percentとrawを混同しない。未適用frame/save拒否を維持。
- CSSだけの差分でnative RGBA/透明1xPNG/sourceを変更しない。司令は通常liveをread-only確認し、Apply等のmutationが必要なら独立cache/専用18840のactual editorで一経路だけ確認する。同saved/sessionを共有する第二serverは使わない。
- AI snapshot/testids/visible statusは既存契約のまま。static、実Browser、native、液タブ/性能、Owner受入を分け、未実測をPASSにしない。

## Verification

worker: HTML差分を確認し、`node tegaki_work/build/verify-rive-editor-weights.mjs`、`node tegaki_work/build/verify-rive-editor-grid.mjs`（実在commandはrgで確認）、`node tegaki_work/build/verify-rive-influence-map.mjs`、`npm.cmd run build`（cwd tegaki_work）、`git diff --check`。関連verifierの既存名称が異なる場合は実在するものを使い報告する。可逆的CSSを写す新test/大型fixtureは追加しない。build生成物/SDKコピーを成果へ混ぜない。Browser未実施なら明記して司令へ返す。

司令: 差分/既存raw境界を監査後、actual editorで各input/output寸法、点選択とfocus、raw/Discard、必要なApply、native画素不変を限定確認。文書harness check。WP035/036の全Project/History試験は反復しない。既存共通Transform `paint.append`不一致は他lead対象として分離し修正しない。

## Stop

JS/controller/model/runtime/server/bridge/SDK/CLI変更、第二version/platform/backend、system install/PATH/login/cloud/publish、保存/Project/History/renderer/SOURCE authority変更、旧RIG移行、自由頂点/骨追加/多PNG/IK/物理/Timeline、共通CSS/shortcut/漫画/font、他project/他者process停止、commit/pushは禁止。必要なら具体的根拠を返しHOLD。worker完了報告だけでcloseしない。司令監査後に限定技術結果を反映し、制作受入は未のまま返す。次の未確定Cardは自動実装しない。

## Completion

限定CSS実装と関連検証後、司令がactual Browserを監査。controls228pxでquad入力111.11px/grid入力72.07px、360pxでは150.56px/98.37pxを各列確認、横overflowなし。raw5/空欄/小数・点選択/focus/Discard/公式grid Apply、native RGBA/透明画素不変と通常配信・live未保存/saved保全を確認。[司令監査](../ai/WP-037-rive-weight-readability-audit.md)。PNG追加bytes比較/全embedded操作/液タブ/性能/制作受入は未測定。共通harnessのWP030旧anchor不一致は他lead対象として分離、全PASSへ広げない。技術完了、次Card自動実装なし。
