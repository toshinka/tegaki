# D&D設計提案書：レイヤーパネル・アルバムパネルのドラッグ移動改善

**作成者：** Claude  
**宛先：** Codex・Gemini（実装前レビュー・実装参照用）  
**初版：** 2026-05-18  
**改訂：** 2026-05-22（Phase 2 調査結果を反映）  
**対象フェーズ：** Phase 2（進行中）

---

## 改訂履歴

| 版 | 日付 | 変更内容 |
|---|---|---|
| v1 | 2026-05-18 | 初版作成（Codex 向け設計提案） |
| v2 | 2026-05-22 | Phase 2 調査で Bug 1〜4 が判明。実際のデータ破壊バグを Section 1 に追加。Section 5・6・7 を調査結果に合わせて改訂 |

---

## 1. 現状の問題

### 1-1. UX上の問題（初版から）

現在、レイヤーパネルおよびアルバム内パネルの並び替えに **SortableJS** を採用しているが、
以下の問題がある。

| 問題 | 詳細 |
|---|---|
| 入れ替えが急すぎる | hover直後にリストが動いてしまい、ユーザーの意図と合わない |
| フォルダ収納の判定がない | 「フォルダの中に入ったのか、隣に並んだのか」の視覚的フィードバックがない |
| ゴーストが不自然 | Windowsエクスプローラーのような半透明追従ではなく、デジタル的なスナップ感 |
| SortableJSの設計限界 | SortableJSは**フラットリストの並び替え専用**であり、ツリー操作（階層移動）には根本的に向いていない |

### 1-2. 実際に発生しているバグ（v2 追記・Phase 2 調査結果）

上記の「設計限界」が、**実際のデータ破壊・表示不整合バグ**として現れていることが確認された。
詳細は `layer_panel_bug_report.md` を参照。

| Bug | 場所 | 症状 | 深刻度 |
|---|---|---|---|
| Bug 1 | `layer-system.js` `reorderLayers()` | PixiJS の live array を直接 splice → シーングラフ破壊。一度発生すると新規レイヤーもパネルに出なくなる | **最重要** |
| Bug 2 | `layer-panel-renderer.js` `onEnd` | SortableJS の `newIndex` が非表示レイヤーを無視 → インデックス誤算。フォルダ内子レイヤーが1つでもあると常に発生 | **重要** |
| Bug 3 | `layer-system.js` `addLayerToFolder()` | フォルダを閉じた状態でレイヤーを追加すると永続的にパネルから消える | 中 |
| Bug 4 | `layer-panel-renderer.js` `layer:activated` | アクティブ枠の高速更新がインデックスズレ後に誤要素へ適用 → 「ゴースト選択」表示 | 中 |

> **重要**: Bug 2 は SortableJS がフラットリスト前提のため
> 「非表示アイテムの存在を認識できない」という**構造的限界**から来ている。
> Bug 1 は Bug 2 の補正として自前インデックス計算を追加したことで生まれた実装ミスである。
> どちらも SortableJS を使い続ける限り根本解決しない。

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
| Bug 1・2 の解決 | △ Bug 2 は解消。Bug 1 は自前 reorderLayers を修正すれば解消 |

**結論：** SortableJSより柔軟。短期的な乗り換え先としては有力。  
ただし、フォルダ収納の「ツリー操作」部分は自前実装が残るため、
後述の選択肢Cと比較すると中途半端になりうる。

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
| Bug 1・2 の解決 | ◎ SortableJS を削除すれば Bug 1・2 は根本消滅 |

**結論：** **長期的には最良。**  
`pointer-handler.js` が既にある＝Pointer Events処理の基盤が流用できるため、  
実装コストは見た目より低い可能性がある。

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
  const rect = element.getBoundingClientRect();
  // クリック位置とゴーストの左上のオフセットを記録
  state.offsetX = e.clientX - rect.left;
  state.offsetY = e.clientY - rect.top;

  const ghost = element.cloneNode(true);
  ghost.style.cssText = `
    position: fixed;
    opacity: 0.6;
    pointer-events: none;
    z-index: 9999;
    width: ${element.offsetWidth}px;
    transform: scale(1.03);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    left: ${rect.left}px;
    top: ${rect.top}px;
  `;
  document.body.appendChild(ghost);
  state.ghost = ghost;
  state.dragging = element;
  state.originRect = rect; // キャンセル時の帰還先

  // キャンバス側の pointerdown と競合しないよう setPointerCapture は使わない
  // document レベルでキャプチャするだけでよい
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onDrop);
  document.addEventListener('keydown', onKeyDown); // Escape キャンセル
}

function onMove(e) {
  state.ghost.style.left = `${e.clientX - state.offsetX}px`;
  state.ghost.style.top  = `${e.clientY - state.offsetY}px`;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  updateHoverState(target);      // ハイライト更新
  checkFolderHover(target, e);   // フォルダ展開タイマー
}

function onKeyDown(e) {
  if (e.key === 'Escape') cancelDrag();
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

**ドロップ先の「内側 vs 隣」判定：**

```js
function getDropIntent(target, e) {
  // ターゲットがフォルダ要素かどうか
  const folderEl = target?.closest('[data-type="folder"]');
  if (!folderEl) return { type: 'reorder' };

  const rect = folderEl.getBoundingClientRect();
  const relativeY = e.clientY - rect.top;
  const threshold = rect.height * 0.3; // 上下30%は「隣」、中央70%は「内側」

  if (relativeY < threshold) return { type: 'before', target: folderEl };
  if (relativeY > rect.height - threshold) return { type: 'after', target: folderEl };
  return { type: 'into', target: folderEl }; // フォルダに収納
}
```

**ドロップとキャンセルのアニメーション（GSAP）：**

```js
function onDrop(e) {
  cleanup();
  const intent = getDropIntent(
    document.elementFromPoint(e.clientX, e.clientY), e
  );

  // ドロップ先の位置を取得してゴーストをそこへスナップ
  const destRect = getDest(intent); // intent から目標 rect を算出
  gsap.to(state.ghost, {
    left: destRect.left, top: destRect.top,
    opacity: 0, duration: 0.18, ease: 'power2.out',
    onComplete: () => {
      state.ghost.remove();
      EventBus.emit('dnd:dropped', { intent, draggedId: state.dragging.dataset.layerIndex });
    }
  });
}

function cancelDrag() {
  cleanup();
  // ゴーストを元の位置に戻すアニメーション
  gsap.to(state.ghost, {
    left: state.originRect.left, top: state.originRect.top,
    opacity: 0, scale: 1, duration: 0.22, ease: 'power2.inOut',
    onComplete: () => state.ghost.remove()
  });
}

function cleanup() {
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerup', onDrop);
  document.removeEventListener('keydown', onKeyDown);
  clearTimeout(folderTimer);
}
```

---

## 5. SortableJSの扱いと移行戦略

### v2 改訂：止血パッチを先行させる

> ⚠️ **v1 からの変更点**  
> v1 では「移行期に SortableJS をフォルダ収納なし箇所のみ残す」と記載したが、
> Bug 1・2 の調査結果を踏まえて戦略を修正する。
> Bug 1・2 が残ったまま SortableJS を部分使用し続けると、
> 移行期間中もシーングラフ破壊が発生し続けるリスクがある。
> 止血パッチを先に入れてから移行を進めること。

**推奨移行フロー：**

```
Step 1【止血】Bug 1〜4 の修正パッチを適用（layer_panel_bug_report.md 参照）
  ↓
Step 2【検証】修正後に受け入れ条件（同レポート末尾）をすべてパス
  ↓
Step 3【移行】drag-drop-manager.js を新規作成し、Pointer Events 自前実装を開始
  ↓
Step 4【縮小】SortableJS を layer-panel-renderer.js から段階的に削除
  ↓
Step 5【完了】SortableJS 依存を全削除
```

| フェーズ | SortableJS | 自前D&D | 状態 |
|---|---|---|---|
| 現在 | 使用中（Bug あり） | なし | ❌ 不安定 |
| Step 1〜2 完了後 | 使用中（止血済み） | なし | ✅ 安定（暫定） |
| Step 3〜4 | 縮小中 | 段階適用 | ⚠️ 移行期 |
| Step 5 完了後 | 削除 | 全D&D統一 | ✅ 安定（恒久） |

---

## 6. 調査状況と残依頼事項

### 6-1. `pointer-handler.js` の流用可否 ← **未調査・Codex 依頼継続**

`pointer-handler.js` の `pointerdown` / `pointermove` / `pointerup` 処理が、
キャンバス描画以外（パネルUI）にも流用できる設計になっているか確認してほしい。

流用できるなら、`drag-drop-manager.js` はその上に薄く乗せる形にする。  
描画処理と競合するようなら、パネル側のPointer Eventsは独立して処理する（`stopPropagation` で分離）。

> **追記**: `startDrag` の実装例ではあえて `setPointerCapture` を使っていない。
> キャンバス側と `pointerId` が衝突するリスクを避けるため。
> この判断の妥当性も確認してほしい。

### 6-2. SortableJS 利用箇所の全洗い出し ← **未調査・Codex 依頼継続**

どのファイルの何行目でSortableJSが `import` / `new Sortable()` されているか列挙してほしい。  
乗り換えコストの見積もりに使う。

### 6-3. `@dnd-kit` vs 自前実装のコスト見積もり ← **未調査・Codex 依頼継続**

ローカルの実ファイルを確認した上で、どちらが現実的か判断してほしい。  
Claudeの判断は「自前が長期最良」だが、Phase 2 の他タスクと並行する場合は `@dnd-kit` が現実的かもしれない。

### 6-4. GSAPとの連携箇所 ← **未調査・Codex 依頼継続**

ゴーストのドロップアニメ（収まり・キャンセル戻り）にGSAPを使いたい。
現在のGSAP利用パターン（`gsap.to()` の呼び出し元）を確認し、D&Dアニメとの干渉がないか見てほしい。

### 6-5. Bug 1〜4 の止血パッチ適用 ← **v2 新規追加・Gemini 作業依頼**

`layer_panel_bug_report.md` の修正指示に従って Bug 1〜4 を修正してほしい。
修正優先順：**Bug 1 → Bug 2 → Bug 4 → Bug 3**（報告書の優先度表参照）。

---

## 7. まとめ・推奨方針

### 緊急度別の作業順序（v2 改訂）

| 緊急度 | 作業 | 担当 | 根拠 |
|---|---|---|---|
| 🔴 **今すぐ** | Bug 1〜4 の止血パッチ | Gemini | シーングラフ破壊が進行中 |
| 🟡 **次フェーズ初頭** | D&D 設計方針の最終決定（A vs C） | Codex 判断 | 6-1〜6-3 の調査結果待ち |
| 🟢 **移行期** | `drag-drop-manager.js` 実装 | Gemini | Codex 判断後 |
| 🟢 **完了時** | SortableJS 全削除 | Gemini | drag-drop-manager 完成後 |

### 技術方針（変更なし）

| 優先度 | 内容 |
|---|---|
| **第一推奨** | Pointer Events 自前実装（`drag-drop-manager.js` 新規作成） |
| **代替案** | `@dnd-kit` 採用（短期解決、フォルダ収納は自前で追加） |
| **採用禁止** | HTML5 Drag and Drop API（液タブペン入力と根本的に非互換） |
| **SortableJS** | 止血パッチ後に段階的縮小・最終的に削除 |

`pointer-handler.js` との統一が取れれば、
ペン・マウス・タッチ・D&Dのすべてが同一の入力基盤で動く設計になり、
TEGAKIの長期的な保守性が大きく上がる。

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| `layer_panel_bug_report.md` | Bug 1〜5 の詳細調査・修正コード付き報告書 |
| `Claude提案_DnD_設計提案書_v2.md` | 本ドキュメント |

---

*Claude作成 / 初版 2026-05-18 / v2改訂 2026-05-22*
