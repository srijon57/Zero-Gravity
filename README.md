# 🏁 Zero Gravity — 2 Player Split-Screen Race

A two-player, split-screen racing game built with **Three.js** and **Vite**. Two drivers share one keyboard and race a neon track floating through space. The screen is split top and bottom, so each player gets their own camera and HUD.

<!-- Add a screenshot or GIF here, e.g. ![Gameplay](docs/screenshot.png) -->

## ✨ Features

- **Split-screen multiplayer:** Player 1 on the top half, Player 2 on the bottom half, each with an independent chase camera and bloom effect.
- **Choose your laps:** pick 1–20 laps on the landing page.
- **One keyboard, two players:** WASD for Player 1, arrow keys for Player 2.
- **Wide neon road with guard walls:** cars can never fall off the track.
- **Car-to-car collisions:** bump, block and push your opponent.
- **Nitro boost:** limited meter that drains while boosting and recharges over time.
- **Race flow:** 3-2-1-GO countdown, lap timers, best lap, live positions, winner banner and results screen with Rematch.
- **Space environment:** a procedurally generated night sky with nebula clouds and thousands of stars.
- **Fixed centre light:** a glowing light sits in the middle of the map.

## 🎮 Controls

| Action | Player 1 (top screen) | Player 2 (bottom screen) |
| --- | --- | --- |
| Accelerate | `W` | `↑` |
| Brake / reverse | `S` | `↓` |
| Steer left | `A` | `←` |
| Steer right | `D` | `→` |
| Nitro | `Space` or `Left Shift` | `Enter`, `Right Shift` or `Numpad 0` |

> **Tip:** some keyboards can't register many keys pressed at once ("ghosting"). If a key stops responding while both players are pressing several keys, use the alternative nitro keys.

## 🏆 How to Play

1. Open the game and choose the **number of laps** with the `−` / `+` buttons or the quick presets.
2. Click **Start Race**.
3. Wait for the countdown, then race. Cars start behind the checkered start/finish line.
4. The first player to complete all laps **wins**. Results show finish time, best lap and the other player's progress.
5. Choose **Rematch** to race again with the same lap count, or **Main menu** to change settings.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A browser with WebGL support (Chrome, Edge, Firefox, Safari)

### Install and run

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:5173`).

### Production build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

## 🌐 Deploying to GitHub Pages

If you host the game at `https://<user>.github.io/<repo>/`, set the base path in `vite.config.js`:

```js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/<your-repo>/",
  plugins: [tailwindcss()],
});
```

Then run `npm run build` and publish the `dist/` folder (for example with a GitHub Actions workflow or the `gh-pages` package).

## 🗂 Project Structure

```
.
├── index.html
├── index.js              # Entry point: landing page → race → render loop
├── spline.js             # Track centre-line (closed Catmull-Rom curve, TRACK_SCALE)
├── vite.config.js
├── css/
│   └── style.css         # Tailwind import + HUD / landing styles
├── public/
│   └── models/           # race.glb (car) and textures
└── js/
    ├── assets.js         # Asset URLs
    ├── background.js     # Procedural star / nebula sky
    ├── camera.js         # Per-player chase camera
    ├── carStyle.js       # Car materials, wheels and colours
    ├── game.js           # Race state: countdown, laps, finish, results
    ├── hud.js            # Split-screen HUD and results overlay
    ├── input.js          # Keyboard mapping for both players
    ├── landing.js        # Landing page with lap selector
    ├── lights.js         # Scene lighting (fixed centre light)
    ├── nitrous.js        # Exhaust flame effect
    ├── player.js         # Car physics, wall and car collisions, laps
    ├── road.js           # Road mesh, markings, guard walls, start line
    ├── scene.js          # Scene and renderer setup
    ├── views.js          # Split-screen rendering with bloom
    └── shaders/          # Road glow shader
```

## ⚙️ Configuration

| What | Where |
| --- | --- |
| Road width, wall height | `js/road.js` (`roadWidth`, `wallHeight`) |
| Track size | `spline.js` (`TRACK_SCALE`) |
| Top speed, nitro, acceleration, steering | `js/player.js` (constants at the top) |
| Camera distance, height and FOV | `js/camera.js` |
| Player colours and start positions | `js/game.js` (`PLAYER_SPECS`) |
| Bloom strength | `js/views.js` |

## 🧰 Tech Stack

- [Three.js](https://threejs.org/): 3D rendering, GLTF loading, post-processing (bloom)
- [Vite](https://vitejs.dev/): dev server and bundler
- [Tailwind CSS](https://tailwindcss.com/) v4: landing page styling
- Vanilla JavaScript (ES modules)

## 🛠 Troubleshooting

- **Black screen or nothing renders:** check that WebGL is enabled in your browser and open the developer console for errors.
- **Car model doesn't load:** make sure `public/models/race.glb` exists. Vite serves the `public` folder from the site root.
- **Low frame rate:** the game renders the scene twice per frame, once per player. Lower the pixel ratio in `js/scene.js` or reduce the bloom pass in `js/views.js`.

## 📄 License

Add your preferred license here (for example MIT).

## 🙏 Credits

- Car and track assets included in the `public/models` folder.
- Built with Three.js.
- It was a project for LAB which was updated for more fun.
- Thanks to [@Sadik_Rahman](https://github.com/SadikRahman14)) for his massive contribution!
