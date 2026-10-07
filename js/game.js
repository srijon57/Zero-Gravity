import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { scene, renderer } from "./scene.js";
import { Road } from "./road.js";
import { Minimap } from "./minimap.js";
import {
  setupLights,
  updateMapLights
} from "./lights.js";
import { AIController } from "./aiController.js";
import {
  DEFAULT_MAP
} from "./maps/maps.js";
import { CAR_URL } from "./assets.js";
import {
  CONTROLS,
  setInputEnabled,
  isDown
} from "./input.js";
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
  stopAllAudio
} from "./audio.js";

const PLAYER_SPECS = [
  {
    id: 0,
    name: "PLAYER 1",
    color: "#2aa8ff",
    style: { body: 0x1976d2, edge: 0x00aaff, emissive: 0x061827 },
    controls: CONTROLS.p1,
    gridLat: 0.85,
  },
  {
    id: 1,
    name: "PLAYER 2",
    color: "#ff4d4d",
    style: { body: 0xd32f2f, edge: 0xff6b6b, emissive: 0x270606 },
    controls: CONTROLS.p2,
    gridLat: -0.85,
  },
];

// ============================================================
// HUMAN KEYBOARD -> VIRTUAL CONTROLS
// ============================================================

function getHumanControls(
  controls
) {

  return {

    throttle:
      isDown(
        controls.up
      ),

    brake:
      isDown(
        controls.down
      ),

    steerLeft:
      isDown(
        controls.left
      ),

    steerRight:
      isDown(
        controls.right
      ),

    nitro:
      isDown(
        controls.nitro
      ),

  };

}

export class Game {
  constructor() {

    // =========================
    // MAP + ROAD
    // =========================

    this.map = DEFAULT_MAP;

    this.road = new Road(this.map);

    setupLights(this.road);
    // =========================
    // GAME MODE
    // =========================

    this.mode = "local";

    this.aiDifficulty = "normal";

    this.aiController =
      new AIController(
        this.road,
        this.aiDifficulty
      );

    // =========================
    // GAME STATE
    // =========================

    this.state = "idle"; // idle | countdown | racing | finished

    this.totalLaps = 3;
    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;

    // =========================
// PAUSE STATE
// =========================

this.paused = false;


// =========================
// ESCAPE KEY
// =========================

this._escapeHandler = (event) => {

  if (
    event.code !== "Escape" ||
    event.repeat
  ) {
    return;
  }


  // Ignore ESC on landing/results.

  if (
    this.state === "idle" ||
    this.state === "finished"
  ) {
    return;
  }


  event.preventDefault();


  if (
    this.paused
  ) {

    this.resumeGame();

  }

  else {

    this.pauseGame();

  }

};


window.addEventListener(
  "keydown",
  this._escapeHandler
);

    // Preload the car model while landing page is showing
    this.ready = new GLTFLoader()
      .loadAsync(CAR_URL)
      .then((gltf) =>
        this.setup(gltf.scene)
      );

  }



  

  setup(template) {

    this.players = PLAYER_SPECS.map((spec) => {

      const model =
        buildCar(
          template,
          spec.style
        );


      return new Player({

        ...spec,

        model,

        road: this.road

      });

    });


    this.cameras =
      this.players.map(
        () => new ChaseCamera()
      );


    this.views =
      new SplitScreen(
        renderer,
        scene,
        this.cameras.map(
          (c) => c.camera
        )
      );


    this.hud = new Hud(this.players);

    this.minimap = new Minimap(this.road, this.players);

    this.engineSounds = null;

  }

  setMode(
    mode = "local",
    aiDifficulty = "normal"
  ) {

    this.mode =
      mode === "ai"
        ? "ai"
        : "local";


    this.aiDifficulty =
      ["easy", "normal", "hard"]
        .includes(aiDifficulty)
        ? aiDifficulty
        : "normal";


    this.aiController.setDifficulty(
      this.aiDifficulty
    );

    // ==========================================================
    // CAR PERFORMANCE
    // ==========================================================

    // Player 1 always uses the basic car.

    if (
      this.players?.[0]
    ) {

      this.players[0]
        .setPerformanceMultiplier(
          1
        );

    }


    // Player 2:
    //
    // LOCAL       → 1.0x
    // EASY AI     → 1.0x
    // NORMAL AI   → 1.0x
    // HARD AI     → 1.5x

    if (
      this.players?.[1]
    ) {

      const hardAi =
        this.mode === "ai" &&
        this.aiDifficulty === "hard";


      this.players[1]
        .setPerformanceMultiplier(

          hardAi
            ? 1.3
            : 1

        );

    }

    // Player 2 becomes NOVA AI
    // when AI mode is selected.

    if (
      this.players &&
      this.players[1]
    ) {

      if (
        this.mode === "ai"
      ) {

        this.players[1].name =
          "NOVA AI";

      }

      else {

        this.players[1].name =
          "PLAYER 2";

      }

    }


    // These methods will be added below.

    this.views?.setMode(
      this.mode
    );


    this.hud?.setMode(
      this.mode
    );


    this.minimap?.setMode(
      this.mode
    );


    if (this.hud) {

      if (
        this.mode === "ai"
      ) {

        this.hud.setPlayerIdentity(
          1,
          "NOVA AI",
          `${this.aiDifficulty.toUpperCase()} AI`
        );

      }

      else {

        this.hud.setPlayerIdentity(
          1,
          "PLAYER 2",
          "↑ ← ↓ → · ENTER = NITRO"
        );

      }

    }

  }

  // ==========================================================
// PAUSE GAME
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


  this.paused =
    true;


  setInputEnabled(
    false
  );


  // ========================================================
  // FREEZE ALL AUDIO
  // ========================================================

  pauseAllAudio();


  this.hud.showPauseMenu({

    onResume:
      () => {

        this.resumeGame();

      },


    onRestart:
      () => {

        this.restartGame();

      },


    onMenu:
      () => {

        stopAllAudio();

        window.location.reload();

      }

  });

}


// ==========================================================
// RESUME
// ==========================================================

async resumeGame() {

  if (
    !this.paused
  ) {
    return;
  }


  this.paused =
    false;


  this.hud.hidePauseMenu();


  setInputEnabled(
    true
  );


  // ========================================================
  // CONTINUE AUDIO FROM EXACT PAUSE POINT
  // ========================================================

  await resumeAllAudio();

}


  
// ==========================================================
// RESTART
// ==========================================================

async restartGame() {

  this.paused =
    false;


  this.hud.hidePauseMenu();


  await resumeAllAudio();


  if (
    this.engineSounds
  ) {

    this.engineSounds.forEach(
      (engine) => {

        engine.reset();

      }
    );

  }


  this.start(
    this.totalLaps
  );

}
  setMap(mapConfig) {
    this.map = mapConfig;

    this.road.setMap(mapConfig);
    updateMapLights(this.road);

    this.minimap?.setRoad(this.road);

    if (this.players && this.cameras) {
      this.players.forEach((player, index) => {
        player.reset();
        this.cameras[index].update(player, 0, true);
      });
    }
  }

  start(laps) {
    this.paused = false;

this.hud.hidePauseMenu();
    const parsedLaps =
      Number(laps);


    this.totalLaps =
      Number.isFinite(parsedLaps)
        ? Math.max(
          1,
          Math.floor(parsedLaps)
        )
        : 3;
    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;

    this.paused = false;




    this.state = "countdown";
    this.aiController.reset();

    this.hud.hideResults();
    setInputEnabled(true);
    this.minimap.show();
    if (
  !this.engineSounds
) {

  this.engineSounds =

    this.players.map(

      (_, i) =>

        new EngineSound(

          i === 0
            ? -0.25
            : 0.25

        )

    );

}

else {

  this.engineSounds.forEach(
    (engine) => {

      engine.reset();

    }
  );

}

    this._lastCountdownTick = null;

    this.players.forEach(
  (p, i) => {

    p.reset();


    // ======================================================
    // LAP AUDIO TRACKING
    // ======================================================

    p.lastAudioLap =
      p.laps;


    this.cameras[i].update(
      p,
      0,
      true
    );


    this.hud.setMessage(
      i,
      ""
    );

  }
);
    this.minimap.update();
    this.updateHud();
  }

  rank(player) {
    const other = this.players.find((p) => p !== player);
    if (player.finished !== other.finished) return player.finished ? 1 : 2;
    if (player.finished && other.finished) return player.finishTime <= other.finishTime ? 1 : 2;
    return player.total >= other.total ? 1 : 2;
  }

  update(dt) {
    
  if (
    this.state === "idle" ||
    this.paused
  ) {
    return;
  }
    dt = Math.min(dt, 0.05);

    this.road.update(dt);

    // ---- race state ----
    if (this.state === "countdown") {
      this.countdown -= dt;

      if (this.countdown <= 0) {
        this.state = "racing";
        this.raceTime = 0;
        this.goTimer = 1;
        this.players.forEach((_, i) => this.hud.setMessage(i, "GO!", "go"));
        playGoBeep();
      } else {
        const tick = Math.ceil(this.countdown);
        if (tick !== this._lastCountdownTick) {
          this._lastCountdownTick = tick;
          playCountdownBeep();
        }
        this.players.forEach((_, i) => this.hud.setMessage(i, String(tick), "count"));
      }
    } else if (this.state === "racing") {
      this.raceTime += dt;

      if (this.goTimer > 0) {
        this.goTimer -= dt;
        if (this.goTimer <= 0) this.players.forEach((_, i) => this.hud.setMessage(i, ""));
      }
    }

    const canDrive = this.state === "racing";

    // ---- physics ----
    for (
      let i = 0;
      i < this.players.length;
      i++
    ) {

      const p =
        this.players[i];


      p.raceTime =
        this.raceTime;


      let controls;


      // --------------------------------
      // Player 2 = AI
      // --------------------------------

      if (
        this.mode === "ai" &&
        i === 1
      ) {

        const opponent =
          this.players[0];


        controls =
          this.aiController
            .getControls(
              p,
              canDrive,
              opponent,
              dt
            );

      }


      // --------------------------------
      // Normal keyboard player
      // --------------------------------

      else {

        controls =
          getHumanControls(
            p.controls
          );
        
        controls.brakeMultiplier = 2.0;

      }


      p.audioControls =
  controls;


p.update(
  dt,
  canDrive,
  controls
);

    }

    const carImpact = resolveCarCollision(this.players[0], this.players[1]);
    if (carImpact > 0) playImpact(carImpact);

    // ---- sound: engine hum, nitro whoosh, wall impacts ----
    if (this.engineSounds) {
      this.players.forEach(
  (p, i) => {

    const controls =
      p.audioControls || {};


    // AI uses a faster physical car,
    // so normalize against that car's
    // own maximum speed.

    const performance =

      p.performanceMultiplier ||

      1;


    const carMaxSpeed =

      MAX_SPEED *

      performance;


    const speedRatio =

      Math.abs(
        p.speed
      ) /

      carMaxSpeed;


    const wallContact =

      Math.abs(
        p.lat
      ) >=

      p.latMax -
      0.002;


    this.engineSounds[i]
      .update({

        speedRatio,

        nitroActive:
          p.nitroActive,

        throttleActive:
          !!controls.throttle,

        brakeActive:
          !!controls.brake,

        wallContact

      });


    // ======================================================
    // NITRO START
    // ======================================================

    if (
  p.justStartedNitro &&
  !(this.mode === "ai" && i === 1)
) {
  playNitro(
    i === 0 ? -0.2 : 0.2
  );
}


    // ======================================================
    // IMPACT
    // ======================================================

    if (
      p.impactThisFrame >
      0.12
    ) {

      playImpact(
        p.impactThisFrame
      );

    }

  }
);
    }

    // ---- pose + cameras ----
    this.players.forEach((p, i) => {
      p.updatePose(dt);
      this.cameras[i].update(p, dt);
    });

    // ---- finish detection ----
    // ========================================================
// LAP AUDIO
// ========================================================

if (
  this.state === "racing"
) {

  this.updateLapAudio();

}


// ========================================================
// FINISH DETECTION
// ========================================================

if (
  this.state === "racing"
) {

  this.checkFinish();

}

    if (this.state === "finished") {
      this.endTimer += dt;
      if (this.endTimer > 2.5 && !this.hud.results) this.showResults();
    }

    this.updateHud();
  }

  // ==========================================================
// LAP AUDIO
// ==========================================================

updateLapAudio() {

  this.players.forEach(
    (player, index) => {

      // No change in lap number.

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


      // ====================================================
      // IGNORE INITIAL START-LINE CROSSING
      //
      // -1 -> 0
      //
      // That's the beginning of lap 1,
      // not completion of a lap.
      // ====================================================

      if (
        previousLap < 0
      ) {

        return;

      }


      // ====================================================
      // DON'T PLAY LAP SOUND AFTER FINISH
      // ====================================================

      if (
        player.laps >=
        this.totalLaps
      ) {

        return;

      }


      // ====================================================
      // PAN
      //
      // Player 1 = slightly left
      // Player 2 / NOVA = slightly right
      // ====================================================

      const pan =

        index === 0

          ? -0.18

          : 0.18;


      // ====================================================
      // FINAL LAP
      //
      // Example, 3 laps:
      //
      // laps = 0 -> LAP 1
      // laps = 1 -> LAP 2
      // laps = 2 -> LAP 3 / FINAL LAP
      // ====================================================

      const enteringFinalLap =

        this.totalLaps > 1 &&

        player.laps ===
        this.totalLaps - 1;


      if (
        enteringFinalLap
      ) {

        playFinalLap(
          pan
        );

      }

      else {

        playLap(
          pan
        );

      }

    }
  );

}

  checkFinish() {
    for (const p of this.players) {
      if (!p.finished && p.laps >= this.totalLaps) {
        p.finished = true;
        p.finishTime = this.raceTime;
      }
    }

    const finishers = this.players.filter((p) => p.finished);
    if (finishers.length === 0) return;

    finishers.sort((a, b) => b.total - a.total);
    this.winner = finishers[0];
    this.state = "finished";
    this.endTimer = 0;

    this.players.forEach((p, i) => {
      if (p === this.winner) this.hud.setMessage(i, "YOU WIN!", "win");
      else this.hud.setMessage(i, `${this.winner.name} WINS`, "lose");
    });

    playFanfare();
  }

  showResults() {
    const winner = this.winner;
    const rows = [...this.players]
      .sort((a, b) => (a === winner ? -1 : b === winner ? 1 : b.total - a.total))
      .map((p, idx) => {
        let result;
        if (p.finished) {
          result = formatTime(p.finishTime);
        } else {
          const done = Math.max(0, p.total);
          const lapNo = Math.min(this.totalLaps, Math.floor(done) + 1);
          result = `Lap ${lapNo}/${this.totalLaps} (${Math.round((done / this.totalLaps) * 100)}%)`;
        }
        return {
          place: idx + 1,
          name: p.name,
          color: p.color,
          result,
          best: formatTime(p.bestLap),
        };
      });

    this.hud.showResults({
      title: `${winner.name} WINS!`,
      color: winner.color,
      rows,
      onRematch: () => this.start(this.totalLaps),
      onMenu: () => window.location.reload(),
    });
  }

  updateHud() {
    this.players.forEach((p, i) => {
      const lap = Math.min(this.totalLaps, Math.max(1, p.laps + 1));
      const lapTime = p.laps < 0 ? 0 : p.finished ? p.lastLap : p.raceTime - p.lapStart;

      this.hud.updatePlayer(i, {
        lap,
        totalLaps: this.totalLaps,
        pos: this.rank(p),
        count: this.players.length,
        lapTime,
        bestLap: p.bestLap,
        speed: Math.round(Math.abs(p.speed) * 14),
        nitro: p.nitro,
        nitroActive: p.nitroActive,
        nitroLocked: p.nitroLocked,
      });
    });
  }

  render(dt) {
    if (this.state === "idle") return;

    this.views.render(dt);
    this.minimap?.update();
  }
}

