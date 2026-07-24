# StormPower
**By Aimless Developement**

External Apple-style spawn menu for *Stormworks: Build and Rescue*.

## Features

- Locked **622×800** overlay, pinned to the **top** of the screen (left or right)
- Always-on **SP** toggle button (click to show/hide — no keybinds required)
- Spawn distance **1–5000 m**
- Weapons, animals, creatures, weather/wind boost, disasters
- Chat commands when you prefer typing (`?sp`)
- Auto-updater (`update.bat`)

## Quick start

1. Install [Node.js LTS](https://nodejs.org/)
2. Run `install.bat`
3. Run `start.bat`
4. Enable addon **StormPower** in your Stormworks save
5. Click the floating **SP** button to open/close the menu

> Tip: For best overlay visibility use **Borderless Window**. Exclusive fullscreen hides other windows; use chat commands there.

## Chat commands

| Command | Example |
|---|---|
| `?sp` | Help |
| `?dist <m>` | `?dist 2500` (1–5000) |
| `?count <n>` | `?count 10` |
| `?size <n>` | `?size 2` |
| `?shark [n] [size] [dist]` | `?shark 5 1 100` |
| `?whale …` / `?kraken …` | |
| `?give pistol\|smg\|rifle\|grenade\|c4\|spear\|aid` | `?give rifle` |
| `?outfit scuba\|diving\|armor\|arctic` | |
| `?loadout` `?heal` `?money` `?cleanup` | |
| `?wind <0-10>` | `?wind 5` (0 = off) |

## Overlay controls

- **SP button** — always on screen, show/hide menu
- **Back** button in the menu
- Mouse click any list item
- Left/Right side setting in Quick Setup

## Sharing

```text
git clone https://github.com/bigboyfrost/StormPower.git
cd StormPower
install.bat
start.bat
```

Friends can later run `update.bat`.

## License

MIT © Aimless Developement
