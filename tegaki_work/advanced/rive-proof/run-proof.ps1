[CmdletBinding()]
param(
    [switch]$StartServer,
    [switch]$StopServer
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$cache = Join-Path $root 'tegaki_work\.cache\rive-authoring-proof'
$project = Join-Path $cache 'project'
$cli = Join-Path $cache 'cli-1.3.0\rive.exe'
$runtimeArchive = Join-Path $cache 'canvas-advanced-2.44.0.tgz'
$runtimePackage = Join-Path $cache 'runtime-2.44.0\package'
$riveHome = Join-Path $cache 'rive-home'
$server = Join-Path $root 'tegaki_work\advanced\rive-proof\proof-server.mjs'
$pidFile = Join-Path $cache 'server.pid.json'
$manifestFile = Join-Path $cache 'run-manifest.json'
$port = 18726
$hostAddress = '127.0.0.1'
$archivePath = Join-Path $root 'tegaki_work\.cache\rig-reassessment\rive-1.3.0-docs-source.tar.gz'
$expectedArchiveSha256 = 'F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF'
$expectedRuntimeSha512 = '1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA=='
$expectedVersion = 'rive 1.3.0'

function Assert-File([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing $Label`: $Path"
    }
}

function Hash-Base64([string]$Path) {
    $hex = (Get-FileHash -LiteralPath $Path -Algorithm SHA512).Hash
    $list = New-Object 'System.Collections.Generic.List[byte]'
    for ($i = 0; $i -lt $hex.Length; $i += 2) { [void]$list.Add([Convert]::ToByte($hex.Substring($i, 2), 16)) }
    return [Convert]::ToBase64String($list.ToArray())
}

function Invoke-Rive([string[]]$Arguments, [string]$LogName) {
    $log = Join-Path $cache $LogName
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lines = @(& $cli @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    $output = ($lines -join "`n") + "`n"
    [IO.File]::WriteAllText($log, $output)
    if ($exitCode -ne 0) {
        throw "Rive CLI failed ($($Arguments -join ' ')); see $log"
    }
    return $output
}

function Initialize-RiveEnvironment {
    New-Item -ItemType Directory -Force -Path $riveHome | Out-Null
    $env:RIVE_HOME = $riveHome
    $env:RIVE_ANALYTICS = '0'
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $offLines = @(& $cli analytics off 2>&1 | ForEach-Object { $_.ToString() })
    $offCode = $LASTEXITCODE
    $statusLines = @(& $cli analytics 2>&1 | ForEach-Object { $_.ToString() })
    $statusCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    $offOutput = ($offLines -join "`n") + "`n"
    $statusOutput = ($statusLines -join "`n") + "`n"
    [IO.File]::WriteAllText((Join-Path $cache 'analytics-off.log'), $offOutput + $statusOutput)
    if ($offCode -ne 0 -or $statusCode -ne 0 -or $statusOutput -notmatch 'analytics\s+off') {
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
    $connections = @(Get-NetTCPConnection -LocalAddress $hostAddress -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    $owners = @($connections | ForEach-Object { $_.OwningProcess })
    if ($owners.Count -eq 0) {
        $netstat = @(netstat -ano -p tcp 2>$null | Select-String -Pattern "127\.0\.0\.1:$port\s+.*LISTENING\s+(\d+)$")
        $owners = @($netstat | ForEach-Object { if ($_.Matches.Count -gt 0) { [int]$_.Matches[0].Groups[1].Value } })
    }
    if ($owners.Count -gt 0) {
        $ownerText = ($owners | ForEach-Object { "PID=$_" }) -join ', '
        throw "HOLD: dedicated proof port $hostAddress`:$port is already occupied ($ownerText). No process was stopped."
    }
}

function Get-PngInfo([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 26 -or $bytes[0] -ne 137 -or $bytes[1] -ne 80 -or $bytes[2] -ne 78 -or $bytes[3] -ne 71) {
        throw "Fixture is not a PNG: $Path"
    }
    $width = ($bytes[16] * 16777216) + ($bytes[17] * 65536) + ($bytes[18] * 256) + $bytes[19]
    $height = ($bytes[20] * 16777216) + ($bytes[21] * 65536) + ($bytes[22] * 256) + $bytes[23]
    return [pscustomobject]@{ Width = $width; Height = $height; ColorType = $bytes[25]; Bytes = $bytes.Length }
}

function Stop-OwnProofServer {
    Assert-File $pidFile 'proof server PID record'
    $record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $serverPid = [int]$record.pid
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid" -ErrorAction SilentlyContinue
    if (-not $process -or $process.CommandLine -notmatch 'proof-server\.mjs') {
        throw "HOLD: PID $serverPid is not the recorded proof-server.mjs process; no process was stopped."
    }
    Stop-Process -Id $serverPid -Force
    [IO.File]::WriteAllText($pidFile, (@{ pid = $serverPid; stoppedAt = (Get-Date).ToUniversalTime().ToString('o'); command = $process.CommandLine } | ConvertTo-Json))
    Write-Output "Stopped own proof server PID=$serverPid"
}

if ($StopServer -and $StartServer) { throw 'Choose either -StartServer or -StopServer.' }
if ($StopServer) { Stop-OwnProofServer; exit 0 }

Assert-File $archivePath 'official CLI archive cache'
Assert-File $cli 'extracted official Rive CLI'
Assert-File $runtimeArchive 'official Web runtime archive cache'
foreach ($name in @('canvas_advanced.mjs', 'rive.wasm', 'rive_fallback.wasm')) {
    Assert-File (Join-Path $runtimePackage $name) "Rive Web runtime file $name"
}
foreach ($name in @('rive.yaml', 'scene.rml', 'fixture.png')) {
    Assert-File (Join-Path $project $name) "proof fixture $name"
}

$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($archiveHash -ne $expectedArchiveSha256) { throw "Official CLI archive SHA-256 mismatch: $archiveHash" }
$runtimeHash = Hash-Base64 $runtimeArchive
if ($runtimeHash -ne $expectedRuntimeSha512) { throw "Rive Web runtime SHA-512 integrity mismatch: $runtimeHash" }
$version = (& $cli --version 2>&1 | Out-String).Trim()
if ($version -ne $expectedVersion) { throw "Unexpected Rive CLI version: $version" }
Initialize-RiveEnvironment
$png = Get-PngInfo (Join-Path $project 'fixture.png')
if ($png.Width -ne 240 -or $png.Height -ne 160 -or $png.ColorType -ne 6) { throw "Fixture must be RGBA 240x160; got $($png.Width)x$($png.Height), color type $($png.ColorType)" }

Invoke-Rive @($project, '--verify', '--format=json') 'verify.log' | Out-Host
Invoke-Rive @($project, '--once', '--format=json') 'once.log' | Out-Host
Assert-File (Join-Path $project 'build\rive_authoring_proof.riv') 'compiled proof .riv'
Invoke-Rive @('inspect', $project, '--json') 'inspect.json' | Out-Host

$manifest = [ordered]@{
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    cliVersion = $version
    cliArchive = $archivePath
    cliArchiveSha256 = $archiveHash
    cliExecutableSha256 = (Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash.ToUpperInvariant()
    runtimeArchive = $runtimeArchive
    runtimeArchiveSha512 = $runtimeHash
    runtimePackage = $runtimePackage
    riveHome = $riveHome
    riveAnalytics = '0'
    analyticsCommand = 'off'
    environmentScope = 'process-only'
    fixture = $project
    fixturePng = $png
    port = $port
    server = $server
}

if ($StartServer) {
    Test-PortFree
    $stdout = Join-Path $cache 'server.stdout.log'
    $stderr = Join-Path $cache 'server.stderr.log'
    $node = (Get-Command node -ErrorAction Stop).Source
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
        throw "Proof server did not become ready. PID=$($process.Id)`n$line"
    }
    $pidRecord = [ordered]@{ pid = $process.Id; startedAt = (Get-Date).ToUniversalTime().ToString('o'); command = "$node $server" }
    [IO.File]::WriteAllText($pidFile, ($pidRecord | ConvertTo-Json))
    $manifest.serverPid = $process.Id
    $manifest.serverUrl = "http://$hostAddress`:$port/"
    Write-Output "Started own proof server PID=$($process.Id) at $($manifest.serverUrl)"
}

[IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json -Depth 6))
Write-Output "WP-026 static/CLI proof checks passed; manifest=$manifestFile"
