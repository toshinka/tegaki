[CmdletBinding()]
param(
    [string]$RepoRoot,
    [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'handoff_gui_core.ps1')

function New-GuiSize {
    param([int]$Width, [int]$Height)
    return New-Object System.Drawing.Size($Width, $Height)
}

function New-GuiPoint {
    param([int]$X, [int]$Y)
    return New-Object System.Drawing.Point($X, $Y)
}

function New-GuiLabel {
    param(
        [string]$Text,
        [int]$Width = 110,
        [int]$Height = 24,
        [switch]$Bold
    )
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.AutoSize = $false
    $label.Size = New-GuiSize $Width $Height
    $label.Margin = New-Object System.Windows.Forms.Padding(3, 4, 3, 2)
    if ($Bold) { $label.Font = New-Object System.Drawing.Font($label.Font, [System.Drawing.FontStyle]::Bold) }
    return $label
}

function New-GuiButton {
    param([string]$Text, [int]$Width = 160, [int]$Height = 34)
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Size = New-GuiSize $Width $Height
    $button.Margin = New-Object System.Windows.Forms.Padding(3, 4, 3, 4)
    $button.UseVisualStyleBackColor = $true
    return $button
}

function Show-GuiTargetSettingsDialog {
    param(
        [Parameter(Mandatory = $true)]$Owner,
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][scriptblock]$SaveSettings
    )

    $dialog = New-Object System.Windows.Forms.Form
    $dialog.Text = '接続先設定'
    $dialog.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $dialog.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterParent
    $dialog.MinimizeBox = $false
    $dialog.MaximizeBox = $false
    $dialog.ShowInTaskbar = $false
    $dialog.ClientSize = New-GuiSize 420 180
    $dialog.Padding = New-Object System.Windows.Forms.Padding(10)

    $note = New-GuiLabel '返却先WebGPTウィンドウのタイトル一部を指定してください。' 390 30
    $note.ForeColor = [System.Drawing.Color]::DimGray
    $dialog.Controls.Add($note)
    $grid = New-Object System.Windows.Forms.TableLayoutPanel
    $grid.Location = New-GuiPoint 10 38
    $grid.Size = New-GuiSize 390 72
    $grid.ColumnCount = 2
    $grid.RowCount = 2
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 155)))
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    for ($row = 0; $row -lt 2; $row++) { [void]$grid.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 32))) }
    $routes = @(
        [pscustomobject]@{ Key = 'H3_WEBGPT'; Label = 'H3 WebGPTウィンドウ' }
        [pscustomobject]@{ Key = 'MANGA_WEBGPT'; Label = 'Manga WebGPTウィンドウ' }
    )
    $fields = @{}
    for ($row = 0; $row -lt $routes.Count; $row++) {
        $route = $routes[$row]
        $grid.Controls.Add((New-GuiLabel $route.Label 150 25), 0, $row)
        $field = New-Object System.Windows.Forms.TextBox
        $field.Size = New-GuiSize 225 25
        $field.Text = [string]$Settings.target_tokens[$route.Key]
        $fields[$route.Key] = $field
        $grid.Controls.Add($field, 1, $row)
    }
    $dialog.Controls.Add($grid)

    $ok = New-GuiButton '保存' 90 30
    $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $ok.Location = New-GuiPoint 205 130
    $cancel = New-GuiButton 'キャンセル' 100 30
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $cancel.Location = New-GuiPoint 300 130
    $dialog.Controls.Add($ok)
    $dialog.Controls.Add($cancel)
    $dialog.AcceptButton = $ok
    $dialog.CancelButton = $cancel

    if ($dialog.ShowDialog($Owner) -eq [System.Windows.Forms.DialogResult]::OK) {
        foreach ($route in $routes) { $Settings.target_tokens[$route.Key] = $fields[$route.Key].Text }
        & $SaveSettings
        return $true
    }
    return $false
}

try {
    $settings = Get-GuiSettings
    $candidateRoot = if (-not [string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot } elseif (-not [string]::IsNullOrWhiteSpace([string]$settings.repo_root)) { [string]$settings.repo_root } else { $null }
    try { $resolvedRepoRoot = Resolve-GuiRepositoryRoot -RequestedRoot $candidateRoot }
    catch { $resolvedRepoRoot = Resolve-GuiRepositoryRoot }
}
catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'TEGAKI Handoff', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 1
}

$guiState = [pscustomobject]@{ RepoRoot = $resolvedRepoRoot }

function Get-GuiUsableRepoRoot {
    param([Parameter(Mandatory = $true)]$GuiState)
    $candidate = [string]$GuiState.RepoRoot
    if ([string]::IsNullOrWhiteSpace($candidate)) { throw '現在のリポジトリが未設定です。' }
    $validated = Resolve-GuiRepositoryRoot -RequestedRoot $candidate
    if ([string]::IsNullOrWhiteSpace($validated)) { throw '現在のリポジトリが未設定です。' }
    return $validated
}

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'TEGAKI Handoff'
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::SizableToolWindow
$form.MinimizeBox = $true
$form.MaximizeBox = $false
$form.ShowInTaskbar = $true
$form.TopMost = [bool]$settings.always_on_top
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.ClientSize = New-GuiSize 520 460
$form.MinimumSize = New-GuiSize 520 430
$form.BackColor = [System.Drawing.Color]::WhiteSmoke
$form.Padding = New-Object System.Windows.Forms.Padding(8)

$screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$initialX = [int]$settings.window_x
$initialY = [int]$settings.window_y
if ($initialX -lt $screenBounds.Left -or $initialX -gt ($screenBounds.Right - 120)) { $initialX = $screenBounds.Left + 40 }
if ($initialY -lt $screenBounds.Top -or $initialY -gt ($screenBounds.Bottom - 120)) { $initialY = $screenBounds.Top + 40 }
$form.Location = New-GuiPoint $initialX $initialY

$outer = New-Object System.Windows.Forms.FlowLayoutPanel
$outer.Dock = [System.Windows.Forms.DockStyle]::Fill
$outer.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
$outer.WrapContents = $false
$outer.AutoScroll = $true
$outer.Padding = New-Object System.Windows.Forms.Padding(2)
$outer.BackColor = [System.Drawing.Color]::WhiteSmoke
[void]$form.Controls.Add($outer)

$title = New-GuiLabel 'TEGAKI Handoff — 結果返却パレット' 490 28 -Bold
$title.Font = New-Object System.Drawing.Font($title.Font.FontFamily, 10, [System.Drawing.FontStyle]::Bold)
[void]$outer.Controls.Add($title)

$rootPanel = New-Object System.Windows.Forms.Panel
$rootPanel.Size = New-GuiSize 490 42
$rootLabel = New-GuiLabel 'リポジトリ' 78 27 -Bold
$rootLabel.Location = New-GuiPoint 0 4
[void]$rootPanel.Controls.Add($rootLabel)
$rootText = New-Object System.Windows.Forms.TextBox
$rootText.ReadOnly = $true
$rootText.Size = New-GuiSize 325 27
$rootText.Location = New-GuiPoint 82 3
$rootText.Text = $guiState.RepoRoot
[void]$rootPanel.Controls.Add($rootText)
$changeRootButton = New-GuiButton '変更...' 78 27
$changeRootButton.Location = New-GuiPoint 407 3
[void]$rootPanel.Controls.Add($changeRootButton)
[void]$outer.Controls.Add($rootPanel)

$optionsPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$optionsPanel.Size = New-GuiSize 490 34
$optionsPanel.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
$optionsPanel.WrapContents = $false
$alwaysOnTop = New-Object System.Windows.Forms.CheckBox
$alwaysOnTop.Text = '常に手前に表示'
$alwaysOnTop.AutoSize = $true
$alwaysOnTop.Checked = [bool]$settings.always_on_top
$alwaysOnTop.Margin = New-Object System.Windows.Forms.Padding(3, 5, 12, 3)
[void]$optionsPanel.Controls.Add($alwaysOnTop)
$settingsButton = New-GuiButton '接続先設定...' 110 27
[void]$optionsPanel.Controls.Add($settingsButton)
$refreshButton = New-GuiButton '状態を更新' 100 27
[void]$optionsPanel.Controls.Add($refreshButton)
$safetyLabel = New-GuiLabel '監視なし ・ 自動送信なし ・ Pushなし' 200 27
$safetyLabel.ForeColor = [System.Drawing.Color]::DimGray
[void]$optionsPanel.Controls.Add($safetyLabel)
[void]$outer.Controls.Add($optionsPanel)

$statusLabel = New-GuiLabel '準備完了' 490 30
$statusLabel.BorderStyle = [System.Windows.Forms.BorderStyle]::Fixed3D
$statusLabel.BackColor = [System.Drawing.Color]::White
$statusLabel.ForeColor = [System.Drawing.Color]::DarkSlateGray
[void]$outer.Controls.Add($statusLabel)

$laneControls = @{}
$setStatus = {
    param([string]$Message)
    $statusLabel.Text = "$(Get-Date -Format 'HH:mm:ss')  $Message"
}.GetNewClosure()

$saveCurrentSettings = {
    $settings.repo_root = $guiState.RepoRoot
    $settings.always_on_top = [bool]$alwaysOnTop.Checked
    $settings.window_x = [int]$form.Location.X
    $settings.window_y = [int]$form.Location.Y
    Save-GuiSettings -Settings $settings
}.GetNewClosure()

$trackingDigestOverride = $null
if ($SmokeTest -and $PSBoundParameters.ContainsKey('SmokeLastReturnedDigest')) { $trackingDigestOverride = $SmokeLastReturnedDigest }

function Set-GuiLaneControlsFromSnapshot {
    param(
        [Parameter(Mandatory = $true)]$Controls,
        [Parameter(Mandatory = $true)]$Snapshot
    )
    $Controls.State.Text = [string]$Snapshot.Status
    $Controls.Card.Text = if ([string]::IsNullOrWhiteSpace([string]$Snapshot.CardId)) { '—' } else { [string]$Snapshot.CardId }
    $Controls.Return.Enabled = [bool]$Snapshot.ReturnEnabled
    $Controls.State.ForeColor = if ($Snapshot.Status -eq '報告ファイル不正') { [System.Drawing.Color]::Firebrick } else { [System.Drawing.SystemColors]::ControlText }
}

$refreshAll = {
    foreach ($lane in @('H3', 'MANGA')) {
        $controls = $laneControls[$lane]
        try {
            $lastDigest = if ($null -ne $trackingDigestOverride) { $trackingDigestOverride } else { Get-GuiLastReturnedDigest -Settings $settings -Lane $lane }
            $snapshot = Get-GuiLaneSnapshot -Lane $lane -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState) -LastReturnedDigest $lastDigest
            Set-GuiLaneControlsFromSnapshot -Controls $controls -Snapshot $snapshot
        }
        catch {
            $controls.State.Text = '報告ファイル不正'
            $controls.Card.Text = '—'
            $controls.Return.Enabled = $false
            $controls.State.ForeColor = [System.Drawing.Color]::Firebrick
        }
    }
    $rootText.Text = $guiState.RepoRoot
}.GetNewClosure()

function New-GuiLaneGroup {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][System.Drawing.Color]$BackColor,
        [Parameter(Mandatory = $true)][string]$ReturnButtonText
    )

    $group = New-Object System.Windows.Forms.GroupBox
    $group.Text = $Title
    $group.Size = New-GuiSize 490 118
    $group.Margin = New-Object System.Windows.Forms.Padding(3, 5, 3, 5)
    $group.Padding = New-Object System.Windows.Forms.Padding(8)
    $group.BackColor = $BackColor

    $latestLabel = New-GuiLabel '最新結果' 92 24 -Bold
    $latestLabel.Location = New-GuiPoint 10 23
    $stateValueLabel = New-GuiLabel '結果なし' 360 24
    $stateValueLabel.Location = New-GuiPoint 108 23
    $cardLabel = New-GuiLabel 'Card' 92 24
    $cardLabel.Location = New-GuiPoint 10 49
    $cardValueLabel = New-GuiLabel '—' 360 24
    $cardValueLabel.Location = New-GuiPoint 108 49
    [void]$group.Controls.Add($latestLabel)
    [void]$group.Controls.Add($stateValueLabel)
    [void]$group.Controls.Add($cardLabel)
    [void]$group.Controls.Add($cardValueLabel)

    $returnButton = New-GuiButton $ReturnButtonText 340 34
    $returnButton.Location = New-GuiPoint 108 76
    [void]$group.Controls.Add($returnButton)

    foreach ($control in @($stateValueLabel, $cardValueLabel)) {
        if ($control -isnot [System.Windows.Forms.Label]) { throw 'Lane result control invariant failed.' }
    }
    if ($returnButton -isnot [System.Windows.Forms.Button]) { throw 'Lane return control invariant failed.' }
    $registry = [pscustomobject]@{ Group = $group; State = $stateValueLabel; Card = $cardValueLabel; Return = $returnButton }
    $script:laneControls[$Lane] = $registry

    $returnButton.Add_Click(({
        try {
            $usableRoot = Get-GuiUsableRepoRoot -GuiState $guiState
            $candidate = Get-GuiReportCandidate -Lane $Lane -RepoRoot $usableRoot
            $lastDigest = Get-GuiLastReturnedDigest -Settings $settings -Lane $Lane
            $text = New-GuiReturnTransferText -Lane $Lane -RepoRoot $usableRoot -LastReturnedDigest $lastDigest
            $route = if ($Lane -eq 'H3') { 'H3_WEBGPT' } else { 'MANGA_WEBGPT' }
            $transfer = Invoke-GuiReturnTransfer -Text $text -Route (Get-GuiRoutePrefix $route) -TargetToken ([string]$settings.target_tokens[$route]) -SetStatus $setStatus
            if ($transfer.PayloadReady) {
                Set-GuiLastReturnedReport -Settings $settings -Lane $Lane -Digest $candidate.Digest -CardId $candidate.CardId
                & $saveCurrentSettings
                & $refreshAll
            }
        }
        catch {
            if ($_.Exception.Message -eq 'REPORT ALREADY RETURNED') {
                & $setStatus '新しい結果はまだありません。この結果は返却済みです。'
            }
            else {
                & $setStatus "返却を準備できません: $($_.Exception.Message)"
            }
        }
    }.GetNewClosure()))

    return $group
}

$h3Group = New-GuiLaneGroup -Lane H3 -Title 'H3 / CODEX' -BackColor ([System.Drawing.Color]::AliceBlue) -ReturnButtonText '結果をH3 WebGPTへ戻す'
$mangaGroup = New-GuiLaneGroup -Lane MANGA -Title 'MANGA / GEMINI' -BackColor ([System.Drawing.Color]::Honeydew) -ReturnButtonText '結果をManga WebGPTへ戻す'
[void]$outer.Controls.Add([System.Windows.Forms.Control]$h3Group)
[void]$outer.Controls.Add([System.Windows.Forms.Control]$mangaGroup)

$settingsButton.Add_Click(({
    try {
        if (Show-GuiTargetSettingsDialog -Owner $form -Settings $settings -SaveSettings $saveCurrentSettings) { & $setStatus '接続先設定を保存しました。' }
    }
    catch { & $setStatus "接続先設定を保存できません: $($_.Exception.Message)" }
}.GetNewClosure()))

$refreshButton.Add_Click(({
    try { & $refreshAll; & $setStatus '状態を更新しました。' } catch { & $setStatus "更新できません: $($_.Exception.Message)" }
}.GetNewClosure()))

$alwaysOnTop.Add_CheckedChanged(({
    $form.TopMost = [bool]$alwaysOnTop.Checked
    & $saveCurrentSettings
    & $setStatus (if ($alwaysOnTop.Checked) { '常に手前に表示: ON' } else { '常に手前に表示: OFF' })
}.GetNewClosure()))

$changeRootButton.Add_Click(({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Gitリポジトリのルートを選択'
    $dialog.SelectedPath = $guiState.RepoRoot
    if ($dialog.ShowDialog($form) -ne [System.Windows.Forms.DialogResult]::OK) { $dialog.Dispose(); return }
    try {
        $guiState.RepoRoot = Resolve-GuiRepositoryRoot -RequestedRoot $dialog.SelectedPath
        & $saveCurrentSettings
        & $refreshAll
        & $setStatus "リポジトリを変更しました: $($guiState.RepoRoot)"
    }
    catch { & $setStatus "リポジトリを変更できません: $($_.Exception.Message)" }
}.GetNewClosure()))

$form.Add_Move(({
    if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Normal) { & $saveCurrentSettings }
}.GetNewClosure()))
$form.Add_FormClosing(({
    & $saveCurrentSettings
}.GetNewClosure()))
$form.Add_Shown(({
    & $refreshAll
    & $setStatus '準備完了 — 新しい結果があるときだけ返却できます。'
}.GetNewClosure()))

if ($SmokeTest) {
    $usableRoot = Get-GuiUsableRepoRoot -GuiState $guiState
    & $refreshAll
    foreach ($lane in @('H3', 'MANGA')) {
        $controls = $laneControls[$lane]
        foreach ($valueControl in @($controls.State, $controls.Card)) {
            if ($valueControl -isnot [System.Windows.Forms.Label]) { throw "WinForms smoke: $lane result control is not a Label." }
            if ($null -eq $valueControl.Text) { throw "WinForms smoke: $lane result control has no Text." }
        }
        if ($controls.Return -isnot [System.Windows.Forms.Button]) { throw "WinForms smoke: $lane return control is not a Button." }
        if ([string]::IsNullOrWhiteSpace($controls.Return.Text)) { throw "WinForms smoke: $lane return button has empty text." }
        if ($controls.PSObject.Properties['Stage'] -or $controls.PSObject.Properties['Run']) { throw "WinForms smoke: $lane has a forward action." }
    }
    $noResult = [pscustomobject]@{ Status = '結果なし'; CardId = ''; ReturnEnabled = $false }
    $newResult = [pscustomobject]@{ Status = '新しい結果あり'; CardId = 'SMOKE-NEW'; ReturnEnabled = $true }
    $returnedResult = [pscustomobject]@{ Status = '返却済み'; CardId = 'SMOKE-RETURNED'; ReturnEnabled = $false }
    Set-GuiLaneControlsFromSnapshot -Controls $laneControls.H3 -Snapshot $noResult
    if ($laneControls.H3.Return.Enabled) { throw 'WinForms smoke: no-result return button enabled.' }
    Set-GuiLaneControlsFromSnapshot -Controls $laneControls.H3 -Snapshot $newResult
    if (-not $laneControls.H3.Return.Enabled) { throw 'WinForms smoke: new-result return button disabled.' }
    Set-GuiLaneControlsFromSnapshot -Controls $laneControls.H3 -Snapshot $returnedResult
    if ($laneControls.H3.Return.Enabled) { throw 'WinForms smoke: returned-result return button enabled.' }
    & $refreshAll
    $null = New-GuiReturnTransferText -Lane H3 -RepoRoot $usableRoot -LastReturnedDigest $trackingDigestOverride
    $null = New-GuiReturnTransferText -Lane MANGA -RepoRoot $usableRoot -LastReturnedDigest $trackingDigestOverride
    Write-Output 'WINFORMS_RETURN_ONLY_SMOKE PASS'
    $form.Dispose()
    exit 0
}

[System.Windows.Forms.Application]::Run($form)
