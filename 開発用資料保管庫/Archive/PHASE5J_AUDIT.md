# Phase 5j 実装監査

更新日: 2026-06-21
判定: 2026-06-21時点では未完了。2026-06-27に修正完了し、記録としてArchiveへ移動。

## 結論

`TimelineModel` の再生範囲計算とmarker保存fieldは追加されているが、
Phase 5jの受け入れ条件を満たすUI・History・再生接続が不足している。
次Phaseへは進まず、`task-codex/phase5j.md` の修正sliceを先に完了する。

## 確認できた実装

- `TimelineModel.playback` に `loop / endMode / inFrame / outFrame` が存在する。
- `getPlaybackRange()` がtimeline、last-clip、out-markerを計算する。
- `advanceFrame()` がeffective start / endとloop ON / OFFを扱う。
- `serialize()` と既存project / Album経路でplayback fieldを保存できる。
- Timeline History snapshotはmodel serializeを含むため、設定変更を記録する土台はある。
- Timeline ruler生成時にIN / OUT marker classとbadgeを出す入口がある。
- `node --check` と `npm.cmd run build` は成功した。
- BrowserでAnimation Table表示と既存play button、console新規errorなしを確認した。

## 修正必須

### 1. playback scopeが実再生へ渡っていない

`AnimationTablePopup.play()` は `this.model.advanceFrame()` を引数なしで呼ぶ。
そのため`endMode = last-clip`でも、LANE / SETの終端計算は常にall相当になる。

再生開始時に固定した `activePlaybackLaneIds` を、previewだけでなく
last-clip終端計算にも使用する。UI enumをmodelへ直接持ち込むより、
対象Lane ID集合をmodelへ渡す契約を優先して検討する。

### 2. 再生開始直後の範囲正規化が遅い

currentFrameが範囲外でも、現在は最初のtimer tickまでeffective startへ移動しない。
`play()` 開始時にrangeを確定し、必要なら即座にFrame移動・render・event通知する。

### 3. marker正規化methodが未接続

`clampPlaybackSettings()` は定義されているが、次の経路から呼ばれていない。

- constructor / 旧project読込
- totalFrames変更
- Timeline History復元
- project / Album復元
- IN / OUT設定

`endMode` の許可値、NaN、整数化、`inFrame <= outFrame` も同じ正規化入口へ集約する。
INがlast-clip終端より後になる条件のfallbackも固定入力で仕様化する。

### 4. 操作UIが未実装

Browser上で確認したAnimation Tableには次が存在しない。

- loop ON / OFF button
- timeline / last-clip / OUT終端切替
- 現在FrameをIN / OUTへ設定するbutton
- marker解除操作

既存play、ALL / LANE / SET、PREVIEW、ONION、FPS、FRAMESを押し出さない小型controlとして追加する。

### 5. marker表示が未完成

`.anim-marker-badge`、`.in-marker`、`.out-marker` を生成するコードはあるが、
対応する表示CSSと操作入口がない。未使用の `range` 変数も残っている。

静的装飾は既存CSS変数を使い、marker位置だけをTimeline cellに追従させる。
最初からmarker dragや修飾clickを追加しない。

### 6. History接続が未実装

Timeline Historyのserialize / restore土台はあるが、playback設定変更を記録する
setter / commandがない。loop、endMode、IN、OUTの各操作を1操作1commandで記録する。
再生中のcurrentFrame進行はHistoryへ記録しない。

### 7. Phase文書が実装状態と不一致

`task-codex/phase5j.md` とhandoffが「計画済み・未着手」のままで、
`PROGRESS.md` にも部分実装と残存が記録されていなかった。

## 固定入力結果

総Frame 12、IN=2、OUT=8:

- out-marker、loop OFF、currentFrame=8: `advanceFrame()` はfalse、Frame 8を維持。
- last-clip、ALL、Lane A終端3、Lane B終端8: rangeは2..8。
- last-clip、LANE=A: model helper単体ではrange 2..3。
- last-clip、SET={B}: model helper単体ではrange 2..8。
- IN=9、OUT=3: 現行はrange 0..3へ暗黙fallbackし、model値自体は修復しない。

最後の条件は明示的な正規化契約へ修正する。

## PixiJS v8.19確認

公式v8.19.0 release note:

- https://github.com/pixijs/pixijs/releases/tag/v8.19.0

公式Application options:

- https://pixijs.com/8.x/guides/components/application

確認結果:

- v8.19.0は2026-06-04公開のlatest release。
- Tegakiは現在v8.17.0。
- v8.19.0の主な追加はopt-inの`pixi.js/html-source`と、
  WebGPU MSAA RenderTexture向け`transientAttachment`。
- rendererの既定`preference`は現在も`webgl`。WebGPUが既定化されたわけではない。
- 点検レポートにあるGraphics to SVG ExportとSprite Mask Channelsは、
  v8.19.0公式release noteで追加機能として確認できない。
- Phase 5iのinverse clippingを未確認APIへ置き換えない。
- v8.17からv8.19への更新はWebGPU有効化と分離した互換監査候補とする。

## 次の完了条件

- fixed sequenceをmodel helperと実再生の両方で確認する。
- LANE / SETのlast-clip終端が再生開始時に固定したLane集合と一致する。
- loop / endMode / IN / OUT UIとTimeline Historyを接続する。
- totalFrames縮小、旧project、marker逆転、未設定を同じ入口で正規化する。
- project / Album保存復元とExport範囲の独立を確認する。
- browserで既存CAF操作、Timeline pan、Clip move / retime、Undo / Redoを回帰する。
- `dist/` とVite cache差分を残さない。
