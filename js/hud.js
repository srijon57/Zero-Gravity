// DOM heads-up display for the split screen

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "--:--.--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function ordinal(n) {
  return n === 1 ? "1ST" : n === 2 ? "2ND" : `${n}TH`;
}

export class Hud {
  constructor(players) {
    this.root = document.createElement("div");
    this.root.id = "hud";

    this.halves = players.map((player, i) => {
      const half = document.createElement("div");
      half.className = `hud-half ${i === 0 ? "hud-top" : "hud-bottom"}`;
      half.style.setProperty("--player", player.color);

      const hint =
        i === 0 ? "W A S D &middot; SPACE = NITRO" : "&uarr; &larr; &darr; &rarr; &middot; ENTER = NITRO";

      half.innerHTML = `
        <div class="hud-tag"><b>${player.name}</b><span>${hint}</span></div>
        <div class="hud-info">
          <div><small>LAP</small><b data-el="lap">1/1</b></div>
          <div><small>POS</small><b data-el="pos">1/2</b></div>
        </div>
        <div class="hud-times">
          <div><small>LAP TIME</small><b data-el="time">00:00.00</b></div>
          <div><small>BEST</small><b data-el="best">--:--.--</b></div>
        </div>
        <div class="hud-speed"><b data-el="speed">0</b><span>KM/H</span></div>
        <div class="hud-nitro"><span>NITRO</span><div class="hud-bar"><i data-el="nitro"></i></div></div>
        <div class="hud-msg" data-el="msg"></div>
      `;

      this.root.appendChild(half);

      const q = (name) => half.querySelector(`[data-el="${name}"]`);
      return {
        lap: q("lap"),
        pos: q("pos"),
        time: q("time"),
        best: q("best"),
        speed: q("speed"),
        nitro: q("nitro"),
        msg: q("msg"),
        nitroBar: q("nitro").parentElement,
      };
    });

    const divider = document.createElement("div");
    divider.className = "hud-divider";
    this.root.appendChild(divider);

    document.body.appendChild(this.root);
    this.results = null;
  }

  updatePlayer(i, data) {
    const h = this.halves[i];
    h.lap.textContent = `${data.lap}/${data.totalLaps}`;
    h.pos.textContent = `${data.pos}/${data.count}`;
    h.time.textContent = formatTime(data.lapTime);
    h.best.textContent = formatTime(data.bestLap);
    h.speed.textContent = data.speed;
    h.nitro.style.width = `${Math.round(data.nitro * 100)}%`;
    h.nitroBar.classList.toggle("active", data.nitroActive);
    h.nitroBar.classList.toggle("locked", data.nitroLocked);
  }

  setMessage(i, text, kind = "") {
    const el = this.halves[i].msg;
    if (el.textContent === text && el.dataset.kind === kind) return;
    el.textContent = text;
    el.dataset.kind = kind;
    el.style.opacity = text ? "1" : "0";
  }

  showResults({ title, color, rows, onRematch, onMenu }) {
    this.hideResults();

    const overlay = document.createElement("div");
    overlay.className = "hud-results";
    overlay.innerHTML = `
      <div class="hud-results-card" style="--player:${color}">
        <div class="hud-results-kicker">RACE FINISHED</div>
        <h2>${title}</h2>
        <table>
          <thead><tr><th></th><th>Player</th><th>Result</th><th>Best lap</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr style="--player:${r.color}">
                <td>${ordinal(r.place)}</td>
                <td>${r.name}</td>
                <td>${r.result}</td>
                <td>${r.best}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="hud-results-buttons">
          <button data-act="rematch">Rematch</button>
          <button data-act="menu" class="ghost">Main menu</button>
        </div>
      </div>
    `;

    overlay.querySelector('[data-act="rematch"]').addEventListener("click", onRematch);
    overlay.querySelector('[data-act="menu"]').addEventListener("click", onMenu);

    document.body.appendChild(overlay);
    this.results = overlay;
  }

  hideResults() {
    if (this.results) {
      this.results.remove();
      this.results = null;
    }
  }
}
