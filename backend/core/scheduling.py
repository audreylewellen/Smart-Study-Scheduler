from datetime import date, timedelta
from collections import defaultdict

class UserPreferences:
    def __init__(self, study_days: list[int], intensity: str):
        """
        study_days: list of weekday ints (0=Monday, 6=Sunday)
        intensity: 'light' or 'medium' or 'hard'
        """
        self.study_days = study_days
        self.intensity = intensity

class Scheduler:
    def __init__(self, user_id: str, preferences: UserPreferences):
        self.user_id = user_id
        self.preferences = preferences
        intensity_mapping = {
            "light": 10,
            "medium": 45,
            "hard": 90,
        }
        self.study_minutes_per_day = intensity_mapping[preferences.intensity]

    def schedule_learn_tasks(self, chunk_ids: list[str], start_date: date | None = None):
        """
        Distributes chunks across available study days, starting from start_date (default today).
        Returns a list of scheduled tasks (dicts) with chunk, date, and task_type.
        """
        if not start_date:
            start_date = date.today()

        estimated_minutes_per_chunk = 5
        daily_limit = self.study_minutes_per_day
        schedule = []
        day_pointer = 0
        buffer = defaultdict(list)

        for chunk_id in chunk_ids:
            # Find next available day that matches study_days and has time
            while True:
                target_day = start_date + timedelta(days=day_pointer)
                weekday = target_day.weekday()
                used = len(buffer[target_day]) * estimated_minutes_per_chunk

                if weekday in self.preferences.study_days and used + estimated_minutes_per_chunk <= daily_limit:
                    task = {
                        "user_id": self.user_id,
                        "chunk_id": chunk_id,
                        "date": target_day,
                        "task_type": "learn",
                    }
                    buffer[target_day].append(task)
                    break
                else:
                    day_pointer += 1

        # Flatten into list
        for day in sorted(buffer.keys()):
            schedule.extend(buffer[day])

        return schedule