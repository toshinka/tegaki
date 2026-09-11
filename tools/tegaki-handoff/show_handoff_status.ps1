[CmdletBinding()]
param(
    [string]$RepoRoot,
    [switch]$FriendlyErrors
)

$ErrorActionPreference = 'Stop'

function Resolve-RepositoryRoot {
    param([string]$RequestedRoot)

    if ($RequestedRoot) {
        $candidate = [IO.Path]::GetFullPath($RequestedRoot)
    }
    else {
        $candidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    }

    $detectedOutput = & git -C $candidate rev-parse --show-toplevel 2>$null
    $gitExitCode = $LASTEXITCODE
    $detected = @($detectedOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($detected)) {
        throw "Not a Git repository: $candidate"
    }
    return $detected.Trim()
}

function Get-CurrentHead {
    param([string]$Root)

    $headOutput = & git -C $Root rev-parse HEAD 2>$null
    $gitExitCode = $LASTEXITCODE
    $head = @($headOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
        throw 'Unable to read the repository HEAD.'
    }
    return $head.Trim()
}

try {
    $root = Resolve-RepositoryRoot -RequestedRoot $RepoRoot
    $handoffRoot = Join-Path $root '.tegaki-handoff'
    $statePath = Join-Path $handoffRoot 'state.json'
    $reportPath = Join-Path $handoffRoot 'from_luna\latest_report.md'
    $currentHead = Get-CurrentHead -Root $root

    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
        Write-Output 'Status: UNINITIALIZED'
        Write-Output 'Card ID: -'
        Write-Output 'Base SHA: -'
        Write-Output 'Card path: .tegaki-handoff/to_luna/current_card.md'
        Write-Output 'Report present: NO'
        Write-Output ("Current HEAD: {0}" -f $currentHead)
        Write-Output 'HEAD matches Card base: NO'
        Write-Output 'Last update: -'
        exit 0
    }

    $state = ([IO.File]::ReadAllText($statePath) | ConvertFrom-Json)
    $cardId = if ([string]::IsNullOrWhiteSpace([string]$state.card_id)) { '-' } else { [string]$state.card_id }
    $baseSha = if ([string]::IsNullOrWhiteSpace([string]$state.base_sha)) { '-' } else { [string]$state.base_sha }
    $cardPath = if ([string]::IsNullOrWhiteSpace([string]$state.card_path)) { '.tegaki-handoff/to_luna/current_card.md' } else { [string]$state.card_path }
    $lastUpdate = if ([string]::IsNullOrWhiteSpace([string]$state.updated_at)) { '-' } else { [string]$state.updated_at }
    $reportPresent = if (Test-Path -LiteralPath $reportPath -PathType Leaf) { 'YES' } else { 'NO' }

    Write-Output ("Status: {0}" -f $state.status)
    Write-Output ("Card ID: {0}" -f $cardId)
    Write-Output ("Base SHA: {0}" -f $baseSha)
    Write-Output ("Card path: {0}" -f $cardPath)
    Write-Output ("Report present: {0}" -f $reportPresent)
    Write-Output ("Current HEAD: {0}" -f $currentHead)
    $headMatchesBase = ($baseSha -ne '-' -and $baseSha -match '^[0-9a-fA-F]{40}$' -and $baseSha -ceq $currentHead)
    Write-Output ("HEAD matches Card base: {0}" -f $(if ($headMatchesBase) { 'YES' } else { 'NO' }))
    Write-Output ("Last update: {0}" -f $lastUpdate)

    if ($baseSha -ne '-' -and $baseSha -notmatch '^[0-9a-fA-F]{40}$') {
        Write-Output 'WARNING: state Base SHA is malformed.'
    }
    else {
        if ($baseSha -ne '-' -and $baseSha -cne $currentHead) {
            Write-Output ("WARNING: current HEAD differs from Base SHA: {0}" -f $currentHead)
        }
    }
}
catch {
    if ($FriendlyErrors) {
        Write-Output ("ERROR: {0}" -f $_.Exception.Message)
    }
    else {
        Write-Error $_.Exception.Message
    }
    exit 1
}
