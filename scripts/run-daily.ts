import 'dotenv/config';
import { runCollection } from '../src/agents/collector';
import { generateDailyReport } from '../src/agents/reporter';
import { logger } from '../src/lib/logger';

async function main(): Promise<void> {
  logger.info('=== 의료 뉴스 일일 파이프라인 시작 ===');

  const collectResult = await runCollection();
  logger.info(
    `[Pipeline] 수집 결과: 총 ${collectResult.total_fetched}건 → 고유 ${collectResult.unique}건 → 저장 ${collectResult.saved}건 (${collectResult.elapsed_seconds.toFixed(1)}초)`
  );

  const report = await generateDailyReport();
  if (report) {
    logger.info(
      `[Pipeline] 리포트 완료: ${report.report_date} / 총 ${report.total_articles}건 / 위급 ${report.critical_count}건`
    );
  } else {
    logger.warn('[Pipeline] 리포트 생성 실패 (기사 없음 또는 오류)');
  }

  logger.info('=== 파이프라인 완료 ===');
}

main().catch((e) => {
  logger.error(`[Pipeline] 치명적 오류: ${e}`);
  process.exit(1);
});
