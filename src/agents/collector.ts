import { ALL_SOURCES } from '@/sources';
import type { RawArticle } from '@/sources';
import { crawlArticle } from './crawler';
import { analyzeArticle } from './analyzer';
import { computeHash } from '@/lib/hash';
import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { NewsArticleInsert, CollectionResult } from '@/types';

const MAX_PER_SOURCE = parseInt(process.env.MAX_ARTICLES_PER_SOURCE ?? '50');
// 무료 LLM 분당 16회 제한 → 동시 3개 + 배치 간 12초 대기 = 분당 ~15건
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 12000;

// ── Source fetching ───────────────────────────────────────────────────────────

async function fetchAllSources(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(ALL_SOURCES.map((s) => s.fetch()));
  const articles: RawArticle[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const name = ALL_SOURCES[i].name;
    if (r.status === 'fulfilled') {
      const sliced = r.value.slice(0, MAX_PER_SOURCE);
      logger.info(`[Collector] ${name}: ${sliced.length}건`);
      articles.push(...sliced);
    } else {
      logger.error(`[Collector] ${name} 실패: ${r.reason}`);
    }
  }
  return articles;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicate(articles: RawArticle[]): Array<RawArticle & { _hash: string }> {
  const seenHash = new Set<string>();
  const seenUrl = new Set<string>();
  const unique: Array<RawArticle & { _hash: string }> = [];

  for (const a of articles) {
    if (!a.title || !a.url) continue;
    const hash = computeHash(a.title, a.summary ?? '');
    if (seenHash.has(hash) || seenUrl.has(a.url)) continue;
    seenHash.add(hash);
    seenUrl.add(a.url);
    unique.push({ ...a, _hash: hash });
  }

  logger.info(`[Collector] 중복 제거: ${articles.length} → ${unique.length}건`);
  return unique;
}

// ── DB duplicate check (요약 없는 기사는 재처리 허용) ─────────────────────────

async function isStored(url: string): Promise<boolean> {
  try {
    const db = getSupabaseClient();
    const { data } = await db
      .from('news_articles')
      .select('id, summary')
      .eq('url', url)
      .limit(1);
    if (!data || data.length === 0) return false;
    // 요약이 있는 기사만 "이미 처리됨"으로 간주
    return typeof (data[0] as Record<string, unknown>).summary === 'string' &&
      ((data[0] as Record<string, unknown>).summary as string).length > 10;
  } catch {
    return false;
  }
}

// ── Single article pipeline ───────────────────────────────────────────────────

async function processArticle(
  raw: RawArticle & { _hash: string }
): Promise<boolean> {
  if (await isStored(raw.url)) {
    logger.debug(`[Collector] 이미 저장됨: ${raw.url}`);
    return false;
  }

  const content = await crawlArticle(raw.url);
  const textForLLM = content || raw.summary || raw.title;

  // 요약 + 분류를 단일 LLM 호출로 처리
  const analysis = await analyzeArticle(textForLLM ? `${raw.title}\n\n${textForLLM}` : raw.title, '', raw.language);

  const record: NewsArticleInsert = {
    source: raw.source,
    title: raw.title,
    url: raw.url,
    published_at: raw.published_at?.toISOString() ?? null,
    content: content || null,
    summary: analysis.summary || null,
    keywords: analysis.keywords,
    diseases: analysis.diseases,
    risk_level: analysis.risk_level,
    category: analysis.category,
    language: raw.language,
    is_processed: true,
    content_hash: computeHash(raw.title, content),
  };

  try {
    const db = getSupabaseClient();
    const { error } = await db
      .from('news_articles')
      .upsert(record, { onConflict: 'url' });

    if (error) throw error;

    const riskEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', unknown: '⚪' }[analysis.risk_level];
    logger.info(`[Collector] ${riskEmoji} [${analysis.risk_level}][${analysis.category}] ${raw.title.slice(0, 55)}`);
    return true;
  } catch (e) {
    logger.error(`[Collector] DB 저장 오류: ${e}`);
    return false;
  }
}

// ── Concurrency helper (배치 간 지연 포함) ─────────────────────────────────────

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    // 마지막 배치가 아니면 대기 (rate limit 준수)
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function runCollection(): Promise<CollectionResult> {
  const start = Date.now();
  logger.info('=== 의료 뉴스 수집 시작 ===');

  const rawArticles = await fetchAllSources();
  const unique = deduplicate(rawArticles);

  const saved = await runConcurrent(unique, CONCURRENCY, processArticle);
  const savedCount = saved.filter(Boolean).length;

  const elapsed = (Date.now() - start) / 1000;
  logger.info(`=== 수집 완료: ${savedCount}건 저장 / ${elapsed.toFixed(1)}초 ===`);

  return {
    total_fetched: rawArticles.length,
    unique: unique.length,
    saved: savedCount,
    elapsed_seconds: elapsed,
  };
}
