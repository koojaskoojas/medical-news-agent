export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type ArticleCategory =
  | '감염병'
  | '만성질환'
  | '백신'
  | '제약/신약'
  | '공공보건'
  | 'AI 의료'
  | '병원/의료정책'
  | '기타';

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  '감염병', '만성질환', '백신', '제약/신약',
  '공공보건', 'AI 의료', '병원/의료정책', '기타',
];

export const RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'unknown'];

// ── Raw article from RSS/API ──────────────────────────────────────────────────

export interface RawArticle {
  source: string;
  title: string;
  url: string;
  published_at?: Date;
  summary?: string;
  language: 'ko' | 'en';
}

// ── Supabase row shapes ───────────────────────────────────────────────────────

export interface NewsArticleInsert {
  source: string;
  title: string;
  url: string;
  published_at?: string | null;
  content?: string | null;
  summary?: string | null;
  keywords?: string[];
  diseases?: string[];
  risk_level?: RiskLevel;
  category?: ArticleCategory | null;
  language?: string;
  is_processed?: boolean;
  content_hash?: string | null;
}

export interface NewsArticleRow extends Required<NewsArticleInsert> {
  id: string;
  collected_at: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReportInsert {
  report_date: string;
  total_articles: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  top_diseases: string[];
  top_keywords: string[];
  report_markdown?: string | null;
  report_json?: Record<string, unknown> | null;
}

export interface DailyReportRow extends DailyReportInsert {
  id: string;
  created_at: string;
}

// ── LLM result shapes ─────────────────────────────────────────────────────────

export interface LLMSummaryResult {
  summary: string;
  keywords: string[];
  diseases: string[];
}

export interface ClassificationResult {
  risk_level: RiskLevel;
  category: ArticleCategory;
  risk_reason: string;
}

// ── Pipeline result ───────────────────────────────────────────────────────────

export interface CollectionResult {
  total_fetched: number;
  unique: number;
  saved: number;
  elapsed_seconds: number;
}
