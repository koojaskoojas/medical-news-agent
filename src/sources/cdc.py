import feedparser
from .base import BaseSource, RawArticle


class CDCSource(BaseSource):
    name = "CDC"
    language = "en"
    FEEDS = [
        "https://tools.cdc.gov/api/v2/resources/media/403372.rss",  # CDC Newsroom
        "https://emergency.cdc.gov/han/rss.asp",  # Health Alert Network
        "https://www.cdc.gov/mmwr/feeds/rss/wk.xml",  # MMWR Weekly
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
                logger.warning(f"[CDC] 피드 오류 {url}: {e}")
        return articles
