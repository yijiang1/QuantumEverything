import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATA_DIR = os.getenv("DATA_DIR", "./data")
CHROMA_DIR = os.path.join(DATA_DIR, "chroma")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
LIBRARY_PDF_DIR = os.path.join(DATA_DIR, "library_pdfs")
