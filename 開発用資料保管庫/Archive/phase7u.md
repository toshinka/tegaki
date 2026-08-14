# Phase 7u — Vite / Build Tool Security Patch

更新日: 2026-08-13
担当: SOL / XHigh（Gate・最終監査）、限定dependency更新はSOLまたはLUNA / MAX
状態: CLOSED — Stage A〜C、audit 0、全61 verifier、build / dev smoke、SOL最終review=`A`

## 1. Goal

PixiJS 8.19互換更新やapplication runtimeを変更せず、現在の`npm audit` high 3件をVite 8.0系の最小安全patchとtransitive lock更新で0件へする。

## 2. Current evidence

- direct Viteは`^8.0.12`、lock / installedは8.0.12。
- `npm audit --json`はVite、PostCSS、Nanoidのhigh 3件を報告する。
- Vite advisory範囲は8.0.0〜8.0.15。8.0.16は同minorの最初の範囲外patch。
- Vite 8.0.16のPostCSS rangeは`^8.5.15`。安全なPostCSS 8.5.23以上とNanoid 3.3.17以上へlock解決できる。
- Vite 8.2.1も利用可能だが、今回はsecurity patchをfeature / bundler更新と分離するため8.0.16 exactを第一案とする。

## 3. In scope

- `package.json`のViteをexact `8.0.16`へ更新する。
- `package-lock.json`とinstalled Vite / PostCSS / Nanoidをnpmの正規解決で同期する。
- package / lock / installed version、audit 0、Vite config非変更を固定するverifierを追加する。
- 全verifier、production build、dev配信入口、生成差分清掃を行う。

## 4. Out of scope

- PixiJS 8.19.0、application production source、保存schema、History、UIの変更。
- Vite 8.1 / 8.2機能採用、config再設計、bundler tuning、chunk分割。
- `npm audit fix --force`、無関係dependency更新。
- WebGPU / Canvas renderer、Mesh、Motion機能追加。
- Phase 7t multi-model設定変更。

## 5. Stage plan

### Stage A — dependency snapshot / update

- 更新前Vite 8.0.12 / PostCSS 8.5.14 / Nanoid 3.3.12とaudit high 3を記録する。
- `npm.cmd install --save-dev --save-exact vite@8.0.16`でdirect / lock / installedを同期する。
- 実際に変わったpackageをlock diffと`npm ls`で確認し、無関係更新があれば停止する。

### Stage B — compatibility Gate

- `verify-vite-security-patch.mjs`を追加し、direct exact、lock / installed、safe lower bounds、Vite config / application source非変更を検査する。
- 全`verify-*.mjs`、production build、Vite dev配信入口とconsole startup errorを確認する。
- `dist/`と`.vite/`は追跡済み基準を個別restoreし、検証済み生成物だけを清掃する。

### Stage C — SOL final review / close

- `npm audit --json` total 0、高0。
- project-owned diff check、対象外変更0、全verifier / build成功。
- Browser UI変更はない。dev serverのHTTP / module graph確認をruntime smokeとし、描画実機受入を再要求しない。

## 6. Acceptance criteria

- Viteはpackage / lock / installedでexact 8.0.16。
- PostCSSは8.5.23以上、Nanoidは3.3.17以上。
- `npm audit` vulnerability total 0。
- PixiJSは8.19.0のまま。
- Vite configとproduction JS / CSSに対象外diffなし。
- 全verifier、build、dev配信、生成物清掃を通過する。

## 7. Stop conditions

- Vite 8.0.16でaudit 0にならない。
- npm解決がPixiJSまたはapplication dependencyを意図せず更新する。
- build / dev失敗がVite 8.0.16の範囲で説明できない。
- Vite 8.1 / 8.2またはconfig変更が必要になる。

停止時は範囲を広げずSOLへ`BLOCKED / REPLAN`を返す。

## 8. Model decision

- Gate・依存diff・失敗判断・最終review: SOL / XHigh。
- exact dependency更新、verifierの限定実装、定型check: LUNA / MAX向き。
- 現taskではPhase 7tのnested CLI実測が高コストだったため、SOLが短いStageを直接処理してよい。新taskでproject agentを直接spawnできる場合はLUNA / MAXを優先する。

## 9. 最終結果

- Viteを`^8.0.12` / lock 8.0.12からexact 8.0.16へ更新した。
- npm正規解決でPostCSS 8.5.26、Nanoid 3.3.18、Rolldown 1.0.3、必要binding等へ同期した。PixiJSはexact 8.19.0を維持した。
- 更新前`npm audit` high 3 / total 3から、更新後high 0 / total 0になった。
- `verify-vite-security-patch.mjs`を追加し、direct / lock / installed、PostCSS / Nanoid安全下限、PixiJS、Vite script契約を固定した。
- 変更mjsのnode check、全61 verifier、`npm.cmd run build`を通過した。Vite 8.0.16 dev serverは209msで起動し、`/`、`/@vite/client`、`/core-initializer.js`がHTTP 200。
- UI / runtime production source、Vite config、保存・Historyは変更していない。Browser描画受入は非対象。
- 追跡済み`dist/` / `.vite/`基準を個別restoreし、検証済み未追跡生成40件とPhase専用logだけを清掃した。
- GitHubURLはPhase 7u verifierまで同期し、close前集計HTTPS 187 / Raw 180 / 重複0 / local欠損0。
- 2026-08-13、SOL最終review=`A`で技術close。
