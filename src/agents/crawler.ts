import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { truncate } from '@/lib/text-cleaner';
import { logger } from '@/lib/logger';

const MAX_CONTENT = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; MedNewsBot/1.0)';

export async function crawlArticle(url: string): Promise<string> {
  const timeoutMs = parseInt(process.env.CRAWL_TIMEOUT ?? '15000');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) {
      logger.warn(`[Crawler] HTTP ${res.status}: ${url}`);
      return '';
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document as unknown as Document);
    const article = reader.parse();

    if (!article?.textContent) return '';

    const cleaned = article.textContent
      .replace(/\s+/g, ' ')
      .trim();

    return truncate(cleaned, MAX_CONTENT);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      logger.warn(`[Crawler] 타임아웃: ${url}`);
    } else {
      logger.warn(`[Crawler] 오류 ${url}: ${e}`);
    }
    return '';
  } finally {
    clearTimeout(timer);
  }
}
