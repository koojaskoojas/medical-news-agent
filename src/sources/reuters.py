import feedparser
from .base import BaseSource, RawArticle


class ReutersSource(BaseSource):
    name = "Reuters"
    language = "en"
    FEEDS = [
        "https://feeds.reuters.com/reuters/healthNews",
        "https://feeds.reuters.com/reuters/scienceNews",
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
                logger.warning(f"[Reuters] 피드 오류 {url}: {e}")
        return articles
