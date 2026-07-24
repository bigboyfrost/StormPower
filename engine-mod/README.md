# StormPower Mega-Wave Engine Mod

Mild crest height patch for disaster / tsunami gerstner waves.

## What it changes

| File | Change |
|---|---|
| `rom/graphics/shaders/ocean_common.glslh` | Gerstner height `100` → `145` (~45%). **Stock wavelength/speed kept** so the ocean does not bounce globally. |
| `rom/data/realtime_values/environment.txt` | Unchanged (stock forces) |

Earlier builds used height `400` + wider waves — that made the whole sea levitate boats. That is gone.

## Install

1. **Close Stormworks**
2. StormPower → **Toggles → Mega Wave Engine** ON
3. Start Stormworks
4. Use **Ultra Massive Waves** / **Massive Waves** / Spawn One Mega Wave

## Uninstall

Toggle **Mega Wave Engine** OFF, or Steam → Verify integrity of game files.
