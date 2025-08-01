from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.core.embedding import embed_pdf
from backend.core.scheduling import (
    Scheduler, UserPreferences, schedule_next_quiz, schedule_next_review, schedule_followup_review,
    find_next_available_slot, shift_tasks_forward
)
import backend.db.chunks
import backend.db.schedule
import backend.db.classes
import backend.db.reviews
import uuid
from io import BytesIO
from typing import List, Optional
from datetime import datetime, date
import json 
from backend.db.database import supabase
from backend.db.auth import verify_supabase_jwt, login_user, signup_user, refresh_user_token
import os
import openai
from backend.db.preferences import get_user_preferences, set_user_preferences

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/login")
async def login(request: Request):
    return await login_user(request)

@app.post("/api/signup")
async def signup(request: Request):
    return await signup_user(request)

@app.get("/api/classes")
async def get_classes(user_id: str = Depends(verify_supabase_jwt)):
    classes = backend.db.classes.get_user_classes(user_id)
    return {"classes": classes}

@app.get("/api/classes/{class_id}")
async def get_class(class_id: str, user_id: str = Depends(verify_supabase_jwt)):
    class_info = backend.db.classes.get_class_by_id(class_id, user_id)
    if not class_info:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"class": class_info}

@app.post("/upload-pdf")
async def upload_pdf(
    class_id: str = Form(...),
    pdf: UploadFile = File(...),
    user_id: str = Depends(verify_supabase_jwt)
):
    try:
        # Store PDF file in bucket
        document_id = str(uuid.uuid4())
        pdf_bytes = await pdf.read()
        backend.db.chunks.store_file(user_id, class_id, document_id, pdf_bytes, pdf.filename)

        # Get PDF chunks and embeddings 
        chunks, embeddings = embed_pdf(BytesIO(pdf_bytes))

        # Store embeddings and get chunk IDs
        chunk_ids = backend.db.chunks.store_chunks(chunks, embeddings, user_id=user_id, document_id=document_id)
        return {"status": "ok", "chunks": len(chunks), "chunk_ids": chunk_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-batch")
async def upload_batch(
    class_id: str = Form(...),
    pdfs: List[UploadFile] = File(...),
    study_days: str = Form(...),  
    intensity: str = Form(...),   
    user_id: str = Depends(verify_supabase_jwt)
):
    """
    Upload multiple PDFs for a specified class, process them, and create a combined study schedule.
    """
    try:
        # Parse study days 
        study_days_list = json.loads(study_days)

        preferences = UserPreferences(study_days=study_days_list, intensity=intensity)
        scheduler = Scheduler(user_id=user_id, preferences=preferences)
        all_chunk_ids = []
        
        # Process each PDF
        for pdf in pdfs:
            # Store PDF file in bucket
            document_id = str(uuid.uuid4())
            pdf_bytes = await pdf.read()
            backend.db.chunks.store_file(user_id, class_id, document_id, pdf_bytes, pdf.filename)

            # Get PDF chunks and embeddings 
            chunks, embeddings = embed_pdf(BytesIO(pdf_bytes))

            # Store embeddings and get chunk IDs
            chunk_ids = backend.db.chunks.store_chunks(chunks, embeddings, user_id=user_id, document_id=document_id)
            all_chunk_ids.extend(chunk_ids)
        
        print("DEBUG: About to create schedule")
        # Create schedule for all chunks combined (learn, quiz, review)
        schedule = scheduler.schedule_tasks(all_chunk_ids)
        
        # Store schedule in database
        backend.db.schedule.store_schedule(schedule, user_id)
        
        return {
            "status": "ok", 
            "total_chunks": len(all_chunk_ids),
            "total_pdfs": len(pdfs)
        }
        
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reviews/today")
async def get_todays_reviews(user_id: str = Depends(verify_supabase_jwt)):
    """Get today's review tasks for the user"""
    today = date.today().isoformat()
    reviews = backend.db.reviews.get_todays_reviews(user_id, today)
    return {"reviews": reviews}

@app.post("/api/reviews/start")
async def start_review_session(request: Request, user_id: str = Depends(verify_supabase_jwt)):
    data = await request.json()
    chunk_id = data.get("chunk_id")
    task_type = data.get("type")
    if not chunk_id:
        raise HTTPException(status_code=400, detail="chunk_id is required.")
    from backend.db.database import supabase
    chunk_result = supabase.table("document_chunks").select("text").eq("id", chunk_id).single().execute()
    chunk_text = ""
    if hasattr(chunk_result, "data") and chunk_result.data:
        chunk_text = chunk_result.data.get("text", "")
    # AI-based quiz generation for both 'quiz' and 'review' tasks
    quiz_question = None
    if task_type in ("quiz", "review"):
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful study assistant. Generate a short quiz question based on the following study material. Make sure to generate a new, unique question each time."},
                    {"role": "user", "content": chunk_text}
                ],
                max_tokens=60,
                temperature=1.0 if task_type == "review" else 0.7
            )
            quiz_question = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[DEBUG] OpenAI quiz generation error: {e}")
            quiz_question = "Write a short summary of this material."
    return {
        "chunk_text": chunk_text,
        "chunk_id": chunk_id,
        **({"quiz_question": quiz_question} if quiz_question else {})
    }

@app.post("/api/reviews/complete")
async def complete_review_session(request: Request, user_id: str = Depends(verify_supabase_jwt)):
    """Complete a review session"""
    data = await request.json()
    chunk_id = data.get("chunk_id")
    if not chunk_id:
        raise HTTPException(status_code=400, detail="chunk_id is required")
    from backend.db.database import supabase
    from datetime import date
    # Mark the learn task as completed
    supabase.table("tasks").update({"completed": True}).eq("user_id", user_id).eq("chunk_id", chunk_id).eq("task_type", "learn").execute()
    # Schedule a quiz for the next available day
    quiz_task = schedule_next_quiz(user_id, chunk_id, date.today())
    next_day = find_next_available_slot(user_id, supabase, date.today())
    quiz_task["scheduled_date"] = next_day.isoformat()
    supabase.table("tasks").upsert(quiz_task).execute()
    shift_tasks_forward(user_id, supabase, next_day)
    return {"status": "completed", "chunk_id": chunk_id}

@app.post("/api/quiz/submit")
async def submit_quiz_answer(request: Request, user_id: str = Depends(verify_supabase_jwt)):
    data = await request.json()
    chunk_id = data.get("chunk_id")
    answer = data.get("answer")
    quiz_question = data.get("quiz_question")
    task_type = data.get("type")
    if not chunk_id or not answer:
        raise HTTPException(status_code=400, detail="chunk_id and answer are required.")
    try:
        from backend.db.database import supabase
        from datetime import date
        chunk_result = supabase.table("document_chunks").select("text").eq("id", chunk_id).single().execute()
        chunk_text = ""
        if hasattr(chunk_result, "data") and chunk_result.data:
            chunk_text = chunk_result.data.get("text", "")
        # AI-based grading
        ai_score = 0
        ai_feedback = ""
        try:
            prompt = (
                "You are an expert grader for short-answer quizzes. "
                "Given the study material, quiz question, and student answer, respond ONLY with a valid JSON object on a single line, like this: {\"score\": 1, \"feedback\": \"Your feedback here.\"}. "
                "Do not include any explanation or text outside the JSON.\n\n"
                f"Study material: {chunk_text}\n"
                f"Quiz question: {quiz_question or 'N/A'}\n"
                f"Student answer: {answer}\n"
                "Grade the student's answer as 1 (fully correct) or 0 (incorrect) and provide a brief feedback. Only use 1 or 0 for the score. If the answer is incorrect, use 'you' (second person) in your feedback."
            )
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert grader for short-answer quizzes."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.2
            )
            import json as pyjson
            ai_result = response.choices[0].message.content.strip()
            print(f"[DEBUG] Raw AI grading response: {ai_result}")
            try:
                ai_json = pyjson.loads(ai_result)
            except Exception:
                import re
                print("[DEBUG] Failed to parse as JSON, trying regex extraction...")
                match = re.search(r'\{.*\}', ai_result, re.DOTALL)
                if match:
                    try:
                        ai_json = pyjson.loads(match.group(0))
                    except Exception as e2:
                        print(f"[DEBUG] Regex JSON extraction failed: {e2}")
                        ai_json = {"score": 0, "feedback": "Quiz submitted! (AI grading unavailable)"}
                else:
                    print("[DEBUG] No JSON object found in AI response.")
                    ai_json = {"score": 0, "feedback": "Quiz submitted! (AI grading unavailable)"}
            ai_score = int(round(float(ai_json.get("score", 0))))
            if ai_score not in (0, 1):
                ai_score = 0
            if ai_score == 1:
                ai_feedback = "Correct!"
            else:
                ai_feedback = ai_json.get("feedback", "Submitted.")
        except Exception as e:
            print(f"[DEBUG] OpenAI grading error: {e}")
            ai_feedback = "Quiz submitted! (AI grading unavailable)"
            ai_score = 0
        # Store the answer, score, and feedback
        result = supabase.table("quiz_performance").insert({
            "user_id": user_id,
            "chunk_id": chunk_id,
            "answer": answer,
            "score": ai_score,
            "feedback": ai_feedback,
            "timestamp": datetime.utcnow().isoformat(),
            "task_type": task_type or "quiz"
        }).execute()
        # Mark the task as completed
        supabase.table("tasks").update({"completed": True}).eq("user_id", user_id).eq("chunk_id", chunk_id).eq("task_type", task_type).execute()
        # Next task scheduling logic
        today = date.today()
        if task_type == "learn":
            # Schedule a quiz for the next available day
            quiz_task = schedule_next_quiz(user_id, chunk_id, today)
            next_day = find_next_available_slot(user_id, supabase, today)
            quiz_task["scheduled_date"] = next_day.isoformat()
            supabase.table("tasks").upsert(quiz_task).execute()
            shift_tasks_forward(user_id, supabase, next_day)
        elif task_type == "quiz":
            # Schedule a review, interval depends on correctness
            review_task = schedule_next_review(user_id, chunk_id, ai_score == 1, today)
            next_day = find_next_available_slot(user_id, supabase, today)
            review_task["scheduled_date"] = next_day.isoformat()
            supabase.table("tasks").upsert(review_task).execute()
            shift_tasks_forward(user_id, supabase, next_day)
        elif task_type == "review":
            # Schedule another review only if incorrect
            followup = schedule_followup_review(user_id, chunk_id, ai_score == 1, today)
            if followup:
                next_day = find_next_available_slot(user_id, supabase, today)
                followup["scheduled_date"] = next_day.isoformat()
                supabase.table("tasks").upsert(followup).execute()
                shift_tasks_forward(user_id, supabase, next_day)
        return {"feedback": ai_feedback, "score": ai_score}
    except Exception as e:
        print(f"Error storing quiz answer: {e}")
        raise HTTPException(status_code=500, detail="Failed to store quiz answer.")

@app.get("/api/preferences")
async def get_preferences(user_id: str = Depends(verify_supabase_jwt)):
    prefs = get_user_preferences(user_id)
    return {"preferences": prefs}

@app.post("/api/preferences")
async def set_preferences(request: Request, user_id: str = Depends(verify_supabase_jwt)):
    data = await request.json()
    study_days = data.get("study_days")
    intensity = data.get("intensity")
    if not isinstance(study_days, list) or not intensity:
        raise HTTPException(status_code=400, detail="study_days (list) and intensity (str) required")
    success = set_user_preferences(user_id, study_days, intensity)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to set preferences")
    return {"status": "ok"}

@app.get("/api/tasks")
async def get_tasks(start: str, end: str, user_id: str = Depends(verify_supabase_jwt)):
    from backend.db.database import supabase
    result = supabase.table("tasks").select(
        "id, chunk_id, scheduled_date, task_type, completed"
    ).eq("user_id", user_id).gte("scheduled_date", start).lte("scheduled_date", end).execute()
    return {"tasks": result.data if hasattr(result, "data") else []}