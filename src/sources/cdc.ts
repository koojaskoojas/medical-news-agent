import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

// CDC Emerging Infectious Diseases Journal + CDC 뉴스 (구 RSS 피드 대부분 폐지됨)
const FEEDS = [
  'https://wwwnc.cdc.gov/eid/rss/ahead-of-print.xml',
  'https://news.google.com/rss/search?q=CDC+disease+outbreak+health+alert&hl=en&gl=US&ceid=US:en',
];

export class CDCSource extends BaseSource {
  readonly name = 'CDC';

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
        logger.warn(`[CDC] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
