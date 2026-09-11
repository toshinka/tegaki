[CmdletBinding()]
param(
    [string]$RepoRoot
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

function Read-ClipboardText {
    try {
        $text = Get-Clipboard -Raw -ErrorAction Stop
        if ($null -ne $text) {
            return [string]$text
        }
    }
    catch {
    }

    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            return [System.Windows.Forms.Clipboard]::GetText()
        }
    }
    catch {
    }

    throw 'Unable to read text from the Windows clipboard.'
}

function Get-EnvelopeFields {
    param(
        [string]$Text,
        [string]$Kind
    )

    $lines = [regex]::Split($Text, "\r\n|\n|\r")
    if ($lines.Count -eq 0 -or $lines[0].TrimStart([char]0xFEFF).Trim() -cne 'TEGAKI_CARD_V1') {
        throw "Invalid $Kind envelope: first line must be TEGAKI_CARD_V1."
    }

    $fields = @{}
    $limit = [Math]::Min($lines.Count, 40)
    for ($index = 0; $index -lt $limit; $index++) {
        if ($lines[$index] -cmatch '^\s*(CARD_ID|TARGET|BASE_SHA|EXECUTION|PUSH|AUTO_RUN)\s*:\s*(.*?)\s*$') {
            $name = $matches[1]
            if ($fields.ContainsKey($name)) {
                throw "Duplicate $name field in $Kind envelope."
            }
            $fields[$name] = $matches[2].Trim()
        }
    }

    foreach ($required in @('CARD_ID', 'TARGET', 'BASE_SHA', 'EXECUTION', 'PUSH', 'AUTO_RUN')) {
        if (-not $fields.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($fields[$required])) {
            throw "Missing required $required field in $Kind envelope."
        }
    }

    return $fields
}

function Get-EmbeddedCardId {
    param(
        [string]$Path,
        [string]$Fallback
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $Fallback
    }

    $text = [IO.File]::ReadAllText($Path)
    $lines = [regex]::Split($text, "\r\n|\n|\r")
    $limit = [Math]::Min($lines.Count, 40)
    for ($index = 0; $index -lt $limit; $index++) {
        if ($lines[$index] -cmatch '^\s*CARD_ID\s*:\s*(.*?)\s*$' -and -not [string]::IsNullOrWhiteSpace($matches[1])) {
            return $matches[1].Trim()
        }
    }
    return $Fallback
}

function Get-SafeArchiveToken {
    param([string]$Value)

    $token = [regex]::Replace([string]$Value, '[^A-Za-z0-9._-]', '_')
    if ([string]::IsNullOrWhiteSpace($token)) {
        $token = 'unknown'
    }
    if ($token.Length -gt 80) {
        $token = $token.Substring(0, 80)
    }
    return $token
}

function Write-TextAtomically {
    param(
        [string]$Path,
        [string]$Text
    )

    $temporaryPath = "$Path.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($temporaryPath, $Text, $utf8)
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    $root = Resolve-RepositoryRoot -RequestedRoot $RepoRoot
    $cardText = Read-ClipboardText
    $fields = Get-EnvelopeFields -Text $cardText -Kind 'Card'

    if ($fields['TARGET'] -cne 'LUNA') {
        throw 'Card TARGET must be exactly LUNA.'
    }
    if ($fields['EXECUTION'] -cne 'EXPLICIT_HUMAN_START') {
        throw 'Card EXECUTION must be exactly EXPLICIT_HUMAN_START.'
    }
    if ($fields['AUTO_RUN'] -cne 'FORBIDDEN') {
        throw 'Card AUTO_RUN must be exactly FORBIDDEN.'
    }
    if ($fields['PUSH'] -cne 'FORBIDDEN') {
        throw 'Card PUSH must be exactly FORBIDDEN.'
    }
    if ($fields['BASE_SHA'] -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'Card BASE_SHA must be a full 40-character hexadecimal SHA.'
    }

    $headOutput = & git -C $root rev-parse HEAD 2>$null
    $gitExitCode = $LASTEXITCODE
    $head = @($headOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
        throw 'Unable to read the repository HEAD.'
    }
    $head = $head.Trim()
    if ($fields['BASE_SHA'] -cne $head) {
        throw ("Card BASE_SHA mismatch. Expected current HEAD {0}; received {1}." -f $head, $fields['BASE_SHA'])
    }

    $handoffRoot = Join-Path $root '.tegaki-handoff'
    $cardDirectory = Join-Path $handoffRoot 'to_luna'
    $reportDirectory = Join-Path $handoffRoot 'from_luna'
    $cardArchiveDirectory = Join-Path $handoffRoot 'archive\cards'
    $reportArchiveDirectory = Join-Path $handoffRoot 'archive\reports'
    foreach ($directory in @($handoffRoot, $cardDirectory, $reportDirectory, (Join-Path $handoffRoot 'archive'), $cardArchiveDirectory, $reportArchiveDirectory)) {
        $null = New-Item -ItemType Directory -Path $directory -Force
    }

    $currentCardPath = Join-Path $cardDirectory 'current_card.md'
    $latestReportPath = Join-Path $reportDirectory 'latest_report.md'
    $archiveStamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')

    if (Test-Path -LiteralPath $currentCardPath -PathType Leaf) {
        $oldCardId = Get-EmbeddedCardId -Path $currentCardPath -Fallback 'unknown-card'
        $cardArchiveName = "{0}_{1}_{2}.md" -f (Get-SafeArchiveToken $oldCardId), $archiveStamp, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
        Move-Item -LiteralPath $currentCardPath -Destination (Join-Path $cardArchiveDirectory $cardArchiveName)
    }

    if (Test-Path -LiteralPath $latestReportPath -PathType Leaf) {
        $oldReportId = Get-EmbeddedCardId -Path $latestReportPath -Fallback 'unknown-report'
        $reportArchiveName = "{0}_{1}_{2}.md" -f (Get-SafeArchiveToken $oldReportId), $archiveStamp, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
        Move-Item -LiteralPath $latestReportPath -Destination (Join-Path $reportArchiveDirectory $reportArchiveName)
    }

    Write-TextAtomically -Path $currentCardPath -Text $cardText
    $state = [ordered]@{
        schema = 'tegaki.handoff/v1'
        card_id = $fields['CARD_ID']
        target = $fields['TARGET']
        base_sha = $fields['BASE_SHA']
        status = 'READY'
        card_path = '.tegaki-handoff/to_luna/current_card.md'
        report_path = '.tegaki-handoff/from_luna/latest_report.md'
        updated_at = [DateTime]::UtcNow.ToString('o')
    }
    $statePath = Join-Path $handoffRoot 'state.json'
    $stateTemporaryPath = "$statePath.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        $json = $state | ConvertTo-Json -Depth 5
        [IO.File]::WriteAllText($stateTemporaryPath, $json + [Environment]::NewLine, $utf8)
        Move-Item -LiteralPath $stateTemporaryPath -Destination $statePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $stateTemporaryPath) {
            Remove-Item -LiteralPath $stateTemporaryPath -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Output 'STAGED'
    Write-Output ("Card ID: {0}" -f $fields['CARD_ID'])
    Write-Output 'Status: READY'
    Write-Output 'Card path: .tegaki-handoff/to_luna/current_card.md'
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
