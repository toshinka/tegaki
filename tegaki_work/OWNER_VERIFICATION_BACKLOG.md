# Owner実機確認バックログ

更新日: 2026-08-12  
状態: ACTIVE — Phase 7i〜7qはSOL技術close済み、Owner制作環境では未確認項目あり

## 目的

SOLの実装監査・固定verifier・Browser確認でcloseした機能について、Ownerが制作環境へ戻った時にまとめて確認する項目を保持する。ここに残る項目は「未確認」であり、「不具合確認済み」または「Phase未完了」を意味しない。

- Owner確認で問題がなければ各項目を完了へ更新する。
- 問題が見つかった場合は、閉じたPhaseを暗黙に再OPENせず、再現条件に応じたbug fixまたは新しい限定Phaseを立てる。
- 既存Projectを破壊し得る確認は複製Projectで行う。

## 未確認項目

### Phase 7i — Auto Shape LINE / Ribbon

- 適合する細長いalpha fixtureでAUTO LINE成功、0° / 45° / 90°、preview / playback / onion、random seek。
- GRID / SHAPE / LINE相互再生成、STALE / rebase、Table close / reopen。
- 腕、髪束、交差線、分岐、閉輪郭等の制作sampleで成功 / 拒否理由を記録し、LINEの実受理率と理由messageの次操作が理解できるかを確認する。
- 現在と異なるgeneratorをpen / touchで誤って押す頻度、`再生成`表示・status・Undoで十分に回復できるか、連続再生成時のHistory / memoryを確認する。実測前にmodal確認は追加しない。
- 制作Project、pen / touch、console error。

### Phase 7j — Deformer SELECT Stage 2

- Control MeshとFolder別WARPでRECT / CIRCLE / POLY、複数点move、Undo / Redo。
- 制作Project、pen / touch、Table close / reopen、console error。

### Phase 7k — Text to Raster

- 通常制作Projectでzoom / pan後のviewport中心配置、日本語 / ASCII / 複数行。
- Project reload、PNG / PSD、狭幅、pen / touch。CAF working Layerでは拒否されること。

### Phase 7l — Animation Table二段header

- 液タブ制作環境で1280px相当 / 狭幅の配置、設定から実行への左→右導線、Setup青 / 実行橙。
- header zoom、Lane上下、Timeline左右のwheel三領域、resize保存、close / reopen。

### Phase 7m — Motion Graph Viewer

- 長尺CAFで5 group、key / boundary / cursor、random seek / playback、Table close / reopen。
- narrow / low viewport、無効target、Clip外`OUT`、console error。

### Phase 7n — Resize Preview Direct Framing

- 通常Layer / CAF snapshotを含む制作Projectで「内容」drag / wheel / align / Apply。
- Undo / Redo、Project reload、mode離脱、close / reopen、pen / touch。

### Phase 7o — Motion Easing Preset Palette

- 制作Projectで単独 / Ctrl・Cmd複数Motion key、terminal混在拒否、Undo / Redo。
- Project reload後のpreset再識別、CUSTOM curveとの往復、random seek / playback / Graph表示。

### Phase 7p — Motion Easing Clipboard

- 制作ProjectでHOLD / LINEAR / CUSTOMを別Motion key・別ClipへCOPY / PASTEし、Motion値が変わらないこと。
- Ctrl / Cmd複数選択、terminal混在拒否、Undo / Redo、Table / Curve close-reopen、長尺CAF、pen / touch。

### Phase 7q — Motion Graph Key Navigation / Easing Bridge

- 長尺CAFで5 groupのexplicit key markerをmouse / pen / touchとkeyboardで選択し、Timeline、Graph cursor / status、CLIP MOTION数値、Canvas previewが同じFrameへ同期すること。
- implicit boundary / path / grid / cursorではseekせず、再生中はmarker activationとEASING編集を拒否し、Historyが増えないこと。
- HOLD read-only Curve、terminal disabled、Graph / Curve / Table close-reopen、random seek、narrow / low viewportでheader操作が重ならないこと、console error。

## close根拠

Phase 7i〜7qは各指示書のGate=`GO`、最終SOL review=`A`、関連Browser確認を完了し、2026-08-12時点の全57 verifier、変更JS / mjsの`node --check`、`npm.cmd run build`を通過した。2026-08-12のOwner指示により、これらを技術closeし、制作環境での確認だけを本書へ分離した。
