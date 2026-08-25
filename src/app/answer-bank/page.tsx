import { AnswerBankClient } from '@/components/AnswerBankClient';
import { listAnswerBank } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AnswerBankPage() {
  const entries = await listAnswerBank();
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Saved answers</h1>
        <div className="sub">Reuse your approved answers for common application questions.</div>
      </div>
    </div>
    <AnswerBankClient initialEntries={entries} />
  </>;
}
