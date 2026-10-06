import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyCarStyle } from "./carStyle.js";
import { CAR_URL } from "./assets.js";
import { unlockAudio } from "./audio.js";
import { MAPS, DEFAULT_MAP } from "./maps/maps.js";

// ------------------------------------------------------------
// Small top-down track preview used inside each map card.
// Preview is generated from the map's real curvePath.
// ------------------------------------------------------------
function createMapPreviewSVG(map) {
  const points = [];

  for (let i = 0; i < map.curvePath.length; i += 3) {
    points.push({
      x: map.curvePath[i],
      z: map.curvePath[i + 2],
    });
  }

  if (points.length < 2) return "";

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxZ - minZ, 1);

  const viewWidth = 100;
  const viewHeight = 56;
  const padding = 7;

  const scale = Math.min(
    (viewWidth - padding * 2) / width,
    (viewHeight - padding * 2) / height
  );

  const drawnWidth = width * scale;
  const drawnHeight = height * scale;

  const offsetX = (viewWidth - drawnWidth) / 2;
  const offsetY = (viewHeight - drawnHeight) / 2;

  const toPreviewPoint = ({ x, z }) => ({
    x: offsetX + (x - minX) * scale,
    y: offsetY + (maxZ - z) * scale,
  });

  const previewPoints = points.map(toPreviewPoint);

  const pointString = previewPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const start = previewPoints[0];

  return `
    <svg
      class="map-preview-svg"
      viewBox="0 0 ${viewWidth} ${viewHeight}"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <polyline
        class="map-preview-shadow"
        points="${pointString}"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <polyline
        class="map-preview-track"
        points="${pointString}"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <circle
        class="map-preview-start"
        cx="${start.x.toFixed(1)}"
        cy="${start.y.toFixed(1)}"
        r="2.2"
      />
    </svg>
  `;
}

export function setupLandingScreen(onStartRace) {
  const landing = document.createElement("div");

  landing.className = `
    fixed inset-0 z-50
    overflow-x-hidden overflow-y-auto
    bg-[#050507]
    transition-opacity duration-700
  `;

  landing.innerHTML = `
    <style>

      /* ======================================================
         MAP SELECTION
      ====================================================== */

      .landing-map-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 7px;
      }

      .map-chip.landing-map-card {
        position: relative;
        min-width: 0;
        min-height: 98px;
        padding: 7px 6px 8px;
        overflow: hidden;
      }

      .landing-map-card .map-level {
        margin: 0;
        font-size: 8px;
        line-height: 1;
      }

      .landing-map-card strong {
        display: block;
        margin-top: 5px;
        overflow: hidden;
        font-size: 8px;
        line-height: 1.2;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      /* ======================================================
         MINI MAP PREVIEW
      ====================================================== */

      .map-preview-shell {
        display: flex;
        height: 52px;
        margin-top: 5px;
        align-items: center;
        justify-content: center;

        border: 1px solid rgba(255, 255, 255, 0.05);

        background:
          radial-gradient(
            circle at center,
            rgba(239, 68, 68, 0.08),
            transparent 68%
          ),
          rgba(255, 255, 255, 0.015);

        transition:
          border-color 180ms ease,
          background 180ms ease;
      }

      .map-preview-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .map-preview-shadow {
        stroke: rgba(0, 0, 0, 0.75);
        stroke-width: 7;
      }

      .map-preview-track {
        stroke: rgba(255, 255, 255, 0.38);
        stroke-width: 3.2;

        transition:
          stroke 180ms ease,
          filter 180ms ease;
      }

      .map-preview-start {
        fill: #ef4444;
        stroke: rgba(255, 255, 255, 0.85);
        stroke-width: 0.9;
        opacity: 0.78;
      }

      .landing-map-card:hover .map-preview-track {
        stroke: rgba(255, 255, 255, 0.82);
      }

      .landing-map-card.active .map-preview-track {
        stroke: #ef4444;

        filter:
          drop-shadow(
            0 0 3px
            rgba(239, 68, 68, 0.75)
          );
      }

      .landing-map-card.active .map-preview-start {
        fill: #ffffff;
        stroke: #ef4444;
        opacity: 1;
      }

      .landing-map-card.active .map-preview-shell {
        border-color: rgba(239, 68, 68, 0.28);

        background:
          radial-gradient(
            circle at center,
            rgba(239, 68, 68, 0.15),
            transparent 70%
          ),
          rgba(239, 68, 68, 0.025);
      }

      /* ======================================================
         COMPACT LAP SELECTION
      ====================================================== */

      .lap-step.compact-lap-step {
        width: 30px;
        height: 30px;
        font-size: 16px;
      }

      .lap-value.compact-lap-value {
        min-width: 32px;
        font-size: 24px;
        line-height: 1;
      }

      .lap-chip.compact-lap-chip {
        min-width: 28px;
        height: 26px;
        padding: 0 6px;
        font-size: 9px;
      }

      /* ======================================================
         MOBILE
      ====================================================== */

      @media (max-width: 767px) {
        .landing-map-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .map-chip.landing-map-card {
          min-height: 94px;
        }
      }

      /* ======================================================
         SMALLER LAPTOP HEIGHT
      ====================================================== */

      @media (min-width: 768px) and (max-height: 820px) {
        #landing-title {
          font-size: 78px;
        }

        #landing-controls {
          margin-top: 18px;
        }
      }

    </style>


    <!-- ======================================================
         BACKGROUND GLOWS
    ======================================================= -->

    <div class="
      pointer-events-none
      absolute
      -left-40
      top-1/2
      h-[600px]
      w-[600px]
      -translate-y-1/2
      rounded-full
      bg-red-700/10
      blur-[160px]
    ">
    </div>


    <div class="
      pointer-events-none
      absolute
      right-[-150px]
      top-[-150px]
      h-[600px]
      w-[600px]
      rounded-full
      bg-cyan-500/8
      blur-[180px]
    ">
    </div>


    <!-- ======================================================
         TOP BAR
    ======================================================= -->

    <div class="
      absolute
      left-0
      top-0
      z-20
      flex
      w-full
      items-center
      justify-end
      px-10
      py-6
      md:px-16
    ">

      <span class="
        hidden
        text-[10px]
        tracking-[0.3em]
        text-white/25
        md:block
      ">
        // 2 PLAYER SPLIT-SCREEN RACE
      </span>

    </div>


    <!-- ======================================================
         MAIN CONTENT
    ======================================================= -->

    <main class="
      relative
      z-10
      mx-auto
      grid
      min-h-screen
      max-w-[1500px]
      grid-cols-1
      items-center
      px-8
      md:grid-cols-[0.85fr_1.15fr]
      md:px-16
      lg:px-24
    ">


      <!-- ====================================================
           LEFT SIDE
      ===================================================== -->

      <section class="
        z-20
        flex
        flex-col
        items-start
        justify-center
      ">


        <!-- Small heading -->

        <div class="
          mb-4
          flex
          items-center
          gap-4
        ">

          <div class="
            h-px
            w-12
            bg-gradient-to-r
            from-red-500
            to-transparent
          ">
          </div>


          <span class="
            text-[10px]
            uppercase
            tracking-[0.55em]
            text-red-400
          ">
            Beyond the road
          </span>

        </div>


        <!-- ==================================================
             TITLE
        =================================================== -->

        <h1
          id="landing-title"
          class="
            text-[60px]
            font-black
            uppercase
            leading-[0.82]
            tracking-[-0.06em]
            text-white
            sm:text-[85px]
            lg:text-[102px]
          "
        >

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


        <!-- ==================================================
             SELECTION AREA
        =================================================== -->

        <div
          id="landing-selector"
          class="
            mt-10
            w-full
            max-w-md
          "
        >


          <!-- ================================================
               TRACK SELECTION
          ================================================= -->

          <div class="mb-9">

            <div class="
              mb-2
              text-[10px]
              uppercase
              tracking-[0.4em]
              text-white/40
            ">
              Select track
            </div>


            <div class="landing-map-grid">

              ${MAPS.map(
                (map) => `

                <button
                  type="button"
                  class="
                    map-chip
                    landing-map-card
                  "
                  data-map-id="${map.id}"
                  aria-label="Select ${map.name}"
                  title="${map.name}"
                >

                  <span class="map-level">
                    L${map.difficulty}
                  </span>


                  <span class="map-preview-shell">

                    ${createMapPreviewSVG(map)}

                  </span>


                  <strong title="${map.name}">
                    ${map.name}
                  </strong>

                </button>

              `
              ).join("")}

            </div>

          </div>


          <!-- ================================================
               LAP SELECTION
          ================================================= -->

          <div class="
            mb-2
            text-[10px]
            uppercase
            tracking-[0.4em]
            text-white/40
          ">
            Number of laps
          </div>


          <div class="
            flex
            flex-wrap
            items-center
            gap-2
          ">


            <!-- Decrease -->

            <button
              id="lap-minus"
              class="
                lap-step
                compact-lap-step
              "
              aria-label="Fewer laps"
            >
              &minus;
            </button>


            <!-- Current number -->

            <div
              id="lap-value"
              class="
                lap-value
                compact-lap-value
              "
            >
              3
            </div>


            <!-- Increase -->

            <button
              id="lap-plus"
              class="
                lap-step
                compact-lap-step
              "
              aria-label="More laps"
            >
              +
            </button>


            <!-- Quick lap buttons -->

            <div class="
              ml-1
              flex
              gap-2
            ">

              <button
                class="
                  lap-chip
                  compact-lap-chip
                "
                data-laps="1"
              >
                1
              </button>


              <button
                class="
                  lap-chip
                  compact-lap-chip
                "
                data-laps="3"
              >
                3
              </button>


              <button
                class="
                  lap-chip
                  compact-lap-chip
                "
                data-laps="5"
              >
                5
              </button>


              <button
                class="
                  lap-chip
                  compact-lap-chip
                "
                data-laps="10"
              >
                10
              </button>

            </div>

          </div>


          <!-- ================================================
               START BUTTON
          ================================================= -->

          <button
            id="start-race"
            class="
              mt-5
              border
              border-red-500/60
              bg-red-600
              px-9
              py-3
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


        <!-- ==================================================
             CONTROLS
        =================================================== -->

        <div
          id="landing-controls"
          class="
            mt-7
            grid
            gap-2
            text-[10px]
            uppercase
            tracking-[0.2em]
            text-white/40
          "
        >


          <!-- Player 1 -->

          <div class="
            flex
            items-center
            gap-4
          ">

            <span class="
              w-24
              font-bold
              text-[#2aa8ff]
            ">
              Player 1
            </span>

            <span>
              W A S D
              &nbsp;·&nbsp;
              Space = Nitro
            </span>

          </div>


          <!-- Player 2 -->

          <div class="
            flex
            items-center
            gap-4
          ">

            <span class="
              w-24
              font-bold
              text-[#ff4d4d]
            ">
              Player 2
            </span>

            <span>
              &uarr;
              &larr;
              &darr;
              &rarr;
              &nbsp;·&nbsp;
              Enter = Nitro
            </span>

          </div>

        </div>

      </section>


      <!-- ====================================================
           RIGHT SIDE SHOWROOM
      ===================================================== -->

      <section class="
        relative
        flex
        h-[560px]
        items-center
        justify-center
      ">


        <!-- Back circle -->

        <div class="
          absolute
          h-[430px]
          w-[430px]
          rounded-full
          border
          border-white/[0.04]
        ">
        </div>


        <!-- Inner circle -->

        <div class="
          absolute
          h-[330px]
          w-[330px]
          rounded-full
          border
          border-red-500/10
        ">
        </div>


        <!-- Decorative number -->

        <div class="
          pointer-events-none
          absolute
          right-[-20px]
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


        <!-- Three.js car -->

        <div
          id="car-preview"
          class="
            relative
            z-10
            h-[500px]
            w-full
            max-w-[760px]
          "
        >
        </div>


        <!-- Showroom label -->

        <div class="
          absolute
          bottom-14
          right-4
          flex
          items-center
          gap-4
          text-[9px]
          uppercase
          tracking-[0.3em]
          text-white/25
        ">

          <span>
            Race Prototype
          </span>

          <div class="
            h-px
            w-10
            bg-red-500/50
          ">
          </div>

          <span>
            01
          </span>

        </div>

      </section>

    </main>


    <!-- ======================================================
         BOTTOM BORDER
    ======================================================= -->

    <div class="
      absolute
      bottom-0
      left-0
      h-px
      w-full
      bg-gradient-to-r
      from-transparent
      via-red-500/30
      to-transparent
    ">
    </div>
  `;


  document.body.appendChild(landing);


  // ==========================================================
  // DOM ELEMENTS
  // ==========================================================

  const container = document.getElementById("car-preview");

  const startButton = document.getElementById("start-race");

  const lapValue = document.getElementById("lap-value");

  const lapChips = landing.querySelectorAll(".lap-chip");

  const mapButtons = landing.querySelectorAll(".map-chip");


  // ==========================================================
  // MAP SELECTION
  // ==========================================================

  let selectedMap = DEFAULT_MAP;


  function setMap(map) {
    selectedMap = map;

    mapButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.mapId === map.id
      );
    });
  }


  mapButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const map = MAPS.find(
        (item) =>
          item.id ===
          button.dataset.mapId
      );

      if (map) {
        setMap(map);
      }
    });
  });


  setMap(DEFAULT_MAP);


  // ==========================================================
  // LAP SELECTION
  // ==========================================================

  const MIN_LAPS = 1;
  const MAX_LAPS = 20;

  let laps = 3;


  function setLaps(value) {
    laps = Math.min(
      MAX_LAPS,
      Math.max(
        MIN_LAPS,
        value
      )
    );

    lapValue.textContent = laps;

    lapChips.forEach((chip) => {
      chip.classList.toggle(
        "active",
        Number(chip.dataset.laps) === laps
      );
    });
  }


  document
    .getElementById("lap-minus")
    .addEventListener(
      "click",
      () => setLaps(laps - 1)
    );


  document
    .getElementById("lap-plus")
    .addEventListener(
      "click",
      () => setLaps(laps + 1)
    );


  lapChips.forEach((chip) => {
    chip.addEventListener(
      "click",
      () =>
        setLaps(
          Number(chip.dataset.laps)
        )
    );
  });


  setLaps(3);


  // ==========================================================
  // THREE.JS SHOWROOM
  // ==========================================================

  const previewScene = new THREE.Scene();


  // ==========================================================
  // CAMERA
  // ==========================================================

  const previewCamera =
    new THREE.PerspectiveCamera(
      32,
      container.clientWidth /
        container.clientHeight,
      0.1,
      100
    );


  previewCamera.position.set(
    4.4,
    2.5,
    5.5
  );


  previewCamera.lookAt(
    0,
    0.45,
    0
  );


  // ==========================================================
  // RENDERER
  // ==========================================================

  const previewRenderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });


  previewRenderer.setSize(
    container.clientWidth,
    container.clientHeight
  );


  previewRenderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
    )
  );


  previewRenderer.setClearColor(
    0x000000,
    0
  );


  previewRenderer.outputColorSpace =
    THREE.SRGBColorSpace;


  previewRenderer.toneMapping =
    THREE.ACESFilmicToneMapping;


  previewRenderer.toneMappingExposure =
    1.35;


  container.appendChild(
    previewRenderer.domElement
  );


  // ==========================================================
  // LIGHTING
  // ==========================================================

  const hemiLight =
    new THREE.HemisphereLight(
      0xb8d5ff,
      0x160004,
      2.2
    );


  previewScene.add(
    hemiLight
  );


  const frontLight =
    new THREE.DirectionalLight(
      0xffffff,
      3.5
    );


  frontLight.position.set(
    4,
    5,
    5
  );


  previewScene.add(
    frontLight
  );


  const blueLight =
    new THREE.PointLight(
      0x0099ff,
      10,
      9
    );


  blueLight.position.set(
    3.5,
    1.6,
    1.5
  );


  previewScene.add(
    blueLight
  );


  const redLight =
    new THREE.PointLight(
      0xff1f2d,
      13,
      10
    );


  redLight.position.set(
    -3,
    1,
    2.5
  );


  previewScene.add(
    redLight
  );


  // ==========================================================
  // PLATFORM
  // ==========================================================

  const platformGroup =
    new THREE.Group();


  previewScene.add(
    platformGroup
  );


  // ==========================================================
  // SOFT SHADOW
  // ==========================================================

  const shadow =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        2.45,
        80
      ),

      new THREE.MeshBasicMaterial({
        color: 0x220000,
        transparent: true,
        opacity: 0.28,
      })
    );


  shadow.rotation.x =
    -Math.PI / 2;


  shadow.position.y =
    -0.32;


  platformGroup.add(
    shadow
  );


  // ==========================================================
  // BOTTOM PLATFORM
  // ==========================================================

  const platformBottom =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.18,
        2.28,
        0.22,
        96
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x180203,
        metalness: 0.95,
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.18,
      })
    );


  platformBottom.position.y =
    -0.23;


  platformGroup.add(
    platformBottom
  );


  // ==========================================================
  // MAIN RED PLATFORM
  // ==========================================================

  const platformMain =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.02,
        2.14,
        0.2,
        96
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x5f0508,
        metalness: 0.85,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      })
    );


  platformMain.position.y =
    -0.12;


  platformGroup.add(
    platformMain
  );


  // ==========================================================
  // TOP RED PLATE
  // ==========================================================

  const platformTop =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.87,
        1.92,
        0.05,
        96
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0xb80e14,
        metalness: 0.8,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      })
    );


  platformTop.position.y =
    -0.01;


  platformGroup.add(
    platformTop
  );


  // ==========================================================
  // CENTER PLATE
  // ==========================================================

  const centerPlate =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.15,
        1.2,
        0.035,
        96
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x8b0b10,
        metalness: 0.75,
        roughness: 0.14,
        clearcoat: 1,
      })
    );


  centerPlate.position.y =
    0.02;


  platformGroup.add(
    centerPlate
  );


  // ==========================================================
  // DARK CENTER
  // ==========================================================

  const centerCore =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.55,
        0.55,
        0.025,
        64
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x120405,
        metalness: 0.8,
        roughness: 0.35,
        clearcoat: 0.5,
      })
    );


  centerCore.position.y =
    0.04;


  platformGroup.add(
    centerCore
  );


  // ==========================================================
  // OUTER NEON RING
  // ==========================================================

  const neonRingOuter =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        1.88,
        0.03,
        16,
        120
      ),

      new THREE.MeshBasicMaterial({
        color: 0xff3b3b,
      })
    );


  neonRingOuter.rotation.x =
    Math.PI / 2;


  neonRingOuter.position.y =
    0.02;


  platformGroup.add(
    neonRingOuter
  );


  // ==========================================================
  // INNER NEON RING
  // ==========================================================

  const neonRingInner =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        1.18,
        0.018,
        12,
        100
      ),

      new THREE.MeshBasicMaterial({
        color: 0xff5a5a,
      })
    );


  neonRingInner.rotation.x =
    Math.PI / 2;


  neonRingInner.position.y =
    0.045;


  platformGroup.add(
    neonRingInner
  );


  // ==========================================================
  // LOWER RING
  // ==========================================================

  const lowerRing =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        2.05,
        0.02,
        12,
        100
      ),

      new THREE.MeshBasicMaterial({
        color: 0x7a0006,
      })
    );


  lowerRing.rotation.x =
    Math.PI / 2;


  lowerRing.position.y =
    -0.24;


  platformGroup.add(
    lowerRing
  );


  // ==========================================================
  // PLATFORM ACCENT LIGHTS
  // ==========================================================

  const accentGroup =
    new THREE.Group();


  platformGroup.add(
    accentGroup
  );


  const accentGeo =
    new THREE.BoxGeometry(
      0.12,
      0.03,
      0.03
    );


  const accentMat =
    new THREE.MeshBasicMaterial({
      color: 0xff4040,
    });


  for (
    let i = 0;
    i < 18;
    i++
  ) {
    const accent =
      new THREE.Mesh(
        accentGeo,
        accentMat
      );


    const angle =
      (i / 18) *
      Math.PI *
      2;


    const radius =
      1.63;


    accent.position.set(
      Math.cos(angle) *
        radius,

      -0.02,

      Math.sin(angle) *
        radius
    );


    accent.lookAt(
      0,
      -0.02,
      0
    );


    accent.rotateY(
      Math.PI / 2
    );


    accentGroup.add(
      accent
    );
  }


  // ==========================================================
  // CAR
  // ==========================================================

  const loader =
    new GLTFLoader();


  let previewCar =
    null;


  let previewWheels =
    [];


  loader.load(
    CAR_URL,

    (gltf) => {
      previewCar =
        gltf.scene;


      previewWheels =
        applyCarStyle(
          previewCar
        );


      previewCar.scale.set(
        1.05,
        1.05,
        1.05
      );


      previewCar.position.set(
        0.15,
        0.22,
        0.35
      );


      previewScene.add(
        previewCar
      );
    }
  );


  // ==========================================================
  // ANIMATION
  // ==========================================================

  let previewRunning =
    true;


  function animatePreview() {
    if (!previewRunning) {
      return;
    }


    requestAnimationFrame(
      animatePreview
    );


    if (previewCar) {
      previewCar.rotation.y +=
        0.004;


      previewWheels.forEach(
        (wheel) => {
          wheel.rotation.x +=
            0.055;
        }
      );
    }


    neonRingOuter.rotation.z -=
      0.003;


    neonRingInner.rotation.z +=
      0.002;


    accentGroup.rotation.y +=
      0.0015;


    lowerRing.rotation.z +=
      0.0012;


    previewRenderer.render(
      previewScene,
      previewCamera
    );
  }


  animatePreview();


  // ==========================================================
  // RESPONSIVE THREE.JS PREVIEW
  // ==========================================================

  function resizePreview() {
    const width =
      container.clientWidth;


    const height =
      container.clientHeight;


    previewCamera.aspect =
      width / height;


    previewCamera
      .updateProjectionMatrix();


    previewRenderer.setSize(
      width,
      height
    );
  }


  window.addEventListener(
    "resize",
    resizePreview
  );


  // ==========================================================
  // START RACE
  // ==========================================================

  function closeLanding() {
    unlockAudio();


    landing.classList.add(
      "opacity-0",
      "pointer-events-none"
    );


    setTimeout(
      () => {
        previewRunning =
          false;


        previewRenderer.dispose();


        landing.remove();


        onStartRace(
          laps,
          selectedMap
        );
      },

      700
    );
  }


  startButton.addEventListener(
    "click",
    closeLanding
  );
}