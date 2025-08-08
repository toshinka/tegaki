# TypeScript コーディング規約 v4.0

**ドキュメント**: プロジェクト専用TypeScript開発標準  
**対象読者**: 開発者・Claude・新規参加者  
**最終更新**: 2025年8月7日  
**関連文書**: `2_TECHNICAL_DESIGN.md`, `3_IMPLEMENTATION_GUIDE.md`, `6_Claude_Master_Rulebook.md`

## 🎯 **目的・スコープ**

### **対象プロジェクト**
- **プロジェクト名**: モダンお絵かきツール v4.0
- **技術スタック**: TypeScript + Vite + PixiJS v8
- **環境設定**: Node.js 18+, Chrome/Edge/Firefox対応

### **このドキュメントの役割**
```
✅ TypeScript特有のコーディング規則
✅ Vite環境に最適化された設定
✅ PixiJS v8との統合パターン
✅ Claude連携時の標準指示
✅ 品質保証・自動化設定
```

---

## 📋 **インポート記述規則（最重要）**

### **🔴 基本原則: 拡張子なしインポート**

#### **正しいインポート記述**
```typescript
// ✅ 相対インポート - 拡張子なし
import { EventBus } from '../core/EventBus';
import { DrawingEngine } from './DrawingEngine';
import { PenTool } from '../tools/PenTool';

// ✅ 絶対インポート - パッケージ
import * as PIXI from 'pixi.js';
import { defineConfig } from 'vite';

// ✅ 型のみインポート
import type { IEventData } from '../types/events';
import type { Application } from 'pixi.js';
```

#### **❌ 禁止されたインポート記述**
```typescript
// ❌ .js拡張子使用禁止
import { EventBus } from '../core/EventBus.js';
import { DrawingEngine } from './DrawingEngine.js';

// ❌ .ts拡張子（型定義以外）
import { PenTool } from '../tools/PenTool.ts';

// ❌ 不正な相対パス
import { Utils } from '../../../../../../utils/common';
```

### **技術的根拠**
```json
// tsconfig.json設定との整合性
{
  "compilerOptions": {
    "moduleResolution": "bundler",     // Vite使用時の標準
    "allowImportingTsExtensions": true, // .ts拡張子のみ特別許可
    "verbatimModuleSyntax": false      // 柔軟なインポート構文
  }
}
```

---

## 🏗️ **プロジェクト構造・命名規約**

### **ディレクトリ構造**
```
src/
├── core/           # 基盤システム（EventBus, PixiApplication）
├── rendering/      # 描画エンジン（DrawingEngine, ShaderManager）
├── input/          # 入力処理（InputManager, GestureManager）
├── tools/          # 描画ツール（PenTool, BrushTool, EraserTool）
├── ui/             # UI管理（UIManager, Toolbar, ColorPalette）
├── constants/      # 定数定義（Colors, Settings, Performance）
├── types/          # 型定義（interfaces, enums）
└── utils/          # 汎用ユーティリティ
```

### **ファイル命名規則**
```typescript
// ✅ PascalCase - クラス・インターフェース
EventBus.ts
DrawingEngine.ts  
IEventData.ts

// ✅ camelCase - 関数・ユーティリティ
mathUtils.ts
colorHelpers.ts

// ✅ UPPER_SNAKE_CASE - 定数
FUTABA_COLORS.ts
PERFORMANCE_SETTINGS.ts

// ✅ kebab-case - 設定ファイル
vite.config.ts
tsconfig.json
```

---

## 🎨 **型定義・インターフェース設計**

### **インターフェース命名**
```typescript
// ✅ I接頭辞 - インターフェース
export interface IEventData {
  'drawing:start': DrawingStartData;
  'drawing:move': DrawingMoveData;
}

export interface IDrawingTool {
  readonly name: string;
  activate(): void;
  deactivate(): void;
}

// ✅ Type接尾辞 - 型エイリアス
export type RendererType = 'webgpu' | 'webgl2' | 'webgl';
export type ToolCategory = 'drawing' | 'editing' | 'selection';
```

### **厳密な型チェック**
```typescript
// ✅ 厳密なnull/undefined制御
function processPoint(point: PIXI.Point | null): void {
  if (point === null) return;
  // point はここで PIXI.Point として扱える
  console.log(point.x, point.y);
}

// ✅ ユニオン型の適切な使用
type EventResult = 'success' | 'error' | 'pending';

// ✅ ジェネリクスの活用
export class EventBus {
  public on<K extends keyof IEventData>(
    event: K,
    callback: (data: IEventData[K]) => void
  ): () => void {
    // 型安全なイベント処理
  }
}
```

---

## ⚡ **性能・メモリ管理パターン**

### **PixiJS v8 最適化パターン**
```typescript
// ✅ Graphics最適化
export class DrawingEngine {
  private optimizeGraphics(graphics: PIXI.Graphics): void {
    // バッチング最適化
    graphics.finishPoly();
    
    // 複雑度制限
    if (this.strokePoints.length > 500) {
      this.simplifyStroke();
    }
  }

  // ✅ メモリリーク防止
  public destroy(): void {
    if (this.drawingContainer) {
      this.drawingContainer.destroy({ children: true });
      this.drawingContainer = null;
    }
  }
}
```

### **イベントリスナー管理**
```typescript
// ✅ 自動解除パターン
export class InputManager {
  private cleanupFunctions: Array<() => void> = [];

  constructor() {
    // 自動解除関数を保存
    this.cleanupFunctions.push(
      this.eventBus.on('drawing:start', this.onDrawingStart.bind(this))
    );
  }

  public destroy(): void {
    // 一括解除
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
  }
}
```

---

## 🔧 **設定ファイル・環境設定**

### **tsconfig.json 標準設定**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext", 
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### **ESLint設定 `.eslintrc.json`**
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    // インポート拡張子制御
    "import/extensions": [
      "error",
      "ignorePackages", 
      {
        "ts": "never",
        "tsx": "never",
        "js": "never", 
        "jsx": "never"
      }
    ],
    // TypeScript厳格ルール
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/prefer-const": "error",
    // プロジェクト固有ルール
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### **Prettier設定 `.prettierrc`**
```json
{
  "semi": true,
  "trailingComma": "es5", 
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

---

## 🤖 **Claude連携・AI開発支援**

### **標準指示テンプレート**
```markdown
## Claude実装時の必須指示

TypeScript + Vite + PixiJS v8環境での実装。以下を厳守：

✅ **インポート**: 拡張子なし記述 `import { X } from './file'`
✅ **型安全**: strictモード準拠、any禁止、null/undefined明示
✅ **命名規約**: PascalCase(クラス), camelCase(関数), I接頭辞(interface)
✅ **PixiJS v8**: 最新API使用、Graphics最適化、メモリ管理
✅ **性能重視**: 60FPS目標、GPU最適化、メモリリーク防止

❌ **禁止事項**: .js拡張子、any型、メモリリーク、非最適化コード
```

### **コード生成品質チェック項目**
```typescript
// ✅ チェックリスト
interface CodeQualityCheck {
  // 基本品質
  noJsExtensions: boolean;        // .js拡張子なし
  strictTyping: boolean;          // 厳密な型定義
  properNaming: boolean;          // 命名規約準拠
  
  // PixiJS統合
  pixiV8Api: boolean;            // v8 API使用
  memoryManagement: boolean;      // destroy()実装
  performanceOptimized: boolean;  // GPU最適化
  
  // プロジェクト整合性
  eventBusIntegration: boolean;   // EventBus活用
  errorHandling: boolean;         // 例外処理
  documentationPresent: boolean;  // JSDoc記述
}
```

---

## 🛠️ **開発環境・ツール設定**

### **VSCode設定 `.vscode/settings.json`**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

### **package.json スクリプト**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit", 
    "format": "prettier --write 'src/**/*.{ts,tsx}'",
    "validate": "npm run type-check && npm run lint",
    "validate-imports": "bash scripts/validate-imports.sh"
  }
}
```

### **自動検証スクリプト `scripts/validate-imports.sh`**
```bash
#!/bin/bash

echo "🔍 インポート記述検証開始..."

# .js拡張子チェック
if grep -r "\.js['\"]" src/; then
  echo "❌ 不正な.js拡張子が検出されました"
  echo "修正方法: import文から.jsを削除してください"
  exit 1
fi

# 相対パス深度チェック  
if grep -r "import.*'\.\./\.\./\.\./\.\." src/; then
  echo "❌ 過度な相対パス参照が検出されました"
  echo "修正方法: 絶対インポートまたは構造見直しを検討してください"
  exit 1
fi

echo "✅ インポート記述は正常です"
exit 0
```

---

## 🧪 **テスト・品質保証**

### **単体テスト標準パターン**
```typescript
// tests/core/EventBus.test.ts
import { EventBus, IEventData } from '../../src/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.destroy();
  });

  it('should emit and receive typed events', () => {
    const mockCallback = jest.fn();
    
    eventBus.on('ui:color-change', mockCallback);
    eventBus.emit('ui:color-change', { 
      color: 0x800000, 
      previousColor: 0x000000 
    });
    
    expect(mockCallback).toHaveBeenCalledWith({
      color: 0x800000,
      previousColor: 0x000000
    });
  });
});
```

### **型チェック自動化**
```typescript
// scripts/type-check.ts
import { execSync } from 'child_process';

try {
  console.log('🔍 TypeScript型チェック実行中...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ 型チェック成功');
  
  execSync('npx eslint src --ext .ts', { stdio: 'inherit' });
  console.log('✅ ESLintチェック成功');
  
} catch (error) {
  console.error('❌ 品質チェック失敗');
  process.exit(1);
}
```

---

## 📊 **性能・品質指標**

### **コード品質メトリクス**
```
✅ 目標品質レベル:

📈 TypeScript品質:
├─ 型カバレッジ: 95%以上（any型5%未満）
├─ ESLintエラー: 0件（警告10件以下）
├─ 未使用変数/関数: 0件
└─ 型安全性: strict準拠100%

🎯 インポート品質:
├─ .js拡張子使用: 0件（完全禁止）
├─ 相対パス深度: 3階層以下
├─ 循環参照: 0件
└─ 未解決インポート: 0件

⚡ 性能品質:  
├─ バンドルサイズ: 2MB以下
├─ 型チェック時間: 30秒以下
├─ ビルド時間: 60秒以下
└─ 開発サーバー起動: 5秒以下
```

### **品質保証チェックリスト**
```markdown
## Pre-commit Hook チェック項目

🔍 **自動実行項目**:
- [ ] TypeScript型チェック (tsc --noEmit)
- [ ] ESLint検証 (eslint src --ext .ts)
- [ ] インポート記述検証 (validate-imports.sh)
- [ ] Prettier フォーマット確認
- [ ] 未使用コード検出

⚠️ **手動確認項目**:
- [ ] PixiJS v8 API使用確認
- [ ] メモリリーク防止実装
- [ ] エラーハンドリング実装  
- [ ] JSDocコメント記述
- [ ] 型安全性確保
```

---

## 🚨 **よくある問題・トラブルシューティング**

### **インポートエラー解決**
```typescript
// ❌ エラー: Cannot find module './EventBus.js'  
import { EventBus } from './EventBus.js';

// ✅ 解決: 拡張子削除
import { EventBus } from './EventBus';

// ❌ エラー: Module resolution failed
import { Utils } from '../../../../utils';

// ✅ 解決: 適切な相対パスまたは絶対インポート
import { Utils } from '../../../utils';
// または
import { Utils } from '@/utils'; // パスエイリアス設定時
```

### **型エラー解決パターン**
```typescript
// ❌ エラー: Property 'app' possibly null
this.pixiApp.stage.addChild(container);

// ✅ 解決: null チェック実装
if (this.pixiApp) {
  this.pixiApp.stage.addChild(container);
}

// ❌ エラー: Argument of type 'any' not assignable
const color: number = getColor();

// ✅ 解決: 明示的型変換・検証
const color: number = getColor() as number;
// または型ガード実装
if (typeof getColor() === 'number') {
  const color: number = getColor();
}
```

---

## 📚 **参考資料・関連文書**

### **プロジェクト内文書**
- **`2_TECHNICAL_DESIGN.md`**: アーキテクチャ設計・技術選択理由
- **`3_IMPLEMENTATION_GUIDE.md`**: 段階的実装手順・具体的コード例  
- **`6_Claude_Master_Rulebook.md`**: Claude連携・AI開発支援指針

### **外部技術文書**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PixiJS v8 Documentation](https://pixijs.com/8.x/guides)
- [Vite Configuration](https://vitejs.dev/config/)
- [ESLint TypeScript Rules](https://typescript-eslint.io/rules/)

---

**このコーディング規約により、高品質で一貫性のあるTypeScriptコードベースを維持し、チーム開発・AI連携の効率化を実現します。**