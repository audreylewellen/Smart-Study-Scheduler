from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from backend.core.embedding import embed_pdf
from backend.core.scheduling import Scheduler, UserPreferences
import backend.db.chunks
import backend.db.schedule
import uuid
from io import BytesIO
from typing import List
from datetime import datetime
import json 

app = FastAPI()

@app.post("/upload-pdf")
async def upload_pdf(user_id: str = Form(...), class_id: str = Form(...), pdf: UploadFile = File(...)):
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
    user_id: str = Form(...), 
    class_id: str = Form(...),
    pdfs: List[UploadFile] = File(...),
    study_days: str = Form(...),  
    intensity: str = Form(...),   
    start_date: str = Form(None)  
):
    """
    Upload multiple PDFs for a specified class, process them, and create a combined study schedule.
    """
    try:
        # Parse study days 
        study_days_list = json.loads(study_days)

        # Parse start date 
        parsed_start_date = None
        if start_date:
            parsed_start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

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
        
        # Create schedule for all chunks combined
        schedule = scheduler.schedule_learn_tasks(all_chunk_ids, start_date=parsed_start_date)
        
        # Store schedule in database
        backend.db.schedule.store_schedule(schedule, user_id)
        
        return {
            "status": "ok", 
            "total_chunks": len(all_chunk_ids),
            "total_pdfs": len(pdfs)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))