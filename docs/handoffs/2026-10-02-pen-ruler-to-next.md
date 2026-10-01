# 引き継ぎ — ペン刷新・定規 完了点（2026-10-02）

状態: HANDOFF SNAPSHOT（2026-10-02）。現在地の正本は[STATUS](../STATUS.md)。この文書を第二の進捗正本にしない。
基準: `main` = `54eaf7e8`（定規 merge 後）。前担当chatのcontext残量が尽きたための引き継ぎ。

## まず読む

1. repo直下 `AGENTS.md`
2. [STATUS](../STATUS.md)（BRUSH UPGRADE / DISPLAY DPR / PANEL LAYOUT / RULER / OWNER BACKLOG の各節）
3. [TECHNICAL](../TECHNICAL.md)
4. 次に着手する題材のWP（集中線などはまだWPなし → 下の「次の候補」を元にカード化）
5. 参考実装: [WP-010 コマ割り](../work/WP-010-panel-layout.md)（popup / 純幾何 / overlay / Raster追加1Undo の流儀の見本）

```powershell
git status --short --untracked-files=all
node tegaki_work/build/development-harness.mjs check
node tegaki_work/build/development-harness.mjs test drawing
node tegaki_work/build/development-harness.mjs test ruler
```

## 完了済み（すべて main 取り込み済み）

| 題材 | PR | 要点 / 主なfile |
|---|---|---|
| ペンサイズ上限500 | #2 | |
| 描画engine刷新（pen / 消しゴム / airbrush） | #3 | 共通dab engine（float16 stroke mask + max合成）、筆圧One-Euro、入り抜き、ヒゲ除去、速度/傾き、筆圧2次元カーブ、ブラシプリセット、ひも補正、patch History、縮小表示mipmap。全変更は`TEGAKI_CONFIG.brushEngine`のflagで旧挙動へ戻せる。`system/drawing/brush-core.js`ほか。検証`build/verify-pen-brush-engine.mjs` |
| 表示DPR分離 | #4 | 作品側extractは`resolution: 1`固定。DPR表示は既定OFF（Owner判断: 書き出しと見た目を一致させる）。検証`verify-history-display-dpr-resolution.mjs` |
| コマ割り | #6〜#8 | 別chatが実装（WP-010） |
| 定規（平行線 / 放射線） | #5 | R=ON/OFF、Shift+R=種類、定規ON中Shift+ドラッグ=中心で移動・周囲で回転(Ctrl 15°)。純幾何`system/ruler-geometry.js`、表示/入力`system/drawing/ruler-system.js`、吸着は`brush-core._snapToRuler`、編集ドラッグの振り分けは`drawing-engine._handlePointerDown`。検証`build/verify-ruler.mjs`（domain `ruler`） |

## Ownerの残作業・未確認

- **PR #5がGitHub上でopenのまま**: baseが既にmerge済みの`claude/display-dpr`だったため、git pushでmainへ直接mergeした。PR #5のbaseをmainへ変えれば自動でmerged表示になる（不要ならclose）。
- 定規の規約整備後（ふたば配色化・Shift取り逃し修正）の液タブ実機確認は未。
- WP-010 コマ割りのOwner受入も未（別chat担当）。

## Ownerの好み・判断（作業前に知っておくこと）

- 優先はメインペンの「レスポンスと美観」（クリスタ / Procreate水準）。鉛筆風など派生ブラシは遠回り。
- 操作は「説明なしで自然に触れる」を重視。定規は一度モード方式を試作したが、Shift方式の方が自然として戻した。
- 色はふたば配色のみ（`styles/main.css`のtoken。白・灰・黒・青はUI/既定値に使わない）。native form部品はコマ割りpopup CSSの「ふたば配色のform部品」節と`.ui-scrollbar`を参考に。
- Ownerは最終受入とpushの権限をClaudeにも付与（撤回まで有効）。報告は日本語で、実機（液タブ）未確認なら明記する。

## 次の候補（OWNER BACKLOG。優先順はOwner判断）

1. **集中線ツール**（要望最強）: 放射線定規の`ruler-geometry.js`（中心・方向）を流用できる。生成は「中心＋外周の範囲＋本数＋線長/入り抜き/ばらつき」をpopupで調整し、確定時にRaster Layerを1Undoで追加する形がコマ割りと揃う。描画engineにCanvas2Dを混ぜない（確定時の画素生成は`panel-layout-raster.js`の方針に従う）。
2. 傾けられるグリッド定規、ドラフター型の直線定規（定規系の次段）。
3. トーン（スクリーントーン）。
4. QTPのペンスロット（プリセット6枠の行）。定規のQTP化は不要とOwner判断済み。
5. GPUパーティクル（興味あり、token消費と相談）。
6. ひも補正: 使い道の研究後に糸ガイド表示などのブラッシュアップ。

## 環境メモ

- Windows、repo `D:\GitHub\tegaki`、Vite dev server `http://localhost:5173/tegaki_work/index.html`（Browser paneで確認。pane幅が0になる場合は`resize_window` 1024×768で検証し、終わったらdesktopへ戻す）。
- `gh` CLIなし、Browser paneはGitHub未ログイン。PRの作成・base変更・mergeはGitHub API認証がないとできないため、必要ならOwnerへ依頼するか、権限内でgit merge→pushする。
- harness `ui` suiteは既存失敗4件（verify-animation-table-utility-lod-production / verify-rig-workspace-host-ownership / verify-right-layer-caf-focus-production / verify-right-rig-pre-mesh-candidate-focus）。新規失敗の判定はこれとの比較で行う。
- 実PointerEventでの検証は`info.rawClientX/rawClientY`（線補正前）と補正後座標の違いに注意。自動操作のShift keyupは`shiftKey:true`で届くことがある。
