import { MODELS, type Direction, type Model, type Move, type Preset, type SolveResult, type StopReason, type Vehicle } from "./types";

export function isModel(value: string): value is Model {
  return (MODELS as readonly string[]).includes(value);
}

function isDirection(value: string): value is Direction {
  return value === "L" || value === "R" || value === "U" || value === "D";
}

export function parseMove(value: string): Move | null {
  const model = value[0] ?? "";
  const direction = value[1] ?? "";
  if (value.length !== 2 || !isModel(model) || !isDirection(direction)) return null;
  return value as Move;
}

export function parseVehicles(value: unknown): Vehicle[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Vehicle => {
    if (!item || typeof item !== "object") return false;
    const vehicle = item as Partial<Vehicle>;
    return typeof vehicle.model === "string" && isModel(vehicle.model)
      && typeof vehicle.x === "number" && typeof vehicle.y === "number"
      && (vehicle.orientation === "H" || vehicle.orientation === "V");
  });
}

export function parsePresets(value: unknown): Preset[] {
  if (!value || typeof value !== "object" || !("presets" in value) || !Array.isArray(value.presets)) return [];
  return value.presets.flatMap(item => {
    if (!item || typeof item !== "object" || !("number" in item) || !("vehicles" in item)) return [];
    if (typeof item.number !== "number" || !Number.isInteger(item.number)) return [];
    return [{ number: item.number, vehicles: parseVehicles(item.vehicles) }];
  });
}

function parseNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  return entries.every(([, item]) => typeof item === "number") ? Object.fromEntries(entries) : undefined;
}

function parseStopReason(value: unknown): StopReason {
  return value === "timeout" || value === "cancelled" ? value : null;
}

export function parseSolveResult(value: unknown): SolveResult {
  if (!value || typeof value !== "object") throw new Error("Invalid solve response.");
  const raw = value as Partial<SolveResult> & { moves?: unknown };
  return {
    solved: Boolean(raw.solved),
    moves: Array.isArray(raw.moves) ? raw.moves.map(String).map(parseMove).filter((move): move is Move => Boolean(move)) : [],
    elapsed: typeof raw.elapsed === "number" ? raw.elapsed : 0,
    visited: typeof raw.visited === "number" ? raw.visited : 0,
    unique: typeof raw.unique === "number" ? raw.unique : undefined,
    maxDepth: typeof raw.maxDepth === "number" ? raw.maxDepth : undefined,
    visitedByDepth: parseNumberRecord(raw.visitedByDepth),
    uniqueByDepth: parseNumberRecord(raw.uniqueByDepth),
    stoppedReason: parseStopReason(raw.stoppedReason),
    timeoutSeconds: typeof raw.timeoutSeconds === "number" ? raw.timeoutSeconds : undefined
  };
}
