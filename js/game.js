import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { scene, renderer } from "./scene.js";
import { Road } from "./road.js";
import { Minimap } from "./minimap.js";
import {
  setupLights,
  updateMapLights,
  setupCarHeroLights,
  updateCarHeroLights,
} from "./lights.js";

import { AIController } from "./aiController.js";
import { DEFAULT_MAP } from "./maps/maps.js";
import { CAR_URL } from "./assets.js";
import { CONTROLS, setInputEnabled, isDown } from "./input.js";
import { Player, buildCar, resolveCarCollision, MAX_SPEED } from "./player.js";
import { ChaseCamera } from "./camera.js";
import { SplitScreen } from "./views.js";
import { Hud, formatTime } from "./hud.js";

import {
  EngineSound,
  playImpact,
  playNitro,
  playCountdownBeep,
  playGoBeep,
  playLap,
  playFinalLap,
  playFanfare,
  pauseAllAudio,
  resumeAllAudio,
  stopAllAudio,
} from "./audio.js";


const PLAYER_SPECS = [
  {
    id: 0,
    name: "PLAYER 1",
    color: "#2aa8ff",
    style: {
      body: 0x1976d2,
      edge: 0x00aaff,
      emissive: 0x061827,
    },
    controls: CONTROLS.p1,
    gridLat: 0.85,
  },
  {
    id: 1,
    name: "PLAYER 2",
    color: "#ff4d4d",
    style: {
      body: 0xd32f2f,
      edge: 0xff6b6b,
      emissive: 0x270606,
    },
    controls: CONTROLS.p2,
    gridLat: -0.85,
  },
];


// ============================================================
// HUMAN CONTROLS
// ============================================================

function getHumanControls(controls) {
  return {
    throttle: isDown(controls.up),
    brake: isDown(controls.down),
    steerLeft: isDown(controls.left),
    steerRight: isDown(controls.right),
    nitro: isDown(controls.nitro),
  };
}


// ============================================================
// GAME
// ============================================================

export class Game {
  constructor() {
    this.map = DEFAULT_MAP;
    this.road = new Road(this.map);

    setupLights(this.road);

    this.mode = "local";
    this.aiDifficulty = "normal";

    this.aiController = new AIController(
      this.road,
      this.aiDifficulty
    );

    this.state = "idle";
    this.totalLaps = 3;
    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;
    this.paused = false;

    this._escapeHandler = (event) => {
      if (event.code !== "Escape" || event.repeat) return;

      if (
        this.state === "idle" ||
        this.state === "finished"
      ) {
        return;
      }

      event.preventDefault();

      if (this.paused) {
        this.resumeGame();
      } else {
        this.pauseGame();
      }
    };

    window.addEventListener(
      "keydown",
      this._escapeHandler
    );

    this.ready = new GLTFLoader()
      .loadAsync(CAR_URL)
      .then((gltf) => this.setup(gltf.scene));
  }


  // ==========================================================
  // SETUP
  // ==========================================================

  setup(template) {
    this.players = PLAYER_SPECS.map((spec) => {
      const model = buildCar(
        template,
        spec.style
      );

      return new Player({
        ...spec,
        model,
        road: this.road,
      });
    });

    setupCarHeroLights(this.players);

    this.cameras = this.players.map(
      () => new ChaseCamera()
    );

    this.views = new SplitScreen(
      renderer,
      scene,
      this.cameras.map((camera) => camera.camera)
    );

    this.hud = new Hud(this.players);
    this.minimap = new Minimap(
      this.road,
      this.players
    );

    this.engineSounds = null;
  }


  // ==========================================================
  // GAME MODE
  // ==========================================================

  setMode(
    mode = "local",
    aiDifficulty = "normal"
  ) {
    this.mode =
      mode === "ai"
        ? "ai"
        : "local";

    this.aiDifficulty =
      ["easy", "normal", "hard"].includes(aiDifficulty)
        ? aiDifficulty
        : "normal";

    this.aiController.setDifficulty(
      this.aiDifficulty
    );

    if (this.players?.[0]) {
      this.players[0].setPerformanceMultiplier(1);
    }

    if (this.players?.[1]) {
      const hardAi =
        this.mode === "ai" &&
        this.aiDifficulty === "hard";

      this.players[1].setPerformanceMultiplier(
        hardAi ? 1.3 : 1
      );
    }

    if (this.players?.[1]) {
      this.players[1].name =
        this.mode === "ai"
          ? "NOVA AI"
          : "PLAYER 2";
    }

    this.views?.setMode(this.mode);
    this.hud?.setMode(this.mode);
    this.minimap?.setMode(this.mode);

    if (this.hud) {
      if (this.mode === "ai") {
        this.hud.setPlayerIdentity(
          1,
          "NOVA AI",
          `${this.aiDifficulty.toUpperCase()} AI`
        );
      } else {
        this.hud.setPlayerIdentity(
          1,
          "PLAYER 2",
          "↑ ← ↓ → · ENTER = NITRO"
        );
      }
    }
  }


  // ==========================================================
  // PAUSE
  // ==========================================================

  pauseGame() {
    if (
      this.paused ||
      (
        this.state !== "racing" &&
        this.state !== "countdown"
      )
    ) {
      return;
    }

    this.paused = true;

    setInputEnabled(false);
    pauseAllAudio();

    this.hud.showPauseMenu({
      onResume: () => {
        this.resumeGame();
      },

      onRestart: () => {
        this.restartGame();
      },

      onMenu: () => {
        stopAllAudio();
        window.location.reload();
      },
    });
  }


  // ==========================================================
  // RESUME
  // ==========================================================

  async resumeGame() {
    if (!this.paused) return;

    this.paused = false;

    this.hud.hidePauseMenu();
    setInputEnabled(true);

    await resumeAllAudio();
  }


  // ==========================================================
  // RESTART
  // ==========================================================

  async restartGame() {
    this.paused = false;

    this.hud.hidePauseMenu();

    await resumeAllAudio();

    if (this.engineSounds) {
      this.engineSounds.forEach((engine) => {
        engine?.reset();
      });
    }

    this.start(this.totalLaps);
  }


  // ==========================================================
  // MAP
  // ==========================================================

  setMap(mapConfig) {
    this.map = mapConfig;

    this.road.setMap(mapConfig);
    updateMapLights(this.road);

    this.minimap?.setRoad(this.road);

    if (this.players && this.cameras) {
      this.players.forEach((player, index) => {
        player.reset();
        this.cameras[index].update(
          player,
          0,
          true
        );
      });
    }
  }


  // ==========================================================
  // START
  // ==========================================================

  start(laps) {
    this.paused = false;
    this.hud.hidePauseMenu();

    const parsedLaps = Number(laps);

    this.totalLaps = Number.isFinite(parsedLaps)
      ? Math.max(1, Math.floor(parsedLaps))
      : 3;

    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;

    this.state = "countdown";

    this.aiController.reset();

    this.hud.hideResults();

    setInputEnabled(true);

    this.minimap.show();

    if (!this.engineSounds) {
      this.engineSounds = this.players.map((_, index) => {
        if (this.mode === "ai" && index === 1) {
          return null;
        }

        return new EngineSound(
          index === 0 ? -0.25 : 0.25
        );
      });
    } else {
      this.engineSounds.forEach((engine) => {
        engine?.reset();
      });
    }

    this._lastCountdownTick = null;

    this.players.forEach((player, index) => {
      player.reset();

      player.lastAudioLap = player.laps;

      this.cameras[index].update(
        player,
        0,
        true
      );

      this.hud.setMessage(
        index,
        ""
      );
    });

    this.minimap.update();
    this.updateHud();
  }


  // ==========================================================
  // RANK
  // ==========================================================

  rank(player) {
    const other = this.players.find(
      (candidate) => candidate !== player
    );

    if (player.finished !== other.finished) {
      return player.finished ? 1 : 2;
    }

    if (player.finished && other.finished) {
      return player.finishTime <= other.finishTime
        ? 1
        : 2;
    }

    return player.total >= other.total
      ? 1
      : 2;
  }


  // ==========================================================
  // UPDATE
  // ==========================================================

  update(dt) {
    if (
      this.state === "idle" ||
      this.paused
    ) {
      return;
    }

    dt = Math.min(dt, 0.05);

    this.road.update(dt);


    // ========================================================
    // RACE STATE
    // ========================================================

    if (this.state === "countdown") {
      this.countdown -= dt;

      if (this.countdown <= 0) {
        this.state = "racing";
        this.raceTime = 0;
        this.goTimer = 1;

        this.players.forEach((_, index) => {
          this.hud.setMessage(
            index,
            "GO!",
            "go"
          );
        });

        playGoBeep();
      } else {
        const tick = Math.ceil(this.countdown);

        if (tick !== this._lastCountdownTick) {
          this._lastCountdownTick = tick;
          playCountdownBeep();
        }

        this.players.forEach((_, index) => {
          this.hud.setMessage(
            index,
            String(tick),
            "count"
          );
        });
      }
    } else if (this.state === "racing") {
      this.raceTime += dt;

      if (this.goTimer > 0) {
        this.goTimer -= dt;

        if (this.goTimer <= 0) {
          this.players.forEach((_, index) => {
            this.hud.setMessage(
              index,
              ""
            );
          });
        }
      }
    }

    const canDrive =
      this.state === "racing";


    // ========================================================
    // PHYSICS
    // ========================================================

    for (
      let i = 0;
      i < this.players.length;
      i++
    ) {
      const player = this.players[i];

      player.raceTime = this.raceTime;

      let controls;

      if (
        this.mode === "ai" &&
        i === 1
      ) {
        const opponent = this.players[0];

        controls =
          this.aiController.getControls(
            player,
            canDrive,
            opponent,
            dt
          );
      } else {
        controls = getHumanControls(
          player.controls
        );

        controls.brakeMultiplier = 2.0;
      }

      player.audioControls = controls;

      player.update(
        dt,
        canDrive,
        controls
      );
    }

    const carImpact =
      resolveCarCollision(
        this.players[0],
        this.players[1]
      );

    if (carImpact > 0) {
      playImpact(carImpact);
    }


    // ========================================================
    // AUDIO
    // ========================================================

    if (this.engineSounds) {
      this.players.forEach((player, index) => {
        const controls =
          player.audioControls || {};

        const performance =
          player.performanceMultiplier || 1;

        const carMaxSpeed =
          MAX_SPEED * performance;

        const speedRatio =
          Math.abs(player.speed) /
          carMaxSpeed;

        const wallContact =
          Math.abs(player.lat) >=
          player.latMax - 0.002;

        const engineSound = this.engineSounds[index];

        if (engineSound) {
          engineSound.update({
            speedRatio,
            nitroActive: player.nitroActive,
            throttleActive: !!controls.throttle,
            brakeActive: !!controls.brake,
            wallContact,
          });
        }

        if (
          player.justStartedNitro &&
          !(this.mode === "ai" && index === 1)
        ) {
          playNitro(
            index === 0
              ? -0.2
              : 0.2
          );
        }

        if (player.impactThisFrame > 0.12) {
          playImpact(
            player.impactThisFrame
          );
        }
      });
    }


    // ========================================================
    // POSE + CAMERAS
    // ========================================================

    this.players.forEach((player, index) => {
      player.updatePose(dt);
      this.cameras[index].update(
        player,
        dt
      );
    });

    updateCarHeroLights(
      this.players
    );


    // ========================================================
    // LAP / FINISH
    // ========================================================

    if (this.state === "racing") {
      this.updateLapAudio();
      this.checkFinish();
    }

    if (this.state === "finished") {
      this.endTimer += dt;

      if (
        this.endTimer > 2.5 &&
        !this.hud.results
      ) {
        this.showResults();
      }
    }

    this.updateHud();
  }


  // ==========================================================
  // LAP AUDIO
  // ==========================================================

  updateLapAudio() {
    this.players.forEach((player, index) => {
      if (
        player.laps ===
        player.lastAudioLap
      ) {
        return;
      }

      const previousLap =
        player.lastAudioLap;

      player.lastAudioLap =
        player.laps;

      if (previousLap < 0) {
        return;
      }

      if (
        player.laps >=
        this.totalLaps
      ) {
        return;
      }

      const pan =
        index === 0
          ? -0.18
          : 0.18;

      const enteringFinalLap =
        this.totalLaps > 1 &&
        player.laps === this.totalLaps - 1;

      if (enteringFinalLap) {
        playFinalLap(pan);
      } else {
        playLap(pan);
      }
    });
  }


  // ==========================================================
  // FINISH
  // ==========================================================

  checkFinish() {
    for (const player of this.players) {
      if (
        !player.finished &&
        player.laps >= this.totalLaps
      ) {
        player.finished = true;
        player.finishTime = this.raceTime;
      }
    }

    const finishers = this.players.filter(
      (player) => player.finished
    );

    if (finishers.length === 0) return;

    finishers.sort(
      (a, b) => b.total - a.total
    );

    this.winner = finishers[0];
    this.state = "finished";
    this.endTimer = 0;

    this.players.forEach((player, index) => {
      if (player === this.winner) {
        this.hud.setMessage(
          index,
          "YOU WIN!",
          "win"
        );
      } else {
        this.hud.setMessage(
          index,
          `${this.winner.name} WINS`,
          "lose"
        );
      }
    });

    playFanfare();
  }


  // ==========================================================
  // RESULTS
  // ==========================================================

  showResults() {
    const winner = this.winner;

    const rows = [...this.players]
      .sort((a, b) =>
        a === winner
          ? -1
          : b === winner
            ? 1
            : b.total - a.total
      )
      .map((player, index) => {
        let result;

        if (player.finished) {
          result = formatTime(
            player.finishTime
          );
        } else {
          const done = Math.max(
            0,
            player.total
          );

          const lapNo = Math.min(
            this.totalLaps,
            Math.floor(done) + 1
          );

          result =
            `Lap ${lapNo}/${this.totalLaps} ` +
            `(${Math.round((done / this.totalLaps) * 100)}%)`;
        }

        return {
          place: index + 1,
          name: player.name,
          color: player.color,
          result,
          best: formatTime(player.bestLap),
        };
      });

    this.hud.showResults({
      title: `${winner.name} WINS!`,
      color: winner.color,
      rows,
      onRematch: () =>
        this.start(this.totalLaps),
      onMenu: () =>
        window.location.reload(),
    });
  }


  // ==========================================================
  // HUD
  // ==========================================================

  updateHud() {
    this.players.forEach((player, index) => {
      const lap = Math.min(
        this.totalLaps,
        Math.max(
          1,
          player.laps + 1
        )
      );

      const lapTime =
        player.laps < 0
          ? 0
          : player.finished
            ? player.lastLap
            : player.raceTime -
            player.lapStart;

      this.hud.updatePlayer(index, {
        lap,
        totalLaps: this.totalLaps,
        pos: this.rank(player),
        count: this.players.length,
        lapTime,
        bestLap: player.bestLap,
        speed: Math.round(
          Math.abs(player.speed) * 14
        ),
        nitro: player.nitro,
        nitroActive: player.nitroActive,
        nitroLocked: player.nitroLocked,
      });
    });
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  render(dt) {
    if (this.state === "idle") return;

    this.views.render(dt);
    this.minimap?.update();
  }
}