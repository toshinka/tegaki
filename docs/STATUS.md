# Tegaki — 再開checkpoint

状態: DOCUMENTATION / HARNESS BATCH VERIFIED。製品実装は停止中。
更新日: 2026-09-06。監査開始基準: Git `8c5748f5`。その後のOwner commit/差分を保持して統合した。
現在地はこの文書だけが所有する。旧Phaseの自動継続指示より優先する。

## CURRENT OBJECTIVE

前回までの監査を成果物へ収束させ、現行正本・語彙・計画・Work Package・検証入口を一貫させる。
今回の文書移動と外部AI向けURL集は完了。次は再構成成果をレビューし、指定された限定WPから製品改修を再開する。

## COMPLETED

- 調査済み: Animation/Rig/WARP所有、Drawing/History/Project経路、検証基盤、関連する過去失敗。根拠と未確認は[AUDIT](AUDIT.md)。
- 現行[製品思想](PRODUCT.md)、[技術契約](TECHNICAL.md)、[Architecture](ARCHITECTURE.md)、[語彙](VOCABULARY.md)、[開発契約](DEVELOPMENT.md)を分離。
- [ROADMAP](ROADMAP.md)と5件の[Work Package](work/README.md)を作成。旧9qはPAUSED、旧proposalは効力を[登録簿](DOCUMENT_REGISTER.md)に明記。原文/不採用案を保存。
- 自前Markdownをtegaki_workからdocsへ移動。旧入口はdocs/legacy、履歴境界/templateはdocs/reference。AGENTSだけrepo直下のAI入口として維持。TEGAKIはdocs/TECHNICALへ移動。
- LUNA workerの読む順序を新pathへ更新。model/権限/担当範囲は変更していない。既に起動済みagentは新設定を自動取得するとは限らない。
- 外部AI用[Claude_GPT_Review/GITHUB.txt](../Claude_GPT_Review/GITHUB.txt): 現行文書/計画/主要コード50リンク、Archive/過去Reviewなし。
- 検証: harness check（27文書・119 local links・25 proposals・5 WP）、self-test、既存verifier 147/147成功。URL50件の重複/ローカル実在/対象範囲も成功。
- Vite build成功。出力は専用Tempへ、tegaki_work/distは変更なし。ag-psdのutil externalizationと大きなchunk警告は残る。
- 自前Markdownのtegaki_work残存なし。依存packageのREADME/License/PixiJS skillは配布物なのでnode_modulesに維持。

## CURRENT STATE

製品runtimeはこの再構成で修正していない。旧9q A〜Dは従来の技術checkpoint、EのSimple WARP UIは未完。
直前のKEY strip実操作ではKEY/Historyは増えるがpanelが消え、V toolbarだけ残った。連続編集は未受入。
WP-001〜004はREADY（仕様が委任可能という意味で、実装中/完了ではない）。WP-005は前提未完のためBLOCKED。
今回のテスト成功は文書移動/既存検証の証拠。既知不具合の解決、実Pixi画素一致、Owner制作受入を意味しない。

## IMPORTANT DECISIONS

- 保存正本・Layer/CAF/Asset/Instance境界は変更しない。既存model/evaluatorを再利用する。
- 製品思想、技術契約、現行実装、将来候補、現在地を別の正本として一意化する。
- Architecture全面rewriteは実施しない。先に実在バグと失敗系検証、その後一つの編集session境界の段階抽出を提案する。
- ソース文字列検査、mock、CPU画素、Browser、Owner受入を区別する。147 passだけで品質を一般保証しない。
- 新たな自前Markdownはdocsへ置く。root AGENTSは発見用、過去資料は履歴用。外部URL集は案内であって仕様の第二正本ではない。

## OPEN QUESTIONS

- 確認済み不具合: History redo例外のindex二重減算、effect登録順の排他非対称/解除拒否。
- 確認済み接続欠陥: unsupported Layer Motion-onlyがCPU compositorのassertを通過する。実出力での画素欠落は未検証。
- 原因未確定: KEY確定後のTransform再入場失敗。panel/toolbar不一致は実操作で確認済み。
- 未調査の限定項目: save/export中の未確定SOURCE/ANIMATEの終端比較、実renderer間の組合せ品質、全制作条件。
- 全Archive/外部Reviewの再精読は不要。関連根拠を特定した時だけ追加で読む。

## HUMAN DECISION NEEDED

[ROADMAPのHD-001〜005](ROADMAP.md#human-decisions)に問題・選択肢・費用・将来影響・推奨を整理した。
大規模移行方式、static RIG host、内部Layer複製時の時間effect継承、永続非破壊SOURCE、export未確定編集の扱い。
これらは既存バグの限定補修を妨げないが、未採用案を実装契約とみなさない。新保存schema/大規模置換の承認は得ていない。

## NEXT

1. 今回成果と重大判断一覧をOwnerレビュー。再開時はこのcheckpointと対象WPだけから復帰する。
2. 製品改修再開の指示後、[WP-001](work/WP-001-history-failure.md): redo例外の最小再現→局所修正→検証。
3. WP-002 effect排他、WP-003 KEY継続編集、WP-004出力terminal監査の順。未完作業を並列writeしない。
4. 前提が完了してからWP-005 Simple WARP UI。旧Phase Eを直接自動再開しない。

## RISKS / BLOCKERS

- GitHub mainは可変かつ未push変更はWeb AIから不可視。Ownerがpushし、review対象SHAを指定する。公開先との一致は今回ネットワーク検証していない。
- 移動前の旧URLは切れる。新入口はAGENTS / docs/README / GITHUB.txt。Archive原文の相対pathは当時の配置で解釈する。
- 巨大Popupのmutation/session/History混在と、テスト内simulationによる偽安心が残る。カードの失敗系・実操作を省かない。
- Backup/PastFiles/別projectとOwner変更は対象外。文書再構成を理由に依存packageや保存データを移動しない。
