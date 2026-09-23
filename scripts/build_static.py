"""Build the browser-only fallback used by the deployed demo."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.data_loader import load_dataset
from app.service import CareerQuestService

ROOT = Path(__file__).parents[1]
STATIC = ROOT / "app" / "static"
DIST = ROOT / "dist"


def main() -> None:
    dataset = load_dataset(ROOT / "data" / "career_quest_dataset")
    service = CareerQuestService(dataset)
    DIST.mkdir(exist_ok=True)
    for path in STATIC.iterdir():
        if path.is_file():
            shutil.copy2(path, DIST / path.name)
    profiles = {employee["employee_id"]: service.trajectory_view(employee["employee_id"]) for employee in dataset.employees}
    payload = {"employees": service.list_employees(), "profiles": profiles, "hr_overview": service.hr_overview()}
    (DIST / "data.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Built static demo in {DIST} ({len(profiles)} profiles)")


if __name__ == "__main__":
    main()
