import { chat, parseJsonSafe } from '@/lib/openrouter';
import { logger } from '@/lib/logger';
import type { LLMSummaryResult } from '@/types';

const SYSTEM_PROMPT = `You are a medical news analyst. Analyze the article and return a JSON object with exactly these fields:
- "summary": 3-sentence factual summary (use the article's language — Korean if Korean, English if English)
- "keywords": array of exactly 5 key terms as strings
- "diseases": array of disease/pathogen names mentioned (strings); return empty array if none

Return only valid JSON. No explanation, no markdown fences.`;

function buildUserPrompt(title: string, content: string, language: 'ko' | 'en'): string {
  const label = language === 'ko' ? '기사 제목' : 'Article title';
  const contentLabel = language === 'ko' ? '기사 내용' : 'Article content';
  return `${label}: ${title}\n\n${contentLabel}:\n${content.slice(0, 4000) || '(no content)'}`;
}

export async function summarize(
  title: string,
  content: string,
  language: 'ko' | 'en' = 'en'
): Promise<LLMSummaryResult> {
  const empty: LLMSummaryResult = { summary: '', keywords: [], diseases: [] };

  if (!process.env.OPENROUTER_API_KEY) {
    logger.error('[Summarizer] OPENROUTER_API_KEY 미설정');
    return empty;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(title, content, language) },
        ],
        { temperature: 0.2, maxTokens: 600, jsonMode: true }
      );

      const parsed = parseJsonSafe<Record<string, unknown>>(raw);
      if (!parsed) {
        logger.warn(`[Summarizer] JSON 파싱 실패 (시도 ${attempt})`);
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
      };
    } catch (e) {
      lastError = e;
      logger.warn(`[Summarizer] LLM 오류 (시도 ${attempt}): ${e}`);
      if (attempt < 3) await sleep(attempt * 2000);
    }
  }

  logger.error(`[Summarizer] 3회 실패: ${lastError}`);
  return empty;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
