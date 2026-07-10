# Phase 5q preview / Lane order notes

## Current stable point

- Animation Table PREVIEW中のstroke当たり外れは、preview containerのPixi child順が呼び出しごとに反転する経路が主因だった可能性が高い。
- `setChildIndex()` で同じ親の既存childを「基準childの前後」へ動かすと、Pixi側で対象childが一度removeされ、事前に計算したindexと実際の挿入位置がずれる。
- その結果、`animationPreviewBackContainer` / `currentFrameContainer` / `animationPreviewContainer` の前後関係が交互に変わり、stroke中だけ選択CAF working Layerがpreviewや背景代替containerに隠れる状態が起きていた。
- 現在はpreview群を一度parentから外し、`background -> back preview -> currentFrameContainer -> front preview` の順で挿し直すことで順序を冪等にしている。

## Do not regress

- preview containerの順序調整に、同じ親上の `setChildIndex()` 連続移動を戻さない。
- stroke中の選択CAFは本物のanimation working Layerとして表示し、他CAF / Timeline onionだけをsnapshot previewへ回す。稼働中RenderTextureを別Spriteで二重に読む経路へ戻さない。
- preview再構築時は、非表示stagingへ組んでからfront/back childrenを差し替える。先に表示中previewを空にしてから順次addしない。
- Layer visibility、ClipAsset / DrawingSnapshot、Historyへdisplay-only preview stateを混ぜない。
- CAF切替時の0.1秒未満の点滅は、現状では許容できる表示再構成副作用として扱う。stroke中安定を優先し、切替点滅だけを追ってstroke契約を崩さない。

## Lane display order contract

Tegaki内には複数の順序契約がある。

- `LayerSystem.currentFrameContainer.children`: Pixi render orderは配列前方が背面、後方が前面。Layer Panelはこれをreverse表示しているため、通常Layerでは「Panel上 = Canvas前面」。
- `TimelineModel.tracks`: Animation Table UIは `tracks` をそのまま上から下へ描く。現行コメント上は `tracks[0]` を「UI上 = 前面」と見なしている。
- `AnimationTablePopup._renderFrameComposite()`: `tracks` を末尾から先頭へ描くため、`tracks[0]` が最後にaddされて前面になる設計。
- `TimelineFrameCompositor`: `getFrameAssetTree().clips` を末尾から先頭へ描くため、`tracks[0]` 前面の考え方に寄っている。
- CAF internal Layer合成とPSD active CAF compositeもsiblingsを末尾から先頭へ描くため、配列先頭を前面にする契約へ寄っている。

標準的には、Layer Panelと同じく「UI上にあるLaneほど前面」が分かりやすい。つまり、Animation Table上でLane 1が一番上ならLane 1を前面にするのが自然。

ただし実機観測では、現在はLane 3など下側Laneが前面に見えている。これは単純に `_renderFrameComposite()` のloopだけを見ると説明しきれないため、次のいずれかを疑う。

- `TimelineModel.tracks` の実順がUI表示名と逆転している。
- `syncWithLayers()` / independent Lane追加 / restoreで、表示名のLane番号と内部配列順がずれている。
- 非描画previewとstroke中previewで、同じframe合成に見えて別container階層を通っている。
- export / PSD出力の階層順も、同じ「配列順をreverseして使う」前提に依存しており、外部アプリ側のchildren解釈と逆になる可能性がある。

## PSD / PDF hierarchy note

ユーザー観測では、出力をCLIP STUDIO側で開くとFolder / Layerはあるが階層順が逆に見えることがある。Tegaki側のPSD exporterは通常Layer / CAF internal Layerのchildrenを `.reverse()` してag-psdへ渡している。一方、合成canvas生成も末尾から先頭へ描いている。

このため、見た目のflatten結果とPSDレイヤーツリー順は別々に検証する必要がある。Lane表示順問題と概念的には近いが、今回のstroke当たり外れ原因だったPixi preview container順序とは別問題として扱う。

## Recommended next slice

1. まずdebug時だけ、Animation Table render後に `tracks` の実順、表示名、Frame合成のback-to-front順をconsoleまたは一時APIで確認する。
2. その結果を見て、Lane順の正本を「UI上 = 前面」に固定するなら、preview / TimelineFrameCompositor / PSD CAF composite / Layer Panel CAF headerが同じ順序resolverを使うように寄せる。
3. stroke安定化済みのpreview container順序と、stroke中の選択CAF working Layer表示契約は触らない。
4. PSD / PDF階層逆転は、表示順整理後にag-psdのchildren順だけを小さな2Layerファイルで検証し、flatten合成順とは分けて修正する。

## Implemented order fix

- stroke中は選択Laneより下のCAFをback preview、上のCAFをfront previewへ分け、選択CAFの実working Layerをその間へ置く。安定化済みの `background -> back -> currentFrame -> front` container順と、選択CAFを実working Layerで描く契約は維持する。
- 非描画PREVIEWとTimeline compositorは従来どおりtracks末尾から先頭へ合成し、Animation Table上側Laneを前面とする。
- PSD active CAF exportでは `ClipAsset.internalLayers` を反転しない。内部Layer配列とag-psd childrenはいずれもUI上から下の順であり、flatten合成だけを末尾から先頭へ描く。
