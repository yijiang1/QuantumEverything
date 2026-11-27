"""
Open jobs at quantum companies, for the site's Events & jobs page.

Many companies publish their openings through an applicant-tracking system
whose job board has a public, read-only JSON API that needs no key:

    greenhouse  https://boards-api.greenhouse.io/v1/boards/{token}/jobs
    lever       https://api.lever.co/v0/postings/{token}?mode=json
                (https://api.eu.lever.co/... for boards with "region": "eu")
    ashby       https://api.ashbyhq.com/posting-api/job-board/{token}

backend/app/jobs/job_boards.json says which system and board token each
company uses (edit it to add a company). Companies with no supported board
are listed with a link to their careers page instead.

If a board can't be fetched, the jobs from the previous run are kept, so a
bad day doesn't empty the page.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import httpx

BOARDS_PATH = Path(__file__).resolve().parents[1] / "app" / "jobs" / "job_boards.json"
HEADERS = {"User-Agent": "QuantumEverything-site-builder/1.0", "Accept": "application/json"}
URLS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{token}/jobs",
    "lever": "https://api.{region}lever.co/v0/postings/{token}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{token}",
}
MAX_PER_COMPANY = 150


def load_boards() -> list[dict]:
    with open(BOARDS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _text(s) -> str:
    s = unescape(str(s or ""))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def _day(value) -> str:
    """ISO date from an ISO string or a millisecond timestamp."""
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).date().isoformat()
    return str(value)[:10]


def _job(company: str, source: str, ext_id, title, location, department, url, posted, remote=False) -> dict | None:
    title = _text(title)
    if not title or not url:
        return None
    return {
        "id": f"{source}:{company}:{ext_id}",
        "company": company,
        "title": title,
        "location": _text(location),
        "department": _text(department),
        "remote": bool(remote) or bool(re.search(r"\bremote\b", _text(location), re.I)),
        "url": url,
        "posted": _day(posted),
        "source": source,
    }


def parse_greenhouse(payload: dict, company: str) -> list[dict]:
    out = []
    for j in payload.get("jobs") or []:
        dept = ", ".join(d.get("name", "") for d in j.get("departments") or [] if d)
        out.append(_job(company, "greenhouse", j.get("id"), j.get("title"),
                        (j.get("location") or {}).get("name"), dept, j.get("absolute_url"),
                        j.get("first_published") or j.get("updated_at")))
    return [j for j in out if j]


def parse_lever(payload: list, company: str) -> list[dict]:
    out = []
    for j in payload or []:
        cat = j.get("categories") or {}
        location = cat.get("location") or ", ".join(cat.get("allLocations") or [])
        out.append(_job(company, "lever", j.get("id"), j.get("text"), location,
                        cat.get("team") or cat.get("department"), j.get("hostedUrl"), j.get("createdAt"),
                        remote=j.get("workplaceType") == "remote"))
    return [j for j in out if j]


def parse_ashby(payload: dict, company: str) -> list[dict]:
    out = []
    for j in payload.get("jobs") or []:
        if j.get("isListed") is False:
            continue
        out.append(_job(company, "ashby", j.get("id"), j.get("title"), j.get("location"),
                        j.get("department") or j.get("team"), j.get("jobUrl") or j.get("applyUrl"),
                        j.get("publishedAt"), remote=j.get("isRemote")))
    return [j for j in out if j]


PARSERS = {"greenhouse": parse_greenhouse, "lever": parse_lever, "ashby": parse_ashby}


def fetch_board(client: httpx.Client, board: dict) -> list[dict]:
    # Lever hosts EU companies on a separate API host (set "region": "eu").
    region = f'{board["region"]}.' if board.get("region") else ""
    r = client.get(URLS[board["ats"]].format(token=board["token"], region=region))
    r.raise_for_status()
    jobs = PARSERS[board["ats"]](r.json(), board["company"])
    jobs.sort(key=lambda j: j["posted"], reverse=True)
    return jobs[:MAX_PER_COMPANY]


def refresh(companies: list[dict], previous: dict | None, offline: bool,
            client: httpx.Client | None = None, boards: list[dict] | None = None) -> tuple[dict, dict]:
    previous = previous or {}
    boards = boards if boards is not None else load_boards()
    slugs = {c["slug"] for c in companies}
    boards = [b for b in boards if b.get("company") in slugs]
    old_jobs: dict[str, list[dict]] = {}
    for j in previous.get("jobs") or []:
        old_jobs.setdefault(j["company"], []).append(j)
    old_boards = {b["company"]: b for b in previous.get("boards") or []}

    status = {"boards_fetched": 0, "boards_failed": []}
    own_client = client is None and not offline
    if own_client:
        client = httpx.Client(headers=HEADERS, timeout=30, follow_redirects=True)

    jobs: list[dict] = []
    board_rows = []
    try:
        for b in boards:
            row = {"company": b["company"], "ats": b.get("ats", "unknown"), "careers_url": b.get("careers_url", ""),
                   "open_roles": None, "checked": (old_boards.get(b["company"]) or {}).get("checked", "")}
            supported = b.get("ats") in PARSERS and b.get("token")
            if supported and not offline and client is not None:
                try:
                    found = fetch_board(client, b)
                    jobs += found
                    row["open_roles"] = len(found)
                    row["checked"] = datetime.now(timezone.utc).date().isoformat()
                    status["boards_fetched"] += 1
                except Exception as e:  # noqa: BLE001 - keep the previous run's jobs
                    status["boards_failed"].append({"company": b["company"], "error": str(e)[:200]})
                    kept = old_jobs.get(b["company"], [])
                    jobs += kept
                    row["open_roles"] = len(kept) if kept else (old_boards.get(b["company"]) or {}).get("open_roles")
                time.sleep(0.3)
            elif supported:
                kept = old_jobs.get(b["company"], [])
                jobs += kept
                row["open_roles"] = (old_boards.get(b["company"]) or {}).get("open_roles")
            board_rows.append(row)
    finally:
        if own_client and client is not None:
            client.close()

    jobs.sort(key=lambda j: (j.get("posted") or "", j["id"]), reverse=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "boards": board_rows,
        "jobs": jobs,
    }
    return payload, status
