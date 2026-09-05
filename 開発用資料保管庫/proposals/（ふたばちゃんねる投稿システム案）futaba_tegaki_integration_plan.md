> 状態: REFERENCE — 2026-09-05再構成で現行の作業順/正本から分離。採用済み事項と未採用案が混在する原資料。本文中のACTIVE/現行Phase/次の作業は執筆時点の記録。現在の判断は `docs/ROADMAP.md`、実装状態は `docs/AUDIT.md`、資料の効力は `docs/DOCUMENT_REGISTER.md` を参照する。

# ふたば手書きゾーン連携 実装計画書

## 1. 文書の目的

現在開発中のお絵かきツールを、既存の `t3start.js` の仕組みを流用してふたば☆ちゃんねる上で起動し、完成画像をふたば側の手書き Canvas（`#oejs`）へ最大 400 × 400 ピクセルの範囲で焼き付ける。

本計画では、既存ツール本体とふたば固有処理を分離し、まずブックマークレットとして動作させた後、必要に応じてブラウザ拡張機能や専用ブラウザへ展開できる構成を採用する。

---

## 2. 背景

既存の `t3start.js` には、以下の処理がすでに実装されている。

- ふたばの「手書き JS」ボタンを押し、手書き Canvas を生成する
- 外部のお絵かきツールを全画面 iframe として表示する
- 既存の手書き画像を iframe 内のお絵かきツールへ渡す
- お絵かきツールの全レイヤーを統合し、PNG Data URL として親ページへ送る
- 受信した画像を縦横比を維持して最大 400 × 400 に縮小する
- 縮小画像をふたば側の `#oejs` Canvas へ描画する
- 完了後に iframe を閉じ、ページのスクロール状態を復元する

このため、新しいお絵かきツールとの統合では、ふたば連携部分をゼロから作るのではなく、既存コードを「ふたば用アダプター」として再構成する。

---

## 3. 実装目標

### 3.1 必須目標

1. ふたばのレス投稿画面から新しいお絵かきツールを起動できる。
2. 既存の `#oejs` の内容を新しいツールへ読み込める。
3. 新しいツールの表示レイヤーを一枚の画像へ統合できる。
4. 統合画像をふたば側の `#oejs` へ焼き付けられる。
5. 出力画像を縦横比を維持したまま最大 400 × 400 に収める。
6. 投稿ボタンは自動で押さず、最終投稿は利用者が確認して行う。
7. エラー発生時にも iframe とスクロール状態を安全に復元する。

### 3.2 将来目標

- PNG のクリップボードコピー
- ファイル添付欄への PNG セット
- ブラウザ拡張機能化
- キーボードショートカットでの起動・終了
- 板ごとのフォーム差異を吸収するアダプター
- 専用ブラウザ風アプリへの組み込み

---

## 4. 推奨する出力仕様

### 4.1 標準モード

標準では、画像全体を縦横比を維持して最大 400 × 400 に収める。

例：

| 元画像 | 出力サイズ |
|---|---:|
| 800 × 600 | 400 × 300 |
| 600 × 900 | 267 × 400 |
| 344 × 135 | 344 × 135 |
| 200 × 100 | 200 × 100 |

小さい画像は原則として拡大しない。これにより、線のぼやけや不要な補間を避ける。

### 4.2 任意の固定 400 × 400 モード

必要になった場合は、出力 Canvas 自体を 400 × 400 に固定し、その中央へ画像を配置するモードを追加する。

- 余白は透明を標準とする
- オプションで白背景へ焼き付け可能にする
- 元画像は縦横比を維持する
- 小さい画像を拡大するかどうかは設定可能にする

初期実装では、不要な透明余白を作らない「最大 400 × 400 の可変サイズ」を標準とする。

---

## 5. システム構成

```text
ふたばのページ
  ├─ 手書きボタン #oebtnj
  ├─ 手書き領域 #oest1
  ├─ 手書き Canvas #oejs
  │
  └─ ふたば用アダプター
       ├─ 手書き Canvas の生成待機
       ├─ オーバーレイ iframe の生成
       ├─ 既存画像の送信
       ├─ 完成画像の受信
       ├─ 400px 制限処理
       └─ #oejs への焼き付け

iframe 内のお絵かきツール
  ├─ Canvas／レイヤー管理
  ├─ 既存画像の読み込み
  ├─ 全表示レイヤーの統合
  ├─ PNG 化
  └─ 親ページへのエクスポート通知
```

---

## 6. 責務の分離

### 6.1 お絵かきツール本体

お絵かきツール本体は、ふたばの DOM を直接操作しない。

担当する処理：

- 描画
- レイヤー管理
- Undo／Redo
- 既存画像の読み込み
- 表示レイヤーの統合
- PNG Blob または Data URL の生成
- 親側へのエクスポート通知

### 6.2 ふたば用アダプター

ふたば用アダプターは、掲示板固有の処理だけを担当する。

担当する処理：

- `#oebtnj` の検出と実行
- `#oejs` の検出
- iframe の生成・破棄
- `postMessage` の送受信
- 400px 制限
- `#oejs` への描画
- ページスクロールの停止・復元
- エラー表示

この分離により、ふたば側の HTML が変更された場合も、描画ツール本体を修正せずにアダプターだけを更新できる。

---

## 7. 通信仕様

### 7.1 初期画像の送信

親ページから iframe へ、既存の `#oejs` の画像を送る。

```ts
interface InitMessage {
  type: 'oekaki:init';
  imageDataUrl: string;
}
```

既存画像が空の場合は、メッセージを送らないか、`imageDataUrl` を省略する。

### 7.2 完成画像の送信

iframe から親ページへ、統合済みの画像を送る。

```ts
interface ExportMessage {
  type: 'oekaki:export';
  imageDataUrl: string;
  width: number;
  height: number;
  mimeType: 'image/png';
}
```

### 7.3 終了要求

保存せずに閉じる場合と、完成画像を反映して閉じる場合を分ける。

```ts
type CloseMessage =
  | { type: 'oekaki:cancel' }
  | { type: 'oekaki:export'; imageDataUrl: string; width: number; height: number; mimeType: 'image/png' };
```

### 7.4 通信の安全性

現行コードの `postMessage(..., '*')` は初期検証では利用できるが、受信時に最低限以下を確認する。

- `event.source === iframe.contentWindow`
- `event.data` がオブジェクトであること
- `event.data.type` が許可済みの値であること
- Data URL が `data:image/png` で始まること
- 想定外に大きなデータを拒否すること

ブラウザ拡張機能化する際は、可能な範囲で送信先 origin を限定するか、`MessageChannel` の利用を検討する。

---

## 8. 画像統合処理

お絵かきツール側では、表示対象のレイヤーを順番に一枚の Canvas へ統合する。

```ts
async function exportMergedCanvas(): Promise<HTMLCanvasElement> {
  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = canvasWidth;
  mergedCanvas.height = canvasHeight;

  const ctx = mergedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context を取得できません');
  }

  for (const layer of layerManager.layers) {
    if (!layer.visible) continue;
    ctx.drawImage(layer.canvas, 0, 0);
  }

  return mergedCanvas;
}
```

統合後は PNG として親側へ送る。

```ts
const mergedCanvas = await exportMergedCanvas();

window.parent.postMessage(
  {
    type: 'oekaki:export',
    imageDataUrl: mergedCanvas.toDataURL('image/png'),
    width: mergedCanvas.width,
    height: mergedCanvas.height,
    mimeType: 'image/png',
  },
  '*',
);
```

将来的には、メモリ消費を抑えるため `toDataURL()` から `toBlob()` と transferable なデータへの移行を検討する。

---

## 9. 最大 400 × 400 への変換仕様

親側で画像を受信後、次の計算を行う。

```js
const maxSize = 400;
const scale = Math.min(
  1,
  maxSize / img.width,
  maxSize / img.height,
);

const outputWidth = Math.max(1, Math.round(img.width * scale));
const outputHeight = Math.max(1, Math.round(img.height * scale));
```

### 9.1 重要事項

- Canvas の幅・高さには整数を設定する
- 幅または高さが 0 にならないよう最低 1px を保証する
- 縦横比を変更しない
- 400px 未満の画像は標準では拡大しない
- 画像の透明度を維持する

### 9.2 `#oejs` への焼き付け

```js
oejs.width = outputWidth;
oejs.height = outputHeight;

const ctx = oejs.getContext('2d');
if (!ctx) {
  throw new Error('手書き Canvas を取得できません');
}

ctx.clearRect(0, 0, outputWidth, outputHeight);
ctx.drawImage(
  img,
  0,
  0,
  img.width,
  img.height,
  0,
  0,
  outputWidth,
  outputHeight,
);
```

必要に応じて、描画後に `input`、`change`、またはふたば側が期待する独自イベントを発火する。ただし、初期実装では Canvas の直接更新だけで投稿できるかを先に確認する。

---

## 10. 既存画像の読み込み仕様

現在の `#oejs` に画像がある場合、その内容を新しいお絵かきツールの背景または専用インポートレイヤーへ読み込む。

画像の縦横比が新しいツールの Canvas と異なる場合、全面引き伸ばしは行わない。

推奨動作：

1. 元画像の縦横比を維持する
2. 新しい Canvas 内へ全体が収まるよう縮小する
3. Canvas 中央へ配置する
4. 元画像より描画領域が大きくても、標準では拡大しない
5. 読み込み先は背景レイヤーまたは新規レイヤーから選べるようにする

```js
const scale = Math.min(
  1,
  targetCanvas.width / img.width,
  targetCanvas.height / img.height,
);

const width = Math.round(img.width * scale);
const height = Math.round(img.height * scale);
const x = Math.round((targetCanvas.width - width) / 2);
const y = Math.round((targetCanvas.height - height) / 2);

ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
ctx.drawImage(img, x, y, width, height);
```

---

## 11. 手書き Canvas の生成待機

現行コードでは、手書きボタンを押した後に固定の `setTimeout(..., 300)` で待機している。

初期版では流用可能だが、安定版では `MutationObserver` に置き換える。

### 推奨処理

1. `#oebtnj` を押す
2. 既に `#oejs` があれば即時使用する
3. なければ `#oest1` または `document.body` を監視する
4. `#oejs` が生成された時点で監視を終了する
5. 一定時間で見つからない場合はタイムアウトエラーにする

```ts
function waitForElement(
  selector: string,
  timeoutMs = 5000,
): Promise<Element> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;

      observer.disconnect();
      clearTimeout(timeoutId);
      resolve(element);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`${selector} の生成を確認できませんでした`));
    }, timeoutMs);
  });
}
```

---

## 12. iframe 表示仕様

### 12.1 表示

- `position: fixed`
- `top: 0`
- `left: 0`
- `width: 100vw`
- `height: 100vh`
- 高い `z-index`
- 背景ページのスクロールを停止
- ページ側 CSS の影響を避けるため、お絵かきツールは iframe 内で動作させる

### 12.2 終了

終了経路を共通関数へまとめる。

```ts
function cleanupOverlay(): void {
  window.removeEventListener('message', messageHandler);
  observer?.disconnect();
  iframe?.remove();
  restorePageScroll();
}
```

次のすべての経路で `cleanupOverlay()` を必ず実行する。

- 正常な画像反映
- キャンセル
- iframe 読み込み失敗
- 画像デコード失敗
- `#oejs` 取得失敗
- 予期しない例外

---

## 13. 実装フェーズ

### フェーズ 1：既存コードの切り分け

目的：`t3start.js` の機能を整理し、描画ツール固有コードとふたば固有コードを分離する。

作業内容：

- 現行処理のイベントフローを図示する
- DOM セレクターを定数化する
- オーバーレイ生成処理を関数化する
- スクロール保存・復元処理を関数化する
- メッセージ受信処理を関数化する
- 画像縮小・焼き付け処理を関数化する
- エラー処理を一か所へ集約する

成果物：

- `futabaAdapter.ts` または `futaba-adapter.js`
- 既存動作を維持したリファクタリング版ブックマークレット

### フェーズ 2：新しいお絵かきツールのエクスポート API

目的：新しいツールから、ふたば側へ渡せる一枚の PNG を生成する。

作業内容：

- 表示レイヤーの統合関数を追加する
- PNG エクスポート関数を追加する
- 親フレームへの送信処理を追加する
- キャンセル処理を追加する
- エクスポート中の二重実行を防止する

成果物：

- `exportMergedCanvas()`
- `exportDrawing()`
- `postExportMessage()`

### フェーズ 3：既存手書き画像のインポート

目的：ふたば側の既存画像を新しいツールで継続編集できるようにする。

作業内容：

- `oekaki:init` メッセージを受信する
- Data URL を `ImageBitmap` または `Image` に変換する
- 縦横比を維持して読み込む
- 読み込み先レイヤーを定義する
- Undo 履歴の初期状態として保存する

成果物：

- `importInitialImage()`
- 初期画像読み込みテスト

### フェーズ 4：400px 焼き付け処理

目的：完成画像を安全に `#oejs` へ反映する。

作業内容：

- 画像サイズの整数化
- 最大 400px の縮小計算
- 透明度を保った Canvas 描画
- Canvas コンテキスト取得失敗時の処理
- 画像デコード失敗時の処理
- 反映後の後片付け

成果物：

- `fitWithinMaxSize()`
- `burnImageToTegakiCanvas()`

### フェーズ 5：安定化

目的：ページの読み込み速度や DOM の変化に左右されにくくする。

作業内容：

- 固定タイマーを `MutationObserver` へ変更する
- メッセージ構造の検証を追加する
- 二重起動防止を追加する
- 連続起動テストを行う
- 例外時のスクロール復元を保証する
- 画像サイズとメモリ使用量の上限を設定する

### フェーズ 6：拡張機能化

目的：ブックマークレットの文字数制限や CSP の影響を減らし、安定した起動環境を作る。

作業内容：

- Manifest V3 の作成
- content script からアダプターを実行する
- お絵かきツールを拡張機能内へ同梱する
- iframe URL を拡張機能内ページへ変更する
- 必要最小限の `host_permissions` を設定する
- ツールバーボタンまたはショートカットを追加する

---

## 14. 推奨ディレクトリ構成

```text
project/
├─ apps/
│  ├─ drawing-web/
│  │  └─ 現在のお絵かきツール
│  │
│  └─ futaba-extension/
│     ├─ manifest.json
│     ├─ content-script.ts
│     ├─ overlay.ts
│     └─ service-worker.ts
│
├─ packages/
│  ├─ drawing-core/
│  │  ├─ canvas/
│  │  ├─ layers/
│  │  ├─ tools/
│  │  └─ export/
│  │
│  └─ futaba-adapter/
│     ├─ selectors.ts
│     ├─ waitForTegakiCanvas.ts
│     ├─ overlayController.ts
│     ├─ messageProtocol.ts
│     ├─ imageResize.ts
│     └─ burnToCanvas.ts
│
└─ bookmarklet/
   └─ t3start-next.js
```

ブックマークレット版と拡張機能版で、`futaba-adapter` の中核処理を共有する。

---

## 15. テスト計画

### 15.1 サイズ変換テスト

| 入力 | 期待値 |
|---|---:|
| 400 × 400 | 400 × 400 |
| 800 × 800 | 400 × 400 |
| 800 × 600 | 400 × 300 |
| 600 × 800 | 300 × 400 |
| 344 × 135 | 344 × 135 |
| 1 × 1 | 1 × 1 |
| 401 × 400 | 400 × 399 前後 |

端数は `Math.round()` による整数化を前提とする。

### 15.2 画像内容テスト

- 透明背景が保持される
- 半透明ブラシが保持される
- レイヤー順が保持される
- 非表示レイヤーが出力されない
- 消しゴムで透明化した部分が保持される
- 縦長画像が歪まない
- 横長画像が歪まない

### 15.3 操作テスト

- 初回起動
- 二重起動
- 起動後のキャンセル
- 描画後の反映
- 反映後の再起動
- 既存画像を読み込んで追記
- 画像反映後に通常投稿できる
- 投稿ボタンが自動で押されない

### 15.4 異常系テスト

- `#oebtnj` が存在しない
- `#oest1` が存在しない
- `#oejs` が生成されない
- ツール HTML の取得に失敗する
- iframe の読み込みに失敗する
- 不正なメッセージを受信する
- Data URL の画像デコードに失敗する
- Canvas コンテキストが取得できない
- 処理途中で iframe が削除される

すべての異常系で、ページのスクロール状態が復元されることを確認する。

---

## 16. 完了条件

次の条件をすべて満たした時点で、ブックマークレット版の初期実装を完了とする。

- ふたば上でお絵かきツールを全画面表示できる
- 既存の手書き画像を読み込める
- 複数レイヤーを正しい順序で統合できる
- 完成画像を PNG として親ページへ渡せる
- 長辺が 400px を超える画像を正しく縮小できる
- 縦横比を維持して `#oejs` へ焼き付けられる
- 400px 以下の画像を不要に拡大しない
- 透明度が保持される
- 投稿操作を自動実行しない
- 正常終了、キャンセル、例外のすべてで iframe とスクロール状態を復元できる
- 連続して複数回起動してもイベントリスナーが重複しない

---

## 17. Codex への実装指示案

### タスク 1：調査とリファクタリング

```text
現在のプロジェクトと t3start.js を調査し、既存動作を維持したまま、
ふたば固有処理を独立したアダプターへ分離してください。

要件:
- 変更前に現在のイベントフローと依存関係を説明する
- DOM セレクターを定数化する
- iframe の生成・破棄を関数化する
- スクロール状態の保存・復元を関数化する
- postMessage の送受信を関数化する
- 最大 400px への縮小処理を純粋関数として分離する
- 正常終了、キャンセル、例外で共通 cleanup を必ず実行する
- 現時点では投稿ボタンを操作しない
- 実装後に構文確認、型チェック、既存テストを実行する
```

### タスク 2：新ツールのエクスポート API

```text
新しいお絵かきツールに、表示中の全レイヤーを一枚の Canvas へ統合し、
PNG として親 iframe へ渡すエクスポート API を追加してください。

要件:
- 非表示レイヤーは除外する
- レイヤー順を維持する
- 透明度を維持する
- Canvas context が取得できない場合は明示的な例外にする
- export の二重実行を防止する
- postMessage の type は oekaki:export とする
- width、height、mimeType も送信する
- キャンセル用の oekaki:cancel も追加する
- 単独 Web アプリとしての既存動作を壊さない
```

### タスク 3：400px 焼き付け

```text
親ページが oekaki:export を受信した際、画像を縦横比を維持したまま
最大 400 × 400 に収め、ふたばの #oejs Canvas へ焼き付けてください。

要件:
- 400px 以下の画像は拡大しない
- 出力 width と height は Math.round で整数化する
- 最低サイズは 1 × 1 とする
- 透明度を維持する
- event.source が対象 iframe であることを確認する
- data:image/png 以外を拒否する
- 反映後に投稿ボタンは押さない
- 成功後と失敗後の両方で cleanup を実行する
```

### タスク 4：生成待機の安定化

```text
手書きボタン押下後の固定 setTimeout を MutationObserver ベースの待機処理へ
置き換えてください。

要件:
- 既に #oejs が存在する場合は即時返却する
- document の subtree を監視する
- #oejs 発見後は observer を解除する
- 5 秒でタイムアウトする
- タイムアウト時に分かりやすいエラーを表示する
- observer と timer が必ず解放されることをテストする
```

---

## 18. 想定リスクと対策

### 18.1 ふたば側 DOM の変更

リスク：`#oebtnj`、`#oest1`、`#oejs` の構造が変更される。

対策：

- セレクターを一か所へ集約する
- 要素の役割を複数条件で確認する
- 板ごとの差異を設定ファイル化する

### 18.2 CSP・CORS による読み込み失敗

リスク：ブックマークレットから外部 HTML を取得できない。

対策：

- 初期版は現行方式で検証する
- 安定版はブラウザ拡張機能へ移行する
- ツール本体を拡張機能内へ同梱する

### 18.3 Data URL のメモリ消費

リスク：大きな Canvas を Base64 化すると、一時的なメモリ消費が増える。

対策：

- 出力直前に必要サイズへ縮小する
- 将来的に Blob／ArrayBuffer ベースへ変更する
- 最大 Canvas サイズを制限する

### 18.4 イベントリスナーの重複

リスク：繰り返し起動すると複数の message handler が残る。

対策：

- cleanup 関数を共通化する
- 起動ごとに一意のセッション ID を使用する
- `AbortController` でイベントをまとめて解除することも検討する

### 18.5 既存画像の変形

リスク：既存画像を新ツールの Canvas 全面へ引き伸ばすと縦横比が崩れる。

対策：

- contain 方式で中央配置する
- 拡大の可否を設定にする
- 元サイズ情報を保持する

---

## 19. 初期リリースの範囲

初期リリースでは、以下だけを完成させる。

- ブックマークレットから新しいツールを起動
- 既存画像の読み込み
- 描画とレイヤー統合
- 最大 400 × 400 への縮小
- `#oejs` への焼き付け
- キャンセル
- エラー時の復旧

以下は初期リリースに含めない。

- 投稿ボタンの自動押下
- 投稿内容の自動送信
- クリップボードへの自動書き込み
- 添付ファイル入力への自動セット
- 複数サイト対応
- 専用ブラウザ化

---

## 20. 結論

`t3start.js` は、新しいお絵かきツールとふたばの手書きゾーンをつなぐ基礎として流用できる。

特に、iframe によるツール表示、`postMessage` による画像受け渡し、全レイヤー統合、最大 400px への縮小、`#oejs` への `drawImage()` という中核フローはそのまま活用可能である。

実装では、既存コードを一枚のブックマークレットとして拡張し続けるのではなく、次の三層へ分離する。

1. お絵かきツール本体
2. 共通エクスポート処理
3. ふたば用アダプター

この構成にしておけば、まずブックマークレットとして完成させ、その後ブラウザ拡張機能や「お絵かきツール付きブラウザ」へ段階的に発展させられる。
