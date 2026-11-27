"""
Quantum company directory.

Companies are seeded from seed_companies.json into SQLite on startup (upsert by
slug), so the JSON file stays the source of truth for the curated list while
the table gives later features (stocks, policy, funding) something to join on.
"""

import json
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from app.config import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "companies.db")
SEED_PATH = Path(__file__).with_name("seed_companies.json")

CATEGORIES = ["hardware", "big_tech", "software", "enabling", "networking_security", "sensing"]
PLATFORMS = [
    "superconducting", "trapped_ion", "neutral_atom", "photonic",
    "spin", "topological", "annealing", "bosonic", "diamond",
]


@dataclass
class Company:
    slug: str
    name: str
    category: str = ""
    platforms: list[str] = field(default_factory=list)
    country: str = ""
    founded: str = ""
    website: str = ""
    ticker: str = ""
    exchange: str = ""
    status: str = "active"   # active|acquired|defunct
    parent: str = ""
    description: str = ""
    aliases: list[str] = field(default_factory=list)
    updated_at: float = 0.0

    @property
    def is_public(self) -> bool:
        return bool(self.ticker)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["is_public"] = self.is_public
        return d


# ── Connection / schema ───────────────────────────────────────────────────────

@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(seed: bool = True):
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    with _get_conn() as conn:
        conn.executescript("""
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS companies (
                slug        TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                category    TEXT DEFAULT '',
                platforms   TEXT DEFAULT '[]',
                country     TEXT DEFAULT '',
                founded     TEXT DEFAULT '',
                website     TEXT DEFAULT '',
                ticker      TEXT DEFAULT '',
                exchange    TEXT DEFAULT '',
                status      TEXT DEFAULT 'active',
                parent      TEXT DEFAULT '',
                description TEXT DEFAULT '',
                aliases     TEXT DEFAULT '[]',
                updated_at  REAL
            );

            CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);
        """)
    if seed:
        seed_from_file()


def seed_from_file(path: Path = SEED_PATH) -> int:
    """Upsert every company in the seed file. Returns the number written."""
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    now = time.time()
    with _get_conn() as conn:
        for r in rows:
            c = Company(
                slug=r["slug"],
                name=r["name"],
                category=r.get("category", ""),
                platforms=r.get("platforms", []),
                country=r.get("country", ""),
                founded=r.get("founded", ""),
                website=r.get("website", ""),
                ticker=r.get("ticker", ""),
                exchange=r.get("exchange", ""),
                status=r.get("status", "active"),
                parent=r.get("parent", ""),
                description=r.get("description", ""),
                aliases=r.get("aliases", []) or [r["name"]],
            )
            conn.execute(
                """INSERT INTO companies
                   (slug, name, category, platforms, country, founded, website,
                    ticker, exchange, status, parent, description, aliases, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(slug) DO UPDATE SET
                     name=excluded.name, category=excluded.category,
                     platforms=excluded.platforms, country=excluded.country,
                     founded=excluded.founded, website=excluded.website,
                     ticker=excluded.ticker, exchange=excluded.exchange,
                     status=excluded.status, parent=excluded.parent,
                     description=excluded.description, aliases=excluded.aliases,
                     updated_at=excluded.updated_at""",
                (
                    c.slug, c.name, c.category, json.dumps(c.platforms), c.country,
                    c.founded, c.website, c.ticker, c.exchange, c.status, c.parent,
                    c.description, json.dumps(c.aliases), now,
                ),
            )
    return len(rows)


# ── Queries ───────────────────────────────────────────────────────────────────

def list_companies(
    search: str = "",
    category: str = "",
    platform: str = "",
    public_only: bool = False,
) -> list[Company]:
    where, params = ["1=1"], []
    if search:
        where.append("(name LIKE ? OR description LIKE ? OR aliases LIKE ? OR country LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s, s])
    if category:
        where.append("category = ?")
        params.append(category)
    if platform:
        where.append("platforms LIKE ?")
        params.append(f'%"{platform}"%')
    if public_only:
        where.append("ticker != ''")
    sql = f"SELECT * FROM companies WHERE {' AND '.join(where)} ORDER BY name COLLATE NOCASE"
    with _get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_company(r) for r in rows]


def get_company(slug: str) -> Optional[Company]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM companies WHERE slug = ?", (slug,)).fetchone()
    return _row_to_company(row) if row else None


def _row_to_company(row) -> Company:
    d = dict(row)
    return Company(
        slug=d["slug"],
        name=d["name"],
        category=d.get("category", ""),
        platforms=json.loads(d.get("platforms") or "[]"),
        country=d.get("country", ""),
        founded=d.get("founded", ""),
        website=d.get("website", ""),
        ticker=d.get("ticker", ""),
        exchange=d.get("exchange", ""),
        status=d.get("status", "active"),
        parent=d.get("parent", ""),
        description=d.get("description", ""),
        aliases=json.loads(d.get("aliases") or "[]"),
        updated_at=d.get("updated_at") or 0.0,
    )


# ── Mention matching ──────────────────────────────────────────────────────────
#
# A paper or news item "mentions" a company when one of its aliases appears as a
# whole word, case-sensitively. Case sensitivity keeps brand names like
# "Quantum Machines" from matching ordinary phrases like "quantum machines".

def alias_pattern(aliases: list[str]) -> Optional[re.Pattern]:
    terms = sorted({a.strip() for a in aliases if a.strip()}, key=len, reverse=True)
    if not terms:
        return None
    alt = "|".join(re.escape(t) for t in terms)
    return re.compile(rf"(?<![\w&-])(?:{alt})(?![\w&-])")


def mentions(pattern: Optional[re.Pattern], *texts: str) -> bool:
    if pattern is None:
        return False
    return any(t and pattern.search(t) for t in texts)
