// Keyboard input for two players on one keyboard.
//
// Player 1:
// W A S D
// Space / Left Shift = Nitro
//
// Player 2:
// Arrow keys
// Enter / Right Shift / Numpad 0 = Nitro


export const CONTROLS = {

  p1: {

    up: [
      "KeyW"
    ],

    down: [
      "KeyS"
    ],

    left: [
      "KeyA"
    ],

    right: [
      "KeyD"
    ],

    nitro: [
      "Space",
      "ShiftLeft"
    ],

  },


  p2: {

    up: [
      "ArrowUp"
    ],

    down: [
      "ArrowDown"
    ],

    left: [
      "ArrowLeft"
    ],

    right: [
      "ArrowRight"
    ],

    nitro: [
      "Enter",
      "ShiftRight",
      "Numpad0"
    ],

  },

};


// ============================================================
// KEY STATE
// ============================================================

const keys = {};


// All game-related keyboard codes.

const gameCodes =
  new Set(

    Object
      .values(CONTROLS)
      .flatMap(
        (controls) =>
          Object
            .values(controls)
            .flat()
      )

  );


let inputEnabled =
  false;


// ============================================================
// ENABLE / DISABLE INPUT
// ============================================================

export function setInputEnabled(
  value
) {

  inputEnabled =
    value;


  // Clear all pressed keys
  // whenever controls are disabled.

  if (!value) {

    Object
      .keys(keys)
      .forEach(
        (key) => {

          keys[key] =
            false;

        }
      );

  }

}


// ============================================================
// KEY DOWN
// ============================================================

window.addEventListener(
  "keydown",
  (event) => {

    keys[event.code] =
      true;


    // Stop browser scrolling etc.
    // only while racing.

    if (
      inputEnabled &&
      gameCodes.has(
        event.code
      )
    ) {

      event.preventDefault();

    }

  }
);


// ============================================================
// KEY UP
// ============================================================

window.addEventListener(
  "keyup",
  (event) => {

    keys[event.code] =
      false;

  }
);


// ============================================================
// WINDOW LOSES FOCUS
// ============================================================

window.addEventListener(
  "blur",
  () => {

    Object
      .keys(keys)
      .forEach(
        (key) => {

          keys[key] =
            false;

        }
      );

  }
);


// ============================================================
// CHECK WHETHER ANY KEY IS DOWN
// ============================================================

export function isDown(
  codes
) {

  if (
    !Array.isArray(codes)
  ) {

    return false;

  }


  return codes.some(
    (code) =>
      !!keys[code]
  );

}