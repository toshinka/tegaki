# Rig / Mesh Setup UI — 外部AIレビュー報告（CODEX引き継ぎ用）

更新日: 2026-08-11
レビュー担当: 外部AI（Web版Claude）
対象範囲: `tegaki_work/ui/animation-table-popup.js` の RIG Setup panel（`anim-rig-context` 配下）、`tegaki_work/styles/main.css` の関連定義
参照文書: `AGENTS.md` / `TEGAKI.md` / `tegaki_work/PROGRESS.md` / `task-codex/phase7i.md` / `UI_CSSスタイルガイド.md` / `15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
確認方法: GitHub `main` branch raw fileを取得して読解。ローカル実行・Browser確認は行っていない（未検証の範囲は末尾に明記）。

> 本書は提案であり実装契約ではない。`AGENTS.md` 8章の通り、採否は実コード照合の上でCODEX側が判断してください。

---

## 1. 総評

- 色設計は概ね`TEGAKI.md` 8章のパレット規約に従っており、黒/白/neutral grayの直書きは今回読んだ範囲では見つからなかった。RIGタブのactive色（`--deformer-bind-line` / `--deformer-bind-point`の青）とMOTIONタブのactive色（`--active-border`の橙）も、ロードマップ14章「SetupとAnimateは色だけでなくlabel、icon、状態文で区別する」の方針通り実装されている。
- 一方で、**RIG Setup panel内の個別アクション（＋BONE / AUTO GRID / AUTO SHAPE）は「Setup」の意味を持つ青ではなく、通常buttonと同じ栗茶配色**になっている。RIGタブ自体は青だが、その中にある生成buttonが他の一般buttonと視覚的に同格に見える。
- 最大の懸念点は、Phase 7i Stage Dで`AUTO LINE`が同じ行へ追加される契約になっていること（`task-codex/phase7i.md` 7章）に対し、**現状の`.anim-rig-mesh-bone-controls`行がBONE select・＋BONE・AUTO GRID・AUTO SHAPE・statusで既に密集しており、AUTO LINE追加後はflex-wrapで行が折り返され、8pxフォントの中でボタンが埋没する**リスクが高いこと。
- コード面では、`_syncRigSetupContext()`が**pointer drag中を含む高頻度パスから呼ばれ、そのたびに12箇所以上の`querySelector`と2つの`<select>`option再構築を行っている**。値が変化していない場合でも毎回DOMを再構築しており、Stage DでLINE分岐が増えるとこの関数はさらに複雑化する。
- メッセージ組み立て（エラー理由・ステータス文言）がネストした三項演算子で書かれており、`auto-shape-line`追加時に可読性・保守性が悪化しやすい。

---

## 2. テーブル内レイアウトの所見

### 2.1 Rig Mesh Bone Controls行の密集（Stage D前に要対応）

対象: `tegaki_work/ui/animation-table-popup.js` 15681-15696行付近（HTML）、`tegaki_work/styles/main.css` 4275-4330行付近（CSS）

現状のマークアップ（要約）:

```html
<div class="anim-rig-mesh-bone-controls" data-rig-mesh-bone-controls hidden>
    <label>BONE<select data-rig-mesh-bone-select></select></label>
    <button data-rig-mesh-bone-add>＋ BONE</button>
    <button data-rig-mesh-generate>AUTO GRID</button>
    <button data-rig-mesh-generate-shape>AUTO SHAPE</button>
    <span data-rig-mesh-status>MESH未生成</span>
</div>
```

- `display: inline-flex; flex-wrap: wrap; gap: 4px;`で、幅が足りない場合は折り返す設計（`main.css` 4275行）。
- panel自体の幅は`min-width: min(560px, calc(100vw - 32px))`（`main.css` 4213行）で、液タブの想定解像度なら560px程度は確保できるが、BONE select（96–152px）＋4ボタン＋statusバッジを1行に収めるには既にタイト。
- Phase 7i Stage Dの契約（`phase7i.md` 7章）は「同じcontrols内へ明示`AUTO LINE`を追加する。LINEを単独tabやWARP modeにしない」であるため、**ボタンをタブ分割する解決はそもそも許可されていない**。行を増やさずに済む改善だけが選択肢になる。

**提案（実装はCODEX判断）:**

1. 生成系ボタン（AUTO GRID / AUTO SHAPE / 追加予定のAUTO LINE）を`<div class="anim-rig-generate-group">`のような専用サブグループへまとめ、BONE select＋＋BONEの行と視覚的に分離する（DOM構造は1行のままでも、CSSの`flex-basis: 100%`等で2段目に固定折り返しさせれば、狭幅時の折り返し順序が毎回同じになり予測可能になる）。
2. `AUTO GRID` / `AUTO SHAPE` / `AUTO LINE`のように排他選択に近いボタン群は、Live2D/ToonSquidのような「生成モードdropdown + 単一の実行ボタン」に寄せると、Stage D以降にモードが増えても行の専有幅が増えない。ただし`phase7i.md`は「明示`AUTO LINE`を追加する」としか定めておらず、UI具体形は指示していないため、この変更は**Stage D着手前にOwner/SOLと合意してから**行うのが安全（`AGENTS.md` 3章「100行超の一括削除、主要classの再構成、DOM構造の大幅置換は…事前に相談する」に該当しうる）。
3. 最小変更で済ませるなら、`meshStatus`バッジ（`data-rig-mesh-status`）を行の右端固定ではなく`flex-basis: 100%`にして常に2段目へ送り、ボタン列だけを1段目に確保する。現状は幅次第でstatusバッジがボタンの間に挟まって折り返し位置が動くため、見た目の安定性が低い。

### 2.2 RIG folder tree行が8pxフォント固定

対象: `main.css` 4815-4821行（`.anim-rig-folder-track-item`）

- `padding-left: calc(10px + var(--rig-tree-depth, 0) * 6px)`、`font-size: 8px`。階層が深くなるほど文字が読みにくくなる。
- 現状のTegaki全体が8-11pxの密なUIを許容する方針（`TEGAKI.md`「キャラクターを主役にした簡潔なUI」）とは整合するが、**Rig Setupは複数Bone/Folderを識別しながら親子関係を組む作業**であり、他のリスト（Layer Panelのcard等）より識別コストが高い。フォントサイズはそのままでも、`is-selected`時のみ`font-weight`を強めるなど、識別性を上げる差分は小さな変更で可能。

---

## 3. 色使いの所見

### 3.1 概ね規約準拠

- `--futaba-maroon` / `--futaba-cream` / `--active-border`をRIG Setup全体で一貫使用しており、黒白灰の直書きは確認できなかった。
- RIGタブのactive色に`--deformer-bind-line` / `--deformer-bind-point`（青）を転用しているのは、UI/CSSガイド11章「青系はCanvas上の基準範囲編集中に限定し…」という注記と少し役割が重なるが、`AGENTS.md`は「Setupの青…は役割が明確な場合だけ、既存semantic変数または共通変数を追加して使う」としており、RIGタブ自体がSetup工程を表す以上、意味の重複というより**転用として妥当**と考えられる。ここは問題視していない。

### 3.2 生成ボタン（AUTO GRID / AUTO SHAPE）が「Setup」を示す配色を持たない

対象: `main.css` 4342-4356行（`.anim-rig-key-btn`）

```css
.anim-rig-target-switch button,
.anim-rig-setup-btn,
.anim-rig-key-btn,
.anim-rig-ik-btn {
    color: var(--futaba-maroon);
    background: color-mix(in srgb, var(--futaba-cream) 76%, transparent);
    ...
}
```

- `AUTO GRID` / `AUTO SHAPE`ボタンは`.anim-rig-key-btn`を継承しており、通常の「＋BONE」ボタンや「IK追従」ボタンと見た目が同じ。activeになった場合のみ橙（`--active-border`）に切り替わる。
- Live2D/ToonSquidのようなツールでは「Mesh生成」という不可逆・重い操作（既存Meshを上書きする操作）を視覚的に別扱いすることが多い。現状はテキストラベルの違いだけで判別させている。
- `.anim-rig-mesh-status.is-current`は青ではなく橙寄りの`--active-border`配色（`main.css` 4318-4323行）を使っており、RIGタブの青とは連動していない。Setup工程全体を青で軽く縁取る、または生成ボタンにだけ`--deformer-bind-line`の薄い枠を足す等、**「今から不可逆な生成を行う」ことを示す差分**を検討する価値はある。ただしUI/CSSガイド11章は青系を「Canvas上の基準範囲編集中に限定」としているため、**このボタンへ青を使う場合は先にUI/CSSスタイルガイドの想定を広げてよいかOwner合意が必要**。無断で新しいsemantic変数を追加しないこと（`TEGAKI.md` 8章）。

---

## 4. リギング・メッシュへの導線の所見

### 4.1 Stage D（AUTO LINE追加）に向けた導線の整合性

- `phase7i.md`のStage D契約により、`AUTO LINE`は`AUTO GRID` / `AUTO SHAPE`と同じ行・同じボタン粒度で追加される。現状のステータス文言生成（`animation-table-popup.js` 2831-2838行付近）は次のような三項演算子の入れ子になっている。

```js
if (meshGenerate) {
    meshGenerate.disabled = meshGenerateDisabled;
    meshGenerate.textContent = generatorType === ALPHA_FIT_GRID_GENERATOR
        ? 'GRID再生成'
        : 'AUTO GRID';
}
if (meshGenerateShape) {
    meshGenerateShape.disabled = meshGenerateDisabled;
    meshGenerateShape.textContent = generatorType === AUTO_SHAPE_FILL_GENERATOR
        ? 'SHAPE再生成'
        : 'AUTO SHAPE';
}
if (meshStatus) {
    meshStatus.textContent = rasterMeshStatus.state === 'stale'
        ? `${generatorType === AUTO_SHAPE_FILL_GENERATOR ? 'SHAPE' : 'GRID'} STALE`
        : rasterMeshStatus.state === 'current'
            ? generatorType === AUTO_SHAPE_FILL_GENERATOR
                ? 'SHAPE FILL'
                : `GRID ${generator?.columns || '?'}×${generator?.rows || '?'}`
            : rasterMeshStatus.state === 'manual'
                ? 'MANUAL MESH'
                : 'MESH未生成';
}
```

  同様に`_generateSelectedRasterBoneSetup()`側のエラーメッセージ組み立て（同ファイル2497-2503行）も`isAutoShape`の2択前提でネストしている。**LINEが3値目として増えると、この形のまま拡張すると条件分岐がさらに深くなり、可読性・レビュー容易性が下がる。**

  **提案:** `generatorType`をキーにしたメッセージ/ラベル辞書（`GENERATOR_LABELS = { [ALPHA_FIT_GRID_GENERATOR]: {...}, [AUTO_SHAPE_FILL_GENERATOR]: {...}, [AUTO_SHAPE_LINE_RIBBON_GENERATOR]: {...} }`）へ寄せておくと、Stage Dで`auto-shape-line`のエントリを1つ追加するだけで済み、`phase7i.md`が禁止する「pure閾値の調整」等には触れずに済む純粋なUI層のリファクタリングになる。Stage D着手前の下準備として提案する（着手そのものはLUNA/MAX判断）。

### 4.2 BONE select / 親Bone selectのラベル衝突

対象: `animation-table-popup.js` 2846-2870行付近（`meshBoneSelect`の再構築）、2870-2894行付近（`parentSelect`の再構築）

- `meshBoneSelect`のoption labelは`bone.name || 'MESH BONE ${index + 1}'`、`parentSelect`のoption labelは`owner?.layer?.name || candidate.name || 'BONE'`。命名が空の場合のfallback文言が2つのselectで異なる（`MESH BONE 1`系 vs `BONE`固定）。
- 同名Folderが複数存在する場合（例: 「腕」を左右で複製した場合）、`parentSelect`は`owner?.layer?.name`のみを表示するため、**どちらの「腕」かをselect上で区別できない**。BONE select側も同様に、`bone.name`が未設定なら連番のみで区別する形になり、複数箇所でAUTO GRID/AUTO SHAPEを使うほど選択ミスの温床になりやすい。
- **提案:** 少なくとも`parentSelect`のoption labelに、`owner`のFolder階層パス（例: 「体 > 右腕」）か、`boneId`の短縮表示を併記できないか検討する。実装コストが低い代替として、同名候補が複数ある場合だけ末尾に`(#2)`のような連番を足す方法もある。

### 4.3 CAF ⇄ Folder切り替えの導線自体は良好

- `anim-rig-caf-setup` / `anim-rig-folder-setup-context`の`hidden`切り替えでCAF全体PIVOTとFolder Bind Setupを分離しており、ロードマップ14章の「CAF共通PIVOT、Folder / BONEのBind SetupはRIG…へ分離する」という方針に沿っている。Canvas上のPIVOT直接dragと、popup内数値入力（`data-rig-bind-param`）が同じ値を双方向同期する設計もLive2D的な「Canvas操作 + 数値微調整」の型に合っている。ここは変更不要と判断した。

---

## 5. コードの効率面の所見

### 5.1 `_syncRigSetupContext()` の高頻度DOM再構築

対象: `animation-table-popup.js` 2752行〜（`_syncRigSetupContext`）、呼び出し元 3864 / 3930 / 4064 / 15449行

- 呼び出し元のうち3930行・4064行は、PIVOTのdrag中（`_updateRigPivotGesture`相当）・wheel操作中の確定処理から呼ばれており、**ドラッグ中の連続呼び出しが起こり得る**。15449行の呼び出しはRIGタブ表示中の通常render同期経路。
- 関数内部は最大12個の`folderSetup?.querySelector(...)`と、`meshBoneSelect` / `parentSelect`それぞれの**`<option>`全件`replaceChildren`による再構築**を、値が変わっていない場合でも毎回行う。
- 影響: Bone数・Folder数が多いモデルでは、PIVOTドラッグのたびにDOM要素を再生成するコストが積み重なり、液タブでのペン追従性（`TEGAKI.md` 1章「新機能より、描画の追従性…を優先する」）に影響する可能性がある。現時点でBrowser実測はしていないため、**体感遅延が出ているかはCODEX側での実測が必要**（`AGENTS.md` 6章のBrowser確認手順に準拠）。
- **提案（優先度: 低〜中、実測してから着手）:**
  1. `querySelector`結果を`_syncRigSetupContext`の初回呼び出し時に1回だけ取得してインスタンスへキャッシュし、以後は保持した参照を使う（`folderSetup`のDOM自体は`this.motionPanel`生成時に固定されているため、要素が再生成されない限りキャッシュ可能）。
  2. `meshBoneSelect` / `parentSelect`のoption再構築は、選択肢の中身（boneId一覧）が前回と同じ場合はスキップする軽量な差分チェックを挟む。既存の`replaceChildren`呼び出しを丸ごと置き換える必要はなく、直前に比較用の配列をキャッシュして`JSON.stringify`または長さ+ID比較で判定するだけで済む。
- 上記はいずれも**DOM構造・イベント契約・EventBus payloadを変更しない**範囲のため、`AGENTS.md` 3章の「安全な編集」に収まる規模と考えられるが、関数全体の再構成になるため着手前に規模感をCODEX側で確認してほしい。

### 5.2 メッシュ生成エラーメッセージのハードコード分岐（4.1と同一箇所の再掲）

- 5.1と合わせて、`_generateSelectedRasterBoneSetup()`のreason→message変換もSAME関数内で三項演算子ネストになっている。Stage Dで`reason`の種類が増える設計（`phase7i.md`「2〜3 direct-chain BONE必須、branch / hole / multiple island / hard bend等のpure失敗理由をtoastへ限定表示する」）のため、こちらも辞書化しておくと保守しやすい。

### 5.3 良好だった点

- `raster-bone-auto-setup.js`・`raster-bone-skinning.js`はpure関数中心で副作用が分離されており、Gate/検証がしやすい構造になっている。History記録（`_recordInternalLayerHistory`）も生成成功時のみ・1操作1Historyの原則を守っている（`_generateSelectedRasterBoneSetup`内、result.ok確認後にのみ記録）。
- CSSは`color-mix()`を活用してパレットから半透明色を導出しており、色の重複定義を避けている（UI/CSSガイド3章の方針に合致）。

---

## 6. 優先度つきサマリ

| # | 項目 | 種別 | 優先度 | Stage D着手前に検討すべきか |
|---|---|---|---|---|
| 1 | `.anim-rig-mesh-bone-controls`行のAUTO LINE追加後の密集対策 | レイアウト | 高 | **必須**（Stage Dの実装対象そのもの） |
| 2 | generator種別のラベル/メッセージ辞書化 | コード効率・保守性 | 中 | 推奨（Stage D実装が楽になる） |
| 3 | `_syncRigSetupContext()`のDOM再構築コスト | コード効率 | 中 | 任意（まず実測） |
| 4 | BONE select / parentSelectの同名衝突 | 導線 | 中 | 任意 |
| 5 | 生成ボタンのSetup色差別化 | 色使い | 低 | 任意（Owner合意が前提） |
| 6 | RIG folder treeの識別性 | レイアウト | 低 | 任意 |

---

## 7. 未検証・対象外

- 実Browser（Chrome最新）での操作確認、pen/touch実機確認は行っていない。本書の指摘はコード読解のみに基づく。
- `part-rig.js` / `raster-bone-skinning.js`の内部アルゴリズム（LBS計算等）は精読していない。Phase 7iのpure実装（Stage A〜C）そのものへの指摘はない。
- `animation-data-model.js`（Stage D接続先）は今回読んでいない。Stage D実装契約との整合確認は別途必要。
- 本書はWeb外部AIによる調査であり、`AGENTS.md` 8章の通り「外部AIの計画書はそのまま実装契約にせず、存在するfile・event・classと照合してから`task-codex/`へPhase化する」対象。
