# Phase 4z2 — Lane Playback Include MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z1_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/system/layer-system.js`

## 重要な注意

- `AUTO`、`EDIT`、現行 `CAPTURE` は、Lane/Clip内部レイヤー/Virtual Layer Panel が整うまでの暫定UIである。今回それらの本格整理はしない。
- 現行 `CAPTURE` は「選択Clipへ現在の絵をSnapshotとして記録する」意味であり、将来の「複数Laneを再生対象として記録する」概念とは別物。今回も `CAPTURE` という名前を増やさない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- 過去に `animation-table-popup.js` のテンプレート文字列崩れで起動不能が起きている。HTMLテンプレート、CSS文字列、閉じタグを必ず確認する。
- `npm.cmd run build` が失敗した場合、今回触った箇所を優先して確認し、関係ないファイルへ修正を広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z1で、プレビュー/再生対象を `ALL` と `LANE` で切り替えられるようになった。

次に必要なのは、オーナーが「キャプチャー」と呼んでいた、複数Laneを一時的に再生対象へ含める考え方である。

ただし、この機能は名前付きの大きな「キャプチャー」機能として作るより、Lane行の左側にチェック/点灯/小アイコンを置き、「このLaneを再生対象へ含める」と示す方が分かりやすい。

Phase 4z2では、保存済みセットやAsset Libraryには踏み込まず、Lane行単位の include 状態だけを持つMVPを作る。

## 目的

アニメテーブル上で、複数Laneを「再生/プレビュー対象に含める」状態にできるようにする。

目的は以下。

- `ALL`: 全Lane表示。
- `LANE`: Active Laneだけ表示。
- `SET`: includeされたLaneだけ表示。

という3段階の確認を可能にする。

将来の `Lane Set` / `Playback Set` / `Playback Capture` の足場にする。

## 今回やること

### 1. 再生スコープへ `SET` を追加

`AnimationTablePopup` の `playbackScope` を以下へ拡張する。

```js
this.playbackScope = 'all'; // 'all' | 'activeLane' | 'includedLanes'
```

UI表示は以下のような3択にする。

```text
ALL | LANE | SET
```

`SET` は「includeされたLaneだけ」を意味する。

注意:

- `SET` という名称は盤面上の仮UIでよい。
- 将来は文字を出さず、Lane側の点灯/チェックとhover説明だけにする可能性がある。

### 2. include状態の持ち方

MVPでは `AnimationTablePopup` 内の一時状態でよい。

候補:

```js
this.includedLaneIds = new Set();
```

保存/読み込み、serialize、Album保存への統合は今回しない。

理由:

- Lane独立管理とAsset Libraryがまだ途中。
- 今の段階で永続化すると、後でデータモデル移行時に二重作業になりやすい。

### 3. Lane行にincludeボタンを置く

Lane名の左または近くに、小さなボタン/チェック/点灯表示を置く。

候補表示:

- `＋`
- `✓`
- 小さな丸点灯

推奨:

- 文字の意味を強くしすぎない。
- hover titleで「このLaneをSET再生対象に含める」などを出す。
- active状態は軽く点灯させる。
- フォルダLaneや背景Laneは対象外、またはdisabled扱い。

実装候補:

```html
<button class="anim-lane-include-btn active" data-lane-id="..." title="SET再生対象に含める">+</button>
```

### 4. include操作

Lane includeボタンをクリックすると、そのLane IDを `includedLaneIds` に追加/削除する。

注意:

- Lane名クリックやClipクリック、D&D、フレーム移動と競合しないようにする。
- クリック後は `render()` で見た目とPreviewを更新する。
- ヘッダードラッグ対象からこのボタンは関係ないが、イベントバブリングが問題になる場合は `stopPropagation()` を使う。

### 5. SET時のフィルタ

`_getPreviewLaneFilter()` が現在は単一Laneを返している場合、今回から複数Laneを扱えるようにする。

推奨:

- 既存の単一Lane filterを壊さないため、返り値を `Set` に統一するか、別メソッドを追加する。

候補:

```js
_getPreviewLaneFilterIds() {
    if (this.playbackScope === 'activeLane') {
        const lane = this._getActivePreviewLane();
        return lane ? new Set([lane.id]) : null;
    }

    if (this.playbackScope === 'includedLanes') {
        return this.includedLaneIds.size > 0 ? new Set(this.includedLaneIds) : null;
    }

    return null; // ALL
}
```

`null` は「全Lane」を意味する。

`SET` で include が空の場合は、MVPでは安全のため `ALL` fallbackでよい。

理由:

- 空表示になると壊れたように見える。
- 後でUIが整ったら「SET empty」表示を追加すればよい。

### 6. 再生時の固定

Phase 4z1と同じく、再生開始時に対象Laneを固定する。

候補:

```js
this.activePlaybackLaneIds = null;
```

再生開始時:

- `ALL`: `null`
- `LANE`: Active Lane IDのSet
- `SET`: `includedLaneIds` のコピー

再生停止時にクリア。

注意:

- 再生中にincludeを切り替えても、再生対象が急に変わらない方が安定する。
- 停止後に反映される形でよい。

### 7. Onion Skin

ONIONもScopeと同じ対象に限定する。

- `ALL`: 全Lane。
- `LANE`: Active Lane。
- `SET`: includeされたLane。

既存の選択Clip集中モードがある場合は壊さない。

### 8. UI配置

Scope切替は再生ボタン横を維持する。

候補:

```text
▶  ALL LANE SET  ANIMATION TABLE
```

`SET` ボタンのtitle:

- `チェックしたLaneだけをプレビュー/再生`

Lane includeボタンのtitle:

- `このLaneをSET再生対象に含める`
- active時: `このLaneをSET再生対象から外す`

## 今回やらないこと

- 名前付きPlayback Setの保存。
- 複数セットの管理。
- レーンごとのSolo/Mute完全実装。
- Virtual Layer Panel。
- Clip内部レイヤー。
- Asset Library。
- `CAPTURE` の正式改名。
- `AUTO` / `EDIT` の撤去や全面整理。
- UIの最終デザイン調整。

## 暫定UIについて

`AUTO`、`EDIT`、`CAPTURE`、`UNIQUE` は今後の構造変化で消える、または名前や位置が変わる可能性が高い。

今回の実装では、これらをきれいに並べ直すより、以下を優先する。

- 再生/表示モデルが破綻しない。
- Lane includeの状態が分かる。
- D&DやClip編集を壊さない。
- ビルドが通る。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- Scope UIが `ALL / LANE / SET` の3択になる。
- `ALL` は従来どおり全Laneを表示/再生する。
- `LANE` はPhase 4z1どおりActive Laneだけを表示/再生する。
- Lane行のincludeボタンで複数LaneをON/OFFできる。
- `SET` ではincludeされたLaneだけを表示/再生する。
- `SET` でincludeが空の場合、壊れたように見えないfallbackになる。
- 再生開始時に対象Lane群が固定され、再生中に選択やinclude状態が変わっても表示がブレない。
- ONIONがScopeに追従する。
- Clipクリック、EDIT、AUTO、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- Preview OFF時は通常レイヤー表示へ戻る。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z2_report.md`

報告書には以下を必ず書く。

- include状態の持ち方。
- `ALL / LANE / SET` の判定方法。
- 再生時に対象Lane群をどう固定したか。
- Lane include UIの場所と見た目。
- ONIONへの影響。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z2 完了ログを追記する。

最低限、以下を書く。

- Phase 4z2 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
