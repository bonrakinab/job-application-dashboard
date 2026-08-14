import { rankAnswerBankEntries, tailorApplicationAnswer } from '@/lib/answer-tailoring';
import { getJob, listAnswerBank } from '@/lib/store';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as { question?: string };
    const question = body.question?.trim() ?? '';
    if (!question) return Response.json({ error: 'Application question is required.' }, { status: 400 });
    if (question.length > 1200) return Response.json({ error: 'Application question is too long.' }, { status: 400 });
    const [job, entries] = await Promise.all([getJob(id), listAnswerBank()]);
    if (!job) return Response.json({ error: 'Job not found.' }, { status: 404 });
    const ranked = rankAnswerBankEntries(entries.filter((entry) => entry.answer.trim()), question, job);
    const base = ranked[0];
    if (!base) return Response.json({ error: 'No completed answer-bank entry is available yet.' }, { status: 404 });
    const tailored = await tailorApplicationAnswer(question, base.answer, job);
    return Response.json({
      question,
      matchedBaseQuestion: base.question,
      matchedTags: base.tags,
      answer: tailored.answer,
      provider: tailored.provider,
      model: tailored.model,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
