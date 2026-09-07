# Tegaki — 再開checkpoint

状態: WP-001 / WP-002 / WP-003 / WP-004 / WP-006 / WP-007 DONE（Owner操作感は未確認）。WP-005 ACTIVE — TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING。
更新日: 2026-09-08。現在の作業baseline HEAD: `9d1002d5fba94edc887a3a6e6dcafe1ea11d0eb1`。WP-004の監査・HD-005判断とWP-007の限定runtime guardを完了し、WP-005 Simple 4x4 WARP UIの技術完了とOwner受入境界を記録する。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

WP-005のSimple 4x4 WARP UIは既存Layer Transform transactionへの技術接続を完了した。normal/CAF SOURCEはRaster bake、CAF ANIMATEは`ClipInstance.layerDeformers`を維持し、CPU compositor / SOURCE bake / Export / Project canonical dataをpixel authority、Pixiを同じ評価modelを使うinteractive GPU proxyとする。WP-007の未確定Layer Transform Export guardとHD-005 `MIXED`は維持し、Owner受入までpackage statusはACTIVEとする。

## COMPLETED

- 前回の文書/正本/語彙/ロードマップ/5 WPを継承。読む順序・対象scope・local link・harness依存を再レビューし、再構成上の阻害事項なし。
- [WP-001](work/WP-001-history-failure.md) DONE。実HistoryManagerで修正前のindex二重減算を再現（actual=-1 / expected=0）。
- redoのdo成功後だけindexを進める局所修正。実行失敗はindex不変、実行成功後の通知失敗は適用済みindexを保持、finallyでisApplying解除。
- 新規verifierは初回/中間/末尾、連続例外、以前のUndo、再試行、通知例外、部分mutationの限界を確認。
- History関連5/5、全verifier148/148、構文確認、Vite build成功。出力は専用Temp、dist変更なし。
- read-only agentの呼び出し側/Raster Patch/最終diffレビューを主担当が統合。コード変更は主担当だけが実施。
- WP-001製品差分はhistory.jsのredo内のみ。
- [WP-002](work/WP-002-effect-guards.md) DONE。モデルの共有Asset/Folder配下preflight、Motion/Rig/Mesh/clippingの指定追加順、既存WARP解除を補修。
- Owner許可でMotion bridge開始/previewの対象検査を追加し、model setter迂回を封鎖。UI構造/操作は不変。
- 修正前WARP→Rigの誤成功を基準commitの実modelで再現。修正後の拒否deep-equal、無関係target保持、解除、model往復・隔離caller/History試験が成功。
- 最終全149 verifier・構文・Vite build成功。製品変更はanimation-data-model.jsと限定popup検査、build出力はTemp、dist不変。

## CURRENT STATE

WP-001は非UI・同期例外経路を実production classで検証して完了。Browser/Owner実操作は今回未実施であり、受入済みとは記録しない。
WP-002は指定経路の技術完了。Browser実操作・実Pixi・本番History callback全体は未確認で、全機能受入とはしない。
WP-003はDONE。拒否時terminal、自動保存延期、Undo/Redo再同期の隔離回帰がpass。通常RasterのF1/F2継続、周期跨ぎ、History 1/0、Project保存往復をBrowser確認済み。描画直後の初回SOURCE Vも通常Recovery延期へ含め、Browserで維持を確認。Owner操作感の受入は未確認。WP-006もDONE。Folder自身のMotion schema、現行subtree評価、Folder専用V bridge、History/Undo/Redo、保存metadataと双方向effect排他を実装した。BrowserでTable展開後の2子Raster同時preview、KEY、次Frame継続を確認。CPU/export実画素とOwner受入は未確認。WP-004は監査DONE、WP-007は技術DONE、WP-005はSimple 4x4 WARP UIの技術作業を完了し、Ownerの実画面・実download・操作感受入が残る。旧9qはPAUSED。
WP-005は、関連verifier・harness・構文・Vite buildをPASS。normal SOURCEの実Browserで4x4/16点表示、点drag、Esc取消、V確定、Undo/Redo、変更中のBASIC切替拒否を確認した。CAF ANIMATEでは、bridge preview後の共有overlay消失を修正し、2Frameの`READY→drag→KEYED`、V確定、History +1、次Frame移動を確認した。今回のterminal sliceでは、CAF ANIMATEの元KEYなし／元KEYありを対象に、pending WARP→通常Table close→overlay消失、History据え置き、元KEY保持またはKEY未設定への復帰をBrowserで確認した。close前後のcaller順序は既存production `hide()`をverifierで固定した。pointer端末はproduction controller/overlayのBrowser DOM診断で、normal SOURCE／CAF ANIMATEのpointercancel・capture lossがgesture単位でrollbackし、pointerup後のlate lossが結果を保持することを確認した。IAB実UIのconsole errorは0件。trusted OS pointercancel、Owner操作感は未受入として残るが、Pixi/CPU/export画素・save/reopen・非4x4/排他対象の技術証拠は完了し、WP-005は`TECHNICALLY COMPLETE` / `ACTIVE`を維持する。
WP-005のFinal technical evidence sliceはlive baseline `86803e1de0d649648c079b44e20389dc868981fd`から、隔離16x16非対称RasterのChrome診断（Chrome 152 / viewport `680x561` / DPR `2.25` / console errors 0）まで完走した。normal SOURCEのCPU preview/bake/exportは`0x17a134da`で一致し、Project save/reopenはPixi upload後のproduction canonical Raster `0x191a3ed6`とreload後Exportまで一致した（CPU入力`0x7de6acda`との差は半透明RGBの8bit premultiplied-alpha量子化）。CAF SOURCEはDrawingSnapshot/PNG/save-reopenが`0x17a134da`で一致。CAF ANIMATEはCPU/Export/save-reopen/F1→F2→F1が一致し、4x4/16点/target/frameのlayerDeformersも保持したが、Pixiは`0x63f4c1ac`で9px差（最大channel 102）。Layer WARP + MotionはCPU/Export `0x8525007f`、Pixi `0xf73d350c`で9px差（bboxの1px差を含む）。GPU MeshとCPU rasterizerの境界差を固定証拠として記録し、許容誤差やrenderer/schema変更は行わない。production入口guard verifierはnon-4x4/RIG/Mesh/Skin/clipping owner+sourceを全件明示拒否、effect/model mutation 0、History 0、session noneでPASS。よってこのsliceは`PARTIAL / GPT review required`で、WP-005はACTIVEのまま。Actual App UI、Owner受入、trusted device pointercancelは未確認。WP-007はproduction JS未変更のため`NOT RERUN — no relevant production change`を継承する。

### WP-005 Pixi / CPU WARP parity root-cause slice (2026-09-07)

- baseline HEADは`0c93561eda44f1ebba9f2e882d916c305e1de8ab`。既存差分を保持し、production JSは変更していない。`build/wp005-pixi-cpu-parity-diagnostic.html`だけを追加した。
- 固定16x16非対称fixtureをChrome 152（viewport `680x561`、DPR `2.25`、console errors `0`）で実行した。CPU authorityは`warpRgbaWithControlMesh` / `TimelineFrameCompositor`、Pixi側はproduction `AnimationTablePopup._renderInternalLayerPreviewGroup` / `_createDeformerPreviewNode`である。
- NO WARPはopaqueがCPU/Pixiとも`0x74a8cbf3`で完全一致。alphaは1px、最大差2（`[177,17,36,121]`対`[179,19,36,121]`）だけで、既存の8bit premultiplied-alpha upload canonicalization（`EXPECTED GPU CANONICALIZATION`）として扱う。IDENTITY WARPもopaqueは完全一致し、alpha差はNO WARPと同一で追加差なし。
- INTEGER WARPはopaque CPU `0xc01acf0b` / Pixi `0x0cc4933f`、10px差・最大255。alpha CPU `0x42f427ae` / Pixi `0xe9338617`、10px差・最大255。SUBPIXEL WARPはopaque CPU `0x17a134da` / Pixi `0x63f4c1ac`、9px差・最大102。alpha CPU `0x7f8ca105` / Pixi `0xdd315d85`、9px差・最大232。各差は最初のpixelから全て`triangle interior`（integer 10/10、subpixel 9/9）で、external boundary / internal shared edgeへの集中ではない。
- 最初のdeformed divergenceはINTEGER `(x=1,y=1)`、CPU `[180,18,37,194]`、Pixi `[180,20,35,195]`、triangle `1` indices `[0,5,4]`、UV `[(0,0),(0.333333,0.333333),(0,0.333333)]`、CPU barycentric `[0.71875,0.236842,0.044408]`、source coordinate `(1.263158,1.5)`。SUBPIXELは同pixelでCPU `[177,17,36,121]` / Pixi `[179,19,36,121]`、source `(0.974026,1.5)`。
- CPU/Pixiのindices・vertex ordering・18 triangle topology（16 vertices）は一致し、`triangulationMatch=true`。実Texture stateは`scaleMode=linear`、`antialias=false`、`wrapMode=clamp-to-edge`、`resolution=1`、`alphaMode=premultiply-alpha-on-upload`、source 18x18（1px padded）である。UV 0、±0.5 texelの診断候補を比較したが、offset 0がidentity mappingを保持し、INTEGER/SUBPIXELとも候補中最小差だった。production UV変更で一致する証拠はない。
- WARP + Layer Motion代表はCPU `0x8525007f` / Pixi `0xf73d350c`、9px差・最大196、diff bboxは`{x:3,y:2,width:9,height:9}`。WARP-only差が残るためMotion行列の修正へ展開していない。
- 分類は`G (C + A)`。`C`はCPUの明示premultiplied bilinear + byte rounding / CPU triangle bakeとPixi GPU linear Mesh sampling・source-overの実装差、`A`はNO WARP alphaのupload canonicalizationである。UV half-texel、topology mismatch、edge coverage単独の根拠は得られなかった。許容誤差・production UV/renderer/schema変更は行っていない。WP-005は`ACTIVE / GPT review required`で停止する。

### WP-005 Preview Parity Convergence Gate (2026-09-07)

- baseline HEADは`061d9e93f6a3aecc9b55d148ed177190dfa67aef`。既存差分を保持し、production runtimeは変更していない。`build/wp005-preview-convergence-diagnostic.html`を追加した。
- Motion-onlyを同じ16x16 fixtureで実行した。integer opaqueはCPU `0xf8d32585` / Pixi `0x4df056b3`、3px差・最大255、CPU bbox `{x:4,y:4,width:13,height:11}` / Pixi bbox `{x:3,y:2,width:14,height:13}`。integer alphaはCPU `0x2f2030ea` / Pixi `0x06e245ab`、3px差・最大255。同じくsubpixel opaqueはCPU `0x27ec05e7` / Pixi `0xfd6c1212`、23px差・最大255、subpixel alphaはCPU `0x4e2ee189` / Pixi `0x86950156`、23px差・最大255。Motion-onlyも差があるため判定は`M1`である。
- WARP-onlyのCPU finalは`0x17a134da`。current Mesh Pixiは`0x63f4c1ac`、9px差・最大102。CPU WARP surfaceをSprite化したprototypeは`0xe6d751d6`、7px差・最大102で、bbox/nonTransparentはCPUと一致し、残差は半透明RGBのupload canonicalization相当だった。
- WARP + MotionのCPU finalは`0x8525007f`。current Pixiは`0xf73d350c`、9px差・最大196。P1（CPU WARP surface → Pixi Motion）は`0xc90ee9b6`、7px差・最大196でMesh差は縮むがbbox差が残った。P2（CPU compositorでWARP + Motionまでfinal surface → Pixi Sprite）は`0x734812cb`、4px差・最大102。P2はCPUとbbox/nonTransparentが一致し、代表差 `[181,20,34,207]`対`[180,20,34,207]`のようにalpha同値のRGB差で、geometry差ではなくupload canonicalizationとして分離できた。
- 性能は正式閾値を設けず実測だけ記録した。warmup 3回後30サンプル、CPU render / Canvas ImageData / Texture.from descriptor / Pixi render / total（ms）は、344x135が`13.4/15.4/17.7`、`0.2/0.4/0.5`、`0/0.1/0.2`、`0.3/0.5/0.5`、`14.1/16.1/18.4`（median/p95/max）。512x512は`76.5/81.7/89.9`、`0.6/0.8/2.3`、`0.1/0.1/0.2`、`0.3/0.4/0.5`、`77.4/83.2/92.7`。1024x1024は`284.4/294.8/306.4`、`1.5/3.6/6.0`、`0.1/0.1/0.1`、`0.3/0.5/0.5`、`286.5/299.9/310.5`。Texture.fromはdescriptor計測で、実GPU uploadはrenderer.render時に発生する。
- 512x512の30更新dragはtotal median/p95/max `73.0/83.8/85.0ms`、CPU `72.1/82.6/83.3ms`、Pixi render `0.2/0.4/0.4ms`。tracked Texture/RenderTexture balanceはともに`0`、console errors `0`、JS heapは`77,513,690→60,574,826` bytes（delta `-16,938,864`）で増加しなかった。GCや正式frame-time閾値は判定していない。
- 最終分類は`P-B`（Motion-onlyも差があるためWARP MeshとMotion GPU sampling双方に共通するpreview差。P2 full CPU-reference surfaceでgeometryは収束）で、性能面は512以上で明確に重いため`P-D risk`を併記する。CPU-reference方式をproductionへ導入せず、Pixi Mesh削除・許容誤差policy・schema変更は行っていない。この差は2026-09-08のPreview Equivalence Policyでpreview implementation differenceとして分類し、WP-005のtechnical blockerから外す。WP-005は`TECHNICALLY COMPLETE / OWNER ACCEPTANCE PENDING`で停止する。

### WP-005 Technical Closure — Preview Equivalence Policy (2026-09-08)

- **Pixel authority:** CPU compositor、SOURCE bake、Export、Project canonical data。CPU / Bake / Export / save-reopenのcanonical pixel resultを一致させる。
- **Interactive preview:** Pixi GPU proxy。同じevaluated model、target/frame、control points、topology、bind bounds、Layer WARP / Motion sample、transform matrix、effect evaluation order、visibility、opacity/blend authorityを使う。GPU/CPU rasterizer、filtering、premultiplied-alpha由来のbyte差はpreview implementation differenceとして分類する。
- **Policy:** 数値epsilon、最大差、差pixel数などの固定許容閾値は導入しない。pointermove中の連続CPU final renderも採用せず、現行Pixi GPU proxyを維持する。preview pixelを保存正本にしない。
- **Technical status:** Simple 4x4、normal/CAF SOURCE、CAF ANIMATE、排他zero-mutation拒否、History `1/0`、Timeline marker、pointer terminal、Table close rollback、Project save/reopen、CPU/export consistencyを技術PASSとして扱う。WP-005は`TECHNICALLY COMPLETE`、package statusは`ACTIVE`、Owner受入はPENDING。
- **Owner checklist:** normal SOURCE（WARP/16点drag/V/Undo/Redo/Esc）、CAF SOURCE（drag/V/close-reopen）、CAF ANIMATE（READY/drag/KEYED/V/F2/F1/Table close）、pending WARPのExport block→VまたはEsc→成功、production UIからPNGを最低1回download、preview fidelity確認。
- **Trusted input:** synthetic DOM pointercancelはPASSだがtrusted device由来は`NOT VERIFIED`。Owner受入時に確認できる場合だけ補完し、technical completionは戻さない。
- **Production:** runtime JS、保存schema、History契約、Pixi Meshは変更していない。今回の作業後はsession境界抽出・別WP・renderer/schema変更へ進まず、GPT reviewとOwner acceptanceで停止する。
WP-004 Slice 1〜3で、Layer Motionだけのunsupported planがCPU compositorで拒否されず描画まで進むF-003をproduction consumer＋fake Canvasで確定し、`none/ready`だけを通す限定修正を適用した。実BrowserのHTMLCanvas/PNGでready Layer/Folder Motionのhash・bbox一致とunsupportedの描画前拒否、Selection/SOURCE/CAF SOURCE/ANIMATEのfixture terminal差を確認し、HD-005をMIXEDで確定した。WP-007ではExportManager共通guard、Export toolbar/popup preflight、zero-mutation verifier、Browser Canvas診断を追加した。
WP-007は`pending-layer-transform`でSOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE FolderのExport・Preview・Sequence・Blob入口を明示停止する。Chrome 152のCanvas診断はviewport 1280x720、DPR 2.25、consoleErrors 0でPASS。隔離実UIではSOURCEのblock→V/Esc→Preview、ANIMATE Layerのblock→V→Preview、通常Folder SOURCEのblock→V→Previewを確認し、FolderのAnimation Context target表示まで確認したがFolder自身ANIMATE VとCAF SOURCE UIは未受入として残す。
全体監査は[AUDIT](AUDIT.md)、正本配置は[登録簿](DOCUMENT_REGISTER.md)、仕様/将来の順序は[ROADMAP](ROADMAP.md)。

## IMPORTANT DECISIONS

- Owner指示によりWP-002まで順次実施。保存正本、Layer/CAF境界、History command形式、byte/count制限は変更しない。
- indexの修復とcommand内のatomic rollbackを区別する。通知失敗で成功済みcommandを未適用扱いにしない。
- GITHUB.txtは案内。正本はAGENTS / docs / 対象WP / 現行コード。旧Phaseや外部レビュー文を直接実装契約にしない。
- 自前Markdownはdocs、root AGENTSはAI入口。既存構造の段階抽出は提案であり、大規模移行や保存schema変更は未承認。
- HD-005はMIXED。Selectionは既存auto commitを維持し、SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderは未確定Layer TransformをExport前に明示停止する。Project Saveは変更しない。
- WP-007のblockはsession、model、History、frame、selection、preview candidateを変更せず、V確定またはEscキャンセル後の再試行を要求する。Preview一時samplingは採用しない。

## OPEN QUESTIONS

- WP-001範囲内の既知残存なし。範囲外: do途中mutationのrollback、push失敗前のredo枝破棄、composite補償/byteSize、非同期History。
- WP-002の指定登録/解除経路は修正済み。別件F-007: 並べ替え/reparentでclipping sourceが変化し競合する可能性は未修正・全経路未再現。
- WP-003: toolbar残留、自動保存によるV終了、Undo/Redo後のprojection不一致を補修。forced/manual saveは現行terminalを維持。詳細・検証結果はカード。
- Owner補足の「描画直後だけSOURCE Vが閉じる」は、描画後に予約された通常RecoveryがSOURCE sessionを延期しない経路と一致。activeなSOURCE/Timeline双方を延期する追補を適用し、forced/manual保存は維持。
- WP-004: CPU拒否抜けは限定修正済み。実Browser/Canvasのready Layer/Folder Motionとunsupported拒否、save/export terminal差を監査し、HD-005をMIXEDで確定してDONE。
- WP-007: manager/UI共通guard、zero-mutation verifier、Canvas/PNG、sequence/download境界、SOURCEとANIMATE Layerの隔離実UIを確認して技術DONE。CAF SOURCE UI、Folder自身V UI、Owner操作感は未受入。
- Animation Contextの右Layer PanelでCAF `clip-layer-mirror` rowを選択できない症状は、Owner実確認で解消済み。WP-004では追加調査・追加修正を行わない。
- 全solver/codec/長時間pen/全GPU/全Archiveの全面再調査は行わない。必要な対象だけ限定追加する。

## HUMAN DECISION NEEDED

OwnerはFolder自身のKEYを選択。個別Raster KEY展開や暗黙Rig登録をせず、[WP-006](work/WP-006-folder-transform-key.md)の`folderTransformTracks`として実装済み。

HD-005はLead決定済み（MIXED）で、[WP-007](work/WP-007-export-terminal-guard.md)へ実装した。残るのはOwnerの制作操作感受入のみ。

[HD-001〜004](ROADMAP.md#human-decisions): 大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE。
既存不具合の限定補修を妨げないが、未採用案を実装契約へ昇格しない。今回これらの結論は変更していない。

## NEXT

1. GPT reviewとOwner受入待ち。今回固定したPixi/CPU Mesh差とnormal SOURCEのCPU入力→Pixi canonical量子化差はPreview Equivalence Policyへ分類済みで、renderer変更・比較基準の数値epsilon・後続WPへは広げない。
2. trusted device由来のpointercancelは別途実操作が必要ならOwner受入時に補完する。今回のsynthetic DOM PASSをtrusted PASSへ昇格しない。
3. Owner受入（normal/CAF SOURCE/ANIMATE、Export操作感、実download）を技術passと分けて実施する。編集session境界抽出、Layer Panel、F-007、HD-001〜004、広範囲の再監査へ展開しない。

## RISKS / BLOCKERS

- commandの一部mutation後throwは画像/モデルが部分変更のまま残り得る。本WPのindex修正はそれを巻き戻さない。
- 既存verifier＋WP-007限定Verifier、Canvas診断、Vite buildは実機/Owner制作受入の代用ではない。buildの既存util externalization/大きなchunk警告は継続。
- WP-005 Final evidenceのPixi/CPU差は、半透明境界のWebGL Mesh samplingとCPU triangle rasterizerの差（9px、最大channel 102/196）として固定した。normal SOURCEのraw CPU bakeとProject reloadの差はPixi 8bit premultiplied-alpha量子化で、save/reopenのproduction canonical同士は一致する。Preview Equivalence Policyにより数値許容誤差・renderer/schema変更は導入せず、technical blockerから外した。
- mainの未push変更はWeb AIから不可視。Ownerがpush/対象SHAを指定する。公開先との一致は今回確認していない。
- Backup/PastFiles/別project、Owner差分、依存packageは対象外。
