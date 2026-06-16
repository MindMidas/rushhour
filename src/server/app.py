#!/usr/bin/env python3

# Local HTTP server for the Rush Hour web app and solver API.

import argparse;
import hashlib;
import hmac;
import json;
import mimetypes;
import os;
import re;
import secrets;
import sys;
import threading;
import time;
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer;
from http.cookies import CookieError, SimpleCookie;
from pathlib import Path;
from urllib.parse import unquote, urlparse;

from src.solver.RushHour import RushHour;
from src.solver.runner import get_puzzle, initialize_state, reset_search_problem;
from src.solver.SearchProblem import SearchProblem;


PROJECT_ROOT = Path(__file__).resolve().parents[2];
FRONTEND_ROOT = PROJECT_ROOT / "src" / "frontend" / "dist";
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
SESSION_COOKIE_NAME = "rushhour_session";
SESSION_SECRET = (os.environ.get("RUSHHOUR_SESSION_SECRET") or "").encode("utf-8") or secrets.token_bytes(32);
JOB_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,80}$");
RATE_LIMITS = {
    "solve": (6, 60.0),
    "cancel": (30, 60.0),
};
RATE_LIMIT_BUCKETS = {};
RATE_LIMIT_LOCK = threading.Lock();
ACTIVE_JOBS = {};
SESSION_ACTIVE_JOB = {};
JOB_LOCK = threading.Lock();


def security_log(event, **fields):
    """
    Emit one structured security-relevant event without logging request bodies.
    """;

    payload = {
        "event": event,
        "app": "rushhour",
        "ts": round(time.time(), 3),
    };
    payload.update({key: value for key, value in fields.items() if value is not None});
    print(json.dumps(payload, sort_keys=True), file=sys.stderr);


def is_production():
    """
    Return whether production safety checks should be enforced.
    """;

    return os.environ.get("RUSHHOUR_ENV", "development").strip().lower() == "production";


def validate_production_security():
    """
    Fail fast when production is enabled without a stable session secret.
    """;

    if not is_production():
        return;
    secret = os.environ.get("RUSHHOUR_SESSION_SECRET", "").strip();
    if len(secret) < 32:
        raise RuntimeError("RUSHHOUR_SESSION_SECRET must be at least 32 characters when RUSHHOUR_ENV=production.");


def validate_bind_safety(host):
    """
    Reject accidental public binds without production checks.
    """;

    if host in {"0.0.0.0", "::"} and not is_production():
        security_log("public_bind_without_production", host=host);
        raise RuntimeError("Refusing public bind without RUSHHOUR_ENV=production.");


def sign_session_id(session_id):
    """
    Sign one anonymous browser-session id.
    """;

    signature = hmac.new(SESSION_SECRET, session_id.encode("ascii"), hashlib.sha256).hexdigest();
    return f"{session_id}.{signature}";


def read_session_id(cookie_header):
    """
    Read and verify the anonymous session cookie.
    """;

    if not cookie_header:
        return None;
    cookie = SimpleCookie();
    try:
        cookie.load(cookie_header);
    except CookieError:
        return None;
    morsel = cookie.get(SESSION_COOKIE_NAME);
    if morsel is None:
        return None;
    try:
        session_id, signature = morsel.value.rsplit(".", 1);
    except ValueError:
        return None;
    expected = hmac.new(SESSION_SECRET, session_id.encode("ascii"), hashlib.sha256).hexdigest();
    if not hmac.compare_digest(signature, expected):
        return None;
    return session_id;


def validate_job_id(value):
    """
    Validate a browser-generated job id used for solve/cancel ownership.
    """;

    if not isinstance(value, str) or not JOB_ID_PATTERN.fullmatch(value):
        security_log("invalid_job_id");
        raise ValueError("jobId must be an 8-80 character id containing letters, numbers, underscores, or dashes.");
    return value;


def check_rate_limit(scope, session_id, client_ip):
    """
    Apply fixed-window quotas by anonymous session and client IP.
    """;

    limit, window = RATE_LIMITS[scope];
    now = time.monotonic();
    with RATE_LIMIT_LOCK:
        for key in ((scope, "session", session_id), (scope, "ip", client_ip)):
            bucket = RATE_LIMIT_BUCKETS.setdefault(key, []);
            bucket[:] = [timestamp for timestamp in bucket if now - timestamp < window];
            if len(bucket) >= limit:
                security_log("rate_limit_hit", scope=scope, limit=limit, window=window, clientIp=client_ip);
                raise RuntimeError("Too many requests. Please wait and try again.");
        for key in ((scope, "session", session_id), (scope, "ip", client_ip)):
            RATE_LIMIT_BUCKETS[key].append(now);


def register_active_job(session_id, job_id):
    """
    Record one active solve job for the anonymous session.
    """;

    with JOB_LOCK:
        current = SESSION_ACTIVE_JOB.get(session_id);
        if current is not None:
            security_log("active_job_rejected", reason="session_already_running");
            raise RuntimeError("A solve is already running for this browser session.");
        if job_id in ACTIVE_JOBS:
            security_log("active_job_rejected", reason="duplicate_job_id");
            raise ValueError("jobId is already active.");
        ACTIVE_JOBS[job_id] = session_id;
        SESSION_ACTIVE_JOB[session_id] = job_id;


def finish_active_job(session_id, job_id):
    """
    Remove a completed active solve job.
    """;

    with JOB_LOCK:
        if ACTIVE_JOBS.get(job_id) == session_id:
            del ACTIVE_JOBS[job_id];
        if SESSION_ACTIVE_JOB.get(session_id) == job_id:
            del SESSION_ACTIVE_JOB[session_id];


def require_owned_active_job(session_id, job_id):
    """
    Ensure the requested job belongs to the caller's anonymous session.
    """;

    with JOB_LOCK:
        return ACTIVE_JOBS.get(job_id) == session_id;


def max_depth(depth_counts):
    """
    Return the deepest search depth recorded in a depth-count map.
    """;

    return max(depth_counts.keys(), default=0);


def validate_vehicles(raw_vehicles):
    """
    Validate browser vehicle JSON before passing it to the solver.
    """;

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
    """;

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
            problem.best_fs(heuristic=heuristic);

        elapsed = time.perf_counter() - started;

        # capture shared solver metrics before releasing the lock
        solutions = list(SearchProblem.unique_solutions);
        visited = SearchProblem.num_visited;
        unique = len(SearchProblem.discovered);
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
    """;

    vehicles = [];
    for model, frame, orientation in state:
        x = min(cell[0] for cell in frame);
        y = min(cell[1] for cell in frame);
        vehicles.append({"model": model, "x": x, "y": y, "orientation": orientation});
    return vehicles;


class RequestHandler(BaseHTTPRequestHandler):
    """
    HTTP handler for the Rush Hour web app and JSON API.
    """;

    server_version = "RushHourHTTP/1.0";

    def session_id(self):
        """
        Return this browser profile's anonymous session id.
        """;

        session_id = read_session_id(self.headers.get("Cookie"));
        if session_id is None:
            session_id = secrets.token_urlsafe(24);
            self.new_session_cookie = sign_session_id(session_id);
        return session_id;

    def client_ip(self):
        """
        Return the direct client IP seen by this server.
        """;

        return str(getattr(self, "client_address", ("unknown",))[0] or "unknown");

    def read_json_body(self):
        """
        Read and validate a JSON request body from the client.
        """;

        request_path = urlparse(getattr(self, "path", "")).path;
        content_type = self.headers.get("Content-Type", "");
        if content_type and not content_type.lower().startswith("application/json"):
            security_log("invalid_json_request", reason="content_type", path=request_path, clientIp=self.client_ip());
            raise ValueError("Content-Type must be application/json.");

        try:
            content_length = int(self.headers.get("Content-Length", "0"));
        except ValueError as error:
            security_log("invalid_json_request", reason="content_length", path=request_path, clientIp=self.client_ip());
            raise ValueError("Content-Length must be an integer.") from error;
        if content_length <= 0:
            security_log("invalid_json_request", reason="empty_body", path=request_path, clientIp=self.client_ip());
            raise ValueError("Request body is required.");
        if content_length > MAX_BODY_BYTES:
            security_log("oversized_json_request", limit=MAX_BODY_BYTES, size=content_length, path=request_path, clientIp=self.client_ip());
            raise ValueError("Request is too large.");

        try:
            body = self.rfile.read(content_length).decode("utf-8");
            payload = json.loads(body);
        except UnicodeDecodeError as error:
            security_log("invalid_json_request", reason="utf8", path=request_path, clientIp=self.client_ip());
            raise ValueError("Request body must be UTF-8 JSON.") from error;
        if not isinstance(payload, dict):
            security_log("invalid_json_request", reason="non_object", path=request_path, clientIp=self.client_ip());
            raise ValueError("Request body must be a JSON object.");
        return payload;

    def require_same_origin(self):
        """
        Reject browser mutations submitted by a different origin.
        """;

        origin = self.headers.get("Origin");
        if not origin:
            if is_production():
                security_log("origin_rejected", reason="missing", host=self.headers.get("Host"), clientIp=self.client_ip());
                raise PermissionError("Origin is required for state-changing requests.");
            return;

        parsed = urlparse(origin);
        if parsed.netloc != self.headers.get("Host", "") or parsed.scheme not in {"http", "https"}:
            security_log("origin_rejected", reason="mismatch", origin=origin, host=self.headers.get("Host"), clientIp=self.client_ip());
            raise PermissionError("Cross-origin requests are not allowed.");

    def send_security_headers(self):
        """
        Attach basic security headers to every HTTP response.
        """;

        self.send_header("X-Content-Type-Options", "nosniff");
        self.send_header("X-Frame-Options", "SAMEORIGIN");
        self.send_header("Referrer-Policy", "no-referrer");
        self.send_header("Cross-Origin-Resource-Policy", "same-origin");
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'",
        );
        if hasattr(self, "new_session_cookie"):
            cookie = f"{SESSION_COOKIE_NAME}={self.new_session_cookie}; Path=/; HttpOnly; SameSite=Strict";
            if is_production():
                cookie += "; Secure";
            self.send_header("Set-Cookie", cookie);

    def send_json(self, status, payload):
        """
        Send a JSON response with the given HTTP status code.
        """;

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
        """;

        self.send_json(status, {"error": message});

    def cancel_search(self, session_id, job_id):
        """
        Signal the shared solver to stop the current search.
        """;

        if not require_owned_active_job(session_id, job_id):
            security_log("cancel_rejected", reason="job_not_owned", clientIp=self.client_ip());
            self.send_api_error(404, "Active solve job not found.");
            return;
        SearchProblem.stop = True;
        SearchProblem.cancelled = True;
        SearchProblem.stop_reason = "cancelled";
        self.send_json(200, {"cancelled": True});

    def send_presets(self):
        """
        Return all bundled preset boards as JSON.
        """;

        presets = [];
        for number in range(1, 41):
            presets.append({
                "number": number,
                "vehicles": state_to_vehicles(get_puzzle(number, folder=str(BOARDS_ROOT))),
            });
        self.send_json(200, {"presets": presets});

    def serve_static(self, path):
        """
        Serve a Vite build file without allowing path traversal.
        """;

        relative_path = "index.html" if path == "/" else unquote(path).lstrip("/");
        requested = (FRONTEND_ROOT / relative_path).resolve();

        # block path traversal outside the frontend root
        if FRONTEND_ROOT not in requested.parents and requested != FRONTEND_ROOT:
            self.send_error(403);
            return;
        if not requested.is_file():
            if relative_path.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".js", ".css", ".map")):
                self.send_error(404);
                return;
            requested = FRONTEND_ROOT / "index.html";
        if not requested.is_file():
            self.send_error(404, "Frontend is not built. Run ./build build.");
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
        """;

        path = urlparse(self.path).path;
        if path == "/api/presets":
            self.session_id();
            self.send_presets();
            return;
        if path.startswith("/api/"):
            self.send_api_error(404, "API endpoint not found.");
            return;
        self.serve_static(path);

    def do_POST(self):
        """
        Handle solve and cancel POST requests.
        """;

        try:
            self.require_same_origin();
            session_id = self.session_id();
            path = urlparse(self.path).path;
            if path == "/api/cancel":
                check_rate_limit("cancel", session_id, self.client_ip());
                payload = self.read_json_body();
                self.cancel_search(session_id, validate_job_id(payload.get("jobId")));
                return;
            if path != "/api/solve":
                self.send_api_error(404, "API endpoint not found.");
                return;

            check_rate_limit("solve", session_id, self.client_ip());
            payload = self.read_json_body();
            job_id = validate_job_id(payload.get("jobId"));
            vehicles = validate_vehicles(payload.get("vehicles"));
            register_active_job(session_id, job_id);
            try:
                result = solve_puzzle(
                    vehicles,
                    str(payload.get("algorithm", "bestFS")),
                    str(payload.get("heuristic", "h2")),
                );
            finally:
                finish_active_job(session_id, job_id);
            self.send_json(200, result);
        except BrokenPipeError:
            return;
        except PermissionError as error:
            self.send_api_error(403, str(error));
        except (ValueError, json.JSONDecodeError) as error:
            self.send_api_error(400, str(error));
        except RuntimeError as error:
            self.send_api_error(429, str(error));
        except Exception as error:
            print(f"Solver failed: {error}");
            self.send_api_error(500, "Solver failed.");

    def do_PUT(self):
        """
        Reject unsupported PUT requests.
        """;

        self.send_api_error(405, "Method not allowed.");

    def do_DELETE(self):
        """
        Reject unsupported DELETE requests.
        """;

        self.send_api_error(405, "Method not allowed.");

    def log_message(self, format_string, *args):
        """
        Print request log lines to stdout.
        """;

        print(f"{self.address_string()} - {format_string % args}");


def main():
    """
    Parse CLI arguments and start the local web server.
    """;

    parser = argparse.ArgumentParser(description="Run the Rush Hour puzzle web app.");
    parser.add_argument("--host", default="127.0.0.1");
    parser.add_argument("--port", type=int, default=8000);
    args = parser.parse_args();

    validate_production_security();
    validate_bind_safety(args.host);
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
