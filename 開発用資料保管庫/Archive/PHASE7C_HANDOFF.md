# PHASE7C_HANDOFF — close時点の移行記録

更新日: 2026-08-09

## Close状態

- Phase 7cは`開発用資料保管庫/Archive/phase7c.md`へ移し、2026-08-09にcloseした。
- Stage A / BとLUNA限定修正、SOL review 5=`A`、Owner軽量実機受入まで完了し、コードreview上の追加修正はない。
- WARP未作成 / GRID外の拒否、ON追従、OFF復帰、Undo / Redo、Table再開、onion / playback、console errorなしを軽量Browserで確認した。深い制作Project、GIF / APNG、source / target削除、pen / touchは継続監視とする。
- WARP未作成、GRID外、実triangle外では子PIVOT追従Constraintを保存しない。
- dormant / stale / unsupported時は既存`evaluateRigidBones().anchorDiagnostics`を正本に、接続成立overlayを表示せず通常FKへfallbackする。
- focused verifier、変更JS / mjsの`node --check`、全verifier、build、Browser smokeは通過済み。Phase closeにはOwnerの深い制作Project確認が残る。
- 自由anchor drag、orientation / rotation follow、weight、複数anchorは未実装で、本Phaseへ追加しない。

## 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase7c.md`
6. `開発用資料保管庫/Archive/phase6u.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/ui/animation-table-popup.js`
11. `tegaki_work/system/animation/warp-anchor-constraint.js`
12. `tegaki_work/system/animation/warp-triangle-point-map.js`
13. `tegaki_work/system/animation/part-rig.js`
14. `tegaki_work/system/animation/folder-part-render-plan.js`
15. `tegaki_work/system/animation/animation-data-model.js`

`proposals/過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`は、現行正本で不足した情報を救出する場合だけ読む。

## 作業開始時の必須確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

表示される既存差分はPhase 6z〜7cの実装・検証・文書整理を含む意図的な作業中差分である。削除済みproposalはArchiveへ移動済みで、untrackedのPhase / verifier / animation module / Archive文書も維持する。対象外の変更をrestore、reset、checkoutしない。

- `Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。
- `.git/index.lock`は必要時に削除してよいというOwnerの継続許可がある。ただし存在確認後にlockだけを対象にする。
- 清掃・生成物差分の復元は委任済み。ただし`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`には追跡済み基準ファイルがあるため、ディレクトリ全体を削除せず、buildで変わった差分だけを確認・復元する。
- Git PUSHと最終実機判定はOwnerが行う。

## Close前の引き継ぎ内容（履歴）

1. 上記statusと現行文書を確認し、既存変更を維持する。
2. Phase 7cを`SOL review 5=A / Owner深い実機待ち`として再確認する。新機能実装へ広げない。
3. Ownerと次を実制作Projectで確認する。
   - 前腕等のFolder WARPで、anchorに接続したdirect-child PIVOTと子孫が追従する。
   - OFFで通常FKへ戻る。
   - WARP未作成でONを拒否する。
   - GRID再構成等でanchorがstaleになった時、接続成立表示を消して通常FKへ戻る。
   - preview / playback / onion / random seek / Bake / GIF / APNG / Project reloadで位置が一致する。
   - POINT / BRUSH / SELECT、Folder別WARP、Motion、2-Bone IK Pose Bake、Animation Table同時使用を壊さない。
   - Undo / Redo、CAF複製、source / target削除、Table close / reopen、console error。
   - 可能ならpen / touch。
4. Ownerが受入を明示した後だけPhase 7cをcloseする。`task-codex/phase7c.md`を`開発用資料保管庫/Archive/phase7c.md`へ移し、PROGRESS、proposal 00 / 01 / 15を同期し、本書もArchiveへ移す。
5. 次Phaseは現行候補と`RIG済み階層移動の安全Gate`を比較してSOLで立ち上げる。Ownerの優先指定があればそちらを優先する。

## RIG済み階層移動の予約済み判断

- 表示親`parentLayerId`とRig親`parentPartId` / `parentBoneId`は別正本。表示階層移動を理由にRigリンクを自動解除・暗黙再接続しない。
- 同一親内の前後並べ替えはRig参照を維持して許可する。
- `parentLayerId`が変わるreparentは、Part / Bone binding、Raster Mesh / Skin、Folder WARP anchor、RenderIsland / clipping境界を事前検査する。
- 最初の安全SliceではRig関連subtreeまたはRig境界を跨ぐreparentを理由付きで拒否する。
- Layer Panel表示は単独の`R`ではなく、既存正本から導出するSetup青の連結node icon + 小型`RIG` chipを第一案とする。新しい`isRigged`保存flagを作らない。
- 詳細は`開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`の「後続安全Gate」を正本とする。

## 維持する契約

- stroke中working Layer表示。
- preview staging交換と`background -> back preview -> currentFrameContainer -> front preview`順。
- 上側Laneが前面。
- Lane / Timeline onionのdisplay-only境界。
- PSD record順。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clipping、RenderIsland、通常Layer / CAF内部Layerのdata adapter境界。
- Folder WARPは`ClipInstance.folderDeformers`、Bone Poseは`ClipInstance.rigMotion`、static Rigは`ClipAsset.rigDefinition`。
- preview / playback / onion / Bake / exportは同じsample / evaluatorを使う。
- 新しいMotion、WARP、Mesh、mask、physics正本を並行実装しない。

## 検証

コード変更時は変更対象の`node --check`、関連verifier、全`tegaki_work/build/verify-*.mjs`、`npm.cmd run build`を行う。UI変更はBrowser操作とconsole errorも確認する。

build後は、追跡済み基準ファイルを含む`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`を全削除せず、生成差分だけを残さない。

## モデル分担

- Phase 7c受入判定、close、次Phase Gate設計: `gpt-5.6-sol / xhigh`。
- SOLが`GO`にした限定Stage実装: `LUNA / MAX`。
- 実装後のdiff / 正本重複 / History / coordinate / preview・Bake・export最終review: `gpt-5.6-sol / xhigh`。
