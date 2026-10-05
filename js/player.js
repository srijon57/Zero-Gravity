import * as THREE from "three";
import { scene } from "./scene.js";
import { applyCarStyle } from "./carStyle.js";
import { createNitroFlames } from "./nitrous.js";
import { isDown } from "./input.js";

// ---------------------------------------------------------------------------
// Tuning (speeds are in world units per second)
// ---------------------------------------------------------------------------
export const CAR_SCALE = 0.45;

export const MAX_SPEED = 12;
const NITRO_SPEED = 19;

// 0 -> MAX_SPEED and MAX_SPEED -> 0 both take roughly 8.5 seconds
const ACCEL = MAX_SPEED / 8.5;
const DRAG = MAX_SPEED / 8.5; // coasting down when no key is held
const BRAKE = MAX_SPEED / 6; // actively holding the brake/reverse key
const NITRO_ACCEL = 14;
const REVERSE_MAX = 3;

// Steering: the heading is turned by the player, it no longer snaps to the
// road automatically. Driving straight on a curving track will drift you
// towards the outside wall unless you actually steer into the corner.
const TURN_RATE = 1.9; // rad/s at full grip
const HEADING_MAX = 1.35; // rad (~77 degrees) -- how far the car can point away from the track's direction
const CAR_HALF_WIDTH = 0.32;
const CLEARANCE = 0.04;

// Collision boundary: the car body can never go past the road edge / walls

const NITRO_DRAIN = 0.4; // meter per second while boosting
const NITRO_RECHARGE = 0.05; // slower refill than before (~20s for a full tank)
const NITRO_MIN_TO_RESTART = 0.25;

const GRID_BACK = 3.2; // start position: this many units behind the start line

const UP_AXIS = new THREE.Vector3(0, 1, 0);

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

// Signed angle (about `axis`) needed to rotate `from` onto `to`. Used to track
// how much the road's own direction turned underneath the car each step, so
// that "not steering" means "keep going the way you were pointed", not
// "keep following the road".
function signedAngle(from, to, axis) {
  const cross = new THREE.Vector3().crossVectors(from, to);
  return Math.atan2(cross.dot(axis), from.dot(to));
}

export class Player {
  constructor({
    id,
    name,
    color,
    controls,
    gridLat,
    model,
    road
  }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.controls = controls;
    this.gridLat = gridLat;
    this.road = road;

    this.car = model.car;
    this.wheels = model.wheels;
    this.flames = model.flames;
    this.bottomY =
      model.bottomY;

    this.floorOffset =
      this.road.tubeRadius +
      this.bottomY -
      CLEARANCE;

    this.frameQuat = new THREE.Quaternion();
    this._targetQuat = new THREE.Quaternion();
    this._headingQuat = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this.raceTime = 0;
    this.reset();
  }

  get latMax() {

    return (
      this.road.roadWidth / 2 -
      CAR_HALF_WIDTH -
      0.03
    );

  }

  reset() {

    this.floorOffset =
      this.road.tubeRadius +
      this.bottomY -
      CLEARANCE;
    this.progress = 1 - GRID_BACK /  this.road.trackLength;
    this.laps = -1; // becomes 0 when the car crosses the line for the first time
    this.maxLaps = -1;

    this.speed = 0;
    this.lat = this.gridLat;
    this.heading = 0; // angle between the car's nose and the road's own direction

    this.nitro = 1;
    this.nitroActive = false;
    this.nitroLocked = false;
    this.nitroWasActive = false;
    this.justStartedNitro = false;

    this.impactThisFrame = 0;

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
    this.progress += distance / this.road.trackLength;

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

  // ---- wall collision: keeps the car on the road, bounces the nose off the wall ----
  clampToWalls() {
    let impact = 0;

    if (this.lat > this.latMax) {
      this.lat = this.latMax;
      const outwardSpeed = Math.abs(this.speed) * Math.max(0, Math.sin(this.heading));
      if (outwardSpeed > 0.05) {
        impact = outwardSpeed;
        if (this.heading > 0) this.heading = -this.heading * 0.3;
      }
    } else if (this.lat < -this.latMax) {
      this.lat = -this.latMax;
      const outwardSpeed = Math.abs(this.speed) * Math.max(0, -Math.sin(this.heading));
      if (outwardSpeed > 0.05) {
        impact = outwardSpeed;
        if (this.heading < 0) this.heading = -this.heading * 0.3;
      }
    }

    return impact;
  }

  // ---- physics ----
  update(dt, canDrive) {
    const c = this.controls;
    this.impactThisFrame = 0;

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
    this.justStartedNitro = this.nitroActive && !this.nitroWasActive;
    this.nitroWasActive = this.nitroActive;

    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - NITRO_DRAIN * dt);
      if (this.nitro === 0) this.nitroLocked = true;
    } else {
      this.nitro = Math.min(1, this.nitro + NITRO_RECHARGE * dt);
    }

    // ---- longitudinal speed: slow, weighty accel/decel ----
    const topSpeed = this.nitroActive ? NITRO_SPEED : MAX_SPEED;

    if (this.nitroActive) {
      this.speed += NITRO_ACCEL * dt;
    } else if (throttle && !brake) {
      this.speed += ACCEL * dt;
    } else if (brake) {
      if (this.speed > 0.05) this.speed -= BRAKE * dt;
      else this.speed -= ACCEL * 0.6 * dt; // reverse
    } else {
      // no input: coast down towards zero at the same gentle rate
      if (this.speed > 0) this.speed = Math.max(0, this.speed - DRAG * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + DRAG * dt);
    }

    if (this.speed > topSpeed) {
      // ease back down once nitro ends, instead of an abrupt cut
      this.speed = Math.max(topSpeed, this.speed - DRAG * 1.6 * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -REVERSE_MAX, NITRO_SPEED);

    // ---- steering: turns the car's heading, it does not just slide sideways ----
    const steer = (steerLeft ? 1 : 0) - (steerRight ? 1 : 0);
    const grip = 0.35 + 0.65 * Math.min(1, Math.abs(this.speed) / 3);
    const turnRate = steer * TURN_RATE * grip;

    // ---- move using the current heading, THEN correct for how much the
    // road's own direction turned underneath the car this step ----
    const oldFrame = this.road.getRoadFrame(THREE.MathUtils.clamp(this.progress, 0, 1));

    const forwardDist = this.speed * dt * Math.cos(this.heading);
    const lateralDist = this.speed * dt * Math.sin(this.heading);

    this.advance(forwardDist);
    this.lat += lateralDist;

    const newFrame = this.road.getRoadFrame(THREE.MathUtils.clamp(this.progress, 0, 1));
    const roadTurn = signedAngle(oldFrame.tangent, newFrame.tangent, oldFrame.up);

    this.heading = THREE.MathUtils.clamp(
      this.heading + turnRate * dt - roadTurn,
      -HEADING_MAX,
      HEADING_MAX
    );

    // Collision with the road edges
    const impact = this.clampToWalls();
    if (impact > 0.05) {
      this.speed *= 1 - Math.min(0.55, impact * 0.18);
      this.impactThisFrame = Math.max(this.impactThisFrame, impact);
    }
    if (Math.abs(this.lat) >= this.latMax  - 0.001) {
      this.speed *= 1 - 0.4 * dt; // scraping along the wall
    }

    // Wheels + flames
    for (const wheel of this.wheels) wheel.rotation.x += this.speed * dt * 1.4;
    this.flames.update(this.nitroActive);
  }

  // ---- place the car on the road ----
  updatePose(dt, snap = false) {
    const frame = this.road.getRoadFrame(THREE.MathUtils.clamp(this.progress, 0, 1));

    this._right.crossVectors(frame.up, frame.tangent).normalize();
    this._up.crossVectors(frame.tangent, this._right).normalize();
    this._m.makeBasis(this._right, this._up, frame.tangent);
    this._targetQuat.setFromRotationMatrix(this._m);

    if (snap) this.frameQuat.copy(this._targetQuat);
    else this.frameQuat.slerp(this._targetQuat, 1 - Math.exp(-18 * dt));

    this._headingQuat.setFromAxisAngle(UP_AXIS, this.heading);
    this.car.quaternion.copy(this.frameQuat).multiply(this._headingQuat);

    this.car.position
      .copy(frame.center)
      .addScaledVector(frame.floorDirection, this.floorOffset)
      .addScaledVector(this._right, this.lat);
  }
}

// Bumping two cars into each other. Returns an impact strength (0 = no hit)
// so the caller can trigger a sound effect.
export function resolveCarCollision(a, b) {
  const LEN = 1.2;
  const WID = 0.66;

  const dLong = (b.total - a.total) * a.road.trackLength; // > 0: b is ahead
  const dLat = b.lat - a.lat;

  const ax = Math.abs(dLong);
  const ay = Math.abs(dLat);
  if (ax >= LEN || ay >= WID) return 0;

  const penLong = LEN - ax;
  const penLat = WID - ay;
  const impactSpeed = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;

  if (penLat / WID < penLong / LEN) {
    // side-by-side contact: push apart sideways
    const s = dLat === 0 ? (a.id < b.id ? 1 : -1) : Math.sign(dLat);

    a.lat -= (s * penLat) / 2;
    b.lat += (s * penLat) / 2;

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

  // Any collision -- side or rear -- costs both cars some speed
  a.speed *= 0.88;
  b.speed *= 0.88;

  const impact = Math.min(1, 0.15 + impactSpeed / 10);
  a.impactThisFrame = Math.max(a.impactThisFrame, impact);
  b.impactThisFrame = Math.max(b.impactThisFrame, impact);

  return impact;
}
