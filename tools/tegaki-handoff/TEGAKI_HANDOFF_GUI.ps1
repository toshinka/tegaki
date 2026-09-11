[CmdletBinding()]
param(
    [string]$RepoRoot
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
    param([string]$Text, [int]$Width = 150, [int]$Height = 30)
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Size = New-GuiSize $Width $Height
    $button.Margin = New-Object System.Windows.Forms.Padding(3, 3, 3, 3)
    $button.UseVisualStyleBackColor = $true
    return $button
}

try {
    $settings = Get-GuiSettings
    $candidateRoot = if (-not [string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot } elseif (-not [string]::IsNullOrWhiteSpace([string]$settings.repo_root)) { [string]$settings.repo_root } else { $null }
    try {
        $script:repoRoot = Resolve-GuiRepositoryRoot -RequestedRoot $candidateRoot
    }
    catch {
        $script:repoRoot = Resolve-GuiRepositoryRoot
    }
}
catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'TEGAKI Handoff GUI', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 1
}

[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'TEGAKI Handoff GUI — H3 / Manga'
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::SizableToolWindow
$form.MinimizeBox = $true
$form.MaximizeBox = $false
$form.ShowInTaskbar = $true
$form.TopMost = [bool]$settings.always_on_top
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.ClientSize = New-GuiSize 570 790
$form.MinimumSize = New-GuiSize 570 650
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
$form.Controls.Add($outer)

$title = New-GuiLabel 'TEGAKI local handoff — explicit clipboard actions only' 530 28 -Bold
$title.Font = New-Object System.Drawing.Font($title.Font.FontFamily, 10, [System.Drawing.FontStyle]::Bold)
$outer.Controls.Add($title)

$rootPanel = New-Object System.Windows.Forms.Panel
$rootPanel.Size = New-GuiSize 535 42
$rootLabel = New-GuiLabel 'Repository' 78 27 -Bold
$rootLabel.Location = New-GuiPoint 0 4
$rootPanel.Controls.Add($rootLabel)
$rootText = New-Object System.Windows.Forms.TextBox
$rootText.ReadOnly = $true
$rootText.Size = New-GuiSize 360 27
$rootText.Location = New-GuiPoint 82 3
$rootText.Text = $script:repoRoot
$rootPanel.Controls.Add($rootText)
$changeRootButton = New-GuiButton 'Change…' 82 27
$changeRootButton.Location = New-GuiPoint 447 3
$rootPanel.Controls.Add($changeRootButton)
$outer.Controls.Add($rootPanel)

$optionsPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$optionsPanel.Size = New-GuiSize 535 34
$optionsPanel.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
$optionsPanel.WrapContents = $false
$alwaysOnTop = New-Object System.Windows.Forms.CheckBox
$alwaysOnTop.Text = 'Always on top'
$alwaysOnTop.AutoSize = $true
$alwaysOnTop.Checked = [bool]$settings.always_on_top
$alwaysOnTop.Margin = New-Object System.Windows.Forms.Padding(3, 5, 14, 3)
$optionsPanel.Controls.Add($alwaysOnTop)
$refreshButton = New-GuiButton 'Refresh status' 120 27
$optionsPanel.Controls.Add($refreshButton)
$safetyLabel = New-GuiLabel 'No watcher  ·  No Enter  ·  No push' 250 27
$safetyLabel.ForeColor = [System.Drawing.Color]::DimGray
$optionsPanel.Controls.Add($safetyLabel)
$outer.Controls.Add($optionsPanel)

$statusLabel = New-GuiLabel 'Ready' 530 30
$statusLabel.BorderStyle = [System.Windows.Forms.BorderStyle]::Fixed3D
$statusLabel.BackColor = [System.Drawing.Color]::White
$statusLabel.ForeColor = [System.Drawing.Color]::DarkSlateGray
$outer.Controls.Add($statusLabel)

$laneControls = @{}
$setStatus = {
    param([string]$Message)
    $statusLabel.Text = "$(Get-Date -Format 'HH:mm:ss')  $Message"
}.GetNewClosure()

$saveCurrentSettings = {
    $settings.repo_root = $script:repoRoot
    $settings.always_on_top = [bool]$alwaysOnTop.Checked
    $settings.window_x = [int]$form.Location.X
    $settings.window_y = [int]$form.Location.Y
    Save-GuiSettings -Settings $settings
}.GetNewClosure()

$refreshAll = {
    foreach ($lane in @('H3', 'MANGA')) {
        try {
            $snapshot = Get-GuiLaneSnapshot -Lane $lane -RepoRoot $script:repoRoot
            $controls = $laneControls[$lane]
            $controls.State.Text = "$($snapshot.Status)  |  $($snapshot.CardPath)"
            $controls.Card.Text = if ([string]::IsNullOrWhiteSpace($snapshot.CardId)) { '—' } else { $snapshot.CardId }
            $headStatus = if ($snapshot.HeadMatchesBase) { 'HEAD MATCH' } elseif ([string]::IsNullOrWhiteSpace($snapshot.BaseSha)) { 'no BASE yet' } else { 'HEAD DRIFT' }
            $controls.Base.Text = "$($snapshot.BaseShaShort)  |  $headStatus"
            $controls.Report.Text = if ($snapshot.ReportPresent) { "PRESENT  |  $($snapshot.ReportPath)" } else { 'not present' }
        }
        catch {
            $laneControls[$lane].State.Text = "READ BLOCKED: $($_.Exception.Message)"
        }
    }
    $rootText.Text = $script:repoRoot
}.GetNewClosure()

function New-GuiLaneGroup {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][System.Drawing.Color]$BackColor,
        [Parameter(Mandatory = $true)][string]$AgentName,
        [Parameter(Mandatory = $true)][string]$WebName
    )

    $group = New-Object System.Windows.Forms.GroupBox
    $group.Text = $Title
    $group.Size = New-GuiSize 535 322
    $group.Margin = New-Object System.Windows.Forms.Padding(3, 5, 3, 5)
    $group.Padding = New-Object System.Windows.Forms.Padding(8)
    $group.BackColor = $BackColor

    $grid = New-Object System.Windows.Forms.TableLayoutPanel
    $grid.Location = New-GuiPoint 8 23
    $grid.Size = New-GuiSize 510 152
    $grid.ColumnCount = 2
    $grid.RowCount = 6
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 122)))
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    foreach ($height in @(24, 24, 24, 24, 24, 24)) { [void]$grid.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, $height))) }
    $group.Controls.Add($grid)

    $stateLabel = New-GuiLabel '—' 360 22
    $cardLabel = New-GuiLabel '—' 360 22
    $baseLabel = New-GuiLabel '—' 360 22
    $reportLabel = New-GuiLabel '—' 360 22
    $agentToken = New-Object System.Windows.Forms.TextBox
    $agentToken.Size = New-GuiSize 170 22
    $agentToken.Text = [string]$settings.target_tokens.$AgentName
    $webToken = New-Object System.Windows.Forms.TextBox
    $webToken.Size = New-GuiSize 170 22
    $webToken.Text = [string]$settings.target_tokens.$WebName

    $grid.Controls.Add((New-GuiLabel 'State' 115 22 -Bold), 0, 0)
    $grid.Controls.Add($stateLabel, 1, 0)
    $grid.Controls.Add((New-GuiLabel 'Card ID' 115 22), 0, 1)
    $grid.Controls.Add($cardLabel, 1, 1)
    $grid.Controls.Add((New-GuiLabel 'BASE / HEAD' 115 22), 0, 2)
    $grid.Controls.Add($baseLabel, 1, 2)
    $grid.Controls.Add((New-GuiLabel 'Latest Report' 115 22), 0, 3)
    $grid.Controls.Add($reportLabel, 1, 3)
    $grid.Controls.Add((New-GuiLabel "$AgentName token" 115 22), 0, 4)
    $grid.Controls.Add($agentToken, 1, 4)
    $grid.Controls.Add((New-GuiLabel "$WebName token" 115 22), 0, 5)
    $grid.Controls.Add($webToken, 1, 5)

    $hint = New-GuiLabel "Clipboard route: $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' })))  →  $AgentName" 510 25
    $hint.Location = New-GuiPoint 10 180
    $hint.ForeColor = [System.Drawing.Color]::DimGray
    $group.Controls.Add($hint)

    $buttons = New-Object System.Windows.Forms.FlowLayoutPanel
    $buttons.Location = New-GuiPoint 8 207
    $buttons.Size = New-GuiSize 510 98
    $buttons.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
    $buttons.WrapContents = $true
    $buttons.AutoScroll = $false
    $group.Controls.Add($buttons)

    $stage = New-GuiButton "Stage $Lane Card" 145 30
    $run = New-GuiButton "Paste Run → $AgentName" 165 30
    $copyReport = New-GuiButton "Copy $Lane Report" 145 30
    $pasteReturn = New-GuiButton "Paste Return → $WebName" 165 30
    $focusRun = New-GuiButton 'Focus + paste Run' 145 30
    $focusReturn = New-GuiButton 'Focus + paste Return' 165 30
    foreach ($button in @($stage, $run, $copyReport, $pasteReturn, $focusRun, $focusReturn)) { $buttons.Controls.Add($button) }

    $registry = [pscustomobject]@{
        Group = $group
        State = $stateLabel
        Card = $cardLabel
        Base = $baseLabel
        Report = $reportLabel
        AgentToken = $agentToken
        WebToken = $webToken
        Stage = $stage
        Run = $run
        CopyReport = $copyReport
        PasteReturn = $pasteReturn
        FocusRun = $focusRun
        FocusReturn = $focusReturn
    }
    $script:laneControls[$Lane] = $registry

    $agentToken.Add_TextChanged(({
        $settings.target_tokens.$AgentName = $agentToken.Text
        & $saveCurrentSettings
    }.GetNewClosure()))
    $webToken.Add_TextChanged(({
        $settings.target_tokens.$WebName = $webToken.Text
        & $saveCurrentSettings
    }.GetNewClosure()))

    $stage.Add_Click(({
        try {
            $cardText = Get-GuiClipboardText
            if ($Lane -eq 'H3') {
                $stageScript = Join-Path $PSScriptRoot 'stage_card_from_clipboard.ps1'
                $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File $stageScript -RepoRoot $script:repoRoot -FriendlyErrors 2>&1 | Out-String
                if ($LASTEXITCODE -ne 0) { throw $output.Trim() }
                & $setStatus "H3 staged by existing V0.1 helper"
            }
            else {
                $result = Stage-GuiMangaCard -RepoRoot $script:repoRoot -CardText $cardText
                & $setStatus "MANGA staged: $($result.CardId)"
            }
            & $refreshAll
        }
        catch { & $setStatus "STAGE REJECTED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $run.Add_Click(({
        try {
            $text = New-GuiRunTransferText -Lane $Lane
            Set-GuiClipboardText $text
            & $setStatus "COPIED $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' }))) — paste manually"
        }
        catch { & $setStatus "COPY FAILED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $copyReport.Add_Click(({
        try {
            $text = New-GuiReturnTransferText -Lane $Lane -RepoRoot $script:repoRoot
            Set-GuiClipboardText $text
            & $setStatus "COPIED $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_WEBGPT' } else { 'MANGA_WEBGPT' }))) — paste manually"
        }
        catch { & $setStatus "REPORT COPY REJECTED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $pasteReturn.Add_Click(({
        try {
            $text = New-GuiReturnTransferText -Lane $Lane -RepoRoot $script:repoRoot
            Set-GuiClipboardText $text
            & $setStatus "COPIED $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_WEBGPT' } else { 'MANGA_WEBGPT' }))) — no auto-send"
        }
        catch { & $setStatus "RETURN PREP REJECTED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $focusRun.Add_Click(({
        try {
            $text = New-GuiRunTransferText -Lane $Lane
            $token = if ($Lane -eq 'H3') { $agentToken.Text } else { $agentToken.Text }
            $windowTitle = Invoke-GuiFocusPaste -Text $text -TargetToken $token
            & $setStatus "PASTED $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' }))) into $windowTitle"
        }
        catch { & $setStatus "FOCUS + PASTE BLOCKED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $focusReturn.Add_Click(({
        try {
            $text = New-GuiReturnTransferText -Lane $Lane -RepoRoot $script:repoRoot
            $token = $webToken.Text
            $windowTitle = Invoke-GuiFocusPaste -Text $text -TargetToken $token
            & $setStatus "PASTED $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_WEBGPT' } else { 'MANGA_WEBGPT' }))) into $windowTitle"
        }
        catch { & $setStatus "FOCUS + PASTE BLOCKED: $($_.Exception.Message)" }
    }.GetNewClosure()))

    return $group
}

$h3Group = New-GuiLaneGroup -Lane H3 -Title 'H3 / CODEX  —  H3 Video lane' -BackColor ([System.Drawing.Color]::AliceBlue) -AgentName 'H3_AGENT' -WebName 'H3_WEBGPT'
$mangaGroup = New-GuiLaneGroup -Lane MANGA -Title 'MANGA / GEMINI  —  Manga lane' -BackColor ([System.Drawing.Color]::Honeydew) -AgentName 'MANGA_AGENT' -WebName 'MANGA_WEBGPT'
[void]$outer.Controls.Add([System.Windows.Forms.Control]$h3Group)
[void]$outer.Controls.Add([System.Windows.Forms.Control]$mangaGroup)

$refreshButton.Add_Click(({
    try { & $refreshAll; & $setStatus 'Status refreshed' } catch { & $setStatus "REFRESH FAILED: $($_.Exception.Message)" }
}.GetNewClosure()))

$alwaysOnTop.Add_CheckedChanged(({
    $form.TopMost = [bool]$alwaysOnTop.Checked
    & $saveCurrentSettings
    & $setStatus (if ($alwaysOnTop.Checked) { 'Always on top: ON' } else { 'Always on top: OFF' })
}.GetNewClosure()))

$changeRootButton.Add_Click(({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Select the Tegaki Git repository root'
    $dialog.SelectedPath = $script:repoRoot
    if ($dialog.ShowDialog($form) -ne [System.Windows.Forms.DialogResult]::OK) { return }
    try {
        $script:repoRoot = Resolve-GuiRepositoryRoot -RequestedRoot $dialog.SelectedPath
        & $saveCurrentSettings
        & $refreshAll
        & $setStatus "Repository changed: $script:repoRoot"
    }
    catch { & $setStatus "ROOT REJECTED: $($_.Exception.Message)" }
}.GetNewClosure()))

$form.Add_Move(({
    if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Normal) { & $saveCurrentSettings }
}.GetNewClosure()))
$form.Add_FormClosing(({
    & $saveCurrentSettings
}.GetNewClosure()))
$form.Add_Shown(({
    & $refreshAll
    & $setStatus 'Ready — choose one explicit clipboard action'
}.GetNewClosure()))

[System.Windows.Forms.Application]::Run($form)
