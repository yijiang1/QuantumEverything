import arxiv

from app.knowledge_base.paper_db import Paper, add_paper

QUANTUM_QUERIES = [
    "quantum computing algorithm optimization",
    "quantum machine learning variational",
    "quantum advantage error correction",
    "quantum simulation sensing",
    "quantum hardware qubit fidelity",
]


async def fetch_arxiv_papers(query: str | None = None, max_results: int = 20) -> int:
    queries = [query] if query else QUANTUM_QUERIES[:2]
    added = 0
    client = arxiv.Client()

    for q in queries:
        search = arxiv.Search(
            query=q,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.SubmittedDate,
        )
        for result in client.results(search):
            arxiv_id = result.entry_id.split("/")[-1]
            paper = Paper(
                title=result.title,
                authors=", ".join(a.name for a in result.authors[:8]),
                date=result.published.strftime("%Y-%m-%d"),
                journal="arXiv",
                url=result.entry_id,
                abstract=result.summary,
                arxiv_id=arxiv_id,
                source="arxiv",
            )
            if add_paper(paper) is not None:
                added += 1

    return added
