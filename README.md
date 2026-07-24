# StormPower
**By Aimless Developement**

External spawn menu for *Stormworks: Build and Rescue*.

## Install (recommended)

1. Download **StormPower-Setup-*.exe** from [Releases](https://github.com/bigboyfrost/StormPower/releases/latest)
2. Run the installer (creates a desktop shortcut)
3. Launch **StormPower**
4. Enable addon **StormPower** in your Stormworks save
5. Click the floating **SP** button

Updates install automatically from GitHub Releases — no Node.js required.

> Windows SmartScreen may warn on unsigned builds: **More info → Run anyway**.

## Dev / source folder

1. Install [Node.js LTS](https://nodejs.org/)
2. Run **`install.bat`** then **`start.bat`**
3. Build installer: `npm run dist`

Custom icon: replace `build/icon.png`, run `node scripts/make-icon.js`, then rebuild.

## Features

- Blue / light-blue overlay with black buttons (622×800)
- Always-on **SP** toggle + optional **Pop out** to another monitor
- Spawn distance **1–5000 m**
- Animals, creatures, weapons, equipment, objects, explosions
- Ultra wind + massive / ultra tsunami loops
- Disaster siren mute
- Chat fallbacks (`?sp`)

## Chat commands

| Command | Example |
|---|---|
| `?sp` | Help |
| `?dist <m>` | `?dist 2500` |
| `?count <n>` | `?count 10` |
| `?shark / ?whale / ?kraken` | `?shark 5 1 100` |
| `?waves calm\|choppy\|max\|mega\|ultra\|off` | `?waves ultra` |
| `?sirens off\|on\|kill` | `?sirens off` |
| `?boom [0-1] [dist]` | `?boom 0.8 20` |

## License

MIT © Aimless Developement
