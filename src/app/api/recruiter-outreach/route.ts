import { cookies } from 'next/headers';
import { AUTH_COOKIE, authEnabled, validSession } from '@/lib/auth';
import { loadRecruiterOutreach, saveRecruiterOutreach, validateOutreach } from '@/lib/recruiter-outreach';
export const dynamic = 'force-dynamic';
async function authorized() {
  // JobAgent is a single-owner dashboard; use its existing session, never a client profile ID.
  if (!authEnabled()) return process.env.NODE_ENV !== 'production';
  return validSession((await cookies()).get(AUTH_COOKIE)?.value);
}
export async function GET() {
  if (!await authorized()) return Response.json({error:'Log in to JobAgent to load your pipeline.'},{status:401});
  try {return Response.json({records:await loadRecruiterOutreach()},{headers:{'Cache-Control':'private, no-store'}});}
  catch {return Response.json({error:'Unable to load recruiter outreach from JobAgent. Please retry.'},{status:503});}
}
export async function PUT(request: Request) {
  if (!await authorized()) return Response.json({error:'Log in to JobAgent before saving.'},{status:401});
  const origin=request.headers.get('origin');
  if (origin && origin!==new URL(request.url).origin) return Response.json({error:'Cross-origin write rejected.'},{status:403});
  let body: ReturnType<typeof validateOutreach>;
  try {body=validateOutreach(await request.json());}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid contact data.'},{status:400});}
  try {await saveRecruiterOutreach(body.id,body.record);return Response.json({saved:true});}
  catch {return Response.json({error:'Save failed. Your changes have not been saved; please retry.'},{status:503});}
}
