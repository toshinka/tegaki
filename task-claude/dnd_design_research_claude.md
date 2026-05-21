# レイヤーパネル D&D 設計 追加調査報告 (Claude報告)

> **本報告の位置付け**: GEMINI報告 (`dnd_design_research_result.md`) に対する補完・評価・代替案提示。  
> **参照ファイル**: `tegaki_work/ui/layer-panel-renderer.js`（GitHub直接取得）, `tegaki_work/system/layer-system.js`（同）, GEMINI報告書

---

## 結論（先出し）

GEMINI報告の**診断は概ね正確**で、Pointer Events ベース独自D&D移行という方向性も妥当です。ただし以下の点が抜け落ちており、後続AIが実装へ進む前に必ず確認・補完が必要です。

1. **現在の最大バグが未指摘**: `render()` が呼ばれるたびに `initializeSortable()` でSortableを**破棄・再生成**しており、これ単体が操作硬さの大きな原因になっている可能性が高い。
2. **Pragmatic DnD という有力な第3の選択肢**が検討されていない。
3. **ペン/スタイラス入力とPixiJSの競合**という、このアプリ固有のリスクが不足している。
4. **フラットDOM+インデント構造**という設計の制約が分析に反映されていない。

---

## 1. コード精読による現状補完

### 1-1. GEMINI報告で正確に指摘された点

- SortableJS の `onMove` 内でマジックナンバー (0.22〜0.78) によるフォルダ口判定をしていること → **確認済み・正確**
- `_isFolderMouthDrop` の判定が高速ドラッグで漏れやすいこと → **確認済み・正確**
- ドラッグ中に実DOMが動くため、フォルダ判定との競合が起きること → **確認済み・正確**

### 1-2. GEMINI報告で見落とされた点（重要度順）

#### ① `initializeSortable()` が毎回 `render()` 内で呼ばれている【最重要】

```javascript
// layer-panel-renderer.js の render() 末尾
this.initializeSortable();   // ← render() のたびに呼ばれる
```

`initializeSortable()` の冒頭：

```javascript
if (this.sortable) {
    this.sortable.destroy();  // 毎回破棄
}
this.sortable = sortableLib.create(this.container, { ... });  // 毎回生成
```

`render()` は `requestUpdate()` 経由で16msデバウンスされているとはいえ、レイヤー操作のたびに（可視性変更、名前変更、クリッピング変更など）Sortableインスタンスが破棄・再生成されます。  
**ドラッグ中にイベントが飛んで `render()` が呼ばれると、Sortableが途中で破棄されてドラッグが中断またはデータが不整合になる**可能性があります。これが「操作が硬い」「意図しない場所へ移動する」の根本原因の一つと考えられます。

#### ② 階層構造は「フラットDOM＋`margin-left`インデント」

実コードを確認すると、フォルダの子レイヤーは**DOMとして親フォルダの子要素になっていない**。すべての `.layer-item` が `container` の直接子として並んでおり、インデントは `margin-left` で表現されています。

```javascript
// createLayerElement / createFolderElement の共通部分
folderDiv.style.marginLeft = `${leftOffset}px`;   // indentLevel * 12px
```

これはSortableJSが「同一コンテナ内のフラットリスト」として扱うため、`onMove` で並べ替えを止めてフォルダ投入判定を挟むという複雑な実装が必要になった根本原因です。後続AIへの重要情報として明記が必要です。

#### ③ `touch-action: none` がPixiJSと共存している

全 `.layer-item` に `touch-action: none` が付いています。これはPixiJSのポインタハンドラと共存するための設定ですが、SortableJSの `forceFallback: true`（ネイティブDnDを使わず、Pointer Eventsベースの独自実装を使う設定）と組み合わさっています。独自D&D実装に移行する際は同じ `touch-action: none` 設定を維持すれば問題ないはずです。

#### ④ `onEnd` でも `_findFolderDropTarget` を再呼び出ししている

```javascript
onEnd: (evt) => {
    // ↓ onMove で保存した _dragFolderTargetId を使うが、
    //   それがなければ再び _findFolderDropTarget を呼ぶ
    const finalTarget = this._findFolderDropTarget(evt, draggedLayer);
```

`onEnd` 時点ではDOMがすでに動いており、`evt.originalEvent` の座標が有効かも不明です。再判定の信頼性が低く、「ドロップしたら想定外のフォルダに入った」という事故の原因になりえます。

---

## 2. GEMINI設計案の評価

| 項目 | 評価 | コメント |
|------|------|---------|
| 基本コンセプト（ドラッグ中データ変更しない） | ✅ 正しい | このアプリの構造上、必須の方針 |
| 判定領域（上下25%/中央50%） | ✅ 妥当 | マジックナンバーの改善になる |
| 視覚的フィードバック3要素 | ✅ 良い | プレビュー・挿入線・フォルダハイライト |
| Phase分割（A→B→C→D） | ✅ 妥当 | ただし後述の修正推奨あり |
| フラットDOM構造への言及 | ❌ 不足 | 設計の前提として明記必須 |
| `initializeSortable()` 毎回呼び出しバグへの指摘 | ❌ 未指摘 | 重要なバグ |
| Pragmatic DnD等の代替ライブラリ検討 | ❌ 未検討 | 以下で補完 |
| ペン入力とPixiJS競合リスク | △ 不足 | 軽く触れているが詳細不足 |

---

## 3. 代替手法の比較検討

### 3-1. 手法一覧

| 手法 | 概要 | 採用難易度 | 向き不向き |
|------|------|-----------|------------|
| **A. SortableJS改善** | 現行ライブラリのまま根本バグ修正 | 低 | 短期修正向き |
| **B. 独自Pointer Events** | GEMINIが提案した完全自前実装 | 高 | 長期安定向き |
| **C. Pragmatic DnD** | Atlassianの軽量DnDライブラリ | 中 | バランス型 |

### 3-2. 手法A：SortableJS改善（短期修正案）

**やること：**
1. `render()` から `initializeSortable()` を切り離す。初回のみ呼び出し、再render時は `sortable.option()` でデータを更新するだけにする。
2. `onEnd` での再判定をやめ、`onMove` で保存した `_dragFolderTargetId` のみを使用する。
3. フォルダ判定に `data-layer-id` 属性を活用してDOM座標依存を減らす。

**メリット：** 変更量が最小。既存の動作を壊さずに「操作が硬い」問題の多くを解消できる可能性が高い。

**デメリット：** フォルダ口判定の根本的な難しさは残る。SortableJSの制約から抜け出せない。

**推奨度：** ⭐⭐⭐ 「まず試すべき最初のステップ」

### 3-3. 手法B：独自Pointer Events（GEMINIの提案）

**GEMINIの設計は技術的に正しいが、実装コストが高い。**

補足すべき設計要素：

- **スクロール中のautoscroll実装**: `pointermove` のY座標がコンテナの端20px以内になったとき、`requestAnimationFrame` ループで `scrollBy` を呼ぶ。SortableJSのautoscrollプラグインを参考にできる。
- **フラットDOMでの「フォルダ外出し」判定**: 子レイヤーをフォルダ外にドロップする場合、「フォルダの外のアイテム間」を検出する必要がある。インデントレベルを下げる方向（左方向）へのドラッグを検出してフォルダ外出し意図と判断する方法が直感的。
- **setPointerCapture の活用**: `pointerdown` 時に `element.setPointerCapture(e.pointerId)` を呼ぶと、ポインタがコンテナ外に出ても `pointermove` が届き続ける。既に `_attributePopupDrag` で同様のパターンが使われている（`_startLayerAttributePopupDrag`）ので、同じ実装パターンで統一できる。

**推奨度：** ⭐⭐⭐⭐ 「長期的に最も安定するが、実装前に手法Aを試すことを推奨」

### 3-4. 手法C：Pragmatic DnD（新規候補）

AtlassianがJira・Trello・Confluenceの全D&Dを置き換えるために開発したライブラリ（2024年4月公開、GitHubスター12.5k超）。

**特徴：**
- **コアはVanilla TS**、フレームワーク非依存
- ネイティブHTML Drag and Drop APIを使うが、**ポインタ座標へのアクセスも提供**
- 「ドラッグ中にDOMを動かさない」がデフォルト設計（SortableJSと逆の思想）
- `hitbox` オプションパッケージが「reorder-before / reorder-after / combine（フォルダ投入相当）」を標準サポート
- SortableJSより小さい（コアのみ約3KB）

**Tegakiへの採用可否の判断材料：**

| 確認項目 | 判定 | 理由 |
|---------|------|------|
| スタイラス/ペン入力対応 | ⚠️ 要検証 | ネイティブDnD APIベースのため、一部ペンドライバで挙動が異なる可能性 |
| `touch-action: none` との共存 | ⚠️ 要検証 | ネイティブDnDは `touch-action` の影響を受ける |
| フラットDOMツリーとの相性 | ✅ 良好 | `hitbox` パッケージの「flat tree」パターンが既存のフラットDOM構造と合致 |
| npm/bundler不要の使用 | ❌ 不可 | ESMパッケージのため、bundlerかCDN経由が必要 |
| 外部ライブラリ追加方針 | 要確認 | プロジェクトの方針次第 |

**ペン入力とネイティブDnD APIの問題：** Pointer Events（`pointerdown/pointermove/pointerup`）はペン・タッチ・マウスを統一的に扱えるが、ネイティブHTML DnD API（`dragstart/dragover/drop`）はマウス主体の設計で、タッチデバイスやスタイラスでの動作がブラウザ実装に依存します。Tegakiは描画ツールでペン入力が中心的なユースケースのため、このリスクは軽視できません。

**推奨度：** ⭐⭐⭐ 「将来の選択肢として調査価値あり。ただしペン入力検証が必須。外部ライブラリ追加方針の確認後に判断」

---

## 4. 推奨する実装ロードマップ（修正版）

GEMINIのPhase案を以下のように修正・補完します。

### Phase 0（追加）: SortableJS根本バグの修正【最優先・低リスク】

**目的：** 現状の最大問題を最小変更で解消し、効果を確認する。

**変更内容：**
- `render()` から `initializeSortable()` 呼び出しを削除
- `initializeSortable()` を初回init時のみ呼ぶよう変更
- `onEnd` での `_findFolderDropTarget` 再呼び出しを削除し、`_dragFolderTargetId` のみ使用

**触るファイル：** `ui/layer-panel-renderer.js` のみ  
**触らないファイル：** すべて  
**確認項目：** ドラッグ操作が以前より滑らかになるか。フォルダ投入の成功率が上がるか。  
**戻し方：** 変更は3箇所のみ。Gitでrevert。

---

### Phase A: 同階層並べ替えの独自D&D化（GEMINIと同内容）

Phase 0で改善が不十分だった場合に進む。

**補足：** `setPointerCapture` を `_startLayerAttributePopupDrag` と同じパターンで実装すること。既存のコードがテンプレートになる。

---

### Phase B: フォルダ投入・脱出の実装（GEMINIと同内容）

**補足：** 「フォルダ外出し」のUXとして、**水平方向（左）へのドラッグ**でインデント解除を示す挿入マーカーを表示する手法を検討する。Photoshopなどのプロツールで一般的な操作感。

---

### Phase C: スクロール・ペン調整（GEMINIと同内容、追記あり）

**追記：** `touch-action: none` は維持すること。PixiJSの描画キャンバスとパネルが同一ページに共存しており、ブラウザのデフォルトスクロールが競合する可能性がある。パネルのスクロールはJSで制御する。

---

### Phase D: アルバムD&Dへの横展開（GEMINIと同内容）

---

### Phase E（追加）: 複数選択レイヤーの一括移動

GEMINIのPhase Cを後ろにずらし、独立したPhaseとして切り出す。複数選択の実装は独立した複雑さを持つため、基本動作が安定してから着手する。

---

## 5. リスク補完

GEMINI報告のリスク項目に以下を追加します。

### 追加リスク1: ドラッグ中の `render()` 呼び出しによるSortable破棄（Phase 0で解消）

既述の通り。Phase 0で修正しなかった場合、独自D&D実装でも同じリスクが残ります。独自D&D実装後は `render()` 内でDOMを全書き換えするため、ドラッグ中の `render()` 呼び出しを**完全に抑制するフラグ**が必要です。

```javascript
// 実装例
if (this._isDragging) return;  // ドラッグ中はrender()をスキップ
```

### 追加リスク2: `setPointerCapture` とPixiJSポインタハンドラの競合

`setPointerCapture` でポインタをパネル要素に拘束すると、PixiJSが同じポインタの `pointermove` を受け取れなくなります。これは**意図した動作**（ドラッグ中に描画されないべき）ですが、ドラッグキャンセル時に `releasePointerCapture` を必ず呼び出し、PixiJSへのイベント供給を復元することを確認する必要があります。

### 追加リスク3: フラットDOMの書き換えとD&D状態の整合性

`render()` は `container.innerHTML = ''` で全DOMを再生成します。独自D&D実装時にドラッグ中のプレビュー要素（`position: fixed` の幽霊要素）と、`container` 内の挿入マーカー要素は別のDOMノードとして管理し、`innerHTML = ''` の影響を受けないようにする必要があります。

---

## 6. 検証手順補完

GEMINI報告のチェックリストに以下を追加します。

- [ ] **Phase 0検証**: ドラッグ中に別のレイヤーの可視性を変更しても、ドラッグが中断しないか（`render()` が呼ばれる操作を中断確認）
- [ ] **ペン入力の長押し**: スタイラスで長押しした際にドラッグが開始されるか、または誤ってブラウザのコンテキストメニューが出ないか
- [ ] **フォルダ外出し**: フォルダ内レイヤーをフォルダ行より上（ルートレベル）にドロップして外出しできるか
- [ ] **ドラッグ中のrender抑制**: ドラッグ中にレイヤー可視性変更などのイベントが発火しても、パネルが再描画されてドラッグが壊れないか
- [ ] **pointercancel**: スタイラスをペンタブから離した際（`pointercancel` 発火）にドラッグが適切にキャンセルされるか

---

## 7. 未確定事項（補完）

GEMINIの未確定事項に加えて：

- **Phase 0（SortableJS根本修正）で十分かどうか**: 実装コストが最小なので、まずこれを試して効果を測定するべき。効果が十分なら独自D&Dへの全面移行は不要な可能性がある。
- **外部ライブラリ追加の可否**: Pragmatic DnD採用を検討する場合、プロジェクトのバンドル方針と合っているか確認が必要。`tegaki_work/libs/` 以下に同梱されているのは `gsap.min.js` のみ。
- **「左方向ドラッグ＝フォルダ外出し」UXの採用可否**: 直感的だが、ユーザーが慣れていない場合は混乱する。代替として「フォルダ境界より下にドロップ＝外出し」も検討余地あり。

---

## まとめ

| | GEMINI報告 | Claude報告（本報告） |
|--|------------|---------------------|
| 診断精度 | 概ね正確 | `initializeSortable`毎回呼び出しバグを追加指摘 |
| 方向性 | 独自Pointer Events | 同意。ただしPhase 0（SortableJS修正）を先行推奨 |
| 代替案検討 | なし | Pragmatic DnD を比較対象として追加 |
| Tegaki固有リスク | やや不足 | フラットDOM構造・PixiJS競合を補完 |
| 実装ロードマップ | Phase A〜D | Phase 0追加・Phase Eとして複数選択を後回しに修正 |

**後続AIへの推奨アクション：**  
1. まず `initializeSortable()` の毎回呼び出しバグを修正（Phase 0）して効果を測定する。  
2. 改善が不十分な場合、GEMINI+本報告の設計を統合して独自Pointer Events D&Dを実装する。  
3. 外部ライブラリ追加が許容される場合、Pragmatic DnD のペン入力検証を行って採用を判断する。
