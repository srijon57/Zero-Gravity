import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { scene, renderer } from "./scene.js";
import { roadUniforms } from "./road.js";
import "./lights.js";
import { CAR_URL } from "./assets.js";
import { CONTROLS, setInputEnabled } from "./input.js";
import { Player, buildCar, resolveCarCollision } from "./player.js";
import { ChaseCamera } from "./camera.js";
import { SplitScreen } from "./views.js";
import { Hud, formatTime } from "./hud.js";

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

export class Game {
  constructor() {
    this.state = "idle"; // idle | countdown | racing | finished
    this.totalLaps = 3;
    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;

    // Preload the car model while the landing page is showing
    this.ready = new GLTFLoader().loadAsync(CAR_URL).then((gltf) => this.setup(gltf.scene));
  }

  setup(template) {
    this.players = PLAYER_SPECS.map((spec) => {
      const model = buildCar(template, spec.style);
      return new Player({ ...spec, model });
    });

    this.cameras = this.players.map(() => new ChaseCamera());
    this.views = new SplitScreen(
      renderer,
      scene,
      this.cameras.map((c) => c.camera)
    );
    this.hud = new Hud(this.players);
  }

  start(laps) {
    this.totalLaps = laps;
    this.raceTime = 0;
    this.countdown = 3;
    this.goTimer = 0;
    this.endTimer = 0;
    this.winner = null;
    this.state = "countdown";

    this.hud.hideResults();
    setInputEnabled(true);

    this.players.forEach((p, i) => {
      p.reset();
      this.cameras[i].update(p, 0, true);
      this.hud.setMessage(i, "");
    });
  }

  rank(player) {
    const other = this.players.find((p) => p !== player);
    if (player.finished !== other.finished) return player.finished ? 1 : 2;
    if (player.finished && other.finished) return player.finishTime <= other.finishTime ? 1 : 2;
    return player.total >= other.total ? 1 : 2;
  }

  update(dt) {
    if (this.state === "idle") return;
    dt = Math.min(dt, 0.05);

    roadUniforms.uTime.value += dt * 0.5;

    // ---- race state ----
    if (this.state === "countdown") {
      this.countdown -= dt;

      if (this.countdown <= 0) {
        this.state = "racing";
        this.raceTime = 0;
        this.goTimer = 1;
        this.players.forEach((_, i) => this.hud.setMessage(i, "GO!", "go"));
      } else {
        const n = String(Math.ceil(this.countdown));
        this.players.forEach((_, i) => this.hud.setMessage(i, n, "count"));
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
    for (const p of this.players) {
      p.raceTime = this.raceTime;
      p.update(dt, canDrive);
    }

    resolveCarCollision(this.players[0], this.players[1]);

    // ---- pose + cameras ----
    this.players.forEach((p, i) => {
      p.updatePose(dt);
      this.cameras[i].update(p, dt);
    });

    // ---- finish detection ----
    if (this.state === "racing") this.checkFinish();

    if (this.state === "finished") {
      this.endTimer += dt;
      if (this.endTimer > 2.5 && !this.hud.results) this.showResults();
    }

    this.updateHud();
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
  }
}

