import * as THREE from "three";

import { scene } from "./scene.js";
import { applyCarStyle } from "./carStyle.js";
import { createNitroFlames } from "./nitrous.js";


// ============================================================
// TUNING
// ============================================================

export const CAR_SCALE = 0.45;
export const MAX_SPEED = 12;

const NITRO_SPEED = 19;

const ACCEL = MAX_SPEED / 8.5;
const DRAG = MAX_SPEED / 8.5;
const BRAKE = MAX_SPEED / 6;

const NITRO_ACCEL = 14;
const REVERSE_MAX = 3;

const TURN_RATE = 1.9;
const HEADING_MAX = 1.35;

const CAR_HALF_WIDTH = 0.32;
const CLEARANCE = 0.04;

const NITRO_DRAIN = 0.4;
const NITRO_RECHARGE = 0.05;
const NITRO_MIN_TO_RESTART = 0.25;

const GRID_BACK = 3.2;

const UP_AXIS = new THREE.Vector3(0, 1, 0);


// ============================================================
// BUILD CAR
// ============================================================

export function buildCar(template, style) {
  const car = template.clone(true);

  car.scale.setScalar(CAR_SCALE);
  car.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(car);

  const bottomY =
    bounds.min.y -
    car.position.y;

  const wheels = applyCarStyle(
    car,
    style
  );

  const flames = createNitroFlames(car);

  scene.add(car);

  return {
    car,
    wheels,
    bottomY,
    flames,
  };
}


// ============================================================
// SIGNED ANGLE
// ============================================================

function signedAngle(from, to, axis) {
  const cross = new THREE.Vector3().crossVectors(
    from,
    to
  );

  return Math.atan2(
    cross.dot(axis),
    from.dot(to)
  );
}


// ============================================================
// PLAYER
// ============================================================

export class Player {
  constructor({
    id,
    name,
    color,
    controls,
    gridLat,
    model,
    road,
  }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.controls = controls;
    this.gridLat = gridLat;
    this.road = road;

    this.performanceMultiplier = 1;

    this.car = model.car;
    this.wheels = model.wheels;
    this.flames = model.flames;
    this.bottomY = model.bottomY;

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


  // ==========================================================
  // ROAD WIDTH LIMIT
  // ==========================================================

  get latMax() {
    return (
      this.road.roadWidth / 2 -
      CAR_HALF_WIDTH -
      0.03
    );
  }


  // ==========================================================
  // PERFORMANCE MULTIPLIER
  // ==========================================================

  setPerformanceMultiplier(multiplier = 1) {
    const value = Number(multiplier);

    this.performanceMultiplier =
      Number.isFinite(value)
        ? Math.max(1, value)
        : 1;
  }


  // ==========================================================
  // RESET
  // ==========================================================

  reset() {
    this.floorOffset =
      this.road.tubeRadius +
      this.bottomY -
      CLEARANCE;

    this.progress =
      1 -
      GRID_BACK / this.road.trackLength;

    this.laps = -1;
    this.maxLaps = -1;

    this.speed = 0;
    this.lat = this.gridLat;
    this.heading = 0;

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

    this.updatePose(
      0,
      true
    );
  }


  // ==========================================================
  // TOTAL RACE PROGRESS
  // ==========================================================

  get total() {
    return this.laps + this.progress;
  }


  // ==========================================================
  // MOVE ALONG TRACK
  // ==========================================================

  advance(distance) {
    this.progress +=
      distance /
      this.road.trackLength;

    while (this.progress >= 1) {
      this.progress -= 1;
      this.laps += 1;

      if (this.laps > this.maxLaps) {
        this.maxLaps = this.laps;

        if (this.laps === 0) {
          this.lapStart = this.raceTime;
        } else {
          this.lastLap =
            this.raceTime -
            this.lapStart;

          this.lapStart =
            this.raceTime;

          if (
            this.bestLap === null ||
            this.lastLap < this.bestLap
          ) {
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
        this.speed = Math.max(
          this.speed,
          0
        );

        break;
      }
    }
  }


  // ==========================================================
  // WALL COLLISION
  // ==========================================================

  clampToWalls() {
    let impact = 0;

    if (this.lat > this.latMax) {
      this.lat = this.latMax;

      const outwardSpeed =
        Math.abs(this.speed) *
        Math.max(
          0,
          Math.sin(this.heading)
        );

      if (outwardSpeed > 0.05) {
        impact = outwardSpeed;

        if (this.heading > 0) {
          this.heading =
            -this.heading * 0.3;
        }
      }
    } else if (this.lat < -this.latMax) {
      this.lat = -this.latMax;

      const outwardSpeed =
        Math.abs(this.speed) *
        Math.max(
          0,
          -Math.sin(this.heading)
        );

      if (outwardSpeed > 0.05) {
        impact = outwardSpeed;

        if (this.heading < 0) {
          this.heading =
            -this.heading * 0.3;
        }
      }
    }

    return impact;
  }


  // ==========================================================
  // PHYSICS
  // ==========================================================

  update(
    dt,
    canDrive,
    controlState = {}
  ) {
    this.impactThisFrame = 0;


    // ========================================================
    // PERFORMANCE
    // ========================================================

    const performance =
      this.performanceMultiplier || 1;

    const normalMaxSpeed =
      MAX_SPEED * performance;

    const nitroMaxSpeed =
      NITRO_SPEED * performance;

    const acceleration =
      ACCEL * performance;

    const braking =
      BRAKE * performance;

    const nitroAcceleration =
      NITRO_ACCEL * performance;

    const nitroDrain =
      NITRO_DRAIN / performance;

    const nitroRecharge =
      NITRO_RECHARGE * performance;


    // ========================================================
    // INPUT
    // ========================================================

    const throttle =
      canDrive &&
      !!controlState.throttle;

    const brake =
      canDrive &&
      !!controlState.brake;

    const brakeMultiplier =
      Number.isFinite(controlState.brakeMultiplier)
        ? controlState.brakeMultiplier
        : 1;

    const steerLeft =
      canDrive &&
      !!controlState.steerLeft;

    const steerRight =
      canDrive &&
      !!controlState.steerRight;

    const wantNitro =
      canDrive &&
      !!controlState.nitro;


    // ========================================================
    // NITRO
    // ========================================================

    if (
      this.nitroLocked &&
      this.nitro >= NITRO_MIN_TO_RESTART
    ) {
      this.nitroLocked = false;
    }

    this.nitroActive =
      wantNitro &&
      !this.nitroLocked &&
      this.nitro > 0;

    this.justStartedNitro =
      this.nitroActive &&
      !this.nitroWasActive;

    this.nitroWasActive =
      this.nitroActive;

    if (this.nitroActive) {
      this.nitro = Math.max(
        0,
        this.nitro -
        nitroDrain * dt
      );

      if (this.nitro === 0) {
        this.nitroLocked = true;
      }
    } else {
      this.nitro = Math.min(
        1,
        this.nitro +
        nitroRecharge * dt
      );
    }


    // ========================================================
    // LONGITUDINAL SPEED
    // ========================================================

    const topSpeed =
      this.nitroActive
        ? nitroMaxSpeed
        : normalMaxSpeed;

    if (this.nitroActive) {
      this.speed +=
        nitroAcceleration * dt;
    } else if (throttle && !brake) {
      this.speed +=
        acceleration * dt;
    } else if (brake) {
      if (this.speed > 0.05) {
        this.speed -=
          braking *
          brakeMultiplier *
          dt;
      } else {
        this.speed -=
          acceleration *
          0.6 *
          dt;
      }
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(
          0,
          this.speed -
          DRAG * dt
        );
      } else if (this.speed < 0) {
        this.speed = Math.min(
          0,
          this.speed +
          DRAG * dt
        );
      }
    }

    if (this.speed > topSpeed) {
      this.speed = Math.max(
        topSpeed,
        this.speed -
        DRAG *
        1.6 *
        dt
      );
    }

    this.speed = THREE.MathUtils.clamp(
      this.speed,
      -REVERSE_MAX,
      nitroMaxSpeed
    );


    // ========================================================
    // STEERING
    // ========================================================

    let steer;

    if (Number.isFinite(controlState.steer)) {
      steer = THREE.MathUtils.clamp(
        controlState.steer,
        -1,
        1
      );
    } else {
      steer =
        (steerLeft ? 1 : 0) -
        (steerRight ? 1 : 0);
    }

    const grip =
      0.35 +
      0.65 *
      Math.min(
        1,
        Math.abs(this.speed) / 3
      );

    const turnRate =
      steer *
      TURN_RATE *
      grip;


    // ========================================================
    // MOVE
    // ========================================================

    const oldFrame =
      this.road.getRoadFrame(
        THREE.MathUtils.clamp(
          this.progress,
          0,
          1
        )
      );

    const forwardDist =
      this.speed *
      dt *
      Math.cos(this.heading);

    const lateralDist =
      this.speed *
      dt *
      Math.sin(this.heading);

    this.advance(forwardDist);
    this.lat += lateralDist;

    const newFrame =
      this.road.getRoadFrame(
        THREE.MathUtils.clamp(
          this.progress,
          0,
          1
        )
      );

    const roadTurn = signedAngle(
      oldFrame.tangent,
      newFrame.tangent,
      oldFrame.up
    );

    this.heading = THREE.MathUtils.clamp(
      this.heading +
      turnRate * dt -
      roadTurn,
      -HEADING_MAX,
      HEADING_MAX
    );


    // ========================================================
    // WALL COLLISION
    // ========================================================

    const impact = this.clampToWalls();

    if (impact > 0.05) {
      this.speed *=
        1 -
        Math.min(
          0.55,
          impact * 0.18
        );

      this.impactThisFrame = Math.max(
        this.impactThisFrame,
        impact
      );
    }

    if (
      Math.abs(this.lat) >=
      this.latMax - 0.001
    ) {
      this.speed *=
        1 -
        0.4 * dt;
    }


    // ========================================================
    // VISUALS
    // ========================================================

    for (const wheel of this.wheels) {
      wheel.rotation.x +=
        this.speed *
        dt *
        1.4;
    }

    this.flames.update(
      this.nitroActive
    );
  }


  // ==========================================================
  // PLACE CAR ON ROAD
  // ==========================================================

  updatePose(
    dt,
    snap = false
  ) {
    const frame =
      this.road.getRoadFrame(
        THREE.MathUtils.clamp(
          this.progress,
          0,
          1
        )
      );

    this._right
      .crossVectors(
        frame.up,
        frame.tangent
      )
      .normalize();

    this._up
      .crossVectors(
        frame.tangent,
        this._right
      )
      .normalize();

    this._m.makeBasis(
      this._right,
      this._up,
      frame.tangent
    );

    this._targetQuat.setFromRotationMatrix(
      this._m
    );

    if (snap) {
      this.frameQuat.copy(
        this._targetQuat
      );
    } else {
      this.frameQuat.slerp(
        this._targetQuat,
        1 - Math.exp(-18 * dt)
      );
    }

    this._headingQuat.setFromAxisAngle(
      UP_AXIS,
      this.heading
    );

    this.car.quaternion
      .copy(this.frameQuat)
      .multiply(this._headingQuat);

    this.car.position
      .copy(frame.center)
      .addScaledVector(
        frame.floorDirection,
        this.floorOffset
      )
      .addScaledVector(
        this._right,
        this.lat
      );
  }
}


// ============================================================
// CAR-TO-CAR COLLISION
// ============================================================

export function resolveCarCollision(a, b) {
  const LEN = 1.2;
  const WID = 0.66;
  const SEPARATION_EPSILON = 0.015;

  const dLong =
    (b.total - a.total) *
    a.road.trackLength;

  const dLat =
    b.lat - a.lat;

  const ax = Math.abs(dLong);
  const ay = Math.abs(dLat);

  if (
    ax >= LEN ||
    ay >= WID
  ) {
    return 0;
  }

  const penLong = LEN - ax;
  const penLat = WID - ay;

  const relativeSpeed =
    Math.abs(
      a.speed -
      b.speed
    );

  let impactSpeed = 0;


  // ==========================================================
  // SIDE CONTACT
  // ==========================================================

  if (
    penLat / WID <
    penLong / LEN
  ) {
    const side =
      dLat === 0
        ? (
            a.id < b.id
              ? 1
              : -1
          )
        : Math.sign(dLat);

    const push =
      (
        penLat +
        SEPARATION_EPSILON
      ) / 2;

    a.lat -= side * push;
    b.lat += side * push;

    a.clampToWalls();
    b.clampToWalls();

    impactSpeed =
      relativeSpeed * 0.35;
  }


  // ==========================================================
  // FRONT / REAR CONTACT
  // ==========================================================

  else {
    const direction =
      dLong >= 0
        ? 1
        : -1;

    const push =
      (
        penLong +
        SEPARATION_EPSILON
      ) / 2;

    if (direction > 0) {
      a.advance(-push);
      b.advance(push);
    } else {
      b.advance(-push);
      a.advance(push);
    }

    if (relativeSpeed > 0.05) {
      impactSpeed = relativeSpeed;

      const averageSpeed =
        (
          a.speed +
          b.speed
        ) / 2;

      const separationSpeed =
        Math.min(
          0.25,
          0.03 +
          relativeSpeed * 0.08
        );

      if (direction > 0) {
        a.speed =
          averageSpeed -
          separationSpeed;

        b.speed =
          averageSpeed +
          separationSpeed;
      } else {
        a.speed =
          averageSpeed +
          separationSpeed;

        b.speed =
          averageSpeed -
          separationSpeed;
      }
    }
  }


  // ==========================================================
  // IMPACT
  // ==========================================================

  if (impactSpeed < 0.12) {
    return 0;
  }

  const impact = Math.min(
    1,
    0.10 +
    impactSpeed / 8
  );

  a.impactThisFrame = Math.max(
    a.impactThisFrame,
    impact
  );

  b.impactThisFrame = Math.max(
    b.impactThisFrame,
    impact
  );

  return impact;
}