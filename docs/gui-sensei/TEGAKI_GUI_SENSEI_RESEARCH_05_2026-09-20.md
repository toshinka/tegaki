# TEGAKI GUI先生ツール研究 05 — 172px WARP操作面・比較案と採否ゲート

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
保存予定先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_05_2026-09-20.md`  
前提：研究01〜04、およびOwner提示の右側Transform/WARP BRUSH画面。TEGAKI最新production差分のコード監査・Browser実操作は今回行っていない。

## 0. この回の結論ではなく、今回確かめる問い

現行の右Workspaceを増幅・移設するのではなく、**172pxの既存幅で、Canvas主導のWARP操作を、編集状態を失わせずに読み取れるようにできるか**を比較する。比較するのは「現行の縦積み」「同一面内のコンパクト化」「選択中操作をメニュー化」「Canvas近接の補助操作」の情報配置。サイズや見栄えだけで採否を決めない。

今回の提案は仮説であり、次のものを新仕様と認定しない：WARP演算、16点mesh、SOURCE/ANIMATE transaction、KEY bundle、History、既存`V`/`Escape`のterminal意味、`B+drag`、画面breakpoint、Parameter Control共通実装。

## 1. 先生ツールの実証部分（2026-09-20確認）

| 先生・一次資料 | 実際に確認できる操作構造 | TEGAKIへの**推論**と非同一性 |
|---|---|---|
| Procreate [S1][S2] | TransformではCanvas上のbounding box / mesh / handleを操作。Warp meshはTransform内の一方式。Liquifyはbrush型の別操作で、modeを選んでからSizeなどを調整。Liquifyのmode一覧は選択中modeのボタンから開く。 | POINT＝Canvas grid、BRUSH＝Canvas strokeという操作区分の見せ方を比較できる。ただしProcreate WarpとLiquifyは別機能で、TEGAKIの同一WARP sessionと同一視しない。 |
| Adobe Fresco [S3] | LiquifyはTransform入口から選び、効果の種類とBrush Size/Density/Pressure/RateをTool Optionsで調整。 | 「操作種類」と「数値設定」は階層を分けられる。FrescoのDensity等をTEGAKIのHardness等と同じ演算と扱わない。 |
| CLIP STUDIO PAINT Simple Mode [S4][S5] | tool iconのdouble-tapで詳細設定を開き、size/opacityは専用slider、Layer機能には別の表示入口がある。 | 頻繁に触る値と詳細を別の表示密度にできる。設定を隠したことが新規利用者に伝わるか、別途検証が必要。 |
| ToonSquid [S6] | Timelineを畳んでもPlayback Toolbarは残る。 | Animation Tableと最小時間操作を分ける将来課題の根拠。ただし今回のWARP右面改修には混ぜない。 |

**今回の公式資料からは確定できないこと：** 各アプリ最新版での正確なボタンCSS px、実際の親指/ペンの移動距離、TEGAKIのWARP BRUSH追従性能、Procreateの操作をTEGAKIのKEY semanticsへ直接転用できるか。

## 2. 現行TEGAKIのOwner観測と、比較で固定する前提

Owner提示画像で視認できる右面：対象名、`BASIC | WARP`、大きな`WARP ツール`見出し、`POINT | BRUSH`、`MOVE / INFLATE / PINCH`の3段、半径・強さ・硬さ、縦スクロール、下部の確定/取消。CanvasにはmeshとBRUSH円形cursorが同時表示されている。

- **観測**：右側へのモード置換でFloatingは不要になり、Canvasの広い面積が戻った。一方、WARP内の階層、独立Slider、広い余白、強い枠/影、縦スクロールが目立つ。
- **推論**：現在の幅を保ったまま、見出し重複と3段の操作ボタンを整理できる余地がある。ただし実Browserでのscroll量・computed size・coarse hit areaは未測定。
- **注意**：Ownerが指摘した「隙あらば白黒化しようとする縦スライダー」は、画面右端の**縦スクロールバーと値変更用の横Sliderを区別して記録**する。scrollbarの暗色・太さを単に値Sliderの不一致と混同しない。

固定条件：共通の対象画像、同じCanvas倍率、同じ右面幅（当面172pxを比較予算）、同じWARP grid、同じSOURCE/ANIMATE状態、同じボタン/文字の視認性下限、同じ確定/取消動作。CanvasのoverlayやKEY semanticsは比較案ごとに変えない。

## 3. WARPの操作階層を分解する

```
作業入口：V / TRANSFORM
  ├─ BASIC
  └─ WARP
       ├─ POINT：Canvas上のgrid nodeを動かす
       └─ BRUSH：Canvas上をなぞる
             ├─ brush operation：MOVE / INFLATE / PINCH
             └─ parameter：半径 / 強さ / 硬さ

独立軸：SOURCE or ANIMATE、未確定状態、KEY確定 / 終了 / 取消
```

**階層を分ける理由：** 操作対象（点か筆か）、ブラシの変形方式、ブラシの数値、編集terminalは別の問いへの答えだから。見た目を整理しても、SOURCEの確定/取消とANIMATEのKEYを共通の曖昧な「完了」に統合しない。POINT時にはbrush type/parameterを広く表示する必要がない可能性があるが、POINT固有の操作があれば消さない。

## 4. 比較案 A/B/C — 同じ能力、違う見せ方

以下は**操作面の比較仮説**。各案の出発点は現行の172px幅であり、最小限のpaddingを考慮する必要がある。ASCIIはwireframeで実寸再現ではない。

### A. Compact in-place：3方式を直接見せる（発見性優先）

```
[対象 レイヤー1]         [終了/取消の既存入口]
[BASIC | WARP]
[POINT | BRUSH]
[MOVE | INFLATE | PINCH]  ※ 3分割に収まらなければ2行も比較
半径      [47 px]         [----●---]
強さ      [0.45]          [----●---]
[詳細: 硬さ  ▾]
------------------------
[未確定 / Frame]  [明示KEYまたは既存terminal]
```

- 利点候補：MOVE/INFLATE/PINCHを一目で発見・一手で変更できる。
- 弱点候補：172pxの3分割では英語名、とくにINFLATEの可読性・tap面積が厳しい。省略アイコン化するなら短い説明/tooltipが必要。2行にすると節約した高さを消費する。
- 適する条件：同じstroke中にbrush operationを頻繁に変える場合。

### B. Selected operation menu：現在方式のみ常時表示（縦密度優先）

```
[対象名]                [必要なterminal]
[BASIC | WARP]
[POINT | BRUSH]
[変形方式: MOVE ▾]
半径       47px         [----●---]
強さ       0.45         [----●---]
[詳細 ▾: 硬さ]
------------------------
[未確定 / Frame]  [KEYまたは既存terminal]
```

- 利点候補：3段ボタンを1行へ集約。Procreate Liquifyのmode選択入口に類似する**表示文法** [S2]。
- 弱点候補：INFLATE/PINCHへ進むのにメニューを開く追加操作が必要。現在方式が分かりやすい文言で露出しない場合、初心者が機能を発見できない。
- 適する条件：MOVE主体で方式変更が低頻度の場合。**この頻度は現時点で未測定**。

### C. Canvas-first contextual control：右面は現在方式＋数値、Canvas近傍に短命の切替（入力距離優先）

```
Right Workspace             Canvas
[対象]                      [WARP grid / brush cursor]
[BASIC | WARP]              [使用中だけの短命パレット？]
[POINT | BRUSH]              MOVE / INFLATE / PINCH
[現在の方式: MOVE]          （右面にも同等の到達口は残す）
[半径 / 強さ / 詳細]
[明示terminal]
```

- 利点候補：Canvasで連続操作するpen利用者の移動量を減らせる余地。
- 弱点候補：Canvas遮蔽・pointer capture・stroke中の誤起動を増やす。OwnerはTransformをCanvas近接UIにする必要は低いと説明している。**最初の実装候補にはしない**。将来のmode-local radius gestureとは別件。
- 適する条件：右面との往復が明確な負荷だと実操作で確認できたときのみ。

### D. 現行縦積み（比較baseline）

変更しない現行画面を必ず基準として残す。A/B/Cを見栄えだけで比較し、現行に比べて何が減ったかを測定しない事態を避ける。

## 5. 幅172pxより先に「縦の予算」を検討する

実画面が600 CSS px高で、右panel外枠、tab、スクロールバー、下部actionが存在する場合、操作詳細に使える高さは600px全体ではない。下記の数値は**検討用の仮置きでありcomputed styleでも実測値でもない**。

| 部分 | 仮の高さ予算 | 原則 |
|---|---:|---|
| 対象名＋戻る/終了入口 | 36–44px | 装飾的なCONTEXT INSPECTOR見出しを重ねない |
| BASIC/WARP | 32–40px | 選択時の立体的な二重枠を増やさない |
| POINT/BRUSH | 32–40px | 選択中の操作が読める |
| BRUSH方式 | 32–44px | Aは3分割の可読性、Bはmenuを開く一手を評価 |
| 半径/強さ（各） | 42–56px | 値・単位・Sliderのhit areaを維持 |
| 詳細入口 | 28–36px | 硬さを畳んでも存在が分かる |
| terminal footer | 80–104px | 既存SOURCE/ANIMATEごとの明示動作を維持 |

**配置上の注意：** Footerを`position: sticky`にするだけでは、どの祖先がscroll ownerかによって位置が変わる。理想的には「header / scroll body / terminal footer」を別のlayout領域として考えるが、現行DOMとWARP transactionへ影響するなら、今回は仕様化せず境界として報告する。硬さを詳細へ畳む場合も、値が作業上頻繁に使われるならデフォルト露出案と比較する。

## 6. 小型化してよいもの／してはいけないもの

**先に減らす候補**：二重対象名、大きな`WARP ツール`見出し、選択済み情報の繰り返し、方式の3段表示、枠線・影の多重化、不要な上下padding。

**先に減らしてはいけないもの**：操作対象の識別、数値の単位、keyboard focus、現在方式、pending／KEY／取消、失敗時の状態、誤操作防止用のhit area。

画面上の見た目を小さくすることと、pointerの当たり判定を狭くすることは別。Appleのbutton設計では原則44×44ptのhit regionを案内し、WCAG 2.2のpointer target minimumは原則24×24 CSS px（例外規定あり）[S7][S8]。**ptとCSS pxを同一の実寸と扱わず**、TEGAKIのmouse/pen/coarseの試験条件に合わせて採用する。172pxの幅に押し込むために極端なhit area縮小を正当化しない。

## 7. Parameter Control：GUIから仕様化してはならない部分

現在のWARP Native rangeを別のCustom Sliderに換えただけでは、車輪の再発明問題は解決しない。既存Quick Access、Opacity、SliderUtilsとの比較が必要。

候補契約（**未決定**）：

- label / live value / unit / editable precision値の見せ方を共通にする。
- mouse wheelはpanel scroll中の誤値変更を避ける条件を先に決める。wheel常時有効化を既定にしない。
- keyboard focus、矢印での変更、数値validation、min/max/step、pointercancel/lostとHistoryの境界をsource ownerごとに確認する。
- Brush RadiusをCanvas上の`B + drag`等で変える案は、この研究では**mode-local候補**としてのみ保持し、既存Bショートカット・描画抑止・pointer terminal未監査のまま採用しない。
- SOURCE raster costとANIMATE preview latencyは別経路。GUIコンパクト化がBrush追従改善を約束するわけではない。

最初のGUI実験ではSliderの**視覚配置だけ**を固定値で模擬し、現在の値・History更新などproduction authorityを模擬実装しない。共通部品の選抜はその後のCapability Selectionへ渡す。

## 8. Canvas overlay：POINT/BRUSHの区別を支える最小限のfeedback

- POINT：現在のnode・drag対象・meshを明示。16点grid表示をProcreateのmeshと同一の演算仕様だとみなさない。[S1]
- BRUSH：stroke中の作用範囲・現在方式・brush sizeが読み取れる。grid同時表示の採否は変形確認とCanvas視認性を比較してから決める。
- meshとbrush cursorが同時に見えること自体をバグ認定しない。情報量と現在方式の分かりやすさを分けて評価する。
- 右面に長い説明文を常設するより、短いmode labelとCanvas feedbackで現在の操作が分かるかを確認する。

## 9. 比較実験の評価表（数字は測り方であって結果ではない）

| 比較軸 | 確認の仕方 | 不合格を疑う条件 |
|---|---|---|
| 方式の発見性 | WARP BRUSHからINFLATE/PINCHを探す | 入口が見えず機能自体を見落とす |
| 方式変更の操作数 | MOVE→PINCH→MOVEを3回 | 毎strokeで長いmenu往復が必要 |
| KEY/終了/取消 | SOURCEとANIMATEの別状態で操作入口を指す | FOOTERの語が曖昧／scrollで消える |
| 可視域 | 172pxで600px高・900px高を比較 | 操作不能な横scroll、Canvas側への勝手な張り出し |
| Scrollbar | mouse/pen/coarseでスクロール | 値Sliderと混同する／残り項目が見つからない |
| 精密値 | 半径を例に値を読む・編集入口を見つける | 単位欠落／valueが見えない |
| Focus | keyboard Tabで通過する | 焦点不明／非表示controlへfocusが残る |
| Canvas feedback | POINTとBRUSHを切替える | cursorだけでは現在方式が分からない |
| Pending guard | 編集中に対象変更を試みる | 無言のcommit/rollback（実transaction検証は別Gate） |

比較対象：**D（現行）／A／B**を第一候補、Cは実操作上の不足が出た場合に再検討。これはFixtureの設計優先順であり、production UIの採用決定ではない。

## 10. GUI視覚文法としての暫定整理（憲法ではない）

- `--futaba-*`中心、MAROONの主色とcreamのsurface。新しい差し色は`main.css`へ役割とともに登録してから使用する。
- Panelの存在感を増す大きい見出しや立体的shadowを通常の操作入口に反復しない。状態の違いは控えめな面・文字・局所的境界で伝え、主actionだけ必要に応じて優先する。
- 重なりがない通常の右面に、見栄えのためだけにGlass / blurを使わない。Canvasへ重なる補助面でのtranslucencyは可読性・hit blockingと一緒に判断する。
- 「同じStyle」であることと「同じBehavior」であることは別。SliderやTabを見た目だけ揃えて、入力・cancel契約の共通化が完了したと報告しない。

## 11. 次の調査・設計入力

第6回（予定）は**アニメーション系への再接続**：LYRICA / ToonSquid / Callipeg / Procreate Dreamsを再び比較し、Animation Tableを展開／収納した際のPlayback残留、Frame／Clip／Keyの入口、右のText／Transform／RIGとの役割分担を整理する。WARPの暫定案A/B/Dは独立して保持し、LunaのEdit Boundary Gateの結果とOwnerの操作評価が得られるまでproduction WARP改修へ進めない。

また、GUI憲法への昇格は第1〜6回の重複除去後にWebSOL／Ownerが判断し、Astra LOWへは限定された選抜項目だけを渡す。Research Bankの全採用や全面GUIリファクタリングを含意しない。

## 12. 根拠索引／confidence

[S1] Procreate, Transform Interface / Warp：Canvas handles, mesh, numeric input（公式）  
https://help.procreate.com/procreate/handbook/transform/transform-interface-gestures  
https://help.procreate.com/procreate/handbook/transform/transform-warp

[S2] Procreate, Liquify：別brush操作、mode選択、Size等（公式）  
https://help.procreate.com/procreate/handbook/adjustments/adjustments-liquify

[S3] Adobe Fresco, Liquify：Tool Optionsと作用方式（公式、2023年更新資料。2026年UI実寸は未検証）  
https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/liquify-tool.html

[S4] CLIP STUDIO PAINT, Tablet Interface：Simple Modeのtool/settingsとslider（公式）  
https://help.clip-studio.com/en-us/manual_en/090_tablet/Tablet_interface.htm

[S5] CLIP STUDIO PAINT, Using Simple Mode（公式）  
https://help.clip-studio.com/en-us/manual_en/090_tablet/Using_Simple_Mode.htm

[S6] ToonSquid, Timeline：Playback ToolbarとTimeline collapse（公式）  
https://toonsquid.com/handbook/interface/timeline/

[S7] Apple HIG, Buttons：原則44×44pt hit region（公式）  
https://developer.apple.com/design/human-interface-guidelines/buttons

[S8] WCAG 2.2, 2.5.8 Target Size (Minimum)：原則24×24 CSS px、例外あり（公式）  
https://www.w3.org/TR/WCAG22/#target-size-minimum

**HIGH（公式資料で確認）**：ProcreateのWarpとLiquifyの分離、Liquify mode入口、FrescoのLiquify Option、CSP Simple Modeのツール設定入口、ToonSquidの残存Playback。  
**MEDIUM（TEGAKIへの設計仮説）**：A/B案の省スペース効果、Hardnessを畳める頻度、172pxでの最適配置、Canvas feedbackの最小構成。  
**UNKNOWN**：各案の実際のクリック数／scan time／focus／coarse操作感、TEGAKIの実CSS pxと縦scroll owner、KEY History・pointer境界、WARP ANIMATE latency。
