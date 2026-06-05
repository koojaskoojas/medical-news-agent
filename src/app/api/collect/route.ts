import { NextRequest, NextResponse } from 'next/server';
import { runCollection } from '@/agents/collector';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 간단한 API 키 보호 (Vercel Secret 또는 직접 호출 모두 지원)
  const authHeader = req.headers.get('authorization');
  const apiKey = process.env.COLLECT_API_KEY;
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runCollection();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'POST only' }, { status: 405 });
}
