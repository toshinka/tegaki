# 15. ボーン・CAF階層パーツ・Zインデックス動的制御設計 (改訂版)

更新日: 2026-07-27 (Claude評価・レビュー反映改訂)

> **文書の目的**:
> 本ドキュメントは、Tegakiにおいて「1キャラクター＝1 CAF（ClipAsset/Folder）」で一括作画・管理しながら、アニメーション制作時に内部フォルダ（腕・頭・胴体等のパーツ）を個別のトラック（子Lane）として展開・制御し、**ボーン（BONE）機能** および **Zインデックス（描画重なり順）の動的変化** を実現するための基本構想・技術的検討書である。
> 外部AI（Claude等）のアーキテクチャレビュー（`BORN機能計画レビュー_Claude評価.md`）を受け、コンポジターの既存契約との衝突回避策（Option B: 二段合成）、既存UI資産の再利用、厳格なデータモデル制約・ガバナンス区分を全面的に反映した。

---

## 1. 背景と解決したい課題

### 1.1 課題A: 1キャラ1CAF運用におけるパーツアニメーションの分離・煩雑さ
現在、TegakiではCAF（ClipAsset）ごとに1つの描画グループを形成する。キャラクターを肘・肩・頭などのパーツごとに動かそうとすると、パーツごとに個別のCAF（および個別のLane）を作成して管理しなければならず、作画時の効率や管理が非常に煩雑になる。
作画時は「1つのCAF内でレイヤー・フォルダ分けして描く」スタイルを維持し、アニメーション時にその内部フォルダを別々のモーション・軸として扱いたい。

### 1.2 課題B: アニメーション中の手足の重なり順（Zインデックス）変更
キャラクターが腕を体の後ろから前へ回すような動作を行う際、現在のTimelineモデルは固定のレイヤー順序に依存している。フレーム（時間軸）ごとに描画重なり順（Z-Index）を変化させるパラメータとキーフレームが必要である。

### 1.3 課題C: 関節屈曲（ボーン）と既存変形（WarpGrid/ControlMesh）の統合
単純な剛体パーツの回転だけでなく、関節（肩・肘等）を中心に連動して動く**ボーン構造（FK: Forward Kinematics）**と、既存の `WarpGrid` や `ControlMesh` による局所的な筋肉・服の変形をスムーズに連携させたい。

---

## 2. 他ツールの設計思想比較とTegakiへの流用分析

| ツール | 設計思想・アプローチ | Tegakiへの流用・採否 |
| :--- | :--- | :--- |
| **ToonSquid 2** | **非破壊Modifier (Bones Effect)**<br>・Group/LayerへBones Effectを付加<br>・`Bind Pose` (セットアップ) と `Animate Pose` の完全分離 | **採用**: 既存WarpGRIDの `SETUP`/`ANIMATE` 分離UIコンポーネントを流用し、`Rig Setup` / `Animate` モードを維持。 |
| **Live2D** | **回転デフォーマ ＋ ワープデフォーマ ＋ Draw Order**<br>・回転軸（Pivot）と変形（Lattice）の分離<br>・Draw Order (0〜1000) をパラメータ化 | **採用**: 描画順（Draw Order / Z-Index）の動的パラメータキーフレーム化。 |
| **Spine / Moho** | **Bone Hierarchy と Slot/Attachment の分離**<br>・骨構造と描画画像（スロット）を分離管理<br>・Draw Order キーフレーム制御 | **参考**: Slot抽象化はTegakiのシンプル作画思想に重すぎるため、CAF内部Folderをそのままパーツ（Sub-Node）として扱う。 |
| **Procreate Dreams** | **直感的な Group Transform & Pivot (Anchor)**<br>・レイヤーのグループ化と回転中心の変更に特化 | **採用**: 既存の楔形Pivotサイト（Head/Tail）をそのまま流用。 |

---

## 3. 核心概念とデータ構造設計（アプローチ比較と採用方式）

### 課題1: CAF内部フォルダをTimeline子Laneとしてどう表現するか？

#### ❌ アプローチ 1A: CAF内部に mini TimelineModel を再帰保持させる
- **内容**: `ClipAsset` や内部 `Folder` 自身が独自の `TimelineModel` を内包する。
- **評価**: ❌ **不採用**。`proposals/09`-D「Folderごとにmini TimelineModelを再帰させない」原則に反し、Undo/Redo Historyの分離やデータ同期が破綻する。

#### ⭕ アプローチ 1B: 単一 TimelineModel 内での「子Lane (Sub-Lane)」UI投影（採用）
- **内容**: `TimelineModel` は一つのみとし、`Lane` に `parentId` や `partId`（CAF内部フォルダへのUUID参照）を持たせる。
- **構造**:
  ```text
  Lane (Parent: CAF全体)
    ├─ Track: Transform (CAF全体の位置・拡大)
    ├─ Sub-Lane 1 (Part: "UpperArm") -> Parent: Lane
    │    └─ Track: Rotation, Pivot, RestAngle/AxisLength, Z-Index
    └─ Sub-Lane 2 (Part: "ForeArm")  -> Parent: Sub-Lane 1 (親子連動)
         └─ Track: Rotation, Pivot, RestAngle/AxisLength, Z-Index
  ```
- **評価**: ⭕ **採用**。正本は単一の `TimelineModel` と `ClipAsset` のままであり、UI側でアコーディオン展開（階層表示）する。

---

### 課題2: 合成順序の衝突回避（二段合成アプローチの採用）

#### ⚠️ アーキテクチャ上の衝突と対策
現行のコンポジット順序は `内部Layer評価 -> Folder clipping/blend -> Clip Motion/Warp` である。
合成前に内部Folderへ直接個別の変形行列を適用すると、既存の `internal-layer-clipping-contract.js` と真っ向から衝突する。

#### ⭕ 採用アプローチ: Option B（パーツ＝擬似ClipInstance化による二段合成）
1. **第1段（既存パイプラインの無改造適用）**:
   トップレベルFolder（腕・頭など）を、既存の Folder clipping/blend ルールのまま個別の `RenderTexture`（パーツ確定画像）として合成する。
2. **第2段（パーツ階層行列 & Z-Index の適用）**:
   確定された各パーツ画像に対して、`ClipInstance` と同様の階層行列（$M_{\text{final}} = M_{\text{GlobalCAF}} \times M_{\text{ParentPart}} \times M_{\text{LocalPart}}$）および Z-Index を順次掛け合わせて全体を合成する。
- **メリット**: 既存の `internal-layer-clipping-contract.js` を一切変更せず再利用できるため、回帰リスクをゼロに抑えられる。

---

### 課題3: Zインデックス（重なり順）の動的キーフレーム化と制約

#### 実装方式と制約:
- **`zIndex` トラック**: 各 Sub-Lane に `zIndex`（初期値: 0, 整数値）キーフレームトラックを追加。
- **レンダリングソート**: `(フォルダスタック順 * 1000) + zIndexOffset` でソートして描画。
- **クリッピング連結制約（必須ルール）**: **クリッピング（マスク）で直下/直上のレイヤーと連結している Folder 群は、`zIndex` による独立した分離・ソートを禁止する**。離脱させるとマスクが壊れるため、連結グループ単位で同一 Z-Index を維持する。
- **バイパス最適化**: `zIndex` キーフレームが未使用のCAFプロジェクトでは、従来の直列合成処理をバイパスする。

---

### 課題4: ボーン（BONE）データモデルと既存 UI 資産の再利用

#### 1. スキーマの明確化 (`restAngle` / `axisLength`)
`proposals/09`-A.10 の指針に従い、既存の Transform Rotation キーと意味を混同させないため、**ボーンの初期角度（`restAngle`）および軸長（`axisLength`）は、変形 Rotation キーとは別の独立スキーマ**として保持する。

#### 2. 親不在時の Fallback と DAG 循環参照禁止
- 参照関係は非循環有向グラフ (DAG) とする。
- 同一フレームに親パーツが存在しない場合は `disabled` (ローカル変形のみ) / `hold` の明示的な Fallback 状態へ遷移する。
- 位置・回転・スケールのチャンネル別 ON/OFF constraint（個別継承指定）を可能にする。

#### 3. 既存 UI 資産の徹底流用
- **関節マーカー（Pivotサイト）**: 既存の「楔形（Head/Tail）サイト」をそのまま流用。Headを関節位置、Tailを軸方向（0°＝上向き）として表示。
- **SETUP / ANIMATE モード分離**: Phase 6d で導入された WarpGRID の `SETUP`/`ANIMATE` 分離コンポーネントの配色・アイコンを流用。
- **Z順の一時プレビュー**: `Lane onion` の display-only コンテナを再利用し、手前/奥のパーツを薄く色分け表示する。

---

## 4. 技術的難易度とコードベースへの影響範囲（リファクタリング診断）

| 対象モジュール | 変更点と影響範囲 | 難易度 | リファクタリング内容 |
| :--- | :--- | :---: | :--- |
| `tegaki_work/system/animation/animation-data-model.js` | **高** | 🔴 | `Lane` および `Clip` スキーマの拡張。<br>・`parentId`, `partId`(UUID) の追加<br>・`restAngle`, `axisLength`, `zIndex` トラック項目の追加<br>・DAG循環検知と親不在時 Fallback |
| `tegaki_work/system/animation/timeline-frame-compositor.js` | **中〜高** | 🟡 | 二段合成（Option B）によるコンポジット処理。<br>・パーツ単位の確定 RenderTexture 化<br>・パーツ階層 Matrix 計算と `zIndex` ソート |
| `tegaki_work/ui/timeline-ui.js` | **中** | 🟡 | タイムラインUIの階層化。<br>・アコーディオン折りたたみ表示・子Laneレンダリング |
| `tegaki_work/ui/animation-table-popup.js` | **中** | 🟡 | 楔形 Pivot サイトを用いた Setup/Animate 操作ハンドル |
| `tegaki_work/system/layer-system.js` | **低〜中** | 🟢 | Folder 作成時の不可視 `partId` (UUID) 永続付与 |
| `tegaki_work/system/history.js` | **中** | 🟡 | 1 gesture = 1 History 原則に基づく Undo コマンド拡張 |

---

## 5. ガバナンスと役割分担（`PHASE4Z_BOUNDARY.md` 準拠）

`PHASE4Z_BOUNDARY.md` の設計・実装境界に基づき、各作業の担当区分を以下の通り定義する。

- 🔴 **Codex 詳細設計必須**:
  - `LaneModel` / `ClipInstanceModel` のスキーマ・保存形式拡張
  - `timeline-frame-compositor.js` の二段合成評価順と `internal-layer-clipping-contract.js` の再定義
  - DAG 参照解決および Fallback 仕様
- 🟡 **Gemini 先行実装可能**:
  - 既存 WarpGRID の `SETUP`/`ANIMATE` UI コンポーネントを流用した Pivot 操作ツール
  - 楔形 Pivot サイトのオーバーレイ表示およびドラッグ表示

---

## 6. 改訂版 Slice ロードマップ (Slice 0 〜 Slice 4)

```text
Slice 0 (Codex設計): データモデル & 保存スキーマ確定
   └─ partId (UUID) 付与、DAG 循環禁止、親不在時 Fallback、チャンネル別継承スキーマの確定。

Slice 1 (Option B方式): パーツの擬似 ClipInstance 化 ＋ 剛体 FK
   └─ 既存 Folder clipping/blend は無改造。パーツ単位確定画像に対して既存楔形サイトを用いた Pivot 回転を適用。

Slice 2: Dynamic Z-Index Track & クリッピング制約
   └─ zIndex トラック追加。クリッピング連結 Folder 群の同一 Z-Index 維持制約と描画ソート。

Slice 3: Rig Setup UI & Z順プレビュー
   └─ WarpGRID の SETUP/ANIMATE 分離 UI を流用。Lane onion コンテナを流用した Z順プレビュー。

Slice 4: Bone × WarpGrid の Weight バインド ＋ Bake to Frames
   └─ ボーン回転への WarpGrid コントロールポイント連動、および確定 Raster（Bake to Frames）変換。
```

---

## 7. 関連仕様書・参照ドキュメント

- `TEGAKI.md` (技術方針・基本原則正本)
- `tegaki_work/PHASE4Z_BOUNDARY.md` (Layer / CAF 責任境界定義)
- `開発用資料保管庫/proposals/BORN機能計画レビュー_Claude評価.md`
- `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
- `開発用資料保管庫/proposals/【他GPT作成・参考用】TEGAKI_ToonSquid2_feature_UI_reference.md`
