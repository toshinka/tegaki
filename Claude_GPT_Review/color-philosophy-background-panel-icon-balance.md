# Tegaki 配色哲学考察 — 背景・Panel・アイコンの明暗バランス

更新日: 2026-08-25
作成: 外部AI（Web版Claude）
前提: Canvasの淡色（`--futaba-cream` `--futaba-background`系）は変更しない固定条件とする。この考察は実装契約ではなく、色彩学・人間工学の観点からの検討材料であり、採否・実装方法はCODEX/Ownerの判断に委ねる。

---

## 1. 核心原理: 図地分離（figure-ground）は色相ではなく明度で決まる

人間の視覚は対象を瞬時に「主役（figure）」と「背景（ground）」へ分離するが、この分離を最も強く駆動するのは色相の違いではなく**輝度（明度）のコントラスト**である。同時対比（simultaneous contrast）の働きにより、隣接する2色の明度が近いと境界がぼやけて知覚され、「これは作品かUIか」を判別する処理コストが増える。

現状のTegakiは、背景・Panel・Canvasがいずれも明るい暖色系（cream〜pale pink）で構成されており、色相は統一されている一方、**明度差がほぼ無い**。「優しい紙の上で描いている」という質感は保てるが、chrome（UI）とcanvas（作品）の境界は視覚的に弱くなりやすいというトレードオフがある。

---

## 2. 競合ツールの実例: 「暗いchrome + 明るいcanvas」がほぼ標準

これは流行ではなく機能的な理由がある。Procreateの公式ハンドブックは次のように明記している。

> Dark Mode is an unobtrusive charcoal interface that keeps the focus on your artwork.

Adobe Acrobatの公式ブログも、Dark Grayテーマ導入の理由を「開いているファイルと明るいグレーのUIとのコントラストに悩んでいるなら」という文脈で説明しており、Adobe製品全般でDark/Lightテーマの切替が標準搭載されている。CLIP STUDIO PAINT Simple Modeも切替時に自動でダークモードへ移行する（前回調査済み）。**2020年代の主要な制作ツールは、ほぼ例外なく「chrome＝暗、canvas＝明」という構成を採る**。これは1章の図地分離原理を最大化する、理にかなった選択と考えられる。

---

## 3. ただし「暗ければ良い」わけではない — 環境光と長時間作業

Procreateは同時にLight Modeも提供しており、公式には「明るい環境で作業する際に適した、コントラストの強い選択肢」と位置付けている。つまり暗UIの優位性は絶対的ではなく、**周辺の環境光**に依存する相対的なものである。屋内デスク環境での長時間制作（Tegakiが想定するPC環境に近い）では、暗めのchromeが有利に働きやすい。

もう一点、人間工学の観点で重要なのが**輝度順応**である。ISO 9241-3（VDT作業の視覚表示要件に関する国際規格）は、標準的なテキストと視覚のために最低3:1のコントラスト比を推奨しており、WCAGの4.5:1という基準もこの数値を踏まえて設定されている。画面内に極端な輝度差（純黒chromeと純白canvasが隣接する等）があると、視線がその境界をまたぐたびに瞳孔が収縮・拡張を繰り返し、長時間作業での疲労要因になり得る。幸いTegakiのcanvasは純白ではなくやや暖色に沈んだcreamであり、この極端な輝度差のリスクは既にある程度緩和されている。**chrome側も真っ黒にせず、締まりすぎない中間階調に留める**のが妥当なバランスと考える。

---

## 4. 中心視と周辺視の違いを設計に活かす

作業中、視線の多くはCanvasかその近傍のPanel（QTPのスライダー、Layer名等）に向く。sidebarのような画面端のUIは、多くの時間**周辺視野**で処理される。周辺視は輝度コントラストに敏感で色相の細部には比較的鈍感、逆に中心視は色相・文字のprecisionに敏感という性質がある。

これは前回ご自身が挙げられた案——**外周だけを濃色にし、Panel自体は淡色のまま残す**——を工学的に裏付ける。画面端（sidebar、外周背景）は周辺視で処理されるため輝度コントラストを強めても違和感になりにくく、視線を向けずに「今どのモードか」を把握しやすい。一方、QTPやLayer Panelのように直接見て操作する場所は、暖色ファミリーのままprecisionを優先する方が理にかなっている。

---

## 5. 現行配色のコントラスト比（概算）

WCAGの相対輝度式で概算した。

| 組み合わせ | コントラスト比（概算） | 判定 |
|---|---|---|
| `--futaba-maroon` (#800000) on `--futaba-cream` (#f0e0d6) | 約8.5:1 | AAA基準（7:1）を超える |
| `--futaba-maroon` on `--futaba-background` (#ffffee) | 約10.8:1 | AAA基準を大きく超える |

現状の文字・アイコンのコントラストは既に十分であり、変更の必要はない。この比率は理論上反転させても同程度になるため、「cream文字 on 濃色背景」も数値上は問題なく成立する。

ただし、`#800000`という高彩度の色をそのまま大面積の背景に使うのは色彩学的に推奨されない。高彩度色は小面積のアクセント（文字・アイコン・状態表示）に使うほど効果的で、大面積に使うと重く見え、同時対比により周囲の色の見え方まで引きずってしまう。**外周を暗くする場合は、`#800000`そのものではなく、そこから彩度を落とし明度を下げた焦げ茶（umber）系の新しい階調を1つ派生させる**のが適切である。既存6色は据え置き、7色目として「chrome用の暗色」を追加する形になる。同一色相内でのトーン展開（monochromatic harmony）であるため、Setup青・Motion橙という既存のアクセント設計とも衝突しない。

---

## 6. 実装の進め方 — 比較が容易な形にする

外周を暗くする変更は、既存のPhase 9c〜9hで確立された方法（Current / Candidate A / Candidate Bを固定fixtureで比較し、Gate判定してから本採用する）にそのまま乗せるのが良いと考える。実際、Phase 9cでは「Gate 1 = GO — B: Warm Canvas-first」という形で、複数のskin候補を比較した上で採用が決まっている。ご指摘の通り「それは設計上なされるはず」であり、今回のような明度反転を伴う変更ほど、事前の比較検証の価値が大きい。

比較の際に含めるべき軸の例:

- 現状（Candidate 0）、外周のみ暗色（Candidate A）、外周暗色+半透明（Candidate B、7章参照）の3パターン
- 1280×720 / 720×720 / narrow幅での見え方
- 明るい絵・暗い絵・高彩度の絵をcanvasに置いた状態
- 30分程度の制作fixtureでの疲労・視線移動（一目の見た目比較だけでなく、実際に使っての比較）

---

## 7. 「狭く感じる」懸念と半透明化について — 理論的には妥当、要実地確認

外周を不透明な濃色で囲むと、視覚的に「壁」として認識されやすく、作業領域が狭く感じられるリスクがある。半透明化でこれを緩和できるという発想は、Apple Human Interface GuidelinesのMaterial概念と同じ理屈で、理論的には妥当である。

> A material imparts translucency and blurring to a background, creating a sense of visual separation between foreground and background layers.

Tegaki自身も既にsidebarで`backdrop-filter: blur(6px)`を使っており、半透明・ぼかしの技術的な下地は既にある。

**ただし、これは「理論的に妥当」と「実際にうまくいく」の間に距離がある領域であり、ご指摘の通り実地確認が必要**だと考える。理由は3つある。

1. **背後の内容によって効果が変わる。** 半透明の濃色は、背後に何があるかによって見え方が変化する。Apple自身の最新Material（Liquid Glass）についての実務的な検証記事では、「複雑な壁紙の上や、glassの厚みが薄すぎる場合には可読性が落ち、コントラスト比がWCAG 2.2 AAを下回ることがある」と指摘されている。Tegakiのcanvasは単色に近い淡色なので条件は比較的良いが、Layer PanelやQTPなど他の明るいPanelが外周の内側に近接する配置だと、透過した濃色が薄まって「暗さ」の効果自体が弱まる可能性がある。
2. **「狭く感じるか」は数値では決まらない、体感の問題である。** これは色のコントラスト計算のような理論値で断定できず、実際に1280×720やnarrow幅で表示して初めて分かる種類の問題である。6章で述べた比較fixtureに、半透明の透過率を数段階（例: 効果が弱い/中間/強い）用意して並べるのが最も確実な確認方法になる。
3. **パフォーマンスコストが伴う。** 同記事は「高性能なApple siliconでないと60fpsを維持できず、旧世代機種ではフォールバック表示になる」ことにも触れている。Tegakiは既にsidebarという小面積でのみ`backdrop-filter`を使っているが、外周全体のような大面積へ拡張すると、ぼかし処理のコストが増える可能性がある。想定環境（RTX4070級PC）なら大きな問題にはなりにくいと思われるが、確認する価値はある。

以上を踏まえると、**「半透明化でカバーできる」という見立ては方向性として正しいが、透過率とぼかし量は理論から一発で決め打ちせず、6章の比較fixtureの中に組み込んで実地で追い込む**、という進め方をお勧めする。

---

## 8. まとめ

| 領域 | 推奨明度 | 理由 |
|---|---|---|
| Canvas | 現状の淡色を維持 | 固定前提。主役として最も明るいまま |
| QTP / Layer Panel / Animation Table | 現状の暖色系を維持 | 中心視で処理される場所はprecisionと一貫性を優先 |
| Sidebar / 外周背景 | maroon系から派生させた暗い焦げ茶を検討 | 周辺視での図地分離を強化し、canvas+Panelを「浮いた作業島」として際立たせる |
| 半透明化 | 方向性は妥当、透過率は比較fixtureで実地決定 | 背後内容依存・体感依存・性能コストの3点が理論だけでは確定できないため |

---

## 9. 参考資料

- Procreate Handbook — Interface（Dark/Light Modeの位置付け）
  https://help.procreate.com/procreate/handbook/interface-gestures/interface
- Adobe Fresco — Get started with the user interface（Appearance/テーマ切替）
  https://helpx.adobe.com/fresco/desktop/introduction/getting-started-with-user-interface.html
- Adobe Blog — Hidden Gems in Acrobat DC（Dark Grayテーマ導入の理由）
  https://blog.adobe.com/en/publish/2016/05/12/hidden-gems-in-acrobat-dc-fine-tune-your-user-experience
- Adobe Creative Cloud — Switch between light and dark mode
  https://helpx.adobe.com/creative-cloud/help/dark-mode-creative-cloud-desktop-app.html
- W3C WCAG 2.2 — Understanding Success Criterion 1.4.3: Contrast (Minimum)
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C WCAG 2.2 — Understanding Success Criterion 1.4.6: Contrast (Enhanced)
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html
- Apple Human Interface Guidelines — Materials（translucency / blurの定義）
  https://developers.apple.com/design/human-interface-guidelines/foundations/materials/
- Liquid Glass — Smart or Bad for Accessibility（半透明Materialの可読性・性能上の実務的注意点）
  https://designedforhumans.tech/blog/liquid-glass-smart-or-bad-for-accessibility

---

## 10. 未検証・対象外

- 実際のBrowser上での輝度・コントラストの見え方は確認していない。5章の数値はWCAG相対輝度式による概算であり、実測値ではない。
- 半透明化の具体的な透過率・ぼかし量の最適値は、本書では決めていない。7章で述べた比較fixtureでの実地検証が必要。
- 色覚特性（色弱・色盲）を持つユーザーへの見え方は、明度ベースの設計方針である以上大きな問題は生じにくいと考えられるが、個別の検証は行っていない。
