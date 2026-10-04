# WP-033 — 通常RasterのProject半透明PNG往復・司令監査

2026-10-05、main/871c51ed850f436aa0d49deb049bf7276c3a9655。Owner続行に基づく[限定Card](../work/WP-033-raster-project-alpha-roundtrip.md)。既存WP030とRIG dirtyを保持、未commit/未push。

判定: **VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING**。WP032で再現したProject往復HOLDを解消した。新RIGの全機能完成や製品採用へ拡張しない。

## Sourceと境界

[担当結果](WP-033-raster-project-alpha-result.md)の後、実source差分を確認。一般Rasterの保存を文字/吹き出し/コマで既に使用しているcanonical snapshot→Canvas2D.putImageData→PNG経路へ統一した。追加のextract.canvas/_unpremultiplyCanvasを除いた。includePathCollections:falseはLayerSystemで支持済み。保存PNG field/schema、load、bounds/recipe metadata、History、renderer、SOURCE authorityは不変。worker writeはProject export PNG block、新verifier、report/cacheだけ。司令はCard/案内/実fixtureの画素比較追補。SDK/CLI/runtime patch量0。

新verifierは実exportProject関数に低alpha/半透明/opaqueを渡す12 checks。Canvas encoderはmockであり、実PNG圧縮/復号やGPU往復の証拠にはしない。次の実Browser画素比較が別の証拠である。

## 実Browser・native→通常Raster→実Project

専用product18833の実index.htmlをwp029-rive-browser.htmlに読み込み、実UIの新RIG入口からlazy起動。独立native18729で保存済み素材の角56°、scrub End=1、変形を適用を操作し公式CLIで確定。製品fixtureを再読込し、新入口から同じnative readyを受け取り「現在フレームを新レイヤーへ」を明示操作した。

- native snapshot: angle56 / progress1、source SHA256 `276e588776bdbab33d75a6438153f947cca30f1f01fa2a9de41f93b4fcc7ddf9`、buildId `1791127258316-78b933`。
- 新Raster一件/History一件、command rive-frame-import、元絵canonical画素不変。300×180の透明原寸PNGを400×400 Canvas中央へ追加。
- Undoで追加だけ撤回して元Export復元、Redoで同じExport復元。
- 実ProjectManager.exportProject→loadProjectを通し、追加Rasterのcanonical画素と製品Exportを比較。Raster差0 pixels/0 channels/max0、Export差0 pixels/0 channels/max0。
- Raster SHA256 `1c069418f364181c894e0d3198cdc997e5cbe39c5a25e5ad7d053c34ffdea3db`。
- Export前後とも `5a01becb8fe4c45c74e158de256a67cf29ebd05b6fc6b29bb18b18b2443f72d8`。

前回と同じRaster/Export開始hashで、以前の1,018 pixels / 2,271 channels差が0になった。新RIG側の補償変形や許容誤差ではない。native RGBAとTEGAKI canonicalの既存readback量子化差は今回の変更対象外であり、両者の完全一致を主張しない。

wp030-balloon-text-browser.htmlの可視検証buttonも実Browserで実行。本文領域/通常Raster確定/recipeとPNGの実Project往復一致/更新Undoを含む23 checks PASS。gestureはfixtureのsynthetic操作なので、trusted液タブや実連続drag/wheelの受入へ拡張しない。

## 検証と未測定

司令: JS構文、新verifierを含むProject suite11/0 failed、製品build/font metadata27 PASS。担当のoffcanvas/transform/JSON compaction/folder往復もPASS。mock/静的検証と上記実Browserを分けた。文書harness/diff-checkとown lifecycleの最終結果は下の終了記録へ記載する。

固定SDK gateを再実行: cache-valid / rive1.3.0、runtime2.44.0。CLI SHA256 `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`、canvas_advanced.mjs `8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`、wasm `A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`。

未測定: 全embedded編集click、coarse pointer/pen/液タブ、長時間性能、全blend/filter/色空間、公開利用条件/製品採用/Owner制作受入。DPRとoffcanvasは既存限定verifierの範囲、今回の全実機matrixではない。多素材/mesh/IK/物理/Timelineは追加していない。

## 終了記録

own Vite PID64872、companion PID31104。Get-Process executable/starttime、netstat listener、health installationId `57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab`、receipt owned=trueとcreationTokenを照合した。司令作成tab14/15/16だけを閉じ、Vite stdin stop→server.closeで正常終了。2026-10-04 15:28:20 UTCのreceipt stopped/stopReason=vite-close、両PID無し/両port listener無しを確認。他者/reuse processを停止していない。

最終harnessは87 documents / 337 local links / 24 packages PASS、diff-check PASS。WP033 Cardの必須見出しを整え、別leadが記録した先行harness停止を解消。STATUS RIG節、Card、manifest、登録簿、GITHUB案内を限定更新。自動監視はapp toolでPAUSEDを維持し、保存済みpromptを最新の技術確認結果へ更新した。HEADは開始と同じ871c51ed、commit/push無し。制作受入は未。

15分間隔のcompact確認一回でWP033担当turn `01a1077a-bb0a-73f3-8238-fa75bd38d563` completed/idleを確認（cursor `3dd52516-1c76-4546-b09a-6bd66c10b380:24`）。旧WP032 completedではない。報告の12 checksと範囲は実source/司令Project suite/Browser画素の別証拠で監査した。
