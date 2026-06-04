Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root "src-tauri\icons\icon.ico"
$previewPath = Join-Path $root "src-tauri\icons\icon-preview.png"
$sizes = @(16, 24, 32, 48, 64, 128, 256)

function New-IconPngBytes {
  param([int]$Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 256.0
  function S([float]$Value) { return [float]($Value * $scale) }
  function RoundedRect([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
  }

  $bg = [System.Drawing.Color]::FromArgb(255, 17, 18, 15)
  $panel = [System.Drawing.Color]::FromArgb(255, 24, 25, 22)
  $ink = [System.Drawing.Color]::FromArgb(255, 241, 241, 234)
  $soft = [System.Drawing.Color]::FromArgb(108, 241, 241, 234)
  $line = [System.Drawing.Color]::FromArgb(58, 241, 241, 234)

  $graphics.FillPath((New-Object System.Drawing.SolidBrush $bg), (RoundedRect 0 0 $Size $Size (S 56)))
  $graphics.FillPath((New-Object System.Drawing.SolidBrush $panel), (RoundedRect (S 32) (S 32) (S 192) (S 192) (S 34)))
  $graphics.DrawPath((New-Object System.Drawing.Pen $ink, ([Math]::Max(1.0, (S 8)))), (RoundedRect (S 32) (S 32) (S 192) (S 192) (S 34)))

  $linePen = New-Object System.Drawing.Pen $line, ([Math]::Max(1.0, (S 9)))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($linePen, (S 75), (S 128), (S 181), (S 128))
  $graphics.DrawLine($linePen, (S 128), (S 75), (S 128), (S 181))

  $active = @(2, 3, 4, 7)
  for ($i = 0; $i -lt 9; $i++) {
    $col = $i % 3
    $row = [Math]::Floor($i / 3)
    $brush = New-Object System.Drawing.SolidBrush ($(if ($active -contains $i) { $ink } else { $soft }))
    $x = S (58 + $col * 53)
    $y = S (58 + $row * 53)
    $graphics.FillPath($brush, (RoundedRect $x $y (S 34) (S 34) (S 8)))
  }

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  $stream.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  return ,$bytes
}

$entries = @()
$images = @()
$offset = 6 + ($sizes.Count * 16)

foreach ($size in $sizes) {
  $bytes = New-IconPngBytes -Size $size
  $images += ,$bytes
  $entries += [PSCustomObject]@{
    Size = $size
    Length = $bytes.Length
    Offset = $offset
  }
  $offset += $bytes.Length
}

$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)

foreach ($entry in $entries) {
  $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
  $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$entry.Length)
  $writer.Write([UInt32]$entry.Offset)
}

foreach ($bytes in $images) {
  $writer.Write($bytes)
}

[System.IO.File]::WriteAllBytes($iconPath, $stream.ToArray())
[System.IO.File]::WriteAllBytes($previewPath, (New-IconPngBytes -Size 256))
$writer.Dispose()
$stream.Dispose()

Write-Output "Generated $iconPath"
