from datetime import datetime, timedelta

import httpx

from app.knowledge_base.paper_db import Paper, add_paper

OPENALEX_BASE = "https://api.openalex.org"

# Broad quantum computing keyword queries (keyword search, not concept IDs, to stay stable)
QUANTUM_KEYWORDS = [
    "quantum computing algorithm qubit",
    "quantum error correction fault tolerant",
    "variational quantum eigensolver QAOA",
    "quantum machine learning",
    "quantum advantage supremacy",
    "quantum hardware gate fidelity",
    "quantum simulation many-body",
    "quantum sensing metrology",
    "quantum communication cryptography",
]


def _reconstruct_abstract(inverted_index: dict | None) -> str:
    """OpenAlex returns abstracts as {word: [positions]}; reconstruct to plain text."""
    if not inverted_index:
        return ""
    positions: dict[int, str] = {}
    for word, pos_list in inverted_index.items():
        for pos in pos_list:
            positions[pos] = word
    return " ".join(positions[k] for k in sorted(positions))


def _parse_authors(authorships: list) -> str:
    names = [
        a.get("author", {}).get("display_name", "")
        for a in authorships[:8]
        if a.get("author", {}).get("display_name")
    ]
    return ", ".join(names)


def _parse_journal(primary_location: dict | None) -> str:
    if not primary_location:
        return ""
    source = primary_location.get("source") or {}
    return source.get("display_name", "")


async def fetch_openalex_papers(keyword: str | None = None, lookback_days: int = 90) -> int:
    from_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    keywords = [keyword] if keyword else QUANTUM_KEYWORDS[:4]
    added = 0

    async with httpx.AsyncClient(timeout=20.0, headers={"User-Agent": "QuantumEverything/1.0"}) as client:
        for kw in keywords:
            try:
                resp = await client.get(
                    f"{OPENALEX_BASE}/works",
                    params={
                        "search": kw,
                        "filter": f"type:article,from_publication_date:{from_date}",
                        "sort": "publication_date:desc",
                        "per_page": 25,
                        "select": (
                            "id,title,authorships,publication_date,"
                            "primary_location,abstract_inverted_index,doi"
                        ),
                    },
                )
                resp.raise_for_status()
                works = resp.json().get("results", [])
            except Exception:
                continue

            for work in works:
                title = (work.get("title") or "").strip()
                if not title:
                    continue

                doi = (work.get("doi") or "").strip()
                url = doi if doi.startswith("https://") else (f"https://doi.org/{doi.lstrip('/')}" if doi else "")

                paper = Paper(
                    title=title,
                    authors=_parse_authors(work.get("authorships", [])),
                    date=work.get("publication_date", ""),
                    journal=_parse_journal(work.get("primary_location")),
                    url=url,
                    abstract=_reconstruct_abstract(work.get("abstract_inverted_index")),
                    openalex_id=work.get("id", ""),
                    source="openalex",
                )
                if add_paper(paper) is not None:
                    added += 1

    return added
