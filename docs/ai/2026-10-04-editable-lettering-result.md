# WP-025 — 漫画の再編集文字・検証記録

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。2026-10-04、main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。既存WP-023/024とQTP差分を保持、agentによるcommit/pushなし。範囲は[Card](../work/WP-025-editable-manga-lettering.md)。

## 実装

- QTPの一回限りの文字入力を漫画の「文字」tabへ移設。元のRaster画素を移行・変更しない。
- 文字全体の移動・回転・四隅拡縮、縦横・字間・行送り・縁取り、末尾サイズの勾配。回転は表示枠の中心、拡縮は反対側の角を固定。
- 直線・波・楕円・折れ線・自由曲線の配置線。点追加はBezier分割で形を維持、点移動・角/滑らか・削除、局所gridと点snap。閉線は楕円presetに含む。追加上限64点を説明する。
- 平行四辺形・遠近・弧・波・膨らみ・先細りと3×3の9点変形。変形前boundsと変形後boundsを分け、guideの二重変形を避ける。
- 既存FontLibrary、tree、ホイールジョグ、比較page、favorite/Primary/収納先を利用。Eの個人用実体をGit/buildへ追加しない。
- imported字体はHarfBuzz.js `1.6.2`を固定し、ローカルWASMで組版・輪郭取得。MIT系noticeを`tegaki_work/licenses/harfbuzzjs.txt`へ保持。外部CDN依存なし。
- 共用候補の純幾何と文字model、font専門部品、描画、UI、Raster/History adapterを分離。正式Vector Layer、Anime/penへの接続は追加していない。

## 画素・再編集の境界

通常LayerのRenderTexture/PNGが表示・保存・出力の正本。optional `lettering={version:1,params,fingerprint}`だけを再編集用に保持し、font bytes・outline cache・UI状態はProjectへ入れない。追加/更新は画素と情報を一回のHistoryで扱う。LayerSystemは情報をHistory通知前に添付する。

手描き後の画素/boundsの不一致と、まだ焼き込んでいないLayerの移動/回転/拡縮を検出し、更新を拒否して別Layer追加を案内する。解析失敗・font不足・処理中の対象変更・History処理中・CAFには変更を加えない。部分restoreやHistory記録の失敗は元snapshotと情報へ戻す。

再編集中だけ元spriteの表示を外して二重表示を防ぐ。元texture/保存visibilityは変更しない。PNG出力と合成snapshotは確定画素を一時復帰して採取し、finallyでpreviewへ戻す。閉じる/取消で元表示へ戻る。文字LayerのPNG保存ではLayerSystemのstraight-alpha snapshotを直接encodeし、二重のalpha補正による再編集hashの崩れを防ぐ。

## 検証

| 層 | 結果と範囲 |
|---|---|
| 構文 / build | 変更JSの構文、Vite production build PASS。公開検査は27個のmetadata参照のみ、元fontなし。HarfBuzz WASMはbuildに含まれる |
| 幾何 / model | cubic分割の保形、閉線、距離表、snap、座標往復、全envelope、sanitizeと上限 PASS |
| 実engine | JS内生成の小さなSFNTを実HarfBuzzで処理。輪郭の穴・CPU画素、library別cache隔離、全配置点の33/27px移動、identity9点の無変形一致、previewOnly、容量拒否、指数SVG座標、WOFF/端末warp拒否 PASS。個人font/binaryに依存しない |
| Layer adapter | 追加/更新の1History、paired Undo/Redo、非表示RGB、手描き/bounds/外部変形の保護、非同期対象再検査、並行拒否、失敗rollback、previewとcapture PASS |
| 関連検査 | editable-lettering 5/5、fonts 5/5、balloon 1/1、Project 10/10、QTP progressive-density / shortcut-learning-boundary PASS。harness checkとdiff whitespace PASS |
| 実Chromium・統合 | 専用[fixture](../../tegaki_work/build/wp025-lettering-browser.html)で実Eの源暎アンチック、通常LayerSystem/History/ProjectManagerを使用。追加→更新→Undo/Redo、実PNG/Project保存・再読込後の再更新、手描き後拒否、font不在で変更0、旧Project、編集中のPNG/合成採取一致 PASS |
| 実Chromium・UI | タイトル、波のゴゴゴ、楕円文字。全体移動/反対角固定拡縮/中心固定回転、grid有効時の点追加、点移動のsnap、角/滑らかと削除、9点ドラッグ、編集内Ctrl+Z、追加/読み込み/更新/取消、font wheelと比較選択同期/閉じる PASS |
| camera / 狭幅 | 水平flip＋zoom＋15度camera回転で9点handleがマウス位置へ一致。360×720pxで文字欄14..354px、18..714px。比較は一列へ切替、閉じる操作可。通常viewportへ復帰 |
| preview応答 | 実font読込済みのゴゴゴ/波線64px、12回の輪郭更新で初回中央値2.4ms/最大2.9ms、最終確認中央値1.8ms/最大3.0ms。font cold取得・WASM初回・全UI frame時間を含めない。dragは画素を作らず、32ms周期で最新入力へまとめる。継続要求で更新が止まらず、取消後に遅い結果が復活しないことをfixtureで確認 |
| font取得 | 未読込F910新コミック体のensureLoadedは42.0ms、直後の同じfont再利用は0.0ms。アプリ内初回でありHTTP/OS cacheの状態は分離していない。外部Webからの再downloadを意味しない |

広いUI suiteは48件中39 PASS、9 FAIL。8件はHEADのソースを読む比較probeでも同じ失敗、1件は未変更の`ui/layer-panel-renderer.js`のCRLFへ検査regexが依存したもの。今回の変更由来のpassとして数えず、対象外の修正も行っていない。

対象外の9件: `verify-animation-table-utility-lod-production`, `verify-layer-panel-theme-surface`, `verify-rig-workspace-host-ownership`, `verify-right-layer-caf-focus-production`, `verify-right-rig-pre-mesh-candidate-focus`, `verify-sidebar-action-semantics`, `verify-sidebar-rail-attention-hierarchy`, `verify-touch-shortcut-help-gate`, `verify-ui-surface-token-bridge`。

## 利用条件と残る範囲

TTF/OTF/TTCの輪郭経路。WOFF/WOFF2は今回のHarfBuzz部品では未対応と表示して拒否する。端末fontは通常の直線文字用Browser経路で使え、曲線/warpには実体fontの取り込みが必要。未対応字形は理由を返し、別fontへ無言置換しない。

CAF編集、SVG/vector書出し、正式Vector Layer、接線handleを自由につかむ詳細編集、任意mesh、Anime morphは対象外。pointの独自規格を既存Anime WARPへ渡していない。frameごとの長時間性能、全font全字形/結合濁点の制作品質、液タブ/coarse実機とOwnerの最終制作受入は未確認。保存済み画素はfontがない環境でも表示・出力できる。

利用経路: 漫画→文字、書体/文字/配置線/変形を調整→追加。確定Layerを選択→レイヤーから読み込み→更新。欄にfocus中のCtrl+Zは編集内の操作を戻し、LayerのUndo/Redoは文字欄を閉じて操作する。
