# Work Packageの入口

状態と依存は[manifest](../harness.json)のpackages、実行中の一件は[STATUS](../STATUS.md)に置く。
READYは委任可能という意味で、現在の製品実装停止を解除するものではない。

| ID | 目的 | カード |
|---|---|---|
| WP-001 | History redo例外後のindex維持 | [History failure](WP-001-history-failure.md) |
| WP-002 | Layer effectとRigの双方向排他・安全な解除 | [Effect guards](WP-002-effect-guards.md) |
| WP-003 | KEY確定後のpanel保持とFrame継続 | [KEY continuation](WP-003-key-continuation.md) |
| WP-004 | unsupported出力とsave/export terminalの比較・判断材料 | [Output terminal audit](WP-004-output-terminal.md) |
| WP-005 | Drawing WARP Simple UIを既存transactionへ接続 | [Simple WARP](WP-005-simple-warp.md) |

先の機能すべてへ未確定の詳細カードを作らない。新カードはGoal / Scope / Contract / Tasks / Acceptance / Verification / Stop / Completionを持ち、同じ概念の第二正本を作らない。
カードを渡す前に対象fileの存在とbaseline、依存の完了状態を確認する。
