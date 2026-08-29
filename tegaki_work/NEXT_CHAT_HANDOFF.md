# Tegaki 次チャット引き継ぎ

更新日: 2026-08-29

状態: Phase 9lまでclose。現行Phase 9mはStage B `C first`、一行header、固定幅Playback Range、OUT限定I / O＋context shortcut、borderless FPS / FRAMES / PREVIEW、Bottom Lucide COPY / DELETEまで全118 verifier / build / Browserの技術checkpoint済み。Owner実画面のstable header / Bottom icon再確認まではvisual未受入でOPEN、Clip Focus比較fixture / productionはHOLDする。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9m.md`
6. `開発用資料保管庫/Archive/phase9l.md`
7. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
8. `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`
9. `開発用資料保管庫/proposals/00_計画索引.md`
10. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
11. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
12. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
13. `ClaudeReview/gui-skin-redesign-revision-2026-08-25.md`
14. `ClaudeReview/color-philosophy-background-panel-icon-balance.md`
15. `tegaki_work/styles/main.css`
16. `tegaki_work/styles/components/sidebar-rail.css`
17. `tegaki_work/styles/components/layer-panel-surface.css`
18. `tegaki_work/styles/components/quick-access-popup.css`
19. `tegaki_work/styles/components/animation-table-playback.css`
20. `tegaki_work/styles/components/animation-table-utility-lod.css`
21. `tegaki_work/ui/animation-table-popup.js`

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

- 表示されるPhase 6z〜9lの実装、verifier、fixture、文書、proposal、Archiveは意図的な既存差分。すべて維持する。
- `restore` / `reset` / `checkout`で既存成果を巻き戻さない。
- `Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。
- proposal内の「過去計画」は現行正本で不足した情報の救出時だけ参照する。
- `.git/index.lock`は存在とstaleを確認してから必要時だけ削除してよい。
- `dist/`と`node_modules/.vite/`は追跡済み基準を持つ。build生成差分だけを限定清掃する。

## 3. 現在地

- Phase 9iはSidebar 8入口を6 popup launcher / 1 one-shot command / 1 temporary modeへ分類し、native button、popupの`aria-expanded`、Vの`aria-pressed`、Importの状態属性なしを既存stateへ揃えた。全108 verifier / build / Browser、SOL final review=`A`でcloseした。
- Phase 9jはLayer / Folder / CAFの固定appearanceを`--ui-layer-*`と`styles/components/layer-panel-surface.css`へ一正本化し、rendererのinline styleをwidth / indentだけへ限定した。
- Browserで通常Layer、Folder open / collapsed、Layer→Folder D&D、CAF header / internal mirror / Folder開閉 / internal Layer追加、wide / narrow、console error 0件を確認した。全109 verifier / build、Gate 1=`GO — A: Current warm`、SOL final review=`A`でcloseした。
- Phase 9kはOwnerがD淡色外周＋dark floating railを受入れた。productionはFutaba light-maroon上端98%→下端88% gradient、shadowなし、enabled trashは不透明on-dark橙`#ffb87e`。関連4 verifier / 全111 verifier / production build / Browser computed style / console 0件 / 生成物清掃を通過し、SOL final review=`A`でcloseした。
- 同じ数値の橙・grayでも暗色 / 淡色surroundで知覚上の強さが変わる同時対比をStyle Guideへ記録した。actual surface比較と数値contrastを併用し、色の錯視だけへstateを依存させない。長時間の明暗art、mouse / pen / touchのSpace＋dragはOwner確認台帳へ残す。
- Phase 9lはD Flat CAF context＋unified layer listをproductionへ限定接続した。右Panelは選択CAF一件の薄いcontextとinternal Layer / Folderだけを投影し、current targetは橙surface一件。CAF asset列挙とinternal Layer Pointer D&Dは右Panelから外し、CAF管理とD&DをAnimation Tableへ寄せた。Folder collapse選択、visibility / clipping、複数CAF、Table close / reopen、全113 verifier、build、Browser、console 0件を通過し、SOL final review=`A`でcloseした。
- 現行Phase 9mはStage B `C first`までproduction接続済み。Bottom utility、selected / resting Clip surface、47 / 33% visual LOD、Playback End直接cycle、OUT時だけI / O、F9〜F18停止 / reopen保持、console 0件、全117 verifier / buildを技術checkpointとして維持する。
- 2026-08-28のOwner実画面では、十分な横幅のTableでもheaderが`FPS / FRAMES / SCOPE`、Play、Playback End / PREVIEW / Onionの三行へ分裂した。2026-08-29のBrowser再現で、Table幅760pxは`.is-narrow=true`、header 91.78pxの三行、762pxはclass解除、36px一行と確定した。原因は内容不足ではなく、760px compact境界と三clusterを各100%幅へするCSSのbreakpoint不連続だった。
- compact境界を`ANIMATION_TABLE_HEADER_COMPACT_WIDTH = 620`へ限定し、compact playback行を三列grid、leading / Playをnowrap、さらに狭い幅だけtrailing内部を局所wrapする構成へ変更した。760 / 762 / wideと620px OUT、460px通常は36px一行。460 / 420px OUTはtrailingだけ二段で、三clusterの三行積み、横overflow、control重なりはない。Owner実画面での再確認まではPhase 9mをcloseしない。
- BrowserではOUT F9〜F18非loop停止、close / reopen保持、header / Bottom zoom、grid Frame、Lane list縦scroll、Clip 1セルmove / 復元、下辺grip 1F→2F→1F、Bottom utility 34px一行、console warning / error 0件を確認した。全117 verifier、`node --check`、production buildを通過し、`dist/` / `.vite`生成差分は清掃済み。
- 2026-08-29の水平調査では、ToonSquidのnested Clip breadcrumb、Procreate Dreamsの明示Timeline mode、Live2D / CLIP STUDIOの同一Timeline内Dope / Graph切替、RiveのSelected-only focusを照合した。Tegakiは通常Clip clickをselection / move / retimeへ残し、selected CAFの明示`FOCUS`＋Enterから同じTableをin-place `CLIP FOCUS`へ切り替え、breadcrumbと`DOPE / MOTION` subviewを出す案を第一候補とする。
- 継続watchlistは、Fresco / CSP Simple=`modern drawing・段階露出`、Callipeg Studio / ToonSquid 2.0 / Procreate Dreams 2=`pen・touch animation`、Live2D / Spine=`Rig・property密度`、After Effects / Premiere=`長時間軸・workspace・contextual property`。Ownerの定性的な支持優先度として扱い、各Gateで現行公式資料を再確認する。Adobe Animateはmaintenance modeのためframe / span文法だけの補助参照とする。
- dark top / bottomは`current warm / dark top / dark bottom / dark bothまたはFocus時だけ`、Lane濃淡は`uniform＋divider / 低差Futaba zebra / semantic group band / selected周辺attenuation`の独立比較軸とした。contrast、面積、中央配置だけを注目順位とせず、Futaba文化、task goal、mode feedback、誤進入、戻るcostを合わせて判定する。
- `build/verify-ui-attention-lens-philosophy.mjs`で理念、operational rule、調査matrix、Phase停止条件、authority routingを固定し、全118 verifierを通過した。production source / DOM / CSS / modelは変更していない。
- Owner header Gateと独立したappearance Sliceとして、Bottom utilityのSelected Clip contextから重複外枠 / shadow、Duration separator、resting child button枠を除いた。選択対応は低差Futaba面＋4px橙dot、hover面、2px focus outlineで残す。wide / 470px、hover / keyboard focus、Duration 1F→2F→1F、選択解除・再選択、Table close / reopen、console 0件、全118 verifier / buildを通過し、DOM / ID / event / ARIA / History / saveは変更していない。
- Owner画像follow-upで、Playback Rangeはdesktop 80px / coarse 116pxへ固定し、`TIMELINE / LAST CLIP / OUT MARKER`でPREVIEW位置を動かさない。OUT summaryを隠してI / Oだけを表示し、I / OキーはAnimation Table context限定。FPS / FRAMESとPREVIEWはresting borderを除き、Bottom COPY / DELETEは`UI_ICONS.duplicate / trash`の22×18px iconへ置換した。BrowserでI / O設定・解除、Canvas I非干渉、COPY実操作、SVG 12px / currentColorを確認した。外枠はdark top / bottom比較後の独立判断へ残し、今回単独では除去していない。
- CAF選択時は現行renderが同Lane直後へFolder targetとBONE行を投影し、runtime collapsed setが空ならBone groupも既定展開する。多数CAFの全体編集では焦点過多なので、header修正後の別Sliceで`全体Lane概要 → 明示Clip Focus → internal / BONE / Motion subview → breadcrumb復帰`を第一候補として比較する。単なる全group既定collapseや常設Inspector化では済ませない。
- Web GPTの文書routing案は、現行の計画索引 / PROGRESS / current Phase / Archive分離で充足と判定し、`Archive/TEGAKI_Codex_Document_Routing_Proposal.md`へ保存した。

## 4. 次チャットの最初のtask

Phase 9mのstable header / Bottom icon技術checkpointをOwner実画面で確認し、結果に応じてclose可否を決める。

1. 最初にOwner確認結果を受ける。標準幅でheader一行、Play中央、三End modeで後続位置不変、OUTはI / Oだけ、FPS / FRAMES / PREVIEW枠なし、Bottom COPY / DELETE iconが読めるかを確認する。
2. visual NGなら実Table幅、viewport、`.is-narrow`、header高さ、該当controlだけを採取して限定補正する。Clip Focus、dark top / bottom、Lane濃淡、外枠border inventoryを同じpatchへ混ぜない。
3. visual受入なら全118 verifier / build / Browser checkpointを維持したままPhase 9mをcloseし、次Phaseを選定する。
4. 次の独立Sliceは`A current auto detail / B anchored window / C in-place Table mode / D overview＋detail split`の一DOM fixture。通常single clickでの自動進入は棄却し、selected CAFの明示`FOCUS`＋Enter、breadcrumb / Back / Escape、`DOPE / MOTION`切替、Table close / reopenを比較する。Cを第一候補とするがOwner Gate前に採用しない。
5. Clip Focusの比較と境界が固まった後に、Timeline cell / major grid / focus / selected / D&D等の構造・状態枠は残し、resting decorationだけを候補にするAnimation Table border inventoryを行う。枠線削減を一括リスキンとして先行させない。
6. Lane見出しSCOPE、PREVIEW配置、Bottom zoom左右、25% / major gridはさらに別Gateとし、TimelineModel / ClipAsset / History / saveへ第二stateを作らない。

## 5. model分担

- header responsive state、wheel / gesture / model境界、`Clip Focus` adapter判断、Phase closeはSOL / XHigh。
- fixture DOM、状態matrix、Acceptance Criteriaが固定されたstatic SliceだけLUNA / MAXに適する。
- narrow判定、Clip hit、retime、History / save、CAF detail exposure、SCOPE意味の判断が必要ならLUNAは変更せずSOLへ返す。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9lまでSOL final review=Aでclose済みです。現行Phase 9mはAnimation Table Utility Split / Low-Zoom LOD Comparison Gateです。Stage B C-first、一行header、固定幅Playback Range、OUT限定I / O＋context shortcut、borderless FPS / FRAMES / PREVIEW、Bottom Lucide COPY / DELETEまで全118 verifier / build / Browserの技術checkpoint済みです。Owner実画面でstable header / Bottom iconを再確認するまではvisual未受入で、Phase 9mはOPENのままです。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9m.md、tegaki_work/UI_DESIGN_AUTHORITY_MAP.md、開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md、開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md、tegaki_work/styles/components/animation-table-utility-lod.css、tegaki_work/styles/components/animation-table-playback.css、tegaki_work/ui/animation-table-popup.jsを順に読んでください。

次を最初に確認し、既存変更をすべて維持してください。
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive

Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。restore、reset、checkoutで既存差分を巻き戻さないでください。

最初のtaskはOwner実画面でstable header / Bottom iconの結果を受けることです。標準幅で一行header、Play中央、三End modeで後続位置不変、OUTはI / Oだけ、FPS / FRAMES / PREVIEW枠なし、Bottom COPY / DELETE iconを確認してください。NGなら実Table幅と該当controlだけを限定補正し、受入ならPhase 9mをcloseして次Phaseを選定してください。

header修正のOwner受入後だけ、別SliceでCAF詳細露出の一DOM比較へ進んでください。通常Clip clickはselection / move / retimeへ残し、selected CAFの明示FOCUS＋Enterから同じAnimation Table全体をin-place CLIP FOCUSへ切り替え、LANES / CAF名 / DOPE|MOTION breadcrumbで戻るC案を第一候補にします。A current auto detail、B anchored window、D overview＋detail splitも同じstateで比較します。比較watchlistはFresco / CSP Simple、Callipeg Studio / ToonSquid 2.0 / Procreate Dreams 2、Live2D / Spine、After Effects / Premiereを役割別に使い、Gate開始時に公式資料の鮮度を確認してください。dark top / bottomとLane濃淡は独立appearance軸で、Futaba-derived surfaceだけを使い、dark量や偶奇をmode / identityの唯一の意味にしません。単なる全group既定collapse、常設Inspector、第二Timeline / selection / stock / save stateは採用しません。Lane見出しSCOPE、PREVIEW配置、25% / major gridはさらに別Gateです。

次作業予告は、Owner visual確認 → Phase 9m close判断 / 次Phase選定です。作業規模は限定fixtureならLUNA / MAX、Gate・境界・closeはSOLです。並走せず一Gateずつ進めてください。
```
