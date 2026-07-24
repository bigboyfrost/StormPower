# StormPower Changelog

## 1.6.1
- CRITICAL FIX: live memory helper could not run from inside app.asar — waves/overrev never patched RAM in the installed app
- Helper is now copied to %TEMP% (and shipped in extraResources); freeze loop locks tsunami magnitude at 120× every 400ms
- Wave pulses no longer cancelGerstner (that wiped the RAM locks); spawn overrides in place
- Turning waves on immediately kicks a fresh memory scan

## 1.6.0
- LIVE memory patching (Cheat Engine–style): Mega Waves and Overrev apply while Stormworks is running — no restart
- Tsunami uses a unique magnitude marker; companion rewrites it in RAM to ~40× max API height and freezes it
- Overrev writes Medium/Large `engine_max_force` values directly in process memory (file patch still saved for next boot)
- Menu copy updated — no more "restart Stormworks" requirement for these toggles

## 1.5.9
- Mega Wave Engine rebuilt as a narrow localized wall: 900m shader coefficient, 2.5 Ultra magnitude
- Wave refresh slowed to once per minute so the ocean no longer pulses every few seconds
- Replaced ineffective occupied-seat boost with Overrev Engine Power: 25x torque patch for stock and modular engines
- Overrev and wave engine patches remain independently toggleable and restore backed-up game definitions

## 1.5.8
- Mega Wave Engine softened (stock wavelength, ~45% crest height) — stops ocean bounce / boat levitation
- Wave pulses no longer cancel/respawn-strobe; lower tsunami magnitudes
- Engine Boost feeds nearby engines (fuel/throttle) instead of teleporting you out of the seat
- In-game update notify waits for Stormworks bridge and re-sends without opening the menu
- Menu reorganized: Home → Toggles / Spawns / Gear / World / Player / Settings with many more toggles

## 1.5.7
- Ultra Waves no longer use x50 wind / whirlpool / meteor spam (that was chaos, not waves)
- Tall seas come from tsunami magnitude + Mega Wave Engine ocean shader only
- Slower wave pulse so gerstners can exist; engine mod keeps stock whirlpool forces

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
