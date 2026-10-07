import * as THREE from "three";

import { scene } from "./scene.js";

let initialized = false;

let centerLight = null;
let lightMarker = null;

const heroLights = [];


// ============================================================
// LIGHT SETUP
// ============================================================

export function setupLights(road) {
  if (!initialized) {
    const hemiLight = new THREE.HemisphereLight(
      0xb8c7ff,
      0x120814,
      0.45
    );

    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(
      0xffb8d8,
      0.65
    );

    directionalLight.position.set(3, 5, 2);

    scene.add(directionalLight);

    centerLight = new THREE.PointLight(
      0xffc04d,
      0.25,
      0,
      2
    );

    scene.add(centerLight);

    lightMarker = new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        32,
        32
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffcc33,
        fog: false,
      })
    );

    scene.add(lightMarker);

    initialized = true;
  }

  updateMapLights(road);
}


// ============================================================
// MAP LIGHTS
// ============================================================

export function updateMapLights(road) {
  if (!centerLight || !lightMarker) {
    return;
  }

  centerLight.intensity =
    road.mapRadius *
    road.mapRadius *
    0.75;

  centerLight.position.copy(
    road.mapCenter
  );

  lightMarker.position.copy(
    road.mapCenter
  );
}


// ============================================================
// CAR HERO LIGHTS
// ============================================================

export function setupCarHeroLights(players) {
  if (heroLights.length > 0) {
    return;
  }

  players.forEach((player, index) => {
    const color =
      index === 0
        ? 0x8fd8ff
        : 0xff9aa8;

    const light = new THREE.PointLight(
      color,
      5.5,
      8,
      2
    );

    light.castShadow = false;

    scene.add(light);
    heroLights.push(light);
  });
}


// ============================================================
// UPDATE CAR HERO LIGHT POSITIONS
// ============================================================

export function updateCarHeroLights(players) {
  if (heroLights.length === 0) {
    return;
  }

  players.forEach((player, index) => {
    const light = heroLights[index];

    if (!light || !player?.car) {
      return;
    }

    light.position.copy(
      player.car.position
    );

    light.position.y += 2.2;
  });
}