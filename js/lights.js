import * as THREE from "three";
import { scene } from "./scene.js";
import { mapCenter, mapRadius } from "./road.js";

// General lights
const hemiLight = new THREE.HemisphereLight(0xb8c7ff, 0x401020, 3);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffb8d8, 0.65);
directionalLight.position.set(3, 5, 2);
scene.add(directionalLight);

// Centre light: fixed in the middle of the map (no more mouse control)
const centerLight = new THREE.PointLight(0xffc04d, 0.25, 0, 2);
centerLight.intensity = mapRadius * mapRadius * 0.75;
centerLight.position.copy(mapCenter);
scene.add(centerLight);

// Visible light marker
const lightMarker = new THREE.Mesh(
  new THREE.SphereGeometry(1.0, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffcc33,
    fog: false,
  })
);
lightMarker.position.copy(mapCenter);
scene.add(lightMarker);
