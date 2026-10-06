# WP-039 Rive 多関節ワークベンチ — UI result

2026-10-06。UI owner範囲だけを実装した。backend/model/server、既存の`editor.js`/`editor.html`/runtimeは変更していない。

## 実装

- `tegaki_work/advanced/rive-editor/workbench.html` を新画面として追加した。元画像上の独立SVG layer、関節/45点warp/weights選択、日本語labelとtestid、適用・変更を戻す、ポーズ、保存、PNG保存、AI snapshotを用意した。
- `tegaki_work/advanced/rive-editor/chain-controller.js` を追加した。2〜8関節のlocal chain、腕3関節/ヘビ6関節preset、45点row-major、weights、raw文字列とfield validity、数値入力、選択、marker drag、Apply/Discard、SVGの実CTM優先とpreserveAspectRatio letterbox fallbackを担当する。画像変形・Rive評価・canvas readbackは持たない。
- `tegaki_work/advanced/rive-editor/workbench.js` を追加した。`RiveNativeRuntime`と`PlaybackController`を既存契約のまま接続し、`POST /api/compile {chain, progress}`をApplyごとに一回だけ呼ぶ。draft中は保存、PNG、再生、scrub、frame requestを拒否し、parent frame protocolのorigin/source/version/session/request/build/document gateを維持した。
- 診断detailsの「描画を検査」buttonは明示クリック時だけnative canvasのRGBAを読んで`rgbaSha256`、透明pixel数、寸法、progress、sourceHash、`overlayComposited:false`を表示する。通常のplayback tick、scrub、parent frame requestにはreadback/PNG生成を置いていない。
- `tegaki_work/build/verify-rive-chain-controller.mjs` と `.cache/rive-editor/wp039/ui/wp039-chain-ui-verification.json` を追加した。

## 検証

実行したcommand:

```powershell
node --check tegaki_work/advanced/rive-editor/chain-controller.js
node --check tegaki_work/advanced/rive-editor/workbench.js
node tegaki_work/build/verify-rive-chain-controller.mjs
```

結果はsyntax PASS、UI verifier `16/16 PASS`。verifierはpreset payload、45点/weights長、selection draft 0、raw `5`保持、空欄の独立validity、invalid Applyのcallback 0、DiscardのApply 0、valid Apply一回、dispose後stale、非正方形・padding SVGのletterbox fallback、static wiringを確認した。

## 証拠境界

- Technical/static/controller: **PASS**（上記command、cache report）。
- 製品build、実server、Browser DOM/layout、native Rive 0/0.5/1、通常host frame受渡し、保存/Reopen実測: **UNVERIFIED**。rootの統合監査対象。
- Owner acceptance、commit/push: **UNVERIFIED / Owner**。

新規source行数は `chain-controller.js` 836、`workbench.js` 565、`workbench.html` 182、`verify-rive-chain-controller.mjs` 222。既存dirty差分は保持し、commit/push、live server lifecycle変更、API mutationは行っていない。
