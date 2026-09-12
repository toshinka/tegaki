# Manga Region Prompter v3.8
## 新チャット引き継ぎ書 — Reference Cast / IP-Adapter

作成日: 2026-09-12
用途: ChatGPT通常チャットをMRP開発の司令塔として再開するための引き継ぎ

---

## 0. 新チャットのGPTへ最初に伝えること

この文書を読んだ新チャットは、EasyReforge Manga Prompter（MRP）の実装担当ではなく、原則として **設計・判断・作業Card作成・報告書監査を行う司令塔** として振る舞うこと。

実装はCodexまたはGeminiへ、対象ファイル・作業範囲・受入基準・停止条件を限定したCardで依頼する。ユーザーが明示的に求めない限り、このチャット自身がリポジトリを広範囲に調査・改修したり、作業を勝手に拡大したりしない。

目的はトークンを節約しながら、現在も日常利用しているMRP v3.7.7を壊さず、Reference Cast / IP-Adapter機能を段階的に追加できるか判断することである。

---

## 1. プロジェクトの位置づけ

MRPはEasyReforge / stable-diffusion-webui-reForge上で、漫画ページの複数コマ・複数領域へ異なるpromptをSingle-Passで適用する拡張機能である。

- 現在も実際の漫画生成に使用している。
- 本流ではComfyUI / H3系の高精度版も別途検討・開発している。
- ただしReForge版には軽さ、速さ、まとまり、独自の生成結果という価値がある。
- ReForge版は「捨てる旧版」ではなく、**v3.7.7 Frozen Baselineを守るLTS的完成版** として維持する。
- v3.8は全面改造ではなく、既存の味を残した限定的な機能追加とする。

---

## 2. 正本・実行ミラー・旧型バックアップ

次の契約を今後の全作業で厳守する。

| パス | 役割 | 編集規則 |
| --- | --- | --- |
| `D:\GitHub\tegaki\EasyReforgeExtension` | 唯一の正本。Git・実装・設計書・報告書 | **Codex / Geminiはここだけ編集する** |
| `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\easyreforge-manga-prompter` | reForge実行用ミラー | **直接編集禁止。Dからのみ反映** |
| `E:\EasyReforgeExtension` | 旧型バックアップ | **参照・編集・比較・同期すべて禁止** |

E実行用ミラーが通常コピーかNTFSジャンクションかは、Windows実機で確認する。どちらでもDだけを正本とする原則は変わらない。

旧資料にある三箇所完全同期ルールは廃止済み。旧 `E:\EasyReforgeExtension` をAIへ探索させない。

---

## 3. 現在の基準状態

### 3.1 Frozen Baseline

基準バージョンは **MRP v3.7.7**。

v3.7.7までに確立済みの重要事項:

- STYLE → PAGE → REGIONのprompt役割分離
- Nコマに対するN+2 BREAK Slot契約
- BREAKの空Slotを削除しない位置保持型パース
- Global Effect branchとRegion branchの分離
- main conditioningからRegion本文を除去し、全画面漏洩を抑制
- Exclusive / Overlap領域関係
- ControlNetのコマ枠構造との併用
- Canvas-firstのSelect / Slice / Draw Rectangle
- Group Gutters、8方向resize、Undo / Redo
- 物理Region IDと論理コマ番号の分離
- コマ番号drag & drop swap
- Preflight、Branch Map、LoRA scope診断

### 3.2 PromptのSource of Truth

```text
Slot 0 = STYLE
Slot 1 = PAGE
Slot 2 = logical koma 1
Slot 3 = logical koma 2
Slot 4 = logical koma 3
...
```

`koma N:` は人間向けラベル兼診断情報であり、mapping命令ではない。実際の割当はBREAK Slot位置が正本。

### 3.3 Regionの二重ID

```text
stable_region_id      = 動かない物理領域ID
logical_koma_number   = prompt・読み順・Reference割当を結ぶ論理番号
```

コマ番号swapでは物理矩形を動かさず、論理番号と色を交換する。v3.8のReference割当も論理コマ番号へ保存し、生成直前に物理maskへ解決する。

### 3.4 凍結ファイル

次は変更禁止。

- `scripts/manga_attention.py`
- `scripts/manga_spatial_engine.py`
- reForge本体
- `extensions-builtin/sd_forge_controlnet`
- `extensions-builtin/sd_forge_ipadapter`

変更が必要に見えても、AIの判断で編集せず、理由・接続上の問題・代替案を報告して停止する。

---

## 4. v3.8の基本設計

基本設計書は次に格納済み。

`D:\GitHub\tegaki\EasyReforgeExtension\計画書\MRP_v3.8_Reference_Cast_IPAdapter_基本設計書.md`

v3.8の本質は「IP-Adapter入力欄」ではなく、次の **Reference Cast System** である。

### 4.1 Reference Card

- Character: 顔・髪・人物全体
- Outfit: 衣装・配色・装飾
- Prop: 放送用TVカメラなどの物体・機材
- Performance: 表情・ポーズ・演技。後期段階

### 4.2 Logical Koma Assignment

- Cardを各論理コマへUIで明示的に割り当てる。
- 自然文中の人名を自動検出してリンクしない。
- 内部IDと表示名を分離する。
- `CharacterA` という単語をモデルに理解させる方式を主系統にしない。
- Cardの任意prompt assistを対象Region promptへ追加できる。

### 4.3 IP-Adapter接続方針

- MRPのAttention HookへIP-Adapter処理を直接混ぜない。
- reForge内蔵ControlNet / IP-Adapterへ、外部制御経路から参照画像とRegion maskを渡すBridge方式を第一候補とする。
- ユーザーがControlNet UIで設定したUnitを上書きしない。
- Region maskを渡せない場合、全画面IP-Adapterへ自動fallbackしない。
- Reference機能だけを無効化し、既存MRP生成は継続する。
- 安全なBridgeが成立しなければ、画像参照統合はComfyUI / H3版へ移管する。

---

## 5. 期待する用途と限界

| 用途 | 見込み | 注意点 |
| --- | --- | --- |
| コマをまたぐ人物A/Bの再現性向上 | 高 | 完全固定ではなく、ぶれを減らす補助 |
| AとBを別コマへ割当 | 中～高 | Effective Region Maskと複数Unit共存に依存 |
| 同じ顔で衣装を変更 | 中～高 | Face参照を強くし、全身参照を抑える |
| 同じ衣装の維持 | 中 | Character参照との同時利用は負荷・干渉が増える |
| 放送用TVカメラの正しい形状 | 中～高 | Prop画像と具体的promptを併用する |
| ポーズ・演技 | IP-Adapter単独では低い | Region promptやOpenPose等を別に使う |
| 同じコマ内の人物A/B完全分離 | 低～中 | コマ内部の個人別maskが別途必要 |

---

## 6. 開発段階と現在位置

### Phase 0 — Environment Probe

実装前に、対象EasyReforge実体で次を確認する。

- reForge / ControlNet / IP-Adapterのversionと配置
- 外部extensionから使えるAPIまたは安定import path
- ControlNet Unit相当型のfield
- 参照画像とEffective Region Maskの渡し方
- maskの極性・shape・resize・Highres fix挙動
- 複数IP-Adapter Unit
- 既存コマ枠ControlNetとの共存
- Unit上限
- MRPとControlNetのhook順
- SDXL系model / preprocessor

成果物:

`計画書\MRP_v3.8_Phase0_IPAdapter_Environment_Probe_Report.md`

Phase 0の完了報告書が存在する場合は、MRP v3.8用の調査か、別プロジェクトの同名調査かをファイル内容と対象パスで確認してから現在位置を更新する。ファイル名だけで完了扱いにしない。

### Phase 1 — Reference Registry / UI

- Card CRUD
- 画像importと相対パス保存
- 論理コマへの割当
- Undo / Redo / Preset保存
- まだ生成へ画像参照を接続しない

### Phase 2 — Prompt Assist

- Card promptを対象Region textへ追加
- BREAK Slot契約とコマ番号swapを検証

### Phase 3 — Single Regional IP-Adapter MVP

- 1コマにつきPrimary Reference 1件
- Region mask付きIP-Adapter
- 人物A/Bの2領域Oracle
- user-owned ControlNet Unitとの共存

### Phase 4以降

- Character + Outfit / Prop
- 複数画像
- FaceID独立検証
- Performance / OpenPose補助

現時点の標準的な次作業は、Phase 0が未完ならCard 00（D/E運用確認）とCard 01（Environment Probe）の指示書作成。Phase 0が完了済みなら、その報告書を監査してGo / Conditional Go / No-Goを判定すること。

---

## 7. GitHub URL台帳の改名方針

### 7.1 推奨結論

`GitHubURL_ERE.txt` はMRP専用台帳として使われているため、正本名を **`GitHubURL_MRP.txt`** へ変更する。

ただし旧Raw URLを過去チャット・旧報告書・外部AI用promptが参照している可能性があるため、旧ファイルを完全削除しない。

推奨構成:

```text
GitHubURL_MRP.txt   = 今後更新する唯一の正本台帳
GitHubURL_ERE.txt   = 非推奨を明記し、新台帳のRaw URLだけを案内する互換stub
```

### 7.2 作業方法

ユーザーの手作業ではなく、Codex / Geminiへ限定Cardとして依頼する。

1. D正本で `git mv GitHubURL_ERE.txt GitHubURL_MRP.txt`
2. headerと文中の旧ファイル名を更新
3. リポジトリ内の参照を `rg` で検索して必要箇所だけ更新
4. 新しい `GitHubURL_ERE.txt` を互換stubとして追加
5. 新旧両Raw URLを記載
6. commit / push後に両URLを確認
7. 変更内容を報告書へ残す

旧台帳をそのまま複製して二重更新対象にしない。旧stubは数行に限定する。

### 7.3 正本Raw URL

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/GitHubURL_MRP.txt
```

旧互換Raw URL:

```text
https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/EasyReforgeExtension/GitHubURL_ERE.txt
```

一度新チャットへ正本Raw URLを渡した後は、各作業後にこのURLを再取得すれば最新の台帳を確認できる。Raw URL自体はpushごとに変更する必要がない。

反映遅延やcacheが疑われる場合は、台帳内の `Latest commit SHA` とGitHub commit URLを照合する。必要なら取得時だけqueryを付けるが、文書内の正本URLは固定のままにする。

---

## 8. GitHubURL_MRP.txtの必須構造

新台帳はURLの羅列ではなく、最新状態を短時間で把握できる索引にする。

```text
Project: EasyReforge Manga Prompter
Baseline: v3.7.7 Frozen
Current Phase: Phase 0 / 1 / 2 / 3
Last Updated: YYYY-MM-DD HH:MM
Latest Commit SHA: <full SHA>
Latest Commit URL: https://github.com/toshinka/tegaki/commit/<SHA>

[LATEST REPORT]
- title
- Raw URL
- status: PASS / CONDITIONAL / BLOCKED

[CURRENT DESIGN]
- MRP_v3.8_Reference_Cast_IPAdapter_基本設計書.md
- Raw URL

[CURRENT SOURCE]
- manga_prompter.py
- manga_canvas.js
- style.css
- frozen core files

[WORK HISTORY]
- date / Card / commit / report / changed files / result
```

最上部だけ読めば現在地点が分かり、必要な場合だけ下の履歴・コードURLへ進める構成にする。

---

## 9. 今後の全作業Cardに追加する完了条件

Codex / Geminiへ渡す全Cardの末尾に、次を必須事項として入れる。

### Documentation & URL Index Completion

1. 作業内容に対応する完了報告書を `D:\GitHub\tegaki\EasyReforgeExtension\計画書` に作成または更新する。
2. `D:\GitHub\tegaki\EasyReforgeExtension\GitHubURL_MRP.txt` を更新する。
3. 台帳の `Current Phase`、`Last Updated`、`Latest Commit SHA`、`LATEST REPORT`、`WORK HISTORY` を更新する。
4. 変更したソース、設計書、報告書のGitHub Raw URLを記載する。
5. 凍結ファイルが未変更であることを明記する。
6. D正本からE実行ミラーへ反映したか、未反映かを明記する。
7. commit / pushを依頼範囲に含む場合は、成功したcommit SHAとURLを報告する。
8. pushを許可されていない場合は勝手にpushせず、ローカルcommitまたは未commitの状態を正確に報告する。
9. `GitHubURL_ERE.txt` 互換stubは、新台帳への案内以外では更新しない。

この完了条件を満たさない作業は、コードが動いても「引き継ぎ可能な完了」と扱わない。

---

## 10. AIとトークンの節約運用

ユーザー申告時点:

- Gemini残量: 約45%
- Codex残量: 約10%

希望運用:

| 役割 | モデル | 使い方 |
| --- | --- | --- |
| 定型調査・実機Probe | Gemini 3.8 Low | 調査項目を固定し、コード改修をさせない |
| 限定実装Card | Codex LUNA Max | 1 Cardずつ。対象ファイルを限定 |
| 難所の原因診断・限定救援 | SOL ExHigh | 失敗原因または小さな修正だけ |
| 重大なGo / No-Go監査 | Astra Low | 読むファイル、質問、出力長、停止条件を厳しく制限 |

原則:

- 同じ調査を複数AIへ重複依頼しない。
- 一度に複数Phaseを実装しない。
- AIへ「ついでの改善」を許可しない。
- 作業Card外の問題は実装せず、候補として報告させる。
- Astraに広範囲監査や実装を自由裁量でさせない。
- 通常チャットは司令塔として使い、実装環境の長いログや全コードを毎回貼り直さない。
- 最新状態は `GitHubURL_MRP.txt` と最新報告書から読む。

---

## 11. 新チャットが必ず守る判断基準

1. まず `GitHubURL_MRP.txt` のRaw URLを確認する。
2. `Latest Commit SHA` と最新報告書を確認し、過去資料より新しい状態を優先する。
3. v3.7.7凍結境界を維持する。
4. Reference Assignmentは論理コマ番号へ紐付ける。
5. Card表示名の自然言語解析をSource of Truthにしない。
6. Region maskなしの全画面IP-Adapter fallbackを認めない。
7. user-owned ControlNet Unitを上書きしない。
8. 実装前にPhase 0の事実確認を優先する。
9. 安全なBridgeが成立しない場合はreForge本体を改造せず停止する。
10. ComfyUI / H3版へ移せるようCard schemaを生成器非依存に保つ。
11. 実装完了後は報告書と `GitHubURL_MRP.txt` 更新を必須とする。
12. ユーザーの許可なしにcommit / push範囲を拡大しない。

---

## 12. 新チャット開始用の短い依頼文

以下をこの文書と一緒に新しい通常チャットへ渡す。

```text
この文書をMRP開発の現行引き継ぎとして扱ってください。
あなたは司令塔役です。広範囲の実装は行わず、最新状態をGitHubURL_MRP.txtと最新報告書から確認し、Codex/Geminiへ渡す限定Card、結果の監査、次のGo/No-Go判断を担当してください。

最初に、
1. 正本・ミラー・旧バックアップの規則
2. v3.7.7 Frozen Baselineと変更禁止ファイル
3. v3.8 Reference Cast / IP-Adapterの目的
4. 現在のPhaseと次の1作業
5. GitHubURL_MRP.txt更新ルール
を短く復唱してください。

トークン節約のため、資料の長い再要約や複数Phaseの一括作業は不要です。不明点は推測せず、最新台帳・報告書・対象コードだけを確認してください。
```

---

## 13. 新チャットへ最初に渡す資料

最小構成:

1. `MRP_v3.8_新チャット引き継ぎ書.md`（本書）
2. `MRP_v3.8_Reference_Cast_IPAdapter_基本設計書.md`
3. `GitHubURL_MRP.txt` のRaw URL
4. Phase 0以降の最新完了報告書1件

過去のv3.7.2～v3.7.7報告書を毎回すべて添付する必要はない。必要になった場合だけ `GitHubURL_MRP.txt` から該当資料を読む。

---

## 14. 現時点での次の作業候補

### Card A — URL台帳改名・互換stub作成

- `GitHubURL_ERE.txt` を `GitHubURL_MRP.txt` へ `git mv`
- 旧名で互換stubを新規作成
- リポジトリ内参照を更新
- 新台帳に基本設計書を追加
- commit / push範囲はユーザー指示に従う

### Card B — Phase 0状態確認

- MRP v3.8用Phase 0報告書の有無と対象パスを確認
- 未実施ならProbe指示書を作成
- 実施済みなら報告書を監査し、Go / Conditional Go / No-Goを判定

同時実行はせず、原則としてCard A完了後にCard Bへ進む。これにより以後の全成果を新しいURL台帳へ集約できる。

---

## 15. 補足: UI表示ルール

カラー／白黒表示切替ボタンは、現在状態ではなく **押すと何に変わるか** を表示する。

- カラー表示中: `白黒表示へ`
- 白黒表示中: `カラー表示へ`

この仕様はv3.7.5で反映済みのため、将来のUI改修で元へ戻さない。
