# 自動保存（緊急復帰）設定UI 実装提案書

作成日: 2026-08-02
対象: `tegaki_work/system/settings-manager.js` / `tegaki_work/ui/settings-popup.js` / `tegaki_work/system/emergency-recovery-store.js`
作成担当: Claude

---

## 2026-08-08 SOL採否

Phase 6zで実装済み。UI上は通常Project保存と区別するため「緊急復旧」と表記し、操作中の定期記録、最短間隔、tab非表示・終了時の記録をそれぞれ設定できるようにした。

定期Ctrl+Sは実装していない。将来は一つのdirty revisionとsingle-flight Project serializationを通常FileSystemFileHandle保存／IndexedDB緊急復旧の二つのsinkで共有し、二本のtimerが同じProjectを同時serializeしないGateを先に置く。

---

## 0. 提案の評価

**結論: 良い提案。既存の設定システムの型にそのまま収まり、追加実装コストも小さい。採用を推奨します。**

Tegakiの設定画面（左サイドバー「設定」ボタン→`settings-popup.js`の「設定」タブ）には、既に`History`設定として「自動調整On/Off＋数値ドロップダウン」という**全く同型のUIパターン**が実装済みです（`historyAutoAdjust`チェックボックス＋`historyMaxEntries`/`historyMaxMemoryMB`の`<select>`）。今回の自動保存On/Off＋保存間隔も、このパターンをそのまま流用できるため、UI設計・データ保存・イベント配線のいずれも新規発明が不要です。

一点、設計として詰めるべき論点があります。

> **OFFにした場合、ページを閉じる際の緊急保存（`pagehide`/`visibilitychange`時の`forceCheckpointSoon()`）まで止めてよいか？**

これは「緊急復帰」という機能の安全網そのものに関わるため、**OFFにするのは定期的な自動保存（ペン遅延の原因になっている方）だけとし、タブを閉じる際の最終保存は設定に関わらず常に行う**、という設計を提案します（詳細は2-3節）。これにより「遅延の原因は止めたいが、クラッシュ対策は失いたくない」という両方の要望を満たせます。

---

## 1. 設計仕様

### 1-1. 追加する設定項目

| 設定キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| `autoSaveEnabled` | boolean | `true` | 定期的な自動バックアップ（緊急復帰チェックポイント）を行うか |
| `autoSaveIntervalSeconds` | number（固定選択肢） | `5` | 直近の保存から次の保存までの最短間隔。選択肢: 5 / 10 / 30 / 60 / 180 / 300秒 |

既存の`historyMaxEntries`等と同様、自由入力ではなく固定の選択肢からの選択とし、既存UIとの統一感を保ちます。

### 1-2. UIモック（設定タブ内、Historyグループの近くに追加）

```html
<div class="setting-group">
    <div class="setting-label">自動保存（緊急復帰）</div>
    <label class="history-setting-auto">
        <input id="auto-save-enabled" type="checkbox" checked>
        操作中の自動バックアップを有効にする
    </label>
    <div class="history-setting-row">
        <label>保存間隔
            <select id="auto-save-interval">
                <option value="5">5秒</option>
                <option value="10">10秒</option>
                <option value="30">30秒</option>
                <option value="60">1分</option>
                <option value="180">3分</option>
                <option value="300">5分</option>
            </select>
        </label>
    </div>
    <div id="auto-save-status-display" class="setting-description">最終自動保存: まだありません</div>
    <div class="setting-description">OFFにしても、タブを閉じる際の保存は安全のため引き続き行われます。</div>
</div>
```

`最終自動保存: 14:32:07` のような簡易ステータス表示を添えることを提案します（後述1-5）。既存の`history-usage-display`と同じ役割・同じ見た目で、実装コストはほぼゼロです。

### 1-3. OFF時の挙動（安全網の維持）

- OFF: `history:changed`（ストローク確定・レイヤー操作など）による**定期的なバックグラウンド保存だけを止める**。ペン遅延の主因はこちらであるため、OFFにすれば体感遅延はほぼ解消されるはずです。
- OFFでも: `pagehide` / `visibilitychange`（タブを閉じる・非表示にする瞬間）に走る**最終保存だけは常に実行**する。この保存はユーザーが作業中に体感することがなく、クラッシュ・誤ってタブを閉じた際の保護として機能し続けます。

### 1-4. 保存間隔の意味

現行コードの`_saveInterval`（既定5000ms、「前回保存からこれだけ経過していないと次を保存しない」というレート制限）を、この設定値で置き換えます。間隔を伸ばすほど保存頻度が下がり、遅延の発生頻度そのものが減ります。デバウンス時間（変更後何ms待つか、既定1000ms）は内部定数のまま残し、設定項目としては露出させません（UIをシンプルに保つため）。

### 1-5. 保存ステータス表示（追加提案）

`emergency-recovery-store.js`の保存成功時に、新しいイベント`emergency-recovery:saved`を発火するようにし、`settings-popup.js`側でこれを購読して「最終自動保存: HH:MM:SS」を更新します。これにより、ユーザーは「設定を変えたら本当に保存頻度が変わったか」を目視で確認でき、OFFにした場合は「最終自動保存」が更新されなくなることで動作を確認できます。

---

## 2. 実装詳細（ファイルごとの変更内容）

### 2-1. `system/settings-manager.js`

`getDefaults()`に追加:

```js
autoSaveEnabled: this.config?.userSettings?.autoSaveEnabled !== false,
autoSaveIntervalSeconds: this.config?.userSettings?.autoSaveIntervalSeconds || 5,
```

`validateValue()`の`validators`に追加:

```js
autoSaveEnabled: (v) => typeof v === 'boolean' ? v : undefined,
autoSaveIntervalSeconds: (v) => {
    const num = parseInt(v, 10);
    return [5, 10, 30, 60, 180, 300].includes(num) ? num : undefined;
},
```

`subscribeToSettingChanges()`の`settingKeys`配列に`'autoSaveEnabled'`、`'autoSaveIntervalSeconds'`を追加。

### 2-2. `ui/settings-popup.js`

1. 1-2節のHTMLを`#tab-settings`内、`History`の`setting-group`の直前に挿入。
2. `_cacheElements()`に以下を追加:
   ```js
   autoSaveEnabled: document.getElementById('auto-save-enabled'),
   autoSaveInterval: document.getElementById('auto-save-interval'),
   autoSaveStatus: document.getElementById('auto-save-status-display'),
   ```
3. `historyAutoAdjust`のイベント配線の近くに追加:
   ```js
   this.elements.autoSaveEnabled?.addEventListener('change', () => {
       const enabled = this.elements.autoSaveEnabled.checked;
       this.settingsManager?.set('autoSaveEnabled', enabled);
       if (this.elements.autoSaveInterval) this.elements.autoSaveInterval.disabled = !enabled;
   });
   this.elements.autoSaveInterval?.addEventListener('change', () => {
       this.settingsManager?.set('autoSaveIntervalSeconds', Number(this.elements.autoSaveInterval.value));
   });
   ```
4. `_loadSettings()`相当の初期反映処理（`historyAutoAdjust`を読み込んでいる箇所）に、同様に`autoSaveEnabled` / `autoSaveIntervalSeconds`をチェックボックス・selectへ反映する処理を追加。
5. `initialize()`内、`this.eventBus?.on('history:changed', ...)`の近くに追加:
   ```js
   this.eventBus?.on('emergency-recovery:saved', ({ timestamp }) => {
       if (!this.elements.autoSaveStatus) return;
       const time = new Date(timestamp).toLocaleTimeString();
       this.elements.autoSaveStatus.textContent = `最終自動保存: ${time}`;
   });
   ```

### 2-3. `system/emergency-recovery-store.js`

1. ファイル先頭にイベントバスをimport:
   ```js
   import { TegakiEventBus } from './event-bus.js';
   ```
2. コンストラクタで、既定値を設定システムから読み込むように変更:
   ```js
   constructor() {
       ...
       const settings = window.TegakiSettingsManager?.get?.() || {};
       this._enabled = settings.autoSaveEnabled !== false;
       this._saveInterval = (Number(settings.autoSaveIntervalSeconds) || 5) * 1000;
       ...
       TegakiEventBus.on?.('settings:auto-save-enabled', ({ value }) => {
           this._enabled = value !== false;
       });
       TegakiEventBus.on?.('settings:auto-save-interval-seconds', ({ value }) => {
           this._saveInterval = (Number(value) || 5) * 1000;
       });
   }
   ```
   `SettingsManager`の初期化順によっては`window.TegakiSettingsManager`がまだ無い場合があるため、フォールバック（`autoSaveEnabled: true`, `5`秒）を必ず用意する。
3. `scheduleCheckpoint()`の先頭にOn/Offチェックを追加:
   ```js
   scheduleCheckpoint() {
       if (!this._enabled) return;
       ...
   }
   ```
   `forceCheckpointSoon()`（`pagehide` / `visibilitychange`用）は**変更しない**。これにより1-3節の安全網が維持される。
4. `performSave()`の成功時（`this._recordPerf('emergency-recovery.total', ...)`の直後）に、UI用イベントを追加:
   ```js
   TegakiEventBus.emit?.('emergency-recovery:saved', { timestamp: Date.now() });
   ```

---

## 3. 影響範囲・安全性の確認

- Undo/Redo（`history.js`）、保存フォーマット（`ProjectManager.exportProject()`のデータ構造）、CAF/Lane関連のロジックには一切触れない。純粋に「いつ・どのくらいの頻度でバックグラウンド保存を試みるか」という発火条件だけの変更。
- 既存の`_isDrawingActive()`によるストローク中保存回避のロジックはそのまま維持。
- `PHASE4Z_BOUNDARY.md`が示すCodex専属領域（`LaneModel`等のスキーマ変更、保存形式変更、EventBus新規イベント追加の是非）のうち、今回追加する`emergency-recovery:saved`は**UI表示用の軽量イベント**であり、保存データの構造やCAF/Lane関連の契約には影響しないため、比較的低リスクな追加と考えられます。ただし新規イベント追加である点は事前に一声入れておくのが安全です。

---

## 4. 実装Slice案

```
Slice 1: settings-manager.jsへの設定項目追加（既定値・validator・購読キー）
Slice 2: settings-popup.jsへのUI追加（チェックボックス・select・ステータス表示）
Slice 3: emergency-recovery-store.jsの設定連動化（_enabled / _saveInterval可変化、pagehide系は不変）
Slice 4: 動作確認（OFF時に定期保存が止まりpagehide保存だけ残ること、間隔変更が反映されること、ステータス表示の更新）
```

いずれも既存のCodex専属領域（Lane/CAFスキーマ、保存フォーマット）に触れないため、Gemini側で完結して実装可能な範囲と考えられます。

---

## 5. 追加で判明したペン遅延要因（新規発見・要検証）

前回の診断書でお伝えした「緊急復帰の自動保存」以外に、今回のコード調査で**もう1つ、より直接的にペンの遅延へ影響しうる要因**が見つかりました。これは`PROGRESS.md`等の既存資料には記載がなく、**今回初めて確認したもの**です。

### 5-1. `refreshClippingMasks()` が毎ストローク完了ごとに全レイヤーを再走査している

`layer-system.js`には次の配線があります。

```js
this.eventBus.on('drawing:stroke-completed', () => this.refreshClippingMasks());
```

つまり、**1本のストロークを描き終えるたびに、必ず`refreshClippingMasks()`が呼ばれます。** この関数の中身は次の通りです。

```js
refreshClippingMasks() {
    const layers = this.getLayers();      // 全レイヤーを取得
    ...
    this.clearClippingMasks();            // 既存の全クリッピングマスクを一旦破棄
    for (const layer of layers) {         // 全レイヤーをループ
        ...
        const maskTexture = this._createBinaryClippingMaskTexture(sourceLayers);
        ...
    }
}
```

さらに`_createBinaryClippingMaskTexture()`は、クリッピング元となっている各レイヤーについて、

1. `createLayerRasterSnapshot()`でGPUからピクセルデータを読み出す（GPU→CPU readback）
2. キャンバス全体（例: 400×400なら16万ピクセル、大きなキャンバスならさらに多い）を1ピクセルずつ走査してマスク画像を構築する
3. それをCanvas要素・PixiJSテクスチャへ変換し、あらためてGPUへ描画する

という重い処理を行います。**これが、クリッピングを使っているレイヤーが1枚でもあれば、そのレイヤーと無関係な場所にストロークを1本描くだけで、毎回まるごと実行されます。**

### 5-2. なぜ「フォルダやレイヤーが増えた状態」と関係するか

- `getLayers()`によるループ自体がレイヤー総数に比例して重くなる。
- クリッピングを使っているレイヤーが多いほど（キャラクターの陰影を肌レイヤーへクリッピング、といった一般的な使い方が複数箇所にあるほど）、GPU readback＋ピクセル走査＋GPU再描画の回数が増える。
- キャンバスサイズが大きいほど、ピクセル走査コストが（幅×高さに比例して）増える。

前回・今回ご指摘の「フォルダやレイヤーが増えた状態」という条件と、この処理が重くなる条件は一致します。しかも**緊急復帰の自動保存と違い、これは「ストロークを描くたび毎回」発生する**ため、体感としてはこちらの方が「常時ペンが少し重い」という感覚に近い可能性があります。

### 5-3. 現時点の位置づけ

これは開発チームの既存記録（`PROGRESS.md`、`phase6e.md`）には登場しない、**今回の調査で新たに見つかった疑わしい箇所**であり、Phase 6eのように実測値が取れているわけではありません。次のいずれかで実際の影響度を確認することを推奨します。

- クリッピングを使っているレイヤーがある状態とない状態で、ストローク確定直後の体感の重さを比較する。
- `TEGAKI_CONFIG.debug = true`にして、`refreshClippingMasks()`の前後に簡易的な計測（`performance.now()`差分）を仕込み、実際の所要時間をログ出力してみる。

もし実測で有意な遅延が確認できた場合、改善の方向性としては「変更があったクリッピング関係だけを差分更新する」「同一フレーム内の複数呼び出しをまとめる（debounce）」などが考えられますが、これは今回の自動保存設定とは別の改修テーマとして、**別途調査・提案書を分けることを推奨します**（クリッピング機能はCAF/Folderと関わる範囲のため、`PHASE4Z_BOUNDARY.md`に照らしてCodex確認が必要な可能性が高いため）。

---

## 6. まとめ

1. 自動保存On/Off＋保存間隔の設定UIは、既存の`History`設定と同じ型でそのまま実装可能。採用を推奨。
2. OFF時も、タブを閉じる際の最終保存だけは安全のため維持する設計とする。
3. 今回新たに、`refreshClippingMasks()`が毎ストロークごとに全レイヤーを再走査する重い処理であることを発見した。クリッピング使用状況・レイヤー数・キャンバスサイズに応じて体感遅延に寄与している可能性があり、実測での確認と、別テーマとしての改修提案を推奨する。
