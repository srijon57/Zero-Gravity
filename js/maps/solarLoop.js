const curvePath = [
  -18, 0, -18,
  -5, 0, -20,
  10, 0, -20,
  22, 0.1, -18,
  29, 0.2, -12,
  31, 0.3, -2,
  31, 0.4, 10,
  28, 0.5, 18,
  20, 0.6, 23,
  7, 0.5, 25,
  -7, 0.4, 25,
  -20, 0.3, 23,
  -28, 0.2, 17,
  -31, 0.1, 8,
  -31, 0, -4,
  -29, -0.1, -12,
  -24, -0.1, -17,
  -18, 0, -18
];

export const solarLoop = {
  id: "solar-loop",
  name: "Solar Loop",
  difficulty: 1,
  difficultyName: "Easy",
  description: "A long high-speed circuit with wide turns and minimal elevation.",
  curvePath,
  trackScale: 2.5,
  roadWidth: 3.6,
  tubeRadius: 0.65
};