# Phase 8d — Rig Workspace / Canvas-first Architecture Gate

更新日: 2026-08-20
担当: SOL / XHigh（authority、UI復帰契約、Gate、最終review）。Gate後の限定projection / verifierだけLUNA / MAX候補
状態: CLOSED — Stage B / CとArchitecture Gateを受入れ、B: Canvas-first Workspaceの段階導入を選定

## 1. Goal

Phase 8cまでに成立した一枚Raster Rig、Mesh / Skin、WEIGHT診断、限定補正を、通常描画を圧迫せず制作しやすくする次のUI構造を選ぶ。外部構造・UI提案をそのまま採用せず、現行CLIP MOTION、Animation Table、Canvas overlay、Layer Panelの正本と復帰契約へ照合する。

## 2. Gate候補

- `A: 現行floating CLIP MOTIONを維持し、RIG内progressive disclosureだけ整理`
- `B: Canvas-first Rig Workspace shellへSetup青RIGを投影し、Table / Inspectorを必要時だけ表示`
- `C: Animation Table dock + 折りたたみInspector`

第一比較はA / B。Cはwindow占有、狭幅、Panel位置保存、通常描画復帰への影響が大きいため、固定fixtureで優位が出るまでproduction候補にしない。

## 3. 維持契約

- static正本は既存`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、Frame正本は既存`ClipInstance.rigMotion`。
- UI専用Rig、Mesh、Bone group、selection、History、Workspace保存flagを作らない。
- `Q` / `V` / `H`、Space + drag、header / Lane / Timeline grid wheel、Panel位置、CAF working Layer、Table close / reopenを維持する。
- preview / playback / onion / Bake / GIF / APNG / Project reloadのsolver・render planを変更しない。
- Phase 8cの未接続Motion gate、対象外art dim、WEIGHT / CORRECT、再生成確認を維持する。

## 4. Stage A — authority / interaction audit

1. `animation-table-popup.js`のRIG target、overlay、History、Layer Panel同期、close / reopen入口を一覧化する。
2. Workspace shellへ移す場合に必要なruntime projectionと、既存popupへ残すmutation adapterを分ける。
3. 1280×720、narrow、CAF 1 Raster / 2 Bone、11 Bone密集fixtureでA / Bの占有面積、Canvas可視面、設定→実行導線、Setup青 / Motion橙を比較する。
4. 通常描画→Rig→Motion→通常描画の往復で、active Layer、selected Clip / Bone、viewport、Panel位置、Historyが変わらないことを固定する。

### Stage A判定 — 2026-08-20

- 一枚Rasterには`Root Raster Part + rigid Bone`で絵全体を動かす方式と、`Mesh Bone + Mesh / Skin`で絵を曲げる方式がある。従来はLaneの`+RIG`が前者を即作成し、CLIP MOTIONの`+BONE`が後者を作るため、同じ「RIG」に見える二方式が無説明で混在した。
- Mesh Boneだけでは絵へ影響しない。`AUTO GRID / AUTO SHAPE / AUTO LINE`がSkin接続操作だが、Motionへ移った後の案内がRIGへ戻る文章だけで、次の直接操作がなかった。
- mixed stateではRaster Part矩形overlayとMesh Bone overlayが同時に現れ、Boneを動かしているのか絵全体を変形しているのか判別しにくかった。
- macro Gateは`A / B`比較を継続する。ただしこの問題はWorkspace shell選定を待たず直せる既存導線欠陥なので、保存schema・solverを変更しない限定Stage Bを`GO`とした。

## 5. Stage B — 一枚Raster RIG onboarding repair

- LaneのRoot Raster入口を、正本を即作成する`+RIG`から非mutationの`RIG設定`へ変更する。1 Frame CAFでもstatic RIG Setupだけは開けるが、Durationは暗黙延長しない。
- RIGは`BONE追加 → Mesh / Skin生成 → Motion`を第一導線とし、絵を曲げない方式は別の`全体PIVOT`へ分離してMesh Bone / Meshとの併用を拒否する。Stage B初版のAUTO SHAPE優先はOwner fixtureを受けてStage CのAUTO GRID基準へ改訂した。
- Skin未接続のMotionでは対象Rasterを通常濃度で維持し、非対象だけをdimする。key / Canvas dragは拒否したまま、Stage CでSetup青`AUTO GRIDを作成`を直接表示する。
- 既存mixed stateは自動解除しない。確認付き`曲げBONEへ切替`だけが対象Raster Part、rigid Bone、対応Motion trackを除去し、未接続Mesh Boneを維持する。外部child、Skin使用中は理由付き拒否する。
- 内部RIG対象中のMOTION件数はCAF root Transformではなく、Bone / Part trackのexplicit key総数を表示する。

Stage B確認: 変更JSの`node --check`、全78 verifier、production build、Browserの1 Frame RIG設定、未接続Gate / CTA、AUTO SHAPE接続、Bone dragと絵の追従、MOTION 1、全体PIVOT分離、console error 0件を通過した。`曲げBONEへ切替`のmutation / external-child拒否はmodel verifierで固定し、Browser上の確認dialog承認はOwner fixtureへ残す。

## 5.1 Stage C — AUTO GRID基準導線とWeight復帰

Owner制作fixtureでは`AUTO SHAPE`がalpha / guard条件で拒否される一方、`AUTO GRID`では一枚人物RasterをMotionへ接続できた。最初の成功操作を失敗し得るgeneratorへ固定しないため、保存schema・Skin evaluator・Historyを変えない次の限定修正を行う。

- Setupの第一導線を`1. BONE追加 → 2. AUTO GRID → Motion`へ変更する。`2. 絵へ接続`という独立buttonに見える文言は置かず、Mesh未生成時だけ`2. AUTO GRID`を太いSetup青境界で強調する。`AUTO SHAPE / AUTO LINE`は同列の明示的な高度generatorとして維持する。
- 未接続Motionの直接actionも`AUTO GRIDを作成`へ統一する。Shape / Lineで既にSkin接続済みなら従来どおりMotion可能であり、GRIDだけを評価正本にしない。
- Skin接続後のMotionには`WEIGHT確認`を出し、対象Boneを維持したままRIGの既存read-only WEIGHT診断へ戻す。自由brush、Topology編集、第二Weight正本は追加しない。
- Root Rasterの未設定targetから派生する仮PIVOTは保存BONEではなく、初期BONEに誤認されるためCanvas overlayへ出さない。明示`BONE追加`または`全体PIVOT`だけをBONEとして表示し、自動BONE作成は行わない。
- GRIDの現行距離weightは全Bone候補から最大2本を選ぶため、別branchの手足へ影響が漏れる場合がある。Stage Cは診断への到達性までとし、自由Weight paint / Mesh point追加・切断はproposal 15の別Gateで扱う。

Stage C確認: 変更JS / verifierの`node --check`、全78 verifier、production buildを通過した。Browserでは簡易Rasterを描画し、未設定仮PIVOT名なし、明示BONE追加、`2. AUTO GRID`の2px相当Setup青強調（AUTO SHAPEは通常境界）、未接続Motionの`AUTO GRIDを作成`、接続後のBone Pose key / MOTION 1、`WEIGHT確認`からRIG / WEIGHT ONへの復帰、console warning / error 0件を確認した。自由Weight補正とTopology編集は未実装のまま維持する。

Owner初期確認: 2026-08-20、一枚Rasterに6 Bone、AUTO GRID 6×6、Motion key、WEIGHT可視化までを実制作操作し、Phase 8dの初期導線として受入れた。形状に沿うMesh最適化、point追加・triangle切断、自由Weight paintは本Phaseの不足ではなくproposal 15の別Gateとする。Motion poseを動かしながらWEIGHT推移を確認したい要望は、Workspace構造と診断表示の独立性を検証するPhase 8eの第一Sliceへ送る。

## 6. 思考の水位 / UI比較契約

- 通常描画ではCLIP / Rig / Meshの内部構造を要求せず、Canvasと今の制作行為を第一水位とする。
- RIG開始時は「一枚全体を動かす」か「曲げる」かを選び、曲げる場合も`BONEを置く → AUTO GRID → Motion`の次の一手だけを強く見せる。AUTO SHAPE / LINE、diagnostic、WEIGHT、CORRECTは必要時に開く第二・第三水位とする。
- CallipegのCanvas / timeline / ergonomics、Adobe FrescoのCanvas中心workspaceと左右tool、CLIP STUDIO PAINT Simple Modeの最小UIとStudioへの復帰を比較fixtureにする。外観やbrandを複製せず、Canvas占有、操作到達段数、pen / touch、通常描画への復帰を測る。
- contrastは色の印象だけで決めない。WCAG 2.2を参照し、通常文字4.5:1、large text 3:1、操作境界・focus・disabledを固定palette / 1280×720 / narrowで監査する。Setup青、Motion橙はlabel / icon / stateと併用し、色だけを意味正本にしない。

公式比較資料:

- https://callipeg.com/learn-interface/
- https://callipeg.com/features/
- https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html
- https://help.clip-studio.com/en-us/manual_en/090_tablet/Simple_Mode_and_Studio_Mode.htm
- https://www.w3.org/TR/WCAG22/

### 6.1 ClaudeReview再照合 — Stage B後

- `rig-mesh-setup-ui-review.md` / `rig-mesh-evaluation-and-followup.md`のうち、generator辞書、AUTO group、select option再構築抑制、Setup青、次操作を含む拒否message、多Bone表示密度は現行コードで採用済みである。Stage Bは残っていた一枚Rasterの方式競合と未接続Motionの行き止まりを解消した。
- Gate選定後にPhase 8eへ送る残件は、同名Bone / targetの経路表示、11 Bone密集時のCanvas / Table表示、異種generator再生成の誤操作防止、拒否後の次操作、Workspace全体contrastである。これらを保存schemaやsolver変更の理由にしない。
- `tegaki-code-redundancy-file-organization-report.md`の小utility重複は現行にも残るが、Rig WorkspaceのAcceptance Criteriaではない。`animation-table-popup.js`は現在も2万行超であるため、全面分割は採用せず、Gateで読取projection / mutation adapter / overlay境界が固定した箇所だけを将来段階抽出する。
- `tegaki-webgpu-pixijs-resource-diagnostic.md`が示すCPU Skin / Raster経路と固定resource上限はコード上に存在するが、主ボトルネックという結論は未計測である。WebGPU、GPU Skin、Raster / Bake上限変更はPhase 8dへ混ぜず、Owner制作fixtureのprofiling後に別Gateで判断する。
- ClaudeReviewは旧main snapshotに対する提案であり、現行正本ではない。採否は本節、proposal 15 / 16、Owner確認台帳を正本とする。

## 7. Architecture Gate最終判定

- `B: Canvas-first Rig Workspace shellを段階導入`を採用する。Owner fixtureではAnimation Tableとfloating CLIP MOTIONがCanvasを同時に覆い、Setup診断を見るためMotionからRIGへtab移動する必要もある。Canvasを主面に保ち、同じruntime stateを必要なInspectorへ投影する構造が最も小さくこの問題を解く。
- `A`は通常描画への復帰と互換fallbackとして既存popupを維持するが、追加機能を同じfloating panelへ積み上げる第一候補にはしない。
- `C: 常設Animation Table dock + Inspector`は、narrow / pen / touchでCanvas占有が大きく、Panel位置保存や第二Workspace正本へ波及しやすいため保留する。
- production shellを本Phaseで一括実装しない。Phase 8eはMotion中のread-only WEIGHT表示を最初のpure projection / visibility Gateとし、成立後だけCanvas-first shellの段階抽出へ進む。
- SOL最終判定は`A`。Stage B / Cの全78 verifier、production build、Browser実操作、console error 0件を受入れる。Ownerの深い制作Project、reload / export、pen / touchは`OWNER_VERIFICATION_BACKLOG.md`で継続し、不具合発見時は限定bug fixまたは新Phaseで扱う。

## 8. Stop conditions

- Workspace専用の保存stateまたは第二Historyが必要になる。
- Animation Table / popup主要classの一括再構成や100行超のDOM置換が先に必要になる。
- Ownerがpopup / dock / mode切替の基本操作を選ばないと候補を一つへ絞れない。
- Rig / Mesh機能追加、Graph、Motion Path、Video編集、WebGPU、AI、physicsへ範囲が広がる。

## 9. Verification

- Stage Aのmacro Workspace比較は文書・pure projection verifier中心。Stage Bの限定onboarding repairとStage CのAUTO GRID基準導線は上記確認を完了した。後続Sliceも変更JSの`node --check`、関連 / 全verifier、build、Browser実操作、console error確認を必須とする。
- Gate後の限定UI Sliceだけnode check、関連 / 全verifier、build、Browserの通常描画復帰・Panel位置・consoleを必須とする。

## 10. Source

- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
- `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
- 外部原案は`開発用資料保管庫/Archive/`に保存し、本Phaseの実装契約を上書きしない。
