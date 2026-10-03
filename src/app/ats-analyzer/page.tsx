import type { Metadata } from 'next';
import { AtsAnalyzer } from '@/components/AtsAnalyzer';

export const metadata: Metadata = {
  title: 'ATS Analyzer · Job Dashboard',
  description: 'Compare a résumé with a job description using the dashboard’s ATS, evidence, keyword, formatting, and claim-safety checks.',
};

export default function AtsAnalyzerPage() {
  return <>
    <div className="topbar simple-topbar">
      <div>
        <span className="eyebrow">Résumé checker</span>
        <h1 className="title">ATS Analyzer</h1>
        <div className="sub">Upload a résumé and a job description to get separate scores for every ATS check currently built into the dashboard, with evidence-backed strengths, gaps, and practical improvements.</div>
      </div>
      <a className="btn ghost" href="/settings">Profile settings</a>
    </div>
    <AtsAnalyzer />
  </>;
}
