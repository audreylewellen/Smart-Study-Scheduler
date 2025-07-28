"""
reviews.py

Database operations for review sessions and tracking review progress.
"""

from backend.db.database import supabase
from typing import List, Dict, Optional
from datetime import datetime

def get_todays_reviews(user_id: str, today: str) -> List[Dict]:
    """Get all review tasks scheduled for today (all types)"""
    try:
        result = supabase.table("tasks").select(
            "id, chunk_id, scheduled_date, task_type, completed"
        ).eq("user_id", user_id).eq("scheduled_date", today).execute()
        
        if hasattr(result, "data"):
            return result.data
        return []
    except Exception as e:
        print(f"Error fetching today's reviews: {e}")
        return []

def start_review_session(user_id: str, chunk_id: str) -> bool:
    """Mark a chunk as being reviewed (start of review session)"""
    try:
        # For now, just return True since we don't have a 'reviewing' column
        return True
    except Exception as e:
        print(f"Error starting review session: {e}")
        return False

def complete_review(user_id: str, chunk_id: str) -> bool:
    """Mark a review as completed"""
    try:
        result = supabase.table("tasks").update({
            "completed": True
        }).eq("user_id", user_id).eq("chunk_id", chunk_id).execute()
        
        return True
    except Exception as e:
        print(f"Error completing review: {e}")
        return False 