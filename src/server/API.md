# Rush Hour API

This is the small JSON API used by the Rush Hour web UI.

| Item | Value |
|---|---|
| Local URL | `http://127.0.0.1:8000` |
| Errors | `{"error": "message"}` |
| Session | Browser cookie, handled by the server |

## Vehicles

Vehicles are sent like this:

```json
{ "model": "X", "x": 0, "y": 2, "orientation": "H" }
```

- `model`: `X`, `A`-`K`, or `O`-`R`
- `x`, `y`: zero-based board position
- `orientation`: `H` or `V`
- `X` is the red target car and must be horizontal on row 3 in the UI

## `GET /api/presets`

Returns the 40 built-in boards.

```json
{
  "presets": [
    {
      "number": 1,
      "vehicles": [
        { "model": "X", "x": 0, "y": 2, "orientation": "H" }
      ]
    }
  ]
}
```

## `POST /api/solve`

Solves one board.

```json
{
  "jobId": "job-12345678",
  "algorithm": "bestFS",
  "heuristic": "h2",
  "vehicles": [
    { "model": "X", "x": 0, "y": 2, "orientation": "H" }
  ]
}
```

Algorithms:

- `bfs`
- `dfs`
- `bestFS` for the A* button in the UI

Heuristics for `bestFS`:

- `h1`: distance to the exit
- `h2`: distance plus blockers
- `h3`: estimated cost to clear blockers

Params:

- `jobId`: frontend-generated id for this solve.
- `algorithm`: `bfs`, `dfs`, or `bestFS`.
- `heuristic`: used by `bestFS`; defaults to `h2`.
- `vehicles`: validated board layout.

In the response, `visited` means expanded states. `unique` means unique states discovered, including states still waiting in the frontier when the solution is found.

Example response:

```json
{
  "solved": true,
  "moves": ["XR", "AR"],
  "elapsed": 0.0796,
  "visited": 691,
  "unique": 745,
  "maxDepth": 12,
  "stoppedReason": null
}
```

## `POST /api/cancel`

Stops the active solve request for the same browser session.

```json
{ "jobId": "job-12345678" }
```

Example response:

```json
{ "cancelled": true }
```

## Notes

- The frontend creates the `jobId`.
- The server limits solve and cancel requests so the solver cannot be spammed.
- In production mode, state-changing requests must come from the same origin.
