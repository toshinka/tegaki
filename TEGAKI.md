# TEGAKI — 技術方針・禁止事項

更新日: 2026-06-19

> Tegakiの技術方針の正本。
> 現在状態は `tegaki_work/PROGRESS.md`、未実装計画は
> `開発用資料保管庫/proposals/00_計画索引.md` を参照する。

## 1. プロダクト方針

Tegakiはブラウザで動作するラスターお絵かき・アニメーション統合ツール。
デスクトップ液晶タブレットを主対象とし、キャンバスを主役にした簡潔なUIを維持する。

- UIの原点: 「はっちゃん」の潔さ。
- 操作感の参考: Adobe Fresco、ToonSquid、Procreate Dreams。
- 新機能より、描画の追従性、保存復元、Undo/Redo、出力の一致を優先する。
- アニメ機能が通常描画を壊さず、通常描画がCAF編集を壊さない境界を守る。

## 2. 正本と作業対象

- 実装: `tegaki_work/`
- 現在状態: `tegaki_work/PROGRESS.md`
- Phase指示: `task-codex/`
- 未実装計画: `開発用資料保管庫/proposals/`
- 完了文書: `開発用資料保管庫/Archive/`
- 要望の簡略一覧: `開発用資料保管庫/実装したいことメモ.txt`

`PastFiles/` と `Backup/` はオーナー管理の参照・退避領域。通常作業では触らない。
過去Phaseの履歴は現行方針ではない。必要な技術境界だけ現行文書へ残す。

## 3. 技術スタック

```text
言語:       JavaScript
モジュール: ESM
ビルド:     Vite
対象:       Chrome 最新
描画:       PixiJS v8.17.0
Layer:      Container + Sprite(RenderTexture)
UI:         DOM + PixiJS + lucide-static
UI animation: GSAP
D&D:        SortableJS または共通Pointer D&D engine
```

TypeScript化、複雑なbundler再構成、file://直開き前提への変更は行わない。

## 4. 描画パイプライン

標準経路:

```text
PointerEvent
  -> drawing-engineで座標変換
  -> stroke-recorderへlocal座標を記録
  -> brush-coreが短い線分を生成
  -> 対象LayerのRenderTextureへ逐次焼き込み
  -> pointerupで履歴と最終状態を確定
```

- ペンと消しゴムは同じライブラスター基盤を使う。
- 消しゴムは背景色塗りではなく `blendMode = 'erase'` による透明化。
- 座標は drawing-engine 側へ集約し、同一pointを二重変換しない。
- PixiJS `toLocal()` / `toGlobal()` を描画座標変換へ使わない。
- DPRは1倍。内部2倍化や `resolution: 2` を採用しない。
- 出力サイズと内部作業サイズを一致させる。
- `perfect-freehand` は補助経路。線を過度に丸める既定値へ戻さない。

## 5. Layer・CAF・Timeline境界

- 通常Layerの正本は `LayerSystem`。
- アニメの正本は `TimelineModel / Lane / Clip / ClipAsset / DrawingSnapshot`。
- animation working Layerは、選択CAFを既存描画engineへ接続する一時的な表示・入力アダプター。
- working Layerを保存正本や全Frame共通Layerとして扱わない。
- CAF切替やFrame切替だけでHistoryをリセットしない。
- Raster履歴は変更対象の前後Snapshotを保持し、無関係なCAF全体を複製しない。
- 通常LayerとCAF内部Layerは、UI rendererを共有してもdata adapterとHistory復元先を分離する。
- Layer Panel / CAF UIは「1つのUI engine、2つのdata adapter」を維持する。
- 責務詳細は `tegaki_work/PHASE4Z_BOUNDARY.md` を参照する。

## 6. RenderTexture・変形・履歴

- 各描画LayerはRenderTextureを持ち、Spriteで表示する。
- リサイズ後はRenderTexture、表示範囲、描画可能範囲、thumbnail抽出範囲を一致させる。
- Vキー変形はpreviewと確定を分離し、確定時に一度だけラスターへ焼き込む。
- 変形確定後はcontainerのscale / rotationを通常状態へ戻す。
- History commandの現行契約は `{ name, do, undo, byteSize?, meta? }`。
- 件数上限と推定メモリ上限の両方を適用し、線形Undo順を壊さず古い履歴から破棄する。
- class階層の導入は目的ではない。既存command契約で表現できない具体的問題がある場合だけ再設計する。

## 7. EventBus・グローバル

- event名は原則 `component:action`。
- `emit` / `on` の追加・変更前に、同名eventを `rg` で全検索する。
- event名だけでなくpayload構造を1種類へ統一する。
- 送信側と受信側を同じ変更内で更新する。
- `TegakiEventBus.EVENTS` は有効な共有定数として使えるが、全eventの機械的一括置換は行わない。
- listener無しemit、emit無しlistener、旧system依存は、実検索で未使用を証明してから削除する。
- `window.*` は既存互換境界として残る。新規追加を避け、削減は依存先を確認して段階的に行う。

## 8. UI・カラーパレット

キャンバスを主役にし、大きな常設windowを増やさない。
popup、Layer Panel、Timelineは液タブのペン操作で成立させる。

安易な黒・白・グレーの直書きを避け、原則として次のCSS変数を使う。

```text
--futaba-maroon:       #800000
--futaba-light-maroon: #9c3835
--futaba-medium:       #b8706b
--futaba-light-medium: #d4a8a0
--futaba-cream:        #f0e0d6
--futaba-background:   #ffffee
--text-primary:        #2c1810
--text-secondary:      #5d4037
--active-border:       #ff8c42
```

- 通常文字、disabled文字、input/select/optionもパレット範囲へ揃える。
- 色やscrollbarを実装する前に、CSS変数と `.ui-scrollbar` 等の共通classを検索して再利用する。
- 共通定義が存在する場合、同じ役割の色値・scrollbar装飾をcomponent内へ再定義しない。
- 静的装飾はCSS classで管理する。
- 動的な座標・寸法・D&D shift・canvas/Pixi色変換は必要な範囲でJSが扱ってよい。
- popupの重なりはz-index値だけでなく、mount先とstacking contextを確認する。
- 命名・component規約は `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md` を参照する。
- 既存classを一括renameしない。変更対象component内で互換性を保ちながら段階移行する。

## 9. ファイル責務とヘッダー

- 実際のimport、export、EventBus検索結果を依存関係の正本とする。
- 新規fileは責務と公開APIが分かる短いJSDocを付ける。
- 既存headerがあるfileは、責務・公開API・event契約が変わった時に更新する。
- 「被依存」一覧を毎回完全手動同期することや、全fileへ長い定型headerを追加することは必須にしない。
- headerがコードと矛盾する場合はコードを推測せず、headerを修正する。

## 10. 凍結・禁止事項

- WebGPU、SDF/MSDF、WebGL2 Meshの新規採用・復活。
- Canvas2Dを本番stroke描画へ混入。
- `import { BlendMode } from 'pixi.js'`。
- 背景色で塗る消しゴム。
- 内部2倍解像度化。
- 通常LayerとCAF data modelの安易な統合。
- 描画target抽象class、BasePopup、HistoryCommand class等を、利用箇所の具体的重複なしに先行導入すること。
- EventBus literalやCSS classの全件一括置換。
- 二重実装、循環依存、暗黙のfallback、黙ったstate修復。
- 調査ログやbuild生成物を不要な差分として残すこと。

## 11. 作業規律

実装前:

1. `AGENTS.md`、本書、`PROGRESS.md`、Phase指示書を読む。
2. `rg` で同責務、同名event、global、CSS classを確認する。
3. 受け入れ条件と対象外を確定する。
4. 主要class再構成や大幅DOM変更が必要なら先に相談する。

実装後:

1. 構文確認と `npm.cmd run build`。
2. 関連UI、描画、Undo/Redo、保存/出力を規模に応じて実操作確認。
3. browser consoleの新規errorを確認。
4. `PROGRESS.md` を現在状態へ更新。
5. 完了Phase指示書をArchiveへ移す。
6. `dist/` 等の生成差分を残さない。

## 12. 現行ロードマップ

- 完了: Phase 5a、Phase 5b、Phase 5c。
- 次の機能Phase: `task-codex/phase5d.md`。
- 保守性・UIスタイル整理: `task-codex/phase5e.md`。機能Phaseの前提にはせず、独立した監査・小分け修正として扱う。

過去Phase一覧は本書へ再掲しない。完了内容はArchiveとGit履歴を参照する。
