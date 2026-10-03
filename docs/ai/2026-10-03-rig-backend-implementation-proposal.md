# RIG backend — 実装方針の提案

状態: REFERENCE / DESIGN PROPOSAL。2026-10-03。
Owner依頼「調査を深くしすぎず、どう実装するか考える」に対する司令の判断材料。実装指示・採用決定・schema変更の承認ではない。
baseline: main / `7765fde4573492478d5dede545c295116592f63a`、開始時worktree clean。前件の文書はOwner側でcommit済み。製品変更なし。

## 判断

既存RIGを維持し、Inochi2Dを新規Advancedモデルの評価backend候補として限定導入する案を推奨する。既存Projectを一括変換したり、既存RIGの保存・History・IKを先に外部へ移さない。

Inochi2Dの採用は未決定。先に旧系sourceを固定した独立proofを一件だけ通し、その接続量から採用を判断する。現行main bindingの復旧をTEGAKIが背負う案は、資源節約の目的に合わないため優先しない。

添付ブリーフは参考の設計提案として読んだ。GUI大改造やPersonal helperの許容を、そのまま現在の製品実装指示にはしない。

## 調査を区切れる理由

[WP-019](../work/WP-019-inochi-edit-roundtrip-proof.md)と[capability report](INOCHI2D_EDIT_ROUNDTRIP_CAPABILITY.md)で現配布WASMの不足は確認済み。実測はinstantiate/initのみ。編集・保存・再読込のproofは未達。

追加の限定source読解では、旧nightly tag SHA `66fa76834b28037db0c871c656563422f697879e`に以下を確認した:

- `source/inochi2d/core/param/package.d:265-339`: bindingを含むserialize/deserialize。
- `source/inochi2d/core/puppet.d:804-817`: Puppet serialize/deserialize。
- `source/inochi2d/core/mesh.d:203-215`: deformed verticesとindicesの読取。
- `source/inochi2d/cffi/puppet.d:269-270`: DrawList getter。
- `source/inochi2d/cffi/render.d:321-375`: commands / vertices / indices / allocationsの読取。

以上はsource上の能力で、実行成功ではない。公開WASMへの適用も未確認。旧系には検証候補を残すだけの根拠があるため、これ以上候補を採点し直すより、一つの実行経路で残る自作量を測る方が有益。

注意: 公式[release一覧](https://github.com/Inochi2D/inochi2d/releases)のv0.8.7 tagは`e2235f6...`、調査済みnightly tagは`66fa768...`。version文字列だけで同じsourceと扱わない。次のproofでは一つのfull SHAと依存lock・ビルド条件・binary hashを固定する。nightly URLを恒久的なversion固定に使わない。

## 実装の責任分担

| 責任 | 維持/導入案 | 残る負担 |
|---|---|---|
| 既存PART/Bone/IK/既存Project | 現行Native RIGを維持 | 新backendへの互換変換を初手で作らない |
| Advanced parameter/keyform/変形評価 | 固定したInochi2Dで評価 | WASM ABI、buffer寿命、型/座標対応、失敗の伝達 |
| 人間の編集操作 | TEGAKIの限定編集session | pivot/parameter/meshのGUI、入力検証、cancel |
| HistoryとProject | TEGAKIが所有 | 外部model payloadの保存境界を別の重大判断で確定 |
| 描画・書出し | 現行planとCPU/final出力、Pixi previewへ接続 | mask/blend/composite/座標の対応はTEGAKI責任 |
| AI | 同じ編集commandとinspect結果を利用 | semantic role解決、失敗理由、before/after差分 |

上流の評価資産を利用しても、TEGAKIのrenderer/保存/UIに接続した箇所の検証は省略できない。DrawListにはmask/composite等の状態が含まれるため、頂点getterをつなぐだけで全機能互換にはならない。

現行[ARCHITECTURE](../ARCHITECTURE.md)はCPU/final dataをpixel authority、Pixiを同じ評価入力によるpreviewとする。GPU/CPUのRGBA byte完全一致を全場面で要求する契約ではない。単一の評価入力と出力の責任を守り、外部rendererを追加の出力正本にしない。

## 保存と編集の案

SDKにnative save APIがないことは「保存不能」と同義ではない。旧系loaderが実際に受理し評価できるなら、TEGAKI側で編集したnative形式payloadをencodeして再ロードする経路も候補になる。ただしencoder・validator・unknown field保持・互換性の責任は自作として計上する。JSON往復だけをproofの成功にしない。

初期proofでは、外部model bytesを専用cacheに置き、production Projectへ埋め込まない。編集→保存bytes→元instance破棄→新規native instance→再評価で成立を測る。

正式統合時の提案は、新規Advanced assetについて外部model payloadを一つの保存正本とし、頂点/GPU bufferは派生runtimeにすること。既存Native assetは現行正本のまま。二つの正本が同じRigを同時に編集する構造を作らない。asset識別、resource参照、semantic role map、Timeline parameter trackの置場・version・旧Project互換はschema判断が必要で、この提案では未承認。

編集はdetached draftに対して行い、検証とnative load/evaluateが成功した場合だけ既存History形式の一commandへ確定する。失敗/cancelは確定modelを維持。Physicsは初回proofでOFFにし、後段で時間・reset・seed/状態復元を明示して再現性を確認する。

## 初期UIとAI

初期UIは選択Part、parameter値、keyform登録/編集、保存/戻すに絞る。Timelineの全面再構成、physics、IK置換、自動リグ、任意effect互換を同時に入れない。

AIも同じ限定commandを使う。例えばroleの対象確認→parameter/keyform変更案→検証→差分確認→確定。raw mesh JSONをAIへ大量に出力させず、数値変換・native encodingは決定的な処理に任せる。inspectはbackend/version、対象、入力値、失敗理由、変更前後の差を返す。MCP実装はこのcommandが人間操作で成立してから。

## 次に実装する一件

次Cardは「旧系固定buildを用いたheadless編集・保存roundtrip」。本体へ接続する前に、1 Part、1 parameter、2 keyforms、物理OFF、通常blend、mask/composite無しで実行する。

1. 一つのsource SHAから再現可能なbuildを確保する。portable/隔離toolchainの利用範囲は次Cardに明記し、system installは行わない。
2. native loaderが受理する最小fixtureを作り、0 / 0.5 / 1のnative評価を観測する。
3. 一つのkeyformまたはmeshを編集し、native形式bytesを保存。旧instanceを破棄し、新規instanceで三点を再評価する。
4. 編集前との意図した差、保存後reload一致、変更撤回、破損inputの拒否を確認する。
5. 独自encoder/validator/bridgeの量、patch数、ビルド条件、未知の機能を記録する。

第一候補はpayload外部編集→native reload。必要ならauthoring/save/観測だけの小さなABI bridge。評価器本体の修復が必要、非対応機能の自作再実装が必要、build経路を一件の限定作業で確保できない場合は、その理由を出して打ち切る。別候補の長期調査へ自動継続しない。

この一件が通った場合だけ、次に一つのAdvanced対象のpreview/CPU出力接続を検証する。mask/composite/blendを初手から対応済みと表示しない。未対応modelは理由付き拒否。Public/Advancedの依存分離は実依存を入れるCardで確認し、先に大きな汎用backend frameworkを作らない。

## このターンの区切り

設計提案まで。WP-019のBLOCKEDと実測限界は維持。追加のworker起動、toolchain導入、製品実装、schema変更、commit/pushは行っていない。Nativeを凍結/退役する決定もしていない。
