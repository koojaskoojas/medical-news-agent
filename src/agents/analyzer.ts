import { chat, parseJsonSafe } from '@/lib/openrouter';
import { logger } from '@/lib/logger';
import type { RiskLevel, ArticleCategory } from '@/types';
import { ARTICLE_CATEGORIES, RISK_LEVELS } from '@/types';

export interface AnalysisResult {
  summary: string;
  keywords: string[];
  diseases: string[];
  risk_level: RiskLevel;
  category: ArticleCategory;
  risk_reason: string;
}

const SYSTEM_PROMPT = `You are a medical news analyst and risk classifier. Analyze the given article and return a single JSON object with ALL of these fields:

- "summary": 3-sentence factual summary. Use the article's language (Korean if the article is in Korean).
- "keywords": array of exactly 5 key terms as strings
- "diseases": array of disease/pathogen names mentioned; return [] if none
- "risk_level": one of exactly: critical | high | medium | low
  · critical = active outbreak, declared pandemic/emergency, mass casualties
  · high = novel pathogen, rapid multi-country spread, drug-resistant strain
  · medium = emerging concern, regional outbreak under control, new research
  · low = routine health news, general research, informational
- "category": one of exactly these Korean labels:
  감염병 | 만성질환 | 백신 | 제약/신약 | 공공보건 | AI 의료 | 병원/의료정책 | 기타
- "risk_reason": one sentence explaining the risk level

Return ONLY valid JSON. No markdown, no explanation.`;

function buildPrompt(title: string, content: string, language: 'ko' | 'en'): string {
  const label = language === 'ko' ? '기사 제목' : 'Article title';
  const contentLabel = language === 'ko' ? '기사 내용' : 'Article content';
  return `${label}: ${title}\n\n${contentLabel}:\n${content.slice(0, 4000) || '(no content available)'}`;
}

function isValidRiskLevel(v: unknown): v is RiskLevel {
  return typeof v === 'string' && (RISK_LEVELS as string[]).includes(v);
}

function isValidCategory(v: unknown): v is ArticleCategory {
  return typeof v === 'string' && (ARTICLE_CATEGORIES as string[]).includes(v);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function analyzeArticle(
  title: string,
  content: string,
  language: 'ko' | 'en' = 'en'
): Promise<AnalysisResult> {
  const fallback: AnalysisResult = {
    summary: '',
    keywords: [],
    diseases: [],
    risk_level: 'unknown' as RiskLevel,
    category: '기타',
    risk_reason: '',
  };

  if (!process.env.OPENROUTER_API_KEY) return fallback;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const raw = await chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(title, content, language) },
        ],
        { temperature: 0.2, maxTokens: 700, jsonMode: true }
      );

      const parsed = parseJsonSafe<Record<string, unknown>>(raw);
      if (!parsed) {
        logger.warn(`[Analyzer] JSON 파싱 실패 (시도 ${attempt})`);
        continue;
      }

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        keywords: Array.isArray(parsed.keywords)
          ? (parsed.keywords as unknown[]).filter((k): k is string => typeof k === 'string').slice(0, 10)
          : [],
        diseases: Array.isArray(parsed.diseases)
          ? (parsed.diseases as unknown[]).filter((d): d is string => typeof d === 'string').slice(0, 10)
          : [],
        risk_level: isValidRiskLevel(parsed.risk_level) ? parsed.risk_level : 'low',
        category: isValidCategory(parsed.category) ? parsed.category : '기타',
        risk_reason: typeof parsed.risk_reason === 'string' ? parsed.risk_reason : '',
      };
    } catch (e) {
      lastError = e;
      const msg = String(e);
      // 429 rate-limit: 더 오래 대기
      const is429 = msg.includes('429') || msg.includes('rate');
      const waitMs = is429 ? 15000 + attempt * 5000 : attempt * 3000;
      logger.warn(`[Analyzer] LLM 오류 (시도 ${attempt}, ${waitMs}ms 대기): ${msg.slice(0, 80)}`);
      if (attempt < 4) await sleep(waitMs);
    }
  }

  logger.error(`[Analyzer] 4회 실패: ${lastError}`);
  return fallback;
}
