# GPT-5.5 委託指示書：エアブラシ & ぼかしブラシの実装仕様

> このファイルは外部AI（GPT-5.5）に作業を依頼するための指示書です。
> 対象コードの参照URLや実装アルゴリズム、UIへの繋ぎ込み方法を明記しています。

> [!IMPORTANT]
> **外部AI（作業担当者）への重要な注意とワークフロー指示**
> 1. **コードの読み込み元（参照用）**:
>    - GitHubのキャッシュ遅延を防ぎ、完全に固定された最新のスナップショットを参照するため、参照用URLはすべて **`PastFiles/tegaki_phase2q2/...`** を指しています。コードの設計や理解にはこれらのURLを参照してください。
> 2. **提案コードの出力先（ターゲット）**:
>    - 提案する差分（Git Diff形式または詳細な置換指示）は、すべて本番作業フォルダである **`tegaki_work/...`** 以下の同名ファイルに対する変更として記述・出力してください。
> 3. **ファイル編集の制約**:
>    - 外部AIがリポジトリを直接編集・PUSHすることはありません。提案された差分は、ローカル環境で動く専用AI（Antigravity等）およびオーナーの手によって検証された後、ローカルの `tegaki_work/` に反映（マージ）されます。

---

## 1. プロジェクトの基本情報 & 開発環境
- **技術スタック**: HTML5, Vanilla CSS, Vanilla JS (ESM), Vite
- **グラフィックスライブラリ**: PixiJS v8.17.0
- **描画方式**: 各レイヤーが独自の `RenderTexture` と `Sprite` を持ち、ドラッグ中のストロークを `RenderTexture` にリアルタイムで焼き込む「ラスター焼き込み」方式。
- **リソース管理**: `window.brushSettings`, `window.layerManager`, `window.eventBus` などがグローバルまたはモジュール間で連携。

---

## 2. 実装対象ファイル
外部AIは、以下のファイルに対して差分（Git Diff形式または詳細な置換指示）を作成してください。

1. **`PastFiles/tegaki_phase2q2/system/drawing/brush-settings.js`**
   - URL: https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/PastFiles/tegaki_phase2q2/system/drawing/brush-settings.js
   - 新しいモード `'airbrush'` と `'blur'` の追加。
   - エアブラシ用のプロパティ（スタンプ密度等）や、ぼかし強度などの変数の受け口を追加。
2. **`PastFiles/tegaki_phase2q2/system/drawing/brush-core.js`**
   - URL: https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/PastFiles/tegaki_phase2q2/system/drawing/brush-core.js
   - 描画中のライフサイクル (`startStroke`, `updateStroke`, `finalizeStroke`) にエアブラシおよびぼかしブラシの処理を統合。
   - ペンや消しゴムと同様に、ドラッグ中にリアルタイムに `RenderTexture` に焼き込む経路（`_renderRealtimeSegmentIfNeeded`）を接続。
3. **`PastFiles/tegaki_phase2q2/system/drawing/stroke-renderer.js`**
   - URL: https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/PastFiles/tegaki_phase2q2/system/drawing/stroke-renderer.js
   - エアブラシおよびぼかしブラシの実際のピクセル描画・サンプリングロジック。
4. **`PastFiles/tegaki_phase2q2/ui/dom-builder.js`**
   - URL: https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/PastFiles/tegaki_phase2q2/ui/dom-builder.js
   - 属性パネル（またはクイックアクセス等）に「エアブラシ」「ぼかし」を追加。
5. **`PastFiles/tegaki_phase2q2/ui/ui-panels.js`**
   - URL: https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/PastFiles/tegaki_phase2q2/ui/ui-panels.js
   - 選択時にイベントを発火して設定を同期する UI 導線。

---

## 3. 詳細アルゴリズム仕様

### A. エアブラシ（Airbrush）
- **描画コンセプト**: Perfect-Freehand によるソリッドなポリゴンではなく、中心が濃くエッジに向かって滑らかに減衰する「柔らかい円形スタンプ」をストロークパス上に等間隔で連続描画する。
- **実装アプローチ (PixiJS v8)**:
  1. 初期化時（または初回使用時）に、HTML5 Canvas の `createRadialGradient` を利用して 64x64px などの「柔らかい円形のグラデーション」を生成し、`PIXI.Texture.from(canvas)` としてキャッシュ（エアブラシテクスチャ）。
  2. ストロークの移動距離を監視し、一定の間隔（例：`brushSize * 0.1` または `1px`）ごとに、その座標にエアブラシテクスチャを割り当てた `PIXI.Sprite`（または `PIXI.Graphics` でテクスチャを塗った円）を描画する。
  3. 筆圧に応じて、スタンプのサイズ、不透明度、またはスタンプ間隔が動的に変化する挙動をサポート。

### B. ぼかしブラシ（Blur Brush）
- **描画コンセプト**: 描画済みのレイヤーのピクセルを擦ることで、ストロークパスの下にあるピクセルを平滑化する。
- **実装アプローチ (PixiJS v8)**:
  1. **ストローク開始時 (`startStroke`)**:
     - 現在のアクティブレイヤーの `RenderTexture` を複製、または一時的な `RenderTexture`（`blurSourceTexture`）に内容をコピーする。
  2. **描画中 (`updateStroke`)**:
     - `blurSourceTexture` をソースとするスプライトに対し、PixiJS の `BlurFilter`（強度は設定値に基づく）を適用したコンテナを作成。
     - このコンテナから、現在のストロークパス（または短いセグメント）をマスク領域とした部分だけを切り出し、アクティブレイヤーの `RenderTexture` にブレンド描画で上書き焼き込みする。
  3. **ストローク完了時 (`finalizeStroke`)**:
     - 一時テクスチャやフィルタ用コンテナを適切に破棄し、メモリリークを防止。

---

## 4. 提出フォーマットと規律
- **差分編集の徹底**: ファイル全体を上書きするコードではなく、置換部分が明確な差分（Before / After）で提示してください。
- **インラインスタイルの禁止**: 新規UIのスタイルは必ず `main.css` への追加クラス定義として出力してください。
- **互換性の維持**: 既存の通常ペン、消しゴム、バケツ塗りつぶし、Undo/Redo（`RasterSnapshot` 復元）が壊れないように実装してください。
