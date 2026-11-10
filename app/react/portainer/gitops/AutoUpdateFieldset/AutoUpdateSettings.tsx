import { TextTip } from '@@/Tip/TextTip';

import { WebhookSettings } from './WebhookSettings';

export function AutoUpdateSettings({
  baseWebhookUrl,
  webhookId,
  webhookDocs,
}: {
  baseWebhookUrl: string;
  webhookId: string;
  webhookDocs?: string;
}) {
  return (
    <>
      <WebhookSettings
        baseUrl={baseWebhookUrl}
        value={webhookId}
        docsLink={webhookDocs}
      />

      <TextTip color="orange" className="mb-2">
        Any changes to this stack or application that have been made locally via
        Portainer or directly in the cluster will be overwritten by the git
        repository content, which may cause service interruption.
      </TextTip>
    </>
  );
}
