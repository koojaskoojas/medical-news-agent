import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

const FEEDS = [
  'https://medicalxpress.com/rss-feed/',
  'https://medicalxpress.com/rss-feed/medical-research-news/',
  'https://medicalxpress.com/rss-feed/diseases-conditions-news/',
];

export class MedicalXpressSource extends BaseSource {
  readonly name = 'MedicalXpress';

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
        logger.warn(`[MedicalXpress] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
