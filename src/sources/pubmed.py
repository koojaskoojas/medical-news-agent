import httpx
from .base import BaseSource, RawArticle
from datetime import datetime

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
PUBMED_ARTICLE_URL = "https://pubmed.ncbi.nlm.nih.gov/{pmid}/"

QUERIES = [
    "infectious disease outbreak",
    "pandemic epidemic surveillance",
    "emerging pathogen",
]


class PubMedSource(BaseSource):
    name = "PubMed"
    language = "en"

    async def fetch(self) -> list[RawArticle]:
        articles = []
        async with httpx.AsyncClient(timeout=15) as client:
            for query in QUERIES:
                try:
                    r = await client.get(PUBMED_SEARCH_URL, params={
                        "db": "pubmed", "term": query,
                        "retmax": 10, "retmode": "json",
                        "sort": "date",
                    })
                    ids = r.json().get("esearchresult", {}).get("idlist", [])
                    if not ids:
                        continue
                    s = await client.get(PUBMED_SUMMARY_URL, params={
                        "db": "pubmed", "id": ",".join(ids), "retmode": "json",
                    })
                    result = s.json().get("result", {})
                    for pmid in ids:
                        item = result.get(pmid, {})
                        title = item.get("title", "")
                        if not title:
                            continue
                        pub_date = item.get("pubdate", "")
                        try:
                            dt = datetime.strptime(pub_date[:10], "%Y %b %d") if len(pub_date) > 6 else None
                        except Exception:
                            dt = None
                        articles.append(RawArticle(
                            source=self.name,
                            title=title,
                            url=PUBMED_ARTICLE_URL.format(pmid=pmid),
                            published_at=dt,
                            language=self.language,
                        ))
                except Exception as e:
                    from src.utils.logger import logger
                    logger.warning(f"[PubMed] 쿼리 오류 '{query}': {e}")
        return articles
