import { AnswerBankClient } from '@/components/AnswerBankClient';
import { listAnswerBank } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AnswerBankPage() {
  const entries = await listAnswerBank();
  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Reusable application evidence</div>
        <h1 className="title">Application answer bank</h1>
        <div className="sub">Keep approved, truthful base answers for recurring application questions. Reuse the facts, then adapt the wording to the specific role rather than rewriting from scratch.</div>
      </div>
    </div>
    <div className="notice">The answer bank never adds experience on its own. Save only answers you are comfortable reusing, especially for work authorization, salary and technical-experience questions.</div>
    <AnswerBankClient initialEntries={entries} />
  </>;
}
