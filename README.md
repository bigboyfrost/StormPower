# StormPower
**By Aimless Developement**

External Apple-style spawn overlay for *Stormworks: Build and Rescue*.  
Toggle with **F4** — the game keeps focus (no tabbing out). Arrow keys are captured globally while the menu is open.

## Features

- Focus-free overlay (622×800, locked size)
- Spawn animals, creatures, objects at a **configurable distance**
- Weapons / equipment / outfits into inventory
- **StormPower wind boost** (2×–10×) — pushes past the stock weather slider (0–1) and re-applies every tick
- Auto-updater for friends (`update.bat`)
- Easy share via GitHub

## Quick start

1. Install [Node.js LTS](https://nodejs.org/)
2. Run `install.bat`
3. Run `start.bat`
4. In Stormworks, enable the **StormPower** addon on your save
5. Press **F4** in-game

### Controls

| Key | Action |
|---|---|
| F4 | Show / hide (game stays focused) |
| ↑ ↓ | Move |
| Enter / → | Select |
| Backspace / Esc / ← | Back |
| 1–9 | Jump to item |

**Quick Setup** sliders at the top: Spawn distance, Amount, Scale, Peer ID.

## Sharing with friends

1. They clone/download this repo
2. Run `install.bat` then `start.bat`
3. Host enables **StormPower** on the save
4. Later: `update.bat` pulls the latest release

## Wind boost note

Stormworks documents `server.setWeather` wind as `0–1`. StormPower intentionally sends higher values (up to 10) and refreshes them every tick so the game cannot ease wind back to stock. Exact in-world strength depends on the game build; 2×–5× is the practical sweet spot.

## License

MIT © Aimless Developement
