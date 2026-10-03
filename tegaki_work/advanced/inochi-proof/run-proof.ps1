# ROLE: Run the isolated WP-020 native proof with cached tools and dependencies.
# AUTHORITY: Cache-only fixture/build outputs; no production state or machine toolchain changes.
# INVARIANTS: Exact base/patch/patched hashes only; DUB_HOME is process-local and restored.
# RELATED: docs/work/WP-020-rig-renewal-first-path.md and this folder's README.md.

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$cacheRoot = Join-Path $repoRoot 'tegaki_work\.cache\inochi-roundtrip'
$buildRoot = Join-Path $cacheRoot 'build-project'
$sourceRoot = Join-Path $cacheRoot 'nightly-source\inochi2d-66fa76834b28037db0c871c656563422f697879e'
$sourceArchivePath = Join-Path $cacheRoot 'inochi2d-nightly-source-66fa768.tar.gz'
$sourceFilePath = Join-Path $sourceRoot 'source\inochi2d\core\math\deform.d'
$patchPath = Join-Path $repoRoot 'tegaki_work\advanced\inochi-proof\deformation-json-array.patch'
$priorFailureLogPath = Join-Path $cacheRoot 'run-proof-slice-a-first-failure.log'
$selectionsPath = Join-Path $buildRoot 'dub.selections.json'
$toolBin = Join-Path $cacheRoot 'ldc-toolchain\ldc2-1.43.0-windows-x64\bin'
$ldc = Join-Path $toolBin 'ldc2.exe'
$dub = Join-Path $toolBin 'dub.exe'
$dubHome = Join-Path $cacheRoot 'dub-home'
$logPath = Join-Path $cacheRoot 'run-proof.log'
$exePath = Join-Path $buildRoot 'out\inochi-roundtrip-proof.exe'
$expectedSourceArchiveHash = '79F1F51641380AC992B5ECCA2AB49245F111517CA4185CA832FFB0460F6CD4FB'
$expectedBaseSourceFileHash = 'E424BE9DE5C8C3795FD18C91E6A5D17C2F87C2C84766E99191C5ECFF34CAF026'
$expectedPatchHash = 'E943091A9A362E7A14E382EBD367CFA865F1CC5CA3DD8C306F1F68E5A902C711'
$expectedPatchedSourceFileHash = 'F5FB290794F848AA75DA0486E0BA0C89C6F17F58D6F9AD08B17B85DC8DB29C8B'
$expectedPriorFailureLogHash = '3044FED17A70DE445A196A91596E4C139D259E1583724CB93CC92C9E752CDE84'
$expectedSelectionsHash = '593A1B399EB0A4D6EACCE1FCAE0FBBCE27D8B11381CA0C85F4AADF7A53A92C70'
$previousLocation = Get-Location
$previousDubHome = $env:DUB_HOME

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "Fixed source directory is missing: $sourceRoot"
}

foreach ($requiredPath in @(
    $ldc,
    $dub,
    (Join-Path $buildRoot 'dub.sdl'),
    $sourceArchivePath,
    $sourceFilePath,
    $patchPath,
    $priorFailureLogPath,
    $selectionsPath
)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required cached proof input is missing: $requiredPath"
    }
}

$priorFailureHash = (Get-FileHash -LiteralPath $priorFailureLogPath -Algorithm SHA256).Hash
if ($priorFailureHash -ne $expectedPriorFailureLogHash) {
    throw "Preserved Slice A failure log hash mismatch: $priorFailureHash"
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

    $archiveHash = (Get-FileHash -LiteralPath $sourceArchivePath -Algorithm SHA256).Hash
    if ($archiveHash -ne $expectedSourceArchiveHash) {
        throw "Fixed source archive hash mismatch: $archiveHash"
    }

    $patchHash = (Get-FileHash -LiteralPath $patchPath -Algorithm SHA256).Hash
    if ($patchHash -ne $expectedPatchHash) {
        throw "Tracked source patch hash mismatch: $patchHash"
    }

    $selectionsHash = (Get-FileHash -LiteralPath $selectionsPath -Algorithm SHA256).Hash
    if ($selectionsHash -ne $expectedSelectionsHash) {
        throw "DUB selections lock hash mismatch: $selectionsHash"
    }

    $sourceHash = (Get-FileHash -LiteralPath $sourceFilePath -Algorithm SHA256).Hash
    if ($sourceHash -eq $expectedBaseSourceFileHash) {
        'Source file matches the exact Slice A base SHA; checking and applying the one tracked A2 patch.' |
            Tee-Object -FilePath $logPath -Append
        & git -C $sourceRoot apply --check $patchPath 2>&1 |
            Tee-Object -FilePath $logPath -Append
        if ($LASTEXITCODE -ne 0) { throw "Tracked source patch check failed with exit code $LASTEXITCODE" }

        & git -C $sourceRoot apply $patchPath 2>&1 |
            Tee-Object -FilePath $logPath -Append
        if ($LASTEXITCODE -ne 0) { throw "Tracked source patch apply failed with exit code $LASTEXITCODE" }
    } elseif ($sourceHash -eq $expectedPatchedSourceFileHash) {
        'Source file already matches the exact A2 patched SHA.' | Tee-Object -FilePath $logPath -Append
    } else {
        throw "Unknown fixed source file hash; refusing patch/build: $sourceHash"
    }

    $patchedSourceHash = (Get-FileHash -LiteralPath $sourceFilePath -Algorithm SHA256).Hash
    if ($patchedSourceHash -ne $expectedPatchedSourceFileHash) {
        throw "Patched source file hash mismatch: $patchedSourceHash"
    }

    $archiveHashAfterPatch = (Get-FileHash -LiteralPath $sourceArchivePath -Algorithm SHA256).Hash
    if ($archiveHashAfterPatch -ne $expectedSourceArchiveHash) {
        throw "Source archive changed during patching: $archiveHashAfterPatch"
    }

    "Source archive SHA-256: $archiveHashAfterPatch" | Tee-Object -FilePath $logPath -Append
    "Base source file SHA-256: $expectedBaseSourceFileHash" | Tee-Object -FilePath $logPath -Append
    "Tracked patch SHA-256: $patchHash" | Tee-Object -FilePath $logPath -Append
    "Patched source file SHA-256: $patchedSourceHash" | Tee-Object -FilePath $logPath -Append
    "DUB selections lock SHA-256: $selectionsHash" | Tee-Object -FilePath $logPath -Append
    "Preserved Slice A failure log SHA-256: $priorFailureHash" | Tee-Object -FilePath $logPath -Append

    'Native build: fixed Inochi2D base + exact tracked A2 patch + same local DUB lock + LDC internal linker' |
        Tee-Object -FilePath $logPath -Append
    & $dub build "--compiler=$ldc" '--cache=local' '--build=release' 2>&1 |
        Tee-Object -FilePath $logPath -Append
    if ($LASTEXITCODE -ne 0) { throw "DUB build failed with exit code $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
        throw "DUB reported success but the expected proof executable is missing: $exePath"
    }
    $selectionsHashAfterBuild = (Get-FileHash -LiteralPath $selectionsPath -Algorithm SHA256).Hash
    if ($selectionsHashAfterBuild -ne $expectedSelectionsHash) {
        throw "DUB selections changed during build: $selectionsHashAfterBuild"
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
        $selectionsPath,
        $sourceArchivePath,
        $sourceFilePath,
        $patchPath,
        $priorFailureLogPath
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
