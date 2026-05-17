# TEGAKI プロジェクト計画書

> Gemini CLI・Claude・Codex が参照する共通方針。
> 作業前に必ず読み、ここに反する実装へ進む場合は先にオーナーへ確認すること。

---

## 最優先ルール

- 現在の作業対象は `tegaki_work/`。`PastFiles/` と `tegaki_phase0` は参照・保存用で、通常作業では触らない。
- オーナーはコーディング初心者。AI が全実装を担うため、可読性・責務分離・依存関係の明確さを最優先する。
- DRY/SOLID を常に確認し、二重実装・循環依存・同じ責務の複数配置を作らない。
- 各ファイルのヘッダーは改修時に必ず更新し、依存・被依存・イベントのズレを放置しない。
- 過剰な `console.log` は確認完了後に削除する。長期的に必要な診断ログは用途を明記して残す。
- 不明な API・存在不明のファイル・古い計画の内容を推測で使わない。実ファイルと実バージョンを確認してから実装する。
- 新規クラス・関数・イベントを作る前に、必ず既存実装を `rg` で検索し、同じ責務の二重実装を避ける。
- `TEGAKI.md`、`GEMINI.md`、`CODEX.md`、作業指示書の参照パスや役割分担がズレた場合は、実装前に修正またはオーナーへ確認する。

---

## 現在の方針

ブラウザで動作するお絵かきツール。
デスクトップ液タブを主対象にしつつ、スマホ・タブレットでも最低限快適に動くことを目標にする。

UI の原点はふたばちゃんねる用ツール「はっちゃん」の潔さ。
ただし実装と操作感は、現代的なお絵かきアプリに近づける。

### 開発フェーズ

**Phase 1c（完了判定済み）**

- 液タブペン入力対応
- 消しゴムの透明リアルタイム消去
- レイヤーサムネイルの安定表示
- ペン/消しゴムのライブラスター描画と確定後差異の解消
- 鋭角ストロークの三角形アーティファクト対策
- V キー変形後の bake と座標・ブラシサイズ維持
- リサイズ後の RenderTexture / 描画可能範囲 / サムネイル抽出範囲の整合
- 基本バケツ塗りの復旧

**Phase 1d（完了判定済み）**

- UI 未整理部分の ESM 化・責務整理
- Phase 1c で残った一時診断ログの整理
- ファイルヘッダーと EventBus / window 登録の現状同期
- V キー変形時のキャンバス外クリップ問題の調査
- ショートカットとポップアップ操作の整理
- 書き出し・履歴・タイムライン周辺の安定化
- WebGPU / SDF / MSDF 系の再検討と、採用する場合の正式設計

**Phase 1e（完了判定済み：描画の基本品質）**

- 遅いストロークが丸の連続に見える問題の改善
- 筆圧入力の実装と `Shift+P` による ON/OFF ショートカット
- ステータスバーの `ベクターペン` 表示を、`ペン（固定幅）` / `ペン（筆圧ON）` など現行描画方式に合う表記へ変更
- 消しゴム筆圧の `Shift+E` 切替とステータス表示
- ツールショートカット時のサイドバー active 枠とステータス表示同期
- ペン補正、四角ペン、設定タブ、Vキー/クイックUI軽量化は後続へ移動

**Phase 1f（完了判定済み：履歴・リサイズ・座標整合）**

- アンドゥ/リドゥ後に描画座標がズレる問題の調査と修正
- リサイズ do/undo/redo 後の RenderTexture、表示 sprite、キャンバスサイズ、描画可能範囲の整合
- Vキーモードで少し動かすと座標が戻る現象の原因切り分け
- `History` command と resize 経路の棚卸し
- debug 限定の履歴/座標診断ログ整備
- 描画/消しゴム/バケツを RenderTexture スナップショット履歴へ記録
- History ステータス表示の更新

**Phase 1g（完了判定済み：出力・レイヤー編集基盤）**

- エクスポート機能の復旧
- PNG エクスポートの復旧
- レイヤー複製、下レイヤー結合
- レイヤーサムネイル上下反転と即時更新の修正
- 背景への最終結合禁止

**Phase 1h（完了判定済み：アルバム保管・PNG出力・保存復帰）**

- JSON + レイヤー PNG dataURL による最小プロジェクト保存
- 保存 JSON からの読み込み復元
- キャンバスサイズ、背景色、背景表示状態、通常レイヤー順/名前/表示/不透明度/画像の復元
- 読み込み後のサムネイル更新、描画、PNG エクスポート、履歴表示の整合
- サイドバーの記録導線を JSON 直保存ではなくアルバム保管へ復旧
- アルバムからの PNG ダウンロード、カード削除、カードクリック復帰
- DEL によるアクティブレイヤー描画消去とサムネイル/保存復帰の整合
- アニメボタンは表示入口のみ軽復旧。アニメ本体は現行描画へ副作用が出るため未接続

**Phase 1i（完了判定済み：保守性と小型UI操作の整備）**

- AI が読み取りやすいファイル名、配置、責務、ヘッダー、EventBus 契約の棚卸し
- 重複責務・旧式ファイル・未接続モジュールの整理方針作成。ただし削除や大移動は Codex 判断へ戻す
- ステータスの History カウント再確認
- V キー変形パネルの水平反転/垂直反転、`V+H` / `V+Shift+H` 相当のショートカット整理
- V キー変形パネルの回転 360 度化、数値ダブルクリック直接入力
- レイヤー不透明度の数値ドラッグ操作
- クリップボード画像貼り付け、アクティブレイヤーコピー/新規コピーレイヤー作成の棚卸しと小実装

**Phase 1j（完了判定済み：AI向け構造整理と保守性マップ）**

- `tegaki_work/ARCHITECTURE.md` など、AI が次に読むべき構造マップを作る
- 起動順序、描画経路、レイヤー/変形/サムネイル、UI/ショートカット、保存/出力の責務境界を明文化する
- 主要ファイルのヘッダーと実際の依存/EventBus/window登録を同期する
- 命名、ファイル配置、責務重複、未接続ファイル、凍結ファイルを棚卸しし、今直すものと Codex 判断へ戻すものに分ける
- レイヤー削除ボタンや popup の `X` ボタンなど、小UIの見た目不整合を低リスク範囲で整理する
- 大規模リネーム、ファイル移動、削除、主要 EventBus payload 変更は実装しない

**Phase 1k（完了判定済み：UI部品・アイコン共通化）**

- `dom-builder.js` に混在している SVG アイコン定義を、専用の `ui-icons` 系モジュールへ段階的に移す
- close / trash / duplicate / download / upload など、再利用頻度が高いアイコンを単一ソース化する
- `.ui-close-button`、`.ui-icon-button`、サイズ修飾子など、共通CSSクラスで見た目を管理する
- レイヤー削除ボタン、popup閉じボタン、Qパネル閉じボタンなどを同じ設計へ寄せる
- 機能追加や大規模UI再設計は行わず、挙動を変えずに参照元と見た目の整理を優先する
- アニメ旧UIや凍結系ファイルの大量SVG置換は、現行描画へ副作用が出ない範囲に限定する

**Phase 1l（次候補：アルバム管理基盤拡張）**

- アルバムカードのドラッグ並べ替え
- アルバムカードの選択状態と、複数選択の土台
- 個別削除/個別PNG保存の既存導線を壊さず、複数選択時の一括削除・一括エクスポート設計を整理する
- アルバム全体保存/HTMLエクスポート/インポートは、保存形式・復元対象・互換性を先に設計し、初回で無理に本実装しない
- `AlbumPopup` の localStorage 保存と `VirtualAlbum` の IndexedDB 保存の責務差を棚卸しし、どちらを正本にするか Codex判断へ戻す

**Phase 1m以降（レイヤー/UI編集拡張）**

- クリッピング
- レイヤーフォルダ
- 複数レイヤー選択、一括結合、一括クリッピング、まとめて移動
- レイヤーパネルのコンパクト化検討
- 範囲選択、切り取りなどの編集操作

**Phase 2（高機能な描画補助）**

- エアブラシ
- ぼかし
- 囲い塗り・隙間閉じ・表示レイヤー参照などの高機能バケツ
- 直線、円、矩形
- 定規、自在定規
- クイックパネルの色/サイズプリセット/スポイト/カラーサークル

**低優先の将来フェーズ**

- GIF アニメ
- 動画ツール風のレイヤー × 時間マトリクス
- レイヤー × 時間のマトリクス
- 物理演算・メッシュ変形・ボーン
- APNG/GIF の自動判定、アニメプレビュー、エクスポート連携
- ベクター系の再検討
- スクリーントーン
- 集中線、ウニフラッシュ

---

## 技術スタック

```text
言語:         JavaScript
モジュール:   ESM import/export
ビルド:       Vite
実行環境:     Chrome 最新
描画基盤:     PixiJS v8.17.0
レイヤー:     PixiJS Container + Sprite(RenderTexture)
ストローク:   ライブラスター線分 -> RenderTexture 焼き込み（perfect-freehand は補助/旧経路）
UI:           DOM + PixiJS + lucide-static
アニメ:       GSAP（UI用途）
並び替え:     SortableJS
```

### 旧計画との優先順位

`計画書/指示書.txt` には旧方針が含まれる。
以下は現在の方針と矛盾するため採用しない。

- Vite 禁止
- ESM 禁止
- perfect-freehand 禁止
- Pixi.Graphics の本番使用禁止
- PixiJS を UI 表示のみに限定する方針
- WebGL2 フレームバッファ直描画を現フェーズで必須にする方針
- file:// 直開き前提

採用するのは以下のみ。

- DRY/SOLID の徹底
- ファイルヘッダーによる依存関係の明示
- 座標変換の単一責務化
- `toLocal()` / `toGlobal()` 依存の禁止
- DPR 1 倍固定
- 過剰ログ削除
- フォールバックや暗黙修復を作らない方針
- 色・UI 方針
- 既存実装検索、EventBus 契約確認、一時ログ管理、AI 設定ファイル同期などの作業規律

---

## 描画パイプライン

現在の標準パイプラインは以下。

```text
PointerEvent
  -> drawing-engine で座標変換
  -> stroke-recorder に local 座標を記録
  -> brush-core が短い線分を生成
  -> ドラッグ中に対象レイヤーの RenderTexture へ逐次焼き込み
  -> pointerup 時に undo 用 stroke 記録と最終状態を確定
```

### ペン

- Phase 1c では、ペンも消しゴムと同じライブラスター方式を標準にする。
- 「軌跡を描いて離した瞬間に補正される」感触は、細密描画ではデフォルトにしない。
- `perfect-freehand` は補助/旧経路として扱い、使う場合も強い自動補正をデフォルトにしない。
- 座標は整数丸めしない。
- 同一点・極端に近い点は必要に応じて小さくフィルタする。
- WebGL2 Mesh 経路は現時点では復活させない。
- WebGPU / SDF / MSDF 系の描画・塗りつぶし経路は Phase 1c では凍結する。既存コードに分岐が残っていても、1c の不具合修正では使わない。

`perfect-freehand` を使う場合の基準値。
線を勝手に丸めないことを優先し、補正は将来スライダーで上げる。

```javascript
{
  size,
  thinning: 0.7,
  smoothing: 0.08,
  streamline: 0,
  simulatePressure: false,
  last: true
}
```

### 消しゴム

- 背景色で塗る方式は禁止。
- 消しゴムは透明化として実装する。
- PixiJS v8.17.0 では `BlendMode` を named import しない。
- ブレンドモードは文字列で指定する。

```javascript
graphics.blendMode = 'erase';
```

リアルタイム消しゴムの基準。

- ドラッグ中に短いセグメントを `RenderTexture` へ焼き込む。
- pointerup / ツール OFF まで消去結果が出ない実装は禁止。
- eraser preview は表示しなくてよい。
- pointerup 時に同じ範囲を二重消去しない。
- undo 用の stroke 記録は維持する。

### RenderTexture

- 各描画レイヤーは `RenderTexture` を持つ。
- レイヤー表示は `Sprite(RenderTexture)` で行う。
- ストローク確定時に `renderer.render({ target: layer.renderTexture, clear: false })` 系で焼き込む。
- リサイズ時は各描画レイヤーの `RenderTexture` を新サイズへ作り直し、旧内容を適切な offset で移す。
- リサイズ後は見た目のキャンバスサイズ、描画可能範囲、サムネイル抽出元サイズが一致していること。
- V キー変形確定時は bake し、コンテナの `scale/rotation` を通常状態へ戻す。
- 変形後にペンサイズや描画範囲が引きずられてはいけない。

---

## 解像度・出力ルール

- DPR は 1 倍固定。
- 内部キャンバスを 2 倍化しない。
- `resolution: 2` を採用しない。
- 出力サイズと内部作業サイズを一致させる。
- 400 x 400 で描いたものは、400 x 400 の提出物として意図が変わらないことを優先する。
- 等倍のまま改善できるアンチエイリアス設定は小さく検証してよいが、副作用があれば採用しない。

---

## 座標変換

座標変換は drawing-engine 側に集約する。

```text
PointerEvent.clientX/Y
  -> screenClientToCanvas()
  -> canvasToWorld()
  -> worldToLocal()
  -> Local 座標
  -> stroke-recorder へ記録
```

ルール。

- `stroke-recorder` は受け取った local 座標をそのまま保存する。
- 同一ポイントに対する二重変換を禁止する。
- PixiJS の `toLocal()` / `toGlobal()` を座標変換に使わない。
- canvas 移動・ズームとレイヤー変形の座標処理を混ぜない。
- 変数名には座標系を明示する。

```javascript
localX, localY
worldX, worldY
screenX, screenY
```

---

## PixiJS v8.17.0 ルール

`BlendMode` は export されない前提で扱う。

禁止。

```javascript
import { BlendMode } from 'pixi.js';
```

使用する。

```javascript
graphics.blendMode = 'normal';
graphics.blendMode = 'erase';
```

import する API は実在確認済みのものに限定する。
不明な場合は実プロジェクトの `node_modules/pixi.js` で確認する。

```powershell
node -e "const p = require('./node_modules/pixi.js'); console.log(Object.keys(p).filter(k=>k.includes('XXX')))"
```

主に使用する API。

```text
Application, Container, Graphics, Sprite, RenderTexture, Texture,
Matrix, Rectangle, Point, Assets
```

---

## ファイル責務

実ファイル構成を優先する。
存在しない理想ファイル名へ無理に寄せない。

主な責務。

```text
coordinate-system.js
  Screen/Canvas/World/Local 変換

system/camera-system.js
  ズーム・パン・worldContainer transform

system/drawing/drawing-engine.js
  PointerEvent 受信後の描画制御、座標変換、stroke 開始

system/drawing/pointer-handler.js
  DOM pointer event の正規化、pointer capture、raw 入力診断

system/drawing/stroke-recorder.js
  local 座標ポイント列と筆圧情報の記録

system/drawing/stroke-renderer.js
  perfect-freehand -> Graphics.poly 変換、ペン・消しゴム形状生成

system/drawing/brush-core.js
  preview 管理、RenderTexture への焼き込み、リアルタイム eraser

system/drawing/thumbnail-system.js
  レイヤー RenderTexture からサムネイル生成・キャッシュ

ui/layer-panel-renderer.js
  レイヤーパネル DOM、サムネイル表示、SortableJS 操作

system/layer-system.js
  レイヤー生成・削除・選択・順序管理

system/layer-transform.js
  V キー変形、変形確定 bake
```

---

## ファイルヘッダー

各 JS ファイルの先頭に以下を維持する。
改修で依存やイベントが変わった場合は必ず更新する。

```javascript
/**
 * ============================================================================
 * ファイル名: system/drawing/example.js
 * 責務: このファイルが唯一担う処理
 * 依存: import または使用する主要モジュール
 * 被依存: このファイルを import または使用する主要モジュール
 * 公開API: export するクラス・関数
 * イベント発火: EventBus 経由で発行するイベント名、なければ「なし」
 * イベント受信: EventBus 経由で受信するイベント名、なければ「なし」
 * グローバル登録: window.XXX、なければ「なし」
 * 実装状態: 新規 / 移植 / 改修
 * ============================================================================
 */
```

ヘッダーは AI が影響範囲を読むための索引。
古い依存関係を残すと調査が誤るため、コード変更と同じ重要度で扱う。

責務が曖昧なファイルや複数システムの接点では、ヘッダーの「責務」に境界を書く。
例。

```text
責務: レイヤーパネル DOM の描画とユーザー操作受付。サムネイル画像の生成処理は thumbnail-system.js に委譲する。
```

対象ファイルの責務外へ変更が広がる場合は、作業報告に理由を書く。

---

## イベント・グローバル

イベント名は `component:action` 形式。

例。

```text
layer:added
layer:activated
thumbnail:layer-updated
thumbnail:updated
stroke:start
stroke:end
```

グローバル登録は重複禁止。
同じ役割の singleton を複数作らない。

```text
window.CoordinateSystem
window.cameraSystem
window.layerManager
window.EventBus
window.PixiUI
window.WebGLContext
```

EventBus のルール。

- `emit` または `on` を追加・変更する前に、同じイベント名を `rg` で全検索する。
- payload 形式はイベントごとに 1 種類へ統一する。`{ data: {...} }` とフラット形式を混在させない。
- 既存イベントの payload を変える場合は、送信側と受信側を同じ作業内で更新する。
- 一時的な互換処理を入れる場合は、削除条件をコメントまたは作業報告に残す。

---

## UI 方針

コンセプトは「はっちゃん」の潔さ + 現代的なお絵かきアプリの操作感。

参考。

```text
Adobe Fresco       全体印象、ツール配置、スマートさ
ToonSquid 2        タイムライン、ノード構造
Procreate Dreams   アニメーション UX
はっちゃん          キャンバス優先、余計なものを置かない潔さ
```

配置。

- キャンバスを主役にする。
- ツール切り替えは左サイドバー。
- カラーパレット・ペンサイズ・タイムラインはショートカットまたはサイドバーボタンで出し入れする。
- 画面に常時置きっぱなしの大きなウィンドウを増やさない。
- 液タブのペン操作でボタン・ポップアップ・レイヤー操作が成立することを確認する。

---

## カラーパレット

安易な黒・白・グレーへ逃げない。
UI 部品は原則この範囲から選ぶ。

```text
Maroon:   #800000  アクティブペン色
Stiletto: #9c3836
Contessa: #b8706b
Eunry:    #d4a8a1  パネル背景
Bizarre:  #f0e0d6  背景レイヤー0
Ivory:    #ffffee  ページ・キャンバス系背景
Accent:   #ff8c42  アクティブ強調
```

---

## 品質基準

- Chrome 最新を対象にする。
- 後方互換は重視しない。
- 目標は 120Hz 入力に耐える描画体験。
- 筆圧・傾き・ひねりは取得できる構造を維持する。
- ただし Phase 1c ではまず描けること、消せること、座標が壊れないことを優先する。
- 例外や不整合は明示的に扱う。
- フォールバック処理・暗黙修復・黙った状態書き換えを作らない。

---

## 禁止事項

- TypeScript 化
- 複雑な bundler 設定
- Canvas2D を本番描画ロジックへ混入
- `import { BlendMode } from 'pixi.js'`
- 背景色で塗る消しゴム
- 内部 2 倍解像度化
- `resolution: 2`
- PixiJS `toLocal()` / `toGlobal()` による描画座標変換
- ペンと消しゴムの別エンジン化
- perfect-freehand を使わない独自輪郭生成への置き換え
- WebGL2 Mesh 経路の安易な復活
- Phase 1c で WebGPU / SDF / MSDF 系の新規採用・復活を行うこと
- 二重実装
- 循環依存
- 古い `tegaki_phase1a` パスを新規記述へ増やすこと
- 設定値・色・サイズ・イベント名・座標変換を複数箇所へ直書きして分散させること
- 調査用ログを目的や削除条件なしで恒久化すること
- `dist/` などビルド生成物を、成果物として必要ない作業で差分に残すこと

---

## AI 作業規律

AI は実装前に以下を確認する。

1. 既存実装検索  
   `rg` で同じ責務のクラス、関数、イベント、グローバル登録を探す。既存 API で済む場合は新設しない。

2. 変更範囲の確認  
   対象ファイルのヘッダーと責務を読み、責務外の変更を避ける。必要な場合は理由を作業報告に書く。

3. EventBus 契約確認  
   イベント名を全検索し、payload 形式と受信側の期待値を確認してから変更する。

4. 設定値の参照元確認  
   色、ブラシ補正、サムネイルサイズ、解像度、しきい値は `config.js`、settings、既存定数を優先する。直書きする場合は理由を残す。

5. 受け入れ条件の先出し  
   作業指示書には「何ができたら完了か」を書く。例：液タブで描ける、右クリックでは描けない、サムネイルサイズが崩れない。

AI は作業後に以下を報告する。

- 変更ファイル
- 変更理由
- 確認コマンド
- ブラウザ確認結果
- 残った問題
- Claude / Codex に判断してほしい点
- 追加した一時ログと削除予定

---

## 作業フロー

1. `TEGAKI.md` と `tegaki_work/PROGRESS.md` を読む。
2. 対象ファイルのヘッダーと実装を読む。
3. `rg` で既存実装、同名イベント、同じ責務のファイルを検索する。
4. 方針と矛盾する場合は、実装前にオーナーへ確認する。
5. 変更後は関連ヘッダーを更新する。
6. `npm run dev` または `npm run build` で確認する。
7. ブラウザ console の主要エラーを確認する。
8. `tegaki_work/PROGRESS.md` を更新する。
9. デバッグログが不要になったら削除する。残す場合は目的と削除条件を書く。
10. 成果物でない生成物や不要な差分を残さない。

---

## アーカイブ手順

フェーズ完了時のみ実施する。

1. `tegaki_work/PROGRESS.md`
2. `tegaki_work/GitHubURL.txt`
3. `tegaki_work/TegakiConsole.txt`

上記が最新であることを確認する。

その後、`tegaki_work/` を `PastFiles/tegaki_phase[フェーズ名][連番]/` へコピーする。
`tegaki_work/` 本体は移動・削除しない。

コピー先の `GitHubURL.txt` だけ、URL パスをコピー先フォルダへ置換する。
作業中の `tegaki_work/GitHubURL.txt` は書き換えない。

---

## AI 別役割

```text
Claude
  指示統括、設計整理、GitHub 経由レビュー

Gemini CLI
  実装担当。tegaki_work/ を中心に変更する。

Codex
  ローカル調査・原因切り分け・GEMINI への作業順整理。
  小さく原因が明確な修正、ドキュメント同期、警告整理は直接行ってよい。
```

---

*最終更新: 2026-05-16*
