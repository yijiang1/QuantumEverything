import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analyze, papers, news
from app.knowledge_base.vector_store import init_vector_store
from app.knowledge_base.paper_db import init_db
from app.config import UPLOADS_DIR, CHROMA_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    os.makedirs(CHROMA_DIR, exist_ok=True)
    init_vector_store()
    init_db()
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
