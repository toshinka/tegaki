# ペン描画品質改修 — 段階的実装提案書
> 対象AI: CODEX  
> 作成: Claude  
> 作業フォルダ: `tegaki_work/`  
> 前提読了: `AGENTS.md` / `TEGAKI.md` / `PROGRESS.md`

---

## 背景と目的

現在のペン描画は `perfect-freehand → Graphics.poly fill → RenderTexture焼き込み` という
「輪郭ポリゴン方式」で実装されている。この方式には以下の**構造的限界**があり、
パラメータ調整では根本解決できない。

| 症状 | 原因 |
|---|---|
| 半透明時に三角形ノイズが見える | ポリゴン自己交差・earcut三角分割の暴れ |
| 描画中と確定後に見た目が一致しない | ポリゴン輪郭生成のタイミング依存 |
| 濃淡・テクスチャ表現ができない | シルエット塗りつぶし方式の限界 |
| 筆圧がサイズ変化にしか反映されない | 不透明度・密度制御の構造がない |

本提案は3ステップで段階的にこれらを解決し、最終的にWebGPU上で動くプロ品質の
スタンプ描画エンジンへ移行することを目標とする。

各ステップは**独立してリリース可能**な単位として設計する。
前のステップが完了・安定してから次へ進むこと。

---

## ステップ一覧

| Step | 内容 | 主な改修ファイル | 難度 | 効果 |
|---|---|---|---|---|
| **1** | 入力安定化（Lazy Nezumi方式） | `pointer-handler.js` | 低 | 手ぶれ除去・線が滑らか |
| **2** | スタンプ描画エンジンへの置換 | `stroke-renderer.js` `brush-core.js` | 中〜高 | ノイズ根絶・半透明正確・テクスチャ対応 |
| **3** | WebGPU Computeへの移行 | 新規 `webgpu/` ディレクトリ | 高 | 120Hz対応・変形との統合 |

---

## STEP 1 — 入力安定化（Lazy Nezumi方式）

### 概要

ペンの物理的なブレ・振動を「遅れバネ」で吸収する。
GPU不要・既存描画パイプラインを一切変えずに導入できる。

### アルゴリズム

入力カーソル位置に対し、「描画点」が一定距離だけ遅れてバネで追従する。
距離が `FOLLOW_DISTANCE` を超えた分だけ描画点を進める。

```
カーソル位置 C
描画点 P（実際にstrokeRecorderへ渡す点）

毎フレーム:
  dist = |C - P|
  if dist > FOLLOW_DISTANCE:
    P += normalize(C - P) * (dist - FOLLOW_DISTANCE)
    → P を strokeRecorder に記録
```

### 実装箇所

**`system/drawing/pointer-handler.js`**

`onPointerMove` の内部、`drawingEngine.updateStroke()` を呼ぶ前に
`LazyBrush` クラスのインスタンスを挟む。

```javascript
// pointer-handler.js 追記イメージ
// （既存クラスの責務内に収める。新ファイル不要）

class LazyBrush {
    constructor(radius = 8) {
        this.radius = radius;   // px（local座標）
        this.penX = null;
        this.penY = null;
    }

    reset(x, y) {
        this.penX = x;
        this.penY = y;
    }

    update(x, y) {
        if (this.penX === null) { this.reset(x, y); return { x, y, moved: true }; }
        const dx = x - this.penX;
        const dy = y - this.penY;
        const dist = Math.hypot(dx, dy);
        if (dist <= this.radius) return { x: this.penX, y: this.penY, moved: false };
        this.penX += dx * (1 - this.radius / dist);
        this.penY += dy * (1 - this.radius / dist);
        return { x: this.penX, y: this.penY, moved: true };
    }
}
```

### 設定値の追加

`config.js` の `TEGAKI_CONFIG` に追記する（直書き禁止ルール準拠）。

```javascript
pen: {
    lazyEnabled: true,
    lazyRadius: 8,        // px（local座標。大きいほど強い補正）
    lazyMinRadius: 0,     // 0=無効化
    lazyMaxRadius: 40,
}
```

UIからユーザーが調整できるようにする場合は `settings-manager.js` / `settings-popup.js` に
項目を追加すること（本Stepでは任意）。

### 受け入れ条件

- [ ] ゆっくり描いたとき：ラジアス以内の微振動が吸収され、滑らかな曲線になる
- [ ] 速く描いたとき：追従遅延が体感0.5フレーム以内に収まる
- [ ] `lazyEnabled: false` で従来通りの直接入力になる
- [ ] 液タブ・マウス両方で動作確認済み
- [ ] 既存の消しゴム・エアブラシ・ぼかしブラシの動作を壊していない

---

## STEP 2 — スタンプ描画エンジンへの置換

### 概要

「輪郭ポリゴン → fill」方式を廃止し、「スプライン補間 → 等間隔サンプリング →
ブラシテクスチャをスタンプ配置 → スクラッチバッファ蓄積 → レイヤーへ合成」方式へ置き換える。

これにより以下が同時解決する：
- 三角形ノイズ：スタンプは独立スプライトのため自己交差しない
- 確定前後の差異：同一スクラッチバッファを使い回すため差が生まれない
- 半透明overdraw：スクラッチバッファに1ストローク分蓄積し、最後に1回合成する
- テクスチャ・濃淡対応：スタンプ画像とアルファで自由に表現できる

### 設計原則（TEGAKI.md準拠）

- `perfect-freehand` は**廃止**（TEGAKI.md禁止事項「perfect-freehandを使わない独自輪郭生成への置き換え」は
  本方式が「輪郭生成を完全廃止してスタンプ方式へ転換」するものであり、`Graphics.poly`依存を捨てる変更のため、
  オーナー確認を取ってから着手すること）
- PixiJS `Sprite` + `RenderTexture` を引き続き使用する（スタック変更なし）
- `stroke-renderer.js` の責務を「スタンプ1個の生成」に絞る
- スクラッチバッファ管理は `brush-core.js` が担う

### アーキテクチャ

```
[入力点列（STEP1でLazy済み）]
    ↓
[CatmullRomスプライン補間（新規 spline-utils.js）]
    ↓
[等間隔サンプリング（間隔 = size × spacing比）]
    ↓
[ブラシテクスチャスプライト生成（stroke-renderer.js）]
    ↓
[スクラッチRenderTextureへ normal合成で蓄積（brush-core.js）]
    ↓
[stroke確定時 or 定期フラッシュ]
    ↓
[activeLayerのRenderTextureへ opacity×blendMode で1回合成]
```

### 追加ファイル

| ファイル | 責務 |
|---|---|
| `system/drawing/spline-utils.js` | Catmull-Romスプライン補間・等間隔サンプリング |
| `system/drawing/brush-texture-factory.js` | ブラシテクスチャのCanvas生成・キャッシュ管理 |

既存ファイルの主な変更：

| ファイル | 変更内容 |
|---|---|
| `stroke-renderer.js` | `renderPenSegment` をスタンプ1個返却に変更。`perfect-freehand`依存を除去。 |
| `brush-core.js` | スクラッチRenderTextureの生成・維持・フラッシュ処理を追加。 |

### スクラッチバッファの実装

```javascript
// brush-core.js 追記イメージ

_ensureScratchTexture(width, height) {
    if (!this._scratchTexture) {
        this._scratchTexture = RenderTexture.create({
            width, height, resolution: 1, antialias: false
        });
    }
    return this._scratchTexture;
}

_flushScratchToLayer(activeLayer, settings) {
    if (!this._scratchTexture || !this._scratchDirty) return;
    const renderer = this.app.renderer;
    const scratchSprite = new Sprite(this._scratchTexture);
    scratchSprite.alpha = settings.opacity;
    scratchSprite.blendMode = settings.mode === 'eraser' ? 'erase' : 'normal';
    renderer.render({
        container: scratchSprite,
        target: activeLayer.layerData.renderTexture,
        clear: false
    });
    scratchSprite.destroy();
    // スクラッチをクリア
    renderer.render({
        container: new Graphics(),
        target: this._scratchTexture,
        clear: true
    });
    this._scratchDirty = false;
}
```

### ブラシテクスチャの最低構成

まず「丸ペン」1種類だけ実装し、動作確認してから拡張する。

```javascript
// brush-texture-factory.js
// 責務: ブラシテクスチャ(Canvas→Texture)の生成とキャッシュ

export class BrushTextureFactory {
    constructor() {
        this._cache = new Map();
    }

    getRoundBrush(size, hardness = 1.0) {
        const key = `round_${size}_${hardness}`;
        if (this._cache.has(key)) return this._cache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;

        const g = ctx.createRadialGradient(center, center, 0, center, center, center);
        const edge = Math.max(0, 1.0 - hardness);  // hardness=1→くっきり、0→ぼかし
        g.addColorStop(0,    'rgba(255,255,255,1.0)');
        g.addColorStop(edge, 'rgba(255,255,255,1.0)');
        g.addColorStop(1.0,  'rgba(255,255,255,0.0)');

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        const tex = Texture.from(canvas);
        this._cache.set(key, tex);
        return tex;
    }

    // 将来拡張: getPencilBrush / getCharcoalBrush / getFromImage など
}
```

### 筆圧マッピングの拡張

スタンプ方式では筆圧を**サイズ・不透明度・テクスチャ密度**の3軸にマッピングできる。

```javascript
// stroke-renderer.js内 スタンプ1個生成ロジック

_makeDab(x, y, pressure, settings) {
    const size   = settings.pressureAffectsSize    ? settings.size * pressure : settings.size;
    const alpha  = settings.pressureAffectsOpacity ? settings.opacity * pressure : settings.opacity;

    const tex    = this.brushTextureFactory.getRoundBrush(Math.ceil(size), settings.hardness ?? 1.0);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.width = sprite.height = size;
    sprite.tint   = settings.color;
    sprite.alpha  = alpha;
    sprite.blendMode = 'normal'; // スクラッチへの合成は常にnormal
    return sprite;
}
```

`config.js` に追記する設定値：

```javascript
pen: {
    // ...STEP1設定に追記
    stampSpacingRatio: 0.25,     // スタンプ間隔 = size × ratio
    hardness: 1.0,               // 1.0=くっきり 0.0=ぼかし
    pressureAffectsSize: true,
    pressureAffectsOpacity: false,
}
```

### 移行戦略

`stroke-renderer.js` に `useLegacyPolygon` フラグを設け、
falseの場合だけスタンプ経路を通るようにする。
安定確認後にフラグと旧コードを削除する。

```javascript
// stroke-renderer.js

const USE_LEGACY_POLYGON = false; // Step2完了後に削除

renderPenSegment(points, settings) {
    if (USE_LEGACY_POLYGON) {
        return this._renderLineSegment(points, settings); // 旧経路
    }
    return this._renderStampSegment(points, settings);   // 新経路
}
```

### 受け入れ条件

- [ ] 半透明（opacity 0.3〜0.7）で重ね描きしたとき、三角形ノイズが見えない
- [ ] 描画中と pointerup 確定後で線の形・濃さが一致する
- [ ] 速いストロークと遅いストロークでスタンプ間隔が均一になる
- [ ] 消しゴムはスクラッチバッファを経由せず既存の `'erase'` blendMode焼き込みのままで動作する
- [ ] undo（`history.js`）が正常に機能する（スクラッチフラッシュ前後のスナップショット取得タイミング確認）
- [ ] ビルド `npm run build` が通る
- [ ] 液タブ・マウス両方で実機確認済み

---

## STEP 3 — WebGPU Computeへの移行

### 概要

STEP2のスタンプ描画を **WebGPU Compute Shader** に移植する。
CPUで行っていたスプライン補間・スタンプ配置・バッファ合成を
GPUで並列実行することで、120Hz液タブ入力に耐える描画速度を実現する。

またVキー変形（`layer-transform.js`）が将来WebGPUへ移行する際に、
描画エンジンと同じGPUコンテキストを共有できるようにする設計にする。

### 前提条件

- STEP2が完全に安定していること
- PixiJSのWebGPUバックエンド（`@pixi/webgpu`）がプロジェクトに導入済みか、
  または独立したWebGPUコンテキストを `canvas` から別途取得できること
- Chrome最新（WebGPU対応版）での動作を前提とする

### ファイル構成

```
tegaki_work/system/drawing/webgpu/
  ├── webgpu-context.js          # GPUDevice・Queue の初期化と共有
  ├── webgpu-stroke-pipeline.js  # Compute Shader パイプライン管理
  ├── webgpu-stamp-buffer.js     # スタンプ座標・圧力をGPUバッファへ転送
  └── shaders/
      ├── spline-sample.wgsl     # スプライン補間・等間隔サンプリング
      └── stamp-blit.wgsl        # スタンプテクスチャをターゲットへ合成
```

### Compute Shaderの役割分担

**spline-sample.wgsl**

入力: 生ポイント列（x, y, pressure, timestamp）
出力: 等間隔サンプリング済みポイント列

```wgsl
// 各ワークグループが1セグメント（2点間）を担当
// Catmull-Rom係数をGPU上で計算し、spacing間隔でサンプル点を生成
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) { ... }
```

**stamp-blit.wgsl**

入力: サンプル点列, ブラシテクスチャ（storage texture）
出力: スクラッチテクスチャへのブレンド合成

```wgsl
// 各ワークグループが1スタンプ（中心1点 × テクスチャサイズ）を担当
// alpha合成をGPU上で実行 → CPU→GPU転送のボトルネックを解消
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) { ... }
```

### PixiJSとの共存戦略

PixiJS v8はWebGPUバックエンドを持つが、ComputeShaderには対応していない。
そのため、**描画コア（スタンプ配置）だけを独立WebGPUパイプラインで実行**し、
結果のテクスチャをPixiJSの `RenderTexture` へ橋渡しする方式を取る。

```
[WebGPU Compute → スクラッチGPUテクスチャ]
    ↓ copyExternalImageToTexture / importExternalTexture
[PixiJS RenderTexture（activeLayer）へ合成]
```

既存の `gl-texture-bridge.js`（WebGL2時代の残骸）を参考に、
`webgpu-texture-bridge.js` として新規作成する。

### フォールバック設計

WebGPU非対応環境ではSTEP2のCPUスタンプ方式へ自動フォールバックする。

```javascript
// webgpu-context.js

export async function initWebGPUContext() {
    if (!navigator.gpu) {
        console.warn('[WebGPUContext] WebGPU not supported. Falling back to CPU stamp.');
        return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    return device;
}
```

`config.js` に追記：

```javascript
webgpu: {
    penEnabled: false,   // STEP3実装後にtrueへ。falseならSTEP2経路を使う
    transformEnabled: false,  // Vキー変形のWebGPU移行時にtrue
}
```

### 受け入れ条件

- [ ] WebGPU有効時にCPUスタンプ（STEP2）と見た目が一致する
- [ ] `config.webgpu.penEnabled: false` でSTEP2経路に完全フォールバックできる
- [ ] 120Hz入力時に描画遅延が体感1フレーム以内である
- [ ] `webgpu-context.js` の `GPUDevice` をVキー変形側からも参照できる設計になっている
- [ ] WebGPU非対応ブラウザで起動してもエラーにならない
- [ ] ビルド `npm run build` が通る
- [ ] 液タブ実機確認済み

---

## 共通の作業規律（再掲）

各Stepの着手前に必ず確認すること。

1. `rg` で同じ責務のクラス・関数・イベントが既にないか検索する
2. 変更対象ファイルのヘッダー（責務・依存・イベント）を読む
3. `config.js` の既存設定値と重複がないか確認する
4. STEP2着手前に `perfect-freehand` 廃止をオーナーへ確認する
5. 各Step完了後に `PROGRESS.md` を更新する
6. 一時デバッグログは `TEGAKI_CONFIG.debug` フラグで制御し、目的と削除条件をコメントに残す

---

## 依存ライブラリの変更サマリ

| ライブラリ | STEP1 | STEP2 | STEP3 |
|---|---|---|---|
| `perfect-freehand` | 継続使用 | **廃止** | 廃止 |
| PixiJS v8 | 変更なし | 変更なし | 変更なし（橋渡し役） |
| WebGPU API | 不使用 | 不使用 | **新規導入** |
| CatmullRom補間 | 不使用 | 新規（spline-utils.js） | GPUへ移植 |

`package.json` の変更はSTEP3のみ（WebGPUは標準API、追加パッケージ不要の見込み）。

---

*作成: Claude / 日付: 2026-05-28*
