# WP-012 Layer Panel / 合成まわりの調査（読み取り中心）

状態: INVESTIGATION → 一部実装（2026-10-02）。**フォルダのグループ合成（§1）とフォルダのサムネイル（§3）は実装済み**（下の「実装結果」）。ほかは未着手で、各項目をカード化してから。
目的: 吹き出し → トーン → レイヤーパネル改善 の見積りを正しくするため、先に事実を固める。

## 1. フォルダの合成（乗算・加算・不透明度）

- フォルダは**論理グループ**で、Pixi上は子の上に重なる空のContainer。子のSprite（layerSprite）は同じ`currentFrameContainer`の兄弟であり、フォルダContainerの子ではない。
- **不透明度**: `layer-system.js`の有効alpha解決（`resolveAlpha`）が、子のalphaへ親フォルダのopacityを**掛け算**している。これは「子それぞれを半透明にする」挙動で、真のグループ合成（子を先に合成してからフォルダ全体へopacity）とは、子同士が重なる所で結果が違う。
- **合成モード**: `setLayerBlendMode`はフォルダでも`layer.blendMode`（空Container）へ設定するだけで、**子へは伝わらず無効**。UIには出ているため「効かない」と見える。
- **クリッピング**: フォルダをクリッピング元/先にする処理は別途ある（`refreshClippingMasks`）。
- 影響: コマ割りの`コマNフォルダ`、トーンをフォルダにまとめて乗算、がそのままでは期待どおりにならない。
- 直し方の候補: (a) フォルダ合成を「子を一時RenderTextureへ合成→フォルダのopacity/blendで描く」真のグループ合成にする（正しいが重い。保存・書き出し・CPU compositorとの一致が必要）、(b) フォルダの乗算/加算を子へ伝播（子の合成モードは保持し、フォルダ側は「子の通常レイヤーのみ」に適用）の近似、(c) UIでフォルダの合成モードを無効化して誤解を防ぐ。(a)が本筋、工数大。

## 2. 合成モードの種類

- UI/`allowedModes`は **通常 / 乗算 / 加算 / オーバーレイ の4種のみ**。
- 描画側は`core-initializer.js`で`pixi.js/advanced-blend-modes`を読み込み済みで、Pixiは多数を持つ: Color, ColorBurn, ColorDodge, Darken, Difference, Divide, Exclusion, HardLight, HardMix, Lighten, LinearBurn, LinearDodge, LinearLight, Luminosity, Negation, Overlay, PinLight, Saturation, SoftLight, Subtract, VividLight（+標準のmultiply/screen/add）。
- アニメ書き出しのCPU compositor（`timeline-frame-compositor.js`の`_compositeMode`）は Canvas2D の `multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity` と加算(`lighter`)に対応。
- 安全に増やせる共通集合: **スクリーン / 乗算 / 加算 / オーバーレイ / 比較(暗) / 比較(明) / 覆い焼き / 焼き込み / ハードライト / ソフトライト / 差の絶対値 / 除外 / 色相(Pixiに無いため除く) / 彩度 / 色 / 輝度**。`subtract`/`divide`等はCanvas2Dに無く、CPU側との一致が取れないので除外。
- 要確認: 通常Canvasの書き出し（`export-manager`のextract）とPixi表示の一致、保存(`blendMode`)の往復、レイヤーパネルのラベル表。

## 3. フォルダのサムネイル

- `layer-system.requestThumbnailUpdate`が**フォルダを明示的にスキップ**し、レイヤーパネルのフォルダ行は開閉アイコン（`UI_ICONS.folder`/`folderOpen`）を出す設計。バグではなく未実装。
- 作るなら: 子の（有効alpha・合成モード付き）Spriteを小さなRenderTextureへ描いて縮小。更新は子の内容変更/並び替え/表示切替で要求（フォルダ展開中は不要など制限可）。

## 4. 逆クリッピング

- すでに実装済み（`clippingMode: none → normal → inverse`の巡回、レイヤーパネル/属性popupのボタン）。
- 見分けにくかった点を修正: 逆クリッピングはmaroon塗り＋クリーム抜き文字のアイコンで表示。

## 5. D&D・フォルダ出し入れのレスポンス

- 論理操作は軽い: `moveLayerIntoFolder`等は約1ms。パネルの更新は`requestUpdate`で16msに合体され、ドラッグ中は延期される設計（`_cardDrag`）。パネル再描画も25枚で約15ms。
- 重い候補: **`refreshClippingMasks()`が並び替え（`_finalizeLayerReorder`）のたびに全マスクを破棄・再構築**する。コマ割り（6コマ=クリッピング6枚）で1回40〜57ms（ヘッドレスのソフトウェアGL計測。実GPUでは小さいが、クリッピング数・キャンバスサイズに比例）。
- ヘッドレス環境は常時負荷が高く（アイドルでも100msのlong taskが連続）、**ここでは実機のD&D体感は再現できない**。実機のプロファイルが必要: `TEGAKI_CONFIG.debug=true`で`layer-panel-diagnostics`（要求/合体/ドラッグ延期の記録）が有効になる。
- 改善案: クリッピングは影響範囲だけ更新（dirty化）／ドラッグ中は再構築せずドロップ時に1回／マスクのRenderTexture再利用、パネルはカード差分更新。

## 6. レイヤーパネルとANIME Dockの二系統

- 見た目は**共通の`layer-panel-card-row`＋variant設定**（`legacy-layer-card`/`clip-layer-mirror`等）で、すでに同じレンダラーを使っている。データ側（通常Layer / CAF）が別adapterなのはTECHNICAL.mdの契約。
- 統一できる範囲: 寸法・色・状態表現のtoken化（CSSがvariantごとに重複）。データ層の統合は不要・不可。

## 実装結果（フォルダのグループ合成 + サムネイル）

- 新規 `system/folder-composite.js`（`FolderCompositor`）。**合成フォルダ**（フォルダ自身の合成モードが通常でない、または不透明度<1）の子孫を、通常描画から外し（`renderable=false`）、キャンバス寸法のRenderTextureへ（各自のblend/alphaのまま）描いて、そのSpriteをフォルダContainerの中（=子の真上）に置く。SpriteにフォルダのblendModeとalphaが掛かるため、**グループとして**乗算/加算/不透明度が効く。
  - 非破壊: 子Layer・History・保存形式・Layer順序・既存の描画経路は変えない。合成フォルダが無い間はコンパイル/生成コストゼロ（compositorを作らない）。
  - 更新はdirtyのときだけ（描画/変形中は毎フレーム。イベント: content-changed / reordered / opacity / blend / visibility / clipping / history / canvas:resized など）。入れ子は内側から先に描く。書き出し(`renderToCanvas`)の直前に`flush()`して最新を反映。保存・読込・非表示・合成解除（通常へ戻すと子が通常描画へ復帰）を実機で確認。
  - 不透明度: 合成フォルダは子へ掛け算せず、フォルダ全体として掛かる（子同士が重なる所の結果が従来の「子ごとに薄くする」から、正しいグループ不透明度へ変わる）。フォルダが通常・100%のときは従来どおり（パススルー）。
  - 画素検証（シアン/マゼンタが重なる2枚をフォルダに入れ、黄色の背景に対して）: 通常=重なりはマゼンタ、乗算=グリーン/レッド（重なりはレッド＝グループ内で先に合成してから乗算）、不透明度50%=重なりとマゼンタ単独が同じ値（グループ不透明度）。
- フォルダのサムネイル: 子孫を合成した縮小絵（フォルダ自身のblend/opacityは含めない）。開閉アイコンは左下の小さなバッジへ。内容の変更で差し替え（行の再生成なし）。内容の変更が無ければcache。
- 制約: 合成フォルダの中で、さらに乗算の子Layerを置くと、その子はフォルダ内の（透明な）背面にだけ作用する（グループの隔離。CSPなどでも同様）。フォルダのクリッピング（フォルダ自身を下のLayerへクリップ）との併用、Rigやアニメ(CAF)のフォルダは対象外で未検証。

## 7. 次のカード候補（優先は相談）

1. 合成モード拡張（共通集合の10〜12種、UIとCPU compositorの一致検証つき）
2. ~~フォルダのサムネイル~~（実装済み）
3. ~~フォルダ合成の本実装（真のグループ合成）~~（実装済み）
4. クリッピング再構築の差分化・D&Dの実機プロファイル
5. パネルとANIME Dockの見た目token統一
