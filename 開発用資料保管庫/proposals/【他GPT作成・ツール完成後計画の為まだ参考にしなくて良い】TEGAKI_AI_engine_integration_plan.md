# TEGAKI 生成AI連携エンジン構想
## ComfyUI連携・動画生成・透過キャラクター出力・モデル責任分界

- 文書種別: 将来設計の検討メモ
- 主な読者: TEGAKIを調査・設計・実装するCodex／GPT、および開発者
- 対象: 生成AIを第3の連携エンジンとして利用する構想
- 想定用途: 個人利用を中心としたローカル生成
- 初期出力単位: パーツ分けされていない「1キャラクター単位」の動画またはPNG連番
- 重要: 本文書は実装契約ではない。実装前に現行コード、`AGENTS.md`、`TEGAKI.md`、`PROGRESS.md`、現行Phase指示書と照合すること

---

## 1. 目的

TEGAKIでは、以下のような変化は通常の2D演算だけで処理すると工数が大きい。

- 正面顔から斜め顔・横顔への回転
- 顔を斜め上へ向ける
- 腕を画面手前へ突き出す
- 腕を身体の後方へ回す
- 胴体を前後方向へひねる
- 服、髪、輪郭の隠れ方が変わる姿勢
- パースが大きく変化する動き
- 2D Bone／Warpだけでは自然に補完しにくい立体変化

これらを完全なRig、細密Mesh、Live2D型変形だけで解決しようとすると、作画前の準備と調整が重くなる。

本構想では、生成AIを次の目的で利用する。

```text
難しい立体変化を含む短い動画を生成
  ↓
時間的一貫性のある動作候補または作画ガイドとして取得
  ↓
良いFrameを採用
  ↓
崩れたFrameはTEGAKIで描き直す
  ↓
必要なFrameまたは区間だけ再度i2i／v2vする
```

AI生成物を最終完成品またはTEGAKIの保存正本にすることは必須としない。

---

## 2. TEGAKI全体における位置づけ

生成AIは、TEGAKI本体や演算変形を置き換えるものではない。

```text
第1エンジン: TEGAKI手描き／CAF
  コマを描く
  修正する
  Onion Skin
  作画の正本を保持する

第2エンジン: 演算アニメーション
  Clip Motion
  Warp
  Bone
  Mesh
  再利用配置
  Subframe Motion

第3エンジン: 生成AI
  難角度変形
  奥行きを伴う姿勢変化
  動画ガイド
  中割り候補
  別視点候補
  部分再生成

将来の別動画ツール
  素材配置
  合成
  Camera
  Audio
  Effect
  最終編集
```

生成AIエンジンは、TEGAKIに依存しすぎない別プロセスまたは別サービスとして設計する。

---

## 3. 静止画より動画を優先する理由

### 3.1 静止画生成の問題

正面、斜め、横向き等を静止画として別々に生成すると、各画像単体では良く見えても、連続させた際に次が一致しないことがある。

- 顔の大きさ
- 目、鼻、口の位置
- 髪型
- 衣装の細部
- 線の癖
- 彩色
- 身体比率
- 装飾品
- 前後Frame間の速度感

安定した一連の姿勢を得るまで、静止画単位の生成試行を繰り返す必要がある。

### 3.2 動画生成を「一括ガチャ」として扱う

短い動画として一度に生成すれば、試行単位を「1枚」から「1動作」へ移せる。

```text
静止画方式
  Frame Aを生成
  Frame Bを生成
  Frame Cを生成
  各Frame間の一致を人間が調整

動画方式
  AからCまでの動作全体を一回生成
  良い動作候補を選ぶ
  崩れた区間だけ修正
```

動画生成でも完全な一貫性は保証されない。ただし、同一生成処理内で前後Frameが関連づけられるため、作画ガイドとしては静止画の独立生成より扱いやすい可能性がある。

### 3.3 完成品ではなくガイドとして使う

想定運用:

- 生成動画を半透明表示して上から描く
- 良いFrameだけCAFへ変換する
- 崩れた手、顔、服だけ描き直す
- 特定Frameだけi2iする
- 特定区間だけvideo-to-videoする
- 元の作画へ戻せる状態を維持する

AI出力の不完全さを許容し、TEGAKIの手描き修正能力を前提とする。

---

## 4. 初期の出力単位

初期段階では、キャラクターを自動的に髪、顔、腕、胴体、服等へLayer分解することを成功条件にしない。

```text
入力
  1キャラクターの元画像またはCAF
  任意の範囲Mask
  動作指示
  生成設定

出力
  1キャラクター単位の短い動画
  またはPNG連番
  キャラクターのAlpha Mask連番
  生成条件とWorkflow情報
```

パーツ分けは将来機能とする。

候補:

- 人物全体Mask
- 顔、腕、髪等の追加Segmentation
- TEGAKI上での手動Layer分割
- Frameごとの部分Mask修正
- AIによる部品分離候補

---

## 5. 基本アーキテクチャ

### 5.1 推奨する三層構造

```text
TEGAKI AI Request
  TEGAKIに適した高水準の生成要求
        ↓
AI Engine Adapter
  各Runtime固有のWorkflowへ変換
        ↓
AI Runtime
  ComfyUI
  将来の独自Runtime
  他のローカル推論環境
```

TEGAKIの保存正本やCAFを、ComfyUIのWorkflow形式へ直接依存させない。

### 5.2 初期Runtime

初期RuntimeはComfyUIを推奨する。

理由:

- 画像・動画生成Workflowをノードで組める
- HTTP／WebSocket APIで外部UIから利用できる
- WorkflowをJSONで保存できる
- Custom Nodeを追加できる
- Model、前処理、後処理を交換しやすい
- TEGAKI専用UIからノード画面を隠して利用できる

ComfyUIは別プロセスとして起動し、TEGAKIまたは専用AI UIはAPIクライアントとして接続する。

```text
TEGAKI / TEGAKI AI UI
    ↕ REST / WebSocket
ComfyUI Server
    ↕
Checkpoint / LoRA / VAE / Custom Nodes
```

### 5.3 独自化の意味

「独自化」は、必ずしも推論エンジンをゼロから作ることを意味しない。

```text
1. ComfyUIをそのまま使用
2. 固定WorkflowをAPI実行
3. TEGAKI向けCustom Nodeを追加
4. TEGAKI専用フロントエンドを作成
5. Job管理・結果管理を独自化
6. AIEngineAdapterでRuntimeを抽象化
7. 必要な場合だけ推論Runtimeを独自化
```

独自UIや独自ジョブ管理の背後で、ComfyUIを引き続き利用してよい。

---

## 6. ComfyUIに寄せる規則

独自AIエンジンを設計する際、次の考え方はComfyUIに寄せてよい。

- Workflow／Graphによる処理記述
- Nodeごとの型付き入出力
- Workflow JSON
- Queue型のJob実行
- Seed
- Prompt
- Model参照
- 進捗通知
- Cancel
- History
- Result
- Custom Node拡張
- 入力Asset Upload
- 出力Asset Download
- Workflow Version
- 実行条件の記録

ただし、TEGAKI内部の正本をComfyUI形式へ変更しない。

寄せない部分:

- CAFをComfyUI Nodeとして保存正本にする
- ComfyUI Node IDをTEGAKI Asset IDとして使う
- TEGAKI ProjectにAPI用Workflowを直接埋め込む
- 特定Custom Node名をProject必須条件にする
- ComfyUIのUI状態をTEGAKIの保存対象にする
- ComfyUIのUndo／RedoをTEGAKI Historyと共有する

---

## 7. Checkpoint／LoRAの責任分界

### 7.1 基本方針

TEGAKIおよびTEGAKI AI連携ツールは、原則としてCheckpoint、LoRA、VAE等のモデルファイルを同梱・再配布しない。

```text
TEGAKI側
  モデルを使用する接続機能を提供

ユーザー側
  Checkpoint、LoRA、VAE等を任意に用意
  ローカルRuntimeへ配置
  利用条件を確認
```

この分離により、TEGAKI本体と、ユーザーが選択するモデル資産を明確に分ける。

### 7.2 重要な注意

この責任分界は、製品設計・配布物・操作責任を整理するためのものであり、法的責任が自動的に完全分離されることを保証するものではない。

モデル、LoRA、Workflow、Custom Nodeには個別のライセンス、利用制限、出典条件、商用利用条件がある可能性がある。公開または配布を行う段階では、個別条件を確認する必要がある。

### 7.3 TEGAKIが行わないこと

- Checkpointの同梱
- LoRAの同梱
- 無断のModel自動Download
- Model販売サイトからの自動取得
- Model利用権の保証
- Modelの安全性保証
- Model出力品質の保証
- Modelに含まれる学習素材や権利関係の保証
- ユーザーのModel選択をTEGAKI Projectへ強制固定
- 巨大ModelファイルをProject内へコピー

### 7.4 TEGAKIが提供できるもの

- Model参照先の設定
- ComfyUI Runtimeの検出
- 利用可能なCheckpoint／LoRA一覧の読取
- Model Hashの記録
- Model名、Hash、Runtime Versionの生成履歴への保存
- 必要Modelが無い場合のエラー表示
- Workflowが要求する能力の表示
- ユーザー確認付きの設定
- Modelを同梱しないPresetまたはWorkflow Template
- 任意の対応Modelを選択できるUI

### 7.5 保存するのは参照と来歴

TEGAKI ProjectまたはAI Result Packageには、Model本体ではなく参照情報を保存する。

```json
{
  "modelReference": {
    "runtime": "comfyui",
    "checkpointName": "user-selected-checkpoint.safetensors",
    "checkpointHash": "sha256:...",
    "vaeName": "user-selected-vae.safetensors",
    "loras": [
      {
        "name": "user-selected-lora.safetensors",
        "hash": "sha256:...",
        "strengthModel": 0.8,
        "strengthClip": 0.7
      }
    ]
  }
}
```

ファイルの絶対Pathを共有用Projectへ保存すると他環境で無効になりやすい。保存時は論理名、Hash、ユーザー定義Aliasを中心にする。

### 7.6 Model解決

Runtime起動時またはJob投入前に、Adapterが必要Modelを解決する。

```text
Workflow要求
  checkpointAlias: character-video-default
        ↓
User Model Mapping
  character-video-default
    → D:/AI/models/checkpoints/example.safetensors
        ↓
ComfyUI Workflowへ変換
```

このMappingはユーザー環境固有の設定とし、Project本体へ直接埋め込まない。

### 7.7 Compatibility

Modelごとに対応能力が異なるため、Adapterは可能なら次を確認する。

- Image-to-Video
- Video-to-Video
- Mask Input
- Control Input
- LoRA対応
- 推奨解像度
- 最大Frame数
- 対応Precision
- 必要VRAM
- Alpha出力可否
- Batch対応
- Seed固定
- 使用可能なSampler
- 使用可能なScheduler

完全な自動判定が難しい場合は、ユーザーがPresetへ能力情報を登録できるようにする。

---

## 8. Custom Nodeの位置づけ

### 8.1 最初から独自Nodeを作らなくてもよい

```text
既存Nodeで作った固定Workflow
  ↓
TEGAKIが画像、Prompt、Seed、Model名を差し替える
  ↓
ComfyUI APIへ送信
```

これで有効なWorkflowと出力形式を検証する。

### 8.2 TEGAKI向けCustom Node候補

生成モデルそのものより、入出力とメタデータを整えるNodeを優先する。

```text
TEGAKI Load Character
TEGAKI Load Mask
TEGAKI Load CAF Range
TEGAKI Character Video Output
TEGAKI Matte Refine
TEGAKI PNG Sequence Export
TEGAKI Result Package
```

### 8.3 Custom Nodeは実行コードである

Custom Nodeは単なるPresetではなく、サーバー上で動く実行コードを含み得る。

推奨:

- TEGAKIが自動で不明なCustom NodeをInstallしない
- Install前にNode名、配布元、Versionを表示
- 信頼済みNode一覧を持つ
- Workflow不足Nodeの一覧を表示
- Node更新後の互換性を確認
- AI RuntimeをTEGAKI本体とは別プロセスで動かす
- Remote接続時は認証とNetwork設定を明示する

---

## 9. TEGAKI専用AI UI

### 9.1 通常ユーザー向け

ComfyUIのNode Graphを常時見せる必要はない。

```text
入力素材
  現在のCAF
  選択Clip
  読み込んだPNG
  選択Frame範囲

動作
  左へ振り向く
  右へ振り向く
  斜め上を見る
  腕を手前へ出す
  腕を後ろへ引く
  身体をひねる
  Custom Prompt

長さ
  1.5秒

出力FPS
  12 / 24 / 30

キャラクター保持
  弱 / 中 / 強

背景
  Mask生成
  単色背景
  元背景維持

出力
  Preview動画
  PNG連番
  RGB + Mask連番
```

### 9.2 Advanced Mode

- ComfyUIでWorkflowを開く
- Workflow Templateを差し替える
- Node Graphを編集する
- Model／LoRAを選択する
- Sampler、Scheduler、Steps、CFG等を編集する
- Custom Node設定を編集する
- Workflow JSONをImport／Exportする

```text
Simple Mode
  TEGAKI専用の高水準操作

Advanced Mode
  ComfyUI Workflow編集
```

### 9.3 TEGAKI側の要求形式

```json
{
  "operation": "characterTurn",
  "source": {
    "assetId": "character-001",
    "frameRange": [12, 12],
    "maskId": "character-mask"
  },
  "motion": {
    "direction": "left",
    "angle": 90,
    "durationSeconds": 1.5
  },
  "preservation": {
    "identity": 0.85,
    "lineStyle": 0.8,
    "color": 0.9
  },
  "output": {
    "fps": 24,
    "frameFormat": "png",
    "requireMask": true
  },
  "modelPreset": "user-character-video-default"
}
```

Adapterがこの高水準RequestをRuntime固有Workflowへ変換する。

---

## 10. AIEngineAdapter

### 10.1 共通Interface案

```ts
interface AIEngineAdapter {
  connect(config: EngineConnectionConfig): Promise<void>;
  getCapabilities(): Promise<EngineCapabilities>;
  validateRequest(request: AIGenerationRequest): Promise<ValidationResult>;
  submitJob(request: AIGenerationRequest): Promise<JobReference>;
  getProgress(job: JobReference): Promise<JobProgress>;
  cancelJob(job: JobReference): Promise<void>;
  getResult(job: JobReference): Promise<AIGenerationResult>;
}
```

### 10.2 Capability例

```json
{
  "engine": "comfyui",
  "imageToVideo": true,
  "videoToVideo": true,
  "imageToImage": true,
  "maskInput": true,
  "alphaOutput": false,
  "pngSequenceOutput": true,
  "workflowApi": true,
  "progressEvents": true,
  "cancel": true,
  "customNodes": true
}
```

### 10.3 Runtime固有情報の隔離

ComfyUI固有のNode ID、Class Type、Prompt API payload等を、TEGAKIの共通Requestへ漏らさない。

---

## 11. 動画Workflow

### 11.1 基本フロー

```text
TEGAKIからキャラクター画像を取得
  ↓
必要ならCanvas外余白を追加
  ↓
動作Prompt／Control情報を付与
  ↓
Image-to-Video
  ↓
人物Mask生成
  ↓
Mask時間安定化
  ↓
Alpha境界補正
  ↓
Preview動画 + PNG連番 + Mask連番
  ↓
TEGAKIへImport
```

### 11.2 一貫性を補助する情報

Workflowによっては、以下を入力できる可能性がある。

- 元画像
- 直前Frame
- 前後Keyframe
- Pose／Skeleton
- Depth
- Edge
- Line Art
- Character Reference
- Mask
- Optical Flow
- Seed
- LoRA
- Prompt
- Negative Prompt

どのControlが有効かはModel／Workflow依存であるため、TEGAKIの共通仕様として固定しない。

### 11.3 再生成

生成結果全体が悪い場合:

- Seed変更
- Prompt変更
- Motion強度変更
- Model変更
- LoRA変更
- Duration変更

一部だけ悪い場合:

- 特定Frameだけi2i
- 一定区間だけv2v
- 前後の良いFrameを条件として再生成
- TEGAKIで描き直す
- 修正Frameから再度短い動画を生成する

---

## 12. 背景透過

### 12.1 初期方針

AI RuntimeがRGBA動画を直接生成できることを必須にしない。

```text
RGB動画またはRGB PNG連番
+
Alpha Mask PNG連番
```

TEGAKI Import時またはResult Package作成時にRGBAへ合成する。

### 12.2 単純な白抜きの問題

白背景を単純に透明化すると、次も消える可能性がある。

- 白い服
- 白目
- ハイライト
- 明るい髪
- 半透明表現
- アンチエイリアス境界

したがって、単純な色キーだけを標準方式にしない。

### 12.3 推奨方式

```text
生成Frame
  ↓
人物Segmentation／Matting
  ↓
時間方向のMask安定化
  ↓
境界補正
  ↓
Alpha Mask
```

必要なら生成時に、人物と区別しやすい単色背景を指定する。ただし最終Maskは色差だけでなく、SegmentationまたはMattingで作る。

### 12.4 Mask修正

TEGAKI側で可能にしたい操作:

- Alpha Maskを別Layerとして表示
- Maskへペンで加筆
- Maskを消しゴムで修正
- 膨張／収縮
- Feather
- Threshold
- 穴埋め
- Frame間Copy
- 前後Frame補間
- RGBとMaskの同期Scrub

### 12.5 出力形式

推奨順位:

1. PNG連番 + Mask連番
2. RGBA PNG連番
3. Preview用MP4／WebM
4. Alpha対応WebM等
5. APNG

TEGAKIとの往復では、編集しやすいPNG連番を正本寄りに扱う。

---

## 13. Result Package

```text
ai-result-001/
├ manifest.json
├ preview.mp4
├ frames/
│  ├ 000001.png
│  └ ...
├ masks/
│  ├ 000001.png
│  └ ...
├ rgba/
│  ├ 000001.png
│  └ ...
├ source/
│  ├ input.png
│  └ input-mask.png
├ workflow/
│  ├ workflow-api.json
│  └ workflow-ui.json
└ metadata/
   └ generation.json
```

### 13.1 manifest候補

```json
{
  "formatVersion": 1,
  "resultId": "ai-result-001",
  "sourceAssetId": "character-001",
  "width": 1024,
  "height": 1024,
  "fps": 24,
  "frameCount": 48,
  "hasRgbFrames": true,
  "hasMasks": true,
  "hasRgbaFrames": true,
  "previewFile": "preview.mp4"
}
```

### 13.2 generation情報

- Engine名とVersion
- Workflow VersionとHash
- Model論理名
- Checkpoint Hash
- LoRA名とHash
- VAE名とHash
- Seed
- Prompt／Negative Prompt
- Steps、Sampler、Scheduler
- 解像度、FPS、Frame数
- 使用Custom NodeとVersion
- 生成日時
- 入力画像Hash
- Mask生成方法
- 後処理内容
- 失敗／警告情報

モデル本体はPackageへ含めない。

---

## 14. TEGAKIへのImport

AI出力は元のCAFへ自動上書きしない。

```text
AI Result Clip
  ├ Preview
  ├ RGB Frame
  ├ Mask
  ├ RGBA Frame
  └ Generation Metadata
```

Import後の選択肢:

- ガイドとして表示
- 新規CAF列へ変換
- 新規CAF Groupへ変換
- 選択FrameだけCAF化
- 元CAFと比較表示
- 特定Frameをi2iへ再送
- 選択区間をv2vへ再送
- ResultをAsset Libraryへ保存
- 破棄

### 14.1 ガイド表示

- 半透明表示
- 色変更
- Loop
- Frame Offset
- Speed
- 左右反転
- CAF Frameへの同期
- Subframe表示
- ガイドを書き出し対象から除外

### 14.2 CAF化

- 出力FPS
- CAF作画FPS
- Frame間引き
- Alpha適用
- Bounds
- Anchor
- Crop
- 元ResultとのLink
- Result Metadata保存
- 1回のHistory Transaction

---

## 15. Job管理

### 15.1 Job状態

```text
queued
uploading
running
postprocessing
downloading
completed
failed
cancelled
```

### 15.2 エラー分類

- Runtimeに接続できない
- 必要Modelが無い
- 必要Custom Nodeが無い
- ModelとWorkflowが非互換
- VRAM不足
- Storage不足
- JobがCancelされた
- Outputが見つからない
- Mask生成失敗
- Frame数不一致
- Runtime Version非対応
- Workflow Format非対応

エラー時にTEGAKI ProjectやCAFを破損させない。

---

## 16. ローカル利用とプライバシー

個人利用を基本とする場合、初期方針はLocal-firstが適する。

```text
TEGAKI
  → localhostのComfyUI
  → ローカルModel
  → ローカルOutput
```

明示的な設定なしに、画像、Prompt、Project情報を外部サービスへ送信しない。

将来クラウドRuntimeへ対応する場合は、次を区別する。

- Local Runtime
- LAN Runtime
- Remote Self-hosted Runtime
- Third-party Cloud Runtime

Remote送信時は、送信先、対象データ、認証、保存方針を明示する。

---

## 17. セキュリティ境界

### 17.1 Modelファイル

- ユーザーが任意に用意
- TEGAKIは同梱しない
- Hashを記録
- Runtime側の安全な読込機構を利用
- 不明形式をTEGAKI本体で直接解析しない

### 17.2 Custom Node

- 実行コードとして扱う
- 自動Installしない
- 配布元、Versionを表示
- Runtimeを別プロセスに隔離
- Remote Runtimeを不用意に外部公開しない
- LAN Listen等はユーザー明示設定にする

### 17.3 Workflow

Workflow Import時に表示する候補:

- 必要Node
- 必要Model
- 外部API使用
- 未知Node
- ファイル出力先
- Networkアクセス
- 互換Version

---

## 18. ライセンスと配布

### 18.1 ComfyUI本体

ComfyUI本体のコードを直接取り込み、派生物として配布する場合は、ComfyUI本体のライセンス条件を確認する。

初期構造では、ComfyUIを別プロセス／別Runtimeとして扱い、TEGAKIまたは専用AI UIはAPIで接続することを推奨する。

### 18.2 Checkpoint／LoRA

TEGAKIは:

- Modelを同梱しない
- Model権利を保証しない
- Model利用可否を自動的に断定しない
- Model本体をResult Packageへ含めない
- Model名、Hash、ユーザー設定を記録できる
- 利用者が確認できる導線を用意する

### 18.3 責任分界表

| 項目 | TEGAKI側 | ユーザー側 |
|---|---|---|
| Checkpointの提供 | 原則しない | 任意に用意 |
| LoRAの提供 | 原則しない | 任意に用意 |
| Modelの配置 | 設定UI／検出補助 | 実際の配置 |
| Model利用条件 | 参照情報を表示可能 | 条件確認と選択 |
| Workflow Template | 提供可能 | 必要に応じて変更 |
| Custom Node | 公式／信頼済みのみ案内可能 | 導入判断 |
| 生成Prompt | UIと保存機能 | 内容を決定 |
| 出力採用 | 候補管理機能 | 採用・修正判断 |
| 最終作画 | TEGAKI機能を提供 | 最終確認・修正 |
| 公開・配布 | 書き出し機能 | 権利確認と公開判断 |

---

## 19. 実装Phase案

### Phase AI-0: 手動検証

- TEGAKIからPNGをExport
- ComfyUIへ手動入力
- Image-to-Video Workflow検証
- 1キャラクター単位の生成
- 動画一括ガチャの有効性確認
- 崩れFrameの描き直し検証
- i2i／v2v再生成検証
- Mask／透過検証

### Phase AI-1: 固定Workflow API

- ComfyUI接続設定
- Runtime Health Check
- 画像Upload
- 固定Workflow JSON送信
- Queue／Progress
- Output Download
- Preview表示
- エラー処理
- Modelはユーザー準備

### Phase AI-2: Result Package

- PNG連番
- Mask連番
- Preview動画
- Workflow保存
- Model Hash記録
- Result Package
- TEGAKIへのImport
- ガイド表示

### Phase AI-3: TEGAKI Custom Node

- TEGAKI Character Input
- TEGAKI Mask Input
- PNG Sequence Output
- Result Package Output
- Metadata保持
- Node Version管理

### Phase AI-4: 専用AI UI

- 動作Preset
- Prompt
- Duration
- FPS
- Character Preservation
- Model Preset
- Background／Mask設定
- Job一覧
- Result比較
- 再生成

### Phase AI-5: AIEngineAdapter

- ComfyUI固有処理をAdapterへ隔離
- Capability Query
- Model Mapping
- Validation
- Job共通Interface
- 別Runtime追加可能な境界

### Phase AI-6: 部分再生成

- Frame単位i2i
- 区間v2v
- Mask付き再生成
- 前後Frame条件
- TEGAKI修正Frameの再投入
- Result Revision

### Phase AI-7: 独自化の判断

- 専用Job Server
- 専用Workflow記述
- 前後処理の独自実装
- ComfyUI Runtime継続または置換
- 別動画ツールとの共用
- Model管理は引き続きユーザー責任

---

## 20. 受け入れテスト

### 20.1 基本生成

- TEGAKIから1キャラクターPNGを送信できる
- ComfyUIで短い動画を生成できる
- Progressを取得できる
- Cancelできる
- ResultをTEGAKIへ戻せる
- 元CAFを変更しない

### 20.2 動画ガイド

- 生成動画を半透明ガイド表示できる
- CAF Timelineと同期して再生できる
- ガイドは最終Exportから除外できる
- 選択FrameをCAFへ変換できる
- 崩れFrameをTEGAKIで描き直せる

### 20.3 透過

- RGB連番とMask連番のFrame数が一致する
- RGBAへ合成できる
- MaskをTEGAKIで修正できる
- 白い服等が単純色抜きで消えない
- Preview動画とRGBA連番が同期する

### 20.4 Model責任分界

- Checkpoint未設定時に明確なエラー
- LoRA未設定でもWorkflowが許せば実行可能
- Model本体がProjectへコピーされない
- Model名とHashがGeneration Metadataへ保存される
- 他環境でModelが見つからない場合にMapping UIを表示
- TEGAKIがModelを無断Downloadしない

### 20.5 Custom Node

- 不足Nodeを一覧表示
- 未知Nodeを自動Installしない
- Node Version不一致を警告
- Runtime失敗時にTEGAKI Projectが壊れない

---

## 21. 非目標

初期Phaseでは以下を狙わない。

- TEGAKI本体へのCheckpoint同梱
- TEGAKI本体へのLoRA同梱
- Model配布サービス
- Modelの権利保証
- ComfyUI全機能の再実装
- 全身パーツの自動Layer分け
- 生成動画の完全無修正採用
- 生成AIをTEGAKIの保存正本にする
- クラウド送信の自動有効化
- 不明Custom Nodeの自動Install
- 全Modelへの完全互換
- 完全なPrompt再現性の保証
- AI生成とTEGAKI Historyの完全統合
- 複数Runtimeの同時並列対応
- 推論エンジンのゼロからの実装

---

## 22. Codex／GPTへの作業指針

この文書を読んだAIは、直ちに実装を開始せず、以下を確認すること。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 現行Phase指示書
5. Timeline／CAF／Project保存正本
6. Export／Import経路
7. IndexedDB／File管理
8. EventBus
9. History transaction
10. 既存の外部通信方針

実装提案では次を明記する。

- TEGAKI本体とAI Runtimeのプロセス境界
- 保存正本
- Model本体を保存しないこと
- Model参照とHashの保存方法
- Workflow Version
- Custom Node Version
- Job状態
- Cancel
- エラー復旧
- Result Package
- Mask形式
- RGB／RGBA／Previewの関係
- ガイドとCAFの境界
- Local／Remoteの区別
- Security設定
- 既存ProjectのMigration
- 現行Phaseとの衝突有無

新規class、関数、EventBusイベントを作る前に、既存実装を検索する。

本文のinterface名、JSON名、Phase名は概念例であり、現行コードの命名と衝突する場合は既存設計を優先する。

---

## 23. 未決事項

1. ComfyUI Serverの起動をTEGAKIから補助するか。
2. ComfyUIをユーザーが別途起動する方式だけにするか。
3. Workflow Templateをどこへ保存するか。
4. Model MappingをBrowser Storage、設定ファイル、Runtime側のどこへ置くか。
5. Model Hash計算をRuntime側へ任せるか。
6. WAN系等の動画WorkflowをPresetとして提供するか。
7. 特定Model名をPresetに固定しない構造をどう作るか。
8. キャラクター保持の高水準値をNode設定へどう変換するか。
9. RGBとMaskの時間的不一致をどう検出するか。
10. Mask安定化をComfyUI側とTEGAKI側のどちらで行うか。
11. Result PackageをProject内へ埋め込むか外部参照にするか。
12. AI Resultの容量上限。
13. Cache削除と再生成可能性。
14. ガイド動画をProject Exportへ含めるか。
15. 別動画ツールと同じAI Result Packageを共有するか。
16. Custom Nodeの信頼済み一覧を誰が管理するか。
17. Remote Runtime対応をいつ行うか。
18. 生成情報にPromptを保存しないPrivacy Modeを用意するか。
19. Resultの再現性をどこまで保証するか。
20. 独自AI Runtime化を行う判断基準。

---

## 24. 最終方針

```text
TEGAKI
  手描きCAFを正本として保持
  AIへ送る素材とMaskを作る
  AI出力をガイドまたはCAF候補として受け取る
        ↓
TEGAKI AI Adapter
  高水準RequestをWorkflowへ変換
  Job、Progress、Resultを管理
        ↓
ComfyUIまたは将来の独自Runtime
  ユーザーが用意したCheckpoint／LoRAを使用
  動画生成
  Mask生成
  Result Package作成
```

設計原則:

1. AIは第3の補助エンジンであり、TEGAKIの正本ではない。
2. 難しい立体変化は短い動画として一括生成する。
3. 動画を完成品だけでなく、時間的一貫性を持つ作画ガイドとして扱う。
4. 崩れたFrameは手描き修正または部分再生成する。
5. 初期出力は1キャラクター単位で十分とする。
6. 透明背景はRGBとMaskの分離を標準とする。
7. Checkpoint／LoRAはユーザーが任意に用意する。
8. Model本体をTEGAKIへ同梱・再配布しない。
9. Model参照、Hash、Workflow、Seedを来歴として保存する。
10. ComfyUIのWorkflow／Job／Nodeの考え方を参考にする。
11. TEGAKI内部データをComfyUI形式へ従属させない。
12. 設計が安定してから、専用UI、Adapter、必要部分の独自化へ進む。

---

## 参考資料

### TEGAKI

- `AGENTS.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/AGENTS.md
- `TEGAKI.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/TEGAKI.md
- `tegaki_work/PROGRESS.md`  
  https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/PROGRESS.md

### ComfyUI公式

- ComfyUI GitHub  
  https://github.com/Comfy-Org/ComfyUI
- Server API Overview  
  https://docs.comfy.org/development/comfyui-server/comms_overview
- Server API Examples  
  https://docs.comfy.org/development/comfyui-server/api-examples
- Custom Nodes Overview  
  https://docs.comfy.org/custom-nodes/overview
- Workflow JSON Specification  
  https://docs.comfy.org/specs/workflow_json
- Core Concepts: Workflow  
  https://docs.comfy.org/development/core-concepts/workflow
