import { atsAnalyzerReportPdf, isAtsAnalyzerResult } from '@/lib/ats-report-pdf';
import { slug } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!isAtsAnalyzerResult(payload)) {
      return Response.json({ error: 'The ATS report data is incomplete or invalid.' }, { status: 400 });
    }
    const pdf = atsAnalyzerReportPdf(payload);
    const filename = `${slug(payload.job.company) || 'company'}-${slug(payload.job.title) || 'role'}-ats-report.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
