> 状態: ARCHIVED — 2026-09-05再構成前の記録。元の場所: `AGENTS.md`。本文中の「現行」「次の作業」は当時のもの。現在の入口は `docs/README.md`。

# AGENTS.md — AIエージェント共通ガイド

> [!IMPORTANT]
> 作業開始時にこのファイルを最初に読む。
> 技術方針・禁止事項の正本は `TEGAKI.md`。衝突時は `TEGAKI.md` を優先する。

## 1. 読む順序

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. 今回の指示書
   - Phase作業: `task-codex/phase*.md`
   - 小修正: ユーザー指示と `PROGRESS.md`
4. 指示書から参照された境界文書・proposal

過去Phaseの詳細は `開発用資料保管庫/Archive/` にある。現行判断へ古いPhase記述を持ち込まない。

## 2. 作業範囲

- 実装対象: `tegaki_work/`
- 現行Phase指示: `task-codex/`
- 未実装計画: `開発用資料保管庫/proposals/`
- 完了文書: `開発用資料保管庫/Archive/`
- `PastFiles/` と `Backup/` はオーナー管理の退避物。明示指示なしに編集・削除・差分調査しない。
- GitのPUSHと最終実機判定はオーナーが行う。

ユーザーや他AIの変更を維持し、対象外の差分を巻き戻さない。

## 3. 安全な編集

- 変更箇所を限定し、JSファイル全体の置換を避ける。
- 100行超の一括削除、主要classの再構成、DOM構造の大幅置換は、明示された計画範囲でない限り事前に相談する。
- 新規class・関数・イベントを作る前に `rg` で既存実装を検索する。
- EventBus変更前に同名イベントの送受信側とpayloadを全検索する。
- CSSで表現できる装飾をJSのインラインstyleへ追加しない。
- 動的座標・寸法・CSS custom propertyは、必要な範囲でJSから設定してよい。
- 調査用ログは削除する。残す場合は `TEGAKI_CONFIG.debug` 配下とし、目的を明記する。
- ビルド失敗時は最初の原因へ絞る。無関係なファイルを連鎖修正しない。

## 4. 描画・モデル境界

- 本番描画は PixiJS RenderTexture へのライブラスター焼き込み。
- 背景は特殊な不透明Layerで、通常Layerの結合・消去対象外。
- 通常LayerとCAF内部LayerはUIを共有しても、データ正本とHistoryを混同しない。
- CAF編集は animation working Layerを表示・入力アダプターとして使う。TimelineModel / ClipAsset / DrawingSnapshotが保存正本。
- Layer Panel / CAFの共有方針は「1つのUI engine、2つのdata adapter」。
- SDF/MSDFとWebGPU brushは正式Phaseまで凍結。WebGPU / WebGL2 Meshは、現行Phase指示と `TEGAKI.md` が明示的に許可し、CPU一致・fallback・export境界を維持する限定adapterだけ採用できる。

## 5. UI・CSS

- カラーは `TEGAKI.md` のパレットと `styles/main.css` のCSS変数を使う。
- icon、記号、文字、背景へ黒・白・neutral grayを安易に使うことを禁止する。`black` / `white` / `gray`、`#000` / `#fff`系の直書きだけでなく、未指定でbrowser既定の黒へ落ちるcontrolも残さない。
- 基本はふたば茶系。active / currentは橙を第一候補とし、Setupの青、成功・接続の緑、警告・破壊の赤は役割が明確な場合だけ、既存semantic変数または共通変数を追加して使う。
- Unicode記号やSVGも親要素任せにせず、componentの通常・hover・active・disabledすべてでpalette内の`color` / `stroke` / `fill`を確認する。
- 色、スクロールバー、button、form、popupの見た目を追加する前に、`styles/main.css` の既存変数・共通classを `rg` で検索する。
- 共通定義がある場合は必ず参照し、その場で近似色やcomponent専用scrollbarを新設しない。
- 命名とスタイル判断は `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md` を参照する。
- 既存classの一括リネームは行わない。触るcomponent内で互換性を保ちながら段階整理する。

## 6. 検証

変更規模に応じて次を行う。

```powershell
node --check <変更したJSファイル>
Set-Location tegaki_work
npm.cmd run build
```

- UI変更は可能ならブラウザで対象操作とconsole errorを確認する。
- 描画、D&D、Undo/Redo、保存/復元は、関連する実操作まで確認する。
- build後に `git status --short --untracked-files=all` を確認する。
- `tegaki_work/dist/` の生成差分を成果物として残さない。

## 7. 文書更新

- `PROGRESS.md` は現在状態、既知残存、次の入口だけに保つ。
- 完了Phase指示書は `開発用資料保管庫/Archive/` へ移す。
- proposalは未実装計画の正本。実装済み内容を残タスクとして残さない。
- `実装したいことメモ.txt` はオーナー向け簡略版であり、詳細仕様はproposalへ置く。
- UI/CSSスタイルガイドは毎変更ではなく、UI整理Phase完了時または不整合監査時にまとめて更新する。

## 8. AI連携

- Codex: 現行の主実装、ローカル調査、設計境界、文書同期、ビルド・ブラウザ確認。
- 外部AI: 計画案、レビュー、限定成果物の作成。提案は実コード照合後に採否を決める。
- オーナー: 優先順位、実機確認、バックアップ、Git操作、最終決定。

外部AIの計画書はそのまま実装契約にせず、存在するfile・event・classと照合してから `task-codex/` へPhase化する。

### Codex Multi-Model委譲

- 主taskはSOLが設計・境界判断・監査・Phase closeを担当する。LUNAへは、対象file、既存契約、Acceptance Criteria、検証、停止条件が確定した一つの限定Sliceだけを委譲する。
- project workerは`.codex/agents/tegaki-luna-worker.toml`を使う。LUNAが新しいArchitecture、保存schema、History、Layer / CAF / Rig / Mesh境界の判断を必要とした場合は変更せず`BLOCKED`でSOLへ返す。
- LUNAの報告だけで採用・closeしない。SOLが全diff、対象外変更、verifier / build、生成物、文書整合を再監査する。利用不能時に別modelへ暗黙fallbackしない。
- 初期導入ではread-only probeを先行し、SOL判定後だけwrite pilotへ昇格する。現在の権限と詳細手順は`tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`および現行Phase Gateに従う。

### PixiJS公式Agent Skills

- PixiJSを調査・変更する時は、`TEGAKI.md`と現行Phase指示書の後に`tegaki_work/node_modules/pixi.js/skills/pixijs/SKILL.md`を入口として読み、routerが示す関連skillだけを追加で読む。
- 公式skillはPixiJS v8 APIの参照資料であり、Tegakiの描画・保存・History境界を上書きしない。特にWebGPU / Canvas renderer、HTML source、mask channel、transient MSAA等をskillの一般推奨だけで有効化しない。
- v7形式の`Application(options)`、`app.view`、`BaseTexture`、`@pixi/*`分割package等を新規導入しない。既存互換コードを触る場合は実importとv8.19 APIを照合する。
- `node_modules`が未導入でskillを読めない場合は推測で補完せず、`npm.cmd install`が許可された作業か確認する。Web外部AIはPixiJS公式Skills / docs URLを参照する。
