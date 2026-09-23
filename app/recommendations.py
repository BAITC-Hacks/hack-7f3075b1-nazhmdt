"""Explainable career-gap and activity recommendation engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .data_loader import Dataset


GRADE_ORDER = ["Junior", "Middle", "Senior", "Lead"]
SUCCESS_STATUSES = {"completed"}
FAILED_STATUSES = {"no_show", "dropped", "declined", "overdue"}


@dataclass(frozen=True)
class SkillGap:
    skill_id: str
    skill_name: str
    current_level: int
    required_level: int
    gap: int
    critical: bool


@dataclass(frozen=True)
class Recommendation:
    event_id: str
    title: str
    score: float
    covered_skills: tuple[str, ...]
    critical_skills: tuple[str, ...]
    reasons: tuple[str, ...]
    history_signal: str


@dataclass(frozen=True)
class Trajectory:
    employee_id: str
    target_role: str
    target_grade: str
    target_source: str
    gaps: tuple[SkillGap, ...]
    recommendations: tuple[Recommendation, ...]


def _skill_names(dataset: Dataset) -> dict[str, str]:
    return {item["skill_id"]: item["name"] for item in dataset.skills}


def resolve_target(employee: dict[str, Any]) -> tuple[str, str, str]:
    goal = employee.get("career_goal")
    if goal:
        return goal["target_role"], goal["target_grade"], "career_goal"
    grade = employee.get("grade")
    try:
        next_grade = GRADE_ORDER[GRADE_ORDER.index(grade) + 1]
    except (ValueError, IndexError):
        return employee["role"], grade, "current_grade_support_plan"
    return employee["role"], next_grade, "next_grade_default"


def calculate_gaps(dataset: Dataset, employee: dict[str, Any]) -> tuple[SkillGap, ...]:
    target_role, target_grade, _ = resolve_target(employee)
    profile = dataset.role_profiles_by_key[(target_role, target_grade)]
    names = _skill_names(dataset)
    current = employee.get("skills", {})
    gaps = []
    for skill_id, required in profile["required_skills"].items():
        level = int(current.get(skill_id, 0))
        gap = max(int(required) - level, 0)
        if gap:
            gaps.append(SkillGap(skill_id, names.get(skill_id, skill_id), level, int(required), gap, skill_id in profile["critical_skills"]))
    return tuple(sorted(gaps, key=lambda item: (-item.critical, -item.gap, item.skill_name)))


def _history(dataset: Dataset, employee_id: str) -> list[dict[str, Any]]:
    return dataset.history_by_employee.get(employee_id, [])


def _candidate_score(event: dict[str, Any], gaps: tuple[SkillGap, ...], history: list[dict[str, Any]], employee: dict[str, Any]) -> tuple[float, tuple[str, ...], str]:
    by_skill = {gap.skill_id: gap for gap in gaps}
    develops = [item for item in event.get("develops_skills", []) if item["skill_id"] in by_skill]
    covered = tuple(item["skill_id"] for item in develops)
    critical = tuple(item["skill_id"] for item in develops if by_skill[item["skill_id"]].critical)
    gap_total = sum(gap.gap for gap in gaps) or 1
    covered_levels = sum(min(int(item.get("gain", 0)), by_skill[item["skill_id"]].gap) for item in develops)
    gap_coverage = min(covered_levels / gap_total, 1.0)
    critical_total = sum(gap.gap for gap in gaps if gap.critical) or 1
    critical_levels = sum(min(int(item.get("gain", 0)), by_skill[item["skill_id"]].gap) for item in develops if by_skill[item["skill_id"]].critical)
    critical_coverage = min(critical_levels / critical_total, 1.0)
    goal_alignment = 1.0 if employee.get("role") in event.get("target_roles", []) else 0.0
    event_rows = [row for row in history if row["event_id"] == event["event_id"]]
    failed = sum(row["status"] in FAILED_STATUSES for row in event_rows)
    completed = sum(row["status"] in SUCCESS_STATUSES for row in event_rows)
    history_fit = max(0.2, 1.0 - 0.2 * failed + 0.1 * min(completed, 2))
    feasibility = 1.0 if not event.get("upcoming_sessions") or event.get("upcoming_sessions") else 0.8
    score = 0.45 * gap_coverage + 0.25 * critical_coverage + 0.15 * goal_alignment + 0.10 * history_fit + 0.05 * feasibility
    if failed:
        history_signal = f"previous_attempts_failed={failed}"
    elif completed:
        history_signal = f"previous_attempts_completed={completed}"
    else:
        history_signal = "no_previous_attempt"
    return score, covered, history_signal


def recommend(dataset: Dataset, employee_id: str, limit: int = 3) -> Trajectory:
    employee = dataset.employees_by_id[employee_id]
    target_role, target_grade, target_source = resolve_target(employee)
    gaps = calculate_gaps(dataset, employee)
    gap_by_skill = {gap.skill_id: gap for gap in gaps}
    history = _history(dataset, employee_id)
    completed_ids = {row["event_id"] for row in history if row["status"] == "completed"}
    recommendations: list[Recommendation] = []
    for event in dataset.events:
        # Mandatory HR/compliance activities are assignments, not recommendations.
        if event.get("mandatory"):
            continue
        if employee["role"] not in event.get("target_roles", []) or employee["grade"] not in event.get("target_grades", []):
            continue
        if event["event_id"] != "EV_036" and event["event_id"] in completed_ids:
            continue
        if any(employee.get("skills", {}).get(skill_id, 0) < required for skill_id, required in event.get("prerequisites", {}).items()):
            continue
        if not any(item["skill_id"] in gap_by_skill for item in event.get("develops_skills", [])):
            continue
        score, covered, history_signal = _candidate_score(event, gaps, history, employee)
        critical = tuple(skill_id for skill_id in covered if gap_by_skill[skill_id].critical)
        reasons = tuple(
            f"{gap_by_skill[skill_id].skill_name}: {gap_by_skill[skill_id].current_level}/{gap_by_skill[skill_id].required_level}"
            for skill_id in covered
        )
        recommendations.append(Recommendation(event["event_id"], event["title"], round(score, 4), covered, critical, reasons, history_signal))
    recommendations.sort(key=lambda item: (-item.score, item.title))
    return Trajectory(employee_id, target_role, target_grade, target_source, gaps, tuple(recommendations[:limit]))
