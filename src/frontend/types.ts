export const MODELS = ["X", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "O", "P", "Q", "R"] as const;

export type Model = typeof MODELS[number];
export type Orientation = "H" | "V";
export type Direction = "L" | "R" | "U" | "D";
export type Algorithm = "bestFS" | "bfs" | "dfs";
export type Heuristic = "h1" | "h2" | "h3";
export type StopReason = "timeout" | "cancelled" | null;
export type Move = `${Model}${Direction}`;

export interface Vehicle { model: Model; x: number; y: number; orientation: Orientation; }
export interface Preset { number: number; vehicles: Vehicle[]; }
export interface SolveResult {
  solved: boolean;
  moves: Move[];
  elapsed: number;
  visited: number;
  unique?: number | undefined;
  maxDepth?: number | undefined;
  visitedByDepth?: Record<string, number> | undefined;
  uniqueByDepth?: Record<string, number> | undefined;
  stoppedReason?: StopReason | undefined;
  timeoutSeconds?: number | undefined;
}
export interface RunDetails {
  algorithm: Algorithm;
  heuristic: Heuristic | "";
  algorithmLabel: string;
  key: string;
  preset: string;
  puzzleLabel: string;
  vehicles: Vehicle[];
}
export interface Run extends RunDetails {
  id: number;
  solved: boolean;
  moves: Move[];
  moveCount: number;
  elapsed: number;
  visited: number;
  unique: number;
  maxDepth: number;
  stoppedReason: StopReason;
}
