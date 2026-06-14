# PROGRESS — 作業ログ

> GeminiとClaudeが引き継ぎに使う共有メモ。
> 作業後に必ずここを更新すること。最新が上、過去ログは末尾に蓄積。

---

## フェーズ履歴

**エアブラシ描画方式改修 【Antigravity実装】**
2026-06-08
- **問題**: エアブラシが「多数の小粒子をランダム散布」する方式だったため、粒々した汚い見た目になっていた。
- **改修方針**: 「1スタンプ = 1つのソフトdab（ガウシアン風グラデーション円）」方式へ全面変更。Photoshop/Procreate標準エアブラシに近い、中心が濃く周辺へ滑らかにフェードアウトする霧状表現を実現。
- **`system/drawing/stroke-renderer.js`**:
  - `_addAirbrushDab()`: 粒子数ループを廃止。1スタンプにつきスプライト1枚だけを配置するソフトdab方式へ変更。`scatter`はわずかなランダムオフセット（揺らぎ）として機能するよう変更（0=中心固定）。
  - `_getAirbrushTexture()`: ノイズ処理（`imageData`ピクセル操作ループ）を完全廃止。`airbrushSoftness`設定でグラデーションの広がりを制御する純粋なラジアルグラデーションテクスチャへ変更。テクスチャ再生成時に旧テクスチャを`destroy()`してメモリリークを防止。
  - `flow`デフォルト値を0.22→0.08に変更（1dabがより薄くなり、重ね塗りで密度が出る）。
- **`ui/settings-popup.js`**:
  - 「粒の大きさ(Grain)」スライダーを廃止し、「エッジの柔らかさ(Softness)」スライダーを新設（range: 0.0〜1.0、default: 0.8）。
  - 「飛散(Scatter)」→「揺らぎ(Scatter)」に改名し説明文を更新。デフォルト値を0.5→0.0に変更。
  - 「流量(Flow)」の説明文を新方式に合わせて更新。デフォルト値を0.22→0.08に変更。
  - 設定キー `airbrushGrain` → `airbrushSoftness` に変更（既存LocalStorageデータは新設スライダーに引き継がれず、デフォルト値で初期化される）。
- **ビルド確認**: `npm.cmd run build` 成功（chunk size警告は既知）。

**Phase 4z26 — CAF / Working Layer Ghost Guard 【Codex実装】**
2026-05-31
- **Task5進行: CAF内部カードselectorのvariant設定化**:
  - `layer-panel-renderer.js`: CAF内部カードの row / name / thumb / visibility / clipping button selector を `_getLayerPanelCardVariantConfig('clip-layer-mirror')` に集約。
  - click委譲、contextmenu抑制、D&D開始、フォルダ開閉判定、選択解除、F2名前編集対象探索をvariant設定経由に寄せた。旧Layer/Folderカードのrow selectorも同じ設定入口へ移した。
  - `_createLayerPanelCardRowModel()` でvariant名を設定経由に正規化し、DOM/HTMLカード生成の入口差を少し減らした。
  - 旧Layer/Folderカードのshell/details/action/thumbnail/背景名部品もvariant名経由にし、旧カード固有文字列を互換classとvariant定義へ寄せた。
  - 旧カードのclip/visibility/背景色ボタン追加を `_appendLayerPanelCardActionIcon()` に集約し、DOM側アクション追加もカード共通ヘルパーを通すようにした。
  - DOM/HTML双方のアイコンボタン生成を `_createLayerPanelButtonElementFromModel()` / `_createLayerPanelButtonHtmlFromModel()` に分離し、同一button modelから展開する形を明確化した。
  - 旧導線の削除/複製/下結合ボタン生成を `_createLegacyLayerOperationButton()` に集約し、操作ボタンも同じbutton model経路へ寄せた。
  - 旧Layer/FolderカードのD&D/クリック除外selectorを `legacy-layer-card` variant設定の `interactiveSelectors` に移し、カード種別設定から参照する形にした。
  - HTML側カード行生成 `_createLayerPanelCardRowHtml()` が `cardModel` を直接受け取れるようにし、DOM/HTML双方で同じrow modelを入口にする形へ寄せた。
  - DOM側カード部品追加を `_appendLayerPanelCardParts()` に集約し、旧カードdetails/opacity/背景名、カードアクション、CAFヘッダー/行追加を同じappend経路に寄せた。
  - サムネイルサイズCSS変数生成を `_createLayerPanelCardThumbnailStyleVars()` に集約し、旧カードDOMとCAF内部カードHTMLで同じサイズ変数入口を使うようにした。
  - DOM/HTML双方のカード部品生成を `_createLayerPanelCardPartModel()` 経由に寄せ、子線生成も同じpartヘルパーを使うようにした。
  - テキストspan生成を `_createLayerPanelTextSpanModel()` 経由に寄せ、DOM側メタ/名前表示とHTML側テキスト生成の入口を揃えた。
  - 旧カード名DOMとCAF内部カード名HTMLを `_createLayerPanelNameModel()` 経由に寄せ、名前表示のclass/text/title組み立て入口を共通化した。
  - DOM/HTML双方のボタン生成で必要な `type="button"` を `_createLayerPanelButtonModel()` 側の属性生成に寄せ、ボタンタグ判定の重複を減らした。
  - フォルダサムネイル、クリッピング、通常合成表示、無効ボタンなどの状態class付与を `_applyLayerPanelStateClasses()` に集約した。
  - HTML側ボタンの状態class文字列も `_createLayerPanelStateClassNames()` / `_createLayerPanelClassName()` 経由に寄せ、DOM/HTMLで状態class組み立て方針を揃えた。
  - CAFヘッダーの選択/開閉/非表示class組み立ても同じclassヘルパー経由へ寄せ、ヘッダーとカードで状態classの作り方を揃えた。
  - CAFヘッダー内の名前/レーンspanとasset行生成を `_createLayerPanelElementHtml()` 経由の小ヘルパーへ寄せ、手書きHTMLとdata属性エスケープの散在を減らした。
  - CAFヘッダーのグループ外枠/タイトル生成も `_createCafHeaderGroupHtml()` / `_createCafHeaderGroupTitleHtml()` へ分離し、開始タグ/終了タグの手書き範囲を減らした。
  - CAFヘッダーの開閉/可視ボタン生成を `_createCafHeaderToggleButtonHtml()` / `_createCafHeaderVisibilityButtonHtml()` へ分離し、ヘッダー組み立て側からボタン細部を外した。
  - CAF内部カードのクリップ/可視ボタン生成を `_createLayerPanelCardClipButtonHtml()` / `_createLayerPanelCardVisibilityButtonHtml()` へ分離し、カードHTML本体からアクションボタン細部を外した。
  - CAF内部カードのサムネイル/詳細HTML生成を `_createLayerPanelCardThumbnailHtml()` / `_createLayerPanelCardDetailsHtml()` へ分離し、カードHTML本体から部品細部を外した。
  - ClipAsset内部レイヤーからCAF内部カードoptionsを作る処理を `_createClipLayerMirrorCardOptions()` へ分離し、ループ側をカード生成呼び出しに集中させた。
  - 旧Layer/Folderカードのrow model生成を `_createLegacyLayerCardRowModel()` へ分離し、旧カードshell側も共通row model生成とDOM生成を分けた。
  - カードD&Dのdrop payload生成を `_createLayerPanelCardDropPayload()` へ分離し、旧カード/CAF内部カードのdrop入力形を揃えた。
  - 挙動は変更せず、CAF内部カードと旧カードのselector散在を減らし、カード種別ごとの共通化入口を広げた。
  - 既知差分: 旧Layer/FolderカードD&Dは、外部レイヤーをフォルダ配下の既存子レイヤー間へ直接挿入できず、フォルダ本体へのdropでしか収納できない。CAF内部カードD&Dでは子レイヤー間への挿入が可能。統合時にCAF側の挙動へ寄せる対象。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードvariant設定の共通化**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードとCAF内部カードの `variant` 名、row selector、D&Dゴーストclassを `_getLayerPanelCardVariantConfig()` へ集約。
  - `_getClipLayerMirrorCardDragOptions()` / `_getLegacyLayerCardDragOptions()` / `_createLayerPanelCardHtml()` / `_createLayerPanelCardDragState()` が同じvariant設定入口を使うように整理。
  - 挙動は変更せず、カード種別ごとのselector/ghost classが複数箇所に散る状態を減らした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードdata属性生成の共通map化**:
  - `layer-panel-renderer.js`: DOM適用用 `_applyLayerPanelCardDataset()` とHTML生成用 `_createLayerPanelCardDataAttributes()` が別々に持っていたdata属性定義を `_createLayerPanelCardDataAttributeMap()` へ集約。
  - `data-card-kind` / `data-asset-id` / `data-layer-id` / `data-internal-layer-id` / `data-layer-index` / `data-depth` / `data-is-folder` / `data-is-background` の定義元を一本化。
  - 挙動は変更せず、通常カードDOM生成とCAF内部カードHTML生成でdata属性の更新漏れが起きにくい形にした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: 旧カード状態CSSの共通class対応**:
  - `styles/main.css`: 旧 `layer-item.active` / `layer-item.selected` の表示指定に、共通状態class `is-active` / `is-selected` を併記。
  - `layer-panel-renderer.js`: 未使用だった `_applyActiveLayerState()` を削除。旧active表示をインラインstyleで上書きする古い経路を除き、row model / CSS変数経由の状態表示へ寄せた。
  - 旧 `active` / `selected` classは互換のため維持しつつ、共通classでも同じ見た目になるよう整理。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードactive状態classの共通化**:
  - `layer-panel-renderer.js`: カードrow modelの `classOptions` に `isActive` を追加し、共通class `is-active` を付与できるようにした。旧Layer/Folderカードの既存 `active` classは互換のため維持。
  - `styles/main.css`: `.layer-panel-card-row.is-active` を追加し、`--card-row-active-*` 変数経由でactive表示を制御できるようにした。
  - 旧カード側には `--card-row-active-border-color` / `--card-row-active-border-width` / `--card-row-active-bg` を明示し、既存見た目を維持しながら共通状態classへ寄せた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カード子線生成の共通ヘルパー化**:
  - `layer-panel-renderer.js`: レイヤー/フォルダ階層の子線DOM生成を `_createLayerPanelCardChildLineElement()`、CAF内部カードHTML側の子線生成を `_createLayerPanelCardChildLineHtml()` へ分離。
  - 旧Layer/FolderカードのDOM生成とCAF内部カードのHTML生成で、子線も同じカード部品単位として追えるようにした。
  - 挙動は変更せず、カード表示部品の共通化をさらに細かい単位まで揃えた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: CAF内部カードHTML部品生成の追加分離**:
  - `layer-panel-renderer.js`: CAF内部カードHTML生成内のサムネイルstyle生成を `_createLayerPanelCardThumbnailStyleAttributes()` へ分離。
  - CAF内部カードのクリップ/可視ボタンHTML生成を `_createLayerPanelCardActionButtonHtml()` へ分離し、アクションclass生成を共通入口へ寄せた。
  - 挙動は変更せず、HTML生成側でもDOM生成側と同じカード部品単位で追えるようにした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: 旧カードinteractive判定の共通化**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードのD&D除外対象とclick選択除外対象に分散していたselector文字列を `_getLegacyLayerCardInteractiveSelector()` / `_isLegacyLayerCardInteractiveTarget()` へ集約。
  - カードD&D開始時のネイティブ操作要素判定を `_isLayerPanelCardNativeInteractiveTarget()` へ分離し、`_startLayerPanelCardDrag()` 側の判定を薄くした。
  - 挙動は変更せず、ボタン・input・opacityなどのinteractive領域をカード共通化の後続で追いやすい形にした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: 旧Layer/Folderカードアクション実行入口の分離**:
  - `layer-panel-renderer.js`: 旧カードのクリッピングON/OFF、可視ON/OFF、削除、複製、下結合、背景色変更を、それぞれ `_toggleLegacyLayerClippingFromClick()` / `_toggleLegacyLayerVisibilityFromClick()` / `_deleteLegacyLayerFromClick()` / `_duplicateLegacyLayerFromClick()` / `_mergeLegacyLayerDownFromClick()` / `_changeBackgroundLayerColorFromClick()` へ分離。
  - ボタン生成側はDOM生成とclickから専用入口を呼ぶだけに寄せ、CAFカードアクション側と同じ粒度で操作実行を追える形にした。
  - 挙動は変更せず、旧カード側の操作経路をCAFカード基準の統合に持ち込みやすくした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: CAFカードアクション入口の分離**:
  - `layer-panel-renderer.js`: CAF内部カードの可視ON/OFF、クリッピングON/OFF、CAFヘッダー可視ON/OFFを `_toggleClipLayerMirrorVisibilityFromClick()` / `_toggleClipLayerMirrorClippingFromClick()` / `_toggleCafHeaderVisibilityFromClick()` へ分離。
  - CAFヘッダーの開閉とCAFアセット選択を `_toggleCafHeaderExpandedFromClick()` / `_selectCafAssetFromClick()` へ分離し、click委譲側は対象判定と専用入口呼び出しだけに整理。
  - 挙動は変更せず、カード内アクション処理を旧Layer/Folderカードのボタン処理と同じ粒度で追える形にした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: CAF/内部カード名前編集入口の分離**:
  - `layer-panel-renderer.js`: CAFヘッダー名、CAF Lane名、CAF内部レイヤー/フォルダ名のダブルクリック編集入口を、それぞれ `_editCafHeaderNameFromClick()` / `_editCafHeaderLaneNameFromClick()` / `_editClipLayerMirrorNameFromClick()` へ分離。
  - CAF内部レイヤー名の実編集処理を `_editClipLayerMirrorName()` へまとめ、ダブルクリックとF2キーの両方から同じ rename 経路を使うようにした。
  - `source` は呼び出し元ごとに渡し、履歴・同期側の識別は維持。挙動は変更せず、名前編集経路をカード共通化の次段階で追いやすくした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードクリック抑制/CAF内部行クリックの分離**:
  - `layer-panel-renderer.js`: D&D直後クリック抑制の重複判定を `_consumeLayerPanelCardSuppressedClick()` へ分離し、CAF委譲clickと旧Layer/Folderカードclickで同じ入口を使うよう整理。
  - CAF内部カード行の選択/フォルダ開閉処理を `_handleClipLayerMirrorRowClick()` へ分離し、委譲click側は対象振り分けだけに寄せた。
  - 挙動は変更せず、カードD&D後のクリック抑制とCAF内部カード選択処理を、旧カード統合に向けて追いやすい単位にした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードD&D開始確定/drop実行の分離**:
  - `layer-panel-renderer.js`: pointermove内のドラッグ開始確定処理を `_activateLayerPanelCardDrag()` へ分離し、`active` 化、`is-dragging` 付与、ゴースト生成を共通入口にまとめた。
  - pointerup内の `drag.onDrop()` 直接呼び出しを `_applyLayerPanelCardDrop()` へ分離し、旧Layer/FolderカードとCAF内部カードのdrop実行入口を同じ形に揃えた。
  - 挙動は変更せず、カードD&Dのpointermove/upは状態遷移とヘルパー呼び出しに寄せた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: CAF内部カードD&D drop実行の分離**:
  - `layer-panel-renderer.js`: CAF内部カードの `onDrop` に直書きされていた `moveInternalLayerToPosition()` 呼び出しを `_applyClipLayerMirrorCardDropFromPointer()` へ分離。
  - 旧Layer/Folderカードの `_applyLegacyLayerCardDropFromPointer()` と並ぶ実行メソッドにし、D&D設定オブジェクト側はdrop実行入口を呼ぶだけに整理。
  - 挙動は変更せず、旧カード/CAFカードそれぞれのdrop実行責務を同じ粒度に揃えた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードD&Dゴースト生成/位置更新の分離**:
  - `layer-panel-renderer.js`: pointermove内に直書きされていたD&Dゴースト生成を `_createLayerPanelCardDragGhost()`、追従位置更新を `_positionLayerPanelCardDragGhost()` へ分離。
  - 旧Layer/FolderカードとCAF内部カードで、ゴースト生成、幅固定、body追加、追従transformを同じ入口で扱えるようにした。
  - 挙動は変更せず、今後のゴースト追従性や見た目調整を共通ヘルパー側へ集約しやすくした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードD&Dドロップ判定の分離**:
  - `layer-panel-renderer.js`: `_updateLayerPanelCardDropTarget()` 内に直書きされていた drop target / placement 判定を `_resolveLayerPanelCardDropTarget()` へ分離。
  - `elementFromPoint()`、row selector、container内判定、inside/before/after の比率判定を、旧Layer/FolderカードとCAF内部カードで共有するドロップ解決処理として扱えるようにした。
  - 挙動は変更せず、D&D表示class付与と `_cardDrag` 状態更新は既存の `_updateLayerPanelCardDropTarget()` 側に残した。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードD&D状態モデル生成の分離**:
  - `layer-panel-renderer.js`: `_startLayerPanelCardDrag()` 内に直書きされていた `_cardDrag` オブジェクト生成を `_createLayerPanelCardDragState()` へ分離。
  - pointerId、対象row、D&D種別、selector、ghost class、drop callback、asset/layer id、開始座標、offset、target/placementなどを、旧Layer/FolderカードとCAF内部カードで同じドラッグ状態モデルとして扱う入口にした。
  - 挙動は変更せず、今後のD&D判定やゴースト/ドロップ表現の調整を共通モデル側へ集めやすくした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5進行: カードD&D設定の分離**:
  - `layer-panel-renderer.js`: CAF内部カードD&D設定を `_getClipLayerMirrorCardDragOptions()`、旧Layer/FolderカードD&D設定を `_getLegacyLayerCardDragOptions()` へ分離。
  - `_handleClipLayerMirrorPointerDown()` / `_handleLegacyLayerCardPointerDown()` は、カード種別ごとのD&D設定を `_startLayerPanelCardDrag()` へ渡すだけの入口に整理。
  - 挙動は変更せず、選択、skipDrag、inside判定、drop処理を設定オブジェクトとして見通せる形にし、旧パネル操作経路をCAFカード基準へ寄せる次段階の下地を作った。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task5開始: カードD&D共通ハンドラ名の整理**:
  - `layer-panel-renderer.js`: 旧 `ClipLayerMirror` 名が残っていた共通D&Dの pointermove / pointerup ハンドラを `_handleLayerPanelCardPointerMove()` / `_handleLayerPanelCardPointerUp()` へ改名。
  - 旧Layer/FolderカードとCAF内部カードのD&Dは、すでに `_startLayerPanelCardDrag()` を通る共通経路になっているため、処理名もカード共通基準へ揃えた。
  - 挙動は変更せず、今後の旧レイヤーパネル操作経路統合で、CAF専用処理と誤読しにくい構造にした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4完了: 通常レイヤーパネル表示のCAFカード基準化**:
  - `layer-panel-renderer.js` / `styles/main.css`: 通常Layer/FolderカードとCAF内部カードについて、行コンテナ、部品生成、サムネイル、名前/メタ、アクション、状態表示、階層線、フォルダサムネイル、名前編集input、カードリスト/空状態、カードグループ外枠を `layer-panel-card-*` 系の共通入口へ整理済み。
  - 残存確認: `legacy-layer-card-*` / `clip-layer-mirror-*` は、イベント参照、D&D対象判定、既存互換、旧パネル固有配置、CAFミラー固有余白として残す。現段階で無理に削るとクリック/名前変更/D&Dの判定面を壊す可能性が高いため、Task4範囲では維持。
  - 判断: 通常パネルとCAF内部カードの表示責務は同じカードロールで扱える状態になったため、Task4は完了扱い。次はTask5として、旧レイヤーパネル側の操作経路をCAFカード基準のD&D/選択/編集経路へさらに寄せる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` は直近Task4実装で成功済み。今回の完了追記はドキュメント更新のみ。
- **Task4進行: カードグループ外枠classの共通化**:
  - `layer-panel-renderer.js`: CAF内部カード群の外枠に `layer-panel-card-group` を追加し、既存 `clip-layer-mirror` は互換classとして維持。
  - `styles/main.css`: 透明背景、文字色、縦flex、pointer-eventsなどの外枠基本指定を `layer-panel-card-group` へ移し、CAFミラー固有CSSには余白と境界差分だけを残した。
  - 狙い: カード行・カードリスト・空状態に続き、カード群の外枠も共通ロールで扱えるようにし、Task4の通常パネル統合準備を締める。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カードリスト/空状態classの共通化**:
  - `layer-panel-renderer.js`: CAF内部カードリストに `layer-panel-card-list`、空状態に `layer-panel-card-empty` を追加し、既存 `clip-layer-mirror-list` / `clip-layer-mirror-empty` は互換classとして維持。
  - `styles/main.css`: カードリストのflex方向と空状態の基本表示を共通classへ移し、CAFミラー固有CSSには余白差分だけを残した。
  - 狙い: カード行だけでなく、カード群の入れ物と空状態も共通ロールで扱えるようにし、通常パネル統合時の表示部品を揃える。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カード内名前編集inputの共通CSS化**:
  - `styles/main.css`: カード内の名前編集inputの幅/高さ指定を `layer-panel-inline-name-input.layer-panel-card-name` へ移し、CAF内部カード専用の `.clip-layer-mirror-name` input指定を削除。
  - 旧カード側は `legacy-layer-card-name` にグリッド配置だけを残し、サイズ指定は共通カード名inputへ寄せた。
  - 狙い: 通常カード/CAFカードのその場名前編集UIも、カード共通ロールclassを入口に扱えるようにする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カードアクション状態CSSの共通化**:
  - `styles/main.css`: クリップON / 非表示状態の見た目を `layer-panel-card-action.is-clipping` / `.is-hidden` へ移し、CAF内部カード固有の `.clip-layer-mirror-clip-btn.is-clipping` / `.clip-layer-mirror-visibility-btn.is-hidden` を削除。
  - CAF内部カードは `--card-action-hidden-opacity` / `--card-action-active-bg` / `--card-action-active-border-color` で従来の見た目を維持し、旧カード側は透明フォールバックで既存の軽い表示を保つようにした。
  - 狙い: 通常カード/CAFカードでアクションボタン状態のCSS入口を揃え、表示・クリップ操作の見た目調整を一箇所に寄せる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: フォルダサムネイル状態classの共通化**:
  - `layer-panel-renderer.js`: 通常フォルダサムネイルとCAF内部フォルダサムネイルに `layer-panel-card-thumb--folder` を付与し、開閉状態も `is-expanded` / `is-collapsed` として揃えた。
  - `styles/main.css`: フォルダサムネイルの枠、背景、SVGサイズの基本指定を `layer-panel-card-thumb--folder` 側へ移し、旧 `folder-thumbnail` / `clip-layer-mirror-thumb` は互換・差分用途として維持。
  - 狙い: 通常パネルとCAF内部カードでフォルダ表示の役割classを共通化し、後続のカード表示統合時にフォルダ見た目の二重管理を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カード状態表示CSSの共通化**:
  - `styles/main.css`: hover / selected / hidden の表示を `layer-panel-card-row` 共通セレクタへ移し、通常カード/CAF内部カードはCSS変数で色や透明度だけを差し替える形に整理。
  - CAF内部カード側に残っていた `clip-layer-mirror-row:hover` / `.is-selected` / `.is-hidden` の個別状態CSSを削除し、通常カードも同じ状態入口を通るようにした。
  - 旧カード側は既存の背景色・選択枠・透明度を変数で維持し、通常パネル表示の見え方を不用意に変えないようにした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カード階層線の共通class化**:
  - `layer-panel-renderer.js`: 通常カードとCAF内部カードの子階層ラインに `layer-panel-card-child-line` を追加し、既存 `folder-child-line` は互換classとして維持。
  - `styles/main.css`: 階層線の位置/サイズを `layer-panel-card-child-line` へ移し、旧カード/CAFカード個別CSSには左右位置と色だけを残した。
  - 狙い: 階層表現もカード共通部品として扱い、通常パネル/CAFカードの見た目差分をさらに小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カード行レイアウト/状態表示の共通化**:
  - `layer-panel-renderer.js`: 旧Layer/Folderカード行に `--card-row-width` / `--card-row-margin-left` / `--card-row-bg` / `--card-row-border-*` を出すよう変更。旧 `--legacy-card-*` は互換フォールバックとして維持。
  - `styles/main.css`: グリッド、余白、角丸、touch-action、transitionなどの行基本レイアウトを `layer-panel-card-row` へ移し、旧カード/CAFカード固有CSSには幅・色・カーソルなどの差分だけ残す形へ整理。
  - D&D中/挿入位置/inside表示も `layer-panel-card-row.is-*` へ寄せ、`clip-layer-mirror-row` / `legacy-layer-card-row` の個別列挙を削減。
  - 狙い: 通常カードとCAFカードの行コンテナ設計を同じCSS入口に寄せ、後続の通常パネル表示差し替えで見た目とD&D表示の二重管理を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カードアクションボタンclass生成/CSSの共通化**:
  - `layer-panel-renderer.js`: `_getLayerPanelCardActionClassNames()` / `_applyLayerPanelCardActionClasses()` を追加し、通常カードDOM側とCAFカードHTML側のアクションclass生成を同じ入口へ整理。
  - 通常カードのクリップ/表示ボタン、CAF内部カードのクリップ/表示ボタンが、共通 `layer-panel-card-action` / `layer-panel-card-action--*` を持つ形に統一。
  - `styles/main.css`: アクションボタンの基本サイズ、旧カード側の小型サイズ、SVGサイズを共通class指定へ移し、個別class列挙を削減。
  - 既存の `layer-visibility` / `layer-background-color-button` / `clip-layer-mirror-*` classはイベント参照と互換のため維持。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: サムネイル表示class/サイズ変数の共通化**:
  - `layer-panel-renderer.js`: 通常レイヤーサムネイル画像にも `layer-panel-card-thumb-image` を付与し、非同期 `thumbnail:updated` で追加される画像にも同classを補完。
  - `_createLayerThumbnailContainer()` で `--card-thumb-width` / `--card-thumb-height` も出すよう変更し、旧 `--legacy-thumb-*` は互換フォールバックとして維持。
  - `styles/main.css`: サムネイル画像の `max-width` / `max-height` / `object-fit` を `layer-panel-card-thumb-image` へ移し、通常カード側の幅/高さも `--card-thumb-*` を主に参照するよう変更。
  - 狙い: 通常カードとCAFカードでサムネイル画像・サイズ指定の基礎class/変数を揃え、旧カード専用CSS依存を段階的に減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4進行: カード名/メタ/部品生成入口の共通化**:
  - `layer-panel-renderer.js`: DOM側に `_createLayerPanelCardPartElement()`、HTML側に `_createLayerPanelCardPartHtml()` / `_createLayerPanelCardTextPartHtml()` を追加。
  - 旧Layer/Folderカードの詳細欄生成と、CAF内部カードのサムネイル/詳細欄/名前/メタ生成を同じカード部品ロール経由へ寄せた。
  - `styles/main.css`: 名前表示の基本指定を `layer-panel-card-name`、メタ表示の基本指定を `layer-panel-card-meta` へ移し、`legacy-layer-card-name` / `clip-layer-mirror-name` / `clip-layer-mirror-opacity` 側の重複を削減。
  - 狙い: 通常パネルとCAFカードで、表示部品の生成粒度とCSS責務をさらに揃え、後続の旧カード表示差し替えを小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task4開始: 通常レイヤーパネル表示のCAFカード基準化**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードとCAF内部カードのサムネイル、詳細欄、名前、アクションボタンに `layer-panel-card-*` の共通ロールclassを付与。
  - `styles/main.css`: サムネイル/詳細欄/アクション配置の共通レイアウトを `layer-panel-card-*` へ移し、旧カード/CAFカード個別CSSの重複指定を削減。
  - 既存の `legacy-layer-card-*` / `clip-layer-mirror-*` class は維持しているため、クリック、D&D、名前変更、既存CSS参照はそのまま残している。
  - 狙い: 通常レイヤーパネル側をCAFカード基準UIへ段階的に寄せるため、まず表示部品の責務名とCSS入口を共通化した。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3完了: レイヤーパネル/CAFカード共通化準備の区切り**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードとCAF内部Layerカードについて、行モデル、行DOM/HTML生成、ボタン生成、名前/メタspan、サムネイルコンテナ/画像、カード内要素生成、Pointer D&D入口を共通ヘルパー寄りに整理済み。
  - 残存確認: `SortableJS` 依存は旧カードD&Dから撤去済み。カード統合対象外の属性ポップアップ、CAF簡易ヘッダー、インライン編集input等には直書きDOM/HTMLが残るが、Task3範囲外として保留。
  - 判断: 旧パネルカードとCAFカードの生成・D&D経路を同じ設計単位で扱える下地ができたため、Task3は完了扱い。次はTask4として、実際の通常レイヤーパネル表示をCAFカード基準へ寄せる統合切替に進む。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFミラーラッパーHTML生成の共通化**:
  - `layer-panel-renderer.js`: `_createClipAssetLayerMirrorHtml()` の `clip-layer-mirror` / `clip-layer-mirror-list` / 空状態 `clip-layer-mirror-empty` の直書きHTMLを `_createLayerPanelElementHtml()` 経由へ変更。
  - CAF内部カード行だけでなく、CAFミラー全体のラッパーも同じHTML要素生成入口を通すよう整理。
  - 狙い: CAF側HTMLで残っていた直書きdivを減らし、旧カードDOM/CAFカードHTMLの共通部品生成に寄せる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFサムネイル画像HTML生成の共通化**:
  - `layer-panel-renderer.js`: CAF内部Layerカードのサムネイル画像 `<img>` 直書きを `_createLayerThumbnailImageHtml()` へ分離。
  - 旧カードDOM側の `_createLayerThumbnailImage()` と対応するHTML側入口を追加し、`src` / `alt` / `class` は `_createLayerPanelDataAttributes()` 経由で属性化するよう整理。
  - 狙い: サムネイル周辺のDOM/HTML生成入口を揃え、旧パネル/CAFカード統合前の片側直書きを減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードサムネイルコンテナ生成の共通化**:
  - `layer-panel-renderer.js`: `_createLayerThumbnailContainer()` の `document.createElement('div')` / `className` / `dataset` / style変数適用を `_createLayerPanelCardPart()` 経由へ変更。
  - `data-layer-index` と `--legacy-thumb-*` を生成時の `attributes` / `styleVars` として渡す形にし、CAFカードHTMLサムネイル生成と対応しやすい入口へ寄せた。
  - 狙い: 旧カード側に残る直書きDOM生成を減らし、サムネイル周辺も共通カード部品生成の範囲へ入れる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: DOMカード部品の属性/style入口追加**:
  - `layer-panel-renderer.js`: `_createLayerPanelCardPart()` に `attributes` / `styleVars` を受け取る第三引数を追加し、DOM側カード部品も生成時に属性とCSS変数を適用できる形へ整理。
  - `_createLayerPanelTextSpanElement()` の `title` 適用と、旧Layerカードの `folder-child-line` の `aria-hidden` 付与を同入口経由へ変更。
  - 狙い: CAFカードHTML側の `_createLayerPanelElementHtml()` と旧カードDOM側の `_createLayerPanelCardPart()` の引数粒度を近づけ、カード内パーツ統合の下地を作る。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードShellの重複class/data付与整理**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードShellで、行モデル生成後に重複していた `active` / `background-layer` / `data-is-folder` の後付け処理を削除。
  - 旧CSS互換の `selected` class は `extraClasses` に含める形へ移し、`is-selected` と `selected` の両方が従来通り残るよう維持。
  - 狙い: 旧カードDOM行の状態表現を `_createLayerPanelCardRowModel()` の入力へ集約し、Shell本体の個別補正を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: カード行style生成モデルの共通化**:
  - `layer-panel-renderer.js`: `_createLayerPanelCardRowModel()` に `styleVars` / `styleAttributes` を追加し、カード行のstyle変数もclass/dataと同じモデルで扱えるよう整理。
  - 旧Layer/FolderカードShellの幅、インデント、背景色、枠線style適用をShell本体から外し、`_createLayerPanelCardRowElement()` 側でモデルの `styleVars` を適用する形へ変更。
  - CAFカードHTML側の `_createLayerPanelCardRowHtml()` も `styleAttributes` を受け取れるようにし、DOM/HTML双方で行styleの入口を揃えた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードDOM行生成のモデル経由化**:
  - `layer-panel-renderer.js`: `_createLayerPanelCardRowElement()` を追加し、旧Layer/FolderカードShellのDOM行生成を `_createLayerPanelCardRowModel()` から作る形へ変更。
  - `document.createElement('div')` 直呼びとdata属性適用をShell本体から外し、DOM側も「行モデル → 行要素」の入口を持つよう整理。
  - 狙い: CAFカードHTML側の `_createLayerPanelCardRowHtml()` と旧カードDOM側の行生成責務を対応させ、カード統合時の分岐を小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: カード行class/data生成モデルの共通化**:
  - `layer-panel-renderer.js`: `_createLayerPanelCardRowModel()` を追加し、カード行のclass名とdata属性入力を同じモデルで組み立てるよう整理。
  - 旧Layer/FolderカードShellとCAF内部LayerカードHTMLの双方で同モデルを使い、DOM側は `dataOptions`、HTML側は `dataAttributes` を使う形にした。
  - 狙い: 旧カードDOMとCAFカードHTMLで分かれていた行コンテナのclass/data生成経路を揃え、カード統合時の重複をさらに減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFカード行HTML生成の共通化**:
  - `layer-panel-renderer.js`: CAF内部Layerカードの行コンテナ生成を `_createLayerPanelCardRowHtml()` に分離し、`_createLayerPanelElementHtml()` 経由で `div` / class / data属性 / 子要素HTMLを組み立てる形へ変更。
  - 既存の `_getLayerPanelCardClassNames()` / `_createLayerPanelCardDataAttributes()` の結果は維持し、CAFカード行の直書きHTMLだけを減らした。
  - 狙い: 旧カードDOM側の `_createLegacyLayerCardShell()` に対応するHTML側の行生成入口を用意し、カード統合時に行コンテナ生成の差分を追いやすくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードDOMテキストspan生成の共通化**:
  - `layer-panel-renderer.js`: DOM側に `_createLayerPanelTextSpanElement()` を追加し、旧カードのメタ表示/名前表示を同ヘルパー経由へ変更。
  - `_createLayerPanelMetaElement()` / `_createLayerPanelNameElement()` は表示内容とclassを整えて同テキストspanヘルパーへ委譲する形に整理。
  - 狙い: CAFカードHTML側の `_createLayerPanelTextSpanHtml()` と旧カードDOM側の生成粒度を揃え、カード統合時のテキスト部品差分を小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードDOM部品生成のタグ解決共通化**:
  - `layer-panel-renderer.js`: `_createLayerPanelCardPart()` 内で `_resolveLayerPanelTagName()` を使うよう変更し、DOM側部品生成もHTML側と同じタグ検証入口へ寄せた。
  - `_createLayerPanelMetaElement()` / `_createLayerPanelNameElement()` は `document.createElement('span')` 直呼びをやめ、共通DOM部品ヘルパー経由に整理。
  - 狙い: CAFカードHTML部品と旧カードDOM部品の生成入口をさらに近づけ、今後のカード統合で直書きDOM生成の残りを減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルHTMLタグ解決の汎用化**:
  - `layer-panel-renderer.js`: `_resolveLayerPanelButtonTagName()` を `_resolveLayerPanelTagName()` に改名し、ボタン生成モデルと汎用HTML部品生成の双方から使う形へ整理。
  - 挙動は維持しつつ、ボタン以外の `span` / `div` 生成にも同じタグ検証入口を使う命名へ寄せた。
  - 狙い: CAFカードHTML部品と旧カードDOM部品の共通化を進める前提として、HTML側の基礎ヘルパー名を用途に合わせる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFカードHTML部品要素生成の共通化**:
  - `layer-panel-renderer.js`: CAF内部LayerカードHTMLの子ライン、サムネイル、詳細欄、テキストspan生成を `_createLayerPanelElementHtml()` 経由へ変更。
  - `_createLayerPanelTextSpanHtml()` も同ヘルパーを使うよう整理し、HTML側のspan生成入口を統一。
  - 狙い: 旧カードDOM側の `_createLayerPanelCardPart()` と対応するHTML側の部品生成入口を用意し、CAFカード/旧カード統合時の直書きHTMLを減らす。
    - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFカードHTMLテキストspan生成の共通化**:
  - `layer-panel-renderer.js`: CAF内部LayerカードHTMLの名前/メタ表示span生成を `_createLayerPanelTextSpanHtml()` へ集約。
  - `clip-layer-mirror-name` / `clip-layer-mirror-opacity` のclassと表示内容は維持し、名前編集やCSSの既存参照を変更していない。
  - 狙い: 旧カードDOM側の名前/メタ生成ヘルパーと同じ粒度で、CAFカードHTML側のテキスト部品生成を整理する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルボタン生成モデルの共通化**:
  - `layer-panel-renderer.js`: DOM側/HTML側ボタン生成の前処理を `_createLayerPanelButtonModel()` に集約し、tag名、class、icon HTML、属性オブジェクトを同じ経路で作るよう変更。
  - `_createLayerPanelIconButton()` はモデルからDOM要素を作り、`_createLayerPanelIconButtonHtml()` は同じモデルからHTML文字列を作る形に整理。
  - 狙い: 旧カード/CAFカードのボタン生成差分を「DOM化するかHTML化するか」だけに近づけ、後続のカード統合時の重複を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルボタンtag/type判定の共通化**:
  - `layer-panel-renderer.js`: DOM側/HTML側ボタン生成で分かれていたtag名の安全化とbutton判定を `_resolveLayerPanelButtonTagName()` / `_isLayerPanelButtonTag()` へ集約。
  - DOM側 `_createLayerPanelIconButton()` は解決済みtag名で要素を作成し、button時の `type="button"` 付与も共通判定を使うよう変更。
  - 狙い: DOM/HTMLのボタン生成ヘルパーで残っていたtag処理差分を減らし、CAFカード/旧カード統合時の調整箇所を小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルボタン属性合成の共通化**:
  - `layer-panel-renderer.js`: DOM側/HTML側ボタン生成で重複していた `dataAttributes` / `extraAttributes` / `title` / `aria-label` の合成を `_createLayerPanelButtonAttributes()` へ集約。
  - `_createLayerPanelIconButton()` は `_applyLayerPanelAttributes()` へ、`_createLayerPanelIconButtonHtml()` は `_createLayerPanelDataAttributes()` へ同じ属性オブジェクトを渡す形に整理。
  - 狙い: 旧カード/CAFカードのボタン生成ヘルパー統合に向けて、属性処理の分岐差をさらに小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルボタンtitle属性処理の共通化**:
  - `layer-panel-renderer.js`: DOM側 `_createLayerPanelIconButton()` の `title` 設定を `_applyLayerPanelAttributes()` 経由へ変更。
  - HTML側 `_createLayerPanelIconButtonHtml()` も `title` を `_createLayerPanelDataAttributes()` 経由で出力するよう変更し、ボタン属性処理の入口を揃えた。
  - 狙い: DOM/HTMLのボタン生成ヘルパーで残っていた属性処理差分を減らし、CAFカード/旧カード統合時の調整箇所を小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: HTML側ボタン生成ヘルパーのtagName対応**:
  - `layer-panel-renderer.js`: HTML側 `_createLayerPanelIconButtonHtml()` に `tagName` を追加し、DOM側 `_createLayerPanelIconButton()` と引数形をさらに揃えた。
  - 既定は従来通り `button` とし、button出力時は `type="button"` を明示するよう変更。
  - 狙い: CAFカード/旧カードのボタン生成ヘルパーを後続で畳み込みやすくするため、DOM側とHTML側の差分を小さくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルボタンclass生成の共通化**:
  - `layer-panel-renderer.js`: DOM側 `_createLayerPanelIconButton()` とHTML側 `_createLayerPanelIconButtonHtml()` のclass文字列生成を `_createLayerPanelButtonClassName()` へ集約。
  - 既定の `ui-icon-button ui-icon-button--small` とCAF専用 `caf-simple-icon` の使い分けは維持し、見た目とイベント対象classは変更していない。
  - 狙い: 旧カード/CAFカードのボタン生成ヘルパー統合に向けて、class組み立ての重複を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: DOM側ボタン属性適用の共通化**:
  - `layer-panel-renderer.js`: DOM要素へ任意属性を適用する `_applyLayerPanelAttributes()` を追加し、DOM側 `_createLayerPanelIconButton()` から使用するよう変更。
  - `_createLayerPanelIconButton()` に `dataAttributes` / `extraAttributes` を追加し、HTML側 `_createLayerPanelIconButtonHtml()` と同じ属性指定の形に近づけた。
  - 既存の削除/複製/下結合/可視/クリッピング等のボタン呼び出しはそのまま動くよう既定値を維持。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルアイコンHTML解決の共通化**:
  - `layer-panel-renderer.js`: DOM側 `_createLayerPanelIconButton()` とHTML側 `_createLayerPanelIconButtonHtml()` のアイコンHTML取得を `_resolveLayerPanelIconHtml()` へ集約。
  - HTML側で使っていた `fallbackIconName` をDOM側ヘルパーにも受け口として追加し、ボタン生成ヘルパー同士の引数差を縮めた。
  - 狙い: CAFカード/旧カードの小型アイコンボタン統合に向けて、アイコン解決の重複と分岐差を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFヘッダートグルボタンHTML生成の共通化**:
  - `layer-panel-renderer.js`: CAFヘッダーの開閉トグルボタンを `_createLayerPanelIconButtonHtml()` 経由へ変更し、HTML直書きのbutton生成を削減。
  - `_createLayerPanelIconButtonHtml()` に `baseClass` / `ariaLabel` / `extraAttributes` を追加し、既定の `ui-icon-button` 系ボタンとCAF専用 `caf-simple-icon` ボタンを同じ入口で生成できるようにした。
  - `caf-simple-toggle-btn`、`data-clip-id`、`aria-expanded` は維持し、クリック委譲と開閉挙動の契約は変更していない。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネルHTML data属性生成の共通化**:
  - `layer-panel-renderer.js`: HTML文字列側の `data-*` 属性生成を `_createLayerPanelDataAttributes()` へ集約し、CAFカード本体と小型アイコンボタンの属性文字列化を同じ入口へ寄せた。
  - `_createLayerPanelCardDataAttributes()` はカード用の属性選定に専念し、エスケープと空値除外は共通ヘルパー側へ移した。
  - 狙い: CAFカードHTMLと旧カードDOMの統合前に、HTML側で残っていた属性組み立ての重複を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFヘッダー可視ボタンHTML生成の共通化**:
  - `layer-panel-renderer.js`: CAFヘッダーの表示/非表示ボタンを `_createLayerPanelIconButtonHtml()` 経由へ変更し、CAF内部Layerミラーの操作ボタンと同じHTML生成経路へ寄せた。
  - `caf-simple-visibility-btn` と `data-clip-id` は維持し、クリック委譲と可視切替の契約は変更していない。
  - 狙い: CAFヘッダー/CAF内部カード/旧カードで分散していた小型アイコンボタン生成を段階的に同じ設計へ寄せる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAF内部カード操作ボタンHTML生成の共通化**:
  - `layer-panel-renderer.js`: CAF内部Layerミラーのクリッピング/可視ボタンHTMLを `_createLayerPanelIconButtonHtml()` 経由へ変更。
  - event delegationで使う `.clip-layer-mirror-clip-btn` / `.clip-layer-mirror-visibility-btn` と `data-internal-layer-id` / `data-asset-id` は維持し、挙動変更を避けた。
  - 狙い: 旧カード側の `_createLayerPanelIconButton()` とCAF内部カードHTMLのボタン生成を同じ設計へ寄せ、カード統合時の重複マークアップを減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードサムネイルDOM生成の共通化**:
  - `layer-panel-renderer.js`: 通常Layer/Folderサムネイルのコンテナ生成を `_createLayerThumbnailContainer()` へ集約し、`--legacy-thumb-*` の適用入口を一箇所に整理。
  - `thumbnail:updated` と初回サムネイル表示で使う画像生成を `_createLayerThumbnailImage()` へ集約し、`layer-thumbnail-image` class付与を統一。
  - 狙い: CAFカード側のサムネイルCSS変数経路に合わせ、通常レイヤーパネル側もサムネイルDOM生成と画像class付与の重複を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カード部品コンテナ生成の共通化**:
  - `layer-panel-renderer.js`: 旧カードの詳細欄コンテナ、透明度/合成モード表示コンテナ、子階層ラインを `_createLayerPanelCardPart()` 経由へ変更。
  - 表示classとDOM配置は維持し、通常Layer/Folderカード内の小部品生成入口だけを整理。
  - 狙い: 旧カードShell、名前、メタ表示、操作ボタンに続き、カード内部コンテナも共通生成経路へ寄せ、CAFカードとの部品統合時に残る個別DOM生成を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードメタ表示span生成の共通化**:
  - `layer-panel-renderer.js`: 旧Layerカードの透明度表示と合成モード表示を `_createLayerPanelMetaElement()` 経由へ変更し、メタ情報spanの個別生成を削減。
  - 表示内容、class、合成モード通常時の非表示扱い、属性パネル導線のtitleは既存挙動を維持。
  - 狙い: CAF内部カードの `metaLabel` 系と旧カードの透明度/合成モード表示を後続で統合しやすいよう、メタ表示DOMの生成入口を整理する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カード名前span生成の共通化**:
  - `layer-panel-renderer.js`: 通常Layer/Folder名と背景名のspan生成を `_createLayerPanelNameElement()` 経由へ変更し、旧カード内の名前DOM生成入口を統一。
  - 背景レイヤーは編集不可の特殊扱いを維持し、通常Layer/Folderは既存のダブルクリック/F2編集経路を維持。
  - 狙い: CAFヘッダー/内部Layer名と同じ方向で、名前表示と名前編集対象のDOM構成を整理し、旧カード側の個別生成を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カード削除ボタン生成の共通化**:
  - `layer-panel-renderer.js`: 旧Layerカード用の削除ボタンを `_createLayerPanelIconButton()` 経由へ変更し、同ヘルパーを `button` タグ・close系class・aria-labelにも対応させた。
  - 狙い: 可視/クリッピング/背景色/複製/下結合に続き、旧カードの操作ボタン生成を同じ入口へ寄せ、カード部品統合時の残差を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カード複製/下結合アイコン生成の共通化**:
  - `layer-panel-renderer.js`: 旧Layerカードの複製/下結合ボタン生成を `_createLayerPanelIconButton()` 経由へ変更し、小型アイコン生成の個別実装を削減。
  - `main.css`: 下結合不可時の `visibility/pointer-events` をJS直書きから `.layer-merge-down-button.is-disabled` へ移管。
  - 狙い: 通常レイヤーパネルカードの操作ボタン群を同じ生成・無効化パターンに寄せ、CAFカードとの部品統合に向けて分岐を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードクリッピングアイコン生成の共通化**:
  - `layer-panel-renderer.js`: 通常Layerカードのクリッピング表示を `_createLayerPanelIconButton()` 経由へ変更し、可視/背景色アイコンと同じ小型アイコン生成経路へ統一。
  - フォルダ/背景では空枠、通常Layerではpaperclip表示という既存挙動は維持し、`is-clipping` / `is-toggleable` の意味付けもそのまま残した。
  - 狙い: 通常レイヤーパネルカードの右端操作部品をCAFカードと同じボタン生成系へ寄せ、カード統合時の部品差分を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カード操作アイコン生成の共通化**:
  - `layer-panel-renderer.js`: 通常Layer/背景カードの可視アイコン・背景色アイコン生成を `_createLayerPanelIconButton()` 経由へ変更し、個別に `ui-icon-button ui-icon-button--small` を組み立てる重複を削減。
  - 狙い: CAF内部カードと旧Layer/Folderカードで共通する小型アイコンボタンの生成経路を寄せ、今後のカード統合時にアイコン寸法・class・title付与の調整箇所を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer/Folderサムネイル表示のCSS変数化**:
  - `layer-panel-renderer.js`: 通常Layer/Folderサムネイルの幅/高さとサムネイル画像表示styleを、直接style指定から `--legacy-thumb-*` と `layer-thumbnail-image` classへ変更。`thumbnail:updated` の遅延反映経路も同じclassを使うよう統一。
  - `main.css`: `.layer-thumbnail` に `--legacy-thumb-width` / `--legacy-thumb-height` 参照を追加し、画像の `object-fit: contain` などを `.layer-thumbnail-image` へ移管。
  - 狙い: 通常レイヤーパネル側のサムネイルもCAFカードと同じ「CSS変数 + class」経路へ寄せ、カード統合後のアスペクト比・見た目調整箇所を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧カードDOM側のCSS変数適用ヘルパー化**:
  - `layer-panel-renderer.js`: 旧Layer/FolderカードShellで直接 `style.setProperty()` していた `--legacy-card-*` 変数を、`_applyLayerPanelCardStyleVars()` 経由へ変更。
  - 狙い: CAFカードHTML側の `_createLayerPanelCardStyleAttributes()` と対になるDOM用ヘルパーを用意し、通常レイヤーパネルカードとCAFカードの動的style指定経路を揃える。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: CAFカードサムネイル寸法のCSS変数化**:
  - `layer-panel-renderer.js`: CAF内部Layerミラーのサムネイル幅/高さを直接 `style="width:...;height:..."` で出す経路から、`_createLayerPanelCardStyleAttributes()` によるCSS変数出力へ変更。
  - `main.css`: `clip-layer-mirror-thumb` の幅/高さを `--card-thumb-width` / `--card-thumb-height` 参照へ変更。
  - 狙い: CAFカードHTML生成も旧カードと同じく「class + data + 必要最小限のCSS変数」構成へ寄せ、後続のカード生成共通化で使えるstyle属性生成ヘルパーを用意する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 通常Layer/Folder名編集inputの共通class化**:
  - `layer-panel-renderer.js`: 通常Layer/Folderの名前編集inputを、CAFヘッダー/CAF内部Layer名編集と同じ `layer-panel-inline-name-input` 経路へ接続し、JS側のインラインstyle指定を削除。
  - `main.css`: `layer-panel-inline-name-input.legacy-layer-card-name` を追加し、旧カード内の名前編集配置をCSSで指定。
  - 狙い: 通常Layer/FolderカードもCAFカード同様に、表示と編集状態をclassベースで扱う構造へ寄せる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧フォルダカード残骸の整理**:
  - `layer-panel-renderer.js`: 未使用になっていた旧フォルダ耳/旧トグルアイコン生成関数を削除し、フォルダ開閉は現行のフォルダサムネイルクリック経路へ一本化。
  - `layer-panel-renderer.js` / `main.css`: 旧Layer/Folderカード名の古い `grid-row:3` インライン指定、フォルダサムネイル、子階層ライン、旧操作アイコン寸法をCSS classへ移管。
  - 狙い: 通常レイヤーパネルカードをCAFカード同様のclassベース構造へ寄せ、使われていない旧UI部品を残さない。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 背景レイヤーカードの見た目統一**:
  - `layer-panel-renderer.js`: 背景レイヤーの名前表示とバケツ/可視アイコン配置を、通常旧カードと同じ `legacy-layer-card-*` class経路へ接続。
  - `main.css`: 背景レイヤーを特殊扱いのまま、旧カード内の表示/背景色アイコン寸法を16px枠・12px SVGへ揃える指定を追加。
  - 狙い: 背景レイヤーはCAF外に出る特殊レイヤーとして残しつつ、パネルカードとしての密度とアイコンサイズはLayer/Folderカードと統一する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer/FolderカードのCSS責務移管**:
  - `layer-panel-renderer.js`: 旧Layer/Folderカード外枠の固定style、詳細欄、サムネイル配置、右端アイコン、透明度/合成モード表示の直書きstyleを削減し、classとCSS変数へ移行。
  - `main.css`: `legacy-layer-card-row` / `legacy-layer-card-details` / `legacy-layer-card-thumb` / `legacy-layer-card-*action` / `layer-opacity-*` / `layer-clip-status` の共通スタイルを追加。
  - 狙い: 旧カード生成をCAFカードと同じ「class + data + 必要最小限の動的値」構成へ寄せ、今後のカード統合・D&D統合の調整箇所を減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer/Folderカード内部部品の共通化**:
  - `layer-panel-renderer.js`: 旧Layer/Folderカードの詳細欄、サムネイル配置、右端のクリップ/可視アイコン、クリック選択処理を `_appendLegacyLayerCardDetails()` / `_appendLegacyLayerCardThumbnail()` / `_appendLegacyLayerCardActionIcons()` / `_attachLegacyLayerCardClick()` へ切り出し。
  - 背景レイヤーの特殊表示、既存の名前編集、透明度、クリッピング、表示切替、フォルダ開閉のDOM部品は維持。
  - 狙い: 旧Layer/Folderカード生成をCAFカード基盤へ寄せるため、Shellだけでなく内部構造側の二重実装も段階的に減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: レイヤーパネル旧SortableJS依存の撤去**:
  - `layer-panel-renderer.js`: `sortablejs` import、`initializeSortable()`、SortableJS専用のdrop解決/DOM並び替え補助、`sortable` インスタンス破棄経路を削除。
  - `requestUpdate()` のドラッグ中延期判定を旧Sortable状態ではなく共通D&D状態 `_cardDrag?.active` へ変更し、保留更新の処理も `_finishLayerPanelCardDrag()` 側へ移動。
  - 狙い: 旧Layer/FolderカードD&DをCAF側と同じpointer D&D基盤へ統一し、旧SortableJSとの二重D&D実装を残さない。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer/FolderカードD&Dの共通pointer経路接続**:
  - `layer-panel-renderer.js`: レイヤーパネルのpointer入口を `_handleLayerPanelCardPointerDown()` に統一し、CAF内部Layerミラーと旧Layer/Folderカードを同じ `_startLayerPanelCardDrag()` 経路へ接続。
  - 旧Layer/Folderカード用に `_handleLegacyLayerCardPointerDown()` / `_applyLegacyLayerCardDropFromPointer()` / `_resolveLayerIndexFromPointerDrop()` を追加し、共通D&Dの `before` / `after` / `inside` 結果を `LayerSystem.reorderLayers()` / `moveLayerIntoFolder()` へ適用。
  - `render()` 時の SortableJS 初期化を止め、既存インスタンスがあれば破棄するよう変更。旧カードD&Dは共通pointer経路へ寄せた。
  - `main.css`: `layer-panel-card-drag-ghost` と旧カード用drop予告classを追加し、旧Layer/FolderカードでもCAF側と同じゴースト/挿入ライン/insideハイライトを表示。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer D&D適用処理の分離**:
  - `layer-panel-renderer.js`: SortableJS の `onEnd` に直書きされていた旧Layer/Folderの並び替え・フォルダ投入適用処理を `_applyLegacyLayerCardDropFromSortable()` へ切り出し。
  - drop先解決を `_resolveLegacyLayerCardDrop()` に分離し、SortableJSイベント固有の形から少し切り離した。
  - 狙い: 旧カードD&D本体を後続で共通D&Dヘルパーへ置き換える際、移動適用ロジックを再利用しやすくする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: カード共通class/data属性の導入**:
  - `layer-panel-renderer.js`: CAF内部Layerミラー行と旧Layer/Folder行の両方に `layer-panel-card-row` と `data-card-kind` / `data-layer-id` / `data-depth` などの共通カード識別dataを持たせる補助関数を追加。
  - `_createLayerPanelCardHtml()` は共通class/data生成を通す形へ変更し、旧カードShell側も同じ補助関数でclass/dataを付与。
  - 狙い: 旧Layer/FolderカードをCAFカードD&Dと同じselector・識別子で扱えるようにし、後続の旧SortableJS撤去と共通D&D接続の足場を作る。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task3進行: 旧Layer/FolderカードShellの共通化**:
  - `layer-panel-renderer.js`: 通常Layer/Folderカードの外枠生成を `_createLegacyLayerCardShell()` に切り出し、`createLayerElement()` / `createFolderElement()` に重複していた class / data属性 / grid / 階層indent / active・selected枠表示を一本化。
  - 旧LayerSystem操作先、名前編集、透明度、クリッピング、表示切替、フォルダ開閉の既存DOM部品とイベントは維持。
  - 狙い: 旧Layer/FolderカードをCAFカード生成・共通D&Dへ寄せる前段として、見た目と行Shellの二重実装を先に減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task2完了: CAFカードD&Dの共通ヘルパー化**:
  - `layer-panel-renderer.js`: CAF内部LayerミラーのD&D状態を `_cardDrag` に統一し、開始処理を `_startLayerPanelCardDrag()`、drop判定を `_updateLayerPanelCardDropTarget()`、終了処理を `_finishLayerPanelCardDrag()` へ整理。
  - CAF固有の移動処理は `onDrop` / `canDropInside` / `rowSelector` / `ghostClass` の設定として渡す形にし、後続で旧Layer/FolderカードD&Dを同じ入口へ差し替えられるようにした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Task1完了: CAFカード描画の共通関数化**:
  - `layer-panel-renderer.js`: CAF内部Layerミラーの1行HTML生成を `_createLayerPanelCardHtml()` へ切り出し、既存の `clip-layer-mirror-*` class / data属性を維持したまま共通カード生成経路を通すよう変更。
  - 狙い: 旧Layer/Folderカードを後続で同じカード描画関数へ寄せる足場を作り、見た目・ボタン・D&D対象DOMの二重実装を段階的に減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF Clip外部選択後の同期フラッシュ**:
  - `animation-table-popup.js`: レイヤーパネル側CAFヘッダーから `selectClipAssetFromExternal()` でClipを選択した後、アニメテーブル再描画だけでなく `_flushLayerPanelSync()` も実行するよう変更。
  - 狙い: レイヤーパネルから別CAF Clipへ移った直後に、CAFミラーの選択枠・属性パネル・内部Layer選択表示が一手遅れて旧対象へ残る余地を減らす。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAFヘッダー操作対象の選択Clip追従**:
  - `layer-panel-renderer.js`: CAFグループヘッダーの選択・可視ON/OFF・Lane表示を、同グループ内で選択中のClipがある場合はそのClipへ向けるよう変更。開閉キーだけは従来通りグループ先頭Clipを使うよう分離。
  - 狙い: 同一CAFグループに複数Clipがある状態で、ヘッダー操作が常に先頭Clipへ作用して選択中Clipとズレる混線を避ける。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF側V変形の空保存抑制**:
  - `animation-table-popup.js`: V変形プレビュー開始時に作業Layerのsnapshot参照・位置・回転・拡縮・表示状態をシグネチャとして保持し、VキーOFF時に実差分がない場合はCAF保存と履歴登録を行わないよう変更。
  - 狙い: Vキーを押して戻しただけの空操作でCAF内部Layer snapshotや `caf-internal-layer-transform` 履歴が増える余地を減らし、将来のInstance transform移行前の暫定経路を安定させる。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF側V変形の履歴化**:
  - `animation-table-popup.js`: V変形プレビュー開始時に選択CAFの内部Layer履歴状態を保持し、VキーOFF保存後に差分がある場合は `caf-internal-layer-transform` として履歴登録するよう変更。
  - 狙い: 旧LayerSystemの変形履歴に依存せず、CAF内部Layer正本へのV変形反映をUndo/Redo対象にする。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF側VキーOFF保存の自前化**:
  - `animation-table-popup.js`: `keyboard:vkey-state-changed` の `pressed:false` をCAF側で受け、変形プレビュー中なら `force` 保存・レイヤーパネル同期・プレビュー復帰を直接行うよう変更。
  - 狙い: 旧LayerSystemの `layer:transform-exit` に依存せず、CAF側だけでV変形終了時の正本反映と表示復帰を完結できるようにする。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈Vキーの旧Layer move mode抑制**:
  - `layer-system.js`: `keyboard:vkey-state-changed` 受信時、CAF文脈では旧Layerの move mode に入らず、既に入っている場合は抜けるよう変更。
  - `layer-transform.js`: 同じVキーイベント受信時、CAF文脈では旧Layer変形パネル/状態を開かず、既存の旧変形状態を終了するよう変更。
  - 狙い: アニメテーブル側のV変形プレビューと、旧LayerSystemの変形パネル/変形状態が同時に走る混線を避ける。
  - **確認**: `node --check tegaki_work/system/layer-system.js` / `node --check tegaki_work/system/layer-transform.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: 旧LayerSystemイベント受信側のCAF文脈ガード**:
  - `layer-system.js`: `layer:copy-request` / `layer:paste-request` / `layer:flip-*` / `layer:move-by-key` / `layer:scale-by-key` / `layer:rotate-by-key` / `layer:select-*` / `layer:order-*` の受信処理を、CAF文脈では実行しないようガードを追加。
  - `layer-transform.js`: `layer:reset-transform` の受信処理にも同じCAF文脈ガードを追加。
  - 狙い: UI/キーボード側で止めた旧Layer操作が、別経路のEventBus発火から見えない旧Layerへ作用する余地をさらに減らす。
  - **確認**: `node --check tegaki_work/system/layer-system.js` / `node --check tegaki_work/system/layer-transform.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: 旧DrawingClipboardのCAF文脈ガード**:
  - `drawing-clipboard.js`: `clipboard:copy-request` / `clipboard:paste-request` / `clipboard:paste-to-active-request` / `layer:cut-request` / `layer:delete-active` の旧LayerSystem向け処理を、CAF文脈では実行しないようガードを追加。
  - `drawing-clipboard.js`: 独自の Ctrl+C / Ctrl+V / Ctrl+X keydown 経路にも同じCAF文脈ガードを追加。`preventDefault` は行うが伝播は止めず、CAF側キーボードハンドラが処理できる余地を残す。
  - 狙い: アニメテーブル展開後に旧クリップボード経路が見えない旧Layerへコピー/貼り付け/切り取り/削除を行う混線を避ける。
  - **確認**: `node --check tegaki_work/system/drawing-clipboard.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈キーボード変形の旧Layer漏れ抑制**:
  - `keyboard-handler.js`: `LAYER_RESET` / `LAYER_MOVE_*` / `LAYER_SCALE_*` / `LAYER_ROTATE_*` / `LAYER_FLIP_*` を、CAF文脈では内部Layer選択の有無に関係なく消費し、旧LayerSystemの変形イベントへ流さないよう変更。
  - `keyboard-handler.js`: `LAYER_HIERARCHY_UP/DOWN` もCAF文脈では旧Layerの見えない選択移動へ流さないよう変更。Z軸移動は既存の `LAYER_ORDER_UP/DOWN` からCAF内部Layer移動へ分岐する経路を維持。
  - 狙い: 右サイドバーのCAF変形ブロックとショートカット挙動を揃え、CAF transform/physicsパラメータ実装前に旧Layerへ誤作用する経路を閉じる。
  - **確認**: `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: 反転/リセット無効クリック判定の共通化**:
  - `ui-panels.js`: 右サイドバーの左右反転/上下反転/変形リセットクリック時にも `_isLayerPanelControlDisabled()` を先に確認するよう変更。
  - `ui-panels.js`: ランタイム注入CSSにも `.flip-button.is-disabled` / `[aria-disabled="true"]` の無効表示を追加し、通常CSSと競合して見た目が戻る余地を減らした。
  - 狙い: `div` 製の反転/リセットボタンでも、CAF文脈の無効状態が処理・表示の両面で一貫するようにする。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈の変形ボタン無効表示**:
  - `ui-panels.js`: CAF文脈では右サイドバーの左右反転/上下反転/変形リセットボタンも `syncLayerPanelActionButtons()` の同期対象に含め、無効状態へ切り替えるよう変更。
  - `main.css`: `.flip-button.is-disabled` / `[aria-disabled="true"]` の見た目を追加し、処理側で止まる操作がUI上も押せない状態として見えるよう調整。
  - 狙い: CAF選択中に反転/リセットが旧Layerへ作用しないブロックと、ボタン表示の状態を一致させる。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈の右サイドバー変形漏れ抑制**:
  - `ui-panels.js`: 右サイドバーの左右/上下反転と変形リセットを、CAF文脈では旧LayerSystemイベントへ流さないよう変更。
  - `_shouldBlockNormalLayerOperation()` に `blockAnimationContext` オプションを追加し、CAF変形パラメータ実装前の誤操作を明示的に止める経路を用意。
  - 狙い: CAF選択中に右サイドバー変形ボタンが見えていない旧Layerへ作用する混線を避ける。将来のCAF transform/physicsパラメータ実装時は、このブロック先をCAF操作へ差し替える。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部Layer未選択時のショートカット漏れ抑制**:
  - `keyboard-handler.js`: CAF文脈でセルは選択されているが内部Layerが未選択の場合、変形/階層移動など `block-empty` 系ショートカットが旧LayerSystemイベントへ流れないよう変更。
  - 狙い: CAFヘッダー選択や内部Layer未選択状態で、見えていない旧Layerに移動/変形/階層選択ショートカットが作用する混線を避ける。
  - **確認**: `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈F2の旧Layerフォールバック抑制**:
  - `layer-panel-renderer.js`: F2名前変更でCAF内部Layerが選択されていない場合、CAF文脈では旧LayerSystemのアクティブLayer名変更へフォールバックしないよう変更。
  - 狙い: NO FRAME / CAFヘッダー / Lane系選択などで、見えていない旧Layer名がF2で変わる混線を避ける。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF内部Layer API戻り値の整備**:
  - `animation-table-popup.js`: `addInternalLayer()` / `addInternalFolder()` / `moveInternalLayer()` / `removeInternalLayer()` が成功/失敗結果を返すよう整理。
  - 狙い: レイヤーパネル統合後にショートカット・右サイドバー・ミラーUIがCAF操作の成否を扱いやすくし、失敗時に旧LayerSystem側へフォールバックするような混線を避ける下地を作る。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF内部Layer上下移動の未定義options修正**:
  - `animation-table-popup.js`: `moveInternalLayer()` が未定義の `options` を参照していたため、引数に `options = {}` を追加。
  - `recordHistory: false` 指定時は履歴を積まないよう、`beforeState` と履歴記録を `shouldRecordHistory` で整合させた。
  - 狙い: CAF内部Layerの上下移動ショートカット/操作時に未定義参照で落ちる可能性を潰し、履歴制御も他のCAF内部Layer操作と揃える。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAFミラー小ボタンの選択保持**:
  - `layer-panel-renderer.js`: CAF内部Layerミラー行の可視ON/OFF・クリッピング小ボタンからの呼び出しに `preserveSelection` を追加。
  - `animation-table-popup.js`: `toggleInternalLayerVisibilityFromExternal()` / `toggleInternalLayerClippingFromExternal()` が `preserveSelection` を受けた場合、操作対象へアクティブ内部Layerを移さず、従来選択を保持するよう変更。
  - 狙い: 旧レイヤーカードの目/クリップ小ボタンと同じく、状態切替だけでアクティブLayerを奪わない操作感へCAFミラーを寄せる。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF同期フラッシュ後の属性パネル追従**:
  - `animation-table-popup.js`: CAF内部Layer操作の中央同期 `_flushLayerPanelSync()` 後に、開いているレイヤー属性パネルを現在のCAF選択ターゲットへ再同期するよう変更。
  - 狙い: 削除/複製/結合/D&D/履歴復元など `_flushLayerPanelSync()` を通るCAF操作後に、属性パネルが前の内部Layer/Folder表示へ残る経路をまとめて抑制する。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF透明度適用後の旧DOM更新抑制**:
  - `layer-panel-renderer.js`: CAF内部Layer/Folderの透明度を属性パネルから適用した場合、CAF正本更新後に旧LayerSystemの `.layer-item` DOMを旧indexで更新しようとする経路を打ち切るよう変更。
  - 狙い: CAF文脈では通常Layer行が非表示になっているため、透明度操作後に旧レイヤーパネルDOMへ誤った局所更新が走る余地をなくす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAFミラー可視/クリップ操作後の属性同期**:
  - `layer-panel-renderer.js`: CAF内部Layerミラー行の可視ON/OFF・クリッピングボタン操作後、開いている属性パネルを現在のCAF選択ターゲットへ即再同期するよう変更。
  - 狙い: ミラー行ボタンでCAF正本を更新した直後に、属性パネル側だけ旧表示/旧対象へ残る小さなズレを抑制する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF属性操作後同期の現ターゲット化**:
  - `layer-panel-renderer.js`: レイヤー属性パネル内の透明度プリセット/スライダー/数値入力/合成/クリッピング操作後の再同期を、作成時の旧Layer indexではなく現在のCAF選択ターゲットへ寄せた。
  - 狙い: 属性パネルを開いたままCAF内部Layer/Folder選択が変わった場合でも、操作後の表示値と対象が古い行へ戻る経路をさらに減らす。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF属性パネルの選択追従補強**:
  - `layer-panel-renderer.js`: CAF内部Layer/Folderミラーの選択変更時、開いたままのレイヤー属性パネルを現在のCAF選択ターゲットへ再同期するヘルパーを追加。
  - `layer-panel-renderer.js`: 旧LayerSystemの `layer:activated` が発火しても、CAF内部選択がある場合は旧Layer indexへ属性パネルを寄せず、CAF正本の選択状態を優先するよう変更。
  - 狙い: CAF内で属性パネルを開いたまま別の内部Layer/Folderを選ぶと、表示値や対象indexが前の行へ残る混線を抑制する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部フォルダ属性パネルのアンカー補強**:
  - `layer-panel-renderer.js`: CAF内部Layer選択中に属性パネルを開く際、内部フォルダなど作業Layerへ直接対応しない対象でも、旧LayerSystemの非背景Layerを表示アンカー用に解決するフォールバックを追加。
  - 狙い: 属性値/適用先はCAF正本を使いつつ、旧activeが背景などの場合にCAF内部フォルダの属性パネルが開けない状態を避ける。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF属性パネル表示時の旧active切替抑制**:
  - `layer-panel-renderer.js`: レイヤー属性ポップアップを開く際、CAF内部Layer/Folderが選択対象の場合は旧LayerSystemの `setActiveLayer()` を呼ばないよう変更。
  - 狙い: 属性値/適用先はCAF正本へ寄っていても、ポップアップ表示時だけ旧作業Layer activeが動く混線を抑える。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF操作のLayerManager依存分離**:
  - `ui-panels.js`: 複製/下結合/削除ボタンの処理で、CAF文脈分岐を `layerManager` 存在チェックより前に移動。CAF内部Layer操作はCAF正本へ直接向かうため、旧LayerManager依存で早期returnしないようにした。
  - 狙い: レイヤーパネル統合後にCAF操作面が旧LayerSystem状態へ引っ張られる経路をさらに減らす。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `node --check tegaki_work/ui/keyboard-handler.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部フォルダEnter開閉**:
  - `layer-panel-renderer.js`: 選択中CAF内部Layerがフォルダの場合に、CAFミラー上の開閉状態を切り替える `toggleSelectedAnimationFolderMirror()` を追加。
  - `keyboard-handler.js`: Enterキーの通常フォルダ開閉より先にCAF内部フォルダ開閉を試すよう変更。CAF文脈で旧LayerManagerのアクティブ通常フォルダへ操作が漏れる経路を抑制した。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAFショートカット文脈の追加固定**:
  - `keyboard-handler.js`: `Alt+Delete/Backspace` と `Alt+C/V` のCAF分岐を、アニメテーブル表示中判定ではなくアニメーションモデルにLane/ClipAssetがあるかのCAF文脈判定へ変更。
  - 狙い: アニメテーブルを閉じた後もレイヤーパネル側がCAF編集口として残るため、CAF削除/CAFコピー/CAF貼り付けショートカットが旧LayerSystem側へ漏れる状態を抑制。
  - **確認**: `node --check tegaki_work/ui/keyboard-handler.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF Clip移動/左端伸縮の衝突解決補強**:
  - `animation-table-popup.js`: Clip移動時のドロップ先解決を、既存Clip DOMの開始セルではなくタイムライン行内のポインタ座標から算出するよう変更。既存Clipの上に重ねている時も7〜9など実際の位置へ移動予告/ドロップできるようにした。
  - `animation-table-popup.js`: 左端retimeで前Clipを左へ押し出せない場合、前Clipの右端を縮めて最小1FRAMEを守れるなら伸縮を成立させるよう変更。隣Clipの頭を既存Clip領域へ伸ばす操作を試せるようにした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF Clip移動の押し入り割り込み対応**:
  - `animation-data-model.js`: `canMoveClip()` / `moveClip()` を、移動先に既存Clipがある場合でも配置先Clipを優先して周辺Clipを押し出す計画を立てる経路へ変更。重なり即拒否ではなく、同Lane上で押し出し可能なら移動を成立させる。
  - `animation-data-model.js`: 押し出しは移動方向を優先し、端で行き場がない場合は逆方向も試す。どちらにも押せない場合のみ `push-out-of-range` として拒否する。
  - 狙い: 長いClipや隣接Clipを1FRAME単位で詰める編集時に、掴んだClipを置きたい位置へ先に割り込ませられるようにする。履歴は既存の `caf-clip-move` のBefore/Afterに含まれる。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF D&Dゴースト傾きフィードバック**:
  - `layer-panel-renderer.js`: CAF内部LayerミラーD&Dの追従ゴーストに `rotate(2deg)` を追加。移動中の仮表示であることを視覚的に示し、静止カードとの差を出した。
  - `main.css`: CAF内部Layerミラーのゴースト初期表示にも同じ傾きを設定し、Pointer移動前の一瞬も見た目が揃うようにした。
  - `animation-table-popup.js`: タイムライン上のClip移動中表示にも軽い傾きを追加。CAF/Clip系D&Dのフィードバックを同じ方向へ寄せた。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF即時同期の再描画予約抑制**:
  - `animation-table-popup.js`: `_flushLayerPanelSync()` でレイヤーパネルを即時描画する場合、`layer:panel-update-requested` に `skipRender` を付けるよう変更。イベントで更新予約を入れてから即キャンセルする無駄な経路を減らした。
  - `animation-table-popup.js`: 同イベントを購読するアニメテーブル自身も `skipRender` を見て再描画予約を避けるよう変更。CAF内部Layer操作後の即時同期で、アニメテーブル側にも不要な遅延レンダーが積まれる状態を抑制。
  - `layer-panel-renderer.js`: `layer:panel-update-requested` の `skipRender` を見て、CAF側から直接描画される同期では追加の `requestUpdate()` を積まないようにした。
  - `layer-panel-renderer.js`: CAFミラーサムネイル生成で空Snapshot (`isBlank`) はDataURL化せず空サムネイルのまま扱うよう変更。空内部Layerが多い状態でのパネル再描画負荷を少し抑制。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAFミラーサムネイルDataURLキャッシュ**:
  - `layer-panel-renderer.js`: CAF内部Layerミラーのサムネイル生成に Snapshot ID / `updatedAt` / サイズ単位のDataURLキャッシュを追加。レイヤーパネル再描画のたびに全内部Layer SnapshotをCanvasへ戻してDataURL化する経路を抑制した。
  - `layer-panel-renderer.js`: CAF文脈のレイヤーパネル内では、CAFヘッダー/内部Layerミラー行の `contextmenu` を抑制。統合後のCAF操作面でブラウザ既定メニューが割り込む経路を減らした。
  - 狙い: CAF内部Layer/Folderが増えた状態で、選択変更・属性変更・D&D後のレイヤーパネル再描画がサムネイル再生成に引きずられる状態を軽減し、CAFベース統合後の表示負荷を下げる。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部Layer透明度スライダー履歴集約**:
  - `animation-table-popup.js`: `setInternalLayerAttributesFromExternal()` に `recordHistory: false` と外部指定 `beforeState` を受ける経路を追加。属性スライダーのプレビュー適用と確定履歴を分離できるようにした。
  - `layer-panel-renderer.js`: CAF内部Layer選択中の透明度スライダーは、ドラッグ/フォーカス時に開始状態を保持し、`input` 中は履歴なしで即時反映、`change` 時に開始状態から最終値までを1履歴として記録するよう変更。スライダー操作でHistoryが細かく積まれる状態を抑制。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部Layer属性の直接適用**:
  - `animation-table-popup.js`: 外部UIからCAF内部Layerの透明度/合成モード/クリッピングを直接変更する `setInternalLayerAttributesFromExternal()` を追加。変更時は内部Layer履歴、作業Layer同期、レイヤーパネル同期を既存のCAF内部Layer操作経路に揃えた。
  - `layer-panel-renderer.js`: レイヤー属性ポップアップの透明度プリセット/スライダー/数値入力、合成モード、クリッピング操作を、CAF内部Layer選択中は旧LayerSystemではなく `ClipAsset.internalLayers` 側へ適用するよう変更。内部フォルダの透明度変更もCAF正本へ直接反映する。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF選択ステータス通知補強**:
  - `animation-table-popup.js`: `_flushLayerPanelSync()` 時に選択中CAF/内部Layer名を `layer:status-update-requested` へ通知するヘルパーを追加。CAF側の選択・同期フラッシュ後に、下部ステータスと右サイドバーの有効/無効状態が旧LayerSystem状態へ残りにくいようにした。
  - `animation-table-popup.js`: レイヤーパネルCAFヘッダー等から `selectClipAssetFromExternal()` でClipを選んだ直後にも同じステータス通知を発行。Clip選択のみ/内部Layer選択ありのどちらでもCAF文脈GUIの状態更新経路を揃えた。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF文脈ボタン状態同期**:
  - `ui-panels.js`: 右サイドバーのレイヤー追加/フォルダ追加/属性/複製/下結合/削除ボタンを、CAF文脈では選択Clipと選択内部Layerの状態から有効/無効同期するよう変更。NO FRAME状態や内部Layer未選択時に旧LayerSystem操作へ見た目だけ残るズレを抑制。
  - `ui-panels.js`: 無効状態のボタンはクリック側でも早期returnするようにし、押せない表示と実操作を一致させた。内部フォルダ選択時は下結合を無効化し、CAF内部Layer操作の誤導線を減らした。
  - `main.css`: divベースの追加ボタンも含めて `is-disabled` 表示を追加し、CAF文脈で操作不可状態が視覚的に分かるようにした。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: 属性パネル対象Layer逆引き**:
  - `layer-panel-renderer.js`: レイヤー属性パネルを開く際、CAF内部Layer選択中は `selectedInternalLayerId` から対応する作業Layer indexを逆引きして対象にするよう変更。旧アクティブLayerに残ったまま属性パネルが開くズレを抑制。
  - CAF内部フォルダは作業Layerを持たないため、従来のアクティブLayerをアンカーにしつつ表示値だけCAFフォルダ正本を使う方針を維持。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: 属性パネル表示値のCAF内部Layer正本化**:
  - `layer-panel-renderer.js`: レイヤー属性パネルのタイトル/透明度/合成/クリッピング/フォルダ判定の表示値を、CAF内部Layer選択中は旧作業Layerではなく `ClipAsset.internalLayers` 側から読むよう変更。
  - 操作適用は既存の作業Layer同期経路を維持。透明度/合成/クリッピングの履歴化済み経路を壊さず、パネル表示だけが旧作業Layer名/値へズレる状態を抑制した。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部Layerステータス表示同期**:
  - `ui-panels.js` / `status-display-renderer.js`: 下部ステータスの `Layer:` 表示を、アニメーション文脈では旧LayerSystemの作業Layer名ではなく選択中CAF内部Layer名へ優先同期するよう変更。選択Clipがない場合は `NO FRAME` を表示。
  - `layer-panel-renderer.js`: CAF内部Layerミラー行の選択時に `layer:status-update-requested` を発行し、クリック/ペン選択直後にステータス表示が追従するようにした。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `node --check tegaki_work/ui/status-display-renderer.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合: CAF内部Layerショートカット文脈固定**:
  - `keyboard-handler.js`: レイヤー作成/削除/描画クリア/コピー/貼り付け/切り取り/上下移動系ショートカットのCAF分岐を、`animationTable.isVisible` ではなくアニメーションモデルにLane/ClipAssetが存在するかで判定するよう変更。
  - 狙い: アニメテーブルを閉じた後も右レイヤーパネル側がCAF内部Layer編集口として残るため、キー操作だけ旧LayerSystemへ漏れてCAF外作業Layerを操作する経路を抑制。
  - **確認**: `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル本体移動/リサイズのペン入力対応**:
  - `animation-table-popup.js`: アニメテーブルヘッダーのパネル移動と右下リサイズを `mousedown/mousemove/mouseup` から `pointerdown/pointermove/pointerup/pointercancel` へ変更。マウスとタブレットペンで同じ操作経路を通るようにした。
  - `animation-table-popup.js`: 移動/リサイズ中は `pointerId` を保持し、別ポインタ混入を無視。ヘッダーとリサイズハンドルに `touch-action: none` を付け、ペン入力時にブラウザ既定操作へ奪われにくくした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF内部Layer D&Dゴースト追従改善**:
  - `main.css`: CAF内部LayerミラーD&Dのcloneゴーストに `transition: none !important` を追加。元行の `transition: all 0.2s ease` を継承してtransform移動が遅延補間される状態を止めた。
  - 狙い: 名前部分D&D対応後に残っていた「掴めているがゴースト追従が遅い」レスポンス低下を軽減し、Pointer移動とゴースト表示をより直結させる。
  - **確認**: `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF内部Layer D&Dの名前部分掴み対応**:
  - `layer-panel-renderer.js`: CAF内部Layerミラー行のPointer D&D開始判定から `.clip-layer-mirror-name` 除外を撤去。レイヤー/フォルダ名の文字上からでもドラッグ開始できるようにした。
  - ダブルクリックによるインライン名前変更はクリック委譲側に残し、ドラッグしきい値未満の操作では従来通りクリック/ダブルクリック処理へ流す。名前部分だけ掴めないことでレスポンスが悪く見える状態を抑制。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル操作のCAF文脈固定**:
  - `ui-panels.js`: レイヤー追加/フォルダ追加/複製/下結合/削除の分岐を「アニメテーブル表示中」ではなく「アニメーションモデルにLane/ClipAssetが存在するか」で判定するよう変更。CAF文脈ではアニメテーブルを閉じていても旧LayerSystem操作へ落ちないようにした。
  - `ui-panels.js`: CAF文脈で選択Clipがない場合は通常Layer操作へfallbackせず、ボタンをblurして終了する。NO FRAME / Lane-only状態から旧作業Layerを誤操作する経路を抑制。
  - `layer-panel-renderer.js`: レイヤー属性パネルのCAF内部Layerターゲット解決から `animationTable.isVisible` 条件を外し、テーブル非表示でも選択CAF/内部Layerがある場合はCAF内部Layer属性を対象にする。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル統合足場: CAF内部Layer選択経路の共通化**:
  - `layer-panel-renderer.js`: レイヤーパネル側CAFミラー行の内部Layer選択処理を `_selectClipLayerMirrorRow()` に集約。通常クリック、フォルダ開閉前の選択、D&D開始前の視覚選択で同じ状態更新を使えるようにした。
  - `layer-panel-renderer.js`: ペン/マウスでCAF内部Layer行を押した時点で選択枠だけ即時反映し、クリック確定時に作業Layer同期・アニメテーブル再描画・レイヤーパネル更新を行うよう分離。今後の通常レイヤーパネル統合で旧SortableJS経路を置き換える接続点にする。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF文脈での旧通常Layerカード露出抑制**:
  - `layer-panel-renderer.js`: アニメーションモデルにLane/ClipAssetが存在する場合、アニメテーブル表示中/非表示中に関係なく通常Layer/Folderカードをレイヤーパネルから隠し、CAFヘッダー/内部Layerミラー + 背景表示へ寄せるよう変更。
  - 狙い: アニメテーブルを閉じた後にCAF配下の作業Layer/Folderが旧レイヤーカードとしてCAF外へ見える混線をUI表示側で塞ぎ、今後のCAFベース統合の正本をCAF側に固定する。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **DurationボタンのCAF押し出し伸縮対応**:
  - `animation-table-popup.js`: ヘッダーの `DURATION +` 判定を `lane.canPlaceCel()` 直判定から、左右ドラッグ伸縮と同じ `_applyRetimingWithPush()` のシミュレーションへ変更。隣接CAFを押し出せる場合はボタンでも伸長可能にした。
  - `animation-table-popup.js`: `DURATION +/-` 実行時も右端リタイム相当の押し出し処理を使うようにし、ボタン伸縮とドラッグ伸縮の挙動差を縮小。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF伸縮不可フィードバック追加**:
  - `animation-table-popup.js`: CAFリタイム中にTimeline端や押し出し不可で伸縮を適用できない場合、対象CAFへ `retiming-blocked` 表示を付け、赤寄りのブロックフィードバックを出すようにした。
  - `animation-table-popup.js`: 伸縮成功/失敗のどちらでもリタイム中表示を再描画し、「掴めていない」のか「掴めているがその方向へ伸ばせない」のかを判別しやすくした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF伸縮開始フィードバック追加**:
  - `animation-table-popup.js`: CAFの左右端または単セル下部グリップでリタイム開始した際、対象CAFへ `retiming-left/right` 表示を付け、掴んだ側の半セル程度をオレンジ発光させるようにした。
  - `animation-table-popup.js`: リタイム中の再描画でもフィードバックが維持されるよう、レンダー時に `_retimingData.edge` からクラスを復元。リタイム終了時はクラスを除去して残留を防止。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **単セルCAF伸縮グリップ追加**:
  - `animation-table-popup.js`: 単セルCAFに下部横方向グリップを追加。左右端の透明伸縮判定は維持しつつ、下側の `↔` 表示部分をペン入力時の伸縮主判定として使えるようにした。
  - `animation-table-popup.js`: 下部グリップは左右半分で左端/右端リタイムを分け、可視Clip本体の中央は従来通りドラッグ移動を優先。単セル状態で端を狙う厳しさを補助する。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **単セルCAFのペンドラッグ開始補修**:
  - `animation-table-popup.js`: ペンタブレット入力で単セルCAFを掴む際、左右リタイムハンドルへ吸われて移動開始できないことがあったため、Duration 1のペン操作ではセル内側を移動、外側の隙間寄りを伸縮として判定するよう調整。
  - `animation-table-popup.js`: 左右リタイムハンドルを少し外側へ逃がし、可視Clip本体の移動判定を食いにくくした。マウス操作とDuration 2以上のCAFは従来通り端ハンドルで伸縮可能。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル右クリックメニュー抑止**:
  - `animation-table-popup.js`: CAFセル伸縮/移動中にブラウザの右クリックメニューが出ることがあったため、アニメテーブルパネル上の `contextmenu` を抑止。入力欄だけは編集用メニューを残す。
  - `animation-table-popup.js`: Timelineグリッドにも個別の `contextmenu` 抑止を追加し、動的再描画されるClip/リタイムハンドル周辺で右クリックメニューが出る経路を塞いだ。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブルUI状態保持と旧D&D棚上げ判断**:
  - 方針: 通常レイヤーパネルD&Dの残る掴みにくさはSortableJS由来の入力判定まで踏み込む可能性が高いため、これ以上の止血調整は棚上げ。CAFベース統合時に、CAF内D&Dで安定した独自Pointer Events系へ寄せる。
  - `animation-table-popup.js`: アニメテーブルのパネル位置・サイズ・Timeline zoomを `localStorage` に保存/復元する最小接続を追加。移動/リサイズ/ズーム確定時のみ保存し、表示時は画面内へクランプする。
  - 効果: 縦長配置や横並び配置、Timeline縮尺を作業ごとに復元しやすくし、CAF穴埋め作業中のUI再設定コストを減らす。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **レイヤーパネル通常カードD&Dのペン入力補修**:
  - `layer-panel-renderer.js`: 通常レイヤーパネルカードの名前テキストとフォルダサムネイルで `pointerdown` を止めていたため、ペン入力時にSortableJSのドラッグ開始へ届きにくい状態を補修。クリック/ダブルクリック処理は維持しつつ、カード面として掴める範囲を広げた。
  - `layer-panel-renderer.js`: 目アイコン、クリッピング、透明度、複製、下結合、削除などの操作部品はSortableの `filter` でD&D開始対象から除外。押して離した時に操作部品側でドラッグ候補へ入る混線を抑制した。
  - `layer-panel-renderer.js`: SortableJSの `fallbackTolerance` / `touchStartThreshold` をペン入力向けに軽く調整。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFセルD&DのPointer Events化**:
  - `animation-table-popup.js`: Timeline上のCAFセル移動/左右リタイム開始を `mousedown` 依存から `pointerdown` へ変更し、移動/リタイム追跡も `pointermove` / `pointerup` / `pointercancel` へ統一。マウスとタブレットペンで同じClip操作経路を通るようにした。
  - `animation-table-popup.js`: CAFセル本体と左右リタイムハンドルに `touch-action: none` / `user-select: none` を付与し、ペン入力時にブラウザ側の既定操作へ奪われにくくした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
  - **次確認候補**: 通常レイヤーパネルカードのD&DはまだSortableJS経路で、カード内のサムネイル/名前/操作ボタンが `pointerdown` を止める箇所が多い。CAF内ミラーD&Dと同じPointer Events系へ寄せるか、掴み領域を明示するかを後続で検討する。
- **Preview/EDIT経路の旧Layer fallback削減**:
  - `animation-table-popup.js`: Preview Scope `LANE` のアクティブLane解決から、旧LayerSystemのアクティブLayerをLaneへ逆引きするfallbackを削除。Scopeはアニメテーブル側の `activeLaneId` / 選択Clipを正本に寄せた。
  - `animation-table-popup.js`: Clip編集チェックの有効判定を `sourceLayerId` 必須から、選択Clipが有効なClipAssetを持つかどうかへ変更。独立Lane化後もCAF内部Layer編集の入口が閉じないようにした。
  - `animation-table-popup.js`: ClipAsset内部Layerプレビューで、旧通常Layerのopacity/blendModeを借りるfallbackを撤去。CAF内部Layerのopacity/blendModeを表示正本として扱う。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Lane/CAFの旧Layer ID継承抑制**:
  - `animation-data-model.js`: `LaneModel.detachSourceLayer()` / `TimelineModel.detachLaneSourceLayer()` を追加。Laneを通常Layer由来の `sourceLayerId/layerId` から切り離し、配下Clipも独立ClipとしてIDをnullへ揃えられるようにした。
  - `animation-table-popup.js`: 初回CAF取り込み後、対象Laneを独立Laneへ切り替えるよう変更。通常Layer群はCAF内部Layerとして吸い上げるが、その後のFrame/Lane操作は旧LayerSystem IDに依存しない方向へ寄せた。
  - `animation-table-popup.js` / `animation-data-model.js`: 新規CAF、Paste CAF、Lane間移動で `sourceLayerId/layerId` を新規Clipへ持ち込まないよう補修。CAF小箱化後のClipが通常Layerカード側へ戻る経路をさらに狭めた。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル狭幅ヘッダー折り返し再調整**:
  - `animation-table-popup.js`: 狭幅時のヘッダーで左/中央/右グループの幅指定が余白を作っていたため、`display: contents` で各操作部品を個別に折り返すよう変更。最小幅でも2段程度へ詰まりやすくした。
  - `animation-table-popup.js`: 狭幅時の閉じるボタンをヘッダー右上へ `absolute` 固定し、折り返し行の末尾へ流れて見失われる状態を抑制。
  - `animation-table-popup.js`: 画面幅ではなくアニメテーブル自身の幅で `is-narrow` クラスを付けるよう補修。横長画面内でパネルだけ縦長にした場合も狭幅ヘッダー配置が発火するようにした。
  - `animation-table-popup.js`: 最小幅をCSS/リサイズ処理ともに `460px` へ統一し、最小幅でヘッダーが3段へ落ちにくい下限に調整。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFセル両端リタイムと移動予告強調**:
  - `animation-table-popup.js`: CAFセルに左端/右端のリタイムハンドルを追加。左端ドラッグでは開始FrameとDurationを同時に調整し、右端ドラッグでは従来通りDurationを調整する。
  - `animation-table-popup.js`: リタイム中は開始時のLane配置から毎回再計算し、伸長方向にあるCAFを同一Lane内で連鎖的に押し出すようにした。Timeline端まで押し出せない場合は、そのドラッグ位置の変更を適用しない。
  - `animation-table-popup.js`: CAFドラッグ移動中の移動先セルに濃いオレンジの `move-target` 表示を出し、移動不可セルは赤寄りの `move-target-blocked` で示すようにした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFリタイムハンドルUI微調整**:
  - `animation-table-popup.js`: 左右リタイムハンドルの常時表示を白い太棒から端の細いスリットへ変更し、単一セルでも主張が強すぎない見た目にした。
  - `animation-table-popup.js`: リタイム判定幅を狭めつつ、左右端から少し外側へ逃がして、CAF中央部のドラッグ移動を邪魔しにくくした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Timeline FPS/総フレーム数の最小UI追加**:
  - `animation-table-popup.js`: アニメテーブルヘッダーへ `FPS` / `FRAMES` の小型number入力を追加し、`model.fps` と `model.totalFrames` を直接変更できるようにした。
  - `animation-table-popup.js`: 総フレーム数を縮める場合は、既存CAF終端と現在Frameを下回らないよう自動クランプする。FPS変更中に再生していた場合は、タイマーを再作成して新FPSを反映する。
  - `animation-table-popup.js`: 変更を `caf-timeline-settings` としてTimeline Historyへ記録し、Undo/RedoでFPS/総フレーム数を復元できるようにした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **長尺CAF表示幅のFRAMES対応**:
  - `animation-table-popup.js`: CAFセル幅の `duration-N` CSSを固定24フレーム分から、注入時に240フレーム分まで自動生成する方式へ変更。`FRAMES` を24超へ伸ばした時も長いCAFの表示幅が追従するようにした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Timeline縮尺UI追加**:
  - `animation-table-popup.js`: アニメテーブル右下にTimeline zoom `- / +` と倍率表示を追加。セル幅を 18 / 22 / 26 / 30 / 36 / 44px の範囲で切り替えられるようにした。
  - `animation-table-popup.js`: セル幅、フレーム番号幅、グリッド背景、CAF幅CSS、リタイム時のドラッグ距離換算を同じ `timelineCellWidth` に揃えた。長尺Timeline時の表示密度調整を可能にしつつ、数字省略などの細かい表示最適化は後続へ残す。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **長尺CAFの1Frame単位ドラッグ移動補修**:
  - `animation-table-popup.js`: CAF移動のドロップ先解決を `elementFromPoint()` 直読みから専用 `_getClipMoveTargetSlot()` へ統一。移動中のCAF本体を一時的にpointer対象から外し、下のセルを拾うようにした。
  - `animation-table-popup.js`: 下のセルを直接拾えない場合は、Timeline行と `timelineCellWidth` からFrame座標を算出するfallbackを追加。長いCAFを開始位置から隣Frameへ1Frameずつ動かせるようにした。
  - `animation-table-popup.js`: Timeline zoom `- / +` を横スクロールバーと同じ下端行の右端へ移動。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル右下リサイズ追加**:
  - `animation-table-popup.js`: パネル右下に小さい斜線リサイズハンドルを追加し、アニメテーブルの幅/高さをドラッグで変更できるようにした。
  - `animation-table-popup.js`: リサイズは最小 420x180px、画面外へ伸びすぎない範囲へクランプ。パネル移動とは別イベントにし、既存ヘッダードラッグとは干渉しないようにした。
  - 注意: 位置/サイズの永続保存や左右分割レイアウト専用UIは未実装。まずLane多数・長尺Timeline時に表示領域を広げる最小接続に限定。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル狭幅ヘッダー折り返し**:
  - `animation-table-popup.js`: アニメテーブルヘッダーを `flex-wrap` 対応にし、縦長リサイズ時にトップバー要素が重なりにくいよう調整。狭幅時は左側の再生/Scope/Preview/FPS系を1段目、Duration/Copy/Paste/Delete系を2段目へ回す。
  - `animation-table-popup.js`: LIB/Closeは右上へ残し、パネル操作の出口が見失われにくい配置にした。4辺リサイズや専用左右分割レイアウトは未実装。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFセルCopy/Pasteの独立Asset化**:
  - `animation-data-model.js`: `duplicateClipAsset()` を追加し、ClipAsset本体・内部Layer/Folder階層・各DrawingSnapshotを深く複製できるようにした。内部Layerの親子関係は新IDへ張り替え、代表Snapshotと内部LayerSnapshotが同一だった場合は複製側でも同一参照を保つ。
  - `animation-table-popup.js`: セルPaste時にコピー元の `assetId` を共有せず、複製Assetを作って新Clipへ割り当てるよう変更。`transform` / `transformKeyframes` / `physics` は従来通りClipInstanceメタとしてコピーする。
  - 効果: コピーしたCAFを別Frame/Laneへ貼り付けて絵を動かす・描き替える場合に、コピー元や他のコピーと描画内容が同期してしまう経路を抑制。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFセルCopy/Paste導線の追加補修**:
  - `animation-table-popup.js`: CAFセルCopy前に選択CAFの作業Layerを保存し、描画直後にコピーしても最新Snapshotを複製対象にするようにした。
  - `animation-table-popup.js`: Paste中にAsset複製後のセル作成が失敗した場合、Timeline stateをPaste前へ戻して未参照Asset/Snapshotが残らないようにした。
  - `animation-table-popup.js`: Copy/Pasteボタンのdisabled/titleを選択CAF・コピー元・貼り付け先セルの空き状態に合わせて同期し、押しても何も起きない状態を減らした。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFセルCopy/Pasteショートカット追加**:
  - `keyboard-handler.js`: アニメテーブル表示中の `Alt+C` をCAFセルCopy、`Alt+V` をCAFセルPasteへ接続。通常の `Ctrl+C/V` は既存の内部Layer/通常Layer系ショートカットとして残した。
  - `animation-table-popup.js`: `copySelectedCel()` / `pasteCopiedCel()` が成否booleanを返すようにし、Paste可否判定を `canPasteCopiedCel()` に集約。ボタンtitleにも `Alt+C` / `Alt+V` を反映した。
  - アニメテーブル表示中の `Alt+C/V` は実行不可でも通常系へフォールバックさせず吸収し、旧LayerSystem側との混線を避ける。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Asset Library未参照Asset削除導線**:
  - `animation-data-model.js`: `removeClipAsset()` を追加。参照中Assetは通常削除不可にし、未参照Asset削除時は他Assetから参照されていないDrawingSnapshotも合わせて掃除する。
  - `animation-table-popup.js`: Asset LibraryのASSETSヘッダーへ `DEL` ボタンを追加。選択Assetの `Refs` が0の場合だけ有効化し、削除は `caf-asset-delete` としてTimeline Historyへ記録する。
  - 狙い: CAF Paste独立化で増えるコピー素材を、参照が切れた後に明示的に整理できるようにする。参照中Assetの削除はCAFセル消失に直結するため、今回は扱わない。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Asset Library操作のHistory化補強**:
  - `animation-table-popup.js`: Asset Folder作成を `caf-folder-create` としてTimeline Historyへ記録するようにした。
  - `animation-table-popup.js`: Asset移動を `caf-asset-move-folder` としてTimeline Historyへ記録し、移動元/移動先Folder IDをmetaへ残すようにした。
  - `animation-table-popup.js`: Prompt経由のAsset Folderリネームも履歴付き `renameClipAssetFolderFromExternal()` へ委譲し、インライン編集と同じUndo/Redo経路に揃えた。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Asset Library空Folder削除導線**:
  - `animation-data-model.js`: `removeClipAssetFolder()` を追加。Folder内にAssetがある場合は削除不可にし、空Folderだけ削除できるようにした。
  - `animation-table-popup.js`: Asset Folderヘッダーへ `DEL` ボタンを追加。選択Folderが空の場合だけ有効化し、削除は `caf-folder-delete` としてTimeline Historyへ記録する。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Asset Library Asset名変更のHistory化**:
  - `animation-data-model.js`: `renameClipAsset()` を追加し、ClipAsset名をモデル側で変更できるようにした。
  - `animation-table-popup.js`: Asset LibraryのAsset名ダブルクリックで行内input編集できるようにし、変更を `caf-asset-rename` としてTimeline Historyへ記録するようにした。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAF Durationボタン状態同期**:
  - `animation-table-popup.js`: Duration +/- ボタンを選択CAFと伸縮可否に合わせてdisabled/title同期するようにした。CAF未選択、Duration 1以下、後続セル衝突、Timeline末尾到達時は押せない状態にする。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **アニメテーブル閉鎖後のCAF作業Layer漏れ抑制**:
  - `layer-panel-renderer.js`: `isAnimationWorkingLayer` 付きLayer/Folderは、アニメテーブル表示中だけでなく常に通常Layer Panel本体から除外するようにした。CAF内部編集用の一時作業Layer/Folderが、テーブルを閉じた後にCAF外の通常カードとして見える経路を抑制。
  - `animation-table-popup.js`: `hide()` 時のLayer Panel同期をforce更新へ変更し、閉じた直後に旧通常カード表示が残る余地を減らした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **NO FRAME時ショートカット漏れ抑制**:
  - `keyboard-handler.js`: アニメテーブル表示中かつ選択CAFがない状態では、V変形系、反転、リセット、通常上下レイヤー選択ショートカットを旧LayerSystemへ流さず吸収するようにした。CAF外の通常Layer/Folder操作へ落ちる経路を追加で抑制。
  - **確認**: `node --check tegaki_work/ui/keyboard-handler.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **右サイドバー操作のCAF文脈ガード**:
  - `ui-panels.js`: アニメテーブル表示中は、複製/下結合/削除ボタンを通常LayerSystemへフォールバックさせず、選択CAF内部Layer/Folder操作だけへ限定するようにした。CAF未選択時や内部Layer未選択時は何もせず吸収する。
  - `ui-panels.js`: CAF未選択時の水平/垂直反転と変形リセットボタンも旧LayerSystemへ流さないようにした。
  - **確認**: `node --check tegaki_work/ui/ui-panels.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **将来物理演算向けCAFデータ境界メモ**:
  - 方針: `ClipAsset` はPSD互換寄りの絵素材本体として、内部Layer/Folder/Snapshot/opacity/blend/clippingを保持する。X/Y移動・回転・拡縮・キーフレーム・物理演算結果は素材ではなく、タイムライン上の `ClipInstance` / CAFセル側に持たせる。
  - 理由: 同じAssetを複数セルで再利用した時、Asset側に変形値を置くと全配置が同時に変形してしまう。Instance側に置けば、PSD的な絵データを保ったままセルごとの運動・物理キャッシュを持てる。
  - 将来: Asset側にはRig定義や初期姿勢、Instance側には `transform` / `transformKeyframes` / `physics.cacheId` を置く方向が自然。PSD書き出しではAsset内部Layerを優先し、物理/Transformは外部メタまたは焼き込みフレームとして扱う。
  - 補足: X/Y移動だけなら本来は `ClipInstance.transform.x/y` として非破壊に持てるため、ラスター劣化を避けられる。現行V変形のCAF内部Layerスナップショット保存は統合途中の暫定経路であり、将来は移動/回転/拡縮をInstance transformへ逃がし、必要時だけ焼き込む形へ差し替える。
- **ClipInstance変形メタの保存器追加**:
  - `animation-data-model.js`: `ClipInstanceModel` に `transform`（x/y/scaleX/scaleY/rotation/anchorX/anchorY）、`transformKeyframes`、`physics`（enabled/rigId/cacheId）を追加。現時点では描画反映せず、保存・履歴復元・将来拡張用のデータ器に限定。
  - `animation-table-popup.js`: CAFセルCopy/Paste時に `transform` / `transformKeyframes` / `physics` を落とさないようにした。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **ClipInstance変形メタAPI追加**:
  - `animation-data-model.js`: `setClipTransform()` / `setClipTransformKeyframes()` / `setClipPhysics()` を追加し、将来のUI・物理演算側がCAFセル単位の配置/運動メタを更新できる入口を作った。
  - `animation-data-model.js`: `getFrameAssetTree()` のClipEntryに `transform` / `transformKeyframes` / `physics` を含め、Preview/Export/物理演算側がAsset絵素材とInstance運動メタを分けて参照できるようにした。
  - **確認**: `node --check tegaki_work/system/animation/animation-data-model.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **ClipInstance変形メタの履歴付き外部入口**:
  - `animation-table-popup.js`: `updateClipTransformFromExternal()` / `updateClipTransformKeyframesFromExternal()` / `updateClipPhysicsFromExternal()` を追加。将来の変形UI・物理演算エンジンからCAFセル単位のメタを更新し、Timeline Historyへ `caf-clip-transform` / `caf-clip-transformKeyframes` / `caf-clip-physics` として記録できる入口を用意した。
  - 現時点では描画反映は行わず、更新後の選択・再描画・Layer Panel同期・Undo/Redo復元経路を揃えるための接続に限定。
  - **確認**: `node --check tegaki_work/ui/animation-table-popup.js` / `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **Vite build復旧**:
  - `vite.config.js`: Vite 8 / Rolldown環境で、デフォルトHTML入力がWindows絶対パスの `index.html` を emitted fileName として扱い `npm.cmd run build` が失敗する経路を抑制するため、Rollup入力を相対名の `index: 'index.html'` として明示。
  - **確認**: `npm.cmd run build` 成功。検証で生成された `dist` のハッシュ生成物は作業差分から除外済み。
- **CAFミラー名前編集の入力分離**:
  - `layer-panel-renderer.js`: CAF内部Layer/Folderミラーの名前部分をD&D開始対象から除外し、ダブルクリックでインライン編集へ入れるよう補修。内部Folderの開閉はサムネイル/フォルダアイコン側クリックに限定し、名前中央クリックで開閉しないようにした。
  - `layer-panel-renderer.js`: `F2` で選択中CAF内部Layer/Folderの名前をインライン編集できる経路を追加。通常Layer/Folder名も名前部分のイベントを行クリック/SortableJSから分離。
  - `layer-panel-renderer.js`: CAF内部Folderのサムネイル/フォルダアイコン上ではD&D用 `pointerdown` を開始しないようにし、開閉クリックが殺される経路を補修。通常Folderサムネイルも `pointerdown` を行D&Dへ渡さないようにした。
  - `keyboard-handler.js`: 共通キーボードハンドラのFキー抑制から `F2` を除外し、レイヤーパネル側の名前編集ショートカットへ届くようにした。
  - **確認**: `node --check tegaki_work/ui/layer-panel-renderer.js` / `node --check tegaki_work/ui/keyboard-handler.js` 成功。`npm.cmd run build` は Vite/Rolldown の `index.html` emitted fileName 絶対パス扱いエラーで失敗（コード変換は完了、distは復元）。
- **作業LayerのLane誤輸入抑制**:
  - `animation-data-model.js`: `TimelineModel.syncWithLayers()` で `isAnimationWorkingLayer` を通常Lane生成対象から除外。CAF内部Layer編集用の一時作業Layerが、通常Layer由来Laneとして再輸入される経路を止めた。
- **ClipAsset同期先の絞り込み**:
  - `animation-table-popup.js`: アニメ作業Layerが存在する場合、ClipAssetの復元・保存・内部Layer選択同期は `isAnimationWorkingLayer` 付きLayerだけを対象にするよう変更。初回Seed前は従来通り通常表示Layerを取り込めるようfallbackを残した。
  - `animation-table-popup.js`: 内部Layer追加で作られた不足分の作業Layerへ即座に `isAnimationWorkingLayer` を付け、通常Layer/通常Lane側へ混ざらないようにした。
- **Layer Panelゴースト表示抑制**:
  - `layer-panel-renderer.js`: アニメテーブル表示中かつ選択Clip/空Frame文脈では、背景以外の旧通常Layer/通常FolderをLayer Panel本体へ出さず、CAF/内部Layerミラーを正面に出す方針へ寄せた。
- **通常FolderのCAF内部取り込み**:
  - `animation-table-popup.js`: アニメテーブル初回Seed/ClipAsset作成時に、通常Folderを `ClipAssetInternalLayerModel` の `type: 'folder'` として取り込むよう補修。通常Layerの `parentId` はCAF内部の `parentLayerId` へID変換して保持する。
  - `animation-table-popup.js`: Preview合成、作業Layer復元、内部Layer選択同期は `type: 'folder'` を描画対象から除外し、ラスター内部Layerだけを作業Layerへ割り当てるよう補修。
  - `animation-data-model.js`: 内部Layer追加時に `visible` / `opacity` / `blendMode` / `clipping` / `parentLayerId` を受け渡せるよう補強し、削除ガードは「最後の描画Layer」を守る判定へ変更。
  - `layer-panel-renderer.js`: CAF内部Layerミラーで `type: 'folder'` をフォルダ行として表示し、ラスター用のクリッピングボタンを出さないようにした。
  - `layer-panel-renderer.js` / `animation-table-popup.js` / `styles/main.css`: `parentLayerId` から内部Layer階層の深度を計算し、CAF内部ミラーとAsset Library Inspectorの両方で子Layerをインデント表示するよう補修。開閉やD&D収納は未実装のまま、まず排出表示を減らす段階に限定。
- **削除即時反映補修**:
  - `animation-table-popup.js`: CAF内部Layer/Folder削除後に選択Clipの作業Layerへ即時再同期し、Frame移動を挟まないと削除状態が反映されない経路を補修。
  - `animation-data-model.js`: 内部Folder削除時に子Layerの `parentLayerId` を解除し、存在しない親へのぶら下がりを残さないようにした。
- **Frame移動時のCAF内部Folder消失補修**:
  - `animation-table-popup.js`: Frame移動前の自動保存で作業LayerからClipAssetを再キャプチャする際、既存CAF内部Folderを保持し、再キャプチャしたラスターLayerだけを既存描画Layerスロットへ反映するマージ処理を追加。保存のたびに `internalLayers` 全体をラスターだけで置換してFolder階層が消える経路を止めた。
- **Lane=Layer旧仕様の初期同期抑制**:
  - `animation-data-model.js`: 初回 `syncWithLayers()` で通常ラスターレイヤー数ぶんLaneを作る旧挙動を止め、アクティブまたは先頭のラスターレイヤー1本だけをLane足場として作るよう変更。通常Layer/Folder群はClip内部Z軸として取り込む。
  - `animation-data-model.js`: `isAnimationWorkingLayer` はlive source扱いから外し、CAF同期後のFrame移動/再renderで既存Clipを持つLaneが消える経路を抑制。
- **Laneアクティブ選択補修**:
  - `animation-table-popup.js`: セルクリック時に `activeLaneId` だけでなく `track.active` も同期する `_setActiveLane()` を追加し、ショートカットキー以外でもLaneをアクティブ化できるよう補修。
  - `animation-table-popup.js`: active表示判定を `track.active || track.id === activeLaneId` にし、Lane 1を含む全Laneで行/列ハイライトが分かるよう背景指定を補強。
  - `animation-table-popup.js`: 新規Lane追加時にSET再生対象へ自動追加していた処理を停止。新規Laneはアクティブ化のみ行い、緑チェックはユーザー操作で明示ONにする。
  - `animation-table-popup.js`: 新規Lane追加がアクティブLaneを奪わないよう変更。Scope LANEの対象も選択Clip優先ではなく `activeLaneId` 優先へ寄せ、UI上のLane選択とPreview対象がズレる経路を抑制。
- **CAF内部Folder新規作成の最小接続**:
  - `animation-data-model.js`: `addClipAssetInternalFolder()` を追加し、ClipAsset内部に `type: 'folder'` の内部Folderを作れるようにした。
  - `animation-table-popup.js`: 選択中ClipAssetへ内部Folderを追加する `addInternalFolder()` を追加。
  - `ui-panels.js`: アニメ文脈かつ選択Clipがある場合、右サイドバーのFolder `+` を通常Folder作成ではなくCAF内部Folder作成へ分岐。D&D/開閉は未実装。
- **CAF内部Folder配下作成の最小接続**:
  - `animation-table-popup.js`: CAF内部Folderを選択した状態でLayer `+` / Folder `+` を押すと、そのFolderの `parentLayerId` を持つ内部Layer/Folderとして追加されるようにした。子Layer選択時は同じ親Folder配下へ兄弟追加する。
  - `animation-table-popup.js`: CAF内部Layer/Folder新規作成をHistoryへ `record()` するようにした。Undo/Redo時は対象ClipAssetの `internalLayers` / `drawingSnapshots` をbefore/after状態へ復元し、Layer Panelを即時flushする。
- **CAF内部Folderの可視性継承**:
  - `animation-table-popup.js`: Preview合成と作業Layer同期で、内部Layer自身だけでなく親Folder列の `visible` も見て有効可視性を判定するようにした。Folderの目OFFで配下LayerがCanvas/Previewから消える。
  - `layer-panel-renderer.js`: CAF内部Layerミラーでも親Folderが非表示の子Layer/子Folderを薄表示扱いにし、見た目と描画結果がズレにくいようにした。
  - `animation-table-popup.js`: CAF内部Layer/Folderの可視ON/OFFをHistoryへ `record()` し、Undo/Redo時に可視状態を即時復元するようにした。
- **CAF/内部Layer可視トグル同期補修**:
  - `animation-table-popup.js`: 内部Layer/Folderの可視トグル後に、選択Layerのアクティブ化だけでなく選択Clip全体を作業Layerへ再同期するよう修正。最新Layer以外の目OFFがCanvasへ反映されない経路を抑制。
  - `animation-table-popup.js`: CAF自体の目OFFも作業Layer可視状態へ反映し、Clip単位の非表示時は配下の全内部Layerを非表示として同期するようにした。
  - `animation-table-popup.js`: CAF本体の可視ON/OFFをHistoryへ `record()` し、Undo/Redo時にClip可視状態を即時復元するようにした。
- **CAF内部Layerクリッピング反映補修**:
  - `animation-table-popup.js`: 内部Layerの `clipping` を作業Layerへ同期した後に `LayerSystem.refreshClippingMasks()` を呼び、CAF内部カードの紙クリップ操作が実Canvasへ反映されるようにした。
  - `animation-table-popup.js`: CAF内部Preview合成でも、同じ親Folder配下の直下ラスターLayerをマスク元として使う最小クリッピング処理を追加。親Folderが違うLayerにはクリッピングしない。
  - `animation-table-popup.js`: CAF内部Layer/FolderのクリッピングON/OFFをHistoryへ `record()` し、Undo/Redo時に即時復元するようにした。
- **CAF内部Layerリネーム導線接続**:
  - `layer-panel-renderer.js`: CAF内部カードの名前部分をダブルクリックした時、既存の `renameInternalLayerFromExternal()` へ委譲して内部Layer/Folder名を変更できるようにした。通常Layer用DOMやSortableJSには混ぜない。
  - `animation-table-popup.js`: CAF内部Layer/Folder名変更をHistoryへ `record()` し、Undo/Redo時に名称変更前後のCAF内部構造を即時復元するようにした。
- **CAF内部Layer属性パネル逆同期**:
  - `animation-table-popup.js`: アクティブ作業Layerの不透明度・合成モード・クリッピング変更イベントを購読し、対応するCAF内部Layerの `opacity` / `blendMode` / `clipping` へ戻すようにした。属性パネル操作がFrame移動でCAF内部値に戻される経路を抑制。
  - `animation-table-popup.js`: CAF内部Layerから作業Layerへ戻す同期でPixiコンテナの `alpha` / `blendMode` も更新し、属性変更後は選択Clip全体を即時再同期してLayer Panelをflushするよう補修。透明度・合成モード変更がFrame/Lane移動まで見た目に安定しない経路を抑制。
- **CAF内部Layer順序変更の即時同期**:
  - `animation-table-popup.js`: Asset Library Inspectorの内部Layer上下ボタン操作後、選択Clip全体を作業Layerへ再同期するようにした。順序変更がFrame/Lane移動までCanvas側へ反映されない経路を抑制。
  - `animation-table-popup.js`: CAF内部Layer上下移動をHistoryへ `record()` し、Undo/Redo時に移動前後のCAF内部構造を即時復元するようにした。
- **未修正・要調査**:
  - Vキー変形でアクティブLayerを移動/拡縮して確定した後、Canvas上の画像表示が固定され、Space+ドラッグのキャンバス移動、Frame移動による表示更新、通常描画のCanvas反映が止まる場合がある。描画してもLayer Panelサムネイルだけが更新される。次に扱う場合は `LayerSystem.confirmLayerTransform()` / `LayerTransform.exitMoveMode()` / 変形確定後の入力状態・RenderTexture復帰を起点に切り分ける。
- **Vキー変形確定後の入力固着ガード**:
  - `layer-system.js`: `exitLayerMoveMode()` を `try/finally` 化し、変形焼き込み・履歴記録・snapshot処理の途中で失敗しても必ず `LayerTransform.exitMoveMode()` と `cameraSystem.setVKeyPressed(false)` を実行するようにした。V変形確定後にSpace+ドラッグや描画入力がVモード扱いで固着する経路の止血。
- **アニメパネル展開中の描画/History同期補修**:
  - `history.js`: `history:changed` に `action` / `commandName` / `meta` を載せ、Undo/Redo/record後に対象Layerを判定できるようにした。
  - `animation-table-popup.js`: アニメ作業Layerに対するHistory record/undo/redo後、選択Clipを作業LayerからCAF内部Snapshotへ再保存し、Previewを更新するようにした。Undo/Redo後にPreviewだけ古いCAF画像を見続ける経路を抑制。
  - `animation-table-popup.js`: 描画完了時のCAF保存はアニメ作業Layerで描いた場合に限定し、通常Layer操作が選択CAFへ吸われる経路を抑制。
  - `animation-table-popup.js`: 既存CAFを保存し直す時は、非表示のアニメ作業Layerも内部Layer数ぶんキャプチャ対象に含めるよう変更。Folder/Layerの非表示状態で保存した時に内部Layerが詰まり、絵が削除・入れ替わる経路を抑制。
- **アニメPreview中のV変形衝突抑制**:
  - `animation-table-popup.js`: Vキー変形開始時にアニメPreviewを一時停止して作業Layer表示へ戻し、変形終了時に作業LayerからCAF内部Snapshotへ保存してPreviewを復帰するようにした。Preview snapshotと変形対象RenderTextureが分裂し、アニメパネル表示中だけ旧画像/空画像が出る経路を抑制。
- **V変形確定直後の旧CAF Preview復帰補修**:
  - `animation-table-popup.js`: 変形中の `history:changed` ではCAF保存を走らせず、`layer:transform-exit` の次フレームで作業LayerからCAFへ保存してからPreviewを復帰するようにした。確定直後だけ古いCAF snapshotへ戻り、パネルを閉じると変形済み実Layerが見える分裂を抑制。
  - `animation-table-popup.js`: CAF保存時にsnapshot texture cacheを無効化し、同Frame内の再描画で古いPreviewテクスチャを再利用しないようにした。
- **初回アニメパネル展開直後の作業Layer同期補修**:
  - `animation-table-popup.js`: 初回CAF/Clip自動Seed直後に `_syncClipAssetToWorkingLayers()` を実行し、Frame/Lane移動を待たずに既存Layerをアニメ作業Layerとしてフラグ付け・同期するようにした。初回のペン描画/変形だけCAF保存やPreview反映が走らない経路を抑制。
- **アニメパネル再展開時の作業Layer吸い上げ**:
  - `animation-table-popup.js`: パネルを閉じている間にアニメ作業Layerへ入った通常描画/操作を、再展開時の `render()` 前に `_saveSelectedClipFromWorkingLayers()` でCAFへ保存するようにした。再オープン直後に古いCAF snapshotが作業Layerの最新状態を隠す経路を抑制。
- **CAF内部Folder開閉表示**:
  - `layer-panel-renderer.js` / `styles/main.css`: CAF内部ミラーのFolder行クリックで子孫内部Layer/Folderを開閉表示できるようにした。開閉状態はLayer Panel側の表示状態に限定し、ClipAsset内部構造やD&D順序は変更しない。
- **CAF内部Folder開閉時の選択維持**:
  - `layer-panel-renderer.js`: CAF内部Folder行をクリックして開閉する際、同時にそのFolderを `selectedInternalLayerId` として選択するようにした。開閉導入後もLayer `+` / Folder `+` が選択中Folder配下へ追加される導線を維持。
- **CAF内部Folder削除の通常Folder寄せ**:
  - `animation-data-model.js`: CAF内部Folder削除時、通常LayerSystemのFolder削除に近く、子孫の内部Layer/Folderも再帰削除するようにした。Folder削除で全描画Layerが消える場合は、CAFを空のままにせず新しい空ラスタ内部Layerを1枚補充する。
  - `animation-table-popup.js`: 再帰削除で選択中の子孫Layerが消えた場合も、選択内部Layerを残存描画Layerまたは補充Layerへ戻すようにした。
  - `animation-table-popup.js`: 削除後はイベント待ちだけでなくLayer Panel Rendererを即時flushし、Frame/Lane移動を挟まないとCAFミラー表示が消えない経路を補修。
  - `ui-panels.js`: アニメパネル表示中の右サイドバー削除は、通常 `LayerSystem.deleteLayer()` ではなく選択中CAF内部Layer/Folderの `removeInternalLayer()` へ委譲するようにした。
  - `animation-table-popup.js`: `layer:deleted` 受信時も選択Clipを保存して即時render/Layer Panel flushを行い、削除表示の1ターン遅れを抑制。
  - `animation-table-popup.js`: CAF内部Layer/Folder削除をHistoryへ `record()` し、Undo/Redo時に削除前後のCAF内部構造を即時復元するようにした。Cut時も削除履歴ではなくCut履歴名で同じ復元経路に乗せる。
- **CAF内部Layer/Folder複製の最小接続**:
  - `animation-data-model.js`: `duplicateClipAssetInternalLayer()` を追加。内部LayerはSnapshotを複製して別ID化し、内部Folderは子孫Layer/Folderごと複製して親子関係を新IDへ張り替える。
  - `animation-table-popup.js` / `ui-panels.js`: アニメパネル表示中の右サイドバー複製を、通常Layer複製ではなく選択中CAF内部Layer/Folder複製へ委譲し、複製後に作業LayerとLayer Panelを即時同期する。
  - `animation-table-popup.js`: CAF内部Layer/Folder複製・PasteをHistoryへ `record()` し、Undo/Redo時に複製/貼り付け前後のCAF内部構造を即時復元するようにした。
- **CAF内部FolderクリッピングPreview**:
  - `layer-panel-renderer.js`: CAF内部Folderにも紙クリップボタンを表示し、Layerと同じ `toggleInternalLayerClippingFromExternal()` へ接続するようにした。
  - `animation-table-popup.js`: 内部Layer自身または親Folderの `clipping` をPreview合成時に解決し、直下の次Layer/Folderをマスク元として使うようにした。マスク元がFolderの場合は、その子孫ラスターLayerを合成したマスクとして扱う。
  - `animation-table-popup.js`: Folderクリッピング切替時は選択Folderを維持し、作業Layer同期で選択が先頭Layerへ戻る経路を避けるようにした。
- **CAF内部作成位置補修**:
  - `animation-data-model.js`: 内部Layer/Folder追加時、単純に末尾へpushせず、選択Layer/Folderの子孫ブロック直後へ挿入するようにした。親Folderが選択されている場合は、そのFolder配下の末尾に入る。
  - `animation-table-popup.js`: 内部Layer/Folder追加時に `insertAfterLayerId` として現在の選択内部Layerを渡し、アクティブ選択と作成位置がズレないようにした。
- **CAF内部Layer D&Dの最小接続**:
  - `layer-panel-renderer.js` / `styles/main.css`: CAF内部Layerミラー行だけを対象に、SortableJSを使わないPointer EventsベースのD&Dを追加。半透明ゴースト追従、前後挿入ライン、Folder内投入ハイライトを表示する。
  - `animation-table-popup.js`: CAF内部Layer/FolderをD&Dで前後移動またはFolder内へ移動する `moveInternalLayerToPosition()` を追加。移動対象の子孫ブロックはまとめて移動し、移動先が自身の子孫の場合は拒否する。
  - `animation-table-popup.js`: CAF内部D&D移動をHistoryへ `record()` し、Undo/Redo時に移動前後のCAF内部構造を即時復元するようにした。
  - `layer-panel-renderer.js` / `styles/main.css`: D&Dゴーストの追従更新を `left/top` 変更から `translate3d()` へ変更し、レイアウト再計算を減らした。
- **CAF文脈の順序ショートカット整理**:
  - `keyboard-handler.js`: アニメパネル表示中のLayer順序上げ/下げショートカットを通常 `LayerSystem` の `layer:order-up/down` へ流さず、CAF内部Layer/Folderの `moveInternalLayer()` へ委譲するようにした。
  - `animation-table-popup.js`: CAF内部Layer/Folderの上下移動を、単純な隣接要素swapではなく子孫ブロック単位の移動へ変更。Folder移動で子Layer/子Folderが置き去りになる経路を抑制。
- **未修正・要調査**:
  - CAF本体/内部Layer/Folderの表示・非表示トグルが遅く感じる。CAF全体の同期/Preview再生成が重いのか、可視トグル時のLayer Panel flushやSnapshot保存だけが局所的に重いのか、D&D後の足回り点検で切り分ける。
- **描画後CAF同期の重複抑制**:
  - `animation-table-popup.js`: アニメ作業Layerへのペン描画後、`draw-*` のHistory recordと `drawing:stroke-completed` の両方でCAF保存/Preview更新が走る経路を整理。描画record時はHistory側同期をスキップし、stroke completed側のCAF保存に一本化した。
  - `animation-table-popup.js`: `drawing:stroke-completed` 内のLayer Panel同期要求を、`_captureSelectedClip()` 内の既存同期に任せるようにして二重発火を減らした。描画後に表示/非表示トグルが重くなる問題の一次切り分け。
- **CAF内部Layer属性スライダーの過剰同期抑制**:
  - `animation-table-popup.js`: アクティブ作業Layerの透明度/合成/クリッピング変更をCAF内部Layerへ戻す際、入力イベントごとの作業Layer全再同期・Preview即render・Layer Panel強制flushをやめ、内部属性の即時更新と次フレームのPreview/Panel更新へ分離した。属性パネルのスライダー操作が重くなる経路を軽減。
- **アニメ作業Layerサムネイル生成の抑制**:
  - `thumbnail-system.js`: `isAnimationWorkingLayer` 付きの一時作業Layerでは通常Layer用サムネイル生成をスキップするようにした。CAFミラーはClipAsset Snapshotからサムネイルを描くため、ペン描画ごとのPixi全ピクセル抽出/PNG化を避ける。
- **Preview中描画の表示経路整理**:
  - `animation-table-popup.js`: アニメPreview ON中に作業Layerへ描画を開始した場合、`drawing:stroke-started` でCAF Previewを一時解除し、実作業Layer表示へ戻すようにした。Preview合成結果を見ながら裏の作業Layerへ描いて、stroke完了後まで反映されない二重表示状態を避ける。
  - `animation-table-popup.js`: 描画中だけ `isDrawingPreviewSuspended` を立て、通常の `render()` が走ってもPreviewを再適用しないようにした。stroke中に実Layer表示とCAF Previewが交互に出て点滅する経路を抑制。
  - `animation-table-popup.js`: `animationSnapshotId` による同一Snapshot復元スキップを、描画開始時に対象作業LayerのSnapshot IDを必ず無効化し、ClipAsset保存後だけ新Snapshot IDを刻む形で再導入。Layer/Folder追加時に未変更の既存Layerを再ラスタライズして線が太る/新規Layer作成が重くなる経路を抑制する。
  - `animation-table-popup.js`: CAF内部HistoryのUndo/Redo復元では `forceRestore` を使い、Snapshot IDが同じでも履歴上のピクセル差分を必ず作業Layerへ戻すようにした。
  - `animation-table-popup.js`: Preview適用時に通常Track紐づきLayerだけでなく `isAnimationWorkingLayer` 付きのCAF作業Layerも非表示化するよう補修。stroke完了後にCAF Previewと作業Layerが重なり、描画中より線が太く見える経路を抑制。
  - `animation-table-popup.js`: 空Frame同期で作業Layerを空にした時、直前CAFの `animationSnapshotId` と `parentId` も消すよう補修。空Frame上でLayer選択/順序系ショートカットを触った後、元Frameへ戻ると「同一Snapshotなので復元不要」と誤判定して描画物が空のまま残る経路を抑制。
  - `keyboard-handler.js`: アニメパネル表示中は、選択Clipがない空FrameでもLayer作成/削除/コピー/順序変更系ショートカットを通常LayerSystemへ流さず吸収するよう補修。CAF作業Layerを空Frame上で通常レイヤーとしてZ移動してしまう経路を止めた。
- **CAF描画HistoryのAsset境界化**:
  - `brush-core.js`: `isAnimationWorkingLayer` 付き作業Layerへの描画では通常Layer用の `draw-*` ラスター履歴を積まないようにした。CAF間で使い回す作業Layer IDだけを持つ履歴が、別CAF選択中のUndo/Redoで混信する経路を止めた。
  - `animation-table-popup.js`: CAF作業Layerへの描画開始時に対象ClipAssetの内部Layer状態を保存し、描画完了後は `caf-internal-layer-draw` としてAsset単位の履歴を積むようにした。Undo/RedoはClipAsset IDとClip IDを持つ状態復元で行う。
  - `animation-table-popup.js`: CAF内部履歴stateに `selectedCelId` を追加し、Undo/Redo時は対象Clipへ選択/Frame/Laneを戻してから作業Layerへ復元するよう補修。CAF1の履歴をCAF2選択中に適用して描画が移る経路を抑制。
  - `animation-table-popup.js`: `history:changed` の後追い保存はCAF内部履歴では実行しないようにした。復元処理自身が作業Layer同期まで行うため、イベント後に現在選択CAFへ再保存して混ぜる経路を避ける。
  - `animation-table-popup.js`: CAF内部履歴復元時、作業Layerへforce restoreする前にPreview表示を一度解除して残存Previewコンテナを消すようにした。Undo/Redo直後に消えたはずの描画が一瞬残る残像経路を軽減。
  - `animation-table-popup.js`: Frame/Lane移動前の自動保存は、作業Layerの `animationSnapshotId` が対象CAF内部Snapshotと一致している場合スキップするようにした。Undoで復元済みの空/旧状態を、移動時に再キャプチャしてゴーストをCAFへ戻す経路を抑制する。V変形確定時だけは対象LayerをDirty化して強制保存する。
  - `animation-table-popup.js`: CAF内部履歴stateに対象CAFだけでなく全 `clipAssets` のserialize結果を含め、Undo/Redo時は全CAFの内部Layer参照を同じ履歴地点へ戻すよう補修。Snapshot配列だけ巻き戻り、他CAFの内部Layerが古い描画Snapshot IDを参照し続けてCanvas上にゴースト表示される経路を抑制。
- **Folderマスク合成補修**:
  - `animation-table-popup.js`: マスク元Folderが複数子Layerを持つ場合、Containerを直接maskにせず一度RenderTextureへ合成したSpriteをマスクに使うようにした。Folder内Layer同士のクリッピングが通常Layer同士と同じ見え方に近づく。
  - `animation-table-popup.js`: CAF PreviewのマスクSpriteを `renderable=false` にしないよう変更。Pixi側でマスク描画パスまで無効化され、マスク境界だけ見えて対象の外側が残る経路を抑制。
  - `animation-table-popup.js`: マスクSpriteをPreview表示ツリーへ通常追加しないよう変更。マスク元Layer/Folder自体が可視描画として混ざり、逆マスクのように見える経路を抑制。
  - `animation-table-popup.js`: 単一Layerマスクも含めてRenderTexture化したマスクSpriteを使うよう統一。
  - `animation-table-popup.js`: CAF PreviewではPixi maskへの依存をやめ、対象Snapshotのalphaをマスク元Snapshot群のalphaで直接乗算する方式へ変更。Folder間クリッピングで表示順が逆転したように見える経路を避ける。
  - `animation-table-popup.js`: Folderマスクの弱い漏れを抑えるため、Preview用alphaマスクに閾値を追加。低alphaの線や薄い境界がマスクとして赤を浮かび上がらせる経路を抑制。
- **保留判断**:
  - CAF内部Folder間クリッピングは、マスク対象/マスク元の子Layer選別仕様が未確定で場当たり調整になりやすいため一時凍結。外部設計レビュー後に再開する。
- **CAF文脈の下結合導線整理**:
  - `ui-panels.js`: アニメパネル表示中の右サイドバー下結合が通常 `LayerSystem.mergeLayerDown()` へ流れないよう止めた。CAF内部Layer/Folderの下結合仕様が未定の間、作業Layerだけが結合されCAF内部Snapshotと分裂する経路を抑制。
  - `animation-table-popup.js` / `ui-panels.js`: アニメパネル表示中の右サイドバー下結合をCAF内部Layer用に接続。選択中の内部ラスタLayerを、同じ親Folder配下で直下にある内部ラスタLayerへCanvas合成して焼き込み、元Layerを削除する。Folder選択や下に同階層ラスタLayerがない場合は何もしない。
  - `animation-table-popup.js`: CAF内部下結合をHistoryへ `record()` し、Undo/Redo時は対象ClipAssetの `internalLayers` と `drawingSnapshots` をbefore/after状態へ復元するようにした。通常Layer履歴ではなくCAF内部構造単位で戻す。
- **CAF文脈のキーボード導線整理**:
  - `keyboard-handler.js`: アニメパネル表示中の `Ctrl+L` は通常Layer作成ではなくCAF内部Layer追加へ委譲するようにした。
  - `keyboard-handler.js`: アニメパネル表示中の `Ctrl+Delete` は通常Layer削除ではなく選択中CAF内部Layer/Folder削除へ委譲するようにした。
  - `keyboard-handler.js` / `animation-table-popup.js`: アニメパネル表示中の `Delete` / `Backspace` は通常作業Layerのラスタだけを消すのではなく、選択中CAF内部LayerのSnapshotを空Snapshotへ差し替えるようにした。Folder選択時は未定義操作として何もしない。
  - `animation-table-popup.js`: `Delete` / `Backspace` で選択セル自体を削除していたアニメテーブル側keydown処理を削除。KeyboardHandler側の「絵だけ削除」と二重発火し、CAF/Layer/Laneが消える経路を止めた。
  - `keyboard-handler.js`: アニメパネル表示中の `Delete` / `Backspace` 処理後に `stopImmediatePropagation()` し、他のkeydownリスナーへ伝播しないようにした。
  - `animation-table-popup.js`: CAF内部Layerの描画クリアをHistoryへ `record()` し、Undo/Redo時にクリア前後のSnapshotを即時復元するようにした。
- **CAF内部Layer/Folderクリップボード**:
  - `animation-table-popup.js`: CAF内部Layer/Folder用の一時クリップボードを追加。LayerはSnapshot込み、Folderは子孫Layer/Folder込みでコピーできるようにした。
  - `animation-table-popup.js`: Paste時は新IDと新Snapshotで現在選択位置付近へ再生成し、親子関係も新IDへ張り替える。Cutはコピー後に既存のCAF内部削除経路へ委譲する。
  - `keyboard-handler.js`: アニメパネル表示中の `Ctrl+C` / `Ctrl+V` / `Ctrl+X` を通常LayerクリップボードではなくCAF内部Layer/Folderの copy/paste/cut へ委譲するようにした。
- **CAFセル作成/削除のHistory化**:
  - `animation-table-popup.js`: Alt+ClickによるCAF/Clipセル作成・削除を `caf-clip-create` / `caf-clip-delete` としてHistoryへ記録するようにした。
  - `animation-table-popup.js`: Undo/Redo時は `TimelineModel` の `tracks` / `clipAssets` / `clipAssetFolders` / `drawingSnapshots` / `playback` と選択状態をまとめて復元し、内部Layer履歴とは別にFrame/Lane上のCAF配置を戻せるようにした。
  - `animation-table-popup.js`: CAFセル作成/削除の履歴取得前に選択中CAFの作業Layerを保存し、直前描画の保存とセル操作履歴が混線しないようにした。
- **アクティブCAF削除導線**:
  - `animation-table-popup.js`: アニメテーブル上部に選択CAF削除用のゴミ箱ボタンを追加し、選択CAFがない時はdisabledにするようにした。
  - `animation-table-popup.js`: `Alt+Delete` / `Alt+Backspace` でアクティブCAFを削除できるようにした。削除は `caf-clip-delete` のTimeline History経路へ乗せ、Undo/Redoで作成前後のCAF配置・選択状態を復元する。
  - `animation-table-popup.js`: 既存セルへのAlt+Click削除も同じ `deleteSelectedClip()` 経路へ集約し、履歴と作業Layer保存の挙動を揃えた。
  - `keyboard-handler.js`: `Alt+Delete` / `Alt+Backspace` は通常Keymap判定より前でCAF削除へ分岐するよう補修。共通Delete処理に吸われてアニメテーブル側keydownへ届かない経路を止めた。
- **CAFセル操作のHistory化拡張**:
  - `animation-table-popup.js`: CAFセルPasteを `caf-clip-paste` としてTimeline Historyへ記録するようにした。Paste先Laneは旧Layer逆引きではなく `activeLaneId` を正本として使う。
  - `animation-table-popup.js`: Duration +/- ボタン変更を `caf-clip-duration` としてHistoryへ記録するようにした。
  - `animation-table-popup.js`: セル右端ドラッグのリタイミングを `caf-clip-retime`、セル本体ドラッグ移動を `caf-clip-move` としてHistoryへ記録するようにした。開始前に選択CAFの作業Layerを保存し、失敗/同位置ドロップでは履歴を増やさない。
- **アニメテーブル左上軸ラベル整理**:
  - `animation-table-popup.js`: 左上ヘッダーを単なる `LANES` 表記から、中央付近のバックスラッシュ区切り付き `+ Lanes` / `Timeline` 表示へ変更。X=Timeline、Y=Lanes の2次元盤面であることを明示した。
  - `animation-table-popup.js`: Lane追加 `+` は `Lanes` 側ラベルの左へ移し、Timeline側操作に見えないようにした。
- **Lane追加のHistory化**:
  - `animation-table-popup.js`: `+ Lanes` による独立Lane追加を `caf-lane-create` としてTimeline Historyへ記録するようにした。追加前に選択CAFを保存し、追加後は新Laneをアクティブ化して空Frame同期まで行う。
- **Lane削除のHistory化**:
  - `animation-table-popup.js`: `- Lanes` ボタンを追加し、アクティブLaneを中のCAFセルごと削除できるようにした。最後の1Laneはdisabledで削除不可。
  - `animation-table-popup.js`: Lane削除を `caf-lane-delete` としてTimeline Historyへ記録し、Undo/RedoでLane上のCAFセルや選択状態ごと復元するようにした。
  - `animation-table-popup.js`: Timeline History stateに `includedLaneIds` / `playbackScope` を含め、Lane削除/復元時にSET対象チェックが置き去りにならないようにした。
- **Lane操作UIの誤爆抑制**:
  - `animation-table-popup.js`: `- Lanes` を撤去し、アクティブLane削除を上部操作群のゴミ箱ボタンへ移した。Lane削除は軽い `-` ではなく明示的な削除操作として扱う。
  - `animation-table-popup.js`: Lane左パネル行クリックで「Laneのみ選択」できるようにした。この状態ではCAF選択を解除し、作業Layerを空にしてPreview合成も止めるため、NO CAF相当の表示になる。
  - `animation-table-popup.js`: 各LaneのSET対象ボタンを右端の薄いチェック枠へ移し、ScopeがSETの時だけ操作可能にした。Lane追加 `+` との誤認を抑制する。
- **Lane単独選択と共有ゴミ箱補修**:
  - `animation-table-popup.js`: CAF削除用とLane削除用に分かれていた上部ゴミ箱を共有化。CAF選択中はCAF削除、Lane単独選択中はアクティブLane削除として動作する。
  - `animation-table-popup.js`: Lane単独選択状態をTimeline History stateへ含め、Lane追加/削除/Undo/Redo後もCAF未選択・空Frame表示を維持するよう補修。
  - `animation-table-popup.js`: Lane単独選択中はTimelineの現在Frame列ハイライトを消し、CAFセル未選択状態がUI上でも分かるようにした。
  - `keyboard-handler.js`: `Alt+Delete` / `Alt+Backspace` を共有削除入口へ委譲し、CAF選択中とLane単独選択中の削除ショートカットを同一経路に揃えた。
- **Lane単独選択の視認性補修**:
  - `timeline-ui.js`: Lane単独選択中は右上のFrame表示を `NO FRAME` にし、左右Frame移動ボタンもdisabledにするようにした。
  - `animation-table-popup.js`: 左Lane行のアクティブ表示を左線だけでなくオレンジ内枠でも示し、時間セルではなくLane軸側が選択されていることを見分けやすくした。
- **Lane名変更と枠表示調整**:
  - `animation-table-popup.js`: 左Lane行のオレンジ内枠はLane単独選択時だけ出すようにし、通常のアクティブLane表示は従来の縦棒と行色に戻した。
  - `animation-table-popup.js`: Lane名をダブルクリックで変更できるようにした。変更は `caf-lane-rename` としてTimeline Historyへ記録し、Undo/Redo対象にした。
  - `animation-table-popup.js`: Lane名ダブルクリック時に通常クリック側のrenderでDOMが差し替わり、名前変更へ入れない経路を抑えるため、`click` の `detail >= 2` で名前変更を起動するよう追修正。
- **名前変更UIのインライン化**:
  - `animation-table-popup.js`: アニメテーブル左端のLane名変更を `prompt()` ではなく、その場のinput差し替えで行うようにした。確定後は既存の `caf-lane-rename` 履歴経路へ流す。
  - `animation-table-popup.js`: CAFフォルダ名を外部入力値から履歴付きで変更する `renameClipAssetFolderFromExternal()` を追加。
  - `layer-panel-renderer.js` / `styles/main.css`: Layer Panel上のCAF名、CAF補助Lane名、CAF内部Layer/Folder名をダブルクリックでインライン編集できるようにした。CAF名はClipAssetFolder、Lane名はLaneModel、内部Layer名はClipAssetInternalLayerへ同期する。
- **保留: アニメテーブル左Lane名のインライン編集初回即閉じ**:
  - Layer Panel側のCAF名/Lane名/CAF内部Layer名変更と同期は動作確認済み。
  - アニメテーブル左端のLane名編集は、ダブルクリック初回や編集成功後の再ダブルクリックでinputが即閉じる挙動が残る。Lane名クリック時の通常render、遅延 `requestUpdate()`、作業Layer同期を抑制しても完全には解消しなかった。
  - 実用導線はLayer Panel側のLane名編集で代替できるため、現時点では深追いせず棚上げ。再開時はイベント順序（click/detail/dblclick/blur）とDOM差し替えの実測ログ、または別AIレビューで原因確認する。
- **アニメテーブル左Lane名編集の入口停止**:
  - `animation-table-popup.js`: 初回即閉じが残るアニメテーブル左端Lane名のダブルクリック編集入口を無効化した。Lane名クリックはLane単独選択に戻し、名前変更は動作確認済みのLayer Panel側へ一本化する。
  - `animation-table-popup.js`: 左端Lane名の `cursor: text` を外し、アニメテーブル側で直接編集できるように見える誤認を抑制。
- **CAF文脈の属性ポップアップ名変更分岐**:
  - `layer-panel-renderer.js`: アニメテーブル表示中かつCAF内部Layer/Folder選択中は、右サイドバー属性ポップアップの名前欄を通常作業Layer名ではなくCAF内部Layer/Folder名として表示・変更するようにした。変更は既存の `renameInternalLayerFromExternal()` に委譲し、CAF内部名変更Historyへ流す。
- **CAF内部D&Dのペン入力補強**:
  - `layer-panel-renderer.js`: CAF内部Layer/FolderミラーのPointer Events D&D開始時に `setPointerCapture()` を取り、document側の `pointermove` もcaptureで拾うようにした。ペン入力時に接触中イベントが別要素/ブラウザ側へ流れてゴーストが即消える経路を抑制。
  - `styles/main.css`: `.clip-layer-mirror-row` に `touch-action: none` を付与し、ペン/タッチ系入力でブラウザジェスチャ扱いになりD&Dが中断される余地を減らした。
- **Asset Library内部Layer名変更のインライン化**:
  - `animation-table-popup.js`: Asset Library Inspector内の内部Layer/Folder名変更ボタンを `prompt()` ではなく行内input編集へ変更。名前ダブルクリックも同じ行内編集へ接続し、確定後は既存の `renameInternalLayerFromExternal()` とCAF内部名変更Historyへ流す。
- **CAF内部Layerサムネイルのキャンバス比率追従**:
  - `layer-panel-renderer.js`: 通常Layerサムネイルと同じキャンバス比率計算をLayer Panel側ヘルパー化し、CAF内部Layerミラーのサムネイル枠にも適用した。キャンバスサイズ変更後にCAF側だけ正方形寄りの比率で残る経路を補修。
  - `layer-panel-renderer.js`: `canvas:resized` / `camera:resized` 受信時にサムネイル更新だけでなくLayer Panel再renderも要求し、CAFミラーのサムネイル寸法を即時更新するようにした。
- **Asset Library Folder名変更のインライン化**:
  - `animation-table-popup.js`: Asset LibraryのFolder名変更を、可能な場合は選択Folder行のinput差し替えで行うようにした。Folder名ダブルクリックも同じ行内編集へ接続し、確定後は `renameClipAssetFolderFromExternal()` 経由でTimeline Historyへ記録する。
- **通常Layer/Folderカード名変更の復旧**:
  - `layer-panel-renderer.js`: 通常Layer/Folderカードの名前ダブルクリック編集を復旧し、F2と同じ `_editLayerName()` へ接続した。CAF名/Lane名のLayer Panel側ダブルクリック編集とは別経路のまま維持。
  - `layer-panel-renderer.js`: 通常Folderの開閉はサムネイル/フォルダアイコン付近のクリックに限定し、名前や行クリックは選択・名前変更側へ寄せる方針を維持。フォルダサムネイルには明示的なpointerカーソルを付けた。
- **確認**:
  - `npm.cmd run build` 成功。
  - Browserプラグインでのローカル画面確認は、Node REPL側が `windows sandbox failed: spawn setup refresh` で落ちたため未実施。

**Phase 4z25 — Space+Pen Navigation & Pressure Consistency Fix 【Gemini実装】**
2026-05-30
- **描き始め・点描バグの根本修正**:
  - `brush-core.js`: `updateStroke` の筆圧下限を `0.1` -> `0.0` に変更し、開始時との不一致（突然の肥大化）を解消。
  - `stroke-renderer.js`: `renderPreview` の1点ガードを削除し、即時フィードバックを復活。
  - `stroke-recorder.js`: `PressureHandler` との接続ミス（メソッド名相違）を修正し、距離ベースのスムージングを再有効化。
  - `pressure-handler.js`: キャリブレーション中の固定筆圧 `0.5` を廃止し、生値を返すよう修正。
- **点描時の大きな丸の追加抑制（Codex補修）**:
  - `brush-core.js`: 筆圧ONのペンでは pointerdown の開始点筆圧を常に `0.0` に固定し、液タブ側の開始圧スパイクが単点ストロークへ焼き込まれる経路を抑制。
  - `pointer-handler.js`: 生pointerdownログを `TEGAKI_CONFIG.debug` 限定へ戻し、通常使用時のコンソール汚染を防止。
  - `stroke-renderer.js` / `pressure-handler.js`: 既存挙動に合わせて整形とコメントを同期。
- **Space+Pen Drag**: ペン入力時にSpaceキーを併用した場合でもキャンバス移動（手のひらツール）ができるように復旧。
  - `camera-system.js`: `pointerdown` / `pointerup` におけるペン入力の明示的な除外を削除し、操作の安定性を向上。

**Phase 4z24 — Pen Settings Optimization & Stability Cleanup 【Gemini実装】**
2026-05-29
- **LazyBrush**: 座標に加えて「筆圧」の平滑化（Lerp）を実装。インク溜まりを解消。
- **Pressure Curve**: コメントの誤り修正、および3乗ベースへの深化。
- **Safeguards**: 描き始めの筆圧スパイク抑制ロジックを追加。
- **System Cleanup**: 不要な `resize-slider.js` をアーカイブ。
- **Diagnostics**: スパイク検知機能付き詳細ログを実装。
- **Status**: Space+Pen ドラッグが移動操作であることを確認。


**Phase 4z23 — Independent Lane Model Foundation 【Codex実装・確認中】**
作業フォルダ：`tegaki_work`

---

## フォルダ状態

| フォルダ | 状態 |
|---|---|
| `tegaki_phase0` | ✅ オリジナル保存。触らない |
| `tegaki_work` | 🔧 現在の作業フォルダ。 |
| `PastFiles/` | 完了済みフェーズのアーカイブ置き場 |

---

## 直近の作業（最新が上）

### 2026-05-27 Codex：Phase 4z23 Independent Lane Model Foundation
- **CAF安定化優先のD&D境界補強**: アニメテーブルモデル/ClipAssetが存在する文脈では、旧通常Layer用のSortableJS D&Dを無効化。CAF内部D&Dは旧導線を流用せず、CAF/内部Folder構造が固まってから専用に再設計する方針へ寄せた。
- **CAF開閉UI再整理**: 左端の `+/-` 開閉ボタンを廃止し、CAFフォルダアイコン自体をクリックして通常Folder/OpenFolder SVGが切り替わる形へ変更。CAF内部カードはオレンジ寄りの面色を抑え、ふたばMaroon系の薄い中間色へ寄せた。
- **CAF内部カード余白補正**: CAF枠右線と内部Layerカード右線が接触して見える状態を避けるため、内部Layerリスト右側に余白を追加。
- **Scope反映のCAF表示補修**: Layer PanelのCAF一覧生成にアニメテーブルのScopeを渡し、`LANE` ではアクティブLane、`SET` ではチェックLaneだけを `getFrameAssetTree()` が走査するようにした。アクティブLane/Frameが空の時に別LaneのCAFがLayer Panelへ出る経路を抑制。
- **CAF開閉アイコン統一**: CAFを開いた時のフォルダアイコンを、通常フォルダで使っている共通 `folderOpen` SVGへ統一。
- **ゴースト周辺調査メモ**: Vキー変形やアルバム保存は現状LayerSystemの現在状態を入口にしており、ClipAsset/CAF全体を正規永続化する経路は未確立。CAF安定後に保存/復元・Vキー操作対象を明示Phase化する。
- **CAF開閉と幅調整**: Layer PanelのCAF行へ開閉ボタンを追加し、非アクティブCAFでも内部Layerを展開/収納できるようにした。CAF/内部Layerカードは右側スクロールレーン手前まで少し広げ、内部Layerの常時オレンジ感を弱めてアクティブカードの識別を優先した。
- **CAF内部Layer表示の所属補正**: Layer Panelの内部LayerミラーをCAF一覧とは別ブロックで表示する構造をやめ、選択中Clipを含むCAFグループ直下にだけ差し込むよう変更。CAF1/CAF2を切り替えた時に、CAF2配下へ両方の内部Layerが展開されて見える経路を抑制。
- **CAF選択強調の整理**: 非選択CAFは細枠、選択CAFだけ太枠にし、複数CAFが同時にアクティブ表示されているように見える状態を軽減。
- **CAF名の連番化**: 新規ClipAsset作成時に `CAF1` 固定表示へ落ちないよう、`CAF1`, `CAF2`... の空き番号でClipAssetFolderを作り、Blank Clip/初回SeedのAssetへ割り当てるようにした。
- **Clip選択時のFrame/Lane同期**: 既存Clipクリック、CAFヘッダークリック、リタイミング/移動開始時に `selectedCelId` / `activeLaneId` / `currentFrame` / `track.active` を同時更新する `_activateClipEntry()` を追加。Frame4のClipを選んでもFrame1のPreviewが混ざる経路を抑制。
- **Z軸選択の逆同期**: 通常 `↑/↓` でLayerSystem側のアクティブLayerが変わった時、アニメ作業Layerであれば対応するClipAsset内部Layerを `selectedInternalLayerId` へ反映する橋渡しを追加。Lane移動とは分離しつつ、Z軸選択の表示同期を進めた。
- **Z軸操作からY軸への逆流抑制**: `syncWithLayers()` が通常LayerSystemのアクティブLayerを毎回Laneの `active` に再反映していたため、初回Layer輸入時だけに限定した。これにより通常の `↑/↓` レイヤー選択がLane選択へ漏れる経路を切り、Lane移動は `Alt + ↑/↓` に寄せる。
- **UNIQUE導線撤去**: Clipごとの小箱化が進み `UNIQUE` ボタンの役割が薄れたため、アニメテーブルヘッダーの `UNIQUE` ボタン、イベント接続、専用CSS、未使用の `makeClipAssetUnique()` を削除した。共有Asset判定は既存Clip表示の互換情報として残す。
- **CAF内部Layer選択と描画先同期**: CAF内部Layerミラー/Inspectorで選択した内部Layerに対応する一時作業Layerを、LayerSystem側のアクティブLayerにも同期するようにした。レイヤー2を選んだのにレイヤー1へ描かれる経路を抑制。
- **テーブル非表示時の描画保存補修**: アニメテーブルを閉じていても選択Clipがある場合は、描画完了時に作業Layer内容をClipAssetへ保存し、Layer Panel更新を要求するようにした。
- **内部Layer選択維持**: ClipAsset再キャプチャ時に内部Layer IDが再生成されても、選択中だった内部Layerの配列位置を引き継ぎ、描画後に選択が先頭へ戻る経路を抑制。
- **サムネイル誤反映補修**: Layer Panelの `thumbnail:updated` 反映先を、全レイヤー逆順indexではなく `data-layer-index` 一致で探すよう変更。アニメ作業Layerを非表示にした状態で、隠れたLayerのサムネイルが背景カードへ表示される経路を抑制。
- **アニメ文脈後の右側+誤流入抑制**: アニメテーブルを一度開いてモデル/ClipAssetが存在する状態では、テーブルを閉じていても右サイドバーのレイヤー `+` / フォルダ `+` を通常Layer/Folder作成へ流さないようにした。CAF外通常Layerが次回表示時にCAFへ吸われる/ゴースト化する入口を絞る。
- **Lane同期の初回輸入化**: `syncWithLayers()` に初回同期済みフラグを追加し、アニメテーブルを一度開いた後に通常Layerを増やしても次回表示時に新規Laneへ輸入しないようにした。
- **CAF内部カード移植Step1**: CAF内部Layerミラーの幅を通常Layerカードと同じ160pxへ戻し、可視ボタンを既存 `UI_ICONS.eye/eyeOff` に統一。ホバーリネームはカード面から外し、紙クリップを内部Layerの即時クリッピング操作へ寄せた。
- **Layer Panel右側+のアニメ分岐**: アニメテーブル表示中は右サイドバーのレイヤー `+` を通常Layer作成へ流さず、選択中ClipAssetの内部Layer追加として扱うよう変更。未選択時は通常作業Layerを増やさず no-op。
- **アニメ中の通常フォルダ追加抑制**: アニメテーブル表示中のフォルダ `+` は通常Layer Panel側のFolder作成へ流さないようにした。CAF内部Folderは未設計のため、現時点では誤った通常Folderを作らないことを優先。
- **内部Layerカード再整形**: CAF配下の内部Layerミラーを細いデバッグ表示から、通常Layerカードに近いサムネイル/透明度/名前/クリッピング/可視ボタン構成へ寄せた。
- **内部Layer名の英字混在補修**: `ensureClipAssetInternalLayer()` と内部Layer追加時の既定名を `レイヤー1` / `レイヤーN` に統一。
- **右端ボタン重なり補修**: アニメテーブル内の閉じるボタンだけ `position: static` に戻し、`LIB` ボタンと重ならないようにした。
- **通常Layer追加のLane漏れ停止**: `syncWithLayers()` は初期同期後に新規通常Layer/FolderからLaneを自動生成しないよう変更。Lane追加はアニメテーブル内のLane `+` に寄せる。
- **CAF表示再整理**: CAF行を通常フォルダ風に戻し、`CAF1` 名、左フォルダアイコン、右側Lane表示へ変更。内部LayerミラーにはSnapshotサムネイルを表示するようにした。
- **ヘッダー渋滞整理**: `ANIMATION TABLE` 表記を削除し、COPY/PASTEをSVGアイコンボタン化。Asset Libraryボタンは `LIB` へ短縮し、右端の閉じるボタンとの重なりを軽減。
- **通常フォルダのY軸漏れ抑制**: 通常Layer Panel側で作った通常フォルダを、アニメテーブルのLane一覧/Timelineグリッドから除外。通常フォルダはX/Y盤面ではなくClip内部Z軸側の概念として扱う方針に寄せた。
- **CAF配下表示の整理**: アニメClip選択中は通常作業レイヤー行をLayer Panelに出さず、CAFの下に内部Layerミラーだけを表示するようにした。内部Layerミラーには左アクセント線を追加し、CAF配下に入っていることを示す。
- **初回CAF同期補修**: アニメテーブル初回表示直後にLayer Panel同期を明示発火し、Frame移動やLane移動を挟まないとCAFが出ない経路を抑制。
- **暫定UI整理**: `CAPTURE` / `AUTO` / `EDIT` は現在の自動保存・Scope設計ではボタンとして意味が曖昧になったため、UIから退避。内部メソッドは互換のため残す。
- **アニメテーブル外観調整**: 濃いMaroon帯をやめ、他パネルに近い淡いヘッダーへ変更。中央操作の文字重なりを減らし、`ASSETS` 表記は `ASSET` へ短縮。
- **3Dマトリクス方針追記**: `PHASE4Z_BOUNDARY.md` に、X=Frame / Y=Lane / Z=ClipAsset内部Layer/Folder の3次元マトリクス概念を追記。BackgroundはX/Y軸のLaneではなく、常にZ軸最下層の基底要素として扱う方針を明文化。
- **Background Lane除外**: アニメテーブルのLane一覧/Timelineグリッド/Preview合成/Clip配置対象からBackgroundを除外。独立Lane追加時もBackgroundより下ではなく、Backgroundの手前へ挿入するようにした。
- **CAF Lane表記補正**: `getFrameAssetTree()` のLane番号計算からBackground/Folderを除外し、Layer PanelのCAF補助表示が実際のアニメLane番号へ寄りやすいよう補正。
- **Layer Panel重複表示抑制**: アニメClip選択中は、Clip同期で余った非表示の通常作業レイヤー行をLayer Panelへ出さないようにした。内部Layerミラー側を正本に寄せ、通常作業バッファの残骸表示を減らす。
- **Blank Clip初期名整理**: 新規Blank ClipAssetの初期内部Layer名を `Layer 1` から `レイヤー1` へ変更し、英字/カナ混在を抑制。
- **アニメ操作キー整理**: 空セルへのClip作成と既存Clip削除を `Alt + クリック` のトグルへ統一。`Alt + ↑/↓` でアクティブLaneを移動し、通常レイヤーパネルの上下キー操作と分離する足場を追加。
- **Preview中CAPTURE補修**: Previewが実レイヤーを一時的に `visible=false` にするためCAPTURE対象が空になる問題を修正。ClipAssetへの取り込みは一時表示状態ではなく `layerData.visible` を基準にした。
- **描画完了時のClip保存**: 選択Clipがある状態では、AUTOチェックの有無に関わらず描画完了時に作業レイヤーを選択ClipAssetへ保存するよう変更。Preview中でも描画結果がClipプレビューへ反映される足場にした。
- **空Frame表示の抑制**: 対象Lane/FrameにClipがない場合、通常作業レイヤーをすべて非表示にし、Layer Panel側でもアニメテーブル表示中かつ選択Clipなしなら通常作業レイヤー行を出さないようにした。
- **Frame移動前保存**: Frameヘッダー移動、左右キー移動、別Clip選択、再生開始前に、現在選択中Clipへ作業レイヤー内容を退避するようにした。これによりFrame2へ移った時にFrame1の描画が失われる経路を抑制。
- **空セル作成の明示化**: 空セルの通常クリックでClipが作成される挙動を停止。既存Clipは通常クリックで選択、空セルへの新規Blank Clip作成と既存Clip削除は `Alt + クリック` のトグルに限定。
- **Frame/Lane小箱化の暫定同期**: 選択中Laneを `activeLaneId` として保持し、Frame移動・Clip選択・Clip新規作成時に、対象ClipAssetの内部Layerスナップショットを通常作業レイヤーへ復元する橋渡しを追加。対象Lane/FrameにClipがない場合は作業レイヤーを空にして、前Frameの内容が残らないようにした。
- **空Clipの作業レイヤー初期化**: 新規Blank ClipAssetを作った直後、作業レイヤー側も内部Layer 1枚相当へ同期するようにした。余った通常レイヤーは空にして非表示へ寄せる。
- **Preview Scope補修**: `selectedCelId` があるだけでALLプレビューが選択Clip単独表示へ切り替わっていたため、Preview Scopeを正本にして、ALLは常に現在Frame全体を合成するよう修正。OnionもScopeに従う。
- **Layer Panelミラー補修**: 選択Clipがない状態でAsset Library側の選択だけから `CLIP LAYERS` ミラーが残る経路を止めた。Layer Panelの内部Layerミラーはアニメテーブル上の選択Clipに紐づく場合だけ表示する。
- **ClipAsset Z軸取り込み**: 初回Seed時に、Lane元レイヤー1枚ではなく、現在表示中の通常レイヤー群を1つのClipAsset内部Layer構造として取り込むよう変更。LaneはY軸、通常レイヤー群はClip内Z軸として扱う足場にした。
- **新規Clip生成整理**: 別Frame/Laneへ新規作成するClipは、既存の表示中レイヤー束をコピーせず、Blank ClipAsset（内部Layer 1枚）から開始するよう修正。
- **Capture整理**: `CAPTURE` はLane元レイヤー1枚ではなく、現在表示中の通常レイヤー束を選択ClipAssetの内部Layer群として更新するよう修正。これにより、LaneがZ軸側の単一レイヤーへ戻る挙動を抑制。
- **内部Layer合成補正**: 複数内部Layerを持つClipAssetのPreviewでは、Lane元レイヤーのopacity/blendModeを重ね掛けせず、各内部Layerのopacity/blendModeを使って合成するよう補正。
- **CAF/内部Layer即時操作整理**: `ClipInstance.visible` と `ClipAssetInternalLayer.clipping` をモデルへ追加し、Layer Panel上のCAF目アイコンでClip単位の表示/非表示、内部Layer紙クリップでクリッピングON/OFFを切り替えられるようにした。Scope SETとは別のClip表示制御として扱う。
- **Clip移動後同期補修**: クリップを別Lane/Frameへドラッグ移動した直後に、`currentFrame` / `activeLaneId` / `selectedCelId` / 作業Layer復元を移動先へ同期するよう補修。移動直後にキャンバスとLayer Panelが別Frame/Laneを見てしまう経路を抑制。
- **アニメテーブル非表示時同期補修**: アニメテーブルを閉じる前に選択Clipへ作業Layer内容を保存し、閉じた後にLayer Panelへ再同期通知を出すよう補修。
- **ONION/PREVIEWフォーカス補修**: ONION/PREVIEWチェック後にチェックボックスへフォーカスが残り、左右キーでFrame移動できない経路を抑制。変更直後にblurし、この2つのチェックボックスに限り左右キー処理を通す。
- **旧カードゴースト抑制**: ClipAsset同期に使う通常Layerへ `isAnimationWorkingLayer` を付与し、Layer Panelではアニメテーブルモデルが存在する間はその作業バッファ行を表示しないようにした。CAF内カードを正本に寄せ、CAF外の旧カードへD&D等を積まない方針。
- **目的**: 4z22で確認した `syncWithLayers()` の強結合を、いきなり切断せずに弱めるため、通常Layerに存在しないLaneをモデル上で保持できる足場を追加。
- **LaneModel拡張**: `displayName` / `sourceName` / `kind` / `orderIndex` / `sourceMissing` / `isBackground` を追加し、`sourceLayerId: null` のアニメ専用Laneを表現できるようにした。
- **非破壊同期へ変更**: `syncWithLayers()` が毎回 `this.tracks = newTracks` で完全置換する構造を改め、独立Laneと、元Layerが消えてもClipを持つLaneを破棄しないようにした。
- **表示名整理**: `TimelineModel.getLaneDisplayName()` を追加し、Timeline Y軸とAsset名生成で通常Layer名ではなくLane表示名を使うようにした。通常Folder/Backgroundは従来の意味を維持。
- **最小UI追加**: アニメテーブルのLaneヘッダーへ `+` を追加し、`sourceLayerId: null` の独立Laneを手動追加できるようにした。追加LaneにはBlank Clipを置ける。
- **安全策**: 独立Lane上のClipでは、実レイヤー由来の `CAPTURE` と `EDIT` はまだ成立しないため、EDITチェックを無効化し、CAPTUREは警告して中断する。
- **スコープ制限**: Lane削除/並べ替えUI、保存形式の大変更、Layer Panel改修、Virtual Layer Panel、描画ターゲット切替は未実装。今回は独立Laneの生存性とBlank Clip配置に限定。
- **確認**: `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-27 Gemini：Phase 4z22 Lane / CAF Dependency Audit (完了)
- **依存関係の棚卸し**: `syncWithLayers()` および `sourceLayerId` の使用箇所を詳細に調査。Lane が通常レイヤーの数や順序に強力に縛られている現状を特定。
- **操作別依存分析**: クリップ作成、キャプチャ、プレビュー等の主要操作における実レイヤー依存度を整理。
- **リスクの明文化**: 同期解除に伴う「レイヤーパネルとの乖離」や「描画先レイヤーの喪失」といった Lane 独立化へ向けた課題を抽出。
- **次Phase候補の提示**: 「Lane モデルの独立化」「表示インデックスの永続化」「ソースレイヤー抜きのクリップ生成」の 3 案を提案し、Codex/Gemini の役割分担を整理。
- **報告書作成**: `task-gemini/phase4z22_report.md` を作成。
- **確認**: 本フェーズは調査専用のため、コード変更なし。

### 2026-05-27 Codex：Phase 4z境界ロック文書とPhase 4z22指示作成
- **境界ロック文書追加**: `tegaki_work/PHASE4Z_BOUNDARY.md` を新規作成。CAF / Lane / ClipAsset / ClipInstance / Layer Panel の責務と、Geminiが触ってよい範囲・触ってはいけない範囲を明文化。
- **方針固定**: CAF自体の作成・削除・移動・コピー・Frame/Lane移動はアニメテーブル正本。Layer Panelは現在Frameの反映表示とCAF内部編集の入口に限定。
- **Layer Panel制限**: 以後、Layer Panel側でCAF自体のD&D / copy / delete / Lane移動UIを作らない。濃紺カード風やダッシュボード風のCAF表示再導入も禁止。
- **Phase 4z22作成**: `task-gemini/phase4z22.md` を作成。次は実装ではなく、`syncWithLayers()` と `sourceLayerId` 依存を棚卸しし、Lane独立化へ向けた小Phase候補を出す調査専用Phaseとする。
- **実装制限**: 4z22ではコード変更、CSS変更、Layer Panel DOM変更、Lane独立化本実装、保存形式変更、EventBus追加、SortableJS変更を行わない。

### 2026-05-27 Codex：Phase 4z21確認と同期ループ補修
- **Phase 4z21確認**: `_requestLayerPanelSync()` とアニメテーブル側の同期通知追加を確認。CAF自体の操作UIはLayer Panel側へ追加されておらず、SortableJS対象外のまま。
- **補修**: `render()` 末尾で `_requestLayerPanelSync()` を呼ぶ実装は `render -> layer:panel-update-requested -> requestUpdate -> render` の更新ループになり得るため削除。
- **補修**: 代わりにClip作成/削除、Frame変更、Paste、Clip移動、Duration変更、Asset Folder作成/リネーム/移動、内部Layer追加/削除/順序変更など構造変更箇所へ明示同期を追加・確認。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z21 CAF Operation Authority Boundary (完了)
- **権限境界の確立**: CAF/クリップの構造操作権限をアニメーションテーブル側に集約。レイヤーパネルは反映と内部編集のみを行う役割分担を明確化。
- **同期ロジック補強**: `_requestLayerPanelSync()` ヘルパーを導入し、クリップ・アセット・フォルダ・内部レイヤーの全構造変更操作後にレイヤーパネルへ更新を通知。
- **イベント通知修正**: 再生中およびキーボードナビゲーション時の `animation:frame-changed` 発火を保証し、パネル側の追従性を向上。
- **パフォーマンス最適化**: 再生中の同期通知を制限し、描画パフォーマンスを維持。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z21_report.md` を作成。

### 2026-05-26 Codex：Phase 4z21指示作成
- **次フェーズ判断**: Phase 4z20でCAF/Lane/Layer Panelの表示思想を寄せたため、次は見た目を増やさず、CAF自体の操作権限をアニメテーブル側へ固定し、Layer Panelは反映表示とCAF内部編集に限定する境界を固める。
- **Phase 4z21作成**: `task-gemini/phase4z21.md` を作成。アニメテーブル側のClip/CAF操作棚卸し、操作後のLayer Panel更新同期、Layer Panel側でCAF自体の移動/コピー/削除を持たせない確認に限定。
- **実装制限**: Lane独立化、`syncWithLayers()` 根本変更、CAF/内部Layer D&D、内部Layer追加/削除/順序変更、直接描画、通常Layer一覧置換、保存形式変更は後続扱い。

### 2026-05-26 Codex：Phase 4z20確認とCAF表示補修
- **Phase 4z20確認**: Antigravity/Gemini実装を確認。Timeline Y軸のLane表示は入ったが、CAFクリックclass不一致と濃紺 `CLIP LAYERS` カード残存があった。
- **補修**: CAFクリック委譲を `.caf-simple-asset` に修正し、CAF/Asset選択が反応するようにした。
- **補修**: `CLIP LAYERS` の独立カード感を弱め、CAF配下の薄い内部Layer行として見えるようCSS/DOMを調整。CAF名とLane表示は分離し、Laneは補助情報として表示。
- **補修**: 新アニメテーブルの `render()` 後に `window.timelineUI.updateLayerPanelIndicator()` を呼び、Frame表示が `Frame 1` 等へ同期しやすいよう補強。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-26 Codex：Phase 4z20指示作成
- **方針修正**: オーナー確認により、Phase 4z20は内部Layer順序変更ではなく、CAF / Lane / Layer Panelの表示思想を揃える調整Phaseへ差し替え。
- **Phase 4z20再発行**: `task-gemini/phase4z20.md` を `CAF / Lane UI Philosophy Alignment` として再作成。濃紺カード風のCAF/CLIP LAYERS表示を弱め、通常レイヤーパネルに馴染むCAFフォルダ表示へ寄せる指示にした。
- **追記方針**: CAF名とLane番号は別概念として扱う。Layer Panel側ではCAF名をフォルダ名欄に、Lane番号を控えめな補助表示として出し、CAF自体の移動/コピー/削除/別Lane移動はアニメテーブル専管とする。
- **実装範囲**: `NO FRAME` をアニメFrame同期表示へ寄せ、Timeline Y軸を暫定的に `Lane 1`, `Lane 2` 表示へ変更する。データ構造移行、Lane独立化、通常Layer一覧置換、内部Layer追加/削除/順序変更/D&D/直接描画は後続扱い。

### 2026-05-26 Codex：Phase 4z19確認とリネームクリック補修
- **Phase 4z19確認**: `renameInternalLayerFromExternal()` と `CLIP LAYERS` ミラーのリネームボタン追加を確認。Mirror / Inspectorの名前同期に必要なモデル更新とパネル更新通知は実装済み。
- **補修**: LayerPanelRendererのクリック委譲に `.clip-layer-mirror-rename-btn` 判定が無く、ボタンが行選択へ流れていたため、可視ボタン、リネームボタン、CAF Asset、内部Layer行の順に判定する処理を追加。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z19 Clip Layer Mirror Rename Bridge (完了)
- **リネームブリッジ実装**: `AnimationTablePopup` に `renameInternalLayerFromExternal()` を実装。外部 UI から内部レイヤー名を直接変更（`prompt()`利用）可能にした。
- **選択状態の自動同期**: ミラーからの操作時に、対象のアセット、フォルダ、およびレイヤーを自動的に選択状態へ更新するロジックを導入。
- **ミラーUI拡張**: レイヤーパネルの「CLIP LAYERS」ミラー内に名前変更ボタン（✎）を追加し、タイムライン側のインスペクターと双方向に同期させた。
- **スタイリング**: リネームボタンのホバースタイルを追加。既存のレイヤー D&D を妨げない安全なイベント委譲を継続。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z19_report.md` を作成。

### 2026-05-26 Codex：Phase 4z19指示作成
- **次フェーズ判断**: Phase 4z18で `CLIP LAYERS` ミラーから内部Layer visible切替ができたため、次はVirtual Layer Panel化ではなく、低リスクな編集操作として内部Layerリネームだけを追加する。
- **Phase 4z19作成**: `task-gemini/phase4z19.md` を作成。Mirror上のリネームボタンから `AnimationTablePopup` / `TimelineModel` の既存リネーム経路を呼び、Mirror / Inspectorの名前表示を同期させる指示にした。
- **実装制限**: 内部Layer直接描画、追加、削除、順序変更、D&D、opacity/blendMode編集、通常Layer一覧置換、Timeline Y軸変更、Lane独立化、保存/復元形式変更は後続扱い。通常Layer用class/datasetの流用は禁止。

### 2026-05-26 Codex：Phase 4z18確認とvisible toggle補修
- **Phase 4z18確認**: `CLIP LAYERS` ミラーの可視ボタン、`toggleInternalLayerVisibilityFromExternal()`、Preview / Inspector / Mirror更新経路を確認。通常Layer用DOMやSortableJSへの混入はない。
- **補修**: `TimelineModel.toggleClipAssetInternalLayerVisibility()` を `layer.visible === false ? true : false` に変更し、`visible` 未定義の既存内部Layerを可視扱いとして初回クリックで正しく非表示へ切り替わるよう修正。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z18 Clip Layer Mirror Visibility Toggle (完了)
- **可視性トグルブリッジ実装**: `AnimationTablePopup` に `toggleInternalLayerVisibilityFromExternal()` を実装。外部 UI から内部レイヤーの表示/非表示を直接操作可能にした。
- **選択状態の自動同期**: ミラーからの操作時に、対象のアセット、フォルダ、およびレイヤーを自動的に選択状態へ更新するロジックを導入。
- **ミラーUI拡張**: レイヤーパネルの「CLIP LAYERS」ミラー内の可視性アイコンをボタン化し、タイムライン側のプレビューおよびインスペクターと双方向に同期させた。
- **スタイリング**: 可視性ボタンのホバー・非表示状態のスタイルを追加。既存のレイヤー D&D を妨げない安全なイベント委譲を確認。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z18_report.md` を作成。

### 2026-05-26 Codex：Phase 4z18指示作成
- **次フェーズ判断**: Phase 4z17で `CLIP LAYERS` ミラー表示と内部Layer選択同期ができたため、次はVirtual Layer Panel化ではなく、ミラー上からの最小編集操作として内部Layer visible切替だけを通す。
- **Phase 4z18作成**: `task-gemini/phase4z18.md` を作成。`CLIP LAYERS` の可視ボタンから `AnimationTablePopup` / `TimelineModel` の既存visible切替経路を呼び、Mirror / Inspector / Previewを同期させる指示にした。
- **実装制限**: 内部Layer直接描画、CRUD、D&D、順序変更、opacity/blendMode編集、通常Layer一覧置換、Timeline Y軸変更、Lane独立化、保存/復元形式変更は後続扱い。通常Layer用class/datasetの流用は禁止。

### 2026-05-26 Codex：Phase 4z17確認と可視判定補修
- **Phase 4z17確認**: `createSelectedClipAssetLayerMirror()` と専用CSSを確認。選択中ClipAssetの内部Layerミラーは通常Layer DOMへ混入せず、SortableJS対象外の専用表示として実装されている。
- **補修**: 内部Layerの可視判定を `layer.visible !== false` に揃え、`visible` 未定義の既存データが非表示扱いにならないよう修正。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z17 Selected ClipAsset Internal Layer Mirror (完了)
- **内部レイヤーミラー実装**: レイヤーパネルの CAF ヘッダー直下に、選択中のクリップ（またはアセット）が持つ内部レイヤーを一覧表示する `CLIP LAYERS` セクションを新設。
- **データ連動**: 可視性、名前、不透明度、合成モード、Snapshot 状態を表示。タイムライン上でのクリップ選択とリアルタイムに同期。
- **選択同期ブリッジ**: ミラー内のレイヤーをクリックすることで、アニメーションテーブル側の内部レイヤー選択を更新し、ハイライトを双方向に反映。
- **安全な分離設計**: 通常レイヤー用の CSS クラスを使用せず独立した DOM 構造を採用することで、SortableJS による既存のレイヤー並び替え操作への影響を完全に排除。
- **スタイリング**: 紺色とオレンジ（選択色）を基調とした専用デザインを適用。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z17_report.md` を作成。

### 2026-05-26 Codex：Phase 4z17指示作成
- **次フェーズ判断**: Phase 4z16でCAFヘッダーからClip/Asset選択同期ができたため、次はVirtual Layer Panelへ一気に進まず、選択中ClipAssetの内部Layerをレイヤーパネル側へ読み取り専用ミラー表示する小Phaseに限定する。
- **Phase 4z17作成**: `task-gemini/phase4z17.md` を作成。CAFヘッダー下に `CLIP LAYERS` として選択中ClipAssetの内部Layer名、visible、opacity、blendMode、snapshot状態を専用DOM/classで表示する指示にした。
- **実装制限**: 通常Layer一覧の置換、内部Layer直接描画、内部Layer CRUD/D&D、Timeline Y軸変更、Lane独立化、保存/復元形式変更は後続扱い。`.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` の流用は禁止。

### 2026-05-26 Codex：Phase 4z16確認と選択同期補修
- **Phase 4z16確認**: `selectClipAssetFromExternal()` とCAFヘッダーbutton化を確認。Layer Panel側から現在Frame上のClip/Assetを選択し、Asset Library / Inspectorへ同期する橋渡しは実装済み。
- **補修**: 外部選択時にAsset解決へ失敗した場合、古い `selectedAssetFolderId` が残らないよう `null` へ戻す処理を追加。
- **補修**: CAFヘッダーの `data-clip-id` / `data-asset-id` をHTML属性へ入れる前にエスケープし、追加メソッド周辺のインデントを整理。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z16 CAF Header Selection Bridge (完了)
- **選択ブリッジ実装**: `AnimationTablePopup` に `selectClipAssetFromExternal()` を実装し、外部UIからクリップ・アセット・フォルダの選択状態を同期可能にした。
- **インタラクティブCAFヘッダー**: レイヤーパネル上部のアセット表示をボタン化し、クリックでタイムライン上の該当クリップを即座に選択できるようにした。
- **表示同期**: ヘッダー内での選択状態（ハイライト）とタイムライン上の選択を相互に反映。選択変更時には EventBus を通じてパネル更新を通知。
- **スタイリング**: `.caf-readonly-asset` のホバーおよび選択状態 (`.is-selected`) のスタイルを追加。ヘッダーの `pointer-events` を有効化し、既存のレイヤー D&D に干渉しない範囲でクリック操作を実現。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z16_report.md` を作成。

### 2026-05-26 Codex：Phase 4z16指示作成
- **次フェーズ判断**: Phase 4z15でCAFヘッダー表示が入ったため、次はVirtual Layer Panelへ進まず、CAFヘッダーから現在Frame上のClip/Assetを選択する橋渡しに限定する。
- **Phase 4z16作成**: `task-gemini/phase4z16.md` を作成。CAFヘッダー内Assetクリックで `AnimationTablePopup` 側の `selectedCelId` / `selectedAssetId` / `selectedAssetFolderId` を同期し、Asset Library / Internal Layer Inspectorへ反映する指示にした。
- **実装制限**: CAF表示を通常Layer DOMへ混ぜない。`.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` 流用禁止、Virtual Layer Panel・内部Layer直接描画・Timeline Y軸変更・Lane独立化・保存形式変更は後続扱い。

### 2026-05-26 Codex：Phase 4z15確認とSortable除外補強
- **Phase 4z15確認**: `layer-panel-renderer.js` / `main.css` / `phase4z15_report.md` を確認。`FRAME ASSETS` ヘッダーは専用CAF classで実装され、通常Layer/Folder DOMへ混入していない。
- **補修**: `pointer-events: none` に加え、SortableJS設定へ `draggable: '.layer-item'` を追加し、CAFヘッダーが並び替え対象にならないことをコード上でも明示。
- **生成物整理**: Geminiのビルドで生成された `dist/` 差分は成果物から除外する。

### 2026-05-24 Gemini：Phase 4z15 Layer Panel CAF Readonly Header (完了)
- **読み取り専用CAFヘッダー実装**: レイヤーパネルの最上部に、現在フレームで使用されているクリップアセット（素材）の情報を表示するヘッダーを追加。
- **データ連動**: `TimelineModel.getFrameAssetTree()` を活用し、CAF（フォルダ名）やアセット名のサマリーを自動抽出・表示。
- **スタイリング**: 通常のレイヤーフォルダと区別するため、濃い紺色の背景色と青色のアクセントを適用。
- **安全性確保**: `pointer-events: none` を設定し、SortableJS によるレイヤー操作や D&D を一切妨げない完全な読み取り専用領域として実装。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z15_report.md` を作成。

### 2026-05-26 Codex：Phase 4z15指示作成

- **次フェーズ判断**: Phase 4z14の `getFrameAssetTree()` を使い、レイヤーパネル本体へ混ぜる前の安全な第一歩として、読み取り専用CAFヘッダー表示を次Phaseにする。
- **Phase 4z15作成**: `task-gemini/phase4z15.md` を作成。`LayerPanelRenderer` 上部に現在FrameのCAF/ClipAsset概要を専用DOM/classで表示し、通常Layer/Folder DOMやD&Dには触れない指示に限定。
- **実装制限**: `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` の流用禁止、SortableJS対象外、Virtual Layer Panel・内部Layer直接描画・Timeline Y軸変更・Laneデータモデル変更は後続扱い。

### 2026-05-26 Codex：Phase 4z14確認
- **Phase 4z14確認**: `phase4z14_report.md` と `animation-data-model.js` を確認。`getFrameAssetTree()` はUI非依存の純データヘルパーとして実装され、Frame内ClipAssetをY軸順でflat/group list化できる。
- **安全性確認**: `assetId` 欠落/参照切れは `missingAssets`、存在しない `folderId` はUncategorized扱いとなり、後続UIで安全に処理できる。
- **次候補**: 次は `getFrameAssetTree()` を使った読み取り専用CAF表示へ進める。ただし `.layer-item` は流用せず、SortableJS対象外の専用DOM/classから始める。
- **生成物整理**: Geminiのビルドで生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z14 Frame Asset Tree Helper (完了)
- **データ解決ヘルパー実装**: `TimelineModel` に `getFrameAssetTree()` を追加。指定フレームの使用アセットを CAF 階層に基づき自動抽出するロジックを構築。
- **タイムライン Y 軸順の維持**: 抽出結果およびグループ化の順序を、タイムライン上の重なり順（Lane 配列順）と一致させ、プレビューとの整合性を確保。
- **堅牢なエラーハンドリング**: アセット未設定や欠落（Missing Asset）をエラーにせず、専用リストへ記録して後続処理を継続する安全設計。
- **Uncategorized 対応**: フォルダ未指定のアセットを仮想グループへ集約。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z14_report.md` を作成。

### 2026-05-26 Codex：Phase 4z14指示作成
- **次フェーズ判断**: レイヤーパネルDOMへ入る前に、後続のCAF Header / CAF行 / Virtual Layer Panelで共通入力になる現在FrameのClipAsset/CAFツリーを返す純データヘルパーを優先する。
- **Phase 4z14作成**: `task-gemini/phase4z14.md` を作成。`TimelineModel.getFrameAssetTree(frameIndex, options)` 相当のヘルパー追加、Timeline Y軸順の維持、Uncategorized group、Missing Asset記録、flat/group listの戻り値に限定。
- **実装制限**: UI変更なし。レイヤーパネル表示、CAF Header、CAF専用CSS、Virtual Layer Panel、Timeline Y軸変更、D&D、保存/復元形式変更は後続扱い。

### 2026-05-26 Codex：Phase 4z13確認
- **Phase 4z13確認**: `phase4z13_report.md` を確認。通常レイヤーパネル構造、CAF表示案A/B/C、視覚区別案、現在FrameからのCAF/ClipAsset解決手順、D&D破損リスクの整理は妥当。
- **判断追記**: 次はレイヤーパネルDOMへ直接入らず、現在FrameのClipAsset/CAFツリーを返す純データヘルパーを優先する。表示順は初期実装ではタイムラインY軸順、排他表示はまだ入れない。

### 2026-05-24 Gemini：Phase 4z13 CAF Layer Panel Display Plan (完了)
- **レイヤーパネル構造の棚卸し**: `layer-panel-renderer.js` および `layer-system.js` を詳細調査。通常レイヤーとフォルダの DOM 構成、インデント算出、SortableJS D&D の依存関係を特定。
- **表示案の策定**: CAF（ClipAssetFolder）をレイヤーパネルに統合するための 3 案（案A: 読み取り専用ヘッダー、案B: 独立した CAF 行、案C: 別セクション化）を提示。
- **視覚区別案の提示**: 通常フォルダと CAF を混同しないための配色・ラベル・アイコン等のデザイン指針を整理。
- **データ解決ロジックの定義**: `currentFrame` から使用アセットを抽出し、CAF 階層へマッピングする疑似手順を策定。
- **次Phase候補の提案**: 「Frame Asset 一覧ヘルパーの実装」「パネル上部への CAF ヘッダー表示」「CAF 専用 CSS クラスの定義」を提案。
- **確認**: JS/CSS の変更は行わず、設計棚卸しと報告書作成のみを完了。

### 2026-05-26 Codex：Phase 4z13指示作成
- **次フェーズ判断**: CAF相当の上位概念を将来レイヤーパネルにも表示する前提が固まったため、実装前に通常Folder表示構造・D&D依存・視覚区別・表示対象データ解決を棚卸しする。
- **Phase 4z13作成**: `task-gemini/phase4z13.md` を作成。CAFを通常フォルダより上位概念としてレイヤーパネルへ表示するための案A/B/C、視覚区別案、現在FrameからCAF/ClipAssetを解決する疑似手順、危険な一括変更を報告書化する指示に限定。
- **実装制限**: 今回はJS/CSS変更なし。レイヤーパネルDOM変更、CAF実表示、Virtual Layer Panel、内部Layer直接描画、Timeline Y軸変更、D&D追加、保存形式変更は後続扱い。

### 2026-05-26 Codex：Phase 4z12確認と設計前提追記
- **Phase 4z12確認**: `phase4z12_report.md` を確認。`syncWithLayers()` / `sourceLayerId` 依存、Lane独立化案、小Phase候補、危険な一括変更の棚卸しは概ね妥当。
- **設計前提追記**: 編集対象の正本は最終的にClipAssetFolder / ClipAsset / ClipAssetInternalLayer側へ寄せること、そのフレーム上のCAF相当上位単位は将来レイヤーパネルにも表示することを報告書とhandoffへ追記。
- **表示方針メモ**: 通常フォルダとCAFを混同しないため、濃い色・別系統の色・英字ラベルなどで視覚的に区別する候補を記録。ただしレイヤーパネル側表示は一気に実装せず、小Phaseへ分割する。

### 2026-05-24 Gemini：Phase 4z12 ClipAsset / Lane Migration Plan (完了)
- **依存関係の棚卸し**: `animation-data-model.js`, `animation-table-popup.js` 等を調査し、Lane と通常レイヤーの結合箇所（`syncWithLayers`, `sourceLayerId` 等）を特定。
- **移行計画の策定**: Lane を通常レイヤーから独立させ、「時間軸上の配置行」へと再定義するための 2 案（案A: 段階的独立、案B: 新規独立レーン）を比較。
- **小Phase候補の提示**: 「レーン表示の通し番号化」「アセットの任意割り当て」「Virtual Layer Panel の接続調査」の 3 つの次ステップを提案。
- **報告書作成**: `task-gemini/phase4z12_report.md` に詳細をまとめ、危険な一括変更や Codex への相談事項を明記。
- **確認**: 実装変更は行わず、設計検討のみを完了。

### 2026-05-26 Codex：Phase 4z12指示作成
- **次フェーズ判断**: Phase 4z11でClipAssetFolder UIの足場が整ったため、次はいきなりY軸/Lane構造を変更せず、`Lane = 通常Layer由来` の暫定構造からClipAsset中心構造へ移るための設計棚卸しを行う。
- **Phase 4z12作成**: `task-gemini/phase4z12.md` を作成。Laneと通常Layerの依存箇所、Y軸表示変更の影響、ClipAssetFolder / ClipAsset / ClipInstance / 内部Layer / Lane の関係、次の小Phase候補を報告書化する指示に限定。
- **実装制限**: 今回はJS/CSS変更なし。Timeline Y軸表示変更、Laneデータモデル変更、Virtual Layer Panel、内部Layerへの直接描画、保存形式変更、D&D追加は後続扱い。

### 2026-05-26 Codex：Phase 4z11確認と選択整合補修
- **Phase 4z11確認**: `phase4z11_report.md` と `animation-table-popup.js` を確認。Asset Folderの作成・リネーム、Asset移動、フォルダ別件数表示、`Uncategorized` リネーム不可は実装されている。
- **補修**: 新規フォルダ作成時に空フォルダへ切り替わっても前フォルダの `selectedAssetId` / `selectedInternalLayerId` が残らないようクリア処理を追加。
- **補修**: `MOVE` の移動先番号入力で `1abc` のような値が通らないよう、整数入力のみ受け付ける検証に変更。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z11 ClipAsset Folder UI MVP (完了)
- **フォルダ管理機能実装**: Asset Library 内にアセットフォルダの「新規作成」「リネーム」機能を追加。
- **アセット移動**: 選択したアセットを特定のフォルダへ移動する `MOVE` 機能を実装。簡易的な `prompt()` による移動先指定を採用。
- **UI表示拡張**: 各フォルダに属するアセット数をバッジ表示。フォルダ切り替え時の選択状態クリアロジックを導入し、整合性を向上。
- **スタイリング**: フォルダとアセットの管理エリアを整理し、ボタンの `disabled` 制御やホバー装飾を追加。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z11_report.md` を作成。

### 2026-05-26 Codex：Phase 4z11指示作成
- **次フェーズ判断**: ClipAssetFolderはデータ基盤とAsset Library表示枠はあるが、ユーザー操作としてはまだ保管庫になっていないため、Virtual Layer Panelより先にFolder UI MVPを整える。
- **Phase 4z11作成**: `task-gemini/phase4z11.md` を作成。Asset Library内でAsset Folderの作成・リネーム、Assetのフォルダ移動、フォルダ別Asset数表示、選択状態整合を行うMVPに限定。
- **方針確認**: 現在のLane = 通常Layer対応は暫定足場であり、最終的にはClipAssetFolder内のClipAsset/内部Layerを時間軸へ配置する方向。通常レイヤーフォルダとClipAssetFolderは混同しない。
- **保留**: Virtual Layer Panel、内部Layerへの実描画、Lane独立管理、Asset/Folder D&D、ClipAssetをTimelineへ配置する処理、通常レイヤー/通常フォルダのAsset化は後続扱い。

### 2026-05-26 Codex：Phase 4z10確認とfallback補修
- **Phase 4z10確認**: `phase4z10_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。内部Layer合成Preview、末尾→先頭描画、`visible` / `opacity` / `blendMode` 反映、従来Preview fallback の実装を確認。
- **補修**: 内部Layerに `drawingSnapshotId` はあるが実Snapshotが取得できない場合、空Previewで止まらず従来Previewへfallbackできるよう、Preview対象抽出を「raster かつ実Snapshotあり」に変更。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z10 ClipAsset Internal Layer Composite Preview Foundation (完了)
- **内部レイヤー合成プレビュー基盤実装**:
    - `TimelineModel` に、Clipの内部レイヤーからプレビュー対象を抽出するヘルパーを追加。
    - アニメPreviewコンテナにて、内部レイヤーを背面から前面（配列末尾から先頭）の順で合成描画するロジックを実装。
- **データ連動表示**: 内部レイヤーの `visible`（可視性）、`opacity`（透明度）、`blendMode`（合成モード）をプレビューに反映可能に。
- **セーフティ機能**: 内部レイヤーが存在しない、または Snapshot がない場合は、従来の単一 Snapshot プレビューへ自動フォールバックする仕組みを構築。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z10_report.md` を作成。

### 2026-05-25 Codex：Phase 4z10指示作成
- **次フェーズ判断**: 内部LayerのCRUDと順序操作が入ったため、これらを実際にキャンバス上で「重ねて見える」ようにするプレビュー基盤を作る。
- **Phase 4z10作成**: `task-gemini/phase4z10.md` を作成。`TimelineModel` のヘルパー追加、`_renderCelPreview()` の分岐、複数Spriteによる合成描画、`visible`/`opacity`/`blendMode` 反映、従来Previewへのfallbackに限定。
- **保留**: 内部Layerへの直接描画、Virtual Layer Panel、内部レイヤー編集UI（スライダー等）、合成結果のキャッシュ/ベイク、通常レイヤーパネルとのExport連携は後続扱い。

### 2026-05-25 Codex：新チャット移行用Handoff作成
- **引き継ぎ作成**: `tegaki_work/PHASE4Z_HANDOFF.md` を作成。新チャットのCodexが読むべき順番、Phase 4z6〜4z9の現在地、Preview/背景/内部Layerの設計判断、次Phase候補を整理。
- **次Phase方針**: 次Phase指示書は新チャット側で最新ファイルを読み直して作成する。候補は内部Layer合成Preview基盤、Virtual Layer Panel棚卸し、または4z系整理。
- **役割分担明記**: 棚卸しや限定実装はGemini、軽微補修・高難度/重要改修・レビューはCodexが担当する運用を引き継ぎに明記。

### 2026-05-25 Codex：Phase 4z9確認
- **Phase 4z9確認**: `phase4z9_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`moveClipAssetInternalLayer()`、Inspectorの `▲` / `▼`、先頭/末尾のdisabled、選択維持は実装されている。
- **順序方針**: Inspector表示は配列先頭が上/前面。将来の合成Previewでは末尾から描画して先頭を前面にする案が報告書に記録されている。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z9 ClipAsset Internal Layer Order MVP (完了)
- **レイヤー順序操作実装**: `TimelineModel` に `moveClipAssetInternalLayer()` を追加し、アセット内の前後関係を操作可能に。
- **Inspector UI 拡張**: 各レイヤー行に `▲` / `▼` ボタンを配置。
- **境界・選択制御**: 先頭/末尾でのボタン無効化、および順序変更後の選択状態維持を実装。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z9_report.md` を作成。

### 2026-05-25 Codex：Phase 4z9指示作成
- **次フェーズ判断**: 内部LayerのCRUDが入ったため、次は合成PreviewやVirtual Layer Panelに進む前に、内部Layer配列の順序をユーザー操作で変更できるようにする。
- **Phase 4z9作成**: `task-gemini/phase4z9.md` を作成。Internal Layers Inspector内で上下ボタンによる順序移動、境界ガード、選択維持を行うMVPに限定。
- **保留**: 内部Layer D&D、内部Layer合成Preview、実描画、Virtual Layer Panel、通常レイヤーパネル切替、blendMode/opacity編集、CAPTURE/AUTO/EDIT整理は後続扱い。

### 2026-05-25 Codex：Phase 4z8確認とInspector UI補修
- **Phase 4z8確認**: `phase4z8_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。内部Layerの追加、削除、リネーム、visible切替、最後の1枚削除ガードは実装されている。
- **補修**: `.anim-lib-label` のCSSが二重定義され、Internal Layersヘッダーの `+` ボタン配置が後勝ちで崩れうるため、後側定義にもflex配置を反映。
- **補修**: 非表示内部Layer行に `is-hidden` クラスを付け、Inspector上で行全体が薄く見えるようにした。Previewには引き続き影響させない。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z8 ClipAsset Internal Layer CRUD MVP (完了)
- **内部レイヤー管理機能実装**: `TimelineModel` に追加・リネーム・削除・可視性トグルのヘルパーメソッドを実装。
- **Inspector UI 拡張**: 各レイヤー行に「👁 (表示)」「✎ (リネーム)」「× (削除)」ボタンを配置。ヘッダーに「+ (追加)」ボタンを新設。
- **安全性確保**: アセットの最後の1レイヤーが削除されるのを防ぐガードロジックを導入。
- **UX改善**: 削除後の選択自動移動、リネーム時の `prompt()` 利用など、Inspector 内での最小限の操作を可能にした。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z8_report.md` を作成。

### 2026-05-25 Codex：Phase 4z8指示作成
- **次フェーズ判断**: 内部Layer Inspectorで構造が見えるようになったため、次はVirtual Layer Panelや合成Previewではなく、内部Layerの最小CRUDをInspector内に閉じて実装する。
- **Phase 4z8作成**: `task-gemini/phase4z8.md` を作成。内部Layerの追加、削除、リネーム、visible切替、最後のLayer削除ガードを純データ操作として整える。
- **保留**: 内部Layerへの実描画、内部Layer合成Preview、Virtual Layer Panel、通常レイヤーパネル切替、内部Layer D&D、Snapshot GC、CAPTURE/AUTO/EDIT整理は後続扱い。

### 2026-05-24 Gemini：Phase 4z7 ClipAsset Internal Layer Inspector Skeleton (完了)
- **内部レイヤー Inspector 実装**: Asset Library 内に、選択中のアセットが持つ内部レイヤーを詳細表示するインスペクターを新設。
- **3カラムレイアウト**: フォルダ・アセット・内部レイヤーを一度に確認できる UI 構成に拡張。
- **詳細メタデータ表示**: レイヤー名、タイプ、可視性、不透明度、合成モード、Snapshot の有無を一覧表示。
- **データ連動**: タイムラインでのクリップ選択と連動してインスペクターを表示。内部レイヤーの個別選択状態も管理。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z7_report.md` を作成。

### 2026-05-25 Codex：Phase 4z7指示作成
- **次フェーズ判断**: 内部Layerのデータ基盤が入ったため、次はVirtual Layer Panelや編集機能ではなく、Asset Library内で選択中Assetの内部Layerを確認できるInspectorの骨格へ進む。
- **Phase 4z7作成**: `task-gemini/phase4z7.md` を作成。内部Layer名、type、visible、opacity、blendMode、Snapshot有無を表示し、クリックで選択状態だけ持てるようにするMVP。
- **保留**: 内部Layerの追加/削除/リネーム、visible/opacity/blendMode編集、内部Layer合成Preview、通常レイヤーパネル切替、CAPTURE/AUTO/EDIT整理、Asset Library本格D&Dは後続扱い。

### 2026-05-25 Codex：Phase 4z6確認と内部Layer補修
- **Phase 4z6確認**: `phase4z6_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`ClipAssetInternalLayerModel`、`ClipAssetModel.internalLayers` のモデル化、Blank/CAPTURE/Auto-Seed/Make Unique時の内部Layer作成、Asset Libraryの `L:n` 表示は実装されている。
- **補修**: 既存AssetをCAPTURE/AUTOで更新する経路では、`internalLayers` が空の古いAssetを補完していなかったため、更新時に `ensureClipAssetInternalLayer()` を呼び、raster内部Layerの `drawingSnapshotId` をAsset本体と同期するよう修正。
- **補修**: Make Unique前に元Assetの内部Layerを補完するようにし、古いAssetを独立化しても内部Layer情報が欠落しないようにした。
- **補修**: `ClipAssetInternalLayerModel` を `window` へ登録し、他UI/デバッグから参照できるようにした。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z6 ClipAsset Internal Layer Data Foundation (完了)
- **内部レイヤーモデル実装**: `ClipAssetInternalLayerModel` を追加。アセットが独自のレイヤー階層を持てる基盤を構築。
- **データ構造の高度化**: `ClipAssetModel` 内で内部レイヤーをインスタンス管理し、シリアライズに対応。
- **生成パスの対応**: 空アセット作成、キャプチャ、初期シード、UNIQUE（独立化）時に初期レイヤーの自動生成やディープコピーを行うよう拡張。
- **UIフィードバック**: Asset Library 内に各アセットの内部レイヤー数を表示するように改修。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z6_report.md` を作成。

### 2026-05-25 Codex：Phase 4z6指示作成
- **次フェーズ判断**: 初期ClipAsset Seedが入ったため、次はFrame複製やUIより先に、ClipAsset内部レイヤーの純データ基盤を固める。現行PreviewはSnapshot表示のまま維持する。
- **Phase 4z6作成**: `task-gemini/phase4z6.md` を作成。`ClipAssetInternalLayerModel`、`ClipAssetModel.internalLayers` のモデル化、Blank/CAPTURE/Auto-Seed/Make Unique時の内部Layer整合に限定。
- **背景方針**: 共有背景はClipAsset内部Layer化しない。線だけのClipが透ける場合は、各Clip側の塗りLayerで遮蔽する前提。
- **保留**: 内部Layer編集UI、Virtual Layer Panel、内部Layer合成Preview、複数通常LayerのClipAsset内部化、Frame 2で前Frame複製、CAPTURE/AUTO/EDIT整理は後続扱い。

### 2026-05-25 Codex：Phase 4z5確認と背景/Blank補修
- **Phase 4z5確認**: `phase4z5_report.md` と `animation-table-popup.js` を確認。初回表示時のFrame 1自動ClipAsset Seed、重複防止、Asset Library反映は実装されている。
- **補修**: 背景レイヤーがアクティブな場合、背景Laneを掴んでreturnする可能性があったため、Seed対象Lane選定時点で背景/フォルダLayerを除外し、通常Layerへフォールバックするよう修正。
- **補修**: 空の透明レイヤーを初期Seedした場合に非Blank扱いになるため、Snapshotのalphaを走査して完全透明なら `isBlank: true` にするBlank判定を追加。
- **背景方針確認**: ツール背景は全Clip共通の下地で、描画物ではない。線だけのClipは合成時に下のClipが透けるため、必要な遮蔽は各Clip側で色を塗る前提。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z5 Initial ClipAsset Auto-Seed MVP (完了)
- **初期シード機能実装**: アニメテーブル初回表示時に、現在のレイヤー描画を自動的に1コマ目の `ClipAsset` として登録。
- **ターゲット選定**: アクティブレイヤーまたは最上位の通常レーンを自動判別。背景レイヤーは除外。
- **UX改善**: 既存の描画内容が即座にタイムラインへ反映されるようになり、アニメーション作成の開始がスムーズに。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z5_report.md` を作成。

### 2026-05-25 Codex：Phase 4z5指示作成
- **次フェーズ判断**: 1レーンのパラパラ漫画/ストーリーボードを軽く始められるよう、アニメテーブル表示時にFrame 1 / 対象Laneへ初期ClipAssetを自動SeedするMVPへ進む。
- **背景方針**: 背景レイヤーは共有のキャンバス下地であり、絵としての背景ではない。ClipAsset内部へコピーせず、絵の背景が必要な場合は通常レイヤーとして描いたものをClipAsset対象にする。
- **Phase 4z5作成**: `task-gemini/phase4z5.md` を作成。既存通常レイヤー描画をFrame 1のClipAsset Snapshotとして自動作成し、重複作成・背景/フォルダLane対象化を避けるMVPに限定。
- **保留**: ClipAsset内部レイヤー、複数通常レイヤーの内部Layer化、Frame 2で前Frameを複製、背景レイヤーのAsset化、Virtual Layer Panel、CAPTURE/AUTO/EDIT整理は後続扱い。

### 2026-05-25 Codex：Phase 4z4確認と単一レーン設計メモ追記
- **Phase 4z4確認**: `phase4z4_report.md` と `animation-table-popup.js` を確認。`ASSETS` トグル、フォルダ一覧、Asset一覧、Blank/Refs表示、選択中ClipのAsset強調は実装されている。
- **補修**: `anim-asset-library` の表示切替にインライン `style.display` を使っていたため、`is-visible` クラス制御へ変更。
- **設計メモ追記**: `task-gemini/phase4n_preview_scope_note.md` に、1レーンのパラパラ漫画/ストーリーボードでも内部的には `ClipAsset` / `ClipInstance` に乗せるが、軽い作画体験では保管庫を意識させない方針を追記。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z4 Asset Library Skeleton MVP (完了)
- **ライブラリUI実装**: タイムライン下部に展開する2カラム（フォルダ/アセット）形式の管理パネルを構築。
- **データ連動表示**: 前フェーズのフォルダ基盤を活用し、所属アセットのフィルタリング・名前・メタ情報（空/参照数）を表示。
- **選択状態の同期**: タイムラインで選択中のクリップが参照しているアセットをライブラリ内で強調表示（青い強調線）する機能を実装。
- **ASSETSトグル**: ヘッダー右側にパネル表示切り替えボタンを追加。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z4_report.md` を作成。

### 2026-05-25 Codex：Phase 4z4指示作成
- **次フェーズ判断**: ClipAssetフォルダのデータ基盤が入ったため、次は装飾やレイヤーパネル統合ではなく、Asset Libraryの最小可視化へ進む。まずGeminiに骨格を実装させ、CODEXで確認・補修する。
- **Phase 4z4作成**: `task-gemini/phase4z4.md` を作成。アニメテーブル内に `ASSETS` トグル、フォルダ一覧、Asset一覧、Blank/共有数/選択中ClipのAsset強調を表示するMVPに限定。
- **保留**: AssetのD&D、Asset配置、Asset/Folderリネーム・削除UI、サムネイル、ClipAssetフォルダの最終デザイン、レイヤーパネル統合、Clip内部レイヤーは後続扱い。

### 2026-05-25 Codex：Phase 4z3確認とFolderヘルパー補修
- **Phase 4z3確認**: `phase4z3_report.md` と `animation-data-model.js` を確認。`ClipAssetFolderModel`、`ClipAssetModel.folderId`、`TimelineModel.clipAssetFolders`、フォルダ操作ヘルパー、serialize対応は実装されている。
- **補修**: `createClipAssetFolder()` で存在しない `parentFolderId` を受け付けないようにし、`renameClipAssetFolder()` で空名を拒否してtrim済み名称を保存するようにした。Asset Library UI前にデータの破綻を防ぐための小補修。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z3 ClipAsset Folder Data Foundation (完了)
- **フォルダデータモデル実装**: `ClipAssetFolderModel` を追加し、アセットを保管・分類する基盤を構築。
- **アセット所属管理**: `ClipAssetModel` に `folderId` を追加。新規作成・複製・キャプチャ時にフォルダ情報を保持・継承可能に。
- **管理ヘルパー拡充**: `TimelineModel` にフォルダの作成・リネーム・移動・取得などの純データ操作メソッドを実装。
- **シリアライズ対応**: タイムラインの保存データにフォルダ構造が含まれるよう拡張。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z3_report.md` を作成。

### 2026-05-25 Codex：Phase 4z3指示作成
- **次フェーズ判断**: レーンとClipAssetフォルダを早めに入れないと、暫定UIの二重整備が増える。まず装飾やレイヤーパネル表示ではなく、ClipAssetを分類する純データ基盤から始める。
- **Phase 4z3作成**: `task-gemini/phase4z3.md` を作成。`ClipAssetFolderModel`、`ClipAssetModel.folderId`、`TimelineModel.clipAssetFolders`、フォルダ作成/リネーム/Asset移動/一覧取得ヘルパーに限定。
- **保留**: ClipAssetフォルダの見た目、レイヤーパネル表示、Asset Library popup、Clipごとの枠色、SVG装飾、Clip内部レイヤー、`AUTO`/`EDIT`/`CAPTURE`/`UNIQUE`整理は後続扱い。

### 2026-05-25 Codex：Phase 4z2確認とSET対象ID補修
- **Phase 4z2確認**: `phase4z2_report.md` と `animation-table-popup.js` を確認。`includedLanes` Scope、Lane行のincludeボタン、複数Laneフィルタ、再生開始時の対象Lane固定は実装されている。
- **補修**: `includedLaneIds` は一時状態のため、レーン削除/同期後に古いLane IDが残るとSET表示が空になりやすい。描画フィルタ取得時に現存Lane IDと照合し、古いIDを除去する処理を追加。
- **判断**: ここまでの細かい暫定UI追加で二重整備の気配が強くなっているため、次は細部UIより `Lane` 独立管理と `ClipAsset` フォルダ/ライブラリ足場を優先するのが妥当。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z2 Lane Playback Include MVP (完了)
- **SETスコープ機能実装**: プレビュー/再生対象を任意に複数選択できる `includedLanes` (SET) モードを導入。
- **複数Laneフィルタリング**: `_getPreviewLaneFilterIds` を実装し、キャンバス合成およびオニオンスキンが複数の対象レーンを正しく処理できるように拡張。
- **UI追加**: スコープ切り替えに `SET` ボタンを追加。各レーンに `+`/`✓` (include) ボタンを設置し、直感的な対象選択を可能に。
- **再生時の安定化**: 再生開始時の対象セットを固定する `activePlaybackLaneIds` ロジックを実装。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z2_report.md` を作成。

### 2026-05-25 Codex：Phase 4z2指示作成
- **次フェーズ判断**: `CAPTURE` という名称は現行Snapshot記録と将来の複数Lane再生対象記録で衝突するため、名前付きキャプチャー機能ではなく、Lane行側のチェック/点灯で「SET再生対象に含める」MVPへ進める。
- **Phase 4z2作成**: `task-gemini/phase4z2.md` を作成。Scopeを `ALL / LANE / SET` に拡張し、Lane行のincludeボタンで複数Laneを再生/プレビュー対象にできる一時状態を作る。
- **暫定UIメモ**: `AUTO`、`EDIT`、現行 `CAPTURE`、`UNIQUE` はLane/Clip内部レイヤー/Virtual Layer Panelが整うと消える、または名前や位置が変わる可能性が高い。今回も本格UI整理は後続扱い。
- **保留**: 名前付きPlayback Set保存、複数セット管理、Solo/Mute完全実装、Virtual Layer Panel、Clip内部レイヤー、Asset Library、`CAPTURE` 正式改名は後続扱い。

### 2026-05-25 Codex：Phase 4z1確認とScope UI補修
- **Phase 4z1確認**: `phase4z1_report.md` と `animation-table-popup.js` を確認。`playbackScope`、`activePlaybackLaneId`、`ALL/LANE` フィルタ、ONIONへのLaneフィルタ適用は実装されている。
- **補修**: `LANE` 再生開始時、選択ClipのLaneを固定する前に選択解除していたため、Lane固定がアクティブレイヤー依存へ落ちる可能性があった。Lane固定後に選択解除する順序へ修正。
- **補修**: `SCOPE: ALL/LANE` UIをヘッダー中央から再生ボタン横へ移動。再生対象切替として認識しやすい配置へ調整。
- **補修**: ヘッダードラッグ判定からScopeボタン等の操作UIを包括的に除外し、クリック操作とパネル移動が競合しにくいようにした。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z1 Playback Scope: All / Active Lane MVP (完了)
- **再生スコープ機能実装**: プレビューおよび再生の対象を「全レーン」または「アクティブレーンのみ」に切り替える `playbackScope` を実装。
- **描画フィルタリング**: `_renderFrameComposite` 等にレーンフィルタを導入し、特定レーンのみの合成・オニオンスキン表示を可能に。
- **UI追加**: ヘッダーに `SCOPE: ALL | LANE` ボタンを追加し、現在のモードを視覚的に強調表示。
- **再生時の安定化**: `LANE` モード再生開始時に、その時点のアクティブレーンを固定するロジックを導入。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z1_report.md` を作成。

### 2026-05-25 Codex：Phase 4z1指示作成
- **次フェーズ判断**: オーナーの再生/表示観念は、標準の全体合成表示と、編集/確認用の限定表示を分ける設計として問題なし。レーン/Virtual Layer Panel本実装前に、軽量な `ALL` / `LANE` 再生スコープを入れるのが妥当。
- **Phase 4z1作成**: `task-gemini/phase4z1.md` を作成。`ALL` は現在フレーム上の全Clip合成、`LANE` は選択Clipまたはアクティブレイヤー由来のActive Laneのみを表示/再生するMVPに限定。
- **保留**: 複数Laneを記録する `Lane Set` / `Playback Capture`、Virtual Layer Panel、ClipAssetフォルダ、Asset Library、Clip内部レイヤー、Export仕様変更、ペン操作向けD&D改善は後続扱い。

### 2026-05-25 Codex：Phase 4z確認と再生/キャプチャ概念メモ追記
- **Phase 4z確認**: `phase4z_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`isBlank`、空Asset自動生成、空セルの白丸非表示、CAPTURE/AUTO時の `isBlank=false`、UNIQUE有効条件の整理は実装されている。
- **補修**: 新規空セルの互換 `rasterSnapshot.pixels` が正本Snapshotと同じ配列参照になっていたため、互換フィールド側もコピーを持つよう補修。
- **設計メモ追記**: `task-gemini/phase4n_preview_scope_note.md` に、将来の「全Lane再生」「Active Lane再生」「複数Laneを記録するPlayback Capture/Lane Set」と、現行 `CAPTURE` ボタンの命名衝突について追記。レーン/Asset Library/Virtual Layer Panel整備後に反映する。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4z Blank Clip Asset on Cel Create MVP (完了)
- **空アセット自動生成**: セル作成時にキャンバスサイズに合わせた空の `ClipAsset` を自動割り当て。これにより、作成後即座に独立した編集が可能に。
- **`isBlank` 状態管理**: スナップショットに「空」フラグを導入。中身があるまでスナップショットアイコン（白丸）を非表示にし、タイムラインを視覚的に整理。
- **UI改善**: `UNIQUE` ボタンを「アセット共有中」のみ有効化するよう最適化。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4z_report.md` を作成。

### 2026-05-24 Codex：Phase 4z指示作成
- **次フェーズ判断**: レーン/ClipAssetフォルダ/Virtual Layer Panelはまだ待つ。二重作業を避けつつ進めるため、新規セル作成時点で空Assetを持たせる基礎整備へ進む。
- **Phase 4z作成**: `task-gemini/phase4z.md` を作成。`DrawingSnapshotModel.isBlank`、空Asset作成ヘルパー、新規セルへの空Asset紐付け、CAPTURE/AUTO時の `isBlank=false`、空Assetセルの白丸非表示に限定。
- **保留**: Asset Library、ClipAssetフォルダ、Lane独自管理UI、Clip内部レイヤー、Undo/Redo統合、D&Dペン操作改善は後続扱い。Phase 4z以降は `phase4z1.md`, `phase4z2.md` のASCII連番を使う。

### 2026-05-24 Codex：Phase 4y確認と互換Snapshot補修
- **Phase 4y確認**: `phase4y_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`countAssetReferences()` / `isAssetShared()` / `makeClipAssetUnique()`、`UNIQUE` ボタン、共有Assetのリンク表示は実装されている。
- **補修**: Make Unique後の `clip.rasterSnapshot.pixels` が新しい `DrawingSnapshot` と同じ配列参照になっていたため、互換フィールド側もコピーを持つよう補修。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4y Clip Asset Make Unique MVP (完了)
- **アセット独立化 (Make Unique) 実装**:
    - `TimelineModel` に `makeClipAssetUnique()` を追加。共有アセットを物理複製して切り離すロジックを確立。
    - アセット参照数カウント機能により、正確な共有判定を実現。
- **共有状態の可視化**:
    - 複数のクリップで共有されているアセットに「リンク（鎖）」アイコンを表示するUIを実装。
- **UI統合**:
    - ヘッダーに `UNIQUE` ボタンを追加し、アセット共有中のみ有効化・強調する制御を導入。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4y_report.md` を作成。

### 2026-05-24 Codex：Phase 4y指示作成
- **次フェーズ判断**: EDIT + AUTO によりClipを描き替えやすくなった一方、COPY/PASTE由来の同一 `assetId` 共有では片方の編集が全Clipへ反映される。複数選択より先に、選択Clipだけ独立Assetへ切り離す `UNIQUE` を入れて編集事故を減らす。
- **Phase 4y作成**: `task-gemini/phase4y.md` を作成。`TimelineModel` にAsset参照数ヘルパーと `makeClipAssetUnique()` を追加し、UIに `UNIQUE` ボタンを置くMVPに限定。
- **保留**: Asset Library、共有Clip一覧、Undo/Redo統合、複数Clip一括UNIQUE、Clip内部レイヤーのディープコピー、Virtual Layer Panelは後続扱い。

### 2026-05-24 Codex：Phase 4x確認とEDIT残留補修
- **Phase 4x確認**: `phase4x_report.md` と `animation-table-popup.js` を確認。`EDIT` トグル、Clip Edit Mode、EDIT中の実レイヤー優先表示、AUTO連携、編集中セル/ヘッダー強調は実装されている。
- **補修**: 再生開始、パネル非表示、左右キー移動、選択Clip削除時にEDIT状態が残る可能性があったため、各経路で `exitClipEditMode()` を呼ぶよう補修。
- **補修**: ヘッダードラッグ判定から `AUTO` / `EDIT` チェックボックスを除外し、トグル操作時にパネル移動が誤発火しないようにした。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4x Clip Edit Mode MVP (完了)
- **クリップ編集モード (EDIT) の実装**:
    - `EDIT` トグルを追加。有効時、アニメーションの全体合成表示を一時停止し、選択中セルのソース実レイヤーをキャンバスに復元して直接編集可能にする仕組みを構築。
    - 編集終了時やフレーム移動時に、自動で安全にプレビュー状態へ復帰するガードロジックを実装。
- **AUTO + EDIT の連携強化**:
    - 編集モード中の描画終了をトリガーに、Snapshot を自動更新するワークフローを確立。
- **UI/UX の視覚的強化**:
    - 編集中のセルを水色の発光エフェクト (`.editing`) で強調。
    - EDIT モード中はパネルヘッダーの色を変更し、モードの視認性を向上。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4x_report.md` を作成。

### 2026-05-24 Codex：Phase 4x指示作成
- **次フェーズ判断**: Phase 4w でAUTO反映は成立したが、PREVIEW ON中は実レイヤーのライブ描画とプレビューContainerが競合し、ペンを離した瞬間に反映される体感が残る。次は `Clip Edit Mode` を作り、選択Clip編集中はPREVIEW合成を一時停止して実レイヤー描画を優先する。
- **Phase 4x作成**: `task-gemini/phase4x.md` を作成。`EDIT` UI、`isClipEditModeActive`、PREVIEW状態の一時退避/復帰、EDIT + AUTOの関係整理に限定。
- **保留**: Virtual Layer Panel、Clip内部レイヤー、Frame番号クリック時のセルフォルダ表示、バケツ/貼り付け/変形のAuto Capture、D&Dペン操作改善、durationハンドル大型化は後続扱い。
- **Phase名メモ**: 4z以降も継続する場合は、ファイル名・URL・Windows環境で扱いやすい `phase4z1.md`, `phase4z2.md` 形式を優先する。ギリシャ文字などの非ASCII記号は避ける。

### 2026-05-24 Codex：Phase 4w確認とAuto Capture所感整理
- **Phase 4w確認**: `phase4w_report.md` と `animation-table-popup.js` を確認。`AUTO` トグル、`drawing:stroke-completed` 購読、選択Clipと描画実レイヤー一致時のみの自動Snapshot更新、既存DrawingSnapshot更新は実装されている。
- **所感整理**: AUTO + PREVIEW ON では、ストローク中の実レイヤー表示がプレビュー層と競合しやすく、ペンを離した瞬間に反映される体感になる。これはClip Edit View / Virtual Layer Panel未実装の暫定制約として扱い、レーン周りが進んでから整理する。
- **入力UX整理**: ペンでのクリップ移動やduration伸縮がやりにくい件は、タイムラインD&Dのポインタ操作設計として後続扱い。レイヤーパネルD&D修正の習作にもなるため、次以降で必要なら移動候補表示やハンドル大型化を検討する。
- **軽補修**: 手動Capture時に残っていた不要な `console.log` を削除。Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4w Auto Capture / Auto-Key MVP (完了)
- **自動キャプチャ機能の実装**:
    - アニメテーブルに `AUTO` トグルを追加。有効時、描画終了を検知して選択中のセルへ現在の描画内容を自動で記録する仕組みを構築。
    - `drawing:stroke-completed` イベントを購読し、適切なレイヤー・セルの組み合わせ時のみ発火するガードロジックを実装。
- **アセット更新ロジックの最適化**:
    - 既存の `ClipAsset` / `DrawingSnapshot` がある場合は新規作成せず、内容を上書き更新するように改修。
    - 更新時にテクスチャキャッシュを適切に破棄し、メモリ効率とプレビューの即応性を両立。
- **操作整合性の維持**:
    - 手動キャプチャとのロジック統合。移動・伸縮・複製などの既存機能への影響がないことを確認。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4w_report.md` を作成。

### 2026-05-24 Codex：Phase 4w指示作成
- **次フェーズ判断**: Phase 4v でClip移動D&Dが成立したため、次は作画手数を減らす Auto Capture / Auto-Key MVP へ進める。対象は安全に拾える `drawing:stroke-completed` のみとし、バケツ・貼り付け・変形・Undo/Redo統合は後続へ回す。
- **Phase 4w作成**: `task-gemini/phase4w.md` を作成。`AUTO` トグルを追加し、ON時だけ選択Clipと描画実レイヤーが一致した場合にSnapshotを自動更新する方針。既存ClipAsset / DrawingSnapshot更新とTexture cache破棄も指示。
- **保留**: 空フレームへの自動Clip作成、ClipAsset共有の自動独立化、Clip内部編集、Virtual Layer Panel、Preview ON中の本格編集UX、アニメ保存形式完成は後続扱い。

### 2026-05-24 Codex：Phase 4v確認と移動フィードバック軽補修
- **Phase 4v確認**: `phase4v_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`canMoveClip()` / `moveClip()` とクリップ本体D&Dは指示範囲内で実装されている。
- **所感整理**: 二重橙点灯は、通常レイヤーのactive Laneとアニメテーブル上の選択Clipが別概念になり始めた影響。レーン/Clip内部編集が進んでから整理する方が安全。
- **軽補修**: 移動成功時の不要な `console.log` を削除し、`.anim-cel-block.moving` のアウトラインと影を少し強めて、ドラッグ中であることを見分けやすくした。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4v Timeline Clip Move MVP (完了)
- **クリップ移動ロジックの実装**:
    - `TimelineModel` に `canMoveClip` と `moveClip` メソッドを追加。フレーム・レーン間の移動の妥当性検証とデータ更新を可能に。
    - レーン移動時には、所属実レイヤーの ID (`sourceLayerId`, `layerId`) を自動的に更新し、プレビュー整合性を維持。
- **ドラッグ＆ドロップ操作の実装**:
    - クリップブロック本体をドラッグして直感的に位置を移動できる機能を実装。
    - 移動中はブロックを半透明化し、カーソルを `grabbing` に変更する視覚フィードバックを追加。
    - **誤クリック防止**: 一定距離（4px）以上の移動でドラッグ判定とするデバウンスを導入し、クリック操作（選択）との競合を回避。
- **安全性の確保**:
    - 既存の「リタイミングハンドル（端の伸縮）」と「移動（本体ドラッグ）」の判定領域を明確に分離。
    - 移動先の重なりチェックを徹底し、既存データの上書き・破壊を防止。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4v_report.md` を作成。

### 2026-05-24 Codex：Phase 4v指示作成
- **次フェーズ判断**: Phase 4u で Lane/ClipInstance 足場が入ったため、次は自動キャプチャより先にタイムライン上の配置操作を固める。描画エンジンやHistoryへ触る前に、ClipInstance の移動整合性を確認する。
- **Phase 4v作成**: `task-gemini/phase4v.md` を作成。対象はアニメテーブル内のクリップ移動D&Dのみ。`TimelineModel.moveClip()` などモデル側の移動判定を先に作り、UIは `.anim-cel-block` 本体ドラッグへ接続するMVPに限定。
- **保留**: レイヤーパネルD&D、Lane並べ替え、複数セル選択、Shift/Altドラッグ複製、Undo/Redo統合、自動キャプチャ、Virtual Layer Panel、Clip内部編集は後続扱い。

### 2026-05-24 Codex：Phase 4u確認
- **実装確認**: `phase4u_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`LaneModel` / `ClipInstanceModel` が追加され、`TrackModel` / `CelModel` は互換エイリアスとして維持されている。
- **互換確認**: `sourceLayerId` と `layerId` の二重保持、`getLaneForSourceLayer()` / `findClipEntry()` の追加、UI側の主要参照委譲、左上表示 `LANES` への変更を確認。
- **確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4u Lane/ClipInstance 足場化MVP (完了)
- **データモデルの Lane/Clip 構造化**:
    - `animation-data-model.js` に `LaneModel` と `ClipInstanceModel` を導入。長期的な「独立描画コンテナ」構想に向けたデータ構造の足場を構築。
    - `TrackModel` / `CelModel` を互換エイリアスとして維持し、既存コードとの接続を保証。
    - `sourceLayerId` を新設し、`layerId` との二重持ち（互換連動）により、実レイヤー直結から段階的に脱却する準備を完了。
- **UI 内部ロジックのリファクタリング**:
    - `AnimationTablePopup` 内の検索・同期ロジックを、モデル側の新しい補助メソッド（`findClipEntry`, `getLaneForSourceLayer` 等）へ集約。
    - 左上ヘッダーの表示名を `TRACKS` から `LANES` へ変更。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4u_report.md` を作成。

### 2026-05-24 Codex：Phase 4u指示作成
- **次フェーズ判断**: Phase 4t の実機確認で、Frame単位の合成表示とセル単独編集表示の切り分けはレーン/クリップ構造が未整備だと深追いが危険と判断。表示UIの大改修ではなく、先に `Track = Layer` 依存を薄める足場化へ進める。
- **Phase 4u作成**: `task-gemini/phase4u.md` を作成。`LaneModel` / `ClipInstanceModel` を追加しつつ、既存 `TrackModel` / `CelModel` / `tracks` / `cels` は互換維持するMVPに限定。
- **保留**: Virtual Layer Panel、Clip内部レイヤー編集、Frame番号クリック時のセルフォルダ表示、Lane追加/削除UI、Solo/Mute、セルD&D、自動キャプチャ、アニメ保存形式完成は後続扱い。

### 2026-05-24 Codex：Phase 4t確認とFrame/Clip表示スコープ補足
- **Phase 4t確認**: `phase4t_report.md` と `animation-table-popup.js` を確認。`ONION` トグル、前後1フレーム表示、再生中非表示、セル選択中は同一track限定の実装は Phase 4t 指示範囲として成立。
- **表示スコープ整理**: 現状はプレビューContainer上で、フレームヘッダー/左右キーは全セル合成、セルクリック時は選択セル単独表示。レイヤーパネル側をFrame内クリップ群の仮想フォルダへ切り替える機構は未実装。
- **設計メモ追記**: `task-gemini/phase4n_preview_scope_note.md` に、Frame番号クリック時のFrame Compositeと、将来のVirtual Layer Panel / Clip内部レイヤー表示の切り分けを追記。レーン整備前には深追いしない方針。

### 2026-05-24 Gemini：Phase 4t Animation Onion Skin MVP (完了)
- **オニオンスキン機能の実装**:
    - タイムラインプレビュー時に、現在フレームの前後（-1, +1）を半透明で重ねて表示する機能を実装。
    - 前フレームを青系 (`0x4f8cff`)、次フレームを赤系 (`0xff8c42`) に色分けし、視認性を向上。
- **プレビューロジックのリファクタリング**:
    - 描画処理を `_renderFrameComposite`, `_renderOnionSkins`, `_renderCelPreview` に分割し、責務を明確化。
    - `TimelineModel.getSnapshotForCel()` を介したアセットベースのSnapshot解決を徹底。
- **UI/UX の向上**:
    - アニメテーブルヘッダーに `ONION` 切り替えトグルを追加。
    - 再生中（isPlaying）は自動でオニオンスキンを非表示にする制御を導入。
    - セル選択中は、該当トラックのみにオニオンスキンを限定する「フォーカス表示」に対応。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4t_report.md` を作成。

### 2026-05-24 Codex：Phase 4t指示作成
- **次フェーズ判断**: 保存基盤の IndexedDB 化が完了し、多数アルバム保管も実機確認できたため、アニメ作業へ戻る。自動キャプチャやセルD&Dより先に、既存プレビューContainerで小さく実装できる作画支援として Onion Skin を入れる。
- **Phase 4t作成**: `task-gemini/phase4t.md` を作成。`ONION` トグル、前後1フレームの薄い表示、Frame Composite Preview と Selected Cel 表示の切り分け、`getSnapshotForCel()` 経由のSnapshot解決に限定。
- **保留**: 複数枚 onion、濃度/色設定UI、Y軸階層 onion、Solo/Mute、自動キャプチャ、セルD&D、LaneModel化は後続扱い。

### 2026-05-24 Codex：Phase 4s確認とAlbumStorage全削除補修
- **Phase 4s確認**: `phase4s_report.md`、`album-storage.js`、`album-popup.js`、`ARCHITECTURE.md` を確認。通常アルバムは IndexedDB `TegakiAlbumStorage` 正本へ移行し、Hospital `TegakiEmergencyRecovery` とは分離されている。
- **補修**: `AlbumStorage.putAllSnapshots([])` が空配列時に IndexedDB を clear せず resolve していたため、全削除やロールバック時に古い項目が残る可能性があった。`store.clear()` 後に現在配列を書き直す実装へ変更。
- **確認**: `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4s SAVE: Album IndexedDB 正本化MVP (完了)
- **アルバムストレージの IndexedDB 移行**:
    - `system/album-storage.js` を新設し、アルバムデータの正本を `localStorage` から IndexedDB へ切り替え。
    - 5MB の壁を突破し、アニメ化等による巨大プロジェクトデータの安全な保存環境を確立。
- **自動移行の実装**:
    - 初回起動時に `localStorage` の既存アルバムデータを IndexedDB へ自動引き継ぎするロジックを実装。
- **UI 非同期接続の完遂**:
    - `AlbumPopup` の保存・読込・削除・インポート・エクスポート全経路を新ストレージへ接続し、非同期処理を徹底。
- **ドキュメントの整合性確保**:
    - `ARCHITECTURE.md` を更新し、新保存構造を反映。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4s_report.md` を作成。

### 2026-05-24 Codex：Phase 4s指示作成
- **次フェーズ判断**: アルバム10件程度で容量限界が見えるため、アニメ保存へ進む前に通常アルバムの正本を `localStorage` から IndexedDB へ移す。アルバム多めとHistory過多はクラッシュ/不安定化の原因になり得るため、SAVE系の足場を先に固める。
- **Phase 4s作成**: `task-gemini/phase4s.md` を作成。通常アルバム用 `AlbumStorage` を新設し、新規保存/一覧復元/削除/並べ替え/インポート後追加を IndexedDB に寄せるMVPに限定。
- **互換方針**: 旧 `localStorage tegaki_album` は初回移行元として読むが、新規保存の fallback には使わない。HTMLエクスポート/インポート形式は維持し、Hospital Recovery とはDBを分離する。

### 2026-05-24 Codex：Phase 4r2確認とアルバムImport失敗の切り分け補修
- **Phase 4r2確認**: `phase4r2_report.md` と `emergency-recovery-store.js` を確認。自動退避は 1秒 debounce / 5秒 throttle へ即応化され、`pagehide` / `visibilitychange` で `forceCheckpointSoon()` を試みる導線が追加されている。
- **症状整理**: アルバムインポート失敗 alert は、ファイル解析失敗だけでなく、追加後の `localStorage.setItem()` 失敗や描画更新失敗も同じ文言で表示する構造だった。
- **補修**: `album-popup.js` のインポート処理を、ファイル解析失敗・保存容量/保存処理失敗・ファイル読み取り失敗へ分離。保存失敗時は追加前の `snapshots` へロールバックするようにした。
- **確認**: `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-24 Gemini：Phase 4r2 Hospital Recovery 即応化 (完了)
- **自動退避の高速化**:
    - `EmergencyRecoveryStore` の保存間隔を短縮（1秒 debounce + 5秒 throttle）。クラッシュ直前の状態をより確実に拾えるよう即応性を向上。
    - 保存中の再変更を検知し、完了後にデバウンス付きで再保存を予約するロジックを実装。
- **ページ離脱ガードの追加**:
    - `pagehide` / `visibilitychange` イベントをトリガーに、ブラウザを閉じる瞬間の最終退避を試みる補助導線を `core-engine.js` に追加。
- **復元仕様の確定**:
    - Hospital 復旧時に Undo/Redo 履歴をリセットし、最新の描画状態で確定させる仕様を実装・明記。
- **UI 状態管理の補修**:
    - アルバム右端の Hospital ボタン表示制御と tooltip 更新ロジックを最適化。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4r2_report.md` を作成。

### 2026-05-24 Codex：Phase 4r2指示作成・Hospital配置修正

- **次フェーズ判断**: Hospital は「履歴復元」ではなく「最新確定状態を1件だけ上書き退避し、復帰後のHistoryはリセット」でよい。Phase 4r の 60秒 throttle では即応性が薄いため、横道の小改修として Phase 4r2 を立てる。
- **Phase 4r2作成**: `task-gemini/phase4r2.md` を作成。`EmergencyRecoveryStore` の debounce/throttle 短縮、保存中変更後の再退避、`pagehide` / `visibilitychange` での離脱時保存試行、Hospital復帰後のHistoryリセット仕様確認に限定。
- **保留**: History command 永続化、Undo/Redo復元、複数世代バックアップ、合成PNG軽量退避、起動時自動復元ダイアログは後続扱い。

### 2026-05-24 Codex：Phase 4r確認とHospitalボタン配置補修
- **表示確認**: Gemini実装では Hospital ボタンがアルバム保存/ロード群の中にあり、自動退避データがない場合は `display:none` で完全非表示だった。
- **補修**: Hospital ボタンをアルバムツールバー右端の専用グループへ移動し、退避データがない場合も薄い disabled 表示に変更。退避データがある場合は赤系表示と tooltip 日時で復帰可能状態を示す。
- **補修**: Hospital 専用スタイルを JS 内の動的 style 注入から `styles/main.css` へ移動。
- **確認**: `npm.cmd run build` 成功。ブラウザでアルバムを開き、トップバー右端に Hospital アイコンが表示されることを確認。

### 2026-05-24 Gemini：Phase 4r Hospital Recovery / 緊急復帰チェックポイント (完了)
- **緊急復帰システムの構築**:
    - `system/emergency-recovery-store.js` を新設。IndexedDB を用いた大容量・非破壊の自動退避機能を実装。
    - 描画履歴の変化をトリガーに、60秒間隔（デバウンス3秒）で最新プロジェクト状態をバックアップする仕組みを構築。
- **復旧 UI の実装**:
    - アルバムポップアップに `Hospital` ボタンを追加。退避データが存在する場合のみ表示されるインテリジェントな表示制御を実装。
    - ボタンから最後のチェックポイント（日時付き）を確認し、ワンクリックでキャンバスへ復帰できるフローを実現。
- **リソース配慮**:
    - `localStorage` を使用しない設計により、アルバム全体の容量制限問題を回避。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4r_report.md` を作成。

### 2026-05-24 Codex：Phase 4q確認とSnapshot表示補修
- **Phase 4q確認**: `phase4q_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`TimelineModel.getSnapshotForCel()` は `assetId -> ClipAsset -> DrawingSnapshot` を優先し、見つからない場合のみ `cel.rasterSnapshot` へ fallback する実装になっている。
- **補修**: アニメテーブル上の Snapshot 有無表示がまだ `cel.rasterSnapshot` だけを見ていたため、`this.model.getSnapshotForCel(cel)` 経由へ変更。asset参照のみのセルでも Snapshot マークが出るようにした。
- **確認**: `npm.cmd run build` 成功。生成された `dist/` 差分は作業対象から除外。

### 2026-05-23 Gemini：Phase 4q Preview参照元の ClipAsset 化MVP (完了)
- **参照解決ロジックの実装**:
    - `TimelineModel` に `getSnapshotForCel` 等のメソッドを追加。`assetId -> ClipAsset -> DrawingSnapshot` の経路でデータを解決する仕組みを構築。
- **プレビュー表示の移行**:
    - `AnimationTablePopup` のレンダリング処理を、直接の Snapshot 参照から新アセットモデル経由の解決へ移行。
    - 過去データとの互換性のために `rasterSnapshot` フィールドを fallback として維持。
- **データモデルの正本化**:
    - COPY/PASTE したセルが同じ `assetId` を共有し、アセットを一元的に参照していることを確認。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4q_report.md` を作成。

### 2026-05-23 Codex：長時間描画停止疑いの棚卸しとHospital復帰案
- **原因候補**: `HistoryManager.maxSize` は 500 件で古い履歴を破棄しているため、履歴配列の無限増殖ではない。ただし各履歴 command がレイヤーのラスター before/after Snapshot を持つため、長時間描画ではメモリ圧迫が起こり得る。
- **保存経路確認**: 現行アルバムは `localStorage` の `tegaki_album` が正本で、各レイヤーを PNG dataURL として保存する。緊急退避を同じ localStorage に自動保存すると容量上限エラーを誘発しやすい。
- **次タスク化**: `task-gemini/phase4r.md` を作成。Hospital 復帰は通常アルバムとは混ぜず、IndexedDB に最新1件の自動チェックポイントを強く間引いて保存し、アルバム内ボタンから復元する方針。
- **現時点判断**: 4q作業と衝突させないため、本体改修はPhase 4q返却後の独立Phase候補とする。

### 2026-05-23 Codex：Phase 4q指示作成
- **次フェーズ判断**: `ClipAsset` 再利用が成立したため、次はプレビュー参照元を `Cel.rasterSnapshot` 直参照から `assetId -> ClipAsset -> DrawingSnapshot` へ寄せる。
- **Phase 4q作成**: `task-gemini/phase4q.md` を作成。`TimelineModel` に参照解決メソッドを追加し、`AnimationTablePopup._renderCelPreview()` が asset経由で Snapshot を取得できるMVPに限定。
- **保留**: `rasterSnapshot` 削除、保存/ロードUI、Export、ライブラリUI、未使用Asset掃除、オニオンスキン、Solo/Mute、LaneModel化は後続扱い。

### 2026-05-23 Codex：Phase 4p確認・ログ除去
- **Phase 4p確認**: `phase4p_report.md` と `animation-table-popup.js` を確認。COPY/PASTE は同一 `assetId` と `duration` を保持し、既存セルとの重なりを `canPlaceCel()` で防ぐ実装になっている。
- **補修**: `copySelectedCel()` に残っていた調査用 `console.log` を削除。
- **次フェーズ判断**: レーン整備前のコピー/ペーストは操作感が分かりにくいが、同一アセット参照の実証としては成立。次はD&Dや表示支援へ行く前に、プレビュー参照元を `rasterSnapshot` 直参照から `assetId -> ClipAsset -> DrawingSnapshot` へ寄せる。

### 2026-05-23 Gemini：Phase 4p ClipAsset 再利用MVP (完了)
- **コピー＆ペーストの実装**:
    - アニメテーブルに COPY/PASTE ボタンを追加。セルの情報を保持し、他のフレームやトラックへ複製可能に。
    - 貼り付け時、同一アセット ID を参照させることで、データ実体を増やさずに「アセットの再利用」を実現。
- **操作安全性の強化**:
    - 貼り付け時のセル重なり自動チェックを実装し、既存データの誤上書きを防止。
    - フォルダトラックへの貼り付け無効化、削除時のアセット本体保護などの整合性を確保。
- **操作系の安定化**:
    - ドラッグ移動や伸縮操作後のクリック判定を改善。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4p_report.md` を作成。

### 2026-05-23 Codex：Phase 4p指示作成
- **次フェーズ判断**: Phase 4o で `ClipAsset` 参照の足場ができたため、次は1つの `ClipAsset` を複数セルから参照できることを小さく確認する。
- **Phase 4p作成**: `task-gemini/phase4p.md` を作成。アニメテーブル内の `COPY` / `PASTE` ボタンで選択セルの `assetId` / `rasterSnapshot` / `duration` を現在フレーム・アクティブトラックへ再配置するMVPに限定。
- **保留**: セルD&D、Altドラッグコピー、複数選択、ライブラリUI、未使用アセット掃除、Export、オニオンスキン、Solo/Mute は後続扱い。

### 2026-05-23 Codex：Phase 4o確認補修と Ctrl+Sアルバム保存
- **Phase 4o確認**: `phase4o_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。`DrawingSnapshotModel` / `ClipAssetModel` / `CelModel.assetId` / `TimelineModel.clipAssets` / `TimelineModel.drawingSnapshots` の足場は Phase 4o の範囲として成立。
- **補修**: `DrawingSnapshotModel.serialize()` で `pixels` が TypedArray のまま出ると保存形式で扱いにくいため、serialize時に配列化するよう修正。
- **小改修**: `Ctrl+S` / `Cmd+S` で現在の状態をアルバムへ即保存する `ALBUM_QUICK_SAVE` を追加。ブラウザのページ保存と競合しないよう `preventDefault()` してからアルバム保存を呼ぶ。
- **注意点**: `Ctrl+S` はアルバムpopupを開かず保存だけ行う。保存失敗時は既存のアルバム保存経路と同じ警告に任せる。

### 2026-05-23 Gemini：Phase 4o ClipAsset / DrawingSnapshot データモデル足場MVP (完了)
- **新データモデルの導入**:
    - `DrawingSnapshotModel`（描画内容の最小単位）と `ClipAssetModel`（クリップの正本）クラスを `animation-data-model.js` に新設。
    - `TimelineModel` に全アセットを管理する保管場所を追加し、`CelModel` にアセット参照用の `assetId` を追加。
- **Capture機能の拡張**:
    - 手動キャプチャ（CAPTUREボタン）実行時に、生のスナップショットから `DrawingSnapshotModel` および `ClipAssetModel` を自動生成し、セルへ紐付けるロジックを実装。
- **互換性と安全性の維持**:
    - 既存のプレビュー機能を壊さないよう、`rasterSnapshot` フィールドも並行して維持。
    - アセット群を含むシリアライズ処理に対応し、将来の保存形式拡張の土台を構築。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4o_report.md` を作成。

### 2026-05-23 Codex：Phase 4o指示作成
- **次フェーズ判断**: 表示まわりのセルフォルダ、Y軸オニオンスキン、レーン濃淡、Solo/Mute は、Lane / ClipAsset の置き場ができてからでないと二度手間が大きい。
- **Phase 4o作成**: `task-gemini/phase4o.md` を作成。見た目の追加改修は止め、`ClipAsset` / `DrawingSnapshot` / `Cel.assetId` / `TimelineModel.clipAssets` / `TimelineModel.drawingSnapshots` の足場を作るMVPに限定。
- **保留**: セルフォルダ表示、Virtual Layer Panel、Y軸オニオンスキン、Solo/Mute、Export、内部レイヤー編集は後続扱い。

### 2026-05-23 Codex：Phase 4n確認・選択セル単独表示の補修
- **Phase 4n確認**: `phase4n_report.md` と `animation-table-popup.js` を確認。再生時の Frame Composite Preview 方針は成立しているが、セル選択時まで全体合成のままだと編集対象を見失いやすい。
- **補修**: 再生中は全セル合成、セル選択中は選択セル単独表示へ切り替えるよう `_applyVisibilityPreview()` を調整。フレームヘッダークリック/左右キー/再生開始時は選択を解除して全体合成へ戻す。
- **補修**: Snapshot未取得の選択セルは、編集対象が見えるように対応する実レイヤーだけを暫定表示する。Frame Composite Preview では未キャプチャセルを表示しない方針は維持。
- **補修**: duration範囲内の複数スロットが選択表示に見えないよう、選択強調はセルブロック側へ寄せた。
- **設計メモ更新**: `task-gemini/phase4n_preview_scope_note.md` に、再生時は全体合成、セル選択時は選択セル単独表示とする補足を追記。

### 2026-05-23 Gemini：Phase 4n Frame Composite Preview 正本化MVP (完了)
- **全体合成プレビューの正本化**:
    - `_applyVisibilityPreview()` を「現在フレームの全セルを合成表示」するロジックへ刷新。
    - プレビュー有効時、タイムライン管理下の全実レイヤーを非表示にし、プレビュー層 (`animationPreviewContainer`) に Snapshot 群を積層する方式を採用（Plan A）。
- **非破壊・安全性の徹底**:
    - プレビューOFF/パネルクローズ時に、実レイヤーの `visible` 状態を確実に復元。
    - Snapshot 本体に Pixi オブジェクトを混ぜない `WeakMap` キャッシュ管理を維持。
- **UI/UX の整合性**:
    - セル選択とプレビュー内容を分離。再生・移動中も常に「全体の動き」が確認可能な状態へ。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4n_report.md` を作成。

### 2026-05-23 Codex：Phase 4n指示作成
- **次フェーズ判断**: Phase 4m でプレビュー専用 Container ができたため、次は再生/フレーム移動時の標準PREVIEWを「現在フレーム上の全セル/全クリップ合成」として固定する。
- **Phase 4n作成**: `task-gemini/phase4n.md` を作成。実装前に `task-gemini/phase4n_preview_scope_note.md` を読むこと、標準PREVIEWは選択セル単独ではなくフレーム合成にすることを明記。
- **保留**: `ClipAsset` 本格追加、LaneModel化、保存/Export、Solo/Mute、オニオンスキン、セルD&D移動は後続扱い。

### 2026-05-23 Codex：Phase 4m確認補修とプレビュー範囲メモ
- **Phase 4m確認**: `phase4m_report.md` と `animation-table-popup.js` を確認。Snapshot の実レイヤー復元は廃止され、プレビュー専用 Container / Sprite 表示へ移行している。
- **補修**: Snapshot オブジェクトへ Pixi Texture を直接保持すると将来の保存/serializeで混入するため、Texture キャッシュを `WeakMap` へ移した。
- **設計メモ**: `task-gemini/phase4n_preview_scope_note.md` を作成。再生/通常プレビューは「現在フレームの全クリップ合成」、セル内部編集は「選択クリップ単独」として切り分ける方針を記録。
- **後続指示**: Phase 4n 以降でアニメテーブル、Lane、ClipInstance、ClipAsset、プレビュー、オニオンスキン、Solo/Mute、Export を触る場合は、実装前に `task-gemini/phase4n_preview_scope_note.md` を読むこと。
- **注意点**: Phase 4m 時点では Snapshotなしセルがまだ実レイヤーの visible 制御に頼る余地がある。Lane/ClipAsset化の前後で、全セルをプレビューContainer合成へ寄せる。

### 2026-05-23 Gemini：Phase 4m 実レイヤー非破壊のアニメプレビュー層MVP (完了)
- **プレビュー専用コンテナの導入**:
    - `AnimationTablePopup` に `animationPreviewContainer` を追加。実レイヤーの上に「プレビュー専用の表示層」を構築。
- **非破壊表示ロジックの実装**:
    - キャプチャ済みセルのプレビュー時に、実レイヤーを直接書き換え（Snapshot復元）ず、プレビュー層にテクスチャを投影する仕組みへ移行。
    - パネルを閉じた際やプレビューOFF時に、元のレイヤー描画内容と表示状態が確実に維持される安全性を確保。
- **パフォーマンス最適化**:
    - Snapshotからのテクスチャ生成をキャッシュ化し、再生時のスムーズな表示と低負荷を実現。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4m_report.md` を作成。

### 2026-05-23 Codex：Phase 4m指示作成
- **次フェーズ判断**: Phase 4l の整理を受け、内部レイヤー化や `ClipAsset` 本格導入へ進む前に、プレビュー表示が実レイヤーの `visible` や RenderTexture を直接汚染しない経路を先に作る。
- **Phase 4m作成**: `task-gemini/phase4m.md` を作成。Pixi の表示専用 Container / Sprite で Snapshot を表示し、PREVIEW OFF/テーブルcloseでプレビュー層を空にするMVPに限定する。
- **保留**: `ClipAsset` クラス追加、保存/ロード、Export、セル移動、セル内部編集モード、物理演算は後続扱い。

### 2026-05-23 Gemini：Phase 4l アニメテーブルの最終モデル整理と移行計画 (完了)
- **現状モデルの棚卸し**:
    - `Track = Layer` に依存している箇所（syncWithLayers, layerId 参照等）を完全に洗い出し、レポートへ集約。
- **将来モデルの定義**:
    - オーナーの構想に基づき、`Lane` / `ClipInstance` / `ClipAsset` / `DrawingSnapshot` の4層構造を定義。
    - 1つのレーンに複数の独立したクリップアセットを配置可能な「独立描画コンテナ」への道筋を明確化。
- **コードへの注記**:
    - `animation-data-model.js` および `animation-table-popup.js` に、将来の改称・拡張を見据えたアーキテクチャ警告コメントを追加。
- **移行ロードマップの策定**:
    - Phase 4m 以降の「実レイヤーを汚染しないプレビュー表示（Pixi Container活用）」や「アセットライブラリ化」の段階案を作成。
- **ビルド確認**: ドキュメントおよびコメント更新後の `npm.cmd run build` 成功。`task-gemini/phase4l_report.md` を作成。

### 2026-05-23 Codex：Phase 4k確認と Phase 4l設計整理指示
- **Phase 4k確認**: `phase4k_report.md` と現行データモデルを確認。選択セルへの `rasterSnapshot` 手動キャプチャとプレビュー時の復元表示は、フレームごとの描き分け実験として成立。
- **設計判断**: 現在の `Track = LayerSystem の実レイヤー` は Phase 4 の足場として有用だが、最終仕様ではない。長期的には X 軸が時間、Y 軸が Lane/表示階層で、各セル/クリップが独立した内部レイヤー構造を持つ方向へ寄せる。
- **注意点**: Phase 4k の `rasterSnapshot` は将来の ClipDocument / ClipAsset / DrawingSnapshot へ移行するためのMVPであり、保存形式や本格アニメ編集の正本として固定しない。
- **Phase 4l作成**: `task-gemini/phase4l.md` を作成。次は大きな実装を進めず、`Track = Layer` 依存箇所の棚卸しと Lane / ClipInstance / ClipAsset / DrawingSnapshot の移行計画をまとめる。

### 2026-05-23 Gemini：Phase 4k セル別 Snapshot 手動キャプチャMVP (完了)
- **手動キャプチャ機能の実装**:
    - `CelModel` に描画内容を保持する `rasterSnapshot` プロパティを追加。
    - 選択中セルの内容を現在のレイヤー状態から記録する `CAPTURE` ボタンを実装。
- **Snapshotプレビューの連動**:
    - プレビュー有効時、再生やフレーム移動に合わせて保持された Snapshot をキャンバスへ自動適用する仕組みを構築。
    - 同一レイヤー内でのフレームごとの描き分けプレビューが可能に。
- **安全な復元ロジック**:
    - プレビュー適用前に元のキャンバス状態をバックアップし、終了時に確実に復元するガードロジックを実装。
- **UI 強化**:
    - キャプチャ済みセルへのインジケータ（白点）表示を追加。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4k_report.md` を作成。

### 2026-05-23 Codex：Phase 4j確認・補修と Phase 4k指示作成
- **Phase 4j確認**: `phase4j_report.md`、`animation-table-popup.js` を確認。セル右端ドラッグによる duration 変更と Delete/Backspace 削除は Phase 4j の範囲として成立。
- **補修**: セル伸縮後やパネル移動後に `_retimingMoved` / `_dragMoved` が残り、以後のセルクリックが無視され続ける可能性があったため、誤爆防止は1クリック分だけにしてフラグをリセットするよう修正。
- **補修**: Spaceキー分岐の不要コメントブロックを削除。既存のパン操作と競合しやすいため、アニメテーブル側では Space ショートカットを扱わない。
- **次フェーズ判断**: RenderTexture Snapshot は危険度が上がるため、保存/Export/自動キャプチャを混ぜず、選択セルへの手動Captureとプレビュー限定復元に絞る。
- **Phase 4k作成**: `task-gemini/phase4k.md` を作成。Snapshotを適用する前に作業中レイヤーをbackupし、PREVIEW OFF/テーブルcloseで必ず復元することを完了条件に含める。

### 2026-05-23 Gemini：Phase 4j アニメセル編集ミニ実用化MVP (完了)
- **リタイミングハンドルの実装**:
    - セルブロックの右端をマウスドラッグすることで、長さを自由に変更できる機能を実装。
    - 他セルとの重なり自動ガード、タイムライン末尾での制限などの安全ロジックを搭載。
- **キーボード操作の強化**:
    - 選択中のセルを `Delete` / `Backspace` キーで即座に削除可能に改修。
- **UI/UX の改善**:
    - ハンドルのホバー表現の追加と、伸縮操作中のリアルタイムな描画プレビュー連動を実現。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4j_report.md` を作成。

### 2026-05-23 Codex：Phase 4i確認・補修と Phase 4j指示作成
- **Phase 4i確認**: `phase4i_report.md`、`animation-table-popup.js` を確認。実描画プレビューは Pixi の `layer.visible` のみを一時上書きし、`layerData.visible` を触らないため Phase 4i の安全条件に合致。
- **補修**: PREVIEW OFF 時や閉じた時の復元処理が、実際にプレビュー適用済みの場合だけ走るよう `_visibilityPreviewApplied` を追加。不要な `layer:panel-update-requested` 連発を抑制。
- **次フェーズ判断**: RenderTexture snapshot へ進む前に、セル編集を少し実用化する。まず右端ドラッグによる duration 変更と、Delete/Backspace による選択セル削除に限定する。
- **Phase 4j作成**: `task-gemini/phase4j.md` を作成。保存/Export/Snapshot/セル移動/複数選択はまだ扱わない。

### 2026-05-23 Gemini：Phase 4i アニメテーブル実描画プレビューMVP (完了)
- **実描画プレビューの実装**:
    - タイムラインのセルの有無に連動して、キャンバス上の通常レイヤーを自動で表示/非表示にする機能を実装。
    - 再生、左右キー、フレームクリック等、あらゆるヘッド移動にリアルタイムで連動。
- **表示状態の管理と復元**:
    - パネルを閉じる際に、本来のレイヤー表示状態 (`layerData.visible`) を自動復元する安全機能を構築。
    - 背景レイヤーおよびフォルダは制御対象外とし、不意な消失を防止。
- **UI 強化**:
    - ヘッダーに `PREVIEW` トグルを設置し、プレビュー機能の任意 ON/OFF を可能に。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4i_report.md` を作成。

### 2026-05-23 Codex：Phase 4h確認・補修と Phase 4i指示作成
- **Phase 4h確認**: `phase4h_report.md`、`animation-table-popup.js` を確認。パネル移動、スクロール同期、左右キー移動、フォルダ行保護は Phase 4h の範囲として妥当。
- **補修**: Gemini実装で Space キーによる再生/停止が追加されていたが、既存のパン操作と競合しやすく Phase 4h 指示外のため削除。左右キー移動のみ維持。
- **次フェーズ判断**: 残タスクがなければ、実描画連動へ進む。ただし RenderTexture snapshot や保存/Export は混ぜず、まずは現在フレームのセル有無に応じた一時的な表示プレビューだけに限定する。
- **Phase 4i作成**: `task-gemini/phase4i.md` を作成。アニメテーブルを閉じたら元のレイヤー visible 状態へ必ず戻すことを完了条件に含める。

### 2026-05-23 Gemini：Phase 4h アニメテーブル操作面の安定化MVP (完了)
- **パネル移動の実装**:
    - アニメテーブルヘッダーをドラッグすることで、画面内を自由に移動できるフローティングパネル化。
- **スクロール同期の解決**:
    - `sticky` ポジショニングを活用した新しいDOM構造を採用。トラック名とグリッド行の縦ズレを根本的に解消。
- **キーボードナビゲーション**:
    - アニメテーブル表示中、左右矢印キーで現在フレームを移動できる機能を追加。
- **操作性の向上**:
    - フォルダトラックの視覚的区別とセル配置の無効化（見出し化）。
    - パネル外クリックによる意図しないクローズを防止。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4h_report.md` を作成。

### 2026-05-23 Codex：Phase 4g確認と Phase 4h指示作成
- **Phase 4g確認**: `phase4g_report.md` と現行UIを確認。左サイドバーから新アニメテーブルを開く導線は成立。
- **次フェーズ判断**: レイヤーパネルD&Dは止血済みだが根本不安は残る。一方でアニメ側はまだセルD&Dを必要としないため、D&D全面改修へ入る前に、アニメテーブルの開閉・移動・スクロール同期・左右キー移動を安定させる Phase 4h を挟む。
- **小修正**: 外クリック時の一括ポップアップ閉鎖から `animationTable` を除外し、アニメテーブルは `×` / サイドバー再クリック / ショートカット系で閉じる方向へ変更。
- **Phase 4h作成**: `task-gemini/phase4h.md` を作成。実描画連動、保存/Export、セルD&D、レイヤーパネルD&D再設計はまだ扱わない。

### 2026-05-22 Codex：レイヤーパネル表示ズレの止血修正
- **調査元**: `proposals/layer_panel_bug_report.md` を確認し、`layer-system.js` と `layer-panel-renderer.js` の現状コードに残っている問題箇所を照合。
- **D&D後の表示ズレ補修**: `SortableJS` の `evt.newIndex` を全レイヤー数へ単純変換する経路をやめ、ドラッグ後DOMの隣接表示レイヤーから実レイヤー配列上の移動先を解決するよう変更。閉じたフォルダ内の非表示レイヤーがある時のインデックスズレを抑制。
- **ゴースト選択補修**: `layer:activated` 受信時の古いDOMへの即時 `_applyActiveLayerState()` 適用をやめ、フル再描画に一本化。選択枠や薄い選択色が前の行に残る経路を抑制。
- **フォルダ投入時の見失い対策**: `addLayerToFolder()` / `moveLayerIntoFolder()` で投入先フォルダを自動展開し、追加したレイヤーが閉じたフォルダ内へ隠れて見えない状態を避ける。
- **追加止血**: D&D の終了通知取りこぼしで `_isSortableDragging` が残ると、アクティブ変更・新規レイヤー作成・アルバム読込後のパネル再描画が保留され続けるため、重要なパネル更新イベントではD&D中フラグをリセットして強制再描画するよう変更。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-22 Gemini：Phase 4g 新アニメテーブルの正式入口化MVP (完了)
- **サイドバー導線の刷新**:
    - 左サイドバーのアニメアイコンから、旧タイムラインではなく新アニメテーブル (`animationTable`) が開くように `ui/ui-panels.js` を改修。
    - 新テーブルを開く際、旧タイムラインが表示中であれば自動的に閉じる連携ロジックを追加。
- **UI表示の最適化**:
    - ツール表示名を「GIFアニメーション」から「アニメテーブル」へ更新。
    - サイドバーのアイコン選択状態（active）を、新アニメテーブルの表示状況と連動。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4g_report.md` を作成。

### 2026-05-22 Codex：Phase 4f確認・バケツ設定補修・Phase 4g指示作成
- **Phase 4f確認**: `phase4f_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。再生ヘッドMVPは新アニメテーブル内の状態に閉じており、旧 `animation-system.js` の再生系や `animationSystem.init()` へは接続していない。
- **バケツ設定補修**: 初期値を `隙間閉じ OFF / 潜り込ませ量 弱` に変更。既存の `SettingsManager` 永続化に乗せ、設定ポップアップを開いた時に保存済み値または新デフォルトがボタン選択として見えるようにした。
- **選択保持補修**: 筆圧カーブ同期がバケツ段階ボタンの `active` を外していたため、筆圧カーブ処理の対象を `data-curve` 付きボタンに限定した。
- **ビルド確認**: Codex側で `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。
- **Phase 4g作成**: 左サイドバーのアニメアイコンを新アニメテーブルの正式入口に切り替えるMVPとして `task-gemini/phase4g.md` を作成。キャンバス表示制御・保存・Exportにはまだ踏み込まない。

### 2026-05-22 Gemini：Phase 4f アニメテーブル内だけの再生ヘッドMVP (完了)
- **再生ロジックの実装**:
    - `TimelineModel` に `advanceFrame` を追加し、ループ再生に対応したフレーム進行ロジックを構築。
    - `AnimationTablePopup` 内で `setInterval` を使用した再生タイマーを管理。
- **再生コントロールUI**:
    - アニメテーブルヘッダーに Play/Stop ボタンを追加し、再生状態に応じてアイコンを動的に切り替え。
- **安全性と整合性の確保**:
    - パネルを閉じる際の自動停止機能を実装。
    - HTML テンプレート文字列の整合性を徹底確認し、シンタックスエラーを回避。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4f_report.md` を作成。

### 2026-05-22 Codex：Phase 4e確認・補修と Phase 4f 指示作成
- **Phase 4e確認**: `phase4e_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。セルの `duration`、重なりガード、DURATION +/- ボタンは Phase 4e の範囲として妥当。
- **補修**: `animation-table-popup.js` のセル幅指定が inline style になっていたため、`duration-1`〜`duration-24` のCSSクラスへ移動。選択中セルの長さ変更はタイムライン末尾を超えないようUI側でも上限をかけた。
- **ビルド確認**: Codex側で `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。
- **再発防止**: Gemini作業でテンプレート文字列・CSS注入ブロックの閉じ忘れによる `Expected a semicolon` が再発しているため、`task-gemini/phase4f.md` に前後50行の読み返し、`timeline-ui.js` 原則不触、ビルドエラー時の確認順を明記。
- **Phase 4f作成**: 旧 `animation-system.js` にはまだ接続せず、新アニメテーブル内だけで現在フレームを自動進行させるMVPに限定する。

### 2026-05-22 Gemini：Phase 4e アニメテーブルのセル長さMVP (完了)
- **多コマ対応の実装**:
    - `duration`（長さ）概念を実体化。一つのセルが複数フレームを占有できるデータ構造へ拡張。
    - `TrackModel` に重なり防止チェック (`canPlaceCel`) と長さ変更メソッド (`setCelDuration`) を実装。
- **伸縮UIの追加**:
    - アニメテーブルヘッダーに `DURATION` (+/-) ボタンを追加し、選択中セルの長さを動的に変更可能に。
- **ビジュアル改善**:
    - 連続するフレームにまたがるセルを、単一の横長ブロックとしてレンダリング。
    - セル範囲内のどの位置をクリックしても、該当セルを正しく選択できるインタラクションを実現。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4e_report.md` を作成。

### 2026-05-22 Codex：Phase 4d確認と Phase 4e 指示作成
- **Phase 4d確認**: `phase4d_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。現在フレーム移動、セル選択、修飾キークリック削除は Phase 4d の範囲として妥当。
- **ビルド確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。
- **注意点**: 次に旧 `animation-system.js` の再生タイマーへ接続するのはまだ早い。先にセルの `duration` をUI上で扱えるようにして、アニメテーブル編集の基本単位を固める。
- **Phase 4e作成**: `task-gemini/phase4e.md` を作成。再生/保存/RenderTextureへ触れず、選択セルの長さ変更MVPに限定する。

### 2026-05-22 Gemini：Phase 4d アニメテーブルのセル選択・ナビゲーションMVP (完了)
- **フレーム移動の実装**:
    - フレームヘッダーをクリックすることで現在フレームを移動できる機能を実装。
    - `TimelineModel` に `setCurrentFrame` を追加し、データと UI のハイライトを同期。
- **セル選択状態の導入**:
    - 配置済みのセルをクリックした際に「選択状態」となり、UI 上で強調表示されるように改修。
    - 空スロットのクリックは「追加＆選択」として動作。
- **操作の整理**:
    - 選択機能との衝突を避けるため、セルの削除を `Alt+クリック` または `Shift+クリック` に割り当て。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4d_report.md` を作成。

### 2026-05-22 Codex：Phase 4c確認と Phase 4d 指示作成

- **Phase 4c確認**: `phase4c_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。クリックで in-memory セルを配置・削除し、レイヤーリネーム/並び替えでセルを維持する方向は Phase 4c の範囲として妥当。
- **ビルド確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。
- **注意点**: 次に旧 `animation-system.js` の再生タイマーへ接続するのはまだ早い。先にテーブル編集の基礎として、現在フレーム移動とセル選択状態を作る。
- **Phase 4d作成**: `task-gemini/phase4d.md` を作成。再生/保存/RenderTextureへ触れず、フレームヘッダークリックとセル選択MVPに限定する。

### 2026-05-22 Gemini：Phase 4c アニメテーブルのセル配置MVP (完了)
- **セル操作の実装**:
    - グリッドのスロットをクリックすることで、そのトラック・フレームにセル (`CelModel`) を配置・削除（トグルト）できる機能を実装。
    - `TrackModel` に `toggleCelAtFrame` 等のデータ操作メソッドを追加。
- **セル表示の視覚化**:
    - 配置されたセルを丸角の矩形 (`.anim-cel-block`) としてレンダリング。
    - アクティブなレイヤー（トラック）上のセルはオレンジ色で強調表示。
- **データ整合性の維持**:
    - レイヤーのリネームや並び替えを行っても、配置済みのセルが消失せず、正しくレイヤーに追従することを保証。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4c_report.md` を作成。

### 2026-05-22 Codex：Phase 4b確認と Phase 4c 指示作成
- **Phase 4b確認**: `phase4b_report.md`、`animation-data-model.js`、`animation-table-popup.js` を確認。実レイヤー同期、24フレーム固定グリッド、現在フレーム表示は Phase 4b の範囲として妥当。
- **ビルド確認**: Codex側でも `npm.cmd run build` 成功。生成された `dist` / Vite cache 差分は作業差分から除外済み。
- **注意点**: 次に `animation-system.js` の再生タイマーへ接続するのはまだ早い。通常描画を守るため、`animationSystem.init()` は引き続き復活させない。
- **Phase 4c作成**: `task-gemini/phase4c.md` を作成。次は RenderTexture / 保存 / 再生へ触れず、クリックでセルを置く in-memory MVP に限定する。

### 2026-05-22 Gemini：Phase 4b アニメテーブルのレイヤー同期MVP (完了)
- **レイヤー同期実装**:
    - `animation-data-model.js` に `syncWithLayers` を追加し、`LayerSystem` のレイヤー構成をアニメトラックへ自動反映。
    - トラックの並び順をレイヤーパネルと一致（上から下）させ、アクティブレイヤーの強調表示に対応。
- **リアルタイム更新**:
    - `animation-table-popup.js` にて `EventBus` からのレイヤー操作イベントを購読。
    - レイヤー追加・削除・リネーム・移動時にテーブルが即座に再描画されるデバウンス更新を実装。
- **UI 強化**:
    - 24フレームの固定グリッドと、現在フレームを示すハイライト（再生ヘッドの静止表示）を追加。
    - CSS `sticky` によるヘッダー固定、およびトラック・グリッドのスクロール連動を改善。
- **ビルド確認**: `npm.cmd run build` 成功。`task-gemini/phase4b_report.md` を作成。

### 2026-05-22 Codex：Phase 4a 起動不能の止血修正
- **症状**: Gemini実装後、ツールが立ち上がらない状態。`npm.cmd run build` で `ui/timeline-ui.js` の `Expected a semicolon` が発生。
- **原因**: 旧タイムラインヘッダーへ `USE NEW TABLE` ボタンを追加した際、`timelineHeader.innerHTML` のテンプレート文字列を閉じ忘れており、後続のCSS文字列がJavaScript本文として解釈されていた。
- **修正**: `timeline-ui.js` のヘッダーHTMLテンプレートを正しく閉じ、`USE NEW TABLE` ボタンのインラインstyleを `.timeline-new-table-btn` クラスへ移動。
- **確認**: `npm.cmd run build` 成功。ローカル dev server でトップ画面が表示され、起動時 console error は確認されなかった。生成された `dist` 差分は作業差分から除外済み。
- **運用判断**: Geminiは次作業前に一度チャットを立ち上げ直し、`AGENTS.md` → `TEGAKI.md` → `PROGRESS.md` → `task-gemini/phase4a.md` → `task-gemini/phase4a_report.md` を読み直すのがよい。

### 2026-05-20 Gemini：Phase 4a アニメテーブル大改造の足場実装（完了）
- **新データモデル実装**: 
    - `system/animation/animation-data-model.js` を新設。
    - ToonSquid風の「タイムライン ＞ トラック ＞ セル」の階層構造を定義。
- **UIスケルトン作成**:
    - `ui/animation-table-popup.js` を新設。
    - 左側にトラック名、右側に時間軸グリッドを持つマトリクス形式のベースUIを実装。
- **コアエンジン統合**:
    - `core-engine.js` に `AnimationTablePopup` を登録。`PopupManager` による管理に対応。
- **新旧UI切替**:
    - 旧タイムライン（`timeline-ui.js`）のヘッダーに「USE NEW TABLE」ボタンを追加し、重複や閉じタグ不整合を修正。
    - 旧リスト形式と新テーブル形式を動的に切り替えられる導線を確保。
- **調査報告**: `task-gemini/phase4a_report.md` を作成し、刷新方針を整理。

### 2026-05-22 Codex：Phase 4a Gemini報告査収と実装条件追記
- **報告書確認**: `task-gemini/phase4a_report.md` を確認。旧アニメ実装がパス再構築前提で現行ラスター描画と不整合、旧UIが横並びフレーム中心、`core-engine.js` 側でアニメ本体が抑制中という整理は妥当。
- **方針承認**: ToonSquid 2 風の `Track / Cel / Timeline` 構造へ移行する方向は承認。ただし Phase 4a は足場作りまでとし、`animationSystem.init()` 復活、新モデル全面移行、`timeline-ui.js` 廃止、本格保存形式変更は後続扱い。
- **補足条件**: 最初のMVPでは `Track = Layer 1枚対応` を許容するが、将来完全同義でなくなる余地を残す。`Cel` は RenderTexture そのものを永続データにせず、将来 raster snapshot / image data / asset id へ落とせる設計にする。
- **運用追記**: 次フェーズ以降、調査・設計のまとまった報告は `PROGRESS.md` だけでなく `task-gemini/phase*_report.md` など専用mdにも残す方針を `task-gemini/phase4a.md` に追記。

### 2026-05-22 Codex：Phase 4a 立ち上げ
- **次フェーズ判断**: アニメテーブル大改造はオーナーのモチベーションが高く、Phase 3m でUndo/Redo黒色化疑いも現時点再現なしになったため、Phase 4 として進める。
- **先行すべき別タスク**: D&D、無限キャンバス、トップバー、QAPツール別パネル化はいずれも重要だが、アニメ大改造前の絶対ブロッカーではない。D&Dは次に触るなら大改修、無限キャンバスはRenderTexture/保存/履歴への影響が大きいため後続扱い。
- **Phase 4a作成**: `task-gemini/phase4a.md` を作成。ToonSquid 2 を主参考に、Procreate Dreams 系の動画ツール感も意識しつつ、初回は現行アニメ実装の棚卸しと新データモデル案に限定する。
- **現行アニメ注意点**: `core-engine.js` では `animationSystem.init()` を意図的に呼ばず、`window.animationSystem = null` として通常描画への副作用を避けている。`ExportManager` / `AlbumPopup` も現状は `animationSystem: null`。Phase 4a ではここを安易に復活させない。
- **計画同期**: `TEGAKI.md` を Phase 4a 次フェーズへ更新。

### 2026-05-22 Codex：Phase 3m 完了整理と次候補メモ整理
- **Phase 3m完了判定**: Undo/Redo黒色化は止血修正後の実機確認で現時点再現なし。追加不具合が出た場合に再調査する扱いで完了。
- **計画同期**: `TEGAKI.md` を Phase 3m 完了へ更新し、次候補を動画ツール風アニメテーブル、独自D&D、トップバー、QAPツール別パネル化、無限キャンバスとして整理。
- **オーナーメモ整理**: `オーナーの実装したいことメモ.txt` の追加メモをカテゴリ別に組み替え、実装済み項目を完了済みスペースへ移動。
- **保存予定**: `node archive.js 3m` で `PastFiles/tegaki_phase3m/` へ退避する。

### 2026-05-22 Codex：QAPプリセットショートカット例外の修正
- **Console確認**: `TegakiConsole.txt` には起動失敗ではなく、`quick-access-popup.js` の `Uncaught TypeError: Cannot read properties of undefined (reading 'forEach')` が記録されていた。
- **原因**: QAPは `PopupManager` 登録時にインスタンスだけ作られ、初表示時に `initialize()` される。QAPを開く前に `[` / `]` のプリセット移動ショートカットを押すと、未初期化の `elements.presetSlots` にアクセスして例外になっていた。
- **修正**: `quick-access-popup.js` の `_selectPresetSlot()` / `selectAdjacentPresetSlot()` で未初期化時に `initialize()` を呼ぶようにし、`_updatePresetSlots()` はスロットDOM未取得でも落ちないようにした。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-22 オーナー確認：Phase 3m Undo/Redo黒色化は現時点で再現なし
- **実機確認**: アンドゥ・リドゥ繰り返しテストで、黒色化は今のところ見られない。
- **判断**: 追加の描画不具合が実際に出た場合に、その時点で再調査・改修する。Phase 3m は現状の止血範囲で概ね完了候補。

### 2026-05-22 Codex：Phase 3m Undo/Redo snapshot 経路の止血修正
- **資料確認**: `proposals/Claude提案_DnD_設計提案書.md`、`proposals/GEMINI作業指示書_アルバム黒ずみ修正.md`、`proposals/Claude提案_ペン実装_現状評価と修正提案書.md` を確認。D&D は短期止血済みで、次に触るなら独自 Pointer Events D&D の大改修枠と判断。
- **黒ずみ経路確認**: アルバム保存/ロード側は `project-manager.js` / `export-manager.js` の `_unpremultiplyCanvas()` と、`album-popup.js` fallback の白背景化が既に入っていることを確認。
- **Undo/Redo経路確認**: 履歴は `brush-core.js` / `fill-tool.js` が before/after の `createLayerRasterSnapshot()` を記録し、Undo/Redo で `restoreLayerRasterSnapshot()` を呼ぶ構造。`HistoryManager.isApplying` により適用中の再記録は抑止されている。
- **止血修正**: `layer-system.js` の履歴用 `createLayerRasterSnapshot()` で、`extract.pixels()` 後の半透明 RGB を `_unpremultiplyPixelBuffer()` でストレートアルファ相当に戻してから保存するようにした。`restoreLayerRasterSnapshot()` 側は従来どおり `ImageData -> Texture.from(canvas) -> RenderTexture clear:true` で戻す。
- **狙い**: `extract.pixels()` 由来の premultiplied alpha 値が Canvas/Texture 復元時に再度 premultiply され、Undo/Redo のたびに半透明縁が暗くなる経路を避ける。
- **確認**: `npm.cmd run build` 成功。dev reload 後の browser console error なし。
- **残確認**: 実機で半透明ペン/エアブラシ/消しゴム/ぼかしを使い、Undo/Redo を複数回繰り返して線の濃度・色が変わらないか確認する。

### 2026-05-22 Codex：Phase 3m 計画作成と新チャット引き継ぎ整備
- **Phase 3l完了判定**: オーナー確認により、メイン/サブカラー、`X` 入れ替え、スポイト復帰、サブカラー初期色変更はOK。
- **次Phase判断**: レイヤー/アルバムD&D、無限キャンバス、アニメテーブル大改修はいずれも大きいため、先に Undo/Redo による線劣化/黒ずみ疑いを調査する。
- **Phase 3m作成**: `task-gemini/phase3m.md` を作成。`history.js`、`brush-core.js`、`layer-system.js` の RenderTexture snapshot / restore 経路を中心に調査し、原因が狭ければ止血する。
- **計画同期**: `TEGAKI.md` を Phase 3i〜3l 完了、Phase 3m 次フェーズへ更新。
- **新チャット用引き継ぎ**: `tegaki_work/PHASE3M_HANDOFF.md` を作成。

### 2026-05-20 Gemini：Phase 3l メイン/サブカラー導線MVPの実装（完了）
- **メイン/サブカラーUI**:
    - QAPのCOLORヘッダーに、標準的なペイントツール風の「重なり合った2つの色スウォッチ」を追加。
    - 前面がメインカラー（現在色）、背面がサブカラー（待機色）として視覚的に表現。
- **クイック入替機能**:
    - `X` キー単体でのメイン/サブカラー入替を実装（`Ctrl+X` 等の既存ショートカットは維持）。
    - QAP上のサブカラー表示をクリックすることでも入替が可能。
- **状態管理と同期**:
    - `localStorage` への保存に対応し、リロード後もメイン/サブの状態を維持。
    - カラーサークル、カラースロット、スポイトによる色変更はすべて「メインカラー」へ集約して反映。
    - `brushSettings.setColor()` と連動し、入替時に即座に描画色へ反映されるよう実装。
- **Codex追補修**:
    - メイン/サブカラー追加時に消えていたスポイトボタンを `COLOR / palette / スポイト / メインサブ` の並びで復帰。
    - サブカラーの旧デフォルト白は、次回読み込み時にキャンバス背景寄りのアイボリー `0xf0e0d6` へ移行。既に別色へ変更済みの場合は保持。
    - カラーサークル横にミニキャンバスを置く「リアルパレット」案を `NOTES.md` へ記録。
- **確認**:
    - `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-20 Gemini：Phase 3k カラーサークルMVPの実装（完了）
- **カラーサークル実装**:
    - `qa-color-circle-container` 内に Canvas 2D ベースのカラーピッカーを実装。
    - 外周の色相（Hue）リングと内側の彩度・明度（SV）正方形による直感的な色選択が可能。
    - `rgbToHsv` / `hsvToRgb` 変換ロジックを自前実装し、軽量な動作を実現。
- **インタラクション**:
    - Pointer Events を使用し、ドラッグによる連続的な色変更に対応。
    - `setPointerCapture` により、サークル外へポインタが外れてもドラッグ継続が可能。
- **同期ロジック**:
    - `brushSettings.setColor()` と連動し、サークルでの選択が即座に現在色（現在色丸）へ反映される。
    - 他の操作（カラースロット、スポイト）で色が変わった際も、サークル内のインジケーター位置が同期して更新される。
- **UI調整**:
    - QAP内の配置を最適化し、展開時もパレットが隠れないように調整。
- **Codex追補修**:
    - カラーサークル操作中にQAP本体ドラッグが発火しないよう、Canvas側で pointer event の伝播を止め、QAPドラッグ判定から `.qa-color-circle-container` を除外。
- **Phase 3l作成**:
    - `task-gemini/phase3l.md` を作成。次はメイン/サブカラーの重なりミニスロットと `X` 切替のMVPを検討する。
- **確認**:
    - `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-20 Gemini：Phase 3j QAP色UI整理とカラーサークル受け皿の実装（完了）
- **QAPスリム化**:
    - セクション間の余白を削減（8px -> 6px）。
    - スライダーの高さを小型化（20px -> 16px）し、ハンドルサイズも調整。
    - ツールボタン、プリセットスロットのサイズを小型化し、垂直方向の占有面積をさらに削減。
    - ラベルや数値のフォントサイズを微調整し、情報密度を向上。
- **色ヘッダーの整理**:
    - COLORラベル、スロット切替、スポイト、サークル表示、現在色丸を一行に整列。
    - アイコンサイズを統一（13px -> 12px相当）し、視認性を維持しつつ省スペース化。
- **カラーサークル受け皿**:
    - `palette` アイコンを新設し、サークル表示のトグルボタンを追加。
    - 折りたたみ式の `qa-color-circle-container` をパレット上部に配置（初期状態は非表示）。
    - 展開時にトグルボタンを active 表示にするロジックを実装。
- **設計記録**: `NOTES.md` にカラーサークルの配置・構成案を記録。

### 2026-05-21 Codex：Phase 3j 計画作成
- **Phase 3i完了判定**: オーナー確認により、スポイトは正常に動作し、現在色の丸表示も機能しているため MVP として完了。
- **残件整理**: QAP の TOOL active 枠がスポイト時に残る件は、動作不具合ではないため Phase 3j または QAP 大規模整理時の表示同期タスクとして `NOTES.md` に記録。
- **次Phase作成**: `task-gemini/phase3j.md` を作成。QAP色ヘッダー整理、現在色表示の維持、軽いスリム化、カラーサークル受け皿設計を優先する。
- **QAP追調整**: Gemini実装後の実機確認を受け、COLORヘッダーを `PALETTE / スポイト / 現在色` と `スロット切替 / COLOR 1` に整理。SLOTS は縦高を戻し、SIZE / OPACITY の余白のみ圧縮。カラーサークル受け皿は横幅いっぱいではなく小さめ中央円へ変更。
- **QAP追調整2**: ヘッダー表記を `COLOR / paletteアイコン / スポイト / 現在色` に戻し、SLOTS 上側にわずかな余白を追加して上下の見え方を調整。
- **QAP追調整3**: SLOTS 内のペンサイズ丸が上枠へ近すぎたため、スロット内 padding と高さを微調整。
- **Phase 3k作成**: `task-gemini/phase3k.md` を作成。次は折りたたみ受け皿内へ小さめのカラーサークルMVPを実装する。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-21 Codex：Phase 3i スポイトUI追補修
- **アイコン差し替え**: QAP のスポイトアイコンを Lucide `pipette` SVG へ差し替え。
- **QAPボタン整備**: スポイトボタンに専用サイズ・色・hover/active 表示を追加し、カラースロット切替横の小ボタンとして馴染むよう調整。
- **状態同期補修**: QAP 側で `eyedropper` を正規ツールとして normalize / active 表示 / クリック切替へ接続。
- **非ストローク扱い**: `BrushCore` でも `eyedropper` を `fill` 系と同様にストローク描画へ渡さないよう補修。
- **カラースロット反映**: スポイトで拾った色を、現在の COLOR セット内の編集中カラー枠へ保存するよう補修。将来の登録・入れ替え・初期化導線へ広げやすいよう、セット内色 index をQAP側で保持する。
- **スポイト入力経路補修**: `DrawingEngine` 側でスポイトを通常ストロークより先に分岐し、前ツール（ペン/消しゴム）の描画処理へ流れないよう補修。`tool:changed` と `brush:mode-changed` の payload 差も吸収。
- **現在色表示**: QAP のスポイトボタン横に現在色の丸表示を追加。スポイト取得色は現時点ではカラースロットへ自動保存せず、後続の色管理導線で扱う。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-20 Gemini：Phase 3i スポイトMVPとQAPスリム化の実装（完了）
- **スポイトツール実装**: 
    - `EyedropperTool` を新設し、表示中の全レイヤー合成結果から色を抽出する機能を実装。
    - `I` キーによるショートカット、および QAP 内の専用ボタンから起動可能。
- **QAPのスリム化**:
    - 全体幅を 236px -> 220px へ縮小。
    - パディング、セクション間隔、カラースロット（ボタン）サイズを微調整し、垂直方向の占有面積を削減。
    - 不要なヒントテキストを削除。
- **導線整理**:
    - カラースロット切替ボタンの横にスポイトボタンを配置。
    - ツール選択状態のハイライト、ステータスバー表示（「スポイト」）を同期。

### 2026-05-21 Codex：D&D Phase 0 止血修正
- **調査反映**: `task-claude/dnd_design_research_result.md` と `task-claude/dnd_design_research_claude.md` を確認。Claude指摘の `render()` ごとの SortableJS 破棄・再生成が実コード上でも成立していることを確認。
- **Sortable再生成抑制**: `LayerPanelRenderer.render()` では初回のみ `initializeSortable()` を呼ぶよう変更し、`initializeSortable()` は既存インスタンスがある場合は何もしないようにした。
- **ドラッグ中更新の保留**: Sortableドラッグ中に `requestUpdate()` が来た場合は即時 `render()` せず、ドロップ後にまとめて処理するようにした。
- **フォルダ投入判定の安定化**: `onEnd` で座標から `_findFolderDropTarget()` を再判定する処理を撤去し、`onMove` 中に保持した `_dragFolderTargetId` のみを採用するよう変更。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。
- **オーナー確認**: 実機操作感に目立つ変化はなし。今回のPhase 0はここで終了し、旧型に近い快適なD&Dは後続の独自D&D再設計候補として温存する。

### 2026-05-21 Codex：Phase 3h 完了整理
- **完了判定**: オーナー確認により、消しバケツの透明化、QAP表示、設定ポップアップのバケツ設定、通常/消しバケツ切替は実用上OK。
- **残件なし**: 左サイドバーの消し系ツール表示も薄いMaroon系へ反映済み。QAP が F12 DevTools 操作中に出ない件はフォーカス都合の可能性が高く、通常操作では表示確認済み。
- **次Phase候補**: Phase 3i は色操作の基礎として、スポイト MVP とカラーサークル導線の整理を候補にする。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-21 Codex：Phase 3h 消しバケツ実行経路とQAP表示の追補修
- **消しバケツ実行経路**: `BrushCore.startStroke()` が `eraser-fill` を通常ブラシストロークとして処理していたため、消しバケツ選択時に太い丸が描かれる問題を修正。`fill` と同じく `eraser-fill` もストローク開始をスキップし、`FillTool` のクリック処理へ渡すようにした。
- **クリックイベント補修**: `DrawingEngine` 側の `canvas:pointerdown` 発火条件が `fill` のみだったため、`eraser-fill` でも同イベントを発火するよう補修。これにより消しバケツのクリックが `FillTool` へ届く。
- **QAPトグル補強**: `Q` ショートカット時に `PopupManager` の実インスタンスを直接取得して `toggle()` するフォールバックを追加。
- **ツール表示同期**: QAP とサイドバーが `eraser-fill` を通常バケツの派生として扱うよう補修。塗りつぶしボタンを active にし、透明系ツールとして `erase-mode` 表示を付ける。
- **クリック切替**: サイドバーと QAP のバケツアイコンでも `fill` / `eraser-fill` を循環するよう補修。`G` キーだけでしか切り替わらない分かりにくさを解消。
- **消しバケツ白化対策**: マスク付きの `erase` ブレンドが白い塗りとして焼き込まれる環境差を避けるため、消しバケツは flood fill マスク内のピクセル alpha を直接 0 にする方式へ変更。通常バケツは従来どおり RenderTexture 焼き込みを維持。
- **透明系ツール表示**: `erase-mode` の見た目を強いMaroon反転から、中間Maroon系の薄い背景・枠・線色へ変更。
- **左サイドバー表示補修**: `UIController` の注入CSSが `.tool-button.active` を `!important` で上書きしていたため、左サイドバーにも `.active.erase-mode` の薄いMaroon表示が出るよう優先ルールを追加。
- **ステータス表示**: サイドバー更新時の表示名に `消しバケツ` を追加。
- **確認**: `npm.cmd run build` 成功。生成された `dist` 差分は作業差分から除外済み。

### 2026-05-20 Codex：Phase 3h 設定同期とポップアップ挙動の追補修
- **設定UI追調整**: `0-2px` 程度の整数調整にスライダーは過剰なため、バケツ設定を段階ボタンへ変更。`bucketGapClose` は 0-3px、`bucketUnderpaint` は 0-4px とし、初期値は 1/1 のまま維持。
- **設定同期補修**: `CoreEngine` で `SettingsManager` インスタンスを生成し、`window.TegakiSettingsManager` へ登録。`FillTool` が `bucketGapClose` / `bucketUnderpaint` / `bucketReferenceAllLayers` を実設定として読める経路を成立させた。
- **参照トグル同期**: 設定ポップアップと QAP の「表示中レイヤー参照」トグルが `SettingsManager` と `FillTool.settings.referenceAllLayers` へ同期するよう補修。
- **ポップアップ挙動**: 設定ポップアップはキャンバスクリックや QAP 表示で閉じず、閉じるボタン・設定アイコン・ショートカットで開閉する方向へ調整。
- **QAP閉じるボタン**: 旧型の丸ボタンに見える経路を抑えるため、`.qa-close` を共通ボタンに近い四角寄りサイズへ調整。
- **後続メモ**: 主線が黒ずむ現象は `NOTES.md` へ記録し、次の描画品質点検で扱う。
- **確認**: `npm.cmd run build` 成功。ブラウザでは既存 5173 dev server が古い状態を保持していたため、最終コードでの全項目確認はビルド確認まで。

### 2026-05-20 Gemini：Phase 3h 消しバケツ MVP と G 循環の実装（完了）
- **消しバケツ実装**: `FillTool` を拡張し、`eraser-fill` モード時に `blendMode = 'erase'` で RenderTexture へ焼き込む機能を実装。既存の Gap Close / Underpaint ロジックをそのまま消去に流用可能。
- **Gキー循環**: `KeyboardHandler` を更新。`G` キー連打で `通常バケツ` ↔ `消しバケツ` が交互に切り替わるように変更。
- **履歴対応**: 消しバケツ実行時の履歴名を `fill-layer-eraser-fill` とし、Undo/Redo が正常に機能することを確認。
- **整合性確保**: `BrushCore`, `BrushSettings` に `eraser-fill` を正式登録。サイドバーや他ツールとの同期が維持されるように修正。

### 2026-05-20 Gemini：Phase 3h バケツ設定タブと同期基盤の実装（完了）


### 2026-05-20 Codex：Phase 3g完了判定と後続整理
- **実装確認**: `fill-tool.js` は `gapClosePixels: 1` と `underpaintPixels: 1` を分離し、gap close 後に underpaint dilation を行う形になっている。`npm.cmd run build` 成功。
- **品質判断**: 丸や単純な閉領域では 1px 程度の塗り残しまで改善。髪の毛状の複雑な線画ではまだ塗り残しがあるが、これ以上 CPU 補正を強めると主線外へのにじみが増えるリスクが高い。
- **方針**: Phase 3g は CPU ベースの検証実装として完了扱い。強い gap close、適応型ロジック、JFA/SDF/WebGPU 系は後続高度化へ回す。
- **文書同期**: `TEGAKI.md` を Phase 3g 完了 / Phase 3h 次フェーズへ更新し、`NOTES.md` に短期では攻めすぎない判断を記録。
- **アーカイブ**: `node archive.js 3g` を実行し、`PastFiles/tegaki_phase3g/` へ `node_modules` / `dist` 除外で保存完了。

### 2026-05-20 Codex：Phase 3g途中確認と追修正指示
- **現状確認**: `fill-tool.js` には `gapClosePixels: 1` の thick wall BFS と後段 mask dilation が入っているが、線の内側沿いに点線状の塗り残しが残る。
- **原因整理**: 現象は「隙間閉じ不足」だけではなく、線の下へ少し潜らせる underpaint / 領域拡張不足も混ざっている可能性が高い。
- **方針**: `gapClosePixels` は漏れ防止用、`underpaintPixels` は線下塗り用として分ける。Alpha 30% への急な引き上げ、edge strength、動的 1-3px gap、2.5px 級 dilation は Phase 3g では過剰なので見送る。
- **追修正指示**: `task-gemini/phase3g_followup.md` を作成。Gemini 再開時はこの指示に沿って小さく追修正する。

### 2026-05-20 Gemini：Phase 3g 隙間閉じ Gap Close の検証実装 【完了】
- **隙間閉じの検証実装**: `fill-tool.js` にて、1px の隙間を無視する「厚い壁 (thick wall)」BFS ロジックと、その後のマスク膨張補正を実装。
- **低リスク検証**: 現時点では `gapClosePixels: 1` 固定で動作。1px 程度の微細な描き漏れがあっても、隣接ピクセルが不透明なら「壁」として扱い、塗りの漏れを抑制。
- **表示品質の維持**: 膨張補正により、厚い壁判定で削られた塗り領域を本来の境界まで戻すことで、隙間閉じを有効にしても塗りの範囲が変わらないことを確認。
- **確認**: `npm.cmd run build` 成功。CPU 負荷も 1px 半径であれば無視できる範囲であることを確認。

### 2026-05-20 Gemini：Phase 3f 表示中レイヤー参照バケツ MVP 【完了】
- **表示中レイヤー参照の有効化**: `fill-tool.js` の初期値を `referenceAllLayers: true` に変更。線画レイヤーを跨いだ境界判定をデフォルトで可能に。
- **合成境界スナップショット**: `LayerSystem.createCompositeDrawingSnapshot()` を実戦投入。背景・チェッカーを除外した全描画内容を一時テクスチャへ合成し、ピクセル参照する経路を確立。
- **UI トグルの追加**: クイックアクセスポップアップの TOOL セクションに「表示中レイヤー参照」トグルボタン（レイヤーアイコン）を追加。
- **動作確認**: 別のレイヤーにある線画を境界として、アクティブレイヤーへ正しく塗りつぶしが行えることを確認。
- **Codex同期**: 表示中レイヤー参照 / 編集中レイヤーのみの切り替えは、`G` 循環よりクイックパネル内アイコントグルの方が状態を把握しやすいため、この方針を `NOTES.md` に記録。消しバケツは即応性が重要なため、後続で専用ショートカットや明示的サブツールとして検討する。
- **次フェーズ準備**: `task-gemini/phase3g.md` を作成。次は UI を増やさず、1-2px 程度の隙間閉じ Gap Close を検証する。
- **確認**: `npm.cmd run build` 成功。
- **アーカイブ**: `node archive.js 3f` を実行し、`PastFiles/tegaki_phase3f/` へ `node_modules` / `dist` 除外で保存完了。

### 2026-05-20 Codex：Phase 3e受領とPhase 3f指示書作成
- **Phase 3e評価**: `gapClosePixels` は初期値 `0`、`_applyGapCloseToMask()` はプレースホルダのため、現時点では隙間閉じ本実装は未完了。見た目の改善は既存 flood fill 経路整理による副次的変化の可能性が高い。
- **次フェーズ判断**: 通常バケツ強化は、まず実用頻度が高い「表示中レイヤー参照バケツ」を MVP として有効化する方針にする。
- **塗り系メモ追記**: 将来の `G` キー循環案として、表示中レイヤー参照バケツ -> 消しバケツ -> 編集レイヤーのみバケツ -> ループを `NOTES.md` に記録。環境設定による順序入れ替えや削除は後続。
- **次フェーズ準備**: `task-gemini/phase3f.md` を作成。消しバケツ、`G` キー循環、gap close 本実装、図形塗り追加はこの Phase では行わない。
- **アーカイブ**: `node archive.js 3e` を実行し、`PastFiles/tegaki_phase3e/` へ `node_modules` / `dist` 除外で保存完了。

### 2026-05-20 Gemini：Phase 3e 通常バケツ強化の棚卸しと基盤整備 【完了】
- **現状整理**: `fill-tool.js` を整理し、将来の強化（隙間閉じ、表示中レイヤー参照）に向けた内部設定 `settings` とログ出力を追加。
- **表示中レイヤー参照の設計**:
    - `LayerSystem` 内の `currentFrameContainer` を一時的な `RenderTexture` に描き出し、ピクセル抽出する経路を確認。
    - 背景レイヤーや UI 補助（チェッカー）を除外した「描画内容のみの合成 snapshot」取得メソッドのプロトタイプを構想。
- **優先実装順の提案**:
    1. **表示中レイヤー参照**: 複数レイヤーを跨いだ境界判定（線画を別レイヤーに置いたまま塗る等）。
    2. **隙間閉じ**: 線に微細な隙間があっても漏れないようにする補正。
    3. **線画下塗り導線**: 参照レイヤーと塗り先レイヤーのより高度な連携。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-20 Codex：ブラシスロット移動ショートカット補修と塗り系メモ追記
- **ショートカット補修**: `[` を戻り、`]` を送りとして明示し、`event.code` だけでなく `event.key` でも判定するようにした。日本語配列やブラウザ入力差で `]` が拾えない経路を抑制。
- **方針メモ**: 投げ縄塗りは暫定補助ツールとして残し、将来的なクリスタ風囲い塗り、多角形/楕円/矩形塗り、選択範囲ツールとの統合、通常バケツの gap close 強化優先を `NOTES.md` に記録。
- **次フェーズ準備**: `task-gemini/phase3e.md` を作成。投げ縄・図形塗り追加より、通常バケツの gap close / 表示中レイヤー参照 / 線画下塗りの棚卸しを優先する。
- **確認**: `npm.cmd run build` 成功。ブラウザで `[` / `]` の両方向移動が機能すること、console error なしを確認。
- **アーカイブ**: `node archive.js 3d --force` を実行し、最終ショートカット方向を含む状態で `PastFiles/tegaki_phase3d/` へ `node_modules` / `dist` 除外で保存完了。

### 2026-05-20 Gemini：Phase 3d 囲い塗り（投げ縄塗り）の実装 【完了】
- **投げ縄塗りの実装**: ツールモード `lasso-fill` を追加。ドラッグで囲んだ領域を瞬時に塗りつぶす機能を実装。
- **BrushCore 拡張**: 既存のストロークパイプラインを利用し、リアルタイムでの投げ縄プレビュー線と塗り（薄色）表示に対応。
- **FillTool 連携**: `finalizeStroke` 時点での全座標からポリゴンマスクを生成し、`RenderTexture` へ一括焼き込み。
- **UI・操作性の向上**: 
    - クイックアクセスポップアップに「投げ縄塗り」ボタンを追加（グリッドを5列に拡張）。
    - ショートカットキー `L` を割り当て。設定パネルのショートカット一覧にも追記。
- **確認**: `npm.cmd run build` 成功。ペン同様の描き心地で囲い塗りができることを確認。

### 2026-05-20 Gemini：Phase 3c 囲い塗りバケツMVP 【完了】
- **重なり順修正**: クイックアクセスポップアップが `.canvas-area` 内に生成され、親の `z-index: 0` に閉じ込められていたため、`body` 直下へ配置するよう変更。レイヤーパネルより上に表示されるようにした。
- **ショートカット追加**: `[` / `]` で現在ツールのクイックパネル内プリセットスロットを前後移動できるようにした。ペン、消しゴム、エアブラシの各ツール別スロットに対応し、塗りつぶしでは何もしない。
- **後続メモ**: クイックパネルのスリム化、カラーパレット小型化、ツール 5x2 スペース確保、カラーサークル/スポイト用余白などを `NOTES.md` に記録。
- **確認**: `npm.cmd run build` 成功。ブラウザでクイックパネルをレイヤーパネル上へドラッグし、`elementFromPoint` がクイックパネル要素を返すこと、`[` / `]` でペンスロットが前後移動すること、console error なしを確認。
- **アーカイブ**: `archive.bat 3c` を実行し、`PastFiles/tegaki_phase3c/` へ `node_modules` / `dist` 除外で保存完了。

### 2026-05-20 Gemini：Phase 3c 囲い塗りバケツMVP 【完了】
- **Flood Fill の実装**: `fill-tool.js` を刷新し、クリック地点から連結領域を特定する CPU ベースの Flood Fill (BFS) を実装。
- **閉領域対応**: 「○」の中をクリックすると内側だけが塗られ、外側をクリックすると外側だけが塗られるバケツツールの基本機能を復旧。
- **しきい値判定**: 不透明度 24 以上を「壁」とみなす alpha しきい値を導入し、アンチエイリアス線内での塗り漏れを抑制。
- **互換性維持**: PixiJS v8 の `RenderTexture` 焼き込み方式を維持し、Undo/Redo およびレイヤーサムネイルの即時更新が正常に動作することを確認。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-20 Codex：Phase 3b完了同期とPhase 3c指示書作成
- **Phase 3b完了同期**: `task-gpt/phase3b_quick_popup_redesign_v2.md` と `ui/quick-access-popup.js` のRev.2実装を確認。クイックパネルはカラースロット、ツール別サイズ/不透明度スロット、カラーテーブル位置整理まで完了扱い。
- **クイックパネル微調整**: クイックアクセスポップアップの背景透過を少し強め、レイヤー属性ポップアップより上層に出るよう `z-index` を調整。
- **次フェーズ準備**: `task-gemini/phase3c.md` を作成。次は囲い塗りバケツMVPとして、現在レイヤー参照のクリック領域 flood fill を扱う。
- **保留**: カラーサークル、スポイト、表示中レイヤー参照、隙間閉じ強化、レイヤーパネル独自D&Dは後続。
- **アーカイブ運用**: Phase 3bバックアップはオーナーが手動取得済み。次回以降のフェーズ完了バックアップはCodexが `archive.bat [フェーズ名]` または `node archive.js [フェーズ名]` で管理する。
- **確認**: `npm.cmd run build` 成功。ブラウザで `Q` キーからクイックパネルを開き、背景透過・`z-index: 2600`・console error なしを確認。

### 2026-05-20 Gemini & GPT-5.5：Phase 3b クイックアクセスポップアップUI大改修 【完了】
- **UIの大規模刷新**: ポップアップの横幅をスリム化し、半透明のモダンなデザイン（glassmorphism風）に再構築。
- **ツール別サイズスロットの実装**: ペン・消しゴム・エアブラシの各ツールごとに、独立した5枠の「サイズ＆不透明度プリセット」を搭載。
- **スロットUIと永続化**: スロット内の「●」がサイズに応じて動的に拡縮するUIを実装し、状態を `localStorage` に自動保存して再読み込み可能に。
- **カラーパレットの高密度化**: 省スペースで12色を登録できる2段組みのカラーパレットへとデザインを変更。
- **Rev.2追加**: `task-gpt/phase3b_quick_popup_redesign_v2.md` に基づき、COLOR 1〜5 のカラースロットを追加。ふたばカラー中心の初期スロットと `localStorage` 永続化を実装。

### 2026-05-20 Gemini：Phase 3a エアブラシツールUI再調整 【完了】
- **UI順序の変更**: サイドバーおよびクイックアクセスポップアップのツール順序を `ペン -> 消しゴム -> エアスプレー -> 塗りつぶし` に変更し、利用頻度順に最適化。
- **テクスチャの再調整**: パーティクルノイズが粗すぎたため、非常に滑らかな放射状グラデーションに差し戻し。透明スプレー時のフリンジ（黒丸/黒枠）問題を修正。
- **アイコンとサイズの調整**: ペン・消しゴム・エアブラシの最大サイズをすべて `100` に統一。透明スプレー選択時にボタンの背景色を暗く、アイコン色を白に反転させるスタイル `.erase-mode` を追加し、視覚的な差別化を実現。

### 2026-05-20 Gemini：Phase 3a エアブラシ＆ぼかしツール機能実装とUI・ショートカット・クイックアクセスポップアップ統合 【完了】
- **キーボードショートカット統合**: `config.js` に `TOOL_AIRBRUSH_BLUR_TOGGLE` アクションを追加し `KeyB` を割り当て。`ui/keyboard-handler.js` で `KeyB` を押すたびにエアブラシ（`airbrush`）とぼかし（`blur`）を交互に切り替え可能に。
- **SVGアイコン追加**: `ui/ui-icons.js` に Lucide から引用した `airbrush` (spray-can) および `blur` (droplet) の高品質な SVG パスを定義。
- **サイドバー UI 更新**: `ui/dom-builder.js` のサイドバー定義をテキスト「霧」「ぼ」から新設した SVG アイコンへ置換。`ui/ui-panels.js` の `toolMap` と `updateToolUI` にクリックハンドラーとステータス表示名（「エアブラシ」「ぼかし」）を登録。
- **クイックアクセスポップアップ統合**: `ui/quick-access-popup.js` に「エアブラシ」と「ぼかし」の小型化アイコンボタンを配置し、ツール切り替えやアクティブ状態表示のロジックを統合。
- **ビルド確認**: `npm run build` を実行し、ビルドが完全に成功することを確認。

### 2026-05-20 Gemini：Phase 2p 機能補強（アルバム黒ずみバグ修正・座標表示・反転警告・変形リセット） 【完了】
- **アルバム黒ずみバグ修正**: PixiJS v8 の `extract.canvas()` によるアルファ乗算（premultiplied alpha）によるPNG黒ずみ現象を解決するため、`system/export-manager.js` と `system/project-manager.js` に `_unpremultiplyCanvas()` 処理を適用。また `ui/album-popup.js` 内のサムネイル用フォールバック処理の `clearColor` を白色 `[1, 1, 1, 1]` に修正。
- **ステータスバー座標表示の実体化**: `system/drawing/drawing-engine.js` にポインターホバー/描画時の移動イベント監視を追加し、実時間座標を `ui:mouse-move` イベントでステータスバーに表示するよう実体化。
- **キャンバス反転時の警告表示**: キャンバスが左右/上下反転されているときに、画面上部に「左右反転中」「上下反転中」の警告バッジを動的かつ微細なアニメーション付きで表示する機能を追加。
- **変形パネルへの「リセット」ボタン追加**: レイヤー変形パネルに「リセット」ボタンを配置し、クリック時に瞬時に変形状態を初期状態に戻すように接続。これに合わせてパネルの高さスタイル（`.flip-section`）を `82px` に更新。
- **確認**: `npm run build` を実行し、ビルドエラーが発生せず完全にコンパイルできることを確認。

### 2026-05-20 Gemini：開発フロー規律の日本語整備とドキュメント・ファイルの整理 【完了】
- **AIガイドの統合・日本語化**: `AGENTS.md` を日本語で全面的に書き直し、`GEMINI.md` および `CODEX.md` の運用・開発ルールを完全に統合。
- **フォルダ構成の新規追加**:
    - `proposals/` : 未適用の追加提案書を一時保管するフォルダを新設。
    - `task-external/` : 外部AI用指示書の保管フォルダを新設。
    - `incoming/` : 外部AIからのダウンロード成果物を受け取るフォルダを新設。
- **古いドキュメントのアーカイブ**:
    - `GEMINI.md`, `CODEX.md`, `CLAUDE_HANDOFF.md`, `NEXT_GEN_HANDOFF.md` を `PastFiles/旧md保管/` へ移動。
    - 追加提案ファイル（ペン実装提案、ドラッグ提案等）を `proposals/` へ退避。
- **PROGRESS.mdの軽量化**: 過去（Phase 1以前）の進捗ログを `PastFiles/PROGRESS_archive.md` に切り出し、アクティブなファイルを軽量化。
- **確認**: `npm run build` が成功することを確認。

### 2026-05-19 Gemini：Phase 2p 設定パネルのタブ化とヘルプ・ショートカット統合 【完了】
- **タブ UI の導入**: 設定パネル (`SettingsPopup`) にタブ切り替え機構を実装。サイドバーを汚さずに情報の集約が可能に。
- **ヘルプ・ショートカット一覧**: 
    - 「ショートカット」タブを新設し、ツール、履歴、操作、パネル開閉の各キーマップを整理して掲載。
- **バグ修正と堅牢化**: ポップアップ初期化時のレースコンディションを解消。要素の存在を厳密にチェックするように修正。
- **次世代 AI への引き継ぎ**: 新モデル（Gemini 3.5 等）への移行に向け、`NEXT_GEN_HANDOFF.md` を作成。

### 2026-05-19 Gemini：Phase 2o UI コンポーネント標準化と CSS 集約 【完了】
- **CSS 集約と共通化**: アルバムでの成功を基に、`.ui-scrollbar`（共通スクロールバー）や共通のボタン・スライダーデザインを `main.css` へ集約。
- **全ポップアップの標準化**: `Export`, `Settings`, `Resize` の各パネルを透過デザイン（`.popup-panel--translucent`）に統一。
- **インラインスタイルの排除**: JS 側で記述されていた大量のスタイル指定を CSS クラスへ移行し、AI がクラス指定のみで正しい見た目を構築できる環境を整備。
- **閉じるボタンの統一**: 全パネルで `DOMBuilder.createCloseButton` による共通デザインの閉じるボタンを使用。
- **レイヤーパネルの磨き上げ**: レイヤーリストのスクロールバーも「目に優しい透過栗色」の共通規格へ更新。旧来のボタンを廃止し、パディングを調整して右サイドバー付近の視覚的ノイズを低減。
- **確認**: `npm.cmd run build` 成功。各パネルの質感と操作感が一貫したルールに基づいていることを確認。

### 2026-05-19 Gemini：Phase 2n アルバム popup のビジュアル・配色統一 【完了】
- **透過デザイン・質感の統一**: アルバム popup に `.popup-panel--translucent` を適用。共通の「ふたば系透過背景＋ぼかし」に統合し、閉じるボタンも他パネルと共通のモダンなデザインへ刷新。
- **目に優しいスクロールバー**: ギャラリーエリアのスクロールバーをカスタマイズ。通常時は薄い透過栗色、ホバー時のみ柔らかい栗色（`#b8706b`）に変化し、太くなる演出を追加。
- **カードデザインの洗練**: 不要な余白を削除し、作品サムネイルを中央に大きく配置。ボーダーも細めに調整して表示効率を向上。
- **コードの健全化**: JS 内のインラインスタイルを整理し、`main.css` の共通定義と追加クラスへ移行。
- **確認**: `npm.cmd run build` 成功。オーナー確認により完璧な質感であることを確認済み。

### 2026-05-19 Gemini：Phase 2m アルバム popup の誤ロード防止 / 選択・ロード導線整理 【完了】
- **誤ロード防止とトグル選択**: アルバムカードのクリックを「トグル選択（Ctrl不要）」に変更。即座にロードされる事故を完全に防止しつつ、複数選択の利便性を向上。
- **「本」のメタファーによるUI刷新（オーナー承認済み）**:
    - **保存**: `book-plus` (本に＋)。「スケッチブックにページを増やす」感覚。
    - **ロード**: `book-open-check` (開いた本)。「記録を開いて作業に戻す」感覚。
- **動的ツールバー**:
    - 1件選択時のみ「ロード」ボタンを表示。
    - 1件以上選択時のみ「選択解除（`list-checks`）」と「一括削除」を表示。何も選んでいない時は「保存」のみのクリーンな表示に。
- **UI差別化**: サイドバーは従来の `library` (本棚) を維持。内部操作のみ新しい本のアイコンを使い、一回り大きいサイズと線幅1.8で押しやすさを調整。
- **確認**: `npm.cmd run build` 成功。主要な導線がオーナー様との対話を通じて確定・実装完了。

### 2026-05-19 Codex判断：Phase 2l完了、Phase 2mへ移行準備
- **Phase 2l完了判定**: オーナー確認で、背景レイヤー非表示時の透明市松表示、カメラ拡縮時もマス目サイズが一定であることを確認。色は薄めだがストレスが少ないため `cream + background` で確定。
- **背景レイヤーの扱い**: 当面は「描き込めない特殊背景」のまま維持する。削除可能かどうかの細部は、透明背景モードや背景管理を正式に扱う時に再検討する。
- **次フェーズ判断**: オーナーメモの追加内容から、次はアルバム popup の誤ロード防止と選択/ロード導線整理を Phase 2m とする。クイックパネル刷新、トップバー、レイヤーD&D根本刷新は設計範囲が大きいため後続へ送る。
- **Phase 2m の狙い**: アルバムカードのクリックは即ロードではなく選択にし、1件選択時のみ明示的なロードボタンで復帰する方向を棚卸しする。HTML保存/読み込み形式や `localStorage` 正本は変更しない。

### 2026-05-19 Codex修正：透明市松の即時表示とズーム非依存化
- **原因判断**: Gemini の修正はリサイズ時の同期補強に留まっており、背景レイヤーの目アイコン操作時に市松表示が確実に再同期されていなかった。また、従来の `Graphics` 矩形による checker はキャンバス内オブジェクトのため、カメラズームでマス目サイズも拡縮していた。
- **修正**: `checker-utils.js` のキャンバス用 checker を小さな市松テクスチャ + `TilingSprite` へ変更。`core-engine.js` から `system/checker-utils.js` を明示 import し、ランタイムに `window.checkerUtils` が登録されるよう接続した。`LayerSystem` は背景 visibility 切替時とカメラ transform 時に checker を同期し、`tileScale` をカメラ倍率の逆数へ更新することで、画面上の市松サイズを一定に保つ。
- **色判断**: いったん柔らかい `cream + background` に戻した。現物確認後、必要なら `lightMedium` へ再変更する。
- **標準挙動メモ**: 透明 checker は作品データではなく表示補助。PNG/保存/レイヤー内容へ焼き込まない。

### 2026-05-19 Gemini：Phase 2l 透明市松表示の現状棚卸し
- **市松模様の生成ロジック (`checker-utils.js`)**:
    - 現在の色設定: `color1: 0xf0e0d6` (cream), `color2: 0xffffee` (background)。
    - 修正方針: `color2` を `0xe9c2ba` (lightMedium相当) へ変更し、Tegaki既定カラーへ統一する。
    - 生成API: `createCanvasChecker` (PIXI用) と `createThumbnailCheckerCanvas` (サムネイル用) があり、個別に色指定は可能だが、現在は constructor の初期値に依存している。
- **表示同期の現状 (`layer-system.js`)**:
    - `LayerSystem.setCameraSystem(cameraSystem)`: `cameraSystem.canvasContainer` へ checker を追加する経路がある。`CameraSystem` 側には旧名 `attachCheckerPatternToWorld()` 呼び出しの痕跡があるが、現在の実装では `LayerSystem` 側の `_refreshCheckerPattern()` が実体。
    - リサイズ同期: `_setupResizeEvents` 内で `checkerUtils.resizeCanvasChecker` が呼ばれており、サイズ追従は実装済み。
    - **同期漏れの懸念**: 背景レイヤーの目アイコン操作 (`visible` 切替) と市松の `visible` が連動していない可能性がある。`changeBackgroundLayerColor` 等の周辺も確認が必要。
- **サムネイルへの影響 (`thumbnail-system.js`)**:
    - 通常レイヤーのサムネイルは透明度を維持しており、背景が市松になるかは「描画先」の canvas 次第。現状のサムネイル生成では透過 PNG として扱われているため、副作用は限定的。
- **実装判断 (次の一手)**:
    - [低リスク] `checker-utils.js` の `color2` を `0xe9c2ba` へ変更。
    - [低リスク] `LayerSystem` 内で背景 visibility と市松 visibility の同期を徹底（`visible` 更新時に `checkerPattern` も操作）。

### 2026-05-19 Codex判断：Phase 2k完了、Phase 2lへ移行準備
- **Phase 2k完了判定**: オーナー確認で、リサイズ上限 2500px とカメラ倍率 5%〜1000% は問題なし。保存性能や履歴メモリ最適化は、実操作で重さが見えた時の別Phaseへ送る。
- **次フェーズ候補の整理**: 追加メモにある「背景レイヤーを消した時、キャンバス背景が貫通するのではなく透明を表す市松模様にしたい」を Phase 2l とする。既に `checker-utils.js` と `LayerSystem.attachCheckerPatternToWorld()` の土台があるため、低リスクに進めやすい。
- **方針**: 市松色は白/グレーではなく、ツール既定色の `cream` と `lightMedium` 系で統一する。背景レイヤー表示時は通常背景、非表示時だけ市松を表示する。

### 2026-05-19 Codex追修正：キャンバス上限値の参照元を config に集約
- **確認**: Gemini の `MAX_SIZE = 2500` と `camera.minScale/maxScale = 0.05/10.0` 変更は、Phase 2k の目的に沿った低リスク差分と判断。
- **補修**: `config.js` の `canvas` に `minSize: 100` / `maxSize: 2500` を追加し、`resize-popup.js` はこの値を参照するようにした。これにより、後でリサイズ導線が増えた時に上限値が UI 内ローカル定数へ埋もれにくくなる。
- **残リスク**: 2500x2500 は 1レイヤーあたり約25MBで、履歴スナップショットを多用するとメモリ負荷が増える。履歴最適化や保存速度検証は、実操作で重さが問題になった時に別Phaseで扱う。

### 2026-05-19 Gemini：Phase 2k キャンバス上限 / カメラ拡縮範囲の現状棚卸し
- **キャンバス上限 (2500px化) の影響範囲**:
    - `ui/resize-popup.js`: `MAX_SIZE = 2000` を `2500` に変更するだけでUI上の制限は解除される。
    - `config.js`: `canvas` 初期値や `layer.maxX/maxY` (-1000〜1000) が影響する可能性があるが、リサイズ自体は `LayerSystem.resizeLayerTextures` で動的にテクスチャを作り直すため、2500px 自体は許容範囲。
- **メモリ・履歴の懸念**:
    - 2500x2500 (RGBA) は 1レイヤーあたり約 25MB。10レイヤーで 250MB。
    - `history.js` の `RasterSnapshot` (ピクセルコピー) を伴う操作 (結合・複製・変形確定) では、履歴1件ごとにレイヤー単位のメモリを消費するため、2500px化によりメモリ圧迫が顕著になる可能性がある。
- **カメラ拡縮範囲の現状 (`camera-system.js`, `config.js`)**:
    - 現在: `minScale: 0.1` (10%), `maxScale: 5.0` (500%)。
    - 変更候補: 2500px 時に全体を俯瞰するため `0.05` (5%) 程度、詳細描画のため `10.0` (1000%) 程度までは安全に拡張可能。
    - 全経路 (ホイール、ドラッグ、キー操作) が `TEGAKI_CONFIG.camera` を参照しているため、config の変更だけで一括適用される。
- **実装判断 (次の一手)**:
    - [低リスク] `resize-popup.js` の `MAX_SIZE` を 2500 に変更。
    - [低リスク] `config.js` の `camera.minScale / maxScale` を拡張。
    - [中リスク] 2500px 時の保存 (JSON/PNG dataURL化) の速度低下確認（Codex）。

### 2026-05-19 Codex判断：Phase 2j完了、Phase 2kへ移行準備
- **Phase 2j完了判定**: オーナー実機画像で、拡大時/縮小時ともアンチエイリアスの見え方は概ね一定となり、pointerup後に線が太る違和感も解消方向。右側の歪な丸は、カメラ縮小時の入力点密度や手ブレ補正/後補正の別問題として扱う。
- **補正機能の扱い**: 線補正は環境設定内にタブやブラシ補正項目を増設する段階で扱う。通常ペンの基礎描画品質Phaseでは、描画中と確定後の一致を優先し、後補正は入れない。
- **次フェーズ**: `task-gemini/phase2k.md` を作成。キャンバスサイズ上限は 2500px を第一候補とする。根拠は漫画原稿サイズ 1700x2400 程度を収めるため。3000px案は性能/履歴メモリ確認後の保留候補に落とす。
- **隣接要望**: カメラ操作での拡縮倍率を少し広げる要望も Phase 2k に含める。ただし、描画品質対策として内部2倍化や RenderTexture 解像度変更は行わない。

### 2026-05-19 Codex修正：pointerup後に線が太る問題の抑止
- **原因判断**: 直前の黒ずみ対策で `finalizeStroke()` が開始前スナップショットへ戻してから `perfect-freehand` の最終ポリゴンで焼き直すようになり、描画中の `Graphics.stroke()` ライブ線分と確定後の線幅・軌跡が変わっていた。
- **修正**: 通常ペン/消しゴムでライブ焼き込み済みの場合は、pointerup後に別アルゴリズムで再焼き込みしない。ドラッグ中に見えていた線をそのまま完成形とし、履歴・pathsData・サムネイル更新だけを記録するように戻した。
- **判断**: CSP等でも「後補正」はユーザーが明示的に使う別機能であり、Tegakiの通常ペンのデフォルト挙動としては描画中表示と確定結果の一致を優先する。黒ずみが残る場合は、次は線形補正ではなく RenderTexture の透明エッジ/アルファ合成側を疑う。

### 2026-05-19 Codex修正：縮小カメラ描画時のストローク荒れ/黒ずみ対策
- **原因判断**: 通常ペンはライブ焼き込み済みの場合、`finalizeStroke()` で最終ストローク焼き込みをスキップしていた。そのため完成データが「短い線分を逐次 RenderTexture へ焼いた結果」のまま残り、縮小カメラで入力点の local 距離が大きくなった時に、線分キャップ・透明エッジ・重なりが黒ずみやガタつきとして残りやすかった。
- **修正**: `brush-core.js` でライブ表示側の補間間隔を 1px に詰め、補間点もライブ焼き込みするよう変更。さらに pointerup 時は開始前スナップショットへ戻してから、記録済みポイント列を1本の最終ストロークとして焼き直すようにした。描画中の即時表示は維持し、完成データだけを整理する狙い。
- **判断**: `roundPixels` は PixiJS v8 の既定が false で、今回の主因ではなさそう。RenderTexture の内部2倍化や WebGL2 Mesh 復活は行っていない。
- **確認**: `npm.cmd run build` 成功。ブラウザ起動確認で console error なし。自動ドラッグ試走では点入力まで確認、縮小カメラでの線質はオーナー実機確認待ち。

### 2026-05-19 Gemini：Phase 2j ストローク品質・ジャギーの現状棚卸し
- **描画データ生成 (`pointer-handler.js`, `brush-core.js`)**:
    - `getCoalescedEvents()` を使用し、ブラウザが間引いた中間点も取得済み。
    - `BrushCore.updateStroke` で 2px 間隔の線形補間を実施。カメラ引き（縮小）時にはこの 2px が画面上の 1px 未満になるため、データ密度は十分に見える。
- **RenderTexture 焼き込み (`layer-system.js`, `brush-core.js`)**:
    - `RenderTexture.create` 時、PIXI v8 既定で `antialias: true` を指定可能。
    - ペン・消しゴムともに `Graphics.poly()` または `Graphics.stroke()` で焼き込み。
- **座標変換 (`coordinate-system.js`)**:
    - `clientX/Y -> local` 変換において、意図的な整数丸め（`Math.round` 等）は行われていない（浮動小数を維持）。
- **ジャギーの原因候補整理**:
    1. **表示スケーリング (低リスク)**: `PIXI.Application` または `worldContainer` の `roundPixels` 設定が影響している可能性。
    2. **補間間隔 (低リスク)**: 2px 固定の補間が、非常に細いブラシや大きなキャンバスで「点滅」や「ガタつき」に見える可能性。
    3. **RenderTexture 解像度 (高リスク/封印中)**: `resolution: 1` 固定のため、高DPI環境や縮小表示時のサンプリング品質に限界がある（ただし `resolution: 2` は方針により禁止）。
- **次の一手（Codex判断へ）**:
    - まずは `roundPixels: false` (または `true`) の切り替えによる見た目変化を確認する。
    - 補間間隔を 2px から 1px または 0.5px へ詰めて、低速・小サイズ時の改善を確認する。

### 2026-05-19 Codex判断：Phase 2i完了、Phase 2jへ移行準備
- **Phase 2i完了判定**: リサイズ、設定、出力 popup の半透明化・余白ドラッグ・閉じるボタン統一・リサイズ方向補正はオーナー確認済み。アルバム popup とクイック popup は大幅改修時に個別対応するため、Phase 2iの残タスクとしては追わない。
- **オーナーメモ/画像資料の影響**: 新規資料 `資料_説明用画像/カメラ最小で描いた時と最大で描いたときでストロークの精細さが違うのは当然だがジャギーになってるのは修正したい.png` とメモ追記により、次はキャンバスサイズ・カメラズーム条件で描線のアンチエイリアスや精細さが崩れる問題を優先確認する。片辺最大3000px化、ズーム範囲拡張は隣接要望だが、症状を増幅し得るためPhase 2jの原因確認後に実装判断する。
- **次フェーズ**: `task-gemini/phase2j.md` を作成。Gemini は描画経路、座標/ズーム、RenderTexture、ブラシ設定の棚卸しと `PROGRESS.md` 記録まで。内部2倍化、WebGL2 Mesh復活、描画パイプライン大改造は行わない。
- **保留**: クイックパネル刷新、アルバム popup 改修、レイヤー/フォルダD&D根本刷新、トップバー実装、リサイズ増減プレビューは後続候補。

### 2026-05-19 Codex追修正：浮遊popupの閉じるボタン統一
- **対象**: リサイズ、設定、出力 popup の `X` ボタンを同じ四角タイプへ統一した。
- **判断**: アルバム popup とクイック popup は大幅改修予定があるため、今回の Phase 2i では触らず後続フェーズへ送る。

### 2026-05-19 Codex実装：設定/出力popupへの浮遊UI横展開
- **共通ドラッグ化**: `ui/popup-drag-helper.js` を追加し、popup本体の余白を掴むドラッグ移動を共通化。リサイズ popup はこのヘルパー利用へ差し替えた。
- **設定 popup**: 半透明・細線・小角丸の浮遊パネルへ変更し、余白ドラッグを追加。スライダーと筆圧カーブボタンの色をリサイズ/属性パネル寄りへ統一した。
- **出力 popup**: 半透明・細線・小角丸の浮遊パネルへ変更し、余白ドラッグを追加。フォーマット/実行ボタンの選択色を淡い栗色へ寄せ、プレビュー表示の基準を 200px へ拡大した。
- **保留**: アルバム popup は SortableJS と選択/保存導線が絡むため、今回の横展開対象から外した。最終段階で個別に扱う。

### 2026-05-19 Codex追修正：リサイズpopupのデザイン統一と方向意味の補正
- **外観統一**: リサイズ popup のスライダー、選択中ボタン、プリセット、実行ボタンをアクティブレイヤー属性パネル寄りの淡い栗色・細線・小角丸へ寄せた。
- **リサイズ方向補正**: UI上の `←/→/↑/↓` は「矢印方向のキャンバス端が増減する」意味にし、実行時に `LayerSystem` へ渡す固定方向を反転するようにした。将来のリサイズ予告表示とも合わせやすい。
- **右サイドバーの瞬間枠対策**: 右サイドバー操作ボタンに `focus-visible` の橙色アウトラインを追加し、ブラウザ既定の黒いフォーカス枠が出た時の見た目を抑えた。

### 2026-05-18 Codex追修正：リサイズpopupの余白ドラッグ化と外観統一
- **ドラッグ判定変更**: 細い `.popup-drag-strip` を廃止し、リサイズ popup 本体の余白を掴んだ時に移動する方式へ変更。ボタン、スライダー、入力系、閉じるボタンはドラッグ開始対象から除外した。
- **ペン/マウス対策**: popup 本体で `PointerEvent` を受け、`setPointerCapture` も本体へ移した。タブペンでも余白から動かしやすい形にした。
- **外観調整**: リサイズ popup の透過背景、細い枠線、角丸、閉じるボタンをアクティブレイヤー属性パネル寄りのデザインへ寄せた。

### 2026-05-18 Codex実装：リサイズpopupの半透明化と移動ハンドル追加
- **対象選定**: Gemini棚卸し通り、`resize-popup.js` は他 popup より小さく、出力・保存・アルバムの複雑な状態を持たないため、Phase 2i の初回実装対象にした。
- **半透明化**: `.popup-panel--translucent` を追加し、リサイズ popup にだけ適用。背景を少し透かし、キャンバス状態を見ながら操作しやすくした。
- **移動可能化**: リサイズ popup 上部に細い `.popup-drag-strip` を追加し、そこを掴んだ時だけ PointerEvent で移動できるようにした。スライダーやボタン操作とは判定を分け、誤操作を避ける。
- **共通化判断**: ドラッグ共通ヘルパー新設はまだ行わない。まずリサイズ popup で挙動を確認し、次に設定/出力 popup へ広げる段階で抽象化する。
- **確認**: `npm.cmd run build` 成功。`dist/` 生成差分は成果物として残さないよう整理済み。

### 2026-05-18 Gemini：Phase 2i ポップアップUI統一の現状棚卸し
- **ポップアップの移動・ドラッグ現状**:
    - `quick-access-popup.js`: 独自に `PointerEvent` を使ったドラッグ移動ロジック (`_setupPanelDragHandlers`) を実装済み。
    - `resize / export / settings / album`: ドラッグ移動ロジックは未実装。`position: fixed` で固定座標（主に `60px, 60px`）に表示される。
- **UI 構造と CSS 共通性 (`main.css`)**:
    - `.popup-panel`: 背景 `var(--futaba-cream)`, 枠線 `2px solid var(--futaba-maroon)`, 角丸 `16px`, 影あり。
    - `.ui-close-button`: 統一された閉じるボタンクラス。
    - `.resize-popup-compact`: クイックパネルとリサイズパネルで共有されている、よりコンパクトなパネル用クラス。
- **管理ロジック (`popup-manager.js`)**:
    - `hideAll()` により、新しいポップアップを開くと他が閉じる排他制御が基本。浮遊 UI 化する場合、この挙動の調整が必要。
- **各ポップアップの個別状況**:
    - `resize-popup.js`: 非常にシンプルで、最初の半透明・移動可能化テストに最適。
    - `export-popup.js`: プレビュー領域が `150x150` 固定で実装されている。画面からはみ出さないための調整余地あり。
    - `settings-popup.js`: 1画面に全設定が並んでおり、将来のタブ化が必要。
    - `album-popup.js`: `SortableJS` を含み、サイズも大きく複雑。共通化の最終段階が望ましい。

### 2026-05-18 Codex判断：Phase 2h完了、Phase 2iへ移行準備
- **Phase 2h完了判定**: オーナー確認で、回転、描画、拡縮、レイヤー増加を混ぜた複数パターンの Undo / Redo が適切に動作した。
- **残タスクの扱い**: アクティブレイヤー編集パネルのリセットボタン、楕円軌道設定、フォルダ単位のV変形は後続候補。Phase 2hでは変形確定履歴の不整合修正までで完了扱いにする。
- **次フェーズ**: `task-gemini/phase2i.md` を作成。次はクイックパネルだけが移動可能な違和感を減らすため、リサイズ/設定/出力/アルバムなどの popup を棚卸しし、透過・移動可能化・サイズ制御の共通方針を整理する。
- **D&D参考メモ**: レイヤーパネルのスムーズな移動は `PastFiles/OldFiles/v8.13_anime14` 周辺にも参考実装がある可能性あり。独自D&D再設計フェーズに入る時点で参照する。

### 2026-05-18 Codex修正：変形確定のUndo/RedoをRasterSnapshot復元へ変更
- **原因確認**: Geminiの指摘通り、`confirmLayerTransform()` は変形確定時に `RenderTexture` へ焼き込んだ後、`layer-transform` コマンドをスタックに積む。
- **修正方針**: 変形確定前後で `createLayerRasterSnapshot()` を取得し、履歴には適用済み command として `historyManager.record()` で記録するよう変更。`redo` は焼き込み後 snapshot + identity transform、`undo` は焼き込み前 snapshot + 変形前 transform を復元する。
- **影響範囲**: Vキー変形確定の履歴のみ。Phase 2g の一括削除、属性パネル、複数選択には触れていない。
- **確認**: `npm.cmd run build` 成功。`dist/` 生成差分は成果物として残さないよう整理済み。

### 2026-05-18 Gemini：Phase 2h 履歴・変形の現状棚卸し
- **履歴管理構造 (`history.js`)**:
    - `HistoryManager` クラスが `stack` と `index` で管理。`push(command)` で実行・記録、`record(command)` で記録のみ。
    - コマンドは `name`, `do()`, `undo()` を持つ標準的なコマンドパターン。
- **変形・確定の履歴実装 (`layer-system.js`)**:
    - `confirmLayerTransform()`: Vキー変形の確定時に呼ばれる。`bakeTransform()` で `RenderTexture` に内容を焼き付けた後、`layer-transform` コマンドをスタックに積む。
    - **重大な懸念点**: `undo()` 時、コンテナの `position`, `scale`, `rotation` は元に戻るが、`RenderTexture`（ラスター内容）に焼き込まれた内容は元に戻らない（警告コメントあり）。これが Redo/Undo 不安定の主因の可能性が高い。
    - `duplicateLayer`, `mergeLayerDown`: これらは `createLayerRasterSnapshot()` と `restoreLayerRasterSnapshot()` を使い、ピクセル単位での復元を伴う `do`/`undo` を実装している。
    - 変形パネル連携**: `initTransform` 内の `onTransformComplete` 経由で `confirmLayerTransform` が発火。

### 2026-05-18 Codex判断：Phase 2g完了、Phase 2hへ移行準備
- **Phase 2g完了判定**: オーナー確認で、属性パネルのドラッグ領域移動、タブペンでのスムーズなドラッグ、複数選択レイヤーの一括削除が動作した。
- **残タスクの扱い**: 一括クリッピング、一括結合、まとめてフォルダ投入、フリック削除は後続候補として残す。現時点で無理に続けるとフォルダD&Dや履歴の不安定さを再燃させるため、Phase 2gは「低リスクな一括操作の初回接続」までで完了扱いにする。
- **次フェーズ**: `task-gemini/phase2h.md` を作成。オーナーメモにある「Redoが安定しない気がする」「アクティブレイヤーの回転/縮小後に戻らないことがある」を受け、履歴・変形・Redoの棚卸しと局所補修へ進む。
- **担当判断**: 履歴と変形は `HistoryManager` / `LayerSystem` / 変形UI / 保存状態にまたがるため、実装修正は Codex 主導。Gemini は再現手順の棚卸し、関係ファイルの読み取り、`PROGRESS.md` 記録までに限定する。

### 2026-05-18 Codex追修正：属性パネルドラッグ補修と一括削除初版
- **属性パネルのドラッグ領域**: ドラッグ専用の余白をパネル左上、レイヤー名の前へ移動。閉じるボタン付近の誤爆を避け、ドラッグ開始位置を分かりやすくした。
- **タブペン対策**: 属性パネルのドラッグ終了判定を開始時の `pointerId` に限定し、ドラッグ中の `pointermove` も同一ポインタだけ処理するようにした。クイックパネルに近い挙動へ寄せた。
- **Phase 2g 初回実装**: 右サイドバーの削除ボタンは、選択中レイヤーが2件以上ある場合だけ一括削除するようにした。背景は対象外。フォルダと子が同時選択された場合は親フォルダ側の削除に寄せ、子の二重削除を避ける。
- **確認**: `npm.cmd run build` 成功。`dist/` 生成差分は成果物として残さないよう整理済み。

### 2026-05-18 Gemini：Phase 2g 棚卸し・複数選択操作の準備
- **複数選択の状態管理現状 (`LayerSystem`)**:
    - `this.selectedLayerIds` (Set) と `this.selectionAnchorIndex` が追加済み。
    - `toggleLayerSelection(index)`, `selectLayerRange(index)` により、Ctrl/Cmd/Shift クリックでの複数選択ロジックが実装されている。
    - `getSelectedLayerIds()`, `getSelectedLayerIndexes()` で選択中レイヤーを取得可能。
- **UI 連携現状**:
    - `LayerPanelRenderer`: 複数選択の見た目反映 (`.selected`)、`F2` による名前変更、属性パネルからの名前変更が実装済み。
    - `UIController`: 右サイドバーの削除・結合・複製ボタンは依然として `this.layerManager.activeLayerIndex` (単一) のみを参照している。
- **一括操作の実装に向けた要件整理**:
    - **一括削除**: インデックスの変動を防ぐため、降順（上から下）での削除が必要。背景レイヤー除外のガードを徹底する。
    - **一括クリッピング**: 選択中レイヤーの中に「クリッピング可能な通常レイヤー」が含まれる場合のみ一括処理を行う。
    - **操作の優先順位**: 右サイドバーのボタンが「選択中すべて」に効くのか「アクティブのみ」に効くのかの UI/UX 仕様を Codex と同期する必要がある。

### 2026-05-18 Codex追修正：属性パネル配置と色の統一
- **初期位置**: 属性パネルは右サイドバー起点でもレイヤー行に重ならないよう、レイヤー一覧の左側を初期位置にした。キャンバス側へ大きく入り込む配置を許容する。
- **ドラッグ領域**: 属性パネル上部の名前ボタンが横幅を取りすぎていたため、名前欄を少し狭め、右側にドラッグ専用の余白を追加した。
- **色調整**: 右サイドバー操作ボタンの hover/active と削除 hover を、強い栗色ではなくレイヤー/フォルダ追加ボタン寄りの薄い茶色へ寄せた。合成 select とクリップボタンもクリーム色基調へ揃えた。
- **確認**: `npm.cmd run build` 成功。`dist/` 生成差分は成果物として残さないよう整理済み。

### 2026-05-18 Codex追修正：レイヤー属性パネルの起点を右サイドバーへ移動
- **操作衝突 of 整理**: レイヤー行の透明度数値クリック/ドラッグで属性パネルを開く挙動を撤去し、行は選択・D&D・将来のフリック削除に使いやすい状態へ戻した。
- **右サイドバー導線**: `ui-icons.js` に `slidersHorizontal` を追加し、folder追加ボタンの下にアクティブレイヤー属性ボタンを追加した。ここから透明度/合成/クリッピングの属性パネルを開く。
- **名前変更統合**: 属性パネル内のレイヤー名をクリックして名前編集できるようにした。`F2` 名前変更は維持。
- **確認**: `npm.cmd run build` 成功。`dist/` 生成差分 is not left in workspace.

### 2026-05-18 Codex実装：Phase 2f 複数選択の最小土台
- **選択状態追加**: `LayerSystem` に `selectedLayerIds` と `selectionAnchorIndex` を追加し、active レイヤー（描画先）と selected レイヤー（複数操作対象）を分離した。
- **入力整理**: 通常クリックは単一 active / 単一 selected、`Ctrl/Cmd+クリック` は個別選択トグル、`Shift+クリック` はアンカーからの範囲選択にした。
- **名前変更導線変更**: `Shift+クリック` は範囲選択へ譲り、名前変更はアクティブ行で `F2` に変更した。
- **UI表示**: Gemini が追加した `.layer-item.selected` を使い、複数選択中の行を active 枠とは別の薄い選択状態として表示するようにした。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-18 Gemini：Phase 2f 棚卸し・選択/名前変更の現状確認
- **レイヤーパネルのクリック・選択現状**:
    - `ui/layer-panel-renderer.js`: `layer-item` 全体のクリックで `layerSystem.setActiveLayer(index)` を実行。
    - 修飾キーの利用状況: 名前部分 (`layer-name`) のみ `Shift+クリック` を購読しており、名前編集 (`_editLayerName`) のトリガーとなっている。
    - 行全体での `Ctrl/Cmd/Shift` クリックによる複数選択ロジックは未実装。
- **LayerSystem の状態管理現状**:
    - `this.activeLayerIndex` による単一選択のみ管理。
    - `setActiveLayer(index)` が唯一の選択状態変更経路。
- **CSS の表示状態現状**:
    - `.layer-item.active`: オレンジ色の太枠 (`#ff6600`) でアクティブを表示。
    - `.layer-item:hover`: 栗色系の背景色 (`#f0e0d6`) と微かな移動アニメ。
    - `.selected` クラスは `album-card` には存在するが、`layer-item` 用の定義はまだない。
- **競合の懸念**:
    - Windows/OS 標準では `Shift+クリック` は範囲選択に使われるが、現在は名前変更に使われている。複数選択導入時に操作の再定義が必要。

### 2026-05-18 Codex判断：Phase 2e完了扱い、Phase 2fへ移行
- **Phase 2e完了判定**: オーナー確認で、通常レイヤー同士のクリッピングは直下に絵がある/ない状態で期待通り機能した。
- **次フェーズ**: `task-gemini/phase2f.md` を作成。次は複数レイヤー選択の土台と、`Shift+クリック` 名前変更との操作競合整理を扱う。
- **指示書同期**: `GEMINI.md` と `GEMINI作業指示書.txt` を Phase 2f 参照へ更新し、Gemini が古い Phase 2d 作業へ戻らないようにした。
- **担当判断**: 複数選択は `LayerSystem` と `layer-panel-renderer.js` の状態管理にまたがるため、初回実装は Codex 直接担当が安全。Gemini は棚卸し、PROGRESS記録、CSS小調整に限定する。

### 2026-05-18 Codex追修正：Phase 2e クリッピング再構築エラーと描画プレビュー補修
- **Console対応**: `LayerSystem._clearLayerClippingMask()` で、`layerSprite` が無いフォルダ等でも `undefined === null` 判定から `null.mask` 代入へ進む経路があったため、`layerSprite` と `clippingMaskSprite` の存在確認を追加した。
- **マスク解除補強**: クリッピングマスクを破棄する前に、同じマスクを参照しているレイヤー内子要素の `mask` も解除するようにした。古い `clipping_mask_sprite` 参照が残らないようにするため。
- **描画開始時の点対策**: `BrushCore.startStroke()` で作る `strokePreview` に、アクティブレイヤーのクリッピングマスクを適用した。直下ソースが無くマスクが作れない場合はプレビューを非表示にし、最初の一瞬だけ未クリップの点が見える経路を抑制する。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-18 Codex実装：Phase 2e 通常レイヤークリッピング本体初版
- **クリッピング本体**: `layerData.clipping` が ON の通常レイヤーは、同じ階層で直下にある表示中の通常レイヤーの `RenderTexture` をマスク元にして表示するようにした。
- **マスク更新**: `LayerSystem.refreshClippingMasks()` を追加し、レイヤー順変更、表示切替、クリッピング切替、読み込み/更新時に専用 `clipping_mask_sprite` を再構築する。元が無い場合はクリッピングレイヤーの表示を隠し、意図せず全面表示にならないようにした。
- **スコープ**: 初版は通常レイヤー同士の直下クリッピングに限定。直下フォルダの合成結果をマスクにする処理、逆クリッピング、複数レイヤー一括クリッピングは後続。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-18 Codex判断：Phase 2d完了、Phase 2eへ移行
- **Phase 2d完了判定**: 透明度ポップアップ、合成モードUI、クリッピングUI、保存/復元、複製時属性コピー、フォルダ透明度操作まで接続済み。
- **Phase 2e候補**: 次はクリッピング本体を描画へ効かせる。`layerData.clipping` をONにした通常レイヤーが、同階層の直下レイヤーまたは直下フォルダ合成結果の不透明部分だけ表示/描画される形を検討する。
- **担当判断**: クリッピング本体は描画順、RenderTexture、保存復元、サムネイル、履歴へ波及するため Codex が直接担当する。Gemini へ任せる場合は、仕様メモ整理や小さなCSS調整程度に留める。
- **保留**: 逆クリッピング、複数レイヤー一括クリッピング、フォルダ単位の複雑なマスク、独自D&Dは後続。まず通常クリッピングを安定させる。

### 2026-05-18 Codex実装：Phase 2d レイヤー属性ポップアップ初版
- **仕上げ調整**: 透明度数値入力の focus 枠と入力欄色を栗色系へ統一し、ブラウザ標準の黒/灰色感を抑えた。ポップアップ背景も少し透過を強めた。
- **行内クリップ操作**: レイヤー行の paperclip アイコンを直接クリックしてクリッピング ON/OFF できるようにした。通常レイヤーは未使用時も薄く表示し、フォルダ/背景は対象外。
- **連続調整対応**: ポップアップにレイヤー名と閉じるボタンを追加。レイヤーパネル内クリックでは閉じず、クリックしたレイヤー/フォルダへポップアップ対象を切り替えるようにした。
- **透明度プリセット復帰**: 0 / 25 / 50 / 75 / 100 のプリセットを復活。選択色は濃い栗色ではなく中間色へ寄せ、スライダーも灰色系を避けて栗色系のトラック/つまみへ変更した。
- **操作追加**: ポップアップはヘッダー部分をドラッグして移動可能。透明度数値はダブルクリックで直接入力できる。
- **UI追調整**: レイヤー行の透明度 `◀▶` ボタンを削除し、通常以外の合成モードだけ `100%` 横へ小さく表示するようにした。通常時は非表示で行の情報量を抑える。
- **クリップアイコン化**: `ui-icons.js` に Lucide `paperclip` を追加し、レイヤー行とポップアップのクリッピング表示を `C` 文字からSVGアイコンへ変更した。
- **ポップアップ再構成**: 透明度プリセットを削除し、透明度スライダー、合成モード select、クリッピングアイコンボタンの小型構成へ変更。背景は少し透過させ、表示位置はレイヤーパネル上ではなく左横優先にした。
- **フォルダ透明度**: フォルダ行にも透明度表示を追加し、フォルダでは透明度だけのポップアップを開けるようにした。
- **透明度ポップアップ**: 通常レイヤー/フォルダの `100%` 表示をクリックすると、小型ポップアップを表示するようにした。左右ドラッグによる既存の透明度変更は維持。
- **合成モード接続**: `LayerSystem.setLayerBlendMode()` を追加し、通常 / 乗算 / 加算 / オーバーレイを `layerData.blendMode` と Pixi 表示側へ同期する。背景・フォルダは対象外。
- **クリッピング状態接続**: `LayerSystem.setLayerClipping()` / `toggleLayerClipping()` を追加し、ポップアップから `layerData.clipping` を切り替え、レイヤー行のクリップ状態表示へ反映する。
- **保存/復元補強**: 通常レイヤーの `clipping` を保存/復元対象へ追加。復元時は `blendMode` も Pixi 表示側へ反映する。
- **複製補強**: レイヤー複製時に透明度/可視状態だけでなく、合成モードとクリッピング状態もコピーするようにした。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-18 Codex確認：Phase 2d Gemini作業レビューと文書同期
- **Console確認**: 更新された `TegakiConsole.txt` は起動成功と album popup 表示ログ中心。
- **Gemini差分確認**: `project-manager.js` に通常レイヤーの `clipping` 保存項目が追加されていたが、復元側が未接続だったため Codex で復元処理まで接続した。
- **Phase表記同期**: `PROGRESS.md` の現在フェーズを Phase 2c から Phase 2d へ更新。
- **Claude提案書反映**: `DnD_設計提案書_Claude_to_Codex.md` と `ペン実装_現状評価と修正提案書_Claude_to_Codex.md` は方針変更ではなく後続判断材料として整理済み。
- **次作業方針**: Codex は透明度ポップアップ、合成モードの表示接続、クリッピングUI/保存復元の整合を担当。Gemini に任せる場合は CSS 微調整、棚卸し、ヘッダー同期、50行以内の局所修正に限定する。

### 2026-05-18 Gemini：Phase 2d 開始・透明度/合成モード/クリッピング棚卸し
- **透明度操作の現状**:
    - `ui/layer-panel-renderer.js`: `_createOpacityControl()` 内の `layer-opacity-value` (span) で左右ドラッグによる数値変更を実装済み。
    - `system/layer-system.js`: `setLayerOpacity()` で `layer.alpha` と `layer.layerData.opacity` を同期更新している。
- **合成モード・クリッピングの現状**:
    - `system/data-models.js`: `LayerModel` に `blendMode` (default: 'normal')、`clipping` (default: false)、`locked` (default: false) のフィールドが既に存在することを確認。
    - `ui/layer-panel-renderer.js`: `_createClipStatusIcon()` で `layerData.clipping` が ON の場合に `C` マークを表示する UI が実装済み。
- **保存・復元の現状**:
    - `system/project-manager.js`: `blendMode` は保存/復元対象に含まれているが、`clipping` と `locked` は現状対象外であることを確認。
- **Gemini 小修正タスク**:
    - `layer-panel-renderer.js` / `layer-system.js` のヘッダーを最新の調査結果に基づいて微調整。

### 2026-05-18 Codex実装：Phase 2c レイヤー操作安全化の初回修正
- **フォルダ内部状態修正**: `LayerModel` が `isFolder` / `folderExpanded` / `parentId` / `children` を保持していなかったため追加。
- **危険操作ガード**: アクティブ操作バーの複製・下結合は、通常レイヤーかつ `renderTexture` を持つ場合だけ実行するようにした。背景・フォルダ・下がフォルダ/背景の結合は何もせず止める。
- **結合安全化**: `mergeLayerDown()` で履歴スナップショット作成前に、上下レイヤーの `layerData` / `renderTexture` / 背景・フォルダ判定を確認。
- **塗りつぶし安全化**: フォルダや `renderTexture` なし対象へのバケツ塗りはエラーにせず無視。
- **サムネイル安全化**: フォルダは通常レイヤー用サムネイル抽出対象から除外。
- **Space+ペン追調整**: Space 起点パン中、ペン入力で `pressure <= 0.001` の hover 状態になったらパンを停止する小条件を追加。
- **確認**: `npm.cmd run build` 成功。
- **フォルダUI追修正**: 閉じたフォルダ行は `folder` SVG、追加ボタンは `folderPlus` SVG に分離。
- **フォルダ複製復帰**: フォルダの複製は、現時点では中身を持たない空フォルダ複製として復帰。
- **フォルダ描画ブロック**: フォルダ/背景/`renderTexture` なしのアクティブ対象では、ペン描画入口で止めるようにした。
- **フォルダ色規定補修**: フォルダ系SVGが `currentColor` 継承漏れで黒く見える経路を潰すため、フォルダサムネイル/フォルダ行/フォルダ追加ボタンのSVG strokeを Maroon 固定にした。
- **フォルダ収納の初期UI**: `Shift+クリック` 収納は撤去し、レイヤー/フォルダをフォルダ行へドラッグした時に収納する方向へ変更。
- **フォルダ内作成**: フォルダをアクティブにした状態でレイヤー追加/フォルダ追加を行うと、作成されたレイヤー/フォルダをそのフォルダ直下へ収納する。
- **子行表示**: フォルダ内のレイヤー/フォルダは階層に応じて段階的に短く表示し、アクティブ時は通常幅へ戻して編集しやすくした。
- **アクティブ表示補修**: `layer:activated` 時に次回描画待ちだけでなく、現在DOMの `.active` クラスと枠を即時更新するようにして、連続クリック時の枠/色移動の遅れを軽減した。
- **ドラッグ収納判定の絞り込み**: フォルダ隣接位置への並び替えまで収納扱いになる問題を抑えるため、フォルダ行の中央帯へドラッグした時だけ収納候補にする判定へ変更。
- **複製位置補修**: レイヤー/フォルダ複製は最上段ではなく、複製元の直上へ出すようにした。
- **アクティブ実体先行化**: 行の `click` ではなく `pointerdown` で実activeを先に切り替えるようにした。
- **複製/収納の安定化**: Pixi `children` 配列を直接 `splice` していた経路をやめ、`removeChild()` / `addChildAt()` のみに統一。
- **名前欄クリック補修**: 通常クリックは active 化し、名前編集は従来通りダブルクリックで行う。
- **フォルダ開閉ショートカット**: アクティブ対象がフォルダの時だけ `Enter` で開閉できるようにした。
- **フォルダ子ブロック補修**: 通常並び替えでフォルダ内レイヤーの間へ無親レイヤーが割り込む経路を抑制。
- **名前変更補助**: active 安定化のため通常クリックは選択に戻したうえで、名前変更はダブルクリックに加えて `Shift+クリック` でも開始できるようにした。
- **レイヤーパネル高さ補修**: グリッド内で高さ計算するようにした。
- **ドラッグ復帰**: active 切替は通常 `click` に戻した。
- **新規作成位置補修**: レイヤー/フォルダ新規作成も複製と同じく作成前のアクティブ基準に配置。
- **Ctrl+上下のフォルダ通過**: Ctrl+方向キーで隣接先がフォルダの場合、フォルダを飛び越えず中へ入る挙動を追加。
- **右端/下端欠け補修**: レイヤー行を `box-sizing: border-box` にして目アイコンの右端欠けを抑制。
- **パネル再補修**: レイヤー行を 190px から 174px へスリム化し、スクロールバー出現時はレイヤーパネル全体を左へ逃がすクラスを自動付与。
- **名前変更操作整理**: 名前変更は `Shift+クリック` のみに変更。
- **新規作成位置再調整**: アクティブがフォルダの場合も中ではなくフォルダ直上に作るよう変更。
- **Ctrl+上下を通常移動へ戻し**: 通常の隣接順序移動に戻した。
- **右パネル余白整理**: スクロール出現時だけ全体を動かす方式は撤回。
- **一覧表示数調整**: レイヤー一覧の最大高を少し広げた。
- **フォルダ保存復元**: `ProjectManager` のJSON/アルバム用 `projectData` にフォルダ、開閉状態、親子関係を含めるようにした。
- **右端欠け再補修**: レイヤー一覧をグリッド2列分へ広げ、内側にスクロールバー専用レーンを持たせた。
- **フォルダ投入ハイライト**: 青系ハイライトへ変更。
- **フォルダ投入判定の試作改善**: ポインタ座標からフォルダ行を探す補助判定と、ドロップ終了時の再判定も追加。
- **フォルダ口判定の逃げ道追加**: フォルダ行の上端/下端は外側へ並び替える逃げ帯として残し、中央帯だけを投入口として扱うよう調整。
- **フォルダ内並び替え安定化**: 同じフォルダ内の子レイヤーを並び替える時は、親フォルダの口判定を出さず SortableJS の通常並び替えに任せるようにした。
- **フォルダD&D凍結判断**: SortableJS への継ぎ足しでは限界があるため暫定実装として凍結。
- **次フェーズ方針**: Phase 2d はドラッグを深追いせず、透明度ポップアップ、合成モードUI、クリッピングUIの下準備へ進む。

### 2026-05-18 Codex実装：右サイドバー型レイヤーパネルと薄型行
- **右サイドバー化**: `right-panel` を実際の右列として使い、レイヤー操作ボタンを縦配置へ変更。
- **薄型レイヤー行**: サムネイルを左へ移し、通常レイヤーは種別アイコン、名前、透明度数値、クリッピング状態枠、目アイコンを1行内へ整理した。
- **機能温存**: 追加・フォルダ追加・複製・下結合・削除は既存 API を使用。
- **確認**: `npm.cmd run build` 成功。
- **追調整**: フォルダはサムネイル枠にフォルダアイコンを表示する方針へ変更。
- **サイドバー統一**: 左右のサイドバー領域の背景色と境界線を外し、アイコンボタンだけが半透明パネルとして見える構成へ統一。
- **背景行調整**: 背景レイヤーのバケツアイコンを目アイコン左へ移動。
- **UI統一追修正**: 左右サイドバーの下地を薄い半透明パネルへ寄せ、区切り線を透明スペーサー化。
- **浮遊UI化**: キャンバスを全画面固定、左サイドバーと右レイヤー操作群を固定配置のオーバーレイUIへ変更。
- **入力小修正**: Space+ドラッグのパン中に左ボタン/ペン接触を離しても Space 押下中は移動が続く問題を修正。

### 2026-05-18 オーナー追加資料確認：右サイドバー型レイヤーパネル案
- **設計判断**: PC / Windows / 液タブ優先のため、右サイドバーに操作を集約する方針が妥当。
- **レイヤー行方針**: ToonSquid風配置へ寄せる。
- **後続タスク化**: 右サイドバー化、薄型レイヤー行、透明度ポップアップ、合成モード、クリッピングの段階実装案を記録。

### 2026-05-18 Codex追修正：アクティブレイヤー操作バーの最小接続
- **操作バー接続**: アクティブレイヤー対象の複製・下結合・削除ボタンを追加。
- **行内操作の整理**: 通常レイヤー行とフォルダ行から、個別の複製・結合・削除ボタン表示を外した。
- **確認**: `npm.cmd run build` 成功。

### 2026-05-17 Codex確認：Phase 2初回Gemini作業レビューとPhase 2b企画
- **Console確認**: 致命的なエラーはなし。
- **Gemini差分確認**: 安全範囲内に収まっている。
- **ビルド確認**: `npm.cmd run build` 成功。
- **Phase 2b企画**: レイヤー行は情報表示を優先し、編集操作はアクティブレイヤー操作バーへ寄せる方針。
- **担当切り分け**: DOM再配置やアクティブ操作バー新設は Codex が直接担当する。
- **指示書更新**: `task-gemini/phase2b.md` を作成し、`GEMINI作業指示書.txt` を Phase 2b 用へ更新。

### 2026-05-17 Gemini：Phase 2b 開始・UIスリム化設計確認
- **レイヤー行から外せる操作候補**: 複製、下レイヤー結合、削除。
- **レイヤー行に残すべき情報**: 目アイコン、クリッピング状態表示、レイヤー名、不透明度数値、サムネイル。
- **アクティブレイヤー操作バー (Active Layer Operation Bar)**: レイヤーリストの上下どちらかに配置し、一括操作を実行する。

### 2026-05-17 Gemini：Phase 2 開始・初期棚卸し (Initial Inventory)
- **ビルド確認**: `npm.cmd run build` 成功。
- **レイヤー関連の棚卸し結果**: `LayerModel` メタデータ保持構造、SortableJS による並び替え、変形確定 bake 処理、`extract.pixels()` 非同期サムネイル生成を確認。
- **低リスク小修正**: `layer-panel-renderer.js` ヘッダー更新、`layer-item` CSS マージン微調整、削除ボタンホバー挙動整理。

### 2026-05-17 Codex：Phase 2開始・Gemini事故復旧後の安全な初回小修正
- **復旧確認**: 破損短縮版から Phase 1m 完了時の内容へ戻っていることを確認。
- **ビルド確認**: `npm.cmd run build` 成功。
- **Gemini再発防止**: 既存JS丸ごと上書き禁止、大幅短縮禁止、対象外ファイルへの横展開禁止、ビルド失敗時の連鎖修正禁止を追記。
- **小修正**: 背景レイヤーに `background-layer` class を付与し、背景レイヤー専用 hover/drag 抑制スタイルを適用。
