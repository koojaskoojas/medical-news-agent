export const dynamic = 'force-dynamic';

import type { NewsArticleRow, DailyReportRow, RiskLevel } from '@/types';

const RISK_EMOJI: Record<RiskLevel, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', unknown: '⚪',
};

const RISK_COLOR: Record<RiskLevel, string> = {
  critical: '#fc8181', high: '#f6ad55', medium: '#f6e05e', low: '#68d391', unknown: '#a0aec0',
};

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function getLatestArticles(): Promise<NewsArticleRow[]> {
  const base = process.env.SUPABASE_URL;
  if (!base) { console.error('[Dashboard] SUPABASE_URL not set'); return []; }
  try {
    const params = new URLSearchParams({
      select: 'id,source,title,url,collected_at,summary,risk_level,category,diseases',
      order: 'collected_at.desc',
      limit: '50',
    });
    const res = await fetch(`${base}/rest/v1/news_articles?${params}`, {
      headers: supabaseHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[Dashboard] articles fetch error:', res.status, await res.text());
      return [];
    }
    return await res.json() as NewsArticleRow[];
  } catch (e) {
    console.error('[Dashboard] getLatestArticles error:', e);
    return [];
  }
}

async function getTodayReport(): Promise<DailyReportRow | null> {
  const base = process.env.SUPABASE_URL;
  if (!base) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({
      select: '*',
      report_date: `eq.${today}`,
      limit: '1',
    });
    const res = await fetch(`${base}/rest/v1/daily_reports?${params}`, {
      headers: { ...supabaseHeaders(), Accept: 'application/vnd.pgrst.object+json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json() as DailyReportRow;
  } catch (e) {
    console.error('[Dashboard] getTodayReport error:', e);
    return null;
  }
}

export default async function DashboardPage() {
  const [articles, report] = await Promise.all([getLatestArticles(), getTodayReport()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* 헤더 */}
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #2d3748', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#90cdf4' }}>
          🏥 의료 뉴스 수집 Agent
        </h1>
        <p style={{ color: '#718096', marginTop: '0.25rem' }}>{today} 기준 · 자동 수집 및 AI 분석</p>
      </header>

      {/* 오늘 리포트 요약 */}
      {report && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#a0aec0' }}>
            오늘의 요약
          </h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {(
              [
                { label: '총 기사', value: report.total_articles, color: '#90cdf4' },
                { label: '🔴 위급', value: report.critical_count, color: '#fc8181' },
                { label: '🟠 고위험', value: report.high_count, color: '#f6ad55' },
                { label: '🟡 중위험', value: report.medium_count, color: '#f6e05e' },
                { label: '🟢 저위험', value: report.low_count, color: '#68d391' },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: '#1a202c', borderRadius: 8, padding: '0.75rem 1.25rem',
                  minWidth: 100, textAlign: 'center', border: '1px solid #2d3748',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#718096' }}>{stat.label}</div>
              </div>
            ))}
          </div>
          {report.top_diseases && report.top_diseases.length > 0 && (
            <p style={{ marginTop: '0.75rem', color: '#a0aec0', fontSize: '0.875rem' }}>
              <strong>주요 질병:</strong>{' '}
              {report.top_diseases.slice(0, 8).map((d) => (
                <span key={d} style={{ background: '#2d3748', borderRadius: 4, padding: '2px 6px', marginRight: 4, fontSize: '0.8rem' }}>{d}</span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* 기사 목록 */}
      <section>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#a0aec0' }}>
          최신 기사 ({articles.length}건)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {articles.map((a) => {
            const risk = (a.risk_level as RiskLevel) ?? 'unknown';
            return (
              <article
                key={a.id}
                style={{
                  background: '#1a202c', borderRadius: 8, padding: '1rem',
                  border: `1px solid #2d3748`,
                  borderLeft: `3px solid ${RISK_COLOR[risk]}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{RISK_EMOJI[risk]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: '#90cdf4', fontSize: '0.95rem' }}
                    >
                      {a.title}
                    </a>
                    <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.25rem' }}>
                      {a.source} · {a.category ?? '기타'} ·{' '}
                      {a.collected_at ? new Date(a.collected_at).toLocaleString('ko-KR') : ''}
                    </div>
                    {a.summary && (
                      <p style={{ fontSize: '0.85rem', color: '#a0aec0', marginTop: '0.4rem', lineHeight: 1.5 }}>
                        {a.summary.slice(0, 200)}
                      </p>
                    )}
                    {Array.isArray(a.diseases) && a.diseases.length > 0 && (
                      <div style={{ marginTop: '0.4rem' }}>
                        {a.diseases.slice(0, 5).map((d) => (
                          <span
                            key={d}
                            style={{ background: '#2d3748', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: '0.75rem', color: '#fc8181' }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {articles.length === 0 && (
            <p style={{ color: '#718096', textAlign: 'center', padding: '2rem' }}>
              아직 수집된 기사가 없습니다. <code>npm run collect</code>를 실행해 주세요.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
