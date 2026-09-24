import * as THREE from "three";

// Small deterministic random generator so the sky looks the same every time
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Equirectangular night sky: black space, deep-blue nebula clouds, thousands of stars
function createSkyTexture() {
  const W = 4096;
  const H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(2024);

  ctx.fillStyle = "#01020a";
  ctx.fillRect(0, 0, W, H);

  // --- Nebula clouds (soft blue blobs, drawn additively) ---
  ctx.globalCompositeOperation = "lighter";

  const drawBlob = (x, y, r, color, alpha) => {
    // draw three times so the sky wraps seamlessly at the left/right edge
    for (const dx of [-W, 0, W]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  };

  for (let c = 0; c < 16; c++) {
    const cx = rand() * W;
    const cy = H * (0.15 + 0.7 * rand());

    for (let i = 0; i < 45; i++) {
      const x = cx + (rand() - 0.5) * 800;
      const y = cy + (rand() - 0.5) * 420;
      const r = 90 + rand() * 280;
      const alpha = 0.04 + rand() * 0.06;
      const color = rand() < 0.85 ? "24,62,185" : "70,40,150";
      drawBlob(x, y, r, color, alpha);
    }
  }

  // --- Dense star dust ---
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < 7000; i++) {
    // uniform distribution over a sphere
    const lat = Math.asin(2 * rand() - 1);
    const x = rand() * W;
    const y = (0.5 - lat / Math.PI) * H;

    const r = 0.45 + Math.pow(rand(), 5) * 1.7;
    const stretch = 1 / Math.max(Math.cos(lat), 0.2); // undo equirect squeeze near poles
    const tint = rand();
    const color =
      tint < 0.7 ? "255,255,255" : tint < 0.88 ? "190,215,255" : "255,235,200";

    ctx.fillStyle = `rgba(${color},${0.45 + rand() * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * stretch, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  // The post-processing chain writes linear values straight to the screen (same as the
  // original project), so the painted colours are used as-is instead of being converted.
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

// Glowing 4-point sparkle sprite for the brighter stars
function createSparkleTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;

  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.12, "rgba(220,235,255,0.75)");
  glow.addColorStop(0.35, "rgba(140,180,255,0.18)");
  glow.addColorStop(1, "rgba(80,120,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // cross-shaped spikes
  ctx.globalCompositeOperation = "lighter";
  for (const [w, h] of [
    [size, 3],
    [3, size],
  ]) {
    const g = ctx.createLinearGradient(c - w / 2, c - h / 2, c + w / 2, c + h / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(c - w / 2, c - h / 2, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createStarBackground(scene) {
  scene.background = createSkyTexture();

  // Brighter twinkling stars on a huge sphere around the world
  const sparkle = createSparkleTexture();
  const rand = mulberry32(99);

  const groups = [
    { count: 900, size: 5 },
    { count: 260, size: 9 },
    { count: 70, size: 16 },
  ];

  for (const { count, size } of groups) {
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const radius = 900;

      positions[i * 3] = Math.cos(theta) * s * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = Math.sin(theta) * s * radius;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      map: sparkle,
      size,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xcfe0ff,
      fog: false,
    });

    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    scene.add(stars);
  }
}
