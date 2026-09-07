# Tegaki — 再開checkpoint

状態: WP-001 / WP-002 / WP-003 / WP-004 / WP-006 / WP-007 DONE（Owner操作感は未確認）。WP-005 ACTIVE。
更新日: 2026-09-07。作業開始baseline HEAD: `82192bd22c31f154c1cba155b063ac4fa601bb15`。WP-004の監査・HD-005判断とWP-007の限定runtime guardを完了し、WP-005 Simple 4x4 WARP UIを継続中。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

WP-005のSimple 4x4 WARP UIを既存Layer Transform transactionへ接続中。normal/CAF SOURCEはRaster bake、CAF ANIMATEは`ClipInstance.layerDeformers`を維持し、16点pointer gesture・V/Esc・mode切替の限定検証を先行する。WP-007の未確定Layer Transform Export guardとHD-005 `MIXED`は維持する。

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
WP-003はDONE。拒否時terminal、自動保存延期、Undo/Redo再同期の隔離回帰がpass。通常RasterのF1/F2継続、周期跨ぎ、History 1/0、Project保存往復をBrowser確認済み。描画直後の初回SOURCE Vも通常Recovery延期へ含め、Browserで維持を確認。Owner操作感の受入は未確認。WP-006もDONE。Folder自身のMotion schema、現行subtree評価、Folder専用V bridge、History/Undo/Redo、保存metadataと双方向effect排他を実装した。BrowserでTable展開後の2子Raster同時preview、KEY、次Frame継続を確認。CPU/export実画素とOwner受入は未確認。WP-004は監査DONE、WP-007は技術DONE、WP-005はSimple 4x4 WARP UI実装中で、normal/CAF SOURCE/CAF ANIMATEの実画面・実画素受入が残る。旧9qはPAUSED。
WP-005は、関連verifier・harness・構文・Vite buildをPASS。normal SOURCEの実Browserで4x4/16点表示、点drag、Esc取消、V確定、Undo/Redo、変更中のBASIC切替拒否を確認し、CAF ANIMATEは2Frameの入場・preview・Escまで確認した。CAF SOURCE、CAF ANIMATEのV確定/Frame継続、実Pixi/CPU/export画素、save/reopen、pointercancel実操作、Owner操作感は未受入で、WP-005はACTIVEを維持する。
WP-004 Slice 1〜3で、Layer Motionだけのunsupported planがCPU compositorで拒否されず描画まで進むF-003をproduction consumer＋fake Canvasで確定し、`none/ready`だけを通す限定修正を適用した。実BrowserのHTMLCanvas/PNGでready Layer/Folder Motionのhash・bbox一致とunsupportedの描画前拒否、Selection/SOURCE/CAF SOURCE/ANIMATEのfixture terminal差を確認し、HD-005をMIXEDで確定した。WP-007ではExportManager共通guard、Export toolbar/popup preflight、zero-mutation verifier、Browser Canvas診断を追加した。
WP-007は`pending-layer-transform`でSOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE FolderのExport・Preview・Sequence・Blob入口を明示停止する。Chrome 152のCanvas診断はviewport 1280x720、DPR 2.25、consoleErrors 0でPASS。隔離実UIではSOURCEのblock→V/Esc→Preview、ANIMATE Layerのblock→V→Preview、通常Folder SOURCEのblock→V→Previewを確認し、FolderのAnimation Context target表示まで確認したがFolder自身ANIMATE VとCAF SOURCE UIは未受入として残す。
全体監査は[AUDIT](AUDIT.md)、正本配置は[登録簿](DOCUMENT_REGISTER.md)、仕様/将来の順序は[ROADMAP](ROADMAP.md)。

## IMPORTANT DECISIONS

- Owner指示によりWP-002まで順次実施。保存正本、Layer/CAF境界、History command形式、byte/count制限は変更しない。
- indexの修復とcommand内のatomic rollbackを区別する。通知失敗で成功済みcommandを未適用扱いにしない。
- GITHUB.txtは案内。正本はAGENTS / docs / 対象WP / 現行コード。旧Phaseや外部レビュー文を直接実装契約にしない。
- 自前Markdownはdocs、root AGENTSはAI入口。既存構造の段階抽出は提案であり、大規模移行や保存schema変更は未承認。
- HD-005はMIXED。Selectionは既存auto commitを維持し、SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderは未確定Layer TransformをExport前に明示停止する。Project Saveは変更しない。
- WP-007のblockはsession、model、History、frame、selection、preview candidateを変更せず、V確定またはEscキャンセル後の再試行を要求する。Preview一時samplingは採用しない。

## OPEN QUESTIONS

- WP-001範囲内の既知残存なし。範囲外: do途中mutationのrollback、push失敗前のredo枝破棄、composite補償/byteSize、非同期History。
- WP-002の指定登録/解除経路は修正済み。別件F-007: 並べ替え/reparentでclipping sourceが変化し競合する可能性は未修正・全経路未再現。
- WP-003: toolbar残留、自動保存によるV終了、Undo/Redo後のprojection不一致を補修。forced/manual saveは現行terminalを維持。詳細・検証結果はカード。
- Owner補足の「描画直後だけSOURCE Vが閉じる」は、描画後に予約された通常RecoveryがSOURCE sessionを延期しない経路と一致。activeなSOURCE/Timeline双方を延期する追補を適用し、forced/manual保存は維持。
- WP-004: CPU拒否抜けは限定修正済み。実Browser/Canvasのready Layer/Folder Motionとunsupported拒否、save/export terminal差を監査し、HD-005をMIXEDで確定してDONE。
- WP-007: manager/UI共通guard、zero-mutation verifier、Canvas/PNG、sequence/download境界、SOURCEとANIMATE Layerの隔離実UIを確認して技術DONE。CAF SOURCE UI、Folder自身V UI、Owner操作感は未受入。
- Animation Contextの右Layer PanelでCAF `clip-layer-mirror` rowを選択できない症状は、Owner実確認で解消済み。WP-004では追加調査・追加修正を行わない。
- 全solver/codec/長時間pen/全GPU/全Archiveの全面再調査は行わない。必要な対象だけ限定追加する。

## HUMAN DECISION NEEDED

OwnerはFolder自身のKEYを選択。個別Raster KEY展開や暗黙Rig登録をせず、[WP-006](work/WP-006-folder-transform-key.md)の`folderTransformTracks`として実装済み。

HD-005はLead決定済み（MIXED）で、[WP-007](work/WP-007-export-terminal-guard.md)へ実装した。残るのはOwnerの制作操作感受入のみ。

[HD-001〜004](ROADMAP.md#human-decisions): 大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE。
既存不具合の限定補修を妨げないが、未採用案を実装契約へ昇格しない。今回これらの結論は変更していない。

## NEXT

1. WP-005のCAF SOURCE Raster bakeとCAF ANIMATEのV確定・Frame/Table close継続をBrowserで確認する。
2. normal/CAFの固定入力についてPixi preview・CPU・bake/exportの実画素とsave/reopenを比較し、非4x4/排他対象の実画面拒否を確認する。
3. Owner受入（normal/CAF SOURCE/ANIMATE、Export操作感、実download）を技術passと分けて実施する。Layer Panel、F-007、HD-001〜004、広範囲の再監査へ展開しない。

## RISKS / BLOCKERS

- commandの一部mutation後throwは画像/モデルが部分変更のまま残り得る。本WPのindex修正はそれを巻き戻さない。
- 既存verifier＋WP-007限定Verifier、Canvas診断、Vite buildは実機/Owner制作受入の代用ではない。buildの既存util externalization/大きなchunk警告は継続。
- mainの未push変更はWeb AIから不可視。Ownerがpush/対象SHAを指定する。公開先との一致は今回確認していない。
- Backup/PastFiles/別project、Owner差分、依存packageは対象外。
