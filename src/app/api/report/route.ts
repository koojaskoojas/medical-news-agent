import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReport } from '@/agents/reporter';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as { date?: string };
    const targetDate = body.date ?? undefined;
    const report = await generateDailyReport(targetDate);
    if (!report) {
      return NextResponse.json({ message: '해당 날짜에 기사가 없습니다.' }, { status: 204 });
    }
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const reportDate = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('daily_reports')
      .select('*')
      .eq('report_date', reportDate)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: `${reportDate} 리포트 없음` }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
