# Phase 9h — Sidebar Rail Attention Hierarchy / Active Surface Gate

作成日: 2026-08-24

状態: CLOSED — Gate 0=`GO — B: Quiet Resting＋Hover Surface＋Active Ring`、SOL final review=`A`

## 1. 目的

左Sidebar rail一componentだけで、休止中の常設枠をCanvasより低い水位へ下げ、hover / keyboard focus / active / disabledをsurfaceまたは輪郭で読み分けられる状態へ整理した。tool構成、icon、shortcut、popup内部skin、Canvas input、保存正本は変更していない。

## 2. Stage A inventory

### DOM / role

- `ui/dom-builder.js`の順序は`Album → Import → Export → Resize → Q → V → Animation → Settings`。
- `Q / V`だけが現行`button + aria-pressed`であり、他6入口はclick delegation対象の`div`である。
- Album / Import / Export / Resizeはcommand / utility、Qは一時popup、Vは一時mode、Animation / Settingsはpanel launcherであり、同じpersistent state契約ではない。

### state正本

- Q: `popup:shown / popup:hidden` → `.is-active + aria-pressed`。
- V: keyboard / selection transform event → `.is-active + aria-pressed`。
- Animation: `updateToolUI('gif-animation')` → `.active`。
- Settingsとutility: persistent active projectionなし。
- Animation Table内部×は`AnimationTablePopup.hide()`を直接呼び、Sidebar tool syncを通らないため、閉じてもAの`.active`が残る既存差を再現した。

### 寸法 / appearance

- rail controlはnormal 30×30px、`pointer: coarse` 38×38px。
- Phase 9h前は全controlが常時visible borderを持ち、hover / activeのstatic styleが`main.css`と`ui-panels.js`注入styleに重複していた。

## 3. Gate 0

固定fixture `build/phase9h-sidebar-rail-attention-hierarchy-fixture.html`で次を比較した。

- A Current: hit areaは明確だがutilityを含む全cellの常設枠がCanvasより先に見える。
- B Quiet Resting＋Hover Surface＋Active Ring: transparent layout borderでhit / 寸法を維持し、restingをrailへ沈め、hover / focus / activeだけ面と輪郭を戻せる。
- C Color Bar Only: 明るいCanvas edgeでactive位置とfocus / hit surfaceが弱くなるため`HOLD`。

判定は`GO — B`。

## 4. 実装

- `styles/components/sidebar-rail.css`を追加し、Sidebar static appearanceの正本とした。
- restingは`--ui-border-subtle / --ui-surface-control`、hoverは`--ui-border-hover / --ui-surface-control-hover`、activeは`--ui-border-active / --ui-surface-control-active / --ui-shadow-control-active`、disabledは`--ui-opacity-disabled`を使う。
- keyboard `:focus-visible`は2px橙outlineを維持し、activeと同時の時はactive surfaceを優先する。
- `main.css`にはrail geometry、30 / 38px hit token、icon寸法を残し、重複するstatic state ruleを除去した。
- `ui-panels.js`の`setupPanelStyles()`と`!important`注入だけを除去した。DOM、ID、event、shortcut、popup state mutationは変更していない。
- `index.html`でsemantic token正本の`main.css`後にcomponent stylesheetを読む。
- `build/verify-sidebar-rail-attention-hierarchy.mjs`でGate、load順、state selector、DOM順、30 / 38px hit、runtime注入除去を固定した。

## 5. 検証

- `node --check ui/ui-panels.js`: PASS。
- `build/verify-*.mjs`: 全107件PASS。
- `npm.cmd run build`: PASS。Viteの既知chunk-size warningのみ。
- Browser 1280×720 / 700×720: restingの低い水位、Q / V active surface、Q再click・V Escape解除、Animation open、Settings open / close、30px hit、Canvas edgeを確認。
- coarse 38pxはfixed fixtureとtoken verifierで確認。実pen / touchはOwner台帳へ送る。
- Browser console error: 0件。

## 6. 分離した既知差

- Animation Table内部×でAの`.active`が残る。
- Settings / Album / Resize / Export等は現行generic elementで、keyboard focusやpanel open stateのARIA projectionを持たない。
- これらはPhase 9hのCSS問題ではなく、command / toggle / mode / launcherのroleとclose syncを決めるbehavior / accessibility Gateである。No-goのpanel同期再設計へ広げず、Phase 9iを新設した。

## 7. Owner確認

制作環境でのCanvas contrast、OS表示倍率、mouse / pen / touch、hover / focus / active / disabled、normal 30px / coarse 38px hitは`OWNER_VERIFICATION_BACKLOG.md`へ分離した。未確認はPhase未完了を意味しない。

