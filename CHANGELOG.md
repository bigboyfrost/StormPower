# StormPower Changelog

## 1.5.6
- In-game Stormworks notify + announce when an update is available
- Mega Wave Engine install/uninstall from the overlay menu (no bat required)
- Flip Boost Direction + Check for Updates menu items
- Packaged app includes engine-mod resources for menu-driven install

## 1.5.5
- Vehicle Boost rewritten as hard warp pulses (setGroupPos / setVehiclePos) — soft moveVehicle cannot beat ship physics
- Tsunami API magnitude raised (4–5) for taller gerstner waves
- NEW: engine-mod patches Stormworks ocean shaders for ~4x rogue-wave height (INSTALL_MEGA_WAVES.bat)

## 1.5.4
- Vehicle Boost: real local-forward shove (no more sliding in the seat). Auto-picks ship facing; `?boost flip` if reversed

## 1.5.3
- Check for updates while StormPower is running (menu open + every 15 min)
- Release notes formatting fixed (markdown renders again)
- Leftover StormPower-Setup.exe on the desktop is cleaned up after install/update

## 1.5.2
- Rewrite Vehicle Boost: moves the whole ship group, horizontal only, pulsed — no more vibrate/glitch/break

## 1.5.1
- App shortcut keeps the lightning icon (was resetting to Electron)
- Installer deletes itself a few seconds after a successful install

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
