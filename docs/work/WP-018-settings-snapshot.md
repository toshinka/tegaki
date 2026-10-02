# WP-018 環境スナップショット（設定のアルバム保存 / PNG埋め込み）

状態: TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。更新日: 2026-10-02。

## Goal

設定のエクスポートが無い代わりに、QTP・各ツール・設定の状態を名前を付けて保存し、過去の環境を**当時のまま**復元して続けられるようにする。PNGのコメント（iTXt）に埋め込んで持ち運び、そこから取得もできる。

## 設計判断

| 論点 | 採用 | 理由 |
|---|---|---|
| 保存先 | **別のIndexedDB**（`TegakiSettingsSnapshots`）。アルバム本体（作品のスナップショット）の保存形式・UIは変えない | アルバムの契約（`AlbumStorage` / 作品のProject参照）に触れず、環境だけを独立に扱える。UIは設定popupの「環境スナップショット」欄 |
| 対象 | localStorageの**許可リスト**（`tegaki_settings` / `quick-access-*` / `tegaki-*` のUI設定。トーン・定規・吹き出し・コマ割り・集中線・ツールスロット等）。アルバム/緊急復旧は除外。1値256KB・合計768KB・80キーまで | 想定外のキーや巨大データを取り込まない。取り込みフォント（IndexedDB）・作品は含まない |
| 復元 | 許可リストのキーを**当時のまま**に（スナップショットに無い許可キーは消す）→ 再読み込み。復元の直前に「復元前（自動）」を保存して戻れる | 全モジュールが起動時にlocalStorageを読むので、再読み込みで確実に反映。取り返しがつく |
| PNG | カード画像（ふたば配色、名前・日時・項目数）に `iTXt`（keyword `tegaki-settings`、UTF-8、非圧縮）で設定JSONを埋め込む。画素・他チャンクは不変、既存の同keywordは置換 | 通常のPNGビューアで開ける。CRC32つきの正しいチャンク |
| 読み込み | PNG（iTXt）またはJSON。許可リスト・JSON妥当性・サイズで検証し、不正は拒否。読み込んだものは一覧に「（読込）」で追加し、復元は一覧の「復元」から | 外から来たデータをそのまま書き込まない |

## ファイル

- `system/png-text-chunk.js`（純粋: embed / extract / crc32）、`system/settings-snapshot.js`（collect / sanitize / apply / PNG往復）、`system/settings-snapshot-store.js`（IDB、30件まで）、`ui/settings-snapshot-section.js`（UI）。
- 検証: `build/verify-settings-snapshot.mjs`（harness domain `settings-snapshot`）。

## 確認（Chromium）

- 保存 → 別の値へ変更 → 復元（再読み込み後に、トーン設定・QTP位置・ショートカットヘルプ表示が当時の値へ戻る）。「復元前（自動）」が一覧に残る。PNG書き出し → 読み込み（「（読込）」で追加）。タグの無いPNGは拒否。

## 制約・次の候補

- 作品（Project）・アルバムの中身・取り込みフォント・緊急復旧は含まない。フォントも含めたい場合は別途（サイズが大きい）。
- アルバム画面への統合（アルバムのタイル表示に環境カードを並べる）は未対応。今は設定popupから操作。
- 他端末へ持ち運ぶとき、QTPの位置は画面サイズで丸められる（既存のクランプが働く）。
- Owner実機（液タブ）は未確認。
