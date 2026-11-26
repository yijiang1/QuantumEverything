from fastapi import APIRouter, HTTPException

from app.companies import db
from app.companies.linking import mention_counts, news_for, papers_for

router = APIRouter()


@router.get("/companies")
async def list_companies(
    search: str = "",
    category: str = "",
    platform: str = "",
    public_only: bool = False,
):
    companies = db.list_companies(
        search=search, category=category, platform=platform, public_only=public_only
    )
    counts = mention_counts(companies)
    return [
        {**c.to_dict(), "mentions": counts.get(c.slug, {"papers": 0, "news": 0})}
        for c in companies
    ]


@router.get("/companies/meta")
async def companies_meta():
    """Filter options for the directory page."""
    all_companies = db.list_companies()
    by_category: dict[str, int] = {}
    for c in all_companies:
        by_category[c.category] = by_category.get(c.category, 0) + 1
    return {
        "total": len(all_companies),
        "public": sum(1 for c in all_companies if c.is_public),
        "categories": db.CATEGORIES,
        "platforms": db.PLATFORMS,
        "by_category": by_category,
    }


@router.get("/companies/{slug}")
async def get_company(slug: str):
    company = db.get_company(slug)
    if not company:
        raise HTTPException(404, "Company not found")

    related = []
    # Parent and subsidiaries, so e.g. IonQ links to Oxford Ionics and back.
    for other in db.list_companies():
        if other.slug == company.slug:
            continue
        if other.parent and other.parent == company.name.split(" (")[0]:
            related.append({"slug": other.slug, "name": other.name, "relation": "subsidiary"})
        elif company.parent and other.name == company.parent:
            related.append({"slug": other.slug, "name": other.name, "relation": "parent"})

    return {
        **company.to_dict(),
        "related": related,
        "papers": papers_for(company),
        "news": news_for(company),
    }
