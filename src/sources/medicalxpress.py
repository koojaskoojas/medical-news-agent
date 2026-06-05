import feedparser
from .base import BaseSource, RawArticle


class MedicalXpressSource(BaseSource):
    name = "MedicalXpress"
    language = "en"
    FEEDS = [
        "https://medicalxpress.com/rss-feed/",
        "https://medicalxpress.com/rss-feed/medical-research-news/",
        "https://medicalxpress.com/rss-feed/diseases-conditions-news/",
    ]

    async def fetch(self) -> list[RawArticle]:
        articles = []
        for url in self.FEEDS:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries:
                    articles.append(RawArticle(
                        source=self.name,
                        title=entry.get("title", "").strip(),
                        url=entry.get("link", ""),
                        published_at=self._safe_date(entry.get("published")),
                        summary=entry.get("summary", ""),
                        language=self.language,
                    ))
            except Exception as e:
                from src.utils.logger import logger
                logger.warning(f"[MedicalXpress] 피드 오류 {url}: {e}")
        return articles
