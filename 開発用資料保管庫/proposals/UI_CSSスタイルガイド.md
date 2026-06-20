# Tegaki UI / CSS スタイルガイド

更新日: 2026-06-20

## 役割

新規UIと、変更対象componentの命名・配色・style責務を揃えるための基準。
全既存classを一括renameする辞書ではない。

更新は毎変更で強制せず、次のタイミングでまとめて行う。

- UI整理Phaseの完了時。
- 同じ不整合が複数componentで見つかった時。
- popup、Layer Panel、Timeline等の共通契約を変更した時。
- Phase 5eの定期監査時。

## 1. CSS class命名

原則はkebab-case。

```text
component:        .timeline-clip
element:          .popup-panel__body
variant:          .ui-icon-button--small
runtime state:    .is-active
runtime behavior: .is-dragging
```

- `--small` 等は恒常的なvariant。
- `.is-active` 等はJSが付け外す一時state。
- 既存の `.active`、`.selected` は互換性を保つ。新規componentでは `.is-*` を優先する。
- component固有名と汎用名を混ぜない。
- JSから渡すCSS custom propertyもkebab-caseにする。

## 2. 既存classの扱い

- `.caf-simple-header` 等の稼働中classを、名称だけを理由に一括renameしない。
- componentを実際に改修する時に、新classを追加して旧classをaliasとして残すか、全参照を同一作業内で更新する。
- CSS、querySelector、event delegation、test、drag ghostの参照を全検索する。
- 旧class削除は参照0件を確認してから行う。

## 3. 色

原則として `styles/main.css` の変数を使う。
色を決めてから近い変数を探すのではなく、実装前に既存変数と同用途componentを検索し、その定義から選ぶ。

```css
--futaba-maroon: #800000;
--futaba-light-maroon: #9c3835;
--futaba-medium: #b8706b;
--futaba-light-medium: #d4a8a0;
--futaba-cream: #f0e0d6;
--futaba-background: #ffffee;
--text-primary: #2c1810;
--text-secondary: #5d4037;
--text-inverse: #ffffff;
--active-border: #ff8c42;
```

- body text、label、button、select、option、disabled、placeholderもpalette対象。
- 安易な `black`、`#000`、`white`、neutral grayを追加しない。
- 半透明色は既存paletteのRGBを基準にする。
- canvas / Pixiへ数値色が必要な場合だけJSでCSS変数を読む。DOM装飾のためだけに `getComputedStyle()` を増やさない。

## 4. 共通部品を先に参照する

見た目を追加する前に、少なくとも次を検索する。

```powershell
rg -n "対象component|--futaba-|ui-scrollbar|ui-icon-button|popup-panel" tegaki_work/styles/main.css tegaki_work/ui
```

- 既存のCSS変数、共通class、同用途componentを優先する。
- 共通定義がある場合、近似色や専用scrollbarをその場で作らない。
- 新しい共通値が必要な場合は、既存値で表現できない理由と使用予定componentを確認してから `:root` または共通classへ追加する。
- component固有値を追加する場合も、palette変数または既存共通値から組み立てる。

## 5. scrollbar

- scroll可能領域は原則 `.ui-scrollbar` を付ける。
- thumb、track、hover色をcomponent内へ重複定義しない。
- 幅や高さだけcomponent固有調整が必要な場合は、`.ui-scrollbar` を基底に限定的なoverrideを行う。
- Firefox用 `scrollbar-width` / `scrollbar-color` とWebKit用定義を片方だけ追加しない。
- Timeline等で既存専用定義がある場合は、Phase 5e監査時に共通classへ寄せられるか確認する。機能改修と無関係な一括置換はしない。

## 6. JSとCSSの責務

CSSへ置く:

- 色、border、shadow、font、固定padding。
- hover / focus / disabled / selected。
- 固定layoutとcomponent variant。
- show / hide、透過、選択、drag中などのclass state。

JSが扱ってよい:

- pointer位置へ追従する `left/top`。
- viewportから計算する幅・高さ。
- D&Dのreorder shift。
- Timeline zoom等の連続値。
- canvas / Pixiへ渡す数値色。

同じ値を複数elementへ繰り返し設定する場合はclassまたはCSS custom propertyへ移す。

## 7. popup

共通基底:

```html
<div class="popup-panel popup-panel--translucent">
  <button class="ui-close-button"></button>
  <div class="popup-title"></div>
  <div class="popup-content"></div>
</div>
```

- popupの最前面化はz-indexだけで判断せず、overlay mount先と祖先stacking contextを確認する。
- 共通overlay mount helperを使う。
- 固定装飾はCSS、drag後の動的位置はJS。
- BasePopup classは、複数popupに実在するlife-cycle重複を削減できる時だけ導入する。

## 8. button・form

- icon button: `.ui-icon-button` + size variant。
- close: `.ui-close-button`。
- runtime state: `.is-active`, `.is-disabled`。
- `button`, `input`, `select`, `option` は文字色と背景色を明示する。
- native disabledの既定色へ任せず、palette内の色とopacityを設定する。
- focus-visibleは `--active-border` 等で判別できるようにする。

## 9. Layer Panel / CAF

- 共通card rendererとdata adapterの境界を維持する。
- 通常LayerとCAF内部Layerのclass差はvariantとして扱う。
- name、meta、thumbnail、action、folder line、D&D stateは共通部品を優先する。
- CAF containerとfolder cardの背景は同色に固定せず、階層が読める薄い差を許容する。
- D&Dのghost、drop line、押しのけanimationは共通engineと共通state classを使う。

## 10. Timeline

推奨語彙:

```text
.timeline-viewport
.timeline-lane
.timeline-clip
.timeline-playhead
.timeline-clip.is-selected
.timeline-viewport.is-panning
```

既存classを置換する際は、cell click、duration handle、Space drag、zoom、CAF D&Dのselectorを同時に確認する。

## 11. 監査チェック

UI変更時:

- palette外の文字色がないか。
- 色とscrollbarを既存変数・共通classから選んだか。
- native form controlが黒文字へ戻っていないか。
- static styleをJSへ追加していないか。
- mount先が正しく、Sidebar / Layer Panelとの重なりが意図通りか。
- class名がkebab-caseか。
- runtime stateがvariantへ混ざっていないか。
- 旧class互換が必要か。
- browserでhover、disabled、drag、closeを確認したか。

## 関連文書

- `TEGAKI.md`
- `AGENTS.md`
- `開発用資料保管庫/Archive/06_構造改善・保守性.md`
- `開発用資料保管庫/Archive/phase5e.md`
- `開発用資料保管庫/Archive/PHASE5E_AUDIT.md`
