"""Print a small reproducible demo of the recommendation engine."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.data_loader import load_dataset
from app.recommendations import recommend


def main() -> None:
    root = Path(__file__).parents[1]
    dataset = load_dataset(root / "data" / "career_quest_dataset")
    for employee_id in ("E0002", "E0028", "E0001"):
        trajectory = recommend(dataset, employee_id)
        employee = dataset.employees_by_id[employee_id]
        print(f"{employee_id}: {employee['full_name']} — {trajectory.target_role} {trajectory.target_grade}")
        print("  gaps:", ", ".join(f"{gap.skill_name} {gap.current_level}/{gap.required_level}" for gap in trajectory.gaps[:5]))
        for item in trajectory.recommendations:
            print(f"  → {item.event_id} {item.title} ({item.score:.3f}): {', '.join(item.reasons)}")
        print()


if __name__ == "__main__":
    main()
