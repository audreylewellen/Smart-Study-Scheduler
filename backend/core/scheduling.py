from datetime import date, timedelta
from collections import defaultdict
from typing import Any

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

    def schedule_tasks(self, chunk_ids: list[str], start_date: date | None = None):
        """
        For each chunk, schedule a 'learn', then a 'quiz', then a 'review' task, spaced over days.
        Returns a list of scheduled tasks (dicts) with chunk, date, and task_type.
        """
        if not start_date:
            start_date = date.today()

        estimated_minutes_per_chunk = 5
        daily_limit = self.study_minutes_per_day
        schedule = []
        day_pointer = 0
        buffer = defaultdict(list)
        task_sequence = ["learn"]
        spacing = 1  # days between each task type for a chunk

        for chunk_id in chunk_ids:
            for i, task_type in enumerate(task_sequence):
                while True:
                    target_day = start_date + timedelta(days=day_pointer)
                    weekday = target_day.weekday()
                    used = len(buffer[target_day]) * estimated_minutes_per_chunk
                    if weekday in self.preferences.study_days and used + estimated_minutes_per_chunk <= daily_limit:
                        task = {
                            "user_id": self.user_id,
                            "chunk_id": chunk_id,
                            "date": target_day,
                            "task_type": task_type,
                        }
                        buffer[target_day].append(task)
                        # Space out next task for this chunk
                        day_pointer += spacing
                        break
                    else:
                        day_pointer += 1

        # Flatten into list
        for day in sorted(buffer.keys()):
            schedule.extend(buffer[day])

        return schedule

def schedule_next_quiz(user_id: str, chunk_id: str, today: date | None = None) -> dict:
    """Schedule a quiz task for the next day after learn is completed."""
    if not today:
        today = date.today()
    return {
        "user_id": user_id,
        "chunk_id": chunk_id,
        "scheduled_date": (today + timedelta(days=1)).isoformat(),
        "task_type": "quiz",
        "completed": False
    }

def schedule_next_review(user_id: str, chunk_id: str, quiz_correct: bool, today: date | None = None) -> dict:
    """Schedule a review task after a quiz, with date depending on correctness."""
    if not today:
        today = date.today()
    interval = 3 if quiz_correct else 1
    return {
        "user_id": user_id,
        "chunk_id": chunk_id,
        "scheduled_date": (today + timedelta(days=interval)).isoformat(),
        "task_type": "review",
        "completed": False
    }

def schedule_followup_review(user_id: str, chunk_id: str, review_correct: bool, today: date | None = None) -> dict | None:
    """Schedule another review only if the last review was incorrect."""
    if not today:
        today = date.today()
    if not review_correct:
        return {
            "user_id": user_id,
            "chunk_id": chunk_id,
            "scheduled_date": (today + timedelta(days=1)).isoformat(),
            "task_type": "review",
            "completed": False
        }
    return None

def get_user_preferences_from_db(user_id: str, supabase) -> dict:
    result = supabase.table("user_preferences").select("study_days, intensity").eq("user_id", user_id).single().execute()
    if hasattr(result, "data") and result.data:
        return result.data
    return {"study_days": [1,2,3,4,5], "intensity": "medium"}

# Map intensity to minutes per day
INTENSITY_MAP = {"light": 10, "medium": 45, "hard": 90}

# Utility: Find next available slot for a user/chunk
# Returns the date (as a date object) for the next available slot
# and a list of tasks that need to be shifted

def find_next_available_slot(user_id: str, supabase, start_date: date, estimated_minutes: int = 5) -> date:
    prefs = get_user_preferences_from_db(user_id, supabase)
    study_days = prefs["study_days"]
    intensity = prefs["intensity"]
    daily_limit = INTENSITY_MAP.get(intensity, 45)
    day_pointer = 0
    while True:
        target_day = start_date + timedelta(days=day_pointer)
        weekday = target_day.weekday()
        if weekday not in study_days:
            day_pointer += 1
            continue
        # Count tasks already scheduled for this day
        result = supabase.table("tasks").select("id").eq("user_id", user_id).eq("scheduled_date", target_day.isoformat()).execute()
        num_tasks = len(result.data) if hasattr(result, "data") and result.data else 0
        used = num_tasks * estimated_minutes
        if used + estimated_minutes <= daily_limit:
            return target_day
        day_pointer += 1

# Utility: Shift all tasks scheduled after a given date forward by one day, respecting study days

def shift_tasks_forward(user_id: str, supabase, from_date: date):
    prefs = get_user_preferences_from_db(user_id, supabase)
    study_days = prefs["study_days"]
    # Get all tasks after from_date, ordered by date
    result = supabase.table("tasks").select("id, scheduled_date").eq("user_id", user_id).gt("scheduled_date", from_date.isoformat()).order("scheduled_date").execute()
    tasks = result.data if hasattr(result, "data") and result.data else []
    for task in tasks:
        old_date = date.fromisoformat(task["scheduled_date"])
        # Find next valid study day
        day_pointer = 1
        while True:
            new_date = old_date + timedelta(days=day_pointer)
            if new_date.weekday() in study_days:
                break
            day_pointer += 1
        supabase.table("tasks").update({"scheduled_date": new_date.isoformat()}).eq("id", task["id"]).execute()