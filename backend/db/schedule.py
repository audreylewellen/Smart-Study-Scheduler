"""
schedule.py 

DB logic for task schedules. 
"""

import uuid 
from backend.db.database import supabase 

def store_schedule(schedule: list[dict], user_id: str):
    """
    Stores a study schedule in the database.
    
    Args:
        schedule: List of scheduled tasks (dicts with chunk_id, date, task_type)
        user_id: User identifier

    """
    try:
        data = []
        for task in schedule:
            task_data = {
                "user_id": user_id,
                "chunk_id": task["chunk_id"],
                "scheduled_date": task["date"].isoformat(),
                "task_type": task["task_type"],
                "completed": False
            }
            data.append(task_data)
        
        # Store in database
        supabase.from_("tasks").upsert(data).execute()
        
    except Exception as e:
        print(f"Error storing schedule: {e}")
        raise