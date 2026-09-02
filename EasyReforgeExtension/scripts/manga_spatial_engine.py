"""
EasyReforge Manga Prompter - Spatial Conditioning Engine (v3.7.4)
Exclusive (コマ連結/くり抜き) vs Overlap (重なり許可/共存) モード対応
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
        interactionMode ('exclusive' または 'overlap') に応じて Z-Index くり抜きを制御。
        """
        if not panels:
            return []

        # interactionMode の判定 (全体または先頭パネルから取得, デフォルトは 'exclusive')
        interaction_mode = 'exclusive'
        if isinstance(panels, list) and len(panels) > 0:
            interaction_mode = panels[0].get('interactionMode', 'exclusive')

        # 渡された順番（index順）を厳密に保持して矩形マスクを生成
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

        final_regions = []

        if interaction_mode == 'overlap':
            # Overlap モード: Z-Index くり抜きを行わず、重なり領域で両方のコンディショニングを保持
            for item in raw_masks:
                final_regions.append({
                    'id': item['panel'].get('id'),
                    'name': item['panel'].get('name', 'コマ'),
                    'weight': float(item['panel'].get('weight', 1.0)),
                    'mask': item['mask'],
                    'rect': item['panel'].get('rect'),
                    'interactionMode': 'overlap'
                })
        else:
            # Exclusive (コマ連結) モード: Z-Index に基づくくり抜き (前面コマを背面コマからくり抜く)
            for i, item_i in enumerate(raw_masks):
                mask_i = item_i['mask'].clone()
                z_i = item_i['zIndex']

                for j, item_j in enumerate(raw_masks):
                    z_j = item_j['zIndex']
                    if z_j > z_i:
                        mask_i = mask_i * (1.0 - item_j['mask'])

                final_regions.append({
                    'id': item_i['panel'].get('id'),
                    'name': item_i['panel'].get('name', 'コマ'),
                    'weight': float(item_i['panel'].get('weight', 1.0)),
                    'mask': mask_i,
                    'rect': item_i['panel'].get('rect'),
                    'interactionMode': 'exclusive'
                })

        return final_regions
