import { buildManualJob, ManualJobInputError, type ManualJobInput } from '@/lib/manual-job';
import { logActivity, saveDiscoveredJobs } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const input = await request.json() as ManualJobInput;
    const job = buildManualJob(input);
    await saveDiscoveredJobs([job]);
    try {
      await logActivity('job.manual.created', job.id, {
        jobId: job.id,
        company: job.company,
        title: job.title,
        hasApplicationUrl: Boolean(job.applyUrl),
        at: new Date().toISOString(),
      });
    } catch {
      // Activity logging must not prevent the user from adding a job.
    }
    return Response.json({ jobId: job.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ManualJobInputError || error instanceof SyntaxError) {
      return Response.json({ error: error.message || 'Invalid job details.' }, { status: 400 });
    }
    return Response.json({
      error: error instanceof Error ? error.message : 'The job could not be saved.',
    }, { status: 500 });
  }
}
