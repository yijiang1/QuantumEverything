import arxiv

from app.knowledge_base.paper_db import Paper, add_paper
from app.knowledge_base.relevance import looks_quantum

# arXiv search syntax. Plain words are matched one by one across all of arXiv,
# which returned computer-vision and robotics papers, so each query is limited
# to the quant-ph category and a phrase in the abstract.
QUANTUM_QUERIES = [
    'cat:quant-ph AND abs:"quantum computing"',
    'cat:quant-ph AND abs:"error correction"',
    'cat:quant-ph AND abs:"quantum algorithm"',
    'cat:quant-ph AND (abs:qubit OR abs:qubits)',
    'cat:quant-ph AND abs:"quantum machine learning"',
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
            if not looks_quantum(result.title, result.summary):
                continue
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
