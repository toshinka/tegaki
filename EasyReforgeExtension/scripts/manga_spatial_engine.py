"""
EasyReforge Manga Prompter - Spatial Conditioning Engine (v2.6)
コマ番号（index）と空間マスクの完全同期 ＆ Z-Indexくり抜き
"""

import json
import torch

class MangaSpatialEngine:
    def __init__(self):
        pass

    @staticmethod
    def parse_panels_json(json_str):
        """フロントエンドからのJSON文字列を解析"""
        if not json_str or not isinstance(json_str, str):
            return []
        try:
            data = json.loads(json_str)
            if isinstance(data, list):
                return data
        except Exception as e:
            print(f"[MangaPrompter] JSON Parse Error: {e}")
        return []

    @classmethod
    def generate_spatial_masks(cls, panels, height, width, device='cpu', dtype=torch.float32):
        """
        各パネルの空間マスクテンソル [N, 1, H, W] を生成。
        渡された panels（index順）の順番を100%保持してマスクを返す。
        """
        if not panels:
            return []

        # 渡された順番（index順）を厳密に保持
        raw_masks = []
        for p in panels:
            rect = p.get('rect', {'x': 0, 'y': 0, 'w': 1, 'h': 1})
            x1 = int(rect['x'] * width)
            y1 = int(rect['y'] * height)
            x2 = int((rect['x'] + rect['w']) * width)
            y2 = int((rect['y'] + rect['h']) * height)

            # 境界クランプ
            x1 = max(0, min(width - 1, x1))
            y1 = max(0, min(height - 1, y1))
            x2 = max(x1 + 1, min(width, x2))
            y2 = max(y1 + 1, min(height, y2))

            mask = torch.zeros((1, 1, height, width), dtype=dtype, device=device)
            mask[:, :, y1:y2, x1:x2] = 1.0
            raw_masks.append({
                'panel': p,
                'mask': mask,
                'zIndex': p.get('zIndex', 0),
            })

        # Z-Indexに基づくくり抜き（前面にあるカットイン小ゴマを背面コマからくり抜く）
        final_regions = []
        for i, item_i in enumerate(raw_masks):
            mask_i = item_i['mask'].clone()
            z_i = item_i['zIndex']

            for j, item_j in enumerate(raw_masks):
                z_j = item_j['zIndex']
                if z_j > z_i:
                    # item_j は前面にあるため、item_i からくり抜く
                    mask_i = mask_i * (1.0 - item_j['mask'])

            final_regions.append({
                'id': item_i['panel'].get('id'),
                'name': item_i['panel'].get('name', 'コマ'),
                'weight': float(item_i['panel'].get('weight', 1.0)),
                'mask': mask_i,
                'rect': item_i['panel'].get('rect')
            })

        return final_regions
