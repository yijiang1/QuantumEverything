"""
Curated lists the site shows as they are, checked against the company list.

    deals.json     funding rounds, acquisitions, SPAC mergers and IPOs
                   (backend/app/funding/deals.json)
    hardware.json  quantum computers and published roadmap milestones
                   (backend/app/hardware/hardware.json)
    events.json    upcoming conferences; events that have ended are dropped
                   (backend/app/events/events.json)
    learn.json     free courses, lectures, notes and tutorials
                   (backend/app/learn/resources.json)
    trends.json    historical series for the Trends page: record qubit counts,
                   gate fidelities, coherence times, quantum volume, error-
                   correction milestones and arXiv papers per year
                   (backend/app/trends/history.json)

Each entry cites a source. Links to companies that aren't in the company list
are dropped with a warning, so a typo can't break a page.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"
DEALS_PATH = APP / "funding" / "deals.json"
HARDWARE_PATH = APP / "hardware" / "hardware.json"
EVENTS_PATH = APP / "events" / "events.json"
LEARN_PATH = APP / "learn" / "resources.json"
TRENDS_PATH = APP / "trends" / "history.json"

LEVELS = ("beginner", "intermediate", "advanced")
TREND_SERIES = ("qubits", "two_qubit_fidelity", "coherence", "quantum_volume", "qec_milestones", "arxiv_quant_ph")


def _load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _check_company(row: dict, field: str, slugs: set[str], label: str) -> None:
    value = row.get(field) or ""
    if value and value not in slugs:
        print(f"{label}: {row.get('id')} links unknown company {value!r}", file=sys.stderr)
        row[field] = ""


def export_deals(companies: list[dict], path: Path = DEALS_PATH) -> list[dict]:
    slugs = {c["slug"] for c in companies}
    rows = _load(path)
    for r in rows:
        _check_company(r, "company", slugs, "deals")
        # counterparty may be a slug or a plain name; mark which
        r["counterparty_slug"] = r.get("counterparty") if r.get("counterparty") in slugs else ""
    rows = [r for r in rows if r.get("company")]
    rows.sort(key=lambda r: (r.get("date") or "", r["id"]), reverse=True)
    return rows


def export_hardware(companies: list[dict], path: Path = HARDWARE_PATH) -> list[dict]:
    slugs = {c["slug"] for c in companies}
    rows = _load(path)
    for r in rows:
        _check_company(r, "company", slugs, "hardware")
    return rows


def export_events(today: date | None = None, path: Path = EVENTS_PATH) -> list[dict]:
    today = (today or date.today()).isoformat()
    rows = [r for r in _load(path) if (r.get("end") or r.get("start") or "") >= today]
    rows.sort(key=lambda r: (r.get("start") or "", r["id"]))
    return rows


def export_learn(path: Path = LEARN_PATH) -> list[dict]:
    """Free learning resources, beginner first; rows without a web link are dropped."""
    rows = []
    for r in _load(path):
        if not str(r.get("url", "")).startswith(("https://", "http://")) or r.get("level") not in LEVELS:
            print(f"learn: skipping {r.get('id')!r} (needs a web link and a known level)", file=sys.stderr)
            continue
        r.setdefault("people", [])
        r.setdefault("topics", [])
        r.setdefault("free_note", "")
        rows.append(r)
    rows.sort(key=lambda r: (LEVELS.index(r["level"]), not r.get("confirmed"), r.get("provider", ""), r["title"]))
    return rows


def export_trends(path: Path = TRENDS_PATH) -> list[dict]:
    """Historical data points, oldest first; unknown series are dropped."""
    rows = []
    for r in _load(path):
        if r.get("series") not in TREND_SERIES or not r.get("date"):
            print(f"trends: skipping {r.get('id')!r} (unknown series or no date)", file=sys.stderr)
            continue
        for k in ("platform", "group", "description", "value_text", "source_name"):
            r.setdefault(k, "")
        rows.append(r)
    rows.sort(key=lambda r: (r["series"], r["date"], r["id"]))
    return rows
