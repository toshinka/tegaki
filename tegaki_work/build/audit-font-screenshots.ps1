# WP-021: local OCR only; no screenshot uploads or font downloads.
param(
    [string]$InputDirectory = 'D:\GitHub\tegaki\開発用資料保管庫\フォント選定資料\スクリーンショット',
    [string]$OutputFile = 'D:\GitHub\tegaki\tegaki_work\.cache\font-acquisition\screenshots-ocr.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
$taskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-Result($Operation, [Type]$ResultType) {
    $task = $taskMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { throw 'No installed Windows OCR language engine' }
$rows = @(); $hashes = @{}; $count = 0
$files = Get-ChildItem -LiteralPath $InputDirectory -File -Filter '*.png' | Sort-Object Name
foreach ($imageFile in $files) {
    $hash = (Get-FileHash -LiteralPath $imageFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hashes.ContainsKey($hash)) {
        $rows += [PSCustomObject]@{ file = $imageFile.Name; sha256 = $hash; duplicateOf = $hashes[$hash]; text = '' }
        continue
    }
    $hashes[$hash] = $imageFile.Name
    try {
        $storageFile = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imageFile.FullName)) ([Windows.Storage.StorageFile])
        $stream = Await-Result ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $rows += [PSCustomObject]@{ file = $imageFile.Name; sha256 = $hash; text = $result.Text }
        $bitmap.Dispose(); $stream.Dispose()
    } catch {
        $rows += [PSCustomObject]@{ file = $imageFile.Name; sha256 = $hash; text = ''; error = $_.Exception.Message }
    }
    $count++
    if ($count % 100 -eq 0) { Write-Output ('OCR {0}/{1}' -f $count, $files.Count) }
}
$rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutputFile -Encoding UTF8
Write-Output ('OCR complete: files={0}, unique={1}, errors={2}, language={3}' -f $files.Count, $hashes.Count, @($rows | Where-Object error).Count, $engine.RecognizerLanguage.LanguageTag)
