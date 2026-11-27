"""
Quantum policy data for the site's Policy page.

Three parts, all from free public sources that need no API key:

    programs        national quantum programs, from backend/app/policy/programs.json
                    (curated by hand: edit that file to add or correct a program)
    us_actions      US laws, executive orders, standards and tracked bills, from
                    backend/app/policy/us_actions.json. Each run refreshes a bill's
                    latest action from govinfo.gov's bill status files.
    federal_register  recent Federal Register documents (rules, proposed rules,
                    notices, presidential documents) that mention quantum
                    technology, from the Federal Register API.

Companies are linked to Federal Register documents and bills that name them,
using the same alias matching as papers and news.
"""

from __future__ import annotations

import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

POLICY_DIR = Path(__file__).resolve().parents[1] / "app" / "policy"

FR_API = "https://www.federalregister.gov/api/v1/documents.json"
FR_PHRASES = [
    '"quantum computing"', '"quantum computer"', '"quantum computers"', '"post-quantum"',
    '"quantum information science"', '"quantum technology"', '"quantum technologies"',
    '"quantum sensing"', '"quantum network"', '"quantum cryptography"',
]
FR_FIELDS = ["title", "type", "abstract", "document_number", "html_url", "publication_date",
             "agencies", "citation", "subtype"]
FR_FIRST_YEARS = 3   # look-back on the first run
FR_UPDATE_DAYS = 45  # look-back on later runs
FR_MAX = 300

BILLSTATUS_URL = "https://www.govinfo.gov/bulkdata/BILLSTATUS/{congress}/{type}/BILLSTATUS-{congress}{type}{number}.xml"
CONGRESS_URL = "https://www.congress.gov/bill/{congress}th-congress/{chamber}/{number}"
CHAMBER_PATH = {"hr": "house-bill", "s": "senate-bill", "hres": "house-resolution",
                "sres": "senate-resolution", "hjres": "house-joint-resolution",
                "sjres": "senate-joint-resolution"}

HEADERS = {"User-Agent": "QuantumEverything-site-builder/1.0", "Accept": "application/json, application/xml"}

STAGES = ["introduced", "committee", "reported", "passed_one", "passed_both", "law"]


def load_curated() -> tuple[list[dict], list[dict]]:
    with open(POLICY_DIR / "programs.json", encoding="utf-8") as f:
        programs = json.load(f)
    with open(POLICY_DIR / "us_actions.json", encoding="utf-8") as f:
        actions = json.load(f)
    return programs, actions


# ── Bills ─────────────────────────────────────────────────────────────────────

def bill_url(b: dict) -> str:
    return CONGRESS_URL.format(congress=b["congress"], chamber=CHAMBER_PATH.get(b["bill_type"], "bill"),
                               number=b["number"])


def stage_from_actions(texts: list[str], has_law: bool) -> str:
    """Furthest stage a bill reached, judged from its action texts."""
    if has_law or any(re.search(r"became public law|signed by president", t, re.I) for t in texts):
        return "law"
    passed_house = any(re.search(r"passed(/agreed to)? in (the )?house|passed house", t, re.I) for t in texts)
    passed_senate = any(re.search(r"passed(/agreed to)? in (the )?senate|passed senate", t, re.I) for t in texts)
    if passed_house and passed_senate:
        return "passed_both"
    if passed_house or passed_senate:
        return "passed_one"
    if any(re.search(r"reported|ordered to be reported|placed on .*calendar", t, re.I) for t in texts):
        return "reported"
    if any(re.search(r"referred to", t, re.I) for t in texts):
        return "committee"
    return "introduced"


def parse_billstatus(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    bill = root.find("bill")
    if bill is None:
        raise ValueError("no <bill> element")

    def text(path: str) -> str:
        el = bill.find(path)
        return (el.text or "").strip() if el is not None else ""

    sponsor = bill.find("sponsors/item")
    actions = [(a.findtext("actionDate") or "", (a.findtext("text") or "").strip())
               for a in bill.findall("actions/item")]
    laws = [f"Pub. L. {(l.findtext('number') or '').strip()}" for l in bill.findall("laws/item")]
    latest = {"date": text("latestAction/actionDate"), "text": text("latestAction/text")}
    return {
        "title": text("title"),
        "introduced": text("introducedDate"),
        "sponsor": (sponsor.findtext("fullName") or "").strip() if sponsor is not None else "",
        "latest_action": latest,
        "stage": stage_from_actions([t for _, t in actions] + [latest["text"]], bool(laws)),
        "laws": laws,
    }


def refresh_bills(client: httpx.Client | None, actions: list[dict], status: dict) -> list[dict]:
    out = []
    for a in actions:
        a = dict(a)
        if a.get("kind") == "bill":
            a.setdefault("url", bill_url(a))
            if client is not None:
                url = BILLSTATUS_URL.format(congress=a["congress"], type=a["bill_type"], number=a["number"])
                try:
                    r = client.get(url)
                    r.raise_for_status()
                    fresh = parse_billstatus(r.text)
                    for k in ("title", "introduced", "sponsor", "latest_action", "stage"):
                        if fresh.get(k):
                            a[k] = fresh[k]
                    if fresh["laws"]:
                        a["reference"] = ", ".join(fresh["laws"])
                    a["checked"] = date.today().isoformat()
                    status["bills_refreshed"] += 1
                except Exception as e:  # noqa: BLE001 - keep the curated status
                    status["bills_failed"].append({"bill": a["id"], "error": str(e)[:200]})
                time.sleep(0.3)
        out.append(a)
    return out


# ── Federal Register ─────────────────────────────────────────────────────────

def parse_fr_results(payload: dict) -> list[dict]:
    out = []
    for d in payload.get("results") or []:
        if not d.get("document_number") or not d.get("title"):
            continue
        out.append({
            "id": d["document_number"],
            "title": d["title"].strip(),
            "type": d.get("type") or "",
            "subtype": d.get("subtype") or "",
            "abstract": (d.get("abstract") or "").strip(),
            "date": d.get("publication_date") or "",
            "agencies": [a.get("name") or a.get("raw_name") or "" for a in d.get("agencies") or [] if a],
            "citation": d.get("citation") or "",
            "url": d.get("html_url") or "",
        })
    return out


def fetch_federal_register(client: httpx.Client, since: str) -> list[dict]:
    found: dict[str, dict] = {}
    for phrase in FR_PHRASES:
        params = [("conditions[term]", phrase), ("conditions[publication_date][gte]", since),
                  ("order", "newest"), ("per_page", "100")] + [("fields[]", f) for f in FR_FIELDS]
        r = client.get(FR_API, params=params)
        r.raise_for_status()
        for d in parse_fr_results(r.json()):
            found[d["id"]] = d
        time.sleep(0.3)
    return list(found.values())


def merge_fr(old: list[dict], new: list[dict]) -> list[dict]:
    merged = {d["id"]: d for d in old}
    merged.update({d["id"]: d for d in new})
    return sorted(merged.values(), key=lambda d: (d.get("date") or "", d["id"]), reverse=True)[:FR_MAX]


# ── Company links ────────────────────────────────────────────────────────────

def link_companies(items: list[dict], companies: list[dict], fields: tuple[str, ...]) -> None:
    """Add a `companies` list of slugs to each item that names a company."""
    from app.companies.db import alias_pattern, mentions

    patterns = [(c["slug"], alias_pattern(c.get("aliases") or [c["name"]])) for c in companies]
    for item in items:
        texts = [str(item.get(f) or "") for f in fields]
        item["companies"] = [slug for slug, pat in patterns if mentions(pat, *texts)]


# ── Entry point ──────────────────────────────────────────────────────────────

def refresh(companies: list[dict], previous: dict | None, offline: bool,
            client: httpx.Client | None = None) -> tuple[dict, dict]:
    previous = previous or {}
    programs, actions = load_curated()
    status = {"bills_refreshed": 0, "bills_failed": [], "federal_register_fetched": None,
              "federal_register_error": None}

    own_client = client is None and not offline
    if own_client:
        client = httpx.Client(headers=HEADERS, timeout=30, follow_redirects=True)
    fr = previous.get("federal_register") or []
    try:
        # Keep the latest bill status from the previous run if this run can't fetch.
        prev_bills = {a["id"]: a for a in previous.get("us_actions") or [] if a.get("kind") == "bill"}
        seeded = []
        for a in actions:
            p = prev_bills.get(a["id"])
            if p and (p.get("latest_action") or {}).get("date", "") > (a.get("latest_action") or {}).get("date", ""):
                a = {**a, **{k: p[k] for k in ("title", "sponsor", "introduced", "latest_action", "stage", "reference", "checked") if k in p}}
            seeded.append(a)
        actions = refresh_bills(None if offline else client, seeded, status)

        if not offline:
            days = FR_UPDATE_DAYS if fr else 365 * FR_FIRST_YEARS
            since = (date.today() - timedelta(days=days)).isoformat()
            try:
                new = fetch_federal_register(client, since)
                status["federal_register_fetched"] = len(new)
                fr = merge_fr(fr, new)
            except Exception as e:  # noqa: BLE001
                status["federal_register_error"] = str(e)[:200]
    finally:
        if own_client and client is not None:
            client.close()

    link_companies(fr, companies, ("title", "abstract"))
    link_companies(actions, companies, ("title", "summary"))
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "programs": programs,
        "us_actions": actions,
        "federal_register": fr,
    }
    return payload, status
