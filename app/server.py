"""Dependency-free local web server for the Career Quest MVP."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
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
            parsed_path = urlparse(self.path).path
            if parsed_path == "/api/coach":
                self._coach_response()
                return
            parts = [part for part in parsed_path.split("/") if part]
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

        def _read_json_body(self) -> dict:
            length = int(self.headers.get("Content-Length", "0"))
            return json.loads(self.rfile.read(length) or b"{}")

        def _coach_response(self) -> None:
            body = self._read_json_body()
            question = str(body.get("question", "")).strip()
            language = body.get("language", "ru")
            if not question:
                self._send_json({"error": "question is required"}, 400)
                return
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                self._send_json({"error": "OPENAI_API_KEY is not configured"}, 503)
                return
            language_name = {"ru": "Russian", "kk": "Kazakh", "en": "English"}.get(language, "Russian")
            employee = body.get("employee") or {}
            trajectory = body.get("trajectory") or {}
            system = (
                "You are an action-oriented AI development agent inside Career Quest for Halyk Bank. "
                f"Answer in {language_name}. Do not sound like a FAQ bot: first interpret the employee's intent, "
                "use the supplied profile and recommendations, explain why a step fits, then propose one concrete next action "
                "and finish with one short clarifying question. Keep the response under 120 words, use short paragraphs, "
                "and never expose private employee data or invent HR decisions. "
                f"Employee role: {employee.get('role', 'unknown')}; grade: {employee.get('grade', 'unknown')}; "
                f"target role: {trajectory.get('target_role', 'unknown')}. "
                f"Recommendations: {json.dumps(body.get('recommendations', []), ensure_ascii=False)}"
            )
            history = body.get("history") or []
            conversation = [{"role": "system", "content": system}]
            for item in history[-6:]:
                if item.get("role") in {"user", "assistant"} and item.get("content"):
                    conversation.append({"role": item["role"], "content": str(item["content"])[:1000]})
            conversation.append({"role": "user", "content": question})
            payload = json.dumps({"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "input": conversation, "max_output_tokens": 240}).encode("utf-8")
            request = urllib.request.Request("https://api.openai.com/v1/responses", data=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    result = json.loads(response.read())
                answer = result.get("output_text") or "Не удалось получить ответ помощника."
                self._send_json({"answer": answer})
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                self._send_json({"error": f"Coach unavailable: {exc}"}, 502)

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
