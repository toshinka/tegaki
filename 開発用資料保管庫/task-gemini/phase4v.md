# Phase 4v — Timeline Clip Move MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4u.md`
5. `task-gemini/phase4u_report.md`
6. `tegaki_work/system/animation/animation-data-model.js`
7. `tegaki_work/ui/animation-table-popup.js`

## 背景

Phase 4u で、アニメテーブルは `LaneModel` / `ClipInstanceModel` の足場を持った。

ただし、セル/クリップの位置を変えるには、まだ以下のような遠回りが必要。

- 削除して置き直す。
- COPY / PASTE で別位置に複製する。
- duration は右端ハンドルで伸縮できるが、開始位置そのものはドラッグ移動できない。

次は、タイムライン上のクリップをマウスで掴んで、別フレームや別Laneへ移動できるようにする。

これはレイヤーパネルD&Dとは別物であり、対象はアニメテーブル内の `ClipInstance` 移動だけに限定する。

## 目的

アニメテーブル上で、既存クリップをドラッグして移動できる MVP を実装する。

最低限ほしい挙動:

- クリップ本体を掴んで左右に動かすと `startFrame` が変わる。
- 上下に動かすと移動先Laneが変わる。
- フォルダLaneには移動できない。
- 他クリップと重なる位置には移動できない。
- duration / assetId / rasterSnapshot / selected 状態は維持する。
- Preview / Onion は移動後に更新される。

## 基本方針

### 1. まずデータモデル側に安全な移動メソッドを作る

UI側で直接 `clip.startFrame = ...` や `lane.cels.splice(...)` を散らさない。

`TimelineModel` に、移動可否判定と移動実行をまとめる。

候補:

```js
canMoveClip(clipId, targetLaneId, targetStartFrame)
moveClip(clipId, targetLaneId, targetStartFrame)
```

戻り値例:

```js
{ ok: true, lane, clip }
{ ok: false, reason: 'not-found' | 'folder-lane' | 'out-of-range' | 'overlap' }
```

実装方針:

- `findClipEntry(clipId)` で移動元を取得。
- `getLaneById(targetLaneId)` で移動先Laneを取得。
- `targetLane.type === 'folder'` なら不可。
- `targetStartFrame < 0` なら不可。
- `targetStartFrame + clip.duration > totalFrames` なら不可。
- 同一Lane内の移動でも、対象clip自身は重なり判定から除外する。
- 別Laneへ移動する場合は、元Laneからclipを外して移動先Laneへ入れる。
- 移動後は `clip.startFrame` を更新し、`clip.sourceLayerId` / `clip.layerId` を移動先Laneに合わせる。

注意:

- asset本体は複製しない。
- `assetId` は維持する。
- `rasterSnapshot` 互換フィールドも維持する。

### 2. UI側は既存リタイミングと衝突させない

既に右端ハンドル `.anim-cel-handle` は duration 伸縮に使っている。

Phase 4vでは以下の切り分けにする。

- `.anim-cel-handle` の mousedown: 既存どおりリタイミング。
- `.anim-cel-block` 本体の mousedown: クリップ移動。
- パネルヘッダーの mousedown: 既存どおりパネル移動。

ハンドルを掴んだ時に移動D&Dが発火しないよう、`e.target.closest('.anim-cel-handle')` を必ず除外する。

### 3. ドラッグ中の表示はMVPでよい

高級なゴースト表示は必須ではない。

MVPで許可:

- ドラッグ中は対象クリップへ `.moving` クラスを付ける。
- 移動候補セルへ `.move-target` / `.move-invalid` を付ける。
- もしくは、ドラッグ終了時にだけ移動し、ドラッグ中は半透明表示だけでもよい。

ただし、何も反応がないと分かりにくいため、最低限 `.moving` は付ける。

### 4. 座標からLane/Frameを解決する

既存DOMにはセルスロットに以下がある。

```html
data-track-id="..."
data-frame-index="..."
```

ドラッグ終了時の `document.elementFromPoint(e.clientX, e.clientY)` から `.anim-cell-slot` を探し、移動先を決める。

候補:

```js
const targetEl = document.elementFromPoint(e.clientX, e.clientY);
const slot = targetEl?.closest('.anim-cell-slot');
```

注意:

- クリップ自身が前面にいると `elementFromPoint` が `.anim-cel-block` を返す可能性があるため、`closest('.anim-cell-slot')` で親を取る。
- パネル外でドロップした場合は移動キャンセル。
- フォルダLaneへドロップした場合は移動キャンセル。
- 不正位置へドロップした場合は元位置維持。

### 5. クリック選択との誤爆を避ける

短いクリックは従来通り選択にする。

候補:

- mousedown 時に開始座標を保持。
- mousemove で移動量が 4px 以上になったら `isClipMoving = true`。
- 4px 未満で mouseup した場合は通常クリック扱いへ任せる。

既存クリックハンドラが動いてしまう場合は、Phase 4j/4hと同様に `_clipMoveMoved` のようなフラグで直後の click を無視する。

### 6. Preview / Onion の更新

移動成功後:

- `this.selectedCelId` は移動したclipのまま維持する。
- 必要なら `this.model.setCurrentFrame(targetStartFrame)` はしない。MVPでは現在フレームは維持でよい。
- `this.render()` を呼ぶ。
- PREVIEW / ONION がONなら、移動後の配置で表示更新されること。

## 実装候補

### 1. `TimelineModel` に移動メソッド追加

`animation-data-model.js` に追加。

候補:

```js
canMoveClip(clipId, targetLaneId, targetStartFrame) {
    const entry = this.findClipEntry(clipId);
    const targetLane = this.getLaneById(targetLaneId);
    if (!entry || !targetLane) return { ok: false, reason: 'not-found' };
    if (targetLane.type === 'folder') return { ok: false, reason: 'folder-lane' };
    if (targetStartFrame < 0 || targetStartFrame + entry.clip.duration > this.totalFrames) {
        return { ok: false, reason: 'out-of-range' };
    }
    if (!targetLane.canPlaceCel(targetStartFrame, entry.clip.duration, entry.clip.id)) {
        return { ok: false, reason: 'overlap' };
    }
    return { ok: true, lane: targetLane, clip: entry.clip, sourceLane: entry.lane };
}
```

```js
moveClip(clipId, targetLaneId, targetStartFrame) {
    const check = this.canMoveClip(clipId, targetLaneId, targetStartFrame);
    if (!check.ok) return check;

    const { sourceLane, lane: targetLane, clip } = check;
    if (sourceLane.id !== targetLane.id) {
        sourceLane.cels = sourceLane.cels.filter(c => c.id !== clip.id);
        targetLane.cels.push(clip);
        clip.sourceLayerId = targetLane.sourceLayerId;
        clip.layerId = targetLane.layerId;
    }
    clip.startFrame = targetStartFrame;
    return { ok: true, lane: targetLane, clip };
}
```

### 2. `AnimationTablePopup` に状態追加

constructor に追加候補。

```js
this._clipMoveData = null;
this._clipMoveMoved = false;
this._isClipMoving = false;
```

### 3. クリップ本体 mousedown を追加

既存の timelineGrid `mousedown` はリタイミング用に使われている。

同じ listener 内、または別 listener で、ハンドルではない `.anim-cel-block` を対象にする。

候補:

```js
const block = e.target.closest('.anim-cel-block');
if (block && !e.target.closest('.anim-cel-handle')) {
    const clipId = block.dataset.celId;
    const entry = this.model.findClipEntry(clipId);
    if (!entry) return;

    this._clipMoveData = {
        clipId,
        startX: e.clientX,
        startY: e.clientY,
        sourceLaneId: entry.lane.id,
        sourceStartFrame: entry.clip.startFrame
    };
    this._clipMoveMoved = false;
    this.selectedCelId = clipId;

    document.addEventListener('mousemove', this._onClipMoveMouseMove);
    document.addEventListener('mouseup', this._onClipMoveMouseUp);
    e.stopPropagation();
    e.preventDefault();
}
```

### 4. mousemove / mouseup

mousemove:

- 4px以上動いたら `_isClipMoving = true`。
- `.anim-cel-block.selected` に `.moving` を付ける、または `this._movingCelId` を持って render時にクラス付与。
- MVPでは毎mousemoveで render しない。必要ならクラス直接付与でよい。

mouseup:

- 移動量が4px未満なら移動処理しない。選択だけ残す。
- `elementFromPoint` で `.anim-cell-slot` を取得。
- `targetLaneId` と `targetFrame` を読む。
- `this.model.moveClip(clipId, targetLaneId, targetFrame)` を呼ぶ。
- 成功したら `this.selectedCelId = clipId; this.render();`
- 失敗時は元のまま `this.render();`
- document listener を外す。
- 直後の click 誤爆を避けるため `_clipMoveMoved` を一瞬 true にして既存 click handler で無視する。

既存 click handler の先頭:

```js
if (this._dragMoved || this._retimingMoved || this._clipMoveMoved) {
    this._dragMoved = false;
    this._retimingMoved = false;
    this._clipMoveMoved = false;
    return;
}
```

### 5. CSS

既存の `animation-table-popup.js` 内 CSS 注入に最小追加。

```css
.anim-cel-block.moving {
    opacity: 0.65;
    transform: scale(1.02);
    cursor: grabbing;
}

.anim-cel-block {
    cursor: grab;
}

.anim-cel-handle {
    cursor: ew-resize;
}
```

既存CSSと重複する場合は、必要最小限にする。

## このPhaseでやらないこと

- レイヤーパネルD&Dの修正。
- Lane自体の並べ替え。
- 複数セル選択。
- 複数セル一括移動。
- Shift/Altドラッグ複製。
- ドラッグ中のリアルタイムゴースト追従。
- 移動先候補の高度なハイライト。
- 自動キャプチャ。
- Clip内部レイヤー編集。
- Virtual Layer Panel。
- Undo/Redoへのアニメ操作履歴統合。

Undo/Redo統合は重要だが、このPhaseでは手を広げない。まず移動操作のデータ整合性を確認する。

## 注意点

- `animation-table-popup.js` はテンプレート文字列とCSS注入ブロックが長い。バッククォート閉じ忘れに注意する。
- 右端リタイミングハンドルと移動D&Dを必ず分離する。
- `moveClip()` で重なり判定をすり抜けない。
- フォルダLaneへ移動させない。
- `assetId` を消さない。
- `rasterSnapshot` 互換フィールドを消さない。
- `sourceLayerId` / `layerId` の互換を維持する。
- `dist/` は作業対象にしない。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. アニメテーブルが開く。
3. 既存クリップをクリックすると従来通り選択できる。
4. 既存クリップを左右ドラッグして別フレームへ移動できる。
5. 既存クリップを上下ドラッグして別Laneへ移動できる。
6. フォルダLaneへドロップしても移動しない。
7. 他クリップと重なる位置へドロップしても移動しない。
8. duration付きクリップを移動しても長さが維持される。
9. CAPTURE済みクリップを移動しても Snapshot 表示が維持される。
10. COPY / PASTE は従来通り動く。
11. 右端ハンドルの duration 伸縮は従来通り動く。
12. PREVIEW / ONION が移動後の配置に追従する。

## 完了条件

- [ ] `TimelineModel.canMoveClip()` または同等の移動可否判定がある。
- [ ] `TimelineModel.moveClip()` または同等の移動実行メソッドがある。
- [ ] UI側でクリップ本体ドラッグによる移動ができる。
- [ ] リタイミングハンドルと移動D&Dが競合しない。
- [ ] 不正ドロップ時にデータが壊れない。
- [ ] Snapshot / assetId / duration / selected 状態が維持される。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4v_report.md` を作成し、実装内容・確認結果・残課題を書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
