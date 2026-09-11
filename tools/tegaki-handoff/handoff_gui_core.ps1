# Shared, fail-closed helpers for TEGAKI-HANDOFF-GUI-V1C.
# This file has no entry-point side effects. The GUI and verifier dot-source it.

$ErrorActionPreference = 'Stop'

function Get-GuiSettingsPath {
    $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        $localAppData = [IO.Path]::GetTempPath()
    }
    return (Join-Path $localAppData 'TEGAKI-Handoff\settings.json')
}

function Get-GuiDefaultSettings {
    return [ordered]@{
        repo_root = ''
        always_on_top = $true
        window_x = 80
        window_y = 80
        target_tokens = [ordered]@{
            H3_WEBGPT = 'WebGPT'
            MANGA_WEBGPT = 'WebGPT'
        }
        last_returned_h3_report_sha256 = ''
        last_returned_h3_card_id = ''
        last_returned_manga_report_sha256 = ''
        last_returned_manga_card_id = ''
    }
}

function Get-GuiSettings {
    $defaults = Get-GuiDefaultSettings
    $path = Get-GuiSettingsPath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $defaults
    }

    try {
        $stored = [IO.File]::ReadAllText($path) | ConvertFrom-Json
        if ($stored.PSObject.Properties['repo_root']) {
            $defaults.repo_root = [string]$stored.repo_root
        }
        if ($stored.PSObject.Properties['always_on_top']) {
            $defaults.always_on_top = [bool]$stored.always_on_top
        }
        if ($stored.PSObject.Properties['window_x']) {
            $defaults.window_x = [int]$stored.window_x
        }
        if ($stored.PSObject.Properties['window_y']) {
            $defaults.window_y = [int]$stored.window_y
        }
        if ($stored.PSObject.Properties['target_tokens'] -and $null -ne $stored.target_tokens) {
            foreach ($route in @('H3_WEBGPT', 'MANGA_WEBGPT')) {
                if ($stored.target_tokens.PSObject.Properties[$route]) {
                    $defaults.target_tokens[$route] = [string]$stored.target_tokens.$route
                }
            }
        }
        foreach ($field in @('last_returned_h3_report_sha256', 'last_returned_h3_card_id', 'last_returned_manga_report_sha256', 'last_returned_manga_card_id')) {
            if ($stored.PSObject.Properties[$field]) { $defaults[$field] = [string]$stored.$field }
        }
    }
    catch {
        # A corrupt settings file is treated as absent. It never blocks the repo.
    }
    return $defaults
}

function Write-GuiTextAtomically {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Text
    )

    $directory = Split-Path -Parent $Path
    $null = New-Item -ItemType Directory -Path $directory -Force
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

function Save-GuiSettings {
    param(
        [Parameter(Mandatory = $true)]$Settings
    )

    $safe = [ordered]@{
        repo_root = [string]$Settings.repo_root
        always_on_top = [bool]$Settings.always_on_top
        window_x = [int]$Settings.window_x
        window_y = [int]$Settings.window_y
        target_tokens = [ordered]@{}
        last_returned_h3_report_sha256 = [string]$Settings.last_returned_h3_report_sha256
        last_returned_h3_card_id = [string]$Settings.last_returned_h3_card_id
        last_returned_manga_report_sha256 = [string]$Settings.last_returned_manga_report_sha256
        last_returned_manga_card_id = [string]$Settings.last_returned_manga_card_id
    }
    foreach ($route in @('H3_WEBGPT', 'MANGA_WEBGPT')) {
        $value = ''
        if ($Settings.target_tokens -and $Settings.target_tokens.PSObject.Properties[$route]) {
            $value = [string]$Settings.target_tokens.$route
        }
        elseif ($Settings.target_tokens -and $Settings.target_tokens.Contains($route)) {
            $value = [string]$Settings.target_tokens[$route]
        }
        $safe.target_tokens[$route] = $value
    }

    $json = $safe | ConvertTo-Json -Depth 5
    Write-GuiTextAtomically -Path (Get-GuiSettingsPath) -Text ($json + [Environment]::NewLine)
}

function Get-GuiReportDigest {
    param([Parameter(Mandatory = $true)][string]$ReportText)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($ReportText)
        $hash = $sha256.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-GuiReturnTrackingFieldNames {
    param([Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane)

    if ($Lane -eq 'H3') {
        return [pscustomobject]@{ Digest = 'last_returned_h3_report_sha256'; CardId = 'last_returned_h3_card_id' }
    }
    return [pscustomobject]@{ Digest = 'last_returned_manga_report_sha256'; CardId = 'last_returned_manga_card_id' }
}

function Get-GuiLastReturnedDigest {
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane
    )

    $fieldNames = Get-GuiReturnTrackingFieldNames -Lane $Lane
    if ($Settings -is [System.Collections.IDictionary] -and $Settings.Contains($fieldNames.Digest)) {
        return [string]$Settings[$fieldNames.Digest]
    }
    if ($Settings.PSObject.Properties[$fieldNames.Digest]) { return [string]$Settings.$($fieldNames.Digest) }
    return ''
}

function Set-GuiLastReturnedReport {
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$Digest,
        [Parameter(Mandatory = $true)][string]$CardId
    )

    $fieldNames = Get-GuiReturnTrackingFieldNames -Lane $Lane
    if ($Settings -is [System.Collections.IDictionary]) {
        $Settings[$fieldNames.Digest] = $Digest
        $Settings[$fieldNames.CardId] = $CardId
        return
    }
    $Settings | Add-Member -NotePropertyName $fieldNames.Digest -NotePropertyValue $Digest -Force
    $Settings | Add-Member -NotePropertyName $fieldNames.CardId -NotePropertyValue $CardId -Force
}

function Invoke-GuiReturnTransfer {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Route,
        [Parameter(Mandatory = $true)][string]$TargetToken,
        [Parameter(Mandatory = $true)][scriptblock]$SetStatus,
        [scriptblock]$ClipboardWriter = { param([string]$Value) Set-GuiClipboardText -Text $Value },
        [scriptblock]$WindowProvider = { Get-GuiDesktopWindows },
        [scriptblock]$WindowPaster = { param($Window) Invoke-GuiWindowPaste -Window $Window }
    )

    try { & $ClipboardWriter $Text }
    catch {
        $message = "返却準備に失敗しました。クリップボードは変更していません。($($_.Exception.Message))"
        & $SetStatus $message
        return [pscustomobject]@{ PayloadReady = $false; Message = $message }
    }

    $resolution = Resolve-GuiTargetWindow -Windows @(& $WindowProvider) -Token $TargetToken
    if ($resolution.Status -eq 'TARGET FOUND') {
        try {
            $null = & $WindowPaster $resolution.Matches[0]
            $message = "$Route を貼り付けました。送信はOwnerが手動で行います。"
        }
        catch {
            $message = "$Route の貼り付けに失敗しました。クリップボードから手動で貼り付けてください。送信はOwnerが手動で行います。($($_.Exception.Message))"
        }
    }
    else {
        $message = "返却内容をクリップボードに用意しました。対象が見つからないため手動で貼り付けてください。($($resolution.Status))"
    }
    & $SetStatus $message
    return [pscustomobject]@{ PayloadReady = $true; Message = $message }
}

function Resolve-GuiRepositoryRoot {
    param([string]$RequestedRoot)

    if ([string]::IsNullOrWhiteSpace($RequestedRoot)) {
        $candidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    }
    else {
        $candidate = [IO.Path]::GetFullPath($RequestedRoot)
    }

    $detectedOutput = & git -C $candidate rev-parse --show-toplevel 2>$null
    $gitExitCode = $LASTEXITCODE
    $detected = @($detectedOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($detected)) {
        throw "Not a Git repository: $candidate"
    }
    return [IO.Path]::GetFullPath($detected.Trim())
}

function Get-GuiCurrentHead {
    param([Parameter(Mandatory = $true)][string]$RepoRoot)

    $headOutput = & git -C $RepoRoot rev-parse HEAD 2>$null
    $gitExitCode = $LASTEXITCODE
    $head = @($headOutput) | Select-Object -First 1
    if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
        throw 'Unable to read the repository HEAD.'
    }
    return $head.Trim()
}

function Get-GuiLaneDefinition {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    $handoffRoot = Join-Path $RepoRoot '.tegaki-handoff'
    if ($Lane -eq 'H3') {
        $laneRoot = $handoffRoot
        return [pscustomobject]@{
            Lane = 'H3'
            Channel = 'H3'
            Target = 'LUNA'
            Root = $laneRoot
            CardPath = Join-Path $laneRoot 'to_luna\current_card.md'
            ReportPath = Join-Path $laneRoot 'from_luna\latest_report.md'
            StatePath = Join-Path $laneRoot 'state.json'
            CardRelativePath = '.tegaki-handoff/to_luna/current_card.md'
            ReportRelativePath = '.tegaki-handoff/from_luna/latest_report.md'
            AgentRoute = 'H3_AGENT'
            WebRoute = 'H3_WEBGPT'
        }
    }

    $laneRoot = Join-Path $handoffRoot 'manga'
    return [pscustomobject]@{
        Lane = 'MANGA'
        Channel = 'MANGA'
        Target = 'GEMINI'
        Root = $laneRoot
        CardPath = Join-Path $laneRoot 'to_gemini\current_card.md'
        ReportPath = Join-Path $laneRoot 'from_gemini\latest_report.md'
        StatePath = Join-Path $laneRoot 'state.json'
        CardRelativePath = '.tegaki-handoff/manga/to_gemini/current_card.md'
        ReportRelativePath = '.tegaki-handoff/manga/from_gemini/latest_report.md'
        AgentRoute = 'MANGA_AGENT'
        WebRoute = 'MANGA_WEBGPT'
    }
}

function Get-GuiTextLines {
    param([Parameter(Mandatory = $true)][string]$Text)
    return [regex]::Split($Text, "\r\n|\n|\r")
}

function Get-GuiCardPayload {
    param([Parameter(Mandatory = $true)][string]$Text)

    $beginMarker = '<<<TEGAKI_CARD_BEGIN>>>'
    $endMarker = '<<<TEGAKI_CARD_END>>>'
    $beginMatches = [regex]::Matches($Text, [regex]::Escape($beginMarker))
    $endMatches = [regex]::Matches($Text, [regex]::Escape($endMarker))

    if ($beginMatches.Count -eq 0 -and $endMatches.Count -eq 0) {
        $lines = Get-GuiTextLines $Text
        if ($lines.Count -gt 0 -and $lines[0].TrimStart([char]0xFEFF).Trim() -match '^TEGAKI_CARD_V[12]$') {
            return $Text
        }
        throw 'CARD NOT FOUND: use a pure Card or one explicit BEGIN/END wrapper.'
    }

    if ($beginMatches.Count -ne 1 -or $endMatches.Count -ne 1) {
        throw 'CARD MARKERS INVALID: exactly one BEGIN/END Card block is required.'
    }
    $begin = $beginMatches[0]
    $end = $endMatches[0]
    if ($end.Index -le $begin.Index) {
        throw 'CARD MARKERS INVALID: END occurs before BEGIN.'
    }

    $payloadStart = $begin.Index + $begin.Length
    $payload = $Text.Substring($payloadStart, $end.Index - $payloadStart)
    if ($payload.StartsWith("`r`n")) {
        $payload = $payload.Substring(2)
    }
    elseif ($payload.StartsWith("`n") -or $payload.StartsWith("`r")) {
        $payload = $payload.Substring(1)
    }
    if ($payload.EndsWith("`r`n")) {
        $payload = $payload.Substring(0, $payload.Length - 2)
    }
    elseif ($payload.EndsWith("`n") -or $payload.EndsWith("`r")) {
        $payload = $payload.Substring(0, $payload.Length - 1)
    }

    $payloadLines = Get-GuiTextLines $payload
    if ($payloadLines.Count -eq 0 -or $payloadLines[0].TrimStart([char]0xFEFF).Trim() -notmatch '^TEGAKI_CARD_V[12]$') {
        throw 'CARD NOT FOUND: wrapped content must start with TEGAKI_CARD_V1 or TEGAKI_CARD_V2.'
    }
    return $payload
}

function Get-GuiEnvelopeFields {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [ValidateSet('Card', 'Report')][string]$Kind = 'Card'
    )

    $lines = Get-GuiTextLines $Text
    if ($lines.Count -eq 0) {
        throw "Invalid $Kind envelope: it is empty."
    }

    $firstLine = $lines[0].TrimStart([char]0xFEFF).Trim()
    if ($Kind -eq 'Card') {
        if ($firstLine -notmatch '^TEGAKI_CARD_V[12]$') {
            throw 'Invalid Card envelope: first line must be TEGAKI_CARD_V1 or TEGAKI_CARD_V2.'
        }
        $fieldNames = @('CARD_ID', 'CHANNEL', 'TARGET', 'BASE_SHA', 'EXECUTION', 'PUSH', 'AUTO_RUN')
    }
    else {
        if ($firstLine -cne 'TEGAKI_REPORT_V1') {
            throw 'Invalid Report envelope: first line must be TEGAKI_REPORT_V1.'
        }
        $fieldNames = @('CARD_ID', 'RESULT')
    }

    $fields = @{}
    $limit = [Math]::Min($lines.Count, 40)
    $fieldPattern = '^\s*({0})\s*:\s*(.*?)\s*$' -f (($fieldNames | ForEach-Object { [regex]::Escape($_) }) -join '|')
    for ($index = 0; $index -lt $limit; $index++) {
        if ($lines[$index] -cmatch $fieldPattern) {
            $name = $matches[1]
            if ($fields.ContainsKey($name)) {
                throw "Duplicate $name field in $Kind envelope."
            }
            $fields[$name] = $matches[2].Trim()
        }
    }

    $required = if ($Kind -eq 'Card') { @('CARD_ID', 'TARGET', 'BASE_SHA', 'EXECUTION', 'PUSH', 'AUTO_RUN') } else { @('CARD_ID', 'RESULT') }
    if ($firstLine -eq 'TEGAKI_CARD_V2') {
        $required += 'CHANNEL'
    }
    foreach ($name in $required) {
        if (-not $fields.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($fields[$name])) {
            throw "Missing required $name field in $Kind envelope."
        }
    }
    return [pscustomobject]@{
        Version = $firstLine
        Fields = $fields
    }
}

function Test-GuiCard {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$ExpectedBaseSha
    )

    try {
        $payload = Get-GuiCardPayload $Text
        $envelope = Get-GuiEnvelopeFields -Text $payload -Kind Card
        $fields = $envelope.Fields
        if ($Lane -eq 'H3') {
            if ($envelope.Version -eq 'TEGAKI_CARD_V2' -and $fields['CHANNEL'] -cne 'H3') {
                throw 'H3 lane requires CHANNEL: H3 for Card V2.'
            }
            if ($fields['TARGET'] -cne 'LUNA') {
                throw 'H3 Card TARGET must be exactly LUNA.'
            }
            if ($fields['CARD_ID'] -notmatch '^(H3-|TEGAKI-HANDOFF-)') {
                throw 'H3 Card ID must start with H3- or TEGAKI-HANDOFF-.'
            }
        }
        else {
            if ($envelope.Version -cne 'TEGAKI_CARD_V2') {
                throw 'Manga lane accepts only TEGAKI_CARD_V2.'
            }
            if ($fields['CHANNEL'] -cne 'MANGA') {
                throw 'Manga lane requires CHANNEL: MANGA.'
            }
            if ($fields['TARGET'] -cne 'GEMINI') {
                throw 'Manga Card TARGET must be exactly GEMINI.'
            }
            if ($fields['CARD_ID'] -notmatch '^MANGA-') {
                throw 'Manga Card ID must start with MANGA-.'
            }
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
        if ($fields['BASE_SHA'] -cne $ExpectedBaseSha) {
            throw "BASE SHA MISMATCH: Card expects $($fields['BASE_SHA']); current repository is $ExpectedBaseSha."
        }
        return [pscustomobject]@{
            Valid = $true
            Message = 'VALID'
            Payload = $payload
            Version = $envelope.Version
            Fields = $fields
        }
    }
    catch {
        return [pscustomobject]@{
            Valid = $false
            Message = $_.Exception.Message
            Payload = $null
            Version = $null
            Fields = $null
        }
    }
}

function Assert-GuiCard {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$ExpectedBaseSha
    )
    $result = Test-GuiCard -Text $Text -Lane $Lane -ExpectedBaseSha $ExpectedBaseSha
    if (-not $result.Valid) {
        throw $result.Message
    }
    return $result
}

function Get-GuiCurrentLaneCard {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )
    $definition = Get-GuiLaneDefinition -Lane $Lane -RepoRoot $RepoRoot
    if (-not (Test-Path -LiteralPath $definition.StatePath -PathType Leaf)) {
        throw "$Lane handoff state not found."
    }
    if (-not (Test-Path -LiteralPath $definition.CardPath -PathType Leaf)) {
        throw "$Lane current Card not found."
    }
    $state = [IO.File]::ReadAllText($definition.StatePath) | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$state.card_id)) {
        throw "$Lane handoff state has no active Card ID."
    }
    $cardText = [IO.File]::ReadAllText($definition.CardPath)
    $check = Assert-GuiCard -Text $cardText -Lane $Lane -ExpectedBaseSha (Get-GuiCurrentHead $RepoRoot)
    if ($check.Fields['CARD_ID'] -cne [string]$state.card_id) {
        throw "$Lane state/Card ID mismatch."
    }
    return [pscustomobject]@{
        CardId = [string]$check.Fields['CARD_ID']
        CardText = $cardText
        Fields = $check.Fields
        Version = $check.Version
    }
}

function Get-GuiSafeArchiveToken {
    param([string]$Value)
    $token = [regex]::Replace([string]$Value, '[^A-Za-z0-9._-]', '_')
    if ([string]::IsNullOrWhiteSpace($token)) { $token = 'unknown' }
    if ($token.Length -gt 80) { $token = $token.Substring(0, 80) }
    return $token
}

function Get-GuiEmbeddedCardId {
    param([string]$Path, [string]$Fallback)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $Fallback }
    $lines = Get-GuiTextLines ([IO.File]::ReadAllText($Path))
    $limit = [Math]::Min($lines.Count, 40)
    for ($index = 0; $index -lt $limit; $index++) {
        if ($lines[$index] -cmatch '^\s*CARD_ID\s*:\s*(.*?)\s*$') {
            if (-not [string]::IsNullOrWhiteSpace($matches[1])) { return $matches[1].Trim() }
        }
    }
    return $Fallback
}

function Stage-GuiMangaCard {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$CardText
    )

    $head = Get-GuiCurrentHead $RepoRoot
    $check = Assert-GuiCard -Text $CardText -Lane MANGA -ExpectedBaseSha $head
    $lane = Get-GuiLaneDefinition -Lane MANGA -RepoRoot $RepoRoot
    $cardArchiveDirectory = Join-Path $lane.Root 'archive\cards'
    $reportArchiveDirectory = Join-Path $lane.Root 'archive\reports'
    foreach ($directory in @($lane.Root, (Split-Path -Parent $lane.CardPath), (Split-Path -Parent $lane.ReportPath), (Join-Path $lane.Root 'archive'), $cardArchiveDirectory, $reportArchiveDirectory)) {
        $null = New-Item -ItemType Directory -Path $directory -Force
    }

    $archiveStamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
    if (Test-Path -LiteralPath $lane.CardPath -PathType Leaf) {
        $oldId = Get-GuiEmbeddedCardId -Path $lane.CardPath -Fallback 'unknown-card'
        $name = '{0}_{1}_{2}.md' -f (Get-GuiSafeArchiveToken $oldId), $archiveStamp, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
        Move-Item -LiteralPath $lane.CardPath -Destination (Join-Path $cardArchiveDirectory $name)
    }
    if (Test-Path -LiteralPath $lane.ReportPath -PathType Leaf) {
        $oldId = Get-GuiEmbeddedCardId -Path $lane.ReportPath -Fallback 'unknown-report'
        $name = '{0}_{1}_{2}.md' -f (Get-GuiSafeArchiveToken $oldId), $archiveStamp, ([Guid]::NewGuid().ToString('N').Substring(0, 8))
        Move-Item -LiteralPath $lane.ReportPath -Destination (Join-Path $reportArchiveDirectory $name)
    }

    Write-GuiTextAtomically -Path $lane.CardPath -Text $check.Payload
    $state = [ordered]@{
        schema = 'tegaki.handoff/manga/v1'
        channel = 'MANGA'
        card_id = $check.Fields['CARD_ID']
        target = 'GEMINI'
        base_sha = $check.Fields['BASE_SHA']
        status = 'READY'
        card_path = $lane.CardRelativePath
        report_path = $lane.ReportRelativePath
        updated_at = [DateTime]::UtcNow.ToString('o')
    }
    Write-GuiTextAtomically -Path $lane.StatePath -Text (($state | ConvertTo-Json -Depth 5) + [Environment]::NewLine)
    return [pscustomobject]@{ CardId = $check.Fields['CARD_ID']; Status = 'READY'; Path = $lane.CardRelativePath }
}

function Get-GuiClipboardText {
    try {
        $text = Get-Clipboard -Raw -ErrorAction Stop
        if ($null -ne $text -and -not [string]::IsNullOrWhiteSpace([string]$text)) { return [string]$text }
    }
    catch { }
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    if ([System.Windows.Forms.Clipboard]::ContainsText()) { return [System.Windows.Forms.Clipboard]::GetText() }
    throw 'Clipboard does not contain text.'
}

function Set-GuiClipboardText {
    param([Parameter(Mandatory = $true)][string]$Text)
    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Set-Clipboard -Value $Text -ErrorAction Stop
            return
        }
        catch {
            $lastError = $_.Exception.Message
            if ($attempt -lt 3) { Start-Sleep -Milliseconds (100 * $attempt) }
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
                if ($attempt -lt 3) { Start-Sleep -Milliseconds (100 * $attempt) }
            }
        }
    }
    catch { $lastError = $_.Exception.Message }
    throw "Unable to write text to the Windows clipboard. Last error: $lastError"
}

function Assert-GuiReport {
    param(
        [Parameter(Mandatory = $true)][string]$ReportText,
        [Parameter(Mandatory = $true)][string]$ExpectedCardId
    )
    $envelope = Get-GuiEnvelopeFields -Text $ReportText -Kind Report
    if (@('PASS', 'PASS WITH LIMIT', 'BLOCKED', 'FAILED') -notcontains $envelope.Fields['RESULT']) {
        throw 'Report RESULT must be PASS, PASS WITH LIMIT, BLOCKED, or FAILED.'
    }
    if ($envelope.Fields['CARD_ID'] -cne $ExpectedCardId) {
        throw "Report CARD_ID mismatch. Expected $ExpectedCardId; received $($envelope.Fields['CARD_ID'])."
    }
    return $envelope.Fields
}

function Get-GuiReportCandidate {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    $definition = Get-GuiLaneDefinition -Lane $Lane -RepoRoot $RepoRoot
    if (-not (Test-Path -LiteralPath $definition.ReportPath -PathType Leaf)) {
        return [pscustomobject]@{
            Exists = $false
            Valid = $false
            Readiness = '結果なし'
            CardId = ''
            Digest = ''
            ReportText = ''
            Error = ''
            ReportPath = $definition.ReportRelativePath
        }
    }

    $reportText = [IO.File]::ReadAllText($definition.ReportPath)
    try {
        $fields = Assert-GuiReport -ReportText $reportText -ExpectedCardId ([string](Get-GuiEmbeddedCardId -Path $definition.ReportPath -Fallback ''))
        $cardId = [string]$fields['CARD_ID']
        $digest = Get-GuiReportDigest -ReportText $reportText
        return [pscustomobject]@{
            Exists = $true
            Valid = $true
            Readiness = '新しい結果あり'
            CardId = $cardId
            Digest = $digest
            ReportText = $reportText
            Error = ''
            ReportPath = $definition.ReportRelativePath
        }
    }
    catch {
        return [pscustomobject]@{
            Exists = $true
            Valid = $false
            Readiness = '報告ファイル不正'
            CardId = ''
            Digest = ''
            ReportText = $reportText
            Error = $_.Exception.Message
            ReportPath = $definition.ReportRelativePath
        }
    }
}

function Get-GuiLaneSnapshot {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$LastReturnedDigest = ''
    )
    $definition = Get-GuiLaneDefinition -Lane $Lane -RepoRoot $RepoRoot
    $head = Get-GuiCurrentHead $RepoRoot
    $state = $null
    if (Test-Path -LiteralPath $definition.StatePath -PathType Leaf) {
        try { $state = [IO.File]::ReadAllText($definition.StatePath) | ConvertFrom-Json } catch { $state = $null }
    }
    $report = Get-GuiReportCandidate -Lane $Lane -RepoRoot $RepoRoot
    $readiness = $report.Readiness
    if ($report.Valid -and -not [string]::IsNullOrWhiteSpace($LastReturnedDigest) -and $report.Digest -ceq $LastReturnedDigest) {
        $readiness = '返却済み'
    }
    $cardId = if ($report.Valid) { $report.CardId } else { '' }
    $status = if ($state) { [string]$state.status } else { '' }
    $baseSha = if ($state) { [string]$state.base_sha } else { '' }
    $reportPresent = $report.Exists
    $headMatch = (-not [string]::IsNullOrWhiteSpace($baseSha) -and $baseSha -ceq $head)
    return [pscustomobject]@{
        Lane = $Lane
        CardId = $cardId
        Status = $readiness
        LegacyStatus = $status
        BaseSha = $baseSha
        BaseShaShort = if ($baseSha.Length -ge 8) { $baseSha.Substring(0, 8) } else { $baseSha }
        Head = $head
        HeadMatchesBase = $headMatch
        ReportPresent = $reportPresent
        ReportValid = $report.Valid
        ReportDigest = $report.Digest
        ReportError = $report.Error
        ReturnEnabled = ($readiness -eq '新しい結果あり')
        CardPath = $definition.CardRelativePath
        ReportPath = $definition.ReportRelativePath
    }
}

function Get-GuiRoutePrefix {
    param([Parameter(Mandatory = $true)][ValidateSet('H3_AGENT', 'H3_WEBGPT', 'MANGA_AGENT', 'MANGA_WEBGPT')][string]$Route)
    switch ($Route) {
        'H3_AGENT' { return '[H3 -> CODEX]' }
        'H3_WEBGPT' { return '[H3 -> WEBGPT]' }
        'MANGA_AGENT' { return '[MANGA -> GEMINI]' }
        'MANGA_WEBGPT' { return '[MANGA -> WEBGPT]' }
    }
}

function New-GuiRunTransferText {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )
    $route = if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' }
    $current = Get-GuiCurrentLaneCard -Lane $Lane -RepoRoot $RepoRoot
    if ($Lane -eq 'H3') {
        $lines = @(
            (Get-GuiRoutePrefix $route)
            ''
            'TEGAKI H3 handoffを読んで実行。'
            "Use only the current validated H3 Card: $($current.CardId)."
            'Do not infer work from earlier chat history.'
            'Do not execute Manga work.'
            'Do not push.'
            'Human send is required.'
        )
    }
    else {
        $lines = @(
            (Get-GuiRoutePrefix $route)
            ''
            'TEGAKI MANGA handoffを読んで実行。'
            "Use only the current validated MANGA Card: $($current.CardId)."
            'Do not infer or resume older Manga Cards from chat history.'
            'M3B_PRODUCTION_CLOSED remains authoritative unless the current Card explicitly changes scope.'
            'Do not execute H3 work.'
            'Do not push.'
            'Human send is required.'
        )
    }
    return ($lines -join "`r`n")
}

function New-GuiReturnTransferText {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$LastReturnedDigest
    )
    $definition = Get-GuiLaneDefinition -Lane $Lane -RepoRoot $RepoRoot
    $candidate = Get-GuiReportCandidate -Lane $Lane -RepoRoot $RepoRoot
    if (-not $candidate.Exists) { throw "$Lane latest Report not found." }
    if (-not $candidate.Valid) { throw "$Lane latest Report is invalid: $($candidate.Error)" }
    $effectiveLastDigest = $LastReturnedDigest
    if (-not $PSBoundParameters.ContainsKey('LastReturnedDigest')) {
        $effectiveLastDigest = Get-GuiLastReturnedDigest -Settings (Get-GuiSettings) -Lane $Lane
    }
    if (-not [string]::IsNullOrWhiteSpace($effectiveLastDigest) -and $candidate.Digest -ceq $effectiveLastDigest) {
        throw 'REPORT ALREADY RETURNED'
    }
    $reportText = $candidate.ReportText
    if ($Lane -eq 'H3') {
        $instruction = @(
            'H3 RETURN INSTRUCTION:'
            ''
            'Confirm current GitHub main / publication state when publication is expected.'
            'Independently audit actual GitHub diff, implementation, evidence, limitations, and scope.'
            'Do not accept the agent Report blindly.'
            'Do not resume or modify Manga work from this return.'
            'Issue another Card only when development progression requires one.'
            'Do not invent publication status.'
        ) -join "`r`n"
    }
    else {
        $instruction = @(
            'MANGA RETURN INSTRUCTION:'
            ''
            'Independently review the result against current GitHub/main and Manga SSOT/boundary.'
            'Do not resume unrelated historical Manga Cards.'
            'Do not modify H3 work from this return.'
            'Keep Manga product implementation HOLD unless explicitly authorized.'
            'Issue the next Manga Card only when explicitly appropriate.'
        ) -join "`r`n"
    }
    return "$(Get-GuiRoutePrefix $definition.WebRoute)`r`n$reportText`r`n`r`n$instruction"
}

function Resolve-GuiTargetWindow {
    param(
        [Parameter(Mandatory = $true)][object[]]$Windows,
        [Parameter(Mandatory = $true)][string]$Token
    )
    if ([string]::IsNullOrWhiteSpace($Token)) {
        return [pscustomobject]@{ Status = 'TARGET TOKEN NOT CONFIGURED'; Matches = @() }
    }
    $matchesFound = @($Windows | Where-Object { [string]$_.Title -like "*$Token*" })
    if ($matchesFound.Count -eq 0) { return [pscustomobject]@{ Status = 'TARGET NOT FOUND'; Matches = @() } }
    if ($matchesFound.Count -gt 1) { return [pscustomobject]@{ Status = 'TARGET AMBIGUOUS'; Matches = $matchesFound } }
    return [pscustomobject]@{ Status = 'TARGET FOUND'; Matches = $matchesFound }
}

function Get-GuiDesktopWindows {
    $windows = @()
    foreach ($process in @(Get-Process)) {
        try {
            if ($process.MainWindowHandle -ne 0 -and -not [string]::IsNullOrWhiteSpace($process.MainWindowTitle)) {
                $windows += [pscustomobject]@{ Id = $process.Id; Title = $process.MainWindowTitle }
            }
        }
        catch { }
    }
    return $windows
}

function Invoke-GuiWindowPaste {
    param([Parameter(Mandatory = $true)]$Window)
    $shell = New-Object -ComObject WScript.Shell
    if (-not $shell.AppActivate([int]$Window.Id)) { throw 'TARGET ACTIVATION FAILED' }
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    return [string]$Window.Title
}

function Invoke-GuiFocusPaste {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$TargetToken
    )
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $resolution = Resolve-GuiTargetWindow -Windows (Get-GuiDesktopWindows) -Token $TargetToken
    if ($resolution.Status -ne 'TARGET FOUND') { throw $resolution.Status }
    Set-GuiClipboardText -Text $Text
    return Invoke-GuiWindowPaste -Window $resolution.Matches[0]
}
