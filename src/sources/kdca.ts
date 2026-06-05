import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

const FEEDS = [
  'https://www.kdca.go.kr/board/board.es?mid=a20501000000&bid=0015&act=rss',
  'https://www.kdca.go.kr/board/board.es?mid=a20507020000&bid=0019&act=rss',
];

export class KDCASource extends BaseSource {
  readonly name = 'KDCA';
  readonly language = 'ko' as const;

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
        logger.warn(`[KDCA] 피드 오류 ${feedUrl}: ${e}`);
      }
    }
    return articles;
  }
}
