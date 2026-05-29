# ペン設定タブ新設 & 設定接続 — 実装計画書

## 概要

設定ポップアップ（`settings-popup.js`）に **「ペン」タブ** を新設し、  
既存の「設定」タブから筆圧・手ブレ補正関連の項目を移植する。  
さらに各スライダーの値を `PointerHandler` の実描画処理へ動的に反映させ、  
スライダーが「見た目だけ」になっている現状の断絶を解消する。

---

## 現状の課題整理

| 問題 | 場所 | 深刻度 |
|---|---|---|
| 「設定」タブに筆圧・ブレ補正・カーブが混在し、ステータスパネルだけ残したい | `settings-popup.js` L135–174 | 中（UX） |
| 筆圧補正スライダー (`pressureCorrection`) が描画に反映されていない | `pointer-handler.js` | 高（機能不全） |
| 線補正スライダー (`smoothing`) が `LazyBrush.radius` に繋がっていない | `pointer-handler.js` L37 / `settings-popup.js` | 高（機能不全） |
| 筆圧カーブ (`pressureCurve`) が描画処理に一切存在しない | `pointer-handler.js` `normalizeEvent()` | 高（機能不全） |
| `_applyPressureCurveUI()` でインラインスタイルを直接書き換えている | `settings-popup.js` L608–617 | 低（規約違反） |

---

## 変更ファイルと内容

---

### ① UI層

#### [MODIFY] [settings-popup.js](file:///d:/GitHub/tegaki/tegaki_work/ui/settings-popup.js)

**タブ構成の変更**

現在の3タブ（設定 / バケツ / ショートカット）を4タブ（設定 / **ペン** / バケツ / ショートカット）に拡張する。

| タブID | タブラベル | 移動前後 |
|---|---|---|
| `#tab-settings` | 設定 | ステータスパネルのみ残す |
| **`#tab-pen`** | **ペン** ← 新設 | 筆圧補正 / 線補正 / 筆圧カーブ を移植 |
| `#tab-bucket` | バケツ | 変更なし |
| `#tab-help` | ショートカット | 変更なし |

**具体的な変更箇所**

1. **`_populateContent()`** (L115–255):
   - `.ui-tabs` に `<button data-tab="pen">ペン</button>` を追加
   - `#tab-settings` から筆圧・線補正・カーブの `setting-group` を削除、ステータスパネルのみ残す
   - `#tab-pen` の `<div>` ブロックを新規追加（スライダーIDは同じ）

2. **`_applyPressureCurveUI()`** (L602–618):
   - インラインスタイル直接書き換えを削除
   - `classList.add('active')` / `classList.remove('active')` のみに変更（CSSで制御）

3. **`_setupButtons()`** (L528):
   - `querySelectorAll('.pressure-curve-btn[data-curve]')` は変更なし（セレクタはそのまま機能する）

---

### ② 描画システム層

#### [MODIFY] [pointer-handler.js](file:///d:/GitHub/tegaki/tegaki_work/system/drawing/pointer-handler.js)

**A. `smoothing` 設定の動的反映**

現状：`LazyBrush` のコンストラクタ引数 `radius` を `window.TEGAKI_CONFIG?.pen?.lazyRadius ?? 8` で固定読み込み。  
問題：スライダーを動かしても `radius` は変わらない（初期化時の一度読み込みのみ）。

修正方針：`onPointerMove` の `brush.update()` 呼び出し前に `TegakiSettingsManager` から `smoothing` を読み、`LazyBrush.radius` を更新する。

```
smoothing (0.0〜1.0) → lazyRadius への変換式
radius = smoothing * 20    // 0→0（即時追従）, 1.0→20（最大補正）
```

**B. 筆圧補正 (`pressureCorrection`) の反映**

現状：`normalizeEvent()` の `pressure: e.pressure ?? 0.5` でそのまま生値を渡している。  
修正方針：`normalizeEvent()` 内（または呼び出し後）で `pressureCorrection` を乗算する。

```js
// normalizeEvent内の最後に追記
const correction = window.TegakiSettingsManager?.get('pressureCorrection') ?? 1.0;
pressure: Math.min(1.0, (e.pressure ?? 0.5) * correction)
```

**C. 筆圧カーブ (`pressureCurve`) の反映**

`normalizeEvent()` で補正済み圧力値にカーブ関数を適用する。

```js
function applyPressureCurve(p, curve) {
    if (curve === 'ease-in')  return p * p;          // 軽め：弱押しで細く
    if (curve === 'ease-out') return 1 - (1 - p)**2; // 重め：強押しでも太くなりにくい
    return p; // linear（デフォルト）
}
```

処理順序（`normalizeEvent` 内）：
1. 生 `pressure` を取得
2. `pressureCorrection` を乗算してクランプ
3. `pressureCurve` 関数を適用

---

### ③ 設定管理層

#### [MODIFY] [settings-manager.js](file:///d:/GitHub/tegaki/tegaki_work/system/settings-manager.js)

現状の `subscribeToSettingChanges()` で `smoothing` の変更イベントを受信済み。  
**追加修正不要** — `pointer-handler.js` 側が `TegakiSettingsManager.get()` で随時読み出す方式なので変更不要。

#### [MODIFY] [config.js](file:///d:/GitHub/tegaki/tegaki_work/config.js)

`pen.lazyRadius` は廃止し `pen.lazyEnabled` のみ保持する。  
（`smoothing` の実値は `SettingsManager` が管理するため `config.js` に重複させない）

---

## CSS

#### [MODIFY] [main.css](file:///d:/GitHub/tegaki/tegaki_work/main.css) （確認後判断）

`_applyPressureCurveUI()` のインラインスタイルを除去した代わりに、  
`.pressure-curve-btn.active` のスタイルが CSS 側で定義されているか確認する。  
既存の `.pressure-curve-btn.active` ルールがあれば追加変更不要。

---

## 実装順序

```
1. settings-popup.js の _populateContent() HTML変更（タブ追加・項目移動）
2. settings-popup.js の _applyPressureCurveUI() インライン削除
3. pointer-handler.js の normalizeEvent() に pressureCorrection + pressureCurve を追記
4. pointer-handler.js の onPointerMove に smoothing→radius 動的反映を追記
5. config.js から lazyRadius を削除（smoothingに一元化）
6. ビルド確認 npm run build
```

---

## 検証計画

### 自動（ビルド確認）
```
npm.cmd run build
```
エラーなし・警告なしであること。

### 手動（ブラウザ動作確認）

| 確認項目 | 期待結果 |
|---|---|
| 設定ポップアップを開く | 「設定」「ペン」「バケツ」「ショートカット」の4タブが表示される |
| 「設定」タブ | ステータスパネルのボタンのみ表示される |
| 「ペン」タブ | 筆圧補正 / 線補正 / 筆圧カーブ が表示される |
| 線補正スライダーを左端（0）に設定して描く | ノイズが出るほどリアルタイム追従する |
| 線補正スライダーを右端（1.0）に設定して描く | 最大20相当の遅延補正がかかり、滑らかな曲線になる |
| 筆圧補正を下げる（0.5）→ 細く描ける | 軽タッチでも通常より細い線になる |
| 筆圧カーブ「軽め」 | 弱い筆圧でも太さがあまり変わらない（flatter） |
| 筆圧カーブ「重め」 | 強い筆圧でないと太くならない |
| ポップアップを閉じて再開 | SettingsManager でリストアされ、設定値が維持される |

---

## 開いている質問

> [!IMPORTANT]
> **Q1: `smoothing` → `radius` の変換レンジ（0〜20）で十分か？**  
> 現在 `lazyRadius = 8` がデフォルトだった。スライダー中央（0.5）→ radius 10 の感覚で問題ないか確認をお願いします。

> [!NOTE]
> **Q2: `pressureCurve` の「軽め（ease-in）」「重め（ease-out）」の日本語表現は現行のまま維持でよいか？**  
> 他のお絵かきツールでは「ライト」「ヘビー」等の表現もありますが、現行維持で進めます。

> [!NOTE]
> **Q3: `config.js` の `lazyRadius` を削除するとき、他の箇所で参照していないか？**  
> `pointer-handler.js` 以外で `lazyRadius` を参照しているコードがないことを実装前に `rg` で確認します。
