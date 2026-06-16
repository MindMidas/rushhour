<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/frontend/public/assets/rushhour_white.png">
    <img src="src/frontend/public/assets/rushhour.png" alt="Rush Hour" width="220">
  </picture>
</p>

<h1 align="center">Rush Hour</h1>

<p align="center">
  Puzzle editor and solver with BFS, DFS, and Best-First / A* search.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/A*-334155?style=for-the-badge&labelColor=e5e9ec&color=334155" alt="A*">
  <img src="https://img.shields.io/badge/BFS-334155?style=for-the-badge&labelColor=e5e9ec&color=334155" alt="BFS">
  <img src="https://img.shields.io/badge/DFS-334155?style=for-the-badge&labelColor=e5e9ec&color=334155" alt="DFS">
  <img src="https://img.shields.io/badge/Heuristics-334155?style=for-the-badge&labelColor=e5e9ec&color=334155" alt="Heuristics">
  <img src="https://img.shields.io/badge/Board%20Editor-334155?style=for-the-badge&labelColor=e5e9ec&color=334155" alt="Board Editor">
</p>

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"></a>
</p>

<p align="center">
  <img src="src/frontend/public/assets/rushhour.gif" alt="Rush Hour demo" width="100%">
</p>

---

# **Overview**

Rush Hour is a 6x6 puzzle editor and solver. It includes a React frontend, a Python server, and Python search code.

What is included:

- Board editor with cars, trucks, and 40 built-in puzzles.
- BFS and DFS search.
- Best-First / A* search with `h1`, `h2`, and `h3`.
- Solution playback, run history, and a small JSON API.

In this project, the browser button says **A\***. The API and CLI call the same search mode `bestFS`.

Heuristics:

- `h1`: distance from the red car `X` to the exit.
- `h2`: `h1` plus blocking vehicles.
- `h3`: `h1` plus estimated cost to move blockers.

---

# **Pre-Requisites**

Ensure these are installed:

- Python 3.10+
- Node.js 20.19+, 22.13+, or newer
- npm 10+
- Docker, only needed for deployment

---

# **Folder Structure**

```text
rushhour/
|-- src/
|   |-- data/boards/
|   |-- frontend/
|   |-- server/
|   `-- solver/
|-- Dockerfile
|-- package.json
|-- package-lock.json
|-- build
`-- README.md
```

Important paths:

- `src/data/boards/` contains the 40 bundled puzzle files.
- `src/solver/` contains the search code.
- `src/server/app.py` serves the app and JSON API.
- `src/server/API.md` documents the API.
- `src/frontend/public/assets/` contains the logo, demo GIF, GitHub social preview image, and report PDF.

---

# **How to Build & Run**

## 1. Start the App

```bash
./build
```

This installs locked npm dependencies if needed, builds the frontend, and starts the local server.

Open:

```text
http://127.0.0.1:8000
```

Use another port by setting `RUSHHOUR_PORT`:

```bash
RUSHHOUR_PORT=8010 ./build
```

## 2. Common Commands

```bash
./build build
./build run
./build restart
./build stop
./build clean
./build test
./build typecheck
./build lint
./build audit
```

## 3. CLI Solver

Run from the project root:

```bash
python3 -m src.solver.runner bfs --file src/data/boards/1
python3 -m src.solver.runner bestFS --h h2 --file src/data/boards/1
python3 -m src.solver.runner bfs bestFS --h h1 h2 h3 --file src/data/boards/3
```

To run all 40 bundled puzzles:

```bash
python3 -m src.solver.runner bfs bestFS --h h1 h2 h3 -loop
```

A single algorithm prints the found move path. Comparison runs write `results.json`.

---

# **Testing**

Run the solver smoke test:

```bash
./build test
```

Run frontend checks:

```bash
./build typecheck
./build lint
```

Run all configured checks:

```bash
./build audit
```

---

# **Deploy**

Set a stable session secret before running in production:

```bash
RUSHHOUR_SESSION_SECRET="replace-with-at-least-32-random-characters"
```

Build and run the Docker image:

```bash
docker build -t rushhour .
docker run -d --restart unless-stopped \
  -e RUSHHOUR_ENV=production \
  -e RUSHHOUR_SESSION_SECRET="replace-with-at-least-32-random-characters" \
  -p 8000:8000 \
  rushhour
```

Serve it behind HTTPS when deployed publicly.

---

# **Notes**

- The red target car is `X`.
- Cars use `X` and `A` through `K`.
- Trucks use `O` through `R`.
- The project report is stored at `src/frontend/public/assets/report.pdf`.
- The API docs are in `src/server/API.md`.
