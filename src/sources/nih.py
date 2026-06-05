import feedparser
from .base import BaseSource, RawArticle


class NIHSource(BaseSource):
    name = "NIH"
    language = "en"
    FEEDS = [
        "https://www.nih.gov/news-events/news-releases/feed",
        "https://www.niaid.nih.gov/news-events/news-releases/feed",  # NIAID (감염병)
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
                logger.warning(f"[NIH] 피드 오류 {url}: {e}")
        return articles
