# Phase 4g — 新アニメテーブルの正式入口化MVP

## 概要

Phase 4a〜4f で、新アニメテーブルはレイヤー同期、セル配置、セル選択、セル長さ、再生ヘッド進行まで到達した。
ただし左サイドバーのアニメアイコンは、まだ旧 `timeline-ui.js` の `ui:toggle-timeline` を開く導線のままになっている。

Phase 4g では、キャンバス表示制御や保存/Exportへ進む前に、左サイドバーのアニメアイコンから新アニメテーブルを開けるようにする。
目的は「ユーザーが普段押すアニメボタンで、今作っている新テーブルが出る」状態にすること。

## 重要な再発防止ルール

過去に Gemini 作業で、`timeline-ui.js` と `animation-table-popup.js` の HTML テンプレート文字列・CSS注入ブロック周辺が壊れ、`Expected a semicolon` 系のビルドエラーが複数回発生している。

- `innerHTML = \`` や `style.textContent = \`` を編集したら、編集箇所の前後50行を必ず読み返し、バッククォート・閉じタグ・波括弧・メソッド境界が崩れていないか確認する。
- `timeline-ui.js` は原則触らない。どうしても触る場合は変更前後の該当メソッド全体を確認する。
- `animation-table-popup.js` のテンプレート文字列を大きく組み替えない。
- `npm.cmd run build` で `Expected a semicolon` が出た場合、推測で複数ファイルを直さず、直近で触ったテンプレート文字列の閉じ忘れを最初に確認する。
- JS側の inline style は追加しない。見た目はCSSクラスで制御する。

## 現在の前提

- `core-engine.js` で `AnimationTablePopup` は `popupManager.register('animationTable', ...)` 済み。
- 旧 `timeline-ui.js` は存在し、ヘッダー内の `USE NEW TABLE` ボタンから新アニメテーブルへ切り替える導線がある。
- 左サイドバーの `gif-animation-tool` は `ui-panels.js` で `ui:toggle-timeline` を emit している。
- `animationSystem.init()` はまだ呼ばない。

## 目標

- 左サイドバーのアニメアイコンを押すと、新アニメテーブル (`animationTable`) が開閉する。
- 旧タイムラインは自動では開かない。
- 旧タイムラインの `USE NEW TABLE` ボタンは、開発中の退避導線として残してよい。
- サイドバー上のアニメアイコンの active 表示は、新アニメテーブルの表示状態と大きく矛盾しないようにする。

## 実装範囲

### 1. 左サイドバー導線

- `ui-panels.js` の `gif-animation-tool` ハンドラを、新アニメテーブルの `popupManager.toggle('animationTable')` または同等の安全な呼び出しへ切り替える。
- 既存の `this.togglePopup('...')` パターンが使えるなら、それに合わせる。
- 旧 `ui:toggle-timeline` は左サイドバーからは原則 emit しない。

### 2. 旧タイムラインとの関係

- 旧 `timeline-ui.js` を削除しない。
- 旧タイムライン側の `USE NEW TABLE` ボタンは残してよい。
- 必要であれば、新アニメテーブルを開く時に旧タイムラインを閉じる程度の小さな整理は可。ただし `timeline-ui.js` の大改造は禁止。

### 3. 表示名・状態

- 可能ならツール表示名やタイトルを「GIFアニメーション」から「アニメテーブル」寄りに少し調整する。
- ただしアイコンSVGや大規模な DOM 構造変更は不要。

## 禁止

- `animationSystem.init()` を復活させない。
- 旧 `animation-system.js` の再生、保存、フレーム生成へ接続しない。
- セル配置に応じて実レイヤーの visible を切り替えない。
- RenderTexture snapshot、保存/ロード、Export、Albumへ触らない。
- `timeline-ui.js` を廃止・大改造しない。
- Phase 4g でセルドラッグ移動、伸縮ドラッグ、範囲選択へ踏み込まない。

## 完了条件

- [ ] 左サイドバーのアニメアイコンで新アニメテーブルが開く。
- [ ] 同じアイコン操作で閉じる、または既存ポップアップ仕様と同じ開閉挙動になる。
- [ ] 旧タイムラインは左サイドバー操作では自動表示されない。
- [ ] 旧 `USE NEW TABLE` ボタンは壊れていない。
- [ ] 通常描画、QAP、レイヤーパネルに退行がない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4g_report.md` と `PROGRESS.md` を更新する。

