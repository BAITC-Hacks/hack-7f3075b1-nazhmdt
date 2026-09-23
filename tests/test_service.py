import unittest
from pathlib import Path

from app.data_loader import load_dataset
from app.service import CareerQuestService


DATASET = Path(__file__).parents[1] / "data" / "career_quest_dataset"


class CareerQuestServiceTests(unittest.TestCase):
    def setUp(self):
        self.service = CareerQuestService(load_dataset(DATASET))

    def test_trajectory_view_contains_profile_gaps_and_recommendations(self):
        view = self.service.trajectory_view("E0002")
        self.assertEqual(view["employee"]["employee_id"], "E0002")
        self.assertEqual(view["trajectory"]["target_grade"], "Senior")
        self.assertTrue(view["gaps"])
        self.assertTrue(view["recommendations"])

    def test_completion_updates_skill_and_history(self):
        before = self.service.trajectory_view("E0002")
        updated = self.service.complete_activity("E0002", "EV_005")
        before_system = next(item for item in before["gaps"] if item["skill_id"] == "SK_SYSTEM_DESIGN")
        after_system = next((item for item in updated["gaps"] if item["skill_id"] == "SK_SYSTEM_DESIGN"), None)
        self.assertEqual(before_system["current_level"], 1)
        self.assertTrue(after_system is None or after_system["current_level"] == 2)
        self.assertTrue(any(row["event_id"] == "EV_005" and row["status"] == "completed" for row in updated["history"]))


if __name__ == "__main__":
    unittest.main()
