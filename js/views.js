import * as THREE from "three";

import {
  EffectComposer
} from "three/examples/jsm/postprocessing/EffectComposer.js";

import {
  RenderPass
} from "three/examples/jsm/postprocessing/RenderPass.js";

import {
  UnrealBloomPass
} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";


// ============================================================
// VIEW MANAGER
//
// LOCAL MODE:
// Player 1 = top half
// Player 2 = bottom half
//
// AI MODE:
// Player 1 = full screen
//
// BOTH MODES use the SAME:
// - RenderPass
// - Bloom
// - Lighting
// - Environment
// - Visual effects
// ============================================================

export class SplitScreen {

  constructor(
    renderer,
    scene,
    cameras
  ) {

    this.renderer =
      renderer;

    this.scene =
      scene;

    this.cameras =
      cameras;


    // Default game mode

    this.mode =
      "local";


    // Store dimensions

    this.width =
      window.innerWidth;

    this.height =
      window.innerHeight;


    // ========================================================
    // CREATE ONE COMPOSER FOR EACH CAMERA
    // ========================================================

    this.composers =
      cameras.map(
        (camera) => {

          const composer =
            new EffectComposer(
              renderer
            );


          // --------------------------------------------------
          // NORMAL SCENE
          // --------------------------------------------------

          const renderPass =
            new RenderPass(
              scene,
              camera
            );


          composer.addPass(
            renderPass
          );


          // --------------------------------------------------
          // BLOOM
          //
          // These are the ORIGINAL Zero Gravity values.
          // --------------------------------------------------

          const bloom =
            new UnrealBloomPass(

              new THREE.Vector2(
                256,
                256
              ),

              1.5,

              0.4,

              100

            );


          bloom.threshold =
            0.1;


          bloom.strength =
            1.6;


          bloom.radius =
            0.35;


          composer.addPass(
            bloom
          );


          return composer;

        }
      );


    // Initial sizing

    this.resize();


    // Resize listener

    this._resizeHandler =
      () => this.resize();


    window.addEventListener(
      "resize",
      this._resizeHandler
    );

  }


  // ==========================================================
  // CHANGE GAME MODE
  // ==========================================================

  setMode(mode) {

    this.mode =
      mode === "ai"
        ? "ai"
        : "local";


    // Camera/composer sizes change
    // depending on the mode.

    this.resize();

  }


  // ==========================================================
  // RESIZE
  // ==========================================================

  resize() {

    const width =
      window.innerWidth;


    const height =
      window.innerHeight;


    this.width =
      width;


    this.height =
      height;


    // Main renderer always covers
    // the complete browser window.

    this.renderer.setSize(
      width,
      height
    );


    // ========================================================
    // AI MODE
    // ========================================================

    if (
      this.mode === "ai"
    ) {

      this.topHeight =
        height;


      this.bottomHeight =
        0;


      // ------------------------------------------------------
      // Player 1 composer becomes full screen.
      // ------------------------------------------------------

      this.composers[0]
        .setPixelRatio(
          this.renderer
            .getPixelRatio()
        );


      this.composers[0]
        .setSize(
          width,
          height
        );


      // ------------------------------------------------------
      // Player 1 camera also becomes full screen.
      // ------------------------------------------------------

      this.cameras[0].aspect =
        width /
        height;


      this.cameras[0]
        .updateProjectionMatrix();


      return;

    }


    // ========================================================
    // LOCAL TWO-PLAYER MODE
    // ========================================================

    this.bottomHeight =
      Math.floor(
        height / 2
      );


    this.topHeight =
      height -
      this.bottomHeight;


    const sizes = [

      this.topHeight,

      this.bottomHeight

    ];


    // Each player gets a half-height
    // composer + camera.

    this.composers.forEach(
      (composer, i) => {

        composer.setPixelRatio(
          this.renderer
            .getPixelRatio()
        );


        composer.setSize(
          width,
          sizes[i]
        );


        this.cameras[i].aspect =
          width /
          sizes[i];


        this.cameras[i]
          .updateProjectionMatrix();

      }
    );

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  render(dt) {

    const renderer =
      this.renderer;


    // Make sure we're rendering
    // to the browser canvas.

    renderer.setRenderTarget(
      null
    );


    // ========================================================
    // AI MODE
    // ========================================================

    if (
      this.mode === "ai"
    ) {

      // ------------------------------------------------------
      // Full-screen mode does NOT need scissor clipping.
      // ------------------------------------------------------

      renderer.setScissorTest(
        false
      );


      renderer.setViewport(

        0,

        0,

        this.width,

        this.height

      );


      // ------------------------------------------------------
      // SAME BLOOM PIPELINE AS MULTIPLAYER
      // ------------------------------------------------------

      this.composers[0]
        .render(dt);


      return;

    }


    // ========================================================
    // LOCAL 2-PLAYER MODE
    // ========================================================

    renderer.setScissorTest(
      true
    );


    // ========================================================
    // PLAYER 1 - TOP HALF
    // ========================================================

    renderer.setViewport(

      0,

      this.bottomHeight,

      this.width,

      this.topHeight

    );


    renderer.setScissor(

      0,

      this.bottomHeight,

      this.width,

      this.topHeight

    );


    this.composers[0]
      .render(dt);


    // ========================================================
    // PLAYER 2 - BOTTOM HALF
    // ========================================================

    renderer.setViewport(

      0,

      0,

      this.width,

      this.bottomHeight

    );


    renderer.setScissor(

      0,

      0,

      this.width,

      this.bottomHeight

    );


    this.composers[1]
      .render(dt);

  }

}