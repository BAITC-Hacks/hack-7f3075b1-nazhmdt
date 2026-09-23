"""Load and validate the Career Quest JSON/CSV dataset."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class DatasetError(ValueError):
    """Raised when the input dataset is missing or internally inconsistent."""


@dataclass(frozen=True)
class Dataset:
    employees: list[dict[str, Any]]
    events: list[dict[str, Any]]
    skills: list[dict[str, Any]]
    role_profiles: list[dict[str, Any]]
    activity_history: list[dict[str, Any]]
    as_of_date: str

    @property
    def employees_by_id(self) -> dict[str, dict[str, Any]]:
        return {item["employee_id"]: item for item in self.employees}

    @property
    def events_by_id(self) -> dict[str, dict[str, Any]]:
        return {item["event_id"]: item for item in self.events}

    @property
    def role_profiles_by_key(self) -> dict[tuple[str, str], dict[str, Any]]:
        return {(item["role"], item["grade"]): item for item in self.role_profiles}

    @property
    def history_by_employee(self) -> dict[str, list[dict[str, Any]]]:
        result: dict[str, list[dict[str, Any]]] = {}
        for row in self.activity_history:
            result.setdefault(row["employee_id"], []).append(row)
        return result


def _read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DatasetError(f"Missing dataset file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DatasetError(f"Invalid JSON in {path}: {exc}") from exc


def _read_history(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open(newline="", encoding="utf-8") as stream:
            return list(csv.DictReader(stream))
    except FileNotFoundError as exc:
        raise DatasetError(f"Missing dataset file: {path}") from exc


def _require_unique(items: list[dict[str, Any]], key: str, source: str) -> None:
    values = [item.get(key) for item in items]
    if None in values or len(set(values)) != len(values):
        raise DatasetError(f"{source} must contain unique non-empty {key} values")


def load_dataset(directory: str | Path) -> Dataset:
    """Load the official dataset format and validate all cross-file references."""

    root = Path(directory)
    employees_doc = _read_json(root / "employees.json")
    events_doc = _read_json(root / "events.json")
    skills_doc = _read_json(root / "skills.json")
    employees = employees_doc.get("employees", [])
    events = events_doc.get("events", [])
    skills = skills_doc.get("skills", [])
    role_profiles = skills_doc.get("role_profiles", [])
    history = _read_history(root / "activity_history.csv")

    if not employees or not events or not skills or not role_profiles:
        raise DatasetError("Dataset contains an empty required collection")
    _require_unique(employees, "employee_id", "employees.json")
    _require_unique(events, "event_id", "events.json")
    _require_unique(skills, "skill_id", "skills.json")
    if len({(p.get("role"), p.get("grade")) for p in role_profiles}) != len(role_profiles):
        raise DatasetError("role_profiles must contain unique role/grade pairs")

    employee_ids = {item["employee_id"] for item in employees}
    event_ids = {item["event_id"] for item in events}
    skill_ids = {item["skill_id"] for item in skills}
    profile_keys = {(item["role"], item["grade"]) for item in role_profiles}

    for employee in employees:
        if (employee.get("role"), employee.get("grade")) not in profile_keys:
            raise DatasetError(f"No role profile for {employee['employee_id']}")
        if employee.get("manager_id") and employee["manager_id"] not in employee_ids:
            raise DatasetError(f"Unknown manager for {employee['employee_id']}")
        unknown = set(employee.get("skills", {})) - skill_ids
        if unknown:
            raise DatasetError(f"Unknown employee skills for {employee['employee_id']}: {sorted(unknown)}")

    for event in events:
        for item in event.get("develops_skills", []):
            if item.get("skill_id") not in skill_ids:
                raise DatasetError(f"Unknown event skill in {event['event_id']}")
        if set(event.get("prerequisites", {})) - skill_ids:
            raise DatasetError(f"Unknown event prerequisite in {event['event_id']}")

    for profile in role_profiles:
        unknown = set(profile.get("required_skills", {})) - skill_ids
        unknown.update(set(profile.get("critical_skills", [])) - skill_ids)
        if unknown:
            raise DatasetError(f"Unknown role profile skills for {profile['role']} {profile['grade']}")

    for row in history:
        if row.get("employee_id") not in employee_ids or row.get("event_id") not in event_ids:
            raise DatasetError(f"Unknown history reference in {row.get('record_id')}")

    return Dataset(
        employees=employees,
        events=events,
        skills=skills,
        role_profiles=role_profiles,
        activity_history=history,
        as_of_date=employees_doc.get("meta", {}).get("as_of_date", ""),
    )
