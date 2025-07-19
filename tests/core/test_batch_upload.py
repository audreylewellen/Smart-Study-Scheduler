import pytest
from unittest.mock import Mock, patch, MagicMock
from backend.core.scheduling import UserPreferences, Scheduler
from datetime import date
import json

def test_user_preferences():
    """Test UserPreferences class initialization"""
    preferences = UserPreferences(study_days=[0, 1, 2], intensity="medium")
    assert preferences.study_days == [0, 1, 2]
    assert preferences.intensity == "medium"

def test_scheduler_initialization():
    """Test Scheduler class initialization"""
    preferences = UserPreferences(study_days=[0, 1, 2], intensity="medium")
    scheduler = Scheduler(user_id="test_user", preferences=preferences)
    assert scheduler.user_id == "test_user"
    assert scheduler.study_minutes_per_day == 45  # medium intensity

def test_schedule_learn_tasks():
    """Test scheduling functionality"""
    preferences = UserPreferences(study_days=[0, 1, 2], intensity="light")
    scheduler = Scheduler(user_id="test_user", preferences=preferences)
    
    # Test with some chunk IDs
    chunk_ids = ["chunk1", "chunk2", "chunk3"]
    start_date = date(2024, 1, 1)  # Monday
    
    schedule = scheduler.schedule_learn_tasks(chunk_ids, start_date=start_date)
    
    assert len(schedule) == 3
    assert all(task["user_id"] == "test_user" for task in schedule)
    assert all(task["task_type"] == "learn" for task in schedule)
    assert all(task["estimated_minutes"] == 5 for task in schedule)
    assert all(task["chunk_id"] in chunk_ids for task in schedule)

def test_schedule_with_different_intensities():
    """Test that different intensities result in different daily limits"""
    light_prefs = UserPreferences(study_days=[0, 1, 2], intensity="light")
    medium_prefs = UserPreferences(study_days=[0, 1, 2], intensity="medium")
    hard_prefs = UserPreferences(study_days=[0, 1, 2], intensity="hard")
    
    light_scheduler = Scheduler(user_id="test_user", preferences=light_prefs)
    medium_scheduler = Scheduler(user_id="test_user", preferences=medium_prefs)
    hard_scheduler = Scheduler(user_id="test_user", preferences=hard_prefs)
    
    assert light_scheduler.study_minutes_per_day == 20
    assert medium_scheduler.study_minutes_per_day == 45
    assert hard_scheduler.study_minutes_per_day == 90

def test_schedule_respects_study_days():
    """Test that scheduling only occurs on specified study days"""
    # Only study on Monday (0) and Wednesday (2)
    preferences = UserPreferences(study_days=[0, 2], intensity="light")
    scheduler = Scheduler(user_id="test_user", preferences=preferences)
    
    chunk_ids = ["chunk1", "chunk2", "chunk3", "chunk4"]
    start_date = date(2024, 1, 1)  # Monday
    
    schedule = scheduler.schedule_learn_tasks(chunk_ids, start_date=start_date)
    
    # Should schedule on Monday and Wednesday only
    scheduled_dates = [task["date"] for task in schedule]
    weekdays = [date.weekday() for date in scheduled_dates]
    
    assert all(weekday in [0, 2] for weekday in weekdays) 