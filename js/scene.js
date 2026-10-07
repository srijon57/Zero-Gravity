import * as THREE from "three";
import { createStarBackground } from "./background.js";

const width = window.innerWidth;
const height = window.innerHeight;


// ============================================================
// SCENE
// ============================================================

const scene = new THREE.Scene();

scene.fog = new THREE.FogExp2(
  0x090814,
  0.02
);

createStarBackground(scene);


// ============================================================
// RENDERER
// ============================================================

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setSize(width, height);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);


// ============================================================
// COLOR MANAGEMENT
// ============================================================

renderer.outputColorSpace = THREE.SRGBColorSpace;


// ============================================================
// TONE MAPPING
// ============================================================

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;


// ============================================================
// SHADOWS
// ============================================================

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;


// ============================================================
// DOM
// ============================================================

document.body.appendChild(renderer.domElement);

export {
  scene,
  renderer,
};