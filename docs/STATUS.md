# Tegaki — 再開checkpoint

状態: WP-001 / WP-002 / WP-003 / WP-006 DONE（Owner操作感は未確認）。WP-004 ACTIVE。
更新日: 2026-09-07。現在HEADは`c5ddf8c45fe5df40122497112f53d1b352b60950`。再開時にlive HEADと既存差分を確認し、WP-004の限定監査を継続中。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

WP-006のFolder自身Motion KEYは技術完了。次の[WP-004](work/WP-004-output-terminal.md)で未確定Transformとunsupported Motionのsave/export terminalを監査する。

## COMPLETED

- 前回の文書/正本/語彙/ロードマップ/5 WPを継承。読む順序・対象scope・local link・harness依存を再レビューし、再構成上の阻害事項なし。
- [WP-001](work/WP-001-history-failure.md) DONE。実HistoryManagerで修正前のindex二重減算を再現（actual=-1 / expected=0）。
- redoのdo成功後だけindexを進める局所修正。実行失敗はindex不変、実行成功後の通知失敗は適用済みindexを保持、finallyでisApplying解除。
- 新規verifierは初回/中間/末尾、連続例外、以前のUndo、再試行、通知例外、部分mutationの限界を確認。
- History関連5/5、全verifier148/148、構文確認、Vite build成功。出力は専用Temp、dist変更なし。
- read-only agentの呼び出し側/Raster Patch/最終diffレビューを主担当が統合。コード変更は主担当だけが実施。
- WP-001製品差分はhistory.jsのredo内のみ。
- [WP-002](work/WP-002-effect-guards.md) DONE。モデルの共有Asset/Folder配下preflight、Motion/Rig/Mesh/clippingの指定追加順、既存WARP解除を補修。
- Owner許可でMotion bridge開始/previewの対象検査を追加し、model setter迂回を封鎖。UI構造/操作は不変。
- 修正前WARP→Rigの誤成功を基準commitの実modelで再現。修正後の拒否deep-equal、無関係target保持、解除、model往復・隔離caller/History試験が成功。
- 最終全149 verifier・構文・Vite build成功。製品変更はanimation-data-model.jsと限定popup検査、build出力はTemp、dist不変。

## CURRENT STATE

WP-001は非UI・同期例外経路を実production classで検証して完了。Browser/Owner実操作は今回未実施であり、受入済みとは記録しない。
WP-002は指定経路の技術完了。Browser実操作・実Pixi・本番History callback全体は未確認で、全機能受入とはしない。
WP-003はDONE。拒否時terminal、自動保存延期、Undo/Redo再同期の隔離回帰がpass。通常RasterのF1/F2継続、周期跨ぎ、History 1/0、Project保存往復をBrowser確認済み。描画直後の初回SOURCE Vも通常Recovery延期へ含め、Browserで維持を確認。Owner操作感の受入は未確認。WP-006もDONE。Folder自身のMotion schema、現行subtree評価、Folder専用V bridge、History/Undo/Redo、保存metadataと双方向effect排他を実装した。BrowserでTable展開後の2子Raster同時preview、KEY、次Frame継続を確認。CPU/export実画素とOwner受入は未確認。WP-004はACTIVE、WP-005は前提未完でBLOCKED。旧9qはPAUSED。
WP-004 Slice 1/2で、Layer Motionだけのunsupported planがCPU compositorで拒否されず描画まで進むF-003をproduction consumer＋fake Canvasで確定し、`none/ready`だけを通す限定修正を適用した。Slice 3Aでは実BrowserのHTMLCanvas/PNGでready Layer/Folder Motionのhash・bbox一致とunsupportedの描画前拒否を確認し、Selection/SOURCE/CAF SOURCE/ANIMATEのfixture terminal差を記録した。Slice 3Bの隔離UIでは通常SOURCEのPreview後session残留とANIMATE LayerのExport toolbar時session終了を観測した。実UIは限定確認であり、OwnerのHD-005判断が残る。
全体監査は[AUDIT](AUDIT.md)、正本配置は[登録簿](DOCUMENT_REGISTER.md)、仕様/将来の順序は[ROADMAP](ROADMAP.md)。

## IMPORTANT DECISIONS

- Owner指示によりWP-002まで順次実施。保存正本、Layer/CAF境界、History command形式、byte/count制限は変更しない。
- indexの修復とcommand内のatomic rollbackを区別する。通知失敗で成功済みcommandを未適用扱いにしない。
- GITHUB.txtは案内。正本はAGENTS / docs / 対象WP / 現行コード。旧Phaseや外部レビュー文を直接実装契約にしない。
- 自前Markdownはdocs、root AGENTSはAI入口。既存構造の段階抽出は提案であり、大規模移行や保存schema変更は未承認。

## OPEN QUESTIONS

- WP-001範囲内の既知残存なし。範囲外: do途中mutationのrollback、push失敗前のredo枝破棄、composite補償/byteSize、非同期History。
- WP-002の指定登録/解除経路は修正済み。別件F-007: 並べ替え/reparentでclipping sourceが変化し競合する可能性は未修正・全経路未再現。
- WP-003: toolbar残留、自動保存によるV終了、Undo/Redo後のprojection不一致を補修。forced/manual saveは現行terminalを維持。詳細・検証結果はカード。
- Owner補足の「描画直後だけSOURCE Vが閉じる」は、描画後に予約された通常RecoveryがSOURCE sessionを延期しない経路と一致。activeなSOURCE/Timeline双方を延期する追補を適用し、forced/manual保存は維持。
- WP-004: CPU拒否抜けは限定修正済み。実Browser/Canvasのready Layer/Folder Motionとunsupported拒否は確認済み。save/exportのfixture terminal差と限定UI差は記録済みだが、Export側の自動確定/一時評価/明示停止は仕様判断待ち。
- WP-004結果: Slice 3のBrowser/Canvas・隔離UI evidence、CPU拒否修正、save/export terminal差、HD-005の判断材料は[結果表](work/WP-004-results.md)へ固定。実UIのCAF SOURCE/Folder Motion/連番downloadとOwner操作感は未受入。
- Animation Contextの右Layer PanelでCAF `clip-layer-mirror` rowを選択できない症状は、Owner実確認で解消済み。WP-004では追加調査・追加修正を行わない。
- 全solver/codec/長時間pen/全GPU/全Archiveの全面再調査は行わない。必要な対象だけ限定追加する。

## HUMAN DECISION NEEDED

OwnerはFolder自身のKEYを選択。個別Raster KEY展開や暗黙Rig登録をせず、[WP-006](work/WP-006-folder-transform-key.md)の`folderTransformTracks`として実装済み。

[HD-001〜005](ROADMAP.md#human-decisions): 大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE、export未確定編集。
既存不具合の限定補修を妨げないが、未採用案を実装契約へ昇格しない。今回これらの結論は変更していない。

## NEXT

1. Slice 3の[Browser / Canvas結果](work/WP-004-results.md)をWEB GPTへ渡し、HD-005（Export terminal仕様）の判断を待つ。製品runtimeは変更しない。
2. GPT判断が返るまで、実UIの限定観測とfixtureの技術passを混同せず、WP-004をACTIVEのまま保持する。
3. Folder MotionのBrowser Album保存/再読込や追加UI確認は、GPTから明示された場合だけWP-004内で限定実施する。F-007へ広げない。

## RISKS / BLOCKERS

- commandの一部mutation後throwは画像/モデルが部分変更のまま残り得る。本WPのindex修正はそれを巻き戻さない。
- 149 passは実機/画素/Owner制作受入の代用ではない。buildの既存util externalization/大きなchunk警告は継続。
- mainの未push変更はWeb AIから不可視。Ownerがpush/対象SHAを指定する。公開先との一致は今回確認していない。
- Backup/PastFiles/別project、Owner差分、依存packageは対象外。
