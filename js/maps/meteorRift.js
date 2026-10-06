const curvePath = [
  20, 0, 28,
  7, 0.5, 30,
  -6, 1, 28,
  -17, 2, 24,
  -25, 3, 16,
  -27, 4, 7,
  -23, 3, -2,
  -27, 2, -11,
  -22, 1, -19,
  -13, 0, -25,
  -2, -1, -28,
  8, -1.5, -25,
  17, -0.5, -21,
  24, 1, -14,
  27, 2, -6,
  23, 3, 2,
  27, 4, 10,
  24, 4.5, 18,
  20, 3, 24,
  20, 0, 28
];

export const meteorRift = {
  id: "meteor-rift",
  name: "Meteor Rift",
  difficulty: 4,
  difficultyName: "Hard",
  description: "Technical S-curves, tighter corners and stronger elevation changes.",
  curvePath,
  trackScale: 2.5,
  roadWidth: 3.6,
  tubeRadius: 0.65
};