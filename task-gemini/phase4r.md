# Phase 4r — Hospital Recovery / 緊急復帰チェックポイント

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4q.md`
4. `tegaki_work/system/history.js`
5. `tegaki_work/ui/album-popup.js`
6. `tegaki_work/system/project-manager.js`
7. `tegaki_work/system/virtual-album.js`

## 背景

長時間描画中、または History 表示が 500 付近/500超えの状態で、突然エラー停止する疑いがある。

現時点の棚卸しでは、`HistoryManager.maxSize` は 500 で、500件を超えると古い command を `shift()` している。そのため「履歴配列が無限に増える」型ではない。

ただし、現在の履歴 command はレイヤーの `createLayerRasterSnapshot()` 前後データを保持する経路が多い。1 command が大きい場合、500件以内でもメモリ圧迫は起こり得る。

また現行アルバムは `localStorage` の `tegaki_album` が正本で、`ProjectManager.exportProject()` が各レイヤー画像を PNG dataURL として保存する。緊急復帰データを同じ `localStorage` に自動保存すると、容量上限や `QuotaExceededError` を誘発しやすい。

## 目的

クラッシュやブラウザ誤操作の直前に近い描画状態へ戻れる、軽い「ホスピタル」復帰導線を作る。

アルバム内に復帰ボタンを置く方向でよいが、保存先は `localStorage` ではなく IndexedDB を優先する。

## 実装方針

### 1. IndexedDB ベースの緊急退避ストアを作る

既存 `system/virtual-album.js` はアニメーション blob 用の未接続実装なので、そのまま混ぜず、緊急復帰専用の小さなストアを追加する。

候補:

- 新規ファイル: `tegaki_work/system/emergency-recovery-store.js`
- DB名: `TegakiEmergencyRecovery`
- store名: `snapshots`
- key: 固定キー `latest`、または最新1件だけ残す設計

保存データ候補:

```js
{
  id: 'latest',
  timestamp: Date.now(),
  thumbnail,
  projectData,
  reason: 'auto-checkpoint'
}
```

`projectData` は `ProjectManager.exportProject()` の戻り値をそのまま保存する。

### 2. 自動チェックポイントは強く間引く

`history:changed` をトリガにしてよいが、毎回保存しない。

最低条件:

- 最後の保存から 60 秒以上経過していること。
- 連続描画中に毎ストローク即保存しないこと。
- `setTimeout` で 2〜5 秒遅延し、その間に追加変更があれば1回にまとめること。
- 保存中に次の保存を重ねないこと。

例:

```js
TegakiEventBus.on('history:changed', () => {
  emergencyRecovery.scheduleCheckpoint();
});
```

### 3. 保存失敗は UI を止めない

IndexedDB 保存が失敗しても描画操作を止めない。

- `console.warn` 程度に留める。
- `alert()` は自動保存失敗では出さない。
- `QuotaExceededError` らしい場合は、原因メモを `phase4r_report.md` に書く。

### 4. アルバムへ Hospital ボタンを追加

`album-popup.js` の toolbar に Hospital ボタンを追加する。

候補アイコン:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M14 9h-4"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/></svg>
```

可能なら `ui-icons.js` に `hospital` として追加し、AlbumPopup では `UI_ICONS.hospital` を使う。

ボタン挙動:

- 緊急退避が存在しない場合は disabled。
- クリック時に確認メッセージを出す。
- 復元は `window.projectManager.loadProject(snapshot.projectData)` を使う。
- 復元後はアルバムを閉じ、レイヤーパネル更新と履歴クリアが通常ロード同様に走ることを確認する。

確認メッセージ例:

```text
最後の自動退避状態へ復帰します。現在のキャンバス状態は置き換わります。実行しますか？
```

### 5. 既存アルバム保存とは混ぜない

Hospital は通常アルバム項目を増やさない。

- `this.snapshots.push()` しない。
- `tegaki_album` に保存しない。
- HTML書き出し対象に含めない。

## このPhaseでやらないこと

- History の最大件数変更。
- 履歴 command の圧縮/差分化。
- localStorage アルバム正本の IndexedDB 移行。
- 自動保存の複数世代管理。
- クラッシュ完全防止。
- アニメ ClipAsset / DrawingSnapshot の保存形式変更。

## 調査メモ

原因が再現できる場合は、以下を確認して `phase4r_report.md` に残す。

- `TegakiConsole.txt` のエラー全文。
- History の `stackSize` と `currentIndex`。
- レイヤー数、キャンバスサイズ、アニメ Snapshot 数。
- `localStorage` 保存時の `QuotaExceededError` 有無。
- `ProjectManager.exportProject()` 中の `renderer.extract.canvas()` 失敗有無。

## 完了条件

- [ ] 緊急復帰用 IndexedDB ストアがある。
- [ ] `history:changed` から強く間引いた自動チェックポイントが保存される。
- [ ] 自動保存失敗で描画操作が止まらない。
- [ ] アルバムに Hospital ボタンがある。
- [ ] Hospital ボタンで最新チェックポイントから復元できる。
- [ ] 通常アルバム `tegaki_album` の項目は増えない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4r_report.md` を作成し、保存先・間引き条件・残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
