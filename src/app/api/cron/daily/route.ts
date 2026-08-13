import { sendDigest } from '@/lib/gmail';
import { runDiscoveryAndAnalysis } from '@/lib/orchestrator';
import { listJobs, logActivity } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron/1.0') ?? false;
}

export async function GET(request: Request) {
  if (!authorizedCron(request)) return new Response('Unauthorized', { status: 401 });
  try {
    const run = await runDiscoveryAndAnalysis();
    const jobs = (await listJobs(200)).filter((j) => j.match && ['exceptional','strong'].includes(j.match.recommendation)).slice(0, 12);
    const lines = jobs.map((j, i) => `${i + 1}. ${j.title} — ${j.company} (${j.location ?? 'location not listed'})\n   Match: ${j.match?.overall}/100 · ${j.match?.recommendation}\n   ${j.url}`);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const text = [`Job Agent daily brief`, `Fetched ${run.fetched} jobs across ${run.sources} sources; ${run.relevant} passed the first relevance filter.`, '', ...lines, '', appUrl ? `Dashboard: ${appUrl}` : ''].join('\n');
    const mail = await sendDigest(`Job Agent: ${jobs.length} strong matches`, text);
    await logActivity('cron.daily.completed', undefined, { run, digestJobs: jobs.length, mailSkipped: mail.skipped });
    return Response.json({ ok: true, run, digestJobs: jobs.length, mail });
  } catch (error) {
    await logActivity('cron.daily.failed', undefined, { error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
