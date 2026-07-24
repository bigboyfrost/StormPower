# Build a friend-ready StormPower zip (no node_modules / .git)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Join-Path $env:USERPROFILE "Documents\StormPower" }

$ver = (Get-Content -LiteralPath (Join-Path $root "VERSION") -Raw).Trim()
$outDir = Join-Path $root "dist"
$stage = Join-Path $env:TEMP "StormPower-pack-$ver"
# Discord/share name + GitHub asset name (must NOT match old updater's stormpower.*.zip preference)
$zipName = "StormPower-v$ver-friends.zip"
$ghAssetName = "Friends-Install-v$ver.zip"
$zipPath = Join-Path $outDir $zipName
$ghAssetPath = Join-Path $outDir $ghAssetName
$desktopZip = Join-Path ([Environment]::GetFolderPath("Desktop")) $zipName

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$include = @(
  "addon",
  "companion",
  "install.bat",
  "start.bat",
  "update.bat",
  "pack.bat",
  "pack-release.ps1",
  "package.json",
  "package-lock.json",
  "VERSION",
  "update-config.json",
  "CHANGELOG.md",
  "README.md",
  "START_HERE.txt"
)

foreach ($name in $include) {
  $src = Join-Path $root $name
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Missing: $name"
    continue
  }
  $dest = Join-Path $stage $name
  if ((Get-Item -LiteralPath $src).PSIsContainer) {
    Copy-Item -LiteralPath $src -Destination $dest -Recurse -Force
  } else {
    Copy-Item -LiteralPath $src -Destination $dest -Force
  }
}

$strip = @(
  (Join-Path $stage "companion\user-settings.json")
)
foreach ($p in $strip) {
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue }
}

$config = @{ owner = "bigboyfrost"; repo = "StormPower"; branch = "master" } | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $stage "update-config.json") -Value $config -Encoding UTF8

# Nest inside StormPower\ so extractors always get a clear project root
$nested = Join-Path $env:TEMP "StormPower-pack-nested-$ver"
if (Test-Path $nested) { Remove-Item -LiteralPath $nested -Recurse -Force }
New-Item -ItemType Directory -Path $nested -Force | Out-Null
Copy-Item -LiteralPath $stage -Destination (Join-Path $nested "StormPower") -Recurse -Force

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $nested "StormPower") -DestinationPath $zipPath -Force
Copy-Item -LiteralPath $zipPath -Destination $desktopZip -Force
Copy-Item -LiteralPath $zipPath -Destination $ghAssetPath -Force

Remove-Item -LiteralPath $stage -Recurse -Force
Remove-Item -LiteralPath $nested -Recurse -Force

$size = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host ""
Write-Host "Friend zip ready:"
Write-Host "  $zipPath"
Write-Host "  $desktopZip"
Write-Host "  GitHub asset: $ghAssetPath"
Write-Host "  Size: $size KB"
Write-Host ""
