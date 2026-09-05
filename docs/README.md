# Tegaki 開発ナビゲーション

状態: CURRENT。製品仕様の読み取りと、今後の提案を分けて管理する。

Tegakiは、ブラウザで絵を描き、その絵を同じCanvas上で動かすラスター描画・アニメーション制作ツール。
現在の実装には、通常Layer、CAF内部Layer、Motion、WARP、Bone/Skin、保存・出力がある。ただし機能の存在と、全組合せの受入完了は同義ではない。

## 最短の読む順序

1. [現在地・checkpoint](STATUS.md)で作業停止点を確認する。
2. [技術契約](../TEGAKI.md)を読み、対象Work Packageを[ロードマップ](ROADMAP.md)から選ぶ。
3. [Architecture](ARCHITECTURE.md)の対象領域と[正式語彙](VOCABULARY.md)の該当語だけを読む。
4. 作業カードに列挙されたfileのheader、実コード、関連検証へ進む。

新規参加・製品判断時だけ[製品思想](PRODUCT.md)を通読する。毎回全proposalやArchiveを読む必要はない。

## 文書の所有

| 知りたいこと | 正本 |
|---|---|
| 今の作業、確定/仮説/未確認、次の入口 | [STATUS](STATUS.md) |
| 製品思想とOwnerの価値判断 | [PRODUCT](PRODUCT.md) |
| 技術上の維持契約・禁止境界 | [TEGAKI](../TEGAKI.md) |
| 現行データ所有・起動・編集・出力経路 | [ARCHITECTURE](ARCHITECTURE.md) |
| 同じ概念の名称・互換名 | [VOCABULARY](VOCABULARY.md) |
| 担当の渡し方、完了条件、局所header、検証 | [DEVELOPMENT](DEVELOPMENT.md) |
| 優先順位・依存・重大判断点 | [ROADMAP](ROADMAP.md) |
| 調査根拠・確認範囲・既知の穴 | [AUDIT](AUDIT.md) |
| 旧文書の効力・読み直す理由 | [DOCUMENT_REGISTER](DOCUMENT_REGISTER.md) |
| 作業カード・機械的routing | [work](work/README.md)、[harness.json](harness.json) |

コードは「現在何が起こるか」の証拠、Owner承認済み仕様は「何が起こるべきか」の根拠。
両者が違えば不具合/未移行として記録する。バグを現行仕様へ自動昇格させない。

## 検証入口

repo rootからも実行できる:

```powershell
node tegaki_work/build/development-harness.mjs check
node tegaki_work/build/development-harness.mjs list transform
node tegaki_work/build/development-harness.mjs test transform
```

`test all`は既存verifier全件。runnerがCWDを`tegaki_work`へ固定する。
合格はその検証種別の証拠であり、Browser操作・実Pixi画素一致・Owner受入を代替しない。

## 過去資料

旧Phaseは捨てない。実装完了と記録されていても、残存バグや制作環境の未確認を消さない。
旧入口には新入口への案内を残す。過去の命令文や「次は…」は現在の実装指示ではない。
文書状態の判断は[登録簿](DOCUMENT_REGISTER.md)を参照する。
