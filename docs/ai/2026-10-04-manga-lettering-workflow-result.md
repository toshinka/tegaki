# WP-027 — 漫画文字の制作動線検証

状態: REFERENCE EVIDENCE / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。2026-10-04、main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。契約は[WP-027](../work/WP-027-manga-lettering-workflow.md)。既存WP023/024/025と独立WP026の差分を保持、commit/push無し。

## 結果

文字パネルを幅316px・本文11px・24px以上の主buttonへ揃え、既存Futaba背景64%とblurを使用。独自paper fallback・hover/active色・border tintを共通paletteへ寄せた。文字入力2行、書体/比較、基本サイズ、縦横/太字/文字色を常設。context bodyだけscroll、footerは兄弟elementとして固定。

書式/配置線/変形が設定とCanvas対象を同時切替。切替で効果を消さず、設定済みの印を残す。末尾サイズは変形へ移動。新しい先頭/中央profileは追加していない。9点の強さcontrolは非表示/disabled。font情報は初期閉、UI-only localStorageで開閉保持。回転はUI度→従来radのまま保存。

下端の「選択レイヤーを編集」はアクティブ文字recipeの読込。font file importではない。新規は「新規レイヤーに追加」、再編集は「更新」が主操作で「別レイヤーに追加」は副操作。Ctrl+Enterで主操作成功後に閉じる。通常Enter改行、IME/repeat除外、二重確定防止。変更なし再編集はHistory追加無し。失敗・確定中の追加入力はpanelを残す。×/tab切替のhideはdraft保持、取消は未確定編集を戻す。通常hideをauto commitへ変更していない。

共通numeric helperへoptional numberInputを追加。range/number上のwheel、Shift10倍、範囲/step、空欄/disabled/readOnly除外とdetachを検証。既存range/valueElの直接編集と変換callerは保持。漫画4tabは即時、sidebarの通常open animationは保持。scale中のvisual rectangleをanchorへ使わず、layout座標とtarget寸法でviewport clamp。

## 証拠

- Node構文、numeric behavior、editable-lettering 6、fonts 5、balloon 1、panel-layout/focus/ruler/shortcut、Project 10、harness check、Vite production build PASS。
- 実Chromium、専用loopback5181、新規scratch tabs。製品画面でrange wheel64→65、書式/配置線/変形、フォント比較接続、情報openのreload保持、Ctrl+Enterによる追加→読込→文章変更→更新を確認。実キー入力のHistoryは追加1＋更新1、読込後の文章は「再編集できる」。
- `build/wp027-lettering-workflow-browser.html`で実製品iframe、実font/Layer/Historyに対して確認。1280×720、360×640、360×400。footer初期到達、通常書式scroll不要、詳細body scrollでもfooter不動、mode/effect保持、degree変換、9点で強さ非表示、4外tab即時/画面内、通常open、IME/repeat/二重確定、変更無し・更新Undo、失敗変更0、遅いcommit中の追加入力保持、取消後元sprite復帰。
- 既存WP025 Browser fixture全PASS。実ProjectManager export/load後の画素とrecipe、PNG/合成capture、UndoRedo、手描き後更新拒否、旧Project/font不在、遅いpreview取消を再確認。warm曲線preview中央値2.10ms（取得時間を含まない）。rendererを今回改修した証拠としては扱わない。
- 実装画面: `C:/Users/MAX/.codex/visualizations/2026/10/03/01a101f4-fdbf-7623-8288-2f90c7d960e4/wp027-lettering-format.png` と `wp027-lettering-curve.png`。

## 限界・次の単位

Owner制作・液タブ/coarse実機の受入は未。通常desktopで評価できる状態。今回の対象は文字パネルと共通漫画tab。吹き出し/コマ/集中線の内部group再編と新しいサイズprofileは別の限定単位。Project/History/renderer/font配置・RIG proofは変更しない。既存広範囲UI suiteの未解決9件はこのSliceのPASSへ読み替えず、今回は関連検証に絞った。

numeric workerはLuna MAXの独立2filesのみ。leadはreportだけでcloseせず、実操作/統合を確認。短いSliceへ継続的なポーリングは行わず完了通知を使用。
