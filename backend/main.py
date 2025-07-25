from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.core.embedding import embed_pdf
from backend.core.scheduling import Scheduler, UserPreferences
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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/refresh")
async def refresh_token(request: Request):
    return await refresh_user_token(request)

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
        # Create schedule for all chunks combined
        schedule = scheduler.schedule_learn_tasks(all_chunk_ids)
        
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
    """Start a review session and get the first chunk to review"""
    data = await request.json()
    chunk_id = data.get("chunk_id")
    
    if not chunk_id:
        raise HTTPException(status_code=400, detail="chunk_id is required")
    
    # Mark the chunk as being reviewed
    backend.db.reviews.start_review_session(user_id, chunk_id)
    
    # Get the chunk text
    chunk_text = backend.db.chunks.get_chunk_text(chunk_id, user_id)
    if not chunk_text:
        raise HTTPException(status_code=404, detail="Chunk not found")
    
    return {"chunk_text": chunk_text, "chunk_id": chunk_id}

@app.post("/api/reviews/complete")
async def complete_review_session(request: Request, user_id: str = Depends(verify_supabase_jwt)):
    """Complete a review session"""
    data = await request.json()
    chunk_id = data.get("chunk_id")
    
    if not chunk_id:
        raise HTTPException(status_code=400, detail="chunk_id is required")
    
    # Mark the review as completed
    success = backend.db.reviews.complete_review(user_id, chunk_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to complete review")
    
    return {"status": "completed", "chunk_id": chunk_id}