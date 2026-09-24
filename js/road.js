import * as THREE from "three";
import spline from "../spline.js";
import { scene } from "./scene.js";
import vertexShader from "./shaders/roadVertex.glsl?raw";
import fragmentShader from "./shaders/roadFragment.glsl?raw";

// ---------------------------------------------------------------------------
// Road settings
// ---------------------------------------------------------------------------
const tubeRadius = 0.65; // vertical distance from the spline to the road surface
const roadWidth = 3.6; // (was 1.6) about 6 car-widths wide
const roadSegments = 1200;
const wallHeight = 0.22;
const trackLength = spline.getLength();
const worldDown = new THREE.Vector3(0, -1, 0);

function getRoadFrame(p) {
  const center = spline.getPointAt(p);
  const tangent = spline.getTangentAt(p).normalize();

  const floorDirection = worldDown
    .clone()
    .sub(tangent.clone().multiplyScalar(worldDown.dot(tangent)))
    .normalize();

  const up = floorDirection.clone().negate();
  const right = new THREE.Vector3().crossVectors(up, tangent).normalize();

  return { center, tangent, floorDirection, up, right };
}

// Point on the road surface: `offset` sideways along frame.right, `lift` above the surface
function surfacePoint(frame, offset, lift = 0) {
  return frame.center
    .clone()
    .addScaledVector(frame.floorDirection, tubeRadius - lift)
    .addScaledVector(frame.right, offset);
}

// Builds a ribbon between two edges that follow the track
function buildStrip(pointA, pointB, { segments = roadSegments, p0 = 0, p1 = 1, vScale = 1 } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const frame = getRoadFrame(p0 + (p1 - p0) * t);
    const a = pointA(frame);
    const b = pointB(frame);

    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uvs.push(0, t * vScale, 1, t * vScale);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Main road surface
// ---------------------------------------------------------------------------
const roadGeo = buildStrip(
  (f) => surfacePoint(f, -roadWidth / 2),
  (f) => surfacePoint(f, roadWidth / 2),
  { vScale: 75 }
);

roadGeo.computeBoundingBox();
roadGeo.computeBoundingSphere();

const mapCenter = new THREE.Vector3();
roadGeo.boundingBox.getCenter(mapCenter);
const mapRadius = roadGeo.boundingSphere.radius;

export const roadUniforms = {
  uTime: { value: 0 },
};

const roadMat = new THREE.MeshPhysicalMaterial({
  color: 0x3a0828,
  emissive: 0x220014,
  emissiveIntensity: 0.45,
  roughness: 0.4,
  metalness: 0.15,
  clearcoat: 0.55,
  clearcoatRoughness: 0.3,
  side: THREE.DoubleSide,
});

const road = new THREE.Mesh(roadGeo, roadMat);
scene.add(road);

// Animated glow lines
const shaderRoad = new THREE.Mesh(
  roadGeo.clone(),
  new THREE.ShaderMaterial({
    uniforms: roadUniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
);
shaderRoad.position.y += 0.002;
scene.add(shaderRoad);

// ---------------------------------------------------------------------------
// Road markings
// ---------------------------------------------------------------------------
function createEdgeStripe(offset) {
  const stripeWidth = 0.06;

  const geo = buildStrip(
    (f) => surfacePoint(f, offset - stripeWidth / 2, 0.015),
    (f) => surfacePoint(f, offset + stripeWidth / 2, 0.015)
  );

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffd000,
    emissive: 0x111100,
    emissiveIntensity: 0.35,
    roughness: 0.65,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.7,
    side: THREE.DoubleSide,
  });

  const stripe = new THREE.Mesh(geo, mat);
  stripe.renderOrder = 2;
  scene.add(stripe);
}

function createDashedCenterStripe() {
  const positions = [];
  const indices = [];

  const stripeWidth = 0.05;
  const dashLength = 0.9 / trackLength; // progress units (0.9 world units)
  const gapLength = 1.0 / trackLength;

  let vertexIndex = 0;

  for (let start = 0; start < 1; start += dashLength + gapLength) {
    const end = Math.min(start + dashLength, 1);

    const startFrame = getRoadFrame(start);
    const endFrame = getRoadFrame(end);

    const startLeft = surfacePoint(startFrame, -stripeWidth / 2, 0.015);
    const startRight = surfacePoint(startFrame, stripeWidth / 2, 0.015);
    const endLeft = surfacePoint(endFrame, -stripeWidth / 2, 0.015);
    const endRight = surfacePoint(endFrame, stripeWidth / 2, 0.015);

    positions.push(
      startLeft.x, startLeft.y, startLeft.z,
      startRight.x, startRight.y, startRight.z,
      endLeft.x, endLeft.y, endLeft.z,
      endRight.x, endRight.y, endRight.z
    );

    indices.push(
      vertexIndex, vertexIndex + 1, vertexIndex + 2,
      vertexIndex + 1, vertexIndex + 3, vertexIndex + 2
    );

    vertexIndex += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffcc00,
    emissiveIntensity: 0.8,
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    side: THREE.DoubleSide,
  });

  const dashes = new THREE.Mesh(geo, mat);
  dashes.renderOrder = 2;
  scene.add(dashes);
}

createEdgeStripe(-roadWidth / 2 + 0.12);
createEdgeStripe(roadWidth / 2 - 0.12);
createDashedCenterStripe();

// ---------------------------------------------------------------------------
// Guard walls: glowing barriers on both sides so cars can never leave the road
// (the physical collision is handled in player.js using roadWidth)
// ---------------------------------------------------------------------------
function createWall(side, color) {
  const edge = side * (roadWidth / 2);

  const wallGeo = buildStrip(
    (f) => surfacePoint(f, edge, 0),
    (f) => surfacePoint(f, edge, wallHeight)
  );

  const wall = new THREE.Mesh(
    wallGeo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(wall);

  const rimGeo = buildStrip(
    (f) => surfacePoint(f, edge - 0.05, wallHeight),
    (f) => surfacePoint(f, edge + 0.05, wallHeight)
  );

  const rim = new THREE.Mesh(
    rimGeo,
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );
  scene.add(rim);
}

createWall(1, 0xff2d8a); // car's left side (pink)
createWall(-1, 0x18d8ff); // car's right side (cyan)

// ---------------------------------------------------------------------------
// Start / finish line (checkered), located at progress 0
// ---------------------------------------------------------------------------
function createStartLine() {
  const cols = 12;
  const rows = 2;
  const cell = 16;

  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#111111";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;

  const geo = buildStrip(
    (f) => surfacePoint(f, -roadWidth / 2 + 0.1, 0.02),
    (f) => surfacePoint(f, roadWidth / 2 - 0.1, 0.02),
    { segments: 4, p0: 0, p1: 0.6 / trackLength }
  );

  const line = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  line.renderOrder = 3;
  scene.add(line);
}

createStartLine();

export {
  road,
  roadGeo,
  tubeRadius,
  roadWidth,
  roadSegments,
  trackLength,
  mapCenter,
  mapRadius,
  getRoadFrame,
};
