import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePresets, parseSolveResult } from "../api";
import type { Algorithm, Heuristic, Model, Orientation, Preset, Run, Vehicle } from "../types";
import { Board } from "./components/Board";
import { Results } from "./components/Results";
import { SearchControls } from "./components/SearchControls";
import { MobileCopyrightFooter } from "./components/MobileCopyrightFooter";
import { Sidebar } from "./components/Sidebar";
import { SelectField } from "./components/SelectField";
import { VehicleControls } from "./components/VehicleControls";
import { algorithmLabel, createRun, createSolutionStates, placementAtCell, placementAtDrop, runKey } from "./model";
import { usePdfViewport } from "./utils/usePdfViewport";

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SOLVER_COOLDOWN_MS = 60_000;
const SOLVER_COOLDOWN_MESSAGE = "Limited solver resources are cooling down. Please wait a moment before starting another search.";
const appUrl = (path: string) => `${APP_BASE}${path}`;
const createJobId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [preset, setPreset] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Model>("X");
  const [orientation, setOrientation] = useState<Orientation>("H");
  const [algorithm, setAlgorithm] = useState<Algorithm>("bestFS");
  const [heuristic, setHeuristic] = useState<Heuristic>("h2");
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solverCoolingDown, setSolverCoolingDown] = useState(false);
  const [solverNotice, setSolverNotice] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  usePdfViewport(report);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);
  const activeJobId = useRef<string | null>(null);
  const cooldownTimer = useRef<number | null>(null);
  const active = runs.find(run => run.id === activeId) ?? null;
  const solutionStates = useMemo(() => active?.solved ? createSolutionStates(active.vehicles, active.moves) : [], [active]);
  const boardVehicles = solutionStates[step] ?? vehicles;
  const totalSteps = active?.solved ? active.moves.length + 1 : 0;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(appUrl("/api/presets"), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Could not load preset puzzles.");
      const payload: unknown = await response.json();
      const loadedPresets = parsePresets(payload);
      setPresets(loadedPresets);
      const first = loadedPresets[0];
      if (first) { setPreset(String(first.number)); setVehicles(first.vehicles); }
    }).catch(reason => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setPresets([]);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing || !totalSteps) return;
    const timer = window.setInterval(() => setStep(current => {
      if (current >= totalSteps) { setPlaying(false); return current; }
      return current + 1;
    }), 550);
    return () => window.clearInterval(timer);
  }, [playing, totalSteps]);
  useEffect(() => () => {
    if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current);
  }, []);

  const resetSolution = useCallback(() => { setActiveId(null); setStep(0); setPlaying(false); }, []);
  const startSolverCooldown = useCallback((message = SOLVER_COOLDOWN_MESSAGE) => {
    setSolverCoolingDown(true);
    setSolverNotice(message);
    if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current);
    cooldownTimer.current = window.setTimeout(() => {
      setSolverCoolingDown(false);
      setSolverNotice(null);
      cooldownTimer.current = null;
    }, SOLVER_COOLDOWN_MS);
  }, []);
  const chooseModel = (model: Model) => {
    setSelected(model);
    const existing = vehicles.find(vehicle => vehicle.model === model);
    setOrientation(model === "X" ? "H" : existing?.orientation ?? orientation);
  };
  const place = (x: number, y: number) => {
    if (active) return false;
    const orient = selected === "X" ? "H" : orientation;
    const others = vehicles.filter(vehicle => vehicle.model !== selected);
    const candidate = placementAtCell(x, y, selected, orient, others);
    if (!candidate) return false;
    setVehicles([...others, candidate]); setPreset(""); resetSolution();
    return true;
  };
  const move = (vehicle: Vehicle, anchorX: number, anchorY: number, pointerX: number, pointerY: number) => {
    const others = vehicles.filter(item => item.model !== vehicle.model);
    const candidate = placementAtDrop(anchorX, anchorY, pointerX, pointerY, vehicle.model, vehicle.orientation, others);
    if (!candidate) return false;
    setVehicles([...others, candidate]); setPreset(""); resetSolution();
    return true;
  };
  const selectPreset = (value: string) => {
    setPreset(value); const selectedPreset = presets.find(item => String(item.number) === value);
    setVehicles(selectedPreset ? structuredClone(selectedPreset.vehicles) : []); resetSolution();
  };
  const loadRun = (run: Run) => {
    setActiveId(run.id); setVehicles(structuredClone(run.vehicles)); setPreset(run.preset); setAlgorithm(run.algorithm);
    if (run.heuristic) setHeuristic(run.heuristic); setStep(0); setPlaying(false); setReport(false);
  };
  const solve = async () => {
    if (solverCoolingDown) {
      setSolverNotice(SOLVER_COOLDOWN_MESSAGE);
      return;
    }
    const selectedHeuristic: Heuristic | "" = algorithm === "bestFS" ? heuristic : "";
    const key = runKey(vehicles, algorithm, selectedHeuristic);
    const existing = runs.find(run => run.key === key);
    if (existing) { loadRun(existing); return; }
    const details = { algorithm, heuristic: selectedHeuristic, algorithmLabel: algorithmLabel(algorithm, heuristic), key, preset, puzzleLabel: preset ? `Preset ${preset}` : "Custom", vehicles: structuredClone(vehicles) };
    const jobId = createJobId();
    activeJobId.current = jobId;
    abort.current = new AbortController(); setSolving(true);
    const started = performance.now();
    try {
      const response = await fetch(appUrl("/api/solve"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, vehicles, algorithm, heuristic }), signal: abort.current.signal });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 429) {
        startSolverCooldown();
        return;
      }
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Could not solve puzzle.");
      const run = createRun(nextId.current++, parseSolveResult(payload), details);
      setSolverNotice(null);
      setRuns(current => [...current, run]); loadRun(run);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        const run = createRun(nextId.current++, { solved: false, moves: [], elapsed: (performance.now() - started) / 1000, visited: 0, stoppedReason: "cancelled" }, details);
        setRuns(current => [...current, run]); loadRun(run);
      } else {
        setSolverNotice(reason instanceof Error ? reason.message : "Could not solve puzzle.");
      }
    } finally { abort.current = null; activeJobId.current = null; setSolving(false); }
  };
  const cancel = () => {
    const jobId = activeJobId.current;
    abort.current?.abort();
    if (jobId) {
      void fetch(appUrl("/api/cancel"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
    }
  };

  return <section className="app-shell grid h-screen min-h-0 grid-cols-[238px_minmax(0,1fr)] overflow-hidden max-[720px]:grid-cols-1 max-[720px]:h-auto max-[720px]:min-h-screen max-[720px]:overflow-visible">
      <Sidebar
        report={report}
        runs={runs}
        active={active}
        onReport={() => setReport(current => !current)}
        onRun={loadRun}
        onDelete={id => { setRuns(current => current.filter(run => run.id !== id)); if (activeId === id) resetSolution(); }}
        onClear={() => { setRuns([]); resetSolution(); }}
      />
      <div className="main-pane h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto max-[720px]:h-auto max-[720px]:overflow-visible"><main className="main-workspace h-full min-h-0"><section className="workspace-shell grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 max-[720px]:p-2" aria-label="Puzzle workspace">
      {!report && <div className="grid min-w-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-3 max-[1080px]:grid-cols-1" aria-label="Board and search tools">
        <VehicleControls vehicles={vehicles.map(v => v.model)} selected={selected} orientation={orientation} onSelect={chooseModel} onOrientation={setOrientation} onRemove={() => { setVehicles(current => current.filter(v => v.model !== selected)); resetSolution(); }} />
        <SearchControls algorithm={algorithm} heuristic={heuristic} solving={solving} cooldown={solverCoolingDown} notice={solverNotice} onAlgorithm={setAlgorithm} onHeuristic={setHeuristic} onSolve={() => void solve()} onCancel={cancel} />
      </div>}
      <div className={`puzzle-stage board-stage grid min-w-0 overflow-hidden ${report ? "report-stage row-span-2" : "min-h-0"}`}>
        {report ? <><div className="report-heading flex min-w-0 items-start justify-between gap-4"><div><p className="section-kicker">Reference</p><h2>Project write-up</h2></div><button className="report-close" type="button" aria-label="Close write-up" onClick={() => setReport(false)}>×</button></div><div className="report-view"><iframe title="Rush Hour project write-up" src={appUrl("/assets/report.pdf#navpanes=0")} /></div></> : <div className="puzzle-layout">
          <div className="board-area">
            <div className="board-toolbar"><div className="board-toolbar-copy"><p className="section-kicker">Puzzle workspace</p><h2>Arrange the board</h2></div><div className="board-actions"><SelectField ariaLabel="Load a preset puzzle" className="preset-select" value={preset} onChange={selectPreset} options={[["", "Custom board"], ...presets.map(item => [String(item.number), `Preset ${item.number}`] as const)]} />
              <button className="secondary" type="button" onClick={() => { setVehicles([]); setPreset(""); resetSolution(); }}>Clear board</button></div></div>
            <div className="board-canvas"><Board vehicles={boardVehicles} selected={selected} playback={Boolean(active)} onCell={place} onSelect={chooseModel} onMove={move} /></div>
          </div>
          <Results active={active} step={step} playing={playing} onStep={value => { setPlaying(false); setStep(Math.max(0, Math.min(totalSteps, value))); }} onPlay={() => { if (step === totalSteps) setStep(0); setPlaying(current => !current); }} />
        </div>}
      </div>
    </section></main></div>
      <MobileCopyrightFooter />
    </section>;
}
