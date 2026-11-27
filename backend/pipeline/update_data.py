"""
Refresh the static site's data files.

Run from the backend directory:

    python -m pipeline.update_data            # fetch, score (if a key is set), export
    python -m pipeline.update_data --offline  # skip network fetches, just re-export

It restores the paper store from frontend/public/data/papers.json into a
throwaway SQLite database, reuses the app's own fetchers, classifier and
company matching, then writes JSON back for the site:

    papers.json     every paper seen (skipped ones kept as stubs for de-duplication)
    news.json       latest news items, merged with earlier runs
    companies.json  company directory with paper and news links
    stocks.json     daily share prices and a quantum stock index (see stocks.py)
    meta.json       when the data was built and what each source returned

A GitHub Actions workflow runs this on a schedule and commits the changes.
"""

import argparse
import asyncio
import hashlib
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DATA = REPO_ROOT / "frontend" / "public" / "data"

# app.config reads DATA_DIR at import time, so point it at a scratch dir first.
_TMP = tempfile.mkdtemp(prefix="qe-pipeline-")
os.environ["DATA_DIR"] = _TMP

from app.companies import db as company_db  # noqa: E402
from app.companies.linking import news_for, papers_for  # noqa: E402
from app.knowledge_base import paper_db  # noqa: E402
from app.knowledge_base.arxiv_fetcher import QUANTUM_QUERIES, fetch_arxiv_papers  # noqa: E402
from app.knowledge_base.openalex_fetcher import QUANTUM_KEYWORDS, fetch_openalex_papers  # noqa: E402
import app.news.tracker as tracker  # noqa: E402
from pipeline import stocks  # noqa: E402

MAX_PAPERS = 2000      # visible papers kept on the site, newest first
MAX_NEWS = 200
CLASSIFY_PER_RUN = 60  # Haiku calls per run, to keep API cost predictable

PAPER_FIELDS = [
    "id", "title", "authors", "date", "journal", "url", "abstract", "paper_type",
    "quantum_area", "hardware_platform", "quantum_advantage", "relevance_score",
    "summary", "status", "skip_reason", "arxiv_id", "openalex_id", "source",
    "created_at", "updated_at",
]


def _read(name: str, default):
    path = SITE_DATA / name
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(name: str, data) -> None:
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    path = SITE_DATA / name
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    tmp.replace(path)


# ── Papers ────────────────────────────────────────────────────────────────────

def restore_papers(rows: list[dict]) -> None:
    """Load earlier papers into the scratch DB, keeping their ids stable."""
    paper_db.init_db()
    with paper_db._get_conn() as conn:
        for r in rows:
            values = [r.get(f, "" if f not in ("relevance_score", "created_at", "updated_at") else 0) for f in PAPER_FIELDS]
            conn.execute(
                f"INSERT OR IGNORE INTO papers ({', '.join(PAPER_FIELDS)}) "
                f"VALUES ({', '.join('?' * len(PAPER_FIELDS))})",
                values,
            )


async def fetch_papers(status: dict) -> None:
    before = paper_db.get_stats()["total"]
    for q in QUANTUM_QUERIES:
        try:
            await fetch_arxiv_papers(q, 25)
        except Exception as e:  # one failing source shouldn't stop the run
            status.setdefault("errors", []).append(f"arXiv '{q}': {e}")
    mid = paper_db.get_stats()["total"]
    status["arxiv_new"] = mid - before
    for kw in QUANTUM_KEYWORDS:
        try:
            await fetch_openalex_papers(kw, 30)
        except Exception as e:
            status.setdefault("errors", []).append(f"OpenAlex '{kw}': {e}")
    status["openalex_new"] = paper_db.get_stats()["total"] - mid


def classify(status: dict) -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        status["classified"] = 0
        status["classify_note"] = "ANTHROPIC_API_KEY not set; papers left unscored"
        return
    from app.knowledge_base.paper_classifier import classify_papers
    status["classified"] = classify_papers(limit=CLASSIFY_PER_RUN)


def export_papers() -> list[dict]:
    with paper_db._get_conn() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM papers").fetchall()]

    visible = [r for r in rows if r["status"] != "skipped"]
    visible.sort(key=lambda r: (r["date"] or "", r["created_at"] or 0), reverse=True)
    keep_ids = {r["id"] for r in visible[:MAX_PAPERS]}

    out = []
    for r in rows:
        if r["status"] == "skipped" or r["id"] not in keep_ids:
            # Keep a stub so the paper isn't fetched and scored again.
            out.append({
                "id": r["id"], "title": r["title"], "url": r["url"],
                "status": "skipped", "skip_reason": r["skip_reason"] or "trimmed",
                "date": r["date"], "relevance_score": r["relevance_score"],
            })
        else:
            out.append({f: r.get(f) for f in PAPER_FIELDS})
    out.sort(key=lambda r: (r.get("date") or "", r["id"]), reverse=True)
    return out


# ── News ──────────────────────────────────────────────────────────────────────

def _news_id(item: dict) -> str:
    key = item.get("link") or item.get("title", "")
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def _news_time(item: dict) -> float:
    s = item.get("published") or ""
    for parse in (parsedate_to_datetime, datetime.fromisoformat):
        try:
            dt = parse(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except Exception:
            continue
    return item.get("fetched_at", 0)


async def refresh_news(existing: list[dict], offline: bool, status: dict) -> list[dict]:
    fresh: list[dict] = []
    if not offline:
        await tracker.refresh_news()
        now = time.time()
        fresh = [{**i, "fetched_at": now} for i in tracker.get_news(limit=10_000)]
    status["news_fetched"] = len(fresh)

    merged: dict[str, dict] = {}
    for item in existing + fresh:  # fresh wins on conflicts
        item = {**item, "id": _news_id(item)}
        merged[item["id"]] = item
    items = sorted(merged.values(), key=_news_time, reverse=True)[:MAX_NEWS]
    return items


# ── Companies ─────────────────────────────────────────────────────────────────

def export_companies(news: list[dict]) -> list[dict]:
    company_db.init_db()
    tracker._news_cache = news
    out = []
    for c in company_db.list_companies():
        papers = papers_for(c, limit=200)
        linked_news = news_for(c, limit=100)
        out.append({
            **c.to_dict(),
            "paper_ids": [p["id"] for p in papers],
            "news_ids": [n["id"] for n in linked_news],
        })
    return out


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(offline: bool) -> None:
    status: dict = {}
    restore_papers(_read("papers.json", []))

    if not offline:
        await fetch_papers(status)
        classify(status)

    papers = export_papers()
    news = await refresh_news(_read("news.json", []), offline, status)
    companies = export_companies(news)
    stock_data, status["stocks"] = stocks.refresh(companies, _read("stocks.json", {}), offline)

    visible = [p for p in papers if p["status"] != "skipped"]
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "counts": {
            "papers": len(visible),
            "papers_scored": sum(1 for p in visible if (p.get("relevance_score") or 0) > 0),
            "news": len(news),
            "companies": len(companies),
            "public_companies": sum(1 for c in companies if c["is_public"]),
            "stocks_priced": sum(1 for t in stock_data["tickers"].values() if t["history"]),
        },
        "last_run": status,
    }

    _write("papers.json", papers)
    _write("news.json", news)
    _write("companies.json", companies)
    _write("stocks.json", stock_data)
    _write("meta.json", meta)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="skip network fetches")
    args = ap.parse_args()
    try:
        asyncio.run(main(args.offline))
    finally:
        import shutil
        shutil.rmtree(_TMP, ignore_errors=True)
    sys.exit(0)
