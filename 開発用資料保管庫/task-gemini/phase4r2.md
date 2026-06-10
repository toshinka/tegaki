# Phase 4r2 — Hospital Recovery 即応化

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4r.md`
4. `task-gemini/phase4r_report.md`
5. `tegaki_work/system/emergency-recovery-store.js`
6. `tegaki_work/core-engine.js`
7. `tegaki_work/ui/album-popup.js`
8. `tegaki_work/system/project-manager.js`
9. `tegaki_work/system/history.js`

## 背景

Phase 4r で Hospital Recovery を導入したが、現在は自動退避が「3秒 debounce + 60秒 throttle」であり、誤ってブラウザバック/リロードした直前の状態を拾えない可能性がある。

オーナーの求める挙動は、History を丸ごと復元することではない。

目標は以下。

- History 100 の時点でブラウザバック/リロードしても、History 0 の状態として復帰してよい。
- Undo/Redo 履歴は失われてよい。
- ただし、History 100 時点に近い「画面状態・レイヤー構造・プロジェクト全体状態」は残ってほしい。
- 保存先は引き続き IndexedDB の最新1件でよい。

## 目的

Hospital Recovery を「長時間ごとの保険」から「最新確定状態の即応退避」へ寄せる。

履歴 command や全ストロークログの永続化はしない。`ProjectManager.exportProject()` による最新プロジェクト全体の上書き退避を、より短い待ち時間で行う。

## 実装方針

### 1. debounce / throttle を短縮する

`emergency-recovery-store.js` の保存間隔を以下の方向へ変更する。

候補値:

- `_debounceDelay`: `3000` → `1000` ms 前後
- `_saveInterval`: `60000` → `3000`〜`5000` ms 前後

推奨:

```js
this._saveInterval = 5000;
this._debounceDelay = 1000;
```

理由:

- 毎ストローク即 `exportProject()` は重い。
- ただし 60秒間隔では緊急復帰として遅すぎる。
- 1秒 debounce + 5秒 throttle なら、通常描画の直後状態へかなり寄せられる。

### 2. 保存中の再変更は「もう1回保存」へつなげる

現在の `_pendingSave` は保存中変更を拾うが、再試行が `_saveInterval / 2` で遅い。

Phase 4r2 では、保存中に変更があった場合、保存完了後に短い debounce で再保存を予約する。

方針:

- 保存中に `scheduleCheckpoint()` が呼ばれたら `_pendingSave = true`。
- `performSave()` の finally で `_pendingSave` が true なら、`scheduleCheckpoint()` 相当の短い再予約をする。
- ただし保存の多重実行はしない。

### 3. ページ離脱時の最後の保存を試みる

`pagehide` / `visibilitychange` / `beforeunload` のどれか、または複数を使い、最後の退避を試みる。

注意:

- ブラウザは非同期処理完了を保証しない。
- `alert()` / `confirm()` は出さない。
- 失敗しても UI を止めない。
- 「効く場合は効く補助策」として扱う。

候補:

```js
window.addEventListener('pagehide', () => {
  emergencyRecoveryStore.forceCheckpointSoon?.();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    emergencyRecoveryStore.forceCheckpointSoon?.();
  }
});
```

`forceCheckpointSoon()` は、通常の60秒/5秒制限を完全無視するか、最小限の多重実行ガードだけ残して `performSave()` へ寄せる。

ただし `performSave()` は `exportProject()` を含む非同期処理なので、ページ離脱時に必ず完了するとは考えないこと。

### 4. Hospital 復帰時の History リセットを明記する

`ProjectManager.loadProject()` は通常ロード後に `window.History.clear()` を呼ぶ。

Phase 4r2 では、Hospital 復帰後に History が 0/500 へ戻ることを仕様として `phase4r2_report.md` に明記する。

必要なら `_loadHospitalCheckpoint()` 側でも復帰後に `window.History?.clear?.()` を明示的に呼んでよい。ただし `ProjectManager.loadProject()` 側と重複しても問題ない範囲に留める。

### 5. Hospital tooltip / UI状態更新

自動退避の即応性が上がるため、アルバム Hospital ボタンの tooltip に表示される日時が更新されやすくなる。

確認:

- アルバムを開いた時、Hospital ボタンが右端に常時表示される。
- 退避データなし: disabled / 薄い表示。
- 退避データあり: available / 赤系表示 / tooltip に退避日時。

この UI 配置は Codex 補修済みなので、壊さないこと。

## このPhaseでやらないこと

- History command の永続化。
- Undo/Redo履歴の復元。
- 複数世代バックアップ。
- localStorage アルバム正本の IndexedDB 移行。
- 完全なクラッシュ直前保証。
- 合成PNGだけの軽量退避。
- アニメ ClipAsset / DrawingSnapshot の保存形式変更。
- Hospital 起動時自動復元ダイアログ。

## 注意点

- `exportProject()` は全レイヤーPNG化を含むため重い。保存頻度を短くしすぎない。
- 自動保存失敗では `alert()` を出さない。`console.warn` に留める。
- 調査ログの `console.log` をむやみに増やさない。残す場合は目的を `phase4r2_report.md` に書く。
- `album-popup.js` の Hospital 右端配置と `styles/main.css` の Hospital CSS を壊さない。
- `dist/` の生成物は作業対象にしない。

## 完了条件

- [ ] Hospital 自動退避が 1秒前後 debounce + 3〜5秒 throttle 程度へ即応化されている。
- [ ] 保存中に変更が来た場合、保存完了後に再退避が予約される。
- [ ] `pagehide` / `visibilitychange` 等で最後の退避を試みる補助導線がある。
- [ ] Hospital 復帰後は History がリセットされる仕様が確認・記録されている。
- [ ] アルバム右端の Hospital ボタン表示が維持されている。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4r2_report.md` を作成し、保存間隔・離脱時保存の限界・Historyリセット仕様を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
