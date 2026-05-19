# D&D設計提案書：レイヤーパネル・アルバムパネルのドラッグ移動改善

**作成者：** Claude  
**宛先：** Codex（実装前レビュー・実装方針確認用）  
**日付：** 2026-05-18  
**対象フェーズ：** Phase 1c 以降（並行または次フェーズ扱いで可）

---

## 1. 現状の問題

現在、レイヤーパネルおよびアルバム内パネルの並び替えに **SortableJS** を採用しているが、以下の問題がある。

| 問題 | 詳細 |
|---|---|
| 入れ替えが急すぎる | hover直後にリストが動いてしまい、ユーザーの意図と合わない |
| フォルダ収納の判定がない | 「フォルダの中に入ったのか、隣に並んだのか」の視覚的フィードバックがない |
| ゴーストが不自然 | Windowsエクスプローラーのような半透明追従ではなく、デジタル的なスナップ感 |
| SortableJSの設計限界 | SortableJSは**フラットリストの並び替え専用**であり、ツリー操作（階層移動）には根本的に向いていない |

---

## 2. 目指す挙動（要件定義）

Windowsエクスプローラー相当の操作感を目標とする。

```
1. ドラッグ開始
   → ゴースト要素が生成され、半透明でカーソルに追従する
   → 元要素はうっすら残るか、プレースホルダーに置き換わる

2. ドラッグ中
   → ホバーした要素がハイライトされる
   → フォルダ上に一定時間（例：500ms）留まると、フォルダが自動展開する
   → フォルダの「内側」に入るのか「隣」に並ぶのかが、視覚的に区別できる
     （例：フォルダ内 → 枠が光る / 隣 → 挿入ラインが表示される）

3. ドロップ
   → GSAPで滑らかに収まるアニメーション
   → フォルダに入った場合はフォルダ内に移動
   → リスト間に落とした場合は順序が入れ替わる

4. キャンセル（Escape or 外にドロップ）
   → ゴーストが元の位置に戻るアニメーション
```

---

## 3. 選択肢の評価

### 選択肢A：`@dnd-kit` に乗り換え

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**評価：**

| 項目 | 評価 |
|---|---|
| フォルダ収納対応 | △ 自前ロジックが必要だが、イベント設計がしやすい |
| ゴースト制御 | ○ 自由にカスタマイズ可能 |
| ドロップ先判定 | ○ `over` イベントで細かく制御できる |
| TEGAKIへの統合コスト | △ 既存SortableJS置き換えの書き換えが必要 |
| 依存追加 | あり（3パッケージ） |
| タッチ・ペン対応 | ○ Pointer Events ベース |

**結論：** SortableJSより柔軟。短期的な乗り換え先としては有力。  
ただし、フォルダ収納の「ツリー操作」部分は自前実装が残るため、後述の選択肢Cと比較すると中途半端になりうる。

---

### 選択肢B：HTML5 Drag and Drop API

```js
element.setAttribute('draggable', true);
element.addEventListener('dragstart', (e) => { ... });
element.addEventListener('dragover', (e) => { e.preventDefault(); ... });
element.addEventListener('drop', (e) => { ... });
```

**評価：**

| 項目 | 評価 |
|---|---|
| フォルダ収納対応 | ○ `dragover` で自前制御可能 |
| ゴースト制御 | △ `setDragImage()` で差し替えは可能だが位置ずれが出やすい |
| タッチ・ペン対応 | **✕ 非対応（致命的）** |
| TEGAKIへの統合コスト | △ |

**結論：** **採用不可。**  
液タブペン入力は `pointerType: 'pen'` として来るため、HTML5 D&D APIと根本的に噛み合わない。  
`pointer-handler.js` の設計方針とも矛盾する。

---

### 選択肢C：Pointer Events 完全自前実装（推奨）

```js
// ドラッグ開始
element.addEventListener('pointerdown', startDrag);

// ドラッグ中（document にキャプチャ）
document.addEventListener('pointermove', onDrag);

// ドロップ
document.addEventListener('pointerup', endDrag);
```

**評価：**

| 項目 | 評価 |
|---|---|
| フォルダ収納対応 | ○ 完全制御 |
| ゴースト制御 | ○ DOMにゴースト要素を生成、`position: fixed` で追従 |
| ドロップ先判定 | ○ `document.elementFromPoint(x, y)` で任意判定 |
| タッチ・ペン対応 | ○ `pointer-handler.js` と同じ基盤で統一可能 |
| GSAP連携 | ○ ゴースト移動・収まりアニメをGSAPで制御 |
| EventBus統合 | ○ TEGAKIのEventBus設計に自然に乗せられる |
| 依存追加 | なし（完全ゼロ） |
| 実装コスト | 高（最も工数がかかる） |

**結論：** **長期的には最良。**  
`pointer-handler.js` が既にある＝Pointer Events処理の基盤が流用できるため、  
実装コストは見た目より低い可能性がある。Codexに事前調査を依頼したい。

---

## 4. 実装アーキテクチャ案（選択肢Cの場合）

```
drag-drop-manager.js      ← D&D全体の制御（新規ファイル）
  ├─ startDrag(element)   ← ゴースト生成、状態初期化
  ├─ onMove(x, y)         ← ゴースト追従、ホバー判定、フォルダ展開タイマー
  ├─ onDrop(x, y)         ← ドロップ先決定、ツリー更新イベント発行
  └─ cancel()             ← ゴーストをGSAPで元位置へ戻す

layer-panel-renderer.js   ← D&Dイベント購読、レイヤーパネルへの反映
album-panel-renderer.js   ← 同上（アルバム側）
```

**ゴースト実装の骨格：**

```js
function startDrag(e, element) {
  const ghost = element.cloneNode(true);
  ghost.style.cssText = `
    position: fixed;
    opacity: 0.6;
    pointer-events: none;
    z-index: 9999;
    width: ${element.offsetWidth}px;
    transform: scale(1.03);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(ghost);
  state.ghost = ghost;
  state.dragging = element;
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onDrop);
}

function onMove(e) {
  state.ghost.style.left = `${e.clientX - state.offsetX}px`;
  state.ghost.style.top  = `${e.clientY - state.offsetY}px`;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  updateHoverState(target);      // ハイライト更新
  checkFolderHover(target, e);   // フォルダ展開タイマー
}
```

**フォルダホバー展開：**

```js
let folderTimer = null;

function checkFolderHover(target, e) {
  const folder = target?.closest('[data-type="folder"]');
  if (folder && folder !== state.lastFolder) {
    clearTimeout(folderTimer);
    state.lastFolder = folder;
    folderTimer = setTimeout(() => {
      EventBus.emit('folder:expand', { id: folder.dataset.id });
    }, 500); // 500ms 滞留でフォルダ展開
  } else if (!folder) {
    clearTimeout(folderTimer);
    state.lastFolder = null;
  }
}
```

---

## 5. SortableJSの扱い

即時全廃は不要。以下の段階移行を提案する。

| フェーズ | SortableJS | 自前D&D |
|---|---|---|
| 現在 | フラットリスト並び替えに使用中 | なし |
| 移行期 | フォルダ収納なし箇所のみ残す | フォルダ収納・階層移動に適用 |
| 完了後 | 削除 | 全D&D操作を統一 |

SortableJSの `onStart` / `onEnd` フックを活かしつつ、フォルダ検出時だけ自前ロジックに委譲する構造も一時的には取れる。

---

## 6. Codexへの依頼事項

以下を調査・判断してほしい。

### 6-1. `pointer-handler.js` の流用可否

`pointer-handler.js` の `pointerdown` / `pointermove` / `pointerup` 処理が、  
キャンバス描画以外（パネルUI）にも流用できる設計になっているか確認してほしい。

流用できるなら、`drag-drop-manager.js` はその上に薄く乗せる形にする。  
描画処理と競合するようなら、パネル側のPointer Eventsは独立して処理する（`stopPropagation` で分離）。

### 6-2. 現在のSortableJS利用箇所の全洗い出し

どのファイルの何行目でSortableJSが `import` / `new Sortable()` されているか列挙してほしい。  
乗り換えコストの見積もりに使う。

### 6-3. `@dnd-kit` vs 自前実装のコスト見積もり

ローカルの実ファイルを確認した上で、どちらが現実的か判断してほしい。  
Claudeの判断は「自前が長期最良」だが、Phase 1cの完了を急ぐ場合は `@dnd-kit` が現実的かもしれない。

### 6-4. GSAPとの連携箇所

ゴーストのドロップアニメ（収まり・キャンセル戻り）にGSAPを使いたい。  
現在のGSAP利用パターン（`gsap.to()` の呼び出し元）を確認し、D&Dアニメとの干渉がないか見てほしい。

---

## 7. まとめ・推奨方針

| 優先度 | 内容 |
|---|---|
| **第一推奨** | Pointer Events 自前実装（`drag-drop-manager.js` 新規作成） |
| **代替案** | `@dnd-kit` 採用（短期解決、フォルダ収納は自前で追加） |
| **採用禁止** | HTML5 Drag and Drop API（液タブペン入力と根本的に非互換） |
| **SortableJS** | 段階的に縮小・最終的に削除 |

`pointer-handler.js` との統一が取れれば、  
ペン・マウス・タッチ・D&Dのすべてが同一の入力基盤で動く設計になり、  
TEGAKIの長期的な保守性が大きく上がる。

Codexの調査結果を受けて、Geminiへの作業指示書を作成する。

---

*Claude作成 / 2026-05-18*
