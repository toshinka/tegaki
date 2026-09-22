# TEGAKI Browser Drawing — WebSOL 引継ぎ

状態: ブラウザお絵かきツール専用の引継ぎ。記録日: 2026-09-23。これは実装Cardでも制作受入宣言でもない。数値と状態の正本は現行コード、GUI部品の使い方は[GUI作法辞典](TEGAKI_GUI_COMPONENT_CONVENTIONS.md)を参照する。

## A. PROJECT IDENTITY

対象は `D:\GitHub\tegaki` の `tegaki_work/` にある、ブラウザ内で描画・アニメーションを制作するTEGAKI。Layer、Transform、Animation Dock、Timeline、RIGはこの製品の範囲に入る。同じリポジトリ内の `ComfyUIPortable/`、Manga/H3生成GUI、Scene/CAST/Guide生成モデル、Reference画像によるAI生成制御、ComfyUIPortableのStage Layoutは別ワークフローであり、この引継ぎの実装対象ではない。

## B. CURRENT SNAPSHOT

- 記録時点: branch `main`、HEAD `d8bebf5cad2a5341db07b34c862126af250ff61b`、`git status --short --untracked-files=all` は空（clean）。HEADは将来の開始条件ではなく、この時点のsnapshot。
- 直前に未commitと報告されたTransform GUI部品語彙の変更と作法辞典は、現HEAD `d8bebf5c` に含まれる。対象は `tegaki_work/styles/main.css`、`tegaki_work/styles/components/layer-transform-basic.css`、`tegaki_work/styles/components/layer-panel-surface.css`、`tegaki_work/ui/dom-builder.js`、`docs/gui-sensei/TEGAKI_GUI_COMPONENT_CONVENTIONS.md`、`tegaki_work/build/verify-layer-transform-progressive-controls.mjs`。今回の文書編集はまだcommitしない。
- このCardの終了時には `docs/gui-sensei/README.md` の入口追加と本引継ぎ文書が未commitで残る。製品コードの未commit変更ではない。次チャットは下の作業後statusを実際に再確認する。
- [STATUS](../STATUS.md) のGUI以外を含むcheckpointは2026-09-18時点で、このGUI snapshotより古い。技術契約は[TECHNICAL](../TECHNICAL.md)、現行動作は対象コードと最新の実装報告で再確認する。新チャットは必ず自分の開始時にbranch、HEAD、worktreeを取り直す。未commitのローカル変更が公開GitHubにもあるとは推定しない。

## C. COMPLETED GUI — 実装と受入を分離

- Canvas-firstと単一Pixi Canvasは現行の技術契約。右WorkspaceはLayer面とTransform面を同じ枠内で置換する。[主スイッチの投影とStatus移動](../../tegaki_work/ui/right-workspace-frame.js)は既存Transform panelの `.show` とDock状態を参照し、別のTransform状態を作らない。
- 右Workspace上端に薄型 `LAYER | TRANSFORM`。Transform内に `BASIC | WARP`、POINT/BRUSH、MOVE/INFLATE/PINCHがあり、[DOM owner](../../tegaki_work/ui/dom-builder.js)は既存handlerへ共通classを付ける。[main.css](../../tegaki_work/styles/main.css)がFutaba tokenとS/M/L・segment状態の正本。[layer-transform-basic.css](../../tegaki_work/styles/components/layer-transform-basic.css)はInspectorの局所配置とWARP rangeを所有する。
- [layer-panel-surface.css](../../tegaki_work/styles/components/layer-panel-surface.css)は透明なWorkspace、局所cream glass、viewport基準の右アクションレール、Layer一覧の内部スクロールを定義。[Animation Dock CSS](../../tegaki_work/styles/components/animation-table-utility-lod.css)は下部Dockの外殻、リサイズ端、Timeline領域とfooterを定義する。Statusは単一DOMを右WorkspaceまたはDock slotへrehostする。
- 直前SOLのBrowser報告では、実Artworkを背後に置いたBASIC/WARPの可読性、segmentのselected/unselected hover・focus、狭いWARP Inspectorの内部スクロール、透明空白での描画とスライダー上の誤描画なし、V/Esc/確定/取消を確認した。ただしこの引継ぎCardではBrowserを再実行していない。これを全viewport、pen、ANIMATE/KEY、Owner制作受入へ拡大解釈しない。

## D. CRITICAL INVARIANTS

- Workspaceの透明な空白はCanvasへ描画入力を通す。Layerカード、主/副スイッチ、Inspector操作部品、右レール、Animation Dockの実操作領域はUI入力を所有する。見た目の透過とPointerの透過は別々に検証する。
- Dockの高さ・開閉やLayer数は右レールのviewport基準位置を動かさない。Dock内部は描画入力をCanvasへ通さない。狭い画面でのみ必要なレール内scrollは操作到達性を守る。
- 主スイッチはTransform状態の表示であり、新しい編集state machineではない。入場guard、V、Esc、確定、取消を迂回しない。未確定Transform中のLAYER押下だけで暗黙に確定・破棄しない。
- Transform確定とANIMATE KEY確定は別操作。SOURCEはpreview後にRaster bake、ANIMATEは対象KEYへ確定する。History、保存正本、working Layerと通常Layerの境界を混ぜない。
- 旧RIG Workspace/資産は右Workspaceへの能力移行を実証する前に撤去しない。上記はコード・[TECHNICAL](../TECHNICAL.md)・Owner要求からの維持契約であり、全経路のBrowser受入済みという意味ではない。

## E. GUI COMPONENT CONVENTIONS

実装時は暫定版の[TEGAKI_GUI_COMPONENT_CONVENTIONS.md](TEGAKI_GUI_COMPONENT_CONVENTIONS.md)を読む。そこに現行import経路、共通class/token、S/M/L、primary/secondary/compact segment、selected/hover/focus/disabled、glassとPointer ownership、Browser確認項目がある。CSSが数値・色・状態表現の正本で、この文書へ値を複写しない。作法辞典は現行Transformで成立した範囲の使用規約であり、外部Web/GUIデザイン資料との照合と必要な改訂を経てから適用範囲を広げる。現在の寸法・配色を永久固定仕様としない。

## F. OPEN WORK / UNKNOWN

1. Animation Dock内部: 子Layer行、`+ MORE`、アクティブFrame/Timeline文字、数値操作の可読性と材質。完成済みDock外殻の透過・geometryを作り直す仕事ではない。
2. Transform terminal/reset: V、Esc、主スイッチ、KEY確定、既存 `layer:reset-transform` の接続を次Cardで整理する。現行の `✓ 確定` / `× 取消` は存在し、廃止済みではない。KEYとTransform確定、取消とUndoを同一視しない。
3. 数値wheel UX: 既存step/min/max、Inspector内部scroll・Canvas zoomとの競合、History境界の設計と実装は未完了。
4. ANIMATE/KEY Browser fixture: 直前SOLではDockを開いた通常LayerへのTransform入場が既存guardで拒否され、KEY未設定/設定済みの実画面に到達できなかった。guardをPASSと記録しても、KEY表示の全経路PASSにはしない。
5. RIG: 旧能力の保持と、将来の右Workspace GUI/機能整理が残る。研究候補や旧資産を、完成した新RIGとは書かない。

## G. NEXT WORK ORDER

候補はDock内部のglass/可読性、Transform terminal/resetの操作整理、数値wheel UXの限定改修。新WebSOLは最新成果とOwner意向を確認し、次のCardを一件だけ選ぶ。引継ぎを読んだだけで複数Cardを自動開始しない。作法辞典の外部資料照合、RIG本格改修、Astra横断監査は必要時に別々に扱う。

## H. COMMANDER OPERATING RULES

材料・実装報告 → WebSOLが統合/重複除去 → 必要時のみAstraへ限定裁定 → Codexへbounded implementation → WebSOLが一次監査。Astraを通常実装に常設せず、LOWを標準とし、重大な意味境界・中核契約でのみMEDIUM/HIGHを検討する。推論レベルを上げても調査範囲・ファイル数・作業量は拡大しない。Cardには変更owner、do-not-touch、Browser/技術の受入、検証予算、STOP条件を明記し、同責務を複数agentへ二重実装させない。古いHEADを固定ゲートにせず、技術PASS・Browser PASS・Owner制作受入・pushを別々に報告する。

## I. FIRST STEPS FOR A NEW WEBSOL

1. この引継ぎ文書を読み、対象がブラウザお絵かきツールか確認する。
2. [GUI作法辞典](TEGAKI_GUI_COMPONENT_CONVENTIONS.md)を読み、必要に応じて[gui-sensei入口](README.md)から関連研究だけ選ぶ。
3. ユーザーが提供する最新Codex報告を受け、branch/HEAD/worktreeと未完了事項を照合する。Codexがローカルrepoを使える場合は[STATUS](../STATUS.md)→[TECHNICAL](../TECHNICAL.md)→対象ownerの順で読む。
4. 次に変える箇所の既存CSS/DOM/handler ownerとDoDを確認し、Ownerに次の一件を確認する。

WebSOLがユーザーのローカル `D:` ドライブを直接読めるとは仮定しない。必要な本文・報告はユーザー提供の添付/貼付、または確認可能な公開repositoryで受け取る。公開repositoryがローカル未commit差分を含むとは仮定しない。

### 新WebSOLチャットへ貼る開始文

> ブラウザお絵かきツールTEGAKIの司令塔業務を引き継いでください。ComfyUIPortable、Manga、H3生成GUIとは別件です。添付/貼付した `docs/gui-sensei/TEGAKI_BROWSER_DRAWING_WEBSOL_HANDOFF.md` と `TEGAKI_GUI_COMPONENT_CONVENTIONS.md` の本文を順に読み、最新Codex報告のHEAD/worktreeと未完了作業を確認してください。ローカルDドライブや未commit差分を直接読めると仮定せず、読了だけで次Cardを自動発行しないでください。まず理解した現在地と次の一件の候補を返してください。
