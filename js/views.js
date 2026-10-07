import * as THREE from "three";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";


// ============================================================
// VIEW MANAGER
// ============================================================

export class SplitScreen {
  constructor(renderer, scene, cameras) {
    this.renderer = renderer;
    this.scene = scene;
    this.cameras = cameras;

    this.mode = "local";

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.composers = cameras.map((camera) => {
      const composer = new EffectComposer(renderer);

      const renderPass = new RenderPass(
        scene,
        camera
      );

      composer.addPass(renderPass);

      const bloom = new UnrealBloomPass(
        new THREE.Vector2(256, 256),
        1.5,
        0.4,
        100
      );

      bloom.threshold = 0.1;
      bloom.strength = 1.6;
      bloom.radius = 0.35;

      composer.addPass(bloom);

      return composer;
    });

    this.resize();

    this._resizeHandler = () => this.resize();

    window.addEventListener(
      "resize",
      this._resizeHandler
    );
  }


  // ==========================================================
  // CHANGE GAME MODE
  // ==========================================================

  setMode(mode) {
    this.mode = mode === "ai" ? "ai" : "local";
    this.resize();
  }


  // ==========================================================
  // RESIZE
  // ==========================================================

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.width = width;
    this.height = height;

    this.renderer.setSize(width, height);

    if (this.mode === "ai") {
      this.topHeight = height;
      this.bottomHeight = 0;

      this.composers[0].setPixelRatio(
        this.renderer.getPixelRatio()
      );

      this.composers[0].setSize(
        width,
        height
      );

      this.cameras[0].aspect =
        width / height;

      this.cameras[0].updateProjectionMatrix();

      return;
    }

    this.bottomHeight = Math.floor(
      height / 2
    );

    this.topHeight =
      height -
      this.bottomHeight;

    const sizes = [
      this.topHeight,
      this.bottomHeight,
    ];

    this.composers.forEach((composer, i) => {
      composer.setPixelRatio(
        this.renderer.getPixelRatio()
      );

      composer.setSize(
        width,
        sizes[i]
      );

      this.cameras[i].aspect =
        width /
        sizes[i];

      this.cameras[i].updateProjectionMatrix();
    });
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  render(dt) {
    const renderer = this.renderer;

    renderer.setRenderTarget(null);

    if (this.mode === "ai") {
      renderer.setScissorTest(false);

      renderer.setViewport(
        0,
        0,
        this.width,
        this.height
      );

      this.composers[0].render(dt);

      return;
    }

    renderer.setScissorTest(true);


    // ========================================================
    // PLAYER 1
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

    this.composers[0].render(dt);


    // ========================================================
    // PLAYER 2
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

    this.composers[1].render(dt);
  }
}