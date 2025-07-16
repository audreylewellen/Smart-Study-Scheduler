import re
import fitz

class Chunker:
    """
    Handles the logic for splitting PDFs into smaller, semantically meaningful chunks.

    Attributes:
        max_chars (int): Maximum allowed characters in a single chunk.
        min_chars (int): Minimum required characters in a valid chunk.
    """

    def __init__(self, max_chars=1000, min_chars=100):
        """
        Initialize the Chunker with maximum and minimum chunk sizes.
        max_chars: Maximum number of characters per chunk.
        min_chars: Minimum number of characters per chunk.
        """
        self.max_chars = max_chars
        self.min_chars = min_chars

    def extract_text(self, pdf_path):
        """
        Extract text from a PDF file, treating each block as a paragraph.
        Internal newlines within a block are replaced with spaces.
        Blocks are joined with double newlines to mark paragraph boundaries.
        """
        doc = fitz.open(pdf_path)
        paragraphs = []
        for page in doc:
            blocks = page.get_text("blocks")
            # Sort blocks top-to-bottom, then left-to-right
            blocks = sorted(blocks, key=lambda b: (b[1], b[0]))
            for block in blocks:
                text = block[4].strip()
                if not text:
                    continue
                # Replace newlines within a block with spaces
                temp_text = text.replace('\n', ' ')
                text = re.sub(r'\s+', ' ', temp_text)
                paragraphs.append(text)
        # Join all blocks with double newlines
        result = ""
        for i, para in enumerate(paragraphs):
            result += para
            if i != len(paragraphs) - 1:
                result += "\n\n"
        return result

    def _split_paragraph(self, paragraph):
        """
        Split a long paragraph into smaller chunks, avoiding word breaks when possible.
        """
        if len(paragraph) <= self.max_chars:
            return [paragraph]
        parts = []
        idx = 0
        while idx < len(paragraph):
            end = idx + self.max_chars
            if end > len(paragraph):
                end = len(paragraph)
            split_at = end
            # Try not to break words - back up to a space or newline
            found = False
            for j in range(split_at-1, idx-1, -1):
                if paragraph[j] in (" ", "\n"):
                    split_at = j + 1
                    found = True
                    break
            if not found:
                split_at = end  # if no space found, just split at max_chars
            chunk = ""
            for c in paragraph[idx:split_at]:
                chunk += c
            chunk = chunk.strip()
            parts.append(chunk)
            idx = split_at
        return parts

    def chunk_merged_paragraphs(self, text):
        """
        Split text into paragraphs using double newlines, then chunk and merge as needed.
        Long paragraphs are split, and small chunks are merged to stay within size limits.
        """
        paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) >= self.min_chars]
        print(f"Found {len(paragraphs)} paragraphs. Lengths: {[len(p) for p in paragraphs]}")

        # Split long paragraphs
        chunks = []
        for paragraph in paragraphs:
            if len(paragraph) <= self.max_chars:
                chunks.append(paragraph)
            else:
                for part in self._split_paragraph(paragraph):
                    chunks.append(part)

        # Merge small chunks together (less efficient way)
        merged = []
        current = ""
        i = 0
        while i < len(chunks):
            chunk = chunks[i]
            if len(current) == 0:
                current = chunk
            elif len(current) + 1 + len(chunk) <= self.max_chars:
                current = current + " " + chunk
            else:
                merged.append(current.strip())
                current = chunk
            i += 1
        if current:
            merged.append(current.strip())

        print(f"Final chunk count: {len(merged)}\n")
        return merged

if __name__ == "__main__":
    chunker = Chunker(max_chars=850, min_chars=300)
    raw_text = chunker.extract_text("tests/files/test.pdf")
    print("RAW EXTRACTED TEXT:\n", repr(raw_text))
    chunks = chunker.chunk_merged_paragraphs(raw_text)
    for i, chunk in enumerate(chunks, 1):
        print(f"--- chunk #{i} ---\n{chunk}\n")
