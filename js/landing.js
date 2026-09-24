import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyCarStyle } from "./carStyle.js";
import { CAR_URL } from "./assets.js";

export function setupLandingScreen(onStartRace) {
  const landing = document.createElement("div");

  landing.className = `
    fixed inset-0 z-50 overflow-hidden
    bg-[#050507]
    transition-opacity duration-700
  `;

  landing.innerHTML = `
    <!-- BACKGROUND GLOWS -->
    <div class="
      pointer-events-none absolute -left-40 top-1/2
      h-[600px] w-[600px] -translate-y-1/2
      rounded-full bg-red-700/10 blur-[160px]
    "></div>

    <div class="
      pointer-events-none absolute right-[-150px] top-[-150px]
      h-[600px] w-[600px]
      rounded-full bg-cyan-500/8 blur-[180px]
    "></div>


    <!-- TOP BAR -->
    <div class="
      absolute left-0 top-0 z-20
      flex w-full items-center justify-between
      px-10 py-8 md:px-16
    ">
      <div class="flex items-center gap-3">
        <div class="
          h-2 w-2 rounded-full
          bg-red-500
          shadow-[0_0_14px_#ef4444]
        "></div>

        <span class="
          text-[10px] uppercase
          tracking-[0.4em]
          text-white/40
        ">
          TWO PLAYERS · ONE KEYBOARD
        </span>
      </div>

      <span class="
        hidden text-[10px]
        tracking-[0.3em]
        text-white/25 md:block
      ">
        // 2 PLAYER SPLIT-SCREEN RACE
      </span>
    </div>


    <!-- MAIN -->
    <main class="
      relative z-10 mx-auto
      grid min-h-screen
      max-w-[1500px]
      grid-cols-1
      items-center
      px-8
      md:grid-cols-[0.85fr_1.15fr]
      md:px-16
      lg:px-24
    ">

      <!-- LEFT -->
      <section class="
        z-20 flex flex-col
        items-start justify-center
      ">

        <div class="
          mb-6 flex items-center gap-4
        ">
          <div class="
            h-px w-12
            bg-gradient-to-r
            from-red-500 to-transparent
          "></div>

          <span class="
            text-[10px]
            uppercase
            tracking-[0.55em]
            text-red-400
          ">
            Beyond the road
          </span>
        </div>


        <h1 class="
          text-[64px]
          font-black
          uppercase
          leading-[0.82]
          tracking-[-0.06em]
          text-white
          sm:text-[85px]
          lg:text-[115px]
        ">
          ZERO
          <span class="
            block
            bg-gradient-to-r
            from-white
            via-white
            to-white/30
            bg-clip-text
            text-transparent
          ">
            GRAVITY
          </span>
        </h1>


        <p class="
          mt-8 max-w-md
          text-sm
          leading-7
          tracking-[0.06em]
          text-white/40
        ">
          Two drivers, one keyboard, one zero-gravity track
          floating through space. Pick your laps and race.
        </p>


        <div class="mt-10 w-full max-w-md">

          <div class="mb-3 text-[10px] uppercase tracking-[0.4em] text-white/40">
            Number of laps
          </div>

          <div class="flex flex-wrap items-center gap-4">
            <button id="lap-minus" class="lap-step" aria-label="Fewer laps">&minus;</button>
            <div id="lap-value" class="lap-value">3</div>
            <button id="lap-plus" class="lap-step" aria-label="More laps">+</button>

            <div class="ml-2 flex gap-2">
              <button class="lap-chip" data-laps="1">1</button>
              <button class="lap-chip" data-laps="3">3</button>
              <button class="lap-chip" data-laps="5">5</button>
              <button class="lap-chip" data-laps="10">10</button>
            </div>
          </div>

          <button
            id="start-race"
            class="
              mt-8
              border border-red-500/60
              bg-red-600
              px-10 py-4
              text-xs
              font-semibold
              uppercase
              tracking-[0.3em]
              text-white
              transition-all
              duration-300
              hover:bg-red-500
              hover:shadow-[0_0_35px_rgba(239,68,68,0.5)]
            "
          >
            Start Race
          </button>

        </div>


        <div class="mt-12 grid gap-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <div class="flex items-center gap-4">
            <span class="w-24 font-bold text-[#2aa8ff]">Player 1</span>
            <span>W A S D &nbsp;·&nbsp; Space = Nitro</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="w-24 font-bold text-[#ff4d4d]">Player 2</span>
            <span>&uarr; &larr; &darr; &rarr; &nbsp;·&nbsp; Enter = Nitro</span>
          </div>
        </div>

      </section>


      <!-- RIGHT SHOWROOM -->
      <section class="
        relative flex
        h-[600px]
        items-center
        justify-center
      ">

        <!-- BACKPLATE -->
        <div class="
          absolute
          h-[430px]
          w-[430px]
          rounded-full
          border border-white/[0.04]
        "></div>

        <div class="
          absolute
          h-[330px]
          w-[330px]
          rounded-full
          border border-red-500/10
        "></div>

        <!-- LARGE DECORATIVE TEXT -->
        <div class="
          pointer-events-none
          absolute right-[-20px]
          top-[15%]
          select-none
          text-[110px]
          font-black
          tracking-[-0.08em]
          text-white/[0.018]
          lg:text-[150px]
        ">
          01
        </div>


        <div
          id="car-preview"
          class="
            relative z-10
            h-[520px]
            w-full
            max-w-[760px]
          "
        ></div>


        <!-- SHOWROOM LABEL -->
        <div class="
          absolute bottom-14 right-4
          flex items-center gap-4
          text-[9px]
          uppercase
          tracking-[0.3em]
          text-white/25
        ">
          <span>Race Prototype</span>
          <div class="h-px w-10 bg-red-500/50"></div>
          <span>01</span>
        </div>

      </section>

    </main>


    <!-- BOTTOM BORDER -->
    <div class="
      absolute bottom-0 left-0
      h-px w-full
      bg-gradient-to-r
      from-transparent
      via-red-500/30
      to-transparent
    "></div>
  `;

  document.body.appendChild(landing);

  const container = document.getElementById("car-preview");
  const startButton = document.getElementById("start-race");
  const lapValue = document.getElementById("lap-value");
  const lapChips = landing.querySelectorAll(".lap-chip");

  // ============================
  // LAP SELECTION
  // ============================

  const MIN_LAPS = 1;
  const MAX_LAPS = 20;
  let laps = 3;

  function setLaps(value) {
    laps = Math.min(MAX_LAPS, Math.max(MIN_LAPS, value));
    lapValue.textContent = laps;

    lapChips.forEach((chip) => {
      chip.classList.toggle("active", Number(chip.dataset.laps) === laps);
    });
  }

  document.getElementById("lap-minus").addEventListener("click", () => setLaps(laps - 1));
  document.getElementById("lap-plus").addEventListener("click", () => setLaps(laps + 1));
  lapChips.forEach((chip) =>
    chip.addEventListener("click", () => setLaps(Number(chip.dataset.laps)))
  );

  setLaps(3);


  // ============================
  // THREE.JS SHOWROOM
  // ============================

  const previewScene = new THREE.Scene();

  const previewCamera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );

  previewCamera.position.set(4.4, 2.5, 5.5);
  previewCamera.lookAt(0, 0.45, 0);


  const previewRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  previewRenderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  previewRenderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  previewRenderer.setClearColor(0x000000, 0);

  previewRenderer.outputColorSpace =
    THREE.SRGBColorSpace;

  previewRenderer.toneMapping =
    THREE.ACESFilmicToneMapping;

  previewRenderer.toneMappingExposure = 1.35;

  container.appendChild(previewRenderer.domElement);


  // ============================
  // LIGHTING
  // ============================

  const hemiLight = new THREE.HemisphereLight(
    0xb8d5ff,
    0x160004,
    2.2
  );

  previewScene.add(hemiLight);


  const frontLight = new THREE.DirectionalLight(
    0xffffff,
    3.5
  );

  frontLight.position.set(4, 5, 5);
  previewScene.add(frontLight);


  const blueLight = new THREE.PointLight(
    0x0099ff,
    10,
    9
  );

  blueLight.position.set(3.5, 1.6, 1.5);
  previewScene.add(blueLight);


  const redLight = new THREE.PointLight(
    0xff1f2d,
    13,
    10
  );

  redLight.position.set(-3, 1, 2.5);
  previewScene.add(redLight);


  // ============================
  // PLATFORM
  // ============================

  const platformGroup = new THREE.Group();
  previewScene.add(platformGroup);

  // Soft shadow under base
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.45, 80),
    new THREE.MeshBasicMaterial({
      color: 0x220000,
      transparent: true,
      opacity: 0.28
    })
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.32;
  platformGroup.add(shadow);

  // Bottom dark foundation
  const platformBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.18, 2.28, 0.22, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x180203,
      metalness: 0.95,
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18
    })
  );

  platformBottom.position.y = -0.23;
  platformGroup.add(platformBottom);

  // Main red glossy body
  const platformMain = new THREE.Mesh(
    new THREE.CylinderGeometry(2.02, 2.14, 0.2, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x5f0508,
      metalness: 0.85,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.05
    })
  );

  platformMain.position.y = -0.12;
  platformGroup.add(platformMain);

  // Upper bright red plate
  const platformTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.87, 1.92, 0.05, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xb80e14,
      metalness: 0.8,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.04
    })
  );

  platformTop.position.y = -0.01;
  platformGroup.add(platformTop);

  // Small center stage
  const centerPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.2, 0.035, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x8b0b10,
      metalness: 0.75,
      roughness: 0.14,
      clearcoat: 1
    })
  );

  centerPlate.position.y = 0.02;
  platformGroup.add(centerPlate);

  // Dark center insert
  const centerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.025, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0x120405,
      metalness: 0.8,
      roughness: 0.35,
      clearcoat: 0.5
    })
  );

  centerCore.position.y = 0.04;
  platformGroup.add(centerCore);

  // Outer bright ring
  const neonRingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(1.88, 0.03, 16, 120),
    new THREE.MeshBasicMaterial({
      color: 0xff3b3b
    })
  );

  neonRingOuter.rotation.x = Math.PI / 2;
  neonRingOuter.position.y = 0.02;
  platformGroup.add(neonRingOuter);

  // Inner ring
  const neonRingInner = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.018, 12, 100),
    new THREE.MeshBasicMaterial({
      color: 0xff5a5a
    })
  );

  neonRingInner.rotation.x = Math.PI / 2;
  neonRingInner.position.y = 0.045;
  platformGroup.add(neonRingInner);

  // Lower underglow ring
  const lowerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.02, 12, 100),
    new THREE.MeshBasicMaterial({
      color: 0x7a0006
    })
  );

  lowerRing.rotation.x = Math.PI / 2;
  lowerRing.position.y = -0.24;
  platformGroup.add(lowerRing);

  // Accent light bars around edge
  const accentGroup = new THREE.Group();
  platformGroup.add(accentGroup);

  const accentGeo = new THREE.BoxGeometry(0.12, 0.03, 0.03);
  const accentMat = new THREE.MeshBasicMaterial({
    color: 0xff4040
  });

  for (let i = 0; i < 18; i++) {
    const accent = new THREE.Mesh(accentGeo, accentMat);

    const angle = (i / 18) * Math.PI * 2;
    const radius = 1.63;

    accent.position.set(
      Math.cos(angle) * radius,
      -0.02,
      Math.sin(angle) * radius
    );

    accent.lookAt(0, -0.02, 0);
    accent.rotateY(Math.PI / 2);

    accentGroup.add(accent);
  }


  // ============================
  // CAR
  // ============================

  const loader = new GLTFLoader();

  let previewCar = null;
  let previewWheels = [];

  loader.load(CAR_URL, (gltf) => {
    previewCar = gltf.scene;

    // SAME STYLE AS ROAMING CAR
    previewWheels = applyCarStyle(previewCar);

    // Bigger showroom car
    previewCar.scale.set(1.05, 1.05, 1.05);
    previewCar.position.set(0.15, 0.22, 0.35);

    previewScene.add(previewCar);
  });


  // ============================
  // ANIMATION
  // ============================

  let previewRunning = true;

  function animatePreview() {
    if (!previewRunning) return;

    requestAnimationFrame(animatePreview);

    if (previewCar) {
      previewCar.rotation.y += 0.004;

      previewWheels.forEach((wheel) => {
        wheel.rotation.x += 0.055;
      });
    }

    neonRingOuter.rotation.z -= 0.003;
    neonRingInner.rotation.z += 0.002;
    accentGroup.rotation.y += 0.0015;
    lowerRing.rotation.z += 0.0012;

    previewRenderer.render(
      previewScene,
      previewCamera
    );
  }

  animatePreview();


  // ============================
  // RESPONSIVE PREVIEW
  // ============================

  function resizePreview() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();

    previewRenderer.setSize(width, height);
  }

  window.addEventListener(
    "resize",
    resizePreview
  );


  // ============================
  // START
  // ============================

  function closeLanding() {

    landing.classList.add(
      "opacity-0",
      "pointer-events-none"
    );


    setTimeout(() => {

      previewRunning = false;

      previewRenderer.dispose();

      landing.remove();


      onStartRace(laps);


    }, 700);

  }


  startButton.addEventListener(
    "click",
    closeLanding
  );
}
