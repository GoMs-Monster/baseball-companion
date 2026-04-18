# Run this script once: Right-click → "Run with PowerShell"
$appDir = "C:\Users\joey_\Documents\baseball-companion"
$icoPath = "$appDir\icon.ico"

# Download Mariners logo PNG (swap this file later for city connect if desired)
$url = "https://midfield.mlbstatic.com/v1/team/136/spots/128"
$png = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content

# Wrap PNG in ICO format (ICO supports embedded PNG since Vista)
$header = [byte[]]@(0,0,1,0,1,0)
$w = 0; $h = 0  # 0 means 256px
$dir = [byte[]]@($w, $h, 0, 0, 1, 0, 32, 0)
$dir += [BitConverter]::GetBytes([int32]$png.Length)
$dir += [BitConverter]::GetBytes([int32]22)
$ico = $header + $dir + $png
[IO.File]::WriteAllBytes($icoPath, $ico)

# Remove old VBS shortcut if present
$desktop = [Environment]::GetFolderPath("Desktop")
$oldVbs = "$desktop\MLB Companion.vbs"
if (Test-Path $oldVbs) { Remove-Item $oldVbs }

# Create .lnk shortcut
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("$desktop\MLB Companion.lnk")
$sc.TargetPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$sc.Arguments = "--app=`"file:///$($appDir.Replace('\','/'))/index.html`""
$sc.IconLocation = $icoPath
$sc.WorkingDirectory = $appDir
$sc.Save()

Write-Host "`nShortcut created on Desktop with Mariners logo!" -ForegroundColor Green
Write-Host "To use a city connect logo instead, replace icon.ico in:"
Write-Host "  $icoPath" -ForegroundColor Cyan
Read-Host "`nPress Enter to close"
