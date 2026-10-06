const curvePath = [
  19, 0, 20,
  8, 0.2, 24,
  -5, 0.5, 24,
  -17, 1, 21,
  -25, 1.5, 15,
  -27, 1.8, 7,
  -24, 1.5, -1,
  -17, 1, -7,
  -20, 0.5, -15,
  -14, 0, -22,
  -3, -0.3, -25,
  10, 0, -24,
  21, 0.5, -20,
  27, 1, -13,
  25, 1.5, -5,
  20, 1.8, 1,
  25, 1.5, 8,
  27, 1, 15,
  24, 0.5, 19,
  19, 0, 20
];

export const auroraCircuit = {
  id: "aurora-circuit",
  name: "Aurora Circuit",
  difficulty: 2,
  difficultyName: "Easy / Medium",
  description: "A long flowing circuit with gentle S-curves and mild elevation.",
  curvePath,
  trackScale: 2.5,
  roadWidth: 3.6,
  tubeRadius: 0.65
};