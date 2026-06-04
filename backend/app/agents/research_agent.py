import json
import re
from typing import AsyncGenerator

import anthropic
from duckduckgo_search import DDGS

from app.knowledge_base.vector_store import search_papers
from app.config import ANTHROPIC_API_KEY

client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "search_web",
        "description": (
            "Search the web for current information about a topic. "
            "Use this to understand the state of the art, key challenges, and recent developments."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"}
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_knowledge_base",
        "description": (
            "Search the local quantum computing knowledge base for relevant papers. "
            "Use this to find specific quantum algorithms, experiments, and approaches."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Semantic search query for quantum papers"}
            },
            "required": ["query"],
        },
    },
]

SYSTEM_PROMPT = """You are an expert quantum computing researcher and technology analyst.
Your task is to analyze a given topic and identify concrete opportunities for quantum computing applications.

Research process:
1. Use search_web to understand the topic's core computational challenges and recent developments
2. Use search_knowledge_base to find relevant quantum computing research
3. Use search_web again to find specific quantum approaches for this domain
4. Synthesize into a structured analysis

Be specific about:
- Which quantum algorithms apply (VQE, QAOA, HHL, Grover's, QML, QSVT, quantum simulation, etc.)
- The type of advantage (exponential speedup, quadratic speedup, accuracy, noise tolerance)
- Current hardware readiness (NISQ vs fault-tolerant requirements)
- Realistic timeline

After research, output ONLY valid JSON matching this schema exactly:
{
  "opportunity_level": "Low|Medium|High|Very High",
  "opportunity_score": <float 0.0-1.0>,
  "summary": "<2-3 sentence overview>",
  "current_challenges": ["<challenge>", ...],
  "quantum_approaches": [
    {
      "name": "<Algorithm/Approach>",
      "description": "<what it is and how it applies>",
      "advantage": "<specific advantage over classical>",
      "maturity": "Theoretical|Research|Early Experiments|NISQ-era|Near-term",
      "relevant_papers": ["<title>", ...]
    }
  ],
  "key_papers": [{"title": "<title>", "relevance": "<why relevant>"}],
  "timeline": "<e.g. 2-5 years NISQ experiments, 10-15 years fault-tolerant>",
  "recommendations": ["<actionable step>", ...],
  "full_analysis": "<detailed markdown, 3-5 paragraphs>"
}"""


def _search_web(query: str) -> str:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return "No results found."
        parts = []
        for r in results:
            parts.append(f"**{r.get('title', '')}**\n{r.get('body', '')}\nSource: {r.get('href', '')}")
        return "\n\n---\n\n".join(parts)
    except Exception as e:
        return f"Search failed: {e}"


def _search_knowledge_base(query: str) -> str:
    try:
        results = search_papers(query, n_results=5)
        if not results:
            return "No relevant papers found in knowledge base. (Run arXiv sync from the Papers page to populate it.)"
        parts = []
        for r in results:
            meta = r.get("metadata", {})
            parts.append(
                f"**{meta.get('title', 'Unknown')}**\n"
                f"Authors: {meta.get('authors', 'N/A')} | Date: {meta.get('date', 'N/A')}\n"
                f"arXiv: {meta.get('arxiv_id', 'N/A')}\n"
                f"{r['text'][:400]}..."
            )
        return "\n\n---\n\n".join(parts)
    except Exception as e:
        return f"Knowledge base search failed: {e}"


async def analyze_topic(topic: str) -> AsyncGenerator[dict, None]:
    yield {"type": "status", "message": f"Starting deep research on: {topic}"}

    messages: list = [
        {
            "role": "user",
            "content": (
                f"Analyze this topic for quantum computing opportunities: **{topic}**\n\n"
                "Research thoroughly, then output valid JSON as described in your instructions."
            ),
        }
    ]

    for iteration in range(12):
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            text_content = next(
                (b.text for b in response.content if hasattr(b, "text")), ""
            )
            try:
                json_match = re.search(r"\{[\s\S]*\}", text_content)
                if json_match:
                    analysis = json.loads(json_match.group())
                    yield {"type": "result", "data": analysis}
                    return
            except (json.JSONDecodeError, AttributeError):
                pass
            # Fallback: wrap raw text
            yield {
                "type": "result",
                "data": {
                    "opportunity_level": "Unknown",
                    "opportunity_score": 0.5,
                    "summary": text_content[:500],
                    "full_analysis": text_content,
                    "current_challenges": [],
                    "quantum_approaches": [],
                    "key_papers": [],
                    "timeline": "Unknown",
                    "recommendations": [],
                },
            }
            return

        # Process tool calls
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            yield {"type": "tool_call", "tool": block.name, "input": block.input}

            if block.name == "search_web":
                result = _search_web(block.input["query"])
                yield {"type": "tool_result", "tool": block.name, "preview": result[:200]}
            elif block.name == "search_knowledge_base":
                result = _search_knowledge_base(block.input["query"])
                yield {"type": "tool_result", "tool": block.name, "preview": result[:200]}
            else:
                result = f"Unknown tool: {block.name}"

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })

        if not tool_results:
            break

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

    yield {"type": "error", "message": "Analysis did not complete — max iterations reached."}
