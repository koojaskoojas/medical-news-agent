import os
import json
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from src.utils.logger import logger

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
TIMEOUT = int(os.getenv("LLM_TIMEOUT", "30"))

CATEGORIES = [
    "infectious_disease", "outbreak", "pandemic", "vaccine",
    "pharmaceutical", "clinical_research", "public_health",
    "mental_health", "chronic_disease", "medical_technology", "other",
]

RISK_CRITERIA = """
- critical: Active outbreak, pandemic, bioterrorism, mass casualties, emergency alert
- high: New pathogen, rapid spread, drug-resistant strain, significant mortality
- medium: Disease monitoring, new research findings, regional health concerns
- low: General health news, routine updates, background research
"""

SYSTEM_PROMPT = f"""You are a medical risk assessment system. Classify the article and return JSON with:
- risk_level: one of "critical", "high", "medium", "low"
- category: one of {CATEGORIES}
- risk_reason: one sentence explaining the risk level

Risk level criteria:
{RISK_CRITERIA}

Return only valid JSON."""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def classify(title: str, summary: str, diseases: list[str]) -> dict:
    """위험도와 카테고리를 분류."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return _default_classification()

    user_msg = f"""Title: {title}
Summary: {summary}
Diseases mentioned: {", ".join(diseases) if diseases else "None"}

Classify this article."""

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
                    "temperature": 0.1,
                    "max_tokens": 200,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            result = json.loads(raw)
            return {
                "risk_level": result.get("risk_level", "unknown"),
                "category": result.get("category", "other"),
                "risk_reason": result.get("risk_reason", ""),
            }
    except Exception as e:
        logger.error(f"[Classifier] 분류 오류: {e}")
        raise


def _default_classification() -> dict:
    return {"risk_level": "unknown", "category": "other", "risk_reason": ""}
