# Tegaki GUI改修 評価改訂版 — Phase 9b〜9i実装状況の反映

更新日: 2026-08-25
作成: 外部AI（Web版Claude）
位置づけ: `gui-skin-redesign-concretization-proposal.md`（2026-08-20）の内容を、実際の最新スクリーンショット2枚とGitHub最新コード（Phase 9b〜9i、`UI_DESIGN_AUTHORITY_MAP.md`）で答え合わせし、必要な箇所を訂正・更新したもの。旧版は前提が古い部分があるため、本書を優先して参照されたい。

---

## 0. まず結論

**当方が把握していたより、実装は大幅に先へ進んでいました。** 前回時点でゼロだったSemantic Surface Token層は、Phase 8l〜9iで実際に構築・運用されており、しかも単なるCSS変数追加ではなく、`UI_DESIGN_AUTHORITY_MAP.md`という**palette / semantic surface / component static style / runtime geometry / behaviorの所有者を明文化した正本**まで整備されていました。これは前回私が提案した「ヘッダー記載よりも構造的に共有する」という方向性を、さらに一歩進めた形で実現しています。

以下、ご質問へ個別に回答します。

---

## 1. 配色トークンの確認結果

ご提示の6色は`styles/main.css`の`:root`冒頭にそのまま存在することを確認しました。

```css
--futaba-maroon: #800000;
--futaba-light-maroon: #9c3835;
--futaba-medium: #b8706b;
--futaba-light-medium: #d4a8a0;
--futaba-cream: #f0e0d6;
--futaba-background: #ffffee;
```

**ご質問の「他は予備やグラデーション表現として、この6色を基本にしているか」については、確認できた範囲では概ねその通りでした。** 直後にPhase 8l由来のSemantic Surface Token群があり、コメントで明示的に「既存Futaba値のsemantic surface alias」と書かれています。

```css
/* Phase 8l: existing Futaba values exposed as semantic surface aliases. */
--ui-surface-rail: rgba(240, 224, 214, 0.42);
--ui-surface-float: linear-gradient(180deg, rgba(255, 255, 238, 0.78), rgba(240, 224, 214, 0.66)), rgba(255, 255, 238, 0.56);
--ui-surface-control: rgba(255, 255, 238, 0.12);
--ui-surface-control-hover: rgba(255, 255, 238, 0.72);
--ui-surface-control-active: rgba(255, 245, 222, 0.92);
--ui-border-hover: rgba(128, 0, 0, 0.16);
--ui-border-active: rgba(255, 140, 66, 0.9);
```

いずれも`rgba()`で`--futaba-cream`（240,224,214）や`--futaba-background`（255,255,238）、`--futaba-maroon`（128,0,0）のRGB値をそのまま使い、透明度だけを変えて意味用途（rail/float/control/hover/active）ごとに派生させています。新しい独立した色相を追加しているわけではなく、**6色を基準にした濃淡・透過のバリエーション**という理解で正しいです。唯一、`--active-border: #ff8c42`（橙）だけは6色とは別系統の意味色（Motion/実行状態を示すアクセント）として存在しますが、これはこれまでの資料で繰り返し確認してきた「Setup青 / Motion橙」の橙側にあたるもので、無秩序な追加ではありません。

`--ui-*`のうち、この意味的な「Token」と呼べるものは`surface.*` `border.*` `shadow.*` `radius.*` `backdrop.*` `opacity-disabled`の18個程度で、残り約120個は個別component専用の寸法値（`--ui-layer-card-row-height`等）でした。色の一貫性という観点では、前者18個が本題です。

---

## 2. 左サイドバーの再評価

添付いただいたImage 1を見ると、以前の「画面端に密着した帯」から、**上下端が丸く、画面端から少し離れた浮遊カプセル**へ既に変化していました。CSSを確認したところ、これは狙って作られたものでした。

```css
.sidebar {
    left: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--ui-surface-rail);
    border-radius: var(--ui-radius-rail);
    backdrop-filter: var(--ui-backdrop-rail);
    box-shadow: var(--ui-shadow-rail);
}
```

`left: 6px`で画面端から浮かせ、`--ui-radius-rail`（6px）で角を丸め、`backdrop-filter`のblurと`box-shadow`で「浮いている」質感を出しています。ご指摘の「ラウンド処理してもっと近づける」という方向性は、既にこの形で実現済みと言ってよいと思います。

**等間隔か分類間隔かについても、既に答えが出ていました。**

```css
.tool-separator {
    width: 22px;
    height: 8px;
    flex: 0 0 8px;
    background: transparent;
    margin: 0;
}
```

線を引かない、透明な8pxの「間」だけを挿入する`.tool-separator`という要素が既に存在します。前回私が「線を引かずに間隔だけ広げる」形を推奨しましたが、まさにその実装が既にありました。つまり、**等間隔一本槍ではなく、分類ごとに間隔を広げる方式が既に採用されている**ということです。この点はご心配なく、既存方針のままで良いと思います。

さらに、Phase 9hで「resting時はtransparent border、hover/focus/active/disabledで意味のあるsurfaceを出す」という状態設計（Attention Hierarchy）が`styles/components/sidebar-rail.css`へ正本化されていました。これは提案書17番のC3（hitboxとsurfaceの分離）が、既にsidebarについては実装・検証済みであることを意味します。

---

## 3. Layer Panelの配色反転について

Image 1・2を見る限り、Layer/CAF Panelは今のところ従来の淡色系のままで、大きな配色変更はまだ行われていないようです。ご自身で「他Panelはサイドバー文化が決まってからで良い」とされている通り、この判断は妥当だと思います。前回お伝えした「案A（反転）よりも案B（外周だけ濃色にする）の方がリスクに対して効果が高い」という評価は変更ありません。サイドバーの浮遊カプセル化が固まった今のタイミングでLayer Panelへ着手するなら、まずサイドバーと同じ`--ui-surface-*`トークンをそのまま流用して試すのが、最も一貫性を保ちながら低リスクに検証できる方法だと思います。

---

## 4. アニメテーブルのフッター化について

ご指摘の「33%と書いてある行」——Timeline zoom（`-` `100%` `+`）、Asset Library、Clip Motion、Copy/Paste/Group等が並ぶ行——は、コードを確認したところ`anim-table-header-row anim-table-header-row--clip`というクラス名で、**現在も依然として第2ヘッダー行のまま**でした。Phase 9e/9fで触られたのは主に第1行（再生ボタンの中央寄せ、休止中要素のborder透明化）で、この第2行自体をフッターへ移す変更はまだ行われていません。

つまり、**この提案はまだどこにも実装されておらず、そのまま提案として持ち込む価値があります**。前回申し上げた通り、「頻繁に見る情報は上、たまに調整する情報はフッターへ」という切り分けの理屈は妥当で、Phase 9fの「休止中要素の視覚的な重みを下げる」という既存の考え方とも自然に接続できます。フッター化とセットで、この行に含まれる複数のアイコン（Library、Clip Motion、Copy、Paste、Group等）を新しいSVGとして起こすタイミングでもあるので、次の点も合わせてご検討ください。

---

## 5. SVGアイコンの新規作成（Lucide系をCODEXへ依頼する案）について

現状を確認したところ、`ui/ui-icons.js`の登録数は43→47個へ増えていましたが、`animation-table-popup.js`内のinline SVG直書きは依然35箇所のままで、前回発見した集約漏れは未解消でした。Phase 8l〜9iはSemantic Surface Token（色・枠・影）の整備が中心で、アイコン集約はまだ手が回っていない領域のようです。

「Lucideと同じ系統デザインで、足りないアイコンの制作をCODEXへ依頼する」というご提案は良い方向だと思います。Lucideはstroke幅・grid・角の丸め方が統一された体系を持つオープンソースのアイコンセットなので、その作法（24×24 viewBox、2pxのstroke-width、丸端のlinecap等）さえ守れば、CODEXが新規アイコンを描き足しても既存の見た目から浮きません。ちょうど4章のフッター化で新しいアイコン配置を整理するタイミングなので、**新規アイコンをinlineで足すのではなく、最初から`ui-icons.js`へ登録する形で作業する**ことをお勧めします。これなら「新旧スキンの二重実装」を避けたいという以前のご懸念にも合致します。

---

## 6. 全体の優先順位（更新版）

| 項目 | 状態 |
|---|---|
| Semantic Surface Token層の新設 | **完了**（Phase 8l、`--ui-surface/border/shadow/radius/backdrop`） |
| 共有governance文書（ヘッダー記載の代替） | **完了、想定以上**（`UI_DESIGN_AUTHORITY_MAP.md`） |
| Sidebar: 浮遊カプセル化・分類間隔 | **完了**（Phase 9h、`.tool-separator`実装済み） |
| Sidebar/QTP/Animation Table Playback: Attention Hierarchy（休止時border透明化） | **完了**（Phase 9f〜9h） |
| Animation Table中央再生ボタン | **完了**（Phase 9e、通常28×24px / coarse 44×38px） |
| Animation Table第2行のフッター化 | **未着手**。今回の提案として持ち込む価値あり |
| SVGアイコンの`ui-icons.js`集約 | **未着手**（35箇所残存）。フッター化と同時進行を推奨 |
| Layer Panelの配色方針 | **未着手**。サイドバー文化確定後という判断は妥当 |

前回の提案書からの最大の訂正点は、「Design Tokenをこれから作る」という前提そのものが古くなっていたことです。既に土台は完成しており、残っているのは（a）Animation Table第2行のフッター配置、（b）SVGアイコンの集約、（c）Layer Panelへの展開判断、の3点に絞られてきています。
