# 個人用フォントの自動参照

状態: REFERENCE。実行契約は [WP-023](../work/WP-023-font-auto-local.md)、現在地はSTATUS。

接続を繰り返さず、E:\Data\TegakiFonts の登録済み書体を開発版から参照する。通常の接続行は非表示、manual picker/IDB handleの仕組みは将来公開版用に保持。ON/OFF設定なし。

Vite serveのloopback限定経路で、catalog登録済みfontと作者資料だけを読む。実体をpublic/distへコピーしない。固定root内の実path検査、ID allowlist、Host/Origin/接続元の検査で任意local fileと外部サイトの読取りを拒否する。公開build/previewでは自動経路を作らない。

フォントを使った作品の制作と、元フォントファイルの配布は別。各書体の既存作者資料・使用条件はEに保持。公開用の同梱書体と任意DLの選定は別Sliceで扱う。

## 検証

- 構文、fonts4 verifier、balloon verifier、harness、production build PASS。
- 実Eの27書体をChromiumでdecode。picker呼出0、接続UI非表示。wheel/keyboard/native D&D/収納/favorite/見本、Apply/Update/UndoRedo/実Project export-load、reload後の自動読込を確認。
- 実HTTPで元font SHA一致、foreign origin、別local port、DNS rebinding Host、cross-site/image、unknown ID、任意query、encoded traversal、preflight拒否。Vite `/@fs/` 直指定はSPA HTMLを返しfont bytesなし。
- Vite既定CORSのpreflightがpluginより先に応答するため、serve時のCORSをfalseへ設定。再検証PASS。
- preview HTTPはSPA HTMLでbridge/fontなし。production Browserはautomatic設定なし・bridge request0。`--host 0.0.0.0` は起動前に拒否。
- Browserの収納reload検証で1回手動root順の不一致があり、診断付き再実行は保存前後同じ順でPASS。自動参照とは別に、後続の選択UI改修でasync更新を確認する。
- 証拠はignored `.cache/font-acquisition/browser-auto-fonts-results.json`, `http-auto-fonts-results.json` とPNG。元実体はpublic/distへ追加していない。

Owner制作受入・液タブは別判定。agent commit/pushなし。応答時間と比較pageは後続WP-024。
