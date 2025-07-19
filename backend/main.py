from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.core.embedding import embed_pdf
from backend.core.scheduling import Scheduler, UserPreferences
import backend.db.chunks
import backend.db.schedule
import backend.db.classes
import uuid
from io import BytesIO
from typing import List, Optional
from datetime import datetime
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