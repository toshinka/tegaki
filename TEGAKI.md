# TEGAKI プロジェクト計画書

> このファイルはGemini CLI・Claudeの両AIが参照する共通の羅針盤です。
> 作業前に必ず読み、方針から外れる実装をしないこと。

---

## プロジェクト概要

ブラウザで動作するお絵かきツール。
デスクトップ（液タブ）をメインに、スマホ・タブレットでも快適に動くことを目標とする。
ふたばちゃんねる用ツール「はっちゃん」のUIの潔さをベースに、現代的なお絵かきアプリのUXに近づけたもの。

**開発者について**
オーナーはコーディング非経験者。実装はAI（Gemini CLI・Claude）が全て担う。
そのため、コードの可読性・構造の明確さ・AIからの改修しやすさを最優先とする。

---

## 開発フェーズ

### Phase 1（現在）：お絵かきツール基盤
- ラスターペン（筆圧・傾き・ひねり対応）
- 消しゴム（ペンと統合パスで実装）
- エアブラシ
- レイヤー管理
- カラーパレット・ペンサイズ（ショートカット/ポップアップ切り替え）
- ズーム・パン

### Phase 2：GIFアニメ
- コマ単位の時間設定
- 旧Photoshop的なフレームテーブル

### Phase 3：動画ツール
- レイヤー × 時間の2次元マトリクス
- 物理演算・メッシュ変形・ボーンによる動き付け
- LIVE2D的なベクター変形（将来目標）

---

## 技術スタック

```
言語:              JavaScript（TypeScript不使用）
ビルド:            Vite（ホットリロードのみの用途。複雑な設定は入れない）
モジュール:        ESM（import/export使用。グローバル汚染を避ける）
描画:              WebGL2（全描画処理をGPUで実施）
UIホスト:          PixiJS v8.17.0（UI表示・レイヤー管理のみ。ストローク描画に使う）
ペン輪郭生成:      perfect-freehand（筆圧→ストローク輪郭ポリゴン変換）
アイコン:          lucide-static（SVGアイコン）
アニメ:            GSAP（UIアニメーションのみ）
```

### ペン・消しゴムのパイプライン（必須遵守）

```
PointerEvent（筆圧・座標取得）
  ↓
perfect-freehand（輪郭ポリゴン生成）
  ↓
PixiJS v8 Graphics（ポリゴン塗りつぶしで描画）
  ↓ プレビュー中はGraphicsのまま保持
  ↓ 確定時にレイヤーのRenderTextureへ焼き込み

消しゴムは同じパイプラインで blendMode = 'erase'（文字列）を指定するだけ
```

**描画確定時の焼き込み方針（重要）：**
- プレビュー中（ドラッグ中）→ Graphics オブジェクトで表示
- ストローク確定時（PointerUp）→ レイヤーの RenderTexture に焼き込んで Graphics を破棄
- 履歴（Undo用）はストロークデータ（点列）を保存する（RenderTexture全体ではない）
- 毎フレームGraphicsをclearして作り直す実装は禁止（パフォーマンス劣化）

筆圧の扱い：
```javascript
// 最小筆圧をクランプして完全ゼロによるゴミ点を防ぐ
const pressure = Math.max(event.pressure, 0.02)

// 幅（perfect-freehand）と不透明度（PixiJS alpha）を両方制御する
graphics.alpha = Math.max(0.1, pressure ** 0.5)
```

### PixiJS v8.17.0 の活用方針

| 機能 | 用途 |
|---|---|
| `blendMode = 'erase'` | 消しゴム実装（文字列指定。BlendModeのimport不要） |
| `blendMode = 'normal'` | 通常ペン描画 |
| `RenderTexture` | レイヤーへの焼き込み・合成 |
| `reparentChild()` | レイヤー並び替え（位置・スケール崩れなし） |
| `getGlobalTransform()` | 座標系補助（camera-system.jsの簡略化） |
| 逆マスク `inverse: true` | 消しゴムの実装バリエーション |
| `pixelLine` | グリッド・補助線の1px描画 |

> ⚠️ **PixiJS v8.17.0では `BlendMode` オブジェクトはexportされていない。**
> `import { BlendMode } from 'pixi.js'` は失敗する。
> 消しゴム・ブレンドモードは必ず文字列（`'erase'`・`'normal'`）で指定すること。

### WebGPU・ベクターペンについて（将来オプション）

WebGL2+ラスターの安定運用が完成した後に検討する。
それまでは一切着手しない。参考：KlecksはWebGL2→WebGPU移行を2027年頃に予定しており、
本プロジェクトの方針と一致している。

**ラスター優先の理由：** 出力は最終的にラスターになるため、高解像度で描けば十分な品質が得られる。変形時の拡大縮小もラスターで解決できる。描画感のためだけにベクターやRetinaを導入するコストは現時点では不要。

ベクター消しゴムへの将来の備えとして、消しゴムストロークのパスを渡す口（`applyEraser(path, layer, mode)`）だけ統一した設計にしておくこと。

**禁止事項**
- TypeScript・Babel・複雑なbundler設定
- Canvas2D（デバッグ目的の一時使用のみ可）
- PixiJS の toLocal() / toGlobal()（座標変換に使用禁止）
- `import { BlendMode } from 'pixi.js'`（v8.17.0ではexport不可。文字列で指定すること）
- 消しゴムの「白塗り」実装（`blendMode = 'erase'` を使うこと）
- 毎フレームGraphicsをclearして作り直す実装（RenderTextureへ焼き込む方式を使う）
- 二重実装・循環依存・グローバル変数の重複定義
- ペンと消しゴムの分離実装（strokeTypeで統合すること）
- perfect-freehandを使わない独自ブラシ輪郭計算（再発明禁止）

---

## ベースコード・フォルダ構成

```
tegaki/
├── GEMINI.md                    ← Gemini自動読み込み
├── TEGAKI.md                    ← 本ファイル（方針・ルール）
├── tegaki_work/                 ← 現在の作業フォルダ（Geminiはここだけ触る）
│   ├── PROGRESS.md              ← 作業ログ（フォルダ内に置く）
│   ├── GitHubURL.txt            ← ファイルURL一覧（フォルダ内に置く）
│   ├── TegakiConsole.txt        ← コンソールログ（フォルダ内に置く）
│   └── ...（ソースファイル群）
└── PastFiles/                   ← 完了済みフェーズのスナップショット
    ├── tegaki_phase0/           ← オリジナル保存。絶対に触らない
    └── tegaki_phase1b1/         ← （例）phase1b完了時点のコピー
```

---

## フェーズ完了時のアーカイブ手順（Geminiが実施する）

> フェーズの全作業完了・`vite dev` 動作確認後に以下を順番に実行する。

**ステップ1：ログファイルを作業フォルダ内に集約する**

以下3ファイルが `tegaki_work/` の直下にあることを確認する。
なければ `tegaki/` ルートから移動する。

```
tegaki_work/PROGRESS.md       ← 最新の作業ログ（このフェーズの記録を追記済みであること）
tegaki_work/GitHubURL.txt     ← 最新のファイルURL一覧
tegaki_work/TegakiConsole.txt ← このフェーズ完了時点のコンソールログ
```

**ステップ2：作業フォルダをPastFilesにコピーしてリネームする**

```
コピー元: tegaki_work/
コピー先: PastFiles/tegaki_phase[フェーズ名][連番]/

例）phase1c 初回完了時    → PastFiles/tegaki_phase1c1/
    phase1c 修正パッチ後  → PastFiles/tegaki_phase1c2/
    phase1c さらに修正後  → PastFiles/tegaki_phase1c3/
```

- `tegaki_work/` フォルダ本体は**移動しない・削除しない**（作業フォルダとして継続使用）
- コピーなのでオリジナルはそのまま残る
- **修正・パッチが発生するたびに連番を上げて別保存する**（上書きしない）
- 不要になった中間スナップショットは後からオーナーが整理して削除してよい

**ステップ3：コピー先のGitHubURL.txtのパスを書き換える**

コピー先（例：`PastFiles/tegaki_phase1c1/`）の `GitHubURL.txt` を開き、
全URLのパス部分を新しいフォルダ名に一括置換する。

```
置換前: tegaki_work/
置換後: PastFiles/tegaki_phase1c1/

例）
変更前: https://raw.githubusercontent.com/.../tegaki_work/index.html
変更後: https://raw.githubusercontent.com/.../PastFiles/tegaki_phase1c1/index.html
```

- これはコピー先のファイルだけを書き換える
- `tegaki_work/GitHubURL.txt`（作業中のもの）は書き換えない

**ステップ4：GitHubにpushして反映を確認する**

PastFilesへのコピーとURL書き換えが完了したらGitHubにpushする。
ClaudeがPastFilesのURLからスナップショットを正しく参照できるようになる。

---

**tegaki_phase0（ベース）の状態**
- ブラウザで起動・描画できる動作確認済み
- PixiJS v8ベース・WebGL2描画
- ペン描画は動作するが消しゴムにバグあり
- Vite未導入（file://直接実行の旧方式）

---

## UIデザイン方針

**コンセプト**
「はっちゃん」の潔さ + 現代的お絵かきアプリのスマートさ

**UIの参考アプリ（必ず確認してから実装すること）**

| 参考アプリ | 参照する要素 |
|---|---|
| **Adobe Fresco** | 全体的なパット見の第一印象・ツールの配置感・スマートさ |
| **ToonSquid 2** | 動画編集テーブル・タイムライン・ノード構造 |
| **Procreate Dreams** | アニメーション機能のUX・レイヤー×時間マトリクス |
| **はっちゃん** | キャンバス優先・余計なものを置かない潔さ（原点） |

実装前にこれらのスクリーンショットや動画をAIが参照できるよう提示することを推奨する。
現状のtegaki_phase0のUIはこの方針をある程度達成しているので、破壊的変更は慎重に。

**カラーリング**
ふたばちゃんねるカラー（Noctuaカラー）で統一。
黒・白・グレーを安易に使わない。詳細はカラーパレットセクション参照。

**配置ルール**
- キャンバスは常に最大化。パネル類は重ねない
- ツール切り替えは左サイドバー（常時表示）
- カラーパレット・ペンサイズ・タイムラインはショートカットまたはサイドバーボタンでポップアップ表示
- 画面に常時「置きっぱなし」のウィンドウを作らない

**ショートカット方針（液タブ想定）**
- ペンサイズ：ホイールまたはショートカット
- 色切り替え：サイドバーから素早く
- ポップアップ：ワンキーで出し入れ可能

**レスポンシブ**
- デスクトップ（液タブ）メイン
- スマホ・タブレットでも最低限快適に動くこと

---

## カラーパレット

```
Maroon:   #800000  アクティブペン色（デフォルト）
Stiletto: #9c3836
Contessa: #b8706b
Eunry:    #d4a8a1  パネル背景
Bizarre:  #f0e0d6  背景レイヤー0デフォルト色
Ivory:    #ffffee  キャンバス背景
Accent:   #ff8c42  橙色（アクティブ強調など）
```

スライダー・ボタン・ラベルは必ずこのパレットで統一すること。
黒・白・グレーを安易に使わない。

---

## 座標変換パイプライン（重要）

```
PointerEvent.clientX/Y
  → screenClientToCanvas()   [DPI補正]
  → canvasToWorld()           [worldContainer逆行列]
  → worldToLocal()            [手動逆算・親チェーン遡査]
  → Local座標確定
  → strokeRecorderへ記録
```

- 座標変換はdrawing-engineが単一で実行
- stroke-recorderは受け取った座標をそのまま保存（追加変換禁止）
- Pixiのtolocal/toGlobalは使用禁止

---

## ファイル責務（目標構成）

```
coordinate-system.js   : Screen/Canvas/World/Local変換のみ
camera-system.js       : ズーム・パン・worldContainer transform
                         （PixiJS getGlobalTransform()を補助的に使用可）
drawing-engine.js      : PointerEvent → 筆圧取得・座標変換・ストローク開始
stroke-recorder.js     : Localポイント記録（変換なし）
freehand-stroke.js     : perfect-freehandでポイント列→輪郭ポリゴン変換
                         ペン・消しゴム共通（strokeTypeで blendMode文字列切り替え）
raster-layer.js        : WebGL2フレームバッファ・レイヤー管理
                         レイヤー並び替えにreparentChild()使用
webgl2-drawing-layer.js: 合成・出力
```

各ファイルの先頭に以下を必須記載：
```javascript
/**
 * ============================================================================
 * ファイル名: （例）system/drawing/freehand-stroke.js
 * 責務: （このファイルが唯一担う処理を1行で）
 * 依存: （このファイルがimport/使用するもの）
 * 被依存: （このファイルをimport/使用するもの）
 * 公開API: （exportまたはwindow登録する関数・クラス名）
 * イベント発火: （EventBus経由で発行するイベント名、なければ「なし」）
 * イベント受信: （EventBus経由で受信するイベント名、なければ「なし」）
 * グローバル登録: window.XXX（なければ「なし」）
 * 実装状態: 🆕新規 / ♻️移植 / 🔧改修
 * ============================================================================
 */
```

ヘッダーは改修のたびに更新すること。依存関係がずれたまま放置しない。
これはAIが「どのファイルを触れば何が影響するか」を即座に判断するための最重要情報。

---

## 命名規則（必須）

**座標系を変数名に明示する**
```javascript
// 良い例
localX, localY
worldX, worldY
screenX, screenY

// 悪い例（どの座標系か不明）
x, y, posX, posY
```

**メソッド名で変換方向を明示する**
```javascript
screenClientToCanvas()   // Screen → Canvas
canvasToWorld()          // Canvas → World
worldToLocal()           // World → Local（手動逆算。toLocal()禁止）
```

**その他**
- イベント名：`component:action` 形式で統一（例：`layer:added`, `stroke:end`）
- WebGL2関連変数：`gl` 接頭辞（例：`glDevice`, `glProgram`, `glTexture`）
- PixiJS UI関連：`pixi` 接頭辞または `window.PixiUI` 配下に集約

---

## グローバルオブジェクト登録名（重複厳禁）

```
window.CoordinateSystem   : 座標変換（coordinate-system.js）
window.cameraSystem       : ズーム・パン（camera-system.js）
window.layerManager       : レイヤー管理（raster-layer.js）
window.WebGLContext       : gl・programs・shaders・format等を集約
window.PixiUI             : PixiJS UI関連をまとめる
window.EventBus           : イベント通信バス
```

同じ役割のグローバルを複数定義しない。新しく登録する際は必ずこの一覧を確認・更新する。

---

## レンダーループ規則

- **WebGL2が唯一のマスターレンダーループ**
- PixiJSのticker（自動描画）は停止する
- 描画順序は必ず `glRender()` → `pixiRender()` の順
- PointerEventの一次取得はWebGL2キャンバスが担う（`setPointerCapture`使用）
- PixiJSのインタラクティブ機能は無効化する
- UIがPointerEventを必要とする場合はEventBusを経由して同期する

---

## 品質目標

- 描画レート：120Hz対応
- ペン入力：筆圧・傾き（tilt）・ひねり（twist）の3軸取得
- DPR：1倍固定（Retina対応による品質ブレを避ける）
- 後方互換：不要（Chrome最新のみ対象）

---

## 開発ルール

- DRY/SOLID原則を常に意識し、二重実装を作らない
- 過剰なconsole.logは都度削除してクリーンに保つ。デバッグはなるべくコンソールコマンドで行う
- エラーは例外として明示的に扱い、黙って内部状態を書き換えない
- フォールバック処理・曖昧な暗黙修復動作を作らない
- 「とりあえず動く」ではなく「構造が正しい」を優先する
- 大きな変更前にGeminiまたはClaudeに方針を確認してから実装する

---

## ハルシネーション防止ルール（AI向け）

- 知らないメソッド・APIを使う前に、必ず実在確認をしてから実装する
- ライブラリのバージョンを確認し、古いAPIを新バージョンに誤用しない
  - PixiJS: **v8.17.0**（v7のAPIを混入させない）
  - perfect-freehand: **最新安定版**（npm installで取得したバージョンを使う）
- **PixiJS v8.17.0の実exportを確認済みのAPI一覧（これ以外をimportしない）：**
  ```
  使用可能: Container, Graphics, Sprite, RenderTexture, Texture,
            Matrix, Mesh, Geometry, Application, Assets,
            Filter, Rectangle, Point
  使用不可: BlendMode（exportなし。'erase'/'normal'の文字列で代替）
  ```
- 不明なAPIはnode -e "const p = require('./node_modules/pixi.js'); console.log(Object.keys(p).filter(k=>k.includes('XXX')))" で実在確認してから使う
- 存在しないファイルパスを推測で書かない。必ず実際のファイル構成を確認してから参照する
- 500行以上のエラーログを丸ごと処理しようとしない。関係するStack Traceの3〜5行に絞って対処する
- 不確かな場合は「〜かもしれない」と明示し、確認を求めてから進める
- コンテキストが怪しいと感じたら `TEGAKI.md` と `PROGRESS.md` を再読してリセットする

---

## AIへの作業依頼の流れ

1. `TEGAKI.md`（本ファイル）と `PROGRESS.md` を読んでから作業開始
2. 方針と矛盾する実装案は、提案前に「方針と矛盾しますが進めますか？」と確認する
3. 大きな変更は「何をどう変えるか」を先に説明してからオーナーの確認を取る
4. 実装後は `vite dev` で動作確認し、エラーがあれば自己修正する
5. 一区切りついたら `PROGRESS.md` を更新してセッションを閉じる
6. 複雑な設計判断・行き詰まりはClaudeに相談する

---

*最終更新：2026年5月（BlendMode API修正・RenderTexture焼き込み方針追加・PixiJS許可API表追加）*
