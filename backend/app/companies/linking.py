"""Link companies to the papers and news items that mention them."""

from app.companies.db import Company, alias_pattern, mentions
from app.knowledge_base import paper_db
from app.news.tracker import get_news


def _terms(company: Company) -> list[str]:
    return company.aliases or [company.name]


def papers_for(company: Company, limit: int = 50) -> list[dict]:
    pattern = alias_pattern(_terms(company))
    out = []
    for p in paper_db.find_papers_mentioning(_terms(company)):
        if mentions(pattern, p.title, p.abstract, p.authors, p.summary):
            out.append(p.__dict__)
            if len(out) >= limit:
                break
    return out


def news_for(company: Company, limit: int = 30) -> list[dict]:
    pattern = alias_pattern(_terms(company))
    out = []
    for item in get_news(limit=10_000):
        if mentions(pattern, item.get("title", ""), item.get("summary", "")):
            out.append(item)
            if len(out) >= limit:
                break
    return out


def mention_counts(companies: list[Company]) -> dict[str, dict[str, int]]:
    """Paper and news mention counts per company slug, for the directory view."""
    news = get_news(limit=10_000)
    counts: dict[str, dict[str, int]] = {}
    for c in companies:
        pattern = alias_pattern(_terms(c))
        n_papers = sum(
            1 for p in paper_db.find_papers_mentioning(_terms(c), limit=1000)
            if mentions(pattern, p.title, p.abstract, p.authors, p.summary)
        )
        n_news = sum(
            1 for item in news
            if mentions(pattern, item.get("title", ""), item.get("summary", ""))
        )
        counts[c.slug] = {"papers": n_papers, "news": n_news}
    return counts
