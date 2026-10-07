# Zero Gravity

Zero Gravity is a browser-based 3D racing game developed with **Three.js**, **Vite**, and **Vanilla JavaScript**.

The game supports both **local two-player split-screen racing** and **single-player racing against NOVA AI**. Players race across neon tracks suspended in a procedurally generated space environment, using nitro boosts, collision mechanics, dynamic lighting, minimaps, post-processing effects, and a complete race management system.

The project originally began as an academic laboratory project and was later expanded into a more complete and polished racing experience.

<!-- Add a screenshot or GIF here -->
<!-- Example: ![Zero Gravity Gameplay](docs/gameplay.png) -->

## Features

### Game Modes

- **VS AI**
  - Single-player full-screen racing against NOVA AI.
  - AI uses the same underlying vehicle physics as the player.
  - Includes autonomous steering, braking, acceleration, collision avoidance, and nitro usage.
  - NOVA AI is configured as a challenging opponent.

- **Local Two-Player**
  - Top-and-bottom split-screen multiplayer.
  - Each player has an independent chase camera, HUD, minimap, and post-processing pipeline.
  - Both players share a single keyboard.

### Race System

- Configurable race length from **1 to 20 laps**.
- Quick lap presets for 1, 3, 5, and 10 laps.
- 3-2-1-GO race countdown.
- Real-time race positions.
- Individual lap timing.
- Best-lap tracking.
- Finish-time tracking.
- Final race results screen.
- Restart and main-menu options.
- Pause menu with Resume, Restart, and Main Menu controls.

### Track System

- Multiple selectable tracks.
- Track difficulty displayed from **L1 to L5**.
- Closed-loop spline-based race tracks.
- Dynamic road generation using Three.js geometry.
- Neon edge markings and center markings.
- Guard walls that prevent vehicles from leaving the track.
- Checkered start and finish line.
- Animated road shader effects.

### Vehicle Physics

- Acceleration and deceleration.
- Braking and reverse movement.
- Speed-dependent steering.
- Nitro-enhanced acceleration and top speed.
- Nitro depletion and recharge.
- Road-boundary collision handling.
- Wall-impact speed penalties.
- Continuous wall-scraping resistance.
- Car-to-car collision detection.
- Side-contact separation.
- Front and rear collision handling.
- Momentum transfer between vehicles.

### Nitro System

Each vehicle includes a limited nitro reserve. While active, nitro increases acceleration and maximum speed, produces animated exhaust flames, and drains the nitro meter. Nitro automatically recharges when it is not being used.

### Minimap

The game includes a player-oriented minimap system featuring:

- complete track outline;
- highlighted road section ahead;
- player position indicators;
- opponent position indicators;
- start-line indicator;
- separate minimaps for both players in local multiplayer;
- a single minimap in VS AI mode.

### Rendering and Visual Effects

- Three.js WebGL rendering.
- ACES Filmic tone mapping.
- sRGB color management.
- Unreal Bloom post-processing.
- Independent bloom rendering for split-screen players.
- Full-screen bloom pipeline in AI mode.
- Dynamic scene lighting.
- Per-car hero lighting.
- Neon road and wall materials.
- Procedurally generated space background.
- Nebula effects and star fields.

### Camera System

Each player uses an independent chase camera with smooth positional interpolation, automatic road orientation, perspective projection, nitro-based field-of-view expansion, and independent aspect-ratio handling for split-screen and full-screen modes.

### Audio System

The game contains a custom audio system for procedural engine sound, speed-dependent engine pitch, wind noise, braking sound, nitro activation, vehicle impacts, race countdown, GO signal, lap completion, final lap, and finish events.

Audio behavior changes depending on the selected game mode so unnecessary opponent audio does not interfere with the player experience.

## Controls

### Player 1

| Action | Key |
| --- | --- |
| Accelerate | `W` |
| Brake / Reverse | `S` |
| Steer Left | `A` |
| Steer Right | `D` |
| Nitro | `Space` or `Left Shift` |

### Player 2

Player 2 controls are used in local multiplayer mode.

| Action | Key |
| --- | --- |
| Accelerate | `↑` |
| Brake / Reverse | `↓` |
| Steer Left | `←` |
| Steer Right | `→` |
| Nitro | `Enter`, `Right Shift`, or `Numpad 0` |

Some keyboards have limited simultaneous key registration. If controls stop responding while both players are pressing several keys, use one of the alternative nitro keys.

## How to Play

1. Open the game.
2. Select either **2 Players** or **VS AI**.
3. Select a track.
4. Choose the number of laps.
5. Click **Start Race**.
6. Wait for the countdown to finish.
7. Accelerate, steer, brake, and use nitro strategically.
8. Complete the required number of laps before the opponent.
9. Review the race results after finishing.
10. Restart the race or return to the main menu.

Press `Esc` during a race to open the pause menu.

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A modern browser with WebGL support

Recommended browsers include Google Chrome, Microsoft Edge, Mozilla Firefox, and Safari.

### Clone the Repository

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### Install Dependencies

```bash
npm install
```

### Start the Development Server

```bash
npm run dev
```

Vite will print a local development URL in the terminal, commonly:

```text
http://localhost:5173
```

## Production Build

```bash
npm run build
```

The generated application will be placed in `dist/`.

Preview the production build locally with:

```bash
npm run preview
```

## Deployment with GitHub Pages

If the application is hosted at:

```text
https://<username>.github.io/<repository>/
```

configure the repository base path in `vite.config.js`:

```js
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/<repository>/",
  plugins: [tailwindcss()],
});
```

Then run:

```bash
npm run build
```

Publish the generated `dist/` directory using GitHub Actions, `gh-pages`, or another deployment workflow.

## Project Structure

```text
.
├── index.html
├── index.js
├── spline.js
├── vite.config.js
├── css/
│   └── style.css
├── public/
│   ├── audio/
│   ├── models/
│   │   └── race.glb
│   └── textures/
└── js/
    ├── aiController.js
    ├── assets.js
    ├── audio.js
    ├── background.js
    ├── camera.js
    ├── carStyle.js
    ├── game.js
    ├── hud.js
    ├── input.js
    ├── landing.js
    ├── lights.js
    ├── minimap.js
    ├── nitrous.js
    ├── player.js
    ├── road.js
    ├── scene.js
    ├── views.js
    ├── maps/
    │   └── ...
    └── shaders/
        ├── roadVertex.glsl
        └── roadFragment.glsl
```

## Main Modules

### `game.js`

Controls the overall race lifecycle, including game state, countdown, player creation, selected game mode, lap handling, finish detection, collision handling, audio updates, pause behavior, and race results.

### `player.js`

Contains the main vehicle simulation logic, including acceleration, braking, reverse movement, steering, nitro, wall collisions, lap progress, vehicle positioning, and car-to-car collision response.

### `aiController.js`

Controls NOVA AI behavior, including road analysis, steering decisions, acceleration, braking, nitro usage, collision avoidance, and road-centering behavior.

### `road.js`

Generates the race track and related geometry, including the road surface, edge stripes, center markings, guard walls, start line, and shader overlay.

### `views.js`

Manages rendering for both game modes. Local multiplayer uses two vertically stacked viewports, while AI mode gives Player 1 the complete browser viewport.

### `minimap.js`

Generates the minimap dynamically from the active road spline and displays both vehicle positions.

### `audio.js`

Handles vehicle and race audio, including procedural engine synthesis and gameplay sound effects.

### `background.js`

Generates the space environment, including stars and nebula-style background effects.

## Configuration

| Configuration | File |
| --- | --- |
| Maximum speed | `js/player.js` |
| Acceleration | `js/player.js` |
| Braking | `js/player.js` |
| Nitro speed | `js/player.js` |
| Nitro drain and recharge | `js/player.js` |
| Steering behavior | `js/player.js` |
| Car collision dimensions | `js/player.js` |
| Road width | `js/road.js` |
| Wall height | `js/road.js` |
| Track spline | `spline.js` / map configuration |
| Camera FOV | `js/camera.js` |
| Camera distance | `js/camera.js` |
| Camera height | `js/camera.js` |
| Player configuration | `js/game.js` |
| AI behavior | `js/aiController.js` |
| Lighting | `js/lights.js` |
| Bloom | `js/views.js` |
| Minimap dimensions | `js/minimap.js` |
| Audio configuration | `js/audio.js` |

## Technology Stack

- **Three.js** — 3D rendering, geometry, spline-based tracks, vehicle models, lighting, cameras, GLTF loading, shaders, and post-processing.
- **Vite** — development server, module loading, asset handling, and production builds.
- **Tailwind CSS** — landing-page interface and supporting UI styling.
- **Vanilla JavaScript** — game architecture, physics, AI, race system, input handling, HUD, and rendering logic.

## Performance Notes

Split-screen mode is more computationally expensive than single-player mode because the scene is rendered once for each player.

If performance is limited, possible optimizations include:

- lowering the renderer pixel ratio;
- reducing bloom resolution or strength;
- reducing road geometry segments;
- reducing background particle counts;
- simplifying lighting;
- reducing expensive material effects.

Relevant rendering settings are primarily located in:

```text
js/scene.js
js/views.js
js/background.js
js/road.js
```

## Troubleshooting

### Black Screen or No Rendering

Check the browser developer console for JavaScript or WebGL errors. Also verify that hardware acceleration and WebGL are enabled.

### Car Model Does Not Load

Confirm that the car model exists at:

```text
public/models/race.glb
```

Files inside Vite's `public` directory are served from the application root.

### Audio Does Not Start Immediately

Modern browsers restrict automatic audio playback. The game initializes audio after user interaction, such as pressing the Start Race button.

### Low Frame Rate

Try lowering the device pixel ratio in `js/scene.js`, reducing bloom processing in `js/views.js`, reducing road segment count, reducing background stars, or closing other GPU-intensive applications.

### Keyboard Inputs Are Not Registered

This may be caused by keyboard ghosting when many keys are pressed simultaneously. Use the alternative nitro keys where necessary.

## Future Improvements

Possible future additions include:

- additional vehicle models;
- vehicle selection;
- more track environments;
- improved AI racing strategies;
- racing statistics;
- persistent best-lap records;
- controller support;
- online multiplayer;
- additional visual effects;
- improved collision physics.

## License

A license has not yet been specified. For public distribution, consider adding a standard open-source license such as the MIT License.

## Credits

- Developed using Three.js and Vite.
- Vehicle and related assets are stored under the project's `public` directory.
- Originally developed as a laboratory project and later expanded with additional gameplay, AI, visual, audio, and user-interface systems.
- Special thanks to [Sadik Rahman](https://github.com/SadikRahman14) for his significant contribution to the project.
