import * as THREE from "three";

const BASE_FOV = 55;
const cameraHeight = 0.55;
const cameraDistance = 2.3;
const lookOffset = new THREE.Vector3(0, 0.05, 0.45);

export class ChaseCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 2000);

    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  update(player, dt, snap = false) {
    const { car } = player;

    this._offset
      .set(0, cameraHeight, -cameraDistance)
      .applyQuaternion(car.quaternion);

    this._target
      .copy(car.position)
      .add(this._offset);

    if (snap) {
      this.camera.position.copy(this._target);
    } else {
      this.camera.position.lerp(
        this._target,
        1 - Math.exp(-10 * dt)
      );
    }

    this._look
      .copy(lookOffset)
      .applyQuaternion(car.quaternion)
      .add(car.position);

    this._up
      .set(0, 1, 0)
      .applyQuaternion(car.quaternion);

    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);

    const targetFov = BASE_FOV + (player.nitroActive ? 9 : 0);

    const fov = snap
      ? targetFov
      : THREE.MathUtils.lerp(
          this.camera.fov,
          targetFov,
          1 - Math.exp(-6 * dt)
        );

    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}