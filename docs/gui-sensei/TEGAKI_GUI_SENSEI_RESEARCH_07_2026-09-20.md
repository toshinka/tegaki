# TEGAKI GUI先生ツール研究 07 — Time Strip / Animation Table の情報設計比較

作成日：2026-09-20  
区分：Research Bank／非正本／非実装Card  
ユーザー保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_07_2026-09-20.md`  
前提：研究01〜06、とくに06「Animation Table・再生操作・Text/Context の配置」。対象となるTEGAKIの最新production差分を、この回では実コード・実Browserで検証していない。

## 0. この回の問い

Animation Tableの開閉がCanvasの視認性に影響する一方、再生や現在Frameの確認まで失わせる必要はあるか。右Single WorkspaceでTransform・RIG・Textを扱いながら、時間文脈をどこへ置くべきか。**位置の選択・制作手順・編集guard**を三つのワイヤー案で比較し、まだ採用を決めない。

本書のうち「公式」は外部資料で確認できた挙動、「仮説」はTEGAKIへ読み替えた考え、「UNKNOWN」は現物確認を要する事項を示す。

## 1. 第6回から引き継ぐ外部根拠を再点検

| 先生／根拠 | 公式資料で確認できる挙動 | TEGAKIへ持ち込む際の限界 |
|---|---|---|
| ToonSquid [T1] | Timelineは下部で開閉可能。Playback ToolbarはTimelineを畳んでも表示される。ToolbarをドラッグしてTimelineの高さを変更でき、Layerが増えた際は無制限に高さを増やさず内部スクロールへ移行する。 | ToonSquidの自動KeyframingをTEGAKIの明示KEY確定へ移植しない。Toolbarの機能数もそのままコピーしない。 |
| Callipeg [C1] | Timelineは下部で伸縮・非表示にできる。Sheet選択時には対象に応じたAction PanelをTimeline上に表示し、sheet長を見ながらdrag・数値で調整する。 | 対象依存Action Panelをもう一つの時間正本にしない。iPad gestureをmouse/pen/keyboardへ無条件転用しない。 |
| Callipeg mini [C2] | mini UIのTimeline位置は縦／横方向で変わり、非表示時にはflip barへ切り替わる。 | TEGAKIのresponsive配置をそのまま採用する根拠ではない。 |
| LYRICA [L1] | 2026-09-17公開のWindows版Steam公式ページで、BPM Timeline、beat snap、real-time preview、複数track、歌詞・clipの配置を確認。 | **最新の実画面での再生ボタン・右Editor・折り畳み遷移の詳細は未確認。** 「LYRICAではこの位置」と断定しない。 |

出典：[T1] https://toonsquid.com/handbook/interface/timeline/  
[C1] https://callipeg.com/learn-timeline/  
[C2] https://callipeg.com/learn-mini-interface-timeline/  
[L1] https://store.steampowered.com/app/5106770/Lyrica/

### LYRICAの実画面取得状況

公式サイト・Windows版紹介記事の本文取得を試みたが、今回の閲覧では取得できなかった。Steam公式の機能説明は取得できたが、**動画から時間操作部の固定位置・動作を連続して確認できる材料は得られていない**。従って、以下のワイヤー案はLYRICAの実画面の再現図ではない。利用者から実アプリ画面や操作動画の該当時刻が共有されたら、独立した「視覚証拠」として追加確認する。

## 2. TEGAKI側で固定する責務（案の比較条件）

```text
中央Canvas         = 結果表示／空間直接操作
右Single Workspace = Drawing／Transform／RIG／将来Textの現在能力
下Animation Table  = lane・clip・keyなど時間構造の編集
最小Time UI        = Tableの開閉と最低限の時間ナビゲーションの候補
```

Animation Tableを開いたことを、DrawingからTransformへのモード遷移と同義にしない。Tableを閉じることも、CAF対象・pending candidate・Transform sessionの継続を独自に決める契機にしない。ただし、現行productionのTable開閉terminalが何を行うかは**未監査**なので、「実装で必ず継続する」という仕様確定ではない。

Time UIは既存Frame／Timeline／KEY authorityへ接続する表示・操作入口であり、独立したplayhead・time model・History stackを作らない。

## 3. 同一サンプル状態で比較する3案

略号：`F12`＝例示の現在Frame、`▶`＝再生、`▴`＝Tableを開く、`▾`＝畳む。ASCII図は**配置比較の概念図**であり、既存TEGAKIの実装画面でもLYRICAの再現画面でもない。

### A — 常設ミニTime Strip＋下部Table

**Table収納中**

```text
┌────────────────────────────Canvas────────────────┐  Right
│                  drawing / transform              │  Workspace
│                                                    │  [context]
└────────────────────────────────────────────────────┘
[ ◀ F12 ▶ ][ ▶/❚❚ ][ loop? ][ ▴ Table ]  ← 細い独立Time Strip
```

**Table展開中**

```text
┌────────────────Canvas────────────────┐   Right
└──────────────────────────────────────┘   Workspace
[ ◀ F12 ▶ ][ ▶/❚❚ ][ loop? ][ ▾ Table ]
┌────────────────Animation Table───────────────────┐
│ lane / clip / frame / key / time ruler           │
└──────────────────────────────────────────────────┘
```

期待：収納状態でも時間現在地が消えず、同じ場所から再生／展開できる。懸念：新しい常設面を追加してCanvasの縦寸法を消費し、すでにある再生controlsとの二重表示を生む。**既存のTable headerを再利用できるか**を先に調べる。

### B — Table上端のPlayback Headerだけ残す（ToonSquid型の比較案）

```text
Table収納中: [ 時間header: F12 | ◀ ▶ | Play | ▴ ]
Table展開中: [ 同じ時間header: F12 | ◀ ▶ | Play | ▾ ]
            [ frame ruler / lanes / clips / keys        ]
```

期待：再生controlsの位置が展開／収納で大きく変わらず、新しい独立Toolbarを作らずに済む可能性。懸念：現行Animation Tableの浮動Panel・既存再生buttons・drag/resize領域が、このheader構成と競合し得る。実際のheader所有者、z-index、既存popupの大きさを確認するまで**最少変更とは判断しない**。

### C — Canvas下端のContextual Playback／Time Chip

```text
Drawing:             [ F12 | ▶ | Table ▴ ]
Transform ANIMATE:   [ F12 | ▶? | 未確定 | Table ▴ ]
RIG:                 [ F12 | ▶ | Table ▴ ]
Table展開:           [ 同じ位置に小型chip またはTable headerへ接続 ]
```

期待：Canvas周辺の高頻度操作だけを残し、作業文脈に応じて情報を絞れる。懸念：modeごとにbuttonsが移動・消失すると発見性を損なう。Canvas上の絵やoverlayを隠す、QTP等と競合する、chip自体がもう一つのfloating windowになる危険がある。**現在のTEGAKIで最優先の配置候補とはまだしない**。

### 比較時に変えてはいけない条件

全案でCanvas内容・倍率、Frame／CAF対象、Table内容、再生権限、pending状態、文字／hit areaを固定する。A案だけ機能を多くし、B案だけKEYを目立たせる等の恣意的比較をしない。実画面の高さとCanvas遮蔽の差を記録する。

## 4. 表示／操作の状態行列（仕様ではなくテスト設計）

| 状態 | Time UIで見ること | 注意すべきauthority |
|---|---|---|
| Drawing・Table収納 | 現在Frame／再生／展開入口の有無 | 「Drawingだけで再生不可」と推定しない |
| Drawing・Table展開 | 収納中と同じ意味のcontrolか／重複しないか | Frame選択は既存Timelineへ委譲 |
| ANIMATE Transform・Table収納 | 現在Frameとpending有無を区別して読めるか | Tableを畳むだけでWARP candidateを捨てない |
| ANIMATE Transform・Table展開 | 右TransformのKEY入口とTableの時間表示を両立できるか | 右側に第二KEY正本を作らない |
| pending中の前後Frame／再生要求 | 禁止・保留・確認の**既存挙動**と理由が読み取れるか | 見た目だけで操作を通す／全操作禁止と決めない。既存guardを調査 |
| 明示KEY確定後 | 現在Frame／KEYED表示／Historyが既存契約に沿うか | UI側が二度commitしない |
| RIG／Text編集中 | Time UIを必要最小限に保てるか | IME・深いRIGの既存terminalに無断干渉しない |
| narrow／Table最大化 | Canvasと右Workspaceにどの程度の可視領域が残るか | 非表示・透過でpointer遮蔽を隠さない |

**重要：** pending中のplayback・frame移動は既存productionの現在の実動作を確認するまでUNKNOWN。Time Stripが表示されることと、押せることは別。

## 5. Canvasの占有と透明化の検討

- 最初に必要なのは、新Time UIの追加ではなく**既存Animation Tableのheader／再生部分を再配置・再利用できるか**の確認。
- 最小時間操作は可能な限り一定位置へ置く。展開時に大きく飛び移らせない。
- Tableを拡張する際、右WorkspaceとCanvasの可視領域を同時に測る。下Panelを大きくするほどCanvasでWARP／RIG overlayを見られなくなる場合は、内部scroll／段階的展開を比較する。
- 半透明はCanvasに重なる**背景面**で候補とし、文字・再生・KEY・focus輪郭を一括して薄くしない。透過して見えてもpointerを遮る場合は別途対処が必要。
- `FPS`やloop範囲など低頻度の設定を、再生の横へすべて常設する必要はない。入口・現在状態だけを残す案を比較する。

## 6. 既存TEGAKIの重複候補：次回の局所確認待ち

ユーザー提供の過去画面では、Canvasの近くにCAFのFrame操作、下にAnimation Table内の再生controls、Layer側にも`LAYERS / RIG`が併存していた。**どれが現行HEADで生きているかは未確認**。このため、次に「追加するもの」だけでなく「移し替えられる既存の再生・Frame controls」を棚卸しする必要がある。

本資料は現行のAnimation Table DOMやFrame modelの現物を解析していない。Tableが開閉後にどのcontrollerを保持するか、KEY／pending guardとの結合、floating popupのresize／move契約はUNKNOWN。新Time Stripの実装Cardをここから直接発行しない。

## 7. WebSOL用・比較時の確認軸

1. **Canvasを見られるか：** Table収納中の有効Canvas縦幅、展開時のWARP/RIG overlay遮蔽。
2. **所在が一定か：** F12／再生／展開入口を、状態が変わるたびに探し直さないか。
3. **現在地が読めるか：** Frame、CAF対象、pending、KEYEDの混同が起こらないか。
4. **入口が見つかるか：** Table展開／高さ変更が、見えないdrag handleだけに依存していないか。
5. **既存を重複しないか：** Canvas周辺CAF controls／Table上部／右Workspaceを合わせ、第二の再生barやKEY書込み入口を無駄に生まないか。
6. **入力の安全性：** pen・mouse・keyboard、IME中focus、pointer capture、Historyと既存guardに矛盾しないか。

## 8. 今回の暫定判断と残存UNKNOWN

**比較の入口：** 新規独立bar（A）を前提にせず、既存Animation Tableのheaderを薄く残せるBを先に検証する価値がある。これは**実装の採用決定ではなく、コード調査の順番**。Aは代替、CはCanvas遮蔽とmodeによる移動の懸念を検証する対象として保持する。

**外部事実として確認済み：** ToonSquidの常設Playback ToolbarとTimeline伸縮・収納、CallipegのTimeline伸縮／Action Panel、LYRICAのBPM Timeline等の機能。

**UNKNOWN：** LYRICA最新版の正確な再生UI配置とClip Editorの変化、TEGAKI現行Tableのheader/mount/resizeと時間controlの共有可否、pending guardを通したTime UIの操作可否、wide/narrowの正確な寸法。

## 9. 次の一回に限定した調査提案

次回は**TEGAKI現行Animation Table／CAF Frame controlsの局所Capability Bank**を作る。再生・前後Frame・現在Frame・Table展開／収納・resize／move・KEY・pending guardの「表示DOM」「所有者」「イベント先」「Table開閉時の生存」を各一行で整理し、既存UIのどれを再利用できるか判断する。LUNAのEdit Boundary Gateで未確認だった編集安全性は、通過したと推定しない。GUI全面再調査、Timeline model再設計、実装は行わない。

## 10. 根拠索引

- [T1] ToonSquid公式Handbook「Timeline」：https://toonsquid.com/handbook/interface/timeline/
- [C1] Callipeg公式「Timeline」：https://callipeg.com/learn-timeline/
- [C2] Callipeg公式「mini interface timeline」：https://callipeg.com/learn-mini-interface-timeline/
- [L1] LYRICA Steam公式製品ページ（2026-09-17 Windows版公開）：https://store.steampowered.com/app/5106770/Lyrica/
- [H1] TEGAKI_GUI_SENSEI_RESEARCH_06_2026-09-20.md：内部研究の前提。外部一次資料ではない。

後日、LYRICAの時刻付き操作動画・実アプリ画面が確保できた場合、現時点のUNKNOWNを別章で更新する。未取得のまま公式操作の断定を加えない。
