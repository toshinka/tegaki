# WP-027 — 漫画文字パネルの制作動線

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。2026-10-04 Ownerが設計後の実装・確認を指示。[検証記録](../ai/2026-10-04-manga-lettering-workflow-result.md)。開始main/f245c354。既存dirty、WP-026独立proofを保持。

## Goal

文字入力・書体・基本サイズを残した目的別tabと、常時見える下端actionに整理する。他漫画と同じ密度・Futaba glassへ揃え、数値wheelと漫画tabの即時切替を導入する。根拠は[設計](../ai/2026-10-04-manga-panel-workflow-design.md)。

## Scope

- Lead WRITE: `tegaki_work/ui/lettering-popup.js`, `styles/components/lettering-popup.css`, `ui/manga-tabs.js`, `styles/components/panel-layout-popup.css`, 本Card・結果report・STATUS・登録簿・work索引・harness。
- 限定worker WRITE: `tegaki_work/ui/numeric-field.js`, `tegaki_work/build/verify-numeric-field.mjs`。既存range/valueEl callerを保持しoptional numberInput（range無しも可）を追加。workerは他者差分を巻き戻さない。
- Lead test WRITE: `tegaki_work/build/wp027-lettering-workflow-browser.html`, 必要時既存WP025 fixtureの検証追加のみ。
- 他漫画の設定group再編・新サイズprofile・renderer/Project/History/adapter・global keyboard/RIG/packageは変更しない。共通tab切替は4漫画に適用。

## Contract

- 幅316px、本文11px、主control24px以上。透明背景とpaletteは既存Futaba。font情報初期閉・UI設定保持。bodyだけscrollし共通入力とfooterを残す。
- 書式/配置線/変形はCanvas対象と設定を同時切替、tab移動でparamsや適用効果を消さない。末尾サイズは変形へ。回転UI度、保存rad。
- footer「選択レイヤーを編集」「新規」、新規時「追加」、再編集時「更新」と副action「別レイヤーに追加」。読み込みは文字recipeの再編集でありfont importではない。
- Ctrl+Enterはこのpopup内で追加/更新成功後に閉じる。IME/repeat除外、失敗・適用中の追加入力は開いたまま。取消・通常hide/tab切替は確定しない。二重commitを防止する。変更無し再編集shortcutはHistoryを追加しない。
- wheelは数値control上のみ。Shift10倍、範囲・step保持、disabled/readOnly除外。回転1度、行送り0.05等の意味に沿う刻み。既存caller互換。
- 漫画tab切替の開く演出のみ抑止。サイドバーopenの演出保持。位置はlayout座標を使いviewport内へ収める。

## Tasks

既存controlをcontextごとに再配置し、共有numeric helperへ接続。4漫画の切替理由を既存tab moduleで管理し、通常openとtab表示を分ける。既存WP025 recipeの再編集・確定経路を保持する。

## Acceptance

1280×720と狭幅で、文字入力・書体・基本サイズ・確定欄が常時見え、目的tabから直接その設定へ到達する。IME/二重確定/失敗/確定中入力を保護し、既存保存・Undo/Redoの動作を維持。

## Verification

構文、numeric behavior、editable-lettering/font/balloon/shortcut関連、harness/build。Chromium製品画面1280×720と360pxでfooter到達、設定tab/効果保持、数値wheelと通常scroll、font情報reload、outer tab即時/通常open、Ctrl+Enter追加・再編集更新・取消・失敗・二重入力を確認。実Layer/History/Project往復はWP025 fixtureで再確認。BrowserとOwner制作受入は区別。

## Stop

保存/renderer正本・別project・WP026 proofには触れない。

## Completion

技術検証をlead確認後technical complete、Owner操作感/pushはOwner。
