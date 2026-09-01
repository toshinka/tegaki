# Swarm Manga Extension 開発仕様書
## 第1冊 — SwarmUI外部Extension成立性の実証と開発骨格

Version 0.1  
基準日: 2026-09-01  
対象: SwarmUI 0.9.8 Beta 系 / 現行masterを実装時に再確認すること  
実装担当想定: OpenAI Codex  
状態: 「確認済み仕様」と「本プロジェクトとしての提案」を明示的に区別する

---

# 0. この冊の位置づけ

この第1冊の目的は、漫画生成機能そのものを作ることではない。

最優先事項は、

**SwarmUI本体をフォーク・改造せず、独立した外部Extensionとして漫画制作UIを追加できることを実証する**

ことである。

この実証が成功するまでは、

- Regional Prompt
- LoRA管理
- Wildcard
- 漫画コマ
- Canvas編集
- ComfyUI Workflow生成
- 画像生成API
- Project Save
- Separate Panel生成

には進まない。

第1冊で作るものは非常に小さい。

成功状態は、

「SwarmUIを起動するとMangaタブが追加され、そのタブにExtension由来のHTML・JavaScript・CSSが正常に読み込まれている」

ことである。

この状態が確認できれば、

SwarmUI
↓
外部Extension
↓
専用漫画GUI
↓
SwarmUI生成機能

という設計の入口が成立したと判断する。

---

# 1. 現時点で確認できているSwarmUI Extension仕様

## 1.1 外部Extension用ディレクトリ

【確認済み】

SwarmUI公式ドキュメントでは、外部Extensionは、

`src/Extensions/`

以下の独立フォルダとして配置する。

例:

```text
SwarmUI/
└─ src/
   └─ Extensions/
      └─ MyExtension/
```

各Extensionは `Extension` クラスを継承したC#クラスを持つ構造である。

SwarmUI公式ドキュメントにも、

`src/Extensions/MyExtension/...`

という構成が明示されている。

したがって本プロジェクトでは、

```text
SwarmUI/
└─ src/
   └─ Extensions/
      └─ SwarmManga/
```

をExtensionのルートとする。

SwarmUI本体の、

```text
src/Core/
src/Pages/
src/wwwroot/
src/BuiltinExtensions/
```

等は原則変更しない。

---

# 2. Mangaタブ追加方式

## 2.1 Tabs/Text2Image

【確認済み】

SwarmUIはExtension内部の、

```text
Tabs/Text2Image/
```

を自動走査する。

その中に存在する `.html` ファイルをText2Image画面の追加タブとして登録する実装がSwarmUI本体に存在する。

したがって、

```text
Tabs/
└─ Text2Image/
   └─ Manga.html
```

を配置すれば、

```text
Generate
Models
...
Manga
```

のようにMangaタブが追加されることが期待できる。

これは本プロジェクトにとって非常に重要である。

Mangaタブ追加のためにSwarmUI本体のHTMLやRazor Pageを改造する必要はない。

---

# 3. JavaScript / CSS

【確認済み】

SwarmUIの `Extension` クラスには、

```text
ScriptFiles
StyleSheetFiles
OtherAssets
```

が存在する。

Extension側の `OnInit()` 等でファイルを登録すると、SwarmUI側がExtension用Web Assetとして読み込む。

SwarmUIのWebServer側でも、

- ScriptFiles → `<script>`
- StyleSheetFiles → `<link rel="stylesheet">`
- OtherAssets → ExtensionFile

へ変換する処理が実装されている。

したがって漫画UIは、

```text
HTML
JavaScript
CSS
```

をExtensionフォルダ内部だけで管理できる。

---

# 4. Extensionとしての方針

【本プロジェクト提案】

Swarm Mangaは、

「SwarmUIに漫画機能を追加する」

のではなく、

「SwarmUI上に独立した漫画制作フロントエンドを置く」

ものとして設計する。

SwarmUI本体の既存Generate UIを破壊・置換しない。

通常Generate UIはそのまま残す。

ユーザーは、

```text
通常画像生成 → Generate

漫画制作 → Manga

高度なWorkflow → Comfy Workflow
```

という形で用途を切り替える。

---

# 5. Extension Standardとの整合性

【確認済み】

SwarmUI公式のExtension Standardには、

- coreを壊さない
- 可能な限りself-containedにする
- core hackingをしない

という方針が明記されている。

本プロジェクトもこれに従う。

したがって第1冊では、

**SwarmUI coreへの変更を1行も行わない**

ことを重要な合格条件とする。

---

# 6. Codexにとって重要な注意点

SwarmUIリポジトリには既存の、

```text
AGENTS.md
```

が存在する。

ただし現在のSwarmUI側AGENTS.md自身が、

「これはSwarmUI core開発用であり、`src/Extensions/` 内だけで完結するExtension開発には適用されない」

という趣旨を明記している。さらに同文書では外部Extensionは `src/Extensions` に置き、その作業はExtensionフォルダ内に限定するよう整理されている。

本プロジェクトではSwarmUIルートの `AGENTS.md` を変更しない。

代わりに、

```text
src/Extensions/SwarmManga/AGENTS.md
```

を作成する。

以降のCodex作業では、このExtensionローカルAGENTS.mdを本プロジェクトの恒久指示として利用する。

---

# 7. 第1冊で作成するディレクトリ構造

Codexは以下を作成する。

```text
SwarmUI/
└─ src/
   └─ Extensions/
      └─ SwarmManga/
         │
         ├─ AGENTS.md
         ├─ SwarmMangaExtension.cs
         ├─ SwarmMangaExtension.csproj
         ├─ README.md
         │
         ├─ Assets/
         │  ├─ manga.js
         │  └─ manga.css
         │
         ├─ Tabs/
         │  └─ Text2Image/
         │     └─ Manga.html
         │
         └─ docs/
            └─ BOOK1_RESULT.md
```

`BOOK1_RESULT.md` は最初は空でもよい。

Codexが実装・テストを終えた後に結果を書く。

---

# 8. Extension名

内部名称:

```text
SwarmManga
```

表示名:

```text
Manga
```

C#クラス:

```text
SwarmMangaExtension
```

namespace:

```text
MangaTools.SwarmManga
```

とする。

【確認済み注意事項】

公式Extension開発ドキュメントでは、外部Extensionのnamespaceに `SwarmUI` を含めないよう明示されている。

したがって、

```csharp
namespace SwarmUI.SwarmManga;
```

は禁止する。

---

# 9. SwarmMangaExtension.cs

第1冊で必要なC#処理は最小限にする。

推奨初期コード:

```csharp
using SwarmUI.Core;
using SwarmUI.Utils;

namespace MangaTools.SwarmManga;

/// <summary>
/// Entry point for the Swarm Manga extension.
/// </summary>
public class SwarmMangaExtension : Extension
{
    /// <summary>
    /// Registers the browser assets used by the Manga tab.
    /// </summary>
    public override void OnInit()
    {
        ScriptFiles.Add("Assets/manga.js");
        StyleSheetFiles.Add("Assets/manga.css");

        Description = "Experimental manga-production frontend for SwarmUI.";
        License = "MIT";

        Logs.Init("SwarmManga extension initialized.");
    }
}
```

この段階では、

- API route
- ComfyUI
- Regional Prompt
- T2I parameter
- WorkflowGenerator

を登録してはならない。

このファイルの責務は、

1. Extensionとしてロードされる
2. JavaScriptを登録する
3. CSSを登録する
4. ロード成功をログへ出す

だけとする。

---

# 10. csproj

【確認済み】

2026年現在のSwarmUI Extensionは独自 `.csproj` を持てる。

公式ドキュメントでは、

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
    <PropertyGroup>
        <AssemblyName>MyFirstExtension</AssemblyName>
    </PropertyGroup>
    <Import Project="../../SwarmUI.extension.props" />
</Project>
```

というテンプレートが提供されている。

SwarmMangaでは以下を使用する。

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
    <PropertyGroup>
        <AssemblyName>SwarmManga</AssemblyName>
    </PropertyGroup>

    <Import Project="../../SwarmUI.extension.props" />
</Project>
```

ファイル名:

```text
SwarmMangaExtension.csproj
```

とする。

`.csproj` が複数ある場合にExtensionを含む名前を優先する仕様も公式ドキュメントに記載されているため、この名称を採用する。

追加NuGet Packageは第1冊では禁止する。

---

# 11. Manga.html

目的は、

「Extension独自UIがSwarmUIのタブとして表示できる」

ことの確認だけである。

初期案:

```html
<section id="swarm-manga-root" class="swarm-manga-root">
    <header class="swarm-manga-header">
        <div>
            <h2>Swarm Manga</h2>
            <p>
                Experimental manga-production frontend.
            </p>
        </div>

        <span
            id="swarm-manga-load-state"
            class="swarm-manga-status"
        >
            HTML loaded
        </span>
    </header>

    <div class="swarm-manga-test-panel">
        <h3>Extension Smoke Test</h3>

        <p>
            This page verifies that the SwarmManga extension,
            its JavaScript, and its stylesheet loaded correctly.
        </p>

        <button
            id="swarm-manga-smoke-button"
            type="button"
            class="btn btn-primary"
        >
            Run UI Smoke Test
        </button>

        <pre
            id="swarm-manga-smoke-result"
            class="swarm-manga-smoke-result"
        >Waiting for JavaScript...</pre>
    </div>
</section>
```

重要:

第1冊ではSwarmUI既存Generate UIのDOMを複製しない。

既存UI内部の非公開DOM構造にも依存しない。

---

# 12. manga.js

第1冊では外部JavaScriptライブラリを使用しない。

React、Vue、Fabric.js、Konva.js等もまだ導入しない。

Vanilla JavaScriptのみでロード確認する。

推奨コード:

```javascript
(() => {
    "use strict";

    const ROOT_ID = "swarm-manga-root";

    function initializeSwarmManga() {
        const root = document.getElementById(ROOT_ID);

        if (!root) {
            return;
        }

        if (root.dataset.swarmMangaInitialized === "true") {
            return;
        }

        root.dataset.swarmMangaInitialized = "true";

        const state = document.getElementById(
            "swarm-manga-load-state"
        );

        const button = document.getElementById(
            "swarm-manga-smoke-button"
        );

        const result = document.getElementById(
            "swarm-manga-smoke-result"
        );

        if (state) {
            state.textContent = "HTML + JS loaded";
        }

        if (result) {
            result.textContent =
                "JavaScript initialized successfully.";
        }

        if (button && result) {
            button.addEventListener("click", () => {
                const now = new Date();

                result.textContent =
                    "Smoke test passed.\n" +
                    `Time: ${now.toISOString()}`;
            });
        }

        console.info(
            "[SwarmManga] Extension frontend initialized."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeSwarmManga
        );
    }
    else {
        initializeSwarmManga();
    }
})();
```

重要:

関数や変数を可能な限りグローバル空間へ出さない。

SwarmUI本体や他Extensionとの名称衝突を避ける。

---

# 13. manga.css

すべてのCSS selectorを、

```text
swarm-manga-
```

で名前空間化する。

例:

```css
.swarm-manga-root {
    box-sizing: border-box;
    width: 100%;
    padding: 1rem;
}

.swarm-manga-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
}

.swarm-manga-header h2 {
    margin-top: 0;
}

.swarm-manga-status {
    display: inline-block;
    padding: 0.35rem 0.65rem;
    border: 1px solid currentColor;
    border-radius: 0.4rem;
    font-size: 0.85rem;
}

.swarm-manga-test-panel {
    max-width: 52rem;
    padding: 1rem;
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 0.5rem;
}

.swarm-manga-smoke-result {
    margin-top: 1rem;
    padding: 0.75rem;
    min-height: 4rem;
    overflow: auto;
}
```

第1冊では、

```css
body {}
button {}
textarea {}
.nav {}
```

のようなSwarmUI全体へ作用するselectorは禁止する。

---

# 14. ExtensionローカルAGENTS.md

以下を作成する。

```markdown
# SwarmManga Agent Rules

These instructions apply to all work inside this extension.

## Scope

All implementation work must remain inside:

src/Extensions/SwarmManga/

Do not modify SwarmUI core files unless the user explicitly approves
a future design change that requires it.

## Current Phase

The current phase is Book 1: Extension feasibility proof.

Do not implement manga generation features yet.

Do not add:

- Regional Prompt compilation
- Generation API calls
- ComfyUI workflow changes
- LoRA management
- Wildcards
- Panel canvas editing
- Project save/load

unless a later specification explicitly requests them.

## Architecture

SwarmUI is the host.

SwarmManga is an external extension.

Keep the extension self-contained.

Prefer public extension APIs over DOM hacks or core modifications.

## Frontend

Namespace DOM IDs and CSS classes with `swarm-manga-`.

Avoid global JavaScript variables.

Do not add third-party frontend dependencies during Book 1.

## C#

Namespace must not contain `SwarmUI`.

Use:

MangaTools.SwarmManga

The main extension class is:

SwarmMangaExtension

## Safety

Never modify:

Data/
Models/
Output/
dlbackend/

Do not modify generated build directories.

## When uncertain

Inspect the currently checked-out SwarmUI source.

Do not guess an API signature.

If the current source conflicts with the specification,
document the conflict before making a broader change.
```

---

# 15. README.md

最低限以下を書く。

```markdown
# SwarmManga

Experimental manga-production frontend extension for SwarmUI.

## Current status

Book 1 / extension feasibility prototype.

The current build only verifies:

- external extension loading
- Manga tab registration
- extension JavaScript loading
- extension stylesheet loading

No image-generation functionality is implemented yet.

## Installation for local development

Place this repository at:

src/Extensions/SwarmManga/

Then launch SwarmUI using its development launcher.

## Important

SwarmManga is intended to remain an external extension.

SwarmUI core modifications are not required for the Book 1 prototype.
```

---

# 16. 開発環境記録

Codexは実装前に必ず現在環境を記録する。

以下を取得する。

```text
git rev-parse HEAD
git status --short
dotnet --version
```

可能なら、

```text
git log -1 --format="%H %ci %s"
```

も取得する。

結果は最終的に、

```text
src/Extensions/SwarmManga/docs/BOOK1_RESULT.md
```

へ記録する。

理由:

この仕様書は2026-09-01時点のSwarmUIを調査して作成しているが、SwarmUIは更新頻度が高い。

したがって実装時点のcommit hashを「実際に動いた基準バージョン」として残す。

---

# 17. Windows開発時の起動

【確認済み】

SwarmUIには現在、

```text
launch-windows-dev.ps1
```

が存在する。

このスクリプトはDebug構成でSwarmUIをbuildしてから開発モードで起動する。

公式Extensionドキュメントも、Extension開発時にはdev launcherを利用して再buildする方法を案内している。

したがって第1冊の開発確認では、通常のショートカット起動ではなく、

```powershell
.\launch-windows-dev.ps1
```

を第一候補とする。

PowerShell execution policy等の環境問題が存在する場合は、既存環境を無理に変更せず、その問題を `BOOK1_RESULT.md` に記録する。

---

# 18. 通常ユーザー向けExtension導入

【確認済み】

SwarmUIには、

```text
Server
→ Extensions
```

というExtension管理UIがあり、公式リストに登録されたExtensionはそこからInstallできる。

ただしSwarmMangaは開発初期段階では公式Extension Listに存在しない。

したがって第1冊では、

```text
git clone
```

またはCodexによる直接作成で、

```text
src/Extensions/SwarmManga/
```

へ配置する。

将来公開する場合は、

SwarmManga専用Git repository
↓
SwarmUI extension list
↓
Server > Extensions > Install

という導線を目標とする。

---

# 19. 重要な現行注意事項

2026-08-04付で、Extensionのbuildに失敗した場合、Extensions UI上で「Installed / Available」の状態表示が不整合になるケースがSwarmUI issueとして報告されている。

したがって開発初期段階では、

「Server > Extensionsの表示だけ」

を成功・失敗判定に使わない。

必ず、

- 起動コンソール
- build result
- Mangaタブ
- JavaScript Smoke Test
- browser console

を確認する。

---

# 20. 第1冊のテスト

テストA:

SwarmUIがbuildできる。

テストB:

起動ログに、

```text
SwarmManga extension initialized.
```

相当のログが出る。

テストC:

Text2Image画面に、

```text
Manga
```

タブが出る。

テストD:

Mangaタブを開く。

以下が表示される。

```text
Swarm Manga
Experimental manga-production frontend.
```

テストE:

Status表示が、

```text
HTML loaded
```

から、

```text
HTML + JS loaded
```

へ変化する。

テストF:

Smoke Testボタンを押す。

```text
Smoke test passed.
Time: ...
```

が表示される。

テストG:

CSSが適用され、Test Panel等にレイアウトが反映される。

テストH:

Browser DevTools consoleに、

```text
[SwarmManga] Extension frontend initialized.
```

が出る。

テストI:

SwarmUI coreに意図しない変更がないことを確認する。

`git status --short`

の結果を調べる。

SwarmManga以外のtracked file変更が存在した場合、第1冊としては原則不合格。

---

# 21. 合格条件

第1冊は以下がすべて成立した場合のみ成功とする。

```text
[PASS] Extensionフォルダだけで実装できた

[PASS] SwarmUI coreを変更していない

[PASS] C# Extensionがロードされた

[PASS] Mangaタブが追加された

[PASS] Extension HTMLが表示された

[PASS] Extension JavaScriptがロードされた

[PASS] Extension CSSがロードされた

[PASS] SwarmUIの通常Generate画面が壊れていない

[PASS] SwarmUIを通常通り終了できた
```

---

# 22. 部分成功

以下の場合は「部分成功」とする。

例:

```text
Extensionはロードされる
Mangaタブも出る
しかしCSS assetのみ読み込み方が変更されていた
```

この場合、SwarmUI coreへ手を入れてはいけない。

現行Extension APIを再調査する。

---

# 23. 失敗条件

次の場合は第2冊へ進まない。

```text
SwarmUI coreを直接変更しないとタブが作れない

Extensionから十分なWeb UIを構築できない

Extensionの独立buildが構造的に成立しない

現行SwarmUIがExtension HTML/JS/CSS方式を廃止している
```

ただしこの場合も即座に「SwarmUIは使えない」と判断しない。

Codexは、

「なぜ現在のSwarmUIでは成立しなかったか」

を具体的に記録する。

---

# 24. Codexがしてはいけないこと

第1冊実装時に、

「将来必要になるから」

という理由で余計な機能を追加しない。

特に禁止:

```text
SwarmUI Generate APIへの接続

Regional Prompt構文生成

Canvasライブラリ導入

React導入

Vue導入

Node.js build system追加

LoRA一覧取得

Model一覧取得

ComfyUI API直接接続

Project JSON

LocalStorage

IndexedDB

画像アップロード

ドラッグ矩形

Panel Card

Wildcard

Preset

ControlNet
```

これらは第1冊の目的ではない。

---

# 25. Codexが現行コードと仕様書の差異を発見した場合

現行SwarmUIソースを優先して確認する。

ただし勝手に設計変更してはいけない。

小さな互換修正なら行ってよい。

例:

```text
ScriptFiles.Add
```

のAPI名だけが変更されている場合。

大きな設計差の場合は実装を無理に進めず、

`BOOK1_RESULT.md`

へ、

```text
SPEC DIFFERENCE
```

として記録する。

---

# 26. BOOK1_RESULT.md

この文書は非常に重要である。

次の冊子は、この結果を読み直してから作成する。

Codexは作業終了時に以下を記録する。

```markdown
# Book 1 Result

## Environment

SwarmUI commit:
SwarmUI commit date:

OS:

dotnet version:

## Extension

Path:

Build result:

Extension load result:

## UI Tests

Manga tab visible:
PASS / FAIL

HTML visible:
PASS / FAIL

JavaScript:
PASS / FAIL

CSS:
PASS / FAIL

Smoke test:
PASS / FAIL

Normal Generate tab still works:
PASS / FAIL

## Core Modification Check

Files modified outside src/Extensions/SwarmManga:

None

or list them here.

## Specification Differences

List any differences between Book 1 and the actual current
SwarmUI extension APIs.

## Problems

List errors and warnings.

## Decisions Made

List implementation decisions Codex had to make.

## Recommended Next Investigation

Do not implement the next stage.

Only describe what should be investigated next.
```

---

# 27. 第1冊後の開発方針

第1冊終了後、ただちに第2冊を実装しない。

まず、

```text
BOOK1_RESULT.md
```

と実際に生成されたコードを確認する。

その結果を材料に、

**Pre-Book 2**

を作成する。

Pre-Book 2は「実装命令書」ではない。

役割は、

```text
第1冊で確認できた事実

現行SwarmUIの実際の構造

使えそうなAPI

避けた方がよい方法

漫画UI構築方法の候補

Canvas技術候補

SwarmUI Generate APIとの接続候補

Regional Promptとの接続候補
```

を整理する技術調査書とする。

その後、

Pre-Book 2
＋
第1冊の実装結果

を基に正式な第2冊を作る。

これは現時点では提案であり、第1冊の結果次第で変更してよい。

---

# 28. この方式を採る理由

AIによる長期開発では、

「最初に全10冊の詳細仕様を固定する」

と、実際のコード構造との差が後半になるほど大きくなる。

そのため、

```text
仕様
↓
実装
↓
実地結果
↓
次の調査
↓
次の仕様
```

という循環を採る。

各冊を、

「次の冊の仮説」

ではなく、

「その時点で検証できる最小単位」

にする。

---

# 29. 第1冊のCodex用実行指示

以下をCodexへの実際の依頼文として使用できる。

---

SwarmUI repository内に、外部Extension `SwarmManga` のBook 1 prototypeを実装してください。

目的は漫画生成機能の実装ではありません。

今回の唯一の主要目的は、

「SwarmUI coreを変更せず、`src/Extensions/SwarmManga/` 内だけで、独立したMangaタブとExtension由来のHTML/JavaScript/CSSを正常にロードできること」

を実証することです。

作業前に必ず現在のSwarmUIソースを確認してください。

特に、

- `docs/Making Extensions.md`
- `src/Core/Extension.cs`
- `src/Core/WebServer.cs`
- 現在のExtension実装例

を参照してください。

実装前に、

```text
git rev-parse HEAD
git status --short
dotnet --version
```

を確認してください。

変更範囲は原則、

```text
src/Extensions/SwarmManga/
```

だけにしてください。

SwarmUI coreを変更しないでください。

以下を作成してください。

```text
src/Extensions/SwarmManga/
├─ AGENTS.md
├─ SwarmMangaExtension.cs
├─ SwarmMangaExtension.csproj
├─ README.md
├─ Assets/
│  ├─ manga.js
│  └─ manga.css
├─ Tabs/
│  └─ Text2Image/
│     └─ Manga.html
└─ docs/
   └─ BOOK1_RESULT.md
```

仕様書記載のコードはreference implementationです。

現在のSwarmUI APIと軽微な差がある場合は、現在のAPIに合わせて最小限修正してください。

ただし設計を大きく変更する必要がある場合は、SwarmUI coreをhackせず、その理由を `BOOK1_RESULT.md` に記録してください。

今回、以下は実装しないでください。

- image generation
- Regional Prompt
- LoRA
- Wildcard
- Canvas rectangle editor
- ComfyUI workflow manipulation
- project save/load
- external frontend framework

ExtensionをbuildしてSwarmUIを起動し、可能な範囲で以下を確認してください。

```text
Manga tab visible

Extension HTML visible

Extension JavaScript loaded

Extension CSS loaded

Smoke Test button works

normal SwarmUI Generate UI remains functional
```

最後に必ず、

```text
src/Extensions/SwarmManga/docs/BOOK1_RESULT.md
```

へ実装結果を書いてください。

また最終報告では、

```text
1. 作成したファイル
2. 変更したファイル
3. SwarmUI commit
4. build結果
5. Manga tab確認結果
6. JavaScript/CSS確認結果
7. SwarmUI coreに変更がないこと
8. 現行仕様との差異
9. 未解決事項
```

を報告してください。

第2段階の機能は実装しないでください。

---

# 30. 第1冊の最終判断基準

この段階では画面が質素でも問題ない。

価値があるのは、

```text
SwarmUI Portable / Installation
        │
        ▼
   SwarmUI Core
        │
        │ core modification = 0
        │
        ▼
src/Extensions/SwarmManga
        │
        ├── C#
        ├── HTML
        ├── JS
        └── CSS
        │
        ▼
     Manga Tab
```

が実際に成立することである。

成立すれば次の段階で初めて、

```text
Manga Tab
↓
Page Canvas
↓
Region
↓
Prompt Card
↓
Swarm Regional Prompt
↓
Generate
```

へ進む。

第1冊では、その入口だけを確実に作る。

---

# 31. 現時点での成立可能性評価

2026-09-01時点の公開SwarmUIソースを見る限り、

**外部Extension方式でManga UIを構築できる可能性は高い**

と判断する。

その根拠は、

- 外部Extension用の `src/Extensions` が公式構造として存在する
- Extension用C#クラスが正式に用意されている
- 独自csprojに対応している
- Extension側からJavaScript/CSSを登録できる
- `Tabs/Text2Image/*.html` をSwarmUI本体が自動的に追加タブ化している
- SwarmUI自身がcore hackingではなくExtensionでの機能追加を推奨している

ためである。

したがって第1冊では、

「できるかどうかを推測する」

段階から、

「実際に最小Extensionを作り、現行環境で成立を証明する」

段階へ移行する。

以上。