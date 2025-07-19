from backend.db.database import supabase
from typing import List, Dict, Optional
import uuid
from datetime import datetime

def get_user_classes(user_id: str) -> List[Dict]:
    """
    Get all classes for a specific user.
    """
    try:
        result = supabase.table("classes").select("*").eq("user_id", user_id).execute()
        if hasattr(result, "data"):
            return result.data
        return []
    except Exception as e:
        print(f"Error fetching classes: {e}")
        return []

def get_class_by_id(class_id: str, user_id: str) -> Optional[Dict]:
    """
    Get a specific class by ID, ensuring it belongs to the user.
    """
    try:
        result = supabase.table("classes").select("*").eq("id", class_id).eq("user_id", user_id).execute()
        if hasattr(result, "data") and result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error fetching class: {e}")
        return None

def create_class(user_id: str, name: str) -> Optional[Dict]:
    """
    Create a new class for a user.
    """
    try:
        class_data = {
            "id": str(uuid.uuid4()),
            "name": name,
            "user_id": user_id
        }
        result = supabase.table("classes").insert(class_data).execute()
        if hasattr(result, "data") and result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error creating class: {e}")
        return None

def delete_class(class_id: str, user_id: str) -> bool:
    """
    Delete a class, ensuring it belongs to the user.
    """
    try:
        supabase.table("classes").delete().eq("id", class_id).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting class: {e}")
        return False 