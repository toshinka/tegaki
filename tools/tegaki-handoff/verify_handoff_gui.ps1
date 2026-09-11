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
function Invoke-GuiRuntimeSmoke {
    param([string]$Root, [string]$LastReturnedDigest)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', $guiPath, '-RepoRoot', $Root, '-SmokeTest')
    if ($PSBoundParameters.ContainsKey('LastReturnedDigest')) { $arguments += @('-SmokeLastReturnedDigest', $LastReturnedDigest) }
    $output = & powershell.exe @arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}
function New-FixtureReport {
    param([string]$CardId, [string]$Result, [string]$Body = 'Fixture report.')
    return "TEGAKI_REPORT_V1`r`nCARD_ID: $CardId`r`nRESULT: $Result`r`n`r`n$Body`r`n"
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
$launcherText = [IO.File]::ReadAllText($launcherPath)
$guiText = [IO.File]::ReadAllText($guiPath)
$coreText = [IO.File]::ReadAllText($corePath)
$head = Get-GuiCurrentHead $repoRoot

# A-H: launcher, repository, settings, and compact return-only window contract.
Assert-GuiTest ($launcherText -match '%~dp0' -and $launcherText -match 'REPO_ROOT') 'A launcher resolves own tool path'
Assert-GuiTest ((Resolve-GuiRepositoryRoot) -ceq $repoRoot) 'B repo root auto-detection'
Assert-GuiTest ((Resolve-GuiRepositoryRoot -RequestedRoot $repoRoot) -ceq $repoRoot) 'C manual root validation'
$invalidRoot = Join-Path ([IO.Path]::GetTempPath()) ('tegaki-handoff-invalid-' + [Guid]::NewGuid().ToString('N'))
Assert-GuiThrows { Resolve-GuiRepositoryRoot -RequestedRoot $invalidRoot } 'D invalid root rejected'
$settingsPath = Get-GuiSettingsPath
Assert-GuiTest (-not ([IO.Path]::GetFullPath($settingsPath).StartsWith(($repoRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase))) 'E settings outside repo'
$defaults = Get-GuiDefaultSettings
Assert-GuiTest ([bool]$defaults.always_on_top -and $defaults.target_tokens.Keys.Count -eq 2 -and $defaults.target_tokens.Contains('H3_WEBGPT') -and $defaults.target_tokens.Contains('MANGA_WEBGPT')) 'F return target settings only'
Assert-GuiTest ($defaults.Contains('last_returned_h3_report_sha256') -and $defaults.Contains('last_returned_manga_report_sha256')) 'G return digest settings present'
Assert-GuiTest ($guiText -match '常に手前に表示' -and $guiText -match 'Add_CheckedChanged' -and $guiText -match '\$form\.TopMost = \[bool\]\$alwaysOnTop\.Checked' -and $guiText -match 'ClientSize = New-GuiSize 520 460') 'H TopMost and compact window'

# I-P: the GUI has one return action per lane and no forward mediation.
$returnButtons = [regex]::Matches($guiText, 'New-GuiLaneGroup -Lane H3|New-GuiLaneGroup -Lane MANGA')
Assert-GuiTest ($returnButtons.Count -eq 2 -and $guiText -match 'ReturnButtonText' -and $guiText -match '結果をH3 WebGPTへ戻す' -and $guiText -match '結果をManga WebGPTへ戻す') 'I one return button per lane'
Assert-GuiTest ($guiText -notmatch 'カードを取り込む|Codexへ渡す|Geminiへ渡す|New-GuiRunTransferText|stage_card_from_clipboard\.ps1|\$RunButtonText') 'J no normal forward workflow'
Assert-GuiTest ($guiText -match '最新結果' -and $guiText -match "'Card'" -and $guiText -match '\.Return\.Enabled') 'K result status and enablement controls'
Assert-GuiTest ($guiText -notmatch 'H3_AGENT|MANGA_AGENT' -and $guiText -match 'H3_WEBGPT|MANGA_WEBGPT') 'L only WebGPT targets in primary GUI'
Assert-GuiTest ($coreText -match 'Get-GuiReportDigest' -and $coreText -match 'REPORT ALREADY RETURNED' -and $coreText -match 'Set-GuiLastReturnedReport') 'M digest duplicate guard'
Assert-GuiTest ($coreText -match 'Get-GuiReportCandidate' -and $coreText -match '新しい結果あり' -and $coreText -match '返却済み' -and $coreText -match '報告ファイル不正') 'N readiness states'
Assert-GuiTest ($coreText -match 'Get-GuiLaneSnapshot' -and $coreText -match 'LastReturnedDigest' -and $coreText -notmatch 'New-GuiReturnTransferText[\s\S]{0,500}StatePath') 'O no active-card dependency in return path'
Assert-GuiTest ($guiText -match 'WINFORMS_RETURN_ONLY_SMOKE' -and $guiText -notmatch 'Add_.*Timer|ClipboardWatcher|Clipboard.*watch|watch.*Clipboard|poll') 'P native smoke and no watcher'

# Q: return-only matrix in an isolated temporary Git repository with no live handoff state.
$fixtureBase = 'C:\Users\MAX\.codex\visualizations\2026\09\08\01a07f09-0de3-7e92-a8bb-f365b3648ed8'
$fixtureRoot = Join-Path $fixtureBase ('.tmp-handoff-gui-v1c-' + [Guid]::NewGuid().ToString('N'))
try {
    $null = New-Item -ItemType Directory -Path $fixtureRoot -Force
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('init', '--quiet')
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'fixture.txt'), 'fixture')
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('add', 'fixture.txt')
    Invoke-FixtureGit -Root $fixtureRoot -Arguments @('-c', 'user.name=TEGAKI Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture')
    $fixtureHead = Get-GuiCurrentHead $fixtureRoot
    $h3Definition = Get-GuiLaneDefinition -Lane H3 -RepoRoot $fixtureRoot
    $mangaDefinition = Get-GuiLaneDefinition -Lane MANGA -RepoRoot $fixtureRoot
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $h3Definition.ReportPath) -Force
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $mangaDefinition.ReportPath) -Force
    $h3Settings = Get-GuiDefaultSettings
    $mangaSettings = Get-GuiDefaultSettings

    $h3NoResult = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest ''
    $mangaNoResult = Get-GuiLaneSnapshot -Lane MANGA -RepoRoot $fixtureRoot -LastReturnedDigest ''
    Assert-GuiTest ($h3NoResult.Status -ceq '結果なし' -and -not $h3NoResult.ReturnEnabled) 'Q1 H3 no-result disabled'
    Assert-GuiTest ($mangaNoResult.Status -ceq '結果なし' -and -not $mangaNoResult.ReturnEnabled) 'Q2 Manga no-result disabled'

    $h3Report = New-FixtureReport -CardId 'H3-FIXTURE-V1C' -Result 'PASS' -Body 'H3 first result.'
    [IO.File]::WriteAllText($h3Definition.ReportPath, $h3Report)
    $h3Candidate = Get-GuiReportCandidate -Lane H3 -RepoRoot $fixtureRoot
    $h3New = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest ''
    $mangaStillEmpty = Get-GuiLaneSnapshot -Lane MANGA -RepoRoot $fixtureRoot -LastReturnedDigest ''
    Assert-GuiTest ($h3Candidate.Valid -and $h3Candidate.CardId -ceq 'H3-FIXTURE-V1C' -and $h3New.Status -ceq '新しい結果あり' -and $h3New.ReturnEnabled) 'Q3 H3 valid new Report detected'
    Assert-GuiTest ($mangaStillEmpty.Status -ceq '結果なし' -and -not $mangaStillEmpty.ReturnEnabled) 'Q4 H3 report does not affect Manga'

    $h3Return = New-GuiReturnTransferText -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest ''
    Assert-GuiTest ($h3Return.StartsWith('[H3 -> WEBGPT]') -and $h3Return.IndexOf($h3Report) -ge 0 -and $h3Return -match 'H3 RETURN INSTRUCTION') 'Q5 H3 Return payload complete'
    $h3Digest = $h3Candidate.Digest
    Set-GuiLastReturnedReport -Settings $h3Settings -Lane H3 -Digest $h3Digest -CardId $h3Candidate.CardId
    $h3Returned = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest (Get-GuiLastReturnedDigest -Settings $h3Settings -Lane H3)
    Assert-GuiTest ($h3Returned.Status -ceq '返却済み' -and -not $h3Returned.ReturnEnabled) 'Q6 explicit return digest tracked'
    $duplicateMessage = ''
    try { $null = New-GuiReturnTransferText -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest $h3Digest } catch { $duplicateMessage = $_.Exception.Message }
    Assert-GuiTest ($duplicateMessage -ceq 'REPORT ALREADY RETURNED') 'Q7 duplicate old Report blocked'

    $sameCardChangedReport = New-FixtureReport -CardId 'H3-FIXTURE-V1C' -Result 'PASS' -Body 'H3 corrected result.'
    [IO.File]::WriteAllText($h3Definition.ReportPath, $sameCardChangedReport)
    $changedCandidate = Get-GuiReportCandidate -Lane H3 -RepoRoot $fixtureRoot
    $changedSnapshot = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest $h3Digest
    Assert-GuiTest ($changedCandidate.Digest -cne $h3Digest -and $changedCandidate.CardId -ceq 'H3-FIXTURE-V1C' -and $changedSnapshot.Status -ceq '新しい結果あり' -and $changedSnapshot.ReturnEnabled) 'Q8 same Card changed Report is new'

    [IO.File]::WriteAllText($h3Definition.ReportPath, 'not a report')
    $malformed = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest $h3Digest
    Assert-GuiTest ($malformed.Status -ceq '報告ファイル不正' -and -not $malformed.ReturnEnabled) 'Q9 malformed Report blocked'
    [IO.File]::WriteAllText($h3Definition.ReportPath, (New-FixtureReport -CardId 'H3-FIXTURE-V1C' -Result 'INVALID' -Body 'invalid result.'))
    $invalidResult = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest $h3Digest
    Assert-GuiTest ($invalidResult.Status -ceq '報告ファイル不正' -and -not $invalidResult.ReturnEnabled) 'Q10 invalid RESULT blocked'
    Remove-Item -LiteralPath $h3Definition.ReportPath -Force
    $h3EmptyAgain = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest $h3Digest
    Assert-GuiTest ($h3EmptyAgain.Status -ceq '結果なし' -and -not $h3EmptyAgain.ReturnEnabled) 'Q11 report removal is no-result'

    $h3FinalReport = New-FixtureReport -CardId 'H3-FIXTURE-FINAL' -Result 'PASS WITH LIMIT' -Body 'H3 final result.'
    $mangaReport = New-FixtureReport -CardId 'MANGA-FIXTURE-V1C' -Result 'PASS' -Body 'Manga result.'
    [IO.File]::WriteAllText($h3Definition.ReportPath, $h3FinalReport)
    [IO.File]::WriteAllText($mangaDefinition.ReportPath, $mangaReport)
    $h3FinalCandidate = Get-GuiReportCandidate -Lane H3 -RepoRoot $fixtureRoot
    $mangaCandidate = Get-GuiReportCandidate -Lane MANGA -RepoRoot $fixtureRoot
    $mangaReturn = New-GuiReturnTransferText -Lane MANGA -RepoRoot $fixtureRoot -LastReturnedDigest ''
    Assert-GuiTest ($mangaCandidate.Valid -and $mangaCandidate.CardId -ceq 'MANGA-FIXTURE-V1C' -and $mangaReturn.StartsWith('[MANGA -> WEBGPT]') -and $mangaReturn.IndexOf($mangaReport) -ge 0 -and $mangaReturn -match 'MANGA RETURN INSTRUCTION') 'Q12 Manga valid Return payload'
    $h3Only = Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest ''
    $mangaOnly = Get-GuiLaneSnapshot -Lane MANGA -RepoRoot $fixtureRoot -LastReturnedDigest ''
    Assert-GuiTest ($h3Only.Status -ceq '新しい結果あり' -and $mangaOnly.Status -ceq '新しい結果あり') 'Q13 H3 and Manga lane isolation'

    $mockClipboard = [pscustomobject]@{ Text = ''; Fail = $false }
    $statusMessages = [System.Collections.Generic.List[string]]::new()
    $mockWriter = { param([string]$Value) if ($mockClipboard.Fail) { throw 'clipboard fixture failure' }; $mockClipboard.Text = $Value }
    $mockStatus = { param([string]$Message) $statusMessages.Add($Message) }
    $noTarget = { @([pscustomobject]@{ Title = 'unrelated window' }) }
    $manualTransfer = Invoke-GuiReturnTransfer -Text $h3FinalReport -Route '[H3 -> WEBGPT]' -TargetToken 'WebGPT' -SetStatus $mockStatus -ClipboardWriter $mockWriter -WindowProvider $noTarget
    Assert-GuiTest ($manualTransfer.PayloadReady -and $mockClipboard.Text -ceq $h3FinalReport -and $manualTransfer.Message -match '手動で貼り付け') 'Q14 target not found manual fallback'
    $fallbackSettings = Get-GuiDefaultSettings
    Set-GuiLastReturnedReport -Settings $fallbackSettings -Lane H3 -Digest $h3FinalCandidate.Digest -CardId $h3FinalCandidate.CardId
    Assert-GuiTest ((Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest (Get-GuiLastReturnedDigest -Settings $fallbackSettings -Lane H3)).Status -ceq '返却済み') 'Q15 manual fallback may mark returned'
    $mockClipboard.Fail = $true
    $failureSettings = Get-GuiDefaultSettings
    $failedTransfer = Invoke-GuiReturnTransfer -Text $h3FinalReport -Route '[H3 -> WEBGPT]' -TargetToken 'WebGPT' -SetStatus $mockStatus -ClipboardWriter $mockWriter -WindowProvider $noTarget
    Assert-GuiTest (-not $failedTransfer.PayloadReady -and [string]::IsNullOrWhiteSpace((Get-GuiLastReturnedDigest -Settings $failureSettings -Lane H3)) -and (Get-GuiLaneSnapshot -Lane H3 -RepoRoot $fixtureRoot -LastReturnedDigest '').Status -ceq '新しい結果あり') 'Q16 clipboard failure does not mark returned'

    $runtimeSmoke = Invoke-GuiRuntimeSmoke -Root $fixtureRoot
    Assert-GuiTest ($runtimeSmoke.ExitCode -eq 0 -and $runtimeSmoke.Output -match 'WINFORMS_RETURN_ONLY_SMOKE PASS') 'Q17 native WinForms return-only smoke'
}
finally {
    if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# R-Z: transfer safety, source contract, syntax, and diff checks.
Assert-GuiTest ((Get-GuiRoutePrefix H3_WEBGPT) -ceq '[H3 -> WEBGPT]' -and (Get-GuiRoutePrefix MANGA_WEBGPT) -ceq '[MANGA -> WEBGPT]') 'R prefixes exact'
Assert-GuiTest ($coreText -match "SendWait\('\^v'\)" -and $coreText -notmatch '\{ENTER\}|\^~|Send button' -and $guiText -notmatch 'Add_.*Timer|ClipboardWatcher|Document\.getElementById|chrome\.') 'S Ctrl+V only / no browser automation'
Assert-GuiTest ($guiText -notmatch 'Add_Shown[\s\S]{0,800}Set-GuiClipboardText' -and $guiText -notmatch 'Clipboard.*watch|watch.*Clipboard|poll') 'T clipboard changes only from explicit actions'
$ignoreText = [IO.File]::ReadAllText((Join-Path $repoRoot '.gitignore'))
Assert-GuiTest ($ignoreText -match '(?m)^/\.tegaki-handoff/$') 'U .tegaki-handoff ignored'
$parseErrors = @()
foreach ($file in @(Get-ChildItem -LiteralPath $toolRoot -Filter '*.ps1' -File -Recurse)) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    $parseErrors += @($errors)
}
Assert-GuiTest ($parseErrors.Count -eq 0) 'V PowerShell syntax'
$oldPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$diffOutput = & git -C $repoRoot diff --check -- tools/tegaki-handoff 2>&1
$diffExit = $LASTEXITCODE
$ErrorActionPreference = $oldPreference
Assert-GuiTest ($diffExit -eq 0) 'W git diff check'

Write-Output "GUI V1C VERIFIER PASS ($passed checks)"
