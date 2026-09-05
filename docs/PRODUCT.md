# Tegakiの製品思想

状態: CURRENT。以下の「継承」はOwner発言、旧TEGAKI、採用済みGateからの抽出。「提案」は新しい判断候補。

## 継承する目的

ブラウザで気軽に描き始め、その絵やパーツをその場で動かせる制作環境を目指す。
主対象はデスクトップ液晶タブレット。Canvasを主役とし、描画の追従性、Undo/Redo、保存復元、出力一致を新機能数より優先する。
一般的なペイントと動画編集の全機能を同時に再現することを完成条件にしない。

「はっちゃん」の潔さをUIの原点とし、絵を描く時間からアニメーションを付ける時間へ、対象と操作の理解を持ち越せることを重視する。
標榜する統合は、通常Layerとアニメデータを一つの保存モデルへ押し込むことではない。

## 描画とアニメーション

- WHAT: Layer Panelで対象・順序・可視性を選ぶ。
- HOW: Transformで移動・回転・拡縮、将来の段階的WARP/構造編集へ進む。
- WHEN: Animation TableでFrame・Key・Timing・再生を扱う。
- DO: Canvasで直接操作する。

この導線純化はOwnerが優先した方向。Transformへ全RIG UIを移す具体的配置まで承認済みとはしない。
現行はBASICのSOURCE/ANIMATE分岐があり、WARP Simple UIとstatic authoring配置は未完成。
「絵を選んでV、Tableを開いて現在FrameへKEY」が分かることを、細かなモード分類を覚えることより優先する。

## 非破壊の意味

現行SOURCE変形はsession中のpreviewを保ち、確定時にRasterへ一度焼き込む。Undo用の元RasterはHistoryが持つ。
ANIMATEでは原画と時間変化を分け、ClipInstanceのKEYを編集する。
永続的な原画像＋effect stackによる完全非破壊SOURCE編集は未採用。現在すでに実現していると説明しない。

Motionは時間変化、WARPは面の変形、Bone/Skinは構造と影響率による変形であり、似た絵が得られても別の責務を持つ。
Physics/Performは将来候補。保存fieldやproposalの存在だけで実用機能と数えない。

## 認知・注目・意志の焦点（継承）

- 外部toolは「水平参照」に使い、採用判断はTegakiの制作頻度、pen操作、既存state正本、Owner文化へ戻して行う。新しい、人気がある、多数が同じ配置という事実だけを設計正本にしない。
- 比較対象は役割別watchlistで管理する。公式資料の確認日と正式version名を残す。支持の多さはOwnerの定性的な優先度であり、未計測の市場占有率として断定しない。
- 注目度は有限の予算。色、面積、位置、動き、余白、反復、現在taskが相互作用する。contrast基準は可読性の下限であって、注目順位の得点ではない。
- 通常selectionと深い編集への進入を暗黙に同一化せず、明示入口、現在mode、breadcrumbまたは同等の復帰路を一組で設計する。
- ふたば☆ちゃんねるpaletteは単なる懐古的skinでなく、Ownerが在籍ユーザーとして持つ文化・識別・安心感の哲学。茶系、cream、橙を基準とし、neutralな黒/白/grayへ安易に置き換えない。
- 不要な枠、動くcontrol幅、過剰な選択ringは注目を消費する。固定幅や静かな休止面を使い、状態表示は単色の点や面でも成立させる。
- 枠レスは目的ではない。誤操作防止、現在地、pen hit、判読性に必要な境界は残す。

比較対象はFresco、Callipeg Studio、Clip Studio Paint Simple Mode、ToonSquid 2、Procreate Dreams 2を重視し、Live2D、Spine、Rive、After Effects/Premiere、Adobe Animateからも操作文法を学ぶ。
この一覧はOwnerの比較希望であり、今回の監査で最新市場動向を再調査した結果ではない。過去の公式URL・確認日は[比較資料](../開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md)に保持する。次の比較時に更新する。

## AI生成との将来接続（既存案から継承）

生成画像/動画、pose、inbetween、参考動画を、明示的なimport/export adapterで制作素材として利用する候補がある。
生成結果は新しいAsset/Laneへ受け、元絵を無言で上書きしない。外部engineのruntimeをProjectへ埋め込まず、未導入/offlineでも通常制作を続けられる境界を守る。
ComfyUI等の具体的製品連携は今回未実装・未監査。同じrepo内の別プロジェクトをTegakiの現行機能へ数えない。

## 新しい提案と未決定

1. 能力別の作業カードを使い、モデル名を仕様の正本にしない。Astra級が全体判断、Terra/Luna級が確定範囲の実装、Ownerが製品思想と重大判断を保持する。
2. 非破壊SOURCEへの将来拡張、static RIG hostの最終配置、内部Layer複製時の時間effect継承は[重大判断点](ROADMAP.md#human-decisions)として残す。
3. 全面rewriteは比較案として保持するが、今回その採用や実行を決めていない。

根拠: 旧TEGAKI、Ownerの本task内発言、Transform-centric追補、[長期研究案](../開発用資料保管庫/proposals/05_長期研究_AI・WebGPU・物理.md)。新しい提案をOwner由来の哲学へ混ぜない。
