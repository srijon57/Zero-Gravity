import * as THREE from "three";

import { scene } from "./scene.js";


let initialized = false;

let centerLight = null;

let lightMarker = null;


export function setupLights(road) {

  if (!initialized) {

    // General ambient lighting

    const hemiLight =
      new THREE.HemisphereLight(
        0xb8c7ff,
        0x401020,
        1.4
      );


    scene.add(
      hemiLight
    );


    // Directional light

    const directionalLight =
      new THREE.DirectionalLight(
        0xffb8d8,
        0.65
      );


    directionalLight.position.set(
      3,
      5,
      2
    );


    scene.add(
      directionalLight
    );


    // Map centre light

    centerLight =
      new THREE.PointLight(
        0xffc04d,
        0.25,
        0,
        2
      );


    scene.add(
      centerLight
    );


    // Visible centre marker

    lightMarker =
      new THREE.Mesh(

        new THREE.SphereGeometry(
          1,
          32,
          32
        ),

        new THREE.MeshBasicMaterial({
          color: 0xffcc33,
          fog: false
        })

      );


    scene.add(
      lightMarker
    );


    initialized = true;

  }


  updateMapLights(
    road
  );

}


export function updateMapLights(road) {

  if (
    !centerLight ||
    !lightMarker
  ) {
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