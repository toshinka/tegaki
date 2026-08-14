# Phase 8a — Raster Skin Weight Diagnostics / Dense Bone Focus Gate

更新日: 2026-08-14
担当: SOL / XHigh（Gate・表示境界・最終review）、GO後の限定pure projection / verifierはLUNA / MAX候補
状態: CLOSED — Stage A / B完了、Gate 1=`GO`、SOL最終review=`A`（Owner制作確認は台帳へ分離）

## 1. Goal

Phase 7zの`chain-local-joint-v1`をOwner制作Projectで判断しやすくするため、既存`skinBindings[].vertexWeights`を変更せず、選択Mesh BONEの影響領域と関節blendをCanvas上で読める診断導線を比較する。同時に、一Rasterへ多数Boneを置いた時のCanvas名とAnimation Table子行の密度を、保存groupやBone色schemaを増やさず整理できるか判定する。

最初は一つの選択Raster / Mesh / Bone、Setup青のRIG内、read-only表示に限定する。weight編集や自動再生成は行わない。

## 2. Current evidence

- Phase 7zは新AUTO SHAPEを既存static `vertexWeights`へ確定し、旧Projectを暗黙再生成しない。選択Boneのweightは既存Mesh / Skinだけから決定的に投影できる。
- Canvas Bone名は`NAMES AUTO / ON`、active名常時、非active名hover、明色underlayまで改善済みだが、一Raster 11 Bone級では全表示とTable子行がまだ密になる。
- Mesh targetは`meshDefinitions[].targetInternalLayerId`、Bone参照は`skinBindings[].vertexWeights[].influences`から導出できる。新しい`boneGroupId`、保存色、`isRigged`を作る前にruntime projectionを比較できる。
- Phase 7zの曖昧branch拒否は安全だが、顔への微小weight漏れやjoint bandの広さを制作画面から直接確認する手段はまだない。

## 3. Gate 0 questions

1. 選択Boneの0〜1 weightを既存Mesh triangleへread-only heatmapとして投影し、影響なし、rigid 1、親子blendを判別できるか。
2. overlayをSetup中だけ表示し、preview / playback / onion / Bake / export、Project / Historyへ一切参加させずに済むか。
3. active Raster / Mesh由来のBoneだけを主表示しつつ、親子接続に必要な外部Boneを勝手に隠さないtarget focusを作れるか。
4. Animation Table子行の表示group / collapseをruntime UI stateだけで導出し、Bone / Motion keyの選択・seek・Historyを変えずに済むか。
5. 256 vertex / 多Bone fixtureでoverlay再描画を選択・Frame変更時へ限定し、pointer入力とpreviewを阻害しないか。

## 4. Initial boundary

- 一つの選択Raster / Mesh / Bone、既存static weightのread-only診断から開始する。
- Setup青のRIG内にadvanced `WEIGHT` submodeを置く案を第一候補とし、4つ目のtop-level tabを増やさない。
- active Boneは橙、Setup / diagnosticは既存青、警告は既存赤を使う。保存Bone色辞書や自動branch配色を作らない。
- Project schema、History、Skin evaluator、weight generator、AUTO SHAPE、STALE判定を変更しない。
- manual weight brush、add / subtract / smooth、chain include / exclude、joint band編集、Mesh頂点編集は非対象。
- DQS、stretch、IK変更、複数Mesh分割、Attachment、WARP共有、physicsへ広げない。

## 5. Stage plan

### Stage A — read-only authority / projection audit

- `meshDefinitions`、`skinBindings`、選択Rig context、Canvas overlay、Table子行projectionを横断監査する。
- 選択Bone weight、rigid / blend / none、target Raster、parent / child参照をpure resultへまとめられるか固定fixtureで確認する。
- 現行NAMES AUTO / ON、hover、underlay、Timeline selectionを変更せず、追加表示の競合を記録する。

監査結果（2026-08-14）:

- `AnimationTablePopup._getSelectedCafRigProjection()`は選択CAFからRasterごとの`mesh` / `skinBinding` / 参照Boneを既に導出しており、対象Raster / Mesh / Boneを新しい保存fieldなしで一意に決められる。
- 現行`evaluateRasterBoneSkinning()`は保存Mesh / Skinと既存Bone evaluatorからFrame頂点を返す一つの正本である。診断側はこのFrame座標を借り、weightは対応する`skinBindings[].vertexWeights`から選択Bone成分だけを読むことで、第二Skin評価を作らずに済む。
- `rig-pivot-overlay`は`document.body`上の固定SVGで、Project / History / Pixi stage / compositor / Bake / exportへ参加しない。専用のpointer-eventsなし表示groupをPIVOTより後ろへ置けばSetup中だけの診断に限定できる。
- 256 vertex級でtriangleごとのDOM要素を作る案は棄却する。weight帯ごとに複数triangleを一つのSVG pathへまとめ、static geometryの再構築をtarget / Bone / Mesh変更時だけ、Frame / pan / zoom時はgroup transformまたは既存座標adapter更新だけにする。
- active Raster focusは既存weight参照Boneから導出できるが、外部の親子接続を隠さないancestor / child展開が必要で誤非表示の危険が残る。Table group / collapseはruntime化できるが、Timeline key選択・seekとの確認面が広く、Phase 7z weight判定への直接性は低い。
- `raster-skin-weight-diagnostic.js`へ選択Raster / Mesh / Boneのweight 0 / blend / rigid、triangle統計、直接親子を返すnon-mutating pure projectionを追加した。任意の既存Frame evaluator結果から座標だけを受け取り、Project / Skin / Rigを変更しないfixtureを固定した。

### Gate 1 — first diagnostic selection

- `A: 選択Bone weight heatmap`、`B: active Raster target focus`、`C: Table Bone group / collapse`を比較する。
- Phase 7zの制作判定へ直接効き、保存・編集境界を増やさない最小一つだけをStage Bへ送る。
- 複数機能を同時導入しない。表示だけで安全に成立しなければ`HOLD / REPLAN`。

判定（2026-08-14）: `GO — A: 選択Bone weight heatmap`

- Phase 7zの顔・反対肢への微小weight漏れ、rigid区間、短いjoint blendを制作画面から直接判定できる唯一の候補である。
- `B: active Raster target focus`は接続に必要な外部Boneを誤って隠す危険があり、`C: Table Bone group / collapse`は密度改善には有効でもweight安全性を示さないため、いずれも後続Gateへ送る。
- Stage BはSetup青RIG内のadvanced `WEIGHT` toggle、一つの選択Raster / Mesh / Bone、read-only SVG path overlayだけに限定する。0は非塗り、blendはSetup青の段階濃度、rigidは最濃色、active Bone自体は既存橙を維持する。
- overlayは既存Frame evaluatorの頂点だけを使い、Skin weightの補間・再生成・編集を行わない。Project / History / export差分0と、toggle OFF / target変更 / Bone削除 / Table closeで即消去をStage Bの停止条件にする。

### Stage B — limited display adapter

- Gate=`GO`後だけ、対象file、既存契約、Acceptance Criteria、検証を固定して実装する。
- overlay / focus / collapseはruntime UI stateに限定し、Project / History / export差分0を専用verifierで証明する。

実装結果（2026-08-14）:

- Setup青RIG内へ`WEIGHT` toggleと`0 · BLEND · 1`凡例を追加した。一つの選択Raster / Mesh / Boneが正確に成立する時だけ有効となり、別Rasterや別Boneへfallbackしない。
- `raster-skin-weight-diagnostic.js`は既存`skinBindings[].vertexWeights`から選択Bone成分だけをnon-mutatingに正規化し、既存`evaluateRasterBoneSkinning()`のFrame頂点を座標として借りる。第二Skin evaluator、weight補間、再生成を作らない。
- `rig-skin-weight-overlay.js`はtriangleごとのDOMを作らず、low / mid / high / rigidと二重outlineの固定6 SVG pathへまとめる。weight 0は無塗り、微小漏れはlow、全頂点1だけrigidとし、暗い線画上ではFutaba cream underlayを使う。
- geometryはtarget / Bone / Frame / Rig context同期時だけ再構築し、pan / zoomは一つのSVG group matrixだけを更新する。overlayはPIVOTより背面、`pointer-events: none`でSpace + dragやCanvas入力へ参加しない。
- toggle OFF、target / Bone消失、CAF対象、Motion / WARP表示、Table closeでstale表示を残さない。toggle状態はruntimeだけでProject / History / Bake / exportへ保存しない。
- BrowserではMesh未生成時のdisabled、Bone / AUTO GRID後のON、固定6 path、pointer非捕捉、target切替、Raster再選択、Motion往復、OFF、Table close、console error 0件を確認した。

### SOL final review

判定（2026-08-14）: `A`

- exact target、既存Frame evaluator共有、runtime-only toggle、固定path数、stale解除がInitial boundaryと一致する。
- 全71 verifier、変更JSの`node --check`、production buildを通過した。build後の追跡済み`dist` / `.vite`基準は復元したが、未追跡生成fileの最終個別削除だけはCodex実行環境の承認枠上限で実行不能となったため、成果物ではなく清掃残として報告する。
- active Raster target focusとTable Bone group / collapseは同時実装せず、後者をPhase 8bの比較Gateへ送る。manual weight、保存group / Bone色、DQS、stretch、複数Mesh、WARP共有は未実装を維持する。
- Owner制作環境では、一枚人物Raster + 多Boneで微小漏れ、joint blend、暗色線画、256 vertex級の操作感、reload / preview / export横断を確認する。未確認はPhase 8a未完了を意味せず、問題時は限定bug fix Gateを立てる。

## 6. Acceptance criteria

- 選択Raster / Mesh / Boneと表示内容が一意で、別Raster / 別branchを誤表示しない。
- weight 0、0〜1 blend、1 rigidをFutaba palette内で識別でき、暗い線画上でもBone / Mesh境界を読める。
- target切替、Bone追加 / 削除、Layer追加 / 削除、Undo / Redo、CAF複製、Table close / reopenでstaleな表示を残さない。
- display-onlyでProject JSON、History件数、CPU / Pixi / Bake / export結果を変えない。
- NAMES AUTO / ON、hover名、Space + drag、Timeline header zoom / Lane上下 / grid Frame±1 wheel、Motion / WARP tabを壊さない。

## 7. Stop conditions

- 正確な表示に新しい保存group、Bone色、weight zone正本が必要になる。
- overlayが既存Skin evaluatorと別のweight解釈を持つ。
- parent / child表示のためRig treeを自動再接続または暗黙解除する必要がある。
- 256 vertex程度でpointer / previewを継続的に阻害する。

該当時はproduction UIへ接続せず、read-only inspector、Table group、manual weight authoringを別Gateへ再分割する。

## 8. Model decision

- Gate 0、表示権威、UI導線、performance / stale監査、最終reviewはSOL / XHigh。
- Gate=`GO`後に、入出力が固定したpure weight projection / fixture verifier、または一つのdisplay-only adapterだけLUNA / MAXへ委譲可能。
- manual editing、保存schema、History、Skin正本の判断が必要になった場合はLUNAへ渡さずSOLへ戻す。
