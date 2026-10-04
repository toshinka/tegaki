# WP-025 — 漫画の再編集文字と曲線・少点変形

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerが2026-10-04に仮設計の方向で作成を指示。[検証記録](../ai/2026-10-04-editable-lettering-result.md)。最終制作受入とpushはOwner。

## Goal

漫画に「文字」tabを新設し、タイトル/擬音/独立文字を選択fontで配置、線上point/grid/snapと少点変形で整え、確定後も元情報から再編集する。既存通常Rasterにoptional `lettering`を保存し、画素の表示/保存/出力正本は維持。QTP文字入力は新tabへ移す。

## Scope

- Geometry worker WRITE: `tegaki_work/system/editable-curve-geometry.js`, `tegaki_work/system/lettering-model.js`, `tegaki_work/build/verify-editable-lettering-geometry.mjs`のみ。
- Raster worker WRITE: `tegaki_work/system/lettering-vector-renderer.js`, `tegaki_work/system/lettering-font-engine.js`, `tegaki_work/package.json`, `tegaki_work/package-lock.json`, `tegaki_work/licenses/harfbuzzjs.txt`のみ。HarfBuzz依存の固定導入とnotice。font-libraryはread-onlyで既存loaded entry.dataを利用する。
- UI worker WRITE: `tegaki_work/ui/lettering-popup.js`, `tegaki_work/ui/lettering-overlay.js`, `tegaki_work/styles/components/lettering-popup.css`のみ。独自controller/host部品、既存font tree/比較を利用。
- Lead WRITE: PopupManager/tab登録、Project save/loadのoptional文字field、QTP文字UI撤去と関係verifier、styles import、必要時keyboardの局所guard、integration verifier、docs。上記worker fileは完了後の統合修正のみ。
- Lead限定追加: `system/lettering-layer-adapter.js`, `system/lettering-fingerprint.js`、`system/layer-system.js`の`createRasterLayerFromSnapshot`だけ。optional recipeをHistory通知前に検証/添付し、失敗時は既存作成rollback経路で戻す。従来callは変更なし。
- 既存WP-023/024差分を保持。同一file並列writeなし。workerは他者の変更を巻き戻さない。
- 2026-10-04 Owner承認の並行導線: 独立RIGのWP-026は専用proof/cacheだけを所有する。文字側の幾何/保存/出力fileをRIG側から変更しない。共通WARPやLayer/Project/History/Export接点へ範囲を広げる前にwrite ownerと統合順を照合。共通文書の更新も直列。運用は[DEVELOPMENT](../DEVELOPMENT.md#漫画文字とrig-proofの並行導線)、exact製品範囲は本Card。
- Leadの表示統合: `system/lettering-preview-display.js`で再編集時だけ元spriteを表示から外す。layerData/texture/visibility/Historyを変更しない。既存`ExportManager.renderToCanvas`と`LayerSystem.createCompositeDrawingSnapshot`はcapture時に元spriteを一時復帰しfinallyでpreviewへ戻す。元画素の出力を維持、cancel/hide/destroyで必ず復帰。正式なrenderer/save authorityは増設しない。

## Contract

実装時に確定した補足: imported字体は`previewOnly:true`でSVG/pathsとboundsだけを返し、画素生成は適用/更新時に行う。`envelopeBounds`はサイズ勾配/配置線の後・envelopeの前、`localBounds`は最終変形後。UI guideは前者を使う。preview jobは32msごとに最新入力へまとめ、世代の異なる結果を破棄する。

Leadの限定接続に`ui/ui-panels.js`の既存漫画popup維持リスト/sidebar状態と、個人font不要の実engine verifier `build/verify-editable-lettering-render.mjs`を含む。TECHNICAL/ARCHITECTUREには本契約と入口を記載。

`lettering`は `{version:1, params, fingerprint}`。`params`はsanitizeされた次の値。UI選択/hover/mode/cache/font bytesは保存しない。

```js
{
  text: 'タイトル', fontKind: 'imported', fontId: '', fontFamily: 'sans-serif',
  fontSize: 64, endFontSize: null, bold: false, vertical: false,
  tracking: 0, lineHeight: 1.25, color: '#800000', strokeColor: '#ffffee', strokeWidth: 0,
  placement: {x: 200, y: 200, rotation: 0, scaleX: 1, scaleY: 1},
  baseline: {kind:'none', path:{closed:false,nodes:[]}},
  envelope: {kind:'none', amount:0, points:null}
}
```

- baseline kinds: `none/straight/wave/ellipse/polyline/free`。path nodesは `{id,x,y,in:{x,y},out:{x,y},smooth}`、in/outはnode相対offset。local作品px。stable node ID、closed対応。追加はBezier splitで保形、削除は近似を許しUndo可能。
- envelope kinds: `none/skew/perspective/arc/wave/bulge/taper/points`。pointsは正規化3×3の9点（row-major）。純計算の独自map、4隅と詳細9点。点数と評価細分密度を分離する。既存Anime WARP 16点形式には接続しない。
- Geometry exports: `createCurvePreset(kind,width=240,height=80)`, `curveSegments(path)`, `evaluateCubic(segment,t)`, `splitCurveAt(path,segmentIndex,t)`, `moveCurveNode(path,id,point)`, `deleteCurveNode(path,id)`, `curveLengthTable(path,tolerance=0.5)`, `curvePointAtDistance(table,distance)`, `nearestCurvePoint(path,point)`, `snapEditorPoint(point,{grid=0,candidates=[],threshold=6}={})`, `mapEnvelopePoint(point,bounds,envelope)`, `letteringLocalToWorld(point,placement)`, `letteringWorldToLocal(point,placement)`。pure、入力を変更しない。curve tableは`.length`と、distance評価のpoint/tangent。nearestはsegmentIndex/t/point/distance。splitはpathを返す。
- Model exports: `defaultLetteringParams(canvas={width:400,height:400})`, `normalizeLetteringParams(input,canvas)`, `sanitizeLetteringData(raw,canvas)`。normalizeはparams、sanitizeは正しいversion/shapeでなければnull。text最大2000/32行、fontSize8–512、有限座標/point数最大64、invalid enumは既定、保存値にfunction/typed geometry無し。
- Font engine exports: `shapeLettering(params,{fontLibrary}={})` async → `{ok:true,glyphs:[{path, x,y,advance,cluster}], width,height, engine}` | `{ok:false,reason}`。glyph.pathはlocal作品pxのSVG d（位置x/yを既に含むかはrendererと内部で統一）。text/shaping cache有界、font load/parseは共有。fontKind importedは既存ensureLoaded(id).dataから実体、systemは明示browser経路（曲線/warp不可の場合は理由表示して拒否、無言別font置換なし）。HarfBuzz currentAPIは採用配布物と合わせる。
- Vector renderer exports: `renderLettering(params,{fontLibrary}={})` async → `{ok:true,width,height,pixels,rasterBounds,svg,url?,localBounds, paths?, engine}` | `{ok:false,reason}`。rasterBoundsは文書座標、最終1x画素、placement込み。SVG previewと確定は同じ評価。glyph outline→baseline上でcluster配置→envelope→placement。holes/fill rule維持、stroke/変形bounds欠け無し。最大16MP/8192px、空文字拒否。drag中は未変形outline cacheから評価する。
- UI `LetteringPopup({layerSystem,history,eventBus,...})`はpopup protocol show/hide/toggle/isReady/destroy、`apply/update/loadFromActiveLayer/newSession`。Raster commitはlead提供のadapterを constructor `layerAdapter`で注入しUI fileへProject/History実装を重複しない。adapter `apply(params)` / `update(layerId,params)` / `loadActive()`→ `{ok,params?,layerId?,reason?}`。
- 通常Canvas専用。CAFは理由付き拒否。編集中の複数toolのCanvas入力は現在のvisible漫画popupのみ。SVG handleが操作を受け、全Canvasを透明elementで横取りしない。

## Tasks

文字全体/配置線/変形mode、配置/回転/拡縮、font wheelジョグ＋見本比較、縦横、字間/縁取り、曲線preset/点追加移動/角なめらか削除、grid/点整列snap、少点warp/preset、12→20勾配。詳細接線UI/free mesh/汎用Vector Layer/Anime接続は対象外。

preview jobは世代管理でstale結果を採用せず、apply/updateは最新paramsをflushし失敗時は変更0。pixel fingerprintとboundsをmetadataに保持し再編集update前に現snapshotと比較。手描き/外部変更後の不一致は更新拒否し、新Layer作成を案内、元画素を守る。font不足でも保存済画素表示/出力は維持。

適用/更新は画素とmetadataの一回のglobal History。session内Undoは別の現在地を明示し、cancelは未確定変更のみ戻す。QTPの旧入力は新経路確認後に撤去、旧文字の画素を変更しない。

## Acceptance

- タイトル、波のゴゴゴ、楕円見出しを作成。点追加で形不変、点移動/角/削除、閉線、camera zoom/rotation/flip下のhit/grid/snap。
- 実fontの日本語横/縦、結合濁点/約物/小かな、穴とstroke、12/20pxと大文字。フォント取得cold/warmとdragは分けて計測。未対応字形/engine/formatを隠さない。
- 確定→元文字/書体/曲線修正→更新→Undo/Redoで画素と情報一致。実Project export/loadで再編集。旧Project/font不在/手描き後拒否/解析失敗時変更0。
- Node syntax、pure幾何/normalizeのbehavior verifier、実engine font fixture、関連font/balloon/QTP/shortcut/保存verifier、harness/build。実Chromiumで操作とCanvas画素、narrow viewportも確認。
- worker報告だけでcloseしない。Browser未確認/Owner未受入は別欄。commit/push無し。

## Verification

`node tegaki_work/build/development-harness.mjs check`、`test editable-lettering`、font/balloon/QTP/shortcut/Project関連verifier、`npm run build`。実Chromiumは`build/wp025-lettering-browser.html`で実LayerSystem/History/ProjectManager往復と実font、製品画面でpoint/whole/warp/cancel/wheel/比較を操作。静的と実BrowserとOwner制作受入を分けて記録する。

## Completion

全Acceptanceの実証と関連検証をleadが確認してtechnical completeへ。Owner制作受入・pushは別に残す。

## Stop

通常Raster/History/export authority変更、別Project/Backup探索、font公開、全scene graph/renderer刷新、Timeline接続、汎用Vector Layer、未決定global schema変更は行わない。approved optional lettering fieldを超える判断はleadへ返す。
