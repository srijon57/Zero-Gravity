import { solarLoop } from "./solarLoop.js";
import { auroraCircuit } from "./auroraCircuit.js";
import { nebulaRun } from "./nebulaRun.js";
import { meteorRift } from "./meteorRift.js";
import { eventHorizon } from "./eventHorizon.js";

export const MAPS = [
  solarLoop,
  auroraCircuit,
  nebulaRun,
  meteorRift,
  eventHorizon
];

export const DEFAULT_MAP = solarLoop;