"""Create a self-contained browser demo for simple static hosting."""

from pathlib import Path
import json
import re

ROOT = Path(__file__).parents[1]
DIST = ROOT / "dist"
OUTPUT = ROOT / "career-quest-standalone.html"


def main() -> None:
    html = (DIST / "index.html").read_text(encoding="utf-8")
    css = (DIST / "styles.css").read_text(encoding="utf-8")
    js = (DIST / "app.js").read_text(encoding="utf-8")
    data = json.dumps(json.loads((DIST / "data.json").read_text(encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/")
    html = re.sub(r'<link rel="stylesheet"[^>]+>', f"<style>\n{css}\n</style>", html, count=1)
    html = re.sub(r'<script src="/app\.js[^>]*></script>', f'<script>window.__CAREER_QUEST_DATA__ = {data};</script>\n<script>\n{js}\n</script>', html, count=1)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Created {OUTPUT}")


if __name__ == "__main__":
    main()
