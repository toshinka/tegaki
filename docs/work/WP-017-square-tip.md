# WP-017 角ペン / 角消しゴム（ペン先の形）

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-02。

## Goal

QTP二行目の筆プリセットに「角ペン」と「角消しゴム」を入れる。四角いペン先で、進む向きによって線幅が変わる。

## 設計

- ペン・消しゴムはdab（スタンプ）方式（`airbrush-dab-renderer.js` の pen dab）。丸は円形falloffのtexture。**角**は外周1texelを透明にした硬い四角のtextureを、`width = 径`・`height = 径 × アスペクト`・`rotation = nibの角度` で置く（本番strokeにCanvas2Dは使わない契約を守る。textureは起動後に一度だけ作る）。
- 設定キー（`SettingsManager`、筆プリセットが保存・適用する）: `penTipShape`('round'|'square') / `penTipAspect`(0.15〜1) / `penTipAngle`(0〜179°)、消しゴム側は `eraserTip*`。ストローク中は `_buildDabMaskSettings` が読むだけ。
- 組み込み: ペン `角ペン`（角・厚み0.4・35°）、消しゴム `標準`(丸) / `角消しゴム`(角・正方形)。**古い（ペン先の形を持たない）プリセットを当てると丸に戻る**（`BRUSH_PRESET_DEFAULTS`）。一致判定も既定値で比較する。
- UI: QTP二行目に消しゴムのプリセット行（標準 / 角消しゴム）。アイコンは lucide の `square-pen` と `eraser`（角消しゴムは反転）。設定の筆プリセットに「消しゴムのプリセット」と「QTPに出す」。

## 確認（Chromium）

- 角ペン（径30、厚み0.4、35°）: nibの長軸に沿って引くと太さ12、直交して引くと30.5（設計どおり 0.4:1）。見た目は端が角ばった線。
- 角消しゴム: 矩形で角のある消し跡。古い「つけペン風」を当てると丸に戻る。
- 検証: `verify-pen-brush-engine.mjs`（プリセットのキー・既定値適用・一致判定・アイコン）。

## 未確認・次

- ペン先の形・厚み・角度を直接触る設定UI（今はプリセット経由のみ）。ユーザー保存プリセットには現在の形が含まれる。
- `ミリペン風` は ease-out で筆圧を弱めた近似。筆圧に径が全く依存しない固定幅にする `pressureSizeEnabled` は未実装。
- 傾きに応じてnibが回る（ペン先の向きを入力の傾きに追従）は未対応。
- Owner実機（液タブ）は未確認。
