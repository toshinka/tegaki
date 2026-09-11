[CmdletBinding()]
param(
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

function Resolve-RepositoryRoot {
    param([string]$RequestedRoot)

    if ($RequestedRoot) {
        $candidate = [IO.Path]::GetFullPath($RequestedRoot)
        $detectedOutput = & git -C $candidate rev-parse --show-toplevel 2>$null
        $gitExitCode = $LASTEXITCODE
        $detected = @($detectedOutput) | Select-Object -First 1
        if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($detected)) {
            throw "Not a Git repository: $candidate"
        }
        return $detected.Trim()
    }

    $candidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $detectedOutput = & git -C $candidate rev-parse --show-toplevel 2>$null
    $gitExitCode = $LASTEXITCODE
    $detected = @($detectedOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($detected)) {
        throw "Unable to resolve the repository root from $PSScriptRoot"
    }
    return $detected.Trim()
}

function Write-JsonAtomically {
    param(
        [string]$Path,
        [object]$Value
    )

    $temporaryPath = "$Path.tmp.$([Guid]::NewGuid().ToString('N'))"
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        $json = $Value | ConvertTo-Json -Depth 5
        [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, $utf8)
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
    $handoffRoot = Join-Path $root '.tegaki-handoff'
    $directories = @(
        $handoffRoot,
        (Join-Path $handoffRoot 'to_luna'),
        (Join-Path $handoffRoot 'from_luna'),
        (Join-Path $handoffRoot 'archive'),
        (Join-Path $handoffRoot 'archive\cards'),
        (Join-Path $handoffRoot 'archive\reports')
    )

    foreach ($directory in $directories) {
        $null = New-Item -ItemType Directory -Path $directory -Force
    }

    $statePath = Join-Path $handoffRoot 'state.json'
    $cardPath = Join-Path $handoffRoot 'to_luna\current_card.md'
    $reportPath = Join-Path $handoffRoot 'from_luna\latest_report.md'

    if (-not (Test-Path -LiteralPath $statePath)) {
        if ((Test-Path -LiteralPath $cardPath) -or (Test-Path -LiteralPath $reportPath)) {
            Write-Output 'Handoff directories: READY'
            Write-Output 'State: NOT INITIALIZED (existing Card/Report preserved)'
        }
        else {
            $state = [ordered]@{
                schema = 'tegaki.handoff/v1'
                card_id = $null
                target = $null
                base_sha = $null
                status = 'IDLE'
                card_path = '.tegaki-handoff/to_luna/current_card.md'
                report_path = '.tegaki-handoff/from_luna/latest_report.md'
                updated_at = [DateTime]::UtcNow.ToString('o')
            }
            Write-JsonAtomically -Path $statePath -Value $state
            Write-Output 'Handoff directories: READY'
            Write-Output 'Status: IDLE'
        }
    }
    else {
        $existingState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        Write-Output 'Handoff directories: READY'
        Write-Output ("Status: {0} (preserved)" -f $existingState.status)
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
