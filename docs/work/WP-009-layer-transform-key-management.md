# WP-009 — Layer Transform KEY management

状態: ACTIVE — TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING（2026-09-09）。WP-005 Simple WARPのOwner受入状態は変更しない。

## Owner acceptance closure evidence — actual bundle / pending guard (2026-09-09)

- Chrome production `152.0.7977.83`、viewport `908×548`、DPR `2.0249998569488525`、console errors/warnings `0`で、非対称Rasterの`BASIC + WARP` marker、component rows、WARP trash、Timelineを確認した。
- Stable bundleの通常CAF clip D&DはF1→F3でWARP shape、BASIC envelope、filled marker、component rowをdestinationへ保持し、UndoでF1、RedoでF3へ戻った。
- Layer Transform KEY markerのpending D&Dは`先にKEYを確定または取消してください`で拒否し、History/modelを変更しなかった。marker guardのmodel/panel/D&D verifierもPASS。通常CAF clip block D&Dは別のclip move経路のため、KEY marker pending guardの証拠とは分離している。
- WARP component delete→normal bounds、Undo→BASIC+WARP、Redo→WARP-only/削除のBrowser確認は前段fixtureから継承し、今回のalpha調整はKEY authority・schema・History semanticsを変更していない。Owner ACCEPTED判定は行わない。

## Goal

既存の`layerTransformTracks`（BASIC）と`layerDeformers`（WARP）から導出する同一Clip・internal Layer・local FrameのKEY bundleを、Animation Tableでは一単位で移動し、Layer Transform panelではcomponent単位で削除できるようにする。Timeline markerはBASIC-onlyをoutline square、WARPを含むbundleをfilled squareで表示し、アクセシビリティ文言にもcomponentを含める。

## Scope

- Layer Transform panelのKEY strip直下へ、現在Frameに存在するBASIC/WARPだけのcomponent rowsを表示する。
- component削除は既存Timeline Historyへ一操作一件で記録し、pending candidate中は拒否する。
- Timeline markerのclickは既存Frame選択を維持し、threshold超過のdragだけがBASIC/WARP bundleを空きFrameへ原子的に移動する。
- 小さなmodel-adjacent pure helperとproduction verifierを追加する。
- MOTION、Folder自身の新保存正本、Project schema、CPU/Pixi renderer、WP-008機能は対象外。

## Contract

- 新しい`clip.layerTransformBundles` / `transformBundleKeys`は作らない。bundleは既存component presenceから都度導出する。
- KEY stripはpendingを`F# · KEY確定`として最優先し、安定状態ではBASIC/WARPいずれかがあれば`KEY設定済`とする。上部context chipはmode-localのまま維持する。
- BASIC/WARPのcomponent削除は正確なlocalFrame keyだけを除去する。空track/deformerは既存normalizer shapeに従って整理し、他component・pivot・topology・Frameは変更しない。
- pending中の削除とD&Dは暗黙confirm/cancelをせず、model/Historyを変更しない。stable session中は既存History refresh/rebindを通せる場合だけ削除を適用し、Timeline D&Dは安全側でactive sessionを拒否する。
- Timeline D&Dはsourceの`clipId`、`internalLayerId`、`sourceLocalFrame`を固定し、destinationにBASIC/WARPのいずれかがあれば拒否する。same-frame、範囲外、cancel/outside dropはHistory/model 0。valid moveはBASIC/WARPを一つのHistory entryで移動し、playheadは変更しない。
- marker descriptorは`{hasBasic, hasWarp}`から導出し、将来MOTIONを追加できる条件分岐にする。markerの`aria-label`/`title`は`BASIC`、`WARP`、`BASIC + WARP`を明示する。

## Tasks

1. `clip-layer-key-bundle.js`へinspect/remove/moveのpure helperを追加する。
2. Layer Transform panelへcomponent projection、trash action、pending disabled表示を接続する。
3. selected internal Raster Timeline markerをbundle squareへ置き換え、click/threshold D&Dを既存Timeline event delegationへ接続する。
4. model/panel/D&D verifierを追加し、既存Transform/WARP/Animation/UI/Project回帰を確認する。
5. BrowserではBASIC-only、BASIC+WARP、delete Undo/Redo、empty move、collision、pending拒否、pen thresholdを最小確認し、Owner受入とは分離して記録する。

## Acceptance

- BASIC-only markerはoutline square、WARP-only/BASIC+WARPはfilled squareで、文言が一致する。
- BASIC/WARP各rowの削除はHistory +1、最後のcomponentでmarker/panelが消え、Undo/Redoでrows/strip/canvas/overlayが戻る。
- bundle D&Dは空destinationだけへexact keyを移し、BASIC+WARPでもHistory 1、collision/cancel/same/out-of-rangeは0。
- KEY confirm buttonは作成/更新専用で、削除toggleにならない。既存WP-003 cross-frame continuationを壊さない。

## Verification

```powershell
node tegaki_work/build/verify-layer-transform-key-bundle-model.mjs
node tegaki_work/build/verify-layer-transform-key-component-panel.mjs
node tegaki_work/build/verify-layer-transform-key-bundle-dnd.mjs
node tegaki_work/build/development-harness.mjs check
node tegaki_work/build/development-harness.mjs test transform
node tegaki_work/build/development-harness.mjs test warp
node tegaki_work/build/development-harness.mjs test animation
node tegaki_work/build/development-harness.mjs test ui
node tegaki_work/build/development-harness.mjs test project
```

変更JS/MJSの`node --check`、Vite production build、`git diff --check`を行い、生成dist差分を残さない。Browser/Pixi画素とOwner操作感は別判定とする。

## Stop

destination collisionのmerge/overwrite/swap、stable sessionの安全なrebindがproduction evidenceなしで必要になった場合、またはatomic Historyを既存snapshot authorityで表せない場合は実装を広げずGPT判断へ戻す。新schema、Folder/MOTION、renderer変更へ展開しない。

## Completion

- `clip-layer-key-bundle.js`へ保存schemaを増やさないinspect/remove/move pure helperを追加し、BASIC-only、WARP-only、BASIC+WARP、collision、same/out-of-rangeを固定した。
- `Layer Transform` panelはbundle summary直下に存在componentだけを表示し、`F5のBASIC/WARP KEYを削除`のARIA label、pending disabled、stable deleteのHistory +1とUndo/Redo refresh境界をproduction method verifierで固定した。
- selected internal Raster TimelineはBASIC-only outline / WARP-present filledのbundle square markerへ接続し、click選択、threshold D&D、空destinationへのatomic move、active/pending拒否を固定した。valid BASIC+WARP moveは一つのHistory entryで、playheadを変更しない。
- verifierはmodel PASS、panel/delete PASS、D&D PASS。既存回帰はtransform 16/16、warp 26/26、animation 34/34、ui 45/45、project 9/9。全harnessは167 selected / 0 failed、`verify-github-url-index`は54 unique local targets、harness check、変更JS/MJS `node --check`、Vite production build、`git diff --check`もPASS。生成dist差分は残していない。
- 実Browser（localhost:5173、CUA viewport 908×548）では、F6 `BASIC + WARP` filled marker、marker clickによるF5選択、component rowsとARIA label、V終了後のF6→F5 bundle D&D（History表示 5→6、playheadはF1のまま）、V active中の安全側拒否を確認した。再構成したF6 fixtureではBASIC削除後にWARP-only marker / `F6のWARP KEYを削除` / History `1/500`、UndoでBASIC+WARP、RedoでWARP-only、最後のUndoでBASIC+WARPへ戻ることを確認した。console/DPRの独立計測、Pixi/CPU画素一致、Owner制作受入は別判定で未完了。
- WP-005の`ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`、WP-003 continuation、WP-007 terminal、既存renderer/schema契約は変更しない。
