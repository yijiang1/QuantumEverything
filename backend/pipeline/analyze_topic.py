"""
Run the research agent on one topic and save the report for the static site.

    python -m pipeline.analyze_topic "tomography reconstruction"

Needs ANTHROPIC_API_KEY. Writes frontend/public/data/analyses/<slug>.json and
updates analyses/index.json. The "Analyze a topic" GitHub Actions workflow runs
this and commits the result, since a static site can't call the API itself.
"""

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DATA = REPO_ROOT / "frontend" / "public" / "data"
ANALYSES = SITE_DATA / "analyses"


def slugify(topic: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    return s[:60] or "topic"


def keyword_search(papers: list[dict]):
    """Simple keyword ranking over papers.json, standing in for ChromaDB."""
    visible = [p for p in papers if p.get("status") != "skipped"]

    def search(query: str, n: int) -> list[dict]:
        terms = [t for t in re.findall(r"\w+", query.lower()) if len(t) > 2]
        scored = []
        for p in visible:
            hay = " ".join([p.get("title") or "", p.get("abstract") or "", p.get("summary") or ""]).lower()
            hits = sum(hay.count(t) for t in terms)
            if hits:
                scored.append((hits + (p.get("relevance_score") or 0) / 10, p))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {
                "text": f"Title: {p['title']}\n\nAbstract: {p.get('abstract') or ''}",
                "metadata": {
                    "title": p["title"], "authors": p.get("authors", ""),
                    "date": p.get("date", ""), "arxiv_id": p.get("arxiv_id", ""),
                },
            }
            for _, p in scored[:n]
        ]

    return search


async def main(topic: str) -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set", file=sys.stderr)
        return 1

    from app.agents import research_agent

    papers_path = SITE_DATA / "papers.json"
    papers = json.loads(papers_path.read_text(encoding="utf-8")) if papers_path.exists() else []
    research_agent.knowledge_base_search = keyword_search(papers)

    result, steps = None, []
    async for ev in research_agent.analyze_topic(topic):
        if ev["type"] == "tool_call":
            steps.append({"tool": ev["tool"], "query": ev["input"].get("query", "")})
            print(f"  {ev['tool']}: {ev['input'].get('query', '')}")
        elif ev["type"] == "result":
            result = ev["data"]
        elif ev["type"] == "error":
            print(ev["message"], file=sys.stderr)
            return 1
    if result is None:
        return 1

    slug = slugify(topic)
    report = {
        "slug": slug,
        "topic": topic,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "research_steps": steps,
        "result": result,
    }
    ANALYSES.mkdir(parents=True, exist_ok=True)
    (ANALYSES / f"{slug}.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    index_path = ANALYSES / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    index = [e for e in index if e["slug"] != slug]
    index.insert(0, {
        "slug": slug,
        "topic": topic,
        "generated_at": report["generated_at"],
        "opportunity_level": result.get("opportunity_level", ""),
        "opportunity_score": result.get("opportunity_score", 0),
        "summary": result.get("summary", ""),
    })
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Saved analyses/{slug}.json")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print('usage: python -m pipeline.analyze_topic "<topic>"', file=sys.stderr)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1].strip())))
