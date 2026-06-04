import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.research_agent import analyze_topic

router = APIRouter()


class AnalyzeRequest(BaseModel):
    topic: str


@router.post("/analyze")
async def analyze(request: AnalyzeRequest):
    async def event_stream():
        async for event in analyze_topic(request.topic):
            yield f"data: {json.dumps(event)}\n\n"
        yield 'data: {"type": "done"}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
