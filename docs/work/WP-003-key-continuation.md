# WP-003 — KEY確定後の連続編集

## Goal

Layer Transformを閉じずにKEYを確定し、矢印/strip wheelで同じClipの次Frameを編集できる。前作業のpanel消失を解決する。

## Scope

読む: [Transform session](../ARCHITECTURE.md#transform-session)、[F-004](../AUDIT.md)。
変更可: `tegaki_work/system/layer-system.js`、`system/layer-transform.js`、`ui/animation-table-popup.js`のbridge/session箇所、必要時のみ`ui/keyboard-handler.js`と`ui/ui-panels.js`のV同期、関連実行型verifier。
新しいKEY/schema、全Popup分割、WARP UI、原画bake品質、旧履歴の巻戻しは禁止。

## Contract

- LayerSystemが入力session、PopupがClip KEY/Timeline Historyを所有する既存同期adapterを維持。
- pendingは淡色丸。明示確定後は濃色丸/設定済み表示、History一件。
- 未変更確定とFrame移動は新しいHistoryを作らない。
- 未確定中のFrame strip移動は現行どおり拒否し、先にKEY確定を促す。暗黙commitへの変更は別判断。
- 移動は同じClip内、通常wheelはCAFを作らない。SOURCEでstripを出さない。

## Tasks

1. 2Layer/2Frame以上のCAFで再現。commit→finish→resumeのactive ID、working target集合、adapter begin reasonをdebug限定で一回捕捉。
2. 実際の失敗原因へ限定補修。根拠なしのrAF再試行や全state再初期化で覆わない。
3. 失敗経路もpanel/toolbar/Keyboard/Camera V/sessionを一貫させる。既存event送受信を全検索してpayloadを維持。
4. 実production経路を呼ぶ回帰を追加。関数名のsource assertだけで再入場成功と判定しない。

## Acceptance

- 変形→KEY確定後、同Frameでpanelとhandlesが維持され、再操作可能。
- 設定済みdot/Frame表示が一致し、Timelineは対象internal Layer行だけへ単色丸。
- prev/next/wheel、Clip両端、兄弟Layer非干渉を確認。
- Escape、Table close、V再入力、失敗したbeginで幽霊session/toolbar状態なし。
- 一回のKEY確定はHistory 1、Frame移動/入場は0、Undo/Redoとsave/reopen後KEY一致。

## Verification

```powershell
node tegaki_work/build/development-harness.mjs test transform
node tegaki_work/build/development-harness.mjs test ui
```

変更JS構文/build、Browser実操作、console、History件数を記録。前作業の「F2 commitでpanel消失」が修正後再現しないことを示す。

## Stop

Frameを跨ぐ新しい永続session、暗黙KEY、保存正本の移動、既存KEY消去が必要なら根拠を整理。異なるUI案を修復へ混ぜない。

## Completion

原因と修正、実行型回帰、上記Browser結果、未確認範囲をleadが確認。最終の操作感はOwner受入として別記する。
