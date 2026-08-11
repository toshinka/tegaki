# Phase 7o — Motion Easing Preset Palette

更新日: 2026-08-12  
担当: SOL / XHigh（契約・pure helper・review）、限定UI adapterはLUNA / MAXまたはSOL  
状態: OPEN — Gate 0 `GO`、Stage A / B、SOL review 1=`A`、Owner一括確認待ち

> Phase 7i〜7nはOwner一括確認待ちのままOPENを維持する。本Phaseは各Phaseの保存正本とclose条件を変更しない。

## 1. 目的

既存Motion keyの`interpolation / easing`へ、固定cubic-bezierのSoft / Strong Ease、Sine、Circular presetを追加する。preset名は保存せず、選択した1 keyまたはCtrl/Cmd複数選択したMotion keyへ既存4 control pointを1 Timeline Historyで確定する。

## 2. Gate 0

判定: `GO`

- 保存正本は既存`ClipInstance.transformKeyframes[].interpolation / easing`だけ。preset名、selection、palette状態をProjectへ追加しない。
- 現行複数KEY選択はruntimeの`clipId + kind + targetId + frame`であり、同一ClipのMotion keyだけを抽出できる。
- preset適用はkeyのMotion値、Frame、blendModeを変更せず、既存`updateClipTransformKeyframesFromExternal()`から1 Timeline Historyへ記録できる。
- terminal key、存在しないkey、再生中、未知presetを含む場合は一括変更しない。

## 3. Stage

### Stage A — pure preset catalog / atomic apply

- 現行EASEをSoft familyとして維持し、Strong / Sine / CircularのIN / OUT / IN-OUTを固定4値で追加する。
- N key適用をpure planとして導出し、失敗時は入力配列を変更しない。
- LINEAR / HOLDへ戻す時は古い`easing`を残さない。

### Stage B — CLIP MOTION限定adapter

- 既存Interpolation selectをfamily別optgroupへ整理する。
- 現在keyが複数選択に含まれる場合だけ選択中Motion key全体へ適用し、それ以外は現在keyだけへ適用する。
- Warp / Bone / Part keyを対象へ混ぜず、1操作を既存Timeline History 1件にする。

## 4. 非対象

- Bounce / Elastic / Loop、overshoot / Back、範囲外control point
- Easing copy / paste、Graph上のkey編集、Motion Path
- parameter別easing、保存preset名、新しいselection schema
- WARP / Bone / Part easing、Timeline DOM全面置換

## 5. 受入

- 12 cubic presetが選択後に同じIDへ識別され、4値が0..1内で決定的。
- 複数Motion key適用が1 HistoryでUndo / Redoでき、Motion値とFrameを維持する。
- terminalを含む複数選択、再生中、未知presetは原子的に拒否する。
- Project reload後も4値から同じpreset表示へ戻り、custom curveはCUSTOM表示を維持する。
- random seek / playback / Graph / preview / exportの既存sampler結果が一致する。
- console errorなし、関連verifier、全verifier、buildを通過する。

## 6. 実装・検証結果

- 現行3 EASEをSoft familyとして維持し、Strong / Sine / CircularのIN / OUT / IN-OUTを追加した。計12 presetは保存名を持たず、既存cubic-bezier 4値へ確定する。
- pure helperで対象Frameの重複除去、key存在、terminal、preset妥当性をmutation前に検査し、LINEAR / HOLDでは古い`easing`を除去する。
- 現在keyがCtrl/Cmd複数選択へ含まれる時だけ同一ClipのMotion key全体へ適用し、それ以外は現在keyだけに限定する。Warp / Bone / Part選択は混ぜない。
- SOL review 1ではHOLDに同じpreset表示の古いcurveが残るcaseを検出し、保存field一致で`changed`を判定して除去するよう修正した。判定`A`。
- Browserで12 preset表示、F1 / F3複数適用がHistory 1件、非選択F5維持、Undo / Redo、terminal F6拒否とHistory不増加、console warning / error 0件を確認した。
- 変更JS / mjsの`node --check`、全56 verifier、`npm.cmd run build`を通過した。build warningは既存のag-psd `util` externalizationとchunk sizeだけで、生成差分は清掃した。

Owner明示受入前にcloseしない。
