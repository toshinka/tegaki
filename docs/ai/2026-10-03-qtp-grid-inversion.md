# QTP grid / inversion evidence

## 最新Owner修正（2026-10-03、画像2点による指示）

追加の角丸指示: Secondary下地は既定で四隅8px、Primaryのfirst-child active時は左上のみ0、last-child active時は右上のみ0にする。CSS :hasで表示中のactive位置を参照、JS / stacking / popup境界は変更なし。Browserでpen=左上0/右上8、eraser=8/8、select=8/0、下側は全状態8/8を確認。追加後build / tool-slots / preset-density / diff check PASS。

開始HEAD `db0ab24929ecdd074112773d651630d8110ef4df`、開始worktree clean。
前Cardの反転active / 1px縦重なり指定は、今回のOwner指示により更新した。
製品変更はcomponent CSSのみ。対応する既存preset-density verifierも新契約へ更新。

- 3行目もPrimary / Secondaryと同じ6等分・gap・外端へ変更。padding / borderによるgrid内側のずれを撤去。
- 2・3行目のactiveは淡い下地（medium 20% + background）/ MAROON foreground / ORANGE border。反転はPrimaryだけ。hover中もactive keylineを保持。
- Primaryの負のbottom marginを0にして2行目へのはみ出しを撤去。既存z-index / popup所有は変更なし、overflow clippingも追加なし。
- preset cellを最低36px高にし、全スロットでサイズ / 透明度%を表示。active / inactiveのリング寸法・文字寸法を統一。
- 蛇の目は同じ寸法、border-box、flex-shrink無しの内円に統一して中心を固定。
- Third shelf下地はmedium 24% + background。Secondaryは既存medium 36% + background。ふたば同系色の段階差でThirdを淡く、以前の14%より明瞭にした。
- SVG / JS / brush挙動 / tooltip / aria identity / 保存metadataは変更なし。

Browser実操作: ペンThird slot 6選択、エアブラシstrong選択、TEXT展開を確認。
3段の中心は26 / 47 / 68 / 89 / 110 / 131 CSS px、Primary対Thirdは全6列delta 0、実在Secondaryもdelta 0。
Secondary第6列は空だがcomputed gridは6列。蛇の目内外中心差は全6スロットX/Yとも0。
Primary bottom / Secondary topとも297.777771 CSS px、重なり0。
Third全6スロットのopacity表示はblock、penで100 / 100 / 100 / 90 / 80 / 72%。active切替後も同じ寸法。
active Secondary / ThirdはMAROON文字 / 淡い下地 / ORANGE borderで、hover中も同じ。Primaryのみlight文字 / dark surface。
TEXT展開後の入力・フォント・SIZE・CANCEL・RASTERIZEをBrowserで確認（作品への確定はしない）。
build / 関連7 verifier PASS。Owner実機受入・coarse pointer実機は未実施、commit / pushは未実施。

## 以下は前Card時点の証拠

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
