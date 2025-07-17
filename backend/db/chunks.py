""" 
chunks.py 

DB logic for chunks and embeddings. Supports storage, updating, and retrieval for text chunks and vector embeddings.
"""

from backend.db.database import supabase 
import uuid

def store_chunks(chunks : list[str], embeddings: list[list[float]], user_id, document_id): 
    """ 
    Stores given chunks and their corresponding embeddings for a given document id. 
    """
    if len(chunks) != len(embeddings): 
        raise Exception("Unequal number of chunk and embeddings")
    
    # Build data entries to enter in database
    data = []
    for i in range(len(chunks)): 
        data.append({
            "document_id": document_id, 
            "user_id": user_id,
            "chunk_index": i, 
            "text": chunks[i],
            "embedding": embeddings[i]
        })

    try: 
        supabase.from_("document_chunks").upsert(data).execute()
    except Exception as e:
        print(f"Error storing chunks: {e}")
        raise

def store_file(user_id, document_id, pdf_bytes, file_name):
    """ 
    Stores a file in Supabase bucket storage. 
    """
    try: 
        storage_path = f"{user_id}/{document_id}/{file_name}"

        # Store file in bucket 
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"}
        )

        # Store file metadata
        supabase.from_("documents").upsert({
            "id": document_id,
            "user_id": user_id,
            "filename": file_name,
            "pdf_path": storage_path,
        }).execute()

    except Exception as e:
        print(f"Error storing file: {e}")
        raise

# Mock example for testing:
if __name__ == "__main__":
    store_chunks(["hello"], [None], str(uuid.uuid4()), str(uuid.uuid4()))
