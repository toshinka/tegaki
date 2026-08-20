# 制作Workspace・UI・外部Handoff構造ロードマップ

更新日: 2026-08-20
状態: Phase 8j Fixed-topology Skin Weight Brush完了。Phase 8kで既存vertex位置編集のTopology Gateを段階実装

## 1. 位置づけ

外部提案`Tegaki 次期構造再設計提案書 — 提出要旨`、`UI-UX再設計提案書`、`UI-UX・アニメーション基盤 再設計提案書`と、ClaudeReviewのUI / file構成 / PixiJS診断を現行コードへ照合した統合結果である。原案は`開発用資料保管庫/Archive/`へ保存し、本書だけを後続Phase選定の正本とする。

Tegakiの中心は描画、セルアニメーション、Rig / Mesh Setup、Motion制作とする。動画編集、音声、最終コンポジットを内製する前提にはせず、必要時は明示的なhandoff packageで外部toolへ渡す。

## 2. 採用する原則

- Canvas Firstとprogressive disclosureを維持し、通常描画時に高度なRig / Graph / export UIを常設しない。
- `Q` / `V` / `H`、Space + drag、header / Lane / Timeline gridのwheel三領域、半透明popup、既存Panel位置保存を互換契約とする。
- Setup青はstatic設定、橙はFrame作業 / 実行に限定する。一般buttonを意味なく青・橙へ塗り分けない。
- Rig Workspaceを開く場合も、保存正本は既存`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、Frame正本は既存`ClipInstance.rigMotion`とする。Workspace専用Rig、Mesh、selection、Historyを保存しない。
- 静止SetupとAnimationは同じSkin / deformer evaluatorを使う。preview / playback / onion / Bake / export用の別solverを作らない。
- `animation-table-popup.js`の全面分割は行わない。pure projection、overlay、gesture planの境界が固定したものだけを段階抽出する。

## 3. 第一候補 — Rig Workspaceの段階抽出

現行CLIP MOTIONのSetup青RIGを、Canvasを主面とする専用Workspace表示へ段階的に拡張する。ただし第一Stageは新画面を作ることではなく、次を実コードで監査するArchitecture Gateとする。

1. 既存RIG panel / Canvas overlay / Animation Table子行の読取・mutation・History入口を列挙する。
2. 現行popup内のtarget、Bone、Mesh、Skin、diagnosticのruntime stateを、保存正本を増やさずWorkspace shellへ投影できるか比較する。
3. Table dock、Inspector折りたたみ、popup維持の三案を1280px / narrow / pen・touch導線で比較する。
4. Workspaceを閉じても通常描画、CAF working Layer、selection、Panel位置、shortcut、wheelを変えない復帰契約を固定する。

最初からDOM全置換、主要class再構成、Animation Table常時dock、top-level MESH tab追加を行わない。

### 思考の水位と比較fixture

制作UIは機能数ではなく、現在の作業で理解すべき概念の深さを制御する。

1. 第一水位は通常描画とCanvas操作。Layer、brush、undo、pan / zoom以外の内部構造を常時要求しない。
2. 第二水位は目的選択。一枚絵を`全体PIVOT`で動かすか、`曲げBONE`で変形するかを明示する。
3. 第三水位は順序付きSetup。成功率を優先した基準導線`BONEを置く → AUTO GRID → Motion`を示し、未接続Motionから同じactionへ戻れるようにする。`AUTO SHAPE / AUTO LINE`は形状に適した高度generatorとして同じSetup内に残す。
4. WEIGHT / CORRECT、generator差、Bone group診断は制作上必要になった時だけ開く。最初の成功より前へ常設しない。

比較対象はCallipeg Studio、Adobe Fresco、CLIP STUDIO PAINT Simple Modeとする。CallipegのCanvas / timeline / pen ergonomics、FrescoのCanvas中心workspaceとtool配置、Simple ModeのCanvas面積とStudio Modeへの可逆切替を、外観模倣ではなく到達段数・占有面積・復帰契約のfixtureとして使う。

contrastはWCAG 2.2を基準資料とし、通常文字4.5:1、large text 3:1を最低監査線にする。非文字control境界、focus、active、disabledは別fixtureで測り、Setup青 / Motion橙だけに意味を依存させない。現行Stage BのSetup青CTAはBrowser computed colorで通常文字4.57:1を確認したが、Workspace全体の監査完了を意味しない。

公式資料:

- https://callipeg.com/learn-interface/
- https://callipeg.com/features/
- https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html
- https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm
- https://www.w3.org/TR/WCAG22/

### Stage Bで先行した既存導線修正

Workspace shell選定に依存しないため、一枚Rasterの`+RIG` / `+BONE`競合を先に是正した。LaneのRaster入口は非mutationの`RIG設定`、曲げ導線は`BONE追加 → AUTO GRID → Motion`、rigid方式は明示`全体PIVOT`とする。未接続Motionはkeyを拒否しつつ対象絵と同じAUTO GRID actionを見せる。接続後は選択Boneを保った`WEIGHT確認`で診断へ戻り、mixed stateは確認付きの明示切替だけで復旧する。未設定Root Rasterの仮targetをCanvas BONEとして見せず、自動初期BONEも作らない。保存schema、solver、History正本は増やさない。

### Phase 8d Gate選定、Phase 8e proof、Phase 8f Focus shell

Ownerの一枚Raster / 6 Bone / AUTO GRID 6×6 / Motion / WEIGHT初期制作確認と、Animation Table + floating CLIP MOTIONがCanvasを覆う固定fixtureから、`B: Canvas-first Rig Workspaceを段階導入`を選定した。現行popupは通常描画への互換fallbackとして維持し、常設dock / InspectorのC案は保留する。

Phase 8eは大きなshell変更から始めず、Motionのまま既存read-only WEIGHT overlayを表示する一つのruntime projectionを実装した。RIG / Motionで診断とtoggleを共有し、current pose追従、再生中一時非表示、RIG-only CORRECTを全79 verifier / build / Browserで固定してSOL技術closeした。

Phase 8fはAnimation Table compact化を見送り、既存CLIP MOTION内の詳細折りたたみ一つだけを採用した。runtime `CANVAS / DETAIL`でRIG / Motionの主要actionを残して数値詳細を畳み、WARPはexpanded固定、close / reopenと通常描画往復でcompact要求を復帰する。全80 verifier / build / 1280×720・720×720 Browser、console 0件、SOL final review=`A`で技術closeした。Workspace保存state、第二selection / History、Mesh / Skin仕様は追加していない。

Phase 8gはFocus shell active、Phase 8hはAnimation Table SCOPE inactive / focusを、それぞれ一componentだけ補正してcloseした。Phase 8hは3.91:1→4.81:1、browser既定黒focus→Futaba茶outlineを全80 verifier / build / Browserで固定した。Phase 8iはWorkspace shellを広げず固定topology Weight brushを選び、Phase 8jでADD / SUB、SVG vertex hit、1 gesture 1 History、cancel / failure rollbackまで技術closeした。Phase 8kはUI拡張前に既存vertex位置編集のpure / Model境界を固定する。

## 4. 後続候補

### Project-local Rig Library

既存ClipAssetまたは明示複製を再利用し、最初から新しいRig preset schemaを作らない。source Asset更新の伝播、参照切れ、Project外共有が実制作で必要と確認された後だけ、immutable template / import-export境界を別Gateで検討する。

### Video Handoff Package

PNG sequence / APNG / GIF等の既存exportを壊さず、必要になった時だけFrame、FPS、alpha、Canvas size、色・順序metadataをまとめる汎用packageを比較する。特定編集software固有ProjectをTegaki正本にしない。

### UI基盤

Design tokenや共通controlの整理は`UI_CSSスタイルガイド.md`を正本とする。button / popup / scrollbarの局所重複を、触るcomponent単位で段階修正する。大規模CSS renameや一括neutral化はしない。

### 性能 / WebGPU

PixiJS 8.19互換更新は完了済み。WebGPU renderer、GPU Skin、GPU paintは、CPU / WebGLの時間、upload量、texture lifetime、export負荷を固定fixtureで計測してから開く。外部診断の「CPU Skinが主ボトルネック」「Raster上限 / Bake上限が最優先」は未計測仮説として扱い、現行コードとOwner制作Projectで再現するまでproduction変更しない。

## 5. 外部レビュー採否

- 採用: generator別UI辞書、Setup青、select option再構築抑制、Canvas first、段階抽出、profiling first、外部handoff。
- 既に実装済み: Rig / Mesh Setupの密度整理、WEIGHT診断、多Bone group、PixiJS 8.19、Multi-Model / External Review運用。
- Phase 8fで完了: 既存popup fallback、CLIP MOTION可逆Focus shell、RIG / Motion主要action維持、WARP詳細固定、normal drawing復帰、narrow clamp。
- Phase 8g / 8hで完了: Workspace contrastをcomputed styleで監査し、Focus shell activeとAnimation Table SCOPEだけを補正した。Phase 8iで一枚RasterのMesh / Weight authoringを比較し、Phase 8jで固定topology Weight brushを技術closeした。現行Phase 8kは既存vertex位置だけのTopology Gateを選び、固定ID / triangle / weightとsource bounds / winding / overlap拒否をpure / Modelで固定した。同名Bone / target識別、11 Bone密集、異種generator誤操作、拒否後の次操作はOwner台帳と既存後続Gateを維持する。
- 別Gateへ保留: 小utility統合、Auto Line実受理率 / 再生成History実測、Raster / Bake上限、CPU Skin / Raster profiling、Project-local Rig参照schema、GPU Skin、動画編集統合、AI自動化。
- 保留: Animation Table全面dock、常設Inspector。固定fixtureで現行popup / Canvas-first shellより優位と確認できるまで採用しない。
- 棄却: 保存正本をWorkspace / UIへ複製する案、外部proposalを実コード照合なしでPhase契約にする案、`animation-table-popup.js`の一括分割。

2026-08-20のStage B後にClaudeReview 4本を再読した。UIレビューは主要項目が既に反映済み、file整理レビューは段階抽出だけ採用、PixiJS / resource診断は未計測仮説として維持する。旧main snapshotの行番号やPhase状態は現行判断へ持ち込まない。

## 6. Phase化条件

- SOL / XHighが現行event、state、History、save / reload、Panel復帰を横断監査する。
- Gate前はproduction DOM / CSSを大幅変更しない。
- 一つの限定Sliceへ対象file、Acceptance Criteria、Browser fixtureが固定した場合だけLUNA / MAXへ委譲できる。
- Ownerすり合わせが必要なのは、Workspaceをpopup / dock / mode切替のどれとして見せるか、通常描画とRig制作をどの操作で往復するかである。保存schemaやsolverを先に増やして回答しない。
