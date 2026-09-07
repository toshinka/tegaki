# WP-004 results — 出力拒否と未確定編集

状態: AUDIT IN PROGRESS — GPT判断待ち項目あり（2026-09-07）。作業契約は[WP-004](WP-004-output-terminal.md)、現在地は[STATUS](../STATUS.md)。

## 確定した差

| 対象 | Project save | Export / sequence / preview | 根拠 |
|---|---|---|---|
| Selection transform | `confirmTransform()` | `confirmTransform()` | 両managerの入口 |
| active Layer Transform | `exitLayerMoveMode({source: 'project-save'})`後、1 rAF待つ | 終了処理なし | production manager入口 |
| ANIMATE Layer/Folder Motion preview | saveはbridge finishを通り、変更ありならKEY/Historyを確定してからserialize | sessionを残したまま、現在modelに置かれたpreview KEYをconsumerが読む可能性 | LayerSystem/popup bridge。Slice 3Aのfixtureで実Canvas/PNGを確認、実UIは限定観測 |
| SOURCE / CAF SOURCE preview | saveはRaster確定/captureを開始 | exporter別に現在stage採取または保存snapshot参照となり得る | Slice 3AのfixtureでSOURCE相当の実Canvas/PNGを確認、CAF UIは未実施 |

## F-003 production probe

固定fixtureは2x2 Raster 1枚、同RasterをRig Part登録し、Clip-local F1へ`x=4`のLayer Motionを持たせた旧競合state。

1. `createFolderEffectRenderPlan()`は`unsupported`と`layer-transform-rig-overlap`を返す。
2. `_assertLayerDeformerPlanReady()`は`clip.layerDeformers == null`ならplan statusを検査しない、という条件が拒否抜けの原因だった。
3. 条件を`none/ready`だけ通す形へ限定修正し、`_renderClipEntry()`がCanvas描画前に`unsupported`をthrowすることをproduction verifierで確認した。

修正前はLayer WARPを伴わないLayer/Folder Motion由来のunsupported planがCPU出力で拒否されなかった。修正後はCanvas描画前に拒否する。Slice 1/2のfake Canvas probeだけでは実画素を証明していなかったが、Slice 3Aでready Layer/Folder Motionの実Canvas/PNG hash・bbox一致を追加確認した。

## consumer比較（現時点）

| effect | 共有plan | Browser Pixi preview | CPU compositor | Bake/export |
|---|---|---|---|---|
| root Motion / root WARP | 既存sampler | 既存経路 | supported | compositor経路あり |
| Layer Motion | RenderIsland | WP-003で正常preview確認 | readyは適用。unsupported拒否抜けを再現 | Slice 3Aで実Canvas/PNG hash・bbox一致 |
| Folder Motion | RenderIsland | WP-006で2子同時preview確認 | readyは共有matrix consumer。unsupported拒否条件はLayer Motionと同じ | Slice 3Aでsubtree実Canvas/PNG hash・bbox一致 |
| Folder / Layer WARP | FolderEffect plan | 既存Browser確認とは分離 | `layerDeformers`ありならassert | 既存test参照、今回実画素未確認 |
| Mesh / Skin | RasterSkin plan | 既存consumer | status assertあり | 既存test参照、今回実画素未確認 |

legacy Rig fallbackは今回変更していない。ready/noneを拒否せず、`unsupported`と`invalid`だけをeffect reason付きで止める局所修正が候補になる。

## 最小修正の結果

CPU compositorのplan assertを「Layer WARP fieldがある時だけ」から「planが`none/ready`以外なら」へ狭く変更した。legacy fallbackの`none/ready`は維持し、`renderFrame`と`renderClipFrameSurface`が共有するconsumer入口で拒否する。関連verifierで描画前throwを確認した。

## HD-005判断材料

現状はsaveがactive Layer Transformを確定し、exportは終了しないため、同じ未確定状態から出力結果とHistoryが分岐する。第一候補は「未確定Transformがあればexportを開始せず、KEY確定またはcancelを求める」。export操作による暗黙History追加を避け、SOURCE/ANIMATE/selectionを同じ明示terminalへ寄せやすい。

選択肢は次の3つに限定される。

- 自動確定: SaveとExportのterminalを揃えやすいが、ExportがHistoryや保存正本を暗黙に変更する。
- preview一時採取: 編集中の見た目を出力できるが、保存値・出力値・再現順序が分岐する。
- 明示停止: 未確定ならKEY確定またはcancelを求める。HistoryをExportに追加せず、状態差を最小化できるが操作は1手増える。

現時点の推奨候補は明示停止だが、SOURCE、CAF SOURCE、ANIMATE、Selectionの実出力をBrowserで比較するまで採用しない。追加の横断調査は`DEFERRED — token budget recovery後の追加調査候補`とする。

## 2026-09-07 Slice 3 — Browser / Canvasと隔離UIの実測

製品runtimeを変更せず、`tegaki_work/build/wp004-browser-diagnostic.html`からproductionの`ProjectManager`、`ExportManager`、`TimelineFrameCompositor`、PNG exporterを呼び出した。fixture modelを使うmanager境界と、実`HTMLCanvasElement`／PNG Blobのdecodeを分けて記録した。BrowserはChrome 152、viewport 1280x720、DPR 2.25。診断ページは`PASS`で完了し、unsupported検査で意図的に出た2件のconsole errorは期待された拒否ログである。

| case | entrance | pre-session | terminal action | committed / output | post-session / History | canvas evidence | limitation |
|---|---|---|---|---|---|---|---|
| Selection | production manager Save | Selection active | `exportProject` | Selection confirmed | inactive / +1 | — | fixture manager境界 |
| Selection | production manager Export/Preview | Selection active | `generatePreview` | Selection confirmed | inactive / +1 | — | fixture manager境界 |
| SOURCE Layer | manager Save | Layer Transform active | project serialization | `project-save`でTransform確定 | inactive / +1 | — | fixtureの保存往復 |
| SOURCE Layer | manager Export/Preview | Layer Transform active | preview生成 | Transformを終了せず、PNGへ現在frameを反映 | active / 0 | frame hash `0x74ca5dab`、PNG 169 bytes、bbox一致 | 実UIの入口とは分離 |
| CAF SOURCE | manager Save / Export | internal Layer Transform active | 上記と同じ | Saveは確定、Exportはpreview採取 | Save inactive / +1、Export active / 0 | SOURCEと同じfixture画素 | CAF UI clickは未実施 |
| ANIMATE Layer | manager Save / Export | Layer Motion active | Saveはserialize、Exportはpreview | SaveはKEY/Transform確定、Exportはsessionを残す | Save inactive / +1、Export active / 0 | frame/PNG hash `0x74ca5dab`、bbox一致 | fixtureのANIMATE境界 |
| ANIMATE Folder | manager Save / Export | Folder Motion active | Saveはserialize、Exportはpreview | 子subtreeを同時反映 | Save inactive / +1、Export active / 0 | frame `0x693cf796`、clip `0x7372f5b6`、PNG 172 bytes、bbox一致 | Folder UI clickは未実施 |
| unsupported overlap | `renderFrame` / `renderClipFrameSurface` / preview caller | unsupported Layer Motion + Rig overlap | 各入口を呼出し | drawing/mutation前に`layer-transform-rig-overlap`で拒否 | success扱いにならない / 0 | no drawing; same reason at all entrances | expected console errorのみ |

### Slice 3B — 実UIの差分だけを隔離確認

- 通常SOURCEで実画面のPreviewを1回実行した後もVとLayer Transform panelは残り、Historyは増えなかった。Escapeでsessionが閉じた。したがってPreview clickだけでSOURCEを確定するとは記録しない。
- ANIMATE Layerでは実画面でF1 KEYを確定できた。Export toolbarを押した時点でV/sessionが閉じ、その後Previewを実行した。今回の操作ではHistoryは`2/500`のままで、Export前後のUIイベント順序が直呼出しfixtureと一致するとは断定しない。
- Folderは隔離画面で作成と子Layerの収納まで確認したが、Folder自身のMotion KEYを実UIで作る操作は行っていない。Folder全体の出力反映はSlice 3Aのproduction fixtureで確認した。
- CAF SOURCE UI、連番download、Ownerの既存projectは今回の最小操作対象外。diagnosticのfixture結果と実UI結果を同一passへ混同しない。

### HD-005（GPT判断待ち）

Slice 3AではSaveがactive Layer Transformを確定し、Export/Preview直呼び出しはsessionを維持したまま現在frameを採取した。Slice 3Bの通常SOURCEでもPreview後にsessionが残った一方、ANIMATE Layerの実UIではExport toolbar clickの段階でsessionが閉じた。このためA（Export前commit）、B（一時sampling）、C（明示停止）のいずれかを製品仕様として一意に採用する根拠はまだない。今回はruntimeを変更せず、現象・差分・影響をGPT判断へ返す。追加のCAF/Folder UI総当たりや保存schema変更は`DEFERRED — token budget recovery後の追加調査候補`とする。

技術的には、ready Layer/Folder Motionの実CanvasとPNG出力、unsupportedの描画前拒否はPASS。Browser確認はOwner操作感受入を意味せず、WP-004はACTIVEのまま閉じない。
