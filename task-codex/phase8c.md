# Phase 8c — Limited Skin Influence Correction Gate

更新日: 2026-08-14
担当: SOL / XHigh（Skin正本、History / generator lineage、Gate、最終review）、GO後のpure correction plan / fixture verifierだけLUNA / MAX候補
状態: OPEN — Gate 0 / authority auditから開始。production編集は未承認

## 1. Goal

Phase 7zのChain-local Joint Skin、Phase 8aのread-only WEIGHT診断、Phase 8bの多Bone Table整理を土台に、Auto Shape生成後の限定的なweight誤りを制作画面から安全に補正できる最小操作を選ぶ。顔・反対肢への微小漏れ、肘／膝のjoint band範囲、rigid区間の意図外blendを対象とし、描画評価は既存`skinBindings[].vertexWeights`だけを読み続ける。

自由paint brush、第二Shape zone正本、複数Mesh、DQS、stretch、Attachment、WARP共有は第一実装へ混ぜない。

## 2. Current evidence

- `chain-local-joint-v1`は明示AUTO SHAPE生成時にbranch外weight 0、rigid primary、直結親子の短いjoint bandを既存Skinへ確定するが、実制作形状の曖昧箇所を個別補正するUIはない。
- Phase 8aのWEIGHTは選択Boneの0 / blend / rigidを既存Frame evaluator座標で可視化できる。編集結果を同じoverlayへ即時反映できる可能性があるが、表示projection自体を編集正本にしてはならない。
- 現行`skinBindings[].vertexWeights`、Meshのstable vertex ID / index、既存CAF asset History、generator metadata / STALEが唯一の保存・再生成境界である。補正用の並行runtime deformerを作らない。
- Owner要望は自由な造形変形より、Boneから親までのchainだけへ影響を限定し、肘周辺だけ柔らかく、前腕中央を剛体に保つことが中心である。

## 3. Gate 0 questions

1. `A: chainへ含める / 除外`、`B: joint band幅の限定再生成`、`C: 選択頂点をBoneのみ / 親子blend / 影響なしへ確定`のうち、誤操作と保存情報を最小化しつつ制作上の漏れを直せる第一案はどれか。
2. 補正を既存`vertexWeights`へ直接確定し、正規化、最大2 influence、stable vertex対応、1操作1 History、Undo / Redoを維持できるか。
3. AUTO SHAPE / SHAPE再生成時に補正を無言破棄しないため、既存generator lineageとSTALEだけで警告・再生成拒否を表現できるか。追加保存fieldが必要なら何を最小正本とするか。
4. WEIGHT overlay上のhit testをMesh triangle / vertexへ限定し、Canvas描画、Bone操作、Space + drag、pen / touchと競合しない明示編集modeを作れるか。
5. 顔、胴、反対肢、肩／股関節のoff-axis branch、肘45° / 90° / 135°を固定fixtureでどう判定するか。

## 4. Initial boundary

- 一つのCAF内部Raster、一Mesh、選択Bone、既存Auto Shape Skinだけを対象とする。
- `skinBindings[].vertexWeights`を唯一の評価正本とし、Shape zone、weight mask、Bone色、別deformerを同時保存しない。
- 最初はfreehand weight brushを採らない。明示選択と離散的な補正候補をpure planで比較する。
- 補正前後でweight非負、合計1、最大2 influence、stable vertex対応、branch外epsilon 0を検証する。
- Project / emergency recovery / CAF複製、Undo / Redo、STALE / 明示再生成、preview / playback / onion / random seek / Bake / GIF / APNGの既存経路を変更しない。
- manual topology、Mesh頂点移動、multiple Mesh、IK / stretch、DQS、Attachment、physics、Textへ広げない。

## 5. Stage plan

### Stage A — authority / correction-plan audit

- Skin生成、weight正規化、stable vertex対応、Asset History、duplicate / removal、STALE / regenerateを横断監査する。
- A / B / Cを同じ一枚人物fixtureへ適用するnon-mutating pure planとして比較し、変更vertex、拒否理由、正規化結果、generator lineage影響を記録する。
- UI接続前に、遠隔部不動、joint band、rigid区間、triangle winding、Project round-tripをfixtureで固定する。

### Gate 1 — one correction behavior

- 保存追加0を優先し、誤操作が限定され、WEIGHT診断で結果を読める一つだけをStage Bへ送る。
- 補正保持に新しい並行weight正本が必要、既存再生成が無言破棄になる、または一操作一Historyが成立しない場合は`HOLD / REPLAN`。

### Stage B — limited authoring adapter

- Gate=`GO`後だけ対象file、入力、Acceptance Criteria、verifierを固定して接続する。
- production UIはSetup青RIG内の明示modeに限定し、display-only WEIGHTと編集操作の状態を混同しない。

## 6. Acceptance criteria

- 補正後も既存Skin evaluator / CPU / Pixi / exportが同じ`vertexWeights`だけを読む。
- 顔、胴、反対肢はepsilon内で不動、rigid区間はweight 1、joint bandは直結親子だけの最大2 normalized influenceを維持する。
- tap / no-op History 0、実変更1 History、cancel rollback、Undo / Redo、CAF複製、Project reloadが一致する。
- SHAPE再生成が補正を無言破棄せず、明示確認・拒否・既存lineage維持のいずれかを一意に行う。
- WEIGHT、NAMES AUTO / ON、Table Bone group、Timeline wheel、Space + drag、preview / playback / onion / Bake / exportを壊さない。

## 7. Stop conditions

- 自由paintを先に入れないと一つも制作課題を直せない。
- 補正のため第二weight evaluator、毎Frame zone評価、保存Skinの並行正本が必要になる。
- vertexのstable対応がなく、Raster再生成 / CAF複製で別頂点へ誤適用する。
- WARP / clipping / multiple Meshとの同時適用を前提にしないと成立しない。

## 8. Model decision

- Stage A、Skin / History / regenerate境界、Gate 1、UI mode判断、最終reviewはSOL / XHigh。
- Gate=`GO`後、入出力と拒否条件が固定したpure correction plan / fixture verifierはLUNA / MAXへ限定委譲可能。
- 保存schema、History統合、manual brush gesture、Mesh topology変更が必要ならLUNAへ渡さずSOLへ戻す。
