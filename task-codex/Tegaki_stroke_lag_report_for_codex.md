# Tegaki ブラウザお絵かきツール：描画ストローク遅延の分析・調査提案書

作成日: 2026-07-02  
目的: Codex に実装調査・計測追加・改善案の検討を依頼するための報告書

---

## 1. 現象の概要

ブラウザ上のお絵かきツールで、描画ストローク中にまれに入力・描画が一時停止し、約 0.5 秒程度の遅延後に、停止中に動かしていた軌跡がまとめて描画される現象が発生している。

ユーザー観察では、通常時には頻発しないが、外部画像をインポートした後、その画像レイヤーや別レイヤー上で描画していると発生確率が上がるように見える。

Console 上では、この現象に直接対応する JavaScript 例外や致命的エラーは確認されていない。したがって、現時点では「エラーによる停止」ではなく、「メインスレッド、GPU同期、レイヤー合成、テクスチャ更新、メモリ確保、GC などによる一時的な処理詰まり」として扱う。

---

## 2. Console ログから見える前提

最新の Console ログでは、主に以下のサブシステムが正常ロード・初期化されている。

- `pressure-handler.js`
  - 距離ベースフィルタ対応
  - `window.PressureHandler` として公開
- `timeline-ui.js`
  - レイヤー変形連携版
- `webgl2-drawing-layer.js`
  - WebGL2 描画レイヤー
  - `window.WebGLContext` / `window.WebGL2DrawingLayer`
- `gl-stroke-processor.js`
  - GL stroke processor
  - カメラフレーム外描画防止、ポイント座標検証
- `gl-msdf-pipeline.js`
  - MSDF pipeline
  - テクスチャサイズ計算・アスペクト比保持
- `gl-texture-bridge.js`
  - WebGLTexture → PIXI.Sprite 変換
  - PixiJS v8 対応
  - `Texture.from()` 直接使用
- `gl-mask-layer.js`
  - Circle mask rendering
  - Additive blend 対応
- `png-exporter.js` / `apng-exporter.js` / `gif-exporter.js` / `webp-exporter.js` / `psd-exporter.js`
  - 各種エクスポート・プレビュー関連機能

ログ上の `Popup "animationTable" not registered` / `not ready` は登録順・初期化順の警告に見える。今回のストローク遅延と直接関係している可能性は低いが、描画中に UI 更新やポップアップ関連処理が走っていないかは念のため確認対象とする。

---

## 3. 現時点での主要仮説

### 仮説 A: pointermove / pointerrawupdate 中に重い処理が混入している

ストローク中の入力イベント内で、座標追加以外の重い処理を実行している可能性がある。

具体例:

- 全レイヤー合成
- レイヤーサムネイル更新
- undo スナップショット作成
- アルバム・プレビュー更新
- PNG/WebP 用のプレビュー生成
- 外部画像レイヤーの再描画・再変換
- PixiJS Texture / Sprite / RenderTexture の再作成
- Canvas / WebGL からの readback

この場合、処理中はメインスレッドが止まり、その間に溜まった pointer イベントが後からまとめて処理される。症状としては「線が消える」よりも「止まった後、軌跡が一気に描かれる」形になりやすい。

### 仮説 B: 外部画像レイヤーが高解像度のまま毎フレーム処理されている

外部画像をインポートした後に発生率が上がるなら、画像レイヤーが内部的に大きすぎる可能性がある。

表示上は小さく見えていても、内部では 3000px〜8000px 級の元画像を保持し、ストローク中に毎回スケーリング・合成・テクスチャ更新している場合、ハイスペック GPU でも遅延が出る。

確認事項:

- インポート画像の元解像度
- キャンバス作業用に縮小済みのテクスチャを作っているか
- 毎フレーム `drawImage()` で巨大画像を縮小描画していないか
- WebGL の `texImage2D()` / `texSubImage2D()` で大きなテクスチャを頻繁に再アップロードしていないか
- PixiJS 側で Texture / Sprite を再生成していないか

### 仮説 C: CPU-GPU 同期がストローク中に発生している

WebGL / Canvas で以下のような処理をストローク中に呼ぶと、GPU 側の処理完了を CPU が待つ可能性がある。

特に確認すべき API / 処理:

- `gl.readPixels()`
- `canvas.getContext('2d').getImageData()`
- `putImageData()` の大面積更新
- `canvas.toDataURL()`
- `canvas.toBlob()`
- 大きな `texImage2D()`
- 大きな `texSubImage2D()`
- `renderer.extract.*` 系処理
- RenderTexture から CPU 側へ戻す処理

この場合、GPU の絶対性能が高くても、同期待ちが発生した瞬間に UI と入力が停止する。

### 仮説 D: undo / history / thumbnail がストローク中に重い

undo 用に毎ポインターイベントまたは短い間隔でキャンバス全体・全レイヤーをコピーしていると、外部画像インポート後にメモリ負荷が急増する。

問題化しやすい処理:

- レイヤーごとのフルサイズ画像コピー
- `ImageData` の大量生成
- Blob / DataURL 生成
- JSON 化できない巨大データの clone
- 配列・オブジェクトの大量生成
- stroke 中の autosave 的処理

この場合、直接の重い処理だけでなく、GC による 100ms〜500ms 級の停止も起こりうる。

### 仮説 E: PixiJS / WebGLTexture bridge の再生成コスト

ログ上では `gl-texture-bridge.js` による WebGLTexture → PIXI.Sprite 変換、および PixiJS v8 の `Texture.from()` 使用が見える。

この変換は設計上必要な可能性があるが、ストローク中に毎回走っている場合は疑うべきである。

確認事項:

- `Texture.from()` が stroke 中に何回呼ばれているか
- `new PIXI.Sprite()` が stroke 中に何回呼ばれているか
- RenderTexture を stroke 中に作り直していないか
- 既存 Texture / Sprite を使い回しているか
- Texture の destroy / recreate が頻発していないか

### 仮説 F: pointer イベント処理と描画処理が分離されていない

理想的には、入力イベントでは座標・筆圧・時刻を軽量バッファに積むだけにし、描画は `requestAnimationFrame` 側でまとめて処理する。

もし `pointermove` 内で即座にレンダリング、合成、UI 更新まで行っている場合、1 回のイベント処理が重くなると後続イベントが詰まる。

---

## 4. WebGPU 化についての判断

### 結論

WebGPU 化は長期的には意味がある可能性が高いが、今回の 0.5 秒停止の第一対策としては優先度を下げるべきである。

理由は、今回の症状が「GPU の描画能力不足」よりも、「メインスレッドの詰まり」「CPU-GPU 同期」「大容量テクスチャ転送」「undo / preview / thumbnail / layer composite の実行タイミング不備」によって起きている可能性が高いためである。

### WebGPU 化で改善しやすいもの

- 大量のブラシ粒子・スタンプ描画
- レイヤーブレンド
- マスク処理
- フィルタ処理
- 変形処理
- ぼかし・発光・水彩風拡散
- 将来的な物理演算
- 将来的な GPU compute 的処理

### WebGPU 化しても改善しにくいもの

- `pointermove` 内の重い JavaScript 処理
- undo 用の巨大コピー
- サムネイル・プレビュー生成
- `toDataURL()` / `toBlob()` / `getImageData()` / `readPixels()` による同期
- 画像の再デコード
- 毎フレームの Texture / Sprite / RenderTexture 再生成
- 大量オブジェクト生成による GC
- メインスレッドでの UI 更新詰まり

### 判断

今回の修正方針は、まず WebGPU 移行ではなく、以下を先に行うべきである。

1. 遅延の発生箇所を計測する
2. stroke 中に実行されている重い処理を特定する
3. stroke 中の処理を最小化する
4. 外部画像レイヤーの解像度・テクスチャ更新を確認する
5. undo / thumbnail / preview / export 系処理を stroke end 後に遅延させる
6. CPU-GPU 同期処理を stroke 中から排除する

WebGPU 化は、この修正後にまだ「純粋な描画・合成負荷」が問題として残る場合に、別ブランチで検証するのが安全である。

---

## 5. Codex への依頼内容

以下の方針で調査・修正を行ってください。

### 5.1 まず計測ログを追加する

`performance.now()` を使い、以下の処理時間を計測してください。

対象:

- `pointermove`
- `pointerrawupdate`
- `pointerdown`
- `pointerup`
- brush point buffering
- pressure handling
- stroke rendering
- GL stroke processor
- layer compositing
- imported image layer rendering
- mask rendering
- texture upload
- WebGLTexture → PIXI.Sprite bridge
- `PIXI.Texture.from()`
- `new PIXI.Sprite()`
- RenderTexture creation / resize / destroy
- undo snapshot
- history push
- thumbnail update
- album preview update
- export preview generation
- any `getImageData()`
- any `putImageData()`
- any `toDataURL()`
- any `toBlob()`
- any `readPixels()`

### 5.2 Long task 検出ログを追加する

以下のしきい値でログを出してください。

- 16ms 超過: frame budget warning
- 33ms 超過: visible frame drop warning
- 50ms 超過: stroke lag warning
- 100ms 超過: severe lag warning
- 250ms 超過: freeze-level warning

ログには以下を含めてください。

- 処理名
- 所要時間
- 現在のツール
- 描画中かどうか
- レイヤー数
- 可視レイヤー数
- アクティブレイヤー種別
- インポート画像レイヤーの有無
- インポート画像の元解像度
- キャンバス解像度
- 使用中 texture 数
- stroke 中の point 数
- undo / thumbnail / preview 実行有無

---

## 6. 計測用ユーティリティ案

以下のような軽量プロファイラを追加し、重い処理だけを Console に出す。

```js
window.TegakiPerf = window.TegakiPerf || {
  enabled: true,
  thresholds: {
    frame: 16,
    drop: 33,
    lag: 50,
    severe: 100,
    freeze: 250,
  },
  measure(label, fn, extra = {}) {
    if (!this.enabled) return fn();
    const start = performance.now();
    try {
      return fn();
    } finally {
      const dt = performance.now() - start;
      const level =
        dt >= this.thresholds.freeze ? 'FREEZE' :
        dt >= this.thresholds.severe ? 'SEVERE' :
        dt >= this.thresholds.lag ? 'LAG' :
        dt >= this.thresholds.drop ? 'DROP' :
        dt >= this.thresholds.frame ? 'FRAME' :
        null;

      if (level) {
        console.warn(`[TegakiPerf:${level}] ${label}: ${dt.toFixed(2)}ms`, extra);
      }
    }
  }
};
```

使用例:

```js
function onPointerMove(event) {
  return window.TegakiPerf.measure('pointermove.total', () => {
    // 既存処理
  }, getTegakiPerfContext());
}
```

非同期処理用:

```js
window.TegakiPerf.measureAsync = async function measureAsync(label, fn, extra = {}) {
  if (!this.enabled) return await fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const dt = performance.now() - start;
    if (dt >= this.thresholds.frame) {
      console.warn(`[TegakiPerf] ${label}: ${dt.toFixed(2)}ms`, extra);
    }
  }
};
```

---

## 7. monkey patch での危険 API 検出案

開発時のみ、以下の API 呼び出しを検出する。

```js
(function installTegakiDangerousApiWatch() {
  if (window.__tegakiDangerousApiWatchInstalled) return;
  window.__tegakiDangerousApiWatchInstalled = true;

  const warn = (name) => {
    console.warn(`[TegakiPerf:DANGEROUS_API] ${name} called during runtime`, {
      isDrawing: window.TegakiDebug?.isDrawing,
      stack: new Error().stack,
    });
  };

  const canvasProto = HTMLCanvasElement.prototype;

  const originalToDataURL = canvasProto.toDataURL;
  canvasProto.toDataURL = function(...args) {
    warn('HTMLCanvasElement.toDataURL');
    return originalToDataURL.apply(this, args);
  };

  const originalToBlob = canvasProto.toBlob;
  canvasProto.toBlob = function(...args) {
    warn('HTMLCanvasElement.toBlob');
    return originalToBlob.apply(this, args);
  };

  const originalGetContext = canvasProto.getContext;
  canvasProto.getContext = function(type, ...args) {
    const ctx = originalGetContext.call(this, type, ...args);
    if (type === '2d' && ctx && !ctx.__tegakiWatched) {
      ctx.__tegakiWatched = true;

      const originalGetImageData = ctx.getImageData;
      ctx.getImageData = function(...a) {
        warn('CanvasRenderingContext2D.getImageData');
        return originalGetImageData.apply(this, a);
      };

      const originalPutImageData = ctx.putImageData;
      ctx.putImageData = function(...a) {
        warn('CanvasRenderingContext2D.putImageData');
        return originalPutImageData.apply(this, a);
      };
    }
    return ctx;
  };
})();
```

WebGL の `readPixels()` も同様に監視する。

```js
(function installTegakiWebGLWatch() {
  const patch = (proto, name) => {
    if (!proto || proto.__tegakiWatched) return;
    proto.__tegakiWatched = true;
    const originalReadPixels = proto.readPixels;
    if (originalReadPixels) {
      proto.readPixels = function(...args) {
        console.warn('[TegakiPerf:DANGEROUS_API] gl.readPixels called', {
          isDrawing: window.TegakiDebug?.isDrawing,
          stack: new Error().stack,
        });
        return originalReadPixels.apply(this, args);
      };
    }
  };

  patch(window.WebGLRenderingContext?.prototype, 'WebGLRenderingContext');
  patch(window.WebGL2RenderingContext?.prototype, 'WebGL2RenderingContext');
})();
```

---

## 8. 実装改善方針

### 8.1 pointer event と描画を分離する

`pointermove` / `pointerrawupdate` では以下だけを行う。

- 座標取得
- 筆圧取得
- 最小限の座標変換
- stroke point buffer への追加
- 必要なら coalesced events の取得

実際の描画は `requestAnimationFrame` で行う。

```js
const strokeBuffer = [];
let strokeRAF = 0;

function onPointerMove(e) {
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) {
    strokeBuffer.push({
      x: ev.clientX,
      y: ev.clientY,
      pressure: ev.pressure || 0.5,
      time: ev.timeStamp,
    });
  }

  if (!strokeRAF) {
    strokeRAF = requestAnimationFrame(flushStrokeBuffer);
  }
}

function flushStrokeBuffer() {
  strokeRAF = 0;
  if (!strokeBuffer.length) return;

  const points = strokeBuffer.splice(0, strokeBuffer.length);
  renderStrokePoints(points);

  if (strokeBuffer.length) {
    strokeRAF = requestAnimationFrame(flushStrokeBuffer);
  }
}
```

### 8.2 stroke 中に禁止する処理

描画中は以下の処理を直接実行しない。

- 全レイヤーの完全再合成
- レイヤーサムネイル更新
- アルバム表示更新
- 書き出しプレビュー生成
- undo snapshot 作成
- autosave
- image decode
- texture 再生成
- RenderTexture 再生成
- GPU → CPU readback
- Blob / DataURL 作成

必要な場合は `pointerup` 後、または `requestIdleCallback` / debounce 後に回す。

```js
function scheduleAfterStroke(taskName, fn) {
  if (window.TegakiState?.isDrawing) {
    window.TegakiState.deferredAfterStroke ??= [];
    window.TegakiState.deferredAfterStroke.push({ taskName, fn });
    return;
  }
  fn();
}

function onPointerUp(e) {
  finishStroke(e);

  const tasks = window.TegakiState.deferredAfterStroke || [];
  window.TegakiState.deferredAfterStroke = [];

  requestIdleCallback?.(() => {
    for (const task of tasks) {
      window.TegakiPerf.measure(`deferred.${task.taskName}`, task.fn);
    }
  }, { timeout: 500 });
}
```

### 8.3 外部画像レイヤーを作業用サイズへ正規化する

外部画像インポート時に以下を行う。

- 元画像サイズを記録する
- キャンバス作業用サイズへ縮小した bitmap / texture を作成する
- 描画中は作業用 texture のみを使う
- 元画像は必要な場合のみ保持する
- stroke 中に image decode / resize / texture upload を行わない

確認すべき実装:

- `createImageBitmap()` 使用箇所
- `drawImage()` 使用箇所
- `texImage2D()` / `texSubImage2D()` 使用箇所
- PixiJS Texture 作成箇所
- 画像レイヤー変形時の再サンプリング処理

### 8.4 dirty rectangle / tile-based redraw を検討する

小さいキャンバスであれば全体再描画でもよいが、外部画像・複数レイヤー・将来のアニメーション機能を考えると、dirty rectangle または tile-based redraw が有効。

短期的には、ストローク中の更新範囲をブラシ半径込みの矩形に限定する。

- 前回点と今回点を含む矩形
- ブラシ半径分拡張
- 必要なレイヤーだけ更新
- サムネイル・全体合成は stroke end 後

---

## 9. 調査時の検索キーワード / grep 対象

Codex は以下のキーワードでコード全体を検索してください。

```text
pointermove
pointerrawupdate
getCoalescedEvents
requestAnimationFrame
getImageData
putImageData
toDataURL
toBlob
readPixels
texImage2D
texSubImage2D
Texture.from
new PIXI.Sprite
RenderTexture
createImageBitmap
drawImage
thumbnail
preview
generatePreview
undo
history
snapshot
album
composite
layer composite
mask render
export
save
autosave
```

特に `pointermove` / stroke render の呼び出し先から、上記の重い処理へ到達していないかコールチェーンを追う。

---

## 10. 優先順位

### P0: 計測追加

- Long task 計測
- `pointermove` / render / composite / texture / undo / thumbnail / preview の処理時間ログ
- dangerous API watch

### P1: stroke 中の重い処理を停止

- undo snapshot を `pointerup` 後に移動
- thumbnail / preview / album 更新を debounce または idle に移動
- export preview 生成を stroke 中に実行しない
- 全レイヤー再合成を必要最小限にする

### P2: 外部画像レイヤー最適化

- インポート時の作業用テクスチャ生成
- 元画像の毎フレーム縮小・再アップロード禁止
- 画像レイヤー変形時の更新頻度制御

### P3: PixiJS / WebGL resource reuse

- Texture / Sprite / RenderTexture の再利用
- destroy / recreate の頻度削減
- bridge 処理の呼び出し回数削減

### P4: WebGPU 実験ブランチ

- WebGL 実装が整理された後に比較実験する
- 目的は「今回の遅延解消」ではなく「将来の高負荷ブラシ・合成・フィルタ・物理演算への備え」とする

---

## 11. 受け入れ条件

以下を満たすことを目標とする。

1. Console 上で、0.5 秒級停止時にどの処理が重かったか特定できる
2. stroke 中の `pointermove.total` が通常時 1〜3ms 程度、悪化時でも 16ms 未満を目指す
3. stroke rendering は 1 frame あたり 16ms 未満を目指す
4. `toDataURL()` / `toBlob()` / `getImageData()` / `readPixels()` が stroke 中に呼ばれない
5. undo snapshot / thumbnail / preview / album 更新が stroke 中に実行されない
6. 外部画像レイヤーありでも、入力が 0.5 秒止まる現象が再現しない、または発生頻度が大幅に下がる
7. もしまだ停止する場合、ログから次のボトルネックを明確に説明できる

---

## 12. Codex への短縮依頼文

以下をそのまま Codex に渡してもよい。

```text
描画ストローク中に約0.5秒停止し、その後に停止中の軌跡がまとめて描画される遅延があります。Console上は致命的エラーなしです。外部画像をインポートした後、その画像や別レイヤー上で描画していると発生率が上がるように見えます。

この問題を WebGPU 化で解決する前に、まず既存 WebGL/PixiJS 実装のどこでメインスレッドまたはGPU同期が詰まっているかを調査してください。

やってほしいこと:

1. performance.now() による計測を追加
2. pointermove / pointerrawupdate / stroke render / layer composite / imported image render / texture upload / texture bridge / undo snapshot / thumbnail update / preview generation の処理時間をログ化
3. 16ms, 33ms, 50ms, 100ms, 250ms を超えた処理を warning として出す
4. getImageData / putImageData / toDataURL / toBlob / readPixels / texImage2D / texSubImage2D / PIXI.Texture.from / new PIXI.Sprite / RenderTexture 作成が stroke 中に呼ばれていないか確認
5. stroke 中は座標と筆圧をバッファに積むだけにし、描画は requestAnimationFrame でまとめる
6. undo / thumbnail / preview / album / export 系処理は pointerup 後または requestIdleCallback に遅延する
7. 外部画像レイヤーはインポート時に作業用サイズへ正規化し、stroke 中に巨大画像の再デコード・再縮小・再アップロードをしない
8. PixiJS Texture / Sprite / RenderTexture を stroke 中に再生成していないか確認し、可能なら再利用する

WebGPU化は長期的には有効だが、今回の遅延がメインスレッド詰まり、CPU-GPU同期、undo/thumbnail/preview、外部画像テクスチャ再処理によるものなら根本解決にならない可能性が高いです。まず計測と既存パイプライン整理を優先してください。
```
