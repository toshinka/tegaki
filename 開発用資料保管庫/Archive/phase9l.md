# Phase 9l — Right Layer / CAF Focus Responsibility Comparison Gate

作成日: 2026-08-27

close日: 2026-08-28

状態: CLOSED — Gate 0=`GO — D` / SOL final review=`A`

## 1. 目的

Phase 9jで固定したLayer Panelのstyle authorityと、Phase 9kで確定したCanvas-firstの外周文化を維持しながら、右Layer Panelに表示するCAF identity・現在context・内部Layer mirrorの情報量と操作責務を整理する。

通常LayerとCAFを同じcard密度へ押し込まず、Canvasを見たまま現在の描画targetを判断できること、Animation Tableを閉じてもCAF編集contextを失わないこと、CAF順序・階層・copy / cut / pasteの正本を重複させないことを固定fixtureで比較する。

本Phaseはproduction DOM削除Phaseではない。最初に同じstate / data adapterを投影するstatic comparisonを作り、Owner Gate 0後だけ限定Sliceを定める。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/Archive/phase9k.md`
7. `開発用資料保管庫/Archive/phase9j.md`
8. `tegaki_work/UI_DESIGN_AUTHORITY_MAP.md`
9. `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
10. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
11. `tegaki_work/ui/layer-panel-renderer.js`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/styles/components/layer-panel-surface.css`
14. `tegaki_work/build/phase9j-layer-panel-theme-surface-fixture.html`

## 3. Stage A inventory

- 通常Layerの正本は`LayerSystem`、CAFの正本は`TimelineModel / ClipAsset / DrawingSnapshot`。Layer Panelは「1 UI engine / 2 data adapter」で通常LayerとCAF internal Layerを投影する。
- `layer-panel-renderer.js`はCAF identity header、Clip visibility、CAF / Lane名、展開状態、internal Layer / Folder mirrorを描画する。CAF header操作とmirror選択は`animation-table-popup.js`の既存external adapter、`selectedCelId / selectedAssetId / selectedInternalLayerId`へ接続される。
- Animation TableはCAF選択、Lane / Clip / ClipAsset、CAF順序・階層、copy / paste / delete、working Layer同期の正本を持つ。右Panelへ第二のmutation正本を作らない。
- Animation Tableを閉じてもCAF編集contextは継続するため、右PanelからCAF identityと現在internal targetを同時に消す案は不適合。Table visibilityをdata authority切替に使わない。
- 現行表示はCAF identity headerとinternal mirrorを縦に積むため、CAF数・内部Layer数が増えるとPanel面積とactive輪郭が競争する。一方、単純な一枚RasterやTable閉鎖中には直接性がある。
- Phase 9kのdark railはoperation railだけに限定する。Layer / CAF card本体のdark化、全面theme変更、同時対比を利用した自動色切替は本Phaseへ混ぜない。

## 4. Gate 0比較案

- A Current stack: 現行CAF identity header＋全internal mirror。情報欠落のないbaseline。
- B Compact identity + focused mirror: CAF identityを一行stripへ圧縮し、現在選択中internal Layer / Folderを主card、同階層の残りを静かなlistとして投影する。Table閉鎖中の直接編集を維持する。
- C Context handoff: 右Panelには選択CAF identity、Lane / Frame context、現在internal target、visibilityだけを残し、CAF順序・階層・複数CAF管理はAnimation Tableへ明示的に寄せる。Tableを開く入口と復帰先を必須にする。
- D Flat CAF context + unified layer list: CAFを右Panel内のFolder cardとして積まず、Frame / horizontal onion行、選択CAF / vertical onion行、そのCAFのinternal Layer / Folderだけを通常時と同じlist文化へ投影する。選択targetは橙surface一つで示し、CAF順序・階層・複数CAF選択・internal Layer D&DはAnimation Tableへ寄せる。
- Dは表示projectionの比較であり、CAFを通常Layerのdata modelへ統合しない。CAF card全面dark化、右PanelからCAF contextを全撤去する案は比較しない。

## 5. Stage A最初の限定Slice

1. Phase 9j fixtureを再利用し、同じCAF / internal Layer / Folder / active stateをA〜Dへ投影する一DOM static fixtureを作る。
2. Table open / closed、CAF 1件 / 複数件、internal Layer 1件 / 多層、wide / narrowを切り替える。
3. CAF identity、Lane / Frame、current internal target、visibility、Folder depth、RIG chipの読取位置を固定する。
4. fixed verifierでproduction source非変更、第二adapter / model state / save flag未追加を固定する。
5. SOLが情報欠落、誤ったactive二重表示、Table閉鎖中の行き止まり、narrow高さを判定し、Owner Gate 0へ出す。

## 6. Acceptance Criteria

- Canvasを見たまま、選択CAFと現在描画中のinternal Layer / Folderを一義に読める。
- Table open / closedの両方で、同じ`selectedCelId / selectedAssetId / selectedInternalLayerId`を投影し、visibilityとselectionの正本を増やさない。
- 通常Layer Panelの選択、Folder開閉、D&D、opacity、clipping、RIG入口を変更しない。
- CAF順序・階層・copy / cut / pasteを右Panelへ重複実装しない。移管候補はfixtureで責務だけ比較し、mutationはGate後の別Acceptance Criteriaまで行わない。
- 既存Futaba palette、Phase 9j surface token、Phase 9k rail tokenを使い、pure black / white / neutral grayを追加しない。
- Stage Aはproduction DOM / event / ARIA / hit area / LayerSystem / TimelineModel / ClipAsset / History / saveを変更しない。

## 7. No-go

- `LayerSystem`とCAF data modelの統合、新しいWorkspace / Focus保存flag、第二Layer Panel renderer。
- `selectedInternalLayerId`、working Layer adapter、History、Project schemaの変更。
- CAF order / hierarchy / copy / cut / pasteのproduction移管、通常Layer / Folder D&Dの同時改修。
- Layer / CAF card本体のdark化、Panel全面反転、theme picker、自動art sampling。
- Animation Table Bottom split、QTP、RIG / Mesh / WARP、Text、exportの同時変更。
- `animation-table-popup.js`の一括分割、主要DOMの100行超置換。

## 8. model分担

- Stage A inventory、adapter / authority境界、Gate 0、production責務判断、close: SOL / XHigh。
- fixture DOM、対象selector、状態matrix、Acceptance Criteriaが固定された一つのstatic SliceだけLUNA / MAXへ委譲可。
- production DOM、CAF mutation ownership、History / save / selection判断が必要になった場合はLUNAで広げずSOLへ返す。

## 9. Stage A開始記録

- SOLが`layer-panel-renderer.js`と`animation-table-popup.js`を再監査し、CAF header / internal mirrorは表示adapter、CAF / internal selection・順序・ClipAsset操作はAnimation Table側の既存正本であることを確認した。
- Phase 9k close時点ではproduction codeを変更せず、本Phaseをstatic comparisonから開始する。最初の成果物はA〜Cの責務比較fixtureとfixed verifierとする。
- 同時対比はvisual評価の注意点として使うが、CAF stateやactive識別を色の錯視だけに依存させない。

## 10. Stage A fixture結果

- `tegaki_work/build/phase9l-right-layer-caf-focus-fixture.html`へ一つの`.comparison-shell`を作り、A Current / B Compact / C Handoff / D Flat CAF、Table open / closed、internal few / many、CAF 1 / multi、wide / narrowを同じ表示stateから切り替える。
- `verify-right-layer-caf-focus-fixture.mjs`で一DOM、A〜D、adapter authority、production source非変更、storage / model / save state非追加を固定した。
- BrowserでC Handoff＋CAF 1＋few＋narrowを確認し、`data-caf-count=one`、幅430px＝`scrollWidth` 430px、Table閉鎖中のCAF identity / current target / `TABLEを開く`入口を確認した。
- BrowserでB Compact＋Table open＋many＋multi＋narrowを確認し、CAF identity、現在描画target、同階層peer、Table管理contextが同じ430px幅へ収まることを確認した。
- 初回fixtureの`dataset["caf-count"]`はDOMStringMapのnamed property制約により例外になったため、`setAttribute("data-caf-count", ...)`へ限定修正した。修正後に同じ状態matrixを再操作し、例外の再発はない。
- Ownerの`開発用資料保管庫/画像資料/レイヤーカードパネル周りの案20260827.png`をDへ抽象化した。横方向のFrame onionと縦方向のCAF / Layer onionを別行へ置き、CAFをFolder cardとして囲わず、internal Layer listのactiveを橙surface一つに絞る。
- BrowserでD＋Table closed＋many＋multi＋430px narrowを確認し、幅430px＝`scrollWidth` 430px、Frame / onion行、CAF context行、橙の単一active row、全peer、Table管理handoffを確認した。D＋few＋CAF 1ではsecondary CAFだけが消え、D&D handoffと現在targetが残る。Bへ再切替して既存candidateも維持した。
- SOL再予備判定はDを第一比較候補、BをD&D / peer直接性を残すfallback、Aを情報欠落のないbaseline、CをHOLDとする。Dは右Panelの視覚一元化に最も合う一方、CAF内部Layerの順序・階層D&DがAnimation Table依存になるため、Table閉鎖時の到達性とCAF切替をOwner Gate 0で必ず比較する。production変更はOwner Gate 0まで行わない。
- 同じ数値の橙やgrayがsurroundにより沈む／浮く同時対比は、実surface上の比較を促す補助知見として維持する。active / warning / destructive stateは錯視だけに依存せず、surface・outline・icon・labelの組合せと数値contrastで固定する。

## 11. Gate 0 / Stage B production限定Slice

- Gate 0=`GO — D: Flat CAF context + unified layer list`。OwnerのDポンチ絵確認後の継続指示を、右PanelへDを限定接続する承認として扱う。Bはfallback、Aは比較baseline、CはHOLDのまま維持する。
- `layer-panel-renderer.js`は`selectedCelId`、次に`selectedAssetId`、最後に現在Frame先頭の順で表示対象CAFを解決し、右Panelへ選択中CAF一件とその`ClipAsset.internalLayers`だけを投影する。新しいfocus flagや保存stateは作らない。
- CAF identityはFolder toggle / 外枠cardから、Animation icon・CAF名・Lane名・visibilityだけの薄いcontext行へ変更する。CAF配下のClipAsset列挙は右Panelから外し、複数CAF選択・CAF順序・階層はAnimation Tableを正本とする。
- current internal Layer / Folderは既存`selectedInternalLayerId`を使い、橙surface一つで示す。peer、visibility、clipping、RIG chip、Folder開閉、rename、working Layer同期は既存adapterを維持する。
- CAF internal LayerのPointer D&D登録だけを右Panelから外す。`AnimationTablePopup.moveInternalLayerToPosition()`とTable側操作は維持し、通常Layer / FolderのPointer D&Dは変更しない。
- 選択中internal Layerが配下にあるFolderを閉じる時だけ、既存selection adapterでFolder自身へfocusを移してから閉じる。選択targetがPanelから消えて橙surfaceが0件になる状態を防ぎ、新規state / Historyは追加しない。
- appearanceは`styles/components/layer-panel-surface.css`、寸法とtouch behaviorは`styles/main.css`へ分離し、既存Futaba / semantic tokenだけを使う。
- `verify-right-layer-caf-focus-production.mjs`でfocused projection、単一橙surface、右Panel D&D handoff、通常Layer D&D維持、model authority非変更を固定する。

## 12. Stage B検証 / close

- 変更JSとproduction verifierの`node --check`を通過し、`tegaki_work`起点の全113 verifier、Vite 8.0.16 production buildを通過した。build後の`dist` hash差分だけを追跡済み基準へ限定清掃した。
- BrowserでAnimation Tableを開き、CAF内部Folderと子Layer追加、Layer選択、visibility、clipping、Folder collapse、複数CAF copy / Lane追加 / paste、CAF切替、Table close / reopenを実操作した。
- 右Panelは常に選択CAF一件、CAF asset card 0件、internal Layer / Folder list、橙current target一件を投影した。選択中の子Layerを含むFolderを閉じる時はFolderへfocusが移り、橙targetが0件にならない。
- 複数CAFではAnimation Table側の選択に追従してCAF名 / Lane名だけが切り替わり、右PanelへCAF order / hierarchy / copy / pasteの第二正本を作っていない。通常Layer D&DとTable内internal Layer移動authorityは維持した。
- Browser console warning / errorは0件。CSS詳細度でselected Folder surfaceが上書きされる不整合を実画面で検出し、selected ruleをFolder rule後へ置く限定補正まで再確認した。
- SOL final review=`A`。D Flat CAF context＋unified layer listをproduction受入とし、Phase 9lをcloseする。長い内部Layer list、制作Project、mouse / pen / touch、複数CAF間の反復切替はOwner確認台帳へ分離し、問題時はPhase 9lを暗黙に再OPENせず限定bug fix Gateを立てる。
