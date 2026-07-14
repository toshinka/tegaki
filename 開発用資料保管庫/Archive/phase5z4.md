# Phase 5z4: Animation Tableポインター操作改善

更新日: 2026-07-14

## 目的

Animation TableのFPS / FRAMESとTimeline移動を、keyboardへ触れなくても精密に操作できるようにする。既存のcompact header、number直接入力、Lane縦scroll、Timeline横scroll / zoomを維持し、pointer / wheelの競合を先に解消する。

## Slice 0: 既存操作契約の監査

1. FPS / FRAMES inputからTimeline設定、再生、表示更新、保存、Historyへ至るread / write経路を全検索する。
2. Table viewportのwheel handler、frame選択、横scroll、縦Lane scroll、Timeline zoomのevent capture / preventDefault条件を確認する。
3. wheelによる「Timeline移動」がcurrent Frame移動かviewport横scrollかを、次の条件と合わせて決める。
   - Timeline cell / ruler / Lane labelなどhit領域ごとの意味。
   - 通常wheel、Shift+wheel、Ctrl/Cmd+wheelの割当。
   - trackpadの小さい連続delta、1操作で複数Frame飛ぶ場合の上限、端Frame。
   - number / range / select、scrollbar、CLIP MOTION操作中は奪わない。
4. FPS / FRAMES変更のHistory単位と、FRAMES縮小時に範囲外となるCAF / key / Groupの現行挙動を固定する。

## Slice 1: number inputのwheel調整

- headerのcompact number入力は維持し、hover中またはfocus中の通常wheelでHTML `step` 1回分を増減する。FPSは1–60、FRAMESは1–240の現行範囲を再利用する。
- 同じnumber input契約をCLIP MOTIONのX / Y / Scale / Rotation / Opacity / Strengthにも適用する。各field固有の`step`とmin / maxを使い、Motion key更新は既存commit経路へ送る。
- keyboard直接入力を残し、native spinnerを復活させない。
- Ctrl/Cmd/Alt+wheelは奪わず、disabled / read-only fieldでは変更しない。field上のwheelはTable scrollへ伝播させない。
- FPS / FRAMES / CLIP MOTION間で小さいbinding helperを共用する。LAYER TRANSFORMは独自`SliderUtils`正本のため、このhelperを重ねず別途監査する。
- customの▲▼とslider popupは初回実装へ重複させない。wheelだけではpen操作が不足する実機結果が出た場合に、compactな− / ＋を後続候補とする。

## Slice 2: Table wheel Timeline移動

- Timeline grid / ruler / 空白上の通常wheelは横scrollとする。Lane名・controlパネル上の通常wheelは便利な既存縦scrollを維持する。
- Shift+wheelはviewport全域でLaneの縦scrollとし、Timeline側からも縦移動できる補助経路にする。
- Ctrl/Cmd+wheelのTimeline zoom、form control上の数値wheelを奪わない。
- 再生中、drag / retiming中、form操作中、Table外では発火しない。

## Slice 3: 既存数値controlへのwheel展開

- Quick Tool PanelのSIZEは0.5px、OPACITYは1%刻みで、各slider card上のwheelから既存更新関数へ接続する。
- Layer Panel上部のFrame表示はwheelで前後Frameへ移動し、既存Frame移動経路を使う。
- Timeline onion buttonはTable内・Layer Panel上部ともwheelで0～4を増減する。Lane onionはON/OFF正本だけなので数値化しない。
- Layer cardのopacity表示はwheelで1%刻みとし、通常Layer / CAF内部Layerの既存opacity正本・History経路へ接続する。
- LAYER TRANSFORMの独自sliderは`SliderUtils`監査後に別途判断する。

## Slice 4: Transform panel操作契約

- CLIP MOTIONとLAYER TRANSFORMは外観・header action・active色を共通化するが、入力密度は用途別に保つ。
- 項目数の多いCLIP MOTIONはcompact number inputを維持し、横ドラッグ6pxごとにfield固有stepを増減する不可視scrub操作を追加する。click直接入力とwheelも残す。
- scrub中は現在Frame keyとCanvas previewへ追従し、pointerup / cancelで1 Timeline Historyへまとめる。
- 項目数が少なくpen操作を主目的にするLAYER TRANSFORMは可視sliderを維持する。number input化や同じDOM構造への統合は行わない。
- LAYER TRANSFORMの直接number入力はnative灰色spinnerを隠し、ふたば茶系の小型▲▼へ置換する。
- CLIP MOTION Rotationだけは茶系▲▼を常設し、現在値から次 / 前の45°倍数へ揃える。単純な±45ではなく、331°なら▲360° / ▼315°、45°上では▲90° / ▼0°とする。
- Lane onionはboolean正本を維持し、wheel上方向でON、下方向でOFFにする。Timeline onionの数値正本とは統合しない。

## 対象外

- Clip固有FPS、subframe Motion sampling、Project FPS上限変更。
- CAF / Group retiming、複数CAF DURATION一括変更、FRAMESの自動拡張。
- Motion parameter、easing、軌跡 / 波形、Bone、mesh、morph、physics、WebGPU。
- Animation Table header全体の再設計。

## 検証

- 変更JSを `node --check` する。
- FPS 1 / 8 / 60、FRAMES 1 / 24 / 240、hover / focus中wheel、直接入力を確認する。
- CLIP MOTIONのX / Y、Scale 0.01、Rotation、Opacity / Strengthのstepとmin / max、1操作Undo / Redoを確認する。
- FRAMES縮小時の既存CAF / Group境界、Undo / Redo、保存 / 復元を関連範囲で確認する。
- mouse wheelとtrackpad相当deltaで、通常 / Shift / Ctrl(Cmd)と各hit領域を確認する。
- 再生、Timeline zoom、横 / 縦scroll、CLIP MOTION、console errorなしをBrowserで確認する。
- `npm.cmd run build` 後、`tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## 実施結果

- Quick SIZE 10.0→10.5px、OPACITY 100→99%、Layer Panel Frame F1→F2をBrowser実操作で確認した。
- Timeline onionはLayer Panel側で0→1、Table側で1→2へ変更し、両表示と正本が同期することを確認した。
- Timeline onionはwheelで0→1→0と往復し、0が非表示契約として働くことを確認した。
- Timelineを147%へ拡大した固定画面で、grid上の通常wheelにより`scrollLeft`が0→約240px、`scrollTop`が0のまま維持されることを確認した。
- CLIP MOTIONのXを横60px dragして0→10へライブ変更し、Historyが1件だけ増加、Undo 1回でX=0・key無しへ戻ることを確認した。
- BrowserでLane panel上の通常wheelにより`scrollTop` 0→約150px、`scrollLeft` 0を確認した。
- Rotation 331°から▲360° / ▼315°、Lane onion OFF→ON→OFF、LAYER TRANSFORM直接入力▲で0→1とふたば配色を確認した。
- console errorなし。Layer card opacityはopacity metadataを表示するcardだけにwheelを付与し、compact cardへ新しい表示を増やしていない。

## 最初の完了条件

- FPS / FRAMESの変更正本、commit単位、FRAMES縮小時の安全境界を決める。
- wheelのcurrent Frame移動 / viewport移動、modifier、hit領域、trackpad thresholdを決める。
- 契約確定前にheader DOMやwheel処理を置換しない。
