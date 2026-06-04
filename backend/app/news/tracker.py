from datetime import datetime
from typing import Optional

import feedparser
import httpx

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
]

_news_cache: list[dict] = []
_last_refresh: Optional[datetime] = None


def get_news(limit: int = 30) -> list[dict]:
    return _news_cache[:limit]


async def refresh_news() -> int:
    global _news_cache, _last_refresh

    all_items: list[dict] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for feed_info in RSS_FEEDS:
            try:
                response = await client.get(feed_info["url"])
                feed = feedparser.parse(response.text)
                for entry in feed.entries[:20]:
                    summary = entry.get("summary", "")
                    # Strip HTML tags from summary
                    import re
                    summary = re.sub(r"<[^>]+>", "", summary)[:500]
                    all_items.append({
                        "title": entry.get("title", ""),
                        "summary": summary,
                        "link": entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "source": feed_info["source"],
                        "category": feed_info["category"],
                    })
            except Exception:
                continue

    _news_cache = all_items
    _last_refresh = datetime.now()
    return len(all_items)
