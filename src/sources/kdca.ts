import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

// kdca.go.kr 외부 접근 차단 → Google News 한국어 검색으로 대체 (질병관리청·보건복지부 뉴스)
const FEEDS = [
  'https://news.google.com/rss/search?q=%EC%A7%88%EB%B3%91%EA%B4%80%EB%A6%AC%EC%B2%AD+%EA%B0%90%EC%97%BC%EB%B3%91&hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/search?q=%EB%B3%B4%EA%B1%B4%EB%B3%B5%EC%A7%80%EB%B6%80+%EA%B0%90%EC%97%BC%EB%B3%91+%EC%9D%98%EB%A3%8C&hl=ko&gl=KR&ceid=KR:ko',
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
