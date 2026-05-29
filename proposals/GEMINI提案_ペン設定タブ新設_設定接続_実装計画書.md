# GEMINI提案 — ペン設定タブ新設 & 設定接続 実装計画書

> 作成日: 2026-05-29  
> 担当AI: Gemini (Antigravity)  
> 関連進捗: `tegaki_work/PEN_PROGRESS.md`  
> 関連提案: `proposals/pen-improvement-proposal.md`（元の提案書）

---

## 概要

設定ポップアップ（`ui/settings-popup.js`）に **「ペン」タブ** を新設し、  
既存「設定」タブから筆圧・手ブレ補正関連の項目を移植する。  
各スライダーの値を `PointerHandler` の実描画処理へ動的に反映させ、  
スライダーが「見た目だけ」になっている現状の断絶を解消する。

---

## 現状の課題整理

| 問題 | 場所 | 深刻度 |
|---|---|---|
| 「設定」タブに筆圧・ブレ補正・カーブが混在、ステータスパネルのみ残したい | `settings-popup.js` L135–174 | 中（UX） |
| 線補正スライダー (`smoothing`) が `LazyBrush.radius` に繋がっていない | `pointer-handler.js` / `settings-popup.js` | 高（機能不全） |
| 筆圧補正スライダー (`pressureCorrection`) が描画に反映されていない | `pointer-handler.js` `normalizeEvent()` | 高（機能不全） |
| 筆圧カーブ (`pressureCurve`) が描画処理に一切存在しない | `pointer-handler.js` | 高（機能不全） |
| `_applyPressureCurveUI()` でインラインスタイルを直接書き換えている | `settings-popup.js` L608–617 | 低（コーディング規約違反） |

---

## 変更ファイルと内容

### ① UI層: settings-popup.js

**タブ構成の変更**

現在の3タブ → 4タブへ拡張：

| タブID | ラベル | 内容 |
|---|---|---|
| `#tab-settings` | 設定 | ステータスパネルのみ残す |
| **`#tab-pen`** | **ペン** ← 新設 | 線補正 / 筆圧補正 / 筆圧カーブ を移植 |
| `#tab-bucket` | バケツ | 変更なし |
| `#tab-help` | ショートカット | 変更なし |

**具体的な変更箇所**

1. `_populateContent()` の `.ui-tabs` に `<button data-tab="pen">ペン</button>` 追加
2. `#tab-settings` の `setting-group` のうち筆圧・線補正・カーブを削除、ステータスパネルのみ残す
3. `#tab-pen` の `<div>` ブロックを新規追加（スライダーIDは既存と同一）
4. `_applyPressureCurveUI()` のインラインスタイル直書きを削除 → `classList` のみで制御

---

### ② 描画システム層: pointer-handler.js

**A. 線補正スライダー（smoothing）→ LazyBrush.radius 動的反映**

現状：`LazyBrush` のコンストラクタ引数 `radius` を `window.TEGAKI_CONFIG?.pen?.lazyRadius ?? 8` で固定読み込み。  
スライダーを動かしても `radius` は変わらない。

修正方針：`onPointerMove` の `brush.update()` 呼び出し前に `TegakiSettingsManager` から `smoothing` を毎回読み出し、
`brush.radius` を更新する。

**変換式（標準的なブレ補正ライブラリの慣例を参考に設計）:**
```
smoothing 0.0 → radius 0   （即時追従・補正なし）
smoothing 0.5 → radius 8   （現行デフォルト lazyRadius=8 相当をスライダー中央に配置）
smoothing 1.0 → radius 16  （最大補正）

実装: radius = smoothing * 16
```
> **設計根拠**: 現行の `lazyRadius=8` がユーザー好みの基準点とのことで、  
> スライダー中央（0.5）が従来値（8）に対応するよう正規化した。  
> レンジ（0〜16）はKrita / Clip Studio Paint 等の標準補正レンジを参考にした暫定値。

**B. 筆圧補正（pressureCorrection）の反映**

`normalizeEvent()` 内で生筆圧に乗算する。

```js
const correction = window.TegakiSettingsManager?.get('pressureCorrection') ?? 1.0;
const rawPressure = e.pressure ?? 0.5;
let pressure = Math.min(1.0, rawPressure * correction);
```

**C. 筆圧カーブ（pressureCurve）の反映**

補正済み圧力値にカーブ関数を適用する関数を `normalizeEvent()` 内（またはその直後）に追加。

```js
function applyPressureCurve(p, curve) {
    if (curve === 'ease-in')  return p * p;           // 軽め: 弱押しで細く
    if (curve === 'ease-out') return 1 - (1 - p)**2;  // 重め: 強押しでも太くなりにくい
    return p; // linear（デフォルト）
}
```

処理順序:
1. 生 `pressure` 取得
2. `pressureCorrection` 乗算 → クランプ [0, 1]
3. `pressureCurve` 関数適用

---

### ③ 設定管理層: config.js

`pen.lazyRadius` を削除し `SettingsManager` の `smoothing` に一元化。  
（`pointer-handler.js` が `SettingsManager.get('smoothing')` で随時読み出す方式なので重複管理を解消）

### ④ CSS: main.css (確認後判断)

`.pressure-curve-btn.active` のスタイルが CSS 側で定義されているか確認。  
既存ルールで対応済みなら変更不要。

---

## 実装順序

```
1. settings-popup.js → _populateContent() HTML変更（タブ追加・項目移動）
2. settings-popup.js → _applyPressureCurveUI() インラインスタイル削除
3. pointer-handler.js → normalizeEvent() に pressureCorrection + pressureCurve 追記
4. pointer-handler.js → onPointerMove に smoothing→radius 動的反映追記
5. config.js → lazyRadius 削除（smoothing に一元化）
6. main.css → .pressure-curve-btn.active スタイル確認（必要なら追記）
7. npm.cmd run build → エラーなし確認
```

---

## 将来的な拡張（現フェーズでは未実装）

- **2Dマップ型筆圧カーブエディタ**: 現フェーズでは「リニア / 軽め / 重め」3ボタン方式で実装。  
  将来的にスライダー方式（ベジェ制御点1つ）または2Dマップ（ガンマカーブ編集UI）への改修を想定。  
  → 対応する計画書は別途 `proposals/` に作成予定。

---

## 検証計画

### 自動（ビルド確認）
```
npm.cmd run build
```

### 手動（ブラウザ動作確認）

| 確認項目 | 期待結果 |
|---|---|
| 設定ポップアップを開く | 「設定」「ペン」「バケツ」「ショートカット」の4タブが表示される |
| 「設定」タブ | ステータスパネルのボタンのみ表示される |
| 「ペン」タブ | 線補正 / 筆圧補正 / 筆圧カーブ が表示される |
| 線補正 0 → 描く | ノイズが出るほどリアルタイム追従 |
| 線補正 0.5 → 描く | 従来の lazyRadius=8 相当の補正がかかる |
| 線補正 1.0 → 描く | 最大補正（radius=16）で滑らかな曲線 |
| 筆圧補正 0.5 → 描く | 軽タッチでも従来より細い線 |
| カーブ「軽め」→ 描く | 弱押しでも太さが変わりにくい |
| カーブ「重め」→ 描く | 強押しでないと太くならない |
| 再度ポップアップを開く | 設定値がリストアされている |
