"""
Curated lists the site shows as they are, checked against the company list.

    deals.json     funding rounds, acquisitions, SPAC mergers and IPOs
                   (backend/app/funding/deals.json)
    hardware.json  quantum computers and published roadmap milestones
                   (backend/app/hardware/hardware.json)
    events.json    upcoming conferences; events that have ended are dropped
                   (backend/app/events/events.json)

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
