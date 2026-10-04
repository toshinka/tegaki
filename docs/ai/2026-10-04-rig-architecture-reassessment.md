# RIG刷新の設計再精査

状態: REFERENCE / DESIGN REVIEW。2026-10-04。司令によるSOL極高の一回の再精査。
Ownerの目的は旧系への互換整備を抑え、新しい土台で制作動線を作ること。添付briefとClaude所見は参考資料であり、実装許可の根拠はOwnerの会話指示と確定Card。
baseline: main / `f245c354f63b808e3f5c89facfed19f5b0184eaf`。WP-023/024/025等の既存dirtyを保持。製品コードはこのレビューでは変更しない。

## 結論

旧・旧々RIGを隔離して新系を作る方向は維持する。表面GUIのコードを残すことより、素材を選ぶ、支点を置く、動きを調整する、戻す、保存するという操作の意味を残す。

前提を二つ修正する。外部へ評価器だけを任せる案を第一案から外し、外部のモデル・評価・描画をまとまりとして借りる。TEGAKI側でメッシュ、mask、blendを再描画する費用を初期投資にしない。また、Windows nativeの保存proofを重ねる順序を止め、実画像を使ったBrowserの編集・再読込・出力を次の判断材料にする。

次の技術proofはRive CLI / RML / Web runtimeの一件を優先する。これはbackendの製品採用ではない。Inochi2DはLive2D型の概念が近い候補として保留し、今のsnapshotへの修復と安定版への再buildは続けない。Ikiや別engineの比較調査も自動では再開しない。

具体的な実行範囲は[WP-026](../work/WP-026-rive-authoring-browser-proof.md)。一件の結果が出れば候補調査を区切り、制作操作と製品への最小接続を判断する。

## 前のproofから判断できること

[WP-020](../work/WP-020-rig-renewal-first-path.md)の固定nightly snapshotはbuild/linkまで成立した。一行修正後も初期fixtureのserializeは別のJSON例外で停止し、第二callsiteは未特定。保存・編集・破棄後reload・三点評価は成立していない。texture無しの合成fixtureであり、実画像やBrowserへの接続費用も測れていない。

この結果からInochi2D全体が壊れているとは判断しない。一方、TEGAKIの資源節約に向くことも証明されていない。fixture生成器、D依存、serializer、WASM bridgeを順に修復すると、上流エンジン保守がTEGAKIの仕事になる。前の司令案「安定版sourceで同じnative driverを再試行」は次の優先作業から取り下げる。

[現行SDKの公式README](https://github.com/Inochi2D/inochi2d/blob/main/README.md)ではWASMの自前buildにpatched druntimeとLinux向けtoolchainを案内している。配布binaryを使う経路もあるため、これをBrowser不可能とは読まない。ただしWindows native build成功だけではこの追加責任を解消できない。

2026-10-04の公式GitHub APIではSDKのlatestは[v0.8.7](https://github.com/Inochi2D/inochi2d/releases/tag/v0.8.7)（2024-10-02）、Creatorは[v0.8.6](https://github.com/Inochi2D/inochi-creator/releases/tag/v0.8.6)（2024-09-18）。SDK、Creator、nightly、mainの版と公開日を同一視しない。Creatorの公式動作fixtureを入口にする案は残すが、今回は実行していない。

## Riveの再評価

現在の[公式CLI](https://rive.app/docs/cli/overview)はRMLというテキストからsceneを編集・ビルド・inspectする。したがって「binaryと非公開Editorしか使えず、自前GUIの候補から外す」という以前の説明は狭すぎる。[RML](https://rive.app/docs/runtimes/advanced-topic/rml)はモデルの型とpropertyを記述し、公式CLIがruntime形式を生成する。

CLI 1.3.0の公式Windows配布物に同梱された`docs/rigging.md`を読んだ。`Image`の子に`Mesh`、`ContourMeshVertex`、UVとtriangle indicesを置き、`Skin`/`Tendon`/`Weight`で骨に結ぶRML例が実在する。Bone/IKとblendの説明もある。画像メッシュは[Editorの公式説明](https://rive.app/docs/editor/manipulating-shapes/meshes)でも確認できる。これは資料上の能力確認であり、TEGAKI側でビルド・描画した証拠ではない。

[公式Getting Started](https://rive.app/docs/cli/getting-started)はローカルbuild/previewをlogin不要とし、script無しのファイルはWebでunsignedの制約を受けないと説明する。script付きWebファイルにはpublish/signingが必要で、publishにはwatermark/plan条件がある。このproofではscript・publish・cloud accountを使わない。必要機能がscript/publish必須だと判明したらその境界で止める。

残る重大な制約はauthoring compiler。Web runtimeが[MIT](https://github.com/rive-app/rive-runtime/blob/main/LICENSE)でもCLIの再配布やTEGAKIの公開編集サービスへの組込みまでMITとは扱わない。[Service terms](https://rive.app/docs/legal/terms-of-service)と配布条件を別に扱う。今回の案は個人のlocal companionを使う独立proofであり、純Browser authoring、CLI再配布、公開製品のeditor利用条件はUNKNOWN。

またRiveのbone/timeline/blendを使えることは、Cubismの全keyform、変形階層、物理、モデル互換を得ることではない。TEGAKIが必要な操作を一つ通してから不足を判断する。

## どこまで外部へ任せるか

| 責任 | 最初の案 | 限界 |
|---|---|---|
| 画像メッシュ・skin・boneの評価と描画 | 外部runtimeに任せる | mask等の別consumerを自作しない |
| 編集可能なsourceとruntime build | RMLと画像、公式CLI | local companionが必要。純Browser compilerは未確認 |
| 人間の操作 | 小さな独立編集session | 旧GUI mutationへ互換adapterを重ねない |
| 新系の編集中save/cancel | 独立source bundleと最後の成功build | Projectに第二正本を追加しない |
| TEGAKIへの最初の出力 | 出力RGBA/PNGを通常Rasterとして受ける案 | 動的rigのProject保存・CAF/time接続とは別 |
| 既存作品 | 現行経路で開く | 全面移行、旧新の全機能一致は作らない |

独立proofでは外部runtimeがrenderするCanvasから1x PNGを取得する。製品側に進む最初の案は、その確定画素を既存Rasterの取り込み経路へ渡すこと。これはrenderer contract変更前でも試せる境界で、TEGAKI内の動的再編集rigが完成したことにはならない。

動的rigをproduction ClipAssetとして保存する段階では、外部sourceの置場、生成`.riv`の再現・復旧条件、resource不足時の扱い、frame/reset、CPU/final出力とpreviewの関係を個別Cardで決める。現在の[TECHNICAL](../TECHNICAL.md)と[ARCHITECTUREの出力契約](../ARCHITECTURE.md#animation評価と出力)をこの提案で書き換えない。外部Canvasをそのまま現在のExport正本と宣言しない。

## 最初の制作動線と検証量

次のproofは透明PNG一枚、四頂点の画像mesh、二bone、一つの動き、通常blend、physics/mask/script OFFに絞る。自前GUIで終点角を編集し、公式buildが成功した時だけpreviewを交換する。sourceを保存してsessionを破棄し、新規sessionで同じsourceとruntimeを開き、0/0.5/1の動きとPNGを確認する。

必要な検証はこの新経路だけ。素材が実際に描かれる、意図した場所が動く、編集後保存が新instanceで再現する、cancel/壊れた入力が最後の成功状態を壊さない、1x出力にpreview専用変換が入らないことを確認する。旧RIGの大量の整合比較や上流の全suiteは行わない。compileだけやsource文字列往復だけを成功にしない。

これが通れば次はTEGAKIの確定素材の受渡しと通常Rasterへの出力を一件にする。その後、Ownerが実際に触って必要になったpivot、mesh点、parameter/blend、keyform相当の操作を追加する。汎用backend interface、全自動rig、AI/MCP、全physics、任意maskを先に作らない。

## 打切りと役割

一つの公式CLIと一つのWeb runtimeで成立しない場合、engine本体patch、第二platform、無制限のversion探しは行わない。原因、残るbridge/UI/validator量、成立した段階を返す。local companionの費用が大きい、必要な画像meshがbuild/runtimeで非対応、script/publishが必須、利用条件が製品目的と衝突する場合も、候補の順位を再判断する。

設計判断はこの司令。確定proofは既存LUNA MAXへ渡せる。失敗原因や保存/renderer境界の判断だけSOL高へ返す。新chat/agent、短周期pollは不要。今回の極高は旧前提と投資先の見直しに一回使い、実行は中〜高へ戻す。極高を再度使うのはproof後の採用、動的asset保存、frame/出力authorityなど後戻りの大きな判断が具体化した時。

## 取得物と証拠範囲

- CLI manifest: `https://releases.rive.app/cli/v1.3.0/manifest.json`。Windows archive: `https://releases.rive.app/cli/v1.3.0/rive-windows-x64.tar.gz`。SHA256 `F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF`、18,398,734 bytes。公式manifest値と取得値が一致。
- archiveはignored `tegaki_work/.cache/rig-reassessment/`へ取得。path traversal検査後、`tar -xOzf ... docs/rigging.md`と`docs/easing.md`で資料のみ読む。exe/installerは実行していない。
- `rigging.md`の各行をLF連結し末尾LF一つに正規化したSHA256: `F1B41F8B57DC54DB4729133CAE387B2916626B74F9641F5DDAB3E2DDB505C0DC`。archive内の元bytesのhashとは区別する。
- 公式npm metadata: `@rive-app/canvas-advanced` `2.44.0`、MIT、dist integrityはWP-026へ固定。dependency install/package-lock変更なし。
- PROVEN: 既存proofの停止点と現在の契約を読解、公式CLI/RMLと同梱image-skin例、配布hash、文書導線。UNKNOWN: Rive実build/native Web load/画像/性能、CLI組込み/再配布条件、TEGAKI統合/Project/Owner制作受入。採用・pushの自己承認はしない。
- 文書検査: harness checkは69 documents / 265 local links / 25 proposals / 17 packagesでPASS、git diff --check PASS。WP-026は未委任・未実行。今回のwriteは再精査/次Card/案内docsとignored取得cacheだけ。既存製品差分は保持、commit/push無し。
