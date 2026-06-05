import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { DailyReportInsert, NewsArticleRow, RiskLevel, ArticleCategory } from '@/types';

// ── 카운터 헬퍼 ───────────────────────────────────────────────────────────────

function countBy<T>(items: T[], key: keyof T): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const v = String(item[key] ?? 'unknown');
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

function topN(counter: Map<string, number>, n: number): string[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ── 마크다운 빌더 ─────────────────────────────────────────────────────────────

function buildMarkdown(
  reportDate: string,
  articles: NewsArticleRow[],
  counts: { total: number; critical: number; high: number; medium: number; low: number },
  topDiseases: string[],
  topKeywords: string[],
  categoryStats: Map<string, number>
): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const riskEmoji: Record<RiskLevel, string> = {
    critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', unknown: '⚪',
  };

  const lines: string[] = [
    `# 🏥 의료 뉴스 일일 리포트 — ${reportDate}`,
    `> 생성: ${now} | 총 ${counts.total}건`,
    '',
    '## 위험도 요약',
    `| 위급 🔴 | 고위험 🟠 | 중위험 🟡 | 저위험 🟢 | 합계 |`,
    `|:------:|:-------:|:-------:|:-------:|:----:|`,
    `| ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} | ${counts.total} |`,
    '',
    '## 카테고리별 분포',
    ...[...categoryStats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cnt]) => `- **${cat}**: ${cnt}건`),
    '',
    '## 주요 질병·병원체',
    topDiseases.length > 0 ? topDiseases.map((d) => `\`${d}\``).join(' · ') : '해당 없음',
    '',
    '## 핵심 키워드',
    topKeywords.length > 0 ? topKeywords.map((k) => `\`${k}\``).join(' · ') : '해당 없음',
  ];

  const urgent = articles.filter((a) => a.risk_level === 'critical' || a.risk_level === 'high');
  if (urgent.length > 0) {
    lines.push('', '## ⚠️ 주요 뉴스 (위급·고위험)');
    for (const a of urgent.slice(0, 20)) {
      const emoji = riskEmoji[a.risk_level as RiskLevel] ?? '⚪';
      lines.push(
        '',
        `### ${emoji} ${a.title}`,
        `**출처**: ${a.source} | **분류**: ${a.category ?? '기타'} | **위험도**: ${a.risk_level}`,
      );
      if (a.summary) lines.push('', a.summary);
      if (a.diseases?.length > 0) lines.push('', `**질병명**: ${a.diseases.join(', ')}`);
      lines.push('', `🔗 ${a.url}`);
    }
  }

  lines.push('', '## 전체 기사 목록');
  for (const a of articles.slice(0, 100)) {
    const emoji = riskEmoji[a.risk_level as RiskLevel] ?? '⚪';
    lines.push(`- ${emoji} [${a.title}](${a.url}) — ${a.source} · ${a.category ?? '기타'}`);
  }

  return lines.join('\n');
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

export async function generateDailyReport(targetDate?: string): Promise<DailyReportInsert | null> {
  const reportDate = targetDate ?? new Date().toISOString().slice(0, 10);
  const startISO = `${reportDate}T00:00:00+00:00`;
  const endISO = `${reportDate}T23:59:59+00:00`;

  logger.info(`[Reporter] ${reportDate} 리포트 생성 중...`);

  let articles: NewsArticleRow[];
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('news_articles')
      .select('*')
      .gte('collected_at', startISO)
      .lte('collected_at', endISO)
      .order('risk_level', { ascending: true });

    if (error) throw error;
    articles = (data ?? []) as NewsArticleRow[];
  } catch (e) {
    logger.error(`[Reporter] DB 조회 오류: ${e}`);
    return null;
  }

  if (articles.length === 0) {
    logger.info(`[Reporter] ${reportDate} 기사 없음`);
    return null;
  }

  const riskCounter = countBy(articles, 'risk_level');
  const categoryCounter = countBy(articles, 'category');

  const allDiseases = articles.flatMap((a) => a.diseases ?? []);
  const allKeywords = articles.flatMap((a) => a.keywords ?? []);

  const diseaseCounter = new Map<string, number>();
  for (const d of allDiseases) diseaseCounter.set(d, (diseaseCounter.get(d) ?? 0) + 1);

  const keywordCounter = new Map<string, number>();
  for (const k of allKeywords) keywordCounter.set(k, (keywordCounter.get(k) ?? 0) + 1);

  const topDiseases = topN(diseaseCounter, 15);
  const topKeywords = topN(keywordCounter, 15);

  const counts = {
    total: articles.length,
    critical: riskCounter.get('critical') ?? 0,
    high: riskCounter.get('high') ?? 0,
    medium: riskCounter.get('medium') ?? 0,
    low: riskCounter.get('low') ?? 0,
  };

  const markdown = buildMarkdown(reportDate, articles, counts, topDiseases, topKeywords, categoryCounter);

  const report: DailyReportInsert = {
    report_date: reportDate,
    total_articles: counts.total,
    critical_count: counts.critical,
    high_count: counts.high,
    medium_count: counts.medium,
    low_count: counts.low,
    top_diseases: topDiseases,
    top_keywords: topKeywords,
    report_markdown: markdown,
    report_json: {
      date: reportDate,
      counts,
      top_diseases: topDiseases,
      top_keywords: topKeywords,
      category_stats: Object.fromEntries(categoryCounter),
      articles: articles.map((a) => ({
        title: a.title, url: a.url, source: a.source,
        risk_level: a.risk_level, category: a.category,
        summary: a.summary, diseases: a.diseases,
      })),
    },
  };

  try {
    const db = getSupabaseClient();
    const { error } = await db
      .from('daily_reports')
      .upsert(report, { onConflict: 'report_date' });
    if (error) throw error;
    logger.info(`[Reporter] 저장 완료: ${reportDate}, ${counts.total}건`);
  } catch (e) {
    logger.error(`[Reporter] DB 저장 오류: ${e}`);
  }

  return report;
}
