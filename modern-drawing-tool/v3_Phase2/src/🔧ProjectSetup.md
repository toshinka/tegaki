\# モダンお絵かきツール - プロジェクト構成・実行手順



\## 📂 プロジェクト構成



```

modern-drawing-tool/

├── index.html                     # メインHTML（既存）

├── package.json                   # 依存関係設定（既存）

├── vite.config.js                 # Vite設定（新規作成）

├── src/                           # ソースコードディレクトリ

│   ├── main.js                    # メインアプリケーション

│   ├── OGLDrawingCore.js          # OGL統一描画エンジン

│   ├── EventStore.js              # mitt.js統一イベントバス

│   ├── OGLInputController.js      # 入力処理統合

│   ├── ShortcutController.js      # ショートカット専門

│   ├── HistoryController.js       # アンドゥ・リドゥ制御

│   ├── ToolProcessor.js           # ツール処理統合

│   ├── UIController.js            # Fresco風UI制御統合

│   ├── ColorProcessor.js          # ふたば色・色処理統合

│   ├── LayerProcessor.js          # レイヤー処理統合

│   └── stores/                    # 状態管理（Phase3で使用予定）

└── README.md                      # プロジェクト説明

```



\## 🚀 実行手順



\### 1. ファイル配置



\#### src/ディレクトリ作成

```bash

mkdir -p src

```



\#### 実装済みファイルを src/ に配置

以下のファイルを `src/` ディレクトリに配置してください：



\- `main.js` - メインアプリケーション（Phase1+Phase2統合版）

\- `OGLDrawingCore.js` - OGL統一描画エンジン

\- `EventStore.js` - mitt.js統一イベントバス

\- `OGLInputController.js` - 入力処理統合

\- `ShortcutController.js` - ショートカット専門

\- `HistoryController.js` - アンドゥ・リドゥ制御

\- `ToolProcessor.js` - ツール処理統合

\- `UIController.js` - Fresco風UI制御統合

\- `ColorProcessor.js` - ふたば色・色処理統合

\- `LayerProcessor.js` - レイヤー処理統合



\#### vite.config.js配置

プロジェクトルートに `vite.config.js` を配置してください。



\### 2. 依存関係確認・インストール



\#### 現在のpackage.json確認

既存のpackage.jsonに必要なライブラリは含まれています：

\- `ogl` - WebGL描画エンジン

\- `mitt` - 軽量イベントバス

\- `chroma-js` - 色処理ライブラリ

\- `lodash-es` - ユーティリティライブラリ

\- `phosphor-icons` - アイコンライブラリ



\#### 追加パッケージインストール（もし不足していれば）

```bash

npm install

```



\### 3. 開発サーバー起動



```bash

npm run dev

```



または



```bash

npx vite

```



ブラウザで `http://localhost:3000` にアクセス



\### 4. 動作確認



\#### ✅ 確認すべき機能



\*\*Phase1機能:\*\*

\- OGL描画エンジンの初期化

\- ペンツールでの基本描画

\- マウス・ペンタブレット入力

\- ショートカット（Ctrl+Z, Ctrl+Y, P, E, A, B等）

\- アンドゥ・リドゥ機能



\*\*Phase2機能:\*\*

\- 左サイドバーのツールアイコン

\- ツールクリック時のポップアップ表示

\- ツール設定変更（サイズ、不透明度等）

\- カラーピッカー表示

\- ふたば☆ちゃんねる色パレット

\- レイヤー作成・削除・切り替え

\- UI表示切替（Tabキー）



\#### 🔧 デバッグコンソール

ブラウザの開発者ツールで以下のコマンドが使用可能：



```javascript

// メインアプリケーション参照

window.drawingApp



// OGLエンジン直接操作

window.debugOGL



// イベント確認

window.debugEventStore.getEventStats()



// ツール情報確認

window.debugTools.getAllTools()



// 色処理確認

window.debugColors.getCurrentColorInfo()



// レイヤー確認

window.debugLayers.getLayersForUI()



// システム状態確認

window.getSystemStatus()

```



\## 🎨 使用方法



\### 基本操作

1\. \*\*描画\*\*: ペンツールを選択してキャンバス上でドラッグ

2\. \*\*ツール切り替\*\*: 左サイドバーのアイコンクリック、またはショートカット（P/E/A/B）

3\. \*\*ツール設定\*\*: ツールアイコンクリック後に表示されるポップアップで調整

4\. \*\*色変更\*\*: カラーピッカーアイコンクリック（実装済み）

5\. \*\*レイヤー操作\*\*: レイヤーパネルで作成・削除・切り替え

6\. \*\*UI切り替え\*\*: Tabキーで表示/非表示

7\. \*\*アンドゥ・リドゥ\*\*: Ctrl+Z / Ctrl+Y



\### ショートカット一覧

\- `P` - ペンツール

\- `E` - 消しゴムツール  

\- `A` - エアスプレーツール

\- `B` - ボカシツール

\- `Ctrl+Z` - アンドゥ

\- `Ctrl+Y` - リドゥ

\- `Tab` - UI表示切替

\- `F` - フルスクリーン切替

\- `H` - キャンバス左右反転

\- `Shift+H` - キャンバス上下反転



\## 🐛 トラブルシューティング



\### WebGLエラーが発生する場合

1\. ブラウザのWebGL設定を確認

2\. ハードウェアアクセラレーションを有効化

3\. 最新のブラウザバージョンに更新



\### 依存関係エラーが発生する場合

```bash

rm -rf node\_modules package-lock.json

npm install

```



\### ポート3000が使用中の場合

```bash

npm run dev -- --port 3001

```



\## 📋 実装状況



\### ✅ Phase1完了（OGL統一基盤）

\- OGL統一描画エンジン

\- EventStore統一イベント管理

\- 入力処理（マウス・ペンタブレット）

\- ショートカット制御

\- 履歴管理（アンドゥ・リドゥ）



\### ✅ Phase2ほぼ完了（ツール・UI・カラー統合）

\- ツール処理統合（全基本ツール実装）

\- Fresco風UI（左サイドバー・ポップアップ）

\- ふたば☆ちゃんねる色処理

\- レイヤー処理統合

\- \*\*残件\*\*: CanvasController（キャンバス操作）



\### 🔄 Phase3予定（高度機能）

\- 高度ツール（範囲選択拡張、図形ツール）

\- LIVE2D風メッシュ変形

\- Storyboarder風アニメーション機能

\- ファイル操作（保存・読み込み）



\## 🔧 開発者向け情報



\### アーキテクチャ原則

\- \*\*OGL統一制約\*\*: 全描画処理をOGL WebGLで統一

\- \*\*EventStore基盤\*\*: mitt.jsによる統一イベント管理

\- \*\*責任分界\*\*: 各ファイルが明確な責務を持つ

\- \*\*段階的封印\*\*: Phase完成時の品質保証

\- \*\*モダンライブラリ活用\*\*: 車輪の再発明防止



\### コーディング規約

\- ES6 modules使用

\- 明確な命名規則（Manager/Helper等禁止）

\- コンソールログによる動作確認

\- エラーハンドリング必須



\### Phase段階的実装戦略

1\. \*\*Phase1\*\*: 基盤機能の確実な実装・封印

2\. \*\*Phase2\*\*: UI・ツール機能の統合・封印

3\. \*\*Phase3\*\*: 高度機能の実装・完成



この戦略により、各Phaseで確実に動作する状態を維持しながら段階的に機能を追加できます。

