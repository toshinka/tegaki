# Phase 5e 監査結果

更新日: 2026-06-20

状態: 完了

## 対象

- Settings / Export popupのUI / CSS。
- Settings EventBus namespace。
- `window.*` の初期化・互換境界。
- Raster / Model / Structure History command。
- Layer全体変形、pixel selection変形、CAF working Layer境界。

## EventBus

- Settingsの正規契約は `SettingsManager.set()` が送る
  `settings:<kebab-case-key>` とpayload `{ value }`。
- `settings:pressure-curve` を `{ curve }` で二重送信していた経路を削除した。
- History変更通知は `history:changed` とし、payloadにaction、commandName、
  meta、usage、Undo / Redo可否を保持する。
- 旧animation、clipboard、popup等には通知専用eventと外部request入口が残る。
  listener数だけを根拠に削除しない。
- EventBus literalの全件定数化は行わない。

## global依存

- `core-engine.js` の初期global登録は、BrushCore等のconstructorが参照する
  初期化順互換として必要。
- initialize中の再登録は、Layer / Camera / StrokeRenderer等の初期化済みinstanceを
  公開する境界として必要。
- `CoreRuntime`へ移行済みのAPIもあるが、UI、旧animation、診断、
  project / album復元が既存globalを参照する。
- 参照0件を確認できる登録は今回の対象内にないため削除しない。

## History

- command契約は `{ name, do, undo, byteSize?, meta? }` を維持する。
- active Layerへのpaste履歴が `{ redo }` を使いvalidationで拒否されていたため、
  `{ do, undo }` を `record()`する契約へ修正した。
- Raster snapshotを前後保持するstroke、fill、selection、Layer transform、
  merge等はbyteSizeを計上済み。
- Model / Structure commandは大きいTypedArrayを保持しないため、
  一律のbyteSize追加は行わない。
- `HistoryCommand` class階層は導入しない。

## transform / selection / CAF

- Layer全体変形とpixel selection変形は
  `system/transform-math.js` の中心基準行列を共有する。
- preview対象はLayer Containerとselection専用Spriteで分かれるが、
  confirm時の1回bake、cancel、前後snapshot Historyの時系列は一致する。
- pixel selectionはBackground、Folder、animation working Layerを対象外とする。
- CAF internal LayerはTimelineModel / ClipAsset / DrawingSnapshotが正本であり、
  通常Layer Historyへ接続しない。
- 現行adapterより小さく安全な共通APIは確認できないため、
  `IDrawingTarget` 等の抽象化は導入しない。

## UI / CSS

- Settings / Export popupの固定装飾をCSS classとFutaba paletteへ移した。
- form、disabled、status、progress、scrollbarを既存変数へ揃えた。
- 動的位置、slider / progress率、show / hideはJS管理を維持する。
- popup overlay mount、drag、close、preview、download構造は変更していない。

## 完了判断

- Phase 5eで指定された各監査領域を実コードへ照合した。
- 実在した契約不一致だけを局所修正した。
- 全件定数化、global全廃、BasePopup、History class階層、
  drawing target基底classは導入しない。
