# 個人用フォントの自動参照

状態: REFERENCE。実行契約は [WP-023](../work/WP-023-font-auto-local.md)、現在地はSTATUS。

接続を繰り返さず、E:\Data\TegakiFonts の登録済み書体を開発版から参照する。通常の接続行は非表示、manual picker/IDB handleの仕組みは将来公開版用に保持。ON/OFF設定なし。

Vite serveのloopback限定経路で、catalog登録済みfontと作者資料だけを読む。実体をpublic/distへコピーしない。固定root内の実path検査、ID allowlist、Host/Origin/接続元の検査で任意local fileと外部サイトの読取りを拒否する。公開build/previewでは自動経路を作らない。

フォントを使った作品の制作と、元フォントファイルの配布は別。各書体の既存作者資料・使用条件はEに保持。公開用の同梱書体と任意DLの選定は別Sliceで扱う。

## 検証

実装後の技術確認を記録する。Owner制作受入・液タブは別判定。
