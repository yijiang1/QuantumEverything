from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.knowledge_base import paper_db
from app.knowledge_base.arxiv_fetcher import fetch_arxiv_papers
from app.knowledge_base.openalex_fetcher import fetch_openalex_papers
from app.knowledge_base.paper_classifier import classify_papers
from app.knowledge_base.vector_store import sync_paper

router = APIRouter()


# ── List / stats ──────────────────────────────────────────────────────────────

@router.get("/papers")
async def list_papers(
    status: str = "",
    search: str = "",
    quantum_area: str = "",
    paper_type: str = "",
    min_score: float = 0.0,
    limit: int = 30,
    offset: int = 0,
    sort: str = "date_desc",
):
    papers = paper_db.list_papers(
        status=status,
        search=search,
        quantum_area=quantum_area,
        paper_type=paper_type,
        min_score=min_score,
        limit=limit,
        offset=offset,
        sort=sort,
    )
    return [p.__dict__ for p in papers]


@router.get("/papers/stats")
async def get_stats():
    return paper_db.get_stats()


# ── Single paper ──────────────────────────────────────────────────────────────

@router.get("/papers/{paper_id}")
async def get_paper(paper_id: int):
    paper = paper_db.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    return paper.__dict__


# ── Status actions ────────────────────────────────────────────────────────────

@router.post("/papers/{paper_id}/approve")
async def approve_paper(paper_id: int):
    paper = paper_db.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    paper_db.update_paper(paper_id, status="approved")
    # Sync to ChromaDB so the research agent can find it
    sync_paper(
        f"paper:{paper_id}",
        f"Title: {paper.title}\n\nAbstract: {paper.abstract}",
        {
            "title": paper.title,
            "authors": paper.authors,
            "date": paper.date,
            "quantum_area": paper.quantum_area,
            "paper_type": paper.paper_type,
            "arxiv_id": paper.arxiv_id,
            "url": paper.url,
            "source": paper.source,
        },
    )
    return {"status": "approved"}


class SkipRequest(BaseModel):
    reason: str = ""


@router.post("/papers/{paper_id}/skip")
async def skip_paper(paper_id: int, body: SkipRequest = SkipRequest()):
    if not paper_db.get_paper(paper_id):
        raise HTTPException(404, "Paper not found")
    paper_db.update_paper(paper_id, status="skipped", skip_reason=body.reason)
    return {"status": "skipped"}


# ── Edit ──────────────────────────────────────────────────────────────────────

class UpdateRequest(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    date: Optional[str] = None
    journal: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None
    paper_type: Optional[str] = None
    quantum_area: Optional[str] = None
    hardware_platform: Optional[str] = None
    quantum_advantage: Optional[str] = None
    summary: Optional[str] = None


@router.put("/papers/{paper_id}")
async def update_paper(paper_id: int, body: UpdateRequest):
    if not paper_db.get_paper(paper_id):
        raise HTTPException(404, "Paper not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        paper_db.update_paper(paper_id, **updates)
    return {"status": "updated"}


# ── Fetch triggers ────────────────────────────────────────────────────────────

class FetchArxivRequest(BaseModel):
    query: str = ""
    max_results: int = 20


class FetchOpenAlexRequest(BaseModel):
    keyword: str = ""
    lookback_days: int = 90


@router.post("/papers/fetch/arxiv")
async def fetch_arxiv(body: FetchArxivRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(fetch_arxiv_papers, body.query or None, body.max_results)
    return {"status": "fetching", "message": "arXiv fetch started in background"}


@router.post("/papers/fetch/openalex")
async def fetch_openalex(body: FetchOpenAlexRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(fetch_openalex_papers, body.keyword or None, body.lookback_days)
    return {"status": "fetching", "message": "OpenAlex fetch started in background"}


# ── Classify ──────────────────────────────────────────────────────────────────

@router.post("/papers/classify")
async def run_classify(background_tasks: BackgroundTasks, limit: int = 20):
    background_tasks.add_task(classify_papers, limit)
    return {"status": "classifying", "message": f"Classifying up to {limit} unscored pending papers"}
