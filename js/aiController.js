// ============================================================
// ZERO GRAVITY - AI CONTROLLER
// ============================================================


// ============================================================
// DIFFICULTY SETTINGS
// ============================================================

const DIFFICULTIES = {
  easy: {
    cruiseSpeed: 9.0,
    mildCornerSpeed: 7.5,
    mediumCornerSpeed: 6.2,
    sharpCornerSpeed: 5.0,
    steerDeadZone: 0.11,
    centerGain: 0.50,
    recoveryCenterGain: 0.70,
    turnGain: 1.30,
    farTurnGain: 0.30,
    useAdvancedNitro: false,
    collisionAvoidance: 0.55,
    overtakeDistance: 4.0,
  },

  normal: {
    cruiseSpeed: 10.6,
    mildCornerSpeed: 9.0,
    mediumCornerSpeed: 7.4,
    sharpCornerSpeed: 5.8,
    steerDeadZone: 0.065,
    centerGain: 0.62,
    recoveryCenterGain: 0.90,
    turnGain: 1.55,
    farTurnGain: 0.42,
    useAdvancedNitro: true,
    collisionAvoidance: 0.75,
    overtakeDistance: 5.0,
  },

  hard: {
    cruiseSpeed: 15.6,
    mildCornerSpeed: 15.0,
    mediumCornerSpeed: 13.8,
    sharpCornerSpeed: 11.5,
    steerDeadZone: 0.025,
    centerGain: 0.78,
    recoveryCenterGain: 1.15,
    turnGain: 2.05,
    farTurnGain: 0.28,
    collisionAvoidance: 1.15,
    overtakeDistance: 6.0,
    dangerDistance: 2.0,
    useAdvancedNitro: true,
    straightSeconds: 0.75,
    nitroBurstDuration: 1.25,
    nitroCooldownDuration: 0.35,
    nitroStartMinimum: 0.38,
  },
};


// ============================================================
// HELPERS
// ============================================================

function emptyControls() {
  return {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    nitro: false,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapProgress(progress) {
  return ((progress % 1) + 1) % 1;
}

function signedAngle(from, to, axis) {
  const crossX = from.y * to.z - from.z * to.y;
  const crossY = from.z * to.x - from.x * to.z;
  const crossZ = from.x * to.y - from.y * to.x;

  const crossDotAxis =
    crossX * axis.x +
    crossY * axis.y +
    crossZ * axis.z;

  const dot =
    from.x * to.x +
    from.y * to.y +
    from.z * to.z;

  return Math.atan2(crossDotAxis, dot);
}


// ============================================================
// AI CONTROLLER
// ============================================================

export class AIController {
  constructor(road, difficulty = "normal") {
    this.road = road;
    this.setDifficulty(difficulty);
    this.reset();
  }


  // ==========================================================
  // DIFFICULTY
  // ==========================================================

  setDifficulty(difficulty) {
    if (!DIFFICULTIES[difficulty]) {
      difficulty = "normal";
    }

    this.difficulty = difficulty;
    this.config = DIFFICULTIES[difficulty];
  }


  // ==========================================================
  // RESET
  // ==========================================================

  reset() {
    this.recoveryTimer = 0;
    this.overtakeTimer = 0;
    this.overtakeTargetLat = 0;
    this.nitroBurstActive = false;
    this.nitroBurstTimer = 0;
    this.nitroCooldown = 0;
  }


  // ==========================================================
  // ANALYZE ROAD
  // ==========================================================

  analyzeRoad(player, distance, samples = 10) {
    const startProgress = wrapProgress(player.progress);

    let previousFrame = this.road.getRoadFrame(startProgress);
    let totalTurn = 0;
    let maxTurn = 0;
    let signedTotalTurn = 0;

    for (let i = 1; i <= samples; i++) {
      const sampleDistance = distance * (i / samples);

      const progress = wrapProgress(
        startProgress + sampleDistance / this.road.trackLength
      );

      const frame = this.road.getRoadFrame(progress);

      const angle = signedAngle(
        previousFrame.tangent,
        frame.tangent,
        previousFrame.up
      );

      const absAngle = Math.abs(angle);

      totalTurn += absAngle;
      signedTotalTurn += angle;
      maxTurn = Math.max(maxTurn, absAngle);

      previousFrame = frame;
    }

    return {
      totalTurn,
      signedTotalTurn,
      maxTurn,
    };
  }


  // ==========================================================
  // STRAIGHT DETECTION
  // ==========================================================

  hasLongStraightAhead(player) {
    const config = this.config;

    const predictionSpeed = Math.max(
      Math.abs(player.speed),
      10
    );

    const seconds =
      this.difficulty === "hard"
        ? config.straightSeconds
        : 2.1;

    const distance = clamp(
      predictionSpeed * seconds,
      7,
      18
    );

    const analysis = this.analyzeRoad(
      player,
      distance,
      12
    );

    return (
      analysis.maxTurn < 0.07 &&
      analysis.totalTurn < 0.28
    );
  }


  // ==========================================================
  // CORNER ANALYSIS
  // ==========================================================

  getCornerInfo(player) {
    const near = this.analyzeRoad(
      player,
      6,
      5
    );

    const medium = this.analyzeRoad(
      player,
      14,
      7
    );

    const far = this.analyzeRoad(
      player,
      25,
      8
    );

    const severity = Math.max(
      near.totalTurn,
      near.maxTurn * 2.0,
      medium.totalTurn * 0.42,
      medium.maxTurn * 1.4
    );

    return {
      near,
      medium,
      far,
      severity,
    };
  }


  // ==========================================================
  // COLLISION / OVERTAKING
  // ==========================================================

  getOpponentStrategy(player, opponent, dt) {
    const result = {
      targetLat: 0,
      collisionDanger: false,
      blockedAhead: false,
      recovering: false,
    };

    if (player.impactThisFrame > 0.12) {
      this.recoveryTimer = 1.15;
      this.overtakeTimer = 0;
      this.overtakeTargetLat = 0;
    }

    if (this.recoveryTimer > 0) {
      this.recoveryTimer = Math.max(
        0,
        this.recoveryTimer - dt
      );

      result.targetLat = 0;
      result.recovering = true;

      return result;
    }

    if (!opponent || opponent.finished) {
      return result;
    }

    const longitudinalDistance =
      (opponent.total - player.total) *
      this.road.trackLength;

    const lateralDistance =
      opponent.lat - player.lat;

    if (
      Math.abs(longitudinalDistance) < 1.8 &&
      Math.abs(lateralDistance) < 0.95
    ) {
      result.collisionDanger = true;

      const directionAway =
        lateralDistance >= 0
          ? -1
          : 1;

      result.targetLat =
        directionAway *
        player.latMax *
        0.58;

      return result;
    }

    const overtakeDistance =
      this.config.overtakeDistance ?? 5;

    if (
      longitudinalDistance > 0.15 &&
      longitudinalDistance < overtakeDistance
    ) {
      result.blockedAhead = true;

      if (this.overtakeTimer <= 0) {
        const laneTarget =
          player.latMax * 0.62;

        const negativeLane =
          -laneTarget;

        const positiveLane =
          laneTarget;

        const negativeDistance = Math.abs(
          negativeLane - opponent.lat
        );

        const positiveDistance = Math.abs(
          positiveLane - opponent.lat
        );

        this.overtakeTargetLat =
          negativeDistance > positiveDistance
            ? negativeLane
            : positiveLane;

        this.overtakeTimer = 0.9;
      }
    }

    if (this.overtakeTimer > 0) {
      this.overtakeTimer = Math.max(
        0,
        this.overtakeTimer - dt
      );

      result.targetLat =
        this.overtakeTargetLat;
    }

    return result;
  }


  // ==========================================================
  // TARGET SPEED
  // ==========================================================

  getTargetSpeed(cornerInfo, strategy) {
    const config = this.config;
    const severity = cornerInfo.severity;

    let targetSpeed;

    if (severity < 0.16) {
      targetSpeed = config.cruiseSpeed;
    } else if (severity < 0.42) {
      targetSpeed = config.mildCornerSpeed;
    } else if (severity < 0.85) {
      targetSpeed = config.mediumCornerSpeed;
    } else {
      targetSpeed = config.sharpCornerSpeed;
    }

    if (strategy.recovering) {
      targetSpeed = Math.min(
        targetSpeed,
        11.0
      );
    }

    return targetSpeed;
  }


  // ==========================================================
  // PURE PURSUIT STEERING
  // ==========================================================

  getPursuitSteering(player) {
    const speed = Math.max(
      0,
      Math.abs(player.speed)
    );

    const lookAheadDistance = clamp(
      5 + speed * 0.55,
      6,
      13.5
    );

    const currentProgress =
      wrapProgress(player.progress);

    const targetProgress = wrapProgress(
      currentProgress +
      lookAheadDistance /
        this.road.trackLength
    );

    const currentFrame =
      this.road.getRoadFrame(
        currentProgress
      );

    const targetFrame =
      this.road.getRoadFrame(
        targetProgress
      );

    const carX =
      currentFrame.center.x +
      currentFrame.right.x *
        player.lat;

    const carY =
      currentFrame.center.y +
      currentFrame.right.y *
        player.lat;

    const carZ =
      currentFrame.center.z +
      currentFrame.right.z *
        player.lat;

    const targetX =
      targetFrame.center.x;

    const targetY =
      targetFrame.center.y;

    const targetZ =
      targetFrame.center.z;

    const dx =
      targetX - carX;

    const dy =
      targetY - carY;

    const dz =
      targetZ - carZ;

    const forward =
      dx * currentFrame.tangent.x +
      dy * currentFrame.tangent.y +
      dz * currentFrame.tangent.z;

    const side =
      dx * currentFrame.right.x +
      dy * currentFrame.right.y +
      dz * currentFrame.right.z;

    let desiredHeading = Math.atan2(
      side,
      Math.max(0.01, forward)
    );

    const latRatio =
      player.lat /
      Math.max(
        player.latMax,
        0.01
      );

    desiredHeading +=
      -latRatio * 0.24;

    const error =
      desiredHeading -
      player.heading;

    let steer =
      error * 2.35;

    steer = clamp(
      steer,
      -1,
      1
    );

    if (Math.abs(steer) < 0.045) {
      steer = 0;
    }

    return {
      steer,
      desiredHeading,
      error,
      lookAheadDistance,
    };
  }


  // ==========================================================
  // MAIN AI
  // ==========================================================

  getControls(
    player,
    canDrive,
    opponent = null,
    dt = 0
  ) {
    if (!canDrive || player.finished) {
      return emptyControls();
    }

    const config = this.config;

    const cornerInfo =
      this.getCornerInfo(player);

    const strategy =
      this.getOpponentStrategy(
        player,
        opponent,
        dt
      );

    const pursuit =
      this.getPursuitSteering(player);

    let analogSteer =
      pursuit.steer;

    if (strategy.recovering) {
      const centerError =
        -player.lat /
        Math.max(
          player.latMax,
          0.01
        );

      analogSteer +=
        centerError * 0.55;

      analogSteer = clamp(
        analogSteer,
        -1,
        1
      );
    }

    const targetLat =
      strategy.targetLat;

    const latLimit =
      Math.max(
        player.latMax,
        0.01
      );

    const lateralError =
      (targetLat - player.lat) /
      latLimit;

    const nearTurn =
      cornerInfo.near.signedTotalTurn;

    const farTurn =
      cornerInfo.medium.signedTotalTurn;

    const centeringStrength =
      strategy.recovering
        ? (
            config.recoveryCenterGain ??
            config.centerGain
          )
        : config.centerGain;

    const nearDirection =
      Math.sign(nearTurn);

    const farDirection =
      Math.sign(farTurn);

    const sameTurnDirection =
      nearDirection !== 0 &&
      farDirection !== 0 &&
      nearDirection === farDirection;

    const farAssist =
      sameTurnDirection
        ? farTurn *
          config.farTurnGain
        : 0;

    let desiredHeading =
      nearTurn *
        config.turnGain +
      farAssist +
      lateralError *
        centeringStrength;

    const currentLatRatio =
      player.lat /
      latLimit;

    if (
      Math.abs(currentLatRatio) >
      0.78
    ) {
      desiredHeading +=
        -currentLatRatio * 0.5;
    }

    desiredHeading = clamp(
      desiredHeading,
      -1.0,
      1.0
    );

    const headingError =
      desiredHeading -
      player.heading;

    const steerLeft =
      headingError >
      config.steerDeadZone;

    const steerRight =
      headingError <
      -config.steerDeadZone;

    let targetSpeed =
      this.getTargetSpeed(
        cornerInfo,
        strategy
      );

    const absHeading =
      Math.abs(player.heading);

    if (absHeading > 1.10) {
      targetSpeed = Math.min(
        targetSpeed,
        9.5
      );
    } else if (absHeading > 0.82) {
      targetSpeed = Math.min(
        targetSpeed,
        11.8
      );
    }

    if (
      Math.abs(currentLatRatio) >
      0.92
    ) {
      targetSpeed *= 0.90;
    }

    const speed =
      Math.max(
        0,
        player.speed
      );

    let throttle;
    let brake;

    if (this.difficulty === "hard") {
      brake =
        speed >
        targetSpeed + 1.8;

      throttle =
        !brake;
    } else {
      throttle =
        speed <
        targetSpeed;

      brake =
        speed >
        targetSpeed + 0.85;
    }

    if (
      strategy.collisionDanger &&
      opponent
    ) {
      const dLong =
        (opponent.total -
          player.total) *
        this.road.trackLength;

      if (
        dLong > 0 &&
        dLong < 1.15
      ) {
        brake = true;
        throttle = false;
      }
    }

    if (speed < 1.0) {
      throttle = true;
      brake = false;
    }

    let nitro = false;

    if (this.nitroCooldown > 0) {
      this.nitroCooldown =
        Math.max(
          0,
          this.nitroCooldown - dt
        );
    }

    if (this.nitroBurstActive) {
      this.nitroBurstTimer =
        Math.max(
          0,
          this.nitroBurstTimer - dt
        );
    }

    const emergencyCorner =
      cornerInfo.severity > 0.95;

    const badlyMisaligned =
      Math.abs(player.heading) > 0.75;

    const dangerouslyCloseToWall =
      Math.abs(currentLatRatio) > 0.92;

    const nitroEmergency =
      emergencyCorner ||
      badlyMisaligned ||
      dangerouslyCloseToWall ||
      strategy.collisionDanger ||
      strategy.recovering ||
      brake;

    if (this.nitroBurstActive) {
      if (
        player.nitro > 0.01 &&
        !player.nitroLocked &&
        !nitroEmergency &&
        this.nitroBurstTimer > 0
      ) {
        nitro = true;
      } else {
        this.nitroBurstActive = false;
        this.nitroBurstTimer = 0;

        this.nitroCooldown =
          config.nitroCooldownDuration ??
          0.7;
      }
    } else if (
      config.useAdvancedNitro &&
      this.nitroCooldown <= 0
    ) {
      const longStraight =
        this.hasLongStraightAhead(
          player
        );

      const alignedEnough =
        Math.abs(player.heading) <
        0.22;

      const safeFromWall =
        Math.abs(currentLatRatio) <
        0.68;

      const enoughNitro =
        player.nitro >=
        (
          config.nitroStartMinimum ??
          0.65
        );

      const safeToStart =
        !strategy.recovering &&
        !strategy.collisionDanger &&
        !brake;

      if (
        longStraight &&
        alignedEnough &&
        safeFromWall &&
        enoughNitro &&
        safeToStart &&
        !player.nitroLocked
      ) {
        this.nitroBurstActive = true;

        this.nitroBurstTimer =
          config.nitroBurstDuration ??
          2.0;

        nitro = true;
      }
    }

    if (nitro) {
      throttle = true;
      brake = false;
    }

    return {
      throttle,
      brake,
      steer: analogSteer,
      steerLeft: false,
      steerRight: false,
      nitro,
    };
  }
}