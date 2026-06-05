import asyncio
import os
from datetime import datetime, timezone
from src.sources.who import WHOSource
from src.sources.cdc import CDCSource
from src.sources.nih import NIHSource
from src.sources.pubmed import PubMedSource
from src.sources.medicalxpress import MedicalXpressSource
from src.sources.google_news import GoogleNewsSource
from src.sources.reuters import ReutersSource
from src.sources.kdca import KDCASource
from src.agents.crawler import crawl_article
from src.agents.summarizer import summarize
from src.agents.classifier import classify
from src.utils.text_cleaner import compute_hash
from src.db.client import get_client
from src.db.models import NewsArticle
from src.utils.logger import logger

MAX_PER_SOURCE = int(os.getenv("MAX_ARTICLES_PER_SOURCE", "50"))

ALL_SOURCES = [
    WHOSource(), CDCSource(), NIHSource(), PubMedSource(),
    MedicalXpressSource(), GoogleNewsSource(), ReutersSource(), KDCASource(),
]


async def _fetch_all_sources() -> list:
    tasks = [src.fetch() for src in ALL_SOURCES]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles = []
    for i, result in enumerate(results):
        src_name = ALL_SOURCES[i].name
        if isinstance(result, Exception):
            logger.error(f"[Collector] {src_name} 수집 실패: {result}")
        else:
            sliced = result[:MAX_PER_SOURCE]
            logger.info(f"[Collector] {src_name}: {len(sliced)}건 수집")
            articles.extend(sliced)
    return articles


def _deduplicate(articles: list) -> list:
    seen_hashes = set()
    seen_urls = set()
    unique = []
    for a in articles:
        h = compute_hash(a.title, a.summary or "")
        if h in seen_hashes or a.url in seen_urls:
            continue
        seen_hashes.add(h)
        seen_urls.add(a.url)
        a._hash = h
        unique.append(a)
    logger.info(f"[Collector] 중복 제거 후: {len(unique)}건 (원본: {len(articles)}건)")
    return unique


async def _is_already_stored(url: str) -> bool:
    try:
        db = get_client()
        res = db.table("news_articles").select("id").eq("url", url).limit(1).execute()
        return len(res.data) > 0
    except Exception:
        return False


async def _process_article(raw_article) -> dict | None:
    """단일 기사 크롤링 → 요약 → 분류 → DB 저장."""
    if not raw_article.title or not raw_article.url:
        return None

    if await _is_already_stored(raw_article.url):
        logger.debug(f"[Collector] 이미 저장됨: {raw_article.url}")
        return None

    content = await crawl_article(raw_article.url)
    text_for_llm = content or raw_article.summary or ""

    llm_result = await summarize(raw_article.title, text_for_llm, raw_article.language)
    cls_result = await classify(
        raw_article.title,
        llm_result.get("summary", ""),
        llm_result.get("diseases", []),
    )

    article = NewsArticle(
        source=raw_article.source,
        title=raw_article.title,
        url=raw_article.url,
        published_at=raw_article.published_at,
        content=content,
        summary=llm_result.get("summary", ""),
        keywords=llm_result.get("keywords", []),
        diseases=llm_result.get("diseases", []),
        risk_level=cls_result.get("risk_level", "unknown"),
        category=cls_result.get("category", "other"),
        language=raw_article.language,
        is_processed=True,
        content_hash=compute_hash(raw_article.title, content),
    )

    try:
        db = get_client()
        db.table("news_articles").upsert(
            article.model_dump(mode="json"),
            on_conflict="url",
        ).execute()
        logger.info(f"[Collector] 저장: [{cls_result.get('risk_level','?').upper()}] {raw_article.title[:60]}")
        return article.model_dump()
    except Exception as e:
        logger.error(f"[Collector] DB 저장 오류: {e}")
        return None


async def run_collection() -> dict:
    """전체 수집 파이프라인 실행."""
    start = datetime.now(timezone.utc)
    logger.info("=== 의료 뉴스 수집 시작 ===")

    raw_articles = await _fetch_all_sources()
    unique_articles = _deduplicate(raw_articles)

    # 동시 처리 (세마포어로 LLM 과부하 방지)
    sem = asyncio.Semaphore(5)

    async def bounded(article):
        async with sem:
            return await _process_article(article)

    results = await asyncio.gather(*[bounded(a) for a in unique_articles], return_exceptions=True)
    saved = [r for r in results if r and not isinstance(r, Exception)]

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    logger.info(f"=== 수집 완료: {len(saved)}건 저장, {elapsed:.1f}초 ===")

    return {
        "total_fetched": len(raw_articles),
        "unique": len(unique_articles),
        "saved": len(saved),
        "elapsed_seconds": elapsed,
    }
