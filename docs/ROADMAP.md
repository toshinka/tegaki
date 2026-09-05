# 再構成ロードマップ

状態: CURRENT。旧Phaseの時系列を、現在の依存関係へ並べ直した。製品実装はSTATUSで再開を指定するまで停止。
作業カード状態は[harness.json](harness.json)、調査根拠は[AUDIT](AUDIT.md)。

## 直近の順序

| 順 | 作業 | なぜ先か | 完了の尺度 |
|---|---|---|---|
| 0 | 文書/検証入口の再構成 | 古い正本へ誘導される誤実装を止める | link/route検査、旧文書状態、checkpoint、作業カードが一貫 |
| 1 | [WP-001 History失敗時index](work/WP-001-history-failure.md) | 例外後のUndo時系列を壊す再現済み不具合 | do失敗でindex/stack不変、再試行/通常経路が通る |
| 2 | [WP-002 effect排他と解除](work/WP-002-effect-guards.md) | 操作順により保存可能な競合stateを作れる | 双方向/共有Assetの全Clip、解除、Undo/Projectを確認 |
| 3 | [WP-003 KEY継続編集](work/WP-003-key-continuation.md) | 中断したOwner要望、WARPと共有するsession導線 | 確定してpanel維持、次Frame、失敗同期、History 1 |
| 4 | [WP-004 出力拒否/terminal監査](work/WP-004-output-terminal.md) | 設定したMotionが出力で黙って欠落する危険を先に固定 | unsupported拒否表、save/exportのSOURCE/ANIMATE比較 |
| 5 | [WP-005 Simple WARP UI](work/WP-005-simple-warp.md) | 旧9q A〜Dの既存資産を完成へ接続 | normal/CAF/SOURCE/ANIMATE、16点、KEY、cancel、実画素比較 |
| 6 | 一つの編集session境界の抽出 | 正しい振舞いを固定してから巨大Popupの責務を縮める | 互換facade、同じ入力/出力/History、対象file探索の短縮 |
| 7 | static RIG導線の再配置 | WHAT/HOW/WHENを揃える | HD-002比較とOwner受入、保存正本不変 |

1〜4は既存契約の補修/監査。5は前提が通るまでBLOCKED。6は抽出設計の選定から始め、巨大classの書換えを直ちに実行しない。
WP-001の例外index修正へ、History全体系のrewriteやcomposite補償処理を混ぜない。

## 残作業の再分類

| 分類 | 対象 | 現在の扱い |
|---|---|---|
| 実装あり、維持/受入残 | 描画・Layer/CAF・clip copy/bake・root Motion・Graph/Easing・Rig FK/限定IK・Mesh/Skin/weight | ソースと既存検証あり。全制作条件完了とはしない |
| 小修正/統合検証 | History例外、KEY再入場、排他操作順、unsupported Motion出力 | 上記WP |
| 部分実装 | Layer WARP Simple UI、Transform familyの導線純化 | 旧9q Task Eとstatic authoring判断を分離 |
| 再設計準備 | Popupのcommand/session抽出、入力座標重複、Project load事前検証 | fixed input/境界表から限定抽出 |
| 人間判断 | 複製時の時間effect継承、永続非破壊SOURCE、static RIG host、rewrite/段階抽出 | 下記HD |
| 未実装候補 | Motion Path/Perform、Animation Camera、Project-local Rig Library、Video Handoff、追加Constraint/Draw Order | schema/solverの存在とUI完了を区別し、着手時に該当コードを限定再照合 |
| 研究 | Physics/Dynamics、高度画材、WebGPU brush、AI連携、真のtile無限Canvas | 現行CPU/WebGL限界とfallback/保存/出力条件を示してからprototype |
| 今は不要 | 新しいBasePopup/HistoryCommand階層、全EventBus rename、全Layer/CAF統合、全headerの手書き索引 | 具体的問題と利益がない限り作らない |

Motion Path/Performは既存KEY samplerを再利用する入力方式として検討する。別の運動正本を先に作らない。
高度物理はrandom seek、固定step、Bake/export再現性が説明できるまで本番へ入れない。
UI外観候補（dark top/bottom、Lane zebra、Clip Focus、virtual grid/snap）は削除せず資料登録簿へ保持する。

## human-decisions

重大判断点は以下。未決定でも、既存不具合の補修と文書整備は進められる。

### HD-001 — 大規模構造の移行方法

問題: AnimationTablePopupがUI、model mutation、History、previewを所有し、局所変更の探索範囲が大きい。

| 案 | 利点 | 欠点/移行費用 | 将来影響 |
|---|---|---|---|
| 現状＋局所修正 | 即時費用小 | 機能増加で探索/状態組合せが増える | 中長期の委任粒度に限界 |
| 既存model/evaluatorを保持し編集sessionから段階抽出 | 既存Project/品質を比較しながら移行 | 一時facadeとcontract testが必要、中程度 | command/renderer/UIを順に分離可能 |
| 全面rewrite | 最初から整った構造 | 高コスト、旧バグ/入力品質/互換の再証明 | 移行期間に二つの実装を維持 |

推奨: 段階抽出。今回は調査・設計候補として確定し、大規模移行自体は未承認/未実行。一つの境界の具体的diff計画を次のレビューへ出す。

### HD-002 — static RIGの入口

問題: right RIG/浮動WorkspaceとTransformが並存し、HOWの入口が増える。
A: Transform内の段階露出。学習を持ち越せるがpanel肥大リスク。
B: Transformから既存専用Workspaceへ明示handoff。高度操作を分離できるが往復が増える。
C: 右Inspector常設。対象が見えるが描画空間を圧迫する。
推奨: BASIC/WARPを第一水位、RIGは明示handoffで比較するBを出発点とする。既存配置を消さず同じtaskで試す。保存モデル変更は不要、費用は中程度。最終UXはOwner判断。

### HD-003 — 内部Layer複製と時間effect

問題: 現コードは複製時WARPを全参照Clipへ複製するがLayer Motionは複製しない。
A: 原画のみ複製。軽いが現在WARP継承との互換変更。
B: すべての参照Clipの時間effectも複製。見た目を保ちやすいが共有Assetの他Clipへ波及。
C: 現在Clipのみ時間effectを複製。現在地では自然だが他Clipとの差が生じる。
推奨: 既存WARPに合わせるBを比較の第一候補とする。影響するClip数を明示する案も評価。データ移行は既存Projectを自動改変せず今後のduplicate操作に限定。採用までは取りこぼしを黙って補完しない。

### HD-004 — SOURCEの永続非破壊

問題: 現行は確定Raster bake。永久に元絵へ戻れるeffect stackとは違う。
A: 現行bake＋History。単純、互換費用小、繰返し再編集に限界。
B: immutable原画＋永続effect。復元性が高いが保存容量、描画後の基準、clipping、export、CAF昇格を再設計する必要。
推奨: 今はAを維持。Bは製品上の具体的な利用例と費用比較が揃った時に独立設計。今回Bを導入しない。

### HD-005 — Export中の未確定編集

問題: saveとexportでTransform terminalが一致するか未検証。
A: export前に確定。保存との一致が分かりやすいが出力操作がHistoryを変える。
B: previewを一時sampleして出力。編集中を保つが未確定の画像を出す意味を明示する必要。
C: 未確定なら停止して確定を求める。明示的だが操作が増える。
推奨はWP-004の現行動作比較後に出す。現時点でUXとHistory方針を推測で統一しない。

## 旧計画への対応

旧9qはcloseせずPAUSED。A〜Dの資産はWP-005へ継承し、Task Eを再実装済み扱いしない。
旧proposal 09/10/15/16/17、Transform追補は候補/根拠として残す。現在の順序は本書だけが所有する。
Archiveの失敗事例は[AUDIT](AUDIT.md)に短く抽出し、採用しなかった案も原文から追跡できる。
