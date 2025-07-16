import os
import pytest
from backend.core.embedding import embed_chunks, embed_pdf

SAMPLE_CHUNKS = [
    "This is a test chunk.",
    "Another chunk for embedding.",
]

TEST_PDF = os.path.join(os.path.dirname(__file__), "..", "files", "test.pdf")

def test_embed_chunks_returns_vectors():
    """ Tests that embeddings are vectors. """
    vectors = embed_chunks(SAMPLE_CHUNKS)
    assert isinstance(vectors, list)
    assert len(vectors) == len(SAMPLE_CHUNKS)
    # Each embedding should be a list of floats
    assert all(isinstance(vec, list) for vec in vectors)
    assert all(isinstance(x, float) for vec in vectors for x in vec)

def test_embed_pdf_pipeline_runs():
    """ Tests that the full pipeline of text extraction, chunking, and embedding runs without errors and returns valid list of floats."""
    # This will run the full pipeline: extract, chunk, embed
    chunks, vectors = embed_pdf(TEST_PDF, chunker_args={"max_chars": 300, "min_chars": 50})
    assert isinstance(chunks, list)
    assert isinstance(vectors, list)
    assert len(chunks) == len(vectors)
    # Chunks should not be empty
    assert all(len(c) > 0 for c in chunks)
    # Embeddings should be lists of floats
    assert all(isinstance(vec, list) for vec in vectors)
    assert all(isinstance(x, float) for vec in vectors for x in vec)

# Run with: PYTHONPATH=. pytest tests/core/test_embedding.py