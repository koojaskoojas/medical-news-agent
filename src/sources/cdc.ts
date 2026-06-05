import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

const FEEDS = [
  'https://tools.cdc.gov/api/v2/resources/media/403372.rss',
  'https://emergency.cdc.gov/han/rss.asp',
  'https://www.cdc.gov/mmwr/feeds/rss/wk.xml',
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
