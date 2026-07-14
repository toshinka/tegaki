# Phase 5z3: Clip Motion blend parameter

完了日: 2026-07-14

## 目的

Clip Motionの加算・減算・Overlayを、既存ClipInstance正本へ安全に追加する。離散blend modeと連続strengthを分離し、Layer / Folder blendやopacityの正本を上書きしない。

## 実装結果

- 「OL」は既存Layer UIとの整合から `OVERLAY` とし、省略表記をUIへ出さない。
- 最小mode集合を `NORMAL / ADD / SUBTRACT / MULTIPLY / OVERLAY` とした。`transform.blendMode` と各 `transformKeyframes[].blendMode` の任意fieldとして保存する。
- blend modeはLINEAR選択時も左key HOLDの離散parameterとする。欠損は直前値、旧Project・不正値は `normal`。
- `blendStrength` は0..1（UI 0–100%）の連続scalarとし、指定blendで合成するClipのopacityとしてhold / linear samplingする。Clip全体opacityとはschemaを分ける。
- CAF内部Layerを先に完成Clipへ合成し、その一枚を下側LaneへClip blendする。Layer blendとClip blendは `CAF内部Layer blend -> 完成Clip blend -> 下側Lane / background` の順で両方作用する。
- Table previewは完成ClipのPixi blend、TimelineFrameCompositor / animation exportは同じsample結果によるCPU pixel合成を使う。
- Motion windowを二段化し、Rotationを幾何変形の上段、pivot / BORNをkey button直後へ配置した。
- Motion metadata変更時にpreview cacheを無効化し、破棄対象の完成Clip `cacheAsTexture` を解除する。旧NORMAL / Strength表示が残る回帰を修正した。
- Motion clipboardはv4でblend mode / strengthを保持し、旧version貼付けは未対応fieldを変更しない。PSD recordは `subtract` を保持する。

## 検証

- 変更JSの `node --check`、固定入力、`npm.cmd run build` を完了した。
- Browserで5 mode表示、ADD / SUBTRACTの保持、終端OVERLAY、popup二段収まり、console errorなしを確認した。
- F1=0%、F3=100%のADD keyでF2=50%のlinear sampling、実描画、二段表示を確認した。固定入力で0 / 50 / 100%のCPU合成結果を確認した。
- オーナー実機でClip blendとstrengthの数値推移を確認した。
- animation exportとの見た目一致は、実制作中の継続評価へ移した。問題が出た場合はPhase 5z3を再開せず、再現条件を固定した独立修正として扱う。

## 維持した境界

- Folder / internal Layer blend UI、clipping、色補間、easing、Performを変更しない。
- bake、subframe、Bone、mesh、morph、physics、WebGPUを混ぜない。
- keyframeなし旧Projectはnormal / strength 1で従来表示を維持する。
