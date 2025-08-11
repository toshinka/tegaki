# 📋 デバッグ・監視機能集約化計画書

## 1. 背景と分析

### 現在の状況（Phase2F後）
- **部分的改善済み**: main.jsは既に1,200行→600行にスリム化完了（Phase2F）
- **performance-logger.js**: パフォーマンス測定機能は既に分離済み
- **残存する重複問題**: utils.js経由で依然として重複機能が存在
- **未完了統合**: debug/debug-manager.js, debug/diagnostics.jsが完全統合されていない

### 残存する問題点
- **main.js残存問題**: utils.js経由で`measurePerformance`, `logError`を呼び出し（間接重複）
- **debug/システム未統合**: debug-manager.js, diagnostics.jsの機能が散在
- **監視機能分散**: UI層、コア層、専用層での監視機能重複
- **完全なDRY原則違反解決**: 根本的な重複排除が未完了

### 重複機能の詳細分析（Phase2F後の現状）
| 機能カテゴリ | 現在の実装場所 | 重複度 | 統合先 | Phase2F後の状況 |
|--------------|----------------|--------|--------|----------------|
| Performance Logging | main.js (utils.js経由)<br>debug/performance-logger.js<br>ui/performance-monitor.js | 中 | **debug/performance-logger.js** | 部分的統合済み・重複残存 |
| Error Handling/Logging | main.js (utils.js経由)<br>debug/diagnostics.js | 高 | **debug/diagnostics.js** | 未統合・重複深刻 |
| System Monitoring | monitoring/system-monitor.js<br>main.js (APP_STATE.stats) | 中 | **monitoring/system-monitor.js** | 部分統合・統計情報重複 |
| Debug Management | debug/debug-manager.js<br>main.js (setupSimplifiedDebugFunctions) | 高 | **debug/debug-manager.js** | 未統合・機能分散 |

## 2. 集約方針（DRY・SOLID原則準拠）

### SOLID原則の適用
- **SRP (単一責任原則)**: 各モジュールを単一機能に特化
  - main.js → 初期化処理のみ
  - debug/ → デバッグ・診断専用
  - monitoring/ → システム監視専用
- **OCP (開閉原則)**: インターフェースベースで拡張可能に
- **ISP (インターフェース分離原則)**: 機能別インターフェースの分離
- **DIP (依存性逆転原則)**: 抽象インターフェースによる依存注入

### DRY原則の徹底
- 重複関数を専用モジュールに集約
- 共通インターフェースによる統一API
- 設定ファイルによる統合管理

## 3. 具体的な集約内容

### 3.1 Performance Logging集約 → debug/performance-logger.js

**移譲対象**:
- `main.js`の`measurePerformance()`
- `ui/performance-monitor.js`のパフォーマンス計測部分

**新しいインターフェース**:
```javascript
interface IPerformanceLogger {
  startMeasurement(label: string): string
  endMeasurement(measurementId: string): number
  getPerformanceStats(): PerformanceStats
  resetStats(): void
}
```

### 3.2 Error Handling集約 → debug/diagnostics.js

**移譲対象**:
- `main.js`の`logError()`, `handleGracefulDegradation()`
- 統一エラーハンドリング機能

**新しいインターフェース**:
```javascript
interface IErrorDiagnostics {
  logError(error: Error, context?: string): void
  handleGracefulDegradation(error: Error): boolean
  getErrorStats(): ErrorStats
  setErrorThreshold(maxErrors: number): void
}
```

### 3.3 System Monitoring集約 → monitoring/system-monitor.js

**移譲対象**:
- `main.js`の`APP_STATE.stats`
- システム健全性監視

**新しいインターフェース**:
```javascript
interface ISystemMonitor {
  startMonitoring(): void
  stopMonitoring(): void
  getSystemHealth(): SystemHealth
  getMetrics(): SystemMetrics
}
```

## 4. 実施ステップ（Phase2F完成版）

### Phase 1: 残存重複コード完全分析（0.5日）
1. **Phase2F後の重複検証**
   - main.js内のutils.js経由重複機能特定
   - debug/配下の未統合機能マッピング
   - 間接重複（ラッパー関数経由）の特定

2. **完全統合設計**
   - 残存重複の完全排除設計
   - debug/配下の機能統合アーキテクチャ
   - utils.js依存関係の最適化

### Phase 2: 完全統合実装（1-2日）
1. **Error Handling完全統合**
   - main.js → debug/diagnostics.js完全移譲
   - utils.jsのlogError, handleGracefulDegradation統合
   - グローバルエラーハンドラーの統一

2. **Debug Management完全統合**
   - main.js → debug/debug-manager.js完全移譲
   - setupSimplifiedDebugFunctions移植
   - デバッグ関数の一元管理

3. **Performance Logging最終調整**
   - 既存のperformance-logger.js強化
   - utils.js経由の間接重複排除
   - main.jsからの完全分離

### Phase 3: main.js最終スリム化（0.5日）
1. **utils.js依存最適化**
   - 不要なutils.js関数呼び出し除去
   - 必要最小限の依存関係に削減
   - 初期化処理のみに完全特化

2. **完全分離確認**
   - 監視・デバッグ機能の完全外部化
   - main.jsの単一責任原則完全準拠
   - DRY原則違反の完全解消

### Phase 4: 統合テスト・検証（0.5日）
1. **完全統合テスト**
   - 分離されたシステムの個別動作確認
   - 統合連携の正常性確認
   - エラー分離・graceful degradation確認

2. **Phase2F完成版リリース**
   - v1rev13としてタグ付け
   - 完全なDRY・SOLID原則準拠確認
   - ドキュメント更新

## 5. 修繕後の構成

### ファイル構成（Phase2F完成版）
```
futaba-drawing-tool/
├── main.js                    # 初期化のみ（完全スリム化・600行→400行）
├── utils.js                   # 基本ユーティリティのみ（デバッグ機能除去）
├── debug/
│   ├── debug-manager.js       # デバッグ統合管理（完全統合）
│   ├── diagnostics.js         # エラーハンドリング・診断（完全統合）
│   └── performance-logger.js  # パフォーマンス計測（Phase2F完成）
├── monitoring/
│   └── system-monitor.js      # システム監視（統計機能統合）
└── ui/
    └── performance-monitor.js # UI専用監視（表示のみ・重複除去）
```

### 責務の明確化
- **main.js**: アプリケーション初期化のみ
- **debug/**: 開発・デバッグ支援機能
- **monitoring/**: 運用監視機能
- **ui/**: UI表示・制御機能

## 6. 成功基準

### 定量的指標（Phase2F完成版）
- **重複コード削除率**: 100%（間接重複含む完全排除）
- **ファイルサイズ削減**: main.js 追加33%削減（600行→400行）
- **機能統合**: debug/配下4モジュールの完全統合
- **utils.js最適化**: デバッグ関連機能の完全分離
- **テストカバレッジ**: 80%以上

### 定性的指標
- **保守性**: 機能追加時の影響範囲限定
- **可読性**: モジュール責務の明確化
- **拡張性**: 新機能追加の容易さ
- **安定性**: エラー分離・graceful degradation

## 7. リスク管理

### 想定リスク
1. **機能破綻リスク**: 集約時の機能欠損
2. **パフォーマンス劣化**: 依存注入による間接参照
3. **互換性問題**: 既存コードとのインターフェース変更

### 緩和策
1. **段階的移行**: 機能単位での漸進的集約
2. **フォールバック機能**: エラー時の基本機能維持
3. **互換性レイヤー**: 既存APIの一時的維持

## 8. AI癖抑制ガイドライン

### ルール強化
```
デバッグ、モニタリング、パフォーマンスログ、診断機能の追加・修正時は：

1. 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認
2. 重複を避け、既存機能の拡張を優先
3. 新機能は専用ディレクトリに集約
4. main.jsには監視・デバッグ機能を追加しない
5. DRY・SOLID原則の厳守
6. 機能マッピング表を更新してから実装
7. 重複疑いの場合、事前レビュー要求
```

### 実装パターン
- **DO**: `import { performanceLogger } from './debug/performance-logger.js'`
- **DON'T**: main.jsに直接パフォーマンス計測コードを追加

## 9. 次段階への準備

### ペンツール移譲への最適化
1. **安定したデバッグ基盤**: Phase2F完成によりUI改修時のエラー追跡・診断が完全自動化
2. **完全監視システム**: ポップアップ機能破損の即座検出・自動修復
3. **統合診断機能**: 複雑な依存関係のトラブルシューティング完全対応
4. **エラー分離**: UI改修がデバッグ機能に影響しない完全分離体制

このPhase2F完成により、ペンツール移譲時の安定性と追跡可能性が完全に保証され、「AIによる改修時の意図しない機能削除」問題が根本的に解決されます。SOLID・DRY原則に完全準拠した保守しやすいコードベースが実現され、将来の拡張も安全に実行できます。
