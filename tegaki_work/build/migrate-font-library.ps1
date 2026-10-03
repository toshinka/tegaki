param([string]$ExternalRoot = 'E:\Data\TegakiFonts', [switch]$RemovePublicCopies, [switch]$RemoveAcquisitionCache)
$ErrorActionPreference = 'Stop'
$productRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$publicRoot = Join-Path $productRoot 'public\fonts'
$externalPath = [IO.Path]::GetFullPath($ExternalRoot)
if ($externalPath.StartsWith($productRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'External library must be outside product checkout' }
$catalog = Get-Content -LiteralPath (Join-Path $publicRoot 'catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$verified = @()
foreach ($font in $catalog.fonts) {
    if ($font.id -notmatch '^bundled-[a-z0-9-]+$') { throw 'Unrecognized curated font ID' }
    $sourceFolder = [IO.Path]::GetFullPath((Join-Path $publicRoot $font.id))
    if (-not $sourceFolder.StartsWith($publicRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid source folder' }
    $targetFolder = Join-Path $externalPath ('Library\' + $font.id)
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
    $sourceFiles = if (Test-Path -LiteralPath $sourceFolder) { @(Get-ChildItem -LiteralPath $sourceFolder -File) } else { @() }
    foreach ($source in $sourceFiles) {
        $target = Join-Path $targetFolder $source.Name
        $sourceHash = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sourceHash) { throw "Different existing external file: $target" }
        } else { Copy-Item -LiteralPath $source.FullName -Destination $target }
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sourceHash) { throw "Copy verification failed: $target" }
        $verified += [pscustomobject]@{source=$source.FullName; target=$target; sha256=$sourceHash}
    }
    $original = Join-Path $targetFolder ([IO.Path]::GetFileName($font.file))
    if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant() -ne $font.sha256) { throw "Catalog hash mismatch: $original" }
}
foreach ($relative in @('Inbox','Inbox\URLメモ','Archive')) { New-Item -ItemType Directory -Path (Join-Path $externalPath $relative) -Force | Out-Null }
if ($verified.Count) { $verified | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $externalPath 'migration-verification.json') -Encoding UTF8 }
Copy-Item -LiteralPath (Join-Path $publicRoot 'catalog.json') -Destination (Join-Path $externalPath 'catalog.json') -Force
Copy-Item -LiteralPath (Join-Path $publicRoot 'inspection.json') -Destination (Join-Path $externalPath 'inspection.json') -Force
$cacheRoot = [IO.Path]::GetFullPath((Join-Path $productRoot '.cache\font-acquisition'))
$archiveVerified = @()
foreach ($fontId in (@($catalog.fonts.id) + @('bundled-corporate','bundled-yojo'))) {
    if ($fontId -notmatch '^bundled-[a-z0-9-]+$') { throw 'Invalid archive ID' }
    $packageRoot = [IO.Path]::GetFullPath((Join-Path $cacheRoot $fontId))
    if (-not $packageRoot.StartsWith($cacheRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path outside cache' }
    if (-not (Test-Path -LiteralPath $packageRoot)) { continue }
    $packageItems = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -Force)
    if ($packageItems | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Archive symlinks are not permitted' }
    foreach ($source in ($packageItems | Where-Object { -not $_.PSIsContainer })) {
        $relative = $source.FullName.Substring($cacheRoot.Length + 1)
        $target = Join-Path (Join-Path $externalPath 'Archive') $relative
        New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
        $sourceHash = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Different existing archive' }
        } else { Copy-Item -LiteralPath $source.FullName -Destination $target }
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Archive verification failed' }
        $archiveVerified += [pscustomobject]@{source=$source.FullName; target=$target; sha256=$sourceHash}
        if ($RemoveAcquisitionCache) { Remove-Item -LiteralPath $source.FullName }
    }
    if ($RemoveAcquisitionCache) {
        foreach ($directory in @($packageItems | Where-Object { $_.PSIsContainer } | Sort-Object { $_.FullName.Length } -Descending)) {
            if (@(Get-ChildItem -LiteralPath $directory.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath $directory.FullName }
        }
        if (@(Get-ChildItem -LiteralPath $packageRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $packageRoot }
    }
}
if ($archiveVerified.Count) { $archiveVerified | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $externalPath 'archive-verification.json') -Encoding UTF8 }
if ($RemovePublicCopies) {
    # Explicit verified files only. Do not recursively remove arbitrary directories.
    foreach ($item in $verified) { Remove-Item -LiteralPath $item.source }
    foreach ($font in $catalog.fonts) {
        $sourceFolder = Join-Path $publicRoot $font.id
        if ((Test-Path -LiteralPath $sourceFolder) -and @(Get-ChildItem -LiteralPath $sourceFolder -Force).Count -eq 0) { Remove-Item -LiteralPath $sourceFolder }
    }
}
Write-Output ("Verified {0} original/font-license files for {1} fonts. Removed public copies: {2}" -f $verified.Count,$catalog.fonts.Count,[bool]$RemovePublicCopies)
