"use strict";
(() => {
  // src/frontend/app.ts
  var MODELS = ["X", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "O", "P", "Q", "R"];
  var TRUCKS = /* @__PURE__ */ new Set(["O", "P", "Q", "R"]);
  var COLORS = {
    X: "#df342f",
    A: "#299765",
    B: "#db9426",
    C: "#397cc4",
    D: "#8b59b5",
    E: "#168d9b",
    F: "#5d9143",
    G: "#5c6670",
    H: "#be6c39",
    I: "#c44b7b",
    J: "#6377b9",
    K: "#33826f",
    O: "#d97d22",
    P: "#9854a3",
    Q: "#3678a7",
    R: "#52883c"
  };
  var DIRECTIONS = { L: "left", R: "right", U: "up", D: "down" };
  function requiredElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required element: ${id}`);
    return element;
  }
  var elements = {
    board: requiredElement("board"),
    preset: requiredElement("preset"),
    "vehicle-palette": requiredElement("vehicle-palette"),
    "vehicle-count": requiredElement("vehicle-count"),
    horizontal: requiredElement("horizontal"),
    vertical: requiredElement("vertical"),
    remove: requiredElement("remove"),
    heuristic: requiredElement("heuristic"),
    solve: requiredElement("solve"),
    "cancel-search": requiredElement("cancel-search"),
    clear: requiredElement("clear"),
    status: requiredElement("status"),
    bestfs: requiredElement("bestfs"),
    bfs: requiredElement("bfs"),
    dfs: requiredElement("dfs"),
    "move-count": requiredElement("move-count"),
    "solve-time": requiredElement("solve-time"),
    "visited-count": requiredElement("visited-count"),
    "depth-count": requiredElement("depth-count"),
    previous: requiredElement("previous"),
    play: requiredElement("play"),
    next: requiredElement("next"),
    moves: requiredElement("moves"),
    "step-label": requiredElement("step-label"),
    "active-move": requiredElement("active-move"),
    "path-summary": requiredElement("path-summary"),
    "run-history": requiredElement("run-history"),
    "clear-runs": requiredElement("clear-runs"),
    "board-view": requiredElement("board-view"),
    "report-view": requiredElement("report-view"),
    "show-report": requiredElement("show-report"),
    "show-board": requiredElement("show-board"),
    "close-report": requiredElement("close-report"),
    "workspace-kicker": requiredElement("workspace-kicker"),
    "workspace-title": requiredElement("workspace-title"),
    "solve-loader": requiredElement("solve-loader"),
    "solve-loader-text": requiredElement("solve-loader-text")
  };
  var vehicles = [];
  var selectedModel = "X";
  var orientation = "H";
  var algorithm = "bestFS";
  var solutionStates = [];
  var solutionMoves = [];
  var currentStep = 0;
  var playTimer = null;
  var solveAbortController = null;
  var solveCancelledByUser = false;
  var runs = [];
  var activeRunId = null;
  var nextRunId = 1;
  function isModel(value) {
    return MODELS.includes(value);
  }
  function isDirection(value) {
    return value === "L" || value === "R" || value === "U" || value === "D";
  }
  function isHeuristic(value) {
    return value === "h1" || value === "h2" || value === "h3";
  }
  function parseMove(value) {
    const model = value[0] ?? "";
    const direction = value[1] ?? "";
    if (value.length !== 2 || !isModel(model) || !isDirection(direction)) return null;
    return value;
  }
  function parseVehicles(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const vehicle = item;
      return typeof vehicle.model === "string" && isModel(vehicle.model) && typeof vehicle.x === "number" && typeof vehicle.y === "number" && (vehicle.orientation === "H" || vehicle.orientation === "V");
    });
  }
  function parseSolveResult(value) {
    if (!value || typeof value !== "object") throw new Error("Invalid solve response.");
    const raw = value;
    return {
      solved: Boolean(raw.solved),
      moves: Array.isArray(raw.moves) ? raw.moves.map(String).map(parseMove).filter((move) => Boolean(move)) : [],
      elapsed: typeof raw.elapsed === "number" ? raw.elapsed : 0,
      visited: typeof raw.visited === "number" ? raw.visited : 0,
      unique: typeof raw.unique === "number" ? raw.unique : void 0,
      maxDepth: typeof raw.maxDepth === "number" ? raw.maxDepth : void 0,
      visitedByDepth: raw.visitedByDepth,
      uniqueByDepth: raw.uniqueByDepth,
      stoppedReason: raw.stoppedReason ?? null,
      timeoutSeconds: typeof raw.timeoutSeconds === "number" ? raw.timeoutSeconds : void 0
    };
  }
  function lengthOf(model) {
    return TRUCKS.has(model) ? 3 : 2;
  }
  function cellsFor(vehicle) {
    return Array.from({ length: lengthOf(vehicle.model) }, (_, offset) => ({
      x: vehicle.x + (vehicle.orientation === "H" ? offset : 0),
      y: vehicle.y + (vehicle.orientation === "V" ? offset : 0)
    }));
  }
  function buildPalette() {
    elements["vehicle-palette"].replaceChildren(...MODELS.map((model) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vehicle-choice";
      button.dataset.model = model;
      button.textContent = model;
      button.title = `${model}: ${TRUCKS.has(model) ? "truck, length 3" : "car, length 2"}`;
      button.style.background = COLORS[model];
      button.addEventListener("click", () => selectModel(model));
      return button;
    }));
  }
  function buildGrid() {
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < 6; x += 1) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "grid-cell";
        cell.style.left = `${x * 100 / 6}%`;
        cell.style.top = `${y * 100 / 6}%`;
        cell.setAttribute("aria-label", `Column ${x + 1}, row ${y + 1}`);
        cell.addEventListener("click", () => placeVehicle(x, y));
        elements.board.append(cell);
      }
    }
  }
  function selectModel(model) {
    selectedModel = model;
    const existing = vehicles.find((vehicle) => vehicle.model === model);
    if (existing) setOrientation(existing.orientation);
    if (model === "X") setOrientation("H");
    render();
  }
  function setOrientation(value) {
    orientation = selectedModel === "X" ? "H" : value;
    elements.horizontal.classList.toggle("active", orientation === "H");
    elements.vertical.classList.toggle("active", orientation === "V");
    elements.vertical.disabled = selectedModel === "X";
  }
  function placeVehicle(x, y) {
    const candidate = {
      model: selectedModel,
      x,
      y: selectedModel === "X" ? 2 : y,
      orientation: selectedModel === "X" ? "H" : orientation
    };
    const others = vehicles.filter((vehicle) => vehicle.model !== selectedModel);
    const candidateCells = cellsFor(candidate);
    const occupied = new Set(others.flatMap(cellsFor).map((cell) => `${cell.x},${cell.y}`));
    if (candidateCells.some((cell) => cell.x > 5 || cell.y > 5 || occupied.has(`${cell.x},${cell.y}`))) {
      setStatus("That vehicle does not fit there.", true);
      return;
    }
    vehicles = [...others, candidate];
    resetSolution();
    elements.preset.value = "";
    setStatus(`${selectedModel} placed. Select another vehicle or solve the puzzle.`);
    render();
  }
  function isValidPlacement(candidate, otherVehicles) {
    const occupied = new Set(otherVehicles.flatMap(cellsFor).map((cell) => `${cell.x},${cell.y}`));
    return cellsFor(candidate).every(
      (cell) => cell.x >= 0 && cell.x <= 5 && cell.y >= 0 && cell.y <= 5 && !occupied.has(`${cell.x},${cell.y}`)
    );
  }
  function startVehicleDrag(event, piece, vehicle) {
    if (solutionStates.length || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectedModel = vehicle.model;
    setOrientation(vehicle.orientation);
    const boardRect = elements.board.getBoundingClientRect();
    const boardLeft = boardRect.left + elements.board.clientLeft;
    const boardTop = boardRect.top + elements.board.clientTop;
    const boardWidth = elements.board.clientWidth;
    const boardHeight = elements.board.clientHeight;
    const pieceRect = piece.getBoundingClientRect();
    const grabX = event.clientX - pieceRect.left;
    const grabY = event.clientY - pieceRect.top;
    const pieceWidth = pieceRect.width;
    const pieceHeight = pieceRect.height;
    let moved = false;
    let candidate = { ...vehicle };
    piece.classList.add("dragging");
    piece.setPointerCapture(event.pointerId);
    const onMove = (moveEvent) => {
      const left = Math.max(0, Math.min(boardWidth - pieceWidth, moveEvent.clientX - boardLeft - grabX));
      const top = Math.max(0, Math.min(boardHeight - pieceHeight, moveEvent.clientY - boardTop - grabY));
      const nextX = Math.round(left / (boardWidth / 6));
      const nextY = vehicle.model === "X" ? 2 : Math.round(top / (boardHeight / 6));
      candidate = { ...vehicle, x: nextX, y: nextY };
      moved || (moved = Math.abs(moveEvent.clientX - event.clientX) > 4 || Math.abs(moveEvent.clientY - event.clientY) > 4);
      piece.style.left = `${left}px`;
      piece.style.top = `${vehicle.model === "X" ? boardHeight / 3 : top}px`;
    };
    const onUp = (upEvent) => {
      piece.releasePointerCapture(upEvent.pointerId);
      piece.removeEventListener("pointermove", onMove);
      piece.removeEventListener("pointerup", onUp);
      piece.removeEventListener("pointercancel", onUp);
      if (moved) {
        const others = vehicles.filter((item) => item.model !== vehicle.model);
        if (isValidPlacement(candidate, others)) {
          vehicles = [...others, candidate];
          resetSolution();
          elements.preset.value = "";
          setStatus(`${vehicle.model} moved to column ${candidate.x + 1}, row ${candidate.y + 1}.`);
        } else {
          setStatus(`${vehicle.model} cannot be placed there.`, true);
        }
      }
      render();
    };
    piece.addEventListener("pointermove", onMove);
    piece.addEventListener("pointerup", onUp);
    piece.addEventListener("pointercancel", onUp);
  }
  function wheelMarkup(length, vehicleOrientation) {
    const positions = length === 2 ? [26, 74] : [20, 80];
    const isHorizontal = vehicleOrientation === "H";
    return positions.map((pos) => {
      if (isHorizontal) {
        return `
        <span class="wheel wheel-h wheel-top" style="left:${pos}%"></span>
        <span class="wheel wheel-h wheel-bottom" style="left:${pos}%"></span>
      `;
      }
      return `
      <span class="wheel wheel-v wheel-left" style="top:${pos}%"></span>
      <span class="wheel wheel-v wheel-right" style="top:${pos}%"></span>
    `;
    }).join("");
  }
  function renderBoard(boardVehicles = vehicles) {
    elements.board.classList.toggle("playback-mode", solutionStates.length > 0);
    elements.board.querySelectorAll(".vehicle").forEach((element) => element.remove());
    boardVehicles.forEach((vehicle) => {
      const length = lengthOf(vehicle.model);
      const piece = document.createElement("button");
      piece.type = "button";
      piece.className = `vehicle ${vehicle.orientation === "H" ? "horizontal" : "vertical"} ${TRUCKS.has(vehicle.model) ? "truck" : "car"}`;
      piece.classList.toggle("selected", solutionStates.length === 0 && vehicle.model === selectedModel);
      piece.innerHTML = `
      ${wheelMarkup(length, vehicle.orientation)}
      <span class="vehicle-panel" aria-hidden="true"></span>
      <span class="vehicle-label">${vehicle.model}</span>
      <span class="vehicle-lights" aria-hidden="true"></span>
    `;
      piece.style.backgroundColor = COLORS[vehicle.model];
      piece.style.left = `${vehicle.x * 100 / 6}%`;
      piece.style.top = `${vehicle.y * 100 / 6}%`;
      piece.style.width = `${(vehicle.orientation === "H" ? length : 1) * 100 / 6}%`;
      piece.style.height = `${(vehicle.orientation === "V" ? length : 1) * 100 / 6}%`;
      piece.style.setProperty("--vehicle-length", String(length));
      piece.title = `Select vehicle ${vehicle.model}`;
      piece.addEventListener("pointerdown", (event) => startVehicleDrag(event, piece, vehicle));
      piece.addEventListener("click", (event) => {
        event.stopPropagation();
        if (solutionStates.length === 0) selectModel(vehicle.model);
      });
      elements.board.append(piece);
    });
  }
  function render() {
    renderBoard(solutionStates.length ? solutionStates[currentStep] ?? vehicles : vehicles);
    document.querySelectorAll(".vehicle-choice").forEach((button) => {
      button.classList.toggle("active", button.dataset.model === selectedModel);
      button.classList.toggle("placed", vehicles.some((vehicle) => vehicle.model === button.dataset.model));
    });
    elements["vehicle-count"].textContent = `${vehicles.length} placed`;
    elements.remove.disabled = !vehicles.some((vehicle) => vehicle.model === selectedModel) || solutionStates.length > 0;
    renderPlayback();
  }
  function setStatus(message, error = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle("error", error);
  }
  function setPuzzleViewVisible() {
    elements["report-view"].hidden = true;
    elements["board-view"].hidden = false;
    elements["show-board"].hidden = true;
    elements["show-report"].hidden = false;
    elements["close-report"].hidden = true;
    elements["workspace-kicker"].textContent = "RH Board";
    elements["workspace-title"].textContent = "Puzzle workspace";
  }
  function closeReportIfOpen() {
    if (elements["report-view"].hidden) return;
    setPuzzleViewVisible();
  }
  function showReport() {
    stopPlayback();
    elements["board-view"].hidden = true;
    elements["report-view"].hidden = false;
    elements["show-report"].hidden = true;
    elements["show-board"].hidden = false;
    elements["close-report"].hidden = false;
    elements["workspace-kicker"].textContent = "Reference";
    elements["workspace-title"].textContent = "Project write-up";
  }
  function showBoard() {
    setPuzzleViewVisible();
    setStatus(elements.preset.value ? `Preset ${elements.preset.value} loaded. Edit it or solve it as-is.` : "Custom board ready.");
  }
  function algorithmLabel() {
    if (algorithm === "bfs") return "BFS";
    if (algorithm === "dfs") return "DFS";
    return `A* ${elements.heuristic.value}`;
  }
  function formatElapsed(elapsed) {
    return elapsed < 1e-3 ? "<1 ms" : `${(elapsed * 1e3).toFixed(1)} ms`;
  }
  function formatElapsedCompact(elapsed) {
    if (elapsed < 1e-3) return "<1ms";
    const ms = elapsed * 1e3;
    if (ms < 1e3) return `${Math.round(ms)}ms`;
    return `${elapsed.toFixed(1)}s`;
  }
  function formatCountCompact(count) {
    if (count >= 1e4) return `${Math.round(count / 1e3)}k`;
    if (count >= 1e3) return `${(count / 1e3).toFixed(1)}k`;
    return String(count);
  }
  function compactPuzzleLabel(run) {
    return run.preset ? `P${run.preset}` : "Custom";
  }
  function compactMoves(run) {
    if (run.solved) return String(run.moveCount);
    return "\u2014";
  }
  function currentHeuristic() {
    const value = elements.heuristic.value;
    return isHeuristic(value) ? value : "h2";
  }
  function searchHeuristic() {
    return algorithm === "bestFS" ? currentHeuristic() : "";
  }
  function puzzleLabel() {
    return elements.preset.value ? `Preset ${elements.preset.value}` : "Custom";
  }
  function runKey(boardVehicles, runAlgorithm, runHeuristic) {
    const board = [...boardVehicles].map((vehicle) => `${vehicle.model}:${vehicle.x},${vehicle.y},${vehicle.orientation}`).sort().join("|");
    return `${board}::${runAlgorithm}::${runAlgorithm === "bestFS" ? runHeuristic : ""}`;
  }
  function maxDepth(visitedByDepth) {
    return Math.max(0, ...Object.keys(visitedByDepth ?? {}).map(Number));
  }
  function setMetrics(run) {
    elements["move-count"].textContent = run.solved ? String(run.moveCount) : "-";
    elements["solve-time"].textContent = formatElapsed(run.elapsed);
    elements["visited-count"].textContent = run.visited.toLocaleString();
    elements["depth-count"].textContent = String(run.maxDepth);
    elements["path-summary"].textContent = run.solved ? `${run.algorithmLabel} path` : "No path";
  }
  function setSolving(isSolving, message = "Solving puzzle...") {
    elements.solve.disabled = isSolving;
    elements["cancel-search"].hidden = !isSolving;
    elements["cancel-search"].disabled = !isSolving;
    elements["solve-loader"].hidden = !isSolving;
    elements["solve-loader-text"].textContent = message;
    document.body.classList.toggle("solving-active", isSolving);
  }
  function resetSolution() {
    stopPlayback();
    solutionStates = [];
    solutionMoves = [];
    currentStep = 0;
    elements["move-count"].textContent = "-";
    elements["solve-time"].textContent = "-";
    elements["visited-count"].textContent = "-";
    elements["depth-count"].textContent = "-";
    elements["path-summary"].textContent = "No path";
    elements.moves.innerHTML = '<li class="empty-result">Solve a puzzle to see its move sequence.</li>';
    elements["step-label"].textContent = "No run";
    activeRunId = null;
    renderRunHistory();
    renderActiveMove();
  }
  function createSolutionStates(start, moves) {
    const states = [structuredClone(start)];
    moves.forEach((move) => {
      const previous = states.at(-1);
      if (!previous) return;
      const next = structuredClone(previous);
      const vehicle = next.find((item) => item.model === move[0]);
      if (!vehicle) return;
      if (move[1] === "L") vehicle.x -= 1;
      if (move[1] === "R") vehicle.x += 1;
      if (move[1] === "U") vehicle.y -= 1;
      if (move[1] === "D") vehicle.y += 1;
      states.push(next);
    });
    const latest = states.at(-1);
    if (latest) {
      const exited = structuredClone(latest);
      const redCar = exited.find((item) => item.model === "X");
      if (redCar) {
        redCar.x = 6;
        states.push(exited);
      }
    }
    return states;
  }
  function playbackLength() {
    return solutionStates.length ? solutionStates.length - 1 : 0;
  }
  function createRun(result, details) {
    return {
      id: nextRunId++,
      key: details.key,
      puzzleLabel: details.puzzleLabel,
      preset: details.preset,
      vehicles: structuredClone(details.vehicles),
      algorithm: details.algorithm,
      heuristic: details.heuristic,
      algorithmLabel: details.algorithmLabel,
      solved: result.solved,
      moves: result.moves,
      moveCount: result.solved ? result.moves.length : 0,
      elapsed: result.elapsed,
      visited: result.visited,
      maxDepth: result.maxDepth ?? maxDepth(result.visitedByDepth),
      stoppedReason: result.stoppedReason ?? null
    };
  }
  function runStatus(run) {
    if (run.solved) return `${run.moveCount} moves`;
    if (run.stoppedReason === "timeout") return "timeout";
    if (run.stoppedReason === "cancelled") return "cancelled";
    return "no solution";
  }
  function loadRun(run) {
    closeReportIfOpen();
    stopPlayback();
    activeRunId = run.id;
    vehicles = structuredClone(run.vehicles);
    elements.preset.value = run.preset && elements.preset.querySelector(`option[value="${run.preset}"]`) ? run.preset : "";
    if (run.algorithm === "bestFS" && isHeuristic(run.heuristic)) elements.heuristic.value = run.heuristic;
    setAlgorithm(run.algorithm);
    solutionMoves = [...run.moves];
    solutionStates = run.solved ? createSolutionStates(vehicles, solutionMoves) : [];
    currentStep = 0;
    setMetrics(run);
    if (run.solved) {
      renderMoveList();
    } else {
      elements.moves.replaceChildren(emptyListItem(`${runStatus(run)}.`));
    }
    render();
    renderRunHistory();
  }
  function emptyListItem(message) {
    const item = document.createElement("li");
    item.className = "empty-result";
    item.textContent = message;
    return item;
  }
  function appendTextCell(row, text, className) {
    const span = document.createElement("span");
    if (className) span.className = className;
    span.textContent = text;
    row.append(span);
  }
  function renderRunHistory() {
    const columns = document.querySelector(".run-history-columns");
    if (columns) columns.hidden = runs.length === 0;
    if (!runs.length) {
      const empty = document.createElement("div");
      empty.className = "empty-result";
      empty.textContent = "Solve to start comparing runs.";
      elements["run-history"].replaceChildren(empty);
      return;
    }
    const rows = runs.map((run) => {
      const row = document.createElement("div");
      row.className = "run-history-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.classList.toggle("active", run.id === activeRunId);
      row.title = `${run.puzzleLabel} \xB7 ${run.algorithmLabel} \xB7 ${run.solved ? `${run.moveCount} moves` : runStatus(run)} \xB7 ${formatElapsed(run.elapsed)} \xB7 ${run.visited.toLocaleString()} states visited`;
      appendTextCell(row, String(run.id), "run-index");
      appendTextCell(row, compactPuzzleLabel(run));
      appendTextCell(row, run.algorithmLabel);
      appendTextCell(row, compactMoves(run));
      appendTextCell(row, formatElapsedCompact(run.elapsed));
      appendTextCell(row, formatCountCompact(run.visited));
      row.addEventListener("click", () => loadRun(run));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          loadRun(run);
        }
      });
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "run-delete";
      deleteButton.textContent = "\xD7";
      deleteButton.title = "Delete run";
      deleteButton.setAttribute("aria-label", `Delete run #${run.id}`);
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteRun(run.id);
      });
      row.append(deleteButton);
      return row;
    });
    elements["run-history"].replaceChildren(...rows);
  }
  function deleteRun(id) {
    const wasActive = activeRunId === id;
    runs = runs.filter((run) => run.id !== id);
    if (wasActive) resetSolution();
    renderRunHistory();
    render();
  }
  function clearRuns() {
    runs = [];
    vehicles = [];
    elements.preset.value = "";
    resetSolution();
    setStatus("Run history and board cleared. Place the red X car on row 3.");
    render();
  }
  async function solve() {
    closeReportIfOpen();
    stopPlayback();
    const heuristic = searchHeuristic();
    const runDetails = {
      algorithm,
      heuristic,
      algorithmLabel: algorithmLabel(),
      key: runKey(vehicles, algorithm, heuristic),
      preset: elements.preset.value,
      puzzleLabel: puzzleLabel(),
      vehicles: structuredClone(vehicles)
    };
    const existingRun = runs.find((run) => run.key === runDetails.key);
    if (existingRun) {
      loadRun(existingRun);
      setStatus("Loaded existing run from history.");
      return;
    }
    solveAbortController = new AbortController();
    solveCancelledByUser = false;
    setSolving(true, algorithm === "dfs" ? "Searching with DFS..." : "Searching...");
    setStatus(algorithm === "dfs" ? "Searching with DFS..." : "Searching...");
    const searchStarted = performance.now();
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicles, algorithm, heuristic: elements.heuristic.value }),
        signal: solveAbortController.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        const error = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Could not solve puzzle.";
        throw new Error(error);
      }
      const result = parseSolveResult(payload);
      const run = createRun(result, runDetails);
      runs.push(run);
      loadRun(run);
      if (!result.solved) {
        if (result.stoppedReason === "timeout") {
          setStatus(`Search stopped after ${result.timeoutSeconds} seconds. Try BFS or A* for this board.`, true);
        } else if (result.stoppedReason === "cancelled") {
          setStatus("Search cancelled.", true);
        } else {
          setStatus("No solution was found for this board.", true);
        }
        return;
      }
      setStatus(`Solved in ${solutionMoves.length} moves. Use the playback controls to inspect the path.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" || solveCancelledByUser) {
        const cancelledRun = createRun({
          solved: false,
          moves: [],
          elapsed: (performance.now() - searchStarted) / 1e3,
          visited: 0,
          visitedByDepth: {},
          stoppedReason: "cancelled"
        }, runDetails);
        runs.push(cancelledRun);
        loadRun(cancelledRun);
        setStatus("Search cancelled.", true);
      } else {
        setStatus(error instanceof Error ? error.message : "Could not solve puzzle.", true);
      }
    } finally {
      solveAbortController = null;
      solveCancelledByUser = false;
      setSolving(false);
    }
  }
  function cancelSolve() {
    if (!solveAbortController) return;
    solveCancelledByUser = true;
    solveAbortController.abort();
    void fetch("/api/cancel", { method: "POST" }).catch(() => void 0);
    setStatus("Cancelling search...");
  }
  function moveVehicle(move) {
    return move[0];
  }
  function moveDirection(move) {
    return move[1];
  }
  function renderMoveList() {
    const moveItems = solutionMoves.map((move, index) => {
      const item = document.createElement("li");
      item.dataset.step = String(index + 1);
      const label2 = document.createElement("span");
      label2.textContent = `${index + 1}. Vehicle ${moveVehicle(move)}`;
      const direction2 = document.createElement("strong");
      direction2.textContent = DIRECTIONS[moveDirection(move)];
      item.append(label2, direction2);
      item.addEventListener("click", () => goToStep(index + 1));
      return item;
    });
    const exitItem = document.createElement("li");
    exitItem.dataset.step = String(solutionMoves.length + 1);
    exitItem.className = "exit-step";
    const label = document.createElement("span");
    label.textContent = `${solutionMoves.length + 1}. Vehicle X`;
    const direction = document.createElement("strong");
    direction.textContent = "exit board";
    exitItem.append(label, direction);
    exitItem.addEventListener("click", () => goToStep(solutionMoves.length + 1));
    elements.moves.replaceChildren(...moveItems, exitItem);
  }
  function scrollActiveMoveIntoView() {
    const active = elements.moves.querySelector(".active");
    const list = elements.moves;
    if (!active) return;
    const listTop = list.scrollTop;
    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    if (activeTop < listTop) {
      list.scrollTop = activeTop;
    } else if (activeBottom > listTop + list.clientHeight) {
      list.scrollTop = activeBottom - list.clientHeight;
    }
  }
  function setPlaybackScrollLock(locked) {
    document.body.classList.toggle("playback-active", locked);
  }
  function renderActiveMove() {
    const card = elements["active-move"];
    if (!solutionMoves.length) {
      card.className = "active-move idle";
      card.innerHTML = `
      <div class="move-vehicle move-vehicle-idle" aria-hidden="true">\u2014</div>
      <div class="active-move-copy">
        <span class="active-move-label">Current action</span>
        <strong class="active-move-title">No active run</strong>
      </div>
    `;
      return;
    }
    const isExitStep = currentStep === playbackLength() && currentStep > solutionMoves.length;
    const activeMove = currentStep > 0 && !isExitStep ? solutionMoves[currentStep - 1] : null;
    const nextMove = currentStep < solutionMoves.length ? solutionMoves[currentStep] : null;
    const shownMove = activeMove || nextMove;
    const vehicle = shownMove ? moveVehicle(shownMove) : "X";
    const direction = shownMove ? DIRECTIONS[moveDirection(shownMove)] : null;
    const stepMeta = `Step ${currentStep} of ${playbackLength()}`;
    let title;
    let meta = "";
    if (isExitStep) {
      title = "Goal reached";
    } else if (activeMove) {
      title = `Moved ${vehicle} ${direction}`;
      meta = stepMeta;
    } else if (nextMove) {
      title = `Next: ${vehicle} ${direction}`;
      meta = currentStep === 0 ? "Press play or step forward to begin." : stepMeta;
    } else {
      title = "Next: exit board";
      meta = stepMeta;
    }
    card.className = "active-move";
    card.replaceChildren();
    const vehicleBadge = document.createElement("div");
    vehicleBadge.className = "move-vehicle";
    vehicleBadge.style.background = COLORS[vehicle];
    vehicleBadge.textContent = vehicle;
    const copy = document.createElement("div");
    copy.className = "active-move-copy";
    const label = document.createElement("span");
    label.className = "active-move-label";
    label.textContent = "Current action";
    const titleElement = document.createElement("strong");
    titleElement.className = "active-move-title";
    titleElement.textContent = title;
    copy.append(label, titleElement);
    card.append(vehicleBadge, copy);
    if (meta) {
      const metaElement = document.createElement("span");
      metaElement.className = "active-move-meta";
      metaElement.textContent = meta;
      card.append(metaElement);
    }
  }
  function renderPlayback() {
    const hasSolution = solutionStates.length > 0;
    const totalSteps = playbackLength();
    elements.previous.disabled = !hasSolution || currentStep === 0;
    elements.next.disabled = !hasSolution || currentStep === totalSteps;
    elements.play.disabled = !hasSolution;
    elements.play.innerHTML = playTimer ? "&#10074;&#10074;" : "&#9654;";
    elements["step-label"].textContent = hasSolution ? `Step ${currentStep} / ${totalSteps}` : "No run";
    elements.moves.querySelectorAll("li[data-step]").forEach((item) => {
      item.classList.toggle("active", Number(item.dataset.step) === currentStep);
    });
    renderActiveMove();
  }
  function goToStep(step) {
    closeReportIfOpen();
    currentStep = Math.max(0, Math.min(playbackLength(), step));
    render();
    scrollActiveMoveIntoView();
  }
  function stopPlayback() {
    if (playTimer) window.clearInterval(playTimer);
    playTimer = null;
    setPlaybackScrollLock(false);
  }
  function togglePlayback() {
    closeReportIfOpen();
    if (playTimer) {
      stopPlayback();
      renderPlayback();
      return;
    }
    if (currentStep === playbackLength()) currentStep = 0;
    setPlaybackScrollLock(true);
    playTimer = window.setInterval(() => {
      if (currentStep >= playbackLength()) {
        stopPlayback();
        renderPlayback();
        return;
      }
      goToStep(currentStep + 1);
    }, 550);
    renderPlayback();
  }
  async function loadPresets() {
    try {
      const response = await fetch("/api/presets");
      const data = await response.json();
      data.presets.forEach((preset) => {
        const option = document.createElement("option");
        option.value = String(preset.number);
        option.textContent = `Preset ${preset.number}`;
        option.dataset.vehicles = JSON.stringify(preset.vehicles);
        elements.preset.append(option);
      });
      elements.preset.value = "1";
      const selected = elements.preset.selectedOptions[0];
      vehicles = selected?.dataset.vehicles ? parseVehicles(JSON.parse(selected.dataset.vehicles)) : [];
      setStatus("Preset 1 loaded. Edit it or solve it as-is.");
      render();
    } catch {
      setStatus("Could not load preset puzzles.", true);
    }
  }
  function setAlgorithm(value) {
    algorithm = value;
    elements.bestfs.classList.toggle("active", value === "bestFS");
    elements.bfs.classList.toggle("active", value === "bfs");
    elements.dfs.classList.toggle("active", value === "dfs");
    elements.heuristic.disabled = value !== "bestFS";
  }
  elements.horizontal.addEventListener("click", () => setOrientation("H"));
  elements.vertical.addEventListener("click", () => setOrientation("V"));
  elements.bestfs.addEventListener("click", () => setAlgorithm("bestFS"));
  elements.bfs.addEventListener("click", () => setAlgorithm("bfs"));
  elements.dfs.addEventListener("click", () => setAlgorithm("dfs"));
  elements.remove.addEventListener("click", () => {
    vehicles = vehicles.filter((vehicle) => vehicle.model !== selectedModel);
    resetSolution();
    render();
  });
  elements.clear.addEventListener("click", () => {
    vehicles = [];
    elements.preset.value = "";
    resetSolution();
    setStatus("Board cleared. Place the red X car on row 3.");
    render();
  });
  elements.preset.addEventListener("change", () => {
    const option = elements.preset.selectedOptions[0];
    if (!option?.dataset.vehicles) return;
    vehicles = parseVehicles(JSON.parse(option.dataset.vehicles));
    resetSolution();
    setStatus(`Preset ${option.value} loaded. Edit it or solve it as-is.`);
    render();
  });
  elements.solve.addEventListener("click", () => void solve());
  elements["cancel-search"].addEventListener("click", cancelSolve);
  elements["clear-runs"].addEventListener("click", clearRuns);
  elements["show-report"].addEventListener("click", showReport);
  elements["show-board"].addEventListener("click", showBoard);
  elements["close-report"].addEventListener("click", showBoard);
  elements.previous.addEventListener("click", () => goToStep(currentStep - 1));
  elements.next.addEventListener("click", () => goToStep(currentStep + 1));
  elements.play.addEventListener("click", togglePlayback);
  buildPalette();
  buildGrid();
  setOrientation("H");
  setAlgorithm("bestFS");
  render();
  renderRunHistory();
  void loadPresets();
})();
