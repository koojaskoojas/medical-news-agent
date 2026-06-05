from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class RawArticle:
    source: str
    title: str
    url: str
    published_at: Optional[datetime] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    language: str = "en"


class BaseSource(ABC):
    name: str = "base"
    language: str = "en"

    @abstractmethod
    async def fetch(self) -> list[RawArticle]:
        """소스에서 최신 기사 목록을 가져온다."""
        ...

    def _safe_date(self, raw) -> Optional[datetime]:
        if raw is None:
            return None
        if isinstance(raw, datetime):
            return raw
        try:
            import email.utils
            parsed = email.utils.parsedate_to_datetime(str(raw))
            return parsed
        except Exception:
            pass
        try:
            from dateutil import parser as dp
            return dp.parse(str(raw))
        except Exception:
            return None
