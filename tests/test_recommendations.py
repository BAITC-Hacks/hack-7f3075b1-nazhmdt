import unittest
from pathlib import Path

from app.data_loader import load_dataset
from app.recommendations import calculate_gaps, recommend, resolve_target


DATASET = Path(__file__).parents[1] / "data" / "career_quest_dataset"


class CareerQuestEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = load_dataset(DATASET)

    def test_dataset_counts_and_references(self):
        self.assertEqual(len(self.dataset.employees), 200)
        self.assertEqual(len(self.dataset.events), 40)
        self.assertEqual(len(self.dataset.skills), 60)
        self.assertEqual(len(self.dataset.activity_history), 2743)

    def test_goal_and_default_target(self):
        employee = self.dataset.employees_by_id["E0002"]
        self.assertEqual(resolve_target(employee)[:2], ("Backend Engineer", "Senior"))
        no_goal = self.dataset.employees_by_id["E0028"]
        self.assertEqual(resolve_target(no_goal)[:2], ("Backend Engineer", "Senior"))

    def test_recommendations_use_multiple_gaps(self):
        trajectory = recommend(self.dataset, "E0002")
        self.assertGreaterEqual(len(trajectory.gaps), 2)
        self.assertGreater(len(trajectory.recommendations), 0)
        self.assertLessEqual(len(trajectory.recommendations), 3)
        self.assertTrue(any(item.critical_skills for item in trajectory.recommendations))
        for recommendation in trajectory.recommendations:
            self.assertTrue(recommendation.reasons)

    def test_completed_events_are_not_recommended_again(self):
        trajectory = recommend(self.dataset, "E0028")
        completed = {row["event_id"] for row in self.dataset.history_by_employee["E0028"] if row["status"] == "completed"}
        self.assertTrue(all(item.event_id not in completed or item.event_id == "EV_036" for item in trajectory.recommendations))

    def test_mandatory_events_are_not_recommendations(self):
        mandatory = {event["event_id"] for event in self.dataset.events if event["mandatory"]}
        for employee_id in ("E0001", "E0002", "E0028"):
            self.assertTrue(all(item.event_id not in mandatory for item in recommend(self.dataset, employee_id).recommendations))

    def test_missing_skill_is_zero(self):
        employee = dict(self.dataset.employees_by_id["E0028"])
        employee["skills"] = {}
        gaps = calculate_gaps(self.dataset, employee)
        self.assertTrue(gaps)
        self.assertTrue(all(item.current_level == 0 for item in gaps))


if __name__ == "__main__":
    unittest.main()
