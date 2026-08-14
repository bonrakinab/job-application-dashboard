import { AutomationIntegrationsClient } from '@/components/AutomationIntegrationsClient';
import { listWebhookIntegrations } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const integrations = await listWebhookIntegrations();
  return <>
    <div className="topbar">
      <div>
        <div className="eyebrow">Event-driven workflow layer</div>
        <h1 className="title">n8n & automation hooks</h1>
        <div className="sub">Connect an n8n webhook and receive job-match or application-status events without making the dashboard depend on n8n for its core workflow.</div>
      </div>
    </div>
    <div className="notice">Webhook delivery is optional and non-blocking. Use an HTTPS endpoint. If you configure a shared secret, the dashboard sends it in the X-Job-Agent-Secret header so your workflow can verify the caller.</div>
    <AutomationIntegrationsClient initialIntegrations={integrations} />
  </>;
}
