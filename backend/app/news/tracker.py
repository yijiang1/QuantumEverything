import re
from datetime import datetime
from typing import Optional

import feedparser
import httpx

from app.knowledge_base.relevance import looks_quantum

# "filter": the feed covers more than quantum, so keep only items that look quantum.
RSS_FEEDS = [
    {
        "url": "https://export.arxiv.org/rss/quant-ph",
        "source": "arXiv quant-ph",
        "category": "Research",
    },
    {
        "url": "https://quantumcomputingreport.com/feed/",
        "source": "Quantum Computing Report",
        "category": "Industry",
    },
    {
        "url": "https://thequantuminsider.com/feed/",
        "source": "The Quantum Insider",
        "category": "Industry",
    },
    {
        "url": "https://www.sciencedaily.com/rss/computers_math/quantum_computers.xml",
        "source": "ScienceDaily",
        "category": "Research",
        "filter": True,
    },
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; QuantumEverything/1.0; +https://github.com/yijiang1/QuantumEverything)",
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
}

_news_cache: list[dict] = []
_last_refresh: Optional[datetime] = None
# Per-feed result of the last refresh: item count, or the error that stopped it.
last_status: dict[str, int | str] = {}


def get_news(limit: int = 30) -> list[dict]:
    return _news_cache[:limit]


async def refresh_news() -> int:
    global _news_cache, _last_refresh, last_status

    all_items: list[dict] = []
    status: dict[str, int | str] = {}

    # Redirects are followed because feeds move (arXiv's export host forwards to rss.arxiv.org).
    async with httpx.AsyncClient(timeout=20.0, headers=HEADERS, follow_redirects=True) as client:
        for feed_info in RSS_FEEDS:
            try:
                response = await client.get(feed_info["url"])
                response.raise_for_status()
                feed = feedparser.parse(response.text)
                if not feed.entries and not feed.feed.get("title"):
                    raise ValueError("response is not a feed")
                count = 0
                for entry in feed.entries[:30]:
                    title = entry.get("title", "")
                    # Strip HTML tags from summary
                    summary = re.sub(r"<[^>]+>", "", entry.get("summary", ""))[:500]
                    if feed_info.get("filter") and not looks_quantum(title, summary):
                        continue
                    all_items.append({
                        "title": title,
                        "summary": summary,
                        "link": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "source": feed_info["source"],
                        "category": feed_info["category"],
                    })
                    count += 1
                status[feed_info["source"]] = count
            except httpx.HTTPStatusError as e:
                status[feed_info["source"]] = f"HTTP {e.response.status_code}"
            except Exception as e:
                status[feed_info["source"]] = f"{type(e).__name__}: {e}"[:200]

    _news_cache = all_items
    _last_refresh = datetime.now()
    last_status = status
    return len(all_items)
