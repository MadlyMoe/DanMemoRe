param(
    [Parameter(Mandatory=$true)][string]$Catalog,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [int]$LotteryId = 0
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$banners = (Get-Content -LiteralPath $Catalog -Raw -Encoding UTF8 | ConvertFrom-Json).banners
$titleFont = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$labelFont = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$unitFont = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$noteFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$ink = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(57, 45, 36))
$heading = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(125, 43, 36))
$gold = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(171, 148, 94), 3)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
try {
    foreach ($banner in $banners) {
        if ($banner.background.source -ne 'text-fallback' -or ($LotteryId -ne 0 -and $banner.lotteryId -ne $LotteryId)) { continue }
        $bitmap = New-Object System.Drawing.Bitmap(1280, 720)
        $canvas = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $canvas.Clear([System.Drawing.Color]::FromArgb(244, 239, 229))
            $canvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
            # The native draw controls occupy y >= 354. Keep all card text above them.
            $canvas.DrawRectangle($gold, 80, 105, 1120, 238)
            $canvas.DrawString($banner.title, $titleFont, $heading, [System.Drawing.RectangleF]::new(105, 119, 1070, 88), $format)
            $label = if ($banner.source -eq 'authored-pickup') { 'Featured units (original pickup data)' } else { 'Original pool preview - not an authored rate-up list' }
            $canvas.DrawString($label, $labelFont, $heading, [System.Drawing.RectangleF]::new(105, 214, 1070, 26), $format)
            $units = ($banner.units | ForEach-Object { "[$($_.title)] $($_.name)" }) -join '  |  '
            $canvas.DrawString($units, $unitFont, $ink, [System.Drawing.RectangleF]::new(105, 244, 1070, 67), $format)
            $canvas.DrawString('Original banner image unavailable in archive - see Gacha Details for the full unit list', $noteFont, $ink, [System.Drawing.RectangleF]::new(105, 316, 1070, 23), $format)
            $bitmap.Save((Join-Path $OutputDirectory "$($banner.lotteryId).png"), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $canvas.Dispose(); $bitmap.Dispose() }
    }
} finally {
    $titleFont.Dispose(); $labelFont.Dispose(); $unitFont.Dispose(); $noteFont.Dispose()
    $ink.Dispose(); $heading.Dispose(); $gold.Dispose(); $format.Dispose()
}
