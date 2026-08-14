# Phase 7z — Chain-local Joint Skin Safety Gate

更新日: 2026-08-14
担当: SOL / XHigh（Gate・branch / joint設計・最終review）、GO後の限定pure helper / verifierはLUNA / MAX候補
状態: TECHNICAL CLOSE — Gate 1=`GO`、Stage A〜C完了、SOL最終review=`A`、Owner制作確認は台帳へ分離

## 1. Goal

一枚Raster + `AUTO SHAPE` + 複数Mesh BONEで確認された顔へのweight漏れと、肘曲げ時の腕幅／長さ変化に対し、solverや保存正本を増やさず、既存`skinBindings[].vertexWeights`へ確定できる`Chain-local Joint Skin`自動weightを比較する。

最初はOwner fixtureに対応する一枚Raster人体、肩→肘→手首direct chainと別branch、Auto Shape FILLに限定する。現行distance weightを基準として、branchを跨ぐ影響を先に除き、肢中央をrigid、短い関節bandだけを親子blendへする。

## 2. Current evidence

- `createRasterBoneDistanceInfluences()`は各vertexから全Bone segmentを比較し、距離上位2本を必ず正規化する。alpha island、Rig branch、有限cutoffを持たないため、腕Boneから顔等へ非0 weightが残り得る。
- Auto Shape FILLは上記weightをそのまま使う。既存`skinBindings[].vertexWeights`、inverse-bind LBS、CPU / Pixi / Bake評価は既に一つの正本へ収束している。
- LINE / Ribbonは2〜3 direct-chain限定でbranch漏れが小さいが、全区間linear blendのためrigid segment / short joint bandの比較材料に留める。
- 大角度LBSにはcollapseがあり得るが、今回の第一原因はbranch外weightである。DQS等のsolver置換を先行しない。
- Owner制作操作では一枚人物Raster + Auto Shape + 11 Boneで肘曲げと手足独立操作まで成立し、顔引き、前腕幅／長さ変化を確認した。画像と知見はproposal 15 / Owner台帳を正本とする。

## 3. Gate 0 questions

1. `parentBoneId`からjunction / endpoint間のdirect chainを決定的に分解し、別branch同士のweight候補を共有junction以外で排除できるか。
2. 新しいzone保存fieldなしに、Bind Bone geometry、Mesh vertex、既存alpha / topologyからvertexのbranch資格をpure導出できるか。曖昧なjunctionは無言推測せず理由付き拒否または明示chain選択へ送れるか。
3. 各chainの肢中央をweight 1、親子接続周辺の短いbandだけ最大2 influenceへし、全vertexでfinite / non-negative / sum=1と既存validatorを維持できるか。
4. Bind、45° / 90° / 135°で顔・反対肢をepsilon内不動、前腕幅／長さとtriangle windingを現行distance weightより改善できるか。
5. static結果を既存`skinBindings[].vertexWeights`へ確定し、Project / copy / STALE / explicit regenerate、CPU / Pixi / playback / export境界を変えずに済むか。

## 3.5 2026-08-14 entry preflight

Owner制作確認から、Phase 7z開始前に次を分離した。

- Animation Table wheelはheader=`zoom`、Lane名=`vertical scroll`、Timeline grid / Clip=`horizontal scroll`を維持する。高精度trackpadの微小な横ぶれで縦量を失わないdominant-axis pure routingへ固定した。
- Root Raster Part方式が既に成立し、CLIP MOTIONを開いているCAFへ新規直下Rasterを追加した場合だけ、同じ方式の初期Part / Boneを作る。Mesh方式、Folder内部Raster、Rig未設定CAFへは暗黙Boneを作らない。
- Layer削除は専有Part / Bone / Motion track / Mesh / Skinを一Historyでcascadeする。残存Skinが使うBoneまたは削除対象外の子Boneがあれば、自動切断せず理由付き拒否する。
- 多Bone Canvasはactive名だけ常時、非active名はhover、明示`NAMES ON`で全表示、Bone / connectionは明色underlay付きとした。Mesh BoneのLayer group、Table折りたたみ、branch色は保存所有が未確定なためproposal 15の後続Gateへ送った。

これらはauthoring / display入口の修正であり、Phase 7zのweight generator、Skin schema、production WEIGHT UIを変更しない。

## 4. Initial boundary

- Auto Shape FILL、一Raster、一Mesh、既存Rig tree、一つの選択chain fixtureから開始する。
- 既存Mesh topologyとinverse-bind LBSを維持し、まずweightだけを比較する。
- 新しいweight override / delta / zone / `isRigged` / stretch保存fieldを作らない。
- 既存Projectの保存済みweightを自動再生成しない。source更新は従来どおり`STALE`、置換は明示操作だけ。
- 既定stretchはoff。Bone scale、IK target、rotation limit、DQS、physicsを同時変更しない。
- manual weight brush、heatmap production UI、Mesh頂点編集、複数Mesh分割、WARP共有、Attachmentは非対象。
- LINE / GRIDへ横展開せず、Auto Shape FILLの固定fixtureでGateを通してから別Stageで判断する。

## 5. Stage plan

### Stage A — read-only audit / baseline fixture

- 現行Bone segment、Rig tree、Auto Shape vertex / triangle、weight generator、validator、LBS、STALE / regenerateを横断監査する。
- 人体silhouetteを簡略化した決定的fixtureへhead / torso / left-right arm / leg branchを置き、現行distance weightのcross-branch leakage、幅、長さ、triangle signを数値化する。
- Owner Projectを自動読込・変更せず、pure fixtureだけを使う。

開始結果（2026-08-14）:

- `AUTO SHAPE`が`createRasterBoneDistanceInfluences()`をそのまま全vertexへ適用し、segment候補をRig branchやalpha領域で絞らないことを再確認した。
- torso、左右upper arm / forearm、左右thighの簡略branch fixtureで、head頂点の最寄りがtorsoでも第2候補へ別branchの非0 weightが入り、合計1へ正規化される現行baselineを固定した。
- 同一fixtureのleft forearm点では偶然direct chain 2本が上位になる。現行結果が一部の肢で成立して見えても、branch安全性を保証しない比較基準として扱う。
- 次は同じfixtureへbranch分解と曖昧junction拒否だけをpure候補として置き、rigid segment / joint bandを一度に実装せずGate 1比較表を作る。

### Gate 1 — algorithm selection

- `branch partition → rigid segment → short smooth joint band`と、現行distance / LINE longitudinal weightを同一入力で比較する。
- branchが幾何的に曖昧な場合の拒否条件と、将来の明示chain選択境界を決める。
- 合格時だけStage Bへ`GO`。保存情報やsolver置換が必要なら`HOLD / REPLAN`。

判定（2026-08-14）: `GO`

- 頂点の最寄りBoneをprimary rigid領域とし、第2影響は`parentBoneId`で直結する親子だけへ限定する。兄弟、別root、grandchild等のbranch外weightは作らない。
- 親子blendはchild rootをjointとし、親子segmentの短い方の30%以内だけでsmoothstep 0〜0.5を与える。band外はprimary weight 1とし、既定stretchは増やさない。
- 親Bone上で複数child jointの中間にある頂点は親rigidのままにする。off-axisのchild rootは、child側へ分類された頂点だけdirect parentとのblendを許可する。
- primaryと非直結Boneの距離差が短いsegmentの8%以内、または複数joint候補が同距離圏の場合は、頂点IDと候補Boneを返して全生成を非mutation拒否する。
- 比較stripでは現行distanceの幅誤差が45° / 90° / 135°で`0.1260 / 0.4359 / 0.7543px`、長さ誤差が`0.7875 / 1.7647 / 2.3653px`。候補のrigid前腕区間は両誤差0、triangle winding維持、branch外weight 0だった。
- zone / override / stretch field、第二Skin正本、solver置換を必要とせず、既存`vertexWeights` shapeへ確定できるためStage Bへ進めた。

### Stage B — pure candidate

- 新規pure helperは既存Bone / Mesh入力から既存`vertexWeights` shapeだけを返す。
- normalize、最大2 influence、決定性、branch外weight 0、rigid / joint band、rejection non-mutationを専用verifierへ置く。
- production factory / UI / Historyにはまだ接続しない。

完了結果（2026-08-14）:

- `chain-local-joint-skin.js`へ、Mesh vertex / Bone tree / Bind segmentから既存`vertexWeights`だけを返すpure helperを追加した。
- finite / positive / sum=1、最大2 influence、入力順に依存しない決定性、head / opposite branch weight 0、rigid parent領域、off-axis child joint、cycle / zero-length / ambiguity拒否、非mutationを固定した。
- 現行global distanceとの45° / 90° / 135°比較で幅・長さと全triangle signを固定した。DQS、Mesh topology変更、Frame評価は追加していない。

### Stage C — limited Auto Shape adapter

- Gate合格後だけAuto Shape FILLの明示生成 / 再生成へ候補weightを接続する。
- 既存Mesh / Skin setter、generator lineage、CURRENT / STALE、CAF / Raster複製、Project round-trip、Undo / Redoを維持する。
- preview / playback / onion / random seek / Bake / GIF / APNG、CPU / Pixi一致を既存Skin評価で確認する。

実装結果（2026-08-14）:

- 明示`AUTO SHAPE` / `SHAPE再生成`だけがpure候補を使い、generator metadataへ`weightMode: chain-local-joint-v1`を記録する。Skin schemaは既存のまま。
- 保存済み旧AUTO SHAPEは`weightMode`なしの保存weightを維持し、load / preview / source CURRENT判定で暗黙再生成しない。明示再生成時だけ新weightへ置換する。
- UI statusは新生成を`SHAPE JOINT`、旧保存weightを従来どおり`SHAPE FILL`と表示する。曖昧branch / joint、zero-length、cycleは次操作を含む理由messageで拒否する。
- joint band / ambiguity比率はv1 algorithm固定値で、Project別overrideや新しいWEIGHT UIを追加していない。

検証結果:

- `verify-chain-local-joint-skin.mjs`で人体branch、決定性、非mutation拒否、cycle / zero length、45° / 90° / 135°の幅・長さ・triangle windingを固定した。既存baselineを含む全69 verifierがPASSした。
- AUTO SHAPE factory / Model verifierで最大2 normalized weight、旧`weightMode`なしProject、明示再生成、CURRENT / STALE、CAF / Raster複製、Project round-trip、既存inverse-bind LBSを確認した。
- Browserで一枚RasterへMesh BONEを追加し、`AUTO SHAPE → SHAPE JOINT`、Undoで`MESH未生成`、Redoで`SHAPE JOINT`へ戻ることを確認した。
- 5秒周期の緊急checkpointがcleanなCAF Rasterまで強制再captureし、内容不変でもSnapshot IDだけ変えて`SHAPE STALE`にする既存不整合を発見した。Project exportを通常dirty判定へ戻し、checkpoint後とUndo / Redo後も`SHAPE JOINT`を維持した。未確定Rasterは従来どおりdirty判定で保存される。
- Timeline grid上のwheelは横方向へ移動し、Browser console error / warningは0件だった。変更JS / mjsの`node --check`、Vite 8.0.16 production build、生成物清掃を通過した。

## 6. Acceptance criteria

- 顔・反対肢への選択arm branch weightが0で、比較Poseでもepsilon内不動。
- 上腕 / 前腕中央は原則単一Bone weight 1、親子blendは短いjoint bandだけ。
- 45° / 90° / 135°で現行distance weightより幅／長さ誤差が改善し、triangle反転・透明割れを増やさない。
- 全weightがfinite / non-negative / normalized、最大2 influence、決定的。
- 保存済み旧Projectは無変更。明示再生成後も既存Skin schema、STALE、History、copy、reload、CPU / Pixi / exportが一致する。

## 7. Stop conditions

- 一枚alphaとBone geometryだけではbranch資格を安全に決められず、無言誤分類が避けられない。
- 新しい毎Frame zone評価、第二weight正本、複数Mesh schemaが必要になる。
- weight修正だけで幅／長さが改善せず、solver / topology置換を同時に必要とする。
- 既存Auto Shape Projectを暗黙再生成または破壊する必要がある。

該当時はproduction接続を行わず、明示chain selection、joint topology refinement、DQS比較を互いに分離した次Gateへ再計画する。

## 8. Model decision

- Stage A、Gate 1、人体branch分解、誤分類 / 保存境界、最終reviewはSOL / XHigh。
- Gate=`GO`後、入出力と拒否条件を固定できたpure helper / verifierだけLUNA / MAXへ分離可能。
- production Auto Shape adapterとUI判断はSOL review後に開始する。

## 9. SOL final review

判定: `A`

- 新weightは明示AUTO SHAPE生成時だけ既存`skinBindings[].vertexWeights`へ確定し、旧Projectやload時のweightを変更しない。
- branch外weightを無言で残さず、幾何的に曖昧な頂点は全生成を非mutation拒否する。直結親子以外、保存zone、runtime override、第二Skin正本は追加していない。
- runtime Skin evaluator、Mesh topology、preview / playback / onion / compositor / Bake / exportの評価入口は変更していない。既存の一つのinverse-bind LBS正本を維持する。
- clean Project保存でMeshをSTALE化しないよう修正し、明示Raster変更だけが従来どおりSTALEになる。
- manual weight、WEIGHT編集UI、DQS、stretch、複数Mesh、Attachment、WARP共有へ広げていない。

技術close可。Owner制作環境では、一枚人物Raster + 多branch Boneで顔・反対肢の不動、肘45° / 90° / 135°、幅・長さ、曖昧branch拒否、preview / playback / onion / random seek / Bake / GIF / APNG / Project reload、Undo / Redo、CAF複製、source更新STALE、console、pen / touchをまとめて確認する。問題発見時は本Phaseを暗黙に再OPENせず、Raster、Bone tree、失敗vertex / surfaceを固定した限定bug fix Gateを立てる。
