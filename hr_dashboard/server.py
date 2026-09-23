"""Standalone HR dashboard server. It does not change the employee app."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from app.data_loader import load_dataset
from app.service import CareerQuestService

ROOT = Path(__file__).parents[1]
STATIC = Path(__file__).parent


def build_handler(service: CareerQuestService):
    employee_api = os.getenv("CAREER_QUEST_EMPLOYEE_API", "http://127.0.0.1:8000")

    def dashboard_payload() -> dict:
        request = urllib.request.Request(f"{employee_api.rstrip('/')}/api/hr/overview")
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read())

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, payload: object, status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def send_file(self, path: Path, content_type: str) -> None:
            try:
                body = path.read_bytes()
            except FileNotFoundError:
                self.send_json({"error": "Not found"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/hr/overview":
                try:
                    self.send_json(dashboard_payload())
                except (urllib.error.URLError, TimeoutError) as exc:
                    self.send_json({"error": f"Employee server unavailable: {exc}"}, 502)
            elif path in {"/", "/index.html"}:
                self.send_file(STATIC / "index.html", "text/html; charset=utf-8")
            elif path == "/styles.css":
                self.send_file(STATIC / "styles.css", "text/css; charset=utf-8")
            elif path == "/app.js":
                self.send_file(STATIC / "app.js", "text/javascript; charset=utf-8")
            else:
                self.send_json({"error": "Not found"}, 404)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def log_message(self, fmt: str, *args: object) -> None:
            print(f"[career-quest-hr] {fmt % args}")

    return Handler


def run(host: str = "127.0.0.1", port: int = 8010) -> None:
    dataset = load_dataset(ROOT / "data" / "career_quest_dataset")
    server = ThreadingHTTPServer((host, port), build_handler(CareerQuestService(dataset)))
    print(f"Career Quest HR dashboard is running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Career Quest HR dashboard")
    finally:
        server.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run the separate Career Quest HR dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()
    run(args.host, args.port)
