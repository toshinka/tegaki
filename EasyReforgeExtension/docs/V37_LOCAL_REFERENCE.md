# V3.7 Local Reference — EasyReforge 固定環境記録

記録日: 2026-09-02

## 1. 実行環境構成
- **EasyReforge root**: `E:\EasyReforge`
- **stable-diffusion-webui-reForge Commit**: `19395bf96ccdc605774c76a9fe8cc7145b637128`
- **reForge branch**: `19395bf` (detached / pinned)
- **sd-forge-couple Commit**: `707f72c1f8d4401e96eaeffbff5755fad9299b12`
- **Forge Couple Version**: `v4.0.2` (Golden Reference)
- **Forge Couple Path**: `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\sd-forge-couple`
- **ControlNet**: `E:\EasyReforge\stable-diffusion-webui-reForge\extensions\sd-webui-controlnet` (既知良好 / AnyTest 等)

## 2. 方針
- 診断完了まで `Update.bat` や core の更新を行わず、この Golden Environment 上で Manga Prompter の Hook / Conditioning パイプラインの完全動作を証明・確立する。
