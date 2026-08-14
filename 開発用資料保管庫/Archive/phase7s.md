# Phase 7s — PixiJS v8.19 Compatibility / Agent Context

更新日: 2026-08-13  
担当: SOL / XHigh（Gate・互換監査・最終review）、限定依存更新はLUNA / MAXまたはSOL  
状態: CLOSED — Gate 0 `GO`、SOL最終review=`A`。Browser実操作は制御環境blockerのためOwner確認台帳へ分離

## 1. 目的

PixiJSを現行8.17.0から8.19.0へ限定更新し、TegakiのWebGL描画、RenderTexture、mask、Mesh、export、save / reload境界を維持する。同梱された公式PixiJS v8 Agent SkillsをAI参照導線へ加え、v7 APIや未確認APIを生成するハルシネーションを減らす。

## 2. Gate 0監査

### 公式差分

- v8.18はword-wrap付きPixi Textの`width`、Graphics→SVG、Sprite mask channel、renderer preference配列等を追加した。
- v8.19は`updateTransform()`のzero scale、ParticleContainerの親blend継承、FillPattern座標系を挙動変更し、HTML source、WebGPU transient MSAA、TextureMatrix / GC / context lost等を修正した。
- npm packageへPixiJS v8向け公式Agent Skills 25件が`skills/`として同梱される。

### 現行コード照合

- 依存宣言・lock・実インストールはいずれもPixiJS 8.17.0。
- 現行コードは`FillPattern`、`ParticleContainer`、`Container.updateTransform()`、Pixi `Text / HTMLText / BitmapText`を使用していない。
- `TilingSprite`は市松表示で使用するが、v8.19の修正対象である`tileRotation`を設定していない。
- `RenderTexture`、Sprite / Graphics mask、Mesh、BlurFilter、texture GCは広く使用する。保存正本はPixi runtime objectではなく既存Project / Snapshot dataを維持する。
- `Application.init()`はrenderer preference未指定。v8.19でも既定WebGLを維持し、本PhaseでWebGPU / Canvas renderer採用やfallback変更を行わない。

## 3. Gate 0判定

判定: `GO`

既知behavior changeの直接利用がなく、8.19のTextureMatrix / GC / context loss修正はTegakiの大量RenderTexture運用に有益。依存更新だけを独立Phaseにし、描画結果と保存 / exportを実操作で比較する。

## 4. Stage A — dependency / AI context

- `package.json`と`package-lock.json`を`pixi.js: 8.19.0`へ固定する。minor自動更新を許すcaretへ戻さない。
- `core:ready.version`等の手書きversion表示を8.19.0へ同期する。
- npm package内`node_modules/pixi.js/skills/`の存在と25 skillを確認する。
- AGENTS.mdへ、PixiJS実装時は同梱公式skillのentrypointと関連skillを参照し、実コード・TEGAKI境界を優先する規則を追加する。
- Web外部AI向けには公式release / Skills URLを`GitHubURL.txt`へ置く。外部skillをTegakiの仕様正本にはしない。

## 5. Stage B — compatibility verification

- import / build、全`verify-*.mjs`、変更JSの`node --check`。
- Browserで通常描画、消しゴム / clipping / inverse、Layer visibility、zoom / pan、Undo / Redo、save / reloadを確認する。
- Animation Tableでpreview / playback / onion、WARP / Mesh、Bake、GIF / APNGを関連smokeする。
- console error、WebGL renderer、PixiJS実versionを確認する。
- build後に追跡済み`dist/` / `node_modules/.vite/`基準を復元し、新規生成差分を残さない。

## 6. 非対象

- WebGPU / Canvas rendererの有効化、renderer fallback順変更。
- `pixi.js/html-source`、Graphics→SVG、mask channel、transient MSAAの機能採用。
- FillPattern / ParticleContainer / Pixi Text導入、BlurFilter見た目調整。
- save schema、Project data、History、sampler、compositor、export仕様変更。
- Motion History bug fix、Motion Path、manual Mesh、physics等の次候補。

## 7. 停止条件

- fixed fixtureで8.17と描画結果が一致せず、原因が既知behavior changeで説明できない。
- WebGLから別rendererへ暗黙切替する。
- save / reload / exportのRGBAまたはLayer順が変わる。
- 依存更新以外の大きな互換書換えが必要になる。

## 8. close条件

Stage A / B、全verifier、build、Browser回帰、SOL reviewを通過すれば技術close可能。長時間制作、端末別GPU、pen / touchはOwner確認台帳へ分離する。2026-08-13はBrowser制御transportがTegaki起動前に閉じ、同一task内で復旧不能だったため、Ownerの既存方針に基づき全静的・build・dev配信証跡とSOL reviewで技術closeし、Browser実操作一式も未確認としてOwner台帳へ明示分離した。

## 9. Stage A / 静的検証結果

- `package.json` / `package-lock.json` / 実インストールをPixiJS `8.19.0`へ固定した。Pixi transitiveの`parse-svg-path`は0.2.0へ更新された。
- npm packageの`skills/`にrouter 1件と専門skill 25件、計26ディレクトリがあることを確認した。AGENTS.mdへTegaki正本を優先する参照順とv7 API禁止を追加した。
- `core:ready.version`は手書きversionを廃止し、runtimeの`PIXI.VERSION`から生成する。
- `verify-pixijs-8-19.mjs`を追加し、package / lock / installed version、Pixi transitive、runtime version接続、v8 async init / `app.canvas`、renderer preference非変更、HTML source非導入、必須公式skillと26 directoryを固定検証する。project-owned root / `system` / `ui`も走査し、8.18 / 8.19挙動変更対象のFillPattern / ParticleContainer / Pixi Text群を新Gateなしに導入した場合は拒否する。
- 変更JS / mjsの`node --check`、全59 `verify-*.mjs`、`npm.cmd run build`を通過した。
- 追跡済み`dist/` / `node_modules/.vite/`基準を復元し、build / devが新規生成した未追跡53件を対象検証後に清掃した。

## 10. 残存 / Browser blocker

- in-app Browserは制御基盤がkernel assetの書込先を解決できず、Browser選択前にOS path errorで停止した。再初期化に加えBrowser補助プロセスだけを終了して再接続を試したが、現taskではtransport再接続されなかった。別automationへ迂回していない。
- 次回はCodex task / appのBrowser接続が再生成された状態で最初に同じ回帰を再試行する。これはTegaki runtimeの起動失敗ではなく、Browser選択前の制御環境blockerである。
- WebGL renderer、通常描画、mask / clipping、WARP / Mesh、preview / playback / onion、save / reload / export、consoleはBrowser復旧後にOwner確認台帳から確認する。Phase 7sはSOL技術close済みとし、問題発見時は限定bug fix Gateを新設する。
- `npm audit`は既存lockと同じVite 8.0.12 / nanoid 3.3.12 / postcss 8.5.14にhigh 3件を報告した。Pixi更新でversionが変わったpackageではなく、`npm audit fix`は本Phaseへ混ぜない。Vite / build tool security更新は別の限定候補とする。

## 11. SOL最終review

- 判定: `A（dependency / build / dev配信範囲）`。package / lock / vendor payload / runtime version接続、v8 Application契約、renderer境界、公式skill導線に追加修正を要する不整合はない。
- `verify-pixijs-8-19.mjs`拡張後も全59 verifierを再通過した。project-owned差分の`git diff --check`は問題なし。Pixi vendor配布物内の既存tab整形警告は配布物を改変して解消しない。
- Browser transport再接続不能の継続中に、project-owned sourceのaffected API監査をverifierへ昇格した。HTML sourceとFillPattern / ParticleContainer / Pixi Text群は明示的な次Gateなしに追加できず、今回の互換判定根拠が将来の変更で崩れた場合に検出する。
- Vite dev serverで`/`、`/@vite/client`、`/core-initializer.js`を起点にESM import graph 151 moduleを取得し、HTTP失敗0件を確認した。配信されたPixi chunkのruntime `VERSION`は`8.19.0`。これは起動・bundle解決の証拠であり、renderer描画のBrowser受入とは分離する。
- dev起動後は追跡済み`node_modules/.vite/`基準を復元し、今回生成された未追跡cache 43件だけをroot / allowed path検証後に削除した。`dist/` / `.vite/`の生成差分は0件。
- Browser実操作の証拠はない。WebGL renderer、通常描画、mask / clipping、WARP / Mesh、preview / playback / onion、save / reload / export、consoleはOwner確認台帳へ移し、問題発見時はPhase 7sを暗黙に再OPENせず限定bug fix Gateを立てる。

## 12. close

- 2026-08-13、SOL最終review=`A`で技術close。
- `package.json` / lock / tracked vendorをPixiJS 8.19.0へ同期し、公式Agent Skills参照導線と自動互換Gateを追加した。
- 全59 verifier、production build、dev ESM graph 151 module / HTTP失敗0 / runtime 8.19.0、project-owned `git diff --check`、生成物清掃を通過した。
- Browser実操作と端末別GPU / pen / touchは未通過のままOwner確認台帳へ明示分離した。この未確認をBrowser通過と読み替えない。
