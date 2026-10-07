import * as THREE from "three";


// ============================================================
// DETERMINISTIC RANDOM
// ============================================================

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;

    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ============================================================
// SKY TEXTURE
// ============================================================

function createSkyTexture() {
  const W = 4096;
  const H = 2048;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  const rand = mulberry32(2026);


  // ==========================================================
  // BASE SPACE GRADIENT
  // ==========================================================

  const baseGradient = ctx.createLinearGradient(0, 0, 0, H);

  baseGradient.addColorStop(0, "#050817");
  baseGradient.addColorStop(0.42, "#09132b");
  baseGradient.addColorStop(0.62, "#070d20");
  baseGradient.addColorStop(1, "#030510");

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, W, H);


  // ==========================================================
  // HELPERS
  // ==========================================================

  function drawBlob(x, y, radius, color, alpha) {
    for (const offsetX of [-W, 0, W]) {
      const gradient = ctx.createRadialGradient(
        x + offsetX,
        y,
        0,
        x + offsetX,
        y,
        radius
      );

      gradient.addColorStop(0, `rgba(${color},${alpha})`);
      gradient.addColorStop(0.45, `rgba(${color},${alpha * 0.35})`);
      gradient.addColorStop(1, `rgba(${color},0)`);

      ctx.fillStyle = gradient;

      ctx.fillRect(
        x + offsetX - radius,
        y - radius,
        radius * 2,
        radius * 2
      );
    }
  }


  // ==========================================================
  // GALACTIC RIFT
  // ==========================================================

  ctx.globalCompositeOperation = "lighter";

  const riftCenterY = H * 0.48;
  const RIFT_POINTS = 34;

  for (let i = 0; i < RIFT_POINTS; i++) {
    const t = i / (RIFT_POINTS - 1);
    const x = t * W;

    const y =
      riftCenterY +
      Math.sin(t * Math.PI * 2.2) * 125 +
      (t - 0.5) * -240;


    // ========================================================
    // LARGE BLUE CLOUD
    // ========================================================

    drawBlob(
      x,
      y,
      240 + rand() * 210,
      "28,55,150",
      0.07 + rand() * 0.035
    );


    // ========================================================
    // VIOLET CORE
    // ========================================================

    if (rand() > 0.30) {
      drawBlob(
        x + (rand() - 0.5) * 180,
        y + (rand() - 0.5) * 130,
        120 + rand() * 170,
        "83,45,155",
        0.035 + rand() * 0.025
      );
    }


    // ========================================================
    // OCCASIONAL CYAN HAZE
    // ========================================================

    if (rand() > 0.68) {
      drawBlob(
        x + (rand() - 0.5) * 240,
        y + (rand() - 0.5) * 150,
        110 + rand() * 150,
        "30,115,175",
        0.025 + rand() * 0.018
      );
    }
  }


  // ==========================================================
  // SUBTLE MAGENTA REGION
  // ==========================================================

  for (let i = 0; i < 5; i++) {
    drawBlob(
      W * 0.74 + (rand() - 0.5) * 420,
      H * 0.36 + (rand() - 0.5) * 220,
      180 + rand() * 240,
      "125,35,125",
      0.025 + rand() * 0.018
    );
  }


  // ==========================================================
  // STAR FIELD
  // ==========================================================

  ctx.globalCompositeOperation = "source-over";

  const STAR_COUNT = 2600;

  for (let i = 0; i < STAR_COUNT; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const brightness = rand();

    let radius;
    let alpha;

    if (brightness > 0.985) {
      radius = 1.5 + rand() * 1.3;
      alpha = 0.80 + rand() * 0.20;
    } else if (brightness > 0.90) {
      radius = 0.75 + rand() * 0.65;
      alpha = 0.60 + rand() * 0.25;
    } else {
      radius = 0.35 + rand() * 0.45;
      alpha = 0.25 + rand() * 0.45;
    }

    const tint = rand();
    let color;

    if (tint < 0.74) {
      color = "230,240,255";
    } else if (tint < 0.90) {
      color = "175,205,255";
    } else {
      color = "255,220,195";
    }

    ctx.fillStyle = `rgba(${color},${alpha})`;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }


  // ==========================================================
  // CREATE THREE.JS TEXTURE
  // ==========================================================

  const texture = new THREE.CanvasTexture(canvas);

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}


// ============================================================
// BRIGHT STAR SPRITE
// ============================================================

function createSparkleTexture() {
  const size = 128;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const center = size / 2;


  // ==========================================================
  // CORE GLOW
  // ==========================================================

  const glow = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center
  );

  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.08, "rgba(225,235,255,0.85)");
  glow.addColorStop(0.25, "rgba(120,160,255,0.22)");
  glow.addColorStop(1, "rgba(80,100,220,0)");

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);


  // ==========================================================
  // VERY SUBTLE CROSS
  // ==========================================================

  ctx.globalCompositeOperation = "lighter";

  const horizontal = ctx.createLinearGradient(
    0,
    center,
    size,
    center
  );

  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,0.45)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = horizontal;
  ctx.fillRect(0, center - 1, size, 2);

  const vertical = ctx.createLinearGradient(
    center,
    0,
    center,
    size
  );

  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.5, "rgba(255,255,255,0.35)");
  vertical.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = vertical;
  ctx.fillRect(center - 1, 0, 2, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}


// ============================================================
// PUBLIC BACKGROUND SETUP
// ============================================================

export function createStarBackground(scene) {
  scene.background = createSkyTexture();

  const sparkle = createSparkleTexture();
  const rand = mulberry32(99);

  const groups = [
    {
      count: 160,
      size: 3.2,
      opacity: 0.55,
    },
    {
      count: 55,
      size: 5.5,
      opacity: 0.65,
    },
    {
      count: 12,
      size: 8.5,
      opacity: 0.75,
    },
  ];

  for (const { count, size, opacity } of groups) {
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const horizontal = Math.sqrt(1 - u * u);
      const radius = 650 + rand() * 300;

      positions[i * 3] =
        Math.cos(theta) *
        horizontal *
        radius;

      positions[i * 3 + 1] =
        u * radius;

      positions[i * 3 + 2] =
        Math.sin(theta) *
        horizontal *
        radius;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({
      map: sparkle,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xbfd8ff,
      fog: false,
    });

    const stars = new THREE.Points(
      geometry,
      material
    );

    stars.frustumCulled = false;

    scene.add(stars);
  }
}