import os
import json
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from src.utils.logger import logger

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
TIMEOUT = int(os.getenv("LLM_TIMEOUT", "30"))

SYSTEM_PROMPT = """You are a medical news analyst. Analyze the given article and return a JSON object with exactly these fields:
- summary: 3-sentence summary in the article's language
- keywords: list of 5 key terms (strings)
- diseases: list of disease/pathogen names mentioned (strings, empty list if none)
Do not include any text outside the JSON object."""

USER_PROMPT_EN = """Article title: {title}

Article content:
{content}

Return only valid JSON."""

USER_PROMPT_KO = """기사 제목: {title}

기사 내용:
{content}

유효한 JSON만 반환하세요."""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def summarize(title: str, content: str, language: str = "en") -> dict:
    """LLM으로 요약·키워드·질병명 추출. 실패 시 빈 결과 반환."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        logger.error("[Summarizer] OPENROUTER_API_KEY 미설정")
        return _empty_result()

    prompt_template = USER_PROMPT_KO if language == "ko" else USER_PROMPT_EN
    user_msg = prompt_template.format(
        title=title,
        content=content[:4000] if content else "No content available.",
    )

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/medical-news-agent",
                    "X-Title": "Medical News Agent",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 500,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            result = json.loads(raw)
            return {
                "summary": result.get("summary", ""),
                "keywords": result.get("keywords", [])[:10],
                "diseases": result.get("diseases", [])[:10],
            }
    except json.JSONDecodeError as e:
        logger.warning(f"[Summarizer] JSON 파싱 오류: {e}")
        return _empty_result()
    except Exception as e:
        logger.error(f"[Summarizer] LLM 호출 오류: {e}")
        raise


def _empty_result() -> dict:
    return {"summary": "", "keywords": [], "diseases": []}
