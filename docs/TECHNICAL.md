# Tegaki — 技術契約

<!-- Document relocated from TEGAKI.md on 2026-09-06. -->

状態: CURRENT。更新日: 2026-09-05。
製品思想は[PRODUCT](PRODUCT.md)、現行所有/実装経路は[ARCHITECTURE](ARCHITECTURE.md)、作業状態は[STATUS](STATUS.md)。
この文書は維持する契約。既知の違反や未実装は[AUDIT](AUDIT.md)へ記録し、実装済みと偽らない。

## 基盤

- JavaScript ESM / Vite / PixiJS 8.19.0。依存versionの実値はpackage/lockが正本。
- 主対象は現行Chromium系desktop＋液晶タブレット。本番描画はPixi RenderTextureへのlive raster bake。
- rendererの現在の標準はWebGL。WebGPU既定化、SDF/MSDF/WebGPU brushの本番導入は別の明示Gateが必要。
- DPR/resolutionは1、内部作業サイズと出力寸法を一致させる。暗黙の2倍化をしない。
- Canvas2Dを本番strokeへ混入しない。既存CPU compositor/export/reference用途との違いを守る。
- 消しゴムは`erase`による透明化。背景色で塗り戻さない。
- 描画座標の意味をclient/canvas/world/localで明示する。描画変換へPixiのtoLocal/toGlobalを持ち込まない。現コードの重複計算整理は入力契約を固定してから行う。

## Layer / CAF / 保存正本

- 通常LayerはLayerSystem。アニメはTimelineModel / ClipAsset / ClipInstance / DrawingSnapshot。
- working Layerは選択CAFを描画engineへ接続するadapterであり、保存正本でも全Frame共通Layerでもない。
- UIは共通renderer＋別data adapter。通常LayerとCAFのHistory復元先を混同しない。
- Backgroundは特殊な不透明Layer。通常Layer結合/消去対象、Lane、Clipにしない。
- View CameraとProject Frameと時間変化を分離する。表示flip/panを保存画像へ焼かない。
- Frame/CAF切替だけでHistoryをresetしない。Project全体loadのclearとは別。
- Raster履歴は変更対象の前後snapshot/patch。無関係なCAF全体を毎stroke複製しない。
- runtime selection、GPU buffer、評価頂点、scan cacheをProjectへ保存しない。

## Transform / Motion / WARP / Rig

- SOURCE変形はpreviewと確定を分離し、確定で一度だけRaster bake。既定Container transformへ戻す。
- ANIMATEはSOURCE bakeを経由せず、ClipInstanceの対象KEYへ確定する。
- CAF全体MotionはtransformKeyframes、個別Raster MotionはlayerTransformTracks。対象を混同しない。
- WARPはroot deformer / folderDeformers / layerDeformersの既存所有とBind/Pose/placementを維持する。
- static RigはClipAsset.rigDefinition、時間PoseはClipInstance.rigMotion。
- Raster Skinのstatic Mesh/weightはClipAsset.meshDefinitions/skinBindings。同じtopology/Pose/weightを別objectへ重複保存しない。
- CPU/Pixi/preview/Bake/exportは共有evaluatorとplanを参照し、固定入力で一致を検証する。
- 重複effect/clipping/RenderIsland制約を無言fallbackで隠さない。旧fallbackの変更はreason別に監査する。
- 明示生成したMeshをRaster更新だけで自動再生成しない。STALE表示と明示再生成で手動修正を守る。

## History / Project

- command契約は`{ name, do, undo, byteSize?, meta? }`。件数/メモリ上限と線形Undo順を保つ。
- SOURCE/CAF/ANIMATEでmutation正本とterminalを明示。入場/選択だけでKEYやHistoryを増やさない。
- 保存時encodeとruntime/History TypedArrayを分離し、旧Projectの読込互換を維持する。
- load失敗、拒否、cancelで不関連データを黙って削除/修復しない。
- class階層、全モデル統合、汎用command busの新設を目的にしない。具体的な契約不一致から判断する。

## UI / CSS

Canvas-firstとFutaba文化を維持する。palette/semantic tokenは`tegaki_work/styles/main.css`。

```text
--futaba-maroon: #800000
--futaba-light-maroon: #9c3835
--futaba-medium: #b8706b
--futaba-light-medium: #d4a8a0
--futaba-cream: #f0e0d6
--futaba-background: #ffffee
--active-border: #ff8c42
```

- icon/文字/背景へ黒・白・neutral grayを安易に使わない。browser既定色への落下も避ける。
- active/currentは橙が第一候補。Setup青、成功緑、警告/破壊赤は意味を限定した共通semantic tokenを使う。
- SVG fill/stroke、Unicode、hover/focus/disabled、input/selectまで確認する。
- 既存CSS変数、共通button/form/scrollbarを検索し、近似色や専用scrollbarを重複定義しない。
- 静的装飾はCSS、動的な座標/寸法/custom propertyはJS。popupはmount先/stacking contextも確認する。
- Lucide/既存UI_ICONSを優先し、適合iconがなければ同じ線幅・端部・viewBoxのSVGを創作してよい。出典/創作を区別し、意味と全stateのpaletteを確認する。
- [Style Guide](../開発用資料保管庫/proposals/UI_CSSスタイルガイド.md)は現行の運用規約。過去比較案の配置は採用済みと仮定しない。

## 安全な変更

- 大幅削除/class再構成/DOM置換は明示された計画範囲で行う。局所修正へ混ぜない。
- EventBusは同名送受信/payloadを確認し、listener無し等を実検索で証明してから削除する。
- window互換登録を新設しない。既存削減は依存確認と局所移行を伴う。
- 調査ログは削除またはTEGAKI_CONFIG.debug配下。成果のためにログを常時出さない。
- Backup/PastFiles/別projectとOwner差分を保護する。build失敗は最初の原因へ絞る。
- `dist/`等の生成差分を残さない。既存差分を一括restoreせず、自分の生成物だけ扱う。

技術契約を変える場合は、理由、互換影響、代替、移行/検証を[ROADMAPの重大判断点](ROADMAP.md#human-decisions)へ整理する。
