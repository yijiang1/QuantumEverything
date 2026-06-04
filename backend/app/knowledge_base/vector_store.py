import chromadb
from app.config import CHROMA_DIR

_client = None
_collection = None


def init_vector_store():
    global _client, _collection
    _client = chromadb.PersistentClient(path=CHROMA_DIR)
    _collection = _client.get_or_create_collection("quantum_papers")


def get_collection():
    return _collection


def add_paper(paper_id: str, text: str, metadata: dict):
    _collection.upsert(
        documents=[text],
        metadatas=[metadata],
        ids=[paper_id],
    )


def search_papers(query: str, n_results: int = 5) -> list[dict]:
    count = _collection.count()
    if count == 0:
        return []
    results = _collection.query(
        query_texts=[query],
        n_results=min(n_results, count),
    )
    papers = []
    for i, doc in enumerate(results["documents"][0]):
        papers.append({
            "id": results["ids"][0][i],
            "text": doc,
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i] if results.get("distances") else None,
        })
    return papers


def list_papers(limit: int = 20, offset: int = 0) -> list[dict]:
    results = _collection.get(
        limit=limit,
        offset=offset,
        include=["documents", "metadatas"],
    )
    papers = []
    for i, doc in enumerate(results["documents"]):
        papers.append({
            "id": results["ids"][i],
            "text": doc,
            "metadata": results["metadatas"][i],
        })
    return papers


def count_papers() -> int:
    return _collection.count()


def sync_paper(paper_id: str, text: str, metadata: dict):
    """Upsert an approved paper into the semantic search index."""
    _collection.upsert(
        documents=[text],
        metadatas=[metadata],
        ids=[paper_id],
    )
