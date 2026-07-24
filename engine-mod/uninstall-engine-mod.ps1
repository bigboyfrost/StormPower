# Restore stock Stormworks ocean files (undo StormPower mega-wave mod).
$ErrorActionPreference = "Stop"

function Find-Stormworks {
  $candidates = @()
  $steam = (Get-ItemProperty "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue).SteamPath
  if ($steam) {
    $vdf = Join-Path $steam "steamapps\libraryfolders.vdf"
    if (Test-Path $vdf) {
      Get-Content $vdf | ForEach-Object {
        if ($_ -match '"path"\s+"([^"]+)"') {
          $lib = $Matches[1] -replace '\\\\', '\'
          $candidates += (Join-Path $lib "steamapps\common\Stormworks")
        }
      }
    }
  }
  $candidates += @(
    "D:\SteamLibrary\steamapps\common\Stormworks",
    "${env:ProgramFiles(x86)}\Steam\steamapps\common\Stormworks"
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path (Join-Path $p "rom\stormpower_backup"))) { return $p }
  }
  foreach ($p in $candidates) {
    if ($p -and (Test-Path (Join-Path $p "stormworks64.exe"))) { return $p }
  }
  return $null
}

$modRoot = $PSScriptRoot
$sw = Find-Stormworks
if (-not $sw) { Write-Host "Stormworks not found"; exit 1 }

$bakDir = Join-Path $sw "rom\stormpower_backup"
$shaderDst = Join-Path $sw "rom\graphics\shaders\ocean_common.glslh"
$envDst = Join-Path $sw "rom\data\realtime_values\environment.txt"

$shaderSrc = Join-Path $bakDir "ocean_common.glslh"
if (-not (Test-Path $shaderSrc)) {
  $shaderSrc = Join-Path $modRoot "stock\shaders\ocean_common.glslh"
}
$envSrc = Join-Path $bakDir "environment.txt"
if (-not (Test-Path $envSrc)) {
  $envSrc = Join-Path $modRoot "stock\realtime_values\environment.txt"
}

if (-not (Test-Path $shaderSrc) -or -not (Test-Path $envSrc)) {
  Write-Host "No backup found. Use Steam: Properties -> Installed Files -> Verify integrity of game files."
  exit 1
}

Copy-Item $shaderSrc $shaderDst -Force
Copy-Item $envSrc $envDst -Force
Remove-Item (Join-Path $bakDir "INSTALLED.txt") -Force -ErrorAction SilentlyContinue
Write-Host "Mega-wave engine mod REMOVED. Restart Stormworks."
