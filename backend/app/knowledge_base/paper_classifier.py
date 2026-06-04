"""
Batch-classify pending quantum papers using Claude Haiku.
Assigns relevance_score, paper_type, quantum_area, hardware_platform,
quantum_advantage, and summary.  Papers scoring < 4 are auto-skipped.
"""

import json
import re

import anthropic

from app.config import ANTHROPIC_API_KEY
from app.knowledge_base import paper_db

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_PROMPT = """\
You are a quantum computing researcher reviewing papers for a curated knowledge base.

Paper:
Title: {title}
Authors: {authors}
Abstract: {abstract}

Classify this paper and return ONLY valid JSON (no markdown fences), matching this exact schema:
{{
  "relevance_score": <integer 0-10>,
  "paper_type": "<algorithm|hardware|error_correction|simulation|ml_quantum|application|review|other>",
  "quantum_area": "<comma-separated subset of: quantum_computing,quantum_ml,quantum_sensing,quantum_communication,quantum_simulation,quantum_cryptography,quantum_hardware>",
  "hardware_platform": "<comma-separated subset of: superconducting,trapped_ion,photonic,neutral_atom,annealing,spin,other — empty string if not discussed>",
  "quantum_advantage": "<proven|claimed|theoretical|none>",
  "summary": "<2–3 sentence summary of the quantum computing contribution>"
}}

Relevance score guide:
9–10  Core QC contribution: novel algorithm, qubit hardware advance, fault-tolerant computation
7–8   Strong contribution: variational methods, NISQ applications, quantum ML breakthrough
5–6   Quantum-adjacent: classical methods directly applicable to quantum, QC benchmarking tools
3–4   Loosely related: could inspire quantum approaches but is primarily classical
0–2   Not relevant to quantum computing"""


def classify_papers(limit: int = 20) -> int:
    """Classify up to `limit` pending unclassified papers. Returns number classified."""
    papers = paper_db.get_pending_unclassified(limit=limit)
    classified = 0

    for paper in papers:
        abstract = (paper.abstract or "No abstract available.")[:1500]
        prompt = _PROMPT.format(
            title=paper.title,
            authors=paper.authors or "Unknown",
            abstract=abstract,
        )

        try:
            resp = _client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (resp.content[0].text if resp.content else "").strip()

            json_match = re.search(r"\{[\s\S]*\}", text)
            if not json_match:
                continue

            data = json.loads(json_match.group())
            score = float(data.get("relevance_score", 0))

            updates: dict = {
                "relevance_score": score,
                "paper_type": data.get("paper_type", "other"),
                "quantum_area": data.get("quantum_area", ""),
                "hardware_platform": data.get("hardware_platform", ""),
                "quantum_advantage": data.get("quantum_advantage", "none"),
                "summary": data.get("summary", ""),
            }

            if score < 4:
                updates["status"] = "skipped"
                updates["skip_reason"] = f"Low relevance score ({score}/10)"

            paper_db.update_paper(paper.id, **updates)
            classified += 1

        except Exception:
            continue

    return classified
