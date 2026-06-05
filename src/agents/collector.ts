import { ALL_SOURCES } from '@/sources';
import type { RawArticle } from '@/sources';
import { crawlArticle } from './crawler';
import { summarize } from './summarizer';
import { classify } from './classifier';
import { computeHash } from '@/lib/hash';
import { getSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { NewsArticleInsert, CollectionResult } from '@/types';

const MAX_PER_SOURCE = parseInt(process.env.MAX_ARTICLES_PER_SOURCE ?? '50');
const CONCURRENCY = 5;

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

// ── DB duplicate check ────────────────────────────────────────────────────────

async function isStored(url: string): Promise<boolean> {
  try {
    const db = getSupabaseClient();
    const { data } = await db
      .from('news_articles')
      .select('id')
      .eq('url', url)
      .limit(1);
    return (data?.length ?? 0) > 0;
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
  const textForLLM = content || raw.summary || '';

  const [llmResult, clsResult] = await Promise.all([
    summarize(raw.title, textForLLM, raw.language),
    classify(raw.title, raw.summary ?? '', []),
  ]);

  // 요약 결과로 재분류 (diseases 정보 포함)
  const finalCls = llmResult.diseases.length > 0
    ? await classify(raw.title, llmResult.summary, llmResult.diseases)
    : clsResult;

  const record: NewsArticleInsert = {
    source: raw.source,
    title: raw.title,
    url: raw.url,
    published_at: raw.published_at?.toISOString() ?? null,
    content: content || null,
    summary: llmResult.summary || null,
    keywords: llmResult.keywords,
    diseases: llmResult.diseases,
    risk_level: finalCls.risk_level,
    category: finalCls.category,
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

    const riskEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', unknown: '⚪' }[finalCls.risk_level];
    logger.info(`[Collector] ${riskEmoji} [${finalCls.risk_level}][${finalCls.category}] ${raw.title.slice(0, 55)}`);
    return true;
  } catch (e) {
    logger.error(`[Collector] DB 저장 오류: ${e}`);
    return false;
  }
}

// ── Concurrency helper ────────────────────────────────────────────────────────

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
