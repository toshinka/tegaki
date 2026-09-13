# SwarmUI Manga Extension 開発総合計画書
Version 0.1

## 1. プロジェクトの目的

SwarmUI + ComfyUI を生成基盤として利用し、漫画・複数領域画像の制作に特化した視覚的なフロントエンドをSwarmUI拡張として実装する。

通常のComfyUIノードグラフをユーザーに意識させず、A1111 / Forge系に近い操作感を維持する。

主目的は、雑なネームやページ構成から、

- ページ全体の生成条件
- 任意位置に配置した矩形領域
- 各領域専用プロンプト
- 各領域に関連するLoRA
- Wildcard / Preset
- Seed等の生成条件

を明示的に管理し、「厳密なレイアウト制御」ではなく「指定範囲内にそれらしい人物・構図・内容を生成する」漫画制作補助環境を構築することである。


## 2. 基本方針

### 2.1 SwarmUIをフォークしない

初期段階ではSwarmUI本体を改造しない。

SwarmUI Extensionとして実装する。

SwarmUI本体の変更が不可避であることが実証された場合のみフォークを検討する。

理由は、

- SwarmUIの更新を取り込みやすくする
- ComfyUI側の更新と分離する
- 漫画機能の開発に集中する
- 将来的に拡張単体で配布できるようにする

ためである。


## 3. システム構造

概念構造は以下とする。

SwarmUI Manga Extension
↓
Manga UI
↓
Manga Project Data
↓
Prompt / Region Compiler
↓
SwarmUI
↓
ComfyUI Backend
↓
Checkpoint / LoRA / Control系
↓
生成画像


ユーザーが通常操作するのは Manga UI までとする。

ComfyUI Workflowは高度な設定・デバッグ時のみ使用する。


## 4. UIの基本構成

専用の Manga タブを追加する。

### 左側：ページキャンバス

ページ全体を表示する。

ユーザーはマウス操作で矩形領域を作成できる。

例：

┌────────────────────────┐
│ ┌──── Panel 1 ──────┐ │
│ │                   │ │
│ └───────────────────┘ │
│                        │
│ ┌───────┐ ┌─────────┐ │
│ │Panel 2│ │ Panel 3 │ │
│ └───────┘ └─────────┘ │
└────────────────────────┘

矩形は、

- 移動
- リサイズ
- 複製
- 削除
- 並び替え
- 名前変更

が可能であること。


### 右側：Region / Panel Cards

矩形を作成すると自動的に対応するカードを生成する。

例：

Panel 1

Prompt:
[　　　　　　　　　　　　　　]

Negative Prompt:
[　　　　　　　　　　　　　　]

LoRA:
[ Character A ] 0.8

Strength:
[ 1.0 ]

Seed:
[ -1 ]


キャンバス上の矩形とカードは常に1対1対応する。

矩形をクリックすると対応カードを選択する。

カードをクリックすると対応矩形を強調表示する。


## 5. Global / Master設定

ページ全体に適用する設定を独立させる。

最低限、

- Checkpoint
- VAE
- Master Prompt
- Global Negative Prompt
- Global LoRA
- Sampler
- Scheduler
- Steps
- CFG
- Seed
- Width
- Height

を持つ。


Master Promptは、

- 品質
- 絵柄
- 漫画ページ
- モノクロ / カラー
- 全体構図
- 共通キャラクター属性

などを指定するために使用する。


## 6. Regionデータモデル

UI内部ではSwarmUI固有のPrompt Syntaxを直接保存せず、構造化データを持つ。

例：

{
  "id": "region-001",
  "name": "Panel 1",
  "x": 0.05,
  "y": 0.05,
  "width": 0.45,
  "height": 0.40,
  "strength": 1.0,
  "prompt": "girl running, low angle",
  "negativePrompt": "",
  "loras": [],
  "seed": -1
}

座標は基本的に0～1の正規化座標として保存する。

画像解像度を変更しても領域比率が維持される構造とする。


## 7. Prompt Compiler

内部Regionデータから、SwarmUIが理解できるプロンプトへ変換する層を設ける。

概念：

Master Prompt

+

Region 1
x / y / width / height
Prompt 1

+

Region 2
x / y / width / height
Prompt 2

をSwarmUI Regional Prompt Syntaxへ変換する。

重要：

UIコード内の各所でSwarm構文を直接組み立ててはならない。

必ず、

Manga Project
↓
Prompt Compiler
↓
Swarm Prompt

という一箇所の変換層を通す。

SwarmUIの構文仕様が変更された場合、この層だけを修正できる構造にする。


## 8. LoRA

既存のIllustrious系LoRA資産を重視する。

Raw Promptでは、

<lora:AAA:0.1>

のような表現を保持できること。

加えてGUIからLoRAを追加できるようにする。

将来的には、

Global LoRA

と

Region LoRA

を分離する。

ユーザーが大量のLoRAを利用することを想定し、

- 検索
- お気に入り
- LoRA Set
- Weight
- ON/OFF
- 並び替え

を実装可能なデータ構造にしておく。


## 9. Wildcard / Preset

Wildcard、Preset等のSwarmUI独自構文を破壊しない。

Raw Promptに記述された未知のSwarm Prompt Syntaxは可能な限りpass-throughする。

漫画UIは「独自の完全なプロンプト言語」を作らない。

SwarmUIのPrompt Syntaxを利用し、その上に視覚UIを構築する。


## 10. Generation Mode

最終的には最低3方式を想定する。


### Mode A：Regional Page

ページ全体を一度に生成する。

各Panel矩形をRegional PromptとしてSwarmUIへ渡す。

用途：

- 雑ネーム
- アイデア出し
- 群像
- ページ全体のラフ
- 構図ガチャ


### Mode B：Separate Panels

Panelごとに独立生成する。

生成後にページへ配置する。

用途：

- 本番漫画
- 人物品質優先
- 各コマの修正
- キャラクターLoRA切り替え


### Mode C：Hybrid

まずRegional Pageを作成。

その後、選択したPanelのみ再生成 / Inpaint / Object refineする。

最終的にはこれを漫画制作の中心モードとする。


## 11. MVP

Version 0.1では機能を絞る。

実装対象：

1. Manga専用タブ
2. ページキャンバス
3. 矩形作成
4. 矩形移動
5. 矩形リサイズ
6. Regionカード生成
7. Master Prompt
8. Region Prompt
9. Region Strength
10. Swarm Regional Promptへの変換
11. Generate
12. 生成画像表示

Version 0.1では実装しない：

- 吹き出し
- セリフ生成
- OCR
- 自動コマ割り
- キャラクター整合性システム
- ControlNet高度管理
- Separate Panel生成
- Photoshop的レイヤー
- 自動ネーム解析


まず、

「矩形を置く → Promptを書く → Regional生成できる」

ところまでを完成させる。


## 12. 第2段階

MVP完成後に、

- プロジェクト保存
- プロジェクト読込
- LoRA GUI
- Wildcard GUI
- Preset
- Region複製
- Region並び替え
- Seed固定
- Region単独再生成
- Separate Panels

を追加する。


## 13. 第3段階

漫画制作機能として、

- ネーム画像読込
- ネームを背景に表示
- パネル位置トレース
- ControlNet連携
- キャラクター参照画像
- IP-Adapter系
- Panel単位Inpaint
- 自動顔修正
- 自動手修正
- ページ合成

を検討する。


## 14. 第4段階

必要性が確認された場合のみ、

- 吹き出し
- セリフ
- テキストレイヤー
- ページ管理
- 複数ページプロジェクト
- キャラクター管理
- 衣装管理
- シーン管理

へ進む。


# 15. Codexを使った開発方法

本プロジェクトではCodexに全機能を一度に実装させない。

開発仕様を「分冊」する。


## 恒久文書

リポジトリルート：

AGENTS.md

ここには、

- プロジェクト目的
- 絶対に変更してはいけないもの
- コーディング規約
- SwarmUI本体を原則変更しない
- Extension内で完結させる
- テスト方針
- ファイル命名
- エラー処理方針

など短い恒久ルールだけを書く。


## 全体仕様

docs/00_MASTER_PLAN.md

本書を置く。

これは設計上のSource of Truthとする。


# 16. 実装分冊

以下の順序で一冊ずつ作成する。


## 第1冊
「SwarmUI調査・環境固定・Extension骨格」

内容：

- 対象SwarmUI revision
- 対象ComfyUI revision
- Portable構成
- Extension API調査
- 使用可能なhook
- Mangaタブ追加方法
- 最小Extensionコード
- 起動確認方法
- デバッグ方法

この冊だけで、

「空のMangaタブがSwarmUIに表示される」

ところまで完成させる。


## 第2冊
「Manga Projectデータモデル」

内容：

- Page
- Region
- Prompt
- LoRA
- Generation Settings
- JSON Schema
- ID管理
- 座標系
- version migration

この冊だけでデータ層を完成させる。


## 第3冊
「矩形キャンバスUI」

内容：

- Canvas
- Rectangle
- Drag
- Resize
- Selection
- Delete
- Duplicate
- Region card連動

ここではAI生成処理には触れない。


## 第4冊
「Prompt Editor / Region Cards」

Master PromptとRegion PromptのUIを完成させる。


## 第5冊
「Swarm Regional Prompt Compiler」

構造化RegionからSwarm Prompt Syntaxへ変換する。

ここでは実際のサンプル入力と期待される出力を大量に定義する。


## 第6冊
「Swarm生成接続」

GenerateボタンからSwarmUI / ComfyUI生成処理へ接続する。


## 第7冊
「LoRA統合」

大量LoRAを扱えるUIとデータモデルを実装する。


## 第8冊
「Wildcard / Preset統合」

Swarm Prompt Syntaxとの互換性を確立する。


## 第9冊
「Project Save / Load」

漫画プロジェクトを独自JSONとして保存・復元する。


## 第10冊
「Separate Panel / Hybrid生成」

Regional Page方式から本格的な漫画制作方式へ拡張する。


# 17. 各分冊に必ず含める内容

各冊は一般的な解説書ではなく「Codex実装指示書」とする。

必ず以下を含める。

1. この冊の目的
2. 完了条件
3. 非対象
4. 現在のディレクトリ構造
5. 新規作成ファイル
6. 変更するファイル
7. 変更禁止ファイル
8. データ構造
9. API
10. 関数シグネチャ
11. 実装サンプルコード
12. UI構造
13. エラー処理
14. テスト
15. 手動確認手順
16. 完成時のファイル構造
17. Codexへの実行指示
18. 完了報告フォーマット


# 18. Codexへの重要ルール

Codexには毎回、

「可能なら実装してください」

のような曖昧な指示を出さない。

例：

第3冊の仕様を実装してください。

docs/00_MASTER_PLAN.md と AGENTS.md を上位仕様としてください。

第3冊で明示されていない機能を追加しないでください。

SwarmUI coreは変更しないでください。

作業前に現在のリポジトリ構造を確認してください。

仕様と現在のコードが矛盾する場合、推測で大規模変更せず報告してください。

実装後に指定されたテストを実行してください。

最後に、
- 作成ファイル
- 変更ファイル
- テスト結果
- 未解決事項
を報告してください。


# 19. 分冊作成時の重要原則

分冊内にSwarmUI本体の巨大なコードを丸ごとコピーしない。

代わりに、

対象ファイル
対象クラス
対象関数
利用するExtension API
必要最小限の参照コード

を記載する。

理由は、SwarmUI更新による文書の陳腐化を防ぐためである。


# 20. Version固定

実装開始時には必ず、

SwarmUI revision
ComfyUI revision
Python version
主要依存ライブラリ

を記録する。

分冊内の具体的コードは、そのrevisionを基準に作成する。

「一般論としてこう動くはず」ではなく、

「現在チェックアウトされているソースコードでは実際にどうなっているか」

を確認してからコード例を書く。


# 21. 最重要設計原則

漫画UIはSwarmUIやComfyUIの代替物を作るものではない。

既存機能を再実装しすぎない。

役割は、

ユーザー操作
↓
漫画向け構造データ
↓
SwarmUI / ComfyUIが理解できる入力

へ変換することである。

生成技術そのものは可能な限りSwarmUI / ComfyUIに任せる。

これによって、将来的に新しいSampler、Checkpoint、LoRA、Control方式等が登場しても追従しやすくする。


# 22. 最初の到達目標

最初の成功条件は非常に単純である。

1. SwarmUIを起動する
2. Mangaタブを開く
3. Canvasに3個の矩形を配置する
4. Master Promptを書く
5. 各矩形に別々のPromptを書く
6. Generateを押す
7. SwarmUI Regional Promptとして生成される

これが安定して動いてから次の機能へ進む。