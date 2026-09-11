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

function Set-ClipboardText {
    param([string]$Text)

    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Set-Clipboard -Value $Text -ErrorAction Stop
            return
        }
        catch {
            $lastError = $_.Exception.Message
            if ($attempt -lt 3) {
                Start-Sleep -Milliseconds (100 * $attempt)
            }
        }
    }

    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                [System.Windows.Forms.Clipboard]::SetText($Text)
                return
            }
            catch {
                $lastError = $_.Exception.Message
                if ($attempt -lt 3) {
                    Start-Sleep -Milliseconds (100 * $attempt)
                }
            }
        }
    }
    catch {
        $lastError = $_.Exception.Message
    }

    throw ("Unable to write text to the Windows clipboard. Last error: {0}" -f $lastError)
}

function Get-ReportFields {
    param([string]$Text)

    $lines = [regex]::Split($Text, "\r\n|\n|\r")
    if ($lines.Count -eq 0 -or $lines[0].TrimStart([char]0xFEFF).Trim() -cne 'TEGAKI_REPORT_V1') {
        throw 'Invalid Report envelope: first line must be TEGAKI_REPORT_V1.'
    }

    $fields = @{}
    $limit = [Math]::Min($lines.Count, 40)
    for ($index = 0; $index -lt $limit; $index++) {
        if ($lines[$index] -cmatch '^\s*(CARD_ID|RESULT)\s*:\s*(.*?)\s*$') {
            $name = $matches[1]
            if ($fields.ContainsKey($name)) {
                throw "Duplicate $name field in Report envelope."
            }
            $fields[$name] = $matches[2].Trim()
        }
    }

    foreach ($required in @('CARD_ID', 'RESULT')) {
        if (-not $fields.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($fields[$required])) {
            throw "Missing required $required field in Report envelope."
        }
    }

    if (@('PASS', 'PASS WITH LIMIT', 'BLOCKED', 'FAILED') -notcontains $fields['RESULT']) {
        throw 'Report RESULT must be PASS, PASS WITH LIMIT, BLOCKED, or FAILED.'
    }
    return $fields
}

function Read-RequiredTextFile {
    param([string]$Path, [string]$Description)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description not found: $Path"
    }
    return [IO.File]::ReadAllText($Path)
}

try {
    $root = Resolve-RepositoryRoot -RequestedRoot $RepoRoot
    $handoffRoot = Join-Path $root '.tegaki-handoff'
    $statePath = Join-Path $handoffRoot 'state.json'
    $reportPath = Join-Path $handoffRoot 'from_luna\latest_report.md'

    $stateText = Read-RequiredTextFile -Path $statePath -Description 'Handoff state'
    $state = $stateText | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$state.card_id)) {
        throw 'Handoff state has no active Card ID.'
    }

    $reportText = Read-RequiredTextFile -Path $reportPath -Description 'Latest Report'
    $fields = Get-ReportFields -Text $reportText
    if ($fields['CARD_ID'] -cne [string]$state.card_id) {
        throw ("Report CARD_ID mismatch. Expected {0}; received {1}." -f $state.card_id, $fields['CARD_ID'])
    }

    Set-ClipboardText -Text $reportText
    Write-Output 'COPIED'
    Write-Output ("Card ID: {0}" -f $fields['CARD_ID'])
    Write-Output ("Result: {0}" -f $fields['RESULT'])
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
