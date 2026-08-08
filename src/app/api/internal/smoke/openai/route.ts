import { verifyGitHubActionsOidc } from '@/lib/github-actions-oidc';
import { analyzeJobWithAI, createApplicationPack } from '@/lib/openai';
import { getCandidateProfile, listJobs, logActivity, saveApplicationPack, saveMatch } from '@/lib/store';
import { supabaseRequest } from '@/lib/supabase-rest';
import type { JobWithMatch } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const COMPLETED_EVENT = 'production.openai_smoke.completed';

function titlePriority(job: JobWithMatch) {
  const title = job.title.toLowerCase();
  if (title.includes('machine learning')) return 40;
  if (title.includes('ai ')) return 35;
  if (title.includes('data scientist')) return 30;
  if (title.includes('software engineer')) return 20;
  return 0;
}

function eligible(job: JobWithMatch) {
  const match = job.match;
  return Boolean(
    match
    && !match.blockers.length
    && ['exceptional', 'strong'].includes(match.recommendation)
    && !/\b(senior|staff|principal|manager|director|lead)\b/i.test(job.title),
  );
}

export async function POST(request: Request) {
  try {
    await verifyGitHubActionsOidc(request);

    const completed = await supabaseRequest<Array<{ id: number; payload: unknown }>>(
      `activity_log?event=eq.${encodeURIComponent(COMPLETED_EVENT)}&select=id,payload&order=created_at.desc&limit=1`,
    );
    if (completed[0]) {
      return Response.json({ ok: true, alreadyCompleted: true, previous: completed[0].payload });
    }

    const [profile, jobs] = await Promise.all([getCandidateProfile(), listJobs(200)]);
    const candidates = jobs
      .filter(eligible)
      .sort((a, b) => (titlePriority(b) + (b.match?.overall ?? 0)) - (titlePriority(a) + (a.match?.overall ?? 0)))
      .slice(0, 5);

    if (!candidates.length) throw new Error('No strong, unblocked individual-contributor job is available for the OpenAI smoke test.');

    let selected: JobWithMatch | undefined;
    let aiMatch: Awaited<ReturnType<typeof analyzeJobWithAI>> | undefined;

    for (const job of candidates) {
      const analyzed = await analyzeJobWithAI(job, profile);
      await saveMatch(job.id!, analyzed);
      if (!analyzed.model?.startsWith('gpt-')) {
        throw new Error(`OpenAI analysis did not run successfully: ${analyzed.explanation}`);
      }
      if (!analyzed.blockers.length && analyzed.recommendation !== 'skip') {
        selected = job;
        aiMatch = analyzed;
        break;
      }
    }

    if (!selected || !aiMatch) throw new Error('OpenAI analysis ran, but every smoke-test candidate was classified as blocked/skip.');

    const { pack, model: packModel } = await createApplicationPack(selected, profile, aiMatch);
    await saveApplicationPack(selected.id!, pack, packModel);

    const payload = {
      jobId: selected.id,
      company: selected.company,
      title: selected.title,
      analysisModel: aiMatch.model,
      packModel,
      recommendation: aiMatch.recommendation,
      overall: aiMatch.overall,
      claimsAudited: pack.claimsAudit.length,
      generatedAt: new Date().toISOString(),
    };
    await logActivity(COMPLETED_EVENT, selected.id, payload);

    return Response.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await logActivity('production.openai_smoke.failed', undefined, { message, failedAt: new Date().toISOString() });
    } catch {
      // Do not mask the primary smoke-test failure if logging also fails.
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
