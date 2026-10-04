# WP-022 — 場面別整理と外部保管

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Owner実機受入・push未実施。現在地はSTATUS、実装範囲は[WP-022](../work/WP-022-font-organization.md)。

## 初期分類の判断

Owner資料の直下jpg11枚を参照。漫画実例 `DvHc7OfVsAAwgzB.jpg`, `Eyj5VguWgAcc1Mc.jpg`, `HF8-CO3boAAAYuS.jpg`, `GiIIojhasAEsyK6.jpg`, `GKnw_KfawAAEnpk.jpg`, `G3oZW6wWcAAZFpN.jpg`、濁点/明朝の比較 `HJFJcRIbcAAlVHK.jpg` と、手書き/装飾一覧。アンチックの通常会話、明朝の心の声・回想、太いゴシックの大声、弱い手書きのためらい、機械声の書体差などを初期配置へ反映。推薦画像にある有料書体を取得済みと扱わず、紹介の用途を参照する。画像の漫画濁点実例は取得した版の全字形保証ではない。

Primary源暎アンチックと比較用F910新コミック体は直下。漫画・場面別の下に会話・キャラ声、モノローグ・心の声、回想・記憶、叫び・怒り・強調、弱さ・ためらい・震え、喜び・ギャグ・おどけ、恐怖・不穏・威圧、妖艶・セクシー、放送・機械・通信、手書き・手紙・余白、筆・和風・儀礼。タイトル・擬音・MVはポップ/かわいい、クール/工業、装飾/立体/輪郭へ分ける。

源暎こぶり明朝はモノローグを初期収納先とし、回想にも使える。黒薔薇はまず恐怖へ置く。妖艶/セクシーや回想は今後の多様性を受け入れる空フォルダも残す。かなだけの装飾書体は見出し/MV用途で保持。単一の収納先は用途の独占を意味しない。手動変更と名前変更が可能で、同じ書体を複製しない。

## 外部保管

`E:\Data\TegakiFonts\Library` に元実体/作者資料を一書体単位で保持。`Archive` は取得元archive/展開物とdecode保留2件。`Inbox` はOwner追加の未監査原本。`Inbox\URLメモ` は任意のURL/text/.url。書体かzipの名前とURLだけでも残すと、後の一次配布元/版/条件の照合が容易。

27書体83ファイルをコピーしSHA256一致。取得cache29件101ファイルも外部ArchiveへコピーしSHA256一致。metadataのfontId/familyは維持。表示収納先はブラウザのUI設定であり、Windowsの物理パスを変更しない。Inboxを自動導入しない。

作業中の外部commitでHEADが `b7d7fddf` から `9d8a9f5b` へ更新され、元font/資料を含む公開側85ファイルがtrackedになった。読み取り専用 `git ls-remote origin refs/heads/main` でも2026-10-04に同HEADを確認。今回の移設で現在の公開側から除去するが、過去Git履歴の実体は消えない。履歴書換え・remote更新は行わずOwnerへ返す。追加DLは保留を維持。

最終照合: 外部commit/pushでHEAD/origin mainが `a78263db82fee54eeb48fd6323b48c24a44b538d` へ更新。remote SHAを再確認し、その現行treeのpublic/fontsはcatalog.jsonとinspection.jsonの2個だけ、元font/作者資料の削除は反映済み。過去履歴の実体は残る。agentからcommit/pushは行っていない。最終の手動favorite順投影と完了文書等5fileの差分はlocalで保持。

## 検証

### 結果

- syntax: font-library/font-organization/balloon-popup/font-tree/keyboard-handler PASS。Python/移設PowerShell構文 PASS。
- metadata/lazy load/重複排除/再試行/prefs: curated verifier PASS。model/bridge/legacy seed/permission/安全path/read/hash/retry: organization verifier PASS。native IDBRequest.resultの継承accessorを読む回帰caseを追加。
- balloon verifier、shortcut-learning-boundary、harness（58 documents / 224 local links / 13 packages）PASS。
- Chromium: E原本のbytesを隔離したブラウザproof directoryへ読み込み、実DirectoryHandle/IDB/FontFaceで全27書体decode PASS。Windowsのpickerだけをproof rootへの返却に置換している。本物のE picker/OS許可画面の成功を意味しない。
- 実製品Browser: 接続button、保存handle再読込み、wheel前後/端停止/ctrl/微小入力、折畳み/keyboard Enter/Escape、native HTML drag/drop、収納先select、↑による手動順、favoriteの全体上位表示と元配置/手動順保持、コメントreload PASS。folderはmodel verifierで作成/rename/delete/cycle拒否を検証。
- 外部fontで縦/横の実文字確定、再編集/更新、Undo/Redo、実Project export→loadでfontId保持 PASS。未接続でApplyが別書体のLayerを作らないこともBrowser確認。
- 従来本人import: 実IDB保存/フォルダ/reload/ロード/deleteとcatalog delete禁止 PASS。
- 公開側83ファイルをEと再hash照合して削除、取得cache29件101ファイルも外部へ集約。public/fontsとdist/fontsはcatalog/inspectionだけ、元font/archiveゼロ。build PASS。npm prebuildが今後のpublic混入を拒否、gitignoreでもmetadata以外を除外。

Browserで見つけたhandle復元の誤り、Canvasキー競合、popup移動によるnative D&D阻害、keyboard callbackのoptions落ちをleadが修正し再検証した。favorite上位は元の手動順で安定した投影とし、物理/論理収納先を動かさない。

証拠はignored `.cache/font-acquisition/browser-organization-results.json`（全27）とquick/UI/native import試験、画像。第三者画像や元fontを成果へ追加しない。初回の本物のWindowsフォルダpicker、権限再許可画面、液タブの手応え、全字形の制作受入はOwner操作で確認する。外部実体をHTTP配信する設定は追加していない。

今回LUNA maxのbackend/UI限定Sliceを分け、完了通知を受けて統合。親は移設・分類・検証を担当し、全文logの巡回を繰り返さなかった。変更後/不具合再現後の関係する検証だけを追加。
