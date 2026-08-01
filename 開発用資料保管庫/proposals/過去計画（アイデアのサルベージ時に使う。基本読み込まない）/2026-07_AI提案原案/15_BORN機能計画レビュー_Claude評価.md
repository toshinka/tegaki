# BORN（ボーン）機能計画書 レビュー・改善提案

対象文書: `15_ボーン_CAF階層パーツ_Zインデックス動的制御設計.md`（Gemini作成、2026-07-27）
照合資料: `TEGAKI.md` / `ARCHITECTURE.md` / `PHASE4Z_BOUNDARY.md` / `proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`（セクションD）
レビュー担当: Claude
評価日: 2026-07-27

---

## 0. 総評

**総合スコア: 7/10（方向性は良好、コンポジター統合部分に見落としあり、実行順の再整理が必要）**

課題設定（1CAF内フォルダのパーツ分離、Zインデックス動的化、ボーン×WarpGrid統合）そのものは妥当で、`proposals/09` セクションD（Bone/演算アニメ）で既に敷かれている段階方針（①剛体親子transform→②WarpGridへのweight付与→③physics）とも矛盾していない。ToonSquid/Live2D/Spineの比較検討も的確。

ただし、**「内部Folderごとに独立したtransformを与える」という前提が、現行の合成順序（内部Layer評価→Folder clipping/blend→Clip Motion/Warp）と正面から衝突する**点への言及がなく、難易度表の評価（`timeline-frame-compositor.js` = 🔴 高）はこのリスクの大きさを過小評価している可能性がある。また、既にプロジェクト側で用意されている**Bone前提のUI下地（楔形pivotサイト、WarpGRIDのSETUP/ANIMATE分離、Lane onionのdisplay-onlyコンテナ）を再利用する視点が抜けている**ため、これを反映すると設計・UI双方の一貫性が上がる。

---

## 1. 良い点

| 項目 | 評価 |
|---|---|
| アプローチ1B（単一TimelineModel + Sub-Lane投影、mini Timeline再帰禁止） | ⭕ `proposals/09`-D「Folderごとにmini TimelineModelを再帰させない」と完全一致。妥当。 |
| 段階的ハイブリッド（剛体FK→WarpGridへのweight付与） | ⭕ `proposals/09`-D「第一段階は剛体的な親子transform、第二段階で少数control pointへのweight付与」と一致。 |
| Bind Pose / Animate Modeの分離 | ⭕ 誤操作防止として妥当。かつ既存WarpGRIDが既に同型のSETUP/ANIMATE分離を実装済みなので、**新規発明ではなく流用が可能**（後述4章）。 |
| partId/UUID化の懸念提起（討論点1） | ⭕ 論点として正しい。ただし「案A/Bを検討」に留めず、結論を出すべき（後述3-5）。 |
| Slice分割によるリスク低減の発想 | ⭕ 全体方針として妥当。ただしSlice1の粒度が大きすぎる（後述7章で再分割案）。 |

---

## 2. 出典・整合性の指摘

- 文書42行目「`TEGAKI.md` 5章『1つのUI engine, 2つのdata adapter』『mini Timelineを再帰させない』」という引用について、現行mainブランチの `TEGAKI.md` にはこの文言が見当たらない。該当原則は実際には `proposals/09` セクションDの記述である可能性が高い。実装前に一次資料を再確認し、引用元を訂正することを推奨する（`AGENTS.md` 4章「不明なAPI・存在不明のファイル・古い計画の内容を推測で使わない」規律に該当）。
- 本文書が「`proposals/15`」として `開発用資料保管庫/proposals/00_計画索引.md` の現行proposal一覧（1, 5, 8, UI_CSS, 9, 10, 11, 12, 14）に含まれていない。索引への追加、または既存の `09` への統合が必要（索引に載らないと将来のAIが見落とす）。

---

## 3. アーキテクチャ上の懸念点

### 3-1. 内部Folder個別transformと合成順序の衝突（最重要・要再設計）

`proposals/09` の確立済み評価順は次の通り：

```
内部Layer評価 → Folder clipping / blend → Clip Motion / Warp
```

これは「CAF内部は先に1枚のRasterへ確定してから、Clip全体をMotion/Warpで動かす」前提である。しかしGemini案の核心（課題1・課題2）は「内部Folderごとに個別のPivot/Rotationを持たせ、合成前に親子行列を掛ける」ものであり、**内部Folderが合成前に個別transformを持つ**ことを要求する。これは上記の確立済み順序と両立しない。

`timeline-frame-compositor.js` の難易度を🔴（高）としているが、実際には**既存のFolder clipping契約（`internal-layer-clipping-contract.js`）を書き換えるか、パーツを一段抽象化する必要**があり、単なる「行列を掛ける処理を足す」規模ではない。ここは3.6章の代替案で具体的に扱う。

### 3-2. Z-Index動的ソートとFolder clippingの相互作用

クリッピング（マスク）は通常「マスク元レイヤーの直上/直下」という**隣接関係**に依存する。Sub-LaneのzIndexをフレームごとに変えて任意の順序へ並べ替えると、クリッピング元とクリッピング対象の隣接関係が崩れ、マスクが意図せず外れる／別のレイヤーにかかる事故が起こり得る。

文書には「フォルダスタック順*1000+zIndexOffset」という式のみが示されているが、**「clippingで連結しているFolder群はzIndexで分離できない」という制約**が明記されていない。ここは実装前に確定させるべき仕様の抜けである。

### 3-3. Bone専用パラメータ（rest angle / axis length）の未反映

`proposals/09`-A.10 に以下の明確な設計指針が既にある。

> 将来のBoneでは `restAngle / axis length` をRotation keyとは別parameterとして持ち、pivot編集時だけRotation入力の意味を差し替えない。

Gemini案の「Rotation (Pivot中心)」という記述はこれと整合していない。既存のClip Motion Rotationキーとの意味の衝突を避けるため、**Boneのrest角度・軸長はRotationキーとは別スキーマとして持つ**ことを明記すべき。

### 3-4. constraintのfallback仕様（DAG／親不在時の挙動）が未定義

`proposals/09`-Dは以下を明確に要求している。

> 参照関係は循環禁止DAGとし、同Frameに親CAFがない場合の挙動を `rest / hold / disabled` のどれかへ固定する。複数CAF、Group、Folderを跨ぐ暗黙継承は行わない。

Gemini案の「$M_{final} = M_{GlobalCAF} \times M_{ParentPart} \times M_{LocalPart}$」という数式は計算式としては正しいが、**親パーツが該当フレームに存在しない場合の挙動**や**循環参照の検出・拒否**についての言及が一切ない。データモデル拡張（`animation-data-model.js`）の設計に含めるべき必須項目。

またGemini案は行列の単純乗算のみで「channel別ON/OFF・weight付き参照」という`proposals/09`-Dの要求（position/rotation/scaleを個別にON/OFFできる明示constraint）に対応していない。これがないと、例えば「腕は親の回転だけ継承し、スケールは継承しない」といった一般的なリグ要求に応えられない。

### 3-5. partId解決方式：結論を出すべき

討論点1で案A（UUID）・案B（Orphaned Track表示）の両論併記になっているが、これは検討ではなく**採用即決でよい論点**。

**結論案: 案A（不可視UUID採用）+ 案B（削除時はOrphaned Track表示、自動削除しない）を併用**。
理由: 名前ベース参照は`layer-system.js`のrename操作と衝突するリスクが高く、UUID化はコスト対効果が高い。一方、フォルダ削除時に子Laneを黙って消すと作業データを失うため、Orphaned表示は安全側に倒すべき。両案は排他ではなく併用可能。

### 3-6. Bake経路（非破壊→破壊化）の欠落

既存のWarpGRID/Clip Motionはいずれも「非破壊編集→確定時に整数FrameのCAF列へBake」という共通パターンを持つ（`proposals/09`セクションA2・採否gate）。Gemini案にはBone側の**Bake to Frames**経路の記載がない。物理演算やweight追従の結果を確定raster化する将来ニーズ（`proposals/09`-D「physicsの出力はparameter trackとし、確定時にkeyframeへbakeできるようにする」）を見据え、Slice設計に含めるべき。

### 3-7. History原子性の明記漏れ

既存機能は軒並み「1 gesture = 1 History」を徹底している（Warp Bind、Motion key編集など）。Gemini案のPivotドラッグ・Bone作成UIについてこの原則が明記されていない。`system/history.js`拡張の設計に明記すべき。

---

## 4. ガバナンス面の指摘（`PHASE4Z_BOUNDARY.md` 照合）

`PHASE4Z_BOUNDARY.md` は「Geminiが明示指示なしに変更してはいけない」項目として、`LaneModel`/`ClipInstanceModel`/`ClipAssetModel`の責務変更、保存形式・serialize構造変更、EventBusの新イベント名追加、Layer PanelのDOM構造大幅変更などを明記し、これらは**Codexが設計してから**Geminiが実装する体制になっている。

Gemini案のSliceは、この境界線を跨ぐ内容を含むにもかかわらず、**どのSliceを誰が設計し、どのSliceをGeminiがそのまま実装してよいかの区分がない**。

| Slice | 内容 | 現行境界での区分 |
|---|---|---|
| Slice 1 | `parentId`/`partPath`スキーマ追加、剛体FK | 🔴 Codex設計必須（`LaneModel`/`ClipInstanceModel`責務変更に該当） |
| Slice 2 | zIndexトラック追加、合成順ソート | 🔴 Codex設計必須（保存形式・compositor評価順の変更） |
| Slice 3 | Rig SetupモードUI、Canvasドラッグ | 🟡 UI実装はGemini可、ただしモード管理の状態設計はCodex確認推奨 |
| Slice 4 | Bone×WarpGridのweightバインド | 🔴 Codex設計必須（deformer/schema拡張、`ClipInstance.deformer`との接続） |

**改善提案**: 本文書の「7. 関連仕様書」の直後に「実装体制」章を追加し、Slice1・2・4は「Codexが詳細設計→Gemini実装」、Slice3のUI部分のみ「Gemini先行可」と明記する。これは`AGENTS.md`5章の役割分担そのものであり、計画書としての完成度を上げる。

---

## 5. UI面のコメント

- **楔形（くさび形）Pivotサイトの再利用**: `proposals/09`-A.6に「Clip Motionは将来Boneのrootを想起できるhead付き楔形siteとして表示を分け、座標変換ロジックだけを共用する」という記述が既にある。つまり**Boneのjointマーカーは新規デザインを起こす必要がなく、既存の楔形サイトをheadは関節、tailは向きとして流用できる**。Gemini案の「Canvasオーバーレイでの Pivot / Bone ハンドル表示」は新規UI発明として書かれているが、既存資産の延長として設計し直すべき。
- **SETUP/ANIMATE分離の流用**: WarpGRID（Phase 6d）は既に`SETUP`/`ANIMATE`のモード分離UIを実装済み。Gemini案の「RIG SETUPモードトグル」はこれと同じ配色・アイコン・操作感で統一すべきで、ToonSquidを直接参照するより**社内の既存UIコンポーネントを流用する方が「はっちゃんの潔さ」の方針にも合致**する。
- **Z順の一時可視化**: `proposals/09`-Dは「Bone設定時の影響Lane表示はLane onionの描画色・display-only containerを再利用候補とする」と既に示唆している。Gemini案にはZ-Index編集中の可視化UIの言及がないため、この既存のonion display-onlyコンテナを流用したプレビュー（現在どのパーツが手前かを薄く色分け表示）を追加提案する。
- **アイコンの誤読回避**: `proposals/09`-A.7で「checkは完了、flagは範囲markerと誤読しやすいため採用しない」という既存ルールがある。Bone関節マーカーのアイコン選定でも同様の誤読回避基準（`lucide`アイコンの意味的衝突チェック）を明記すべき。

---

## 6. 代替アプローチ比較（コンポジター統合方式）

3-1で指摘した「内部Folder個別transform×合成順序」の問題に対し、3案を比較する。

### Option A: Gemini案そのまま（compositor内でFolderごとに階層行列を都度計算）

内部Layer評価の最中に各Folderのtransformを都度適用し、clipping/blendも同時に階層考慮する方式。

- 長所: 最終的な自由度が最も高く、パーツ間のclippingも理論上可能。
- 短所: `internal-layer-clipping-contract.js`と`timeline-frame-compositor.js`の両方を深く書き換える必要があり、既存の「1CAF＝1枚に確定してからMotion/Warp」という契約全体を壊すため、回帰リスクが非常に高い。
- **スコア: 5/10**（強力だが最もハイリスク。Codexによる契約再定義なしに着手すべきでない）

### Option B: パーツ＝擬似ClipInstanceとして扱う二段合成（推奨）

各トップレベルFolder（腕・頭など）を、まず**既存のFolder clipping/blendルールそのままで単独のRenderTextureへ確定**させる（＝現行の内部Layer評価パイプラインを無改造で再利用）。その後、確定済みの各パーツ画像を、`ClipInstance`が現在CAF全体に対して行っているのと同じ「配置＋Motion的な変換」をパーツ単位に適用し、階層行列とzIndexで並べる。

- 長所: 既存のclipping/blend処理を**一切変更せず**再利用できるため、回帰リスクが低い。「パーツ＝小さなClipInstance」という既存の心的モデルの延長になり、実装者の理解コストも低い。
- 短所: パーツを跨いだclipping（例: 腕の影が胴体にかかる）は表現できない。この制約をアーティスト向けに明示する必要がある。
- **スコア: 8/10**（3-1の問題を安全に解決できる現実的な落とし所。最初の実装方式として推奨）

### Option C: Bone実装をWarp/Mesh完成まで凍結し、まず「複数CAF運用の摩擦」だけをUIで緩和する

`proposals/09`の採用優先順位（A→B→C→D→E→F）に厳密に従い、Bone本体（D）には着手せず、Slice1相当を「1キャラ＝1CAFのまま」ではなく「パーツごとの独立CAFを、専用のグルーピングUIで一括選択・一括duration変更・一括表示できるようにする」だけに留める。

- 長所: 最もリスクが低く、既存アーキテクチャを一切変更しない。
- 短所: 課題A（1CAF運用での分離煩雑さ）の本質的解決にならず、ユーザーが本来望む「1CAFで作画してZ順やBoneを後から効かせる」体験は得られない。
- **スコア: 6/10**（安全だが目的未達。次善のフォールバック案として保持する価値はある）

**推奨: Option B を Slice 1 の実装方式として正式採用し、Option A は「Slice 4以降、Option Bの制約が実運用で問題になった場合の将来拡張」として保留する。**

---

## 7. 改訂版 Slice ロードマップ（提案）

Gemini案のSlice1が「識別子化＋剛体FK」を一度に含み粒度が大きいため、以下のように分割する。

```
Slice 0（新設・Codex設計）: データモデル確定
  - partId(UUID)化、DAG循環禁止、親不在時fallback（rest/hold/disabled）、
    channel別ON/OFF weight constraintのスキーマ確定。
  - 保存形式・EventBus契約の設計をCodexが先に固める（実装はまだしない）。

Slice 1（Option B方式）: パーツの擬似ClipInstance化 + 剛体FK
  - 既存Folder clipping/blendは無改造。パーツ単体を確定Rasterとして扱う。
  - Pivotは既存の楔形サイトを流用。rest angle/axis lengthをRotationと別parameterで保持。
  - 1 gesture = 1 History。

Slice 2: Dynamic Z-Index Track
  - clippingで連結されたFolder群はzIndexで分離不可、という制約を実装前に確定。
  - zIndex未使用CAFは従来の配列直列合成をバイパス（Gemini案どおり採用）。

Slice 3: Rig Setup UI
  - 既存WarpGRIDのSETUP/ANIMATE分離コンポーネントを流用。
  - Lane onionのdisplay-onlyコンテナを流用したZ順プレビュー追加。

Slice 4: Bone × WarpGridのweightバインド + Bake to Frames
  - 既存の非破壊Bake（整数FrameへのCAF列変換）と同じ入口をBoneにも用意する。
```

---

## 8. まとめ・次のアクション

1. 本レビューの3-1〜3-4、6章の指摘を反映し、`15_ボーン_...md`を改訂する。
2. 改訂版を`開発用資料保管庫/proposals/00_計画索引.md`へ正式登録する（現状リストにない）。
3. Slice 0（データモデル確定）はCodexへの設計依頼として`task-codex/`へ切り出す。
4. Slice 1以降は本レビューのOption B方式を前提に、Gemini向け指示書（`task-gemini/`）を作成する。
