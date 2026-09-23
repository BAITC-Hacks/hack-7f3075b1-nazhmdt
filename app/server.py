"""Dependency-free local web server for the Career Quest MVP."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .data_loader import DatasetError, load_dataset
from .service import CareerQuestService


ROOT = Path(__file__).parents[1]
DATASET_PATH = ROOT / "data" / "career_quest_dataset"
STATIC_PATH = Path(__file__).parent / "static"


def build_handler(service: CareerQuestService):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, payload: object, status: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_file(self, path: Path, content_type: str) -> None:
            try:
                body = path.read_bytes()
            except FileNotFoundError:
                self._send_json({"error": "Not found"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            parts = [part for part in parsed.path.split("/") if part]
            try:
                if parsed.path == "/api/employees":
                    self._send_json({"employees": service.list_employees()})
                elif parsed.path == "/api/hr/overview":
                    self._send_json(service.hr_overview())
                elif len(parts) == 3 and parts[:2] == ["api", "employees"]:
                    self._send_json(service.trajectory_view(parts[2]))
                elif parsed.path in ("/", "/index.html"):
                    self._send_file(STATIC_PATH / "index.html", "text/html; charset=utf-8")
                elif parsed.path == "/styles.css":
                    self._send_file(STATIC_PATH / "styles.css", "text/css; charset=utf-8")
                elif parsed.path == "/app.js":
                    self._send_file(STATIC_PATH / "app.js", "text/javascript; charset=utf-8")
                else:
                    self._send_json({"error": "Not found"}, 404)
            except KeyError:
                self._send_json({"error": "Employee not found"}, 404)
            except Exception as exc:  # Keep errors visible to the browser during the hackathon.
                self._send_json({"error": str(exc)}, 500)

        def do_POST(self) -> None:  # noqa: N802
            parts = [part for part in urlparse(self.path).path.split("/") if part]
            if len(parts) != 5 or parts[:2] != ["api", "employees"] or parts[3] != "activities" or parts[4] != "complete":
                self._send_json({"error": "Not found"}, 404)
                return
            try:
                self._send_json(service.complete_activity(parts[2], self._event_id_from_body()))
            except (KeyError, ValueError) as exc:
                self._send_json({"error": str(exc)}, 400)

        def _event_id_from_body(self) -> str:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            event_id = body.get("event_id")
            if not event_id:
                raise ValueError("event_id is required")
            return event_id

        def log_message(self, format: str, *args: object) -> None:
            print(f"[career-quest] {format % args}")

    return Handler


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    try:
        dataset = load_dataset(DATASET_PATH)
    except DatasetError as exc:
        raise SystemExit(f"Dataset error: {exc}") from exc
    service = CareerQuestService(dataset)
    server = ThreadingHTTPServer((host, port), build_handler(service))
    print(f"Career Quest is running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Career Quest")
    finally:
        server.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run the Career Quest MVP locally")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    run(args.host, args.port)
