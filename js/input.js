// Keyboard input for two players on one keyboard.
//   Player 1: W A S D  (+ Space or Left Shift for nitro)
//   Player 2: Arrow keys (+ Enter, Right Shift or Numpad 0 for nitro)

export const CONTROLS = {
  p1: {
    up: ["KeyW"],
    down: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    nitro: ["Space", "ShiftLeft"],
  },
  p2: {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    nitro: ["Enter", "ShiftRight", "Numpad0"],
  },
};

const keys = {};
const gameCodes = new Set(
  Object.values(CONTROLS).flatMap((c) => Object.values(c).flat())
);

let inputEnabled = false;

// Only swallow keys while the race is on, so the landing page buttons still work
export function setInputEnabled(value) {
  inputEnabled = value;
  if (!value) Object.keys(keys).forEach((k) => (keys[k] = false));
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (inputEnabled && gameCodes.has(e.code)) e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// Avoid "stuck" keys when the window loses focus
window.addEventListener("blur", () => {
  Object.keys(keys).forEach((k) => (keys[k] = false));
});

export function isDown(codes) {
  return codes.some((code) => keys[code]);
}
