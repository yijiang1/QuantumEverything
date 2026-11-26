import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analyze, papers, news, library, companies
from app.knowledge_base.vector_store import init_vector_store
from app.knowledge_base.paper_db import init_db
from app.library.db import init_db as init_library_db
from app.companies.db import init_db as init_companies_db
from app.config import UPLOADS_DIR, CHROMA_DIR, LIBRARY_PDF_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    os.makedirs(CHROMA_DIR, exist_ok=True)
    os.makedirs(LIBRARY_PDF_DIR, exist_ok=True)
    init_vector_store()
    init_db()
    init_library_db()
    init_companies_db()
    yield


app = FastAPI(title="Quantum Everything", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
