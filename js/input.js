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


// ============================================================
// KEY STATE
// ============================================================

const keys = {};

const gameCodes = new Set(
  Object.values(CONTROLS).flatMap((controls) =>
    Object.values(controls).flat()
  )
);

let inputEnabled = false;


// ============================================================
// ENABLE / DISABLE INPUT
// ============================================================

export function setInputEnabled(value) {
  inputEnabled = value;

  if (!value) {
    Object.keys(keys).forEach((key) => {
      keys[key] = false;
    });
  }
}


// ============================================================
// KEY DOWN
// ============================================================

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    inputEnabled &&
    gameCodes.has(event.code)
  ) {
    event.preventDefault();
  }
});


// ============================================================
// KEY UP
// ============================================================

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});


// ============================================================
// WINDOW LOSES FOCUS
// ============================================================

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});


// ============================================================
// CHECK WHETHER ANY KEY IS DOWN
// ============================================================

export function isDown(codes) {
  if (!Array.isArray(codes)) {
    return false;
  }

  return codes.some((code) => !!keys[code]);
}