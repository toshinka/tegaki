# TEGAKI GUI先生ツール研究 15 — Bottom Dock移行前の局所Ownership Ledger／研究Bankの配置

作成日：2026-09-20  
区分：Research Bank／局所静的調査＋Owner要件統合／非実装Card  
提案保管先：`D:\GitHub\tegaki\docs\reference\gui-sensei\TEGAKI_GUI_SENSEI_RESEARCH_15_2026-09-20.md`  
前提：研究12（実画面・公式マニュアル参照）、13（Bottom Dockと右手操作）、14（Timeline倍率と共通Statusの単一所有者）。当該文書の採用候補は現行productionの正本や実装完了報告ではない。

## 0. 今回の到達と限界

研究14で宣言した「Zoom、Status、Dock footerの局所所有権確認」を**公開GitHubに置かれた固定commitの小〜中規模ファイルについて部分的に実施**した。参照commit：`ebdf0efdc5da6e292879e4fb48aa8d59b49f987b`。このcommitは直前のLuna報告でのSTART/END HEADだが、現在のローカルD:のHEAD・未commit差分を直接確認したものではない。巨大な`ui/animation-table-popup.js`内部のDOM／Zoom handler／wheel／floating drag／resizeは今回未確認。Browser実画面・実寸・イベント発火も未検証。**今回の進捗はStatusの実所有者と重なり原因の部分確定であり、Bottom Dockをそのまま実装できるという判定ではない。**

### この回で増えた事実

| 対象 | 固定commitでの局所証拠 | 設計上の意味／なお未確認の点 |
|---|---|---|
| 共通StatusのDOM生成 | `tegaki_work/ui/dom-builder.js` L663–694：`buildStatusPanel()`が`.status-panel`一組、`#canvas-info`／`#current-tool`／`#current-layer`／`#coordinates`／`#fps-info`／`#history-info`を作る。[ソース](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/ui/dom-builder.js#L663-L694) | Table専用の第二Status DOMを新設する必要は見つからない。表示項目は後から縮約できるが、まず既存IDを壊さない。 |
| 共通Statusのmount | `tegaki_work/core-engine.js` L205–206：`DOMBuilder.buildStatusPanel()`を`appElement`へappend。[ソース](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/core-engine.js#L201-L207) | Animation Tableに属さない共通面として残せる。現行の他のStatus生成経路の完全否定までは未監査。 |
| 現行Statusの位置・重なり | `tegaki_work/styles/main.css` L3221–3244：`.status-panel`は`position:fixed`、左右70px、bottomは`--ui-status-bottom`、`justify-content:center`、`z-index:1000`、`pointer-events:none`。[ソース](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/styles/main.css#L3221-L3244) | 現状は**レイアウト上の領域予約を伴わない固定重畳**。Dockの位置だけ変更してもStatusとTable footerが重なる余地がある。`z-index`変更だけではレイアウト衝突を解決しない。 |
| FPS欄の意味 | `tegaki_work/ui/status-display-renderer.js` L305–325：`requestAnimationFrame`経路で計測した`this.fps`を`#fps-info`へ表示。[ソース](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/ui/status-display-renderer.js#L305-L325) | **共通Statusの現行「FPS: 60」は描画更新計測値**で、これ自体をAnimationのproject FPS設定値として使う根拠はない。表示を通常画面で隠しても、project FPSの意味や設定を消す指示にはならない。 |
| Timeline Zoom外見のCSS | `tegaki_work/styles/components/animation-table-playback.css` L218–225に`.anim-zoom-controls`／`.anim-zoom-btn`の装飾規則。[ソース](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/styles/components/animation-table-playback.css#L218-L225) | このCSSだけではDOMの親、左右配置、ボタンclick先、wheel先、倍率値の正本は不明。`33%`がTimeline倍率であることはOwnerの明示説明による。 |
| 既存frame-indicatorと右Workspace | `ui/timeline-ui.js` L799–849でLayer Panel先頭へindicatorを挿入。`ui/right-workspace-frame.js` L63–79でTransform時にDrawing面をinertにする。[参照1](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/ui/timeline-ui.js#L799-L849)／[参照2](https://github.com/toshinka/tegaki/blob/ebdf0efdc5da6e292879e4fb48aa8d59b49f987b/tegaki_work/ui/right-workspace-frame.js#L63-L79) | 第11回Luna報告と整合。Dock transportは右Layer面のinert配下に置いたままにしない。 |

## 1. Owner要件とWebSOLの今回の設計固定

**OWNER**：`33%`はTimelineの表示倍率。既存wheel操作があるため、`− 倍率 ＋`を右下へ移しても大きな主操作にしない。右利きのため操作系は右、情報は左。Animation Tableは通常使用時Floatingを廃止し、Bottom Dockを先行、伸縮・収納、Left Vertical Presetは後段。旧RIG Workspaceは能力の移管が確認できるまで残す。

**WebSOL決定：** 共通Statusは**単一DOM・単一update owner＋画面下端の独立したレイアウトslot**で進める。別のStatus controllerをTable内に作らない。`z-index`だけの応急重ね表示も採用しない。Dockを開閉してもStatus更新の責務は切り替えず、不要な座標・計測FPSなどの項目は後続UI-only sliceで隠す。Historyや座標計測自体は削除しない。

**重要な補正：** 現行Statusは画面中央寄せfixedで、まだ「下端レイアウトslot」ではない。これを単一slotへ配置するには**親レイアウト・Canvas viewport・Table geometryを合わせた局所的変更**が要る。CSSで`bottom`や`z-index`だけ調整した状態をDock完成と扱わない。

## 2. 最初に作るBottom Dock Fixture（設計案、未実装）

```text
┌ Tool Rail ┬────────── Canvas viewport ─────────┬ Right Workspace ┐
│           │   Drawing / Transform / Bone       │  Layers or V    │
│           ├─────────────────────────────────────┤                 │
│           │  single Transport   [Table開閉]    │                 │
│           │  lane / ruler / frame grid          │                 │
│           │  選択情報 [− 33% ＋] [高さ切替]       │                 │
├───────────┴─────────────────────────────────────┴─────────────────┤
│ 共通Status（単一Owner、左寄せ。Dock footerと重ならない独立slot）    │
└───────────────────────────────────────────────────────────────────┘
```

- **Collapsed**：transportと展開入口のみ。grid/footerは収納し、Canvas viewportへ空間を返す。Zoomが必要なら明示入口を残す。wheelの作用先は既存仕様のまま。
- **Compact**：少数laneに応じた内容高さを優先。右下`− 33% ＋`と高さ制御、左下はTable固有の軽い情報。巨大空白を維持しない。
- **Expanded**：高さ上限を持つDock。transportとfooterは固定、grid/laneだけ内部scroll。右Workspaceの操作・Canvas直接操作の見える領域を失わせない。
- **Left preset**：別の表示Fixtureで設計する。現段階のBottom実装で90度回転や第二Timeline modelを追加しない。

表面は`styles/main.css`の`--futaba-*`系を基準とし、先生の配置・操作群の軽さ・アイコン密度を借りる。絵を隠すCanvas上の浮動Tableは通常時の目標にしない。

## 3. 先行する実装上のGateを狭く再設定

この回で判明した固定位置の共通Statusは、独立slot化が必要なことを示す。一方、まだ読めていない`animation-table-popup.js`のDOM／event所有権は、Dock化において本質的な阻害材料になる。**ここだけをLunaのローカルread-only局所調査へ渡す。** Statusの全面改築、Playbackやzoomのモデル変更、RIG移管、別端末UI調査へは広げない。

### 次の一件：Luna MAX用 Local Bottom Dock Ownership Gate（提案、未発行）

- **MODEL / MODE / TASK TYPE**：Codex Luna MAX / READ-ONLY / Targeted UI ownership extraction。
- **REPOSITORY / BRANCH / HEAD / WORKTREE**：`D:\GitHub\tegaki`。開始時のbranch・HEAD・`git status --short --untracked-files=all`を報告。前回の`ebdf0efd...`と今回の作業開始状態の一致は仮定しない。Frame fallbackの2ファイルが未commitなら変更せず保存。
- **唯一の責務**：`animation-table-popup.js`の現在有効なZoom controls (`− 33% ＋`)、wheel route、footer/transport DOM、floating drag/resize、Table show/hideと親要素の関係を**必要な定義と直接接続する関数だけ**抽出し、Bottom Dockの表示面を切り離すための所有者表を埋める。
- **読み取り範囲**：`animation-table-popup.js`全体を順読せず、`rg -n`で`anim-zoom`、zoom値のDOM ID・event、wheel、transport/header/footer、panel position/drag/resize、`show/hide`の候補を検索。関係する定義を各±40行以内。追加ファイルは`styles/main.css`、Table関連CSS、`ui/dom-builder.js`、`core-engine.js`、Status CSS／Rendererから、必要部だけ最大4ファイル。既知の第15回局所証拠を再調査しない。
- **結果**：DOM node/owner → listener → callable sink → model authority、zoom値更新とwheel共通sink、drag/resizeとshow/hideの表示契約、Table footer／Statusの現在の座標競合を**最大8行の表**で提示。各行`PROVEN file:line`／`UNKNOWN`を区別。
- **証拠更新**：wideと768×600のBrowser画面からTable/footer/status/Canvasの各bounding rectだけ1 pass測定してよい。Browser不可ならUNKNOWN、無制限再試行しない。
- **予算／終了**：MAX SOURCE FILES 6、MAX ADDITIONAL HELPER DEFINITIONS 3、BROWSER PASSES 1、TOOL CALLS 16。実装・文書変更・commit・push・tests・full suite・subagentsは禁止。追加発見は報告のみ。次のactionは最大一件。Commanderへ返してSTOP。

このGateの結果が出てから、Astra LOWに「現行DOMを保持するDock shellと共通Status slotの境界」だけを狭く裁定するか、WebSOLで直接Luna向けGUI実装Cardを作る。すべてをAstraに再設計させない。

## 4. 研究ファイルの保存先を正す

第15回以降と既存の研究01–14を**`docs/reference/gui-sensei/`**へまとめる。理由は研究量が増え、実装・STATUSの正本と誤読しやすいため。番号付き名称は変更しない。研究12/13のMarkdownに対する相対画像参照を維持するため、`TEGAKI_GUI_CURRENT_*.png`のうち参照される3枚も同じフォルダに入れる。配布ZIPは研究ファイルの重複アーカイブなのでGit管理対象へ入れなくてよい。`docs/reference/interaction/`にある別研究は移動対象にしない。

一度に同じ場所へ全ファイルを移せばMarkdownの`./...png`リンクは維持できる。一方、古い文書内の`docs/TEGAKI_...`という保管先の文言や他文書からのリンクは**自動更新されない**。今はHistorical locationとして読み、後でLunaに`README.md`と参照先・URLを**文書整理だけの別Card**で点検させる。この研究文書が実装契約へ昇格することはない。

## 5. 先生の実画面・説明書の継続参照

- ToonSquid公式 Timeline — `Expand and Collapse`／`Custom Timeline Height`／`Playback Toolbar` の掲載図：https://toonsquid.com/handbook/interface/timeline/
- Callipeg公式 Timeline — 下部Timeline／表示切替：https://callipeg.com/learn-timeline/
- Callipeg公式 Bottom Bar — 情報と右側操作を別グループで観察：https://callipeg.com/learn-interface-bottom-bar/
- Krita公式 Animation Timeline Docker — Desktop Dockの参考：https://docs.krita.org/en/reference_manual/dockers/animation_timeline.html
- LYRICA公式製品メディア — 画面密度の補助参考。最新版の各ボタン位置・折畳み挙動はまだUNKNOWN：https://apps.apple.com/jp/app/lyrica/id6800900577?mt=12

画像・説明書の詳細な「どの図を見るか」は研究12–14を参照。本書では先生製品の新しい実測値を主張しない。

## 6. 現時点での停止条件

Bottom Dockの表示・配置は進める。**現行`animation-table-popup.js`のイベント・位置管理を知らないままCSSで浮動を覆い隠して完成扱いすることはしない。** 既存Frame navigation修正の取り込み状態を先に一回確かめ、他の未commit差分に同居させない。共通Statusは第二所有者に分けない。Left Vertical、WARP widget、RIG、Textは今回の実装範囲へ混ぜない。
