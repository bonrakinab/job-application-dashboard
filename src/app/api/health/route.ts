export const dynamic = 'force-dynamic';

function present(...values: Array<string | undefined>) {
  return values.some((value) => Boolean(value));
}

export async function GET() {
  const checks = {
    supabase: present(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL)
      && present(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY),
    dashboardAuth: present(process.env.DASHBOARD_PASSWORD) && present(process.env.AUTH_SECRET),
    openai: present(process.env.OPENAI_API_KEY),
    gmail: present(process.env.GOOGLE_CLIENT_ID)
      && present(process.env.GOOGLE_CLIENT_SECRET)
      && present(process.env.GOOGLE_REFRESH_TOKEN)
      && present(process.env.GMAIL_DIGEST_TO),
    cron: present(process.env.CRON_SECRET),
  };

  return Response.json({
    ok: true,
    mode: checks.supabase ? 'persistent' : 'demo',
    checks,
    note: 'This endpoint reports configuration presence only. It never returns secret values.',
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
