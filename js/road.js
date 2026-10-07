import * as THREE from "three";

import { scene } from "./scene.js";
import { createSpline } from "../spline.js";

import vertexShader from "./shaders/roadVertex.glsl?raw";
import fragmentShader from "./shaders/roadFragment.glsl?raw";

const worldDown = new THREE.Vector3(0, -1, 0);


// ============================================================
// ROAD
// ============================================================

export class Road {
  constructor(mapConfig) {
    this.group = new THREE.Group();
    this.group.name = "race-road";

    scene.add(this.group);

    this.roadUniforms = {
      uTime: { value: 0 },
    };

    this.setMap(mapConfig);
  }


  // ==========================================================
  // CHANGE MAP
  // ==========================================================

  setMap(mapConfig) {
    this.clear();

    this.mapConfig = mapConfig;
    this.spline = createSpline(mapConfig);

    this.tubeRadius = mapConfig.tubeRadius ?? 0.65;
    this.roadWidth = mapConfig.roadWidth ?? 3.6;
    this.roadSegments = mapConfig.roadSegments ?? 1200;
    this.wallHeight = mapConfig.wallHeight ?? 0.22;

    this.trackLength = this.spline.getLength();
    this.roadUniforms.uTime.value = 0;

    this.build();
  }


  // ==========================================================
  // REMOVE OLD MAP OBJECTS
  // ==========================================================

  clear() {
    if (!this.group) return;

    while (this.group.children.length > 0) {
      const child = this.group.children[0];

      this.group.remove(child);

      child.geometry?.dispose?.();

      const materials = Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : [];

      for (const material of materials) {
        material.map?.dispose?.();
        material.dispose?.();
      }
    }
  }


  // ==========================================================
  // SHADER UPDATE
  // ==========================================================

  update(dt) {
    this.roadUniforms.uTime.value += dt * 0.5;
  }


  // ==========================================================
  // ROAD FRAME
  // ==========================================================

  getRoadFrame(p) {
    const wrapped = ((p % 1) + 1) % 1;

    const center = this.spline.getPointAt(wrapped);
    const tangent = this.spline.getTangentAt(wrapped).normalize();

    const floorDirection = worldDown
      .clone()
      .sub(
        tangent
          .clone()
          .multiplyScalar(worldDown.dot(tangent))
      )
      .normalize();

    const up = floorDirection.clone().negate();

    const right = new THREE.Vector3()
      .crossVectors(up, tangent)
      .normalize();

    return {
      center,
      tangent,
      floorDirection,
      up,
      right,
    };
  }


  // ==========================================================
  // POINT ON ROAD
  // ==========================================================

  surfacePoint(frame, offset, lift = 0) {
    return frame.center
      .clone()
      .addScaledVector(
        frame.floorDirection,
        this.tubeRadius - lift
      )
      .addScaledVector(
        frame.right,
        offset
      );
  }


  // ==========================================================
  // BUILD STRIP
  // ==========================================================

  buildStrip(
    pointA,
    pointB,
    {
      segments = this.roadSegments,
      p0 = 0,
      p1 = 1,
      vScale = 1,
    } = {}
  ) {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const frame = this.getRoadFrame(p0 + (p1 - p0) * t);

      const a = pointA(frame);
      const b = pointB(frame);

      positions.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z
      );

      uvs.push(
        0, t * vScale,
        1, t * vScale
      );
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;

      indices.push(
        a, b, c,
        b, d, c
      );
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(uvs, 2)
    );

    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }


  // ==========================================================
  // BUILD COMPLETE MAP
  // ==========================================================

  build() {
    this.buildMainRoad();

    this.createEdgeStripe(-this.roadWidth / 2 + 0.12);
    this.createEdgeStripe(this.roadWidth / 2 - 0.12);

    this.createDashedCenterStripe();

    this.createWall(1, 0xff2d8a);
    this.createWall(-1, 0x18d8ff);

    this.createStartLine();
  }


  // ==========================================================
  // MAIN ROAD
  // ==========================================================

  buildMainRoad() {
    this.roadGeo = this.buildStrip(
      (frame) => this.surfacePoint(
        frame,
        -this.roadWidth / 2
      ),
      (frame) => this.surfacePoint(
        frame,
        this.roadWidth / 2
      ),
      {
        vScale: 75,
      }
    );

    this.roadGeo.computeBoundingBox();
    this.roadGeo.computeBoundingSphere();

    this.mapCenter = new THREE.Vector3();
    this.roadGeo.boundingBox.getCenter(this.mapCenter);

    this.mapRadius = this.roadGeo.boundingSphere.radius;

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

    this.road = new THREE.Mesh(
      this.roadGeo,
      roadMat
    );

    this.group.add(this.road);

    const shaderRoad = new THREE.Mesh(
      this.roadGeo.clone(),
      new THREE.ShaderMaterial({
        uniforms: this.roadUniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    shaderRoad.position.y += 0.002;

    this.group.add(shaderRoad);
  }


  // ==========================================================
  // EDGE STRIPE
  // ==========================================================

  createEdgeStripe(offset) {
    const stripeWidth = 0.06;

    const geo = this.buildStrip(
      (frame) => this.surfacePoint(
        frame,
        offset - stripeWidth / 2,
        0.015
      ),
      (frame) => this.surfacePoint(
        frame,
        offset + stripeWidth / 2,
        0.015
      )
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

    const stripe = new THREE.Mesh(
      geo,
      mat
    );

    stripe.renderOrder = 2;

    this.group.add(stripe);
  }


  // ==========================================================
  // CENTER DASHES
  // ==========================================================

  createDashedCenterStripe() {
    const positions = [];
    const indices = [];

    const stripeWidth = 0.05;
    const dashLength = 0.9 / this.trackLength;
    const gapLength = 1.0 / this.trackLength;

    let vertexIndex = 0;

    for (
      let start = 0;
      start < 1;
      start += dashLength + gapLength
    ) {
      const end = Math.min(
        start + dashLength,
        1
      );

      const startFrame = this.getRoadFrame(start);
      const endFrame = this.getRoadFrame(end);

      const startLeft = this.surfacePoint(
        startFrame,
        -stripeWidth / 2,
        0.015
      );

      const startRight = this.surfacePoint(
        startFrame,
        stripeWidth / 2,
        0.015
      );

      const endLeft = this.surfacePoint(
        endFrame,
        -stripeWidth / 2,
        0.015
      );

      const endRight = this.surfacePoint(
        endFrame,
        stripeWidth / 2,
        0.015
      );

      positions.push(
        startLeft.x, startLeft.y, startLeft.z,
        startRight.x, startRight.y, startRight.z,
        endLeft.x, endLeft.y, endLeft.z,
        endRight.x, endRight.y, endRight.z
      );

      indices.push(
        vertexIndex,
        vertexIndex + 1,
        vertexIndex + 2,

        vertexIndex + 1,
        vertexIndex + 3,
        vertexIndex + 2
      );

      vertexIndex += 4;
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

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

    const dashes = new THREE.Mesh(
      geo,
      mat
    );

    dashes.renderOrder = 2;

    this.group.add(dashes);
  }


  // ==========================================================
  // WALLS
  // ==========================================================

  createWall(side, color) {
    const edge = side * (this.roadWidth / 2);

    const wallGeo = this.buildStrip(
      (frame) => this.surfacePoint(
        frame,
        edge,
        0
      ),
      (frame) => this.surfacePoint(
        frame,
        edge,
        this.wallHeight
      )
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

    this.group.add(wall);

    const rimGeo = this.buildStrip(
      (frame) => this.surfacePoint(
        frame,
        edge - 0.05,
        this.wallHeight
      ),
      (frame) => this.surfacePoint(
        frame,
        edge + 0.05,
        this.wallHeight
      )
    );

    const rim = new THREE.Mesh(
      rimGeo,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
      })
    );

    this.group.add(rim);
  }


  // ==========================================================
  // START LINE
  // ==========================================================

  createStartLine() {
    const cols = 12;
    const rows = 2;
    const cell = 16;

    const canvas = document.createElement("canvas");

    canvas.width = cols * cell;
    canvas.height = rows * cell;

    const ctx = canvas.getContext("2d");

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle =
          (x + y) % 2 === 0
            ? "#ffffff"
            : "#111111";

        ctx.fillRect(
          x * cell,
          y * cell,
          cell,
          cell
        );
      }
    }

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;

    const geo = this.buildStrip(
      (frame) => this.surfacePoint(
        frame,
        -this.roadWidth / 2 + 0.1,
        0.02
      ),
      (frame) => this.surfacePoint(
        frame,
        this.roadWidth / 2 - 0.1,
        0.02
      ),
      {
        segments: 4,
        p0: 0,
        p1: 0.6 / this.trackLength,
      }
    );

    const line = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
      })
    );

    line.renderOrder = 3;

    this.group.add(line);
  }
}