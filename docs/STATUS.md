# Tegaki — 再開checkpoint

状態: WP-001 DONE。WP-002以降は未着手。
更新日: 2026-09-06。今回の対象commit: `9b6ea3c208bd924d21c9b018c78888432469b64a`（開始時worktree clean）。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

再構成レビューを完了し、Owner指定のWP-001「History例外時の不具合修正」を限定実施した。
このまとまりは完了。次のWPへ自動拡張せず、結果をOwnerへ報告する。

## COMPLETED

- 前回の文書/正本/語彙/ロードマップ/5 WPを継承。読む順序・対象scope・local link・harness依存を再レビューし、再構成上の阻害事項なし。
- [WP-001](work/WP-001-history-failure.md) DONE。実HistoryManagerで修正前のindex二重減算を再現（actual=-1 / expected=0）。
- redoのdo成功後だけindexを進める局所修正。実行失敗はindex不変、実行成功後の通知失敗は適用済みindexを保持、finallyでisApplying解除。
- 新規verifierは初回/中間/末尾、連続例外、以前のUndo、再試行、通知例外、部分mutationの限界を確認。
- History関連5/5、全verifier148/148、構文確認、Vite build成功。出力は専用Temp、dist変更なし。
- read-only agentの呼び出し側/Raster Patch/最終diffレビューを主担当が統合。コード変更は主担当だけが実施。
- 製品差分はhistory.jsのredo内のみ。新規testと完了文書同期以外の整理/リファクタリングは行っていない。

## CURRENT STATE

WP-001は非UI・同期例外経路を実production classで検証して完了。Browser/Owner実操作は今回未実施であり、受入済みとは記録しない。
WP-002〜004はREADY（仕様が委任可能、未実装）、WP-005は前提未完でBLOCKED。旧9qはPAUSED、A〜D資産と未完Eを維持。
全体監査は[AUDIT](AUDIT.md)、正本配置は[登録簿](DOCUMENT_REGISTER.md)、仕様/将来の順序は[ROADMAP](ROADMAP.md)。

## IMPORTANT DECISIONS

- WP-001だけ再開するOwner指示を適用。保存正本、Layer/CAF境界、History command形式、byte/count制限は変更しない。
- indexの修復とcommand内のatomic rollbackを区別する。通知失敗で成功済みcommandを未適用扱いにしない。
- GITHUB.txtは案内。正本はAGENTS / docs / 対象WP / 現行コード。旧Phaseや外部レビュー文を直接実装契約にしない。
- 自前Markdownはdocs、root AGENTSはAI入口。既存構造の段階抽出は提案であり、大規模移行や保存schema変更は未承認。

## OPEN QUESTIONS

- WP-001範囲内の既知残存なし。範囲外: do途中mutationのrollback、push失敗前のredo枝破棄、composite補償/byteSize、非同期History。
- WP-002: effect登録順の排他非対称と解除拒否。今回変更なし。
- WP-003: KEY確定後panel消失/toolbar残留。原因未確定、今回変更なし。
- WP-004: unsupported Layer Motion-onlyのCPU拒否抜け、save/export未確定terminal比較。実画素比較は未実施。
- 全solver/codec/長時間pen/全GPU/全Archiveの全面再調査は行わない。必要な対象だけ限定追加する。

## HUMAN DECISION NEEDED

[HD-001〜005](ROADMAP.md#human-decisions): 大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE、export未確定編集。
既存不具合の限定補修を妨げないが、未採用案を実装契約へ昇格しない。今回これらの結論は変更していない。

## NEXT

1. WP-001の結果をOwnerへ報告。修正前後の証拠と対象fileはWP-001 Completion。
2. 次の改修指示後、WP-002のeffect排他/解除契約を再確認して限定着手。
3. WP-003 → WP-004 → 前提完了後WP-005。並列writeや旧9q Eの自動再開はしない。

## RISKS / BLOCKERS

- commandの一部mutation後throwは画像/モデルが部分変更のまま残り得る。本WPのindex修正はそれを巻き戻さない。
- 148 passは実機/画素/Owner制作受入の代用ではない。buildの既存util externalization/大きなchunk警告は継続。
- mainの未push変更はWeb AIから不可視。Ownerがpush/対象SHAを指定する。公開先との一致は今回確認していない。
- Backup/PastFiles/別project、Owner差分、依存packageは対象外。
