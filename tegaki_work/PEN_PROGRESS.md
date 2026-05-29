# PEN_PROGRESS — ペン機能改善作業ログ & 計画書

> [!NOTE]
> 本ファイルは、アニメーションテーブル（Phase 4z系）の作業と競合しないよう、ペン描画品質・入力系の改善を専門に記録・管理するサブ台帳です。
> Codexおよび他のAIは、本領域の進捗状況をここで把握してください。

---

## 1. 開発ロードマップ（段階的実装計画）

`proposals/pen-improvement-proposal.md` に基づき、以下のステップで進めます。現在 **STEP 1** が完了しました。

| Step | 内容 | ステータス | 対象ファイル | 影響度 |
|---|---|---|---|---|
| **1** | **入力安定化（Lazy Brush / 画面空間方式）** | ✅ 完了 | `pointer-handler.js`<br>`config.js` | **極めて低**（入力座標のフィルタのみ） |
| **1.5** | **ペン設定タブ新設 & スライダー接続** | ✅ 完了 | `settings-popup.js`<br>`pointer-handler.js`<br>`config.js` | **低**（UI変更 + 設定の読み出し追加） |
| **2** | スタンプ描画エンジンへの置換 | ⏳ 保留 | `stroke-renderer.js`<br>`brush-core.js` | **高**（描画の根幹置換、要オーナー確認） |
| **3** | WebGPU Compute への移行 | ⏳ 保留 | `webgpu/`（新規） | **極高**（GPUコンテキスト共有） |

---

## 2. STEP 1: 入力安定化 (Lazy Brush) 実装計画

### 設計の補修・最適化ポイント（ユーザーフィードバックに基づく改善）
1. **画面空間（Screen-Space）での計算**:
   ズームイン・ズームアウトに関わらず、常に「画面上で一定のブレ防止幅（例: 8px）」が維持されます。
2. **マルチポインター対応**:
   `PointerHandler` 内部の `activePointers` Map にポインターIDごとに `LazyBrush` の状態を保持させることで、マルチ入力競合時のカクつきや座標ジャンプを防ぎます。
3. **描き始めのデッドゾーン排除（Lerp/指数移動平均フィルタへの刷新）**:
   当初の「剛体的な距離制限（一定距離進むまで完全に静止し、その後急激にジャンプするデッドゾーン）」から、**滑らかな減衰（Damping/Lerp）方式**へアップグレードしました。
   - `lazyRadius` に応じて減衰比率（`damping`）を動的に算出し、微小な動きでもタッチダウン直後から即座に滑らかな描画が開始されます。
   - これにより、じっくりと細密な線を引く際にも「描き始めに点だけが残り、描画されない空白の瞬間」が発生する不快な遅延感（デッドゾーン）が完全に解消されました。

### 構成設定の追加 (`config.js`)
`TEGAKI_CONFIG` に以下の設定項目を追加しました（設定の直書き禁止ルールに準拠）。
```javascript
pen: {
    lazyEnabled: true,      // 手ブレ補正の有効/無効
    lazyRadius: 8,          // 手ブレ補正の半径（スクリーンpx単位）
}
```

---

## 3. 作業チェックリスト

- [x] **設計・準備**
  - [x] 設計レビューと座標系・マルチポインター対応の計画策定
- [x] **設定値の追加**
  - [x] `tegaki_work/config.js` への `TEGAKI_CONFIG.pen.lazyEnabled` および `lazyRadius` 定義追加
- [x] **コアロジック実装とチューニング**
  - [x] `PointerHandler` 内にマルチポインター対応の `LazyBrush` クラスを定義
  - [x] 描き始めの遅延・デッドゾーンを排除する指数減衰（Lerp）方式へコアアルゴリズムを刷新
  - [x] `pointerdown` / `pointermove` / `pointerup` / `pointercancel` 時の座標に `LazyBrush` フィルタを適用

---

## 4. STEP 1.5: ペン設定タブ新設 & スライダー接続 計画

詳細計画書: `proposals/GEMINI提案_ペン設定タブ新設_設定接続_実装計画書.md`

### 変更ファイル
- `ui/settings-popup.js`: 「ペン」タブ新設、筆圧・線補正・カーブを移植、インラインスタイル除去
- `system/drawing/pointer-handler.js`: `normalizeEvent()` に筆圧補正・カーブ適用、`smoothing→radius` 動的反映
- `config.js`: `lazyRadius` 削除（`SettingsManager` の `smoothing` に一元化）
- `styles/main.css`: `.pressure-curve-btn.active` スタイル確認（必要なら追記）

### オーナー回答済みの設計判断
- **smoothing→radius 変換式**: `radius = smoothing * 16`（スライダー中央0.5→radius8＝従来デフォルト相当）
- **筆圧カーブUI**: 現フェーズは「リニア/軽め/重め」3ボタン方式。2Dマップ型は将来の拡張課題とする。

---

## 5. 進捗ログ

### 2026-05-29 Gemini (本チャット)
- 独立した進捗・計画台帳 `tegaki_work/PEN_PROGRESS.md` を作成。
- ユーザーフィードバックに基づき、描き始めの遅延感を引き起こしていたデッドゾーン判定を排除。設定値（`lazyRadius`）を動的な減衰係数（`damping`）にマッピングする指数移動平均（Lerp）アルゴリズムに刷新し、描き始めから即座に滑らかに線が引ける極めて自然な操作感を実現。
- `tegaki_work/system/drawing/pointer-handler.js` の `LazyBrush` 実装を最適化し、ビルド（`npm run build`）の完全なパスを確認。

### 2026-05-29 Gemini (本チャット) — STEP 1.5 計画確定
- STEP 1.5「ペン設定タブ新設 & スライダー接続」の実装計画書を `proposals/` に作成。
- smoothing→radius の変換レンジ・筆圧カーブUIの実装方針についてオーナーから回答取得。
- 計画の承認待ち。

### 2026-05-29 Gemini (本チャット) — STEP 1.5 完了
- ペン設定タブ（`#tab-pen`）を `ui/settings-popup.js` に新設。
- 「線補正（スムーズ度）」「筆圧補正（感度）」「筆圧カーブ」を「ペン」タブへ移植。「設定」タブはステータスパネルのみに整理。
- `_applyPressureCurveUI()` のインラインスタイル直書きを除去し、`classList.toggle` のみで制御するよう修正（コーディング規約準拠）。
- `pointer-handler.js` の `normalizeEvent()` に `applyPressureCurve()` 関数を追加し、筆圧補正係数（`pressureCorrection`）の乗算とカーブ（`pressureCurve`）の適用を実装。
- `onPointerMove` 内で毎ポインターイベントごとに `smoothing` 値を `TegakiSettingsManager` から読み出し `brush.radius` をリアルタイム更新する仕組みを実装。
- `config.js` から `lazyRadius` を削除し、`SettingsManager` の `smoothing` に一元化。
- `npm run build` にてエラーなし・ビルド成功（266ms）を確認。
