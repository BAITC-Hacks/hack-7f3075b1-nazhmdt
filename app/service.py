"""Application state and JSON-ready views for the Career Quest MVP."""

from __future__ import annotations

from datetime import date
from typing import Any

from .data_loader import Dataset
from .recommendations import Trajectory, recommend


class CareerQuestService:
    def __init__(self, dataset: Dataset):
        self.dataset = dataset
        self._next_record = len(dataset.activity_history) + 1

    def list_employees(self) -> list[dict[str, Any]]:
        return [
            {
                "employee_id": employee["employee_id"],
                "full_name": employee["full_name"],
                "role": employee["role"],
                "grade": employee["grade"],
                "department": employee["department"],
            }
            for employee in self.dataset.employees
        ]

    def trajectory_view(self, employee_id: str) -> dict[str, Any]:
        employee = self.dataset.employees_by_id[employee_id]
        trajectory = recommend(self.dataset, employee_id)
        target_profile = self.dataset.role_profiles_by_key[(trajectory.target_role, trajectory.target_grade)]
        current = employee.get("skills", {})
        required = target_profile["required_skills"]
        total = sum(required.values()) or 1
        achieved = sum(min(int(current.get(skill_id, 0)), int(level)) for skill_id, level in required.items())
        history = self.dataset.history_by_employee.get(employee_id, [])
        return {
            "employee": {
                "employee_id": employee["employee_id"],
                "full_name": employee["full_name"],
                "department": employee["department"],
                "role": employee["role"],
                "grade": employee["grade"],
                "work_format": employee["work_format"],
                "tenure_months": employee["tenure_months"],
                "preferred_language": employee["preferred_language"],
                "career_goal": employee.get("career_goal"),
            },
            "trajectory": {
                "target_role": trajectory.target_role,
                "target_grade": trajectory.target_grade,
                "target_source": trajectory.target_source,
                "progress_pct": round(achieved / total * 100),
            },
            "gaps": [self._gap_json(item) for item in trajectory.gaps],
            "recommendations": [self._recommendation_json(item) for item in trajectory.recommendations],
            "history": [
                {
                    **row,
                    "event_title": self.dataset.events_by_id[row["event_id"]]["title"],
                }
                for row in sorted(history, key=lambda item: item["date"], reverse=True)[:8]
            ],
        }

    def complete_activity(self, employee_id: str, event_id: str) -> dict[str, Any]:
        employee = self.dataset.employees_by_id[employee_id]
        event = self.dataset.events_by_id[event_id]
        existing = [row for row in self.dataset.history_by_employee.get(employee_id, []) if row["event_id"] == event_id and row["status"] == "completed"]
        if existing and event_id != "EV_036":
            raise ValueError("This activity is already completed")
        for skill in event.get("develops_skills", []):
            skill_id = skill["skill_id"]
            current = int(employee.setdefault("skills", {}).get(skill_id, 0))
            employee["skills"][skill_id] = min(current + int(skill["gain"]), int(skill["max_level"]))
        self.dataset.activity_history.append(
            {
                "record_id": f"R{self._next_record:06d}",
                "employee_id": employee_id,
                "event_id": event_id,
                "date": self.dataset.as_of_date or date.today().isoformat(),
                "due_date": "",
                "status": "completed",
                "completion_pct": "100",
                "score": "",
                "feedback_rating": "",
                "assigned_by": "self",
            }
        )
        self._next_record += 1
        return self.trajectory_view(employee_id)

    @staticmethod
    def _gap_json(gap: Any) -> dict[str, Any]:
        return {
            "skill_id": gap.skill_id,
            "skill_name": gap.skill_name,
            "current_level": gap.current_level,
            "required_level": gap.required_level,
            "gap": gap.gap,
            "critical": gap.critical,
        }

    def _recommendation_json(self, item: Any) -> dict[str, Any]:
        event = self.dataset.events_by_id[item.event_id]
        names = {skill["skill_id"]: skill["name"] for skill in self.dataset.skills}
        return {
            "event_id": item.event_id,
            "title": item.title,
            "description": event["description"],
            "type": event["type"],
            "format": event["format"],
            "duration_hours": event["duration_hours"],
            "score": item.score,
            "covered_skills": [names.get(skill_id, skill_id) for skill_id in item.covered_skills],
            "critical_skills": [names.get(skill_id, skill_id) for skill_id in item.critical_skills],
            "reasons": list(item.reasons),
            "history_signal": item.history_signal,
        }
