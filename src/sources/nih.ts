import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

// NIH 공식 RSS는 Cloudflare가 봇 차단 → ScienceDaily로 대체 (NIH 연구 집중 보도)
const FEEDS = [
  'https://www.sciencedaily.com/rss/health_medicine.xml',
  'https://www.sciencedaily.com/rss/top/health.xml',
];

export class NIHSource extends BaseSource {
  readonly name = 'ScienceDaily';

  async fetch(): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    for (const feedUrl of FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const item of feed.items) {
          if (!item.title || !item.link) continue;
          articles.push({
            source: this.name,
            title: this.stripHtml(item.title),
            url: item.link,
            published_at: this.parseDate(item.pubDate ?? item.isoDate),
            summary: item.contentSnippet ?? '',
            language: this.language,
          });
        }
      } catch (e) {
        logger.warn(`[ScienceDaily] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
