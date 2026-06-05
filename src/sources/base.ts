export interface RawArticle {
  source: string;
  title: string;
  url: string;
  published_at?: Date;
  summary?: string;
  language: 'ko' | 'en';
}

export abstract class BaseSource {
  abstract readonly name: string;
  readonly language: 'ko' | 'en' = 'en';

  abstract fetch(): Promise<RawArticle[]>;

  protected parseDate(raw: unknown): Date | undefined {
    if (raw == null) return undefined;
    const d = new Date(String(raw));
    return isNaN(d.getTime()) ? undefined : d;
  }

  protected stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
