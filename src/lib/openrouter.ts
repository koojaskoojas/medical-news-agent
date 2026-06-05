const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface OpenRouterResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const model = options.model ?? process.env.OPENROUTER_MODEL ?? 'openrouter/auto';
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT ?? '30000');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/medical-news-agent',
        'X-Title': 'Medical News Agent',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 600,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${body}`);
    }

    const data = (await res.json()) as OpenRouterResponse;
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonSafe<T>(raw: string): T | null {
  try {
    // JSON 코드 블록 감싸기 제거
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
