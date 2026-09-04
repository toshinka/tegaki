# Tegaki Drawing WARP Authority Gate

更新日: 2026-09-05  
状態: Gate 0 採用判断 — `GO — C: Raster Source Bake + CAF Layer Deformer`

## 1. 結論

Layer Transform `WARP`はactive Raster一枚を直接変形する第一入口にする。ただしUIを共通化しても、対象範囲と保存正本は次の四つへ分ける。

| 対象 | 編集context | 保存正本 | Gate 0判断 |
|---|---|---|---|
| normal Raster | SOURCE | 既存RenderTexture / Raster snapshot | 確定時に一度だけRaster bake。新しい非破壊Layer schemaは作らない |
| CAF internal Raster | SOURCE（Table閉鎖） | ClipAssetのDrawingSnapshot | working Layerはadapterのまま、確定時にCAF Raster History 1件でbake |
| CAF internal Raster | ANIMATE（Table表示） | `ClipInstance.layerDeformers`（新設） | active internal Raster ID一件だけを対象にする。root / Folder deformerへ流用しない |
| root Clip | ANIMATE | 既存`ClipInstance.deformer` | CAF全体WARPのまま維持。今回のLayer Transform Raster入口では編集しない |
| CAF internal Folder | ANIMATE | 既存`ClipInstance.folderDeformers` | Folder subtree WARPのまま維持。今回のLayer Transform Raster入口では編集しない |

採用理由は、normal Rasterへ永続edit stackを新設せず現在のLayer Transform SOURCE契約を守りながら、CAF内部Rasterの時間WARPだけを対象ID付きで表せるためである。

## 2. live code監査

| 領域 | 現在のauthority / consumer | 監査結果 |
|---|---|---|
| root WARP schema | `system/animation/clip-deformer.js`、`ClipInstance.deformer` | `warp-grid` / `control-mesh` dispatcherとFrame samplingが存在。対象はCAF全体 |
| Folder WARP schema | `ClipInstance.folderDeformers` | `{ folderLayerId, deformer }` collection、Asset境界validation、ID remap、samplingが存在。対象はFolder subtree |
| 保存 / 復元 | `animation-data-model.js`、`project-manager.js` | Clip serializeをProjectManagerが透過利用。Folder WARPだけ追加validationあり。個別Raster WARP fieldは存在しない |
| Timeline History | `animation-table-popup.js` | root / Folder WARPはTimeline stateをbefore / after captureし、pointer gesture単位で既存Historyへ記録 |
| CPU render / export / bake | `timeline-frame-compositor.js` | Folder subtree合成後のFolder WARP、続いてroot WARP、root Motion。CPU rasterizerがexport / bake共通経路 |
| Pixi preview | `animation-table-popup.js` | 同じdeformerとmesh dataから一時Meshを作る。preview DOM / Meshは保存正本ではない |
| Canvas overlay | `ui/warp-grid-overlay.js` | display-only SVG。座標変換と点表示だけを所有し、Project / Historyを所有しない |
| Layer Transform SOURCE | `layer-system.js`、`layer-transform.js` | previewは一時display transform、V終了でRasterへ一度bake、Escapeで復元。normal HistoryとCAF Raster History adapterが既に分離 |
| internal Layer Motion | `ClipInstance.layerTransformTracks`、`folder-part-render-plan.js` | active Raster ID単位の時間authorityが存在。RIG / Mesh / clipping重複は明示unsupported |

不足しているのは「CAF internal Raster ID一件を対象にし、既存deformer schemaをFrame samplingするcollection」だけである。root `deformer`を使うと兄弟Layerまで変形し、`folderDeformers`を使うとRaster一枚というWHATを表せない。

## 3. 新しいANIMATE authority

採用shape:

```js
layerDeformers: {
    version: 1,
    targets: [{
        internalLayerId,
        deformer // existing warp-grid | control-mesh schema
    }]
}
```

境界:

- `ClipInstance` optional fieldとし、対象がなければserializeから省略する。
- `internalLayerId`は同じClipAsset内のdrawable Rasterに限る。Folder / Background / missing IDを拒否する。
- 同一Layer IDの重複を拒否する。
- topology、bind points、pose keyは既存`normalizeClipDeformer()` / `sampleClipDeformer()`を再利用する。
- copy / paste / duplicateではinternal Layer ID mapを使う。
- internal Layer削除では対象をcascade除去する。subtree境界が変わるreparentは既存Rig / WARP gateと同様に事前検査する。
- duration変更、structured bake、Clip copy、Project round-trip、Timeline History capture / restoreへ同じfieldを通す。
- DrawingSnapshot、working Layer、Pixi Mesh、SVG overlayを保存正本にしない。

## 4. compositor順序

初期production順序を次で固定する。

```text
DrawingSnapshot
→ individual Layer WARP
→ individual Layer Motion affine
→ internal Layer / Folder composition
→ Folder WARP
→ Folder Part / Bone matrix
→ Folder opacity / blend
→ root Clip WARP
→ root Clip Motion
→ Lane composition
```

Layer WARPとLayer Motionは同じRasterで併用可能とし、WARPを先、affineを後にする。root / Folder WARPも対象範囲が別なので上記順序で併用できる。

初期Sliceでは次を理由付きで拒否する。

- target RasterがRIG Part / rigid bindingに所属する。
- target RasterがRaster Mesh / Skin対象である。
- target Rasterがinternal clippingのownerまたはsourceである。
- target Rasterを含むrender islandが既存validatorでinvalid / unsupportedである。

これらは無言の二重変形やmask座標の不一致を避ける安全境界であり、将来の合成順を永久に否定するものではない。

CPU rasterizerをexport / bakeの基準とし、Pixi previewは同じbind points、pose points、triangle順、boundsを消費する。PixiJS側は一時Meshをleaf表示proxyとして扱い、子を持つContainer authorityにはしない。

## 5. 入口比較

### A — WARP tabから既存WARP WORKSPACEへ転送

不採用。現Workspaceのtargetはroot ClipまたはFolderであり、active Raster一枚へ見える入口から対象範囲が切り替わる。Focus Lensではなくmode handoffになる。

### B — WARP WORKSPACE全機能をLayer Transformへ複製

不採用。Grid setup、brush、selection、lens、key navigationを二重に所有し、Transform panelの注意量も過大になる。

### C — direct Simple WARP + Advanced handoff

採用。

```text
active Rasterを選ぶ
→ V / Layer Transform
→ WARP
→ alpha内容へauto-fitしたSimple 4x4をCanvasで直接操作
→ 必要な時だけ「高度なWARP」
```

- Layer Transform `WARP`をprimary entryとする。
- 第一水位は既存4x4 topology、点drag、resetだけに絞る。
- density変更、Brush、multi-select、Bind frame、Lensはadvancedとし、既存WARP実装をshared controllerへ抽出してから接続する。
- 現行WARP WORKSPACEはroot / Folderの高度編集を当面維持する。Layer Transformからroot / Folderへ自動retargetしない。
- advanced handoffは同じtarget identityとdeformer authorityを渡せる段階まで無効または説明表示とし、第2の保存正本を作らない。

### D — 独立WARP tool / sidebar入口を新設

不採用。WHAT=Layer、HOW=Transformという純化から外れ、V / Transformと学習入口が競合する。

## 6. terminal grammar

| 操作 | SOURCE | ANIMATE |
|---|---|---|
| WARP tabへ入る | auto-fitしたruntime candidate。History 0 | current Frame sampleからruntime candidate。History 0 |
| 最初の点drag | Raster previewだけ更新 | active Rasterのcurrent Frame key候補だけ更新 |
| pointerup | gestureを閉じるがsessionは継続 | gestureを閉じるがTimeline Historyはまだ確定しない |
| pointercancel / capture喪失 | そのgesture開始値へ戻しsession継続 | 同左 |
| Vで閉じる | normalはRaster History 1、CAF SOURCEはCAF Raster History 1で一度bake | `layerDeformers`をTimeline History 1件で確定 |
| Escape | source pixels / boundsを復元、History 0 | baseline `layerDeformers`へrollback、History 0 |
| no-opで閉じる | bakeなし、History 0 | key作成なし、History 0 |
| Frame変更 / Table close | Table非表示SOURCEには該当しない | session全体をrollbackし、新Frame / close自体は維持 |
| save要求 | active sessionを既存Layer Transform terminalへ通してからserialize | 同左。画面だけのcandidateを保存しない |

BASIC / WARPのtab切替は、変更前なら自由に行える。どちらかで実変更後は初期Sliceでは暗黙commitせず、V確定またはEscape取消を要求する。複数authorityを一つの曖昧なHistoryへ束ねない。

## 7. Timeline表示

internal Layer行は、同じFrameにLayer MotionまたはLayer WARPのどちらかがあれば既存7px単色丸を一つだけ表示する。両方がある場合も蛇の目や重複図形にせず、tooltip / Transform contextで内容を列挙する。root WARP、Folder WARP、Part / Bone keyは既存別projectionを維持する。

## 8. 不採用案の再試行条件

- normal Rasterの非破壊WARP schema: 通常Layer全般のnon-destructive effect stack、保存、export、flatten、History、PSD境界をまとめて設計するPhaseが立った時だけ再比較する。
- root `ClipInstance.deformer`流用: 製品方針が「Layer WARPではなく常にCAF全体WARP」へ変わった時だけ再比較する。
- Folder WARP流用: active Raster選択をFolder subtree選択へ自動昇格する明示UXが採用された時だけ再比較する。
- full Transform内Workspace: shared WARP controller抽出後、Simple 4x4では制作上不足するというOwner実測が得られた時だけ再比較する。
- RIG / Mesh / clipping併用: CPU / Pixi / exportで同じ固定入力が一致し、座標系とmask適用順が一意になった時だけ安全Gateを開く。

## 9. production Slice順

1. **完了** — `layerDeformers` pure collection helper、validate / sample / remap / retime / bakeと固定入力verifier。
2. **完了** — ClipInstance / TimelineModel / Project round-trip、delete / copy / duplicate / structured bake / History captureを接続。
3. **完了** — individual Layer WARP render planとCPU compositorを接続し、Layer WARP / Layer Motion / Folder WARP / root WARP順と排他をverifier化。
4. **完了** — Pixi preview proxyとLayer Transform WARP transactionを接続。Layer WARP → Layer MotionとFolder内child plan / boundsをCPU順へ揃え、入場History 0、preview、confirm 1件、rollback 0件を固定した。
5. **次作業** — Simple 4x4 UI、solid marker、V / Escape / pointercancel / Frame変更 / Table close / save terminalをBrowser確認。
6. 必要ならshared controller抽出後にAdvanced handoffを接続。

各Sliceは順に行い、同じproduction fileを複数agentで並走編集しない。

## 10. Antigravity2の役割

Gate入力は本書で固定した。Antigravity2を使う場合は、production write担当ではなく次のread-only比較に限定する。

- Layer Transform `WARP`第一水位の視線誘導、初見理解、pen hit areaを評価する。
- Fresco、Callipeg Studio、CLIP STUDIO PAINT Simple Mode、ToonSquid 2、Procreate Dreams 2、Live2D、Spine、Adobe系動画toolとの操作文法差を列挙する。
- Simple 4x4からAdvancedへ降りる条件が早すぎる / 遅すぎる箇所を指摘する。
- authority、History、save、compositorの変更案は提案に留め、SOL / MAXがlive codeと照合して採否を決める。

Gate 1のpure helper実装はSOL / MAXが開始し、read-only UI比較はproduction fixtureまたは実画面ができた後に行う。
