import json
from datetime import date, datetime, timezone, timedelta
from collections import Counter
from src.db.client import get_client
from src.db.models import DailyReport
from src.utils.logger import logger


def _build_markdown(report_date: str, articles: list, counts: dict, top_diseases: list, top_keywords: list) -> str:
    lines = [
        f"# 의료 뉴스 일일 리포트 — {report_date}",
        f"\n> 생성 시각: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "\n## 요약 통계",
        f"- 총 수집 기사: **{counts['total']}건**",
        f"- 🔴 위급(Critical): {counts['critical']}건",
        f"- 🟠 고위험(High): {counts['high']}건",
        f"- 🟡 중위험(Medium): {counts['medium']}건",
        f"- 🟢 저위험(Low): {counts['low']}건",
        "\n## 주요 질병/병원체",
        ", ".join(top_diseases) if top_diseases else "해당 없음",
        "\n## 핵심 키워드",
        ", ".join(top_keywords) if top_keywords else "해당 없음",
    ]

    # 위급/고위험 기사 목록
    critical_articles = [a for a in articles if a.get("risk_level") in ("critical", "high")]
    if critical_articles:
        lines.append("\n## 주요 뉴스 (위급·고위험)")
        for a in critical_articles[:20]:
            risk_emoji = "🔴" if a.get("risk_level") == "critical" else "🟠"
            lines.append(f"\n### {risk_emoji} {a.get('title', '')}")
            lines.append(f"**출처**: {a.get('source', '')} | **분류**: {a.get('category', '')}")
            if a.get("summary"):
                lines.append(f"\n{a['summary']}")
            if a.get("diseases"):
                lines.append(f"\n**질병명**: {', '.join(a['diseases'])}")
            lines.append(f"\n🔗 [{a.get('url', '')}]({a.get('url', '')})")

    # 전체 기사 목록 (최대 50건)
    lines.append("\n## 전체 기사 목록")
    for a in articles[:50]:
        risk = a.get("risk_level", "unknown")
        emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(risk, "⚪")
        lines.append(f"- {emoji} [{a.get('title','')}]({a.get('url','')}) — {a.get('source','')}")

    return "\n".join(lines)


async def generate_daily_report(target_date: date | None = None) -> dict:
    """당일 수집 기사로 일일 리포트 생성 후 DB 저장."""
    if target_date is None:
        target_date = date.today()

    report_date_str = target_date.isoformat()
    start_dt = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)

    logger.info(f"[Reporter] {report_date_str} 리포트 생성 중...")

    try:
        db = get_client()
        res = db.table("news_articles") \
            .select("*") \
            .gte("collected_at", start_dt.isoformat()) \
            .lt("collected_at", end_dt.isoformat()) \
            .order("risk_level") \
            .execute()
        articles = res.data or []
    except Exception as e:
        logger.error(f"[Reporter] DB 조회 오류: {e}")
        return {}

    if not articles:
        logger.info(f"[Reporter] {report_date_str} 기사 없음")
        return {}

    risk_counter = Counter(a.get("risk_level", "unknown") for a in articles)
    disease_counter = Counter(d for a in articles for d in (a.get("diseases") or []))
    keyword_counter = Counter(k for a in articles for k in (a.get("keywords") or []))

    top_diseases = [d for d, _ in disease_counter.most_common(15)]
    top_keywords = [k for k, _ in keyword_counter.most_common(15)]

    counts = {
        "total": len(articles),
        "critical": risk_counter.get("critical", 0),
        "high": risk_counter.get("high", 0),
        "medium": risk_counter.get("medium", 0),
        "low": risk_counter.get("low", 0),
    }

    markdown = _build_markdown(report_date_str, articles, counts, top_diseases, top_keywords)
    report_json = {
        "date": report_date_str,
        "counts": counts,
        "top_diseases": top_diseases,
        "top_keywords": top_keywords,
        "articles": [
            {
                "title": a.get("title"),
                "url": a.get("url"),
                "source": a.get("source"),
                "risk_level": a.get("risk_level"),
                "category": a.get("category"),
                "summary": a.get("summary"),
                "diseases": a.get("diseases"),
                "keywords": a.get("keywords"),
            }
            for a in articles
        ],
    }

    report = DailyReport(
        report_date=report_date_str,
        **counts,
        top_diseases=top_diseases,
        top_keywords=top_keywords,
        report_markdown=markdown,
        report_json=report_json,
    )

    try:
        db = get_client()
        db.table("daily_reports").upsert(
            report.model_dump(mode="json"),
            on_conflict="report_date",
        ).execute()
        logger.info(f"[Reporter] 리포트 저장 완료: {report_date_str}, {counts['total']}건")
    except Exception as e:
        logger.error(f"[Reporter] 리포트 DB 저장 오류: {e}")

    # 마크다운 파일로도 저장
    import os
    os.makedirs("reports", exist_ok=True)
    with open(f"reports/{report_date_str}.md", "w", encoding="utf-8") as f:
        f.write(markdown)
    logger.info(f"[Reporter] 파일 저장: reports/{report_date_str}.md")

    return report_json
