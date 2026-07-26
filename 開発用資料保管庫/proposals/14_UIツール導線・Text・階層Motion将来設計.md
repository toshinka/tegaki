# UIツール導線・Text・階層Motion将来設計

更新日: 2026-07-22

## 位置づけ

- 本書は未実装proposalであり、Phase 6cのWARP mask・brush・preview / Bake一致へ機能を混ぜない。
- 変形選択、左sidebar / Quick Tool Panel再編、Text、CAF内部階層Motionは、UIが近くても保存正本と検証範囲が異なるため別Sliceで進める。
- 既存のRaster、ClipAsset / DrawingSnapshot、ClipInstance Motion / WARP、Layer Transform、Historyを置換せず、それぞれの正本へ接続する。

## 1. 変形control pointの範囲選択

### 操作案

- WARP / 将来Meshの`SELECT`入口はLucide `square-dashed`を主iconとする。選択shapeは`M`で`RECTANGLE -> CIRCLE -> POLYLINE`を巡回する。
- `CIRCLE`は`circle-dashed`、折れ線／多角形範囲は`trending-down`を候補iconとする。Polylineはclickで頂点追加、Enterまたは始点clickで閉じ、Escapeでcancelする。
- 現行WARPでは`M`がBRUSH mode巡回に使われているため、shortcutはactive tool内で解決する。`SELECT`中のMはshape巡回、`BRUSH`中のMはMOVE / INFLATE / PINCH / SMOOTH巡回とし、通常描画やPixel Selectionへ漏らさない。
- rectangle / circle / polylineはcontrol pointのmulti-selectと一時weightを作るUIであり、WARPのeffect mask、Bind bounds、topology、Raster選択範囲にはしない。
- 選択shape、選択中point、soft weightはruntime UI stateとし、Project正本へ保存しない。確定gestureだけを既存`deformer.keyframes`のposeへ1 Historyで書く。

### icon path候補

```html
<!-- square-dashed -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/></svg>

<!-- circle-dashed -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/></svg>

<!-- trending-down -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></svg>
```

## 2. 左sidebarとQuick Tool Panelの再編

- pen / eraser / airbrush / fill / selection等、Quick Tool Panel内と重複する常設iconを最終的にsidebarから外し、`Q`表記の単一buttonをQuick Tool Panel開閉入口にする。
- ただし一括削除は行わない。先にQ button、Q shortcut、現在tool表示、keyboard help、touch時の再表示導線を追加し、QTPが未初期化・画面外・閉状態でもtoolを失わないことを確認してから重複iconを段階削除する。
- Layer Transformは独立した破壊的Raster確定操作なので、QTP内の描画toolへ埋めず、sidebarへ専用iconを置く候補とする。既存V shortcut、panel、transform正本をそのまま呼び、新しいtransform stateを持たせない。
- Text入口は下記Text Phaseの初期実装ではQTP候補とする。使用頻度とpen導線を実測し、常設T iconが必要な場合だけsidebarへ昇格する。

## 3. PC優先Text

### 段階案

1. 最初はTextを指定fontでRaster Layerへ確定する`Text to Raster`とし、Project / PSD / export / Historyが現在のRaster契約だけで完結する入口を作る。
2. 再編集可能Text Layerは別Phaseとする。`content / font identity / size / alignment / line spacing / transform`のschema、font欠損fallback、Project round-trip、PSD互換を先に決める。
3. Text Layerを導入する場合もCanvas表示・export用raster cacheは派生物とし、文字列とstyleの二重正本を作らない。

### local font境界

- Web appから`C:\Windows\Fonts`をpath走査する実装にはしない。desktop Chromiumで利用できる場合は、明示clickと権限許可を伴う`window.queryLocalFonts()`でfamily / fullName / PostScript名を列挙する。
- API非対応、権限拒否、mobileではbundled font / generic familyとfont file明示importへfallbackする。font file bytesは容量とlicenseの問題があるためProjectへ既定埋め込みしない。
- local fontの存在を保存の前提にせず、Raster確定結果は再open時にも同じpixelを保つ。編集可能Text Layerでは使用font名とfallback状態を明示する。
- 参考: [Local Font Access API draft](https://wicg.github.io/local-font-access/)、[Chrome for Developers: Local Font Access](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts)

## 4. CAF内部Folderの階層Motion

### 正本境界

- CAF内部Folderへ`TimelineModel`を再帰的に持たせる「mini CAF」は採用しない。再生範囲、Frame、History、export評価器が階層ごとに分裂するためである。
- 共有素材である`ClipAsset`側には、動かせる内部Folder / partのID、親子関係、rest transform等のrig定義だけを置く。
- 各配置である`ClipInstance`側には、内部part ID別のtransform keyを置く。同じClipAssetを複数Laneへ配置しても、各ClipInstanceの演技を独立させる。
- CAF内部Folderの通常opacity / blend / clipping / z-order正本は維持する。Motion親子順と表示順を同一視しない。

### UI案

- Animation TableのLaneは親CAF行を開閉し、選択Clipの内部Motion partだけを子行として投影する。子行は新しいCAFや独立Laneではなく、同じClipInstance内trackの編集UIとする。
- 通常Folderへ`Motion part`属性を明示付与する方式を第一候補とし、別種類のFolderを増やさない。属性を外してもRaster階層は失わず、Motion trackの保持／削除を確認する。
- 親Folder Motionは子・孫の評価済みtransformへ継承する。循環禁止DAG、親欠損時、channel別inherit、anchor / rest poseを明示し、暗黙にLane縦順へ依存しない。

### 導入順

1. 1 CAF内の親Folder -> 子Folderのposition / scale / rotation継承だけをpreview / playback / Bake / exportで一致させる。
2. 子行の開閉、選択、key、Undo / Redo、Project / CAF copyを接続する。
3. 明示constraintと少数Boneを追加し、BoneからWARP / Mesh control pointへのweightを別gateで扱う。
4. gravity / spring等のphysicsは決定的parameter trackとして評価し、確定時にkeyへBakeできるようにする。
5. 親子間の表示階層変更はMotion transformと分離し、既存Folder D&D・clipping・上側前面契約を壊さない独立操作として監査する。

## 5. Phase順と受入gate

1. Phase 6cのWARP brush感触、B / N保持drag、pointercancel、preview / playback / Bake / export一致を閉じる。
2. Phase 6d候補のSetup / Lens placementと境界判定を閉じる。
3. UI導線PhaseでQTP開閉、sidebar段階縮小、Layer Transform入口を行う。
4. Deformer SELECT Phaseで3 shapeとM context shortcutを追加する。
5. Text to RasterをPC-firstで追加し、local font permission / fallbackを検証する。
6. 階層Motionは親子transformだけを独立Phase化し、Bone / weight / physicsを同時実装しない。
