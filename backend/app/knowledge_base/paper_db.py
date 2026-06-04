import os
import re
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Optional

from app.config import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "papers.db")

# Quantum-specific enums (stored as comma-separated strings)
PAPER_TYPES = ["algorithm", "hardware", "error_correction", "simulation", "ml_quantum", "application", "review", "other"]
QUANTUM_AREAS = ["quantum_computing", "quantum_ml", "quantum_sensing", "quantum_communication", "quantum_simulation", "quantum_cryptography", "quantum_hardware"]
HARDWARE_PLATFORMS = ["superconducting", "trapped_ion", "photonic", "neutral_atom", "annealing", "spin", "other"]


@dataclass
class Paper:
    title: str
    id: Optional[int] = None
    authors: str = ""
    date: str = ""
    journal: str = ""
    url: str = ""
    abstract: str = ""
    paper_type: str = "other"
    quantum_area: str = ""
    hardware_platform: str = ""
    quantum_advantage: str = "none"  # proven|claimed|theoretical|none
    relevance_score: float = 0.0
    summary: str = ""
    status: str = "pending"  # pending|approved|skipped
    skip_reason: str = ""
    arxiv_id: str = ""
    openalex_id: str = ""
    source: str = ""  # arxiv|openalex|manual
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.executescript("""
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS papers (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                title            TEXT NOT NULL,
                authors          TEXT    DEFAULT '',
                date             TEXT    DEFAULT '',
                journal          TEXT    DEFAULT '',
                url              TEXT    DEFAULT '',
                abstract         TEXT    DEFAULT '',
                paper_type       TEXT    DEFAULT 'other',
                quantum_area     TEXT    DEFAULT '',
                hardware_platform TEXT   DEFAULT '',
                quantum_advantage TEXT   DEFAULT 'none',
                relevance_score  REAL    DEFAULT 0,
                summary          TEXT    DEFAULT '',
                status           TEXT    DEFAULT 'pending',
                skip_reason      TEXT    DEFAULT '',
                arxiv_id         TEXT    DEFAULT '',
                openalex_id      TEXT    DEFAULT '',
                source           TEXT    DEFAULT '',
                created_at       REAL,
                updated_at       REAL
            );

            CREATE INDEX IF NOT EXISTS idx_papers_status  ON papers(status);
            CREATE INDEX IF NOT EXISTS idx_papers_url     ON papers(url);
            CREATE INDEX IF NOT EXISTS idx_papers_date    ON papers(date);
        """)


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Deduplication helpers ─────────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    url = url.strip().lower()
    for prefix in ["http://dx.doi.org/", "https://dx.doi.org/", "http://doi.org/"]:
        if url.startswith(prefix):
            return "https://doi.org/" + url[len(prefix):]
    return url


def _normalize_title(title: str) -> str:
    title = re.sub(r"<[^>]+>", "", title)
    title = re.sub(r"[–—−]", "-", title)  # Unicode dashes → ASCII
    return re.sub(r"\s+", " ", title).lower().strip()


def _paper_exists(url: str, title: str) -> bool:
    with _get_conn() as conn:
        if url:
            row = conn.execute("SELECT id FROM papers WHERE url = ?", (_normalize_url(url),)).fetchone()
            if row:
                return True
        if title:
            norm = _normalize_title(title)
            for row in conn.execute("SELECT title FROM papers").fetchall():
                if _normalize_title(row["title"]) == norm:
                    return True
    return False


# ── CRUD ──────────────────────────────────────────────────────────────────────

def add_paper(paper: Paper) -> Optional[int]:
    if _paper_exists(url=paper.url, title=paper.title):
        return None
    now = time.time()
    with _get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO papers
               (title, authors, date, journal, url, abstract,
                paper_type, quantum_area, hardware_platform, quantum_advantage,
                relevance_score, summary, status, skip_reason,
                arxiv_id, openalex_id, source, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                paper.title,
                paper.authors,
                paper.date,
                paper.journal,
                _normalize_url(paper.url) if paper.url else "",
                paper.abstract,
                paper.paper_type,
                paper.quantum_area,
                paper.hardware_platform,
                paper.quantum_advantage,
                paper.relevance_score,
                paper.summary,
                paper.status,
                paper.skip_reason,
                paper.arxiv_id,
                paper.openalex_id,
                paper.source,
                paper.created_at or now,
                paper.updated_at or now,
            ),
        )
        return cur.lastrowid


def get_paper(paper_id: int) -> Optional[Paper]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
    return _row_to_paper(row) if row else None


def update_paper(paper_id: int, **fields) -> bool:
    if not fields:
        return False
    fields["updated_at"] = time.time()
    clause = ", ".join(f"{k} = ?" for k in fields)
    with _get_conn() as conn:
        conn.execute(f"UPDATE papers SET {clause} WHERE id = ?", (*fields.values(), paper_id))
    return True


def list_papers(
    status: str = "",
    search: str = "",
    quantum_area: str = "",
    paper_type: str = "",
    min_score: float = 0.0,
    limit: int = 30,
    offset: int = 0,
    sort: str = "date_desc",
) -> list[Paper]:
    where, params = ["1=1"], []

    if status:
        where.append("status = ?"); params.append(status)
    if search:
        where.append("(title LIKE ? OR authors LIKE ? OR abstract LIKE ? OR summary LIKE ?)")
        s = f"%{search}%"; params.extend([s, s, s, s])
    if quantum_area:
        where.append("quantum_area LIKE ?"); params.append(f"%{quantum_area}%")
    if paper_type:
        where.append("paper_type = ?"); params.append(paper_type)
    if min_score > 0:
        where.append("relevance_score >= ?"); params.append(min_score)

    order = {
        "date_desc":    "CASE WHEN date = '' THEN 1 ELSE 0 END, date DESC",
        "date_asc":     "CASE WHEN date = '' THEN 1 ELSE 0 END, date ASC",
        "score_desc":   "relevance_score DESC",
        "created_desc": "created_at DESC",
    }.get(sort, "created_at DESC")

    sql = f"SELECT * FROM papers WHERE {' AND '.join(where)} ORDER BY {order} LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    with _get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_paper(r) for r in rows]


def get_stats() -> dict:
    with _get_conn() as conn:
        total    = conn.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
        pending  = conn.execute("SELECT COUNT(*) FROM papers WHERE status = 'pending'").fetchone()[0]
        approved = conn.execute("SELECT COUNT(*) FROM papers WHERE status = 'approved'").fetchone()[0]
        skipped  = conn.execute("SELECT COUNT(*) FROM papers WHERE status = 'skipped'").fetchone()[0]
    return {"total": total, "pending": pending, "approved": approved, "skipped": skipped}


def get_pending_unclassified(limit: int = 20) -> list[Paper]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM papers WHERE status = 'pending' AND relevance_score = 0 "
            "ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [_row_to_paper(r) for r in rows]


# ── Internal ──────────────────────────────────────────────────────────────────

def _row_to_paper(row) -> Paper:
    d = dict(row)
    return Paper(
        id=d["id"],
        title=d["title"],
        authors=d.get("authors", ""),
        date=d.get("date", ""),
        journal=d.get("journal", ""),
        url=d.get("url", ""),
        abstract=d.get("abstract", ""),
        paper_type=d.get("paper_type", "other"),
        quantum_area=d.get("quantum_area", ""),
        hardware_platform=d.get("hardware_platform", ""),
        quantum_advantage=d.get("quantum_advantage", "none"),
        relevance_score=float(d.get("relevance_score") or 0),
        summary=d.get("summary", ""),
        status=d.get("status", "pending"),
        skip_reason=d.get("skip_reason", ""),
        arxiv_id=d.get("arxiv_id", ""),
        openalex_id=d.get("openalex_id", ""),
        source=d.get("source", ""),
        created_at=d.get("created_at", 0),
        updated_at=d.get("updated_at", 0),
    )
