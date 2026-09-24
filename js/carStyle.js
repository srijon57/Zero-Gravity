import * as THREE from "three";

const DEFAULT_STYLE = {
  body: 0x1976d2,
  edge: 0x00aaff,
  emissive: 0x061827,
};

export function applyCarStyle(car, style = {}) {
  const { body, edge, emissive } = { ...DEFAULT_STYLE, ...style };
  const wheels = [];

  car.traverse((child) => {
    if (!child.isMesh) return;

    const name = child.name.toLowerCase();

    // BODY
    if (name === "body") {
      const oldMat = child.material;

      child.material = new THREE.MeshPhysicalMaterial({
        map: oldMat.map,
        color: body,
        metalness: 0.55,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        iridescence: 0.35,
        iridescenceIOR: 1.3,
        emissive: emissive,
        emissiveIntensity: 0.25
      });

      const bodyEdges = new THREE.EdgesGeometry(child.geometry, 30);

      const bodyEdgeMat = new THREE.LineBasicMaterial({
        color: edge,
        transparent: true,
        opacity: 0.8
      });

      const bodyOutline = new THREE.LineSegments(
        bodyEdges,
        bodyEdgeMat
      );

      child.add(bodyOutline);
    }

    // WHEELS
    if (name.includes("wheel")) {
      child.material = child.material.clone();
      child.material.color.set(0x111111);

      child.geometry.computeBoundingBox();

      const box = child.geometry.boundingBox;

      const wheelSize = new THREE.Vector3();
      box.getSize(wheelSize);

      const wheelRadius =
        Math.min(wheelSize.y, wheelSize.z) / 1.51;

      const markerRadius = wheelRadius * 0.68;
      const markerSize = wheelRadius * 0.08;

      const side = name.includes("left") ? 1 : -1;

      // RIM
      const rimRadius = wheelRadius * 0.38;
      const rimDepth = 0.025;

      const rimGeo = new THREE.CylinderGeometry(
        rimRadius,
        rimRadius,
        rimDepth,
        24
      );

      rimGeo.rotateZ(Math.PI / 2);

      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        metalness: 0.6,
        roughness: 0.25,
        emissive: 0x333333,
        emissiveIntensity: 0.4
      });

      const rim = new THREE.Mesh(rimGeo, rimMat);

      const outerFaceX = name.includes("left")
        ? box.max.x
        : box.min.x;

      rim.position.x =
        outerFaceX + side * (rimDepth / 2 + 0.005);

      child.add(rim);

      // CYAN WHEEL MARKERS
      const markerGeo = new THREE.SphereGeometry(
        markerSize,
        8,
        8
      );

      const markerMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff
      });

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;

        const marker = new THREE.Mesh(
          markerGeo,
          markerMat
        );

        marker.position.set(
          side * wheelSize.x * 0.51,
          Math.cos(angle) * markerRadius,
          Math.sin(angle) * markerRadius
        );

        child.add(marker);
      }

      wheels.push(child);
    }
  });

  return wheels;
}