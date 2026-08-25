import { AutomationIntegrationsClient } from '@/components/AutomationIntegrationsClient';
import { listWebhookIntegrations } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const integrations = await listWebhookIntegrations();
  return <>
    <div className="topbar">
      <div>
        <h1 className="title">Automations</h1>
        <div className="sub">Connect an optional webhook for job and application updates.</div>
      </div>
    </div>
    <AutomationIntegrationsClient initialIntegrations={integrations} />
  </>;
}
