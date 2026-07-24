# StormPower Mega-Wave Engine Mod

Stormworks caps normal addon waves. This folder patches **game data files** (not the EXE) so tsunami / gerstner waves get much taller.

## What it changes

| File | Change |
|---|---|
| `rom/graphics/shaders/ocean_common.glslh` | Gerstner height `100` → `400`, wider/slower wave |
| `rom/data/realtime_values/environment.txt` | Unchanged forces (stock whirlpools) — waves only |

Height comes from the **ocean shader**, not from x50 wind. Ultra Waves in StormPower intentionally keep weather wind at normal levels.

## Install

1. **Close Stormworks**
2. In StormPower: Weather & Waves → **Mega Wave Engine** ON  
   (or run `INSTALL_MEGA_WAVES.bat`)
3. Start Stormworks
4. Enable **Ultra Massive Waves** (or Massive Waves / Spawn One Mega Wave)

## Uninstall

Toggle **Mega Wave Engine** OFF in the menu, or run `UNINSTALL.bat`, or Steam → Verify integrity of game files.

## Notes

- Single-player / your own host. Friends joining your lobby should install the same mod for matching seas.
- Steam updates may overwrite the shader — re-toggle Mega Wave Engine after updates.
- This is the real “edit the engine” path available without memory hacking: Stormworks keeps ocean math in `rom/` shaders.
