import { chat, parseJsonSafe } from '@/lib/openrouter';
import { logger } from '@/lib/logger';
import type { ClassificationResult, RiskLevel, ArticleCategory } from '@/types';
import { ARTICLE_CATEGORIES, RISK_LEVELS } from '@/types';

const SYSTEM_PROMPT = `You are a medical news risk and category classifier.

## Categories (choose exactly one Korean label):
- 감염병: Infectious diseases, outbreaks, pandemics, epidemics, bacteria, viruses, parasites, zoonosis
- 만성질환: Chronic diseases, cancer, diabetes, cardiovascular, neurodegenerative, obesity
- 백신: Vaccines, vaccination programs, immunization, vaccine safety/efficacy
- 제약/신약: New drugs, drug approvals, clinical trials, FDA/EMA, pharmaceutical
- 공공보건: Public health policy, epidemiology, health statistics, prevention, health education
- AI 의료: AI in medicine, machine learning diagnostics, digital health, health tech, wearables
- 병원/의료정책: Hospitals, healthcare systems, insurance, medical workforce, health regulations
- 기타: Any medical news that does not fit the above categories

## Risk levels:
- critical: Active outbreak, declared pandemic/emergency, bioterrorism, mass casualties
- high: Novel pathogen identified, rapid multi-country spread, drug-resistant strain, high mortality event
- medium: Emerging health concern, new research findings, regional outbreak under control
- low: Routine health news, general research updates, informational articles

Return a JSON object with exactly:
{ "risk_level": "<one of: critical|high|medium|low>", "category": "<Korean label>", "risk_reason": "<one sentence>" }

No extra text. No markdown.`;

function buildPrompt(title: string, summary: string, diseases: string[]): string {
  return `Title: ${title}
Summary: ${summary || '(none)'}
Diseases/Pathogens: ${diseases.length > 0 ? diseases.join(', ') : 'none'}

Classify this article.`;
}

function isValidRiskLevel(v: unknown): v is RiskLevel {
  return typeof v === 'string' && (RISK_LEVELS as string[]).includes(v);
}

function isValidCategory(v: unknown): v is ArticleCategory {
  return typeof v === 'string' && (ARTICLE_CATEGORIES as string[]).includes(v);
}

export async function classify(
  title: string,
  summary: string,
  diseases: string[]
): Promise<ClassificationResult> {
  const fallback: ClassificationResult = {
    risk_level: 'unknown',
    category: '기타',
    risk_reason: '',
  };

  if (!process.env.OPENROUTER_API_KEY) return fallback;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(title, summary, diseases) },
        ],
        { temperature: 0.1, maxTokens: 200, jsonMode: true }
      );

      const parsed = parseJsonSafe<Record<string, unknown>>(raw);
      if (!parsed) {
        logger.warn(`[Classifier] JSON 파싱 실패 (시도 ${attempt})`);
        continue;
      }

      return {
        risk_level: isValidRiskLevel(parsed.risk_level) ? parsed.risk_level : 'unknown',
        category: isValidCategory(parsed.category) ? parsed.category : '기타',
        risk_reason: typeof parsed.risk_reason === 'string' ? parsed.risk_reason : '',
      };
    } catch (e) {
      lastError = e;
      logger.warn(`[Classifier] LLM 오류 (시도 ${attempt}): ${e}`);
      if (attempt < 3) await sleep(attempt * 2000);
    }
  }

  logger.error(`[Classifier] 3회 실패: ${lastError}`);
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
