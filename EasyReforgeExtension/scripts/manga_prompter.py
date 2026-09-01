"""
EasyReforge Manga Prompter - Main Script & Gradio UI
Version: v3.7.2 GLOBAL Split (Page Structure vs Global Style Separation)
Golden Reference: sd-forge-couple v4.0.2 / v3.7.2 GLOBAL Split Specification
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
    from manga_attention import MangaModelPatcherHook, DIAGNOSTIC_OUTPUT_SCALE
except Exception:
    from scripts.manga_spatial_engine import MangaSpatialEngine
    from scripts.manga_attention import MangaModelPatcherHook, DIAGNOSTIC_OUTPUT_SCALE

def empty_tensor(h: int, w: int):
    return torch.zeros((h, w)).unsqueeze(0)

class MangaPrompterScript(scripts.Script):
    def __init__(self):
        super().__init__()
        self.patcher_hook = MangaModelPatcherHook()
        self.resolved_prompts = []
        self.valid = False
        self.sorted_panels = []
        self.original_resolved_prompt = None
        self.page_text = ""
        self.style_text = ""

    def title(self):
        return "Manga Region Prompter (EasyReforge)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("🎨 Manga Region Prompter (漫画コマ割りプロンプター)", open=True, elem_id="manga-prompter-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable)", value=False, elem_id="manga-prompter-enabled")
                base_weight = gr.Slider(label="全体画風の強度 (Base Style Weight - v3.7.2では未使用)", minimum=0.0, maximum=0.5, step=0.05, value=0.0, interactive=False, info="v3.7.2では第2chunkのSTYLEが各コマへ独立prefixされます")

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
                    <button type="button" class="manga-btn manga-btn-highlight" onclick="window.mangaPrompterInsertTemplateToMainPrompt()" title="メインプロンプト欄に現在のコマ割りに合わせた5chunk(PAGE+STYLE+各コマ)テンプレートを挿入">📝 メインプロンプト欄にテンプレ枠を挿入</button>
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

    def after_extra_networks_activate(self, p, is_enabled, base_weight, json_bridge, *args, **kwargs):
        """v3.7.2: PAGEとSTYLEを分離し、main conditioningからRegion本文を除去"""
        self.valid = False
        self.resolved_prompts = []
        self.sorted_panels = []
        self.original_resolved_prompt = None
        self.page_text = ""
        self.style_text = ""

        if not is_enabled:
            return

        panels = MangaSpatialEngine.parse_panels_json(json_bridge)
        if not panels or len(panels) <= 1:
            return

        self.sorted_panels = sorted(panels, key=lambda x: x.get('index', 0))
        num_panels = len(self.sorted_panels)

        prompts = kwargs.get("prompts")
        if not isinstance(prompts, list) or len(prompts) != 1:
            print("[MangaPrompter][ERROR] Batch Size 1 required for v3.7.2 diagnostic.")
            return

        resolved_full_prompt = prompts[0]
        raw_chunks = [c.strip() for c in re.split(r'\bBREAK\b', resolved_full_prompt, flags=re.IGNORECASE) if c.strip()]

        expected_chunks = num_panels + 2
        if len(raw_chunks) != expected_chunks:
            print(f"[MangaPrompter][ERROR] Expected {expected_chunks} chunks (PAGE + STYLE + {num_panels} regions), got {len(raw_chunks)}.")
            print(f"[MangaPrompter][ERROR] Please ensure format: PAGE_STRUCTURE BREAK GLOBAL_STYLE BREAK koma 1:... BREAK koma 2:...")
            return

        page_text = raw_chunks[0]
        style_text = raw_chunks[1]
        region_chunks = raw_chunks[2:]

        self.original_resolved_prompt = resolved_full_prompt
        self.page_text = page_text
        self.style_text = style_text

        # WebUI main conditioning を PAGE + STYLE のみに縮小（Region本文の全画面漏れを遮断）
        main_conditioning_prompt = ", ".join(x for x in (page_text, style_text) if x)
        prompts[0] = main_conditioning_prompt

        tag_regex = re.compile(r'^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|(\d+)\s*(コマ|koma|panel|p))\s*:?\s*', re.IGNORECASE)

        print("[MangaPrompter][v3.7.2 GLOBAL SPLIT]")
        print(f"  PAGE STRUCTURE    = {page_text!r}")
        print(f"  GLOBAL STYLE      = {style_text!r}")
        print(f"  MAIN CONDITIONING = {main_conditioning_prompt!r}")

        for i, panel in enumerate(self.sorted_panels):
            raw_region = region_chunks[i]
            clean_region = tag_regex.sub("", raw_region).strip()

            # STYLE + 各コマ本文 (PAGEは入れない！)
            if style_text and clean_region:
                resolved_region = f"{style_text}, {clean_region}"
            elif style_text:
                resolved_region = style_text
            else:
                resolved_region = clean_region

            self.resolved_prompts.append({
                "panel_index": i + 1,
                "clean_text": clean_region,
                "resolved_text": resolved_region,
                "weight": float(panel.get("weight", 1.0)),
            })

            print(f"  REGION {i + 1} (Panel {panel.get('name', i+1)}): weight={panel.get('weight', 1.0)}, prompt={resolved_region!r}")

        self.valid = True

    def process_before_every_sampling(self, p, is_enabled, base_weight, json_bridge, *args, **kwargs):
        """Forgeのサンプリング直前に ModelPatcher フックを注入"""
        if (not is_enabled) or (not self.valid) or (not self.resolved_prompts):
            return

        try:
            if not hasattr(p.sd_model, "forge_objects") or not hasattr(p.sd_model.forge_objects, "unet"):
                print("[MangaPrompter][ERROR] p.sd_model.forge_objects.unet not found!")
                return

            unet = p.sd_model.forge_objects.unet.clone()
            is_sdxl = getattr(p.sd_model, "is_sdxl", True)

            # MangaSpatialEngine でマスクを一元生成
            device = 'cpu'
            spatial_regions = MangaSpatialEngine.generate_spatial_masks(
                self.sorted_panels, height=p.height, width=p.width, device=device
            )

            fc_args = {}
            for i, r_info in enumerate(self.resolved_prompts):
                resolved_text = r_info['resolved_text']
                w_val = r_info['weight']

                # テキストコンディショニングをエンコード
                texts = SdConditioning([resolved_text if resolved_text else " "], False, p.width, p.height, None)
                cond = p.sd_model.get_learned_conditioning(texts)
                pos_cond = [[cond["crossattn"]]] if is_sdxl else [[cond]]
                fc_args[f"cond_{i + 1}"] = pos_cond

                # マスク [1, H, W]
                mask_2d = spatial_regions[i]['mask'].squeeze(0).squeeze(0) * w_val
                fc_args[f"mask_{i + 1}"] = mask_2d.unsqueeze(0)

            # base_mask は強制 ZERO
            base_mask = empty_tensor(p.height, p.width)

            patched_unet = self.patcher_hook.patch_unet(
                model=unet,
                base_mask=base_mask,
                kwargs=fc_args,
                width=p.width,
                height=p.height,
            )

            if patched_unet is None:
                print(f"[MangaPrompter][ERROR] patch_unet failed. Generation will continue unpatched.")
                return

            p.sd_model.forge_objects.unet = patched_unet
            print(f"[MangaPrompter] Forge ModelPatcher パッチ登録成功 (Sentinel={DIAGNOSTIC_OUTPUT_SCALE})")

        except Exception as e:
            print(f"[MangaPrompter] パッチ適用例外エラー: {e}")
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, base_weight, json_bridge):
        """生成後処理: 診断サマリーを出力"""
        if is_enabled and self.valid:
            print(f"[MangaPrompter][SUMMARY] attn2_patch_calls={self.patcher_hook.attn2_patch_calls}, attn2_output_patch_calls={self.patcher_hook.attn2_output_patch_calls}")
        self.valid = False
        self.resolved_prompts = []
