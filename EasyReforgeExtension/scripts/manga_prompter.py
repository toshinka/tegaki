"""
EasyReforge Manga Prompter - Main Script & Gradio UI
Version: v3.7.1 Diagnostic Reset (EasyReforge Fixed Environment)
Golden Reference: sd-forge-couple v4.0.2
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

    def title(self):
        return "Manga Region Prompter (EasyReforge)"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("🎨 Manga Region Prompter (漫画コマ割りプロンプター)", open=True, elem_id="manga-prompter-accordion"):
            with gr.Row():
                is_enabled = gr.Checkbox(label="有効化 (Enable)", value=False, elem_id="manga-prompter-enabled")
                base_weight = gr.Slider(label="全体画風の強度 (Base Style Weight)", minimum=0.0, maximum=0.5, step=0.05, value=0.0, info="v3.7診断中は各コマへGLOBALテキストが自動prefixされます")

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

    def after_extra_networks_activate(self, p, is_enabled, base_weight, json_bridge, *args, **kwargs):
        """Forge Couple同等のライフサイクルでプロンプトを厳密解析 (p.prompt は一切書き換えない)"""
        self.valid = False
        self.resolved_prompts = []
        self.sorted_panels = []

        if not is_enabled:
            print(f"[MangaPrompter] after_extra_networks_activate: enabled=False")
            return

        panels = MangaSpatialEngine.parse_panels_json(json_bridge)
        if not panels or len(panels) <= 1:
            print(f"[MangaPrompter] パネル数が2未満のためバイパスします (panels={len(panels) if panels else 0})")
            return

        self.sorted_panels = sorted(panels, key=lambda x: x.get('index', 0))
        num_panels = len(self.sorted_panels)

        # Forgeが解決した prompt を取得
        resolved_prompt_str = kwargs.get("prompts", [p.prompt])[0] if "prompts" in kwargs else (p.prompt if isinstance(p.prompt, str) else p.prompt[0])
        raw_chunks = [c.strip() for c in re.split(r'BREAK', resolved_prompt_str, flags=re.IGNORECASE) if c.strip()]

        expected_chunks = num_panels + 1
        if len(raw_chunks) != expected_chunks:
            print(f"[MangaPrompter][ERROR] Prompt chunk mismatch: expected {expected_chunks} chunks (GLOBAL + {num_panels} panels), got {len(raw_chunks)}.")
            print(f"[MangaPrompter][ERROR] Regional patch was NOT applied. Please ensure format: GLOBAL BREAK koma 1: ... BREAK koma 2: ...")
            return

        global_text = raw_chunks[0]
        tag_regex = re.compile(r'^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|(\d+)\s*(コマ|koma|panel|p))\s*:?\s*', re.IGNORECASE)

        print(f"[MangaPrompter][RESOLVED PROMPTS] Global='{global_text[:40]}...', Panels={num_panels}:")
        for i, panel in enumerate(self.sorted_panels):
            raw_c = raw_chunks[i + 1]
            clean_c = tag_regex.sub('', raw_c).strip()
            # GLOBALテキストを各領域プロンプトの先頭にprefix結合
            merged_text = f"{global_text}, {clean_c}" if global_text else clean_c
            self.resolved_prompts.append({
                'panel_index': i + 1,
                'clean_text': clean_c,
                'resolved_text': merged_text,
                'weight': float(panel.get('weight', 1.0))
            })
            print(f"  - Region {i + 1} (Panel {panel.get('name', i+1)}): '{merged_text[:60]}...'")

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
                # spatial_regions[i]['mask'] は [1, 1, H, W] なので squeeze(1)
                mask_2d = spatial_regions[i]['mask'].squeeze(0).squeeze(0) * w_val
                fc_args[f"mask_{i + 1}"] = mask_2d.unsqueeze(0)

            # base_mask は強制 ZERO (GLOBAL は各領域に prefix 済みのため、ベースブランチは0にする)
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
