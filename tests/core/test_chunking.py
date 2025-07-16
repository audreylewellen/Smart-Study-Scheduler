import os
import pytest
from backend.core.chunking import Chunker

TEST_PDF = os.path.join(os.path.dirname(__file__), "..", "files", "test.pdf")

# Simple string for some tests
SAMPLE_TEXT = (
    "This is a short paragraph.\n\n"
    "This is a much longer paragraph that should be split into multiple chunks because it exceeds the max_chars limit. "
    "It keeps going and going and going and going and going and going and going and going and going and going.\n\n"
    "Tiny."
)

def test_extract_text_runs():
    """ Tests that text extraction runs without raising errors. """
    chunker = Chunker()
    # Should not raise
    text = chunker.extract_text(TEST_PDF)
    assert isinstance(text, str)
    assert len(text) > 0

def test_chunk_merged_paragraphs_basic():
    """ Tests text chunking on paragraphs of various lengths. """
    chunker = Chunker(max_chars=50, min_chars=10)
    chunks = chunker.chunk_merged_paragraphs(SAMPLE_TEXT)
    # Should split the long paragraph
    assert any(len(c) > 40 for c in chunks)
    assert all(len(c) >= 10 for c in chunks)
    # Should not include the tiny paragraph
    assert not any(c == "Tiny." for c in chunks)

def test_chunker_handles_empty():
    """ Tests chunking on empty text returns no chunks. """
    chunker = Chunker()
    chunks = chunker.chunk_merged_paragraphs("")
    assert chunks == []

def test_chunker_pdf_chunking():
    """ Tests text extraction and chunking on a test pdf. """
    chunker = Chunker(max_chars=300, min_chars=50)
    text = chunker.extract_text(TEST_PDF)
    chunks = chunker.chunk_merged_paragraphs(text)
    # Should get at least one chunk
    assert len(chunks) > 0
    # Chunks should not be too small
    assert all(len(c) >= 50 for c in chunks)

# Run with: PYTHONPATH=. pytest tests/core/test_chunking.py