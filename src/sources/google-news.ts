import Parser from 'rss-parser';
import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const parser = new Parser({ timeout: 15000, maxRedirects: 5 });

const FEEDS: Array<{ label: string; url: string }> = [
  {
    label: 'Health',
    url: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
  },
  {
    label: 'InfectiousDisease',
    url: 'https://news.google.com/rss/search?q=infectious+disease+outbreak&hl=en-US&gl=US&ceid=US:en',
  },
  {
    label: 'Pandemic',
    url: 'https://news.google.com/rss/search?q=pandemic+epidemic+virus+health&hl=en-US&gl=US&ceid=US:en',
  },
];

export class GoogleNewsSource extends BaseSource {
  readonly name = 'GoogleNews';

  async fetch(): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    for (const { label, url } of FEEDS) {
      try {
        const feed = await parser.parseURL(url);
        for (const item of feed.items) {
          if (!item.title || !item.link) continue;
          articles.push({
            source: `${this.name}:${label}`,
            title: this.stripHtml(item.title),
            url: item.link,
            published_at: this.parseDate(item.pubDate ?? item.isoDate),
            summary: item.contentSnippet ?? '',
            language: this.language,
          });
        }
      } catch (e) {
        logger.warn(`[GoogleNews] 피드 오류 ${label}: ${e}`);
      }
    }
    return articles;
  }
}
