# QTP grid / inversion evidence

2026-10-03。Owner添付Cardの限定CSS修正。開始 `main / 3e0052fe3b34bc16d86ef3b37bd4b00e28c65f39`、worktree clean。
技術・Browser確認済み（以下の範囲）/ Owner受入待ち、未commit・未push。

## 変更

製品変更は `styles/components/quick-access-popup.css` のみ。
Primary / Secondaryは共通外幅・6等分track・共通gap。Secondary member / overflowを `width: 100%; min-width: 0` にして各trackへ一致させた（coarse規則も同様）。
Secondary / Third activeは共通変数でMAROON surface / ORANGE keyline / CREAM foreground。Third内のring / dot / 数値にも適用。
Primaryの別配色、透明border、Secondary外枠0、既存縦重なり1pxを維持。focus outlineは内向きへ。

削除した旧規則:

```css
.qa-sub-button--icon[data-tone="strong"] {
    color: var(--futaba-background);
    background: var(--futaba-maroon);
    border-color: var(--futaba-maroon);
}
.qa-sub-button--icon[data-tone="strong"].active {
    outline: 2px solid var(--active-border);
    outline-offset: 1px;
}
```

softのopacity差はinactiveに限定。JS、tone metadata、tooltip / aria identity、brush behavior、SVGは変更なし。SVG redesignは延期。Project / History / renderer / 保存正本は変更なし。

## Browser計測

localhost:5173の新規検証タブでCSS hot reload後に計測。Ownerの既存タブは操作していない。
Primary外端 / Secondary外端ともleft **16.5** / right **140.5** CSS px。
Secondary track端はcomputed grid tracksから導出、実在memberのborder-boxも一致。

| 列 | Primary left / right | Secondary left / right | 左 / 右delta |
|---|---|---|---|
| 1 | 16.5 / 35.5 | 16.5 / 35.5 | 0 / 0 |
| 2 | 37.5 / 56.5 | 37.5 / 56.5 | 0 / 0 |
| 3 | 58.5 / 77.5 | 58.5 / 77.5 | 0 / 0 |
| 4 | 79.5 / 98.5 | 79.5 / 98.5 | 0 / 0 |
| 5 | 100.5 / 119.5 | 100.5 / 119.5 | 0 / 0 |
| 6 | 121.5 / 140.5 | 121.5 / 140.5 | 0 / 0 |

Primary activeを1列目（ペン）/6列目（選択）へ切替えて寸法不変。activeはmaroon-family surface / light foreground / transform none。
Primary bottom 167.7778 / Secondary top 166.7778で縦重なり1px。製品の接続・外観もscreenshot目視。

エアブラシnormal（標準）→strong（くっきり）→soft（ふんわり溜め）→normalを実click。
各状態で全列delta 0。inactiveの全toneはtransparent surface / maroon foreground、strongの暗色tileなし。
全toneのactiveはbackground `rgb(128, 0, 0)` / border `rgb(255, 140, 66)` / foreground `rgb(240, 224, 214)`。解除後は非反転へ復帰。
Secondary activeのoutline none / transform none。Third activeも同じ3色をcomputed styleで確認。

## 補足・未検証

標準Secondaryはペン5件 / エアブラシ3件 / 選択2件で、実製品の第6member activeは未実施。
製品main.css / component CSSを直接読み込む一時6セルfixtureでP1/S1→P6/S6を実click。
fixture列端53–72 / 74–93 / 95–114 / 116–135 / 137–156 / 158–177、全列左右delta 0、active切替で不変。
active S6のoutline none / transform none、border-box内orange border。fixtureは削除済み。
この証拠は製品CSSジオメトリであり、第6memberの実製品選択経路の受入とは区別する。
keyboard focus-visibleの実操作はtoolのkey操作で完了できずUNVERIFIED（CSSのoffsetは-2px）。
coarse pointer実機、液タブ、Owner受入は未実施。

## 検証

production build PASS。harness check PASS。
`verify-tool-slots` / `verify-qtp-static-style-boundary` / `verify-qtp-shell-closeout` / `verify-qtp-attention-hierarchy` / `verify-qtp-preset-density` / `verify-qtp-progressive-density` / `verify-qtp-text-entry-layout` PASS。
JS変更なし。static verifier、Browser、fixture、Owner受入を混同しない。
