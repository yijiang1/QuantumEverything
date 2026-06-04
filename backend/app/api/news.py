from fastapi import APIRouter

from app.news.tracker import get_news, refresh_news

router = APIRouter()


@router.get("/news")
async def list_news(limit: int = 30):
    return get_news(limit=limit)


@router.post("/news/refresh")
async def refresh():
    count = await refresh_news()
    return {"status": "ok", "count": count}
