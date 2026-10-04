# WP-031 Rive editor operational entry — 実装結果

## START / FINAL

- START: `main` / `871c51ed850f436aa0d49deb049bf7276c3a9655`。
- FINAL: 同じ `main` / `871c51ed850f436aa0d49deb049bf7276c3a9655`。既存の全 dirty/untracked は保持し、commit/push は行っていない。
- write owner: `advanced/rive-editor/dev-companion.mjs`、`build/rive-editor-dev-bridge.mjs`、`advanced/rive-editor/server.mjs` の health 識別、`build/verify-rive-editor-dev-bridge.mjs`、この report、専用 cache のみ。
- Vite config、host UI、product entry、font bridge、Project/History/renderer、package/lock は変更していない。

## 実装

### Dev companion

- `verifyFixedCache()` は WP-026/029 の固定 CLI/runtime cache を spawn 前に検査する。CLI `rive 1.3.0`、CLI/archive/runtime archive、served runtime 3 files の hash mismatch は `cache-hash-mismatch`、欠落は `cache-unavailable` として spawn しない。
- installation ID は `realpath(tegaki_work)` の SHA-256 `57f42ac8e59d94e188145f6824c40bbd399b38c773529d151efd7f5b677fbcab`。raw filesystem path は HTTP response に出さない。
- status は spawn せず、ensure は single-flight。free の port だけ固定 `process.execPath` + 固定 `server.mjs` を child として起動する。外部 CLI 引数、PATH/system install、network/login は使用しない。
- `/health` を app/protocol/installationId/pid で照合し、同一 installation の既存 service だけを再利用する。他 installation、別 app、識別不能 health は `editor-port-occupied-*` で拒否し、stop/kill/restart しない。
- ready 後も ensure ごとに health と child PID を再照合する。自分の live child が一致する場合は `owned:true` と child reference を保持し、消失時は固定 cache 検査後に own child を再起動する。同一 installation の再利用でも固定 cache mismatch は ready にしない。
- close は自分が spawn した child だけを停止し、再利用 service は停止しない。creation token、health、ownership、stop reason は `tegaki_work/.cache/rive-editor/dev-companion-receipt.json` に記録する。child `exit` と close が同時に receipt を更新しても JSON が連結しないよう、書き込みを直列化し、temporary file から atomic rename する。

### HTTP bridge / health

- serve-only Vite plugin `tegaki-rive-editor-dev-bridge` を追加した（Vite 側の登録は司令 owner の後続作業）。
- `GET /__tegaki/rive-editor/status` は `{schema,phase,reason,nonce}` を返し、spawn しない。
- `POST /__tegaki/rive-editor/ensure` は exact same Origin、`x-tegaki-rive-nonce`、空 body、query 無しだけを受ける。body 上限は `1024` bytes。拒否は query/method/origin/nonce/body/loopback reason を分離する。CORS header は付けない。
- `server.mjs` の `GET /health` は `{app:"tegaki.rive-editor",protocol:1,installationId,pid}` を返す。保存、CLI、renderer、nonce mutation 契約は変更していない。

## Verification

### Static / fake boundary

`node --check`（dev-companion / dev-bridge / verifier / server）と `git diff --check` を実行した。修正前の full verifier baseline は **41 checks PASS**。

- status non-spawn、ensure single-flight、same-origin/nonce/body/query/method/loopback 拒否、CORS 無し。
- same-installation reuse、other-installation/unknown occupancy の spawn `0`、SDK/cache missing の spawn `0`。
- reused service の消失→固定検査後の recovery、owned re-ensure 後の close own stop、reuse + hash mismatch の ready/spawn 拒否。
- fake child の creation token/health/ownership/stop receipt。

司令監査で再現した receipt 並列書き込みを修正後、native 経路を無効化した限定再実行も行った。結果は **35 checks PASS / native HOLD (`native-disabled-for-audit`)**。同じ exit/close race fixture の receipt JSON 読み戻しは追加 20 iterations も PASS した。この再実行は固定 cache、HTTP boundary、fake state machine と receipt JSON の読み戻しだけを対象にし、18729 の native spawn/stop/API mutation は行っていない。

### Native

修正前の native proof として、`node tegaki_work/build/verify-rive-editor-dev-bridge.mjs` の実測結果を cache に保持している。今回の receipt 直列化修正後は、司令が 18729/18831 の Browser 検証を行うため native を再起動していない。

- cache: `rive 1.3.0`。
- CLI SHA-256: `285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9`。
- CLI archive SHA-256: `F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF`。
- runtime archive SHA-512(base64): `1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA==`。
- served runtime: `canvas_advanced.mjs=8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9`、`rive.wasm=A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74`、`rive_fallback.wasm=A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5`。
- native child PID `68424` の health は app/protocol/installationId/pid が一致し、second companion は `reused` となった。reused close では service が存続し、owner close でだけ停止した。
- stop receipt: `event:"stopped"`, `owned:true`, `pid:68424`, `stopReason:"vite-close"`, `stoppedAt:"2026-10-04T12:31:33.017Z"`。最終確認は port `18729` listener `0`、PID `68424` 不在。

詳細な machine receipt は `tegaki_work/.cache/rive-editor/wp031-dev-bridge-verification.json` と `dev-companion-receipt.json` に保存した。

## 未測定 / owner境界

- Vite config への登録、product host の lazy iframe/UI、native frame/Raster/History/Undo/Project の実操作は司令所有で未実施。
- production build/preview への組込み、Owner acceptance、commit/push はこの worker の範囲外である。
