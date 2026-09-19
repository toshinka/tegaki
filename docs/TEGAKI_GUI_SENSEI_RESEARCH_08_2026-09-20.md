# TEGAKI GUI先生ツール研究 08 — 現行Time UIの部分棚卸しと責務境界

作成日：2026-09-20  
分類：Research Bank／非正本／非実装Card  
ユーザー保管先：`D:\GitHub\tegaki\docs\TEGAKI_GUI_SENSEI_RESEARCH_08_2026-09-20.md`  
前提：研究06「Animation Table・再生・Text/Context」と07「Time Strip比較」。

> **調査到達度：PARTIAL。** 第07回で指定した「Animation Tableの表示DOM・イベント先・開閉後の生存」の**完全な現行実装棚卸しは未達**。公開GitHubの既知commit `b5e38265b250d4d7ddfc085c761709a6c42238bd` で、小さな関連sourceの一部を確認したが、中心の `ui/animation-table-popup.js`（公開ツリー上約1.22 MB）は接続経由の本文取得が空となり、内部の再生UI・Frame操作・開閉・resize経路を確かめられなかった。ユーザーのローカル作業ツリー、当該commit以降の変更、Browser状態は未確認。**古い画面・他のsourceから現在のTableの内部構造を補完しない。**

## 0. 今回の問いと方法

新しいTime Stripを追加する前に、既存TEGAKIの再生、前後Frame、現在Frame、Table開閉、KEY、pending guardを「表示位置／所有者／操作先／Table収納時の生存」で整理する。

今回は公開commitの `dom-builder.js`、`keyboard-handler.js`、`status-display-renderer.js` の局所範囲、および `ui/animation-table-popup.js` の存在・ファイルサイズを調べた。Research 06・07のワイヤー案を現行productionの事実へ昇格させない。

## 1. 本文を確認できた既存入口

| 能力・入口 | 調査で確認した実体 | 確認できる操作先／所有権 | Table収納中の生存・残存問題 | 確度 |
|---|---|---|---|---|
| Animation Tableを開く入口 | `dom-builder.js` の `buildSidebar()` に `gif-animation-tool`、表示名「アニメテーブル (A)」、`data-popup-name="animationTable"`、`aria-controls="animation-table-popup"` が定義される。 | sidebarはlauncherを構築。実際の開閉処理は当該箇所では定義されない。 | sidebar入口のDOMは別途生成される。実Browserでの表示・押下先・実際の閉鎖後状態はUNKNOWN。 | CONFIRMED（DOM宣言）／UNKNOWN（runtime） |
| Transform内の前後Frame | `dom-builder.js` の `#layer-transform-key-strip` に `#layer-transform-key-prev-btn`、`#layer-transform-key-next-btn` と `#layer-transform-key-commit-btn` がある。 | KEY stripはTransform panelの一部。ボタンの実handler、前後Frame移動のguardはこのDOM構築部分では未確認。 | Table側の再生やFrame操作と重複する**可能性**。Table開閉後の残存と機能同一性はUNKNOWN。 | CONFIRMED（DOM宣言）／UNKNOWN（handler） |
| 現在Frame / KEY状態の表示 | 同じKEY stripの `#layer-transform-key-state-label` に初期文言 `F1 · KEY未設定` がある。KEY stripには初期 `hidden` 属性。 | Transform側のKEY bundle UIの入口であり、Playback toolbar全体ではない。現在Frameへの追従・表示更新元は今回未追跡。 | Transformが閉じたDrawing状態の「常時Frame表示」をこれで満たすとは言えない。 | CONFIRMED（初期表示定義） |
| Animation文脈のkeyboard routing | `keyboard-handler.js` は `PopupManager.get('animationTable')` を参照し、animation文脈で `handlePlaybackMarkerShortcutKeyDown` を呼ぶ箇所がある。さらに `Shift+↑/↓` から `selectAdjacentInternalLayerByDirection`、`Shift+V` から `toggleMotionWindow` へ入る経路がある。 | `KeyboardHandler` は既存animationTableのメソッドを呼び出す入口。再生・時間・対象操作のsource of truthを持つ証拠ではない。 | 「Tableを畳んでもshortcutが有効」とは未確認。`shortcutContext` と `isVisible` 等の条件を実コードで区別する必要がある。 | CONFIRMED（routing）／UNKNOWN（終端） |
| 汎用status表示 | `status-display-renderer.js` は `current-tool`、`current-layer`、`fps-info` などへ状態を投影する。`fps-info` はフレームレート情報であり、現行Frame番号の表示実体とは確認できない。 | StatusDisplayRenderer は表示projection。frame navigation / playback の正本と混同しない。 | Time Stripに既存Frame表示を転用できる根拠なし。 | CONFIRMED（局所source） |

**表にないものが「存在しない」という意味ではない。** 最も重要なAnimation Table内部が未確認である。

## 2. 調査未達：今後必ず確かめる実体

| 対象 | 確かめる内容 | 今回の状態 |
|---|---|---|
| Animation Table内の再生／停止／Loop | DOM id/class、controlsの作成・保持、単一controllerか、Shortcutとの接続 | UNKNOWN：巨大source本文を取得できず |
| 現在Frame／前後Frame／Playhead | Table内とTransform KEY strip／その他CAF表示の参照元、読み取りと変更のauthority | PARTIAL：Transform側DOMとkeyboard入口のみ確認 |
| Table開く／閉じる／minimize | PopupManagerとTable内部の呼出し関係、visibilityだけかsessionにも影響するか | UNKNOWN：sidebar launcher宣言のみ確認 |
| Table header／resize／drag | headerが実在し、toolbarと分離できるか；move/resizeのpointer ownership、z-index | UNKNOWN |
| pending guard・KEY確定 | navigation/playbackがguardを経由するか、disabled理由、History、KEY bundle | UNKNOWN：Transform KEY表示入口のみ確認 |
| 旧 `LAYERS / RIG` 表示 | Tableと右Single Workspaceでの二重navigation、CAFへの入口の現行配置 | UNKNOWN：本回では現行runtime未確認 |

大きなUI fileの中身を確認できなかったため、**「既存Table headerを薄く残す案Bが最小変更で済む」ことはまだ証明されていない。** A（独立Strip）とC（Context chip）を廃案にする根拠もない。

## 3. Research 07の三案について、今回更新できる判断

**案A：独立Time Strip** — 既存sidebar入口、Transform KEY strip、Table内Playback UIを重複させる危険がある。追加する前に同一既存controlの再利用先を確かめる。

**案B：既存Tableのheaderを残す** — 追加Toolbarを避け得る点は引き続き有効な研究仮説。ただしTable headerのDOM所有・開閉後の生存が未確認のため、最小改修とも採用案とも呼ばない。

**案C：Canvas下端のContextual Time Chip** — Canvas遮蔽とモード間での操作位置変動への懸念を維持。現行TEGAKIで必要とされる根拠はまだ得られていない。

共通条件：Time UIは既存Frame／Playback／KEYへの**投影と入口**であり、第二playhead・第二Frame model・第二Historyを作らない。Tableの開閉は右Workspaceのモード状態・pendingの確定／取消と無条件に同一視しない。

## 4. GUI研究の作業順序への示唆

- **静的な外部先生比較と、製品内のCapability Bankは別の証拠段階。** 先生ツールを調べたという理由だけでTEGAKI内部の所有者・再利用範囲を決めない。
- LYRICA再生配置の現物未確認を維持する。ToonSquidの「Tableを畳んでもPlayback toolbarが残る」は比較原則であり、TEGAKI内に新規の常設barを作る命令ではない。
- 最初にローカル現行コードで「何がすでにあるか」を確認し、その後、最小Time UIの実装の要否そのものを裁定する。

## 5. 次の調査：局所source抽出のみ

ローカルの現行HEADで `tegaki_work/ui/animation-table-popup.js` を検索・抽出し、**再生／Frame表示／開閉・resize の各entryだけ**を、生成箇所／handler／呼出し先／既存guard／開閉時生存として各一行に記録する。巨大fileの全文監査やTimeline model変更を行わない。

必要なソースは、(1) `animation-table-popup.js` 内の当該関数・UI構築箇所、(2) `PopupManager` の開閉経路、(3) Transform KEY stripの前後Frame／commit handlerに限定する。既存LunaのEdit Boundary Gate結果を未受領なら、現在の動作保証と混同しない。

**停止条件：** 新規Time Stripや第二controlを作らない。既存UIの再利用可能性を確認しないままA／B／Cを採用しない。新しい設計問題を見つけても本回の調査対象を増やさない。

## 6. Evidence index（同一commitの公開source／前回研究）

[G1] `dom-builder.js`：sidebar launcherは `buildSidebar()` 周辺、Transform KEY stripは `buildLayerTransformPanel()` 周辺。  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/dom-builder.js

[G2] `keyboard-handler.js`：animationTableへ処理を委譲するショートカット入口。  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/keyboard-handler.js

[G3] `status-display-renderer.js`：statusの表示役割。  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/status-display-renderer.js

[G4] `animation-table-popup.js`：実体の存在と公開ツリー上のサイズのみ確認。**本文未読、内部挙動の根拠に使用しない。**  
https://github.com/toshinka/tegaki/blob/b5e38265b250d4d7ddfc085c761709a6c42238bd/tegaki_work/ui/animation-table-popup.js

[H7] `TEGAKI_GUI_SENSEI_RESEARCH_07_2026-09-20.md`：三案とテスト条件。Research Bankでありproduction authorityではない。

---

### Confidence／引継ぎ

CONFIRMED：sidebarのAnimation Table入口、Transform内の前後Frame・KEY strip、KeyboardHandlerからanimationTableへの一部routing、status projectionの一部。すべて**公開commit b5e38265時点の静的宣言または呼出し**。  
PARTIAL：Table内部の能力カタログと重複関係。  
UNKNOWN：現行ローカルHEADの変更、Table本体の再生DOM・handlers・開閉・resize・pending guard、ブラウザでの実動作、LYRICA最新実UIの再生配置。  

この資料からproduction実装Cardを発行しない。
