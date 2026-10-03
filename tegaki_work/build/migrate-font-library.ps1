param([string]$ExternalRoot = 'E:\Data\TegakiFonts', [switch]$RemovePublicCopies)
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
    foreach ($source in Get-ChildItem -LiteralPath $sourceFolder -File) {
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
$verified | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $externalPath 'migration-verification.json') -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $publicRoot 'catalog.json') -Destination (Join-Path $externalPath 'catalog.json') -Force
Copy-Item -LiteralPath (Join-Path $publicRoot 'inspection.json') -Destination (Join-Path $externalPath 'inspection.json') -Force
if ($RemovePublicCopies) {
    # Explicit verified files only. Do not recursively remove arbitrary directories.
    foreach ($item in $verified) { Remove-Item -LiteralPath $item.source }
    foreach ($font in $catalog.fonts) {
        $sourceFolder = Join-Path $publicRoot $font.id
        if (@(Get-ChildItem -LiteralPath $sourceFolder -Force).Count -eq 0) { Remove-Item -LiteralPath $sourceFolder }
    }
}
Write-Output ("Verified {0} original/font-license files for {1} fonts. Removed public copies: {2}" -f $verified.Count,$catalog.fonts.Count,[bool]$RemovePublicCopies)
