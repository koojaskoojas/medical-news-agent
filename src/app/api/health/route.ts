import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', service: 'medical-news-agent', ts: new Date().toISOString() });
}
