import type { Algorithm, Direction, Heuristic, Model, Move, Orientation, Run, RunDetails, SolveResult, Vehicle } from "../types";

export const TRUCKS = new Set<Model>(["O", "P", "Q", "R"]);
export const COLORS: Record<Model, string> = {
  X: "#df342f", A: "#299765", B: "#db9426", C: "#397cc4", D: "#8b59b5",
  E: "#168d9b", F: "#5d9143", G: "#5c6670", H: "#be6c39", I: "#c44b7b",
  J: "#6377b9", K: "#33826f", O: "#d97d22", P: "#9854a3", Q: "#3678a7", R: "#52883c",
};
export const DIRECTIONS = { L: "left", R: "right", U: "up", D: "down" } as const;
export const RED_ROW = 2;

export function lengthOf(model: Model): 2 | 3 { return TRUCKS.has(model) ? 3 : 2; }
export function placementOrientation(model: Model, orientation: Orientation): Orientation {
  return model === "X" ? "H" : orientation;
}
export function isValidPlacement(candidate: Vehicle, vehicles: Vehicle[]): boolean {
  if (candidate.model === "X" && (candidate.orientation !== "H" || candidate.y !== RED_ROW)) return false;
  const length = lengthOf(candidate.model);
  const cells = Array.from({ length }, (_, offset) => ({
    x: candidate.x + (candidate.orientation === "H" ? offset : 0),
    y: candidate.y + (candidate.orientation === "V" ? offset : 0),
  }));
  if (cells.some(({ x, y }) => x < 0 || x > 5 || y < 0 || y > 5)) return false;
  return !vehicles.some(vehicle => {
    const occupied = Array.from({ length: lengthOf(vehicle.model) }, (_, offset) =>
      `${vehicle.x + (vehicle.orientation === "H" ? offset : 0)},${vehicle.y + (vehicle.orientation === "V" ? offset : 0)}`);
    return cells.some(cell => occupied.includes(`${cell.x},${cell.y}`));
  });
}

/** Try anchor at click cell (forward), then shift backward so the click cell is the far end. */
export function placementAtCell(
  clickX: number,
  clickY: number,
  model: Model,
  orientation: Orientation,
  vehicles: Vehicle[],
): Vehicle | null {
  const orient = placementOrientation(model, orientation);
  const row = model === "X" ? RED_ROW : clickY;
  const length = lengthOf(model);
  const forward: Vehicle = { model, x: clickX, y: row, orientation: orient };
  if (isValidPlacement(forward, vehicles)) return forward;
  const backward: Vehicle = orient === "H"
    ? { model, x: clickX - (length - 1), y: row, orientation: orient }
    : { model, x: clickX, y: row - (length - 1), orientation: orient };
  if (isValidPlacement(backward, vehicles)) return backward;
  return null;
}

function uniqueCells(cells: Array<[number, number]>): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const [x, y] of cells) {
    if (x < 0 || x > 5 || y < 0 || y > 5) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
  }
  return out;
}

/** Resolve a drag drop from the vehicle's visual anchor, not just the pointer cell. */
export function placementAtDrop(
  anchorX: number,
  anchorY: number,
  pointerX: number,
  pointerY: number,
  model: Model,
  orientation: Orientation,
  vehicles: Vehicle[],
): Vehicle | null {
  const orient = placementOrientation(model, orientation);
  const row = model === "X" ? RED_ROW : Math.round(anchorY);
  const length = lengthOf(model);

  for (const x of [Math.round(anchorX), Math.floor(anchorX), Math.ceil(anchorX)]) {
    const direct: Vehicle = { model, x, y: row, orientation: orient };
    if (isValidPlacement(direct, vehicles)) return direct;
  }

  const anchorRow = model === "X" ? RED_ROW : Math.round(anchorY);
  const pointerRow = model === "X" ? RED_ROW : Math.round(pointerY);
  const refs = uniqueCells([
    [Math.round(anchorX), anchorRow],
    [Math.floor(anchorX), model === "X" ? RED_ROW : Math.floor(anchorY)],
    [Math.ceil(anchorX), model === "X" ? RED_ROW : Math.ceil(anchorY)],
    [Math.round(pointerX), pointerRow],
    ...Array.from({ length }, (_, offset) => [
      Math.floor(anchorX) + (orient === "H" ? offset : 0),
      (model === "X" ? RED_ROW : Math.floor(anchorY)) + (orient === "V" ? offset : 0),
    ] as [number, number]),
  ]);

  for (const [x, y] of refs) {
    const placed = placementAtCell(x, y, model, orientation, vehicles);
    if (placed) return placed;
  }
  return null;
}
export function runKey(vehicles: Vehicle[], algorithm: Algorithm, heuristic: Heuristic | ""): string {
  const board = [...vehicles].map(v => `${v.model}:${v.x},${v.y},${v.orientation}`).sort().join("|");
  return `${board}::${algorithm}::${algorithm === "bestFS" ? heuristic : ""}`;
}
export function createSolutionStates(start: Vehicle[], moves: Move[]): Vehicle[][] {
  const states: Vehicle[][] = [structuredClone(start)];
  for (const move of moves) {
    const next = structuredClone(states.at(-1) ?? []);
    const vehicle = next.find(item => item.model === move[0]);
    if (!vehicle) continue;
    if (move[1] === "L") vehicle.x--; if (move[1] === "R") vehicle.x++;
    if (move[1] === "U") vehicle.y--; if (move[1] === "D") vehicle.y++;
    states.push(next);
  }
  const exited = structuredClone(states.at(-1) ?? []);
  const red = exited.find(item => item.model === "X");
  if (red) { red.x = 6; states.push(exited); }
  return states;
}
export function createRun(id: number, result: SolveResult, details: RunDetails): Run {
  return {
    ...details, id, vehicles: structuredClone(details.vehicles), moves: result.moves,
    solved: result.solved, moveCount: result.solved ? result.moves.length : 0,
    elapsed: result.elapsed, visited: result.visited, unique: result.unique ?? result.visited,
    maxDepth: result.maxDepth ?? Math.max(0, ...Object.keys(result.visitedByDepth ?? {}).map(Number)),
    stoppedReason: result.stoppedReason ?? null,
  };
}
export function algorithmLabel(algorithm: Algorithm, heuristic: Heuristic): string {
  return algorithm === "bestFS" ? `A* ${heuristic}` : algorithm.toUpperCase();
}
export function runStatus(run: Run): string {
  if (run.solved) return `${run.moveCount} moves`;
  return run.stoppedReason ?? "no solution";
}
export function moveModel(move: Move): Model { return move[0] as Model; }
export function moveDirection(move: Move): Direction { return move[1] as Direction; }
