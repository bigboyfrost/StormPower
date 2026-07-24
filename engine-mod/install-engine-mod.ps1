# Install StormPower mega-wave engine mod into a Stormworks install.
# Patches ocean shaders + environment forces. Backs up originals first.
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
    $candidates += (Join-Path $steam "steamapps\common\Stormworks")
  }
  $candidates += @(
    "${env:ProgramFiles(x86)}\Steam\steamapps\common\Stormworks",
    "$env:ProgramFiles\Steam\steamapps\common\Stormworks",
    "D:\SteamLibrary\steamapps\common\Stormworks",
    "E:\SteamLibrary\steamapps\common\Stormworks"
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path (Join-Path $p "stormworks64.exe"))) { return $p }
    if ($p -and (Test-Path (Join-Path $p "stormworks.exe"))) { return $p }
  }
  return $null
}

$modRoot = $PSScriptRoot
$sw = Find-Stormworks
if (-not $sw) {
  Write-Host "Could not find Stormworks. Set STORMPOWORKS_PATH and re-run."
  if ($env:STORMPOWORKS_PATH -and (Test-Path $env:STORMPOWORKS_PATH)) {
    $sw = $env:STORMPOWORKS_PATH
  } else {
    exit 1
  }
}

Write-Host "Stormworks: $sw"

$shaderDst = Join-Path $sw "rom\graphics\shaders\ocean_common.glslh"
$envDst = Join-Path $sw "rom\data\realtime_values\environment.txt"
$bakDir = Join-Path $sw "rom\stormpower_backup"
New-Item -ItemType Directory -Path $bakDir -Force | Out-Null

if (-not (Test-Path (Join-Path $bakDir "ocean_common.glslh"))) {
  Copy-Item $shaderDst (Join-Path $bakDir "ocean_common.glslh") -Force
}
if (-not (Test-Path (Join-Path $bakDir "environment.txt"))) {
  Copy-Item $envDst (Join-Path $bakDir "environment.txt") -Force
}

Copy-Item (Join-Path $modRoot "shaders\ocean_common.glslh") $shaderDst -Force
Copy-Item (Join-Path $modRoot "realtime_values\environment.txt") $envDst -Force

Set-Content -LiteralPath (Join-Path $bakDir "INSTALLED.txt") -Value "StormPower mega-wave engine mod installed $(Get-Date -Format o)" -Encoding ascii

Write-Host ""
Write-Host "Mega-wave engine mod INSTALLED."
Write-Host "  - Tsunami/gerstner height ~4x"
Write-Host "  - Wider/slower rogue waves"
Write-Host "  - Stronger whirlpool forces"
Write-Host ""
Write-Host "Restart Stormworks. Use Steam 'Verify integrity' to fully undo, or run uninstall-engine-mod.ps1"
Write-Host "NOTE: Visual + force mod. Friends need the same mod for matching seas in multiplayer you host."
