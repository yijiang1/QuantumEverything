import os
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional

from app.config import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "library.db")


@dataclass
class LibraryPaper:
    title: str
    id: Optional[int] = None
    authors: str = ""
    year: str = ""
    tags: str = ""          # comma-separated free-form labels
    notes: str = ""
    filename: str = ""      # stored PDF filename, relative to LIBRARY_PDF_DIR
    original_filename: str = ""
    created_at: float = 0.0


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.executescript("""
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS library_papers (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                title             TEXT NOT NULL,
                authors           TEXT DEFAULT '',
                year              TEXT DEFAULT '',
                tags              TEXT DEFAULT '',
                notes             TEXT DEFAULT '',
                filename          TEXT DEFAULT '',
                original_filename TEXT DEFAULT '',
                created_at        REAL
            );

            CREATE INDEX IF NOT EXISTS idx_library_created ON library_papers(created_at);
        """)


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def add_paper(paper: LibraryPaper) -> int:
    now = time.time()
    with _get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO library_papers
               (title, authors, year, tags, notes, filename, original_filename, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                paper.title, paper.authors, paper.year, paper.tags, paper.notes,
                paper.filename, paper.original_filename, paper.created_at or now,
            ),
        )
        return cur.lastrowid


def get_paper(paper_id: int) -> Optional[LibraryPaper]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM library_papers WHERE id = ?", (paper_id,)
        ).fetchone()
    return _row_to_paper(row) if row else None


def list_papers(search: str = "", tag: str = "") -> list[LibraryPaper]:
    where, params = ["1=1"], []
    if search:
        where.append("(title LIKE ? OR authors LIKE ? OR notes LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s])
    if tag:
        where.append("tags LIKE ?")
        params.append(f"%{tag}%")
    sql = f"SELECT * FROM library_papers WHERE {' AND '.join(where)} ORDER BY created_at DESC"
    with _get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_paper(r) for r in rows]


def update_paper(paper_id: int, **fields) -> bool:
    if not fields:
        return False
    allowed = {"title", "authors", "year", "tags", "notes", "filename", "original_filename"}
    fields = {k: v for k, v in fields.items() if k in allowed}
    if not fields:
        return False
    clause = ", ".join(f"{k} = ?" for k in fields)
    with _get_conn() as conn:
        conn.execute(
            f"UPDATE library_papers SET {clause} WHERE id = ?",
            (*fields.values(), paper_id),
        )
    return True


def delete_paper(paper_id: int) -> bool:
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM library_papers WHERE id = ?", (paper_id,))
    return cur.rowcount > 0


def _row_to_paper(row) -> LibraryPaper:
    d = dict(row)
    return LibraryPaper(
        id=d["id"],
        title=d["title"],
        authors=d.get("authors", ""),
        year=d.get("year", ""),
        tags=d.get("tags", ""),
        notes=d.get("notes", ""),
        filename=d.get("filename", ""),
        original_filename=d.get("original_filename", ""),
        created_at=d.get("created_at", 0),
    )
