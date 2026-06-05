import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

// Reuters 공개 RSS 2023년 폐지 → STAT News + BBC Health로 대체
const FEEDS = [
  'https://www.statnews.com/feed/',
  'https://feeds.bbci.co.uk/news/health/rss.xml',
];

export class ReutersSource extends BaseSource {
  readonly name = 'STAT News';

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
        logger.warn(`[STAT News] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
