#!/usr/bin/env python3

import argparse
import json
import mimetypes
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from src.solver.RushHour import RushHour
from src.solver.runner import get_puzzle, initialize_state, reset_search_problem
from src.solver.SearchProblem import SearchProblem


PROJECT_ROOT = Path(__file__).resolve().parents[2];
FRONTEND_ROOT = PROJECT_ROOT / "src" / "frontend";
BOARDS_ROOT = PROJECT_ROOT / "src" / "data" / "boards";
SOLVER_LOCK = threading.Lock();  # protect shared SearchProblem class state
SEARCH_TIMEOUT_SECONDS = 30;
DFS_MAX_DEPTH = None;
CAR_MODELS = set("XABCDEFGHIJK");
TRUCK_MODELS = set("OPQR");
ALL_MODELS = CAR_MODELS | TRUCK_MODELS;
HEURISTICS = {"h1", "h2", "h3"};
ALGORITHMS = {"bfs", "dfs", "bestFS"};
MAX_BODY_BYTES = 100_000;


def max_depth(depth_counts):
    """
    Return the deepest search depth recorded in a depth-count map.
    """

    return max(depth_counts.keys(), default=0);


def validate_vehicles(raw_vehicles):
    """
    Validate browser vehicle JSON before passing it to the solver.
    """

    if not isinstance(raw_vehicles, list):
        raise ValueError("Vehicles must be a list.");

    vehicles = [];
    occupied = {};
    seen = set();

    # iterate over submitted vehicles
    for raw in raw_vehicles:
        if not isinstance(raw, dict):
            raise ValueError("Each vehicle must be an object.");

        model = str(raw.get("model", "")).upper();
        orientation = str(raw.get("orientation", "")).upper();
        x = raw.get("x");
        y = raw.get("y");

        # check model, orientation, and coordinates
        if model not in ALL_MODELS:
            raise ValueError(f"Unknown vehicle model '{model}'.");
        if model in seen:
            raise ValueError(f"Vehicle {model} appears more than once.");
        if orientation not in {"H", "V"}:
            raise ValueError(f"Vehicle {model} needs an H or V orientation.");
        if not isinstance(x, int) or not isinstance(y, int):
            raise ValueError(f"Vehicle {model} needs integer coordinates.");

        # build occupied cells for this vehicle
        length = 2 if model in CAR_MODELS else 3;
        cells = [
            (x + offset if orientation == "H" else x,
             y if orientation == "H" else y + offset)
            for offset in range(length)
        ];

        # check bounds and overlap with other vehicles
        for cell_x, cell_y in cells:
            if not (0 <= cell_x < 6 and 0 <= cell_y < 6):
                raise ValueError(f"Vehicle {model} extends outside the board.");
            if (cell_x, cell_y) in occupied:
                raise ValueError(
                    f"Vehicle {model} overlaps vehicle {occupied[(cell_x, cell_y)]}."
                );
            occupied[(cell_x, cell_y)] = model;

        seen.add(model);
        vehicles.append((model, x, y, orientation));

    # require the red target car X on the exit row
    if "X" not in seen:
        raise ValueError("Add the red target car X before solving.");

    x_vehicle = next(vehicle for vehicle in vehicles if vehicle[0] == "X");
    if x_vehicle[2] != 2 or x_vehicle[3] != "H":
        raise ValueError("The red target car X must be horizontal on exit row 3.");

    return vehicles;


def solve_puzzle(vehicles, algorithm, heuristic):
    """
    Run one search while protecting the solver's shared class state.
    """

    if algorithm not in ALGORITHMS:
        raise ValueError("Algorithm must be bfs, dfs, or bestFS.");
    if algorithm == "bestFS" and heuristic not in HEURISTICS:
        raise ValueError("A* search requires heuristic h1, h2, or h3.");

    start_state = initialize_state(vehicles);
    problem = RushHour(start_state);

    with SOLVER_LOCK:
        reset_search_problem();
        SearchProblem.deadline = time.perf_counter() + SEARCH_TIMEOUT_SECONDS;
        started = time.perf_counter();

        # dispatch selected search algorithm
        if algorithm == "bfs":
            problem.bfs();
        elif algorithm == "dfs":
            problem.dfs(max_depth=DFS_MAX_DEPTH);
        else:
            problem.bestFS(heuristic=heuristic);

        elapsed = time.perf_counter() - started;

        # capture shared solver metrics before releasing the lock
        solutions = list(SearchProblem.unique_solutions);
        visited = SearchProblem.num_visited;
        unique = len(SearchProblem.unique);
        visited_by_depth = dict(SearchProblem.visited_dictionary);
        unique_by_depth = dict(SearchProblem.unique_dictionary);
        stopped_reason = SearchProblem.stop_reason;

    # build default response payload
    result = {
        "solved": False,
        "moves": [],
        "elapsed": elapsed,
        "visited": visited,
        "unique": unique,
        "maxDepth": max_depth(visited_by_depth),
        "visitedByDepth": visited_by_depth,
        "uniqueByDepth": unique_by_depth,
        "stoppedReason": stopped_reason,
        "timeoutSeconds": SEARCH_TIMEOUT_SECONDS,
    };

    if not solutions:
        return result;

    # convert first solution path into two-character move tokens
    path = solutions[0][0].replace(" ", "");
    result["solved"] = True;
    result["moves"] = [path[index:index + 2] for index in range(0, len(path), 2)];
    return result;


def state_to_vehicles(state):
    """
    Convert a solver state tuple into browser-friendly vehicle objects.
    """

    vehicles = [];
    for model, frame, orientation in state:
        x = min(cell[0] for cell in frame);
        y = min(cell[1] for cell in frame);
        vehicles.append({"model": model, "x": x, "y": y, "orientation": orientation});
    return vehicles;


class RequestHandler(BaseHTTPRequestHandler):
    """
    HTTP handler for the Rush Hour web app and JSON API.
    """

    server_version = "RushHourHTTP/1.0";

    def read_json_body(self):
        """
        Read and validate a JSON request body from the client.
        """

        content_type = self.headers.get("Content-Type", "");
        if content_type and not content_type.lower().startswith("application/json"):
            raise ValueError("Content-Type must be application/json.");

        try:
            content_length = int(self.headers.get("Content-Length", "0"));
        except ValueError as error:
            raise ValueError("Content-Length must be an integer.") from error;
        if content_length <= 0:
            raise ValueError("Request body is required.");
        if content_length > MAX_BODY_BYTES:
            raise ValueError("Request is too large.");

        try:
            body = self.rfile.read(content_length).decode("utf-8");
            payload = json.loads(body);
        except UnicodeDecodeError as error:
            raise ValueError("Request body must be UTF-8 JSON.") from error;
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.");
        return payload;

    def send_security_headers(self):
        """
        Attach basic security headers to every HTTP response.
        """

        self.send_header("X-Content-Type-Options", "nosniff");
        self.send_header("Referrer-Policy", "no-referrer");

    def send_json(self, status, payload):
        """
        Send a JSON response with the given HTTP status code.
        """

        data = json.dumps(payload).encode("utf-8");
        self.send_response(status);
        self.send_header("Content-Type", "application/json");
        self.send_header("Content-Length", str(len(data)));
        self.send_security_headers();
        self.end_headers();
        self.wfile.write(data);

    def send_api_error(self, status, message):
        """
        Send a JSON error payload for API requests.
        """

        self.send_json(status, {"error": message});

    def cancel_search(self):
        """
        Signal the shared solver to stop the current search.
        """

        SearchProblem.stop = True;
        SearchProblem.cancelled = True;
        SearchProblem.stop_reason = "cancelled";
        self.send_json(200, {"cancelled": True});

    def send_presets(self):
        """
        Return all bundled preset boards as JSON.
        """

        presets = [];
        for number in range(1, 41):
            presets.append({
                "number": number,
                "vehicles": state_to_vehicles(get_puzzle(number, folder=str(BOARDS_ROOT))),
            });
        self.send_json(200, {"presets": presets});

    def serve_static(self, path):
        """
        Serve a file from the frontend directory.
        """

        relative_path = "index.html" if path == "/" else unquote(path).lstrip("/");
        requested = (FRONTEND_ROOT / relative_path).resolve();

        # block path traversal outside the frontend root
        if FRONTEND_ROOT not in requested.parents and requested != FRONTEND_ROOT:
            self.send_error(403);
            return;
        if not requested.is_file():
            self.send_error(404);
            return;

        data = requested.read_bytes();
        content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream";
        self.send_response(200);
        self.send_header("Content-Type", content_type);
        self.send_header("Content-Length", str(len(data)));
        self.send_security_headers();
        self.end_headers();
        self.wfile.write(data);

    def do_GET(self):
        """
        Route GET requests to the API or static frontend files.
        """

        path = urlparse(self.path).path;
        if path == "/api/presets":
            self.send_presets();
            return;
        if path.startswith("/api/"):
            self.send_api_error(404, "API endpoint not found.");
            return;
        self.serve_static(path);

    def do_POST(self):
        """
        Handle solve and cancel POST requests.
        """

        path = urlparse(self.path).path;
        if path == "/api/cancel":
            self.cancel_search();
            return;
        if path != "/api/solve":
            self.send_error(404);
            return;

        try:
            payload = self.read_json_body();
            vehicles = validate_vehicles(payload.get("vehicles"));
            result = solve_puzzle(
                vehicles,
                str(payload.get("algorithm", "bestFS")),
                str(payload.get("heuristic", "h2")),
            );
            self.send_json(200, result);
        except BrokenPipeError:
            return;
        except (ValueError, json.JSONDecodeError) as error:
            self.send_api_error(400, str(error));
        except Exception as error:
            print(f"Solver failed: {error}");
            self.send_api_error(500, "Solver failed.");

    def do_PUT(self):
        """
        Reject unsupported PUT requests.
        """

        self.send_api_error(405, "Method not allowed.");

    def do_DELETE(self):
        """
        Reject unsupported DELETE requests.
        """

        self.send_api_error(405, "Method not allowed.");

    def log_message(self, format_string, *args):
        """
        Print request log lines to stdout.
        """

        print(f"{self.address_string()} - {format_string % args}");


def main():
    """
    Parse CLI arguments and start the local web server.
    """

    parser = argparse.ArgumentParser(description="Run the Rush Hour puzzle web app.");
    parser.add_argument("--host", default="127.0.0.1");
    parser.add_argument("--port", type=int, default=8000);
    args = parser.parse_args();

    os.chdir(PROJECT_ROOT);
    server = ThreadingHTTPServer((args.host, args.port), RequestHandler);
    print(f"Rush Hour web app running at http://{args.host}:{args.port}");
    try:
        server.serve_forever();
    except KeyboardInterrupt:
        pass;
    finally:
        server.server_close();


if __name__ == "__main__":
    main();
