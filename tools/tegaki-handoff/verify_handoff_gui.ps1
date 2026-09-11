[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$toolRoot = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $toolRoot '..\..') | Select-Object -ExpandProperty Path
. (Join-Path $toolRoot 'handoff_gui_core.ps1')

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

$head = Get-GuiCurrentHead $repoRoot
$launcherPath = Join-Path $toolRoot 'TEGAKI_HANDOFF_GUI.cmd'
$guiPath = Join-Path $toolRoot 'TEGAKI_HANDOFF_GUI.ps1'
$corePath = Join-Path $toolRoot 'handoff_gui_core.ps1'
$launcherText = [IO.File]::ReadAllText($launcherPath)
$guiText = [IO.File]::ReadAllText($guiPath)
$coreText = [IO.File]::ReadAllText($corePath)

# A: the double-click launcher derives its own tool path.
Assert-GuiTest ($launcherText -match '%~dp0' -and $launcherText -match 'REPO_ROOT') 'A launcher resolves own tool path'

# B/C/D: automatic and manual roots are Git-validated; arbitrary folders are rejected.
Assert-GuiTest ((Resolve-GuiRepositoryRoot) -ceq ([IO.Path]::GetFullPath($repoRoot))) 'B repo root auto-detection'
Assert-GuiTest ((Resolve-GuiRepositoryRoot -RequestedRoot $repoRoot) -ceq ([IO.Path]::GetFullPath($repoRoot))) 'C manual root validation'
$invalidRoot = Join-Path ([IO.Path]::GetTempPath()) ('tegaki-handoff-invalid-' + [Guid]::NewGuid().ToString('N'))
Assert-GuiThrows { Resolve-GuiRepositoryRoot -RequestedRoot $invalidRoot } 'D invalid root rejected'

# E/F/G/H: settings and basic window contract.
$settingsPath = Get-GuiSettingsPath
Assert-GuiTest (-not ([IO.Path]::GetFullPath($settingsPath).StartsWith(([IO.Path]::GetFullPath($repoRoot) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase))) 'E settings outside repo'
$defaults = Get-GuiDefaultSettings
Assert-GuiTest ([bool]$defaults.always_on_top) 'F TopMost default ON'
Assert-GuiTest ($guiText -match 'Add_CheckedChanged' -and $guiText -match '\$form\.TopMost = \[bool\]\$alwaysOnTop\.Checked') 'G TopMost toggle immediate'
Assert-GuiTest ($guiText -match 'MinimizeBox = \$true' -and $guiText -match 'ShowInTaskbar = \$true') 'H minimize and taskbar behavior'

$h3v1 = @"
TEGAKI_CARD_V1
CARD_ID: H3-GUI-TEST-001
TARGET: LUNA
BASE_SHA: $head
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

H3 V1 compatibility body.
"@
$h3v2 = @"
TEGAKI_CARD_V2
CHANNEL: H3
CARD_ID: H3-GUI-TEST-002
TARGET: LUNA
BASE_SHA: $head
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

H3 V2 body.
"@
$manga = @"
TEGAKI_CARD_V2
CHANNEL: MANGA
CARD_ID: MANGA-GUI-TEST-001
TARGET: GEMINI
BASE_SHA: $head
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

Manga V2 body.
"@
$mangaWithH3Id = $manga -replace 'CARD_ID: MANGA-GUI-TEST-001', 'CARD_ID: H3-GUI-TEST-003'
$h3WithMangaId = $h3v1 -replace 'CARD_ID: H3-GUI-TEST-001', 'CARD_ID: MANGA-GUI-TEST-002'

# I/J/K: H3 staging contract and V0.1 V1 compatibility.
Assert-GuiTest ($guiText -match 'stage_card_from_clipboard\.ps1' -and $guiText -match 'existing V0\.1 helper') 'I H3 lane calls existing safe staging'
Assert-GuiTest ((Test-GuiCard -Text $h3v1 -Lane H3 -ExpectedBaseSha $head).Valid) 'J H3 V1 compatible'
Assert-GuiTest ((Test-GuiCard -Text $h3v2 -Lane H3 -ExpectedBaseSha $head).Valid) 'K H3 V2 accepted'

# L/O/N/M: lane, channel, target, and Card ID isolation.
Assert-GuiTest (-not (Test-GuiCard -Text $manga -Lane H3 -ExpectedBaseSha $head).Valid -and -not (Test-GuiCard -Text $h3v1 -Lane MANGA -ExpectedBaseSha $head).Valid) 'L H3/MANGA channel mismatch rejected'
Assert-GuiTest ((Test-GuiCard -Text $manga -Lane MANGA -ExpectedBaseSha $head).Valid) 'M valid Manga V2 accepted'
Assert-GuiTest (-not (Test-GuiCard -Text $mangaWithH3Id -Lane MANGA -ExpectedBaseSha $head).Valid) 'N Manga with H3 ID rejected'
Assert-GuiTest (-not (Test-GuiCard -Text $h3WithMangaId -Lane H3 -ExpectedBaseSha $head).Valid) 'O H3 with MANGA ID rejected'

# P/Q: exact BASE_SHA and independent physical lane state.
$wrongSha = ('0' * 40)
$mismatch = $h3v1 -replace [regex]::Escape("BASE_SHA: $head"), "BASE_SHA: $wrongSha"
Assert-GuiTest (-not (Test-GuiCard -Text $mismatch -Lane H3 -ExpectedBaseSha $head).Valid) 'P BASE_SHA mismatch rejected'
$h3Definition = Get-GuiLaneDefinition -Lane H3 -RepoRoot $repoRoot
$mangaDefinition = Get-GuiLaneDefinition -Lane MANGA -RepoRoot $repoRoot
Assert-GuiTest ($h3Definition.CardPath -cne $mangaDefinition.CardPath -and $h3Definition.StatePath -cne $mangaDefinition.StatePath -and $mangaDefinition.CardRelativePath -match '/manga/') 'Q independent lane state'

$report = @"
TEGAKI_REPORT_V1
CARD_ID: H3-GUI-TEST-001
RESULT: PASS

Report body.
"@
$mangaReport = $report -replace 'H3-GUI-TEST-001', 'MANGA-GUI-TEST-001'
$wrongReport = $report -replace 'H3-GUI-TEST-001', 'H3-OTHER-999'
$wrongMangaReport = $mangaReport -replace 'MANGA-GUI-TEST-001', 'MANGA-OTHER-999'
Assert-GuiThrows { Assert-GuiReport -ReportText $wrongReport -ExpectedCardId 'H3-GUI-TEST-001' } 'R H3 report Card-ID mismatch rejected'
Assert-GuiThrows { Assert-GuiReport -ReportText $wrongMangaReport -ExpectedCardId 'MANGA-GUI-TEST-001' } 'S Manga report Card-ID mismatch rejected'

# T/U/V/W: route labels and fail-closed explicit paste behavior.
Assert-GuiTest ((Get-GuiRoutePrefix H3_AGENT) -ceq '[H3 -> CODEX]' -and (Get-GuiRoutePrefix H3_WEBGPT) -ceq '[H3 -> WEBGPT]' -and (Get-GuiRoutePrefix MANGA_AGENT) -ceq '[MANGA -> GEMINI]' -and (Get-GuiRoutePrefix MANGA_WEBGPT) -ceq '[MANGA -> WEBGPT]') 'T prefixes exact'
$sendCalls = [regex]::Matches($coreText, 'SendWait\(')
Assert-GuiTest ($sendCalls.Count -eq 1 -and $coreText -match "SendWait\('\^v'\)" -and $coreText -notmatch '\{ENTER\}|\^~') 'U no automatic Enter/send'
$zero = Resolve-GuiTargetWindow -Windows @([pscustomobject]@{ Title = 'unrelated window' }) -Token 'Codex'
$multiple = Resolve-GuiTargetWindow -Windows @([pscustomobject]@{ Title = 'Codex one' }, [pscustomobject]@{ Title = 'Codex two' }) -Token 'Codex'
Assert-GuiTest ($zero.Status -ceq 'TARGET NOT FOUND' -and $multiple.Status -ceq 'TARGET AMBIGUOUS') 'V zero/multiple target fails closed'
Assert-GuiTest ($coreText -match "SendWait\('\^v'\)" -and $guiText -match 'Focus \+ paste') 'W Ctrl+V explicit only'

# X/Y/Z: ignored runtime lane, PowerShell parse, and diff whitespace.
$ignoreText = [IO.File]::ReadAllText((Join-Path $repoRoot '.gitignore'))
Assert-GuiTest ($ignoreText -match '(?m)^/\.tegaki-handoff/$') 'X .tegaki-handoff ignored'
$parseErrors = @()
foreach ($file in @(Get-ChildItem -LiteralPath $toolRoot -Filter '*.ps1' -File -Recurse)) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    $parseErrors += @($errors)
}
Assert-GuiTest ($parseErrors.Count -eq 0) 'Y PowerShell syntax'
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$diffCheckOutput = & git -C $repoRoot diff --check -- tools/tegaki-handoff 2>&1
$diffCheckExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
Assert-GuiTest ($diffCheckExitCode -eq 0) 'Z git diff check'

Write-Output "GUI VERIFIER PASS ($passed/26)"
