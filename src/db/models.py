from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional
from datetime import datetime


class NewsArticle(BaseModel):
    source: str
    title: str
    url: str
    published_at: Optional[datetime] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    keywords: list[str] = []
    diseases: list[str] = []
    risk_level: Optional[str] = "unknown"
    category: Optional[str] = None
    language: str = "en"
    is_processed: bool = False
    content_hash: Optional[str] = None

    @field_validator("risk_level")
    @classmethod
    def validate_risk(cls, v):
        allowed = {"critical", "high", "medium", "low", "unknown", None}
        return v if v in allowed else "unknown"


class DailyReport(BaseModel):
    report_date: str
    total_articles: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    top_diseases: list[str] = []
    top_keywords: list[str] = []
    report_markdown: Optional[str] = None
    report_json: Optional[dict] = None
