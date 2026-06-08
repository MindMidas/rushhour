<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/frontend/assets/rushhour_white.png">
    <img src="src/frontend/assets/rushhour.png" alt="rushhour" width="220">
  </picture>
</p>

<p align="center">
  <strong>Puzzle editor and solver</strong><br>
  A*, BFS, and DFS on Rush Hour boards
</p>

<p align="center">
  <img src="https://img.shields.io/badge/A%2A-312f2c?style=for-the-badge&labelColor=e5e9ec&color=312f2c" alt="A*">
  <img src="https://img.shields.io/badge/BFS-312f2c?style=for-the-badge&labelColor=e5e9ec&color=312f2c" alt="BFS">
  <img src="https://img.shields.io/badge/DFS-312f2c?style=for-the-badge&labelColor=e5e9ec&color=312f2c" alt="DFS">
</p>

<p align="center">
  Place vehicles, load preset boards, compare search algorithms, and play back solutions step by step.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/esbuild-FFCF00?style=for-the-badge&logo=esbuild&logoColor=black" alt="esbuild">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

<p align="center">
  <img src="src/frontend/assets/rushhour.gif" alt="Rush Hour demo" width="100%">
</p>

## Overview

- Interactive 6×6 board editor with 40 bundled presets.
- BFS, DFS, and Best-First / A* search from the browser UI.
- Three heuristics for Best-First / A*: `h1`, `h2`, and `h3`.
- View solutions move by move, past runs, and compare algorithms on runtime and search cost.
- CLI support for running searches from terminal.

**Best-First Search and A\* are used interchangeably in this project.** They refer to the same heuristic search implementation. The browser button says **A\***, while the API, solver, and CLI use the identifier `bestFS`.

| Name | Where it appears |
|---|---|
| BFS | UI, API (`bfs`), CLI |
| DFS | UI, API (`dfs`) |
| Best-First / A* | UI label **A\***; API and CLI use `bestFS` |

Heuristics for `bestFS`:

- `h1`: distance of the red car `X` to the exit (Manhattan distance).
- `h2`: `h1` plus number of blocking cars in the way.
- `h3`: `h1` plus cost to move blocking cars.

## Commands

Web app:

```bash
python3 -m src.server.app
```

Then open `http://127.0.0.1:8000`.

CLI (run from the project root; requires Python 3.10+):

```bash
python3 -m src.solver.runner [algorithm] [options]
```

Examples:

```bash
python3 -m src.solver.runner bfs --file src/data/boards/1
python3 -m src.solver.runner bestFS --h h1 --file src/data/boards/1
python3 -m src.solver.runner bfs bestFS --h h1 h2 h3 -loop   # all 40 puzzles; reads boards/1..40
```

For `-loop`, create a `boards` link first: `ln -sf src/data/boards boards`.

Use one algorithm to print the solution in the terminal. Use `bfs` and `bestFS` together to write comparison JSON (`bfs_results.json`, `h1_results.json`, etc., plus `results.json` when both are run).

## Project Map

| Path | Purpose |
|---|---|
| `src/data/boards/` | 40 preset puzzle files. |
| `src/frontend/` | Browser UI, built CSS/JS, logos, demo GIF, write-up PDF, and social preview source. |
| `src/frontend/assets/` | Logos, demo GIF, source recording, write-up PDF, and social preview image. |
| `src/server/app.py` | Local HTTP server and JSON API. |
| `src/solver/` | Rush Hour search problem, solver, and CLI runner. |
