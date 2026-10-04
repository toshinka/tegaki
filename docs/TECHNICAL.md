# Tegaki — 技術契約

<!-- Document relocated from TEGAKI.md on 2026-09-06. -->

状態: CURRENT。更新日: 2026-09-05。
製品思想は[PRODUCT](PRODUCT.md)、現行所有/実装経路は[ARCHITECTURE](ARCHITECTURE.md)、作業状態は[STATUS](STATUS.md)。
この文書は維持する契約。既知の違反や未実装は[AUDIT](AUDIT.md)へ記録し、実装済みと偽らない。

## 基盤

- JavaScript ESM / Vite / PixiJS 8.22.0。依存versionの実値はpackage/lockが正本。
- 主対象は現行Chromium系desktop＋液晶タブレット。本番描画はPixi RenderTextureへのlive raster bake。
- rendererの現在の標準はWebGL。WebGPU既定化、SDF/MSDF/WebGPU brushの本番導入は別の明示Gateが必要。
- 作品側の読み出し・History・保存・書き出しは`resolution: 1`で、内部作業サイズと出力寸法を一致させる。画面rendererのみ`displayDevicePixelRatio`で高DPR表示をopt-in可能（既定OFF、上限2x）。暗黙に作品データを2倍化しない。
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
- 漫画の独立文字は通常Rasterにoptional `lettering`（version/正規化params/画素fingerprint）を持つ。画素と再編集情報を一回のHistoryで復元し、手描き・外部変形後の更新は拒否する。font実体やoutline cacheを保存しない。再編集previewは表示だけを切替え、出力/合成採取は確定画素を使う。契約は[WP-025](work/WP-025-editable-manga-lettering.md)。
- 文字別指定は唯一の本文に対するUTF-16 grapheme境界の疎な範囲属性。3点サイズと第二フチは同じversion-1 paramsのoptional属性で、欠損時の旧描画を保持する。外線→内線→fillの全文字passをSVG/CPU/previewへ共通反映。詳細は[WP-028](work/WP-028-lettering-character-editing.md)。
- Reference / Preview Viewer（資料 / プレビュー）は閲覧専用の補助機能。資料画像はブラウザ内ローカル（IndexedDB）に永続化され、動的プレビューはruntime-only。Project保存、Layer生成、History、Export、Emergency Recoveryへ一切関与しない。Previewタブは既存WebGLレンダラーから有界解像度（最長辺1024px以下）でサンプリングし、第2レンダラーや第2レイヤーツリーを新設しない。大容量参照画像は2048px/4MP以下へ縮小プロキシ化し、元の巨大デコードバッファを保持しない。クリップボード（Ctrl+V）はViewerフォーカス時のみ参照画像追加として扱い、Canvas側の貼り付け権限を横取りしない。

## Transform / Motion / WARP / Rig

RIG刷新の進め方（Owner承認、2026-10-03）: 旧系は既存作品用の経路として隔離し、新しい土台で制作動線を作る。新系の初期検証は編集/保存/再読込/出力の接点に絞り、旧・旧々RIGとの全機能一致、自動移植、GUI内部コードの維持を必須にしない。既存Project/History/出力の所有は以下の現行契約のまま。新しい保存schemaやproduction切替は個別の確定Cardで扱う。WP-020は停止済み、[WP-026](work/WP-026-rive-authoring-browser-proof.md)の独立proofを経て現在は[WP-029](work/WP-029-rive-editor-first-path.md)の試作入口とRaster受渡し。外部authoringのsource/runtimeをProjectへ保存せず、明示的な1x PNG受渡しだけを既存新Raster追加APIで一Historyにする。外部sceneを製品renderer/保存正本へ昇格させない。漫画文字との並行write境界は[DEVELOPMENT](DEVELOPMENT.md#漫画文字とrig-proofの並行導線)。

- SOURCE変形はpreviewと確定を分離し、確定で一度だけRaster bake。既定Container transformへ戻す。
- SOURCE Layer Transform中のプレビュー切り出し（V+M Rescue）は、変形プレビューからProject Canvas内の選択矩形だけを新規Raster Layerへ切り出す可逆操作。巨大中間テクスチャの確保を禁止し、切り出し矩形サイズのみを単一Canvas2Dでサンプリングして新規レイヤーを生成、元レイヤーはベースラインへロールバックする。容量上限（16MP/8192px）による確定拒絶時もVセッションを破棄せず保持し、Mキー切り出しへ誘導する。
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
