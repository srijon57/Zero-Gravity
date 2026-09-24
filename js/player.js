import * as THREE from "three";
import { scene } from "./scene.js";
import { getRoadFrame, tubeRadius, roadWidth, trackLength } from "./road.js";
import { applyCarStyle } from "./carStyle.js";
import { createNitroFlames } from "./nitrous.js";
import { isDown } from "./input.js";

// ---------------------------------------------------------------------------
// Tuning (speeds are in world units per second)
// ---------------------------------------------------------------------------
export const CAR_SCALE = 0.45;

const MAX_SPEED = 12;
const NITRO_SPEED = 19;
const ACCEL = 7;
const NITRO_ACCEL = 14;
const BRAKE = 16;
const DRAG = 3;
const REVERSE_MAX = 3;

const LAT_SPEED = 3.4; // sideways speed when steering
const CAR_HALF_WIDTH = 0.32;
const CLEARANCE = 0.04;

// Collision boundary: the car body can never go past the road edge / walls
export const LAT_MAX = roadWidth / 2 - CAR_HALF_WIDTH - 0.03;

const NITRO_DRAIN = 0.4; // meter per second while boosting
const NITRO_RECHARGE = 0.1;
const NITRO_MIN_TO_RESTART = 0.25;

const GRID_BACK = 3.2; // start position: this many units behind the start line

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Clone the shared car model, colour it and add it to the scene
export function buildCar(template, style) {
  const car = template.clone(true);
  car.scale.setScalar(CAR_SCALE);

  // Height of the car's lowest point (before adding decorations)
  car.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(car);
  const bottomY = bounds.min.y - car.position.y;

  const wheels = applyCarStyle(car, style);
  const flames = createNitroFlames(car);

  scene.add(car);
  return { car, wheels, bottomY, flames };
}

export class Player {
  constructor({ id, name, color, controls, gridLat, model }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.controls = controls;
    this.gridLat = gridLat;

    this.car = model.car;
    this.wheels = model.wheels;
    this.flames = model.flames;
    this.floorOffset = tubeRadius + model.bottomY - CLEARANCE;

    this.frameQuat = new THREE.Quaternion();
    this._targetQuat = new THREE.Quaternion();
    this._yawQuat = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this.raceTime = 0;
    this.reset();
  }

  reset() {
    this.progress = 1 - GRID_BACK / trackLength;
    this.laps = -1; // becomes 0 when the car crosses the line for the first time
    this.maxLaps = -1;

    this.speed = 0;
    this.lat = this.gridLat;
    this.latVel = 0;
    this.yaw = 0;

    this.nitro = 1;
    this.nitroActive = false;
    this.nitroLocked = false;

    this.finished = false;
    this.finishTime = null;
    this.lapStart = 0;
    this.lastLap = null;
    this.bestLap = null;

    this.updatePose(0, true);
  }

  get total() {
    return this.laps + this.progress;
  }

  // ---- movement along the track (handles lap wrapping) ----
  advance(distance) {
    this.progress += distance / trackLength;

    while (this.progress >= 1) {
      this.progress -= 1;
      this.laps += 1;

      if (this.laps > this.maxLaps) {
        this.maxLaps = this.laps;

        if (this.laps === 0) {
          this.lapStart = this.raceTime; // just crossed the line: lap 1 begins
        } else {
          this.lastLap = this.raceTime - this.lapStart;
          this.lapStart = this.raceTime;
          if (this.bestLap === null || this.lastLap < this.bestLap) {
            this.bestLap = this.lastLap;
          }
        }
      }
    }

    while (this.progress < 0) {
      if (this.laps > -1) {
        this.progress += 1;
        this.laps -= 1;
      } else {
        this.progress = 0;
        this.speed = Math.max(this.speed, 0);
        break;
      }
    }
  }

  // ---- wall collision: keeps the car on the road ----
  clampToWalls() {
    let hit = 0;

    if (this.lat > LAT_MAX) {
      this.lat = LAT_MAX;
      if (this.latVel > 0) {
        hit = this.latVel;
        this.latVel = -this.latVel * 0.25;
      }
    } else if (this.lat < -LAT_MAX) {
      this.lat = -LAT_MAX;
      if (this.latVel < 0) {
        hit = -this.latVel;
        this.latVel = -this.latVel * 0.25;
      }
    }

    return hit;
  }

  // ---- physics ----
  update(dt, canDrive) {
    const c = this.controls;

    const throttle = canDrive && isDown(c.up);
    const brake = canDrive && isDown(c.down);
    const steerLeft = canDrive && isDown(c.left);
    const steerRight = canDrive && isDown(c.right);
    const wantNitro = canDrive && isDown(c.nitro);

    // Nitro meter
    if (this.nitroLocked && this.nitro >= NITRO_MIN_TO_RESTART) {
      this.nitroLocked = false;
    }

    this.nitroActive = wantNitro && !this.nitroLocked && this.nitro > 0;

    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - NITRO_DRAIN * dt);
      if (this.nitro === 0) this.nitroLocked = true;
    } else {
      this.nitro = Math.min(1, this.nitro + NITRO_RECHARGE * dt);
    }

    // Longitudinal speed
    const topSpeed = this.nitroActive ? NITRO_SPEED : MAX_SPEED;

    if (this.nitroActive) {
      this.speed += NITRO_ACCEL * dt;
    } else if (throttle) {
      this.speed += ACCEL * dt;
    } else if (!brake) {
      // coast down
      if (this.speed > 0) this.speed = Math.max(0, this.speed - DRAG * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + DRAG * dt);
    }

    if (brake) {
      if (this.speed > 0.05) this.speed -= BRAKE * dt;
      else this.speed -= ACCEL * 0.5 * dt; // reverse
    }

    if (this.speed > topSpeed) {
      // after nitro ends, ease back to normal top speed
      this.speed = Math.max(topSpeed, this.speed - 8 * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -REVERSE_MAX, NITRO_SPEED);

    // Sideways steering (left = towards the car's left = positive lat)
    const steer = (steerLeft ? 1 : 0) - (steerRight ? 1 : 0);
    const authority = Math.min(1, Math.abs(this.speed) / 2.5);
    const targetLatVel = steer * LAT_SPEED * authority;

    this.latVel += (targetLatVel - this.latVel) * (1 - Math.exp(-9 * dt));
    this.lat += this.latVel * dt;

    // Collision with the road edges
    const hit = this.clampToWalls();
    if (hit > 0.4) {
      this.speed *= 1 - Math.min(0.1, hit * 0.03);
    }
    if (Math.abs(this.lat) >= LAT_MAX - 0.001 && steer * Math.sign(this.lat) > 0) {
      this.speed *= 1 - 0.4 * dt; // scraping along the wall
    }

    // Move along the track
    this.advance(this.speed * dt);

    // Visual heading follows the sideways motion
    const targetYaw = THREE.MathUtils.clamp(
      Math.atan2(this.latVel, Math.max(this.speed, 2.5)),
      -0.5,
      0.5
    );
    this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-12 * dt));

    // Wheels + flames
    for (const wheel of this.wheels) wheel.rotation.x += this.speed * dt * 1.4;
    this.flames.update(this.nitroActive);
  }

  // ---- place the car on the road ----
  updatePose(dt, snap = false) {
    const frame = getRoadFrame(THREE.MathUtils.clamp(this.progress, 0, 1));

    this._right.crossVectors(frame.up, frame.tangent).normalize();
    this._up.crossVectors(frame.tangent, this._right).normalize();
    this._m.makeBasis(this._right, this._up, frame.tangent);
    this._targetQuat.setFromRotationMatrix(this._m);

    if (snap) this.frameQuat.copy(this._targetQuat);
    else this.frameQuat.slerp(this._targetQuat, 1 - Math.exp(-18 * dt));

    this._yawQuat.setFromAxisAngle(Y_AXIS, this.yaw);
    this.car.quaternion.copy(this.frameQuat).multiply(this._yawQuat);

    this.car.position
      .copy(frame.center)
      .addScaledVector(frame.floorDirection, this.floorOffset)
      .addScaledVector(this._right, this.lat);
  }
}

// Bumping two cars into each other
export function resolveCarCollision(a, b) {
  const LEN = 1.2;
  const WID = 0.66;

  const dLong = (b.total - a.total) * trackLength; // > 0: b is ahead
  const dLat = b.lat - a.lat;

  const ax = Math.abs(dLong);
  const ay = Math.abs(dLat);
  if (ax >= LEN || ay >= WID) return;

  const penLong = LEN - ax;
  const penLat = WID - ay;

  if (penLat / WID < penLong / LEN) {
    // side-by-side contact: push apart sideways
    const s = dLat === 0 ? (a.id < b.id ? 1 : -1) : Math.sign(dLat);

    a.lat -= (s * penLat) / 2;
    b.lat += (s * penLat) / 2;
    a.latVel -= s * 1.2;
    b.latVel += s * 1.2;

    a.clampToWalls();
    b.clampToWalls();
  } else {
    // one car hits the back of the other
    const s = dLong >= 0 ? 1 : -1;
    const rear = s > 0 ? a : b;
    const front = s > 0 ? b : a;

    rear.advance(-penLong / 2);
    front.advance(penLong / 2);

    if (rear.speed > front.speed) {
      const diff = rear.speed - front.speed;
      rear.speed = front.speed + diff * 0.15;
      front.speed += diff * 0.3;
    }
  }
}
