import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '의료 뉴스 수집 Agent',
  description: '글로벌 의료·감염병 뉴스 자동 수집 및 AI 분석 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
