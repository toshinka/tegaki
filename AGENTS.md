# Tegaki — agent entry map

最初に読む。詳細の技術契約は[docs/TECHNICAL.md](docs/TECHNICAL.md)、現在地は[docs/STATUS.md](docs/STATUS.md)。

## 読む順序

1. `docs/STATUS.md` — 中断点・進行中の一件・未解決事項。
2. `docs/TECHNICAL.md` — 維持する技術契約。
3. 指定された `docs/work/WP-*.md` — Goal、対象file、検証、完了条件。
4. カードが指定する `docs/ARCHITECTURE.md` の節とlocal file header。

新規参加/全体判断なら[docs/README.md](docs/README.md)から製品思想・語彙へ。
旧 `task-codex/phase*.md` は現在の作業指示と仮定しない。[文書登録簿](docs/DOCUMENT_REGISTER.md)で状態を確認する。

## 作業範囲と安全

- 製品実装は`tegaki_work/`、現行開発文書は`docs/`。
- `ComfyUIPortable/`、`EasyReforgeExtension/`、`RegionalLoRALab/`は別project。
- `Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`はOwner退避物。明示指示なしに探索・編集・削除しない。
- 開始時に`git status --short --untracked-files=all`を確認。既存差分を保持し、対象外を巻き戻さない。
- 同責務・同名event・CSS変数を`rg`してから追加。event変更は送受信とpayloadを確認。
- 新しい保存正本、互換破壊、大規模class再構成、未決定UXは作業カードへ混ぜず、重大判断点としてleadへ返す。
- Git pushと最終制作受入はOwner。生成物や秘密情報を成果へ混ぜない。

## 委任と完了

Architecture leadが全体判断、実装AIは確定カードの限定範囲を担当する。
同じfile/modelへの並列writeはしない。独立read-only調査は可。
役割・header・検証・外部AI受渡しは[DEVELOPMENT](docs/DEVELOPMENT.md)。
workerの完了報告だけでcloseしない。Browser未実施、Owner未受入をpass扱いにしない。

```powershell
node tegaki_work/build/development-harness.mjs check
node tegaki_work/build/development-harness.mjs list transform
node tegaki_work/build/development-harness.mjs test transform
```

JS変更は構文確認、製品変更はbuildと関連実操作。全verifier成功は実機/画素一致の代用ではない。
checkpointは`docs/STATUS.md`だけに現在地を置き、古いPhase履歴を積まない。

PixiJSを調査/変更する場合は、技術契約と対象カードの後に`tegaki_work/node_modules/pixi.js/skills/pixijs/SKILL.md`を読み、routerの関連skillだけ参照する。公式skillの一般推奨でTegakiのrenderer/保存境界を変えない。
