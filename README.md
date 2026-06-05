# 의료 뉴스 수집 Agent

WHO, CDC, NIH, PubMed 등 글로벌 의료/감염병 뉴스를 자동 수집하고, OpenRouter.ai LLM으로 요약·분류하여 Supabase에 저장하는 프로덕션 수준 에이전트입니다.

## 기능

| 기능 | 설명 |
|------|------|
| 자동 수집 | 8개 소스에서 RSS/API로 뉴스 수집 |
| 본문 크롤링 | readability 기반 본문 추출 및 정제 |
| LLM 요약 | 3줄 요약, 키워드 5개, 질병명 추출 |
| 위험도 분류 | critical / high / medium / low |
| 중복 제거 | SHA-256 해시 기반 deduplication |
| 일일 리포트 | 마크다운 리포트 자동 생성 |
| Vercel 배포 | Serverless API 엔드포인트 |
| 자동 스케줄 | GitHub Actions (매일 KST 15:00) |

## 뉴스 소스

- WHO (Disease Outbreak News)
- CDC (Newsroom, Health Alert Network, MMWR)
- NIH / NIAID
- PubMed (infectious disease 검색)
- MedicalXpress
- Google News Health
- Reuters Health
- 한국 질병관리청 (KDCA)

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 키 입력
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 실행

```bash
# 일회성 실행
python scripts/run_daily.py

# 개별 단계 실행 (Python REPL)
from src.agents.collector import run_collection
import asyncio
asyncio.run(run_collection())
```

## API 엔드포인트 (Vercel)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 헬스체크 |
| POST | `/api/collect` | 수집 실행 |
| GET | `/api/articles?risk_level=high&limit=20` | 기사 조회 |
| POST | `/api/report` | 리포트 생성 |
| GET | `/api/report?date=2026-06-05` | 리포트 조회 |

## 환경 변수

| 변수 | 설명 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key |
| `OPENROUTER_API_KEY` | OpenRouter API 키 |
| `OPENROUTER_MODEL` | 사용 모델 (기본: `openrouter/auto`) |
| `MAX_ARTICLES_PER_SOURCE` | 소스당 최대 기사 수 (기본: 50) |

## GitHub Secrets 설정

1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. 다음 시크릿 추가:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENROUTER_API_KEY`

## Vercel 배포

```bash
vercel --prod
```

Vercel 프로젝트 환경 변수에 동일한 키 추가 필요.
