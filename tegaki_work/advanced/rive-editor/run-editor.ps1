# ROLE: WP-029 の公式 CLI/runtime cache gate と専用 server launcher。
# AUTHORITY: process-only RIVE_HOME、cache artifact、own PID のみ。system toolchain と製品状態は変更しない。
# INVARIANTS: 固定 hash/version、served runtime 3 files、18729 占有時 HOLD、own server 以外は停止しない。
# RELATED: advanced/rive-editor/model.mjs、server.mjs、WP-026 cache、WP-029 result report。

[CmdletBinding()]
param(
    [switch]$StartServer,
    [switch]$StopServer
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$cache = Join-Path $root 'tegaki_work\.cache\rive-editor'
$proofCache = Join-Path $root 'tegaki_work\.cache\rive-authoring-proof'
$archivePath = Join-Path $root 'tegaki_work\.cache\rig-reassessment\rive-1.3.0-docs-source.tar.gz'
$project = Join-Path $cache 'project'
$cli = Join-Path $proofCache 'cli-1.3.0\rive.exe'
$runtimeArchive = Join-Path $proofCache 'canvas-advanced-2.44.0.tgz'
$runtimePackage = Join-Path $proofCache 'runtime-2.44.0\package'
$riveHome = Join-Path $cache 'rive-home'
$server = Join-Path $root 'tegaki_work\advanced\rive-editor\server.mjs'
$verifier = Join-Path $root 'tegaki_work\build\verify-rive-editor-model.mjs'
$pidFile = Join-Path $cache 'server.pid.json'
$manifestFile = Join-Path $cache 'run-manifest.json'
$port = 18729
$hostAddress = '127.0.0.1'
$expectedArchiveSha256 = 'F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF'
$expectedRuntimeSha512 = '1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA=='
$expectedCliSha256 = '285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9'
$expectedVersion = 'rive 1.3.0'
$expectedServedRuntimeSha256 = [ordered]@{
    canvasAdvancedMjs = '8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9'
    riveWasm = 'A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74'
    fallbackWasm = 'A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5'
}

function Assert-File([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Label`: $Path" }
}

function Hash-Base64([string]$Path) {
    $hex = (Get-FileHash -LiteralPath $Path -Algorithm SHA512).Hash
    $bytes = New-Object 'System.Collections.Generic.List[byte]'
    for ($i = 0; $i -lt $hex.Length; $i += 2) { [void]$bytes.Add([Convert]::ToByte($hex.Substring($i, 2), 16)) }
    return [Convert]::ToBase64String($bytes.ToArray())
}

function Invoke-Rive([string[]]$Arguments, [string]$LogName) {
    $log = Join-Path $cache $LogName
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @(& $cli @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    [IO.File]::WriteAllText($log, (($lines -join "`n") + "`n"))
    if ($exitCode -ne 0) { throw "Rive CLI failed ($($Arguments -join ' ')); see $log" }
    return ($lines -join "`n")
}

function Initialize-RiveEnvironment {
    New-Item -ItemType Directory -Force -Path $riveHome | Out-Null
    $env:RIVE_HOME = $riveHome
    $env:RIVE_ANALYTICS = '0'
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $off = @(& $cli analytics off 2>&1 | ForEach-Object { $_.ToString() })
    $offCode = $LASTEXITCODE
    $status = @(& $cli analytics 2>&1 | ForEach-Object { $_.ToString() })
    $statusCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    $output = (($off + $status) -join "`n") + "`n"
    [IO.File]::WriteAllText((Join-Path $cache 'analytics-off.log'), $output)
    if ($offCode -ne 0 -or $statusCode -ne 0 -or (($status -join "`n") -notmatch 'analytics\s+off')) {
        throw "Rive CLI analytics is not explicitly off; see $(Join-Path $cache 'analytics-off.log')"
    }
    [IO.File]::WriteAllText((Join-Path $cache 'cli-environment.json'), (@{
        riveHome = $riveHome
        riveAnalytics = '0'
        analyticsCommand = 'off'
        processOnly = $true
        pathChanged = $false
    } | ConvertTo-Json -Depth 4))
}

function Test-PortFree {
    $owners = @(Get-NetTCPConnection -LocalAddress $hostAddress -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess })
    if ($owners.Count -eq 0) {
        $matches = @(netstat -ano -p tcp 2>$null | Select-String -Pattern "127\.0\.0\.1:$port\s+.*LISTENING\s+(\d+)$")
        $owners = @($matches | ForEach-Object { if ($_.Matches.Count -gt 0) { [int]$_.Matches[0].Groups[1].Value } })
    }
    if ($owners.Count -gt 0) { throw "HOLD: dedicated proof port $hostAddress`:$port is occupied ($($owners -join ', ')); no process was stopped." }
}

function Stop-OwnEditorServer {
    Assert-File $pidFile 'editor server PID record'
    $record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $editorPid = [int]$record.pid
    try {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$editorPid" -ErrorAction Stop
    } catch {
        throw "HOLD: process identity query failed for PID $editorPid; no process was stopped."
    }
    if (-not $process -or $process.CommandLine -notmatch 'rive-editor[\\/]server\.mjs') { throw "HOLD: PID $editorPid is not the recorded rive-editor server; no process was stopped." }
    Stop-Process -Id $editorPid -Force
    [IO.File]::WriteAllText($pidFile, (@{ pid = $editorPid; stoppedAt = (Get-Date).ToUniversalTime().ToString('o'); command = $process.CommandLine } | ConvertTo-Json))
    Write-Output "Stopped own Rive editor server PID=$editorPid"
}

if ($StopServer -and $StartServer) { throw 'Choose either -StartServer or -StopServer.' }
if ($StopServer) { Stop-OwnEditorServer; exit 0 }

New-Item -ItemType Directory -Force -Path $cache | Out-Null
Assert-File $cli 'official CLI from WP026 cache'
Assert-File $archivePath 'official CLI archive cache'
Assert-File $runtimeArchive 'official Web runtime archive from WP026 cache'
$runtimePaths = [ordered]@{
    canvasAdvancedMjs = Join-Path $runtimePackage 'canvas_advanced.mjs'
    riveWasm = Join-Path $runtimePackage 'rive.wasm'
    fallbackWasm = Join-Path $runtimePackage 'rive_fallback.wasm'
}
$servedRuntimeSha256 = [ordered]@{}
foreach ($entry in $runtimePaths.GetEnumerator()) {
    Assert-File $entry.Value "official Web runtime file $($entry.Key)"
    $servedHash = (Get-FileHash -LiteralPath $entry.Value -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($servedHash -ne $expectedServedRuntimeSha256[$entry.Key]) { throw "Served Web runtime SHA-256 mismatch for $($entry.Key): $servedHash" }
    $servedRuntimeSha256[$entry.Key] = $servedHash
}
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($archiveHash.ToUpperInvariant() -ne $expectedArchiveSha256) { throw "Official CLI archive SHA-256 mismatch: $archiveHash" }
$cliHash = (Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash.ToUpperInvariant()
if ($cliHash -ne $expectedCliSha256) { throw "Official CLI executable SHA-256 mismatch: $cliHash" }
$runtimeHash = Hash-Base64 $runtimeArchive
if ($runtimeHash -ne $expectedRuntimeSha512) { throw "Official runtime SHA-512 integrity mismatch: $runtimeHash" }
$version = (& $cli --version 2>&1 | Out-String).Trim()
if ($version -ne $expectedVersion) { throw "Unexpected Rive CLI version: $version" }
Initialize-RiveEnvironment

$node = (Get-Command node -ErrorAction Stop).Source
& $node --check (Join-Path $root 'tegaki_work\advanced\rive-editor\model.mjs')
& $node --check (Join-Path $root 'tegaki_work\advanced\rive-editor\server.mjs')
& $node --check (Join-Path $root 'tegaki_work\advanced\rive-editor\runtime.js')
& $node --check (Join-Path $root 'tegaki_work\advanced\rive-editor\editor.js')
& $node $verifier | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Rive editor model verifier failed.' }

Invoke-Rive @($project, '--verify', '--format=json') 'verify.log' | Out-Host
Invoke-Rive @($project, '--once', '--format=json') 'once.log' | Out-Host
Assert-File (Join-Path $project 'build\tegaki_rive_editor.riv') 'compiled editor proof .riv'
Invoke-Rive @('inspect', $project, '--json') 'inspect.json' | Out-Host

$manifest = [ordered]@{
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    cliVersion = $version
    cliArchiveSha256 = $archiveHash.ToUpperInvariant()
    cliExecutableSha256 = $cliHash
    runtimeArchiveSha512 = $runtimeHash
    runtimePackage = $runtimePackage
    servedRuntimeSha256 = $servedRuntimeSha256
    riveHome = $riveHome
    riveAnalytics = '0'
    analyticsCommand = 'off'
    environmentScope = 'process-only'
    fixture = $project
    fixturePng = (Get-Item -LiteralPath (Join-Path $project 'fixture.png')).Length
    port = $port
    server = $server
}

if ($StartServer) {
    Test-PortFree
    $stdout = Join-Path $cache 'server.stdout.log'
    $stderr = Join-Path $cache 'server.stderr.log'
    $process = Start-Process -FilePath $node -ArgumentList @($server) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if ($process.HasExited) { break }
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "http://$hostAddress`:$port/health"
            if ($health.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) {
        $line = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
        throw "Rive editor server did not become ready. PID=$($process.Id)`n$line"
    }
    $pidRecord = [ordered]@{ pid = $process.Id; startedAt = (Get-Date).ToUniversalTime().ToString('o'); command = "$node $server" }
    [IO.File]::WriteAllText($pidFile, ($pidRecord | ConvertTo-Json))
    $manifest.serverPid = $process.Id
    $manifest.serverUrl = "http://$hostAddress`:$port/"
    Write-Output "Started own Rive editor server PID=$($process.Id) at $($manifest.serverUrl)"
}

[IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json -Depth 6))
Write-Output "WP-029 model/CLI proof checks passed; manifest=$manifestFile"

