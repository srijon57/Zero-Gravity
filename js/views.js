import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Split-screen renderer: player 1 = top half, player 2 = bottom half.
// Each half has its own camera and its own bloom post-processing chain.
export class SplitScreen {
  constructor(renderer, scene, cameras) {
    this.renderer = renderer;
    this.cameras = cameras;

    this.composers = cameras.map((camera) => {
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.5, 0.4, 100);
      bloom.threshold = 0.1;
      bloom.strength = 1.6;
      bloom.radius = 0.35;
      composer.addPass(bloom);

      return composer;
    });

    renderer.setScissorTest(true);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);

    this.bottomHeight = Math.floor(height / 2);
    this.topHeight = height - this.bottomHeight;
    this.width = width;

    const sizes = [this.topHeight, this.bottomHeight];

    this.composers.forEach((composer, i) => {
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(width, sizes[i]);

      this.cameras[i].aspect = width / sizes[i];
      this.cameras[i].updateProjectionMatrix();
    });
  }

  render(dt) {
    const r = this.renderer;

    // Top view (player 1)
    r.setViewport(0, this.bottomHeight, this.width, this.topHeight);
    r.setScissor(0, this.bottomHeight, this.width, this.topHeight);
    this.composers[0].render(dt);

    // Bottom view (player 2)
    r.setViewport(0, 0, this.width, this.bottomHeight);
    r.setScissor(0, 0, this.width, this.bottomHeight);
    this.composers[1].render(dt);
  }
}
