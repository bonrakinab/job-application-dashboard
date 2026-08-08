import { runDiscoveryAndAnalysis } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST() {
  try { return Response.json(await runDiscoveryAndAnalysis()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
