import feedparser
from .base import BaseSource, RawArticle

HEALTH_TOPICS = [
    ("Health", "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ"),
    ("Infectious Disease", "https://news.google.com/rss/search?q=infectious+disease+outbreak&hl=en-US&gl=US&ceid=US:en"),
    ("Pandemic", "https://news.google.com/rss/search?q=pandemic+epidemic+virus&hl=en-US&gl=US&ceid=US:en"),
]


class GoogleNewsSource(BaseSource):
    name = "GoogleNews"
    language = "en"

    async def fetch(self) -> list[RawArticle]:
        articles = []
        for topic_name, url in HEALTH_TOPICS:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries:
                    articles.append(RawArticle(
                        source=f"{self.name}:{topic_name}",
                        title=entry.get("title", "").strip(),
                        url=entry.get("link", ""),
                        published_at=self._safe_date(entry.get("published")),
                        summary=entry.get("summary", ""),
                        language=self.language,
                    ))
            except Exception as e:
                from src.utils.logger import logger
                logger.warning(f"[GoogleNews] 피드 오류 {topic_name}: {e}")
        return articles
