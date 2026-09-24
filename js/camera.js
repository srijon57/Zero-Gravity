import * as THREE from "three";

const BASE_FOV = 55;
const cameraHeight = 0.55;
const cameraDistance = 2.1;
const lookOffset = new THREE.Vector3(0, 0.05, 0.45);

// Chase camera that follows one player's car
export class ChaseCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 2000);
    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  update(player, dt, snap = false) {
    const { car, frameQuat } = player;

    // camera position behind the car (uses the road orientation, not the steering yaw)
    this._offset.set(0, cameraHeight, -cameraDistance).applyQuaternion(frameQuat);
    this._target.copy(car.position).add(this._offset);

    if (snap) this.camera.position.copy(this._target);
    else this.camera.position.lerp(this._target, 1 - Math.exp(-14 * dt));

    this._look.copy(lookOffset).applyQuaternion(frameQuat).add(car.position);
    this._up.set(0, 1, 0).applyQuaternion(frameQuat);

    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);

    // FOV kick while using nitro
    const targetFov = BASE_FOV + (player.nitroActive ? 9 : 0);
    const fov = snap
      ? targetFov
      : THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-6 * dt));

    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
