import * as THREE from "three";
import { createStarBackground } from "./background.js";

const width = window.innerWidth;
const height = window.innerHeight;

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x090814, 0.02);

// Star-space background (nebula + stars)
createStarBackground(scene);

// Renderer (split-screen rendering, composers and cameras live in views.js)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMappingExposure = 1.25;

document.body.appendChild(renderer.domElement);

export { scene, renderer };
