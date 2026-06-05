import feedparser
from .base import BaseSource, RawArticle


class KDCASource(BaseSource):
    """한국 질병관리청 RSS"""
    name = "KDCA"
    language = "ko"
    FEEDS = [
        "https://www.kdca.go.kr/board/board.es?mid=a20501000000&bid=0015&act=rss",  # 보도자료
        "https://www.kdca.go.kr/board/board.es?mid=a20507020000&bid=0019&act=rss",  # 감염병 현황
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
                logger.warning(f"[KDCA] 피드 오류 {url}: {e}")
        return articles
