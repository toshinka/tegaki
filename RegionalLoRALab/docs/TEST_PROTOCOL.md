# Regional LoRA Lab - Test Protocol & Evaluation Framework

---

## 1. 対照実験プロトコル (Controlled Experiment Protocol)

同一条件（同 Seed, 同 Checkpoint, 同 Sampler, 同 Resolution, 同 Prompt）において、以下の5パターンを比較生成する：

1. **Control 0**: LoRA なし (Baseline)
2. **Control 1**: LoRA A 全体適用 (Global A)
3. **Control 2**: LoRA B 全体適用 (Global B)
4. **Control 3**: LoRA A + B 同時全体適用 (Global A+B)
5. **Experimental**: Regional LoRA Lab ON (左=LoRA A, 右=LoRA B)

---

## 2. 評価基準 (Success Criteria)

- **左領域**: LoRA A の特徴が発現し、LoRA B の特徴が混入していないこと。
- **右領域**: LoRA B の特徴が発現し、LoRA A の特徴が混入していないこと。
- **対照比較**: Control 3 (Global A+B) に比べて、左右それぞれの領域への反対側 LoRA の漏洩（Style / Character leakage）が明確に低減していること。
- **非汚染性**: Regional LoRA Lab を OFF にした後の生成が、Control 0 と完全に一致すること（Patch state の非残留）。
