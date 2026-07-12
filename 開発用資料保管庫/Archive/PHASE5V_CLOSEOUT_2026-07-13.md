# Phase 5v Closeout

完了日: 2026-07-13

## 完了範囲

- 通常Layer FolderとCAF内部Folderのnone/normal/inverse clipping、Folder target/source、visibility、保存・復元。
- Table展開中、Table閉後、onion、playback、Frame compositor、animation export previewの表示契約統一。
- clipping用内部maskのLayer一覧混入防止、resource pool、preview cache、V変形確定負荷の局所化。
- coalesced pen入力の論理sampleを維持したGPU render batch化と、Table全面backdrop blur撤去。
- Ctrl/Cmd複数選択CAFとCAF Groupの原子的一括削除、単一History Undo/Redo、Alt+Delete。
- Timeline zoom controlのheader移動、33%縮小、60%未満のFrame番号省略、大量Frame scrollbar非競合。

## 確認

- オーナー実機: Folder clipping複合構成、保存・再読込、出力、複数/Group CAF削除、pen/V操作。
- Browser: normal/inverse、Folder source/target、Table表示、onion、8 FPS playback、GIF preview、CAF一括削除、240 Frame、通常/狭幅Table、33-60% zoom、console errorなし。
- 固定入力: Project metadata round-trip、CAF internal hierarchy、inverse source非表示/削除/D&D再探索、一括削除原子性。
- 変更JSのnode check、Vite build、生成差分清掃。

## 別Phase候補

- Folder add/multiply/overlayの完全group合成。通常Folderは空Containerであるため、non-default Folderだけをdirty group RenderTexture化する設計が必要。
- 本項目はPhase 5vの残件ではない。
