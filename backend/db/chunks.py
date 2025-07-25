""" 
chunks.py 

DB logic for chunks and embeddings. Supports storage, updating, and retrieval for text chunks and vector embeddings.
"""

from backend.db.database import supabase 
import uuid

def store_chunks(chunks : list[str], embeddings: list[list[float]], user_id, document_id): 
    """ 
    Stores given chunks and their corresponding embeddings for a given document id. 
    Returns a list of chunk IDs that were store in order by chunk in document and by document.
    """
    if len(chunks) != len(embeddings): 
        raise Exception("Unequal number of chunk and embeddings")
    
    # Build data entries to enter in database
    chunk_ids = []
    data = []
    for i in range(len(chunks)): 
        chunk_id = str(uuid.uuid4())
        chunk_ids.append(chunk_id)
        data.append({
            "id": chunk_id,
            "document_id": document_id, 
            "user_id": user_id,
            "chunk_index": i, 
            "text": chunks[i],
            "embedding": embeddings[i]
        })

    try: 
        supabase.from_("document_chunks").upsert(data).execute()
        return chunk_ids
    except Exception as e:
        print(f"Error storing chunks: {e}")
        raise

def store_file(user_id, class_id, document_id, pdf_bytes, file_name):
    """ 
    Stores a file in Supabase bucket storage. 
    """
    try: 
        storage_path = f"{user_id}/{class_id}/{document_id}/{file_name}"

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
            "class_id": class_id,
            "filename": file_name,
            "pdf_path": storage_path,
        }).execute()

    except Exception as e:
        print(f"Error storing file: {e}")
        raise

def get_chunk_text(chunk_id: str, user_id: str) -> str:
    """
    Retrieve the text content of a specific chunk.
    
    Args:
        chunk_id: The ID of the chunk to retrieve
        user_id: The user ID for security
        
    Returns:
        The text content of the chunk, or None if not found
    """
    try:
        result = supabase.table("document_chunks").select("text").eq("id", chunk_id).eq("user_id", user_id).execute()
        
        if hasattr(result, "data") and result.data:
            return result.data[0]["text"]
        return None
    except Exception as e:
        print(f"Error retrieving chunk text: {e}")
        return None

# Mock example for testing:
if __name__ == "__main__":
    store_chunks(["hello"], [None], str(uuid.uuid4()), str(uuid.uuid4()))
