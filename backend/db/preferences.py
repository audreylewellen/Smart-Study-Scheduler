from backend.db.database import supabase

def get_user_preferences(user_id: str):
    try:
        result = supabase.table("user_preferences").select("study_days, intensity").eq("user_id", user_id).single().execute()
        if hasattr(result, "data") and result.data:
            return result.data
        return None
    except Exception as e:
        print(f"Error fetching user preferences: {e}")
        return None

def set_user_preferences(user_id: str, study_days: list, intensity: str):
    try:
        supabase.table("user_preferences").upsert({
            "user_id": user_id,
            "study_days": study_days,
            "intensity": intensity
        }).execute()
        return True
    except Exception as e:
        print(f"Error setting user preferences: {e}")
        return False 