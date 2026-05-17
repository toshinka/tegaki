# Phase 2b — レイヤーパネルUIスリム化の設計確認

> Phase 2 初回棚卸し後の次作業。Gemini に渡す場合は、実装より先に現状確認と小さな安全修正だけを行う。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/`、`dist/`、`node_modules/` は編集しない。

---

## 目的

レイヤーを多数作るユーザー向けに、レイヤーパネルをより薄く、見やすく、操作しやすい方向へ整理する。
ただし Phase 2b では大改修をしない。ToonSquid 風の配置は参考にするが、現行構造を壊さず段階導入する。

---

## 担当切り分け

### Codex が直接判断・実装する領域

- レイヤーパネル DOM 構造の再配置。
- アクティブレイヤー操作バーの新設。
- 複数選択、クリッピング、フォルダ保存形式など、状態構造に影響する設計。
- `layer-system.js` と `layer-panel-renderer.js` の責務をまたぐ変更。

### Gemini に任せてよい領域

- 既存コードの棚卸し。
- `PROGRESS.md` への短い整理記録。
- CSS の 1〜2 箇所だけの小修正。
- ヘッダーと実イベント名の同期。
- Codex が指定した 50 行以内の局所修正。

Gemini は独自判断でレイヤーパネルを作り替えない。

---

## 現時点の設計方針

1. **レイヤー行は情報表示を優先**
   - 目アイコン
   - クリップ状態の表示枠
   - レイヤー名
   - 不透明度値
   - サムネイル

2. **編集操作はアクティブレイヤー操作バーへ寄せる**
   - 複製
   - 下レイヤー結合
   - 削除
   - 透明度ポップアップ
   - 将来のクリッピング切替

3. **Phase 2b で本実装しないもの**
   - クリッピング本体
   - 複数レイヤー選択の本体
   - レイヤーフォルダ保存形式の変更
   - ToonSquid 風の全面再設計
   - 独自ドラッグ UI

---

## Gemini が読む順番

1. `AGENTS.md`
2. `TEGAKI.md`
3. `GEMINI.md`
4. `tegaki_work/PROGRESS.md`
5. `tegaki_work/PHASE2_HANDOFF.md`
6. `tegaki_work/ARCHITECTURE.md`
7. `task-gemini/phase2.md`
8. この `task-gemini/phase2b.md`

---

## Gemini への禁止事項

- `ui/layer-panel-renderer.js` を丸ごと上書きしない。
- `ui/layer-panel-renderer.js` を短縮版へ置き換えない。
- `dom-builder.js`、`album-popup.js`、`timeline-ui.js`、`ui-icons.js` へ横展開しない。
- 既存の `style.cssText` を大量に削って CSS へ移さない。
- クリッピング、複数選択、保存形式、履歴形式を実装しない。
- 50 行を超える差分を出さない。必要なら Codex へ戻す。

---

## 完了条件

- `npm.cmd run build` が成功する。
- Console に致命的エラーがない。
- 差分が指示範囲内に収まる。
- `tegaki_work/PROGRESS.md` に、やったことと Codex 判断へ戻すことが短く書かれている。
