# ROLE: Run the isolated WP-020 native proof with cached tools and dependencies.
# AUTHORITY: Cache-only fixture/build outputs; no production state or machine toolchain changes.
# INVARIANTS: Fixed source and explicit compiler path; DUB_HOME is process-local and restored.
# RELATED: docs/work/WP-020-rig-renewal-first-path.md and this folder's README.md.

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$cacheRoot = Join-Path $repoRoot 'tegaki_work\.cache\inochi-roundtrip'
$buildRoot = Join-Path $cacheRoot 'build-project'
$toolBin = Join-Path $cacheRoot 'ldc-toolchain\ldc2-1.43.0-windows-x64\bin'
$ldc = Join-Path $toolBin 'ldc2.exe'
$dub = Join-Path $toolBin 'dub.exe'
$dubHome = Join-Path $cacheRoot 'dub-home'
$logPath = Join-Path $cacheRoot 'run-proof.log'
$exePath = Join-Path $buildRoot 'out\inochi-roundtrip-proof.exe'
$previousLocation = Get-Location
$previousDubHome = $env:DUB_HOME

foreach ($requiredPath in @($ldc, $dub, (Join-Path $buildRoot 'dub.sdl'))) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required cached proof input is missing: $requiredPath"
    }
}

New-Item -ItemType Directory -Force -Path $dubHome | Out-Null
Set-Content -LiteralPath $logPath -Value '' -Encoding utf8

try {
    $env:DUB_HOME = $dubHome
    Set-Location -LiteralPath $buildRoot

    'LDC version:' | Tee-Object -FilePath $logPath -Append
    & $ldc --version 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "LDC version probe failed with exit code $LASTEXITCODE" }

    'DUB version:' | Tee-Object -FilePath $logPath -Append
    & $dub --version 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "DUB version probe failed with exit code $LASTEXITCODE" }

    'Native build: fixed Inochi2D source + local DUB cache + LDC internal linker' | Tee-Object -FilePath $logPath -Append
    & $dub build "--compiler=$ldc" '--cache=local' '--build=release' 2>&1 |
        Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "DUB build failed with exit code $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
        throw "DUB reported success but the expected proof executable is missing: $exePath"
    }

    Set-Location -LiteralPath $repoRoot
    'Native proof run:' | Tee-Object -FilePath $logPath -Append
    & $exePath 2>&1 | Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "Native proof failed with exit code $LASTEXITCODE" }

    foreach ($artifact in @(
        (Join-Path $cacheRoot 'fixture-original.inp'),
        (Join-Path $cacheRoot 'fixture-edited.inp'),
        (Join-Path $cacheRoot 'roundtrip-result.json'),
        $exePath,
        (Join-Path $buildRoot 'dub.selections.json')
    )) {
        if (Test-Path -LiteralPath $artifact -PathType Leaf) {
            Get-FileHash -LiteralPath $artifact -Algorithm SHA256 |
                ForEach-Object { "$($_.Hash)  $($_.Path)" } |
                Tee-Object -FilePath $logPath -Append
        }
    }
}
finally {
    Set-Location -LiteralPath $previousLocation
    if ($null -eq $previousDubHome) {
        Remove-Item Env:DUB_HOME -ErrorAction SilentlyContinue
    } else {
        $env:DUB_HOME = $previousDubHome
    }
}
