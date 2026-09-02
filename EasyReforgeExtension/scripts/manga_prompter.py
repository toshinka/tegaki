"""
EasyReforge Manga Prompter - Main Script & Gradio UI
Version: v3.7.5 Regional Core & CSP-Style Panel Editor (Logical Koma Reassignment & Style-First Ordering)
Golden Reference: sd-forge-couple v4.0.2 / v3.7.5 Specification
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
        self.style_text = ""
        self.page_text = ""

    def title(self):
        return "Manga Region Prompter (EasyReforge)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("🎨 Manga Region Prompter (漫画コマ割りプロンプター)", open=True, elem_id="manga-prompter-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable)", value=False, elem_id="manga-prompter-enabled")
                global_effect_weight = gr.Slider(
                    label="ページ全体効果 (Global Effect Weight)", 
                    minimum=0.0, 
                    maximum=1.0, 
                    step=0.05, 
                    value=0.25, 
                    info="STYLE + PAGE を全画面へ弱く混ぜる強度 (初期推奨: 0.25)"
                )

            manga_html = gr.HTML(value="""
            <div id="manga-prompter-root">
                <div class="manga-header-bar">
                    <div class="manga-header-title">
                        <span>📖 1P漫画 コマ割りキャンバス</span>
                        <span class="manga-res-badge" id="manga-res-display">832 × 1216 (自動同期中)</span>
                    </div>
                    <div class="manga-toolbar">
                        <button type="button" class="manga-btn" id="manga-btn-viewmode" onclick="window.mangaPrompterToggleViewMode()" title="白黒線画（ControlNet用）とカラー確認の表示切替">⬛ 白黒表示へ</button>
                        <button type="button" class="manga-btn manga-btn-highlight" onclick="window.mangaPrompterExportLineart()" title="現在のコマ枠を綺麗な白黒PNG画像として保存（ControlNetにD&D用）">📸 コマ枠PNG保存</button>
                        <button type="button" class="manga-btn" id="manga-btn-undo" onclick="window.mangaPrompterUndo()" title="元に戻す (Ctrl+Z)">↶ 戻す</button>
                        <button type="button" class="manga-btn" id="manga-btn-redo" onclick="window.mangaPrompterRedo()" title="やり直す (Ctrl+Y)">↷ やり直す</button>
                        <button type="button" class="manga-btn" onclick="window.mangaPrompterReset()" title="1コマ(全体)に戻す">全初期化</button>
                    </div>
                </div>

                <!-- ツール＆操作バー (CSP風 分類整理) -->
                <div class="manga-toolbar-main">
                    <!-- ツール切替 -->
                    <div class="manga-tool-group">
                        <span class="manga-group-label">ツール:</span>
                        <button type="button" class="manga-btn active" id="manga-btn-tool-select" onclick="window.mangaPrompterSetTool('select')" title="選択・コマ移動・境界ドラッグ・8方向リサイズ">🖱 選択・編集</button>
                        <button type="button" class="manga-btn" id="manga-btn-tool-slice" onclick="window.mangaPrompterSetTool('slice')" title="クリスタ風 枠線分割スライス (交差線でコマを正確に切断)">✂ スライス</button>
                        <button type="button" class="manga-btn" id="manga-btn-tool-drawrect" onclick="window.mangaPrompterSetTool('drawRect')" title="ドラッグして自由な矩形コマを作成">▭ 矩形コマ</button>
                    </div>

                    <!-- クイック分割・結合 -->
                    <div class="manga-tool-group">
                        <span class="manga-group-label">クイック:</span>
                        <button type="button" class="manga-btn manga-btn-primary" onclick="window.mangaPrompterSplit('h')" title="選択中のコマを横に均等2分割">＋ 横分割</button>
                        <button type="button" class="manga-btn manga-btn-primary" onclick="window.mangaPrompterSplit('v')" title="選択中のコマを縦に均等2分割">＋ 縦分割</button>
                        <button type="button" class="manga-btn" id="manga-btn-merge" onclick="window.mangaPrompterMerge()" title="選択中の複数コマまたは隣接コマを合体">🔗 コマ結合</button>
                    </div>

                    <!-- 領域関係モード -->
                    <div class="manga-tool-group">
                        <span class="manga-group-label">領域関係:</span>
                        <button type="button" class="manga-btn" id="manga-btn-interaction-mode" onclick="window.mangaPrompterToggleInteractionMode()" title="コマ連結（別コマ・くり抜き）と 重なり許可（同一シーン・共存）の切替">🔗 コマ連結 (Exclusive)</button>
                    </div>

                    <!-- テンプレート挿入 -->
                    <div class="manga-tool-group">
                        <button type="button" class="manga-btn manga-btn-highlight" onclick="window.mangaPrompterInsertTemplateToMainPrompt()" title="メインプロンプト欄に現在のコマ割りに合わせたN+2テンプレートを挿入">📝 テンプレ枠を挿入</button>
                    </div>
                </div>

                <!-- プリセットバー -->
                <div class="manga-presets-bar">
                    <span class="manga-presets-label">⚡ 王道テンプレート:</span>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('4koma')">4コマ (均等)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('3panel')">3コマ (大1小2)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('5panel')">5コマ (標準)</button>
                    <button type="button" class="manga-preset-btn" onclick="window.mangaPrompterApplyPreset('6panel')">6コマ (2列3段)</button>
                </div>

                <!-- メインキャンバス＆コマ一覧 -->
                <div class="manga-main-layout">
                    <div class="manga-canvas-pane">
                        <div class="manga-canvas-wrapper" id="manga-canvas-wrapper-el">
                            <svg id="manga-canvas-svg"></svg>
                        </div>
                        <div class="manga-canvas-hint" id="manga-canvas-hint-text">
                            💡 <span>[選択モード] コマ選択 / 共通境界ドラッグ / ハンドルで伸縮 / DELキーで削除</span>
                        </div>
                    </div>

                    <div class="manga-sidebar-pane">
                        <div class="manga-sidebar-header">📋 メインプロンプト連動プレビュー＆番号再割当</div>
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

        return [is_enabled, global_effect_weight, json_bridge]

    def after_extra_networks_activate(self, p, is_enabled, global_effect_weight, json_bridge, *args, **kwargs):
        """v3.7.5: STYLE(画風) -> PAGE(構造) -> REGIONS の順序でパースし、main conditioningを縮小"""
        self.valid = False
        self.resolved_prompts = []
        self.sorted_panels = []
        self.original_resolved_prompt = None
        self.style_text = ""
        self.page_text = ""

        if not is_enabled:
            return

        panels = MangaSpatialEngine.parse_panels_json(json_bridge)
        if not panels or len(panels) <= 1:
            return

        # 論理コマ番号 (logical_koma_number / index) 順にソート
        self.sorted_panels = sorted(panels, key=lambda x: x.get('index', 0))
        num_panels = len(self.sorted_panels)

        prompts = kwargs.get("prompts")
        if not isinstance(prompts, list) or len(prompts) != 1:
            print("[MangaPrompter][ERROR] Batch Size 1 required for v3.7.5 diagnostic.")
            return

        resolved_full_prompt = prompts[0]
        raw_chunks = [c.strip() for c in re.split(r'\bBREAK\b', resolved_full_prompt, flags=re.IGNORECASE) if c.strip()]

        expected_chunks = num_panels + 2
        if len(raw_chunks) != expected_chunks:
            print(f"[MangaPrompter][ERROR] Expected {expected_chunks} chunks (STYLE + PAGE + {num_panels} regions), got {len(raw_chunks)}.")
            print(f"[MangaPrompter][ERROR] Please ensure format: GLOBAL_STYLE BREAK PAGE_STRUCTURE BREAK koma 1:... BREAK koma 2:...")
            return

        style_text = raw_chunks[0]
        page_text = raw_chunks[1]
        region_chunks = raw_chunks[2:]

        self.original_resolved_prompt = resolved_full_prompt
        self.style_text = style_text
        self.page_text = page_text

        # WebUI main conditioning を STYLE + PAGE のみに縮小
        main_conditioning_prompt = ", ".join(x for x in (style_text, page_text) if x)
        prompts[0] = main_conditioning_prompt

        tag_regex = re.compile(r'^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|(\d+)\s*(コマ|koma|panel|p))\s*:?\s*', re.IGNORECASE)

        print("[MangaPrompter][v3.7.5 GLOBAL EFFECT]")
        print(f"  GLOBAL STYLE      = {style_text!r}")
        print(f"  PAGE STRUCTURE    = {page_text!r}")
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
                "panel_index": panel.get('index', i + 1),
                "stable_region_id": panel.get('id'),
                "clean_text": clean_region,
                "resolved_text": resolved_region,
                "weight": float(panel.get("weight", 1.0)),
            })

        self.valid = True

    def process_before_every_sampling(self, p, is_enabled, global_effect_weight, json_bridge, *args, **kwargs):
        """Forgeのサンプリング直前に Global Effect (cond_1) + 各Region (cond_2..) を注入"""
        if (not is_enabled) or (not self.valid) or (not self.resolved_prompts):
            return

        try:
            if not hasattr(p.sd_model, "forge_objects") or not hasattr(p.sd_model.forge_objects, "unet"):
                print("[MangaPrompter][ERROR] p.sd_model.forge_objects.unet not found!")
                return

            unet = p.sd_model.forge_objects.unet.clone()
            is_sdxl = getattr(p.sd_model, "is_sdxl", True)

            # MangaSpatialEngine でマスクを一元生成 (sorted_panels順)
            device = 'cpu'
            spatial_regions = MangaSpatialEngine.generate_spatial_masks(
                self.sorted_panels, height=p.height, width=p.width, device=device
            )

            interaction_mode = self.sorted_panels[0].get('interactionMode', 'exclusive') if self.sorted_panels else 'exclusive'

            fc_args = {}

            # 1. Global Effect branch (cond_1, mask_1 = 全画面 * global_effect_weight)
            global_effect_text = ", ".join(x for x in (self.style_text, self.page_text) if x)
            texts_global = SdConditioning([global_effect_text if global_effect_text else " "], False, p.width, p.height, None)
            cond_global_raw = p.sd_model.get_learned_conditioning(texts_global)
            global_cond = [[cond_global_raw["crossattn"]]] if is_sdxl else [[cond_global_raw]]

            fc_args["cond_1"] = global_cond
            fc_args["mask_1"] = torch.ones((1, p.height, p.width), dtype=torch.float32) * float(global_effect_weight)

            # 2. Canvas Regions (cond_2.., mask_2..)
            for i, r_info in enumerate(self.resolved_prompts):
                cond_index = i + 2
                resolved_text = r_info['resolved_text']
                region_weight = r_info['weight']

                texts = SdConditioning([resolved_text if resolved_text else " "], False, p.width, p.height, None)
                cond_raw = p.sd_model.get_learned_conditioning(texts)
                pos_cond = [[cond_raw["crossattn"]]] if is_sdxl else [[cond_raw]]

                fc_args[f"cond_{cond_index}"] = pos_cond

                # マスク [1, H, W]
                region_mask = spatial_regions[i]['mask'].squeeze(0).squeeze(0) * float(region_weight)
                fc_args[f"mask_{cond_index}"] = region_mask.unsqueeze(0)

            # ログ: Branch Mapping
            print("[MangaPrompter][BRANCH MAP]")
            print(f"  MODE:     {interaction_mode.upper()} (Exclusive=くり抜き / Overlap=共存)")
            print(f"  BASE:     mask_weight=0, content=k_target (unused positive base)")
            print(f"  GLOBAL:   cond_1, mask_1=fullscreen * {global_effect_weight:.2f}, prompt={global_effect_text!r}")
            for i, r_info in enumerate(self.resolved_prompts):
                cond_index = i + 2
                panel_rect = self.sorted_panels[i].get('rect', {})
                print(f"  REGION {i + 1}: cond_{cond_index}, mask_{cond_index}, koma={r_info['panel_index']}, id={r_info.get('stable_region_id')}, rect={panel_rect}, weight={r_info['weight']:.2f}, prompt={r_info['resolved_text']!r}")

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
            print(f"[MangaPrompter] Forge ModelPatcher パッチ登録成功 (Global Effect={global_effect_weight:.2f}, Sentinel={DIAGNOSTIC_OUTPUT_SCALE})")

        except Exception as e:
            print(f"[MangaPrompter] パッチ適用例外エラー: {e}")
            traceback.print_exc()

    def postprocess(self, p, processed, is_enabled, global_effect_weight, json_bridge):
        """生成後処理: 診断サマリーを出力"""
        if is_enabled and self.valid:
            print(f"[MangaPrompter][SUMMARY] attn2_patch_calls={self.patcher_hook.attn2_patch_calls}, attn2_output_patch_calls={self.patcher_hook.attn2_output_patch_calls}")
        self.valid = False
        self.resolved_prompts = []
