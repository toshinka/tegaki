# Phase 4a — アニメテーブル大改造 調査報告・設計案 (GEMINI報告)

## 1. 現状の棚卸し結果

### ♻️ 再利用可能な資産
- **ショートカット定義**: `ArrowLeft/Right` (コマ移動), `Ctrl+Space` (再生) などの既存キーマップ。
- **再生ループの基礎**: `AnimationSystem` 内のタイマー駆動によるフレーム更新ロジック。
- **RenderTexture管理**: `LayerSystem` が保持している「フレームIDごとの描画バッファ」 Map 構造。

### 🗑️ 刷新・廃棄すべき点
- **パスベースのシリアライズ**: 旧 `Frame.serialize` は「全ストロークの再構築」を前提としており、現在のラスター描画（RenderTexture）主体と不整合を起こしている。
- **横並びのDOMリスト**: 現在の `frames-container` は単純なコマの羅列であり、レイヤーごとのタイミング管理（トラック概念）が欠如している。
- **SortableJS による強引な制御**: コマ単位の単純な並び替えではなく、タイムライン上のクリップ（セル）操作へ移行するため、現状の SortableJS 接続は破棄する。

---

## 2. 新データモデル案 (ToonSquid 2 準拠)

「レイヤー（Track）」の上に「描画の塊（Cel/Clip）」が「時間軸（Frame）」に沿って並ぶ、マトリクス構造へ移行します。

### TimelineData (全体構造)
```javascript
{
    fps: 12,
    totalFrames: 120, // タイムラインの最大長
    tracks: [ TrackModel, TrackModel, ... ],
    playback: {
        currentFrame: 0,
        loop: true
    }
}
```

### TrackModel (レイヤー単位)
- **id**: UUID
- **name**: レイヤー名（LayerSystem のレイヤーと 1:1 対応）
- **cels**: [ CelModel, CelModel, ... ] // トラック上に配置されたセルの配列

### CelModel (描画の塊 = セル)
- **id**: UUID
- **layerId**: `LayerSystem` の実レイヤーID (RenderTexture への参照)
- **startFrame**: タイムライン上の開始位置
- **duration**: 表示フレーム数（「何コマ打ち」かを決定）

---

## 3. UI スケッチ (アニメテーブル)

ToonSquid 2 や Procreate Dreams を参考に、以下の構成を目指します。

### 基本レイアウト
- **左側**: トラックリスト（現在のレイヤーパネルと同期・統合検討）。
- **中央〜右側**: タイムライングリッド。セルが矩形（クリップ）として横方向に並ぶ。
- **上部**: タイムスライダ、目盛り、再生コントロール（Play/Pause, FPS, ループ等）。

### 最初の到達点 (Phase 4a スケルトン)
- キャンバス下部に「アニメテーブル」パネルを追加（初期は折りたたみ）。
- 縦軸に現在のレイヤー名が並び、横軸にコマ番号が並ぶ「空の表（グリッド）」を表示する。

---

## 4. 段階実装計画 (Phase 4)

- **Phase 4a (現在)**: 設計・棚卸し・新データモデル定義。報告書の作成とスケルトンUI配置。
- **Phase 4b**: 既存の「単一レイヤーアニメ（コマ）」を新データモデルで動くように変換・移植。
- **Phase 4c**: マルチトラック対応。レイヤーごとに異なるタイミングでセルを置けるようにする。
- **Phase 4d**: タイムライン上でのセルのドラッグ移動・伸縮・複製の実装。

---

## 5. Codex への作業依頼案

1. `system/animation-system.js` のデータ構造を上記の新モデルへ拡張（または互換層の作成）。
2. `core-engine.js` におけるアニメモードの「クリーンな初期化・接続経路」の再定義。
3. `ui/timeline-ui.js` を廃止し、新規 `ui/animation-table-popup.js` への移行。
