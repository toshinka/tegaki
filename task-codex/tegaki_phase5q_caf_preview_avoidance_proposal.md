# Tegaki Phase 5q CAF live stroke — 根本回避方針 提案書

前提: 前回の外部診断報告書（`tegaki_phase5q_caf_preview_external_report.md`）に基づく修正が実装済みの状態（`PROGRESS.md` 2026-07-03時点、GitHub上の現行コードで差分確認済み）でも、当たり外れ、または点滅が残っているという前提で書く。
今回もGitHub上の現行コード（`animation-table-popup.js` / `brush-core.js` / `layer-system.js`）を再取得し、実装済み内容を確認したうえで診断・提案する。

---

## 0. 前回修正の反映確認（事実）

GitHub上の現行コードと前回取得時点の差分を確認したところ、前回報告書で提案した内容にほぼ一致する修正が入っていた。

- `_handleBeforeStrokeStart()` から、overlay構築を伴う `_keepDrawingPreviewWorkingLayerVisible(...)` の呼び出しが削除されている（前回提案の修正Aに相当）。
- overlay再構築キーにRenderTexture識別ID（`_getLiveStrokeTextureId()`）が加わり、RT差し替えを検知できるようになっている。
- テクスチャ変化を検出した場合に `_requestLiveStrokeOverlayRender()` という**新規の**rAFベース即時再描画が追加されている（前回提案の修正Bに相当する意図と読める）。
- `penOpacityStrokePreview` / `airbrushStrokePreview` などの一時的な子要素もoverlay側で複製・同期する処理が追加されている。

つまり、**前回報告書が指摘したタイミング問題への対処はほぼすべて実装された**。それでも症状が残る、あるいは点滅という別の症状に転じたという事実は、問題が「JSの参照タイミングを直せば解決する」レベルではなく、**もう一段深い構造的な要因**である可能性を強く示している。

---

## 1. 症状が残った理由の再診断

### 1-1. overlay Sprite方式そのものが持つ構造的な脆弱性（推測、ただし根拠あり）

現行のoverlay方式は、常に「稼働中の（BrushCoreがまさに書き込み中の）`RenderTexture` を、**もう1つ別のSprite**（`animation_live_stroke_overlay_sprite`）から同時に読む」という構造を取っている。これは、通常Layerの描画（＝自分自身の`layerSprite`が自分の`renderTexture`を表示するだけ）には存在しない、**「同じRenderTextureを2つのSpriteが違うタイミングで読みに来る」余分な依存**である。

このため、
- 同期を厳密にする（テクスチャ変化を検知したら即時再描画）→ **点滅**（BrushCore側の`_requestLiveCanvasRender()`とAnimationTablePopup側の`_requestLiveStrokeOverlayRender()`が、同一フレーム内で独立に`app.render()`を呼び合う二重描画になりやすい。下記1-2で詳述）
- 同期を緩める（rAF一本のコアレシングに任せる）→ **当たり外れ**（GPU側のテクスチャ更新反映タイミングに依存する）

という**トレードオフの板挟み**になっている可能性が高い。これは「JS参照は正しいが、実際にPixiJSがGPU上でいつそれを反映するかは保証されていない」という前回報告書の疑問7の指摘が、今回さらに実証された形と考える。

### 1-2. 新たに追加された二重render要求（事実として発見、これは今回新たに見つけた具体的な副次原因）

現行コードには、`app.render()` を呼ぶ経路が**2つ独立に存在する**。

- `brush-core.js` の `_requestLiveCanvasRender()`（ペン/消しゴム等のRenderTexture焼き込み後に呼ばれる、既存の経路）
- `animation-table-popup.js` の新規`_requestLiveStrokeOverlayRender()`（overlay Spriteのtexture変化を検知した時に呼ばれる、今回追加された経路）

両方とも独立に`requestAnimationFrame`でコアレシングされ、どちらも最終的に同じ`app.render()` / `app.stage`を対象にレンダリングする。**同一の描画フレーム内でこの2つが両方トリガーされた場合、`app.render()`が1フレームに2回呼ばれる**ことになる。PixiJSの`Ticker`/`app.render()`は本来「1フレームに1回」呼ばれる前提で内部の時間計測（delta time等）を持っているため、想定外の頻度で呼ばれることで、フレームによって描画結果や合成順の見え方が微妙にブレる可能性がある。これは点滅の**具体的で検証可能な**候補であり、まず最初に潰すべき副次原因として提案4-1に記載する。

---

## 2. ユーザー提案（「Table非アクティブ＋Lane onionゴースト」方式）の技術的検証

### 結論: 可能。というより、**この方式は既にコード上に実装されて動いている**（Table を閉じた時の `laneReferenceMode: 'lane-onion'`）。ユーザーが「当たり外れが無い」と感じているのはこのモードであり、それには明確な構造的理由がある。

コードを確認した結果、以下が判明した。

1. **他CAFのゴースト表示（Lane onion）は、稼働中のRenderTextureを一切参照しない。**
   `_renderLaneReferenceFrame()` → `_renderCelPreview()` → `_renderClipAssetInternalLayerPreview()` の経路は、`this.model.getDrawingSnapshot(...)` で取得したピクセルスナップショットを `canvas` 経由で `Texture.from(canvas)` に変換した**静的テクスチャ**を使っている（`_getTextureFromSnapshot()`）。これはBrushCoreが今まさに書き込んでいるRenderTextureとは完全に無関係な、独立したテクスチャである。

2. **アクティブに描画中のCAF working Layerは、複製Spriteを使わず、通常LayerSystemの一部としてそのまま表示される。**
   `_hideTimelineLayersForPreview()` は `preserveWorkingLayerIds` に含まれるworking Layerを**隠さない**（`layer.visible`をそのまま維持する）。つまりTableを閉じている間は、選択中のCAF working Layerは通常Layerと全く同じ扱いで表示されている。通常Layerの描画で当たり外れが報告されていない以上、これは理屈上も安定する。

3. **`laneReferenceMode` は現在、Tableが開いている間（`isVisible === true`）は無効化される作りになっている。**
   `_updateLaneReferencePreview()` の先頭で `if (this.isVisible || this.isPlaying || ...) { ...; return; }` としており、Table開状態では常にこの安定した経路を使わず、overlay方式のPREVIEW経路に切り替わる。**ここが今回の提案の変更点になる。**

### なぜoverlay方式が「必要」だったのか（重要な補足）

Table開＋PREVIEW中は、他CAFのゴースト（`animationPreviewContainer`、front）は `currentFrameContainer`（＝通常LayerSystemの全Layerが入っている本体コンテナ）の**後に**描画される、つまり他CAFゴーストは通常Layerの内容を覆う位置にある。そのため、選択中working Layerを`preserveWorkingLayerIds`でただ表示したままにしても、他CAFのゴーストがその上に重なって描かれてしまい、ライブ中のストロークが隠れてしまう場合がある。**overlay方式は、この重なり順の問題を解決するために作られたもの**であり、単なる過剰実装ではない。

この点を踏まえ、提案1では「重なり順は多少妥協する」ことを明示的なトレードオフとして提示する。

---

## 3. 提案1（最優先・最小変更）: Stroke中はPREVIEWの合成契約を一時的に手放し、Table閉時と同じ「lane-onion」経路を使う

### 方針

`isDrawingPreviewSuspended === true` になっている間（＝ストローク中）は、現在の「overlay Sprite方式」を使わず、以下に切り替える。

1. 選択中CAFのworking Layerは、**overlayを作らず**、`preserveWorkingLayerIds` によりそのまま（通常Layerと同じ扱いで）表示する。
2. 他CAFは、現在の `animationPreviewContainer`（snapshotベースのゴースト合成）をそのまま使う。**これは既にsnapshotベースで安定しているため変更不要。**
3. 重なり順の問題（上記2章末尾）に対しては、ストローク中に限り、選択中working LayerのちCAFの合成上での「あるべき位置」を、既存の `animationPreviewLiveStrokeContainer` を流用して**そこにだけ薄い枠（あるいは何も置かない）を維持しつつ、実際のピクセルは複製せず、`z-index`（Pixi Containerの重なり順）だけを一時的に調整する**方法を検討する。具体的には、Sprite複製ではなく、選択中working Layerの`renderable`を利用したPixiJSの`sortableChildren`/`zIndex`機構、または`currentFrameContainer`内での**一時的な子要素の並べ替え**（`setChildIndex`。`currentFrameContainer`の外へは出さない）で対応できないかを検証する。これは提案2（物理再配置）よりもずっと軽量で、`LayerSystem.getLayers()`が`currentFrameContainer.children`をそのまま返す実装（後述4章参照）とも衝突しない。

### 期待される効果

- overlay Sprite自体が消えるため、「稼働中のRenderTextureを2つのSpriteが読む」という構造的な脆弱性そのものがなくなる。当たり外れの根本原因（1-1節）を**回避**できる。
- 副次原因（1-2節の二重render要求）も、overlay側の`_requestLiveStrokeOverlayRender()`が不要になることで自然に解消する。

### トレードオフ（明示）

- 選択中Laneが最上位でない場合、ストローク中に限り、他Laneのゴーストとの重なり順が完全ではない可能性がある（`currentFrameContainer`内での並べ替えで軽減を試みるが、100%の保証はない）。
- これは、ユーザー自身が「当たり外れが無い」と評価しているTable閉＋lane-onionモードが**既に同じ前提で動いている**ため、実用上は許容範囲と考える。ストローク中だけの一時的な近似であり、ストローク終了後は通常のPREVIEW合成（正しい重なり順）に戻る。

---

## 4. 提案2（より根本的だが高リスク・現時点では非推奨）: 選択中working Layerの物理的な再配置

「overlayで複製せず、本物のLayerをPREVIEW合成の正しい位置に一時的に移動させてしまえばよい」という発想も検討したが、コード上に重大な制約が見つかった。

`LayerSystem.getLayers()` は次のように実装されている。

```js
getLayers() {
    return this.currentFrameContainer ? this.currentFrameContainer.children : [];
}
```

つまり **LayerSystemの「レイヤー一覧」は、独立した配列ではなく `currentFrameContainer` というPixiJS Containerの `children` そのもの**である。`getActiveLayer()`もこの配列へのindexアクセスに依存している。

これは、選択中working LayerのContainerを`currentFrameContainer`の外（例えば`animationPreviewContainer`側）へ一時的に`addChild`で移動させると、その瞬間に**そのLayerが`getLayers()`の結果から消える**ことを意味する。Layer Panel同期、`_forceAnimationWorkingLayerVisible()`、`refreshClippingMasks()`、Undo/Redoの層参照など、多数の箇所が`getLayers()`の結果に依存しているため、この方式は見た目以上に影響範囲が広く、**現時点では推奨しない**。

将来的にどうしても重なり順を完全に正しくしたい場合は、`getLayers()`自体を「`currentFrameContainer.children`に、一時的に退避中のLayerを正しい位置へ挿入し直した配列」を返すよう改修する必要があり、これは今回の「局所パッチ」の範囲を超える中規模改修になる。**提案1で重なり順の近似が実用上問題になった場合にのみ、次の入口として検討する**位置づけとしたい。

---

## 5. 提案3（代替・提案1と併用可能）: overlayを「稼働中RenderTextureの直接参照」から「静的snapshot＋ベクター先行描画」へ変更

提案1とは別の角度から、overlay方式自体を維持しつつ根本原因（1-1節）を潰す方法。

### 方針

- overlay Spriteに、稼働中の`layerData.renderTexture`を直接参照させるのをやめる。
- 代わりに、**ストローク開始直前の状態を1枚のsnapshotテクスチャとして固定**し（Table閉時のゴーストと同じ`_getTextureFromSnapshot()`の仕組みを流用できる）、その上に**現在ストローク中の点列（`strokeRecorder.getCurrentPoints()`）をベクターGraphicsとしてoverlay側で直接描く**。これはBrushCoreが非penツール向けに既に持っている`previewGraphics`と同じ発想で、稼働中のRenderTextureを一切読まない。
- ストローク完了時にoverlayを破棄し、通常のsnapshotベースの合成（本物の焼き込み結果を含む）へ戻す。

### 利点

- 稼働中RenderTextureへの依存が完全になくなるため、GPU側の反映タイミングに起因する当たり外れが構造的に発生しなくなる。
- 重なり順の問題も、既存のoverlay Container配置（`animationPreviewLiveStrokeContainer`）をそのまま使えるため、提案1のような妥協が不要。

### コスト・リスク

- ストロークの見た目を、BrushCore本体の`strokeRenderer`（`renderPenSegment`/`renderPreview`）とAnimationTablePopup側の両方で描くことになり、ペン設定（筆圧、合成モード、透明度分離処理など）をoverlay側にも正しく引き渡す実装コストが増える。
- ベクター先行描画と、最終的にRenderTextureへ焼き込まれた結果とで、アンチエイリアスや合成順に僅かな見た目の差が出る可能性がある（多くの描画ツールで実用上許容されている差ではあるが、要確認）。

---

## 6. 追加で見つかった具体的な副次原因への対処（提案1・3どちらとも独立に、まず実施すべき）

1-2節で述べた「`app.render()`を呼ぶ経路が独立に2つ存在する」問題は、どの方向へ進むとしても先に解消しておくべきである。

- `_requestLiveStrokeOverlayRender()` を独立の`requestAnimationFrame`として持たず、BrushCore側の`_requestLiveCanvasRender()`と同じスケジューラ（同じ「次のペイントを1回だけ要求する」窓口）に統合する。具体的には、AnimationTablePopupがBrushCoreのインスタンスへ「再描画してほしい」というリクエストを渡す単一の関数（あるいは共有の`pendingLivePaint`フラグ）を経由させ、実際の`requestAnimationFrame`予約と`app.render()`呼び出しは1箇所だけに集約する。
- これにより、1フレームに`app.render()`が2回呼ばれる状況そのものをなくす。提案1・提案3のいずれを採用するかに関わらず、まず最初にこの一本化だけを単独でコミットし、点滅が軽減するかを実機確認することを推奨する（低リスク・低コストで、仮説の検証にもなる）。

---

## 7. 比較表

| 案 | 当たり外れ根絶度 | 点滅への効果 | 実装コスト | リスク | 既存制約との整合性 |
|---|---|---|---|---|---|
| 6章: render要求の一本化のみ | 効果なし（副次原因のみ解消） | 高い（二重render自体を排除） | 低 | 低 | 問題なし |
| 提案1: stroke中はlane-onion経路へ切替 | 高い（RT二重参照を構造的に排除） | 高い | 中（重なり順の近似ロジックが必要） | 中（Lane順の一時的な近似） | 既存のdisplay-only境界を維持、save/export/Undo等に触れない |
| 提案2: 物理再配置 | 理論上は最も高い | 高い | 高 | 高（`getLayers()`の前提を壊すリスク） | 現時点では非推奨 |
| 提案3: ベクター先行描画overlay | 高い（RT依存を排除） | 高い | 中〜高（BrushCoreの描画ロジックとの二重実装） | 中（見た目の僅かな差、実装量） | 既存のdisplay-only境界を維持 |

---

## 8. 推奨の進め方（段階的）

1. **まず6章（render要求の一本化）だけを単独でコミットし、実機で点滅の変化を確認する。** これは他のどの方向に進むにしても無駄にならない、低リスクな一手。
2. **次に提案1（stroke中はlane-onion経路へ切替）を試験導入する。** ユーザー自身が「当たり外れが無い」と確認済みの経路を再利用する設計であり、実現可能性が最も高い。重なり順の近似が実用上気になるかどうかを、複数Lane・複数CAFの実際のプロジェクトで確認する。
3. 重なり順の近似が実用上問題になる場合に限り、**提案3（ベクター先行描画）**を検討する。BrushCoreの描画パラメータをoverlay側に渡す設計が必要になるため、提案1より実装コストは高い。
4. **提案2（物理再配置）は、上記いずれでも解決しない場合の最終手段として保留**する。`getLayers()`の実装契約を変更する中規模改修が前提になるため、単独のPhaseとして計画すべき。

---

## 9. Codexへ渡す実装指示文（Step1: render一本化 + 提案1）

```
Tegaki Phase 5q: CAF live stroke 根本回避パッチ（display-only領域限定）

前提:
- 対象は animation-table-popup.js / brush-core.js のみ。layer-system.js の
  getLayers()の実装契約（currentFrameContainer.childrenを直接返す）は変更しない。
- WebGPU / SDF・MSDF / WebGL2 Mesh化 / DPR2倍化 / tiled canvas / ClipInstance transform/keyframe /
  Lane完全独立化 / animation working Layer廃止 / 通常LayerSystemとTimelineModelの統合は禁止。
- save / export / Undo・Redo履歴 / ClipAsset・DrawingSnapshot正本には一切触れないこと。

Step A（render要求の一本化。まずこれだけを単独でコミットする）:
1. animation-table-popup.js の _requestLiveStrokeOverlayRender() を削除し、
   代わりにBrushCoreインスタンスが公開する既存の再描画要求関数
  （brush-core.js の _requestLiveCanvasRender() 相当）を呼び出すようにする。
   BrushCore側に外部から呼べる薄いpublicメソッド（例: requestLivePaint(reason)）が
   無ければ追加する。内部のrequestAnimationFrame予約・app.render()呼び出しは
   1箇所（BrushCore側）に統一し、AnimationTablePopup側は「変化があった」ことを
   伝えるだけにする。
2. 変更後、ペン入力時のconsole上で app.render() が1フレームに2回以上呼ばれていないか
  （TEGAKI_CONFIG.debug時のログで）確認する。

Step B（提案1: stroke中はlane-onion相当の経路へ切替）:
1. isDrawingPreviewSuspended === true の間、_syncDrawingLiveStrokeOverlay() による
   overlay Sprite生成・同期を行わない。代わりに、_hideTimelineLayersForPreview() の
   preserveWorkingLayerIds に選択中working LayerのIDを含めたまま、そのLayerを
   一切隠さず・複製もしない。
2. 他CAFのゴースト合成（animationPreviewContainer / Back）は既存の
   snapshotベースの経路（_renderClipAssetInternalLayerPreview等）をそのまま使う。
   選択中CAFはこれまで通り合成対象から除外する（excludeClipIds）。
3. 重なり順対策として、isDrawingPreviewSuspended === true の間だけ、選択中working Layerの
   currentFrameContainer内でのchildIndexを、そのLaneが本来あるべき重なり順に近い位置へ
   一時的に setChildIndex() で調整する（currentFrameContainerの外には出さない。
   getLayers()の返り値の集合は変えず、順序のみ一時変更する）。
   stroke完了 / cancel時に元のindexへ戻す。
4. animationPreviewLiveStrokeContainer / _liveStrokeOverlaySprites関連のコードは、
   Step B実装後に到達不能になった部分を確認のうえ削除する（未使用コードを残さない）。

受け入れ条件:
- 複数CAF/Laneを切り替えながら連続でペンストロークした際、当たり外れ・点滅のいずれも
  発生しないこと（少なくとも従来より明確に改善すること）。
- 選択中Laneが最上位でない場合の重なり順のズレが、ストローク中のみの一時的な現象に
  留まり、ストローク完了後は正しい重なり順の通常PREVIEWへ戻ること。
- 通常Layerでの描画、save/export、Undo/Redoの挙動に変化がないこと。
```

---

## ユーザー提案への直接回答

> アニメテーブルを非表示な状態で、Laneオニオン…同Timeline上のアクティブ以外のCAFをゴーストで表示しながらの描画では当たり外れが無い。これを組み合わせるみたいなアイデアは可能か？

可能。というより、これは既にコードベースの中に実装され、実際に安定動作していることが確認できた既存の経路（Table閉時の`laneReferenceMode: 'lane-onion'`）そのものであり、**「新しい仕組みを作る」のではなく「Table開状態でも同じ経路を使うよう条件を広げる」提案**として実現できる（本書 3章「提案1」）。唯一のトレードオフは、選択中Laneが最上位でない場合の一時的な重なり順の近似だが、これはユーザー自身が既に「実用上問題ない」と評価している状態と同じ前提であるため、現実的な妥協点と考える。
