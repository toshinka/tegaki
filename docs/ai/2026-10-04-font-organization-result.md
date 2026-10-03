# WP-022 — 場面別整理と外部保管

状態: 実装中。Owner実機受入・push未実施。現在地はSTATUS、実装範囲は[WP-022](../work/WP-022-font-organization.md)。

## 初期分類の判断

Owner資料の直下jpg11枚を参照。漫画実例 `DvHc7OfVsAAwgzB.jpg`, `Eyj5VguWgAcc1Mc.jpg`, `HF8-CO3boAAAYuS.jpg`, `GiIIojhasAEsyK6.jpg`, `GKnw_KfawAAEnpk.jpg`, `G3oZW6wWcAAZFpN.jpg`、濁点/明朝の比較 `HJFJcRIbcAAlVHK.jpg` と、手書き/装飾一覧。アンチックの通常会話、明朝の心の声・回想、太いゴシックの大声、弱い手書きのためらい、機械声の書体差などを初期配置へ反映。推薦画像にある有料書体を取得済みと扱わず、紹介の用途を参照する。画像の漫画濁点実例は取得した版の全字形保証ではない。

Primary源暎アンチックと比較用F910新コミック体は直下。漫画・場面別の下に会話・キャラ声、モノローグ・心の声、回想・記憶、叫び・怒り・強調、弱さ・ためらい・震え、喜び・ギャグ・おどけ、恐怖・不穏・威圧、妖艶・セクシー、放送・機械・通信、手書き・手紙・余白、筆・和風・儀礼。タイトル・擬音・MVはポップ/かわいい、クール/工業、装飾/立体/輪郭へ分ける。

源暎こぶり明朝はモノローグを初期収納先とし、回想にも使える。黒薔薇はまず恐怖へ置く。妖艶/セクシーや回想は今後の多様性を受け入れる空フォルダも残す。かなだけの装飾書体は見出し/MV用途で保持。単一の収納先は用途の独占を意味しない。手動変更と名前変更が可能で、同じ書体を複製しない。

## 外部保管

`E:\Data\TegakiFonts\Library` に元実体/作者資料を一書体単位で保持。`Archive` は取得元archive/展開物とdecode保留2件。`Inbox` はOwner追加の未監査原本。`Inbox\URLメモ` は任意のURL/text/.url。書体かzipの名前とURLだけでも残すと、後の一次配布元/版/条件の照合が容易。

27書体83ファイルをコピーしSHA256一致。取得cache29件101ファイルも外部ArchiveへコピーしSHA256一致。metadataのfontId/familyは維持。表示収納先はブラウザのUI設定であり、Windowsの物理パスを変更しない。Inboxを自動導入しない。

作業中の外部commitでHEADが `b7d7fddf` から `9d8a9f5b` へ更新され、元font/資料を含む公開側85ファイルがtrackedになった。読み取り専用 `git ls-remote origin refs/heads/main` でも2026-10-04に同HEADを確認。今回の移設で現在の公開側から除去するが、過去Git履歴の実体は消えない。履歴書換え・remote更新は行わずOwnerへ返す。追加DLは保留を維持。

## 検証

製品/Browser/公開側除去の結果は完了時に追記。初回の本物のWindowsフォルダpickerと液タブの手応えはOwner操作で確認する。
