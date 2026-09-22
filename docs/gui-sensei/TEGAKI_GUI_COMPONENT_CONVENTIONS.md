# TEGAKI GUI component conventions

状態: Transform GUI の現行実装に対する使用規約。製品CSSが値と状態表現の正本。この文書は他画面で使う際の選択基準を記す。

## CSS の所有と読み込み

`tegaki_work/index.html` は `styles/main.css`、`styles/components/sidebar-rail.css`、`styles/components/layer-panel-surface.css`、Animation 関連CSS、`styles/components/quick-access-popup.css`、`styles/components/layer-transform-basic.css` の順に読み込む。Futaba palette と共通の `--ui-control-*` token、`.gui-control`、`.gui-segmented`、`.gui-surface` は `styles/main.css` が所有する。Right Workspace の配置と主スイッチは `layer-panel-surface.css`、Transform 内部の行配置と WARP range の見た目は `layer-transform-basic.css` が所有する。

DOM の既存ID・handler・`data-*` は `ui/dom-builder.js` と `ui/right-workspace-frame.js` に残る。`dom-builder.js` は既存class文字列を維持したまま共通classを追加する。共通classを使用するために、編集状態や保存モデルを新設しない。

## サイズと用途

| 用途 | class / token | 現行の視覚高 | 使用例 |
| --- | --- | ---: | --- |
| S | `.gui-control--s` / `--ui-control-height-s` | 24px | アンカー、反転、KEYの前後、WARPブラシ種類 |
| M | `.gui-control--m` / `--ui-control-height-m` | 31px | BASIC/WARP、POINT/BRUSH、詳細toggle、KEY操作 |
| L | `.gui-control--l` / `--ui-control-height-l` | 38px | Transformの確定・取消 |

文字サイズは `--ui-control-font-s/m/l` を参照する。`(pointer: coarse)` では共通コントロールの押下高を42pxへ広げる。上表の値を変更する場合は `main.css` のtokenを変更し、実画面で右Workspace幅とタッチ到達性を確認する。

## Segment の階層と状態

- Primary は右Workspace上端の `.right-workspace-mode-switch > .right-workspace-mode-segment`。表示・寸法・選択投影は `layer-panel-surface.css` と `right-workspace-frame.js` が所有する。Transformの編集状態そのものは所有しない。
- Secondary は `.gui-segmented.gui-segmented--secondary > .gui-control.gui-control--m`。BASIC/WARP と POINT/BRUSH に使用する。
- Compact は `.gui-segmented.gui-segmented--compact > .gui-control.gui-control--s`。MOVE/INFLATE/PINCH のように、右Workspace内の短い行へ3項目を置く場合に限る。

選択面は `--ui-segment-selected-secondary`、選択中hoverは `--ui-segment-selected-hover`、非選択hoverは `--ui-control-surface-hover` が正本。選択中にhoverしてもcream面へ戻さない。`focus-visible` は選択色と独立した `--active-border` の輪郭で示す。押している瞬間の `:active` は軽い位置変化だけで、選択を意味しない。無効時は実際の操作可否に合わせて native `disabled` または正しい `aria-disabled` を使用し、見た目だけで可否を偽らない。

既存のBASIC/WARPは tablist の `aria-selected` と `.active`、POINT/BRUSHとブラシ種類はtoggle group の `aria-pressed` と `.is-selected` を投影する。役割に応じたARIA属性を維持し、共通CSSは両方を同じ選択表現に解決する。ARIA値をCSSだけで変更しない。

## 色、glass、Pointer

明るいcream面の文字は `--futaba-maroon` / `--text-secondary`、濃い選択面の文字は `--futaba-background` を使用する。`--futaba-light-maroon` はsecondary選択面の基調、`--futaba-medium` は補助境界やrangeの進行部に使う。glassは背景面に `--ui-control-backdrop` を適用し、文字・アイコンを親 `opacity` や `filter: blur()` で薄くしない。

`.right-workspace-frame > .layer-panel-context-inspector` と空のInspector面は `pointer-events: none`。対象カード、各操作行、実ボタン、rangeは `pointer-events: auto` でUI入力を所有する。透明なWorkspace空白ではCanvasの描画入力を維持する。操作部品のために全幅・全高の不可視hit面を追加しない。

## 再利用と禁止事項

```html
<div class="gui-segmented gui-segmented--secondary" role="tablist">
  <button class="gui-control gui-control--m" role="tab" aria-selected="true">BASIC</button>
  <button class="gui-control gui-control--m" role="tab" aria-selected="false">WARP</button>
</div>
```

この例は見た目とARIAの対応だけを示す。実際のTransform切替は既存の `data-transform-mode` と handler に従う。各画面でカプセルの選択/hover/focus色を複製しない。`button` / `input` / `select` 全体への上書き、独自の保存状態、主スイッチと内部segmentの同じ視覚重量化を避ける。rangeの値、刻み、History境界はCSSでは決めない。

## GUI変更時のBrowser受入

同一viewportで、primaryとsecondaryの階層、選択/非選択それぞれのhoverとfocus-visible、disabledの可否、coarse pointer時の押下域、狭い右列での文字欠け・横スクロールを確認する。BASIC/WARPとPOINT/BRUSHを切り替え、WARP詳細の内部スクロールと単色円形thumbを確認する。作品を各glass面の背後に置き、透過と文字の可読性を同時に見る。透明なWorkspace空白では描け、操作部品上では誤描画しないことをHistoryと画面で確認する。V/Esc、KEY、確定/取消の意味はそれぞれ既存terminalで確認し、到達できない状態は未確認と報告する。
