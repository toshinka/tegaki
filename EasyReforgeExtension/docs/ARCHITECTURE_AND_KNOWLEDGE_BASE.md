# EasyReforge Manga Prompter - アーキテクチャ設計書 ＆ 実験知見アーカイブ

本ドキュメントは、EasyReforge (SD WebUI Forge / reForge) 上で動作する漫画コマ割り生成拡張機能「Manga Region Prompter」の設計思想、実験履歴、失敗・成功の知見、および技術的アーキテクチャを体系的に記録したナレッジベースです。

---

## 1. 開発の背景と目的

Stable Diffusion（特に SDXL / Illustrious 系モデル）において、1ページの漫画（3〜5コマ等）を生成する際、以下の2大課題が存在する：
1. **レイアウト（コマ割り枠線）の制御**: 意図したコマ数・比率・形状で枠線を描かせることの難しさ。
2. **コンテンツ（プロンプト）の領域分離**: コマ1には女の子、コマ2には空と海、コマ3には男の子といったように、意図したコマの中に狙った被写体・構図を100%描き分けることの難しさ。

---

## 2. 実験履歴・成功と失敗のメカニズム分析

### ① プロンプト構文とモデルの解釈特性
| プロンプト構造 | モデルの挙動 (SDXL/Illustrious) | 分析・知見 |
| :--- | :--- | :--- |
| `3koma manga... BREAK sky... BREAK 1boy...` | **3コマ漫画として分離（初期成功）** | チャンク数＝コマ数が一致し、全体構図と被写体が素直に解釈された。 |
| `3koma...` を全コマに自動結合（Common Prepend） | **1枚絵に崩壊（女の子1人のみ）** | 各コマの狭い空間マスクの中で「3コマ漫画全体を描け」という矛盾命令になり破綻。 |
| **v3.7.2: PAGE と STYLE の分離 (N + 2 構造)** | **全体構図とコマ別被写体の干渉を根絶** | `3koma`（PAGE）はメインコンディショニングにのみ渡し、各コマには `STYLE`（画風）＋被写体のみを注入。 |

### ② ControlNet（線画・コマ枠）との併用実験
| 設定 | 出力結果 | メカニズム分析 |
| :--- | :--- | :--- |
| **拡張OFF ＋ ControlNet ON** | **キャンバス通りのコマ割り（上1・下2）が100%完璧に出力** | ControlNet（AnyTest/Lineart）がForgeの `ModelPatcher` を通じて正常に機能し、線画枠線を完全固定。 |
| **旧拡張ON ＋ ControlNet ON** | **コマ割りが破壊され、5コマの女の子の顔が増殖** | 旧拡張が `CrossAttention.forward` を直接モンキーパッチしたため、ControlNetの制御信号を破壊。 |
| **v3.7.2 ON (ModelPatcher Native + GLOBAL Split)** | **ControlNet完全共存 ＋ コマ別プロンプト完全分離** | Forge公式 `ModelPatcher` API + main conditioning 縮小により、全画面への被写体漏れを遮断。 |

---

## 3. v3.7.2 確定プロンプト文法（N + 2 構造）

3コマの場合、メインPositive Promptは以下の **5 chunk** で構成されます：

```text
3koma, manga page, comic strip, comic panel               ← chunk 0: PAGE STRUCTURE (全体コマ構造)
BREAK
masterpiece, best quality, monochrome, manga ink, lineart ← chunk 1: GLOBAL STYLE (全体共通画風)
BREAK
koma 1: close-up, 1girl, standing                        ← chunk 2: REGION 1 (コマ1の被写体)
BREAK
koma 2: wide shot, sky, ocean                            ← chunk 3: REGION 2 (コマ2の被写体)
BREAK
koma 4: medium shot, 1boy, sitting                       ← chunk 4: REGION 3 (コマ3の被写体)
```

### 【内部ディスパッチの仕組み】
- **WebUI Main Conditioning**: `PAGE STRUCTURE, GLOBAL STYLE` のみ（Region本文は除去され、全画面への漏れを防止）。
- **Region 1 Conditioning**: `GLOBAL STYLE, close-up, 1girl, standing`（PAGEは入れない）。
- **Region 2 Conditioning**: `GLOBAL STYLE, wide shot, sky, ocean`（PAGEは入れない）。
- **Region 3 Conditioning**: `GLOBAL STYLE, medium shot, 1boy, sitting`（PAGEは入れない）。
- **base_mask**: 強制 `0`（ゼロ）。
