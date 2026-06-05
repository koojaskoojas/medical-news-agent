import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

const FEEDS = [
  'https://www.who.int/rss-feeds/news-english.xml',
  'https://www.who.int/feeds/entity/csr/don/en/rss.xml',
];

export class WHOSource extends BaseSource {
  readonly name = 'WHO';

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
        logger.warn(`[WHO] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
