import httpx
from readability import Document
from src.utils.text_cleaner import clean_text, truncate
from src.utils.logger import logger

TIMEOUT = 15
MAX_CONTENT = 8000
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MedNewsBot/1.0; +https://github.com/your-repo)"
}


async def crawl_article(url: str) -> str:
    """URL에서 본문을 추출하고 정제하여 반환."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            doc = Document(resp.text)
            content = clean_text(doc.summary())
            return truncate(content, MAX_CONTENT)
    except httpx.TimeoutException:
        logger.warning(f"[Crawler] 타임아웃: {url}")
        return ""
    except Exception as e:
        logger.warning(f"[Crawler] 오류 {url}: {e}")
        return ""
