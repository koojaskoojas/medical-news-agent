import { BaseSource, RawArticle } from './base';
import { logger } from '@/lib/logger';

const ESEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

interface ESearchResult {
  esearchresult: { idlist: string[] };
}

interface ESummaryItem {
  uid: string;
  title: string;
  pubdate: string;
  source: string;
}

interface ESummaryResult {
  result: Record<string, ESummaryItem>;
}

const QUERIES = [
  'infectious disease outbreak[Title/Abstract]',
  'pandemic epidemic surveillance[Title/Abstract]',
  'emerging pathogen zoonosis[Title/Abstract]',
];

export class PubMedSource extends BaseSource {
  readonly name = 'PubMed';

  async fetch(): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    const timeout = parseInt(process.env.CRAWL_TIMEOUT ?? '15000');

    for (const query of QUERIES) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const searchParams = new URLSearchParams({
          db: 'pubmed', term: query, retmax: '10',
          retmode: 'json', sort: 'date',
        });
        const searchRes = await fetch(`${ESEARCH}?${searchParams}`, { signal: controller.signal });
        const searchData = (await searchRes.json()) as ESearchResult;
        const ids = searchData.esearchresult?.idlist ?? [];

        if (ids.length === 0) {
          clearTimeout(timer);
          continue;
        }

        const summaryParams = new URLSearchParams({
          db: 'pubmed', id: ids.join(','), retmode: 'json',
        });
        const summaryRes = await fetch(`${ESUMMARY}?${summaryParams}`, { signal: controller.signal });
        const summaryData = (await summaryRes.json()) as ESummaryResult;
        clearTimeout(timer);

        for (const id of ids) {
          const item = summaryData.result?.[id];
          if (!item?.title) continue;

          articles.push({
            source: this.name,
            title: item.title,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            published_at: this.parseDate(item.pubdate),
            language: this.language,
          });
        }
      } catch (e) {
        logger.warn(`[PubMed] 쿼리 오류 '${query}': ${e}`);
      }
    }
    return articles;
  }
}
