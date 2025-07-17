from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from backend.core.embedding import embed_pdf
import backend.db.chunks
import uuid
from io import BytesIO

app = FastAPI()

@app.post("/upload-pdf")
async def upload_pdf(user_id: str = Form(...), pdf: UploadFile = File(...)):
    try:
        # TODO: Store PDF file in bucket

        # Get PDF chunks and embeddings 
        chunks, embeddings = embed_pdf(BytesIO(await pdf.read()))

        # Store embeddings 
        backend.db.chunks.store_chunks(chunks, embeddings, user_id=user_id, document_id=str(uuid.uuid4()))
        return {"status": "ok", "chunks": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))