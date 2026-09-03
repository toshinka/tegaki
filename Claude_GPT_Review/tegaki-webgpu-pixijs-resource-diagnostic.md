# Tegaki 診断書 — WebGPU / PixiJS v8.19 / 高スペックPC前提のメモリ・リソース上限点検

更新日: 2026-08-14
レビュー担当: 外部AI（Web版Claude）
確認方法: GitHub `main` branch（2026-08-14時点、sparse clone + `git pull`で最新確認）のコード読解。Browser実機・実測は行っていない。
想定環境（本書全体の前提）: ブラウザツールだが、メインメモリ64GB、GPUはRTX 4070程度のミドルハイ級を想定したPC環境。この前提のもとで、必要な箇所は上限を過度に儲けず、必要なら手動設定できる、可能なら自動である程度最適化する、という方針での点検を行う。

> 本書は提案・所見であり実装契約ではない。採否は`AGENTS.md`の運用方針に従い、実コード照合の上でCODEX側・Ownerが判断してください。

---

## 1. 概要（結論の要約）

- **PixiJS v8.19更新は既に完了済み**（Phase 7s、SOL review=`A`で技術close）。WebGPU/Canvas rendererや新機能採用は意図的に対象外とした純粋なバージョン更新で、破壊的変更の影響もなく低リスクに反映されている。
- **WebGPUは`TEGAKI.md`の規定で正式研究Phaseまで凍結**されており、通常の機能追加では触れない方針が既に明文化されている。
- 多CLIP・多パーツ・多重メッシュ変形・多重ボーン動作時の「余裕」について調べたところ、**実際のボトルネックはWebGPUの有無以前に、CPU側のスキニング計算とピクセル単位のワープ合成にある可能性が高い**（詳細は3章）。
- 64GB RAM / RTX4070級という想定環境に対して、**メモリ・解像度まわりのハードコード上限のうち一部は明らかに保守的すぎる**、または**自動調整の実効値が想定より低くなる構造的な制約**を持っている（詳細は4章）。History設定のように「自動調整＋手動オーバーライド」が既に実装済みの箇所もあれば、Raster面サイズ上限のようにどちらも存在しない箇所もある。

---

## 2. 改修状況の確認（前回までの続報）

| 項目 | 状態 | 根拠 |
|---|---|---|
| PixiJS 8.17.0 → 8.19.0 | 完了。Phase 7sでSOL review=`A`技術close。WebGPU/Canvas renderer、新v8.19機能採用、保存schema変更は明示的に対象外 | `tegaki_work/GitHubURL.txt` 19行、`tegaki_work/package.json`（`pixi.js: 8.19.0`確認済み） |
| Vite / PostCSS / Nanoid更新 | 完了。Phase 7uで`npm audit` high 3件を0件化 | `tegaki_work/GitHubURL.txt` 21行 |
| WebGPU / SDF / MSDF | 正式研究Phaseまで凍結。通常機能追加では参照・編集しない方針を明文化 | `tegaki_work/GitHubURL.txt` 291行、`PROGRESS.md`「WebGPU brush、SDF / MSDF、水彩・油彩、本格物理、真の無限Canvasは正式な研究Phaseまで凍結する」 |
| LBSスキニングの頬漏れ・腕伸縮 | Owner実制作操作で確認済みの課題。Phase 8c（Limited Skin Influence Correction Gate、現在Gate 0段階）で対応中、未解決 | `PROGRESS.md`「全Bone距離上位2本weightによる顔への影響漏れと、LBS関節blendによる腕幅／長さの変化を確認した」 |
| Bake同期チェックポイントのメモリ逼迫 | 400×400・1 Layer・240 Frameの実測で確認済み。安全上限を1GiBへ固定して対応（詳細は3.3、4.2で深掘り） | `PROGRESS.md`「処理完走後の同期checkpointに強いmemory pressureが出たため、校正済み安全上限を1GiBへ固定した」 |

---

## 3. 多CLIP・多パーツ・多重メッシュ変形・多重ボーン動作時の「余裕」についての考察

### 3.1 レンダリングパスの実態（確度: 高いが未実機検証）

コードを辿ると、Rig/Meshで変形したキャラクターパーツの合成は、**PixiJSのGPU Mesh描画ではなく、CPU側のピクセル単位ラスタライザで行われている可能性が高い**ことが分かりました。根拠は以下の通りです。

- Tegaki自身のコード全体（`ui/`、`system/`）を検索した結果、PixiJSの`Mesh`/`MeshGeometry`を生成している箇所は`ui/animation-table-popup.js`の1箇所（4556-4562行）だけで、これは同期bake専用の一時Meshでした（コード内コメント: 「このMeshは同期bakeだけに使い」）。
- 実際にRig/Mesh変形結果を評価しているのは`system/animation/raster-skin-render-plan.js`の`createRasterSkinRenderPlan()`で、これは`evaluateRasterBoneSkinning()`（CPU JS、頂点ごとの重み計算）と、`system/animation/warp-grid-rasterizer.js`の`warpRgbaWithTriangles()`系関数（三角形ごとのbounding boxをスキャンし、ピクセルごとにbilinearサンプリング・source-over合成をCPU JSで行うソフトウェアラスタライザ）を呼び出しています。
- `ui/animation-table-popup.js`は2634行・4373行で`createRasterSkinRenderPlan`を直接呼んでおり、これは**エクスポート専用の`timeline-frame-compositor.js`とは独立に、通常のUI/プレビュー側からも同じCPUラスタライズ経路が使われている**ことを示しています。

つまり、CLIP再生中の各フレームで、変形済みキャラクターパーツを表示するたびに、GPUの三角形ラスタライザ（本来この処理が最も得意なハードウェア）を使わず、シングルスレッドのJSでピクセルを塗っている可能性が高いということです。これが正しければ、**「多CLIP・多パーツ・多重メッシュ変形・多重ボーン」という負荷は、まさにこの経路の合計コスト（スキニング計算＋ピクセルラスタライズ）に直結**します。

ただし、この結論はコード読解によるもので、実機でのプロファイリングは行っていません。`_warnPerf`や`PerformanceObserver('longtask')`など、既存の計測基盤を使えば実測で確認できるはずなので、断定はせず検証を推奨します。

### 3.2 スキニング計算（CPU）のスケーリング

`system/animation/raster-bone-skinning.js`の`evaluateRasterBoneSkinning()`は、頂点ごとに`Map`ルックアップとobject literal生成を伴うJSループで、最大2 influenceの線形ブレンドを計算しています。型付き配列を使わないこの実装は、パーツ数・頂点数が増えるほどGCプレッシャーが線形に増加します。

### 3.3 CPUラスタライズ（本命の負荷）とBakeチェックポイントの関係

3.1の推測が正しい場合、これがボトルネックの本命です。`warpRgbaWithTriangles`系関数は三角形ごとにbounding box内をスキャンし、ピクセルごとにbilinearサンプリング（4テクセル読み込み＋premultiplied blend）を行うため、パーツの描画面積に比例したCPUコストがかかります。GPUなら専用ハードウェアで並列処理される処理を、JSで直列に行っている形です。

これは2章で触れた「Bake同期チェックポイントのメモリ逼迫」（400×400・1 Layer・240 Frameで既に強い圧迫）とも整合します。CPU側でフレームごとにピクセルバッファを生成・保持する経路である以上、パーツ数・CLIP数が増えれば増えるほど、CPU時間とメモリの両方が同時に逼迫しやすい構造だと考えられます。

### 3.4 相対的に安心できる要素

- **IK計算は軽い**。末端から追従させる2-BoneのIKは閉形式で解けるため、チェーン数が増えてもここがボトルネックになる可能性は低いです（Phase 6tでclose済み）。
- **デフォルトアニメーションFPSは12fps**（`config.js` 112行 `defaultFPS: 12`）。60fps前提のアプリと比べて1フレームあたり約83ms（60fpsなら約16.6ms）の予算があり、CPU処理に約5倍の余裕があります。多少重い処理でも12fps基準なら破綻しにくい設計になっている点は評価できます。

### 3.5 WebGPU / GPU化との接続

もしWebGPUに投資するなら、最も価値があるのは3.1・3.3で触れたCPUラスタライズ経路の置き換えです。ただし、これは必ずしも「WebGPUでなければ実現できない」話ではありません。PixiJSは既にGPU Mesh描画（WebGL）をサポートしており、この経路をGPU Meshベースに切り替えるだけでも、WebGPUを経由せずに同等の恩恵の多くを得られる可能性があります。前回お伝えした通り、WebGPU固有の優位性が明確に効くのはMSDF/JFAパイプラインのcompute化と、将来の物理演算（roadmap上でCandidate Hとして凍結中）です。この点は前回の説明から変更ありません。

---

## 4. 高スペックPC前提でのメモリ・リソース上限点検

ご指定の「メインメモリ64GB、GPU RTX4070程度」という環境を前提に、コード上のメモリ・解像度関連の上限値を洗い出しました。「ある程度は既に設定にあったと思う」というご認識は、History設定については正しく、実際にかなり作り込まれた自動調整＋手動オーバーライドの仕組みが存在します。一方で、それ以外の箇所は固定値のままのものもありました。

### 4.1 History（Undo履歴）メモリ上限 — 自動調整・手動設定ともに存在

`system/settings-manager.js`（62-83行）に、以下の自動調整ロジックがあります。

```js
getAutomaticHistoryDefaults() {
    const deviceMemory = Number(globalThis.navigator?.deviceMemory);
    const heapLimitMB = Number(globalThis.performance?.memory?.jsHeapSizeLimit) / 1024 / 1024;
    const heapLimitGB = Number.isFinite(heapLimitMB) && heapLimitMB > 0 ? heapLimitMB / 1024 : 0;
    const memoryGB = Math.max(
        Number.isFinite(deviceMemory) ? deviceMemory : 0,
        heapLimitGB
    );
    if (memoryGB > 0) {
        if (memoryGB <= 4) return { maxEntries: 100, maxMemoryMB: 256 };
        if (memoryGB < 8) return { maxEntries: 250, maxMemoryMB: 512 };
        if (memoryGB < 16) return { maxEntries: 500, maxMemoryMB: 1024 };
        if (memoryGB < 32) return { maxEntries: 500, maxMemoryMB: 2048 };
        return { maxEntries: 500, maxMemoryMB: 4096 };
    }
    return { maxEntries: 250, maxMemoryMB: 512 };
}
```

さらに設定画面（`ui/settings-popup.js` 183-200行付近）には、履歴回数（50〜500）とメモリ上限（**128MB〜16GB**、8段階）を手動選択できる`<select>`があり、`historyAutoAdjust`をOFFにすれば自由に選べます。**「必要ならユーザーが任意で設定できる」は、History に関してはすでに満たされています。**

ただし、自動側には構造的な弱点があります。`navigator.deviceMemory`は仕様上、実際のRAM量に関わらず**最大8を返すよう歴史的に丸められてきたAPI**で、Chromium系ブラウザのみ対応、Firefox/Safariは未対応（`undefined`）です。もう一方の信号である`performance.memory.jsHeapSizeLimit`もChrome限定の非標準APIで、システム全体のRAMではなく「その時点のレンダラープロセスのJSヒープ上限」を返すため、通常のデスクトップChromeでは数GB程度の値になりがちです。

- Chromeで動かした場合: `deviceMemory`が8止まり、`jsHeapSizeLimit`ベースの推定も数GB程度に収まりやすいため、`memoryGB`は8前後、`<16`の分岐（**1024MB**）止まりになる可能性が高いです。コード上は2048MB・4096MBの分岐が用意されていますが、**実際の64GB機でここに到達できるかは怪しい**です。
- Firefox/Safariの場合: 両APIとも使えないため`memoryGB=0`となり、常に最終行の**512MB**フォールバックになります。実RAM量に関係なく、です。

なお、`navigator.deviceMemory`の8GB上限について検索したところ、2026年に入ってChromeが非Android環境でより高い値（16、32）を返すようになったという情報もありましたが、別の情報源では従来通り8で頭打ちという記述もあり、**現時点では確定情報として扱えませんでした**。実機のChromeで`console.log(navigator.deviceMemory)`を打って確認するのが最も確実です。

**推奨**: 自動調整の分岐自体は残しつつ、検出上限が低く出た場合のデフォルトをもう少し高めに倒す（例: 検出失敗時のフォールバックを512MBではなく1024MB程度にする、あるいはハードウェアスレッド数`navigator.hardwareConcurrency`のような別の傍証も加味する）か、初回起動時に「自動調整はブラウザの制約で控えめな値になることがあります。高スペック機なら手動設定を検討してください」といった導線を出す程度の対応で十分だと思います。手動側の上限（16GB）自体は既に十分です。

### 4.2 Bake同期チェックポイントのメモリ上限 — 固定1GiBが実質的な天井

`ui/animation-table-popup.js`のBake容量見積もり（11078-11090行）は、単純な固定値ではなく次のような計算をしています。

```js
const heapBudgetBytes = Number.isFinite(heapLimit) && heapLimit > 0
    ? Math.floor(heapLimit * 0.8)
    : STRUCTURED_BAKE_CHECKPOINT_SAFE_BYTES;
const memoryBudgetBytes = Math.min(
    heapBudgetBytes,
    STRUCTURED_BAKE_CHECKPOINT_SAFE_BYTES  // = 1024 * 1024 * 1024 (1GiB)
);
```

実測ヒープ上限の80%と、固定1GiBの**小さい方**を採用する構造です。つまり、実際のヒープ上限がもっと大きくても、**1GiBを超えて使うことは仕組み上できません**。64GB RAM機であっても、Bakeが使えるメモリ予算は最大1GiBに固定されています。

2章で触れた通り、400×400・1 Layer・240 FrameというかなりコンパクトなプロジェクトでもこのBudget付近で強い圧迫が確認されており、多CLIP・多パーツの大きなプロジェクトではより早く天井に当たると考えられます。

**推奨**: 想定環境（64GB RAM）であれば、この固定上限を例えば2〜4GiB程度まで引き上げる余地は十分あります。ただし3.3で触れた通り、天井を上げるだけでは「モグラ叩き」になる可能性もあるため、根本的にはBake処理がフレームごとの中間データをどれだけ溜め込んでいるか（逐次解放できているか）も合わせて確認する価値があります。天井を上げる対応と、保持パターンの見直しは分けて検討することを推奨します。

### 4.3 Raster面サイズ上限（`maxPixels` / `maxAxis`）— 自動調整・手動設定ともに存在しない

`system/raster-bounds.js`の`validateRasterSurfaceSize()`（190行）は、デフォルトで`maxPixels: 16,777,216`（16メガピクセル、概ね4096×4096相当）、`maxAxis: 8192`（片辺最大8192px）という上限を持っています。

```js
const maxAxis = Math.max(1, Math.round(Number(options.maxAxis) || 8192));
const maxPixels = Math.max(1, Math.round(Number(options.maxPixels) || (16 * 1024 * 1024)));
```

この関数はLayer作成・PSD import・Canvas resize・Bake合成・Alpha輪郭抽出など、少なくとも7箇所（`system/psd-importer.js`、`system/layer-system.js`、`system/animation/timeline-frame-compositor.js`（3箇所）、`ui/resize-popup.js`、`ui/animation-table-popup.js`）から同じ`16*1024*1024`を明示的に渡す形で呼ばれています。**どの呼び出しもデバイス性能を見ておらず、自動調整も手動設定UIも存在しません。**

64GB RAM / RTX4070級のPCであれば、4096×4096より大きなキャンバス（例えば6000×6000クラス）を扱いたい場面は十分考えられますが、現状はこの上限に一律で引っかかります。

**推奨**: History設定と同様に、`config.js`側にデフォルト値を持たせつつ、設定画面から調整できるようにする、あるいは`navigator.deviceMemory`/`jsHeapSizeLimit`ベースの簡易判定で段階的に引き上げる、といった対応が考えられます。ここは4箇所の中で最も「上限を儲けすぎている割に、逃げ道が全くない」状態なので、優先度は高めだと思います。

### 4.4 Snapshot Texture Cache（512MB）— config.js固定、実行時UIなし

`config.js`（132行）の`snapshotTextureCache.maxBytes: 512 * 1024 * 1024`は、`ui/animation-table-popup.js`側で`window.TEGAKI_CONFIG`から読む形にはなっている（5667-5678行）ため、**開発者がconfig.jsを書き換えれば変更できます**が、History設定のような実行時の自動調整・ユーザー向け設定UIはありません。オニオンスキンやCLIPプレビューのキャッシュに使われるものなので、多CLIPプロジェクトでキャッシュの効きが悪くなる（頻繁な入れ替わりが起きる）と、スクラブ時のもたつきにつながる可能性があります。優先度は4.2・4.3より低いですが、記録として残しておきます。

---

## 5. 推奨事項のまとめ（優先度順）

| 優先度 | 項目 | 対応の方向性 |
|---|---|---|
| 高 | Raster面サイズ上限（4.3） | 自動調整または手動設定UIを追加する。現状は逃げ道が全くない |
| 高 | Bakeチェックポイントの1GiB天井（4.2） | 高スペック環境向けに引き上げる。合わせて保持パターンの見直しも検討 |
| 中 | CPUラスタライズ経路の実態確認（3.1） | 実機プロファイリングで多CLIP・多パーツ時のコストを実測する。GPU Mesh化の効果測定はその後 |
| 中 | History自動調整の実効上限（4.1） | 検出失敗時のフォールバックを引き上げる、または高スペック機への導線を用意する。手動設定自体は現状で十分 |
| 低 | Snapshot Texture Cache（4.4） | 必要になった時点で設定UI化を検討 |

---

## 6. 前回までの内容の訂正・補足

- 前々回の回答で「WebGPUは`TEGAKI_CONFIG.webgpu.enabled: false`で明示的に無効化されている」とお伝えしましたが、正確には`core-initializer.js`の`app.init()`がそもそも`preference`を指定しておらず、この設定項目自体が配線されていない状態でした（前回のやり取りで訂正済みですが、本書でも記録として残します）。現在はこの論点自体が「WebGPUは正式研究Phaseまで凍結」という上位方針で上書きされています。
- 前回の「Bake処理は単純に1GiBへ固定された」という理解は、本書4.2で見た通りやや不正確でした。正しくは「実測ヒープの80%と1GiBの小さい方」という計算式で、1GiBは実効上限というより安全弁（ceiling）として機能しています。

---

## 7. 未検証・対象外

- 実Browser（Chrome/Edge/Firefox/Safari）での`navigator.deviceMemory`・`performance.memory.jsHeapSizeLimit`の実際の返り値は確認していません。4.1の推測は公開情報とコード構造からの推論です。
- 3.1のCPUラスタライズ経路の推定は、コード読解のみに基づいており、実機プロファイリングでの裏付けは取れていません。
- 多CLIP・多パーツ・多重メッシュ変形時の実際のフレームレート低下量は測定していません。本書は構造的なリスク要因の指摘にとどまります。
