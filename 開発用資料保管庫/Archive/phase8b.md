# Phase 8b — Animation Table Bone Group / Dense Rig Focus Gate

更新日: 2026-08-14
担当: SOL / XHigh（表示権威・Timeline selection境界・Gate・最終review）、GO後の限定pure projection / verifierはLUNA / MAX候補
状態: CLOSED — Stage A / B、Gate 1=`GO`、SOL final review=`A`。Owner制作確認は台帳へ分離

## 1. Goal

Phase 8aで選択Bone weightのread-only診断を確定した次に、一Rasterへ多数Boneを置く場合と、複数Layer / Folderへ一つずつBoneを置く場合の双方で、Animation Table子行を探しやすくする。第一候補は既存正本から導出する`CAF > target Layer / Folder > Bone`のruntime表示group / collapseであり、Rig、Motion key、Timeline selection、seek、History、保存schemaを変更しない。

Canvas上のBoneや接続線を自動で隠す`active Raster target focus`は、外部親子Boneを誤非表示にする危険があるため、このPhaseの第一実装へ混ぜない。

## 2. Current evidence

- Mesh生成済みBoneは`meshDefinitions[].targetInternalLayerId`と`skinBindings[].vertexWeights[].influences`からtarget Rasterへ表示上分類できる。
- Folder Part / rigid Bone、CAF root Bone、Mesh未生成Boneには同じtarget推定を無言適用できない。既存row descriptorとRig treeを監査し、`未分類`へ勝手に恒久所属させない境界が必要である。
- 現行Canvas名は`NAMES AUTO / ON`、active名常時、非active名hover、明色underlayまで成立している。Animation Tableでは一Raster 11 Bone級で全子行が常時展開され、Clip / keyの読み取り面積を圧迫する。
- Phase 8aのWEIGHT overlayは選択targetだけを厳密に扱うが、そのtarget情報をBone groupの保存正本へ転用しない。

## 3. Gate 0 questions

1. 現行Animation Tableの子行descriptor、key marker、row selectionを変更せず、target Layer / Folder別の見出しだけをpure projectionとして挿入できるか。
2. `A: 明示collapse group`、`B: 選択targetだけ自動展開`、`C: active branch優先`のうち、小規模Rigと多Bone Rigの両方で既存keyを見失わない最小案はどれか。
3. collapse中の選択Bone / key、Frame seek、Ctrl / Cmd複数選択、Motion Graph bridgeをどう表示し、選択正本を消さずに済むか。
4. CAF root / Folder / Root Raster / Mesh Raster / Mesh未生成Boneを、保存`boneGroupId`なしで安全に分類できるか。
5. Layer追加 / 削除、Rig cascade、CAF複製、Undo / Redo、Table close / reopen後にruntime groupがstaleにならないか。

## 4. Initial boundary

- Animation Tableのdisplay projectionだけを対象とする。Bone / connection / labelのCanvas表示は変更しない。
- `boneGroupId`、保存collapse state、Bone色辞書、`isRigged`、target複製fieldを追加しない。
- Timeline row / key descriptor、selection set、seek、History、ClipAsset / ClipInstance、Project JSONを変更しない。
- 小規模Rigを常時自動collapseしない。thresholdや初期展開を採る場合もruntime導出として固定fixtureで比較する。
- manual weight、weight zone、Mesh頂点編集、複数Mesh、Attachment、WARP共有、physicsへ広げない。

## 5. Stage plan

### Stage A — row authority / projection audit

- 子行生成、row descriptor、selection / seek、Rig target projection、Layer / Rig削除同期を横断監査する。
- CAF root、Folder、Root Raster、Mesh Raster、Mesh未生成Boneを含むfixed fixtureで、target group候補と未分類理由をpure resultへまとめる。
- 既存のsmall Rig表示を維持したまま、11 Bone級でgroup header / collapseがDOM量とTimeline可読性へ与える差を記録する。

監査結果（2026-08-14）:

- 現行Tableは選択CAF Lane直後へFolder / Root Raster行と全Mesh Bone行を同順で挿入し、左trackと右Timelineを別々に同じ順で再生成する。Bone row / cellのdescriptorは`clipId + boneId + frame`であり、表示DOMを畳んでもruntime `_motionTimelineKeySelection`と`rigMotion.boneTracks`自体は変更されない。
- 現行`_getRasterRigProjectionContext()`はInspector操作のため、選択Raster、MeshありRaster、先頭Rasterの順にfallbackする。このfallbackは編集targetには必要だが、Table group所属へ使うと外部親Boneや未生成Boneを誤って一Rasterへ分類するため、group権威には採用しない。
- `animation-table-bone-group-projection.js`へ、rigid bindingと正weight Skin influenceだけから一意targetを導出するnon-mutating pure projectionを追加した。複数target Boneは`SHARED / CONNECTION`、targetなしBoneは`UNASSIGNED`へ分離し、親子の隣接targetは診断情報に留めて自動所属させない。
- 一Raster多Boneは一つのtarget groupへ安全にまとまる。複数Layer単Boneを全てgroup header化すると行数が増えるため、singleton targetは従来行のまま、同一targetへ複数Boneがある時だけheader / collapseを出す案が最小である。
- collapseでDOM rowを外しても選択正本は残るが、畳まれたkey選択を無通知にすると見失う。Stage Bではgroup headerへBone数と選択中key / active Boneのindicatorを投影し、collapse操作でselectionをclearしない契約が必要である。

### Gate 1 — one display behavior

- `A: 明示collapse group`、`B: 選択targetだけ自動展開`、`C: active branch優先`を比較する。
- keyを隠したまま選択だけ残す場合の可視通知、group header click、keyboard / pen / touch境界が一意な最小一つだけをStage Bへ送る。
- 正確な分類に保存groupが必要、または既存Timeline selectionを別正本へ複製する必要がある場合は`HOLD / REPLAN`。

判定（2026-08-14）: `GO — A: 複数Bone targetの明示collapse group`

- 同一targetに2本以上のBoneがある時だけ`target Layer / Folder + Bone数`の表示headerを置き、既定は展開、clickでruntime collapseする。singleton targetは従来行を維持し、小規模Rigの行数を増やさない。
- `SHARED / CONNECTION`と`UNASSIGNED`は誤target fallbackを避ける安全groupとして明示する。外部親子をtarget groupへ自動吸収せず、Canvas Bone / connectionは隠さない。
- collapseは左trackと右Timelineを同じpure planで同時に省略するが、Bone / key selectionをclearしない。headerへactive Boneと選択中keyの存在を表示し、再展開で既存descriptorがそのまま復元されることをStage Bの必須条件にする。
- `B: 選択targetだけ自動展開`は選択のたびに別target keyを隠すため棄却し、`C: active branch優先`は親子graphとtarget所属が直交するため後送する。

### Stage B — limited Table projection

- Gate=`GO`後だけ対象file、既存契約、Acceptance Criteria、検証を固定して実装する。
- runtime UI stateに限定し、Project / History / Timeline model差分0を専用verifierで証明する。

実装結果（2026-08-14）:

- `animation-table-bone-group-projection.js`のpure分類をTable左track / 右Timelineの共通display planへ接続した。同一target 2 Bone以上だけ見出しを追加し、singleton targetは従来Bone行のままとした。
- `SHARED / CONNECTION`と`UNASSIGNED`は明示groupとして残し、Inspector用Raster fallbackや親子隣接targetへ暗黙所属させない。collapse stateは`assetId + groupId`のruntime `Set`だけで、Project / History / Timeline modelへ保存しない。
- 見出しclickは左右のBone行だけを同時に省略し、Bone / key selectionをclearしない。active BoneとCtrl / Cmd選択KEY数を別indicatorとして同時表示し、削除済みKEY descriptorは既存の検証済みselection取得経路で除外する。
- BrowserではAUTO GRID後の一target 2 Boneと`UNASSIGNED` 1 Bone、展開 / 折りたたみ、active表示、Ctrl選択KEY、再展開復元、History `7/500`不変を確認した。最終の両indicator同時表示patch後はローカルURL再読込だけBrowser安全ポリシーで拒否されたため、専用verifierと全検証で補完した。

### SOL final review

判定（2026-08-14）: `A`

- target分類、dense-only header、左右同一plan、selection非破壊、runtime-only collapseがInitial boundaryと一致する。Canvas Bone / connection、Rig tree、保存schema、History、Timeline key正本は変更していない。
- 全73 verifier、変更JSの`node --check`、Vite 8.0.16 production buildを通過した。追跡済み`dist` / `.vite`基準は復元し、未追跡build / Vite生成fileだけ実行環境の削除承認制限により清掃残として維持した。
- Layer追加 / 削除、CAF複製、Undo / Redo、Table close / reopen、長尺制作Project、pen / touchのOwner確認はPhase未完了とせず台帳へ分離する。問題時はPhase 8bを再OPENせず、対象Asset / group / keyを固定した限定bug fix Gateを立てる。

## 6. Acceptance criteria

- 一Raster多Boneと複数Layer単Boneの双方で、選択target / Bone / keyを誤分類しない。
- collapse / expandがTimeline key、Frame seek、Ctrl / Cmd選択、Motion Graph、Historyを変更しない。
- CAF root / external parent-child / Mesh未生成Boneを無言で消さず、分類不能は明示的に従来表示へfallbackする。
- Layer追加 / 削除、Rig cascade、CAF複製、Undo / Redo、Table close / reopenでstale groupを残さない。
- header zoom、Lane上下、grid Frame±1 wheel、WEIGHT overlay、NAMES AUTO / ON、Space + dragを壊さない。

## 7. Stop conditions

- group identityに新しい保存fieldが必要になる。
- collapseのためTimeline row / key selectionを別modelへ複製する必要がある。
- external parent-child Boneを安全に表示できず、Rig graphを暗黙解除・再接続する必要がある。
- 小規模Rigの既存操作を悪化させる自動collapseしか成立しない。

該当時はTable projectionをproduction接続せず、明示filter、検索、Canvas target focusを独立Gateとして再比較する。

## 8. Model decision

- Stage A、分類権威、selection / History境界、Gate 1、最終reviewはSOL / XHigh。
- Gate=`GO`後に、入出力が固定したpure grouping projection / fixture verifier、または一つのdisplay-only adapterだけLUNA / MAXへ委譲可能。
- 保存schema、Timeline model、Rig tree再設計が必要になった場合はLUNAへ渡さずSOLへ戻す。
