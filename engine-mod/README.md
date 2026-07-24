# StormPower Engine Mods

## Mega Wave Engine

Creates a narrow, localized rogue-wave wall intended to overtop islands and
swallow very large ships.

## What it changes

| File | Change |
|---|---|
| `rom/graphics/shaders/ocean_common.glslh` | Gerstner height `100` → `900`; phase `0.01` → `0.018` to keep the wall localized instead of lifting the loaded ocean. |
| `rom/data/realtime_values/environment.txt` | Unchanged (stock forces) |

Ultra mode uses magnitude 2.5, so the mathematical crest is over 2 km before
engine/render clipping. The addon refreshes it once per minute instead of every
few seconds, avoiding the previous whole-ocean bounce.

## Overrev Engine Power

The menu can patch the stock small, medium, large, and modular engine
definitions to produce **25x torque**. This is real engine output, not a
teleport or blocked occupied-seat override.

Stormworks does not expose an addon API for setting component RPS, and the RPS
ceiling is hard-coded. This patch drives engines to redline under heavy load,
but cannot directly set an arbitrary RPS without executable/memory hacking.

## Install

1. **Close Stormworks**
2. StormPower → **Toggles → Mega Wave Engine** ON
3. Optionally enable **Overrev Engine Power**
4. Start Stormworks
5. Use **Ultra Massive Waves** / **Massive Waves** / Spawn One Mega Wave

## Uninstall

Toggle **Mega Wave Engine** OFF, or Steam → Verify integrity of game files.
