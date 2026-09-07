# WP-004 results — 出力拒否と未確定編集

状態: AUDIT IN PROGRESS — GPT判断待ち項目あり（2026-09-07）。作業契約は[WP-004](WP-004-output-terminal.md)、現在地は[STATUS](../STATUS.md)。

## 確定した差

| 対象 | Project save | Export / sequence / preview | 根拠 |
|---|---|---|---|
| Selection transform | `confirmTransform()` | `confirmTransform()` | 両managerの入口 |
| active Layer Transform | `exitLayerMoveMode({source: 'project-save'})`後、1 rAF待つ | 終了処理なし | production manager入口 |
| ANIMATE Layer/Folder Motion preview | saveはbridge finishを通り、変更ありならKEY/Historyを確定してからserialize | sessionを残したまま、現在modelに置かれたpreview KEYをconsumerが読む可能性 | LayerSystem/popup bridge。実出力未確認 |
| SOURCE / CAF SOURCE preview | saveはRaster確定/captureを開始 | exporter別に現在stage採取または保存snapshot参照となり得る | 実操作比較が必要 |

## F-003 production probe

固定fixtureは2x2 Raster 1枚、同RasterをRig Part登録し、Clip-local F1へ`x=4`のLayer Motionを持たせた旧競合state。

1. `createFolderEffectRenderPlan()`は`unsupported`と`layer-transform-rig-overlap`を返す。
2. `_assertLayerDeformerPlanReady()`は`clip.layerDeformers == null`ならplan statusを検査しない、という条件が拒否抜けの原因だった。
3. 条件を`none/ready`だけ通す形へ限定修正し、`_renderClipEntry()`がCanvas描画前に`unsupported`をthrowすることをproduction verifierで確認した。

修正前はLayer WARPを伴わないLayer/Folder Motion由来のunsupported planがCPU出力で拒否されなかった。修正後はCanvas描画前に拒否する。実画素の一致自体はfake Canvasでは証明していない。

## consumer比較（現時点）

| effect | 共有plan | Browser Pixi preview | CPU compositor | Bake/export |
|---|---|---|---|---|
| root Motion / root WARP | 既存sampler | 既存経路 | supported | compositor経路あり |
| Layer Motion | RenderIsland | WP-003で正常preview確認 | readyは適用。unsupported拒否抜けを再現 | 実画素未確認 |
| Folder Motion | RenderIsland | WP-006で2子同時preview確認 | readyは共有matrix consumer。unsupported拒否条件はLayer Motionと同じ | 実画素未確認 |
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
