"""
EasyReforge Manga Prompter
メインスクリプト & Gradio UI
Forge ModelPatcher ネイティブエンジン (v3.6 Clean Condition Dispatch)
"""

import os
import sys
import re
import traceback
import torch
import gradio as gr
import modules.scripts as scripts
from modules import shared
from modules.prompt_parser import SdConditioning

cur_dir = os.path.dirname(os.path.abspath(__file__))
if cur_dir not in sys.path:
    sys.path.insert(0, cur_dir)

try:
    from manga_spatial_engine import MangaSpatialEngine
    from manga_attention import MangaModelPatcherHook
except Exception:
    from scripts.manga_spatial_engine import MangaSpatialEngine
    from scripts.manga_attention import MangaModelPatcherHook

def empty_tensor(h: int, w: int):
    return torch.zeros((h, w)).unsqueeze(0)

class MangaPrompterScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.patcher_hook = MangaModelPatcherHook()
        self.active_unet = None
        self.original_prompt = None

    def title(self):
        return "Manga Region Prompter (EasyReforge)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("🎨 Manga Region Prompter (漫画コマ割りプロンプター)", open=True, elem_id="manga-prompter-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable)", value=False, elem_id="manga-prompter-enabled")
                base_weight = gr.Slider(label="全体画風の強度 (Base Style Weight)", minimum=0.0, maximum=0.5, step=0.05, value=0.1, info="全体プロンプト（1行目）を全コマの下地に敷く割合")

            manga_html = gr.HTML(value="""
            <div id="manga-prompter-root">
                <div class="manga-header-bar">
                    <div class="manga-header-title">
                        <span>📖 1P漫画 コマ割りキャンバス</span>
                        <span class="manga-res-badge" id="manga-res-display">832 × 1216 (自動同期中)</span>
                    </div>
                    <div class="manga-toolbar">
                        <button type="button" class="manga-btn" id="manga-btn-viewmode" onclick="window.mangaPrompterToggleViewMode()" title="カラー確認と白黒線画（ControlNet用）の表示切替">🎨 カラー表示</button>
                        <button type="button" class="manga-btn manga-btn-highlight" onclick="window.mangaPrompterExportLineart()" title="現在のコマ枠を綺麗な白黒PNG画像として保存（ControlNetにD&D用）">📸 コマ枠PNG保存</button>
                        <button type="button" class="manga-btn" id="manga-btn-undo" onclick="window.mangaPrompterUndo()" title="元に戻す (Ctrl+Z)">↶ 戻す</button>
                        <button type="button" class="manga-btn" id="manga-btn-redo" onclick="window.mangaPrompterRedo()" title="やり直す (Ctrl+Y)">↷ やり直す</button>
                        <button type="button" class="manga-btn" onclick="window.mangaPrompterReset()" title="1コマ(全体)に戻す">全初期化</button>
                    </div>
                </div>

                <!-- ツール＆操作バー -->
                <div class="manga-toolbar-main">
                    <button type="button" class="manga-btn manga-btn-primary" onclick="window.mangaPrompterSplit('h')" title="選択中のコマを横に2分割">＋ 横スラッシュ</button>
                    <button type="button" class="manga-btn manga-btn-primary" onclick="window.mangaPrompterSplit('v')" title="選択中のコマを縦に2分割">＋ 縦スラッシュ</button>
                    <button type="button" class="manga-btn" id="manga-btn-draw-rect" onclick="window.mangaPrompterToggleDrawRect()" title="キャンバス上をドラッグして自由な四角形コマを作成">＋ 矩形ドラッグ作成</button>
                    <button type="button" class="manga-btn" onclick="window.mangaPrompterAddInset()" title="選択中のコマ内にカットイン小ゴマを配置">🔲 カットイン(入れ子)</button>
                    <button type="button" class="manga-btn" id="manga-btn-merge" onclick="window.mangaPrompterMerge()" title="選択中の複数コマまたは隣接コマを合体">🔗 コマを結合</button>
                    <button type="button" class="manga-btn manga-btn-highlight" onclick="window.mangaPrompterInsertTemplateToMainPrompt()" title="メインプロンプト欄に現在のコマ割りに合わせたBREAKテンプレートを挿入">📝 メインプロンプト欄にテンプレ枠を挿入</button>
                </div>

                <!-- プリセットバー -->
                <div class="manga-presets-bar">
                    <span class="manga-presets-label">⚡ 王道テンプレート:</span>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('4koma')">4コマ (均等)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('3panel')">3コマ (大1小2)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('5panel')">5コマ (標準)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('inset')">カットイン (入れ子)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('6panel')">6コマ (2列3段)</button>
                </div>

                <!-- メインキャンバス＆コマ一覧 -->
                <div class="manga-main-layout">
                    <div class="manga-canvas-pane">
                        <div class="manga-canvas-wrapper" id="manga-canvas-wrapper-el">
                            <svg id="manga-canvas-svg"></svg>
                        </div>
                        <div class="manga-canvas-hint">
                            💡 <span>ドラッグでスライス切断 / 境界線をドラッグで伸縮 / DELキーでコマ削除 / Shift+クリックで複数選択</span>
                        </div>
                    </div>

                    <div class="manga-sidebar-pane">
                        <div class="manga-sidebar-header">📋 メインプロンプト連動プレビュー＆重み設定</div>
                        <div class="manga-panels-summary" id="manga-panels-summary-container">
                            <!-- JSでリアルタイムパース＆プレビューを表示 -->
                        </div>
                    </div>
                </div>
            </div>
            """)

            json_bridge = gr.Textbox(
                value="[]",
                elem_id="manga-prompter-json-bridge",
                visible=False
            )

        return [is_enabled, base_weight, json_bridge]

    def process(self, p, is_enabled, base_weight, json_bridge):
        """生成前処理: 全体ベースプロンプトを抽出してグローバル汚染を防止"""
        if not is_enabled:
            return

        panels = MangaSpatialEngine.parse_panels_json(json_bridge)
        if not panels or len(panels) <= 1:
            return

        prompt_text = p.prompt if isinstance(p.prompt, str) else (p.prompt[0] if len(p.prompt) > 0 else "")
        if not prompt_text:
            return

        self.original_prompt = prompt_text
        raw_chunks = [c.strip() for c in re.split(r'BREAK', prompt_text, flags=re.IGNORECASE) if c.strip()]
        if len(raw_chunks) > 1:
            # メインプロンプトには1行目の全体スタイルのみを渡して、全領域への混ざり（リーク）を防止
            base_style = raw_chunks[0]
            if isinstance(p.prompt, list):
                p.prompt = [base_style] * len(p.prompt)
            else:
                p.prompt = base_style

    def process_before_every_sampling(self, p, is_enabled, base_weight, json_bridge, *args, **kwargs):
        """Forgeのサンプリング直前に ModelPatcher フックを注入"""
        if not is_enabled:
            return

        try:
            panels = MangaSpatialEngine.parse_panels_json(json_bridge)
            if not panels or len(panels) <= 1:
                return

            sorted_panels = sorted(panels, key=lambda x: x.get('index', 0))
            num_panels = len(sorted_panels)

            prompt_text = self.original_prompt or (p.prompt if isinstance(p.prompt, str) else (p.prompt[0] if len(p.prompt) > 0 else ""))
            if not prompt_text:
                return

            raw_chunks = [c.strip() for c in re.split(r'BREAK', prompt_text, flags=re.IGNORECASE) if c.strip()]
            if len(raw_chunks) <= 1:
                return

            has_base = (len(raw_chunks) >= num_panels + 1)
            start_chunk_idx = 1 if has_base else 0

            tag_regex = re.compile(r'^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|(\d+)\s*(コマ|koma|panel|p))\s*:?\s*', re.IGNORECASE)

            # UNet のクローンを取得 (Forge ModelPatcher)
            if not hasattr(p.sd_model, "forge_objects") or not hasattr(p.sd_model.forge_objects, "unet"):
                return

            unet = p.sd_model.forge_objects.unet.clone()
            is_sdxl = getattr(p.sd_model, "is_sdxl", True)

            fc_args = {}

            print(f"[MangaPrompter] Forge ModelPatcher 領域パッチ生成 ({num_panels}コマ, ベース強度={base_weight}):")
            for i, r in enumerate(sorted_panels):
                chunk_pos = start_chunk_idx + i
                if chunk_pos < len(raw_chunks):
                    raw_c = raw_chunks[chunk_pos]
                    clean_c = tag_regex.sub('', raw_c).strip()
                else:
                    clean_c = ""

                # プロンプトのエンコード
                texts = SdConditioning([clean_c if clean_c else " "], False, p.width, p.height, None)
                cond = p.sd_model.get_learned_conditioning(texts)
                pos_cond = [[cond["crossattn"]]] if is_sdxl else [[cond]]
                fc_args[f"cond_{i + 1}"] = pos_cond

                # 空間マスクの作成 [1, H, W]
                rect = r.get('rect', {'x': 0, 'y': 0, 'w': 1, 'h': 1})
                x1 = max(0, min(p.width - 1, int(rect['x'] * p.width)))
                y1 = max(0, min(p.height - 1, int(rect['y'] * p.height)))
                x2 = max(x1 + 1, min(p.width, int((rect['x'] + rect['w']) * p.width)))
                y2 = max(y1 + 1, min(p.height, int((rect['y'] + rect['h']) * p.height)))

                w_val = float(r.get('weight', 1.0))
                mask = torch.zeros((p.height, p.width), dtype=torch.float32)
                mask[y1:y2, x1:x2] = w_val
                fc_args[f"mask_{i + 1}"] = mask.unsqueeze(0)

                print(f"  - コマ {i + 1} (領域: [{x1}:{x2}, {y1}:{y2}], 重み={w_val:.2f}): {clean_c[:50]}")

            base_mask = (torch.ones((p.height, p.width), dtype=torch.float32) * float(base_weight)).unsqueeze(0)

            patched_unet = self.patcher_hook.patch_unet(
                model=unet,
                base_mask=base_mask,
                kwargs=fc_args,
                width=p.width,
                height=p.height,
            )

            if patched_unet is not None:
                p.sd_model.forge_objects.unet = patched_unet
                self.active_unet = patched_unet
                print(f"[MangaPrompter] Forge ModelPatcher パッチ適用成功 (ControlNet完全共存)")

        except Exception as e:
            print(f"[MangaPrompter] パッチ適用エラー: {e}")
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, base_weight, json_bridge):
        """生成後処理: 元のプロンプトを復元"""
        if self.original_prompt is not None:
            p.prompt = self.original_prompt
            self.original_prompt = None
        self.active_unet = None
