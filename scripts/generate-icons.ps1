# Generate raster variants of public/favicon.svg with Windows System.Drawing.
Add-Type -AssemblyName System.Drawing
$iconDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public'))
foreach ($iconSize in @(32,180,192,512)) {
  $bitmap = [Drawing.Bitmap]::new($iconSize,$iconSize)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.Color]::FromArgb(20,20,22))
  $graphics.ScaleTransform($iconSize / 64.0, $iconSize / 64.0)
  $pen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(242,242,242),3.5)
  $pen.StartCap = $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
  $book = [Drawing.Drawing2D.GraphicsPath]::new()
  $book.AddBezier(32,20,27,16,19,15,11,17)
  $book.AddLine(11,17,11,46)
  $book.AddBezier(11,46,19,44,27,45,32,49)
  $book.AddBezier(32,49,37,45,45,44,53,46)
  $book.AddLine(53,46,53,17)
  $book.AddBezier(53,17,45,15,37,16,32,20)
  $graphics.DrawPath($pen,$book)
  $graphics.DrawLine($pen,32,20,32,49)
  $graphics.DrawBezier($pen,17,25,21,24.6,24,25.2,27,26.5)
  $graphics.DrawBezier($pen,17,32,21,31.6,24,32.2,27,33.5)
  $graphics.DrawLine($pen,38,26,47,26)
  $graphics.DrawLine($pen,38,33,47,33)
  $filename = if ($iconSize -eq 180) { 'apple-touch-icon.png' } else { "icon-$iconSize.png" }
  $bitmap.Save((Join-Path $iconDirectory $filename),[Drawing.Imaging.ImageFormat]::Png)
  if ($iconSize -eq 32) {
    $png = [IO.File]::ReadAllBytes((Join-Path $iconDirectory $filename))
    $stream = [IO.File]::Create((Join-Path $iconDirectory 'favicon.ico'))
    $writer = [IO.BinaryWriter]::new($stream)
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
    $writer.Write([byte]32); $writer.Write([byte]32); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
    $writer.Write($png); $writer.Dispose(); $stream.Dispose()
  }
  $book.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
