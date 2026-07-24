# Emergency updater for friends stuck on broken auto-update (HTTP 415).
# Downloads latest StormPower-*.zip / Friends-Install zip from GitHub Releases
# and overlays it onto this folder, then syncs the Stormworks addon.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "Fetching latest release info..."
$rel = Invoke-RestMethod -Uri "https://api.github.com/repos/bigboyfrost/StormPower/releases/latest" -Headers @{
  "User-Agent" = "StormPower-EmergencyUpdater"
  "Accept" = "application/vnd.github+json"
}

$tag = ($rel.tag_name -replace '^v','')
Write-Host "Latest: v$tag"

$asset = $rel.assets | Where-Object { $_.name -match '(?i)stormpower-v.*\.zip|stormpower.*friends.*\.zip|friends-install.*\.zip' } | Select-Object -First 1
if (-not $asset) {
  $asset = $rel.assets | Where-Object { $_.name -match '\.zip$' } | Select-Object -First 1
}

$zipUrl = $null
if ($asset) {
  $zipUrl = $asset.browser_download_url
  Write-Host "Asset: $($asset.name)"
} else {
  $zipUrl = "https://github.com/bigboyfrost/StormPower/archive/refs/tags/v$tag.zip"
  Write-Host "Using tag archive"
}

$tmp = Join-Path $env:TEMP "StormPower-emergency-$tag"
$zip = Join-Path $env:TEMP "StormPower-emergency-$tag.zip"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

Write-Host "Downloading..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zip -Headers @{ "User-Agent" = "StormPower-EmergencyUpdater" }

Write-Host "Extracting..."
Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force

function Test-SpRoot($dir) {
  return (Test-Path (Join-Path $dir "VERSION")) -and (Test-Path (Join-Path $dir "companion")) -and (Test-Path (Join-Path $dir "package.json"))
}

$src = $null
if (Test-SpRoot $tmp) { $src = $tmp }
else {
  Get-ChildItem -LiteralPath $tmp -Directory | ForEach-Object {
    if (-not $src -and (Test-SpRoot $_.FullName)) { $src = $_.FullName }
  }
}
if (-not $src) { throw "Could not find StormPower files in downloaded zip" }

Write-Host "Installing from $src ..."
$skip = @("node_modules", ".git", "_update.zip", "_update_extract", "_update_staging", "_update_ready.json", "dist")
Get-ChildItem -LiteralPath $src | ForEach-Object {
  if ($skip -contains $_.Name) { return }
  $dest = Join-Path $root $_.Name
  if ($_.PSIsContainer) {
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
  } else {
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
  }
}

Set-Content -LiteralPath (Join-Path $root "VERSION") -Value "$tag`n" -Encoding ascii -NoNewline

$addonDest = Join-Path $env:APPDATA "Stormworks\data\missions\StormPower"
if ($env:APPDATA) {
  New-Item -ItemType Directory -Path $addonDest -Force | Out-Null
  Copy-Item (Join-Path $root "addon\playlist.xml") (Join-Path $addonDest "playlist.xml") -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $root "addon\script.lua") (Join-Path $addonDest "script.lua") -Force -ErrorAction SilentlyContinue
}

Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Installed v$tag successfully."
