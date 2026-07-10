# Phase 5u - CAF複数payloadとCAF Group基盤

## 目的

Phase 5tの複数選択・原子的一括移動を基盤に、複数CAFのcopy/pasteと永続的なCAF Groupを同じ相対配置payloadへ載せる。CAF Groupは移動・複製の操作単位であり、ClipAsset内部FolderやLane Folderとは別概念にする。

## 判断

- 複数copy/pasteをCAF Group必須にはしない。短い一時操作で毎回group化を要求しない。
- 直接の複数copy/pasteとCAF Groupのcopy/pasteは、同じ `clipIds + anchor + relative lane/frame` payloadと原子的配置検証を使う。
- CAF Groupを単なる保存済み選択集合にせず、明示的な作成・解除・保存・History境界を持つTimeline構造とする。
- UI表記はfolder iconを使っても、コードと保存形式では `CAF Group` と呼び、CAF内部Layer Folderと混同しない。

## 維持する契約

- `selectedCelId` は単体編集対象、`selectedCelIds` は現在のUI選択集合。
- Phase 5tの `canMoveClips()` / `moveClips()` を一括配置の正本とし、別の衝突判定を増やさない。
- 上側Lane前面、preview staging/container順、PSD record順、Lane visibility、Playback Scope、onionへ影響させない。
- 単体CAF clipboardのClipAsset共有/複製契約を監査してから複数payloadへ拡張する。

## Slice 0 - clipboard・保存境界監査

- 既存単体CAF copy/pasteがClipAssetを共有するか複製するか、History、削除、save/load後の参照を確認する。
- 複数payloadのanchorを主選択CAFとし、各CAFの相対Lane/frame、duration、asset参照を記録する。
- paste先全件が有効な時だけ一括確定し、部分paste・暗黙押し出しを行わない。

監査結果:

- 単体pasteはClipAssetとDrawingSnapshotを複製し、元CAFから独立したAssetを作る。
- 複数pasteも独立コピー契約を維持する。ただし選択内で同じAssetを共有するCAFは、貼付け側でも1つの複製Assetを共有して参照関係を保つ。
- Timeline全体のbefore/afterを1 Historyとして記録し、失敗時はbeforeStateへ戻す。
- clipboard自体はruntime UI stateでありproject保存対象にしない。貼付け後のCAF、Asset、Snapshotだけを既存project保存へ載せる。

## Slice 1 - 複数CAF copy/paste

- 2件以上の選択中に既存Copy操作を押すと複数payloadを作る。
- PasteはアクティブLane/current Frameをanchorとして相対配置を復元する。
- Lane不足、Frame範囲外、非選択CAFとの衝突は全体拒否し、理由をbutton disabled/titleまたは短いfeedbackで示す。
- pasteを単一Timeline Historyとし、Undo/Redoで全件を同時に追加・削除する。

実装状態:

- 複数payload生成、相対Lane/frame paste、Asset参照関係を保った複製、配置全体の事前検証、単一Historyを実装済み。
- Browserで2件の別Lane paste、衝突/Lane不足時disabled、Undo/Redo、選択復元、console errorなしを確認済み。
- 単体copy/paste回帰とproject round-tripは次の検証項目として残す。

## Slice 2 - CAF Group作成・解除

- 2件以上選択時にCAF Group buttonを表示する。
- 作成可能な時はfolder iconを通常表示、不可能な時は薄くしてdisabled理由をtitleへ出す。
- 作成条件は、選択CAFをLane×Frame占有範囲として見た時に1つの連結成分になることとする。同一Laneでは前後端が接するCAF、隣接Laneでは時間範囲が重なるCAFを隣接と判定する。Lane飛び・時間gapだけの集合はgroup化しない。
- group memberのどれかを通常clickした時はgroup全体を選択し、最後に操作したmemberを主選択にする。
- active groupでGroup buttonを再度押すか、明示Ungroup操作で解除する。
- group作成・解除・member削除時の自動解除をTimeline Historyと保存復元へ含める。memberが1件以下になったgroupは自動解除する。

実装状態:

- Timeline直下の `clipGroups`、連結判定、作成/解除、History、serialize/restore、member削除時のreconcileを実装済み。
- folder buttonの表示、非連結時disabled/title、group member clickによる全体選択、grouped outlineを実装済み。
- Browserで作成、解除、非連結拒否、member click全体選択、Undo/Redoを確認済み。
- 同一Laneで連続するGroupは先頭/中間/末尾classで1つの外周破線として描画し、内部の縦破線を出さない。複数Lane・非矩形Groupは個別破線を維持する。
- Group memberの左右retiming handle、下部↔、Duration ±を無効化し、CAF全体を一括移動grab領域にする。
- member削除後に連結条件を再評価し、非連結または1件以下になったGroupは自動解除する。

## Slice 3 - Group移動・copy/paste

- Group dragはPhase 5tの複数移動APIを使う。
- Group copy/pasteはSlice 1の複数payloadを使い、専用の第二clipboard経路を作らない。
- groupを複製する場合は新しいgroup idを払い出し、元groupとのmembershipを共有しない。

実装状態:

- Group移動はPhase 5tの選択集合一括移動へ接続済み。
- Group全体をcopyしたpayloadにはsource Groupを記録し、paste成功時に新しいGroup IDを払い出す。
- Group pasteのブラウザ実操作確認が残る。
- オーナー実機でGroup移動・copy/pasteを確認済み。

## 棚上げ - 時間比率伸縮

- Tegaki側のCAF Groupは移動・複製の操作単位に限定し、時間比率伸縮は原則実装しない。
- Group内の個別retimingを無効化して誤操作を防ぐ現在の契約を維持する。
- 発想自体は、将来の別動画WEBUIでkeyframe、補間、素材instanceを正本として扱う場合のretiming候補として記録する。
- 将来再評価する場合も、TegakiのCAF Groupへ後付けせず、動画ツール側の時間変換結果をCAFへ書き出す変換境界として設計する。

## 非目標

- CAF GroupをClipAsset内部Folder、Lane Folder、Playback Scope、export groupとして扱うこと。
- group内へgroupを入れるnest。
- marquee選択、任意ラベル・色・命名UI。
- Tegaki側CAF Groupの時間比率伸縮。

## 最初のslice

既存単体CAF copy/pasteのasset参照、paste衝突、History、save/load契約を監査し、複数payloadの仕様を確定する。Group保存形式の実装はこの監査後に開始する。

## 検証

- 変更JSの `node --check` と `npm.cmd run build`。
- 複数copy/paste、衝突全体拒否、Undo/Redo、save/load。
- Group作成可否、disabled表示、選択、移動、解除、member削除、copy/paste、Undo/Redo、save/load。
- Browser console errorを確認し、build後の `dist/` と `node_modules/.vite/` の生成差分を残さない。
