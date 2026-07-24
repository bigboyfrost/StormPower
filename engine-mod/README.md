# StormPower Mega-Wave Engine Mod

Stormworks caps normal addon waves. This folder patches **game data files** (not the EXE) so rogue waves / tsunamis get much taller.

## What it changes

| File | Change |
|---|---|
| `rom/graphics/shaders/ocean_common.glslh` | Gerstner height `100` → `400`, wider/slower wave |
| `rom/data/realtime_values/environment.txt` | Whirlpool forces ×3 |

## Install

1. **Close Stormworks**
2. Run `INSTALL_MEGA_WAVES.bat`
3. Start Stormworks
4. In StormPower: Ultra / Impossible waves + Mega Wave

## Uninstall

Run `UNINSTALL.bat`, or Steam → Stormworks → Properties → Installed Files → **Verify integrity of game files**.

## Notes

- Single-player / your own host. Friends joining your lobby should install the same mod for matching seas.
- Steam updates may overwrite the shader — re-run install after updates.
- This is the real “edit the engine” path available without memory hacking: Stormworks keeps ocean math in `rom/` shaders and `realtime_values`.
