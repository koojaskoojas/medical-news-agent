import feedparser
from .base import BaseSource, RawArticle


class WHOSource(BaseSource):
    name = "WHO"
    language = "en"
    FEEDS = [
        "https://www.who.int/rss-feeds/news-english.xml",
        "https://www.who.int/feeds/entity/csr/don/en/rss.xml",  # Disease Outbreak News
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
                logger.warning(f"[WHO] 피드 오류 {url}: {e}")
        return articles
