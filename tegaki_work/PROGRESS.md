# Tegaki Progress

更新日: 2026-07-13

## 現在地

- Phase 5aから5rまで完了。
- Phase 5rではLane visibilityの保存・preview/playback/export除外、閉Table Timeline onion、閉Table再生、Frame/Lane/CAF内部Layerの操作契約、PSDアクティブCAF初期選択を完了した。
- オーナー実機でLane visibility、PSD record順、通常再生のCanvas反映を確認済み。
- Phase 5sを完了。viewportの既存一経路を維持したまま、Lane並べ替えHistory、FPS連動の秒境界、compact Frame indicator、複数Laneを跨ぐドラッグ＆ドロップを確認した。
- Lane順変更はドラッグ＆ドロップ専用とし、余分な▲▼buttonを撤去した。`reorderLaneTo()` はLane D&Dの単一経路として維持する。
- Phase 5tを完了。Ctrl/Cmd複数選択、通常activeと選択集合の表示分離、相対Lane/frameを維持した原子的一括移動、衝突全体拒否、単一History Undo/Redoを実装した。
- オーナー実機で複数Laneを跨ぐ一括移動と、障害CAFがある場合に全件移動しないことを確認済み。
- Phase 5uを完了。複数CAF copy/pasteとCAF Groupを同じ相対配置payload・原子的一括配置へ載せた。
- Phase 5u Slice 0を完了。単体pasteはClipAsset/DrawingSnapshotを複製する独立コピーで、clipboardはruntime UI state、貼付け結果だけがproject保存対象となる契約を確認した。
- Slice 1で複数payload、相対Lane/frame paste、選択内Asset共有関係の維持、衝突/Lane不足の全体拒否、単一History Undo/Redoを実装した。単体paste回帰とproject round-trip確認が残る。
- Slice 2でTimeline直下のCAF Group、隣接連結判定、folder button、作成/解除、member click全体選択、History、保存復元を実装した。非連結選択はdisabled理由を表示する。
- 単体paste回帰、Group作成/解除/Undo/RedoはBrowser確認済み。Group paste時に新Group IDを払い出す処理を追加し、実操作確認が残る。
- オーナー実機でGroup移動・copy/pasteを確認済み。同一Lane連続Groupは外周破線へ統合し、Group中の個別retiming handle、↔、Duration ±を無効化した。
- Browserで中央memberからの一括D&D、Duration不変、中央member削除時の自動解除、Undo復元を確認した。Project保存は既存 `TimelineModel.serialize()` / constructor経路で `clipGroups` をround-tripする。
- CAF Groupの時間比率伸縮はTegaki側では原則実装しない。将来の別動画WEBUI側でkeyframe/retimingを正本にし、整数FrameへbakeしたCAF列を戻す長期案としてロードマップへ記録した。
- Phase 5vを開始。Folder blend完全合成は低優先度で棚上げし、Folder clippingを優先する。Slice 0でCAF `clippingMode` 3状態契約の回帰と通常Folder属性のProject保存欠落を修復する。
- Phase 5v Slice 0を実装。CAF `clippingMode` のモデル/serialize/toggle/clipboard/working Layer/preview alpha契約を復元し、通常Folderの `blendMode / clippingMode` をProject保存へ追加した。BrowserでCAF Folderの通常/逆、Undo/Redo、console errorなしを確認済み。実Project round-tripが残る。
- Phase 5v Slice 1でCAF Folder target/sourceの半透明alpha、inverse、source不在/空/非表示時の透明化、Folder merge後mode維持を実装した。Phase 5u `clipGroups` のProject serialize欠落も修復した。
- 後続はFolder visibility、Layerの直下Folderをclip sourceにする経路を優先する。Folder add/multiply/overlayは子へ伝播せずgroup全体へ適用する要望として監査し、完全group RenderTextureが必要なら低優先度の別Sliceへ送る。
- 通常Folder visibilityを配下Pixi Layerへ反映し、Folder直上Rasterのclip sourceとして配下可視Raster alphaを束ねるmask Container経路を追加した。固定入力、BrowserのFolder D&D/eye往復/clipping ON、node check、build、console errorなしを確認済み。
- オーナー実機報告から、mask ContainerではFolder配下Rasterが実maskへ反映されず、alpha乗算で半透明化する問題を確認した。通常/CAFのclip alphaを二値シルエットへ統一し、Folder sourceを単一textureへ合成する経路へ置換した。通常Folder card/属性popupのclip buttonと、Folder配下全Rasterを下位きょうだいsourceで切り抜くtarget経路も追加した。
- node check、build、二値alpha固定入力、BrowserでFolder clip buttonのnormal切替とconsole errorなしまで確認済み。Folder内複数Rasterのsource/target、inverse、Project round-tripはオーナー実機確認待ち。
- Folder target内部maskが通常Layer一覧へ混入する回帰を修正し、内部maskをowner Folder配下へ隔離した。mask resourceは専用poolで再利用し、OFF後の再ON、Album保存、Layer数不変、console errorなしを確認した。
- CAF化後のTable展開中/閉後でFolder clipping契約が変わる問題を修正した。CAF owner/source/Folder子孫解決を共有helperへ集約し、working Layerへ表示用mode/source ID群を橋渡しする。Frame compositorも二値maskへ統一した。
- Browserで通常Folder target構成をCAF化し、Table展開中と閉後の表示一致、Folder階層/clip ON維持、console errorなしを確認済み。上位LayerからFolder sourceを使う複合構成は固定入力済みで、オーナー実機確認が残る。
- CAF Folder clip切替時の遅延を調査し、working Layer契約の再計算漏れと、previewでcache確認前に全Canvasを再走査する重複を修正した。PREVIEW中のworking mask生成はidleへ送り、通常表示へ戻す前にflushする。
- 単一CAF LayerのV変形確定は対象Layerだけをsnapshot更新する。Browserの400×400複合CAFでclip切替、clip状態の再生、単一Layer V変形、console errorなしを確認した。
- Folder一括V変形は原子的rollbackのため全対象焼込みを維持する。巨大Canvas×多数Layerでは高コストになり得るため、既存size preflightを維持し、非同期分割は中規模History改修候補として棚上げする。
- Table previewのFolder node欠落、全非表示時の旧snapshot fallback、working実効visibilityのCAF正本への逆流を修正した。internal構造revisionをpreview keyへ含め、D&D/eye変更はFrame切替なしで反映する。
- Tableの一時runtime visibilityをclipping source正本から分離し、Folder target抑制解除時は元の表示を復元する。stroke開始時の不要な全mask再生成も除去した。
- Vドラッグ中はPixi transformを毎入力へ反映し、DOM/イベント/thumbnail副作用だけを1 animation frameへ集約した。CAF名single click選択とdouble-click renameも両立した。
- BrowserでTable展開中stroke反復、CAF名single/double click、console errorなしを確認済み。オーナー実機でVキー保持中のXY/回転/拡縮の体感再確認が残る。
- 高Hz penのcoalesced sample処理は全入力点と筆圧を維持し、RenderTextureへの同期描画だけを1 pointermove 1回へ集約した。Animation Table全面のbackdrop blurも撤去した。
- オーナー実機ではPC再起動後に通常/Table展開時のpen描画とVキー移動が滑らかへ復帰した。長時間ブラウザ/GPU状態またはHUION Kamvas 22 Gen 3ドライバの一時状態が関与した可能性があり、アプリ変更単独の効果とは断定しない。
- Ctrl/Cmd複数選択とCAF Group選択を原子的な一括削除へ接続した。BrowserでGroup/未Group各3件の一括削除、ボタンとAlt+Delete、Undo/RedoによるGroup・選択集合復元、console errorなしを確認済み。
- オーナー実機で複数選択CAFとCAF Groupの一括削除を確認済み。
- ProjectManagerの固定入力で通常Folderのparent/children、visibility、blend、normal/inverse clippingをexport/load往復確認し、CAF内部Folderもanimation serialize/TimelineModel復元を確認した。
- CAF inverse Folder sourceの複数Raster子孫、source非表示・削除・D&D順変更後の再探索を固定入力で確認した。Browserでは2 Frame描画のTimeline onion暖色表示、8 FPS再生/停止、GIF 1–2 Frameの400×400プレビューBlob生成、console errorなしを確認済み。
- オーナー実機で、実描画を持つ複合Folder構成の保存・再読込と出力に問題がないことを確認した。
- 大量Frame時にTimeline zoom controlが水平scrollbarを覆う問題を修正し、controlをheader rightへ移した。Timeline縮小は33%まで拡張し、60%未満ではFrame番号だけを隠して秒境界を維持する。Browserで240 Frame、通常幅/543px狭幅、33%/40%/47%/60%、scrollbar非重複、console errorなしを確認済み。
- Phase 5vを完了。Folder group blend完全合成はdirty group RenderTextureを要する別Phase候補として棚上げする。
- Overlay高度blend自体は登録済み。通常Folderが空Containerのため配下groupへ作用しないことが原因で、完全group effectはdirty group RenderTextureを要する低優先度Sliceとして残す。
- Phase 5wを開始する。既存ClipInstanceの静的transform、未定義形のtransformKeyframes保存枠、compositorの静的描画経路を監査済み。最初はkeyframe schemaとhold / linear samplingを固定し、position / scale / rotationを同一Frame契約へ載せる。
- Phase 5w Slice 0でClip-local 0-based Frame、同一Frame後勝ち、範囲外無視、欠損parameter継承、rotation radian、左keyのhold / linear契約を純粋sampling helperへ実装し、TimelineFrameCompositorへ接続した。rotationは負値と360°超の連続回転を保持する。固定入力とbuildは完了し、Browser実操作が残る。
- Phase 5w Slice 1の保存経路を監査。Project serialize/constructor、単体・複数CAF copy/paste、CAF Group paste、Timeline History snapshotは既存の `transformKeyframes` clone経路でround-tripする。固定入力でProject JSON、Group、旧Projectのkeyframe無し互換を確認済み。Browserでcopy/paste・Undo/Redo・保存再読込の実操作確認が残る。
- Phase 5w Slice 2で選択CAF・現在Frameへtransform keyを追加/削除する独立MOTION windowを追加した。position、scale、rotation（UI degree / 正本radian）、hold / linearだけを既存Timeline History経路で編集し、Clip範囲外では無効化する。Table headerはsquare-activity iconの入口buttonだけとし、編集面をbody直下へ分離した。開閉は共通popup CSSと競合しない明示display制御を使う。Browserで入力・補間・Undo/Redoの実操作確認が残る。
- MOTION windowは共通 `attachPopupDrag()` を使う移動可能popupへ揃え、closeを1個へ正規化、数値色をふたばmaroonへ統一した。key入口はmap-pin icon、Timeline上は明示motion keyを小markerで表示し、旧snapshot白丸は撤去した。60%未満ではmarkerを省略し、単Frame CAFではmotion編集を無効化する。
- 静的transformを暗黙のClip始点/終点とし、中間key後は終点へ戻るsamplingへ更新。Table preview、閉Table再生、Timeline onionのPixi previewにも同じsample結果を適用した。固定入力で最終Frame X=26/R=10°への補間と、中間Y=20から終点0への復帰を確認済み。
- MOTION数値変更後もcurrent Frameを維持し、再生・Timeline移動中は選択CAFのsample値をwindowへ追従表示する。pin active色、form focus/selection色、native number spinner撤去、Scale X/Yの説明を追加した。回転中心のVキー十字site共用と、MOTION外の灰色/黒form control全体監査はproposal 09の後続項目へ記録した。
- 右端retimingでは旧終端の明示motion keyだけを新終端へ追従し、中間keyはFrame位置を維持する。preview用retiming snapshotにもkeyframeを含め、キャンセル/可否判定でmotion正本を変えない。Clip Motion shortcutはV変形との意味対応を優先してShift+Vとし、両modeは同時表示しない。
- MOTION window active中のCanvas直接操作を追加。dragはscreen→world差分によるposition、wheelは縦横scale、Shift+wheelは5°単位rotationとして現在Frame keyへ入る。Canvas eventをcaptureして操作中だけ描画/Camera入力を止め、1 drag / 1 wheel burstを各1 Historyへまとめる。V変形のgesture量・scale上限を踏襲し、raster transform stateは共有しない。
- 共通 `transform-anchor-site` を追加し、MOTION locate buttonはClipInstance.transform.anchorX/Y、V locate buttonはLayer transform anchorへ同じCanvas十字dragを接続した。V panelの左右/上下反転はcenterline SVG、resetはrotate-ccw SVGへ変更。MOTION windowは共通popup自動close追加の対象外としてclose重複を防ぐ。
- anchor変更時は `(I - rotationScale) * pivot差分` をX/Yへ補正し、変更前後の表示matrixを不変にする。site表示は現在transform後のpivot、pointer位置はinverse matrixでlocal anchorへ戻す。V bake正規化でもanchorX/Yを保持し、preview/確定座標を一致させた。anchor mode中はCamera全面guideを隠して短い十字siteだけを表示する。Vの4 SVG操作は横一列・共通active配色へ整理した。
- 回転中心siteはV / CLIP MOTIONを開いた時点からpassive表示し、locate button ON中だけdrag可能にした。全面の縦横guideは表示せず、centerはLayerまたはClip単位で1つ、Canvas外座標も許可し、Frame keyを自動作成しない。MOTION fieldsは1行配置へ整理し、LINEAR / HOLDのhover説明を追加。CAFのV変形中は「原画編集・合成モーション一時非表示」を明示する。
- V panelの旧縦配置を起動時注入していた `ui-panels.js` の重複CSSを撤去し、4 SVG buttonを `main.css` の横一列へ統一した。Browserでpassive/active site、MOTION 720px一列、Vとの排他表示、console errorなしを確認済み。Canvas外anchorは固定入力でmatrix不変を確認した。
- V panelを `LAYER TRANSFORM` ヘッダー付きのcompact構成へ整理し、CLIP MOTIONと変形系popupの外観classを共用した。中心編集時は共通site横へ終了方法を示す追従hintを表示する。BrowserでV / MOTIONの排他、compact寸法、hint非重複、LINEAR / HOLD説明、console errorなしを確認済み。
- CLIP MOTIONのFrame key / 回転中心buttonをheaderへ移し、入力列を約488pxへ詰めた。Frame keyは丸marker対応のcircle、Clip単位anchorは将来Bone rootを想起できるhead付き楔形siteとし、Vキー十字siteとは表示だけを分けた。
- Phase 5wを完了。position / scale / rotation、hold / linear、anchor、Canvas操作、preview/playback/onion、copy/paste、Undo/Redo、旧Project互換を同じClipInstance正本へ接続した。Project JSON round-tripは固定入力済み。大容量Albumへの追加実操作は既存約105MBデータで長時間化したため再試行しない。
- Phase 5xを開始。Animation Tableの右方向キーによる空Frame CAF自動生成を設定checkboxで無効化できるようにし、既定ONを維持した。BrowserでOFF時はF3へ移動してもCAF 1件、ON時はF4に2件目を生成、Undoで1件へ復帰、設定再表示でOFF保持を確認した。後続は共通form/controlのふたばカラー監査とする。
- opacity、色補間、easing、Perform、簡易warp / morph、bone、WebGPU brush、水彩・油彩はPhase 5wへ混ぜず、`proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md` で段階管理する。

## 維持する契約

- Animation Table上では上側LaneをCanvas前面とする。
- stroke中の選択CAFは実working Layerで表示し、他CAFとonionだけをsnapshot previewへ回す。
- previewは非表示stagingで完成させてから一括交換する。表示中containerを空にして順次addしない。
- PixiJS v8の `removeChildren()` 戻り順を再利用しない。移送前の `children.slice()` の順を維持する。
- preview container順は `background -> back preview -> currentFrameContainer -> front preview` とし、同じ親上の連続 `setChildIndex()` へ戻さない。
- Lane onion / Timeline onionはdisplay-only。Layer visibility、ClipAsset、DrawingSnapshot、History、保存画像、exportへ混ぜない。
- PSD recordは背面から前面。通常LayerSystemは配列順をそのまま、前面から背面で持つCAF internal Layerだけを反転する。
- CAF working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本。

## 許容している残り

- CAF切替時に0.1秒未満の表示再構成が見える場合がある。stroke中の安定を崩してまで追わない。
- StrokeQualityFilter、墨・水彩的な蓄積、WebGPU brushは実機必要性と計測結果が出るまで保留。
- PSD全CAF一括export、通常LayerへのPSD import、CAF編集状態から通常モードへ戻す明示操作は未実装。

## 資料

- Phase 5q完了: `開発用資料保管庫/Archive/PHASE5Q_CLOSEOUT_2026-07-10.md`
- Phase 5q表示順の技術記録: `開発用資料保管庫/Archive/PHASE5Q_PREVIEW_ORDER_NOTES.md`
- Phase 5t完了: `開発用資料保管庫/Archive/PHASE5T_CLOSEOUT_2026-07-11.md`
- Phase 5u完了: `開発用資料保管庫/Archive/PHASE5U_CLOSEOUT_2026-07-11.md`
- Phase 5v完了: `開発用資料保管庫/Archive/PHASE5V_CLOSEOUT_2026-07-13.md`
- 旧Progress全文: `開発用資料保管庫/Archive/PROGRESS_ARCHIVE_2026-07-10.md`
- 現行ロードマップ: `開発用資料保管庫/proposals/00_計画索引.md`
