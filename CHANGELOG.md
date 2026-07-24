# StormPower Changelog

## 1.5.0
- Real Windows installer (StormPower-Setup.exe) with desktop shortcut
- Auto-updates via GitHub Releases (electron-updater) — no Node.js required
- Temporary stock lightning icon (replace build/icon.png later)
- Stormworks addon syncs automatically on launch

## 1.4.6
- Fix update download HTTP 415 (wrong Accept header on GitHub zip)
- Prefer release zip / tag archive instead of API zipball
- emergency-update.bat if auto-update is stuck

## 1.4.5
- iPhone-style toggles instead of separate On/Off buttons
- Menu keeps keyboard focus so arrow keys work without rapid clicking
- Vehicle boost capped at +40 knots
- Chaos Mode auto-stops and cleans up after 20 seconds
- Updater closes StormPower before installing files

## 1.4.4
- Auto-updater fixes (wrong zip root + Windows file locks)

## 1.4.3
- Chaos Mode, Vehicle Boost, 50x wind, gun autofire fix
