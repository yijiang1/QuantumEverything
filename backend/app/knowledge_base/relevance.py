"""A cheap keyword check that a paper or news item is about quantum technology.

Keyword searches on arXiv and OpenAlex also return papers that only mention
"quantum" in passing (or not at all), so every fetched item has to name a
quantum-technology term in its title or abstract before it reaches the site.
Claude scoring, when an API key is set, filters further.
"""

import re

_QUANTUM_TERMS = re.compile(
    r"\bqubits?\b"
    r"|\bqudits?\b"
    r"|\bquantum[- ]("
    r"comput\w*|algorithm\w*|error[- ]correct\w*|circuit\w*|gates?|processors?|"
    r"anneal\w*|advantage|supremacy|machine[- ]learning|neural[- ]networks?|"
    r"simulat\w*|sens\w*|metrolog\w*|networks?|key[- ]distribution|communications?|"
    r"cryptograph\w*|internet|hardware|devices?|information|software|"
    r"programming|walks?|entangle\w*|memor\w*|repeaters?|photonic\w*|volume|"
    r"optimi[sz]\w*|technolog\w*|teleportation|states?|simulators?|processing"
    r")"
    r"|\bhybrid quantum[- ]classical\b"
    r"|\bpost-quantum\b"
    r"|\bvariational quantum\b"
    r"|\bQAOA\b|\bVQE\b"
    r"|\bentanglement\b",
    re.IGNORECASE,
)


def looks_quantum(title: str, abstract: str = "") -> bool:
    return bool(_QUANTUM_TERMS.search(title or "") or _QUANTUM_TERMS.search(abstract or ""))
