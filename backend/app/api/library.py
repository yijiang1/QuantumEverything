import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import LIBRARY_PDF_DIR
from app.library import db

router = APIRouter()


def _safe_filename(name: str) -> str:
    name = Path(name).name  # strip directory components
    name = re.sub(r"[^\w.\-]", "_", name)
    return name or "paper.pdf"


@router.get("/library")
async def list_library(search: str = "", tag: str = ""):
    papers = db.list_papers(search=search, tag=tag)
    return [p.__dict__ for p in papers]


@router.post("/library/upload")
async def upload_paper(
    file: UploadFile = File(...),
    title: str = Form(...),
    authors: str = Form(""),
    year: str = Form(""),
    tags: str = Form(""),
    notes: str = Form(""),
):
    if file.content_type not in ("application/pdf", "application/octet-stream") and not (
        file.filename or ""
    ).lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    Path(LIBRARY_PDF_DIR).mkdir(parents=True, exist_ok=True)
    original_name = file.filename or "paper.pdf"
    stored_name = f"{uuid.uuid4().hex[:8]}_{_safe_filename(original_name)}"
    dest = Path(LIBRARY_PDF_DIR) / stored_name

    content = await file.read()
    dest.write_bytes(content)

    paper_id = db.add_paper(
        db.LibraryPaper(
            title=title.strip() or original_name,
            authors=authors.strip(),
            year=year.strip(),
            tags=tags.strip(),
            notes=notes.strip(),
            filename=stored_name,
            original_filename=original_name,
        )
    )
    return db.get_paper(paper_id).__dict__


@router.get("/library/{paper_id}/pdf")
async def get_pdf(paper_id: int):
    paper = db.get_paper(paper_id)
    if not paper or not paper.filename:
        raise HTTPException(404, "PDF not found")
    path = Path(LIBRARY_PDF_DIR) / paper.filename
    if not path.exists():
        raise HTTPException(404, "PDF file missing on disk")
    return FileResponse(
        path, media_type="application/pdf",
        filename=paper.original_filename or path.name,
        content_disposition_type="inline",
    )


class UpdateRequest(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


@router.put("/library/{paper_id}")
async def update_paper(paper_id: int, body: UpdateRequest):
    if not db.get_paper(paper_id):
        raise HTTPException(404, "Paper not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        db.update_paper(paper_id, **updates)
    return db.get_paper(paper_id).__dict__


@router.delete("/library/{paper_id}")
async def delete_paper(paper_id: int):
    paper = db.get_paper(paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")
    if paper.filename:
        path = Path(LIBRARY_PDF_DIR) / paper.filename
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
    db.delete_paper(paper_id)
    return {"status": "deleted"}
