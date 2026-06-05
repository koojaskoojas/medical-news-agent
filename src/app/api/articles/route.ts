import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { RiskLevel, ArticleCategory } from '@/types';
import { RISK_LEVELS, ARTICLE_CATEGORIES } from '@/types';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const limit = Math.min(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0);
  const riskLevel = searchParams.get('risk_level');
  const category = searchParams.get('category');
  const source = searchParams.get('source');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (riskLevel && !(RISK_LEVELS as string[]).includes(riskLevel)) {
    return NextResponse.json({ error: `invalid risk_level: ${riskLevel}` }, { status: 400 });
  }
  if (category && !(ARTICLE_CATEGORIES as string[]).includes(category)) {
    return NextResponse.json({ error: `invalid category: ${category}` }, { status: 400 });
  }

  try {
    const db = getSupabaseClient();
    let q = db
      .from('news_articles')
      .select('id,source,title,url,published_at,collected_at,summary,keywords,diseases,risk_level,category,language', { count: 'exact' })
      .order('collected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (riskLevel) q = q.eq('risk_level', riskLevel as RiskLevel);
    if (category) q = q.eq('category', category as ArticleCategory);
    if (source) q = q.eq('source', source);
    if (date) {
      q = q.gte('collected_at', `${date}T00:00:00+00:00`).lte('collected_at', `${date}T23:59:59+00:00`);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
