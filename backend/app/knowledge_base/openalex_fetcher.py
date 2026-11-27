import os
from datetime import datetime, timedelta

import httpx

from app.knowledge_base.paper_db import Paper, add_paper
from app.knowledge_base.relevance import looks_quantum

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
    """Add recent OpenAlex articles matching a keyword. Raises if every request fails."""
    today = datetime.now()
    from_date = (today - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")
    keywords = [keyword] if keyword else QUANTUM_KEYWORDS[:4]
    added = 0
    errors: list[str] = []
    # OpenAlex gives keyless requests a small daily budget shared per IP address.
    api_key = os.getenv("OPENALEX_API_KEY", "").strip()

    async with httpx.AsyncClient(timeout=20.0, headers={"User-Agent": "QuantumEverything/1.0"}) as client:
        for kw in keywords:
            try:
                resp = await client.get(
                    f"{OPENALEX_BASE}/works",
                    params={
                        # Match the words in the title or abstract only. Plain "search"
                        # also matches full text, which let in papers on wastewater and
                        # medicinal plants. The upper date bound keeps out journal
                        # issues dated months ahead, which sorted above everything else.
                        "filter": (
                            f"type:article,title_and_abstract.search:{kw},"
                            f"from_publication_date:{from_date},to_publication_date:{to_date}"
                        ),
                        "sort": "publication_date:desc",
                        "per_page": 25,
                        "select": (
                            "id,title,authorships,publication_date,"
                            "primary_location,abstract_inverted_index,doi"
                        ),
                        **({"api_key": api_key} if api_key else {}),
                    },
                )
                resp.raise_for_status()
                works = resp.json().get("results", [])
            except httpx.HTTPStatusError as e:
                # Not str(e): the request URL can carry the API key, and errors end up in meta.json.
                errors.append(f"{kw}: HTTP {e.response.status_code}")
                continue
            except Exception as e:
                errors.append(f"{kw}: {type(e).__name__}")
                continue

            for work in works:
                title = (work.get("title") or "").strip()
                abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))
                if not title or not looks_quantum(title, abstract):
                    continue

                doi = (work.get("doi") or "").strip()
                url = doi if doi.startswith("https://") else (f"https://doi.org/{doi.lstrip('/')}" if doi else "")

                paper = Paper(
                    title=title,
                    authors=_parse_authors(work.get("authorships", [])),
                    date=work.get("publication_date", ""),
                    journal=_parse_journal(work.get("primary_location")),
                    url=url,
                    abstract=abstract,
                    openalex_id=work.get("id", ""),
                    source="openalex",
                )
                if add_paper(paper) is not None:
                    added += 1

    if errors and len(errors) == len(keywords):
        raise RuntimeError("; ".join(errors))
    return added
