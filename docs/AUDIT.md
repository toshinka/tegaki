# 2026-09-05 再監査の根拠

状態: CURRENT EVIDENCE。開始基準 `8c5748f5`。別projectのcommitが進んでもTegakiの比較対象を分ける。
調査時の製品runtime変更は0。read-only subagentの所見は主担当が該当コードを照合して統合した。

## 調査済みと限界

- 根本思想/規則: AGENTS、TEGAKI、PROGRESS、9q、handoff、旧Architecture/境界、UI map、主要proposal。
- コード: 起動/依存接続、Drawing入力/Brush主要経路、Layer snapshot/Transform、History、Project save/load、Export入口、Timeline model/effect setter/lifecycle、render plan、CPU consumer。
- 歴史: 5e History契約、PSD/CAF診断、6c WARP masking、9m responsive header、9p対象LayerのOwner correctionを抽出。
- 検証: 既存147 verifierを実行。repo rootで4件CWD依存失敗、`tegaki_work`で再実行して147/147 pass。4件はGitHub URL、Motion gesture、Pixi、Vite検査。
- 機械的棚卸し: tracked Tegaki 378 files、build/lib等を除いたJS候補170。主要最大fileはPopup 24,330行、LayerSystem 5,746、LayerPanelRenderer 4,950、QTP 3,311、Animation model 3,239。空行を含む2026-09-05時点の参考値。
- 147件中source/text-only候補56、コード実行候補91という粗い分類。後者にmock/simulationを含む。数字だけをcoverageにしない。

未調査: 全solverの全制約、全codecの実画素/透過/長尺/abort、全旧Project形状、全UI入口、長時間pen品質、全GPU経路、全Archive本文。
資料の全件精読は完了条件にしない。根拠のない「プロジェクト全体完成」を宣言しない。
BrowserのKEY不具合は前作業で観測した証拠を継承。今回すべての実機試験をやり直していない。

## 現在の機能状態

| 領域 | 確認結果 | 主なコード根拠 |
|---|---|---|
| ラスター描画/筆圧/coalesced入力 | 実装あり。長時間性能や全画材は別受入 | drawing/pointer-handler.js、brush-core.js、stroke-recorder.js |
| Layer/Folder/selection/clip編集 | 実装あり、通常/CAFのadapter分離あり | layer-system.js、pixel-selection-system.js、layer-panel-renderer.js |
| 独立Lane/Asset/Clip/Snapshot | 実装あり、旧linked互換も残る | animation-data-model.js:196,301,369,626,679,2995 |
| root Motion/Layer Motion/Graph/Easing | 実装あり、操作順と出力拒否に穴 | clip-transform-sampler.js、clip-layer-transform.js、motion-graph-key-edit.js |
| WARP root/Folder/Layer | model/評価/保存あり。Simple Layer UI未完 | clip-deformer.js、clip-layer-deformer.js、layer-warp-edit-transaction.js |
| Rig/Bone/限定IK/Mesh/Skin | 実装あり。全組合せを許可していない | part-rig.js、two-bone-ik.js、raster-bone-skinning.js |
| Project/Album/Recovery/Export | 実装あり。terminal/破損load/実codecは追加監査 | project-manager.js、export-manager.js、album-storage.js |
| Physics/Perform/Animation Camera/AI | 保存予約や計画はあるが完成とは確認していない | physics field、proposal 05/12/15/16 |

## 再現済みの不具合と仮説

行番号は監査時点。header整理後は関数名で検索する。

### F-001 History redo失敗時index

事実: `history.js`のredo内catchと外catchが両方indexを減らす（143〜154）。
read-only probe: A/B record → B undo（index=0）→ B.doをthrow → redo後index=-1、期待0。
主担当も二つのcatch経路を照合。通常成功時と区別し、[WP-001](work/WP-001-history-failure.md)へ。
別負債: push失敗前にredo枝を切ること、composite byteSizeの未集計。今回同時修正しない。

### F-002 effect排他が操作順で破れる

事実: `animation-data-model.js:setClipLayerDeformer`はRigを拒否（893〜910）、`registerClipAssetRigPart`は既存Layer effectを調べない（938〜952）。
メモリ内probe: WARP追加成功 → 同Raster RIG登録成功 → validation/render plan unsupported。
解除も同じsetterを経由し、競合時`removeClipLayerDeformer`が拒否される（934）。
共有Assetの全Clipへ影響する。[WP-002](work/WP-002-effect-guards.md)。

### F-003 Layer Motionのunsupported出力

事実: `folder-part-render-plan.js`はRIGとの重複をunsupportedとする。
CPU `timeline-frame-compositor.js:_renderClipEntry`（287〜297）はLayer WARP/Skinのassertを呼ぶがLayer Motionだけのunsupportedで進める。
stubでその呼出経路まで確認。実出力でMotionが欠落する可能性は推論であり、実Canvas比較は未実施。[WP-004](work/WP-004-output-terminal.md)。

### F-004 KEY確定後のpanel消失

前作業のproduction実機: 2Frame CAFでV変形 → 未確定丸 → KEY確定 → History +1、丸は確定、panel消失、toolbar V残留。
原因未確定。`layer-system.js:_resumeLayerTransformTimelineSession`の失敗時は`layer:transform-exit`を発しないためtoolbar残留はコードで説明できる。
active/working Layer identityとadapter begin拒否reasonを捕捉する。推測rAF retryで覆わず[WP-003](work/WP-003-key-continuation.md)へ。

### F-005 複製の時間effect不一致

事実: `duplicateClipAssetInternalLayer`（1960〜2108）はFolder/Layer WARPとMesh/Skinを複製するがLayer Motion tracksを複製しない。
メモリ内probeで複製先WARP targetあり、Motion元IDのみを確認。望ましい複製意味は[HD-003](ROADMAP.md#human-decisions)の判断事項。

### F-006 保存と出力の未確定編集

ProjectManagerはsave前にselection/Transformを確定する（44〜52,772）。ExportManagerの該当入口はselectionのみ（122,193,314）。
この差が仕様かbugかは現行操作比較前に決めない。旧「Vは必ずRaster bake」の一般文はANIMATEには不正確。

### F-007 描画座標の説明不一致

DrawingEngineがclient→localを求めても、BrushCoreへclientを渡し再計算する箇所がある。
`drawing-engine.js:194〜201,366〜376`と`brush-core.js:257〜259,450〜452`。
同じ入力の重複計算であり二重local変換と断定しない。再構成候補、品質変更は後送。

## 文書の矛盾

| 旧文書 | 矛盾/古い状態 | 再構成での扱い |
|---|---|---|
| ARCHITECTURE | Animationを未接続扱い、存在しないbakeTransform名 | 旧版を保存、新Architectureへroute |
| PHASE4Z_BOUNDARY | 内部編集をミラー/将来、Layer Panelを作り込まない | 安定原則を現行へ継承、移行制限は歴史扱い |
| PROGRESS | 9q A〜D完了とA完了が同居、完了Phaseが長く累積 | STATUSへ現在地を集約 |
| TEGAKI | 5系ロードマップが残る、SOURCE限定契約をV全体へ一般化 | 技術契約へ縮小しSOURCE/ANIMATEを明示 |
| proposal 00/01 | 次Phaseと完了列が累積、現在9p記述 | 新ROADMAPへroute、原文保持 |
| Drawing WARP proposal | 冒頭にfieldなし、後半に実装あり | Gate当時の入力としてREFERENCE、作業指示にしない |
| OWNER_VERIFICATION_BACKLOG | 9m visual NG/未close文が後の受入記録と併存 | 歴史記録を残し、新しい受入記録を優先する注記 |

## 過去の失敗から維持する資産

| 根拠 | 残す契約 |
|---|---|
| Archive/PHASE5E_AUDIT.md | do/undo契約の不一致を直す。class階層追加自体を解決策にしない |
| Archive/PSD_CAF_IMPORT_FAILURE_INVESTIGATION_2026-07-01.md | Asset/Instanceは既に分離されていた。外部説より実mutation/History範囲を調べる |
| Archive/phase6c.md | CPU/build成功でもPixi root/childのposition/blend差でmask崩れ。実renderer比較を残す |
| Archive/phase9m.md | 760px breakpointで三行化。保存位置/再入場/実サイズの視覚受入を残す |
| Archive/phase9p.md | root Motionの内部行echoでは対象意図を満たせない。Layer ID単位のWHAT一致を守る |
| brush-core / ProjectManager現コード | bounds拡張前baseline、patch/full fallback、無変更saveのSnapshot ID維持、旧Folder復元、mask解除順 |

## 検証基盤の判断

source verifierを捨てず役割を明記する。`verify-*-production`という名前でもsource文字列検査だけのものがある。
旧rollup vendor生成入口は現行npm scripts未接続、依存も未導入。通常Vite buildへ混ぜない。
CIは現行repoに未設定。今回ローカルrunnerを作り、外部CI導入は別途環境/実機手段を決める。
全testでpassしながらF-001/F-002が再現した事実を、失敗系/操作順/terminal試験の追加理由として残す。
