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
    $dialog.ClientSize = New-GuiSize 420 245
    $dialog.Padding = New-Object System.Windows.Forms.Padding(10)

    $note = New-GuiLabel 'ウィンドウタイトルの一部だけを指定してください。' 390 30
    $note.ForeColor = [System.Drawing.Color]::DimGray
    $dialog.Controls.Add($note)
    $grid = New-Object System.Windows.Forms.TableLayoutPanel
    $grid.Location = New-GuiPoint 10 38
    $grid.Size = New-GuiSize 390 140
    $grid.ColumnCount = 2
    $grid.RowCount = 4
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 155)))
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    for ($row = 0; $row -lt 4; $row++) { [void]$grid.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 32))) }
    $routes = @(
        [pscustomobject]@{ Key = 'H3_AGENT'; Label = 'Codexウィンドウ' }
        [pscustomobject]@{ Key = 'H3_WEBGPT'; Label = 'H3 WebGPTウィンドウ' }
        [pscustomobject]@{ Key = 'MANGA_AGENT'; Label = 'Geminiウィンドウ' }
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
    $ok.Location = New-GuiPoint 205 195
    $cancel = New-GuiButton 'キャンセル' 100 30
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $cancel.Location = New-GuiPoint 300 195
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

function Get-GuiStatusText {
    param([Parameter(Mandatory = $true)]$Snapshot)
    $status = switch ($Snapshot.Status) {
        'PRESENT' { 'あり' }
        'UNINITIALIZED' { '未開始' }
        'READY' { '準備済み' }
        'REPORTED' { '報告済み' }
        default { $Snapshot.Status }
    }
    return $status
}

function Invoke-GuiRouteTransfer {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Route,
        [Parameter(Mandatory = $true)][string]$TargetToken,
        [Parameter(Mandatory = $true)][scriptblock]$SetStatus
    )
    try {
        Set-GuiClipboardText -Text $Text
        $resolution = Resolve-GuiTargetWindow -Windows (Get-GuiDesktopWindows) -Token $TargetToken
        if ($resolution.Status -eq 'TARGET NOT FOUND') {
            & $SetStatus '対象が見つかりません。クリップボードにコピーしました。'
            return
        }
        if ($resolution.Status -eq 'TARGET AMBIGUOUS') {
            & $SetStatus '対象を一意に判定できません。クリップボードにコピーしました。'
            return
        }
        try {
            $title = Invoke-GuiWindowPaste -Window $resolution.Matches[0]
            & $SetStatus "$Route を貼り付けました。送信はOwnerが手動で行います。"
        }
        catch {
            & $SetStatus "貼り付けを実行できません。クリップボードにコピーしました。($($_.Exception.Message))"
        }
    }
    catch { & $SetStatus "転送準備に失敗しました。$($_.Exception.Message)" }
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
$form.ClientSize = New-GuiSize 570 650
$form.MinimumSize = New-GuiSize 570 600
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

$title = New-GuiLabel 'TEGAKI Handoff — 明示操作のローカルパレット' 535 28 -Bold
$title.Font = New-Object System.Drawing.Font($title.Font.FontFamily, 10, [System.Drawing.FontStyle]::Bold)
[void]$outer.Controls.Add($title)

$rootPanel = New-Object System.Windows.Forms.Panel
$rootPanel.Size = New-GuiSize 535 42
$rootLabel = New-GuiLabel 'リポジトリ' 78 27 -Bold
$rootLabel.Location = New-GuiPoint 0 4
[void]$rootPanel.Controls.Add($rootLabel)
$rootText = New-Object System.Windows.Forms.TextBox
$rootText.ReadOnly = $true
$rootText.Size = New-GuiSize 360 27
$rootText.Location = New-GuiPoint 82 3
$rootText.Text = $guiState.RepoRoot
[void]$rootPanel.Controls.Add($rootText)
$changeRootButton = New-GuiButton '変更...' 82 27
$changeRootButton.Location = New-GuiPoint 447 3
[void]$rootPanel.Controls.Add($changeRootButton)
[void]$outer.Controls.Add($rootPanel)

$optionsPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$optionsPanel.Size = New-GuiSize 535 34
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
$safetyLabel = New-GuiLabel '監視なし ・ 自動送信なし ・ Pushなし' 240 27
$safetyLabel.ForeColor = [System.Drawing.Color]::DimGray
[void]$optionsPanel.Controls.Add($safetyLabel)
[void]$outer.Controls.Add($optionsPanel)

$statusLabel = New-GuiLabel '準備完了' 535 30
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

$refreshAll = {
    foreach ($lane in @('H3', 'MANGA')) {
        try {
            $snapshot = Get-GuiLaneSnapshot -Lane $lane -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState)
            $controls = $laneControls[$lane]
            $controls.State.Text = "$(Get-GuiStatusText $snapshot)  |  $($snapshot.CardPath)"
            $controls.Card.Text = if ([string]::IsNullOrWhiteSpace($snapshot.CardId)) { '—' } else { $snapshot.CardId }
            $headStatus = if ($snapshot.HeadMatchesBase) { 'HEAD一致' } elseif ([string]::IsNullOrWhiteSpace($snapshot.BaseSha)) { 'BASEなし' } else { 'HEAD差異あり' }
            $controls.Base.Text = "$($snapshot.BaseShaShort)  |  $headStatus"
            $controls.Report.Text = if ($snapshot.ReportPresent) { "あり  |  $($snapshot.ReportPath)" } else { 'なし' }
        }
        catch { $laneControls[$lane].State.Text = "読み取り停止: $($_.Exception.Message)" }
    }
    $rootText.Text = $guiState.RepoRoot
}.GetNewClosure()

function New-GuiLaneGroup {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('H3', 'MANGA')][string]$Lane,
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][System.Drawing.Color]$BackColor,
        [Parameter(Mandatory = $true)][string]$RunButtonText,
        [Parameter(Mandatory = $true)][string]$ReturnButtonText
    )

    $group = New-Object System.Windows.Forms.GroupBox
    $group.Text = $Title
    $group.Size = New-GuiSize 535 222
    $group.Margin = New-Object System.Windows.Forms.Padding(3, 5, 3, 5)
    $group.Padding = New-Object System.Windows.Forms.Padding(8)
    $group.BackColor = $BackColor

    $grid = New-Object System.Windows.Forms.TableLayoutPanel
    $grid.Location = New-GuiPoint 8 23
    $grid.Size = New-GuiSize 510 100
    $grid.ColumnCount = 2
    $grid.RowCount = 4
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 122)))
    [void]$grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    for ($row = 0; $row -lt 4; $row++) { [void]$grid.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 24))) }
    [void]$group.Controls.Add($grid)

    $stateValueLabel = New-GuiLabel '—' 360 22
    $cardValueLabel = New-GuiLabel '—' 360 22
    $baseValueLabel = New-GuiLabel '—' 360 22
    $latestReportValueLabel = New-GuiLabel '—' 360 22
    [void]$grid.Controls.Add((New-GuiLabel '状態' 115 22 -Bold), 0, 0)
    [void]$grid.Controls.Add($stateValueLabel, 1, 0)
    [void]$grid.Controls.Add((New-GuiLabel 'カード' 115 22), 0, 1)
    [void]$grid.Controls.Add($cardValueLabel, 1, 1)
    [void]$grid.Controls.Add((New-GuiLabel 'BASE / HEAD' 115 22), 0, 2)
    [void]$grid.Controls.Add($baseValueLabel, 1, 2)
    [void]$grid.Controls.Add((New-GuiLabel '最新報告' 115 22), 0, 3)
    [void]$grid.Controls.Add($latestReportValueLabel, 1, 3)

    $hint = New-GuiLabel "明示操作のみ  |  $((Get-GuiRoutePrefix $(if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' })))" 510 24
    $hint.Location = New-GuiPoint 10 126
    $hint.ForeColor = [System.Drawing.Color]::DimGray
    [void]$group.Controls.Add($hint)

    $buttons = New-Object System.Windows.Forms.FlowLayoutPanel
    $buttons.Location = New-GuiPoint 8 153
    $buttons.Size = New-GuiSize 510 55
    $buttons.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
    $buttons.WrapContents = $false
    [void]$group.Controls.Add($buttons)

    $stage = New-GuiButton 'カードを取り込む' 160 34
    $run = New-GuiButton $RunButtonText 160 34
    $report = New-GuiButton $ReturnButtonText 160 34
    foreach ($button in @($stage, $run, $report)) { [void]$buttons.Controls.Add($button) }

    foreach ($control in @($stateValueLabel, $cardValueLabel, $baseValueLabel, $latestReportValueLabel)) {
        if ($control -isnot [System.Windows.Forms.Label]) { throw 'Lane value control invariant failed.' }
    }
    foreach ($control in @($stage, $run, $report)) {
        if ($control -isnot [System.Windows.Forms.Button]) { throw 'Lane action control invariant failed.' }
    }
    $registry = [pscustomobject]@{ Group = $group; State = $stateValueLabel; Card = $cardValueLabel; Base = $baseValueLabel; Report = $latestReportValueLabel; Stage = $stage; Run = $run; Return = $report }
    $script:laneControls[$Lane] = $registry

    $stage.Add_Click(({
        try {
            $cardText = Get-GuiClipboardText
            if ($Lane -eq 'H3') {
                $stageScript = Join-Path $PSScriptRoot 'stage_card_from_clipboard.ps1'
                $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File $stageScript -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState) -FriendlyErrors 2>&1 | Out-String
                if ($LASTEXITCODE -ne 0) { throw $output.Trim() }
                & $setStatus 'H3カードを取り込みました。実行はしていません。'
            }
            else {
                $result = Stage-GuiMangaCard -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState) -CardText $cardText
                & $setStatus "Mangaカードを取り込みました: $($result.CardId)"
            }
            & $refreshAll
        }
        catch { & $setStatus "カードを取り込めません: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $run.Add_Click(({
        try {
            $text = New-GuiRunTransferText -Lane $Lane -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState)
            $route = if ($Lane -eq 'H3') { 'H3_AGENT' } else { 'MANGA_AGENT' }
            Invoke-GuiRouteTransfer -Text $text -Route (Get-GuiRoutePrefix $route) -TargetToken ([string]$settings.target_tokens[$route]) -SetStatus $setStatus
        }
        catch { & $setStatus "実行指示を準備できません: $($_.Exception.Message)" }
    }.GetNewClosure()))

    $report.Add_Click(({
        try {
            $text = New-GuiReturnTransferText -Lane $Lane -RepoRoot (Get-GuiUsableRepoRoot -GuiState $guiState)
            $route = if ($Lane -eq 'H3') { 'H3_WEBGPT' } else { 'MANGA_WEBGPT' }
            Invoke-GuiRouteTransfer -Text $text -Route (Get-GuiRoutePrefix $route) -TargetToken ([string]$settings.target_tokens[$route]) -SetStatus $setStatus
        }
        catch { & $setStatus "報告を準備できません: $($_.Exception.Message)" }
    }.GetNewClosure()))

    return $group
}

$h3Group = New-GuiLaneGroup -Lane H3 -Title 'H3 / CODEX' -BackColor ([System.Drawing.Color]::AliceBlue) -RunButtonText 'Codexへ渡す' -ReturnButtonText '結果をH3 WebGPTへ戻す'
$mangaGroup = New-GuiLaneGroup -Lane MANGA -Title 'MANGA / GEMINI' -BackColor ([System.Drawing.Color]::Honeydew) -RunButtonText 'Geminiへ渡す' -ReturnButtonText '結果をManga WebGPTへ戻す'
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
    if ($dialog.ShowDialog($form) -ne [System.Windows.Forms.DialogResult]::OK) { return }
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
    & $setStatus '準備完了 — 3つの明示操作から選択してください。'
}.GetNewClosure()))

if ($SmokeTest) {
    $usableRoot = Get-GuiUsableRepoRoot -GuiState $guiState
    & $refreshAll
    foreach ($lane in @('H3', 'MANGA')) {
        $controls = $laneControls[$lane]
        foreach ($valueControl in @($controls.State, $controls.Card, $controls.Base, $controls.Report)) {
            if ($valueControl -isnot [System.Windows.Forms.Label]) { throw "WinForms smoke: $lane value control is not a Label." }
            if ($null -eq $valueControl.Text) { throw "WinForms smoke: $lane value control has no Text." }
        }
        foreach ($actionControl in @($controls.Stage, $controls.Run, $controls.Return)) {
            if ($actionControl -isnot [System.Windows.Forms.Button]) { throw "WinForms smoke: $lane action control is not a Button." }
            if ([string]::IsNullOrWhiteSpace($actionControl.Text)) { throw "WinForms smoke: $lane action control has empty text." }
        }
        if ($controls.State.Text -like '読み取り停止:*') { throw "WinForms smoke: $lane refresh failed." }
    }
    $null = New-GuiReturnTransferText -Lane H3 -RepoRoot $usableRoot
    $null = New-GuiReturnTransferText -Lane MANGA -RepoRoot $usableRoot
    Write-Output 'WINFORMS_RUNTIME_SMOKE PASS'
    $form.Dispose()
    exit 0
}

[System.Windows.Forms.Application]::Run($form)
