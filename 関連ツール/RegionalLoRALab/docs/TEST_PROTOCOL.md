# Regional LoRA Lab - Test Protocol & Evaluation Framework

---

## 1. 決定論的リファレンスモード (Deterministic Reference Mode)

モデル汚染や再現性を検証する前提として、以下の固定条件を設定する：

- **同一 Seed /同一 Sampler / 同一 Scheduler**
- **同一 Checkpoint / 同一 Resolution (832×1216 等)**
- **Batch Size = 1**
- **他 Extension OFF**

### ベース再現性の測定
1. RLL を使用しない状態で、同一 Seed で 2 回生成を行う。
2. その環境における通常 run-to-run 差（bit-exact か、微小な非決定性差分があるか）を事前に測定・記録する。

---

## 2. 対照実験プロトコル (Controlled Experiment Protocol)

同一条件において、以下の 5 パターンを比較生成する：

1. **Control 0**: LoRA なし (Baseline)
2. **Control 1**: LoRA A 全体適用 (Global A)
3. **Control 2**: LoRA B 全体適用 (Global B)
4. **Control 3**: LoRA A + B 同時全体適用 (Global A+B)
5. **Experimental**: Regional LoRA Lab ON (左=LoRA A, 右=LoRA B)

---

## 3. 評価基準 (Success Criteria)

- **左領域**: LoRA A の特徴が発現し、LoRA B の特徴が混入していないこと。
- **右領域**: LoRA B の特徴が発現し、LoRA A の特徴が混入していないこと。
- **対照比較**: Control 3 (Global A+B) に比べて、反対側領域への LoRA 漏洩が明確に低減していること。
- **非汚染性 (Contamination Test)**:
  - RLL を ON にして生成した後、RLL を OFF にして同 Seed で再生成。
  - 生成された画像と Control 0（または WebUI 再起動後 reference）の差が、事前測定した通常の run-to-run 差の範囲内に収まること。
