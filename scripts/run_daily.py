"""
일일 수집 + 리포트 생성 실행 스크립트
사용법: python scripts/run_daily.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from src.agents.collector import run_collection
from src.agents.reporter import generate_daily_report
from src.utils.logger import logger


async def main():
    logger.info("=== 일일 의료 뉴스 파이프라인 시작 ===")

    # 1. 뉴스 수집
    result = await run_collection()
    logger.info(f"수집 결과: {result}")

    # 2. 일일 리포트 생성
    report = await generate_daily_report()
    if report:
        logger.info(f"리포트 생성 완료: {report.get('date')} / {report.get('counts', {}).get('total', 0)}건")
    else:
        logger.warning("리포트 생성 실패 (기사 없음)")

    logger.info("=== 파이프라인 완료 ===")


if __name__ == "__main__":
    asyncio.run(main())
