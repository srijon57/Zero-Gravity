import * as THREE from "three";
import "./css/style.css";

import { Game } from "./js/game.js";
import { setupLandingScreen } from "./js/landing.js";

const game = new Game();
const clock = new THREE.Clock();

let looping = false;

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  game.update(dt);
  game.render(dt);
}

// The landing screen lets the players pick the number of laps, then the race starts
setupLandingScreen(async (laps) => {
  await game.ready;
  game.start(laps);

  if (!looping) {
    looping = true;
    clock.getDelta();
    animate();
  }
});
