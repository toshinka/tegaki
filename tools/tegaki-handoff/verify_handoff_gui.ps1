[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$toolRoot = $PSScriptRoot
$repoRoot = [IO.Path]::GetFullPath((Join-Path $toolRoot '..\..'))
. (Join-Path $toolRoot 'handoff_gui_core.ps1')
Add-Type -AssemblyName System.Windows.Forms

$passed = 0
function Assert-GuiTest {
    param([bool]$Condition, [string]$Name)
    if (-not $Condition) { throw "FAIL $Name" }
    $script:passed++
    Write-Output "$Name PASS"
}
function Assert-GuiThrows {
    param([scriptblock]$Action, [string]$Name)
    $threw = $false
    try { & $Action } catch { $threw = $true }
    Assert-GuiTest $threw $Name
}
function Invoke-FixtureGit {
    param([string]$Root, [string[]]$Arguments)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & git -C $Root @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($exitCode -ne 0) { throw "fixture git failed: $output" }
}
function Invoke-FixtureStage {
    param([string]$Root, [string]$CardText)
    Set-GuiClipboardText -Text $CardText
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $toolRoot 'stage_card_from_clipboard.ps1') -RepoRoot $Root -FriendlyErrors 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}
function New-FixtureCard {
    param(
        [string]$Version,
        [string]$CardId,
        [string]$BaseSha,
        [string]$Channel = 'H3',
        [string]$Target = 'LUNA'
    )
    if ($Version -eq 'TEGAKI_CARD_V1') {
        return @"
TEGAKI_CARD_V1
CARD_ID: $CardId
TARGET: $Target
BASE_SHA: $BaseSha
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

Fixture Card body.
"@
    }
    return @"
TEGAKI_CARD_V2
CHANNEL: $Channel
CARD_ID: $CardId
TARGET: $Target
BASE_SHA: $BaseSha
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

Fixture Card body.
"@
}

$launcherPath = Join-Path $toolRoot 'TEGAKI_HANDOFF_GUI.cmd'
$guiPath = Join-Path $toolRoot 'TEGAKI_HANDOFF_GUI.ps1'
$corePath = Join-Path $toolRoot 'handoff_gui_core.ps1'
$stagePath = Join-Path $toolRoot 'stage_card_from_clipboard.ps1'
$launcherText = [IO.File]::ReadAllText($launcherPath)
$guiText = [IO.File]::ReadAllText($guiPath)
$coreText = [IO.File]::ReadAllText($corePath)
$stageText = [IO.File]::ReadAllText($stagePath)
$head = Get-GuiCurrentHead $repoRoot

# A-H: launcher, repository, settings, and window contract.
Assert-GuiTest ($launcherText -match '%~dp0' -and $launcherText -match 'REPO_ROOT') 'A launcher resolves own tool path'
Assert-GuiTest ((Resolve-GuiRepositoryRoot) -ceq $repoRoot) 'B repo root auto-detection'
Assert-GuiTest ((Resolve-GuiRepositoryRoot -RequestedRoot $repoRoot) -ceq $repoRoot) 'C manual root validation'
$invalidRoot = Join-Path ([IO.Path]::GetTempPath()) ('tegaki-handoff-invalid-' + [Guid]::NewGuid().ToString('N'))
Assert-GuiThrows { Resolve-GuiRepositoryRoot -RequestedRoot $invalidRoot } 'D invalid root rejected'
$settingsPath = Get-GuiSettingsPath
Assert-GuiTest (-not ([IO.Path]::GetFullPath($settingsPath).StartsWith(($repoRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase))) 'E settings outside repo'
Assert-GuiTest ([bool](Get-GuiDefaultSettings).always_on_top) 'F TopMost default ON'
Assert-GuiTest ($guiText -match '常に手前に表示' -and $guiText -match 'Add_CheckedChanged' -and $guiText -match '\$form\.TopMost = \[bool\]\$alwaysOnTop\.Checked') 'G TopMost toggle immediate'
Assert-GuiTest ($guiText -match 'MinimizeBox = \$true' -and $guiText -match 'ShowInTaskbar = \$true' -and $guiText -match 'ClientSize = New-GuiSize 570 650') 'H compact movable window'

# I-P: H3 implementation contract and cross-lane validation.
Assert-GuiTest ($guiText -match 'stage_card_from_clipboard\.ps1' -and $stageText -match 'TEGAKI_CARD_V2' -and $stageText -match "CHANNEL.*H3") 'I H3 actual V0.1-compatible staging path'
$h3v1 = New-FixtureCard -Version TEGAKI_CARD_V1 -CardId H3-GUI-TEST-001 -BaseSha $head
$h3v2 = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId H3-GUI-TEST-002 -BaseSha $head
$manga = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId MANGA-GUI-TEST-001 -BaseSha $head -Channel MANGA -Target GEMINI
Assert-GuiTest ((Test-GuiCard -Text $h3v1 -Lane H3 -ExpectedBaseSha $head).Valid) 'J H3 V1 compatible'
Assert-GuiTest ((Test-GuiCard -Text $h3v2 -Lane H3 -ExpectedBaseSha $head).Valid) 'K H3 V2 accepted'
Assert-GuiTest (-not (Test-GuiCard -Text $manga -Lane H3 -ExpectedBaseSha $head).Valid -and -not (Test-GuiCard -Text $h3v1 -Lane MANGA -ExpectedBaseSha $head).Valid) 'L H3/MANGA channel mismatch rejected'
Assert-GuiTest ((Test-GuiCard -Text $manga -Lane MANGA -ExpectedBaseSha $head).Valid) 'M valid Manga V2 accepted'
Assert-GuiTest (-not (Test-GuiCard -Text ($manga -replace 'CARD_ID: MANGA-GUI-TEST-001', 'CARD_ID: H3-GUI-TEST-003') -Lane MANGA -ExpectedBaseSha $head).Valid) 'N Manga with H3 ID rejected'
Assert-GuiTest (-not (Test-GuiCard -Text ($h3v1 -replace 'CARD_ID: H3-GUI-TEST-001', 'CARD_ID: MANGA-GUI-TEST-002') -Lane H3 -ExpectedBaseSha $head).Valid) 'O H3 with MANGA ID rejected'
$wrongSha = ('0' * 40)
Assert-GuiTest (-not (Test-GuiCard -Text ($h3v1 -replace [regex]::Escape("BASE_SHA: $head"), "BASE_SHA: $wrongSha") -Lane H3 -ExpectedBaseSha $head).Valid) 'P BASE_SHA mismatch rejected'

# Q: exercise the actual staging writers in an isolated temporary Git repo.
$fixtureBase = 'C:\Users\MAX\.codex\visualizations\2026\09\08\01a07f09-0de3-7e92-a8bb-f365b3648ed8'
$fixtureRoot = Join-Path $fixtureBase ('.tmp-handoff-gui-v1a-' + [Guid]::NewGuid().ToString('N'))
$originalClipboard = $null
$hadOriginalClipboard = $false
try {
    try {
        if ([System.Windows.Forms.Clipboard]::ContainsText()) { $originalClipboard = [System.Windows.Forms.Clipboard]::GetText(); $hadOriginalClipboard = $true }
    }
    catch { }
    $null = New-Item -ItemType Directory -Path $fixtureRoot -Force
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('init', '--quiet')
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'fixture.txt'), 'fixture')
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('add', 'fixture.txt')
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('-c', 'user.name=TEGAKI Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture')
    $fixtureHead = Get-GuiCurrentHead $fixtureRoot
    $stageV1 = Invoke-FixtureStage -Root $fixtureRoot -CardText (New-FixtureCard -Version TEGAKI_CARD_V1 -CardId H3-FIXTURE-V1 -BaseSha $fixtureHead)
    $statePath = Join-Path $fixtureRoot '.tegaki-handoff\state.json'
    Assert-GuiTest ($stageV1.ExitCode -eq 0 -and (Get-Content -Raw $statePath | ConvertFrom-Json).status -eq 'READY') 'Q1 H3 V1 actual staging READY'
    $stageV2 = Invoke-FixtureStage -Root $fixtureRoot -CardText (New-FixtureCard -Version TEGAKI_CARD_V2 -CardId H3-FIXTURE-V2 -BaseSha $fixtureHead)
    $stateAfterV2 = Get-Content -Raw $statePath | ConvertFrom-Json
    Assert-GuiTest ($stageV2.ExitCode -eq 0 -and $stateAfterV2.status -eq 'READY' -and $stateAfterV2.card_id -ceq 'H3-FIXTURE-V2') 'Q2 H3 V2 actual staging READY'
    $badChannel = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId H3-FIXTURE-BAD-CHANNEL -BaseSha $fixtureHead -Channel MANGA
    $badTarget = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId H3-FIXTURE-BAD-TARGET -BaseSha $fixtureHead -Target GEMINI
    $badPrefix = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId BAD-FIXTURE-001 -BaseSha $fixtureHead
    $badBase = New-FixtureCard -Version TEGAKI_CARD_V2 -CardId H3-FIXTURE-BAD-BASE -BaseSha ('0' * 40)
    Assert-GuiTest ((Invoke-FixtureStage -Root $fixtureRoot -CardText $badChannel).ExitCode -ne 0) 'Q3 H3 V2 wrong CHANNEL rejected'
    Assert-GuiTest ((Invoke-FixtureStage -Root $fixtureRoot -CardText $badTarget).ExitCode -ne 0) 'Q4 H3 V2 wrong TARGET rejected'
    Assert-GuiTest ((Invoke-FixtureStage -Root $fixtureRoot -CardText $badPrefix).ExitCode -ne 0) 'Q5 H3 V2 wrong prefix rejected'
    Assert-GuiTest ((Invoke-FixtureStage -Root $fixtureRoot -CardText $badBase).ExitCode -ne 0) 'Q6 BASE mismatch rejected'
    $mangaStage = Stage-GuiMangaCard -RepoRoot $fixtureRoot -CardText (New-FixtureCard -Version TEGAKI_CARD_V2 -CardId MANGA-FIXTURE-V2 -BaseSha $fixtureHead -Channel MANGA -Target GEMINI)
    $mangaStatePath = Join-Path $fixtureRoot '.tegaki-handoff\manga\state.json'
    $h3StateCheck = Get-Content -Raw $statePath | ConvertFrom-Json
    $mangaStateCheck = Get-Content -Raw $mangaStatePath | ConvertFrom-Json
    Assert-GuiTest ($mangaStage.Status -eq 'READY' -and $mangaStateCheck.card_id -ceq 'MANGA-FIXTURE-V2') 'Q7 Manga V2 actual staging READY'
    Assert-GuiTest ($h3StateCheck.card_id -ceq 'H3-FIXTURE-V2' -and $statePath -ne $mangaStatePath) 'Q8 H3 and Manga state independent'

    # R/S: reports and generated transfer strings are exercised against fixture files.
    $h3Report = "TEGAKI_REPORT_V1`r`nCARD_ID: H3-FIXTURE-V2`r`nRESULT: PASS`r`n`r`nH3 fixture report.`r`n"
    $mangaReport = "TEGAKI_REPORT_V1`r`nCARD_ID: MANGA-FIXTURE-V2`r`nRESULT: PASS WITH LIMIT`r`n`r`nManga fixture report.`r`n"
    [IO.File]::WriteAllText((Join-Path $fixtureRoot '.tegaki-handoff\from_luna\latest_report.md'), $h3Report)
    [IO.File]::WriteAllText((Join-Path $fixtureRoot '.tegaki-handoff\manga\from_gemini\latest_report.md'), $mangaReport)
    $runH3 = New-GuiRunTransferText -Lane H3 -RepoRoot $fixtureRoot
    $runManga = New-GuiRunTransferText -Lane MANGA -RepoRoot $fixtureRoot
    Assert-GuiTest ($runH3 -match '\[H3 -> CODEX\]' -and $runH3 -match 'current validated H3 Card' -and $runH3 -match 'earlier chat history' -and $runH3 -match 'Manga work' -and $runH3 -match 'Do not push' -and $runH3 -match 'Human send is required') 'R H3 Run safety text'
    Assert-GuiTest ($runManga -match '\[MANGA -> GEMINI\]' -and $runManga -match 'current validated MANGA Card' -and $runManga -match 'older Manga Cards' -and $runManga -match 'M3B_PRODUCTION_CLOSED' -and $runManga -match 'H3 work' -and $runManga -match 'Do not push' -and $runManga -match 'Human send is required') 'S Manga Run safety text'
    $returnH3 = New-GuiReturnTransferText -Lane H3 -RepoRoot $fixtureRoot
    $returnManga = New-GuiReturnTransferText -Lane MANGA -RepoRoot $fixtureRoot
    $h3ReportIndex = $returnH3.IndexOf($h3Report)
    $mangaReportIndex = $returnManga.IndexOf($mangaReport)
    Assert-GuiTest ($returnH3.StartsWith('[H3 -> WEBGPT]') -and $h3ReportIndex -ge 0 -and $returnH3.Substring($h3ReportIndex, $h3Report.Length) -ceq $h3Report -and $returnH3 -match 'current GitHub main' -and $returnH3 -match 'Independently audit' -and $returnH3 -match 'Do not accept the agent Report blindly' -and $returnH3 -match 'Manga work') 'T H3 Return audit instruction'
    Assert-GuiTest ($returnManga.StartsWith('[MANGA -> WEBGPT]') -and $mangaReportIndex -ge 0 -and $returnManga.Substring($mangaReportIndex, $mangaReport.Length) -ceq $mangaReport -and $returnManga -match 'GitHub/main and Manga SSOT/boundary' -and $returnManga -match 'historical Manga Cards' -and $returnManga -match 'H3 work' -and $returnManga -match 'implementation HOLD') 'U Manga Return audit instruction'
    Assert-GuiThrows { Assert-GuiReport -ReportText ($h3Report -replace 'H3-FIXTURE-V2', 'H3-OTHER') -ExpectedCardId 'H3-FIXTURE-V2' } 'V H3 report Card-ID mismatch rejected'
    Assert-GuiThrows { Assert-GuiReport -ReportText ($mangaReport -replace 'MANGA-FIXTURE-V2', 'MANGA-OTHER') -ExpectedCardId 'MANGA-FIXTURE-V2' } 'W Manga report Card-ID mismatch rejected'
}
finally {
    if ($hadOriginalClipboard) { try { Set-GuiClipboardText -Text $originalClipboard } catch { } }
    else { try { [System.Windows.Forms.Clipboard]::Clear() } catch { } }
    if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# X-Z: GUI contract, localization, and transfer safety.
Assert-GuiTest ((Get-GuiRoutePrefix H3_AGENT) -ceq '[H3 -> CODEX]' -and (Get-GuiRoutePrefix H3_WEBGPT) -ceq '[H3 -> WEBGPT]' -and (Get-GuiRoutePrefix MANGA_AGENT) -ceq '[MANGA -> GEMINI]' -and (Get-GuiRoutePrefix MANGA_WEBGPT) -ceq '[MANGA -> WEBGPT]') 'X prefixes exact'
$mainButtons = [regex]::Matches($guiText, '\$stage = New-GuiButton|\$run = New-GuiButton|\$report = New-GuiButton')
Assert-GuiTest ($mainButtons.Count -eq 3 -and $guiText -match 'カードを取り込む' -and $guiText -match 'Codexへ実行指示' -and $guiText -match 'H3 WebGPTへ報告' -and $guiText -match 'Geminiへ実行指示' -and $guiText -match 'Manga WebGPTへ報告' -and $guiText -notmatch 'Copy H3 Report|Paste Return|Focus \+ paste') 'Y three daily actions per lane'
$japaneseLabels = @('リポジトリ', '変更...', '常に手前に表示', '状態を更新', "'状態'", "'カード'", "'最新報告'", '接続先設定')
$labelsPass = $true
foreach ($label in $japaneseLabels) { if ($guiText -notmatch [regex]::Escape($label)) { $labelsPass = $false } }
Assert-GuiTest $labelsPass 'Z Japanese Owner labels and target settings'

# AA-AF: explicit paste guard and no auto-send/browser automation.
$zero = Resolve-GuiTargetWindow -Windows @([pscustomobject]@{ Title = 'unrelated window' }) -Token 'Codex'
$multiple = Resolve-GuiTargetWindow -Windows @([pscustomobject]@{ Title = 'Codex one' }, [pscustomobject]@{ Title = 'Codex two' }) -Token 'Codex'
Assert-GuiTest ($zero.Status -ceq 'TARGET NOT FOUND' -and $multiple.Status -ceq 'TARGET AMBIGUOUS') 'AA target missing/ambiguous fail-closed'
Assert-GuiTest ($coreText -match "SendWait\('\^v'\)" -and $coreText -notmatch '\{ENTER\}|\^~|Send button' -and $guiText -notmatch 'Add_.*Timer|ClipboardWatcher|Document\.getElementById|chrome\.') 'AB Ctrl+V only / no browser automation'
Assert-GuiTest ($guiText -notmatch 'Add_Shown[\s\S]{0,800}Set-GuiClipboardText' -and $guiText -notmatch 'Clipboard.*watch|watch.*Clipboard|poll') 'AC clipboard changes only from explicit actions'
$ignoreText = [IO.File]::ReadAllText((Join-Path $repoRoot '.gitignore'))
Assert-GuiTest ($ignoreText -match '(?m)^/\.tegaki-handoff/$') 'AD .tegaki-handoff ignored'
$parseErrors = @()
foreach ($file in @(Get-ChildItem -LiteralPath $toolRoot -Filter '*.ps1' -File -Recurse)) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    $parseErrors += @($errors)
}
Assert-GuiTest ($parseErrors.Count -eq 0) 'AE PowerShell syntax'
$oldPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$diffOutput = & git -C $repoRoot diff --check -- tools/tegaki-handoff 2>&1
$diffExit = $LASTEXITCODE
$ErrorActionPreference = $oldPreference
Assert-GuiTest ($diffExit -eq 0) 'AF git diff check'

Write-Output "GUI V1A VERIFIER PASS ($passed checks)"
