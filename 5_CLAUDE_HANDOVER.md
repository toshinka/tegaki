# Claude引き継ぎ専用ガイド v4.1

**対象**: Claude間作業継続・引き継ぎ最適化  
**更新**: 2025年8月4日 - 冗長性削除・情報密度最適化

## 🎯 現在状況（即座把握）

### プロジェクト状態
```
✅ ドキュメント完備:
PROJECT_SPEC.md(要件) | TECHNICAL_DESIGN.md(設計) | 
IMPLEMENTATION_GUIDE.md(実装) | UI_STYLE_GUIDE.md(デザイン)

🎯 戦略: 戦略B+理想要素（確実基盤→段階高性能化）
🔥 次回: Phase1基盤構築（2-3週間・成功率95%）
```

### 変更禁止事項（プロジェクト基盤）
```
🚫 対象環境: 2560×1440液タブレット特化・タッチ非対応
🚫 技術: PixiJS v8.11.0・TypeScript厳格・EventBus疎結合
🚫 色彩: ふたば色(#800000,#f0e0d6)・WCAG AAA準拠
🚫 性能: Tier1=60FPS・1GB・5ms / Tier2=30FPS・512MB・16ms
```

## 🚀 次回実装（Phase1・即座開始）

### 実装順序（IMPLEMENTATION_GUIDE.md詳細参照）
```
Step1: 環境構築（30分）
├─ npm create vite + PixiJS v8.11.0 + TypeScript
└─ ディレクトリ: src/core,input,tools,ui,types

Step2-6: 基盤システム（5-6時間）
├─ PixiApplication.ts(60分) - WebGL2初期化・2560×1440
├─ EventBus.ts(45分) - 型安全通信・IEventData
├─ InputManager.ts(90分) - PointerEvents・筆圧・座標変換
├─ DrawingEngine.ts(75分) - Graphics・スムージング・色管理
└─ UIManager.ts(60分) - 2.5Kレイアウト・ふたば色・基本UI
```

### 完了判定基準
```
✅ 必須: 基本描画動作・色選択・マウス/ペン入力・60FPS・300MB以下⚠️ 延期: 30FPS未満・500MB超過・クラッシュ・基本機能欠如
```

## 🔄 継続作業・品質保証

### Phase1→Phase2移行判断
```
移行可能: 上記必須項目完全クリア + TypeScript厳格エラー0
移行延期: 性能・安定性・基本機能の重大問題存在
Phase2準備: WebGPU検出・レイヤーContainer・高度ツール・エクスポート
```

### 次回確認事項（チャット開始時）
```
1. Phase1実装状況: 完了項目・残課題・性能測定結果
2. 技術変更: 設計修正・実装変更・問題対応・性能調整
3. Phase2準備: 移行可否・優先項目・リスク・品質目標
```

## ⚠️ 重要制約・注意事項

### 成功要因（必須遵守）
```
✅ 段階実装厳守・責任分界明確・インターフェース先行・エラー処理重視・性能基準遵守
❌ 複数機能混在・段階飛ばし・制約無視・性能軽視・色システム変更回避
```

### 技術課題・対策
```
WebGPU不安定性 → WebGL2フォールバック必須・Phase1はWebGL2確実
2.5K環境最適化 → DPR対応・サブピクセル精度・実機テスト必要
液タブレット対応 → 筆圧カーブ・デバイス差異・設定保存・調整機能
```

---
**Phase1確実完了→Phase2段階向上→最終理想達成により、Claude協業最適化とプロジェクト成功を確保**