"""
embedding.py

Handles generation of vector embeddings from text chunks using OpenAI's embedding API.

This module provides functions for embedding raw chunks of text as well as an end-to-end
pipeline of PDF text extraction, chunking with the Chunker class, and creating embeddings.
"""

import openai
from typing import List, Tuple, Optional
import os
from .chunking import Chunker

from dotenv import load_dotenv
load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

def embed_chunks(chunks: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
    """
    Sends a batch of text chunks to OpenAI and retrieves embeddings.

    Args:
        chunks: A list of text segments to embed.
        model: The OpenAI embedding model to use.

    Returns:
        A list of embedding vectors (each vector is a list of floats).
    """
    if not chunks:
        return []

    response = openai.embeddings.create(
        input=chunks,
        model=model
    )
    return [item.embedding for item in response.data]


def embed_pdf(pdf_path: str, chunker_args: Optional[dict] = None, embedding_model: str = "text-embedding-3-small") -> Tuple[List[str], List[List[float]]]:
    """
    Extracts text from a PDF, chunks it, and returns both the chunks and their embeddings.
    chunker_args can optionally contain 'max_chars' and 'min_chars'.
    """
    chunker_args = chunker_args or {}
    max_chars = chunker_args["max_chars"] if "max_chars" in chunker_args else 1000
    min_chars = chunker_args["min_chars"] if "min_chars" in chunker_args else 100
    chunker = Chunker(max_chars, min_chars)
    text = chunker.extract_text(pdf_path)
    chunks = chunker.chunk_merged_paragraphs(text)
    embeddings = embed_chunks(chunks, model=embedding_model)
    return chunks, embeddings
